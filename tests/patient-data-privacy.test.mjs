/* Régressions : aucune note absente à 0/10, aucune donnée personnelle envoyée en ligne. */
import test from "node:test";
import assert from "node:assert/strict";
import {rating,makeSymptom,reply} from "../core.mjs";
import {LIBRARY} from "../medical-library.mjs";
import {summarizeObservations,prepareVisit,planDaily,nonMedicalMessages,classifyIntent} from "../assistant-engine.mjs";
import {isOnlineEligible} from "../network-library.mjs";
import {mistralRoute} from "../mistral-routing.mjs";

test("échelles : un champ vide, espace, booléen ou non numérique n'est pas une valeur zéro",()=>{
 for(const missing of [""," ","  \t ",null,undefined]){
  assert.throws(()=>rating(missing),/Note/);
  assert.equal(rating(missing,true),null);
 }
 assert.throws(()=>rating(false),/Note/);
 assert.throws(()=>rating(true),/Note/);
 assert.throws(()=>rating("NaN"),/Note/);
 assert.equal(rating(0),0);
 assert.equal(rating("0"),0);
 assert.equal(rating("10"),10);
 assert.throws(()=>makeSymptom({name:"Journal",date:"2026-10-29",intensity:" "}),/Note/);
 assert.equal(makeSymptom({name:"Journal",date:"2026-10-29",intensity:7,energy:"  "}).energy,null);
});

test("synthèse clinique descriptive : ne pas inventer de zéro pour une note absente",()=>{
 const out=summarizeObservations({symptoms:[
  {date:"2026-10-23",name:"Sans intensité",intensity:null,energy:0},
  {date:"2026-10-24",name:"Blanc",intensity:" ",energy:2},
  {date:"2026-02-30",name:"Date invalide",intensity:8,energy:8},
  {date:"2026-10-25",name:"Zéro réellement saisi",intensity:0,energy:" "},
  {date:"2026-10-26",name:"Saisie valide",intensity:"10",energy:4,fatigue:null}
 ]});
 assert.match(out,/2 observation\(s\)/);
 assert.match(out,/intensité 5,0\/10 \(2 notes\)/);
 assert.match(out,/énergie 4,0\/10 \(1 notes\)/);
 assert.match(out,/fatigue non renseigné/);
 assert.doesNotMatch(out,/Sans intensité|Date invalide|Blanc/);
});

test("préparation consultation tolère les éléments corrompus et ignore les dates invalides",()=>{
 const out=prepareVisit({
  conditions:[null,{name:"Condition déclarée"}],
  medications:[null,{name:"Traitement déclaré"}],
  appointments:[null,{title:"Faux rendez-vous",date:"2099-02-30"},{title:"Consultation valide",date:"2099-11-11",time:"09:30"}]
 });
 assert.match(out,/Consultation valide/);
 assert.match(out,/Condition déclarée/);
 assert.match(out,/Traitement déclaré/);
 assert.doesNotMatch(out,/Faux rendez-vous/);
});

test("absence de niveau d'énergie : pas de déclaration inventée",()=>{
 const response=reply("Bonjour",LIBRARY);
 assert.match(response.message,/renseigner votre énergie/);
 assert.doesNotMatch(response.message,/undefined\/10/);
 const plan=planDaily({tasks:[{title:"Préparer un thé",effort:1,done:false}]});
 assert.match(plan,/5\/10/);
});

test("vie privée : noms, données familiales et traitement déclaré restent locaux",()=>{
 const questions=[
  "Mon prénom est Marie, raconte une histoire ?",
  "Je m'appelle Marie, écris un poème ?",
  "Je prends de l'amitriptyline, parlons de cinéma ?",
  "Ma mère habite Nantes, qui a écrit ce roman ?",
  "J'ai 49 ans, peux-tu inventer une chanson ?",
  "Mon dossier est personnel, comment écrire une nouvelle ?"
 ];
 for(const q of questions){
  assert.equal(classifyIntent(q),"general",q);
  assert.throws(()=>nonMedicalMessages(q,[]),/données privées/,q);
  assert.equal(isOnlineEligible(q),false,q);
  assert.equal(mistralRoute(q,"general",{kind:"followup",message:"Bonjour"}),null,q);
 }
 const history=[{role:"user",purpose:"general-local",body:"Je m'appelle Marie"},{role:"bot",purpose:"general-local",body:"Salut"}];
 assert.doesNotMatch(JSON.stringify(nonMedicalMessages("Raconte une histoire",history)),/Marie/);
 assert.equal(nonMedicalMessages("Raconte une histoire",[]).at(-1).content,"Raconte une histoire");
 assert.equal(isOnlineEligible("Qui a écrit Les Misérables ?"),true);
});
