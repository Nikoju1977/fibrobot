/* FibroBot — aides locales vérifiables, Studio Niko Design.
 * Pas de diagnostic, prescription, calcul de dose ou score de risque clinique.
 * Les observations restent des données déclarées, sans interprétation médicale.
 */
import {rankTasks,energyGuide,today,dateOK,text} from "./core.mjs";

const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const RE_MEDICAL=/(\b(?:fibromyalgie|fibro)\b|maladi|medic|traitement|douleur|sympt|diagnos|ordonnance|allerg|dose|posolog|crise|suicid|sante|soin|therap|depress|migraine|diabet|asthme|cancer|rhumat|handicap|fatigue|sommeil|insomni|pression|fievre|infection|chirurg|effet secondaire|interact|enceint|prescri|hopital|pharmac|consultation|j.ai mal|mal a la tete|je me sens mal|je souffre|vertige|vomiss|nausee|anxiet|angoiss|paniques|stress|suicide|deprimer|mal etre|blessure|hematome|mal au ventre|mal au dos|saign|tension arterielle|difficulte a respirer)/;
const RE_DRUG=/(dose|dosage|posolog|combien de comprime|quel medicament|arreter|arret.*traitement|modifi.*traitement|interact|contre.indic|puis.je prendre|peux.je prendre|surdosage|intoxicat|prescri|automedic)/;
const RE_PHARMA_NAMES=/(paracetamol|doliprane|ibuprofene|advil|tramadol|morphine|insuline|metformine|sertraline|antidepresseur|anxiolytique|somnifere|antibiotique|cortisone|anticoagulant|opioide|oxycodone|vaccin|rivotril|lyrica|pregabaline)/;
const RE_PRIVATE=/(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:\+33|0[1-9])(?:[ .-]?\d\d){4}|mot de passe|numero de securite sociale|numero de carte|mon adresse|j'habite au \d)/i;

const RE_SENSITIVE_SELF_DISCLOSURE=/(?:\b(?:mon|ma|mes)\s+(?:nom|prenom|adresse|telephone|numero|mail|email|age|date de naissance|dossier|diagnostic|traitement|ordonnance|medicament|symptome|douleur|pathologie)\b|\b(?:je\s+|j[\u0027\u2019])(?:m.appelle|me nomme|habite|souffre|prends|suis sous|suis ne|ai\s+\d{1,3}\s+ans)\b|\b(?:ma mere|mon pere|mon enfant|ma fille|mon fils)\b)/i;
const containsPrivateData=s=>RE_PRIVATE.test(s)||RE_SENSITIVE_SELF_DISCLOSURE.test(s);

