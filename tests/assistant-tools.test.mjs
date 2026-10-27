import test from "node:test";
import assert from "node:assert/strict";
import {buildDailyPlan,summarizeJournal,prepareVisit,searchMedicalLibrary,assistantToolReply,safeGeneralQuestion,safeGeneratedAnswer} from "../assistant-tools.mjs";
import {modelCandidates,WEB_MODELS} from "../gemma-local.mjs";
import {LIBRARY} from "../medical-library.mjs";

const records={energy:2,tasks:[
 {id:1,title:"Préparer les documents",effort:1,priority:"important",done:false},
 {id:2,title:"Déménager les meubles",effort:3,priority:"delegable",done:false},
 {id:3,title:"Petite lessive",effort:1,priority:"normal",done:false}
],symptoms:[{id:1,name:"Douleur déclarée",date:"2026-10-25",intensity:7,energy:3},
{id:2,name:"Fatigue déclarée",date:"2026-10-27",intensity:5}],
conditions:[{id:1,name:"Fibromyalgie"}],medications:[{id:1,name:"Traitement déclaré"}],
appointments:[{id:1,title:"Consultation",date:"2099-01-01",time:"10:30"}]};

test("daily plan is deterministic, bounded to existing tasks and effort",()=>{
 const p=buildDailyPlan(records);
 assert.match(p,/Préparer les documents/);
 assert.match(p,/Petite lessive/);
 assert.match(p,/Déménager les meubles/);
 assert.match(p,/À reporter ou déléguer/);
 assert.match(buildDailyPlan({tasks:[],energy:5}),/Aucune tâche/);
 const noExcess=buildDailyPlan({energy:8,tasks:Array.from({length:20},(_,i)=>({id:i,title:"Travail "+i,effort:1,priority:"normal"}))});
 assert.equal((noExcess.match(/\(effort déclaré/g)||[]).length,3);
});

test("journal and consultation never infer medical conditions",()=>{
 const report=summarizeJournal(records);
 assert.match(report,/2026-10-27/);
 assert.match(report,/7\/10/);
 assert.match(report,/sans diagnostic/);
 assert.match(summarizeJournal({symptoms:[]}),/aucune observation/i);
 const visit=prepareVisit(records);
 assert.match(visit,/Fibromyalgie/);
 assert.match(visit,/Traitement déclaré/);
 assert.match(visit,/sans validation des doses/i);
 assert.match(visit,/2099-01-01/);
});

test("local medical library search yields only explicitly sourced entries",()=>{
 const r=searchMedicalLibrary("sources fibromyalgie",LIBRARY);
 assert.ok(r.length>0&&r.length<=4);
 for(const d of r){assert.ok(d.url.startsWith("https://"));assert.ok(LIBRARY.some(src=>src.id===d.id));}
 assert.deepEqual(searchMedicalLibrary("xyznonexistenttopic",LIBRARY),[]);
 assert.match(assistantToolReply("Cherche des sources scientifiques sur la fibromyalgie",records,LIBRARY).message,/bibliothèque locale/);
});

test("patient intents route to safe deterministic tools",()=>{
 assert.equal(assistantToolReply("Planifie ma journée et mes tâches",records,LIBRARY).kind,"plan");
 assert.equal(assistantToolReply("Fais un bilan de mon journal de santé",records,LIBRARY).kind,"summary");
 assert.equal(assistantToolReply("Prépare ma consultation médicale",records,LIBRARY).kind,"visit");
 assert.equal(assistantToolReply("Bonjour",records,LIBRARY),null);
});

test("nonmedical local LLM filter rejects medical, personal and real-time requests",()=>{
 for(const v of ["Quelle dose de médicament prendre ?","Comment soigner ma fibromyalgie ?",
  "Peux-tu analyser ma douleur ?","Je suis suicidaire","Voici mon email m@example.org",
  "Mon adresse est rue de Paris","Quel temps fera-t-il demain ?",
  "Quelle est ma tension ?","Dois-je arrêter mon traitement ?"]){
  assert.equal(safeGeneralQuestion(v),false,v);
 }
 for(const v of ["Explique ce qu'est la photographie","Écris une histoire de science fiction",
 "Comment trier mon bureau ?"]){assert.equal(safeGeneralQuestion(v),true,v);}
 assert.equal(safeGeneralQuestion("x".repeat(501)),false);
});

test("generated text guard blocks medical dosing and unsupported URLs",()=>{
 for(const v of ["Prenez 10 milligrammes chaque soir","Voici mon diagnostic","Visitez https://example.com","Arrêtez votre traitement"]){
  assert.equal(safeGeneratedAnswer(v),null,v);
 }
 assert.equal(safeGeneratedAnswer("La photographie joue sur la lumière."),"La photographie joue sur la lumière.");
});

test("model catalog matches upstream ID patterns and memory fallback behavior",()=>{
 assert.match(WEB_MODELS.f16.id,/gemma-4-E2B/);
 assert.match(WEB_MODELS.lite32.id,/SmolLM2-360M/);
 const noF16={f16:false};
 assert.deepEqual(modelCandidates("lite",noF16,2),["lite32"]);
 assert.deepEqual(modelCandidates("auto",noF16,2),["lite32"]);
 assert.deepEqual(modelCandidates("auto",{f16:true},4),["lite16","lite32"]);
 assert.deepEqual(modelCandidates("auto",noF16,8),["f32","lite32"]);
 assert.deepEqual(modelCandidates("gemma",noF16,3),["f32"]);
 assert.throws(()=>modelCandidates("not-a-model",noF16,8),/inconnu/);
});
