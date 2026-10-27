import test from "node:test";
import assert from "node:assert/strict";
import {classifyIntent,summarizeObservations,prepareVisit,planDaily,nonMedicalMessages,researchEndpoint,parseResearchResults,cleanGeneratedReply} from "../assistant-engine.mjs";
import {selectModel,estimatedBudgetMB,canPlanWithGemma,safePlanInput,parseTaskOrder} from "../gemma-local.mjs";
test("routage : requêtes santé sensibles ne sont jamais une conversation libre",()=>{
 for(const s of ["Quel dosage de morphine ?","Peux-je prendre ce médicament ?","J'ai une douleur nouvelle","Je veux me suicider","Quels effets secondaires de mon traitement ?","Analyse mes symptômes et mon diabète","Quel médicament pour dormir ?","J’ai mal à la tête","Je me sens mal, des vertiges","J’ai des nausées"]){
  assert.notEqual(classifyIntent(s),"general",s);
 }
 assert.equal(classifyIntent("Résume mes observations"),"summary");
 assert.equal(classifyIntent("Préparer ma consultation"),"visit");
 assert.equal(classifyIntent("Organise les tâches"),"planning");
 assert.equal(classifyIntent("Comment écrire un poème ?"),"general");
});
test("moteur descriptif : synthèse exacte sans données inventées",()=>{
 assert.match(summarizeObservations({symptoms:[]}),/Aucune observation/);
 const s=summarizeObservations({symptoms:[
  {date:"2026-10-25",name:"Observation déclarée",intensity:4,energy:3},
  {date:"2026-10-26",name:"Deuxième note",intensity:6,fatigue:8}
 ]});
 assert.match(s,/5,0\/10 \(2 notes\)/);
 assert.match(s,/énergie 3,0\/10/);
 assert.match(s,/sans inférence médicale/);
});
test("consultation : profil transcrit et aucune dose inventée",()=>{
 const s=prepareVisit({medications:[{name:"Exemple"}],conditions:[{name:"Condition saisie"}],symptoms:[],appointments:[]});
 assert.match(s,/Exemple/);assert.match(s,/Condition saisie/);
 assert.match(s,/Vérifiez doses et interactions/);
});
test("planning : priorise une tâche possible sans conclure à un niveau médical",()=>{
 const s=planDaily({energy:2,tasks:[{title:"Tâche légère",priority:"important",effort:1,done:false},{title:"Tâche lourde",priority:"normal",effort:3,done:false}]});
 assert.match(s,/Tâche légère/);assert.match(s,/À reporter/);
});
test("dialogue libre : exclusion des conversations médicales du contexte Worker",()=>{
 const history=[{role:"user",purpose:"general-local",body:"Salut, voici ma première question"},{role:"bot",purpose:"medical",body:"MORPHINE-SECRET"},{role:"user",purpose:"general-local",body:"Quelle dose de médicament ?"}];
 const messages=nonMedicalMessages("Donne moi une idée de poème",history);
 assert.ok(!JSON.stringify(messages).includes("MORPHINE-SECRET"));
 assert.ok(!JSON.stringify(messages).includes("dose de médicament"));
 assert.throws(()=>nonMedicalMessages("Quels traitements pour mon diabète ?"),/non admissible/);
 assert.equal(cleanGeneratedReply("Bonjour"),"Bonjour");
});
test("WebLLM : choix dynamique compatible, léger et sécurisé",()=>{
 const candidates=[
 {id:"gemma-4-E2B-it-q4f16_1-MLC",estimatedMB:3200,requiresF16:true},
 {id:"Qwen2.5-0.5B-Instruct-q4f16_1-MLC",estimatedMB:650,requiresF16:true},
 {id:"Qwen2.5-0.5B-Instruct-q4f32_1-MLC",estimatedMB:750,requiresF16:false}
 ];
 assert.equal(selectModel(candidates,{f16:false,budgetMB:850}),candidates[2].id);
 assert.equal(selectModel(candidates,{f16:true,budgetMB:850}),candidates[1].id);
 assert.equal(selectModel(candidates,{f16:true,preference:"gemma"}),candidates[0].id);
 assert.throws(()=>selectModel(candidates,{f16:false,preference:"gemma"}),/Gemma 4/);
 assert.throws(()=>selectModel(candidates,{f16:false,budgetMB:400}),/Aucun modèle léger/);
 assert.equal(estimatedBudgetMB(4),850);
 assert.equal(canPlanWithGemma("Organiser mes tâches"),true);
 assert.equal(canPlanWithGemma("Mes traitements"),false);
});
test("protection des sorties d'indices Gemma",()=>{
 const messages=safePlanInput("mes notes privées",{tasks:[{title:"SECRET-PATIENT",effort:1,priority:"important"}]});
 assert.ok(!JSON.stringify(messages).includes("SECRET-PATIENT"));
 assert.deepEqual(parseTaskOrder('{"ordre":[0]}',1),[0]);
 assert.equal(parseTaskOrder('{"ordre":[100]}',1),null);
});
test("recherche Europe PMC : uniquement des thèmes fixes et liens construits depuis identifiants validés",()=>{
 const url=researchEndpoint("sleep");
 assert.match(url,/www.ebi.ac.uk\/europepmc/);
 assert.ok(!url.includes("SECRET-PATIENT"));
 assert.throws(()=>researchEndpoint("SECRET-PATIENT"),/inconnu/);
 const list=parseResearchResults({resultList:{result:[{source:"MED",id:"123456",title:"A published study",journalTitle:"Example",pubYear:"2025"}]}});
 assert.equal(list.length,1);
 assert.equal(list[0].url,"https://europepmc.org/article/MED/123456");
 assert.throws(()=>parseResearchResults({resultList:{}}),/invalide/);
});

test("sécurité des hallucinations : aucune proposition clinique issue d'une conversation générale",()=>{
 const bad=["Prenez deux comprimés le soir.","Arrêtez votre traitement.","Cela ressemble à un diagnostic.",
  "La morphine peut vous aider.","Vous souffrez de fibromyalgie.","Voir https://site-non-verifie.example"];
 for(const answer of bad)assert.throws(()=>cleanGeneratedReply(answer),undefined,answer);
 assert.equal(cleanGeneratedReply("Je peux aider à écrire un poème."),"Je peux aider à écrire un poème.");
});
test("dialogue général : médicaments courants, identité et données privées exclus",()=>{
 for(const s of ["Peux-tu parler du Doliprane ?","Dois-je utiliser l'ibuprofène ?",
  "Je prends du tramadol.","Parle-moi de la metformine."]){
  assert.equal(classifyIntent(s),"medical",s);
  assert.throws(()=>nonMedicalMessages(s),/non admissible/,s);
 }
 for(const s of ["Voici mon email : nom@example.org","Mon adresse est 12 rue de la Paix",
  "Mon numéro de carte est confidentiel"]){
  assert.throws(()=>nonMedicalMessages(s),/privées/,s);
 }
 const history=[{role:"user",purpose:"general-local",body:"mon adresse est 12 rue de la Paix"},
   {role:"bot",purpose:"general-local",body:"Voici mon poème."}];
 const m=nonMedicalMessages("Écris un poème original",history);
 assert.ok(!JSON.stringify(m).includes("rue de la Paix"));
});
