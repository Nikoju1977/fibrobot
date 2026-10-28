import test from "node:test";
import assert from "node:assert/strict";
import {connectMistral,disconnectMistral,mistralStatus,mistralCompletion,generateMistralChat,testMistralConnection,MISTRAL_MODELS} from "../mistral-bridge.mjs";

test.afterEach(()=>disconnectMistral());

test("Mistral est facultatif, déconnecté par défaut, sans clé conservée",async()=>{
 assert.equal(mistralStatus().connected,false);
 assert.equal(MISTRAL_MODELS.length,3);
 await assert.rejects(generateMistralChat("Écris un poème"),/pas connecté/);
 assert.throws(()=>connectMistral("secret"),/invalide/);
 assert.throws(()=>connectMistral("une mauvaise clé\navec retour"),/invalide/);
 assert.equal(connectMistral("cle-test-personnelle-non-valide-0000"),true);
 assert.equal(mistralStatus().connected,true);
 assert.equal("key" in mistralStatus(),false);
 disconnectMistral();
 assert.equal(mistralStatus().connected,false);
});

test("Mistral : appels limités à des questions générales et modèles approuvés",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 let called=0;
 const mock=async(url,init)=>{
  called++;assert.equal(url,"https://api.mistral.ai/v1/chat/completions");
  assert.equal(init.method,"POST");assert.equal(init.mode,"cors");assert.equal(init.credentials,"omit");
  assert.match(init.headers.Authorization,/^Bearer /);
  const data=JSON.parse(init.body);
  assert.equal(data.model,"mistral-small-latest");
  assert.ok(data.messages.every(x=>!x.content.includes("SECRET-MEDICAL")));
  assert.ok(!init.body.includes("mes médicaments"));
  assert.equal(data.messages.at(-1).content,"Écris un poème original");
  return {ok:true,json:async()=>({choices:[{message:{content:"Voici un petit poème sur les étoiles."}}]})};
 };
 const answer=await generateMistralChat("Écris un poème original",
  [{role:"user",body:"SECRET-MEDICAL : ordonnance personnelle",purpose:"medical"}],
  {fetchImpl:mock});
 assert.match(answer.text,/petit poème/);
 assert.equal(called,1);
});

test("Mistral : aucun accès direct aux requêtes de santé et prescriptions",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 let calls=0;
 const fetchImpl=async()=>{calls++;return {ok:true,json:async()=>({choices:[]})};};
 for(const question of ["Quelle dose de morphine ?","Je me sens mal, des vertiges","Aide-moi avec mes médicaments","Mon adresse est 12 rue de la Paix"]){
  await assert.rejects(generateMistralChat(question,[],{fetchImpl}),/non admissible|privées/);
 }
 assert.equal(calls,0);
});

test("Mistral : erreurs HTTP et repli explicites",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 const q=[{role:"system",content:"Réponds en français"},{role:"user",content:"Raconte une histoire courte"}];
 await assert.rejects(mistralCompletion(q,{fetchImpl:async()=>({ok:false,status:429})}),/429/);
 await assert.rejects(mistralCompletion(q,{model:"evil-model",fetchImpl:async()=>({ok:true})}),/non approuvé/);
 await assert.rejects(mistralCompletion(q,{fetchImpl:async()=>{throw TypeError("Network blocked");}}),/CORS/);
});

test("Mistral : filtre les sorties cliniques générées même à partir d'un prompt général",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 await assert.rejects(generateMistralChat("Raconte une histoire originale",[],{
  fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:"Prenez deux comprimés par jour."}}]})})
 }),/bloquée|bloqué|médicale|médical/i);
});

test("Test Mistral n'envoie qu'une simple opération et aucun dossier",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 let messages;
 const res=await testMistralConnection({fetchImpl:async(url,init)=>{
  messages=JSON.parse(init.body).messages;
  return {ok:true,json:async()=>({choices:[{message:{content:"Quatre."}}]})};
 }});
 assert.equal(res.text,"Quatre.");
 assert.equal(messages.at(-1).content,"Combien font deux plus deux ?");
});