export const RESEARCH_TOPICS=Object.freeze([
 {id:"fibromyalgia",label:"Fibromyalgie — recherches générales",query:"TITLE_ABS:fibromyalgia"},
 {id:"activity",label:"Activité physique adaptée",query:"TITLE_ABS:fibromyalgia AND TITLE_ABS:exercise"},
 {id:"sleep",label:"Fibromyalgie et sommeil",query:"TITLE_ABS:fibromyalgia AND TITLE_ABS:sleep"},
 {id:"pacing",label:"Gestion de l'activité (pacing)",query:"TITLE_ABS:fibromyalgia AND TITLE_ABS:pacing"},
 {id:"support",label:"Autogestion et accompagnement",query:"TITLE_ABS:fibromyalgia AND TITLE_ABS:self-management"},
 {id:"pain",label:"Douleur chronique et fibromyalgie",query:"TITLE_ABS:fibromyalgia AND TITLE_ABS:pain"},
 {id:"fatigue",label:"Fatigue et fibromyalgie",query:"TITLE_ABS:fibromyalgia AND TITLE_ABS:fatigue"},
 {id:"cognition",label:"Cognition et fibro-fog",query:"TITLE_ABS:fibromyalgia AND TITLE_ABS:cognition"},
 {id:"rehabilitation",label:"Rééducation et prise en charge",query:"TITLE_ABS:fibromyalgia AND TITLE_ABS:rehabilitation"},
 {id:"life",label:"Qualité de vie",query:"TITLE_ABS:fibromyalgia AND TITLE_ABS:quality of life"}
]);
export function classifyIntent(input){
 const q=norm(input);
 if(RE_DRUG.test(q)||RE_PHARMA_NAMES.test(q))return "medical";
 if(/(bilan|resum|resume|synthes|historique|evolution|compar|tendance|statistique)/.test(q)&&/(mes|mon|observ|sympt|douleur|fatigue|sommeil|suivi)/.test(q))return "summary";
 if(/(prepar|question|fiche|bilan|recap)/.test(q)&&/(rendez.vous|medecin|consultation|soignant|pharmacien)/.test(q))return "visit";
 if(/(recherch|etude|publication|article|science|bibliograph)/.test(q)&&RE_MEDICAL.test(q))return "research";
 if(RE_MEDICAL.test(q))return "medical";
 if(/(organis|tache|planning|courses|menage|lessive|priorite|quotidien|journee|administrati|courrier|papier)/.test(q))return "planning";
 return "general";
}
const validRating=n=>(typeof n==="number"||typeof n==="string")&&String(n).trim()!==""&&Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<=10;
const formattedDay=s=>dateOK(s)?String(s):"date non renseignée";
const lastRows=(ctx,limit)=>(Array.isArray(ctx?.symptoms)?ctx.symptoms:[]).filter(x=>x&&dateOK(x.date)&&validRating(x.intensity)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,limit);
const average=(rows,key)=>{const a=rows.map(r=>r[key]).filter(v=>v!==null&&v!==undefined&&v!==""&&validRating(v)).map(Number);return a.length?((a.reduce((p,c)=>p+c,0)/a.length).toFixed(1).replace(".",","))+"/10 ("+a.length+" notes)":"non renseigné";};
export function summarizeObservations(context={}){
 const rows=lastRows(context,30);
 if(!rows.length)return "Aucune observation exploitable enregistrée. Ajoutez une observation dans l’onglet Santé. FibroBot n’établit pas de diagnostic.";
 const from=formattedDay(rows[rows.length-1].date),to=formattedDay(rows[0].date);
 const recent=rows.slice(0,5).map(x=>formattedDay(x.date)+" : "+text(x.name,80)+" (intensité déclarée "+x.intensity+"/10)").join(" ; ");
 return "Synthèse descriptive de "+rows.length+" observation(s), du "+from+" au "+to+".\n"+
 "Moyennes des valeurs saisies, sans inférence médicale : intensité "+average(rows,"intensity")+
 " ; fatigue "+average(rows,"fatigue")+" ; énergie "+average(rows,"energy")+" ; sommeil "+average(rows,"sleep")+".\n"+
 "Cinq dernières notes : "+recent+".\n"+
 "Les moyennes ne prouvent aucune tendance, cause ou aggravation clinique. Pour les signes nouveaux ou inquiétants, demandez un avis médical.";
}
export function prepareVisit(context={}){
 const observations=lastRows(context,5);
 const conditions=(Array.isArray(context.conditions)?context.conditions:[]).filter(Boolean).slice(0,10).map(x=>text(x.name,100)).filter(Boolean);
 const medications=(Array.isArray(context.medications)?context.medications:[]).filter(Boolean).slice(0,15).map(x=>text(x.name,100)).filter(Boolean);
 const appointments=(Array.isArray(context.appointments)?context.appointments:[]).filter(x=>x&&dateOK(x.date)&&x.date>=today()).sort((a,b)=>String(a.date+(a.time||"")).localeCompare(String(b.date+(b.time||""))));
 const next=appointments[0], questions=appointments.slice(0,3).flatMap(a=>String(a.questions||"").split(/[\n;]/)).map(x=>text(x,180)).filter(Boolean).slice(0,6);
 return "Préparation de consultation (données déclarées, à vérifier avec le professionnel).\n"+
 "Prochain rendez-vous : "+(next?text(next.title,100)+" — "+next.date+(next.time?" à "+next.time:""):"aucun rendez-vous enregistré")+".\n"+
 "Maladies déclarées : "+(conditions.join(", ")||"aucune")+".\n"+
 "Traitements déclarés : "+(medications.join(", ")||"aucun")+". Vérifiez doses et interactions avec le médecin ou le pharmacien.\n"+
 "Observations récentes : "+(observations.map(x=>formattedDay(x.date)+" "+text(x.name,70)+" "+x.intensity+"/10").join(" ; ")||"aucune")+".\n"+
 "Questions déjà notées : "+(questions.join(" ; ")||"aucune")+".\n"+
 "À demander si pertinent : quels symptômes faut-il surveiller, quelles adaptations pratiques prévoir et quand reconsulter ? Ce résumé ne constitue pas une évaluation médicale.";
}
export function planDaily(context={}){
 const n=context.energy===null||context.energy===undefined||context.energy===""?NaN:Number(context.energy);
 const energy=Number.isInteger(n)&&n>=0&&n<=10?n:5;
 const all=rankTasks(context.tasks||[],energy),suggested=all.filter(x=>x.adapted).slice(0,3);
 const later=all.filter(x=>!x.adapted).slice(0,3);
 if(!all.length)return "Votre journée n’a pas encore de tâche enregistrée. Ajoutez-en dans « Tâches », puis choisissez votre énergie de 0 à 10.";
 let response="Proposition d’organisation (non médicale) — énergie déclarée "+energy+"/10.\n"+
 energyGuide(energy).description+"\n"+
 (suggested.length?suggested.map((x,i)=>(i+1)+". "+text(x.title,130)+" (effort "+x.effort+"/3).").join("\n"):"Aucune tâche enregistrée ne correspond au niveau d'effort choisi. Il est possible de tout reporter.")+
 "\nFractionnez chaque action en petites étapes et prévoyez des pauses à votre convenance.";
 if(later.length)response+="\nÀ reporter ou déléguer si possible : "+later.map(x=>text(x.title,100)).join(" ; ")+".";
 return response+"\nCe classement est indicatif et ne remplace pas les conseils de votre équipe soignante.";
}
export function nonMedicalMessages(question,history=[]){
 if(classifyIntent(question)!=="general")throw Error("Question non admissible au dialogue général.");
 if(containsPrivateData(norm(question)))throw Error("Cette question contient des données privées : utilisez le mode documentaire local.");
 const context=Array.isArray(history)?history.filter(x=>x?.purpose==="general-local"&&["user","bot"].includes(x.role)&&classifyIntent(x.body)==="general"&&!containsPrivateData(norm(x.body))).slice(-6):[];
 const system="Tu es FibroBot, compagnon numérique de Studio Niko Design, au style vif, calme, attentionné et précis, comme un assistant de science-fiction sans imiter une voix ou un personnage existant. Réponds en français naturel avec une chaleur sobre, une information claire et des propositions concrètes quand elles sont possibles. Écoute les demandes, pose au maximum une question de suivi pertinente et ne prétends jamais être humain ni professionnel de santé. Ne prétends pas connaître le dossier médical ou avoir consulté Internet. Tu n’as aucune information actualisée. Aucun diagnostic, conseil de traitement, dosage, interaction, posologie, modification de prescription ni évaluation de risque : pour les questions de santé, invite à utiliser les fiches sourcées et à consulter un professionnel. Ne génère aucune action automatique. Signale clairement toute incertitude factuelle.";
 return [{role:"system",content:system},...context.map(x=>({role:x.role==="bot"?"assistant":"user",content:text(x.body,450)})),{role:"user",content:text(question,1000)}];
}
export function cleanGeneratedReply(answer){
 const v=String(answer||"").trim();
 if(!v||v.length>2400)throw Error("Réponse locale vide ou anormalement longue.");
 // Le modèle peut ignorer les consignes : ne jamais laisser passer une réponse
 // contenant une prescription, une posologie, un diagnostic ou une urgence inventés.
 const normalized=norm(v);
 if(/(?:posolog|dosage|\bdose\b|diagnos|prescri|ordonnance|contre.indic|interact.*medic|\bmilligramme|\bmg\b|\bcomprime|arret.*traitement|arretez|prendre.*medic|traitement.*recommand|vous souffrez de|consultez.*urgence)/.test(normalized))
  throw Error("Réponse potentiellement médicale bloquée ; moteur documentaire conservé.");
 if(RE_PHARMA_NAMES.test(normalized)||RE_MEDICAL.test(normalized))
  throw Error("Référence médicale dans une réponse libre : moteur documentaire conservé.");
 if(/https?:\/\/|www\./i.test(v))throw Error("Lien non vérifié du modèle bloqué.");
 return v;
}
/** Broader remote dialogue: permit harmless mentions of health or biology while
 * keeping personalized medical directives and unverified model links blocked.
 * Only called after nonMedicalMessages validates a non-sensitive question.
 */
