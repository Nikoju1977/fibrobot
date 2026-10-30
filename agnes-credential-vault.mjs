/* FibroBot — clé Agnes en coffre local AES-256-GCM, chiffrement imbriqué.
 * Le coffre principal AES-GCM/PBKDF2 reste obligatoire et déverrouillé.
 * La clé API n'est JAMAIS stockée en texte brut, loggée, ou envoyée au dépôt.
 * Sa récupération demande une action volontaire, coffre ouvert.
 * Ne protège pas contre du JavaScript compromis ou une extension hostile.
 */
export const CREDENTIAL_ID="agnes-credential-v1";
const AAD="FibroBot:AgnesAPIKey:v1";
const encoder=new TextEncoder(),decoder=new TextDecoder();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const bytes=s=>Uint8Array.from(s.match(/../g)||[],x=>parseInt(x,16));
const validKey=value=>typeof value==="string"&&value.length>=12&&value.length<=500&&!/[\r\n\s\u0000-\u001f]/.test(value);
const vaultKey=session=>{
 if(!session||session.closed||!session.key||session.key.type!=="secret"||!session.key.usages.includes("decrypt")||!session.key.usages.includes("encrypt"))
  throw Error("Déverrouillez votre coffre chiffré pour accéder aux clés.");
 return session.key;
};
const cryptoAPI=()=>{if(!globalThis.crypto?.subtle||!globalThis.crypto?.getRandomValues)throw Error("Web Crypto nécessite HTTPS.");return globalThis.crypto;};
export function validStoredAgnesCredential(value){
 return Boolean(value&&value.version===1&&value.cipher==="AES-256-GCM"&&
  typeof value.iv==="string"&&/^[0-9a-f]{24}$/i.test(value.iv)&&
  typeof value.payload==="string"&&/^[0-9a-f]{56,1200}$/i.test(value.payload)&&
  value.payload.length%2===0);
}
export async function sealAgnesCredential(apiKey,key){
 if(!validKey(apiKey))throw Error("La clé Agnes doit contenir 12 à 500 caractères sans espace.");
 if(!key||key.type!=="secret"||!key.usages.includes("encrypt"))throw Error("Coffre déverrouillé requis.");
 const api=cryptoAPI(),iv=api.getRandomValues(new Uint8Array(12));
 const ciphertext=await api.subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode(AAD),tagLength:128},key,encoder.encode(apiKey));
 return {version:1,cipher:"AES-256-GCM",iv:hex(iv),payload:hex(new Uint8Array(ciphertext))};
}
export async function unsealAgnesCredential(envelope,key){
 if(!validStoredAgnesCredential(envelope))throw Error("Clé Agnes chiffrée endommagée.");
 if(!key||key.type!=="secret"||!key.usages.includes("decrypt"))throw Error("Coffre déverrouillé requis.");
 try{
  const raw=await cryptoAPI().subtle.decrypt({name:"AES-GCM",iv:bytes(envelope.iv),additionalData:encoder.encode(AAD),tagLength:128},key,bytes(envelope.payload));
  const secret=decoder.decode(raw);
  if(!validKey(secret))throw Error("Clé invalide.");
  return secret;
 }catch{throw Error("Déchiffrement de la clé Agnes impossible. Vérifiez le coffre ou la sauvegarde.");}
}
export async function hasStoredAgnesCredential(session){
 vaultKey(session);
 const records=await session.all("settings");
 return records.some(x=>x?.id===CREDENTIAL_ID&&validStoredAgnesCredential(x.value));
}
export async function saveAgnesCredential(session,apiKey){
 const envelope=await sealAgnesCredential(apiKey,vaultKey(session));
 await session.put("settings",{id:CREDENTIAL_ID,value:envelope});
 return true;
}
export async function loadAgnesCredential(session){
 const key=vaultKey(session);
 const stored=(await session.all("settings")).find(x=>x?.id===CREDENTIAL_ID);
 if(!stored)throw Error("Aucune clé Agnes dans le coffre.");
 return unsealAgnesCredential(stored.value,key);
}
export async function deleteAgnesCredential(session){
 vaultKey(session);
 await session.del("settings",CREDENTIAL_ID);
 return true;
}
