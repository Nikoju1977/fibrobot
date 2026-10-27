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
let worker=null,modelId=null,loading=false,nextID=1,modelsCache=null,lastError="";
const pending=new Map();
export function status(){return{ready:!!modelId,modelId,loading,lastError};}
export async function detectWebGPU(){
 if(!globalThis.isSecureContext||typeof navigator==="undefined"||!navigator.gpu)
  return{supported:false,reason:"WebGPU et HTTPS sont nécessaires. L'assistant documentaire reste disponible."};
 try{const adapter=await navigator.gpu.requestAdapter();if(!adapter)return{supported:false,reason:"Aucun adaptateur WebGPU disponible."};return{supported:true,f16:adapter.features?.has("shader-f16")||false};}
 catch{return{supported:false,reason:"Accès WebGPU refusé par le navigateur."};}
}
function failAll(message){
 for(const job of pending.values()){clearTimeout(job.timeout);job.reject(new Error(message));}
 pending.clear();worker?.terminate();worker=null;modelId=null;loading=false;modelsCache=null;lastError=String(message||"Erreur du moteur local.");
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
  if(kind==="error"){lastError=message||"Erreur du moteur local.";job.reject(new Error(lastError));}
  else{lastError="";job.resolve({...values,text});}
 };
 worker.onerror=()=>failAll("Le moteur IA local s'est arrêté ou n'a pas pu démarrer.");
 worker.onmessageerror=()=>failAll("Réponse illisible du moteur IA local.");
 return worker;
}
function rpc(action,params={},onProgress){
 const instance=requireWorker(),id=nextID++;
 const timeoutMs=action==="load"?600000:action==="generate"?120000:40000;
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{
   pending.delete(id);
   reject(new Error("Délai dépassé pour "+action+". Le moteur a été réinitialisé afin d'éviter un blocage."));
   failAll("Le moteur IA local a été réinitialisé après un délai dépassé.");
  },timeoutMs);
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
const vram=x=>Number.isFinite(x?.estimatedMB)&&x.estimatedMB>0?x.estimatedMB:99999;
/** Selection conservatrice : d'abord la RAM GPU requise, puis un modèle compact
 * adapté à la conversation. Le choix explicite Gemma reste disponible mais
 * peut dépasser les ressources de certains appareils mobiles.
 */
export function selectModel(models,{variant="auto",preference="auto",f16=false,budgetMB=1150}={}){
 const compatible=(models||[]).filter(x=>typeof x?.id==="string"&&
   (f16||!(x.requiresF16||/q4f16|q0f16|q8f16/i.test(x.id))) &&
   (variant==="auto"||(variant==="f16"?/f16/i.test(x.id):!/f16/i.test(x.id))));
 if(!compatible.length)throw Error("Aucun modèle local utilisable avec ce GPU ou cette précision.");
 if(preference==="gemma"){
  const gemma=compatible.filter(x=>/gemma-4-E2B/i.test(x.id)).sort((a,b)=>vram(a)-vram(b));
  if(!gemma.length)throw Error("Gemma 4 E2B n'est pas disponible pour ce GPU dans le catalogue installé. Choisissez un modèle léger.");
  return gemma[0].id;
 }
 if(preference!=="auto"){
  const found=compatible.find(x=>x.id===preference);
  if(!found)throw Error("Modèle demandé absent ou incompatible : aucun téléchargement engagé.");
  return found.id;
 }
 const budget=Number.isFinite(budgetMB)&&budgetMB>0?budgetMB:1150;
 const within=compatible.filter(x=>vram(x)<=budget);
 if(!within.length)throw Error("Aucun modèle léger compatible avec la mémoire estimée. Vous pouvez tester une sélection manuelle, à vos risques de plantage.");
 // Favorise des modèles instruct compacts ; interdit les configurations particulièrement volumineuses par défaut.
 const score=x=>{
  let s=vram(x);
  if(/qwen/i.test(x.id))s-=65;
  if(/smollm/i.test(x.id))s-=35;
  if(!/instruct|it-|chat/i.test(x.id))s+=160;
  return s;
 };
 return within.sort((a,b)=>score(a)-score(b)||a.id.localeCompare(b.id))[0].id;
}
export function estimatedBudgetMB(deviceMemoryGB){
 const gb=Number(deviceMemoryGB);
 if(!Number.isFinite(gb)||gb<=0)return 850;
 if(gb<=2)return 430;
 if(gb<=4)return 850;
 if(gb<=6)return 1150;
 if(gb<=8)return 1750;
 return 2400;
}
export async function loadGemma({variant="auto",model="auto",onProgress=()=>{}}={}){
 if(modelId)return{modelId,alreadyLoaded:true};if(loading)throw Error("Chargement déjà en cours.");
 const cap=await detectWebGPU();if(!cap.supported)throw Error(cap.reason);
 loading=true;
 try{
  onProgress({text:"Vérification des modèles réellement répertoriés par WebLLM…",progress:0});
  const list=modelsCache||await listLocalModels();
  const selected=selectModel(list,{variant,preference:model,f16:cap.f16,
   budgetMB:estimatedBudgetMB(typeof navigator==="undefined"?0:navigator.deviceMemory)});
  onProgress({text:"Chargement de "+selected+" depuis l'hébergeur du modèle (avec votre accord)…",progress:0});
  await rpc("load",{model:selected},onProgress);
  modelId=selected;lastError="";return{modelId,alreadyLoaded:false};
 }catch(error){if(worker){worker.terminate();worker=null;}modelsCache=null;modelId=null;throw error;}
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
/**
 * Self-test de génération sans dossier patient. Il confirme l'inférence, et
 * pas seulement le téléchargement des poids et l'initialisation du moteur.
 */
export async function testLocalModel(){
 if(!modelId)throw Error("Aucun modèle chargé dans cette session.");
 const began=Date.now();
 const result=await rpc("generate",{
  messages:[
   {role:"system",content:"Réponds à une question simple en français, sans données personnelles ni médicales. Une seule courte phrase."},
   {role:"user",content:"Combien font 2 + 2 ?"}
  ]
 });
 const answer=String(result.text||"").trim();
 if(!answer)throw Error("Le modèle a renvoyé une réponse vide.");
 return {modelId,answerLength:answer.length,durationMs:Date.now()-began};
}
export function cancelGemmaLoad(){
 if(!loading)return false;
 failAll("Téléchargement/chargement annulé à votre demande. Le mode documentaire est toujours disponible.");
 return true;
}
export async function unloadGemma(){
 if(worker){try{if(modelId)await rpc("unload");}finally{worker.terminate();worker=null;}}
 modelId=null;modelsCache=null;loading=false;lastError="";
}
