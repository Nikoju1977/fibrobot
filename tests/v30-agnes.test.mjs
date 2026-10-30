import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {deriveKey} from "../vault.mjs";
import {connectAgnes,disconnectAgnes,generateAgnesChat,generateAgnesPublicFiche} from "../agnes-bridge.mjs";
import {unsealMistralCredential} from "../mistral-credential-vault.mjs";
import {AGNES_CREDENTIAL_ID,validStoredAgnesCredential,sealAgnesCredential,unsealAgnesCredential,saveAgnesCredential,loadAgnesCredential,deleteAgnesCredential} from "../agnes-credential-vault.mjs";
import {reply} from "../core.mjs";
import {LIBRARY} from "../medical-library.mjs";
import {mistralRoute} from "../mistral-routing.mjs";
if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;
const fakeKey="agnes-TEST-NOT-A-REAL-KEY-1234567890";
const secret="un mot de passe très long réservé au test de la clé";
async function session(){
 const key=await deriveKey(secret,webcrypto.getRandomValues(new Uint8Array(16)),300000);
 const rows=new Map();
 return {key,rows,closed:false,
  async all(store){assert.equal(store,"settings");return [...rows.values()].map(x=>structuredClone(x));},
  async put(store,row){assert.equal(store,"settings");rows.set(row.id,structuredClone(row));},
  async del(store,id){assert.equal(store,"settings");rows.delete(id);}
 };
}
test("V30: Agnes API key encrypted at rest, recoverable and deletable",async()=>{
 const s=await session();
 await saveAgnesCredential(s,fakeKey);
 const record=s.rows.get(AGNES_CREDENTIAL_ID);
 assert.ok(validStoredAgnesCredential(record.value));
 assert.doesNotMatch(JSON.stringify(record),/agnes-TEST-NOT-A-REAL-KEY/);
 assert.equal(await loadAgnesCredential(s),fakeKey);
 await deleteAgnesCredential(s);
 await assert.rejects(loadAgnesCredential(s),/Aucune clé Agnes/);
});
test("V30: distinct Agnes AAD, random nonce and tamper-proof vault",async()=>{
 const s=await session();
 const a=await sealAgnesCredential(fakeKey,s.key),b=await sealAgnesCredential(fakeKey,s.key);
 assert.notEqual(a.iv,b.iv);
 assert.equal(await unsealAgnesCredential(a,s.key),fakeKey);
 await assert.rejects(unsealMistralCredential(a,s.key),/impossible/);
 const damaged={...a,payload:(a.payload[0]==="A"?"B":"A")+a.payload.slice(1)};
 await assert.rejects(unsealAgnesCredential(damaged,s.key),/impossible/);
 s.closed=true;await assert.rejects(saveAgnesCredential(s,fakeKey),/Déverrouillez/);
});
test("V30: Agnes public fibromyalgia explanation never sends clinical user question or profile",async()=>{
 connectAgnes(fakeKey);
 let calls=0,last;
 const mock=async(_url,opts)=>{
  calls++;last=JSON.parse(opts.body);
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:"La fibromyalgie se manifeste notamment par des douleurs diffuses et de la fatigue."}}]})};
 };
 const result=await generateAgnesPublicFiche("fibro",{fetchImpl:mock});
 assert.match(result.text,/fibromyalgie/);
 assert.equal(calls,1);
 assert.deepEqual(last.messages.map(x=>x.role),["system","user"]);
 const outgoing=JSON.stringify(last.messages);
 assert.match(outgoing,/fiche documentaire publique/);
 assert.doesNotMatch(outgoing,/mon traitement|ma mère|ma douleur|mes symptômes|dossier patient/i);
 await assert.rejects(generateAgnesPublicFiche("unknown",{fetchImpl:mock}),/approuvée/);
 await assert.rejects(generateAgnesChat("Mes douleurs sont insupportables",{fetchImpl:mock}),/admissible|privées|non/i);
 assert.equal(calls,1);
 disconnectAgnes();
});
test("V30: route only documented public clinical facts to Agnes",()=>{
 const q="Quels sont les symptômes de la fibromyalgie ?";
 const safe=reply(q,LIBRARY),route=mistralRoute(q,"medical",safe);
 assert.equal(route?.mode,"medical-reference");
 assert.equal(LIBRARY.some(d=>d.id===route.topic),true);
 assert.equal(mistralRoute("Quelle dose de morphine ?", "medical",reply("Quelle dose de morphine ?",LIBRARY)),null);
});
test("V30: simple UI, encrypted Agnes controls and no local inference required",()=>{
 const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 for(const term of ["setupV30Controls()","agnes-save-key","agnes-session-consent","agnes-public-fiches","agnes-forget","restoreAgnesAfterUnlock","generateAgnesPublicFiche","mistralConnected:false"])
  assert.ok(app.includes(term),term);
 assert.match(css,/v30-simple:not\(\.v30-advanced\)/);
 assert.match(sw,/agnes-credential-vault\.mjs/);
 assert.match(sw,/fibrobot-shell-v32/);
});
