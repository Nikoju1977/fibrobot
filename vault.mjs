/* Chiffrement intégral des données FibroBot au repos, dans IndexedDB.
 * AES-256-GCM / PBKDF2-SHA-256. Phrase secrète et clé jamais persistées.
 * Protection contre lecture du stockage fermé, PAS contre un navigateur compromis.
 */
import {STORES} from "./core.mjs";
export const VAULT_DB="FibroBotVault-v1", VAULT_STORE="envelopes", VAULT_ID="data", ITERATIONS=600000;
const te=new TextEncoder(),td=new TextDecoder();
const c=()=>{if(!globalThis.crypto?.subtle||!globalThis.crypto?.getRandomValues)throw Error("Web Crypto indisponible (HTTPS requis).");return globalThis.crypto;};
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
const unhex=s=>{if(typeof s!=="string"||s.length%2||!/^[a-f0-9]*$/i.test(s))throw Error("Format hexadécimal invalide.");return Uint8Array.from(s.match(/.{2}/g)||[],b=>parseInt(b,16));};
export const emptyData=()=>Object.fromEntries(STORES.map(name=>[name,[]]));
export function validateData(data){if(!data||typeof data!=="object")throw Error("Jeu de données invalide.");const result=emptyData();for(const store of STORES)if(Object.hasOwn(data,store)){if(!Array.isArray(data[store])||data[store].length>100000)throw Error("Table invalide : "+store);result[store]=structuredClone(data[store]);}return result;}
export function validEnvelope(x){return Boolean(x&&x.id===VAULT_ID&&x.v===1&&x.algorithm==="AES-GCM-256"&&x.kdf==="PBKDF2-SHA256"&&Number.isInteger(x.iterations)&&x.iterations>=300000&&x.iterations<=2000000&&/^[a-f0-9]{32}$/i.test(x.salt||"")&&/^[a-f0-9]{24}$/i.test(x.iv||"")&&/^[a-f0-9]{32,}$/i.test(x.ciphertext||""));}
export async function deriveKey(password,salt,iterations=ITERATIONS){if(typeof password!=="string"||password.length<12||password.length>1024)throw Error("Utilisez une phrase secrète de 12 caractères minimum.");const key=await c().subtle.importKey("raw",te.encode(password),"PBKDF2",false,["deriveKey"]);return c().subtle.deriveKey({name:"PBKDF2",salt,iterations,hash:"SHA-256"},key,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);}
export async function seal(data,key,salt,iterations=ITERATIONS){const iv=c().getRandomValues(new Uint8Array(12));const encrypted=await c().subtle.encrypt({name:"AES-GCM",iv,additionalData:te.encode("FibroBotVault-v1"),tagLength:128},key,te.encode(JSON.stringify(validateData(data))));return{id:VAULT_ID,v:1,algorithm:"AES-GCM-256",kdf:"PBKDF2-SHA256",iterations,salt:hex(salt),iv:hex(iv),ciphertext:hex(encrypted)};}
export async function unseal(envelope,password){if(!validEnvelope(envelope))throw Error("Coffre invalide ou endommagé.");const salt=unhex(envelope.salt),key=await deriveKey(password,salt,envelope.iterations);try{const bytes=await c().subtle.decrypt({name:"AES-GCM",iv:unhex(envelope.iv),additionalData:te.encode("FibroBotVault-v1"),tagLength:128},key,unhex(envelope.ciphertext));return {key,salt,iterations:envelope.iterations,data:validateData(JSON.parse(td.decode(bytes)))};}catch(e){throw Error("Mot de passe incorrect ou coffre endommagé.");}}
const request=req=>new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error||Error("IndexedDB indisponible."));});
export function openVaultDB(){return new Promise((ok,no)=>{const r=indexedDB.open(VAULT_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(VAULT_STORE))r.result.createObjectStore(VAULT_STORE,{keyPath:"id"});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
export async function readEnvelope(db){return request(db.transaction(VAULT_STORE,"readonly").objectStore(VAULT_STORE).get(VAULT_ID));}
export function storeEnvelope(db,envelope){return new Promise((ok,no)=>{const tx=db.transaction(VAULT_STORE,"readwrite");tx.objectStore(VAULT_STORE).put(envelope);tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error||Error("Échec de l'enregistrement chiffré."));tx.onabort=()=>no(tx.error||Error("Transaction annulée."));});}
export async function makeVault(password,data=emptyData()){const salt=c().getRandomValues(new Uint8Array(16));const key=await deriveKey(password,salt);return{key,salt,iterations:ITERATIONS,data:validateData(data)};}
export class VaultSession{
 constructor(db,opened){this.db=db;this.key=opened.key;this.salt=opened.salt;this.iterations=opened.iterations;this.data=validateData(opened.data);this.queue=Promise.resolve();this.closed=false;}
 get objectStoreNames(){return STORES;}
 async all(name){if(this.closed)throw Error("Coffre verrouillé.");if(!STORES.includes(name))throw Error("Table inconnue.");await this.queue;return structuredClone(this.data[name]);}
 mutate(fn){const pending=this.queue.then(async()=>{if(this.closed)throw Error("Coffre verrouillé.");const data=validateData(this.data);const result=fn(data);const envelope=await seal(data,this.key,this.salt,this.iterations);await storeEnvelope(this.db,envelope);this.data=data;return result;});this.queue=pending.then(()=>undefined,()=>undefined);return pending;}
 put(name,record){if(!STORES.includes(name))throw Error("Table inconnue.");return this.mutate(data=>{const rows=data[name],v=structuredClone(record);if(v.id===undefined||v.id===null||v.id===""){v.id=rows.reduce((n,x)=>Math.max(n,Number(x.id)||0),0)+1;}const index=rows.findIndex(x=>String(x.id)===String(v.id));if(index<0)rows.push(v);else rows[index]=v;return v.id;});}
 del(name,id){if(!STORES.includes(name))throw Error("Table inconnue.");return this.mutate(data=>{data[name]=data[name].filter(x=>String(x.id)!==String(id));});}
 async encryptedBackup(){await this.queue;return readEnvelope(this.db);}
 close(){this.closed=true;this.data=emptyData();this.key=null;this.salt=null;this.db.close();}
}
export async function createVault(db,password,data){if(await readEnvelope(db))throw Error("Ce coffre existe déjà.");const opened=await makeVault(password,data);await storeEnvelope(db,await seal(opened.data,opened.key,opened.salt));return new VaultSession(db,opened);}
export async function unlockVault(db,password){const envelope=await readEnvelope(db);if(!envelope)throw Error("Aucun coffre créé.");return new VaultSession(db,await unseal(envelope,password));}
// Lecture seule de la base historique ; ne supprime jamais les données sans consentement.
export async function readLegacy(){return new Promise((resolve,reject)=>{const probe=indexedDB.open("FibrobotDB");let fresh=false;probe.onupgradeneeded=()=>{fresh=true;probe.transaction.abort();};probe.onerror=()=>{if(fresh)resolve(emptyData());else reject(probe.error);};probe.onsuccess=async()=>{const db=probe.result,ret=emptyData();try{for(const name of STORES){if(db.objectStoreNames.contains(name))ret[name]=await request(db.transaction(name,"readonly").objectStore(name).getAll());}db.close();resolve(ret);}catch(err){db.close();reject(err);}};});}
export async function clearLegacy(){return new Promise((ok,no)=>{const req=indexedDB.deleteDatabase("FibrobotDB");req.onsuccess=()=>ok();req.onerror=()=>no(req.error);req.onblocked=()=>no(Error("Fermez les autres onglets pour supprimer l'ancienne base."));});}
export async function clearVault(){return new Promise((ok,no)=>{const req=indexedDB.deleteDatabase(VAULT_DB);req.onsuccess=()=>ok();req.onerror=()=>no(req.error);req.onblocked=()=>no(Error("Fermez les autres onglets pour supprimer le coffre."));});}
