import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {liveIntent,explicitWeatherCity,weatherHorizon,publicWeather,publicAirQuality,publicFrenchHolidays,LIVE_SOURCES} from "../public-live-services.mjs";
import {createPublicFeedMonitor,feedState} from "../live-feed-hub.mjs";
import {AMBIENT_TYPES,boundedAmbientVolume,createAmbientPlayer} from "../ambient-sound.mjs";
import {SPECIALISTS,runSpecialist} from "../agent-hub.mjs";

const requests=[];
const fetchStub=async (url,opts)=>{
 requests.push({url,opts});
 const u=new URL(url);
 let data;
 if(u.hostname==="geocoding-api.open-meteo.com")data={results:[{name:"Nantes",latitude:47.2,longitude:-1.55,admin1:"Pays de la Loire",country:"France"}]};
 else if(u.hostname==="api.open-meteo.com")data={current:{time:"2026-10-30T12:00",temperature_2m:15,weather_code:2,relative_humidity_2m:54,apparent_temperature:13,wind_speed_10m:9},
 daily:{time:["2026-10-30","2026-10-31","2026-11-01"],weather_code:[2,61,3],temperature_2m_min:[8,6,5],temperature_2m_max:[18,16,14],precipitation_probability_max:[10,65,20]}};
 else if(u.hostname==="air-quality-api.open-meteo.com")data={current:{time:"2026-10-30T12:00",european_aqi:32,pm2_5:8,pm10:15}};
 else if(u.hostname==="date.nager.at")data=[{date:"2026-01-01",localName:"Jour de l'an"},{date:"2026-05-01",localName:"Fête du travail"}];
 else throw Error("Unexpected remote host "+u.hostname);
 return {ok:true,json:async()=>data};
};
test("V31 routes only explicit public live topics",()=>{
 assert.equal(liveIntent("Quelle météo à Nantes ?"),"weather");
 assert.equal(liveIntent("Quel temps fera-t-il demain à Nantes ?"),"weather");
 assert.equal(liveIntent("Qualité de l'air à Nantes ?"),"air");
 assert.equal(liveIntent("Jours fériés en 2026"),"holidays");
 assert.equal(liveIntent("Ma douleur est forte"),null);
 assert.equal(explicitWeatherCity("Quelle météo à Nantes ?"),"Nantes");
 assert.equal(weatherHorizon("Météo demain"),1);
 assert.equal(weatherHorizon("Météo après-demain"),2);
 assert.equal(weatherHorizon("Météo semaine prochaine"),7);
});
test("V31 real data sources respond with referenced times and never missing values as zero",async()=>{
 requests.length=0;
 const now=await publicWeather("Nantes",{fetchImpl:fetchStub,question:"Météo aujourd'hui à Nantes"});
 assert.match(now.answer,/15 °C/);
 assert.match(now.answer,/Open-Meteo/);
 assert.match(now.answer,/2026-10-30T12:00/);
 assert.equal(now.references.length,1);
 const tomorrow=await publicWeather("Nantes",{fetchImpl:fetchStub,question:"Météo demain à Nantes"});
 assert.match(tomorrow.answer,/2026-10-31/);
 assert.match(tomorrow.answer,/65 %/);
 const air=await publicAirQuality("Nantes",{fetchImpl:fetchStub});
 assert.match(air.answer,/indice européen 32/);
 const holidays=await publicFrenchHolidays("Quels jours fériés en 2026 ?",{fetchImpl:fetchStub});
 assert.match(holidays.answer,/2026-05-01/);
 assert.ok(requests.every(x=>x.opts.credentials==="omit"));
 assert.equal(LIVE_SOURCES.length,4);
});
test("V31 fails closed on missing weather rather than inventing a temperature",async()=>{
 const broken=async url=>{
  const h=new URL(url).hostname;
  if(h==="geocoding-api.open-meteo.com")return {ok:true,json:async()=>({results:[{name:"Nantes",latitude:47.2,longitude:-1.55}]})};
  return {ok:true,json:async()=>({current:{temperature_2m:null},daily:{}})};
 };
 await assert.rejects(publicWeather("Nantes",{fetchImpl:broken}),/indisponibles/);
 await assert.rejects(publicWeather("",{fetchImpl:fetchStub}),/ville/i);
});
test("V31 opt-in feed monitor polls at most once per five minutes while app is visible",async()=>{
 let tick=0,calls=0;
 const monitor=createPublicFeedMonitor({refresh:async()=>{calls++;},clock:()=>tick});
 assert.equal(await monitor.tick(),false);
 monitor.start();
 assert.equal(await monitor.tick(),true);
 assert.equal(await monitor.tick(),false);
 tick=60000;assert.equal(await monitor.tick(),false);
 tick=300000;assert.equal(await monitor.tick({visible:false}),false);
 assert.equal(await monitor.tick({online:false}),false);
 assert.equal(await monitor.tick(),true);
 monitor.stop();tick=600000;assert.equal(await monitor.tick(),false);
 assert.equal(calls,2);
 assert.match(feedState({running:true,city:"Nantes",visible:false}),/suspendue/);
 assert.throws(()=>createPublicFeedMonitor({refresh:()=>{},intervalMs:5000}),/5 minutes/);
});
test("V31 ambient player is action-triggered, uses bounded volume and never stores audio or contacts a service",async()=>{
 assert.equal(AMBIENT_TYPES.length,5);
 assert.equal(boundedAmbientVolume(200),70);
 assert.equal(boundedAmbientVolume(-10),0);
 assert.throws(()=>boundedAmbientVolume("abc"),/Volume/);
 const player=createAmbientPlayer();
 assert.equal(player.currentType(),null);
 await assert.rejects(player.play("fake"),/Ambiance inconnue/);
 player.stop();assert.equal(player.currentType(),null);
});
test("V31 includes eight informational specialists, not virtual doctors",()=>{
 for(const id of ["pain","medication","pacing","quality","triage","psychosocial","nutrition","social"]){
  const result=runSpecialist(id,{symptoms:[],medications:[],tasks:[]},id==="pain"?"fibromyalgie":"Bonjour");
  assert.match(result.answer,/assistant d'information, non professionnel/);
  assert.ok(SPECIALISTS.some(a=>a.id===id));
 }
 const urgent=runSpecialist("psychosocial",{},"Je veux me suicider");
 assert.equal(urgent.id,"safety");
 const app=readFileSync(new URL("../app.mjs",import.meta.url),"utf8");
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 for(const piece of ["createAmbientPlayer","v31-ambient-stop","EXPERT_PANEL","publicWeather","generateAgnesGroundedPublic","feedMonitor"])assert.ok(app.includes(piece),piece);
 assert.ok(sw.includes("./ambient-sound.mjs"));
 assert.ok(!sw.includes("./gemma-local.mjs"));
});
