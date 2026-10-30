/* Mode Auto: Agnes -> Mistral, then safety and documentary fallback.
 * Medical and private content must never enter remote general-chat paths.
 * All remote attempts must obtain explicit per-request permission.
 */
import {nonMedicalMessages} from "./assistant-engine.mjs";
export function autoGeneralAllowed(question,intent,response){
 if(intent!=="general"||!["refusal","followup"].includes(response?.kind))return false;
 try{nonMedicalMessages(question,[]);return true;}catch{return false;}
}
/** Error categories deliberately avoid exposing provider payloads or personal prompts. */
export function providerFailureKind(error){
 const message=String(error?.message||"").toLowerCase().slice(0,240);
 if(/429|quota|rate.limit|too many/.test(message))return "quota";
 if(/401|402|403|interdite|refusée|invalide|invalid key|unauthorized/.test(message))return "authorization";
 if(/abort|timeout|délai|timed out/.test(message))return "timeout";
 if(/network|fetch|cors|réseau|hors ligne/.test(message))return "network";
 return "unavailable";
}
export function autoProviderOrder({agnesConnected=false,agnesCooldown=0,mistralConnected=false,mistralCooldown=0,agnesBlocked=false,mistralBlocked=false}={}){
 const result=[];
 if(agnesConnected&&!agnesBlocked&&agnesCooldown<=0)result.push("agnes");
 if(mistralConnected&&!mistralBlocked&&mistralCooldown<=0)result.push("mistral");
 return result;
}
export async function answerWithAuto({question,intent,response,state={},agnes,mistral,authorize=()=>false,onAttempt=()=>{}}){
 if(!autoGeneralAllowed(question,intent,response))return {provider:null,text:null,skipped:"not-eligible",errors:[]};
 const order=autoProviderOrder(state),errors=[];
 for(const provider of order){
  // Every external request requires explicit informed consent; no medical records/history transmitted.
  if(!await authorize(provider,question))return {provider:null,text:null,skipped:"consent-denied",errors};
  try{
   await onAttempt(provider);
   const answer=await ({agnes,mistral})[provider]?.(question);
   if(!answer||typeof answer.text!=="string"||!answer.text.trim())throw Error("Réponse vide");
   return {provider,text:answer.text,model:answer.model||"",errors};
  }catch(e){
   errors.push({provider,category:providerFailureKind(e)});
  }
 }
 return {provider:null,text:null,errors};
}

/** Factual public questions can use cited sources before a generative provider.
 * This does not authorize a network request; the application must still ask.
 */
export function shouldPreferSources(question,intent,response){
 if(!autoGeneralAllowed(question,intent,response))return false;
 const q=String(question||"").trim().toLowerCase();
 if(/^(raconte|invente|ecris|écris|compose|imagine|discute|parle.moi|bonjour|salut|aide.moi)/.test(q))return false;
 return /^(qui |que |qu.est.ce|quel(?:le|s|les)? |où |ou se |quand |combien |pourquoi |comment |recherch|cherche |source|verifi|vérifi|actualit|information|cite |cites? )/.test(q);
}
