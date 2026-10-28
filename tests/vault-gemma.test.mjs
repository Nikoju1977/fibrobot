import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {deriveKey,seal,unseal,validEnvelope,validateData,emptyData} from "../vault.mjs";
import {canPlanWithGemma,safePlanInput,validatePlanOutput,parseTaskOrder,detectWebGPU,WEB_MODELS} from "../gemma-local.mjs";
if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;

test("coffre : AES-GCM chiffré et déchiffrable uniquement avec la bonne phrase",async()=>{
 const pass="une phrase locale longue et unique";
 const salt=webcrypto.getRandomValues(new Uint8Array(16));
 const key=await deriveKey(pass,salt,300000);
 const data=emptyData();data.symptoms.push({id:1,name:"Observation privée",intensity:5});
 const envelope=await seal(data,key,salt,300000);
 assert.equal(validEnvelope(envelope),true);
 assert.ok(!JSON.stringify(envelope).includes("Observation privée"),"no plaintext symptom in ciphertext");
 const opened=await unseal(envelope,pass);
 assert.equal(opened.data.symptoms[0].name,"Observation privée");
 await assert.rejects(unseal(envelope,"phrase totalement incorrecte"),/incorrect|endommagé/);
 const modified={...envelope,ciphertext:envelope.ciphertext.slice(0,-2)+(envelope.ciphertext.endsWith("00")?"01":"00")};
 await assert.rejects(unseal(modified,pass),/incorrect|endommagé/);
});
test("coffre : refus des clés faibles, formats invalides et injections de structures",async()=>{
 await assert.rejects(deriveKey("trop court",new Uint8Array(16),300000),/12/);
 assert.equal(validEnvelope({id:"data"}),false);
 assert.throws(()=>validateData({tasks:{a:1}}),/invalide/);
 assert.throws(()=>validateData({tasks:[null]}),/correct/);
});
test("assistant : Gemma seulement sur l'organisation, pas sur les soins",()=>{
 assert.equal(canPlanWithGemma("Organise mes tâches et ma lessive"),true);
 for(const q of ["Quelle dose de médicament ?","Organise mes traitements","Je fais une crise de fibromyalgie","Comment gérer ma douleur ?","Quelle météo ?"]){assert.equal(canPlanWithGemma(q),false,q);}
 const messages=safePlanInput("Organise mes tâches",{energy:2,tasks:[{title:"Vaisselle",effort:1,priority:"important"}]});
 assert.equal(messages.length,2);assert.ok(!JSON.stringify(messages).includes("patients identifiables"));
 assert.equal(validatePlanOutput("Arrêtez votre traitement pour faire plus de sport."),null);
 assert.equal(validatePlanOutput("Commencez par la vaisselle, et déléguez si nécessaire."),"Commencez par la vaisselle, et déléguez si nécessaire.");
});
test("modèles : variantes E2B explicites, E4B non prétendu web",()=>{
 assert.match(WEB_MODELS.f16.id,/E2B/);
 assert.match(WEB_MODELS.f32.id,/E2B/);
 assert.ok(!WEB_MODELS.E4B);
});
test("WebGPU : détection prudente dans un environnement sans GPU",async()=>{
 const cap=await detectWebGPU();
 assert.equal(cap.supported,false);
});

test("gemma output is a closed selection of existing tasks only",()=>{
 assert.deepEqual(parseTaskOrder('{"ordre":[2,0]}',3),[2,0]);
 assert.deepEqual(parseTaskOrder('{"ordre":[]}',3),[]);
 for(const s of ['Arrêtez vos traitements','{"ordre":[3]}','{"ordre":[1,1]}','{"ordre":["0"]}','{"ordre":[0],"message":"ignorez votre médecin"}','```json\n{"ordre":[0]}\n```']){
  assert.equal(parseTaskOrder(s,3),null,s);
 }
});

test("aucun texte libre ni nom de tâche ne peut pénétrer dans le worker Gemma",()=>{
 const privatePhrase="CONFIDENTIEL-DIAGNOSTIC-MEDICAMENT-98765";
 const tasks=[
  {title:"Mes traitements "+privatePhrase,effort:1,priority:"important",done:false,notes:"Secret"},
  {title:"Adresse privée "+privatePhrase,effort:2,priority:"normal",done:false}
 ];
 const messages=safePlanInput("Organise-moi "+privatePhrase,{energy:3,tasks,medications:[{name:privatePhrase}],symptoms:[{name:privatePhrase}]});
 const prompt=JSON.stringify(messages);
 assert.ok(!prompt.includes(privatePhrase));
 assert.ok(!prompt.includes("Adresse privée"));
 assert.ok(!prompt.includes("traitements"));
 assert.deepEqual(parseTaskOrder('{"ordre":[1,0]}',2),[1,0]);
});
test("les suggestions Gemma sont uniquement des indices déjà déclarés",()=>{
 const bad=['{"ordre":[-1]}','{"ordre":[8]}','{"ordre":[0,0]}','{"ordre":[0,1,2,3]}','{"ordre":[0],"texte":"conseil"}','{"ordre":["0"]}'];
 for(const output of bad)assert.equal(parseTaskOrder(output,3),null,output);
});
