import test from "node:test";
import assert from "node:assert/strict";
import {autoGeneralAllowed,autoProviderOrder,answerWithAuto} from "../auto-engine.mjs";
import {connectAgnes,disconnectAgnes,agnesStatus,generateAgnesChat,testAgnesConnection,secondsToRetryAgnes} from "../agnes-bridge.mjs";
import {reply} from "../core.mjs";
import {LIBRARY} from "../medical-library.mjs";
import {readFileSync} from "node:fs";

test("IA: only Agnes then Mistral, never a local LLM",()=>{
 assert.deepEqual(autoProviderOrder({localReady:true,agnesConnected:true,mistralConnected:true}),["agnes","mistral"]);
 assert.deepEqual(autoProviderOrder({agnesConnected:true,agnesCooldown:60,mistralConnected:true}),["mistral"]);
 assert.deepEqual(autoProviderOrder({localReady:true}),[]);
});
test("IA: medical and personal questions never routed to general remote models",()=>{
 assert.equal(autoGeneralAllowed("Je veux mourir","medical",reply("Je veux mourir",LIBRARY)),false);
 assert.equal(autoGeneralAllowed("Quels médicaments prendre ?","medical",reply("Quels médicaments prendre ?",LIBRARY)),false);
 assert.equal(autoGeneralAllowed("Ma mère est sous traitement","general",{kind:"refusal"}),false);
 assert.equal(autoGeneralAllowed("Mon adresse est 10 rue X","general",{kind:"followup"}),false);
 assert.equal(autoGeneralAllowed("Quelle est la capitale de la France ?","general",{kind:"refusal"}),true);
 assert.equal(autoGeneralAllowed("Raconte-moi une histoire dans l'espace","general",{kind:"refusal"}),true);
});
test("IA: Agnes responds first without calling Mistral",async()=>{
 let mistral=0;
 const res=await answerWithAuto({question:"Quelle est la capitale de la France ?",intent:"general",response:{kind:"refusal"},state:{localReady:true,agnesConnected:true,mistralConnected:true},
  agnes:async()=>({text:"Paris",model:"agnes-2.5-flash"}),mistral:async()=>{mistral++;return{text:"Fail"};},authorize:()=>true});
 assert.equal(res.provider,"agnes");assert.equal(res.text,"Paris");assert.equal(mistral,0);
});
test("IA: Agnes quota -> Mistral after consent; no consent means no request",async()=>{
 const order=[];
 const res=await answerWithAuto({question:"Explique le fonctionnement des satellites",intent:"general",response:{kind:"refusal"},state:{localReady:true,agnesConnected:true,mistralConnected:true},
  agnes:async()=>{order.push("agnes");throw Error("quota 429");},
  mistral:async()=>{order.push("mistral");return{text:"Les satellites suivent une orbite.",model:"test"};},
  authorize:()=>true});
 assert.deepEqual(order,["agnes","mistral"]);
 assert.equal(res.provider,"mistral");assert.equal(res.errors.length,1);
 const denied=await answerWithAuto({question:"Explique les étoiles",intent:"general",response:{kind:"refusal"},state:{agnesConnected:true,mistralConnected:true},
  agnes:async()=>{throw Error("Should not call");},mistral:async()=>{throw Error("Should not call");},authorize:()=>false});
 assert.equal(denied.provider,null);
});
test("Agnes: never persist key or send user history, reject health data",async()=>{
 disconnectAgnes();
 assert.equal(agnesStatus().connected,false);
 assert.throws(()=>connectAgnes("abc"),/invalide/);
 connectAgnes("fake-long-testing-token-only");
 let sent;
 const fetchImpl=async (url,options)=>{
  assert.equal(url,"https://apihub.agnes-ai.com/v1/chat/completions");
  assert.equal(options.credentials,"omit");assert.equal(options.mode,"cors");
  assert.equal(options.headers.Authorization,"Bearer fake-long-testing-token-only");
  sent=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:"Paris."}}]})};
 };
 const result=await generateAgnesChat("Quelle est la capitale de la France ?",{fetchImpl});
 assert.equal(result.text,"Paris.");
 assert.equal(sent.model,"agnes-2.5-flash");
 assert.deepEqual(sent.messages.map(x=>x.role),["system","user"]);
 assert.equal(sent.messages.some(x=>JSON.stringify(x).includes("traitement patient")),false);
 await assert.rejects(generateAgnesChat("Ma mère prend des médicaments",{fetchImpl}),/privées|incompatible|non admissible|données/i);
 disconnectAgnes();
 assert.equal(agnesStatus().connected,false);
});
test("Agnes: 429 cooldown prevents rapid retry and cannot affect user vault",async()=>{
 connectAgnes("fake-long-testing-token-only");
 let tries=0;
 const fetchImpl=async()=>{tries++;return{ok:false,status:429,headers:{get:()=>"45"}};};
 await assert.rejects(generateAgnesChat("Pourquoi le ciel est bleu ?",{fetchImpl}),/pause|quota/i);
 assert.equal(tries,1);
 assert.ok(agnesStatus().cooldownSeconds>0);
 await assert.rejects(generateAgnesChat("Pourquoi le ciel est bleu ?",{fetchImpl}),/pause/i);
 assert.equal(tries,1);
 disconnectAgnes();
 assert.equal(agnesStatus().cooldownSeconds,0);
 assert.equal(secondsToRetryAgnes("999999"),900);
});
test("PWA: new modules cached, UI connected, no hardcoded keys",()=>{
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
 assert.match(sw,/agnes-bridge\.mjs/);assert.match(sw,/auto-engine\.mjs/);
 assert.match(sw,/fibrobot-shell-v22/);
 for(const id of ["auto-mode","auto-brain-status","agnes-key","agnes-connect","agnes-test","agnes-disconnect","agnes-status","agnes-model"])
  assert.equal(html.split('id="'+id+'"').length-1,1,id);
 assert.match(html,/https:\/\/apihub\.agnes-ai\.com/);
 assert.match(app,/autoGeneralAllowed/);
 assert.match(app,/answerWithAuto/);
 assert.match(app,/disconnectAgnes\(\)/);
});
