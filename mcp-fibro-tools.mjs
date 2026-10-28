/* FibroBot — outils spécialisés réutilisables dans la PWA et via MCP.
 * Aucune inférence clinique, lecture de stockage ni requête réseau implicite.
 * Les données patient ne sont consultées qu'en mémoire, coffre déverrouillé.
 * Tous les appels sont des fonctions à paramètres fermés : pas d'exécution arbitraire.
 */
import {reply} from "./core.mjs";
import {LIBRARY} from "./medical-library.mjs";
import {RESEARCH_TOPICS,summarizeObservations,prepareVisit,planDaily} from "./assistant-engine.mjs";
import {SPECIALISTS,runSpecialist} from "./agent-hub.mjs";

const text=s=>String(s??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,200);
const normalize=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const ids=new Set(LIBRARY.map(x=>x.id));
export const FIBRO_MCP_TOOLS=Object.freeze([
 Object.freeze({name:"fibro.list_agents",title:"Agents spécialisés",description:"Répertorier les sept agents d'aide au quotidien, sans données privées",input:[]}),
 Object.freeze({name:"fibro.guidance",title:"Repères HAS et sources médicales",description:"Consulter une fiche publique fibromyalgie à partir d'un sujet prédéfini",input:["topic"]}),
 Object.freeze({name:"fibro.research_topics",title:"Thèmes de recherche scientifique",description:"Dix sujets de recherche Europe PMC ; aucune donnée de patient transmise",input:[]}),
 Object.freeze({name:"fibro.summarize",title:"Synthèse du journal patient",description:"Décrire les observations déclarées, sans diagnostic et sans réseau",input:[]}),
 Object.freeze({name:"fibro.prepare_visit",title:"Préparer le rendez-vous",description:"Regrouper localement les informations saisies et les questions à poser",input:[]}),
 Object.freeze({name:"fibro.plan_day",title:"Activités et énergie",description:"Créer un planning non médical à partir des tâches et de l'énergie déclarées",input:[]}),
 Object.freeze({name:"fibro.agent",title:"Exécuter un agent de soutien",description:"Agent déterministe autorisé parmi les sept rôles spécialisés",input:["id"]}),
 Object.freeze({name:"fibro.safety",title:"Orientation de sécurité",description:"Vérifier les mots d'urgence ou de prescription avant toute réponse",input:["question"]})
]);
const allowedTopics=Object.freeze(["fibro","activity","sleep","care","daily","multi","mindfulness","hypnosis","complementary","nutrition","gwas2026","living","causes"]);
const topicAliases=Object.freeze({
 general:"fibro",douleurs:"fibro",pain:"fibro",sommeil:"sleep",fatigue:"daily",
 activite:"activity",exercise:"activity",therapie:"care",recherche:"fibro",
 medecin:"care",traitements:"care",psychologie:"mindfulness",genetique:"gwas2026",
 autonomie:"living",nutrition:"nutrition",acupuncture:"complementary"
});
export function normalizedFibroTopic(topic){
 const q=normalize(text(topic)).replace(/[^a-z0-9_-]/g,"");
 const id=topicAliases[q]||q;
 if(!allowedTopics.includes(id)||!ids.has(id))throw Error("Thème médical non approuvé : choisissez une fiche existante.");
 return id;
}
export function publicFibroGuidance(topic="fibro"){
 const id=normalizedFibroTopic(topic);
 const d=LIBRARY.find(x=>x.id===id);
 return {title:d.title,answer:d.answer,source:d.source,url:d.url,date:d.date,evidence:d.evidence||"Niveau de preuve non évalué par FibroBot"};
}
export function listFibroAgents(){
 return SPECIALISTS.map(({id,name,role,sourceId})=>({id,name,role,sourceId}));
}
const ensureContext=context=>{
 if(context===null||typeof context!=="object"||Array.isArray(context))throw Error("Contexte de session patient invalide.");
 const keys=["symptoms","tasks","conditions","medications","appointments"];
 return {...Object.fromEntries(keys.map(key=>[key,Array.isArray(context[key])?context[key]:[]])),
  energy:Number.isInteger(Number(context.energy))?Number(context.energy):5};
};
export function callFibroTool(name,args={},context={}){
 if(!FIBRO_MCP_TOOLS.some(x=>x.name===name))throw Error("Outil MCP inconnu ou non autorisé.");
 if(!args||typeof args!=="object"||Array.isArray(args))throw Error("Paramètres de l'outil invalides.");
 const local=ensureContext(context);
 switch(name){
 case "fibro.list_agents":return {kind:"catalog",items:listFibroAgents()};
 case "fibro.guidance":return {kind:"reference",...publicFibroGuidance(args.topic||"fibro")};
 case "fibro.research_topics":return {kind:"catalog",items:RESEARCH_TOPICS.map(({id,label})=>({id,label})),notice:"Ouvrez Bibliothèque et confirmez votre recherche pour consulter Europe PMC."};
 case "fibro.summarize":return {kind:"local",answer:summarizeObservations(local),disclaimer:"Aucune inférence clinique."};
 case "fibro.prepare_visit":return {kind:"local",answer:prepareVisit(local),disclaimer:"Données déclarées, non évaluées médicalement."};
 case "fibro.plan_day":return {kind:"local",answer:planDaily(local),disclaimer:"Organisation non médicale."};
 case "fibro.agent":{
  const agent=runSpecialist(String(args.id||""),local);
  return {kind:"local",...agent};
 }
 case "fibro.safety":{
  const question=text(args.question);
  if(!question)throw Error("Question obligatoire.");
  const r=reply(question,LIBRARY,local);
  if(r.kind==="urgent"||r.kind==="refusal")return {kind:r.kind,answer:r.message};
  return {kind:"none",answer:"Aucun déclencheur de refus ou d'urgence détecté ; cela ne constitue jamais un avis clinique."};
 }
 }
 throw Error("Outil non disponible.");
}
