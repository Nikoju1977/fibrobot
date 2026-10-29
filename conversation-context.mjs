/* Session-only context for voluntary general conversation continuity.
 * Never read IndexedDB, localStorage, cookies, medical records, or settings.
 * Every outgoing message is filtered through the existing nonmedical/privacy gate.
 */
import {nonMedicalMessages} from "./assistant-engine.mjs";
export function sessionMessages(question,sessionHistory=[],enabled=false){
 const history=enabled&&Array.isArray(sessionHistory)?sessionHistory.slice(-12):[];
 return nonMedicalMessages(question,history);
}
export function sessionPreview(question,sessionHistory=[],enabled=false){
 return sessionMessages(question,sessionHistory,enabled).slice(1,-1)
  .map(m=>(m.role==="assistant"?"FibroBot : ":"Vous : ")+m.content).join("\n").slice(0,2600);
}
export function appendSessionTurn(history,question,answer,purpose="general-local",maxTurns=8){
 if(!Array.isArray(history)||purpose!=="general-local")return;
 // Require that BOTH messages pass the same general-conversation privacy filter.
 const candidate=[
  {role:"user",body:String(question||"").slice(0,450),purpose},
  {role:"bot",body:String(answer||"").slice(0,450),purpose}
 ];
 const messages=sessionMessages("Bonjour !",candidate,true);
 if(messages.length!==4)return;
 history.push(...candidate);
 if(history.length>maxTurns*2)history.splice(0,history.length-maxTurns*2);
}
