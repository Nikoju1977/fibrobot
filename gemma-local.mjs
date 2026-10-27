/* Gemma 4 E2B WebGPU — aucune API de génération distante.
 * Le téléchargement optionnel du runtime et des poids contacte leurs hébergeurs.
 * E4B requiert un client LiteRT-LM natif; non activé ici.
 */
import {safeGeneralQuestion,safeGeneratedAnswer} from "./assistant-tools.mjs";
export const WEBLLM_VERSION="0.2.86";
export const WEBLLM_URL="https://esm.run/@mlc-ai/web-llm@0.2.86";
export const WEB_MODELS=Object.freeze({
 f16:{id:"gemma-4-E2B-it-q4f16_1-MLC",label:"Gemma 4 E2B · q4f16",feature:"shader-f16"},
 f32:{id:"gemma-4-E2B-it-q4f32_1-MLC",label:"Gemma 4 E2B · q4f32",feature:null},
 lite16:{id:"SmolLM2-360M-Instruct-q4f16_1-MLC",label:"SmolLM2 360M · léger FP16",feature:"shader-f16"},
 lite32:{id:"SmolLM2-360M-Instruct-q4f32_1-MLC",label:"SmolLM2 360M · léger compatible",feature:null}
});
let worker=null,modelId=null,loading=false,nextID=1,cancelled=false;
export const AVAILABLE_MODEL_IDS=Object.freeze(Object.values(WEB_MODELS).map(m=>m.id));
const pending=new Map();
export function status(){return{ready:!!modelId,modelId,loading};}
export async function detectWebGPU(){if(!globalThis.isSecureContext||typeof navigator==="undefined"||!navigator.gpu)return{supported:false,reason:"WebGPU et HTTPS sont nécessaires. Utilisez un navigateur moderne ou l'assistant documentaire."};try{const adapter=await navigator.gpu.requestAdapter();if(!adapter)return{supported:false,reason:"Aucun GPU WebGPU disponible."};return{supported:true,f16:adapter.features?.has("shader-f16")||false};}catch(e){return{supported:false,reason:"Accès au GPU refusé par le navigateur."};}}
function requireWorker(){
 if(worker)return worker;
 if(typeof Worker==="undefined")throw Error("Les Web Workers ne sont pas pris en charge.");
 worker=new Worker(new URL("./gemma-worker.mjs",import.meta.url),{type:"module"});
 worker.onmessage=event=>{const {id,kind,progress,text,message,...value}=event.data||{};const req=pending.get(id);if(!req)return;if(kind==="progress"){req.onProgress?.({progress,text});return;}pending.delete(id);clearTimeout(req.timer);if(kind==="error")req.reject(new Error(message||"Erreur du moteur WebGPU."));else req.resolve({...value,text});};
 worker.onerror=()=>{for(const req of pending.values()){clearTimeout(req.timer);req.reject(new Error("Le moteur local a échoué."));}pending.clear();worker?.terminate();worker=null;modelId=null;};
 worker.onmessageerror=worker.onerror;
 return worker;
}
function rpc(action,params={},onProgress){
 const instance=requireWorker(),id=nextID++;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error(action==="load"?"Chargement trop long : réessayez avec un modèle léger.":"Le moteur local ne répond plus."));instance.terminate();if(worker===instance)worker=null;modelId=null;},action==="load"?480000:90000);
  pending.set(id,{resolve,reject,onProgress,timer});
  try{instance.postMessage({id,action,...params});}catch(e){clearTimeout(timer);pending.delete(id);reject(e);}
 });
}
function abortWorker(reason){
 for(const req of pending.values()){clearTimeout(req.timer);req.reject(new Error(reason));}
 pending.clear();worker?.terminate();worker=null;modelId=null;
}
export function cancelGemmaLoad(){if(!loading)return false;cancelled=true;abortWorker("Chargement annulé. Vous pouvez réessayer avec un autre modèle.");return true;}
export function modelCandidates(variant,cap,deviceMemory){
 const lite=cap.f16?["lite16","lite32"]:["lite32"];
 const gemma=cap.f16?["f16","f32"]:["f32"];
 if(variant==="lite")return lite;
 if(variant==="auto")return Number(deviceMemory)>0&&Number(deviceMemory)<=4?[...lite,...gemma]:[...gemma,...lite];
 if(variant==="gemma")return gemma;
 if(!WEB_MODELS[variant])throw Error("Mode de modèle inconnu.");
 if(WEB_MODELS[variant].feature&&!cap.f16)throw Error("Le GPU ne prend pas en charge shader-f16.");
 return [variant];
}
export async function loadGemma({variant="auto",onProgress=()=>{}}={}){
 if(modelId)return{modelId,alreadyLoaded:true};if(loading)throw Error("Chargement déjà en cours.");
 const cap=await detectWebGPU();if(!cap.supported)throw Error(cap.reason);
 loading=true;cancelled=false;
 const candidates=modelCandidates(variant,cap,typeof navigator!=="undefined"?navigator.deviceMemory:undefined);
 let lastError=null;
 try{
  for(const choice of candidates){
   if(cancelled)throw Error("Chargement annulé.");
   const item=WEB_MODELS[choice];
   onProgress({text:"Préparation du modèle "+item.label+". Téléchargement avec votre accord (Wi-Fi recommandé).",progress:0});
   try{
    await rpc("load",{model:item.id},onProgress);
    if(cancelled)throw Error("Chargement annulé.");
    modelId=item.id;
    onProgress({text:item.label+" prêt sur cet appareil.",progress:1});
    return{modelId,alreadyLoaded:false,fallback:choice!==candidates[0]};
   }catch(error){
    lastError=error;
    abortWorker("Redémarrage du moteur local.");
    if(cancelled)throw Error("Chargement annulé.");
    onProgress({text:item.label+" indisponible : "+error.message+(candidates.indexOf(choice)<candidates.length-1?" ; essai d'un modèle de secours.":""),progress:0});
   }
  }
  throw lastError||Error("Aucun modèle local compatible n'a pu être chargé.");
 }finally{loading=false;cancelled=false;}
}
export function canGeneralChat(question){return safeGeneralQuestion(question);}
export async function generateSafeChat(question){
 if(!modelId)throw Error("Modèle non chargé.");
 if(!safeGeneralQuestion(question))throw Error("Cette demande est réservée au moteur documentaire et aux professionnels de santé.");
 const messages=[
  {role:"system",content:"Tu es un assistant local francophone réservé aux sujets généraux non médicaux (culture, explications courantes, écriture, loisirs, organisation pratique). Réponds clairement en français, 180 mots maximum. Tu n'as ni accès à Internet ni accès au dossier privé. Ne prétends jamais connaître des informations récentes ou confidentielles. Si la réponse nécessite une source actuelle, dis-le. Aucun conseil médical, aucune posologie, aucun diagnostic, aucun conseil psychologique ou nutritionnel. Ne fais pas de suppositions."},
  {role:"user",content:String(question).slice(0,500)}
 ];
 const result=await rpc("generate",{messages,mode:"conversation"});
 const checked=safeGeneratedAnswer(result.text);
 if(!checked)throw Error("Réponse du modèle bloquée par les règles de sûreté. Réponse documentaire conservée.");
 return checked+"\n\n[Texte généré localement : peut contenir des erreurs, à vérifier.]";
}

