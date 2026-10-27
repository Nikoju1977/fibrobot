import test from "node:test";
import assert from "node:assert/strict";
import {loadGemma,status,generateGeneralChat,testLocalModel,unloadGemma} from "../gemma-local.mjs";

// Simulation déterministe du protocole Worker : les poids multi-Go ne sont pas requis.
let generated=0,lastMessages=[];
class MockWorker {
 constructor(){this.onmessage=null;this.onerror=null;}
 postMessage(req){
  queueMicrotask(()=>{
   if(req.action==="catalog"){
    this.onmessage?.({data:{id:req.id,kind:"result",models:[
     {id:"Qwen2.5-0.5B-Instruct-q4f32_1-MLC",estimatedMB:750,requiresF16:false}
    ]}});return;
   }
   if(req.action==="load"){
    this.onmessage?.({data:{id:req.id,kind:"result",modelId:req.model}});return;
   }
   if(req.action==="generate"){
    lastMessages=req.messages;generated++;
    this.onmessage?.({data:{id:req.id,kind:"result",text:"Bonjour, je suis FibroBot."}});return;
   }
   if(req.action==="unload"){
    this.onmessage?.({data:{id:req.id,kind:"result",unloaded:true}});return;
   }
  });
 }
 terminate(){}
}
test("runtime simulé : catalogue, chargement, dialogue et auto-test d'inférence",async()=>{
 const oldWorker=globalThis.Worker;
 const oldGpu=globalThis.navigator;
 const oldContext=globalThis.isSecureContext;
 globalThis.Worker=MockWorker;
 Object.defineProperty(globalThis,"navigator",{configurable:true,value:{gpu:{requestAdapter:async()=>({features:new Set([])})},deviceMemory:4}});
 globalThis.isSecureContext=true;
 try{
  const loaded=await loadGemma({model:"auto"});
  assert.match(loaded.modelId,/Qwen2.5/);
  assert.equal(status().ready,true);
  const answer=await generateGeneralChat("Bonjour FibroBot, peux-tu me saluer ?",[]);
  assert.match(answer,/Bonjour, je suis FibroBot/);
  assert.ok(lastMessages.every(m=>!m.content.includes("SECRET-PATIENT")));
  const check=await testLocalModel();
  assert.equal(check.modelId,loaded.modelId);
  assert.ok(check.answerLength>0);
  assert.equal(generated,2);
  await unloadGemma();
  assert.equal(status().ready,false);
 }finally{
  globalThis.Worker=oldWorker;
  Object.defineProperty(globalThis,"navigator",{configurable:true,value:oldGpu});
  globalThis.isSecureContext=oldContext;
 }
});
