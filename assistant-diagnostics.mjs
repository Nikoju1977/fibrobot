/* FibroBot — diagnostic transparent du moteur, 100 % local.
 * Ce module n'accède à aucun dossier patient, ne lance aucun téléchargement,
 * n'appelle ni Mistral ni une API scientifique et ne consomme aucun crédit.
 */
import {reply} from "./core.mjs";
import {LIBRARY} from "./medical-library.mjs";
import {classifyIntent} from "./assistant-engine.mjs";
import {mistralRoute} from "./mistral-routing.mjs";
import {retrieveMedicalEvidence} from "./medical-rag.mjs";

export function checkAssistantCore(){
 const scenarios=[
  {id:"accueil",question:"Bonjour",expected:"followup"},
  {id:"fibromyalgie",question:"Quels sont les symptômes de la fibromyalgie ?",expected:"documented"},
  {id:"sécurité",question:"Quelle dose de morphine dois-je prendre ?",expected:"refusal"},
  {id:"urgence",question:"Je veux me suicider",expected:"urgent"}
 ];
 const checks=scenarios.map(({id,question,expected})=>{
  try{
   const response=reply(question,LIBRARY);
   const valid=response.kind===expected&&typeof response.message==="string"&&response.message.trim().length>30;
   const sourceValid=expected!=="documented"||response.sources?.some(x=>x?.url?.startsWith("https://"));
   const routing=classifyIntent(question);
   const remote=mistralRoute(question,routing,response);
   const remoteSafe=id==="sécurité"||id==="urgence"?remote===null:true;
   return {id,ok:Boolean(valid&&sourceValid&&remoteSafe),info:valid&&sourceValid&&remoteSafe?"Réponse locale prête":"Scénario de réponse ou de sécurité incomplet"};
  }catch{return{id,ok:false,info:"Erreur du moteur local"};}
 });
 return {ok:checks.every(x=>x.ok),checks};
}

export function companionStatus({vaultOpen=false,mistral={},internet=false}={}){
 const remote=mistral&&typeof mistral==="object"?mistral:{};
 const cooldown=Math.max(0,Math.ceil(Number(remote.cooldownSeconds)||0));
 return [
  {id:"coffre",name:"Coffre patient",status:vaultOpen?"prêt":"verrouillé",detail:vaultOpen?"Conversation enregistrable dans le coffre chiffré.":"Le coffre doit être déverrouillé pour enregistrer les échanges."},
  {id:"documentation",name:"Bibliothèque médicale locale",status:"prêt",detail:"Fiches de fibromyalgie et aide déterministe disponibles sans Mistral."},
  {id:"mistral",name:"Mistral AI",status:!remote.connected?"déconnecté":cooldown?"limité (429)":"configuré",detail:cooldown?"Quota atteint : nouvelle tentative possible dans environ "+cooldown+" secondes. Aucun appel automatique.":remote.connected?"Clé disponible ; le vrai test nécessite un appel API consenti.":"Utilisation facultative avec votre clé API."},
  {id:"internet",name:"Recherche Internet",status:internet?"autorisée":"désactivée",detail:"Les recherches libres nécessitent une confirmation distincte pour chaque question."}
 ];
}

export function documentedAnswer(question){
 const r=reply(question,LIBRARY);
 if(r.kind!=="documented")return {kind:r.kind,answer:r.message,references:[]};
 const local=retrieveMedicalEvidence(question,{limit:3});
 const docs=new Map();
 for(const d of r.sources||[])if(d?.id&&d?.url)docs.set(d.id,{title:d.title,provider:d.source,url:d.url});
 for(const d of local.passages||[])if(d?.id&&d?.url)docs.set(d.id,{title:d.title,provider:d.source,url:d.url});
 return {kind:"documented",answer:r.message,references:[...docs.values()].slice(0,3)};
}
