import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FOREGROUND_REMINDER_OPTIN_ID,optInForegroundReminders,eligibleForegroundReminders} from "../foreground-reminders.mjs";
import {readingPageRange,BOOK_SLEEP_MINUTES,validSleepMinutes} from "../reading-range.mjs";
import {medicationReminderTimes,reply} from "../core.mjs";
import {LIBRARY} from "../medical-library.mjs";

test("V29: reminders require an explicit stored opt-in and stay off by default",()=>{
 assert.equal(optInForegroundReminders(),false);
 assert.equal(optInForegroundReminders([{id:FOREGROUND_REMINDER_OPTIN_ID,value:"true"}]),false);
 assert.equal(optInForegroundReminders([{id:FOREGROUND_REMINDER_OPTIN_ID,value:true}]),true);
 assert.equal(optInForegroundReminders([{id:"other",value:true}]),false);
});
test("V29: foreground alerts only within last ten minutes, never disclose medicine",()=>{
 const now=new Date(2026,9,30,13,7);
 const items=[
  {key:"a",name:"Privé A",dose:"dose privée",date:"2026-10-30",time:"13:00"},
  {key:"a",name:"Privé A",date:"2026-10-30",time:"13:00"},
  {key:"too-old",name:"Privé B",date:"2026-10-30",time:"12:30"},
  {key:"future",date:"2026-10-30",time:"13:30"},
  {key:"yesterday",date:"2026-10-29",time:"13:00"},
  {key:"bad-clock",date:"2026-10-30",time:"25:00"}
 ];
 const alerts=eligibleForegroundReminders(items,new Set(),now);
 assert.deepEqual(alerts.map(a=>a.key),["a"]);
 assert.equal(eligibleForegroundReminders(items,new Set(["a"]),now).length,0);
 assert.doesNotMatch(JSON.stringify(alerts),/Privé|dose privée/i);
 assert.match(alerts[0].body,/Consultez FibroBot/);
 assert.deepEqual(eligibleForegroundReminders(items,new Set(),new Date("invalid")),[]);
 assert.throws(()=>eligibleForegroundReminders(items,new Set(),now,200),/Fenêtre/);
});
test("V29: reading progress moves forward by pages and never overflows",()=>{
 const book="p".repeat(5*2400+120);
 const first=readingPageRange(book,0,3);
 assert.equal(first.pages.length,3);
 assert.equal(first.spokenText.length,7202);
 assert.equal(first.nextPage,3);
 assert.equal(first.totalPages,6);
 const end=readingPageRange(book,5,3);
 assert.equal(end.pages.length,1);
 assert.equal(end.nextPage,5);
 assert.equal(end.lastPage,5);
 assert.deepEqual(BOOK_SLEEP_MINUTES,[0,5,10,20]);
 assert.equal(validSleepMinutes("10"),10);
 assert.throws(()=>validSleepMinutes(999),/invalide/);
});
test("V29: invalid legacy medication times are detected without dose advice",()=>{
 assert.throws(()=>medicationReminderTimes({reminderTimes:"99:99"}),/invalides/);
 const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
 assert.match(app,/try\{times=medicationReminderTimes\(m\);\}catch\{invalidTimes=true;\}/);
 assert.match(app,/Horaires anciens ou invalides/);
 assert.equal(reply("Je veux me suicider",LIBRARY).kind,"urgent");
});
test("V29: foreground alerts, sleep timer, calm mode and page advance wired",()=>{
 const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const key of ["setupV29Controls","v29-reminder-opt-in","v29-book-sleep","eligibleForegroundReminders","optInForegroundReminders","readingPageRange","QUIET_SETTING_ID","startBookSleepTimer","restoreV29Preferences"]){
  assert.ok(app.includes(key),key);
 }
 for(const key of ["./foreground-reminders.mjs","./reading-range.mjs"])assert.ok(sw.includes(key),"PWA offline "+key);
 assert.match(sw,/fibrobot-shell-v29/);
 assert.match(sw,/scopePath=new URL\(self.registration.scope\).pathname/);
 assert.match(sw,/new URL\(path,self.registration.scope\).pathname===url.pathname/);
 assert.doesNotMatch(sw,/url.pathname.endsWith\(path.slice\(2\)\)/);
 assert.match(css,/v29-reminder-optin/);
});
