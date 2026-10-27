/* FibroBot — bibliothèque de moteurs locaux WebLLM.
 * Aucun modèle n'est téléchargé automatiquement et aucune API d'inférence distante
 * n'est requise. Les modèles listés viennent du runtime réellement chargé.
 * La compatibilité matérielle et les poids téléchargés restent à vérifier par appareil.
 */
import {nonMedicalMessages,cleanGeneratedReply} from "./assistant-engine.mjs";
export const WEBLLM_VERSION="0.2.86";
export const WEBLLM_URL="https://esm.run/@mlc-ai/web-llm@0.2.86";
// Candidats historiques non garantis disponibles ; le catalogue effectif fait autorité.
export const WEB_MODELS=Object.freeze({
 f16:{id:"gemma-4-E2B-it-q4f16_1-MLC",label:"Gemma 4 E2B · q4f16 (si disponible)",feature:"shader-f16"},
 f32:{id:"gemma-4-E2B-it-q4f32_1-MLC",label:"Gemma 4 E2B · q4f32 (si disponible)",feature:null}
});
let worker=null,modelId=null,loading=false,nextID=1,modelsCache=null;
const pending=new Map();
export function status(){return{ready:!!modelId,modelId,loading};}
export async function detectWebGPU(){
 if(!globalThis.isSecureContext||typeof navigator==="undefined"||!navigator.gpu)
  return{supported:false,reason:"WebGPU et HTTPS sont nécessaires. L'assistant documentaire reste disponible."};
 try{const adapter=await navigator.gpu.requestAdapter();if(!adapter)return{supported:false,reason:"Aucun adaptateur WebGPU disponible."};return{supported:true,f16:adapter.features?.has("shader-f16")||false};}
 catch{return{supported:false,reason:"Accès WebGPU refusé par le navigateur."};}
}
function failAll(message){
 for(const job of pending.values()){clearTimeout(job.timeout);job.reject(new Error(message));}
 pending.clear();worker?.terminate();worker=null;modelId=null;loading=false;modelsCache=null;
}
function requireWorker(){
 if(worker)return worker;
 if(typeof Worker==="undefined")throw Error("Web Workers non pris en charge.");
 worker=new Worker(new URL("./gemma-worker.mjs",import.meta.url),{type:"module"});
 worker.onmessage=event=>{
  const {id,kind,progress,text,message,...values}=event.data||{},job=pending.get(id);
  if(!job)return;
  if(kind==="progress"){job.onProgress?.({progress,text});return;}
  pending.delete(id);clearTimeout(job.timeout);
  if(kind==="error")job.reject(new Error(message||"Erreur du moteur local."));
  else job.resolve({...values,text});
 };
 worker.onerror=()=>failAll("Le moteur IA local s'est arrêté ou n'a pas pu démarrer.");
 worker.onmessageerror=()=>failAll("Réponse illisible du moteur IA local.");
 return worker;
}
function rpc(action,params={},onProgress){
 const instance=requireWorker(),id=nextID++;
 const timeoutMs=action==="load"?600000:action==="generate"?120000:40000;
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{pending.delete(id);reject(new Error("Délai dépassé pour "+action+". Réessayez après avoir vérifié la connexion et la mémoire."));if(action!=="generate")failAll("Chargement du moteur annulé.");},timeoutMs);
  pending.set(id,{resolve,reject,onProgress,timeout});
  try{instance.postMessage({id,action,...params});}
  catch(e){clearTimeout(timeout);pending.delete(id);reject(e);}
 });
}
export async function listLocalModels(){
 const cap=await detectWebGPU();if(!cap.supported)throw Error(cap.reason);
 const {models}=await rpc("catalog");
 modelsCache=(models||[]).filter(x=>x&&typeof x.id==="string").slice(0,150);
 if(!modelsCache.length)throw Error("Aucun modèle compatible listé par cette version de WebLLM.");
 return modelsCache;
}
const sizeB=id=>{
 const m=String(id).match(/(?:^|[-_])(\d+(?:\.\d+)?)B(?:[-_]|$)/i);
 return m?Number(m[1]):100;
};
export function selectModel(models,{variant="auto",preference="auto",f16=false}={}){
 const candidates=(models||[]).filter(x=>x?.id&&
   (f16||!/q\df16|q0f16|f16_\d|f16-mlc/i.test(x.id)) &&
   (variant==="auto"||(variant==="f16"?/f16/i.test(x.id):!/f16/i.test(x.id))));
 if(preference!=="auto"){
  const match=candidates.find(x=>x.id===preference);
  if(!match)throw Error("Modèle choisi indisponible ou non compatible avec les capacités WebGPU sélectionnées.");
  return match.id;
 }
 if(!candidates.length)throw Error("Aucun modèle WebLLM adapté au GPU et à la précision choisis. Essayez l'autre mode ou un navigateur plus récent.");
 const scoring=x=>{
  const id=x.id,small=sizeB(id);
  let penalty=small*100;
  if(/qwen3|qwen2\.5/i.test(id))penalty-=18;
  if(/gemma-4/i.test(id))penalty-=12;
  if(/q4f16|q4f32/i.test(id))penalty-=8;
  if(/q0f16/i.test(id))penalty+=40;
  return penalty;
 };
 return [...candidates].sort((a,b)=>scoring(a)-scoring(b)||a.id.localeCompare(b.id))[0].id;
}
export async function loadGemma({variant="auto",model="auto",onProgress=()=>{}}={}){
 if(modelId)return{modelId,alreadyLoaded:true};if(loading)throw Error("Chargement déjà en cours.");
 const cap=await detectWebGPU();if(!cap.supported)throw Error(cap.reason);
 loading=true;
 try{
  onProgress({text:"Vérification des modèles réellement répertoriés par WebLLM…",progress:0});
  const list=modelsCache||await listLocalModels();
  const selected=selectModel(list,{variant,preference:model,f16:cap.f16});
  onProgress({text:"Chargement de "+selected+" depuis l'hébergeur du modèle (avec votre accord)…",progress:0});
  await rpc("load",{model:selected},onProgress);
  modelId=selected;return{modelId,alreadyLoaded:false};
 }catch(error){if(worker){worker.terminate();worker=null;}modelsCache=null;throw error;}
 finally{loading=false;}
}
export function canPlanWithGemma(question){
 const q=String(question||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 return /(tache|quotidien|courses|menage|lessive|administrati|organis|priorite|liste de choses)/.test(q)&&!/(medicament|dose|prescri|douleur|crise|fibromyalgie|symptom|suicid|traitement|diagnos|allerg|maladie|medical|medecin|urgence)/.test(q);
}
export function safePlanInput(question,{energy=5,tasks=[]}={}){
 const safeTasks=tasks.filter(t=>!t.done).slice(0,12).map((t,i)=>({
  index:i,effort:[1,2,3].includes(Number(t.effort))?Number(t.effort):3,
  priorite:["important","normal","delegable"].includes(t.priority)?t.priority:"normal"
 }));
 return [
  {role:"system",content:"Tu classes des tâches non médicales, anonymisées. Réponds STRICTEMENT en JSON {\"ordre\":[0,1]}. Choisis au maximum trois indices existants distincts, selon l'énergie, l'effort et la priorité. N'ajoute aucune prose, aucun conseil médical ni numéro absent. Si aucune tâche n'est possible, réponds {\"ordre\":[]}."},
  {role:"user",content:"Énergie déclarée de 0 à 10 : "+Math.min(10,Math.max(0,Number(energy)||0))+". Descripteurs anonymes : "+JSON.stringify(safeTasks)+". Aucun intitulé de tâche, note clinique ou question n'est fourni."}
 ];
}
export function parseTaskOrder(answer,count){
 if(typeof answer!=="string"||answer.length>300||!Number.isSafeInteger(count)||count<0||count>12)return null;
 let obj;try{obj=JSON.parse(answer.trim());}catch{return null;}
 if(!obj||typeof obj!=="object"||Array.isArray(obj)||Object.keys(obj).length!==1||!Array.isArray(obj.ordre)||obj.ordre.length>3)return null;
 const ids=obj.ordre;
 if(!ids.every(x=>Number.isSafeInteger(x)&&x>=0&&x<count)||new Set(ids).size!==ids.length)return null;
 return ids;
}
export function validatePlanOutput(answer){
 const s=String(answer||"").trim();
 return s.length>=5&&s.length<=300&&!/dosage|posologie|milligramme|arr[eê]tez votre traitement/i.test(s)?s:null;
}
export async function generateLifePlan(question,context={}){
 if(!modelId)throw Error("Modèle non chargé.");
 if(!canPlanWithGemma(question))throw Error("Seule l'organisation non médicale est autorisée ici.");
 const tasks=(context.tasks||[]).filter(t=>!t.done).slice(0,12);
 if(!tasks.length)throw Error("Aucune tâche enregistrée.");
 const result=await rpc("generate",{messages:safePlanInput(question,{...context,tasks})});
 const indices=parseTaskOrder(result.text,tasks.length);
 if(!indices||!indices.length)throw Error("Le modèle n'a pas fourni de classement fiable, repli sur le moteur local.");
 return "Suggestion de classement : "+indices.map((i,j)=>(j+1)+". "+String(tasks[i].title||"").slice(0,90)).join(" ; ")+". Prévoyez des pauses selon votre ressenti. Ceci n'est pas un avis médical.";
}
export async function generateGeneralChat(question,history=[]){
 if(!modelId)throw Error("Aucun modèle local chargé.");
 const messages=nonMedicalMessages(question,history);
 const result=await rpc("generate",{messages});
 return cleanGeneratedReply(result.text)+"\n\n[Réponse générée localement par "+modelId+" ; vérifiez les faits importants.]";
}
export async function unloadGemma(){
 if(worker){try{if(modelId)await rpc("unload");}finally{worker.terminate();worker=null;}}
 modelId=null;modelsCache=null;loading=false;
}
