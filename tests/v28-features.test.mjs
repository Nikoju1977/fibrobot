import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {preferredLocalVoice,frenchLocalVoices,speechErrorMessage} from "../voice-health.mjs";
import {providerFailureKind,answerWithAuto} from "../auto-engine.mjs";
import {pairedWellbeingDays,descriptiveWellbeingBrief} from "../v28-insights.mjs";
import {findBookPages} from "../reader-search.mjs";
import {deviceReadiness} from "../device-readiness.mjs";
import {createSessionGuard} from "../session-guard.mjs";

test("V28: local French voice is preferred, never silently choose remote synthesis",()=>{
 const en={name:"Remote FR",lang:"fr-FR",localService:false};
 const canadian={name:"Locale Canada",lang:"fr-CA",localService:true};
 const french={name:"Locale France",lang:"fr-FR",localService:true};
 const synthesis={getVoices:()=>[en,canadian,french,{lang:"en-US",localService:true}]};
 assert.deepEqual(frenchLocalVoices(synthesis),[canadian,french]);
 assert.equal(preferredLocalVoice(synthesis),french);
 assert.equal(preferredLocalVoice({getVoices:()=>[en]}),null);
 assert.deepEqual(frenchLocalVoices({getVoices:()=>{throw Error("closed");}}),[]);
 assert.match(speechErrorMessage({error:"not-allowed"}),/bloquée/);
});
test("V28: provider failures are categorized, not forwarded as raw private data",()=>{
 assert.equal(providerFailureKind(Error("429 rate limit")),"quota");
 assert.equal(providerFailureKind(Error("HTTP 401")),"authorization");
 assert.equal(providerFailureKind(Error("network fetch failed")),"network");
 assert.equal(providerFailureKind(Error("Request timed out")),"timeout");
 assert.equal(providerFailureKind(Error("bad response")),"unavailable");
});
test("V28: medical and urgent requests never reach remote general providers",async()=>{
 let called=0;
 const result=await answerWithAuto({question:"Quelle dose de morphine ?",intent:"medical",response:{kind:"refusal"},
  state:{agnesConnected:true,mistralConnected:true},agnes:async()=>{called++;return{text:"bad"};},mistral:async()=>{called++;return{text:"bad"};},authorize:()=>{called++;return true;}});
 assert.equal(result.provider,null);assert.equal(result.skipped,"not-eligible");assert.equal(called,0);
});
test("V28: session epoch suppresses replies arriving after a vault is closed",()=>{
 const guard=createSessionGuard(),ticket=guard.start();
 assert.equal(guard.current(ticket),true);
 guard.invalidate();
 assert.equal(guard.current(ticket),false);
 assert.equal(guard.current(guard.start()),true);
 assert.equal(guard.current(-1),false);
});
test("V28: descriptive trends require actual paired days and never infer causation",()=>{
 const now=new Date(2026,9,30,12,0);
 const values=[
  {date:"2026-10-27",intensity:7,sleep:2,energy:5},
  {date:"2026-10-28",intensity:8,sleep:3},
  {date:"2026-10-29",intensity:5,sleep:6},
  {date:"2026-10-30",intensity:9,sleep:null},
  {date:"2026-10-26",intensity:null,sleep:4},
  {date:"2026-09-01",intensity:1,sleep:2}
 ];
 const pairs=pairedWellbeingDays(values,{days:7,now});
 assert.deepEqual(pairs.map(x=>x.date),["2026-10-27","2026-10-28","2026-10-29"]);
 const report=descriptiveWellbeingBrief(values,{days:7,now});
 assert.match(report,/3 jour\(s\) comportent les deux mesures/);
 assert.match(report,/sans note/);
 assert.doesNotMatch(report,/corrélation prouvée|diagnostic établi|traitement recommandé/);
 const empty=descriptiveWellbeingBrief([],{days:7,now});
 assert.match(empty,/aucune valeur exploitable/);
 assert.match(empty,/insuffisante/);
});
test("V28: private reader search finds exact pages without fetching or uploading",()=>{
 const content="Première page : Douleur et soleil.\n"+("a".repeat(180))+"\nDeuxième page : SOMMEIL et calme.";
 const hits=findBookPages(content,"sommeil",{pageSize:100});
 assert.equal(hits.length,1);assert.ok(hits[0].page>=1);
 assert.match(hits[0].preview,/SOMMEIL/);
 assert.deepEqual(findBookPages(content,"x",{pageSize:100}),[]);
 assert.deepEqual(findBookPages(content,"introuvable",{pageSize:100}),[]);
});
test("V28: mobile readiness is factual and never claims closed-app alarms work",()=>{
 const statuses=deviceReadiness({secure:true,storage:true,serviceWorker:true,notifications:true,notificationPermission:"granted",localSpeech:false,recognition:false,installed:false,online:false});
 assert.equal(statuses.find(s=>s.id==="vault").ok,true);
 assert.equal(statuses.find(s=>s.id==="voice").ok,false);
 assert.match(statuses.find(s=>s.id==="alerts").detail,/pas de garantie/);
 assert.equal(statuses.find(s=>s.id==="network").ok,false);
});
test("V28: session guard and user-accessible controls are wired in PWA",()=>{
 const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const part of ["activeSession.invalidate()","activeSession.current(sessionTicket)","setupV28Controls()","v28-health-brief","v28-quiet-toggle","v28-book-search","v28-device-check"]){
  assert.ok(app.includes(part),part);
 }
 for(const m of ["voice-health.mjs","v28-insights.mjs","reader-search.mjs","device-readiness.mjs","session-guard.mjs"]){
  assert.ok(sw.includes(m),"offline cache "+m);
 }
 assert.match(sw,/fibrobot-shell-v29/);
 assert.match(css,/body\.v28-quiet/);
});
