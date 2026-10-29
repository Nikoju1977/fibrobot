import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makeMedication,medicationReminderTimes,dueReminders,reminderLog,reply} from "../core.mjs";
import {LIBRARY} from "../medical-library.mjs";
import {medicationCalendarICS} from "../medication-calendar.mjs";
import {readerBookmark,matchingReaderBookmark} from "../reader-bookmark.mjs";
import {parseLocalNavigation} from "../local-commands.mjs";
import {parseSiteCommand,knownSite} from "../life-actions.mjs";

test("V27: up to eight declared times without inferring doses",()=>{
 const entry=makeMedication({name:"Traitement fictif",dose:"selon ordonnance",reminderTimes:"20:00, 08:00;13:00,08:00"});
 assert.equal(entry.reminderTime,"08:00");
 assert.deepEqual(medicationReminderTimes(entry),["08:00","13:00","20:00"]);
 assert.throws(()=>makeMedication({name:"A",reminderTimes:"08:00,25:00"}),/Heures/);
 assert.throws(()=>makeMedication({name:"A",reminderTimes:"00:00 01:00 02:00 03:00 04:00 05:00 06:00 07:00 08:00"}),/8 maximum/);
});
test("V27: each schedule is confirmed once, older daily logs remain respected",()=>{
 const now=new Date(2026,9,30,13,30);
 const meds=[{id:1,name:"Test",reminderTimes:"08:00, 13:00, 20:00"}];
 const first=dueReminders(meds,[],now);
 assert.deepEqual(first.map(x=>x.time),["08:00","13:00"]);
 assert.equal(new Set(first.map(x=>x.key)).size,2);
 const taken=reminderLog(1,"taken",now,"08:00");
 assert.deepEqual(dueReminders(meds,[taken],now).map(x=>x.time),["13:00"]);
 assert.deepEqual(dueReminders(meds,[reminderLog(1,"taken",now)],now),[]);
 assert.deepEqual(dueReminders(meds,[taken],new Date(2026,9,30,20,1)).map(x=>x.time),["13:00","20:00"]);
});
test("V27: exported daily alarms never contain medication name or dose",()=>{
 const now=new Date(2026,9,30,7,0);
 const ics=medicationCalendarICS({id:19,name:"Secret de santé",dose:"dose privée",reminderTimes:"08:00,20:00"},now);
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2);
 assert.equal((ics.match(/RRULE:FREQ=DAILY/g)||[]).length,2);
 assert.match(ics,/BEGIN:VALARM/);
 assert.doesNotMatch(ics,/Secret de santé|dose privée|19mg/i);
 assert.throws(()=>medicationCalendarICS({reminderTime:""}),/heure/i);
});
test("V27: reading position is bound to the exact local file, without saving text",()=>{
 const file={name:"roman.epub",size:13720,lastModified:1770000000000};
 const progress=readerBookmark(file,7);
 assert.equal(matchingReaderBookmark({...file},progress),7);
 assert.equal(matchingReaderBookmark({...file,size:13721},progress),0);
 assert.equal(matchingReaderBookmark({...file,lastModified:1770000000001},progress),0);
 assert.equal(matchingReaderBookmark(file,{...progress,page:-1}),0);
 assert.equal(JSON.stringify(progress).includes("pageText"),false);
 assert.throws(()=>readerBookmark(file,-2),/Page/);
});
test("V27: allowlisted links and internal navigation, never arbitrary URLs",()=>{
 assert.equal(parseLocalNavigation("Affiche mes rendez-vous")?.tab,"appointments");
 assert.equal(parseLocalNavigation("Ouvre le mode crise")?.tab,"crisis");
 assert.equal(parseLocalNavigation("Ouvre https://danger.example"),null);
 for(const [q,id] of [["Ouvre Google Maps","google-maps"],["Ouvre Facebook","facebook"],["Ouvre WhatsApp","whatsapp"],["Ouvre Gmail","gmail"]]){
  const action=parseSiteCommand(q);
  assert.equal(action?.siteId,id,q);
  assert.match(knownSite(id)?.url||"",/^https:\/\//);
 }
 assert.equal(reply("Je veux me suicider",LIBRARY).kind,"urgent");
});
test("V27: app wires controls without claiming native autonomy",()=>{
 const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
 for(const feature of ["setupV27Controls","dictation-send-confirm","book-save-mark","medicationCalendarICS","parseLocalNavigation","medicationReminderTimes"]){
  assert.ok(app.includes(feature),feature+" must be wired");
 }
 assert.match(app,/Rappels hors application : non garantis/);
});
