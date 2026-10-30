import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseQuickHealth} from "../quick-health.mjs";
import {searchPrivateRecords} from "../private-search.mjs";

test("V32: one-line symptom note supports values and factors without causal claims",()=>{
 const d=parseQuickHealth("Douleur 7 fatigue 8 énergie 3 stress météo","2026-10-30");
 assert.equal(d.payload.intensity,7);
 assert.equal(d.payload.fatigue,8);
 assert.equal(d.payload.energy,3);
 assert.equal(d.payload.sleep,null);
 assert.deepEqual(d.factors,["stress","meteo"]);
 assert.match(d.payload.notes,/association non démontrée/);
 assert.equal(d.payload.date,"2026-10-30");
 assert.equal(d.payload.name,"Auto-suivi rapide");
 assert.equal(parseQuickHealth("douleur 0 sommeil 10","2026-10-30").payload.intensity,0);
 const narrated=parseQuickHealth("douleur 7/10 fatigue 8 stress après le ménage","2026-10-30");
 assert.match(narrated.payload.notes,/Contexte libre déclaré : apres le menage/);
 assert.match(narrated.payload.notes,/association non démontrée/);
 assert.match(narrated.preview,/note libre conservée/);
});
test("V32: malformed and out-of-bounds values never become silently stored measurements",()=>{
 for(const text of ["","fatigue 8 stress","douleur 11","douleur -1","douleur 8 fatigue 12","douleur", "douleur 5 douleur 8","douleur 5 fatigue non renseignée","douleur 7.5","douleur 7,5","fatigue 8 douleur 9.9"]){
  assert.throws(()=>parseQuickHealth(text,"2026-10-30"),Error,text);
 }
 assert.throws(()=>parseQuickHealth("douleur 5","2026-10-32"),/invalide/);
});
test("V32: vault search is strictly in-memory and accent-insensitive",()=>{
 const data={
  symptoms:[{id:11,name:"Auto-suivi rapide",notes:"Facteur évoqué : météo",date:"2026-10-30"}],
  tasks:[{id:12,title:"Téléphoner au kiné",due:"2026-11-02"}],
  conditions:[],medications:[{id:13,name:"Traitement déclaré",notes:"Ordonnance privée"}],
  appointments:[],conversations:[{id:14,agentId:"general",body:"Réponse sur le sommeil"},
    {id:15,agentId:"algologue",body:"Fiche douleur"}]
 };
 assert.equal(searchPrivateRecords(data,"METEO").length,1);
 assert.equal(searchPrivateRecords(data,"kiné")[0].tab,"tasks");
 assert.equal(searchPrivateRecords(data,"ordonnance")[0].store,"medications");
 assert.equal(searchPrivateRecords(data,"douleur",{agentId:"general"}).length,0);
 assert.equal(searchPrivateRecords(data,"douleur",{agentId:"algologue"}).length,1);
 assert.deepEqual(searchPrivateRecords(data,""),[]);
 assert.equal(searchPrivateRecords(data,"e",{limit:1}).length,0);
 assert.equal(searchPrivateRecords(data,"ra",{limit:1}).length,1);
});
test("V32: service worker and chat wire bounded private features",()=>{
 const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const term of ["parseQuickHealth","searchPrivateRecords","setupV32Controls","v32-quick-entry","v32-private-search","await put(db,\"symptoms\",parsed.payload)"])
  assert.ok(app.includes(term),term);
 for(const path of ["./quick-health.mjs","./private-search.mjs","./ambient-sound.mjs"])assert.ok(sw.includes(path),path);
 assert.match(sw,/fibrobot-shell-v32/);
 assert.match(css,/v32-quick-form/);
 assert.match(css,/v32-search-results/);
});
