/* Worker de génération Gemma. Le coffre, son mot de passe et sa clé ne sont
 * jamais transmis à ce contexte. Seuls tâches, énergie et question pratique
 * préfiltrés arrivent via postMessage. WebGPU/chargement réels à tester.
 */
let engine=null,modelId=null;
const version="https://esm.run/@mlc-ai/web-llm@0.2.86";
const send=(id,kind,payload={})=>postMessage({id,kind,...payload});
self.onmessage=async event=>{
 const {id,action,model,messages}=event.data||{};
 try{
  if(action==="load"){
   if(engine)throw Error("Modèle déjà chargé.");
   const pkg=await import(version);
   if(typeof pkg.CreateMLCEngine!=="function")throw Error("Runtime WebLLM absent.");
   const instance=await pkg.CreateMLCEngine(model,{initProgressCallback:p=>send(id,"progress",{progress:p?.progress||0,text:p?.text||"Chargement…" })});
   engine=instance;modelId=model;send(id,"result",{modelId});return;
  }
  if(action==="generate"){
   if(!engine)throw Error("Modèle non chargé.");
   if(!Array.isArray(messages)||messages.length!==2||messages.some(m=>!["system","user"].includes(m?.role)||typeof m.content!=="string"))throw Error("Format de requête local invalide.");
   const result=await engine.chat.completions.create({messages,temperature:0,max_tokens:320});
   send(id,"result",{text:result?.choices?.[0]?.message?.content||""});return;
  }
  if(action==="unload"){
   if(engine?.unload)await engine.unload();
   engine=null;modelId=null;send(id,"result",{unloaded:true});return;
  }
  throw Error("Action interdite");
 }catch(error){send(id,"error",{message:String(error?.message||error).slice(0,300)});}
};
