import test from "node:test";
import assert from "node:assert/strict";
import {dictationSupport,startDictation} from "../voice-input.mjs";
import {upcomingAppointments,appointmentAlertKeys} from "../appointment-reminders.mjs";
import {coordinatedCareBriefing} from "../care-briefing.mjs";
const at=new Date(2026,9,29,12,0,0);

test("dictation: no unsupported local speech or automatic cloud fallback",async()=>{
 class OldSpeech{start(){throw Error("must not activate unverified local recognition");}}
 assert.equal(dictationSupport(OldSpeech).supported,false);
 await assert.rejects(startDictation({Speech:OldSpeech}),/entièrement locale/);
 assert.equal(dictationSupport(OldSpeech,{allowBrowserService:true}).supported,true);
});
test("dictation: local model availability mandatory before microphone start",async()=>{
 let count=0;
 class Speech{static async available(req){assert.deepEqual(req,{langs:["fr-FR"],processLocally:true});return "unavailable";}
  start(){count++;}}
 await assert.rejects(startDictation({Speech}),/n'est pas installée/);
 assert.equal(count,0);
});
test("dictation: local transcript is returned, never sent automatically",async()=>{
 let mode=null,received="";
 class Speech{
  static async available(){return "available";}
  start(){mode=this.processLocally;this.onresult({results:[[{transcript:"Bonjour FibroBot"}]]});}
 }
 const speech=await startDictation({Speech,onText:t=>{received=t;}});
 assert.equal(speech.lang,"fr-FR");
 assert.equal(mode,true);
 assert.equal(received,"Bonjour FibroBot");
});
test("dictation: browser service requires explicit caller opt-in",async()=>{
 let mode=null;
 class Speech{start(){mode=this.processLocally;}}
 await startDictation({Speech,allowBrowserService:true});
 assert.equal(mode,false);
});
test("appointments: seven-day window sorted, invalid dates ignored and details remain local",()=>{
 const rows=[
  {id:3,date:"2026-10-30",time:"16:30",title:"Consultation"},
  {id:2,date:"2026-10-29",time:"09:00",title:"Déjà aujourd'hui"},
  {id:8,date:"2026-11-07",title:"Trop tard"},
  {id:5,date:"2026-02-30",title:"Date invalide"},
  {id:6,date:"2026-11-01",time:"14:00",title:"Revue"}
 ];
 assert.deepEqual(upcomingAppointments(rows,at).map(x=>x.id),[2,3,6]);
 assert.deepEqual(upcomingAppointments(rows,at).map(x=>x.inDays),[0,1,3]);
 const keys=appointmentAlertKeys(rows,at);
 assert.equal(keys.length,2);
 assert.ok(keys.every(x=>!x.includes("Consultation")&&!x.includes("Déjà")));
});
test("agents: coordinated briefing is descriptive, not a prescription or a diagnostic",()=>{
 const text=coordinatedCareBriefing({
  energy:3,symptoms:[],tasks:[],medications:[{id:10,name:"Traitement SECRET",dose:"100"}],
  conditions:[{name:"Condition privée"}],
  appointments:[{id:2,date:"2026-10-30",time:"10:00",title:"Rendez-vous médical"}]
 },at);
 assert.match(text,/BILAN COORDONNÉ/);
 assert.match(text,/Rendez-vous médical/);
 assert.match(text,/Nombre de traitements déclarés : 1/);
 assert.doesNotMatch(text,/Traitement SECRET|100|Condition privée/);
 assert.match(text,/non vérifiées cliniquement|Aucune relation de cause/);
});
