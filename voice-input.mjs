/* FibroBot voice-input. Dictation never submits a question automatically.
 * Local mode is the default: do not fall back to cloud dictation silently.
 * Remote browser recognition requires a separate, explicit user choice.
 */
export function dictationSupport(Speech,{allowBrowserService=false}={}){
 if(typeof Speech!=="function")return {supported:false,reason:"La reconnaissance vocale n'est pas disponible dans ce navigateur."};
 if(allowBrowserService)return {supported:true,remote:true};
 if(typeof Speech.available!=="function")return {supported:false,reason:"Ce navigateur ne peut pas confirmer une dictée entièrement locale."};
 return {supported:true,remote:false};
}
export async function startDictation({Speech,allowBrowserService=false,onText=()=>{},onEnd=()=>{},onError=()=>{}}={}){
 const cap=dictationSupport(Speech,{allowBrowserService});
 if(!cap.supported)throw Error(cap.reason);
 if(!allowBrowserService){
  const availability=await Speech.available({langs:["fr-FR"],processLocally:true});
  if(availability!=="available")throw Error("La dictée locale française n'est pas installée ou disponible sur cet appareil.");
 }
 const recognition=new Speech();
 recognition.lang="fr-FR";
 recognition.continuous=false;
 recognition.interimResults=false;
 recognition.maxAlternatives=1;
 recognition.processLocally=!allowBrowserService;
 recognition.onresult=e=>{
  const utterance=String(e?.results?.[0]?.[0]?.transcript||"").trim();
  if(utterance)onText(utterance.slice(0,2000));
 };
 recognition.onerror=e=>onError(String(e?.error||"inconnue").slice(0,65));
 recognition.onend=onEnd;
 recognition.start();
 return recognition;
}
