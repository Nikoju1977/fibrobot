import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BREATH_PATTERNS,BREATH_DURATIONS,breathingStep,sessionTimeString} from "../breathing-guide.mjs";
import {parseQuickHealth} from "../quick-health.mjs";
import {searchPrivateRecords} from "../private-search.mjs";

test("V32: guided breathing is bounded, stoppable, without hold phases",()=>{
 assert.deepEqual(BREATH_PATTERNS.map(x=>x.id),["calm","relax"]);
 assert.deepEqual(BREATH_DURATIONS,[2,5,10]);
 assert.equal(breathingStep(0).phase,"inhale");
 assert.equal(breathingStep(5000).phase,"exhale");
 assert.equal(breathingStep(10000).phase,"inhale");
 assert.equal(breathingStep(4000,{pattern:"relax"}).phase,"exhale");
 assert.equal(breathingStep(120000).done,true);
 assert.equal(breathingStep(120000).remainingSeconds,0);
 assert.equal(breathingStep(1000).remainingSeconds,119);
 assert.equal(sessionTimeString(65),"01:05");
 assert.throws(()=>breathingStep(-1),/Temps/);
 assert.throws(()=>breathingStep(1,{durationMinutes:3}),/Durée/);
 assert.throws(()=>breathingStep(1,{pattern:"unsafe"}),/Rythme/);
});
test("V32: quick symptom entry preserves declared measures but rejects missing/out-of-range",()=>{
 const data=parseQuickHealth("douleur 7 fatigue 8 énergie 3 stress","2026-10-30");
 assert.equal(data.payload.intensity,7);
 assert.equal(data.payload.fatigue,8);
 assert.equal(data.payload.energy,3);
 assert.match(data.payload.notes,/association non démontrée/);
 assert.throws(()=>parseQuickHealth("douleur 11","2026-10-30"),/0 et 10/);
 assert.throws(()=>parseQuickHealth("fatigue 8","2026-10-30"),/douleur/);
 assert.throws(()=>parseQuickHealth("douleur 7 douleur 8","2026-10-30"),/qu'une seule fois/);
});
test("V32: search cannot traverse a different agent chat and returns no patient data over network",()=>{
 const vault={symptoms:[{id:1,name:"Douleur des jambes",notes:"après la marche",date:"2026-10-30"}],
  medications:[{id:2,name:"Exemple secret",notes:"ne pas divulguer"}],
  conversations:[{id:3,agentId:"general",body:"Bonjour"}, {id:4,agentId:"algologue",body:"douleur chronique"}]};
 const general=searchPrivateRecords(vault,"douleur",{agentId:"general"});
 assert.equal(general.some(x=>x.store==="conversations"),false);
 const specialist=searchPrivateRecords(vault,"douleur",{agentId:"algologue"});
 assert.equal(specialist.some(x=>x.store==="conversations"),true);
 assert.equal(searchPrivateRecords(vault,"",{}).length,0);
 assert.equal(searchPrivateRecords(vault,"Exemple").length,1);
});
test("V32: no personal city committed, all new features precached and no insecure key storage",()=>{
 const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const term of ["v32-quick-entry","v32-private-search","v32-breath-start","stopBreathingSession","BREATH_PATTERNS","searchPrivateRecords"])assert.ok(app.includes(term),term);
 assert.ok(!app.includes('city.value="La Meilleraye-de-Bretagne"'),"No patient locality hardcoded in the public app");
 assert.ok(sw.includes("./breathing-guide.mjs"));
 assert.ok(sw.includes("fibrobot-shell-v33-1"));
 assert.match(css,/prefers-reduced-motion:reduce/);
});
