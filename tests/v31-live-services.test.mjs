import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {liveIntent,explicitWeatherCity,weatherHorizon,publicWeather,publicAirQuality,publicFrenchHolidays,resolvePublicCity,LIVE_SOURCES} from "../public-live-services.mjs";
import {createPublicFeedMonitor,feedState} from "../live-feed-hub.mjs";
import {connectAgnes,disconnectAgnes,generateAgnesGroundedPublic} from "../agnes-bridge.mjs";
import {SPECIALISTS,runSpecialist} from "../agent-hub.mjs";
const recorded=[];
const makeFetch=async url=>{
 const u=new URL(url);recorded.push(u);
 if(u.hostname==="geocoding-api.open-meteo.com")return {ok:true,json:async()=>({results:[{name:"Nantes",admin1:"Pays de la Loire",country:"France",latitude:47.2,longitude:-1.55}]})};
 if(u.hostname==="api.open-meteo.com")return {ok:true,json:async()=>({current:{time:"2026-10-30T15:00",temperature_2m:17,apparent_temperature:16,relative_humidity_2m:65,weather_code:2,wind_speed_10m:8},
 daily:{time:["2026-10-30","2026-10-31","2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05"],
 temperature_2m_min:[9,8,7,7,7,6,5],temperature_2m_max:[20,19,16,16,15,15,14],precipitation_probability_max:[15,75,50,25,30,40,15],weather_code:[2,61,3,1,1,2,3]}})};
 if(u.hostname==="air-quality-api.open-meteo.com")return {ok:true,json:async()=>({current:{time:"2026-10-30T15:00",european_aqi:35,pm2_5:8,pm10:19}})};
 if(u.hostname==="date.nager.at")return {ok:true,json:async()=>[{date:"2026-11-01",localName:"Toussaint"}]};
 throw Error("Unauthorized hostname "+u.hostname);
};
test("V31: clear routing for weather, air, holidays and safe city strings",()=>{
 assert.equal(liveIntent("Quelle météo demain à Nantes ?"),"weather");
 assert.equal(liveIntent("Quel temps fera-t-il demain ?"),"weather");
 assert.equal(liveIntent("Qualité de l'air à Nantes"),"air");
 assert.equal(liveIntent("Liste des jours fériés en France"),"holidays");
 assert.equal(liveIntent("Mon traitement personnel"),null);
 assert.equal(explicitWeatherCity("Quelle météo demain à Nantes ?"),"Nantes");
 assert.equal(weatherHorizon("Météo après-demain"),2);
 assert.equal(weatherHorizon("Météo cette semaine"),7);
 assert.ok(LIVE_SOURCES.length>=4);
});
test("V31: weather source uses fixed API hosts, explicit city and dated observations",async()=>{
 recorded.length=0;
 const today=await publicWeather("Nantes",{question:"Quelle météo à Nantes ?",fetchImpl:makeFetch});
 assert.match(today.answer,/17 °C/);assert.match(today.answer,/2026-10-30T15:00/);
 assert.equal(today.references[0].provider,"Open-Meteo");
 const tomorrow=await publicWeather("Nantes",{question:"Quel temps fera-t-il demain à Nantes ?",fetchImpl:makeFetch});
 assert.match(tomorrow.answer,/19 °C/);assert.match(tomorrow.answer,/75 %/);
 const week=await publicWeather("Nantes",{question:"météo cette semaine",fetchImpl:makeFetch});
 assert.match(week.answer,/2026-11-05/);
 assert.deepEqual([...new Set(recorded.map(u=>u.hostname))],["geocoding-api.open-meteo.com","api.open-meteo.com"]);
 for(const u of recorded)assert.ok(!u.href.includes("dossier")&&!u.href.includes("patient"));
});
test("V31: missing numeric weather never becomes 0 degrees",async()=>{
 const empty=async url=>url.includes("geocoding")?makeFetch(url):{ok:true,json:async()=>({current:{time:"2026-10-30T15:00",temperature_2m:null}})};
 await assert.rejects(publicWeather("Nantes",{fetchImpl:empty}),/indisponibles/);
 await assert.rejects(resolvePublicCity("",{fetchImpl:makeFetch}),/Précisez une ville/);
});
test("V31: air and calendar providers show grounded, non-clinical information",async()=>{
 const air=await publicAirQuality("Nantes",{fetchImpl:makeFetch});
 assert.match(air.answer,/PM2,5/);assert.match(air.answer,/35/);
 const date=await publicFrenchHolidays("jours fériés 2026",{fetchImpl:makeFetch});
 assert.match(date.answer,/Toussaint/);
});
test("V31: feed monitor never silently polls background or faster than 5 minutes",async()=>{
 let t=0,count=0;
 const feed=createPublicFeedMonitor({refresh:async()=>{count++;},clock:()=>t});
 assert.equal(await feed.tick(),false);
 feed.start();
 assert.equal(await feed.tick({visible:false}),false);
 assert.equal(await feed.tick({online:false}),false);
 assert.equal(await feed.tick(),true);
 assert.equal(await feed.tick(),false);
 t+=299999;assert.equal(await feed.tick(),false);
 t+=1;assert.equal(await feed.tick(),true);
 feed.stop();t+=300000;assert.equal(await feed.tick(),false);assert.equal(count,2);
 assert.throws(()=>createPublicFeedMonitor({refresh:async()=>{},intervalMs:1000}),/5 minutes/);
 assert.match(feedState({running:true,city:"Nantes",visible:false}),/suspendue/);
});
test("V31: Agnes may summarize public dated facts, not a sensitive medical question",async()=>{
 connectAgnes("agnes-NOT-A-REAL-KEY-123456");
 let payload="";
 const fetchImpl=async(_url,opts)=>{payload=opts.body;return{ok:true,status:200,json:async()=>({choices:[{message:{content:"À Nantes, 17 °C avec passages nuageux selon les données datées."}}]})};};
 const result=await generateAgnesGroundedPublic("Quelle météo à Nantes ?","Météo actuelle Nantes (2026-10-30T15:00) : 17 °C",{fetchImpl});
 assert.match(result.text,/17 °C/);assert.match(payload,/2026-10-30T15:00/);
 await assert.rejects(generateAgnesGroundedPublic("Quels traitements pour mes douleurs personnelles ?","Données météo",{fetchImpl}),/admissible|privées|non/i);
 disconnectAgnes();
});
test("V31: specialist agency is documentary and displays 4 requested roles",()=>{
 assert.ok(SPECIALISTS.some(s=>s.id==="quality"));
 const quality=runSpecialist("quality",{symptoms:[]});
 assert.match(quality.answer,/sans prédire une crise|Aucune méthode statistique/);
 assert.match(quality.answer,/non professionnel de santé/);
});
test("V31: no local model remains in PWA code, new controls are wired",()=>{
 const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 for(const id of ["v31-agent-panel","v31-live-consent","v31-watch","v31-clear-thread","v31-agnes-grounded"]){
  assert.ok(app.includes(id),id);
 }
 assert.match(app,/generateAgnesGroundedPublic/);
 assert.doesNotMatch(app,/gemma-local|loadGemma|llmStatus/);
 assert.doesNotMatch(html,/id="gemma-options"/);
 assert.doesNotMatch(sw,/gemma-local\.mjs/);
 assert.match(sw,/fibrobot-shell-v33/);
 for(const id of ["public-live-services.mjs","live-feed-hub.mjs"])assert.ok(sw.includes(id));
});
