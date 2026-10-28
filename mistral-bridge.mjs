/* FibroBot — Mistral facultatif dans un navigateur : JAMAIS de clé persistée.
 * Ce connecteur n'est pas une API médicale, il ne reçoit AUCUN dossier patient.
 * L'accès navigateur dépend des politiques CORS du prestataire ; sinon repli local.
 */
import {nonMedicalMessages,cleanGeneratedReply} from "./assistant-engine.mjs";

const ENDPOINT="https://api.mistral.ai/v1/chat/completions";
const APPROVED_MODELS=Object.freeze(["mistral-small-latest","mistral-medium-latest","mistral-large-latest"]);
let sessionKey=""; // Jamais dans IndexedDB, le coffre, localStorage, logs ou URL.
let cooldownUntil=0,lastFailure="";
const activeRequests=new Set();
const MAX_COOLDOWN_S=900;
const MIN_COOLDOWN_S=15;
export function secondsToRetry(header,now=Date.now()){
 const raw=String(header||"").trim();
 if(!raw)return 60;
 let seconds=Number(raw);
 if(!Number.isFinite(seconds)){
  const when=Date.parse(raw);
  seconds=Number.isFinite(when)?Math.ceil((when-now)/1000):60;
 }
 return Math.max(MIN_COOLDOWN_S,Math.min(MAX_COOLDOWN_S,Math.ceil(seconds)||MIN_COOLDOWN_S));
}
function rateLimitCooldown(res){
 const header=res?.headers?.get?.("retry-after");
 const seconds=secondsToRetry(header);
 cooldownUntil=Date.now()+seconds*1000;
 lastFailure="Limite API Mistral atteinte (429). Réessayez au plus tôt dans "+seconds+" s. Le mode local reste disponible. Si l'erreur revient, vérifiez les limites de votre espace Mistral.";
 return lastFailure;
}
export const MISTRAL_MODELS=APPROVED_MODELS;
export function connectMistral(key){
 const value=String(key||"").trim();
 if(value.length<12||value.length>500||/[\r\n\s]/.test(value))throw Error("Clé Mistral invalide. Ne la saisissez pas dans la conversation.");
 sessionKey=value;return true;
}
export function disconnectMistral(){sessionKey="";lastFailure="";cooldownUntil=0;cancelMistralRequests();}
export function cancelMistralRequests(){for(const ctrl of activeRequests)ctrl.abort();activeRequests.clear();}
export function mistralStatus(){
 return {connected:!!sessionKey,models:APPROVED_MODELS,cooldownSeconds:Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000)),lastFailure};
}
const nonClinical=question=>nonMedicalMessages(question,[]);
export function validateMistralMessages(messages){
 if(!Array.isArray(messages)||messages.length<2||messages.length>8)throw Error("Format des messages non autorisé.");
 if(messages[0]?.role!=="system"||messages.at(-1)?.role!=="user")throw Error("Messages manquants.");
 for(const message of messages){
  if(!["system","user","assistant"].includes(message?.role)||typeof message.content!=="string"||message.content.length>1800)
   throw Error("Conversation incompatible ou trop longue.");
 }
 // Aucune question libre de santé n'est autorisée ici.
 const last=messages.at(-1);
 nonClinical(last.content);
 return messages;
}
const errorFromStatus=n=>n===401?"Clé API Mistral rejetée (401).":n===403?"Clé sans autorisation pour ce modèle (403).":n===429?"Limite de requêtes ou de crédit Mistral atteinte (429).":n===402?"Crédit Mistral insuffisant (402).":"Service Mistral indisponible (HTTP "+n+").";
export async function mistralCompletion(messages,{model="mistral-small-latest",fetchImpl=globalThis.fetch,signal}={}){
 if(!sessionKey)throw Error("Mistral n'est pas connecté dans cette session.");
 const remaining=Math.ceil((cooldownUntil-Date.now())/1000);
 if(remaining>0)throw Error("Mistral est temporairement désactivé après l'erreur 429 ("+remaining+" s restantes). Le mode local reste disponible.");
 if(!APPROVED_MODELS.includes(model))throw Error("Modèle non approuvé.");
 validateMistralMessages(messages);
 if(typeof fetchImpl!=="function")throw Error("API fetch indisponible sur cet appareil.");
 const controller=new AbortController(),abort=()=>controller.abort();
 activeRequests.add(controller);
 if(signal?.aborted)controller.abort();else signal?.addEventListener("abort",abort,{once:true});
 const timeout=setTimeout(abort,12000);
 try{
  const res=await fetchImpl(ENDPOINT,{method:"POST",mode:"cors",credentials:"omit",cache:"no-store",
   headers:{"Authorization":"Bearer "+sessionKey,"Content-Type":"application/json"},
   body:JSON.stringify({model,messages,temperature:0.2,max_tokens:420,stream:false}),signal:controller.signal});
  if(!res.ok){
   if(res.status===429)throw Error(rateLimitCooldown(res));
   lastFailure=errorFromStatus(res.status);
   throw Error(lastFailure);
  }
  const payload=await res.json();
  const raw=payload?.choices?.[0]?.message?.content;
  const answer=Array.isArray(raw)?raw.filter(x=>x?.type==="text").map(x=>String(x.text||"")).join(" "):raw;
  const text=cleanGeneratedReply(answer);
  cooldownUntil=0;lastFailure="";
  return {text,model};
 }catch(e){
  if(e?.name==="AbortError")throw Error("Mistral ne répond pas dans les délais (12 s). Le moteur local reste disponible.");
  if(e instanceof TypeError)throw Error("Connexion Mistral bloquée par le réseau ou le navigateur (CORS). Utilisez l'IA locale.");
  throw e;
 }finally{clearTimeout(timeout);activeRequests.delete(controller);signal?.removeEventListener("abort",abort);}
}
export async function generateMistralChat(question,history=[],options={}){
 const messages=nonMedicalMessages(question,history);
 return mistralCompletion(messages,options);
}
export async function testMistralConnection(options={}){
 const messages=nonMedicalMessages("Combien font deux plus deux ?");
 return mistralCompletion(messages,options);
}
