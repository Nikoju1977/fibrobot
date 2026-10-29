import test from "node:test";
import assert from "node:assert/strict";
import {validateGeneralPreference,savedGeneralPreference,preferenceHistory,PREFERENCE_SETTING_ID} from "../safe-preferences.mjs";
import {dailyTrend,trendDescription} from "../health-trends.mjs";
import {resetApiBudget,apiBudgetStatus,configureApiBudget,reserveApiRequest} from "../request-budget.mjs";
import {openBookArchive,openPrivateDocument} from "../document-reader.mjs";

test("V26: encrypted preference text is safe and requires explicit sharing",()=>{
 const pref=validateGeneralPreference("Je préfère des réponses détaillées et des exemples.");
 assert.equal(savedGeneralPreference([{id:PREFERENCE_SETTING_ID,value:pref}]),pref);
 assert.deepEqual(preferenceHistory(pref,[],false),[]);
 assert.equal(preferenceHistory(pref,[],true).length,2);
 for(const bad of ["Mon adresse est 12 rue du Parc","Je prends de la morphine","Je suis malade avec de la douleur","Ma clé API est abcdef","Contacte-moi à test@example.com","J'habite à Nantes"]){
  assert.throws(()=>validateGeneralPreference(bad),/sensible|admissible|médicale/,bad);
 }
 assert.equal(savedGeneralPreference([{id:PREFERENCE_SETTING_ID,value:"Ma douleur est forte"}]),"");
});
test("V26: descriptive health trends never fill missing days or invent scores",()=>{
 const at=new Date(2026,9,30,12,0);
 const rows=[
  {date:"2026-10-30",intensity:7,fatigue:3,energy:null,sleep:8},
  {date:"2026-10-30",intensity:9,fatigue:"",energy:0},
  {date:"2026-10-28",intensity:4,fatigue:8,energy:2},
  {date:"2026-10-29",intensity:20},
  {date:"2026-10-01",intensity:5},
  {date:"2026-02-30",intensity:1},
  {date:"2026-11-01",intensity:1}
 ];
 const t=dailyTrend(rows,{now:at,days:7});
 assert.equal(t.observedDays,2);
 assert.equal(t.observations,3);
 assert.equal(t.points.find(p=>p.date==="2026-10-30").value,8);
 assert.equal(t.points.find(p=>p.date==="2026-10-29").value,null);
 assert.equal(t.points.find(p=>p.date==="2026-10-28").value,4);
 assert.match(trendDescription(t),/sans note|pas interpolées/);
 const e=dailyTrend(rows,{now:at,days:7,metric:"energy"});
 assert.equal(e.points.find(p=>p.date==="2026-10-30").value,0);
 assert.equal(e.points.find(p=>p.date==="2026-10-29").value,null);
 assert.throws(()=>dailyTrend(rows,{metric:"diagnostic"}),/inconnue/);
});
test("V26: remote API cap limits requests, not claimed costs",()=>{
 resetApiBudget();
 configureApiBudget(5);
 for(let i=0;i<5;i++)reserveApiRequest(i%2?"agnes":"mistral");
 assert.equal(apiBudgetStatus().remaining,0);
 assert.throws(()=>reserveApiRequest("agnes"),/Limite volontaire/);
 assert.throws(()=>configureApiBudget(4),/non autorisée/);
 configureApiBudget(20);
 assert.equal(apiBudgetStatus().remaining,15);
 assert.throws(()=>reserveApiRequest("unknown"),/inconnu/);
 resetApiBudget();
 assert.equal(apiBudgetStatus().used,0);
});
const u16=(n)=>{const v=new Uint8Array(2);new DataView(v.buffer).setUint16(0,n,true);return v;};
const u32=(n)=>{const v=new Uint8Array(4);new DataView(v.buffer).setUint32(0,n,true);return v;};
const concat=(...arrays)=>{const size=arrays.reduce((n,x)=>n+x.length,0),out=new Uint8Array(size);let at=0;for(const a of arrays){out.set(a,at);at+=a.length;}return out;};
function mockStoredZip(name,content){
 const fname=new TextEncoder().encode(name),body=new TextEncoder().encode(content);
 const local=concat(u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(0),u32(body.length),u32(body.length),u16(fname.length),u16(0),fname,body);
 const central=concat(u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(0),u32(body.length),u32(body.length),u16(fname.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(0),fname);
 const trailer=concat(u32(0x06054b50),u16(0),u16(0),u16(1),u16(1),u32(central.length),u32(local.length),u16(0));
 const bytes=concat(local,central,trailer);
 return {name:"book.docx",size:bytes.length,arrayBuffer:async()=>bytes.buffer};
}
test("V26: ZIP reader only reads bounded in-memory document entries",async()=>{
 const zip=await openBookArchive(mockStoredZip("word/document.xml",'<w:document xmlns:w="w"><w:p><w:r><w:t>Bonjour</w:t></w:r></w:p></w:document>'));
 assert.deepEqual(zip.paths,["word/document.xml"]);
 assert.match(await zip.get("word/document.xml"),/Bonjour/);
 await assert.rejects(zip.get("../private.txt"),/hors archive/);
 await assert.rejects(zip.get("external.txt"),/introuvable/);
 await assert.rejects(openBookArchive(mockStoredZip("../evil.txt","bad")),/hors archive/);
 await assert.rejects(openBookArchive({size:13*1024*1024}),/12 Mo/);
});
test("V26: PDF is an explicit local preview, not a fake extracted text",async()=>{
 const pdf={name:"notice.pdf",size:10,slice:()=>new Blob(["%PDF-1.7"])};
 const res=await openPrivateDocument(pdf);
 assert.equal(res.kind,"pdf");assert.equal(res.file,pdf);
 await assert.rejects(openPrivateDocument({name:"bad.pdf",size:5,slice:()=>new Blob(["NOTPDF"])}),/PDF invalide/);
 const textFile={name:"note.txt",size:17,text:async()=>"Un texte privé."};
 const txt=await openPrivateDocument(textFile);
 assert.equal(txt.kind,"text");assert.equal(txt.text,"Un texte privé.");
});
