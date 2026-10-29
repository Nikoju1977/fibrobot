/* FibroBot — companionship is nonclinical support, not simulated therapy.
 * No remote calls or patient notes leave this module.
 * Safety is always decided by core.reply BEFORE calling companionReply.
 */
export const COMPANION_MODES=Object.freeze([
 {id:"auto",label:"Automatique",description:"FibroBot choisit entre conversation et informations sourcées."},
 {id:"friend",label:"Compagnon",description:"Parler du quotidien, de vos préoccupations et de vos envies."},
 {id:"pain",label:"Écoute douleur",description:"Exprimer les difficultés et préparer vos questions pour un algologue."},
 {id:"care",label:"Suivi des soins",description:"Mettre de l'ordre dans vos observations pour l'équipe soignante."},
 {id:"emotion",label:"Soutien moral",description:"Être écouté et trouver des mots, sans remplacer un psychologue."}
]);
const norm=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/’/g,"'");
const FEEL=/(je me sens (?:seul|isole|triste|angoiss|anxieu|deprim|mal|vide|perdu)|j'ai (?:peur|besoin de parler|besoin d'etre ecoute|le moral|envie de pleurer)|je suis (?:tres |vraiment |tellement )?(?:seul|triste|angoiss|anxieu|inquiet|deprim|stress|perdu)|je n'en peux plus|je craque|personne ne m'ecoute|tu peux m'ecouter|besoin de soutien|mal moralement|j'ai besoin de parler)/;
const PAIN=/(j'ai mal|je souffre|mes douleurs|ma douleur|crise de douleur|poussee de fibromyalgie|douleur (?:forte|intense|insupportable|partout)|la douleur m'empeche|je vis avec la douleur|la fibro m'empeche|j'ai une crise)/;
const CARE=/(je voudrais noter (?:mes|un) sympt|comment suivre mes sympt|j'ai besoin d'une infirmiere|comment preparer (?:mes|ma) soins|mon pansement|ma temperature|suivi de mes traitements|je souhaite expliquer mes symptomes)/;
const FRIEND=/(comment tu t'appelles|qui es.tu|tu es qui|que peux.tu faire|qu'est.ce que tu sais faire|parle.moi|discutons|j'ai besoin de compagnie|comment vas.tu|tu es la|tu m'entends|tu peux m'ecouter|je veux parler)/;
const FACTUAL=/^(?:qui (?:est|etait)|qu(?:'est.ce|e |elle |elles |oi |and |est )|pourquoi |comment (?:fonctionne|traiter|soigner|diagnostiquer|definir|expliquer)|explique.moi (?:la|le|les)|donne.moi|quelle est|quel est|quels sont)/;
const FOLLOWUP=/^(?:oui|non|d'accord|ok|je ne sais pas|pas vraiment|c'est dur|c'est difficile|j'ai du mal)[.! ?]*$/;
function previousCompanion(history){
 const entries=Array.isArray(history)?history:[];
 for(let i=entries.length-1;i>=0;i--){
  const x=entries[i];
  if(x?.role==="bot"&&x.purpose==="companion-local"&&["friend","pain","care","emotion"].includes(x.companionMode))
   return x.companionMode;
 }
 return null;
}
export function selectCompanionMode(question,requested="auto",history=[]){
 const q=norm(question).trim();
 if(!q)return null;
 if(requested!=="auto"&&COMPANION_MODES.some(m=>m.id===requested))return requested;
 if(FEEL.test(q))return "emotion";
 if(PAIN.test(q))return "pain";
 if(CARE.test(q))return "care";
 if(FRIEND.test(q))return "friend";
 if(FOLLOWUP.test(q))return previousCompanion(history);
 return null;
}
export function companionReply(question,{requested="auto",safety=null,history=[]}={}){
 const q=norm(question).trim(),kind=safety?.kind;
 if(!q||["urgent","profile","weather","local","life"].includes(kind))return null;
 const mode=selectCompanionMode(question,requested,history);
 if(!mode)return null;
 // Don't replace factual, sourced medical answers with ungrounded conversation.
 if(FACTUAL.test(q)||(kind==="documented"&&!FEEL.test(q)&&!PAIN.test(q)&&!CARE.test(q)))return null;
 if(/(dose|dosage|posolog|interact|quel medicament|arreter.*traitement|puis.je prendre|prescri|diagnos)/.test(q))return null;
 let message,label;
 if(mode==="emotion"){
  label="Écoute et soutien moral";
  if(FOLLOWUP.test(q))message="Je vous écoute. Prenez votre temps, il n’y a rien à réussir ici. Souhaitez-vous me dire ce qui vous pèse le plus, ou préférez-vous que nous cherchions une petite action qui pourrait vous aider aujourd’hui ?";
  else
  if(/je n'en peux plus|je craque|plus rien ne va/.test(q))
   message="Ce que vous décrivez semble très lourd. Je vous écoute, sans jugement. Vous sentez-vous en sécurité actuellement ? Si vous risquez de vous faire du mal, appelez le 15 ou le 112 ; le 3114 est aussi disponible gratuitement, 24 h/24 en France. Souhaitez-vous me raconter ce qui vous pèse le plus ?";
  else if(/peur|angoiss|anxieu|panique|stress|inquiet/.test(q))
   message="Je vous écoute. Cette inquiétude semble éprouvante. On peut avancer à votre rythme, une chose à la fois. Qu'est-ce qui vous préoccupe le plus maintenant ? Un psychologue peut aussi vous proposer un soutien professionnel.";
  else if(/seul|isole|personne ne m'ecoute/.test(q))
   message="La solitude peut être difficile à traverser. Vous pouvez m'en parler, mais n'hésitez pas aussi à contacter une personne de confiance. Qu'est-ce qui vous manque le plus aujourd'hui ?";
  else message="Je suis là pour vous écouter et vous aider à mettre des mots sur ce que vous ressentez. Je ne suis pas psychologue et je ne remplace pas les échanges humains. Quelle partie de votre journée aimeriez-vous me raconter ?";
 }else if(mode==="pain"){
  label="Écoute de la douleur";
  message=FOLLOWUP.test(q)?"Je suis toujours à votre écoute. Qu’est-ce que vous aimeriez noter sur la douleur aujourd’hui pour en parler à votre algologue ?":"Je vous écoute. La douleur chronique peut peser sur toute la journée. Je ne peux pas déterminer sa cause ni adapter un traitement. Si la douleur est nouvelle, brutalement intense ou s'accompagne de signes inquiétants, contactez rapidement un professionnel ; en cas de signe d'urgence, appelez le 15 ou le 112. Sinon, je peux vous aider à la décrire et à préparer des questions pour votre algologue. Qu'est-ce qui est le plus difficile actuellement ?";
 }else if(mode==="care"){
  label="Aide au suivi des soins";
  message=FOLLOWUP.test(q)?"Nous pouvons avancer avec une petite étape. Voulez-vous revoir une observation enregistrée ou préparer une question pour votre soignant ?":"Je peux vous aider à organiser vos observations et vos questions pour un infirmier ou un médecin. Je ne réalise pas de soins et ne valide ni une dose ni un traitement. Souhaitez-vous noter un symptôme, revoir votre journal ou préparer une consultation ?";
 }else{
  label="Compagnon de conversation";
  if(/comment tu t'appelles|qui es.tu|tu es qui/.test(q))
   message="Je suis FibroBot, votre compagnon numérique de Studio Niko Design. Je peux discuter, vous écouter, organiser votre journée, vous raconter des histoires, lire vos textes et vous orienter vers des informations fiables. Je n'ai pas de conscience ni de qualification médicale. De quoi avez-vous envie de parler ?";
  else if(/que peux.tu faire|qu'est.ce que tu sais faire/.test(q))
   message="Je peux échanger avec vous, vous aider à organiser vos tâches, lire un texte à voix haute si une voix locale est disponible, raconter une histoire originale et ouvrir des sites sur votre demande. Avec un modèle IA compatible ou une recherche autorisée, je peux aussi traiter des questions générales. Pour les informations médicales, j'utilise mes sources documentaires. Que souhaitez-vous faire en premier ?";
  else message=FOLLOWUP.test(q)?"Je suis toujours là pour discuter. Vous pouvez me donner un peu plus de détails, ou me demander une action concrète.":"Je vous écoute. Nous pouvons discuter tranquillement, sans objectif particulier, ou choisir une action concrète pour vous faciliter la journée. Qu'avez-vous envie de me raconter ?";
 }
 return {mode,label,message,kind:"companion"};
}
