/* FibroBot — routage de Mistral : information générale, pédagogie médicale
 * publique et organisation générique. Aucune donnée du coffre ni question
 * clinique personnelle n'est envoyée à un modèle distant.
 */
import {LIBRARY} from "./medical-library.mjs";
import {nonMedicalMessages} from "./assistant-engine.mjs";

const approved=new Set(LIBRARY.map(x=>x.id));
export function mistralRoute(question,intent,response){
 if(typeof question!=="string"||!question.trim()||!response||typeof response!=="object")return null;
 if(["urgent","profile"].includes(response.kind))return null;
 if(response.kind==="refusal"&&intent!=="general")return null;
 if(intent==="general"&&["followup","refusal"].includes(response.kind)){
  try{nonMedicalMessages(question,[]);}catch{return null;}
  return {mode:"general",label:"Question générale",preview:question.trim().slice(0,1000)};
 }
 if(intent==="planning"&&response.kind!=="refusal")
  return {mode:"planning",label:"Conseils génériques d'organisation",preview:"Comment découper des tâches quotidiennes en petites étapes avec des pauses, sans informations sur la personne ?"};
 if(intent==="medical"&&response.kind==="documented"){
  const id=response.sources?.find(x=>approved.has(x?.id))?.id;
  if(id)return {mode:"medical-reference",topic:id,label:"Explication d'une fiche médicale publique",
   preview:"Fiche publique : "+LIBRARY.find(x=>x.id===id).title+" (sans question ni dossier patient)"};
 }
 return null;
}
export function mistralConsentDescription(route){
 if(!route)throw Error("Aucun contenu transmissible à Mistral.");
 if(route.mode==="general")return "Question générale envoyée à Mistral, sans historique ni dossier patient :\n« "+route.preview+" »";
 if(route.mode==="medical-reference")return "Mistral recevra seulement le texte PUBLIC de la fiche médicale « "+route.preview+" ». Aucune question personnelle, symptôme, traitement ou donnée du coffre ne sera transmis.";
 if(route.mode==="planning")return "Mistral recevra uniquement une demande GENERIQUE sur l'organisation et les pauses. Aucun titre de tâche, score d'énergie ni donnée de santé ne sera transmis.";
 throw Error("Mode non autorisé.");
}
