/* FibroBot — spécialistes locaux supervisés, Studio Niko Design.
 * Agents déterministes : fonctions explicites, références sourcées, aucun diagnostic.
 * Aucune requête réseau ni inférence clinique ; le modèle génératif reste séparé.
 */
import {reply,text} from "./core.mjs";
import {LIBRARY} from "./medical-library.mjs";
import {summarizeObservations,prepareVisit,planDaily} from "./assistant-engine.mjs";

export const SPECIALISTS=Object.freeze([
 Object.freeze({id:"pain",name:"Douleurs et fibromyalgie",role:"Repères documentaires et préparation de questions",sourceId:"fibro"}),
 Object.freeze({id:"sleep",name:"Sommeil",role:"Documenter le sommeil sans évaluation médicale",sourceId:"sleep"}),
 Object.freeze({id:"fatigue",name:"Fatigue et brouillard cognitif",role:"Résumer les observations déclarées",sourceId:"fibro"}),
 Object.freeze({id:"pacing",name:"Activités et énergie",role:"Fractionner les tâches, proposer des pauses et priorités",sourceId:"daily"}),
 Object.freeze({id:"visit",name:"Coordination des soins",role:"Préparer une consultation et organiser les informations",sourceId:"care"}),
 Object.freeze({id:"medication",name:"Traitements déclarés",role:"Relire la liste saisie, préparer la revue pharmaceutique",sourceId:"care"}),
 Object.freeze({id:"research",name:"Bibliothèque scientifique",role:"Orienter vers les sources institutionnelles et Europe PMC",sourceId:"fibro"})
]);
const normalized=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const hasClinicalAction=q=>/\b(dosage|dose|posolog|prescri|diagnos|comprime|arreter|arret.*traitement|surdo|interaction|contre.indication|quel medicament|puis.je prendre|peux.je prendre)\b/.test(normalized(q));
const symptomCount=context=>Array.isArray(context?.symptoms)?context.symptoms.length:0;
const documented=id=>LIBRARY.find(x=>x.id===id);

export function routeSpecialist(question){
 const q=normalized(question);
 if(!q||hasClinicalAction(q))return null;
 if(/(mon|ma|mes) (rendez.vous|consultation)|prepar.*(consultation|medecin|rendez.vous)/.test(q))return "visit";
 if(/(organis|tache|planning|courses|menage|lessive|quotidien|journee|priorite)/.test(q)&&!/(dose|traitement|medicament)/.test(q))return "pacing";
 if(/(mon|mes) (sommeil|insomnie|nuits?)|insomnie|dormir|sommeil/.test(q))return "sleep";
 if(/fatigue|brouillard cognitif|concentration|memoire/.test(q))return "fatigue";
 if(/douleur|\bfibromyalgie\b|\bfibro\b/.test(q))return "pain";
 return null;
}

export function runSpecialist(id,context={},question=""){
 const specialist=SPECIALISTS.find(x=>x.id===id);
 if(!specialist)throw Error("Agent inconnu.");
 const safety=question?reply(question,LIBRARY,context):null;
 if(safety?.kind==="urgent"||safety?.kind==="refusal"&&hasClinicalAction(question))
  return {id:"safety",name:"Sécurité et orientation",answer:safety.message,sourceId:""};
 const source=documented(specialist.sourceId);
 const intro=specialist.name+" — assistant d'information, non professionnel de santé.\n";
 let answer="",sourceId=specialist.sourceId;
 switch(id){
  case "pain":{
   answer=intro+(source?.answer||"Une douleur nouvelle ou inhabituelle mérite une évaluation.")+
     "\nVous avez "+symptomCount(context)+" observation(s) enregistrée(s). Pour préparer votre consultation, indiquez les changements, la fréquence et les situations qui vous préoccupent.";
   break;
  }
  case "sleep":{
   answer=intro+(source?.answer||"Le sommeil mérite une évaluation individuelle.")+
     "\n"+summarizeObservations(context);
   break;
  }
  case "fatigue":{
   answer=intro+"Voici une synthèse descriptive de vos notes, sans diagnostic ni attribution de cause.\n"+
     summarizeObservations(context)+"\n"+(documented("daily")?.answer||"")+"\n";
   sourceId="daily";break;
  }
  case "pacing":{
   answer=intro+planDaily(context)+"\n"+(documented("daily")?.answer||"");
   sourceId="daily";break;
  }
  case "visit":{
   answer=intro+prepareVisit(context);sourceId="care";break;
  }
  case "medication":{
   const names=(context?.medications||[]).slice(0,20).map(x=>text(x.name,100)).filter(Boolean);
   answer=intro+"Traitements que vous avez déclarés : "+(names.join(" ; ")||"aucun")+
     ".\nLeur liste, leurs doses et leurs horaires ne sont pas vérifiés par FibroBot. Un pharmacien ou médecin doit confirmer les interactions, contre-indications et modifications éventuelles.\n"+
     "Utilisez « Préparer mon rendez-vous » pour partager vos informations avec un professionnel.";
   sourceId="care";break;
  }
  case "research":{
   answer=intro+"Les fiches intégrées présentent les sources HAS et NCCIH. Dans Bibliothèque médicale, la recherche Europe PMC utilise uniquement des thèmes prédéfinis et votre accord. Une publication ne vaut pas une recommandation de traitement.";
   sourceId="fibro";break;
  }
 }
 if(!answer)throw Error("Réponse spécialisée indisponible.");
 return {id,name:specialist.name,answer,sourceId};
}
