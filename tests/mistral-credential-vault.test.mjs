import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {deriveKey} from "../vault.mjs";
import {CREDENTIAL_ID,sealMistralCredential,unsealMistralCredential,validStoredMistralCredential,
 saveMistralCredential,loadMistralCredential,hasStoredMistralCredential,deleteMistralCredential} from "../mistral-credential-vault.mjs";
if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;
const SECRET="mistral-test-cle-confidentielle-NE-JAMAIS-PUBLIER-001";
const password="ma phrase secrete suffisamment robuste pour le test";
const makeSession=async()=>{
 const key=await deriveKey(password,webcrypto.getRandomValues(new Uint8Array(16)),300000);
 const stored=new Map();
 const session={
  key,closed:false,
  async all(name){assert.equal(name,"settings");return [...stored.values()].map(x=>structuredClone(x));},
  async put(name,row){assert.equal(name,"settings");stored.set(row.id,structuredClone(row));},
  async del(name,id){assert.equal(name,"settings");stored.delete(id);}
 };
 return {session,stored,key};
};

test("Clé Mistral chiffrée par AES-GCM, jamais écrite en clair dans la table settings",async()=>{
 const {session,stored}=await makeSession();
 assert.equal(await hasStoredMistralCredential(session),false);
 await saveMistralCredential(session,SECRET);
 assert.equal(await hasStoredMistralCredential(session),true);
 const record=stored.get(CREDENTIAL_ID);
 assert.equal(record.id,CREDENTIAL_ID);
 assert.equal(validStoredMistralCredential(record.value),true);
 assert.ok(!JSON.stringify([...stored]).includes(SECRET),"Never persist the API key in plaintext");
 assert.ok(record.value.iv.length===24);
 assert.equal(await loadMistralCredential(session),SECRET);
 assert.equal(record.value.payload.includes(SECRET),false);
 await deleteMistralCredential(session);
 assert.equal(await hasStoredMistralCredential(session),false);
 await assert.rejects(loadMistralCredential(session),/Aucune clé/);
});

test("Le chiffrement utilise un nonce aléatoire à chaque sauvegarde",async()=>{
 const {session,key}=await makeSession();
 const a=await sealMistralCredential(SECRET,key),b=await sealMistralCredential(SECRET,key);
 assert.notEqual(a.iv,b.iv);
 assert.notEqual(a.payload,b.payload);
 assert.equal(await unsealMistralCredential(a,key),SECRET);
});

test("Refus de lire une copie modifiée, avec un autre coffre ou un coffre verrouillé",async()=>{
 const {session,key}=await makeSession();
 const envelope=await sealMistralCredential(SECRET,key);
 const another=(await makeSession()).key;
 await assert.rejects(unsealMistralCredential(envelope,another),/impossible/);
 const tampered={...envelope,payload:envelope.payload.slice(0,-2)+(envelope.payload.endsWith("00")?"01":"00")};
 await assert.rejects(unsealMistralCredential(tampered,key),/impossible/);
 session.closed=true;
 await assert.rejects(saveMistralCredential(session,SECRET),/Déverrouillez/);
 await assert.rejects(loadMistralCredential(session),/Déverrouillez/);
});

test("Refus des clés invalides et des objets de stockage corrompus",async()=>{
 const {key}=await makeSession();
 for(const invalid of ["tropcourt","cle avec espaces qui expose","abc\nsecret"])await assert.rejects(sealMistralCredential(invalid,key),/clé Mistral/);
 for(const obj of [{},{cipher:"AES-256-GCM",version:1,iv:"a".repeat(24),payload:"b".repeat(20)},{cipher:"AES-256-GCM",version:999,iv:"a".repeat(24),payload:"b".repeat(80)}])assert.equal(validStoredMistralCredential(obj),false);
});
