/* Explicit, encrypted-at-rest conversational preference. Never read the medical record.
 * Opt-in is required separately before sharing with remote providers.
 */
import {classifyIntent,nonMedicalMessages} from "./assistant-engine.mjs";
export const PREFERENCE_SETTING_ID="assistant-general-preference-v26";
const normalize=s=>String(s??"").replace(/[\u0000-\u001f\u007f]+/g," ").replace(/\s+/g," ").trim();
const secret=/(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b(?:\+33|0[1-9])(?:[ .-]?\d\d){4}\b|https?:\/\/|www\.|mot\s+de\s+passe|code\s+secret|cle\s+api|clé\s+api|token|adresse|num[eé]ro|t[eé]l[eé]phone|date\s+de\s+naissance|patient|ordonnance|m[eé]dicament|traitement|diagnostic|douleur|sympt[oô]me|fibromyalgie|diab[eè]te|allergie|handicap|maladie|suicid)/i;
export function validateGeneralPreference(raw){
 const value=normalize(raw);
 if(value.length<5||value.length>220)throw Error("Préférence trop courte ou trop longue (5 à 220 caractères).");
 if(secret.test(value)||classifyIntent(value)!=="general")throw Error("Préférence sensible ou médicale refusée. Ne saisissez que votre style de conversation ou des loisirs généraux.");
 const safe=nonMedicalMessages("Bonjour",[{role:"user",body:value,purpose:"general-local"},{role:"bot",body:"Bien compris.",purpose:"general-local"}]);
 if(safe.length!==4)throw Error("Préférence personnelle non admissible. Utilisez une formulation générale.");
 return value;
}
export function savedGeneralPreference(settings=[]){
 const item=Array.isArray(settings)?settings.find(s=>s?.id===PREFERENCE_SETTING_ID):null;
 if(!item)return "";
 try{return validateGeneralPreference(item.value);}catch{return "";}
}
export function preferenceHistory(value,sessionTurns=[],share=false){
 const recent=Array.isArray(sessionTurns)?sessionTurns.slice(-4):[];
 if(!share||!value)return recent;
 try{
  const safe=validateGeneralPreference(value);
  return [
   {role:"user",purpose:"general-local",body:"Préférence de forme uniquement : "+safe},
   {role:"bot",purpose:"general-local",body:"Je vais essayer de respecter cette préférence de forme."},
   ...recent
  ];
 }catch{return recent;}
}
