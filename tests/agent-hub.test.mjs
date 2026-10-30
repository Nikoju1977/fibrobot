import test from "node:test";
import assert from "node:assert/strict";
import {SPECIALISTS,routeSpecialist,runSpecialist} from "../agent-hub.mjs";
import {status,testLocalModel} from "../gemma-local.mjs";

test("catalogue explicite de douze agents documentaires avec identifiants distincts",()=>{
 assert.equal(SPECIALISTS.length,12);
 assert.equal(new Set(SPECIALISTS.map(x=>x.id)).size,12);
 for(const x of SPECIALISTS){assert.ok(x.name&&x.role&&x.sourceId);}
});

test("routage automatique des sujets fibromyalgie sans confusion avec prescription",()=>{
 assert.equal(routeSpecialist("Comment mieux noter mes douleurs de fibromyalgie ?"),"pain");
 assert.equal(routeSpecialist("Je dors mal, parlons de mon sommeil"),"sleep");
 assert.equal(routeSpecialist("Je suis fatigué avec un brouillard cognitif"),"fatigue");
 assert.equal(routeSpecialist("Comment organiser mes courses ?"),"pacing");
 assert.equal(routeSpecialist("Préparer ma consultation"),"visit");
 assert.equal(routeSpecialist("Quelle dose de mon médicament ?"),null);
 assert.equal(routeSpecialist("Bonjour, écrivons un poème"),null);
});

test("les agents synthétisent le journal patient local sans diagnostic",()=>{
 const ctx={energy:3,tasks:[{title:"Faire la vaisselle",effort:1,priority:"important",done:false}],
 symptoms:[{date:"2026-10-26",name:"Observation déclarée",intensity:4,fatigue:8,sleep:3}],
 appointments:[{title:"Consultation",date:"2099-03-10",time:"13:30",questions:"Question personnelle"}],
 medications:[{name:"Médicament déclaré"}],conditions:[{name:"Fibromyalgie"}]};
 const pacing=runSpecialist("pacing",ctx);
 assert.match(pacing.answer,/vaisselle/);
 assert.equal(pacing.sourceId,"daily");
 const sleep=runSpecialist("sleep",ctx);
 assert.match(sleep.answer,/Sommeil/);
 assert.match(sleep.answer,/observation/i);
 assert.equal(sleep.sourceId,"sleep");
 const visit=runSpecialist("visit",ctx);
 assert.match(visit.answer,/Consultation/);
 assert.match(visit.answer,/Question personnelle/);
 const drug=runSpecialist("medication",ctx);
 assert.match(drug.answer,/Médicament déclaré/);
 assert.match(drug.answer,/pharmacien/);
 assert.doesNotMatch(drug.answer,/augmentez la dose|réduisez la dose/i);
});

test("urgence et prescription sont interceptées y compris depuis un agent explicite",()=>{
 const urgent=runSpecialist("pain",{},"Je veux me suicider et j'ai une douleur");
 assert.equal(urgent.id,"safety");
 assert.match(urgent.answer,/3114/);
 const dose=runSpecialist("medication",{},"Quelle dose de médicament dois-je prendre ?");
 assert.equal(dose.id,"safety");
 assert.match(dose.answer,/ne peux pas déterminer/);
});

test("un agent inconnu ne peut pas exécuter un outil arbitraire",()=>{
 assert.throws(()=>runSpecialist("openai-api"),/Agent inconnu/);
});

test("un téléchargement sans chargement ne suffit pas à valider la génération LLM",async()=>{
 assert.equal(status().ready,false);
 await assert.rejects(testLocalModel(),/Aucun modèle chargé/);
});
