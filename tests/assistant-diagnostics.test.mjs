import test from "node:test";
import assert from "node:assert/strict";
import {checkAssistantCore,companionStatus,documentedAnswer} from "../assistant-diagnostics.mjs";

test("diagnostic du cerveau entièrement local : quatre scénarios distincts",()=>{
 const r=checkAssistantCore();
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.equal(r.checks.length,4);
 assert.deepEqual(r.checks.map(x=>x.id),["accueil","fibromyalgie","sécurité","urgence"]);
 assert.ok(r.checks.every(x=>x.ok));
});

test("diagnostic transparent sans clé, sans connexion et sans état patient",()=>{
 const status=companionStatus();
 assert.equal(status.length,4);
 assert.equal(status[0].status,"verrouillé");
 assert.equal(status[1].status,"prêt");
 assert.equal(status[2].status,"déconnecté");
 assert.equal(status[3].status,"désactivée");
 const busy=companionStatus({vaultOpen:true,webGPU:{ready:true,modelId:"Qwen-test"},
  mistral:{connected:true,cooldownSeconds:120},internet:true});
 assert.equal(busy[0].status,"prêt");
 assert.equal(busy[2].status,"limité (429)");
 assert.match(busy[2].detail,/120/);
 assert.equal(busy[3].status,"autorisée");
 assert.doesNotMatch(JSON.stringify(busy),/secret|bearer|api_key/i);
});

test("questions médicales documentées : lien de la fiche d'origine toujours conservé",()=>{
 const info=documentedAnswer("Quels sont les symptômes de la fibromyalgie ?");
 assert.equal(info.kind,"documented");
 assert.ok(info.answer.length>100);
 assert.ok(info.references.length>=1);
 assert.ok(info.references.length<=3);
 assert.ok(info.references.some(x=>x.url.includes("has-sante.fr")));
 assert.ok(info.references.every(x=>x.url.startsWith("https://")&&x.title&&x.provider));
});

test("jamais de sources inventées en cas de prescription, risque ou question inconnue",()=>{
 const prescribed=documentedAnswer("Quelle dose de morphine dois-je prendre ?");
 assert.equal(prescribed.kind,"refusal");assert.deepEqual(prescribed.references,[]);
 const urgent=documentedAnswer("Je veux me suicider");
 assert.equal(urgent.kind,"urgent");assert.deepEqual(urgent.references,[]);
 const unknown=documentedAnswer("Que préconise-t-on pour une maladie totalement inconnue ?");
 assert.notEqual(unknown.kind,"documented");
 assert.deepEqual(unknown.references,[]);
});
