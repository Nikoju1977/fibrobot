/* Mode Auto: Agnes -> Mistral, then safety and documentary fallback.
 * Medical and private content must never enter remote general-chat paths.
 * All remote attempts must obtain explicit per-request permission.
 */
import {nonMedicalMessages} from "./assistant-engine.mjs";
export function autoGeneralAllowed(question,intent,response){
 if(intent!=="general"||!["refusal","followup"].includes(response?.kind))return false;
 try{nonMedicalMessages(question,[]);return true;}catch{return false;}
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
  if(!await authorize(provider,question))continue;
  try{
   onAttempt(provider);
   const answer=await ({agnes,mistral})[provider]?.(question);
   if(!answer||typeof answer.text!=="string"||!answer.text.trim())throw Error("Réponse vide");
   return {provider,text:answer.text,model:answer.model||"",errors};
  }catch(e){
   errors.push({provider,category:e?.message?.includes("429")||e?.message?.includes("quota")?"quota":"unavailable"});
  }
 }
 return {provider:null,text:null,errors};
}