export function canPlanWithGemma(question){const q=String(question||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");return /(tache|quotidien|courses|menage|lessive|administrati|organis|priorite|liste de choses)/.test(q)&&!/(medicament|dose|prescri|douleur|crise|fibromyalgie|symptom|suicid|traitement|diagnos|allerg|maladie|medical|medecin|urgence)/.test(q);}
export function safePlanInput(question,{energy=5,tasks=[]}={}){
 // Aucun texte libre (questions, intitulés, notes, traitements, maladies) ne pénètre dans le Worker tiers.
 // Le modèle ne reçoit que 12 identifiants éphémères et les caractéristiques des tâches.
 const safeTasks=tasks.filter(t=>!t.done).slice(0,12).map((t,i)=>({index:i,effort:[1,2,3].includes(Number(t.effort))?Number(t.effort):3,priorite:["important","normal","delegable"].includes(t.priority)?t.priority:"normal"}));
 return [{role:"system",content:"Tu es un classeur de tâches non médical. Réponds STRICTEMENT en JSON de la forme {\"ordre\":[0,1]} : au maximum 3 indices existants distincts, pertinents selon énergie, effort et priorité. Aucune prose. Les nombres correspondent à des tâches anonymes ; n'invente aucun numéro. Si aucune tâche n'est possible, réponds {\"ordre\":[]}."},
 {role:"user",content:"Énergie auto-déclarée de 0 à 10 : "+Math.min(10,Math.max(0,Number(energy)||0))+". Descripteurs anonymisés : "+JSON.stringify(safeTasks)+". Classe les tâches adaptées ; aucun texte personnel fourni."}];}
export function parseTaskOrder(answer,count){
 if(typeof answer!=="string"||answer.length>300||!Number.isSafeInteger(count)||count<0||count>12)return null;
 let obj;try{obj=JSON.parse(answer.trim());}catch{return null;}
 if(!obj||typeof obj!=="object"||Array.isArray(obj)||Object.keys(obj).length!==1||!Array.isArray(obj.ordre)||obj.ordre.length>3)return null;
 const ids=obj.ordre;
 if(!ids.every(x=>Number.isSafeInteger(x)&&x>=0&&x<count)||new Set(ids).size!==ids.length)return null;
 return ids;
}
export function validatePlanOutput(answer){const s=String(answer||"").trim();return s.length>=5&&s.length<=300&&!/dosage|posologie|milligramme|arr[eê]tez votre traitement/i.test(s)?s:null;}
export async function generateLifePlan(question,context={}){
 if(!modelId)throw Error("Modèle non chargé.");
 if(!canPlanWithGemma(question))throw Error("Gemma ne traite que les tâches et l'organisation.");
 const tasks=(context.tasks||[]).filter(t=>!t.done).slice(0,12);
 if(!tasks.length)throw Error("Aucune tâche enregistrée à organiser.");
 const result=await rpc("generate",{messages:safePlanInput(question,{...context,tasks})});
 const indices=parseTaskOrder(result.text,tasks.length);
 if(!indices||!indices.length)throw Error("La proposition Gemma ne respecte pas le format sûr. Repli local.");
 return "Proposition d'ordre pour vos tâches : "+indices.map((i,j)=>(j+1)+". "+String(tasks[i].title||"").slice(0,90)).join(" ; ")+". Prenez des pauses et reportez ou déléguez ce qui dépasse votre énergie du jour. Ce classement n'est pas un avis médical.";
}
export async function unloadGemma(){if(loading){cancelGemmaLoad();return;}if(worker){try{if(modelId)await rpc("unload");}finally{worker.terminate();worker=null;}}modelId=null;}