export function cleanConversationalReply(value){
 const v=String(value||"").trim();
 if(!v||v.length>3800)throw Error("Réponse IA vide ou trop longue.");
 const q=norm(v);
 if(/https?:\/\/|www\./i.test(v))throw Error("Lien non vérifié du modèle bloqué.");
 if(/(?:vous souffrez de|vous avez (?:un|une) (?:cancer|diabete|infection)|\b(?:prenez|arretez|augmentez|diminuez)\b.{0,45}\b(?:mg|comprime|medicament|traitement)|\b(?:posologie|prescription|ordonnance)\s*:\s*\d)/.test(q))
  throw Error("Conseil clinique personnalisé bloqué.");
 return v;
}
export function researchEndpoint(topic){
 const selected=RESEARCH_TOPICS.find(x=>x.id===topic);
 if(!selected)throw Error("Sujet scientifique inconnu.");
 const params=new URLSearchParams({query:selected.query+" sort_date:y",format:"json",pageSize:"6",resultType:"lite"});
 return "https://www.ebi.ac.uk/europepmc/webservices/rest/search?"+params.toString();
}
export function parseResearchResults(payload){
 if(!payload||!Array.isArray(payload.resultList?.result))throw Error("Réponse de la bibliothèque scientifique invalide.");
 return payload.resultList.result.slice(0,6).map(r=>{
  const source=String(r.source||"").replace(/[^A-Z]/g,"").slice(0,10),id=String(r.id||"").replace(/[^a-zA-Z0-9_.-]/g,"").slice(0,80);
  if(!source||!id)return null;
  return {title:text(r.title||"Sans titre",260),journal:text(r.journalTitle||"Revue non précisée",130),date:text(r.firstPublicationDate||r.pubYear||"Date non précisée",30),authors:text(r.authorString||"Auteurs non précisés",200),url:"https://europepmc.org/article/"+encodeURIComponent(source)+"/"+encodeURIComponent(id)};
 }).filter(Boolean);
}
