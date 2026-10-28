import test from "node:test";
import assert from "node:assert/strict";
import {connectMistral,disconnectMistral,mistralStatus,mistralCompletion,generateMistralChat,testMistralConnection,MISTRAL_MODELS,secondsToRetry,generateMistralMedicalExplanation,generateMistralPlanningAdvice,cleanMedicalExplanation} from "../mistral-bridge.mjs";

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
 await assert.rejects(mistralCompletion(q,{model:"evil-model",fetchImpl:async()=>({ok:true})}),/non approuvé/);
 await assert.rejects(mistralCompletion(q,{fetchImpl:async()=>{throw TypeError("Network blocked");}}),/CORS/);
 await assert.rejects(mistralCompletion(q,{fetchImpl:async()=>({ok:false,status:429})}),/429/);
 assert.ok(mistralStatus().cooldownSeconds>0);
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

test("429 Mistral : un seul appel, respect de Retry-After, sans boucle ni requête suivante",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 let requests=0;
 const mock=async()=>{requests++;return {ok:false,status:429,headers:{get:name=>name==="retry-after"?"87":null}};};
 const messages=[{role:"system",content:"Réponds en français"},{role:"user",content:"Raconte une histoire courte"}];
 await assert.rejects(mistralCompletion(messages,{fetchImpl:mock}),/429/);
 assert.equal(requests,1,"429 must NOT trigger repeated API retries");
 assert.ok(mistralStatus().cooldownSeconds>=85);
 assert.match(mistralStatus().lastFailure,/429/);
 await assert.rejects(mistralCompletion(messages,{fetchImpl:mock}),/temporairement désactivé/);
 assert.equal(requests,1,"Cooldown prevents accidental second remote call");
 disconnectMistral();
 assert.equal(mistralStatus().cooldownSeconds,0);
});

test("Retry-After : secondes, date HTTP, absence et valeurs excessives",()=>{
 assert.equal(secondsToRetry("120"),120);
 assert.equal(secondsToRetry("1"),15);
 assert.equal(secondsToRetry("999999"),900);
 assert.equal(secondsToRetry(null),60);
 assert.ok(secondsToRetry(new Date(Date.now()+30000).toUTCString())>=15);
});

test("L'API 429 n'est pas contournée en changeant automatiquement de modèle",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 let calls=0;
 const fetchImpl=async()=>{calls++;return {ok:false,status:429,headers:{get:()=>null}};};
 const q=[{role:"system",content:"Réponds en français"},{role:"user",content:"Raconte une histoire originale"}];
 await assert.rejects(mistralCompletion(q,{model:"mistral-small-latest",fetchImpl}),/429/);
 await assert.rejects(mistralCompletion(q,{model:"mistral-large-latest",fetchImpl}),/temporairement désactivé/);
 assert.equal(calls,1);
});

test("Mistral explique une source médicale officielle sans question ni profil personnel",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 let calls=0;
 const res=await generateMistralMedicalExplanation("fibro",{fetchImpl:async(url,init)=>{
  calls++;
  const body=JSON.parse(init.body);
  assert.equal(body.messages.length,2);
  assert.match(body.messages[1].content,/fibromyalgie/i);
  assert.match(body.messages[1].content,/Source :/);
  assert.doesNotMatch(JSON.stringify(body),/mon dossier patient|SECRET-MEDICAL|Quelle dose de morphine/);
  assert.equal(body.model,"mistral-small-latest");
  return {ok:true,json:async()=>({choices:[{message:{content:"La fibromyalgie associe des douleurs diffuses persistantes et de la fatigue. L'information provient de la fiche fournie."}}]})};
 }});
 assert.equal(calls,1);
 assert.match(res.text,/douleurs diffuses/);
});

test("Mistral ne peut pas interroger une source médicale inexistante",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 let count=0;
 await assert.rejects(generateMistralMedicalExplanation("unknown",{fetchImpl:async()=>{count++;return {ok:true};}}),/non approuvée/);
 assert.equal(count,0);
});

test("L'explication médicale générée est rejetée si elle contient prescription, dose ou diagnostic individuel",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 for(const value of [
  "Vous avez une fibromyalgie et je confirme votre diagnostic.",
  "Prenez 200 mg de ce traitement matin et soir.",
  "Arrêtez immédiatement votre médicament.",
  "Pour en savoir plus, voyez https://site-piege.example/faux."
 ]){
  await assert.rejects(generateMistralMedicalExplanation("fibro",{
   fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:value}}]})})
  }),/potentiellement clinique bloquée/);
 }
 assert.match(cleanMedicalExplanation("Une fibromyalgie peut entraîner des douleurs et une fatigue persistantes."),/fatigue/);
});

test("Mistral peut conseiller l'organisation sans titres de tâches ni symptômes du patient",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 let sent="";
 const result=await generateMistralPlanningAdvice({fetchImpl:async(url,init)=>{
  sent=init.body;
  return {ok:true,json:async()=>({choices:[{message:{content:"Découpez une grande tâche en petites étapes et prévoyez une pause."}}]})};
 }});
 assert.match(result.text,/petites étapes/);
 assert.doesNotMatch(sent,/ma douleur|mon médicament|mes rendez-vous|SECRET-MEDICAL/);
 assert.match(sent,/sans données concernant une personne/);
});

test("429 bloque aussi les modes médicaux et organisationnels sans répétition automatique",async()=>{
 connectMistral("cle-test-personnelle-non-valide-0000");
 let count=0;
 const mock=async()=>{count++;return {ok:false,status:429,headers:{get:()=>String(90)}};};
 await assert.rejects(generateMistralMedicalExplanation("fibro",{fetchImpl:mock}),/429/);
 await assert.rejects(generateMistralPlanningAdvice({fetchImpl:mock}),/temporairement désactivé/);
 assert.equal(count,1);
});
