import test from "node:test";
import assert from "node:assert/strict";
import {mistralRoute,mistralConsentDescription} from "../mistral-routing.mjs";
import {classifyIntent} from "../assistant-engine.mjs";
import {reply} from "../core.mjs";
import {LIBRARY} from "../medical-library.mjs";

function route(question){return mistralRoute(question,classifyIntent(question),reply(question,LIBRARY));}
test("Mistral répond aux questions générales quand le catalogue local n'a pas de réponse",()=>{
 const r=route("Écris un poème sur la lune");
 assert.equal(r.mode,"general");assert.match(mistralConsentDescription(r),/poème/);
 const salut=route("Bonjour");
 assert.equal(salut.mode,"general");
});

test("Mistral explique des fiches médicales publiques, sans transmettre la question personnelle",()=>{
 const q="Quels sont les symptômes de la fibromyalgie ?";
 const r=route(q);
 assert.equal(r.mode,"medical-reference");
 assert.equal(r.topic,"fibro");
 assert.doesNotMatch(mistralConsentDescription(r),/Quels sont les symptômes/);
 assert.match(mistralConsentDescription(r),/PUBLIC/);
 const q2="Que recommande la HAS pour la fibromyalgie ?";
 const second=route(q2);
 assert.equal(second.mode,"medical-reference");
 assert.ok(LIBRARY.some(d=>d.id===second.topic));
});

test("Mistral traite l'organisation avec des consignes anonymes",()=>{
 const r=route("Comment organiser mes tâches aujourd'hui ?");
 assert.equal(r.mode,"planning");
 assert.doesNotMatch(mistralConsentDescription(r),/Comment organiser mes tâches/);
 assert.match(mistralConsentDescription(r),/Aucun titre de tâche/);
});

test("Mistral ne reçoit ni dossiers individuels, ni prescription, ni urgences",()=>{
 for(const q of [
 "Quelle dose de morphine dois-je prendre ?",
 "Peux-tu me diagnostiquer ?",
 "Je veux mourir",
 "J'ai une douleur dans la poitrine",
 "Quels sont mes médicaments ?",
 "Quels sont mes symptômes ?",
 "Ma prochaine consultation ?",
 "Je suis fatigué et je souffre",
 "Mon adresse est 12 rue des Lilas, aide-moi"
 ]){
  assert.equal(route(q),null,q);
 }
});
test("Les réponses locales autonomes (heure, météo) restent locales",()=>{
 assert.equal(route("Quelle heure est-il ?"),null);
 assert.equal(route("Quel temps fait-il dehors ?"),null);
 assert.throws(()=>mistralConsentDescription(null),/Aucun contenu/);
});
