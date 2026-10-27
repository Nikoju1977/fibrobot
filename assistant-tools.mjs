/* FibroBot — outils locaux déterministes et vérifiables. Studio Niko Design.
 * Les calculs lisent uniquement le coffre déverrouillé dans le navigateur.
 * Aucune inférence médicale ni accès réseau implicite.
 */
import {rankTasks,energyGuide,today} from "./core.mjs";

export const normalize=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'");
const short=(v,n=140)=>String(v??"").trim().slice(0,n);
const bullet=(title,rest="")=>"- "+short(title)+(rest?" — "+rest:"");
const dateString=v=>String(v??"").slice(0,10);
const safeArr=v=>Array.isArray(v)?v:[];
const n10=v=>Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=10?Number(v):null;

export function buildDailyPlan({tasks=[],energy=5}={}){
 const list=rankTasks(safeArr(tasks),n10(energy)??5);
 const safe=list.filter(t=>t.adapted).slice(0,3);
 const later=list.filter(t=>!t.adapted);
 const lines=["Plan de journée proposé à partir de vos tâches déclarées (et non d'un avis médical).",energyGuide(n10(energy)??5).description];
 if(!list.length)return lines.concat(["Aucune tâche en attente. Vous pouvez ajouter une petite action dans « Tâches »."]).join("\n\n");
 if(!safe.length)lines.push("Aucune tâche ne correspond à l'effort choisi : envisagez un report ou de demander de l'aide.");
 else{
  lines.push("Actions possibles, à votre rythme :");
  safe.forEach((task,i)=>lines.push((i+1)+". "+short(task.title)+" (effort déclaré "+task.effort+"/3)."));
  lines.push("Prévoyez des pauses libres entre les actions ; vous pouvez vous arrêter à tout moment.");
 }
 if(later.length)lines.push("À reporter ou déléguer si nécessaire : "+later.slice(0,3).map(t=>short(t.title)).join(" ; ")+".");
 if(list.length>safe.length+later.length)lines.push("D'autres tâches restent consultables dans « Tâches ».");
 return lines.join("\n");
}
export function summarizeJournal({symptoms=[]}={}){
 const rows=safeArr(symptoms).filter(x=>x&&dateString(x.date)).sort((a,b)=>dateString(b.date).localeCompare(dateString(a.date)));
 if(!rows.length)return "Journal de suivi : aucune observation saisie. Allez dans « Santé » pour noter ce que vous ressentez, sans obligation de tout mesurer.";
 const scores=rows.map(r=>n10(r.intensity)).filter(x=>x!==null);
 const lines=["Résumé descriptif de votre journal (données saisies, sans diagnostic ni interprétation clinique).",
  rows.length+" observation(s), du "+dateString(rows[rows.length-1].date)+" au "+dateString(rows[0].date)+"."];
 if(scores.length)lines.push("Intensités déclarées : "+Math.min(...scores)+"/10 à "+Math.max(...scores)+"/10 (sur "+scores.length+" saisie(s), symptômes possiblement différents).");
 lines.push("Dernières observations :");
 rows.slice(0,5).forEach(r=>lines.push(bullet(dateString(r.date)+" · "+short(r.name,75),"intensité "+(n10(r.intensity)??"non notée")+"/10"+(n10(r.energy)!==null?" ; énergie "+r.energy+"/10":""))));
 lines.push("Ce résumé ne détecte ni aggravation ni cause. Tout signe nouveau, soudain ou inquiétant doit être évalué par un professionnel.");
 return lines.join("\n");
}
export function prepareVisit({symptoms=[],conditions=[],medications=[],appointments=[]}={}){
 const recent=safeArr(symptoms).sort((a,b)=>dateString(b.date).localeCompare(dateString(a.date))).slice(0,5);
 const next=safeArr(appointments).filter(a=>dateString(a.date)>=today()).sort((a,b)=>dateString(a.date).localeCompare(dateString(b.date)))[0];
 const lines=["Préparation de consultation — éléments déclarés à vérifier avec votre équipe soignante.",
  next?"Prochain rendez-vous noté : "+short(next.title)+" le "+dateString(next.date)+(next.time?" à "+short(next.time,6):"")+".":"Aucun rendez-vous futur enregistré.",
  "Conditions déclarées : "+(safeArr(conditions).length?safeArr(conditions).slice(0,10).map(x=>short(x.name,80)).join(" ; "):"aucune")+".",
  "Traitements déclarés (sans validation des doses ni des interactions) : "+(safeArr(medications).length?safeArr(medications).slice(0,10).map(x=>short(x.name,80)).join(" ; "):"aucun")+".",
  "Observations récentes : "+(recent.length?recent.map(x=>dateString(x.date)+" "+short(x.name,60)+" "+(n10(x.intensity)??"?")+"/10").join(" ; "):"aucune")+".",
  "Questions utiles à noter : Quels symptômes nouveaux dois-je signaler ? Quels examens ou suivis sont pertinents dans mon cas ? Pouvez-vous revoir la liste complète de mes traitements et leurs interactions ?",
  "Pour partager ces notes, utilisez le rapport imprimable depuis « Mes données ». Ce document ne remplace pas une consultation."];
 return lines.join("\n");
}
export function searchMedicalLibrary(query,library=[]){
 const q=normalize(query).replace(/[^a-z0-9 ]+/g," ").trim();
 const tokens=q.split(/\s+/).filter(x=>x.length>3&&!["pour","avec","dans","quoi","quels","quelle","recherche","recommandation","scientifique","medicale","source","bibliotheque","consulter","document"].includes(x)).slice(0,12);
 if(!tokens.length)return [];
 return safeArr(library).map(doc=>{
  const hay=normalize((doc.title||"")+" "+safeArr(doc.keywords).join(" ")+" "+(doc.answer||"")).replace(/[^a-z0-9 ]+/g," ");
  const hits=tokens.filter(t=>hay.includes(t)).length;
  return {...doc,hits};
 }).filter(doc=>doc.hits>0).sort((a,b)=>b.hits-a.hits).slice(0,4);
}
export function assistantToolReply(question,data={},library=[]){
 const q=normalize(question);
 if(/(?:plan(?:ifie|ning)?|organis|prioris|journee|programme).{0,45}(?:tache|journee|quotidien)|(?:ma journee|mes priorites|planning complet|plan de journee)/.test(q))
  return {kind:"plan",message:buildDailyPlan(data),sources:[]};
 if(/(?:resume|resumer|synthese|bilan|recap|historique|evolution).{0,48}(?:journal|observation|symptome|sante|douleur)|(?:mon journal|bilan de sante declare)/.test(q))
  return {kind:"summary",message:summarizeJournal(data),sources:[]};
 if(/(?:prepar|resume|synthese|bilan).{0,40}(?:consultation|rendez.vous|medecin)|(?:dossier pour mon medecin|preparer ma visite)/.test(q))
  return {kind:"visit",message:prepareVisit(data),sources:[]};
 if(/(?:source|fiche|bibliotheque|reference|etude|recommandation|recherche).{0,60}(?:fibro|sommeil|douleur|meditation|activite|hypnose|nutrition|recherche|scientifique)|(?:cherche des sources|bibliotheque medicale)/.test(q)){
  const found=searchMedicalLibrary(question,library);
  if(!found.length)return {kind:"library",message:"Aucune fiche correspondante dans la bibliothèque embarquée. Ouvrez « Bibliothèque » pour consulter les sources institutionnelles ; FibroBot ne fait pas de recherche Internet en direct.",sources:[]};
  return {kind:"library",message:"Fiches de la bibliothèque locale (non mises à jour en temps réel) :\n"+found.map(d=>bullet(d.title,d.source+" · "+d.date)).join("\n")+"\nOuvrez « Bibliothèque » puis le lien de chaque fiche pour lire la source originale.",sources:found};
 }
 return null;
}
// Aucun texte libre lié à un soin, à une urgence ou à des informations privées
// ne doit être routé vers l'IA générative du navigateur.
export function safeGeneralQuestion(input){
 const q=short(input,2000),s=normalize(q);
 if(!q||q.length>500)return false;
 if(/[\r\n]/.test(q)||/https?:\/\/|www\.|@|(?:\+33|0[1-9])(?:[ .-]?\d\d){4}/i.test(q))return false;
 if(/(?:dose|dosage|mg\b|medic|prescri|traitement|maladi|diagnos|fibro|sante|symptom|douleur|fatigu|sommeil|insomni|crise|urgence|depress|suicid|anxiet|angoiss|stress|allerg|respir|diabet|enceinte|grossess|chirurg|infection|therapi|psych|cancer|tension|ordonnance|pharmaci|patient|docteur|soignant|interaction|comprime|vitamine|poids|regime|manger|nutrition|handicap|autisme|asthme|eczema|blessure)/.test(s))return false;
 if(/(?:mon adresse|mon nom|mon numero|mon compte|mon email|ma carte|mot de passe|secret|identifiant|date de naissance)/.test(s))return false;
 if(/(?:meteo|aujourd.hui.*actualite|nouvelle[s]? du jour|qui est president|bourse en temps reel|cours actuel)/.test(s))return false;
 return true;
}
export function safeGeneratedAnswer(answer){
 const s=String(answer??"").trim().slice(0,1400);
 if(!s||s.length>1200||/https?:\/\/|www\.|(?:dosage|posologie|prescri|ordonnance|milligramme|medicament|diagnostic|urgence medicale|arretez votre traitement|arret du traitement|vous souffrez de|votre maladie)/i.test(s))return null;
 return s;
}
