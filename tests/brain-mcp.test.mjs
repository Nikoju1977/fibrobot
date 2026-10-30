import test from "node:test";
import assert from "node:assert/strict";
import {knowledgeDomain,knowledgeKeywords,rankKnowledgeResults,buildGroundedMessages} from "../knowledge-router.mjs";
import {retrieveMedicalEvidence,publicMedicalExplanationMessages,approvedMedicalURL,HEALTH_CATALOG} from "../medical-rag.mjs";
import {FIBRO_MCP_TOOLS,callFibroTool,normalizedFibroTopic} from "../mcp-fibro-tools.mjs";
import {dispatchMCP} from "../mcp-server.mjs";

test("connaissance générale : domaines et titres de recherche pertinents",()=>{
 assert.equal(knowledgeDomain("Cherche un logiciel sur GitHub"),"software");
 assert.equal(knowledgeDomain("Je voudrais un livre sur la photographie"),"books");
 assert.equal(knowledgeDomain("Recherche un article scientifique sur les étoiles"),"science");
 assert.equal(knowledgeDomain("Que signifie anachronisme ?"),"language");
 assert.equal(knowledgeDomain("Qui était Marie Curie ?"),"general");
 assert.equal(knowledgeKeywords("Qui était Marie Curie ?"),"Marie Curie");
 const refs=[{title:"Curie",summary:"Notice courte",provider:"Wikidata"},{title:"Marie Curie",summary:"Étude de la radioactivité",provider:"Wikipédia"}];
 assert.equal(rankKnowledgeResults("Qui était Marie Curie ?",refs)[0].title,"Marie Curie");
});

test("prompt de synthèse RAG : uniquement extraits publics, borné au Worker",()=>{
 const refs=[{title:"Marie Curie",summary:"Physicienne et chimiste.",provider:"Wikipédia"}];
 const messages=buildGroundedMessages("Qui était Marie Curie ?",refs);
 assert.equal(messages.length,2);assert.equal(messages[0].role,"system");
 assert.match(messages[0].content,/N'invente/i);
 assert.match(messages[1].content,/Physicienne et chimiste/);
 assert.ok(messages[1].content.length<1800);
 assert.throws(()=>buildGroundedMessages("Qui était Marie Curie ?",[]),/Aucune source/);
});

test("RAG médical : passages attribués issus de fiches vérifiées uniquement",()=>{
 const r=retrieveMedicalEvidence("Quels sont les symptômes de la fibromyalgie ?");
 assert.equal(r.kind,"documented");
 assert.ok(r.passages.length>0);
 assert.ok(r.passages.every(x=>approvedMedicalURL(x.url)&&x.source&&x.title&&x.excerpt));
 assert.ok(r.passages.every(x=>!x.excerpt.includes("SECRET-SANTE")));
 assert.ok(HEALTH_CATALOG.some(x=>x.id==="fibromyalgia"));
 const explain=publicMedicalExplanationMessages("fibro");
 assert.equal(explain.length,2);
 assert.ok(explain[1].content.length<1800);
 assert.doesNotMatch(JSON.stringify(explain),/SECRET-SANTE/);
});

test("RAG médical : refus du diagnostic, des doses et des urgences",()=>{
 for(const input of ["Quelle dose de morphine dois-je prendre ?","Diagnostique mon diabète","Je veux me suicider"]){
  const out=retrieveMedicalEvidence(input);
  assert.ok(["urgent","refusal"].includes(out.kind),input);
  assert.equal(out.passages.length,0);
 }
 assert.equal(retrieveMedicalEvidence("Combien de comprimés dois-je prendre ?").passages.length,0);
 assert.throws(()=>publicMedicalExplanationMessages("nonexistent"),/non approuvée/);
});

test("sources institutionnelles : liens HTTPS strictement approuvés",()=>{
 assert.equal(approvedMedicalURL("https://www.has-sante.fr/jcms/p_3634512/fr/test"),true);
 assert.equal(approvedMedicalURL("https://www.has-sante.fr.evil.example/foo"),false);
 assert.equal(approvedMedicalURL("javascript:alert(1)"),false);
 assert.equal(approvedMedicalURL("http://www.ameli.fr/"),false);
 assert.equal(approvedMedicalURL("https://hack@www.ameli.fr/"),false);
});

test("huit outils MCP spécialisés, données patient non transmises à distance",()=>{
 assert.equal(FIBRO_MCP_TOOLS.length,8);
 assert.equal(callFibroTool("fibro.list_agents").items.length,8);
 assert.equal(callFibroTool("fibro.research_topics").items.length,10);
 assert.equal(callFibroTool("fibro.guidance",{topic:"sommeil"}).kind,"reference");
 assert.equal(normalizedFibroTopic("fibromyalgie"),"fibro");
 assert.throws(()=>callFibroTool("arbitrary.node.ssh"),/inconnu/);
 assert.throws(()=>callFibroTool("fibro.guidance",{topic:"unknown"}),/non approuvé/);
});

test("outils patients locaux : descriptifs uniquement, sans dosage inventé",()=>{
 const data={energy:3,tasks:[{title:"Laver la vaisselle",effort:1,priority:"important",done:false}],medications:[{name:"Traitement déclaré"}],symptoms:[]};
 assert.match(callFibroTool("fibro.plan_day",{},data).answer,/vaisselle/);
 assert.match(callFibroTool("fibro.prepare_visit",{},data).answer,/Traitement déclaré/);
 assert.match(callFibroTool("fibro.summarize",{},data).answer,/Aucune observation/);
 const danger=callFibroTool("fibro.safety",{question:"Je veux me suicider"},data);
 assert.equal(danger.kind,"urgent");
});

test("serveur MCP : protocole et outils publics, zéro accès patient",async()=>{
 const init=await dispatchMCP({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18"}});
 assert.equal(init.result.serverInfo.name,"fibrobot-public-mcp");
 assert.ok(init.result.capabilities.tools);
 const list=await dispatchMCP({jsonrpc:"2.0",id:2,method:"tools/list"});
 assert.ok(list.result.tools.length>=3);
 assert.ok(!list.result.tools.some(x=>x.name==="fibro.summarize"));
 const call=await dispatchMCP({jsonrpc:"2.0",id:3,method:"tools/call",params:{name:"fibro.guidance",arguments:{topic:"fibro"}}});
 assert.equal(call.result.isError,false);
 const forbidden=await dispatchMCP({jsonrpc:"2.0",id:4,method:"tools/call",params:{name:"fibro.summarize",arguments:{}}});
 assert.equal(forbidden.result.isError,true);
});
