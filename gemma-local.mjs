/* Gemma 4 E2B WebGPU — aucune API de génération distante.
 * Le téléchargement optionnel du runtime et des poids contacte leurs hébergeurs.
 * E4B requiert un client LiteRT-LM natif; non activé ici.
 */
export const WEBLLM_VERSION="0.2.86";
export const WEBLLM_URL="https://esm.run/@mlc-ai/web-llm@0.2.86";
export const WEB_MODELS=Object.freeze({
 f16:{id:"gemma-4-E2B-it-q4f16_1-MLC",label:"Gemma 4 E2B · q4f16",feature:"shader-f16"},
 f32:{id:"gemma-4-E2B-it-q4f32_1-MLC",label:"Gemma 4 E2B · q4f32",feature:null}
});
let worker=null,modelId=null,loading=false,nextID=1;
const pending=new Map();
export function status(){return{ready:!!modelId,modelId,loading};}
export async function detectWebGPU(){if(!globalThis.isSecureContext||typeof navigator==="undefined"||!navigator.gpu)return{supported:false,reason:"WebGPU et HTTPS sont nécessaires. Utilisez un navigateur moderne ou l'assistant documentaire."};try{const adapter=await navigator.gpu.requestAdapter();if(!adapter)return{supported:false,reason:"Aucun GPU WebGPU disponible."};return{supported:true,f16:adapter.features?.has("shader-f16")||false};}catch(e){return{supported:false,reason:"Accès au GPU refusé par le navigateur."};}}
function requireWorker(){
 if(worker)return worker;
 if(typeof Worker==="undefined")throw Error("Les Web Workers ne sont pas pris en charge.");
 worker=new Worker(new URL("./gemma-worker.mjs",import.meta.url),{type:"module"});
 worker.onmessage=event=>{const {id,kind,progress,text,message,...value}=event.data||{};const req=pending.get(id);if(!req)return;if(kind==="progress"){req.onProgress?.({progress,text});return;}pending.delete(id);if(kind==="error")req.reject(new Error(message||"Erreur du moteur WebGPU."));else req.resolve({...value,text});};
 worker.onerror=()=>{for(const req of pending.values())req.reject(new Error("Le worker Gemma a échoué."));pending.clear();worker?.terminate();worker=null;modelId=null;};
 return worker;
}
function rpc(action,params={},onProgress){const instance=requireWorker();const id=nextID++;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject,onProgress});try{instance.postMessage({id,action,...params});}catch(e){pending.delete(id);reject(e);}});}
export async function loadGemma({variant="auto",onProgress=()=>{}}={}){
 if(modelId)return{modelId,alreadyLoaded:true};if(loading)throw Error("Chargement déjà en cours.");
 const cap=await detectWebGPU();if(!cap.supported)throw Error(cap.reason);
 loading=true;
 try{
  const selected=variant==="f32"?"f32":variant==="f16"?"f16":cap.f16?"f16":"f32";
  if(selected==="f16"&&!cap.f16)throw Error("FP16 indisponible sur le GPU.");
  onProgress({text:"Téléchargement du runtime en worker isolé. Aucune clé du coffre n'y est transmise.",progress:0});
  const id=WEB_MODELS[selected].id;
  await rpc("load",{model:id},onProgress);modelId=id;
  return{modelId,alreadyLoaded:false};
 }catch(error){if(worker){worker.terminate();worker=null;}throw error;}
 finally{loading=false;}
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
export async function unloadGemma(){if(worker){try{if(modelId)await rpc("unload");}finally{worker.terminate();worker=null;}}modelId=null;}
