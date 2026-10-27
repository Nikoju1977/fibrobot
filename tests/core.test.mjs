import test from "node:test";
import assert from "node:assert/strict";
import {today,dateOK,rating,makeSymptom,makeTask,makeCondition,makeAppointment,makeMedication,energyGuide,rankTasks,reply,dueReminders,reminderLog,DB_VERSION} from "../core.mjs";
import {LIBRARY} from "../medical-library.mjs";

test("date locale et validation du calendrier",()=>{assert.equal(today(new Date(2024,1,29)),"2024-02-29");assert.equal(dateOK("2024-02-29"),true);assert.equal(dateOK("2025-02-29"),false);assert.equal(dateOK("2026-13-01"),false);});
test("mesures de santé séparées et contrôlées",()=>{const o=makeSymptom({name:"Douleur",date:"2026-10-26",intensity:7,energy:3,fatigue:8,sleep:2,notes:"Note"});assert.equal(o.energy,3);assert.equal(o.fatigue,8);assert.equal(o.sleep,2);assert.equal(makeSymptom({name:"Fatigue",date:"2026-10-26",intensity:0,energy:""}).energy,null);assert.throws(()=>rating(""),/Note/);assert.throws(()=>rating(-1),/Note/);assert.throws(()=>rating(11),/Note/);});
test("tâches réparties selon l'énergie, données patient indépendantes",()=>{const low=energyGuide(2);assert.equal(low.max,1);const tasks=[makeTask({title:"Courrier",effort:1,priority:"important"}),makeTask({title:"Courses",effort:3,priority:"important"})];const plan=rankTasks(tasks,2);assert.equal(plan[0].title,"Courrier");assert.equal(plan[1].adapted,false);assert.throws(()=>makeTask({title:"Test",effort:4}),/effort/);});
test("conditions et rendez-vous enregistrables sans diagnostic",()=>{assert.equal(makeCondition({name:"Migraine"}).name,"Migraine");assert.equal(makeAppointment({title:"Consultation",date:"2026-10-26",time:"14:30"}).time,"14:30");assert.throws(()=>makeAppointment({title:"Consultation",date:"2026-10-26",time:"25:12"}),/Heure/);});
test("médicaments déclarés, pas de dose prescrite",()=>{let m=makeMedication({name:"Traitement déclaré",dose:"suivant ordonnance",reminderTime:"08:00"});assert.equal(m.reminderTime,"08:00");assert.throws(()=>makeMedication({name:"Test",reminderTime:"29:00"}),/Heure/);});
test("rappels exactement une fois par jour après confirmation",()=>{const now=new Date(2026,9,26,8,30),med=[{id:1,name:"Traitement",reminderTime:"08:00"}],due=dueReminders(med,[],now);assert.equal(due.length,1);const logged=reminderLog(1,"taken",now);assert.equal(logged.date,"2026-10-26");assert.equal(dueReminders(med,[logged],now).length,0);assert.equal(dueReminders(med,[],new Date(2026,9,26,7,59)).length,0);});
test("urgence vitale et risque suicidaire prioritaires",()=>{for(const q of ["J'ai une douleur dans la poitrine","J'ai une douleur thoracique","Je n'arrive pas à respirer","J'ai une difficulté à respirer","Je veux mourir","Je veux me suicider"]){const r=reply(q,LIBRARY);assert.equal(r.kind,"urgent");assert.equal(r.sources.length,0);}});
test("aucun diagnostic, posologie, contre-indication ou interaction inventés",()=>{for(const q of ["Quelle dose de paracétamol ?","Est-ce que mes médicaments interagissent ?","Puis-je prendre un médicament ?","Est-ce une contre-indication ?","Peux-tu me diagnostiquer ?"]){const r=reply(q,LIBRARY,{medications:[{name:"Traitement A"}]});assert.equal(r.kind,"refusal",q);assert.equal(r.sources.length,0);}});
test("maladie non documentée = refus explicite",()=>{const r=reply("Comment traiter mon diabète ?",LIBRARY);assert.equal(r.kind,"refusal");});
test("réponse médicale précise avec référence contrôlée",()=>{const r=reply("Quels sont les symptômes de la fibromyalgie ?",LIBRARY);assert.equal(r.kind,"documented");assert.ok(r.sources.length);assert.match(r.sources[0].url,/^https:\/\/www\.has-sante\.fr\//);});
test("hypnose et thérapies alternatives : incertitudes sourcées",()=>{for(const q of ["L'hypnose peut-elle aider ?","La méditation aide-t-elle ?","L'acupuncture fonctionne-t-elle ?"]){const r=reply(q,LIBRARY);assert.equal(r.kind,"documented",q);assert.ok(r.sources[0].source);}});
test("réponse inconnue et météo jamais inventées",()=>{assert.equal(reply("Connaissez-vous un traitement expérimental impossible ?",[],{}).kind,"refusal");assert.equal(reply("Quel temps fait-il dehors ?",LIBRARY).kind,"weather");});
test("heure venant de l'appareil",()=>{const r=reply("Quelle heure est-il ?",LIBRARY);assert.equal(r.kind,"local");assert.match(r.message,/appareil/);});
test("historique déclaré consulté sans faire de diagnostic",()=>{const r=reply("Quels sont mes médicaments ?",LIBRARY,{medications:[{name:"Traitement déclaré",dose:"texte saisi"}]});assert.equal(r.kind,"profile");assert.match(r.message,/Traitement déclaré/);});
test("version IndexedDB migrée",()=>assert.ok(DB_VERSION>=4));
test("pas de source inconnue insérée",()=>{for(const d of LIBRARY){assert.ok(d.id&&d.title&&d.answer&&/^https:\/\//.test(d.url)&&d.source);}});

test("mode crise : soutien pratique, sans prescription",()=>{const r=reply("Je fais une crise de fibromyalgie",LIBRARY,{conditions:[{name:"Fibromyalgie"}],medications:[{name:"Traitement"}],symptoms:[]});assert.equal(r.kind,"life");assert.match(r.message,/Crise|crise/);assert.match(r.message,/condition/);});
test("recherche scientifique avec étude publiée",()=>{const r=reply("Que sait-on de la génétique de la fibromyalgie ?",LIBRARY);assert.equal(r.kind,"documented");assert.equal(r.sources[0].id,"gwas2026");});

test("les signes de surdosage et oppression thoracique imposent un message prioritaire",()=>{
 for(const q of ["J'ai pris trop de comprimés","Je crains une overdose","Je fais une intoxication médicamenteuse","J'ai une oppression thoracique"]){
  const result=reply(q,LIBRARY);
  assert.equal(result.kind,"urgent",q);
  assert.ok(result.message.includes("15")&&result.message.includes("112"));
  assert.deepEqual(result.sources,[]);
 }
});
