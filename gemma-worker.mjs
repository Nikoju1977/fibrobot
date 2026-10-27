/* Moteur local WebLLM 0.2.86 : catalogue réel du runtime, aucune API d'inférence distante.
 * L'import de la bibliothèque ne commence qu'après une action explicite.
 * Les poids peuvent occuper plusieurs Go et nécessitent WebGPU.
 */
let engine=null,modelId=null,packageCache=null;
const version="https://esm.run/@mlc-ai/web-llm@0.2.86";
const send=(id,kind,payload={})=>postMessage({id,kind,...payload});
async function library(){
 if(!packageCache)packageCache=import(version).catch(e=>{packageCache=null;throw e;});
 return packageCache;
}
function catalog(pkg){
 const list=pkg?.prebuiltAppConfig?.model_list;
 if(!Array.isArray(list))throw Error("Le runtime ne fournit aucun catalogue de modèles vérifiable.");
 return list.filter(x=>typeof x?.model_id==="string"&&/^[a-zA-Z0-9_.-]{5,150}$/.test(x.model_id))
 .map(x=>({id:x.model_id,estimatedMB:Number.isFinite(x.vram_required_MB)?x.vram_required_MB:null}))
 .filter(x=>/(gemma|qwen|llama|phi|smollm|mistral)/i.test(x.id));
}
self.onmessage=async event=>{
 const {id,action,model,messages}=event.data||{};
 try{
  if(action==="catalog"){
   if(engine){send(id,"result",{models:catalog(await library()),loaded:modelId});return;}
   const pkg=await library();
   send(id,"result",{models:catalog(pkg),loaded:null});
   return;
  }
  if(action==="load"){
   if(engine)throw Error("Un modèle est déjà chargé.");
   const pkg=await library();
   if(!catalog(pkg).some(x=>x.id===model))throw Error("Modèle absent du catalogue WebLLM installé. Choisissez un autre modèle.");
   if(typeof pkg.CreateMLCEngine!=="function")throw Error("Moteur WebLLM non disponible.");
   const instance=await pkg.CreateMLCEngine(model,{initProgressCallback:p=>send(id,"progress",{progress:p?.progress||0,text:p?.text||"Chargement du modèle…"})});
   engine=instance;modelId=model;send(id,"result",{modelId});return;
  }
  if(action==="generate"){
   if(!engine)throw Error("Modèle non chargé.");
   if(!Array.isArray(messages)||messages.length<2||messages.length>8||messages[0]?.role!=="system"||messages[messages.length-1]?.role!=="user"||
      messages.some((m,i)=>!["system","user","assistant"].includes(m?.role)||typeof m.content!=="string"||m.content.length>1800||(i>0&&m.role==="system")))
    throw Error("Format de requête locale non autorisé.");
   const result=await engine.chat.completions.create({messages,temperature:0.25,max_tokens:420});
   send(id,"result",{text:String(result?.choices?.[0]?.message?.content||"").slice(0,2600)});
   return;
  }
  if(action==="unload"){
   if(engine?.unload)await engine.unload();
   engine=null;modelId=null;send(id,"result",{unloaded:true});return;
  }
  throw Error("Action non autorisée");
 }catch(error){send(id,"error",{message:String(error?.message||error).slice(0,400)});}
};
