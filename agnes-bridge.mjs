/* Agnes AI: optional remote text-only connector.
 * API format: OpenAI-compatible /v1/chat/completions.
 * Session key only; never write to storage or logs.
 * The public browser endpoint may block requests (CORS).
 */
import {nonMedicalMessages,cleanConversationalReply} from "./assistant-engine.mjs";
import {reserveApiRequest} from "./request-budget.mjs";
const URL="https://apihub.agnes-ai.com/v1/chat/completions";
const MODELS=Object.freeze(["agnes-2.5-flash","agnes-2.0-flash","agnes-3.0-flash"]);
const active=new Set();
let sessionKey="",cooldownUntil=0,lastFailure="",authorizationBlocked=false;
export function agnesStatus(){
 return {connected:Boolean(sessionKey),cooldownSeconds:Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000)),lastFailure,authorizationBlocked,models:MODELS};
}
export function connectAgnes(key){
 const k=String(key??"").trim();
 if(k.length<12||k.length>500||/\s/.test(k))throw Error("Clé Agnes invalide. Ne la saisissez jamais dans la conversation.");
 sessionKey=k;cooldownUntil=0;lastFailure="";authorizationBlocked=false;
 return true;
}
export function cancelAgnesRequests(){for(const ctrl of active)ctrl.abort();active.clear();}
export function disconnectAgnes(){cancelAgnesRequests();sessionKey="";lastFailure="";cooldownUntil=0;authorizationBlocked=false;}
export function secondsToRetryAgnes(value,now=Date.now()){
 const raw=String(value??"").trim();let seconds=Number(raw);
 if(!raw||!Number.isFinite(seconds)){
  const date=Date.parse(raw);
  seconds=raw&&Number.isFinite(date)?Math.ceil((date-now)/1000):60;
 }
 return Math.max(15,Math.min(900,Math.ceil(seconds)||15));
}
export async function generateAgnesChat(question,{model="agnes-2.5-flash",history=[],fetchImpl=globalThis.fetch,signal}={}){
 if(!sessionKey)throw Error("Agnes non connecté : ajoutez votre clé dans les réglages.");
 if(authorizationBlocked)throw Error("Clé Agnes refusée : reconnectez une clé valide.");
 if(agnesStatus().cooldownSeconds>0)throw Error("Agnes en pause : quota temporairement atteint.");
 if(!MODELS.includes(model))throw Error("Modèle Agnes non autorisé.");
 const messages=nonMedicalMessages(question,history); // filtered, opt-in session context only
 if(typeof fetchImpl!=="function")throw Error("Fonction réseau indisponible.");
 const controller=new AbortController(),abort=()=>controller.abort();
 active.add(controller);
 if(signal?.aborted)controller.abort();else signal?.addEventListener("abort",abort,{once:true});
 const timeout=setTimeout(abort,12000);
 try{
  if(fetchImpl===globalThis.fetch)reserveApiRequest("agnes");
  const response=await fetchImpl(URL,{method:"POST",mode:"cors",credentials:"omit",cache:"no-store",
   headers:{"Authorization":"Bearer "+sessionKey,"Content-Type":"application/json"},
   body:JSON.stringify({model,messages,temperature:0.35,max_tokens:430,stream:false}),signal:controller.signal});
  if(response.status===429){
   cooldownUntil=Date.now()+secondsToRetryAgnes(response.headers?.get("retry-after"))*1000;
   lastFailure="Agnes en pause (quota atteint).";
   throw Error(lastFailure);
  }
  if(!response.ok){
   if([401,402,403].includes(response.status))authorizationBlocked=true;
   lastFailure=response.status===401||response.status===403?"Clé Agnes refusée.":response.status===402?"Crédit Agnes insuffisant.":"Service Agnes indisponible (HTTP "+response.status+").";
   throw Error(lastFailure);
  }
  const data=await response.json();
  const raw=data?.choices?.[0]?.message?.content;
  const answer=Array.isArray(raw)?raw.filter(x=>x?.type==="text").map(x=>String(x.text||"")).join(" "):raw;
  const text=cleanConversationalReply(answer);
  lastFailure="";cooldownUntil=0;
  return {text,model};
 }catch(err){
  if(err?.name==="AbortError")throw Error("Agnes ne répond pas dans les délais.");
  if(err instanceof TypeError)throw Error("Agnes bloqué par le réseau ou le navigateur (CORS).");
  throw err;
 }finally{
  clearTimeout(timeout);active.delete(controller);signal?.removeEventListener("abort",abort);
 }
}
export async function testAgnesConnection(options={}){
 return generateAgnesChat("Combien font deux plus deux ?",options);
}
