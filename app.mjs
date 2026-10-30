import {setupSimpleAssistant} from "./simple-assistant.mjs";
import {today,text,makeSymptom,makeTask,makeCondition,makeAppointment,makeMedication,energyGuide,rankTasks,reply,dueReminders,reminderLog,medicationReminderTimes} from "./core.mjs";
import {LIBRARY} from "./medical-library.mjs";
import {openSecureDB,all,put,del,wipeDB,encryptedExport,eraseLegacy} from "./vault-ui.mjs";
import {liveIntent,explicitWeatherCity,publicWeather,publicAirQuality,publicFrenchHolidays,LIVE_SOURCES} from "./public-live-services.mjs";
import {createPublicFeedMonitor,feedState} from "./live-feed-hub.mjs";
import {createAmbientPlayer,AMBIENT_TYPES} from "./ambient-sound.mjs";
import {parseQuickHealth,QUICK_HELP} from "./quick-health.mjs";
import {searchPrivateRecords} from "./private-search.mjs";
import {BREATH_PATTERNS,BREATH_DURATIONS,breathingStep,sessionTimeString} from "./breathing-guide.mjs";
import {SPECIALISTS,routeSpecialist,runSpecialist} from "./agent-hub.mjs";
import {classifyIntent,summarizeObservations,prepareVisit,planDaily} from "./assistant-engine.mjs";
import {findScientificArticles,externalResearchLink} from "./research-library.mjs";
import {isOnlineEligible,selectPublicProviders,searchPublicQuestion,formatPublicAnswer,safeReferenceUrl,PUBLIC_PROVIDERS} from "./network-library.mjs";
import {setupPatientUX} from "./ux-pro.mjs";
import {checkAssistantCore,companionStatus,documentedAnswer} from "./assistant-diagnostics.mjs";
import {HEALTH_CATALOG,retrieveMedicalEvidence,approvedMedicalURL} from "./medical-rag.mjs";
import {connectMistral,disconnectMistral,cancelMistralRequests,mistralStatus,generateMistralChat,generateMistralMedicalExplanation,generateMistralPlanningAdvice,testMistralConnection} from "./mistral-bridge.mjs";
import {agnesStatus,connectAgnes,disconnectAgnes,cancelAgnesRequests,generateAgnesChat,generateAgnesPublicFiche,generateAgnesGroundedPublic,testAgnesConnection} from "./agnes-bridge.mjs";
import {AGNES_CREDENTIAL_ID,validStoredAgnesCredential,saveAgnesCredential,loadAgnesCredential,deleteAgnesCredential} from "./agnes-credential-vault.mjs";
import {autoGeneralAllowed,answerWithAuto,shouldPreferSources} from "./auto-engine.mjs";
import {sessionPreview,appendSessionTurn} from "./conversation-context.mjs";
import {PREFERENCE_SETTING_ID,validateGeneralPreference,savedGeneralPreference,preferenceHistory} from "./safe-preferences.mjs";
import {TREND_METRICS,dailyTrend,trendDescription} from "./health-trends.mjs";
import {apiBudgetStatus,configureApiBudget} from "./request-budget.mjs";
import {openPrivateDocument} from "./document-reader.mjs";
import {AUTO_LOCK_SETTING,storedAutoLockMinutes,sanitizeAutoLockMinutes,shouldLockForInactivity} from "./session-lock.mjs";
import {startDictation} from "./voice-input.mjs";
import {upcomingAppointments,appointmentAlertKeys,appointmentCalendarICS} from "./appointment-reminders.mjs";
import {coordinatedCareBriefing} from "./care-briefing.mjs";
import {mistralRoute,mistralConsentDescription} from "./mistral-routing.mjs";
import {CREDENTIAL_ID,validStoredMistralCredential,saveMistralCredential,loadMistralCredential,deleteMistralCredential} from "./mistral-credential-vault.mjs";
import {callFibroTool,FIBRO_MCP_TOOLS} from "./mcp-fibro-tools.mjs";
import {companionReply} from "./companion-engine.mjs";
import {parseSiteCommand,knownSite,parseStoryCommand,parseReadingCommand,originalStory} from "./life-actions.mjs";
import {normalizeBookText,validateBookFile,readerPage,splitSpeech} from "./book-reader.mjs";
import {parseLocalNavigation} from "./local-commands.mjs";
import {medicationCalendarICS} from "./medication-calendar.mjs";
import {READER_BOOKMARK_ID,readerBookmark,matchingReaderBookmark} from "./reader-bookmark.mjs";
import {preferredLocalVoice,speechErrorMessage} from "./voice-health.mjs";
import {descriptiveWellbeingBrief} from "./v28-insights.mjs";
import {findBookPages} from "./reader-search.mjs";
import {deviceReadiness} from "./device-readiness.mjs";
import {createSessionGuard} from "./session-guard.mjs";
import {FOREGROUND_REMINDER_OPTIN_ID,optInForegroundReminders,eligibleForegroundReminders} from "./foreground-reminders.mjs";
import {readingPageRange,BOOK_SLEEP_MINUTES,validSleepMinutes} from "./reading-range.mjs";
const $=id=>document.getElementById(id);
const TITLES={today:"Aujourd'hui",chat:"Assistant",tasks:"Mes tâches",health:"Suivi santé",conditions:"Mes maladies",medications:"Mes traitements",appointments:"Mes rendez-vous",library:"Bibliothèque médicale",privacy:"Mes données",crisis:"Mode crise"};
const DATA={symptoms:[],tasks:[],conditions:[],medications:[],appointments:[],medicationLogs:[],conversations:[],settings:[]};
const FORMS={tasks:"task-form",symptoms:"health-form",conditions:"condition-form",medications:"med-form",appointments:"appt-form"};
let db=null,energy=5,voice=false,seen=new Set(),timer=null,patientUX=null,lastSpeech="",busyChat=false,networkEnabled=false;
let refreshSimpleAssistant=()=>{};
let bookText="",bookIndex=0,bookFile=null,speechToken=0,activeRecognition=null,dictationStarting=false,pendingInstall=null,pdfDocumentFile=null,lastActivityAt=Date.now();
// Session-only chat context; never persisted and never taken from the health vault.
const sessionTurns=[];
const activeSession=createSessionGuard();
const medAlertSeen=new Set();
const QUIET_SETTING_ID="quiet-mode-v29";
let bookSleepTimeout=null;
let activeAgentId="general";
const EXPERT_PANEL=Object.freeze([
 {id:"algologue",name:"Douleur / fibromyalgie",specialist:"pain"},
 {id:"pharmacien",name:"Traitements / pharmacien",specialist:"medication"},
 {id:"ergonome",name:"Ergonomie / énergie",specialist:"pacing"},
 {id:"qualite",name:"Qualité / suivi",specialist:"quality"},
 {id:"triage",name:"Orientation médicale",specialist:"triage"},
 {id:"psycho",name:"Soutien émotionnel",specialist:"psychosocial"},
 {id:"nutrition",name:"Alimentation",specialist:"nutrition"},
 {id:"social",name:"Vie sociale / travail",specialist:"social"}
]);
let feedMonitor=null;
const ambientPlayer=createAmbientPlayer();
let breathingTimer=null;
function stopBreathingSession(){if(breathingTimer!==null){clearInterval(breathingTimer);breathingTimer=null;}}
const dom=(tag,string,cls)=>{let n=document.createElement(tag);if(string!==undefined)n.textContent=String(string);if(cls)n.className=cls;return n;};
const val=id=>$(id).value;
function notify(message){$("toast").textContent=message;$("toast").hidden=false;clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>$("toast").hidden=true,5500);}
function tab(name){if(!TITLES[name])return;document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===name));document.querySelectorAll("[data-tab]").forEach(x=>{x.classList.toggle("active",x.dataset.tab===name);x.dataset.tab===name?x.setAttribute("aria-current","page"):x.removeAttribute("aria-current");});$("page-heading").textContent=TITLES[name];document.title=TITLES[name]+" · FibroBot";patientUX?.closeMenu();window.scrollTo(0,0);}
function blank(target,message){target.replaceChildren(dom("div",message,"empty"));}
function action(label,method,store,id){const b=dom("button",label,"mini");b.type="button";b.dataset.action=method;b.dataset.store=store;b.dataset.id=String(id);return b;}
function record(target,title,subtitle,notes,store,id,extra={}){const row=dom("div",undefined,"record"),copy=dom("div"),buttons=dom("div",undefined,"actions");copy.append(dom("strong",title,extra.done?"done":""));if(subtitle)copy.append(dom("small",subtitle));if(notes)copy.append(dom("p",notes));if(extra.tag)copy.append(dom("span",extra.tag,extra.tag==="À reporter"?"tag later":"tag"));if(store==="tasks")buttons.append(action(extra.done?"Réouvrir":"Terminer","toggle",store,id));if(FORMS[store])buttons.append(action("Modifier","edit",store,id));if(store)buttons.append(action("Supprimer","delete",store,id));row.append(copy,buttons);target.append(row);}
async function reload(){for(const name of Object.keys(DATA))DATA[name]=await all(db,name);energy=DATA.settings.find(s=>s.id==="energy")?.value??energy;refreshMistralVaultControls();refreshAgnesVaultControls();restoreV29Preferences();render();}
function render(){ $("count-tasks").textContent=DATA.tasks.filter(x=>!x.done).length;$("count-health").textContent=DATA.symptoms.length;$("count-conditions").textContent=DATA.conditions.length;$("daily-energy").value=energy;$("energy-out").textContent=energy+"/10";$("energy-guide").textContent=energyGuide(energy).description;renderTasks();renderHealth();renderHealthTrends();renderConditions();renderMeds();renderAppointments();renderUpcomingAppointments();renderLibrary();renderChat();renderGeneralPreference();refreshAutoLockSettings();patientUX?.refreshGuide(); }
function renderTasks(){const tasks=rankTasks(DATA.tasks,energy),out=$("tasks-list"),home=$("today-tasks");out.replaceChildren();home.replaceChildren();if(!tasks.length)blank(home,"Aucune tâche urgente. Vous pouvez vous reposer.");else tasks.slice(0,5).forEach(t=>record(home,t.title,"Effort "+t.effort+"/3",null,null,t.id,{tag:t.adapted?"Effort compatible":"À reporter"}));if(!DATA.tasks.length)blank(out,"Vous pouvez ajouter vos tâches ici.");else [...tasks,...DATA.tasks.filter(x=>x.done)].forEach(t=>record(out,t.title,(t.priority==="important"?"Essentielle":t.priority==="delegable"?"Délégable":"Flexible")+" · effort "+t.effort+"/3"+(t.due?" · "+t.due:""),null,"tasks",t.id,{done:t.done,tag:t.done?"Terminée":t.adapted?"Effort compatible":"À reporter"}));}
function renderHealth(){const out=$("health-list");out.replaceChildren();if(!DATA.symptoms.length)blank(out,"Aucune observation enregistrée.");else [...DATA.symptoms].sort((a,b)=>String(b.date).localeCompare(String(a.date))).forEach(s=>{const notes=[s.energy!=null?"Énergie "+s.energy+"/10":"",s.fatigue!=null?"Fatigue "+s.fatigue+"/10":"",s.sleep!=null?"Sommeil "+s.sleep+"/10":"",s.notes].filter(Boolean).join(" · ");record(out,s.name,String(s.date).slice(0,10)+" · Intensité "+s.intensity+"/10"+(s.condition?" · "+s.condition:""),notes,"symptoms",s.id);});const select=$("health-condition"),old=select.value;select.replaceChildren();let option=dom("option","Non précisée");option.value="";select.append(option);for(const c of DATA.conditions){option=dom("option",c.name);option.value=c.name;select.append(option);}select.value=old;}
function refreshAutoLockSettings(){
 const control=$("auto-lock-minutes"),status=$("auto-lock-status");if(!control||!status)return;
 const minutes=storedAutoLockMinutes(DATA.settings);
 control.value=String(minutes);
 status.textContent=minutes?"Coffre verrouillé après "+minutes+" minutes sans activité. Vos modifications non enregistrées peuvent être perdues.":"Verrouillage automatique désactivé pour ce coffre. Verrouillez manuellement après usage.";
}
function lockInactiveVault(){
 if(!db)return;
 const minutes=storedAutoLockMinutes(DATA.settings);
 if(!shouldLockForInactivity(lastActivityAt,Date.now(),minutes))return;
 try{
  activeSession.invalidate();feedMonitor?.stop();ambientPlayer.stop();stopBreathingSession();stopSpeaking();try{activeRecognition?.abort();}catch{}
  sessionTurns.length=0;bookText="";pdfDocumentFile=null;
  disconnectMistral();disconnectAgnes();db.close();db=null;
 }finally{location.reload();}
}
function renderGeneralPreference(){
 const input=$("general-preference"),status=$("preference-status");if(!input||!status)return;
 const value=savedGeneralPreference(DATA.settings);input.value=value;
 status.textContent=value?"Préférence enregistrée dans le coffre chiffré. Le partage avec les IA est désactivé par défaut.":"Aucune préférence générale enregistrée.";
}
function updateApiBudgetUI(){
 const x=apiBudgetStatus(),node=$("api-budget-status");
 if(node)node.textContent=x.used+" appel(s) distant(s) autorisé(s) · "+x.remaining+" restant(s). Ces limites ne garantissent pas un plafond financier.";
}
function renderHealthTrends(){
 const chart=$("trend-chart"),summary=$("trend-summary"),values=$("trend-values");
 if(!chart||!summary||!values||!db)return;
 const metric=$("trend-metric").value;
 let trend;try{trend=dailyTrend(DATA.symptoms,{metric,days:Number($("trend-days").value)});}
 catch(err){summary.textContent=String(err.message||err);return;}
 const label=TREND_METRICS.find(x=>x.key===metric)?.label||"Mesure";
 summary.textContent=trendDescription(trend);chart.setAttribute("aria-label",label+" · "+summary.textContent);
 chart.replaceChildren();
 const ns="http://www.w3.org/2000/svg",make=(tag,attrs={})=>{
  const el=document.createElementNS(ns,tag);
  for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));
  return el;
 };
 const svg=make("svg",{viewBox:"0 0 600 185","aria-hidden":"true"});
 const left=45,right=570,top=18,bottom=152,points=trend.points;
 const x=i=>left+i*(right-left)/Math.max(1,points.length-1);
 const y=v=>bottom-v/10*(bottom-top);
 for(const tick of [0,2,4,6,8,10]){
  const v=y(tick);svg.append(make("line",{x1:left,y1:v,x2:right,y2:v,class:"trend-grid"}));
  const t=make("text",{x:30,y:v+4,"text-anchor":"end",class:"trend-tick"});t.textContent=String(tick);svg.append(t);
 }
 for(let i=0;i<points.length;i++){
  const current=points[i];if(current.value===null)continue;
  if(i>0&&points[i-1].value!==null)svg.append(make("line",{x1:x(i-1),y1:y(points[i-1].value),x2:x(i),y2:y(current.value),class:"trend-line"}));
  const dot=make("circle",{cx:x(i),cy:y(current.value),r:4,class:"trend-point"});
  dot.append(make("title"));dot.firstChild.textContent=current.date+" · "+current.value+"/10 · "+current.count+" note(s)";
  svg.append(dot);
 }
 const t1=make("text",{x:left,y:176,class:"trend-tick"});t1.textContent=points[0]?.date||"";
 const t2=make("text",{x:right,y:176,"text-anchor":"end",class:"trend-tick"});t2.textContent=points.at(-1)?.date||"";
 svg.append(t1,t2);chart.append(svg);
 const table=dom("table"),head=dom("thead"),heading=dom("tr"),body=dom("tbody"),caption=dom("caption",label+" · valeurs réellement notées");
 for(const name of ["Date","Moyenne /10","Nombre de notes"]){const th=dom("th",name);th.scope="col";heading.append(th);}
 head.append(heading);
 const measured=points.filter(p=>p.count);
 for(const item of measured){const row=dom("tr");for(const t of [item.date,item.value+"/10",String(item.count)])row.append(dom("td",t));body.append(row);}
 if(!measured.length){const row=dom("tr"),cell=dom("td","Aucune mesure pour cette période.");cell.colSpan=3;row.append(cell);body.append(row);}
 table.append(caption,head,body);values.replaceChildren(table);
}
function renderConditions(){const out=$("conditions-list");out.replaceChildren();if(!DATA.conditions.length)blank(out,"Aucune maladie connue enregistrée.");else DATA.conditions.forEach(c=>record(out,c.name,"Information saisie par vous",c.notes,"conditions",c.id));}
function renderMeds(){
 const out=$("med-list");out.replaceChildren();
 if(!DATA.medications.length)blank(out,"Aucun médicament ou traitement déclaré.");
 else DATA.medications.forEach(m=>{
  let times=[],invalidTimes=false;
  try{times=medicationReminderTimes(m);}catch{invalidTimes=true;}
  record(out,m.name,[m.dose&&"Dose déclarée : "+m.dose,m.schedule&&"Fréquence : "+m.schedule,times.length&&"Rappels déclarés : "+times.join(", "),m.prescriber&&"Prescripteur : "+m.prescriber].filter(Boolean).join(" · "),m.notes,"medications",m.id);
  if(times.length){
   const button=dom("button","Exporter les rappels vers l'agenda (.ics)","mini");
   button.type="button";button.dataset.medicationCalendarId=String(m.id);
   button.setAttribute("aria-label","Exporter des rappels anonymes vers l'agenda système");
   out.lastElementChild?.append(button);
  }
  if(invalidTimes)out.lastElementChild?.append(dom("p","Horaires anciens ou invalides : corrigez cette fiche pour réactiver les rappels.","tiny"));
 });
 renderReminders();
}
function renderAppointments(){const out=$("appts-list");out.replaceChildren();if(!DATA.appointments.length)blank(out,"Aucun rendez-vous enregistré.");else [...DATA.appointments].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).forEach(a=>record(out,a.title,a.date+(a.time?" à "+a.time:"")+(a.place?" · "+a.place:""),a.questions&&"Questions : "+a.questions,"appointments",a.id));}
function renderLibrary(){const out=$("library-list");out.replaceChildren();for(const d of LIBRARY){const c=dom("article");c.append(dom("h3",d.title),dom("p",d.answer),dom("small",d.source+" · "+d.date));const link=dom("a","Voir la source");link.href=d.url;link.target="_blank";link.rel="noopener noreferrer";c.append(link);out.append(c);}}
function bubble(body,role,source,references=[],siteId=""){
 const b=dom("div",undefined,"bubble"+(role==="user"?" user":""));
 b.append(dom("div",role==="user"?"Vous":"FibroBot","bubble-sender"),dom("div",body,"bubble-body"));
 const doc=LIBRARY.find(d=>d.id===source);
 if(doc){const a=dom("a","Source : "+doc.source,"source");a.href=doc.url;a.target="_blank";a.rel="noopener noreferrer";b.append(a);}
 if(role!=="user"&&Array.isArray(references)){
  const links=dom("div",undefined,"online-refs");
  for(const [i,ref] of references.slice(0,6).entries()){
   const safe=safeReferenceUrl(ref?.url);
   if(!safe)continue;
   const a=dom("a",(i+1)+". "+String(ref.provider||"Source publique").slice(0,40)+" — "+String(ref.title||"Référence").slice(0,85));
   a.href=safe;a.target="_blank";a.rel="noopener noreferrer";links.append(a);
  }
  if(links.childNodes.length)b.append(links);
 }
 if(role!=="user"&&siteId){
  const site=knownSite(siteId);
  if(site){const link=dom("a","Ouvrir "+site.label+" dans le navigateur","approved-site-link");link.href=site.url;link.target="_blank";link.rel="noopener noreferrer";b.append(link);}
 }
 if(role!=="user"){
  const tools=dom("div",undefined,"bubble-tools");
  const copy=dom("button","Copier la réponse");copy.type="button";copy.dataset.chatCopy="1";copy.setAttribute("aria-label","Copier cette réponse de FibroBot");
  const read=dom("button","Écouter");read.type="button";read.dataset.chatRead="1";read.setAttribute("aria-label","Lire cette réponse avec la voix locale");
  tools.append(copy,read);b.append(tools);
 }
 return b;
}
function refreshAgnesVaultControls(){
 const entry=DATA.settings.find(x=>x?.id===AGNES_CREDENTIAL_ID);
 const saved=Boolean(entry&&validStoredAgnesCredential(entry.value));
 if($("agnes-forget"))$("agnes-forget").disabled=!saved;
 return saved;
}
async function restoreAgnesAfterUnlock(){
 if(!db||!refreshAgnesVaultControls())return;
 try{
  connectAgnes(await loadAgnesCredential(db));
  $("agnes-test").disabled=false;$("agnes-disconnect").disabled=false;
  $("agnes-status").textContent="Agnes chargé depuis le coffre chiffré. Connexion à tester si nécessaire.";
 }catch{
  disconnectAgnes();$("agnes-status").textContent="Clé Agnes sauvegardée mais illisible : veuillez la remplacer.";
 }
 updateEngineNote();
}
function refreshMistralVaultControls(){
 const entry=DATA.settings.find(x=>x?.id===CREDENTIAL_ID);
 const saved=Boolean(entry&&validStoredMistralCredential(entry.value));
 $("mistral-restore").disabled=!saved;
 $("mistral-forget").disabled=!entry;
 if(saved&&!mistralStatus().connected)
  $("mistral-status").textContent="Une clé Mistral est conservée chiffrée dans ton coffre. Cliquez sur « Activer la clé de mon coffre » pour l'utiliser dans cette session.";
 return saved;
}
function enableMistralSession(){
 $("mistral-use").disabled=false;$("mistral-use").checked=false;
 $("mistral-test").disabled=false;$("mistral-disconnect").disabled=false;
 updateEngineNote();
}
function disableMistralSession(){
 disconnectMistral();
 $("mistral-key").value="";
 $("mistral-use").checked=false;$("mistral-use").disabled=true;
 $("mistral-test").disabled=true;$("mistral-disconnect").disabled=true;
 updateEngineNote();
}
function setEngineNote(message){
 const node=$("chat-engine-state");if(node)node.textContent=message;
}
function updateEngineNote(){
 const ag=agnesStatus(),mi=mistralStatus();
 if(document.body.classList.contains("v30-simple")&&!document.body.classList.contains("v30-advanced")){
  setEngineNote(ag.connected?"Agnes AI activé. Questions générales et fiches médicales publiques autorisées, avec consentement.":"Entrez votre clé Agnes AI pour activer les réponses conversationnelles. Les fiches médicales FibroBot restent disponibles.");
  updateApiBudgetUI();
  const badge=$("assistant-mode-badge");
  if(badge)badge.textContent=ag.connected?"Agnes AI · FibroBot":"Agnes à connecter";
  const auto=$("auto-brain-status");if(auto)auto.textContent=ag.connected?"Agnes connecté : prêt pour les questions admissibles.":"Agnes non connecté.";
  return;
 }
 setEngineNote("Conversation IA : Agnes "+(ag.connected?(ag.authorizationBlocked?"clé à vérifier":ag.cooldownSeconds?"en pause":"connecté"):"non connecté")+
 " · Mistral "+(mi.connected?(mi.authorizationBlocked?"clé à vérifier":mi.cooldownSeconds?"en pause":"connecté"):"non connecté")+
 " · Envoi seulement après votre accord.");
 updateApiBudgetUI();
 const badge=$("assistant-mode-badge");
 if(badge)badge.textContent=ag.connected?"Agnes AI · FibroBot":networkEnabled?"Recherche sur accord":"Agnes à connecter";
 const auto=$("auto-brain-status");
 if(auto){
  const ag=agnesStatus(),mi=mistralStatus();
  auto.textContent=$("auto-mode")?.checked?
   "IA conversationnelle · Agnes "+(ag.connected?(ag.authorizationBlocked?"clé à remplacer":ag.cooldownSeconds>0?"en pause":"connecté"):"à connecter")+" · Mistral "+(mi.connected?(mi.authorizationBlocked?"clé à remplacer":mi.cooldownSeconds>0?"en pause":"connecté"):"à connecter"):
   "IA désactivée : les informations sourcées et la sécurité restent disponibles.";
 }
}
function renderSpecialists(){
 const out=$("specialist-list");if(!out)return;
 out.replaceChildren();
 for(const agent of SPECIALISTS){
  const b=dom("button",undefined,"specialist-choice");
  b.type="button";b.dataset.specialist=agent.id;
  b.append(dom("strong",agent.name),dom("small",agent.role));
  out.append(b);
 }
}
function renderChat(){
 const out=$("messages");out.replaceChildren();
 const entries=DATA.conversations.filter(m=>(m.agentId||"general")===activeAgentId).slice(-100);
 if(!entries.length)out.append(bubble(activeAgentId==="general"?"Bonjour. Connectez Agnes pour discuter. Pour une réponse actuelle, activez les sources publiques dans le panneau Flux.":"Vous êtes dans l'espace "+(EXPERT_PANEL.find(a=>a.id===activeAgentId)?.name||"spécialisé")+". Les réponses médicales reposent sur les fiches et règles de sécurité, jamais sur une simulation d'expert.","bot"));
 else entries.forEach(m=>out.append(bubble(m.body,m.role,m.sourceId,m.references,m.siteId)));
 out.scrollTop=out.scrollHeight;
}
function localVoice(){return "speechSynthesis" in window?preferredLocalVoice(speechSynthesis):null;}
function syncVoiceControls(){
 const global=$("voice-toggle"),local=$("chat-voice-toggle");
 if(global){global.textContent="Voix : "+(voice?"activée":"off");global.setAttribute("aria-pressed",String(voice));}
 if(local){local.textContent=voice?"Voix activée":"Voix désactivée";local.setAttribute("aria-pressed",String(voice));local.setAttribute("aria-label",voice?"Désactiver la lecture vocale locale":"Activer la lecture vocale locale");}
}
function refreshComposer(){
 const count=$("prompt-count"),field=$("prompt");
 if(count&&field)count.textContent=field.value.length+" / "+field.maxLength;
}
function updateVoiceState(message,active=false){const node=$("voice-live-state");if(node)node.textContent=message;document.body.dataset.voiceState=active?"speaking":"idle";}
function clearBookSleepTimer(){if(bookSleepTimeout!==null){clearTimeout(bookSleepTimeout);bookSleepTimeout=null;}}
function startBookSleepTimer(){
 clearBookSleepTimer();
 const minutes=validSleepMinutes($("v29-book-sleep")?.value??0);
 if(minutes)bookSleepTimeout=setTimeout(()=>{stopSpeaking();notify("Minuterie : lecture arrêtée après "+minutes+" minutes.");},minutes*60000);
}
function stopSpeaking(){
 clearBookSleepTimer();
 speechToken++;
 if("speechSynthesis" in window)try{speechSynthesis.cancel();}catch{}
 updateVoiceState("Lecture arrêtée.");
}
function speak(message,{requested=false,onComplete=null}={}){
 if(!voice&&!requested)return false;
 const selected=localVoice();
 if(!selected){notify("Aucune voix française garantie locale sur cet appareil. La lecture audio n'est pas disponible.");voice=false;syncVoiceControls();return false;}
 const chunks=splitSpeech(String(message||"").slice(0,14000));
 if(!chunks.length)return false;
 voice=true;syncVoiceControls();stopSpeaking();const token=speechToken;let index=0;
 const next=()=>{
  if(token!==speechToken)return;
  if(index>=chunks.length){clearBookSleepTimer();updateVoiceState("Lecture terminée.");if(typeof onComplete==="function")onComplete();return;}
  const utterance=new SpeechSynthesisUtterance(chunks[index++]);
  utterance.lang="fr-FR";utterance.voice=selected;utterance.rate=Number($("chat-voice-speed")?.value)||1;
  utterance.onstart=()=>{if(token===speechToken)updateVoiceState("FibroBot parle : segment "+index+" sur "+chunks.length+".",true);};
  utterance.onend=next;
  utterance.onerror=e=>{if(token===speechToken){updateVoiceState("Lecture interrompue.");notify(speechErrorMessage(e));}};
  try{speechSynthesis.speak(utterance);}catch{notify("Lecture vocale indisponible.");}
 };
 next();return true;
}
function installGuidance(){
 const node=$("install-status");if(!node)return;
 const installed=window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone===true;
 if(installed){node.textContent="FibroBot est déjà lancé comme application installée.";return;}
 if(pendingInstall){node.textContent="Installation disponible sur cet appareil : utilisez le bouton Installer FibroBot.";return;}
 node.textContent=/iPad|iPhone|iPod/i.test(navigator.userAgent)?"Sur iPhone/iPad : dans Safari, touchez Partager puis « Sur l'écran d'accueil ».":"Sur Android : utilisez le menu du navigateur, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».";
}
async function requestPWAInstallation(){
 const status=$("install-status");
 if(window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone===true){installGuidance();return;}
 if(!pendingInstall){installGuidance();return;}
 const event=pendingInstall;pendingInstall=null;
 try{
  await event.prompt();
  const decision=await event.userChoice;
  status.textContent=decision?.outcome==="accepted"?"Installation acceptée par le navigateur.":"Installation refusée ou annulée. Vous pouvez utiliser le menu du navigateur.";
 }catch{installGuidance();}
}
function updateConnectionState(){
 const node=$("connection-state");if(!node)return;
 const online=navigator.onLine!==false;
 node.textContent=online?"Connexion disponible":"Hors ligne · coffre, suivi et bibliothèque accessibles";
 node.setAttribute("data-online",String(online));
}
function updateDictationButton(){
 const b=$("mic");if(!b)return;
 b.disabled=dictationStarting;b.setAttribute("aria-pressed",String(Boolean(activeRecognition)));
 b.textContent=activeRecognition?"Arrêter la dictée":dictationStarting?"Initialisation…":"🎙 Dicter";
}
async function handleDictation(){
 if(activeRecognition){
  try{activeRecognition.abort();}catch{}
  activeRecognition=null;updateDictationButton();return;
 }
 if(dictationStarting)return;
 if(!db){notify("Déverrouillez le coffre avant de dicter.");return;}
 const browserService=Boolean($("dictation-browser-service")?.checked);
 if(browserService&&!confirm("La reconnaissance vocale du navigateur peut envoyer votre voix aux serveurs de son fournisseur. Ne dictez pas de données de santé ou d'informations privées. Démarrer cette dictée externe ?"))return;
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  stopSpeaking();updateVoiceState("Microphone en cours d'écoute.");
 dictationStarting=true;updateDictationButton();
 try{
  activeRecognition=await startDictation({
   Speech,allowBrowserService:browserService,
   onText:transcript=>{
    if(!db)return;
    const field=$("prompt");
    field.value=((field.value.trim()?field.value.trim()+" ":"")+transcript).slice(0,field.maxLength);
    refreshComposer();field.focus();
    if($("dictation-send-confirm")?.checked&&!busyChat&&confirm("Envoyer ce texte à FibroBot ?\n\n« "+field.value.trim()+" »\n\nTout envoi vers une IA distante demandera un second accord séparé.")){const verified=field.value.trim();field.value="";refreshComposer();void ask(verified);}else notify("Dictée terminée. Vérifiez le texte avant de l'envoyer.");
   },
   onError:code=>notify("Dictée interrompue ("+code+"). Vérifiez les autorisations du micro."),
   onEnd:()=>{activeRecognition=null;updateDictationButton();updateVoiceState("Microphone arrêté.");}
  });
  notify(browserService?"Dictée du navigateur activée : l'audio peut être traité à distance.":"Dictée locale activée.");
 }catch(e){activeRecognition=null;updateVoiceState("Dictée indisponible.");notify(String(e?.message||e).slice(0,220));}
 finally{dictationStarting=false;updateDictationButton();}
}
function refreshBook(){
 const page=$("book-page"),status=$("book-state"),prev=$("book-prev"),next=$("book-next"),read=$("book-read");
 if(!bookText){page.textContent="";status.textContent="Aucun livre ouvert.";prev.disabled=next.disabled=read.disabled=true;return;}
 const view=readerPage(bookText,bookIndex);bookIndex=view.page;
 page.textContent=view.text;status.textContent="Page "+(bookIndex+1)+" sur "+view.count+" · lecture privée sur cet appareil.";
 prev.disabled=bookIndex===0;next.disabled=bookIndex>=view.count-1;read.disabled=false;
}

async function ask(q){
 const input=text(q,2000);if(!input||busyChat)return;
 if(!db){
  setEngineNote("Le coffre est verrouillé ou indisponible : déverrouillez-le pour discuter. La question est conservée dans le champ.");
  notify("Déverrouillez le coffre avant de poser une question.");
  return;
 }
 busyChat=true;const sessionTicket=activeSession.start(),requestAgentId=activeAgentId;
 // Le patient voit immédiatement que sa question a été prise en compte.
 // Cette prévisualisation est remplacée par l'historique dès la réponse reçue.
 const out=$("messages");
 out.append(bubble(input,"user"));
 const pending=dom("div","FibroBot prépare sa réponse…","bubble reply-pending");
 pending.setAttribute("role","status");
 out.append(pending);out.scrollTop=out.scrollHeight;
 const button=$("chat-form").querySelector('button[type="submit"]'),prompt=$("prompt");
 button.disabled=true;prompt.disabled=true;
 setEngineNote("Traitement de la question…");
 try{
  const intent=classifyIntent(input),response=reply(input,LIBRARY,{...DATA,energy});
  let answer=response.message+(response.followup?"\n\n"+response.followup:""),sourceId=response.sources?.[0]?.id||"";
  let engine="FibroBot · documentation médicale et sources publiques",references=[],onlineAttempted=false,mistralAttempted=false,mistralProblem="";
  // Les actions locales et l'écoute passent après les règles d'urgence du moteur médical.
  let siteId="",direct=false,companionMode="",navigationTarget="";
  if(response.kind!=="urgent"){
   const site=parseSiteCommand(input),navigation=parseLocalNavigation(input);
   if(navigation&&response.kind!=="refusal"){
    navigationTarget=navigation.tab;answer="J'ouvre "+navigation.label+" dans FibroBot. Les informations restent sur cet appareil.";engine="Navigation locale";direct=true;
   }else if(site){
    siteId=site.siteId;answer="Je peux ouvrir "+site.label+" pour vous. Touchez le lien « Ouvrir "+site.label+" » dans ma réponse pour confirmer l'ouverture dans votre navigateur. Je ne peux pas piloter votre téléphone, vous connecter ou agir dans ce site à votre place.";
    engine="Raccourci navigateur approuvé";direct=true;
   }else if(parseStoryCommand(input)&&!(($("auto-mode").checked&&(agnesStatus().connected||mistralStatus().connected))||($("mistral-use").checked&&mistralStatus().connected))){
    const story=originalStory(input);answer=story.text;engine="Histoire originale écrite localement";direct=true;
   }else if(parseReadingCommand(input)){
    $("book-panel").open=true;answer="Avec plaisir. Ouvrez le panneau « Ma bibliothèque de lecture locale » ci-dessous puis choisissez un fichier .txt ou .md que vous avez le droit de lire. Je peux afficher ses pages et les lire avec une voix française locale disponible. Le fichier ne quitte pas votre appareil.";engine="Lecteur de textes privé";direct=true;
   }else{
    const companion=companionReply(input,{requested:$("companion-mode").value,safety:response,history:DATA.conversations});
    if(companion&&!(classifyIntent(input)==="general"&&$("auto-mode").checked&&(agnesStatus().connected||mistralStatus().connected))){answer=companion.message;engine=companion.label+" (soutien, non médical)";companionMode=companion.mode;direct=true;}
   }
  }
  // Agents déterministes : aucune donnée du dossier ne part vers Agnes.
  if(!direct&&requestAgentId!=="general"&&!liveIntent(input)&&response.kind!=="urgent"){
   const selected=EXPERT_PANEL.find(a=>a.id===requestAgentId);
   if(selected){
    const result=runSpecialist(selected.specialist,{...DATA,energy},input);
    answer=result.answer;sourceId=result.sourceId;engine="Espace "+selected.name+" · fiche médicale et sécurité";direct=true;
   }
  }
  // Services publics actualisés, jamais une météo devinée par le modèle.
  if(!direct&&intent==="general"&&response.kind!=="urgent"){
   const kind=liveIntent(input);
   if(kind){
    direct=true;
    const city=(explicitWeatherCity(input)||$("v31-city")?.value.trim()||"").slice(0,75);
    const permitted=$("v31-live-consent")?.checked||
      confirm("Consulter les données publiques actuelles ?\n\nSeule la ville « "+city+" » sera envoyée à Open-Meteo, ou la requête de calendrier à Nager.Date. Aucun dossier médical n'est transmis. Autoriser pour cette session ?");
    if(!permitted){
     answer="Sources Internet non autorisées. Activez les sources publiques dans le panneau « Flux en direct » pour les prévisions actualisées.";
     engine="Sources publiques : consentement nécessaire";
    }else{
     $("v31-live-consent").checked=true;
     try{
      setEngineNote("Consultation des données publiques actualisées…");
      const found=kind==="weather"?await publicWeather(city,{question:input}):
         kind==="air"?await publicAirQuality(city):await publicFrenchHolidays(input);
      answer=found.answer;references=found.references;sourceId="";
      engine="Source publique datée · "+kind;
      if(agnesStatus().connected&&$("v31-agnes-grounded")?.checked&&$("auto-mode").checked){
       try{
        const phrased=await generateAgnesGroundedPublic(input,found.answer,{model:$("agnes-model").value});
        answer=phrased.text+"\n\nDonnées originales de la source :\n"+found.answer;
        engine="Agnes AI + "+kind+" · données publiques";
       }catch{notify("Agnes indisponible : les chiffres de la source sont conservés.");}
      }
     }catch(err){
      answer="Le service public n'a pas livré de données vérifiables. Vérifiez Internet et le nom de ville. Détail : "+String(err?.message||"Indisponible").slice(0,140);
      engine="Service public indisponible";
     }
    }
   }
  }
  if(!direct){
  const autoEligible=$("auto-mode").checked&&autoGeneralAllowed(input,intent,response);
  let autoAnswered=false,sourceFirstAnswered=false;
  // Consentement au réseau valable pour cette session, puis validation de chaque
  // question exacte. Pas de synchronisation du coffre ni de recherche médicale libre.
  // When active, Mistral answers general questions first. Source search
  // remains available when it is disabled or temporarily rate-limited.
  // Source-first path: explicit consent for the exact public question.
  if(autoEligible&&networkEnabled&&$("sources-first")?.checked&&shouldPreferSources(input,intent,response)&&isOnlineEligible(input)){
   const providers=selectPublicProviders(input).map(id=>PUBLIC_PROVIDERS.find(p=>p.id===id)?.name).filter(Boolean).join(" et ");
   if(confirm("Chercher des sources publiques sur "+providers+" avant de consulter une IA ?\n\nQuestion :\n« "+input+" »\n\nAucune note médicale ni donnée du coffre n'est transmise.")){
    setEngineNote("Recherche de références publiques en cours…");
    try{
     const found=await searchPublicQuestion(input);
     const citations=found.results.map(r=>({provider:r.provider,title:r.title,url:r.url,date:r.date}));
     if(citations.length){
      answer=formatPublicAnswer(found);references=citations;sourceId="";
      engine="Recherche publique sourcée";sourceFirstAnswered=true;onlineAttempted=true;
     }
    }catch(err){setEngineNote("Recherche publique indisponible : essai du modèle conversationnel.");}
   }
  }
  if(!autoEligible&&intent==="general"&&networkEnabled&&isOnlineEligible(input)&&["refusal","followup"].includes(response.kind)&&
   (!($("mistral-use").checked&&mistralStatus().connected)||mistralStatus().cooldownSeconds>0)){
   const servers=selectPublicProviders(input).map(id=>PUBLIC_PROVIDERS.find(p=>p.id===id)?.name).filter(Boolean).join(" et ");
   if(confirm("Recherche Internet facultative sur "+servers+" ?\n\nQuestion envoyée telle quelle aux services publics :\n« "+input+" »\n\nNe poursuivez pas si votre question contient une information personnelle ou médicale.")){
    onlineAttempted=true;setEngineNote("Recherche en cours sur les sources publiques…");
    try{
     const responseOnline=await searchPublicQuestion(input);
     answer=formatPublicAnswer(responseOnline);
     references=responseOnline.results.map(r=>({provider:r.provider,title:r.title,url:r.url,date:r.date}));
     sourceId="";engine=references.length?"Sources Internet publiques vérifiables":"Recherche en ligne sans résultat";
    }catch(error){
     onlineAttempted=false;
     notify("Recherche Internet indisponible : "+String(error.message).slice(0,110)+". L'assistant local reste disponible.");
    }
   }
  }
  if(response.kind==="urgent"){
   engine="Sécurité médicale : réponse encadrée";
  }else if(intent==="planning"&&response.kind!=="refusal"){
   answer=planDaily({...DATA,energy});engine="Agent activités et énergie";
   }else if(intent==="summary"&&response.kind!=="refusal"){
   answer=summarizeObservations(DATA);engine="Agent journal et observations";
  }else if(intent==="visit"&&response.kind!=="refusal"){
   answer=prepareVisit(DATA);engine="Agent coordination des soins";
  }else if(intent==="research"){
   answer="Ouvrez Bibliothèque pour rechercher des publications sur un thème prédéfini avec votre accord. Aucune donnée personnelle n'est envoyée.";engine="Agent documentaire";
  }else if(intent==="medical"&&response.kind==="refusal"){
   // Le refus de diagnostic/prescription reste intact. Les liens vers des
   // index publics ne constituent pas des réponses ni des avis cliniques.
   const evidence=retrieveMedicalEvidence(input);
   if(evidence.catalog?.length&&!/(dose|dosage|posolog|interaction|prescri|quel medicament|puis.je prendre|peux.je prendre)/i.test(input)){
    references=evidence.catalog.filter(x=>approvedMedicalURL(x.url)).map(x=>({provider:x.publisher,title:x.label,url:x.url}));
    answer+="\n\nVous pouvez consulter les ressources institutionnelles proposées ci-dessous, sans en déduire un diagnostic.";
   }
   engine="Sécurité médicale : refus ou orientation documentaire";
  }else if(intent==="medical"&&response.kind==="documented"){
   // Conserver la fiche médicale approuvée et enrichir uniquement ses références.
   // Ne jamais remplacer un texte sourcé par une réponse libre du LLM.
   const grounded=documentedAnswer(input);
   if(grounded.kind==="documented"){
    answer=response.message+(response.followup?"\n\n"+response.followup:"");
    references=grounded.references;engine="Fiches médicales sourcées (sans diagnostic)";
   }
  }else if(intent==="medical"&&response.kind!=="profile"&&response.kind!=="refusal"&&response.kind!=="urgent"&&response.kind!=="life"){
   const id=routeSpecialist(input);
   if(id){const specialist=runSpecialist(id,{...DATA,energy},input);answer=specialist.answer;sourceId=specialist.sourceId;engine="Agent "+specialist.name;}
  }
  const publicMedicalRoute=mistralRoute(input,intent,response);
  if(intent==="medical"&&response.kind==="documented"&&publicMedicalRoute?.mode==="medical-reference"&&
     $("auto-mode").checked&&agnesStatus().connected){
   const permitted=$("agnes-public-fiches")?.checked||
    confirm("Agnes AI peut expliquer la fiche médicale publique « "+publicMedicalRoute.preview+" ».\n\nAucune question personnelle, symptôme ou traitement du coffre ne sera transmis. Cet appel peut être facturé. Autoriser pour cette session ?");
   if(permitted){
    $("agnes-public-fiches").checked=true;
    try{
     const result=await generateAgnesPublicFiche(publicMedicalRoute.topic,{model:$("agnes-model").value});
     const fiche=LIBRARY.find(d=>d.id===publicMedicalRoute.topic);
     answer="Agnes AI — explication pédagogique de la fiche publique :\n"+result.text+"\n\nSource officielle : "+fiche.source+"\n"+fiche.answer+
      "\n\nInformation générale, sans diagnostic ni prescription.";
     sourceId=fiche.id;references=[{provider:fiche.source,title:fiche.title,url:fiche.url}];
     engine="Agnes AI · spécialité fibromyalgie et documentation médicale";
    }catch{
     setEngineNote("Agnes indisponible pour cette fiche : réponse médicale sourcée préservée.");
     notify("La fiche médicale fiable reste accessible sans Agnes.");
    }
   }
  }
  const route=mistralRoute(input,intent,response);
  if(route&&!autoEligible&&!onlineAttempted&&$("mistral-use").checked&&mistralStatus().connected){
   const state=mistralStatus();
   if(state.cooldownSeconds>0){
    mistralProblem="Mistral temporairement limité (429), réponse locale conservée.";
    $("mistral-status").textContent="Mistral en pause (quota). Vous pouvez utiliser Agnes ou réessayer plus tard.";
   }else{
    const description=mistralConsentDescription(route);
    const permission=confirm("Activer Mistral AI pour cette réponse ?\n\n"+description+"\n\nCet appel peut être facturé. Mistral ne recevra pas les notes ou le dossier patient.");
    if(permission){
     setEngineNote("Mistral AI : "+route.label.toLowerCase()+" en cours…");
     try{
      const options={model:$("mistral-model").value};
      if(route.mode==="general"){
       const result=await generateMistralChat(input,[],options);
       answer=result.text+"\n\n[Réponse de Mistral AI, sans vérification des faits.]";
       sourceId="";references=[];engine="Mistral AI : "+result.model;
      }else if(route.mode==="medical-reference"){
       const result=await generateMistralMedicalExplanation(route.topic,options);
       const source=LIBRARY.find(x=>x.id===route.topic);
       answer="Mistral explique une fiche médicale publique :\n"+result.text+
        "\n\nFiche de référence (« "+source.source+" ») :\n"+source.answer+
        "\n\nCette explication ne constitue pas un diagnostic, une prescription ou une conduite à tenir personnalisée.";
       sourceId=route.topic;engine="Mistral pédagogique + fiche institutionnelle";
      }else if(route.mode==="planning"){
       const result=await generateMistralPlanningAdvice(options);
       answer=planDaily({...DATA,energy})+"\n\nConseils généraux formulés par Mistral :\n"+result.text;
       engine="Mistral + agent local d'organisation";
      }
      mistralAttempted=true;
     }catch(error){
      mistralProblem="Mistral indisponible : "+String(error.message||error).slice(0,200);
      $("mistral-status").textContent=mistralStatus().cooldownSeconds>0?"Mistral en pause (quota). Vous pouvez utiliser Agnes ou réessayer plus tard.":"Mistral indisponible. Vous pouvez utiliser Agnes ou consulter les sources documentaires.";
      notify("Mistral indisponible. FibroBot continue en local.");
      setEngineNote("Mistral indisponible : réponse locale disponible");
      if(mistralStatus().cooldownSeconds>0){
       $("mistral-use").checked=false;updateEngineNote();
      }
     }
    }
   }
  }
  if(autoEligible&&!sourceFirstAnswered){
   const agnes=agnesStatus(),mistral=mistralStatus();
   const candidate=await answerWithAuto({
    question:input,intent,response,
    state:{agnesConnected:agnes.connected,agnesCooldown:agnes.cooldownSeconds,agnesBlocked:agnes.authorizationBlocked,
     mistralConnected:false,mistralCooldown:mistral.cooldownSeconds,mistralBlocked:true},
    agnes:async q=>generateAgnesChat(q,{model:$("agnes-model").value,history:preferenceHistory(savedGeneralPreference(DATA.settings),$("chat-memory-optin").checked?sessionTurns:[],$("preference-share").checked)}),
    mistral:async q=>generateMistralChat(q,preferenceHistory(savedGeneralPreference(DATA.settings),$("chat-memory-optin").checked?sessionTurns:[],$("preference-share").checked),{model:$("mistral-model").value}),
    authorize:(provider,q)=>{
     if(apiBudgetStatus().remaining===0){notify("Plafond volontaire d’appels IA de cette session atteint.");return false;}
     const history=preferenceHistory(savedGeneralPreference(DATA.settings),$("chat-memory-optin").checked?sessionTurns:[],$("preference-share").checked);
     const shared=sessionPreview(q,history,history.length>0);
     if(provider==="agnes"&&$("agnes-session-consent")?.checked)return true;
     const accepted=confirm("Envoyer à "+(provider==="agnes"?"Agnes AI":"Mistral AI")+" ?\n\nQuestion : « "+q+" »"+
      (shared?"\n\nContexte de conversation également transmis :\n"+shared:"\n\nAucun historique envoyé.")+
      "\n\nAucune donnée du dossier médical n'est transmise. Cet appel peut être facturé.");
     if(accepted&&provider==="agnes")$("agnes-session-consent").checked=true;
     return accepted;
    },
    onAttempt:provider=>setEngineNote("IA : génération "+(provider==="agnes"?"Agnes AI":"Mistral AI")+" après votre accord…")
   });
   if(candidate.provider){
    answer=candidate.text;sourceId="";references=[];autoAnswered=true;
    engine="IA · "+(candidate.provider==="agnes"?"Agnes AI":"Mistral AI")+" : "+candidate.model;
    if(candidate.provider==="agnes")$("agnes-status").textContent="Agnes disponible · réponse fournie par ce moteur.";
    if(candidate.provider==="mistral")$("mistral-status").textContent="Mistral disponible · réponse fournie par ce moteur.";
   }else if(candidate.errors.length){
    setEngineNote("Auto : "+candidate.errors.map(x=>x.provider+" ("+x.category+")").join(", ")+". Aucun diagnostic de santé n'est généré par le fournisseur.");
   }
   updateEngineNote();
  }
  if(intent==="general"&&!autoAnswered&&!sourceFirstAnswered&&!onlineAttempted&&!mistralAttempted&&response.kind==="refusal"){
   answer="Agnes AI n'a pas pu répondre. Vérifiez votre clé et le bouton « Tester Agnes » ; votre connexion et le quota doivent être disponibles. Les fiches sur la fibromyalgie restent accessibles. Je préfère ne pas inventer de réponse.";
   engine="Assistant documentaire de secours";
  }
  if(mistralProblem&&!mistralAttempted){setEngineNote("Mistral en pause. FibroBot répond localement.");}
  }
  if(!activeSession.current(sessionTicket)||!db)return;
   const purpose=companionMode?"companion-local":intent==="general"?"general-local":intent;
  if($("chat-memory-optin").checked&&engine.startsWith("IA ·")&&intent==="general"){
   appendSessionTurn(sessionTurns,input,answer);
   $("chat-memory-state").textContent="Mémoire de cette session : "+Math.floor(sessionTurns.length/2)+" échange(s) généraux filtrés.";
  }
  const userRecord={role:"user",body:input,time:Date.now(),purpose,agentId:requestAgentId};
  const b={role:"bot",body:answer,time:Date.now(),sourceId,references,purpose,siteId,companionMode,agentId:requestAgentId};
  // L'écran ne dépend jamais de la réussite d'une requête réseau ou d'IndexedDB.
  DATA.conversations.push(userRecord,b);
  pending.remove();
  renderChat();tab(navigationTarget||"chat");speak(answer);lastSpeech=answer;
  let saved=true;
  try{
   await put(db,"conversations",userRecord);
   await put(db,"conversations",b);
  }catch(storageError){
   saved=false;
   notify("Réponse affichée, mais l'enregistrement dans le coffre a échoué. Vérifiez le stockage du navigateur.");
   setEngineNote("Réponse affichée · historique non enregistré : stockage indisponible.");
  }
  if(saved&&engine!=="Assistant documentaire (repli : IA en échec)")setEngineNote("Dernière réponse : "+engine+".");
  if(response.kind==="urgent")notify("Une situation potentiellement urgente a été évoquée.");
 }catch(e){
  if(!activeSession.current(sessionTicket)||!db)return;
  console.error("FibroBot : traitement impossible",String(e?.message||e).slice(0,160));
  const message="Je n'ai pas réussi à terminer cette réponse. Vos fiches médicales et le coffre restent disponibles. Vérifiez la connexion Agnes et les sources publiques.";
  if(pending.isConnected)pending.textContent=message;
  else $("messages").append(bubble(message,"bot"));
  setEngineNote("Erreur récupérable : "+String(e?.message||e).slice(0,145));
  notify("Réponse de secours affichée ; le moteur reste utilisable.");
 }finally{
  if(pending.isConnected&&pending.textContent==="FibroBot prépare sa réponse…")pending.remove();
  busyChat=false;button.disabled=false;prompt.disabled=false;updateApiBudgetUI();
 }
}
function showLocalAnswer(answer){
 if(!db)return;
 lastSpeech=answer;
 // Ces cartes ne font pas l'objet d'une nouvelle collecte clinique ; rendu textContent uniquement.
 const out=$("messages");out.append(bubble(answer,"bot"));out.scrollTop=out.scrollHeight;
 tab("chat");speak(answer);
}
function notifyForegroundMedicationReminders(due){
 if(!db||document.visibilityState!=="visible"||!optInForegroundReminders(DATA.settings))return;
 for(const reminder of eligibleForegroundReminders(due,medAlertSeen,new Date(),10)){
  medAlertSeen.add(reminder.key);
  notify("Rappel personnel : consultez vos horaires déclarés dans FibroBot.");
  if("Notification" in window&&Notification.permission==="granted"){
   try{new Notification(reminder.title,{body:reminder.body,tag:"fibrobot-personal-reminder"});}catch{/* No native guarantees. */}
  }
 }
}
function renderReminders(){const out=$("due-reminders");out.replaceChildren();const due=dueReminders(DATA.medications,DATA.medicationLogs);notifyForegroundMedicationReminders(due);if(!due.length){blank(out,"Aucune prise à confirmer maintenant.");return;}for(const x of due){const row=dom("div",undefined,"record"),left=dom("div"),buttons=dom("div",undefined,"actions");left.append(dom("strong",x.name),dom("small","Heure prévue : "+x.time+" (déclarée)"));for(const [label,status] of [["Pris","taken"],["Ignoré","skipped"]]){const button=action(label,"reminder",status,x.medicationId);button.dataset.scheduledTime=x.time;buttons.append(button);}row.append(left,buttons);out.append(row);if(!seen.has(x.key)){seen.add(x.key);notify("Un rappel de traitement est à vérifier dans FibroBot.");if("Notification" in window&&Notification.permission==="granted"&&document.visibilityState==="visible"){try{new Notification("FibroBot • rappel",{body:"Consultez votre prise planifiée dans FibroBot.",tag:"fibrobot-"+x.key});}catch(e){/* Indisponible sur certaines PWA */}}}}}
function renderUpcomingAppointments(){
 const out=$("upcoming-appointments");if(!out||!db)return;
 const upcoming=upcomingAppointments(DATA.appointments,new Date(),7);
 out.replaceChildren();
 if(!upcoming.length){blank(out,"Aucun rendez-vous déclaré pour les 7 prochains jours.");return;}
 for(const appointment of upcoming){
  const row=dom("div",undefined,"record"),details=dom("div");
  details.append(dom("strong",appointment.title),dom("small",appointment.inDays===0?"Aujourd'hui":appointment.inDays===1?"Demain":"Dans "+appointment.inDays+" jours"));
  details.append(dom("small",appointment.date+(appointment.time?" · "+appointment.time:" · heure non renseignée")));
  const calendarButton=dom("button","Agenda (.ics)","btn light");calendarButton.type="button";calendarButton.dataset.calendarId=String(appointment.id);calendarButton.setAttribute("aria-label","Exporter ce rendez-vous dans le calendrier");
  row.append(details,calendarButton);out.append(row);
 }
 for(const key of new Set(appointmentAlertKeys(DATA.appointments,new Date()))){
  if(seen.has(key))continue;
  seen.add(key);
  notify("Un rendez-vous approche : consultez l'accueil FibroBot.");
  if("Notification" in window&&Notification.permission==="granted"&&document.visibilityState==="visible"){
   try{new Notification("FibroBot · rendez-vous",{body:"Un rendez-vous déclaré approche. Ouvrez votre espace personnel.",tag:"fibrobot-"+key});}catch{/* Fonctionnalité dépend du navigateur mobile. */}
  }
 }
}
async function write(store,entity,form){const id=Number(form.dataset.edit||0);if(id){const old=DATA[store].find(x=>x.id===id);if(!old)throw Error("Enregistrement introuvable.");entity={...old,...entity,id};}await put(db,store,entity);form.reset();form.dataset.edit="";$("health-date").value=today();$("appt-date").value=today();await reload();notify(id?"Modifications conservées.":"Information enregistrée sur cet appareil.");}
function edit(store,id){const x=DATA[store].find(x=>x.id===id);if(!x)return;tab(store==="symptoms"?"health":store==="medications"?"medications":store);const f=$(FORMS[store]);f.dataset.edit=id;const values=store==="tasks"?{"task-name":x.title,"task-effort":x.effort,"task-priority":x.priority,"task-due":x.due||""}:store==="symptoms"?{"health-name":x.name,"health-date":String(x.date).slice(0,10),"health-condition":x.condition||"","pain":x.intensity,"health-energy":x.energy??"","fatigue":x.fatigue??"","sleep":x.sleep??"","health-notes":x.notes||""}:store==="conditions"?{"condition-name":x.name,"condition-notes":x.notes||""}:store==="medications"?{"med-name":x.name,"med-dose":x.dose||"","med-schedule":x.schedule||"","med-prescriber":x.prescriber||"","med-reminder-time":x.reminderTimes||x.reminderTime||"","med-notes":x.notes||""}:{"appt-name":x.title,"appt-date":x.date,"appt-time":x.time||"","appt-place":x.place||"","appt-questions":x.questions||""};for(const [id,value] of Object.entries(values))$(id).value=value;f.scrollIntoView({behavior:"smooth",block:"start"});f.querySelector("input")?.focus({preventScroll:true});notify("Mode modification : enregistrez pour conserver les changements.");}
async function command(btn){const method=btn.dataset.action,store=btn.dataset.store,id=Number(btn.dataset.id);if(method==="reminder"){await put(db,"medicationLogs",reminderLog(id,store,new Date(),btn.dataset.scheduledTime||""));await reload();notify(store==="taken"?"Prise déclarée enregistrée.":"Rappel ignoré.");return;}if(!DATA[store]||!Number.isInteger(id))return;if(method==="edit"){edit(store,id);return;}const item=DATA[store].find(x=>x.id===id);if(!item)return;if(method==="toggle"&&store==="tasks"){await put(db,"tasks",{...item,done:!item.done});await reload();return;}if(method==="delete"&&confirm("Supprimer définitivement cet enregistrement ?")){await del(db,store,id);if(store==="medications")for(const x of DATA.medicationLogs.filter(x=>x.medicationId===id))await del(db,"medicationLogs",x.id);await reload();notify("Enregistrement supprimé.");}}
async function exportBackup(){
 const envelope=await encryptedExport(db);
 if(!envelope)throw Error("Aucun coffre disponible.");
 const blob=new Blob([JSON.stringify({format:"FibroBotVaultEncrypted",version:1,exportedAt:new Date().toISOString(),envelope},null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),anchor=dom("a");
 anchor.href=url;anchor.download="fibrobot-coffre-chiffre-"+today()+".json";
 document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
 notify("Sauvegarde chiffrée exportée. La phrase secrète reste indispensable. Vous pourrez restaurer ce fichier depuis l’écran de création du coffre sur un nouveau navigateur.");
}
function printReport(){const w=window.open("","_blank");if(!w){notify("Fenêtre bloquée : autorisez l'impression ou utilisez JSON.");return;}const d=w.document;d.title="Rapport FibroBot";const style=d.createElement("style");style.textContent="body{font:15px/1.55 system-ui;margin:36px auto;max-width:850px;color:#18323e}h1{color:#16765b}section{border-top:1px solid #ccc;padding:10px 0;break-inside:avoid}article{margin:10px 0;white-space:pre-wrap}";d.head.append(style);d.body.append(dom("h1","Dossier de suivi FibroBot"),dom("p","Rapport du "+new Date().toLocaleString("fr-FR")+". Toutes les valeurs proviennent de la saisie de la personne, sans validation clinique."));const list=[["Conditions",DATA.conditions,x=>x.name+" · "+(x.notes||"")],["Traitements",DATA.medications,x=>x.name+" ; dose : "+(x.dose||"non notée")+" ; fréquence : "+(x.schedule||"non notée")+" ; rappel : "+(x.reminderTime||"non noté")],["Symptômes",DATA.symptoms,x=>x.date+" · "+x.name+" · intensité "+x.intensity+"/10 ; énergie "+(x.energy??"non notée")+" ; fatigue "+(x.fatigue??"non notée")+" ; sommeil "+(x.sleep??"non noté")+" ; "+(x.notes||"")],["Rendez-vous",DATA.appointments,x=>x.date+" · "+x.title+" · questions : "+(x.questions||"aucune")],["Journal des rappels",DATA.medicationLogs,x=>x.date+" "+x.time+" · traitement ID "+x.medicationId+" · "+(x.status==="taken"?"déclaré pris":"ignoré")]];for(const [title,entries,format] of list){const s=dom("section");s.append(dom("h2",title));if(!entries.length)s.append(dom("p","Aucune donnée."));else entries.forEach(e=>s.append(dom("article",format(e))));d.body.append(s);}d.body.append(dom("p","Ce document n'est ni une prescription, ni un avis médical. Faites vérifier les médicaments par un médecin ou pharmacien."));w.focus();notify("Rapport ouvert. Utilisez Imprimer → PDF dans votre navigateur.");}
function forms(){
 $("task-form").addEventListener("submit",async e=>{e.preventDefault();try{await write("tasks",makeTask({title:val("task-name"),effort:val("task-effort"),priority:val("task-priority"),due:val("task-due")}),e.currentTarget);}catch(err){notify(err.message);}});
 $("health-form").addEventListener("submit",async e=>{e.preventDefault();try{await write("symptoms",makeSymptom({name:val("health-name"),date:val("health-date"),condition:val("health-condition"),intensity:val("pain"),energy:val("health-energy"),fatigue:val("fatigue"),sleep:val("sleep"),notes:val("health-notes")}),e.currentTarget);}catch(err){notify(err.message);}});
 $("condition-form").addEventListener("submit",async e=>{e.preventDefault();try{await write("conditions",makeCondition({name:val("condition-name"),notes:val("condition-notes")}),e.currentTarget);}catch(err){notify(err.message);}});
 $("med-form").addEventListener("submit",async e=>{e.preventDefault();try{await write("medications",makeMedication({name:val("med-name"),dose:val("med-dose"),schedule:val("med-schedule"),reminderTimes:val("med-reminder-time"),prescriber:val("med-prescriber"),notes:val("med-notes")}),e.currentTarget);}catch(err){notify(err.message);}});
 $("appt-form").addEventListener("submit",async e=>{e.preventDefault();try{await write("appointments",makeAppointment({title:val("appt-name"),date:val("appt-date"),time:val("appt-time"),place:val("appt-place"),questions:val("appt-questions")}),e.currentTarget);}catch(err){notify(err.message);}});
 $("chat-form").addEventListener("submit",async e=>{
  e.preventDefault();
  if(busyChat){notify("Une réponse est déjà en cours.");return;}
  const q=val("prompt").trim();
  if(!q)return;
  if(!db){setEngineNote("Coffre verrouillé : ouvrez-le pour discuter.");notify("Déverrouillez le coffre avant de discuter.");return;}
  $("prompt").value="";refreshComposer();
  await ask(q);
 });
}
function breathing(){const out=$("breath-guide"),button=$("breath-start");if(timer){clearInterval(timer);timer=null;out.textContent="Exercice arrêté. Reposez-vous à votre rythme.";button.textContent="Démarrer un exercice doux";return;}let seconds=0;button.textContent="Arrêter l'exercice";out.textContent="Installez-vous confortablement. Respirez naturellement.";timer=setInterval(()=>{seconds++;const phase=seconds%12;out.textContent=phase<4?"Inspirez doucement, sans forcer.":phase<9?"Expirez tranquillement, sans retenir votre souffle.":"Restez à votre rythme. Si cela vous gêne, arrêtez.";if(seconds>=72){clearInterval(timer);timer=null;button.textContent="Démarrer un exercice doux";out.textContent="Exercice terminé. Vous pouvez vous reposer.";}} ,1000);}
function events(){
 document.addEventListener("pointerdown",()=>{lastActivityAt=Date.now();},{passive:true});
 document.addEventListener("keydown",()=>{lastActivityAt=Date.now();});
 window.addEventListener("focus",lockInactiveVault);
 $("auto-lock-minutes").addEventListener("change",async e=>{
  if(!db){e.target.value=String(storedAutoLockMinutes(DATA.settings));notify("Déverrouillez le coffre pour modifier la sécurité.");return;}
  try{
   const minutes=sanitizeAutoLockMinutes(e.target.value);
   await put(db,"settings",{id:AUTO_LOCK_SETTING,value:minutes});
   DATA.settings=await all(db,"settings");lastActivityAt=Date.now();
   refreshAutoLockSettings();notify(minutes?"Verrouillage automatique réglé à "+minutes+" minutes.":"Verrouillage automatique désactivé : protégez le téléphone.");
  }catch(error){
   e.target.value=String(storedAutoLockMinutes(DATA.settings));
   notify("Impossible d'enregistrer le verrouillage : "+String(error?.message||error).slice(0,120));
  }
 });

 $("preference-save").addEventListener("click",async()=>{
  if(!db){notify("Ouvrez le coffre pour mémoriser votre préférence.");return;}
  try{
   const value=validateGeneralPreference($("general-preference").value);
   await put(db,"settings",{id:PREFERENCE_SETTING_ID,value});
   DATA.settings=await all(db,"settings");
   $("preference-share").checked=false;renderGeneralPreference();
   notify("Préférence générale enregistrée dans votre coffre chiffré. Aucun envoi automatique.");
  }catch(e){$("preference-status").textContent=String(e.message||e);notify("Préférence non enregistrée.");}
 });
 $("preference-delete").addEventListener("click",async()=>{
  if(!db)return;
  try{
   await del(db,"settings",PREFERENCE_SETTING_ID);
   DATA.settings=await all(db,"settings");
   $("preference-share").checked=false;renderGeneralPreference();
   notify("Préférence de conversation supprimée du coffre actuel ; les anciennes sauvegardes ne sont pas modifiées.");
  }catch(e){notify("Suppression de préférence impossible : "+String(e.message).slice(0,100));}
 });
 $("preference-share").addEventListener("change",e=>{
  if(e.target.checked&&!savedGeneralPreference(DATA.settings)){
   e.target.checked=false;notify("Enregistrez d'abord une préférence générale non sensible.");return;
  }
  $("preference-status").textContent=e.target.checked?"Partage activé pour cette session uniquement. La préférence exacte sera présentée avant chaque envoi IA.":"Préférence conservée uniquement dans le coffre ; aucun envoi à l'IA.";
 });
 $("api-budget-select").addEventListener("change",e=>{
  try{configureApiBudget(e.target.value);}
  catch(err){e.target.value=String(apiBudgetStatus().cap);notify(err.message);}
  updateApiBudgetUI();
 });
 $("trend-metric").addEventListener("change",renderHealthTrends);
 $("trend-days").addEventListener("change",renderHealthTrends);
 const applyAccessibility=()=>{
  document.body.classList.toggle("easy-reading",$("easy-reading").checked);
  document.body.dataset.readingSize=$("reading-size").value;
 };
 $("easy-reading").addEventListener("change",applyAccessibility);
 $("reading-size").addEventListener("change",applyAccessibility);
 $("chat-voice-pause").addEventListener("click",()=>{
  if(!("speechSynthesis" in window)||!speechSynthesis.speaking){notify("Aucune lecture vocale en cours.");return;}
  speechSynthesis.pause();notify("Lecture vocale en pause.");
 });
 $("chat-voice-resume").addEventListener("click",()=>{
  if(!("speechSynthesis" in window)||!speechSynthesis.paused){notify("Aucune lecture à reprendre.");return;}
  speechSynthesis.resume();notify("Lecture vocale reprise.");
 });

 $("chat-memory-optin").addEventListener("change",e=>{
  sessionTurns.length=0;
  $("chat-memory-state").textContent=e.target.checked?
   "Mémoire activée : seuls les prochains échanges généraux admissibles sont retenus dans cette session.":
   "Mémoire désactivée et effacée de la session.";
 });
 $("chat-memory-clear").addEventListener("click",()=>{
  sessionTurns.length=0;$("chat-memory-state").textContent="Mémoire de la session effacée.";
  notify("Contexte IA effacé. L'historique chiffré du coffre n'est pas modifié.");
 });
 $("chat-voice-stop").addEventListener("click",()=>{stopSpeaking();notify("Lecture vocale arrêtée.");});
 $("install-app").addEventListener("click",requestPWAInstallation);
 $("auto-mode").addEventListener("change",()=>{updateEngineNote();notify($("auto-mode").checked?"Agnes AI activé pour les questions générales et fiches publiques autorisées.":"IA conversationnelle désactivée.");});
 $("agnes-connect").addEventListener("click",async()=>{
  const key=$("agnes-key").value.trim();$("agnes-key").value="";
  const button=$("agnes-connect");button.disabled=true;
  try{
   if(!db)throw Error("Déverrouillez votre coffre.");
   connectAgnes(key);
   if($("agnes-save-key")?.checked){
    await saveAgnesCredential(db,key);
    DATA.settings=await all(db,"settings");refreshAgnesVaultControls();
   }
   $("agnes-status").textContent=$("agnes-save-key")?.checked?
    "Clé Agnes chiffrée dans le coffre et activée. Testez la connexion pour vérifier votre accès API.":
    "Clé Agnes activée dans cette session. Testez la connexion pour vérifier votre accès API.";
   $("agnes-test").disabled=false;$("agnes-disconnect").disabled=false;
  }catch(error){
   disconnectAgnes();$("agnes-status").textContent="Clé Agnes non activée : "+String(error?.message||error).slice(0,120);
  }finally{button.disabled=false;updateEngineNote();refreshSimpleAssistant();}
 });
 $("agnes-forget")?.addEventListener("click",async()=>{
  if(!db||!confirm("Supprimer la clé Agnes de ce coffre et déconnecter ? Les anciennes sauvegardes chiffrées ne changent pas."))return;
  try{
   await deleteAgnesCredential(db);DATA.settings=await all(db,"settings");
   disconnectAgnes();$("agnes-test").disabled=true;$("agnes-disconnect").disabled=true;
   refreshAgnesVaultControls();$("agnes-status").textContent="Clé Agnes supprimée du coffre actuel.";updateEngineNote();refreshSimpleAssistant();
  }catch{notify("La clé Agnes n'a pas pu être supprimée.");}
 });
 $("agnes-test").addEventListener("click",async()=>{
  if(!agnesStatus().connected)return;
  if(!confirm("Tester Agnes en envoyant une question d'arithmétique publique ? Cette requête peut être facturée."))return;
  const button=$("agnes-test");button.disabled=true;$("agnes-status").textContent="Vérification de la connexion Agnes…";
  try{const result=await testAgnesConnection({model:$("agnes-model").value});$("agnes-status").textContent="Agnes disponible · test réussi ("+result.model+").";}
  catch(error){$("agnes-status").textContent=agnesStatus().cooldownSeconds>0?"Agnes en pause (quota). Réessayez lorsque le fournisseur le permet.":"Agnes indisponible. Vérifiez la clé, le crédit, le réseau et les permissions du navigateur (CORS).";}
  finally{button.disabled=!agnesStatus().connected;updateEngineNote();}
 });
 $("agnes-disconnect").addEventListener("click",()=>{disconnectAgnes();$("agnes-key").value="";$("agnes-test").disabled=true;$("agnes-disconnect").disabled=true;$("agnes-status").textContent="Agnes déconnecté ; clé effacée de la session.";updateEngineNote();refreshSimpleAssistant();});
 $("companion-mode").addEventListener("change",()=>{
  const label=$("companion-mode").selectedOptions[0]?.textContent||"Automatique";
  notify("Mode d'écoute : "+label+". Les règles de sécurité restent prioritaires.");
 });
 $("book-file").addEventListener("change",async event=>{
  const file=event.currentTarget.files?.[0];
  if(!file)return;
  stopSpeaking();bookText="";bookIndex=0;bookFile=null;pdfDocumentFile=null;$("book-pdf-open").hidden=true;refreshBook();
  try{
   const item=await openPrivateDocument(file);
   if(item.kind==="pdf"){
    pdfDocumentFile=item.file;
    $("book-pdf-open").hidden=false;
    $("book-state").textContent="PDF prêt pour un aperçu dans le navigateur. Aucun texte extrait ou envoyé à un serveur.";
    notify("PDF chargé sur cet appareil. Touchez « Afficher mon PDF » pour l'ouvrir.");
   }else{
    bookText=item.text;bookFile=file;
    const saved=DATA.settings.find(x=>x.id===READER_BOOKMARK_ID)?.value;
    bookIndex=matchingReaderBookmark(file,saved);refreshBook();
    notify("Document "+item.format+" chargé et extrait localement. Aucun envoi à un serveur.");
   }
  }catch(error){$("book-state").textContent=String(error.message||error);notify("Lecture impossible : "+String(error.message||error).slice(0,130));}
 });
 $("book-pdf-open").addEventListener("click",()=>{
  if(!pdfDocumentFile){notify("Aucun fichier PDF sélectionné.");return;}
  const url=URL.createObjectURL(pdfDocumentFile);
  const link=dom("a");link.href=url;link.target="_blank";link.rel="noopener noreferrer";
  document.body.append(link);link.click();link.remove();
  notify("Aperçu PDF demandé au lecteur du navigateur ; aucun transfert vers FibroBot.");
  setTimeout(()=>URL.revokeObjectURL(url),120000);
 });
 $("book-prev").addEventListener("click",()=>{if(bookText){stopSpeaking();bookIndex=Math.max(0,bookIndex-1);refreshBook();}});
 $("book-next").addEventListener("click",()=>{if(bookText){stopSpeaking();bookIndex++;refreshBook();}});
 $("book-read").addEventListener("click",()=>{
  if(!bookText){notify("Ouvrez un document TXT, Markdown, EPUB ou DOCX avec du texte lisible.");return;}
  if(speak(readerPage(bookText,bookIndex).text,{requested:true}))startBookSleepTimer();
 });
 $("book-stop").addEventListener("click",()=>{stopSpeaking();notify("Lecture vocale arrêtée.");});
 $("book-save-mark")?.addEventListener("click",async()=>{
  if(!db||!bookFile||!bookText){notify("Chargez d'abord un livre texte.");return;}
  try{
   const value=readerBookmark(bookFile,bookIndex);
   await put(db,"settings",{id:READER_BOOKMARK_ID,value});
   const old=DATA.settings.findIndex(x=>x.id===READER_BOOKMARK_ID);
   if(old>=0)DATA.settings[old]={id:READER_BOOKMARK_ID,value};else DATA.settings.push({id:READER_BOOKMARK_ID,value});
   notify("Signet conservé dans votre coffre chiffré. Le livre n'est pas sauvegardé.");
  }catch(err){notify("Signet impossible : "+String(err.message).slice(0,110));}
 });
 $("book-clear-mark")?.addEventListener("click",async()=>{
  if(!db)return;
  try{await del(db,"settings",READER_BOOKMARK_ID);DATA.settings=DATA.settings.filter(x=>x.id!==READER_BOOKMARK_ID);notify("Signet supprimé.");}
  catch{notify("Suppression du signet impossible.");}
 });
 $("assistant-diagnostics-run").addEventListener("click",()=>{
  const out=$("assistant-diagnostics-result");out.replaceChildren();
  const core=checkAssistantCore();
  const checks=dom("p",core.ok?"Moteur documentaire : 4 scénarios locaux réussis.":"Moteur documentaire : au moins un scénario local a échoué.");
  out.append(checks);
  for(const detail of companionStatus({vaultOpen:Boolean(db),mistral:mistralStatus(),internet:networkEnabled})){
   out.append(dom("p",detail.name+" : "+detail.status+" — "+detail.detail));
  }
  out.append(dom("p","Dictée : "+((window.SpeechRecognition||window.webkitSpeechRecognition)?"API exposée, fonctionnement réel à tester.":"API indisponible.")+" Voix française locale : "+(localVoice()?"détectée, à tester.":"non détectée.")));
  out.append(dom("p","Rappels hors application : non garantis en PWA. Commandes natives Android/iOS : non disponibles. Audit clinique et tests matériels toujours nécessaires."));
  out.append(dom("p","Ce diagnostic n'appelle aucune API et ne teste pas la disponibilité réelle de Mistral ou WebGPU. Aucune donnée patient n'est envoyée."));
  $("assistant-diagnostics-state").textContent=core.ok?"Diagnostic local terminé. Vérifiez les états des moteurs ci-dessous.":"Diagnostic local incomplet : la bibliothèque pourrait être indisponible.";
 });
 $("mistral-connect").addEventListener("click",async()=>{
  const source=$("mistral-key"),secret=source.value.trim(),save=$("mistral-save-key").checked;
  source.value=""; // Ne jamais laisser le secret dans le formulaire après soumission.
  try{
   connectMistral(secret);
   enableMistralSession();
   if(save){
    if(!db)throw Error("Le coffre doit être déverrouillé pour enregistrer une clé.");
    try{
     await saveMistralCredential(db,secret);
     DATA.settings=await all(db,"settings");
     refreshMistralVaultControls();
     $("mistral-status").textContent="Clé activée et enregistrée chiffrée dans le coffre AES-256-GCM. Elle ne sera pas réutilisée sans déverrouillage et action explicite.";
    }catch(error){
     $("mistral-status").textContent="Mistral activé uniquement pour cette session : enregistrement chiffré impossible ("+error.message+").";
    }
   }else{
    $("mistral-status").textContent="Clé activée en mémoire seulement. Aucune clé enregistrée en clair. Utilise le bouton de test, puis active Mistral pour discuter.";
   }
  }catch(error){
   disableMistralSession();
   $("mistral-status").textContent="Clé Mistral non activée : "+error.message;
  }finally{$("mistral-save-key").checked=false;}
 });
 $("mistral-restore").addEventListener("click",async()=>{
  const button=$("mistral-restore");button.disabled=true;
  try{
   if(!db)throw Error("Déverrouillez le coffre.");
   const secret=await loadMistralCredential(db);
   connectMistral(secret);
   enableMistralSession();
   $("mistral-status").textContent="Clé déchiffrée et activée pour cette session. Rien n'a été envoyé à Mistral ; seul le test ou une question autorisée appellera l'API.";
  }catch(error){
   disableMistralSession();
   $("mistral-status").textContent="Restauration de la clé impossible : "+error.message;
  }finally{refreshMistralVaultControls();}
 });
 $("mistral-forget").addEventListener("click",async()=>{
  if(!db)return;
  if(!confirm("Supprimer définitivement la copie chiffrée de la clé Mistral de ce coffre et déconnecter la session ? Les anciennes sauvegardes chiffrées peuvent encore la contenir. Pour révoquer une clé exposée, faites-le dans votre compte Mistral."))return;
  const button=$("mistral-forget");button.disabled=true;
  try{
   await deleteMistralCredential(db);
   DATA.settings=await all(db,"settings");
   disableMistralSession();
   refreshMistralVaultControls();
   $("mistral-status").textContent="Copie chiffrée supprimée du coffre actuel. Session Mistral déconnectée. Les anciennes sauvegardes ne sont pas modifiées.";
  }catch(error){
   $("mistral-status").textContent="Suppression impossible : "+error.message;
   refreshMistralVaultControls();
  }
 });
 $("mistral-test").addEventListener("click",async()=>{
  if(!mistralStatus().connected)return;
  if(!confirm("Tester Mistral en envoyant une question d'arithmétique publique ? Cette requête peut être facturée."))return;
  const button=$("mistral-test");button.disabled=true;$("mistral-status").textContent="Test API Mistral en cours…";
  try{
   const result=await testMistralConnection({model:$("mistral-model").value});
   $("mistral-status").textContent="Test Mistral réussi ("+result.model+"). Vous pouvez activer les réponses générales et les explications de fiches médicales publiques.";
  }catch(e){
   $("mistral-status").textContent=mistralStatus().cooldownSeconds>0?"Mistral en pause (quota 429). FibroBot continue localement.":"Mistral indisponible. FibroBot continue en local ; vérifie la clé et les droits API.";
   $("mistral-use").checked=false;
  }finally{button.disabled=!mistralStatus().connected;}
 });
 $("mistral-disconnect").addEventListener("click",()=>{
  disableMistralSession();
  const saved=refreshMistralVaultControls();
  $("mistral-status").textContent=saved?
   "Clé effacée de la mémoire de session. La copie chiffrée est conservée dans votre coffre jusqu'à sa suppression volontaire.":
   "Clé effacée de la mémoire de session. Aucune copie conservée dans le coffre.";
 });
 $("mistral-use").addEventListener("change",updateEngineNote);
 $("medical-knowledge-open").addEventListener("click",()=>{
  const out=$("medical-knowledge-results");out.replaceChildren();
  const current=HEALTH_CATALOG.find(x=>x.id===$("medical-knowledge-topic").value);
  if(!current){out.append(dom("p","Référence indisponible."));return;}
  out.append(dom("h4",current.label),dom("p",current.level+" · "+current.publisher));
  const link=dom("a","Ouvrir la ressource institutionnelle");link.href=current.url;link.target="_blank";link.rel="noopener noreferrer";out.append(link);
  if(current.id==="fibromyalgia"){
   const reference=callFibroTool("fibro.guidance",{topic:"fibro"});
   out.append(dom("p",reference.answer),dom("small","Source : "+reference.source+" · "+reference.date));
  }else out.append(dom("p","Pour cette maladie, FibroBot ne dispose pas encore d'une synthèse clinique vérifiée. Consultez les informations officielles et votre professionnel."));
 });
 $("network-mode").addEventListener("change",e=>{
  networkEnabled=Boolean(e.target.checked);
  $("network-state").textContent=networkEnabled
   ?"Réseau autorisé pour cette session. Avant chaque recherche, la question exacte et les sites seront affichés pour confirmation."
   :"Mode privé local : aucune recherche Internet libre ne sera lancée.";
  updateEngineNote();
 });
 document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
 if(b.dataset.medicationCalendarId){
   if(!db){notify("Déverrouillez le coffre avant cet export.");return;}
   const medication=DATA.medications.find(x=>String(x.id)===b.dataset.medicationCalendarId);
   if(!medication){notify("Traitement introuvable.");return;}
   if(!confirm("Créer un fichier calendrier avec des rappels quotidiens anonymes ?\n\nLe fichier ne contient aucun nom de médicament ni dose. Il comporte les heures déclarées. Votre calendrier doit ensuite l'importer : les alertes ne sont pas garanties."))return;
   try{
    const content=medicationCalendarICS(medication);
    const url=URL.createObjectURL(new Blob([content],{type:"text/calendar;charset=utf-8"})),link=dom("a");
    link.href=url;link.download="fibrobot-rappels-prives.ics";document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    notify("Agenda anonyme exporté. Importez-le explicitement dans votre calendrier.");
   }catch(err){notify("Export impossible : "+String(err.message||err).slice(0,110));}
   return;
  }
  if(b.dataset.calendarId){
  if(!db){notify("Déverrouillez le coffre pour exporter le rendez-vous.");return;}
  const entry=DATA.appointments.find(x=>String(x.id)===b.dataset.calendarId);
  if(!entry){notify("Rendez-vous introuvable.");return;}
  try{
   const content=appointmentCalendarICS(entry);
   const file=new Blob([content],{type:"text/calendar;charset=utf-8"}),url=URL.createObjectURL(file),link=dom("a");
   link.href=url;link.download="fibrobot-rendez-vous-"+entry.date+".ics";document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),3000);
   notify("Fichier calendrier créé sans nom ni détail médical. Importez-le volontairement dans votre agenda.");
  }catch(err){notify("Export agenda impossible : "+String(err.message||err).slice(0,110));}
  return;
 }
 if(b.dataset.specialist){
  if(!db){notify("Déverrouillez le coffre personnel.");return;}
  try{
   const result=callFibroTool("fibro.agent",{id:b.dataset.specialist},{...DATA,energy});
   const record={role:"bot",body:result.answer,time:Date.now(),sourceId:result.sourceId,purpose:"specialist"};
   put(db,"conversations",record).then(()=>{DATA.conversations.push(record);renderChat();tab("chat");lastSpeech=result.answer;setEngineNote("Dernière réponse : agent "+result.name+".");speak(result.answer);}).catch(err=>notify("Agent indisponible : "+err.message));
  }catch(err){notify("Agent indisponible : "+err.message);}
  return;
 }
 if(b.dataset.tab)tab(b.dataset.tab);else if(b.dataset.goto)tab(b.dataset.goto);else if(b.dataset.ask)ask(b.dataset.ask);else if(b.dataset.assistantAction){
  if(!db){notify("Ouvrez votre coffre pour utiliser ces fonctions.");return;}
  const output=b.dataset.assistantAction==="plan"?planDaily({...DATA,energy}):b.dataset.assistantAction==="summary"?summarizeObservations(DATA):b.dataset.assistantAction==="briefing"?coordinatedCareBriefing({...DATA,energy}):prepareVisit(DATA);
  showLocalAnswer(output);
 }else if(b.dataset.action)command(b).catch(err=>notify(err.message));});
 $("daily-energy").addEventListener("input",e=>{energy=Number(e.target.value);$("energy-out").textContent=energy+"/10";$("energy-guide").textContent=energyGuide(energy).description;renderTasks();});
 $("daily-energy").addEventListener("change",async()=>{try{await put(db,"settings",{id:"energy",value:energy});}catch(e){notify("Énergie non sauvegardée.");}});
  $("voice-toggle").addEventListener("click",()=>{if(!voice&&!localVoice()){notify("Aucune voix française garantie locale sur cet appareil. Aucune voix en ligne n'est activée.");return;}voice=!voice;syncVoiceControls();if(!voice)stopSpeaking();});
  $("chat-voice-toggle").addEventListener("click",()=>$("voice-toggle").click());
  $("prompt").addEventListener("input",refreshComposer);
  $("prompt").addEventListener("keydown",event=>{
   if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing){
    event.preventDefault();
    if(!busyChat){const form=$("chat-form");if(typeof form.requestSubmit==="function")form.requestSubmit();else $("chat-send").click();}
   }
  });
  $("messages").addEventListener("click",async event=>{
   const target=event.target.closest("button[data-chat-copy],button[data-chat-read]");
   if(!target)return;
   const answer=target.closest(".bubble")?.querySelector(".bubble-body")?.textContent||"";
   if(!answer)return;
   if(target.dataset.chatRead){
    if(!voice){notify("Activez d'abord la voix locale pour écouter cette réponse.");return;}
    speak(answer);return;
   }
   if(target.dataset.chatCopy){
    try{
     if(!navigator.clipboard?.writeText)throw Error("Presse-papiers indisponible");
     await navigator.clipboard.writeText(answer);
     notify("Réponse copiée. Pensez à la confidentialité de vos informations.");
    }catch{notify("Copie impossible sur ce navigateur. Sélectionnez le texte manuellement.");}
   }
  });
 $("mic").addEventListener("click",handleDictation);
 $("export").addEventListener("click",()=>exportBackup().catch(e=>notify("Export impossible : "+e.message)));
 $("print-report").addEventListener("click",()=>{if(confirm("Le rapport imprimable contient vos données de santé EN CLAIR. Évitez un ordinateur partagé, une imprimante publique ou un PDF non protégé. Continuer ?"))printReport();});
 $("erase").addEventListener("click",async()=>{if(!confirm("Supprimer définitivement toutes les données FibroBot de ce navigateur ?"))return;try{disableMistralSession();db.close();await wipeDB();location.reload();}catch(e){notify("Effacement bloqué : "+e.message);}});
 $("notification-permission").addEventListener("click",async()=>{if(!("Notification" in window)||typeof Notification.requestPermission!=="function"){notify("Notifications non disponibles ici. Gardez une alarme système pour les prises essentielles.");return;}try{const state=await Notification.requestPermission();notify(state==="granted"?"Notifications autorisées tant que le navigateur le permet.":"Notifications non autorisées. Les rappels restent visibles dans FibroBot.");}catch(e){notify("Notifications non prises en charge.");}});
 $("research-search").addEventListener("click",async()=>{
  const button=$("research-search"),out=$("research-results"),label=$("research-status");
  if(!db)return;
  if(!confirm("Rechercher des publications sur Europe PMC ? Seul le thème prédéfini est envoyé. Votre dossier et les questions libres restent sur l'appareil."))return;
  button.disabled=true;out.replaceChildren();label.textContent="Recherche de publications en cours…";
  const topic=$("research-topic").value;
  try{
   const articles=await findScientificArticles(topic);
   label.textContent=articles.length+" référence(s) trouvée(s). Vérifiez vous-même les méthodes et la qualité scientifique ; aucune conclusion de traitement n'est déduite.";
   for(const article of articles){
    const card=dom("article",undefined,"record"),body=dom("div");
    body.append(dom("strong",article.title),dom("small",article.authors+" · "+article.journal+" · "+article.date));
    const link=dom("a","Lire la publication");link.href=article.url;link.target="_blank";link.rel="noopener noreferrer";
    card.append(body,link);out.append(card);
   }
   if(!articles.length)out.append(dom("div","Aucune publication dans cette recherche.","empty"));
  }catch(error){
   label.textContent="Recherche externe indisponible : "+error.message;
   const a=dom("a","Rechercher directement sur Europe PMC");a.href=externalResearchLink(topic);a.rel="noopener noreferrer";a.target="_blank";out.append(a);
  }finally{button.disabled=false;}
 });
 $("repeat-last").addEventListener("click",()=>{
  if(!lastSpeech){notify("Aucune réponse récente à lire.");return;}
  if(!voice){notify("Activez la voix française locale dans l'en-tête pour écouter la dernière réponse.");return;}
  speak(lastSpeech);
 });
 $("erase-legacy").addEventListener("click",async()=>{if(!confirm("Supprimer l'ancienne base FibrobotDB non chiffrée de CE navigateur ? Vérifiez d'abord que vos données ont bien été migrées dans le coffre."))return;try{await eraseLegacy();notify("Ancienne base non chiffrée supprimée.");}catch(e){notify(e.message);}});
 $("lock-vault").addEventListener("click",()=>{if(!confirm("Verrouiller le coffre et quitter cette session ?"))return;activeSession.invalidate();feedMonitor?.stop();ambientPlayer.stop();stopBreathingSession();stopSpeaking();try{activeRecognition?.abort();}catch{}activeRecognition=null;sessionTurns.length=0;disconnectAgnes();disableMistralSession();db?.close();location.reload();});
 $("breath-start")?.addEventListener("click",breathing);
 $("relax-script")?.addEventListener("click",()=>{
   const script="Vous pouvez arrêter à tout moment. Installez-vous si possible dans une position confortable. Prenez conscience des points de contact de votre corps avec le support. Laissez votre respiration trouver son rythme naturel, sans la forcer. Observez les sons autour de vous. Si vous ressentez de l'inconfort, ouvrez les yeux et arrêtez. Vous n'avez rien à réussir. Quel petit geste pourrait rendre cet instant plus confortable ?";
   if(!voice){notify("Activez d'abord « Voix » dans l'en-tête si votre appareil dispose d'une voix française locale.");return;}
   speak(script);
 });
}
/* V27 progressive enhancements: attached only when the patient unlocks the existing PWA.
 * No native OS automation, background microphone, network call or data migration.
 */
function setupV27Controls(){
 const live=dom("p","Microphone et lecture vocale inactifs.","tiny voice-state");
 live.id="voice-live-state";live.setAttribute("role","status");live.setAttribute("aria-live","polite");
 $("messages")?.before(live);
 const dictation=document.querySelector(".dictation-permission");
 if(dictation&&!$("dictation-send-confirm")){
  const label=dom("label",undefined,"consent");
  label.htmlFor="dictation-send-confirm";
  const checkbox=dom("input");checkbox.type="checkbox";checkbox.id="dictation-send-confirm";
  label.append(checkbox,document.createTextNode(" Proposer l'envoi après la dictée (confirmation obligatoire)"));
  document.querySelector(".dictation-permission")?.append(label);
 }
 const med=$("med-reminder-time");
 if(med){
  med.type="text";med.maxLength=55;med.placeholder="08:00, 13:00, 20:00";
  const label=document.querySelector('label[for="med-reminder-time"]');
  if(label)label.textContent="Heures de rappels quotidiens déclarés (8 maximum)";
  med.after(dom("p","Séparez les horaires prescrits par des virgules. FibroBot ne déduit ni dose ni fréquence. Les alertes de la PWA ne sont pas garanties après fermeture.","tiny"));
 }
 const bookStop=$("book-stop");
 if(bookStop){
  const save=dom("button","Enregistrer ma page dans le coffre","btn light"),clear=dom("button","Oublier mon signet","btn light");
  save.id="book-save-mark";clear.id="book-clear-mark";save.type=clear.type="button";
  bookStop.after(save,clear);
 }
 const shortcuts=document.querySelector(".companion-shortcuts");
 if(shortcuts){
  for(const [label,query] of [["Google Maps","Ouvre Google Maps"],["Google Agenda","Ouvre Google Agenda"],["Mes rendez-vous","Affiche mes rendez-vous"]]){
   const button=dom("button",label,"btn light");button.type="button";button.dataset.ask=query;shortcuts.append(button);
  }
 }
}
function setupV28Controls(){
 const health=document.querySelector(".health-trends");
 if(health){
  const button=dom("button","Lire mon bilan descriptif","btn light");button.type="button";button.id="v28-health-brief";
  const output=dom("p","Bilan personnel uniquement ; aucune interprétation clinique.","tiny");output.id="v28-health-output";output.setAttribute("role","status");
  health.append(button,output);
  button.addEventListener("click",()=>{
   if(!db){notify("Déverrouillez votre coffre.");return;}
   output.textContent=descriptiveWellbeingBrief(DATA.symptoms,{days:Number($("trend-days").value)});
  });
 }
 const book=$("book-panel");
 if(book){
  const wrapper=dom("div",undefined,"v28-book-search");
  const label=dom("label","Rechercher dans mon livre ouvert");label.htmlFor="v28-book-query";
  const field=dom("input");field.id="v28-book-query";field.maxLength=100;field.type="search";field.placeholder="Mot ou expression";
  const search=dom("button","Trouver une page","btn light");search.type="button";search.id="v28-book-search";
  const results=dom("div",undefined,"v28-search-results");results.id="v28-search-results";results.setAttribute("role","status");results.setAttribute("aria-live","polite");
  const multi=dom("button","Écouter jusqu'à 3 pages","btn light");multi.type="button";multi.id="v28-book-read-three";
  wrapper.append(label,field,search,multi,results);book.append(wrapper);
  search.addEventListener("click",()=>{
   results.replaceChildren();
   if(!bookText){results.append(dom("p","Ouvrez d'abord un document texte."));return;}
   const hits=findBookPages(bookText,field.value);
   if(!hits.length){results.append(dom("p","Aucun résultat. Saisissez au moins deux caractères."));return;}
   for(const hit of hits){
    const b=dom("button","Page "+(hit.page+1)+" — "+hit.preview,"btn light");b.type="button";
    b.addEventListener("click",()=>{stopSpeaking();bookIndex=hit.page;refreshBook();$("book-page")?.focus();});
    results.append(b);
   }
  });
  multi.addEventListener("click",()=>{
   if(!bookText){notify("Ouvrez d'abord un livre.");return;}
   const source=bookText,range=readingPageRange(source,bookIndex,3);
   if(speak(range.spokenText,{requested:true,onComplete:()=>{
    if(bookText===source&&bookIndex===range.firstPage){bookIndex=range.nextPage;refreshBook();}
   }}))startBookSleepTimer();
  });
 }
 const toolbar=document.querySelector(".chat-header-actions");
 if(toolbar){
  const quiet=dom("button","Mode calme","chat-voice-toggle");quiet.id="v28-quiet-toggle";quiet.type="button";quiet.setAttribute("aria-pressed","false");toolbar.append(quiet);
  quiet.addEventListener("click",async()=>{
   if(!db){notify("Déverrouillez le coffre avant de modifier ce réglage.");return;}
   const enabled=!document.body.classList.contains("v28-quiet");
   document.body.classList.toggle("v28-quiet",enabled);quiet.setAttribute("aria-pressed",String(enabled));
   try{
    await put(db,"settings",{id:QUIET_SETTING_ID,value:enabled});
    const at=DATA.settings.findIndex(x=>x.id===QUIET_SETTING_ID);
    if(at<0)DATA.settings.push({id:QUIET_SETTING_ID,value:enabled});else DATA.settings[at]={id:QUIET_SETTING_ID,value:enabled};
    notify(enabled?"Mode calme activé et conservé dans le coffre.":"Mode calme désactivé et préférence conservée.");
   }catch{
    document.body.classList.toggle("v28-quiet",!enabled);quiet.setAttribute("aria-pressed",String(!enabled));
    notify("Impossible de sauvegarder le mode calme.");
   }
  });
 }
 const check=$("assistant-diagnostics-result");
 if(check){
  const button=dom("button","Vérifier les capacités du téléphone","btn light");button.type="button";button.id="v28-device-check";
  check.before(button);
  button.addEventListener("click",()=>{
   const status=deviceReadiness({secure:window.isSecureContext,storage:Boolean(db),serviceWorker:"serviceWorker" in navigator,
    notifications:"Notification" in window,notificationPermission:window.Notification?.permission,
    recognition:Boolean(window.SpeechRecognition||window.webkitSpeechRecognition),
    localSpeech:Boolean(localVoice()),installed:Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone),
    online:navigator.onLine!==false});
   check.replaceChildren(...status.map(item=>dom("p",(item.ok?"OK : ":"À vérifier : ")+item.label+" — "+item.detail)));
   check.append(dom("p","Ce contrôle ne vérifie ni les clés IA, ni les alarmes en arrière-plan, ni le matériel Android/iOS réel."));
  });
 }
}
function restoreV29Preferences(){
 const enabled=DATA.settings.find(x=>x.id===QUIET_SETTING_ID)?.value===true;
 document.body.classList.toggle("v28-quiet",enabled);
 $("v28-quiet-toggle")?.setAttribute("aria-pressed",String(enabled));
 const alerts=$("v29-reminder-opt-in");
 if(alerts)alerts.checked=optInForegroundReminders(DATA.settings);
}
function setupV31Controls(){
 const chat=$("chat"),hero=chat?.querySelector(".assistant-hero");
 if(!chat||!hero)return;
 const panel=dom("section",undefined,"card v31-agent-panel");panel.setAttribute("aria-label","Espaces des agents FibroBot");
 panel.append(dom("h3","Votre équipe FibroBot"));
 panel.append(dom("p","Huit espaces spécialisés et un dialogue général. Conversations distinctes dans le coffre. Agents d'information, non professionnels de santé réels.","tiny"));
 const toolbar=dom("div",undefined,"v31-agent-buttons");toolbar.setAttribute("role","group");toolbar.setAttribute("aria-label","Choisir un espace");
 const all=[{id:"general",name:"Agnes · général"},...EXPERT_PANEL];
 const title=dom("p","Conversation générale","tiny");title.id="v31-thread-title";title.setAttribute("role","status");
 for(const entry of all){
  const button=dom("button",entry.name,"btn light");button.type="button";button.dataset.v31Agent=entry.id;
  button.setAttribute("aria-pressed",String(entry.id===activeAgentId));
  button.addEventListener("click",()=>{
   if(busyChat){notify("Terminez la réponse précédente avant de changer d'agent.");return;}
   activeAgentId=entry.id;sessionTurns.length=0;
   for(const b of toolbar.querySelectorAll("button"))b.setAttribute("aria-pressed",String(b.dataset.v31Agent===entry.id));
   title.textContent="Espace : "+entry.name;
   renderChat();updateEngineNote();
  });
  toolbar.append(button);
 }
 panel.append(toolbar,title);
 const clear=dom("button","Effacer uniquement cette conversation","btn light");clear.type="button";clear.id="v31-clear-thread";
 clear.addEventListener("click",async()=>{
  if(!db||busyChat)return;
  if(!confirm("Effacer définitivement la conversation de cet espace dans le coffre chiffré ? Les autres espaces restent conservés."))return;
  clear.disabled=true;
  try{
   const records=await all(db,"conversations");
   const mine=records.filter(r=>(r.agentId||"general")===activeAgentId);
   for(const record of mine)await del(db,"conversations",record.id);
   DATA.conversations=await all(db,"conversations");sessionTurns.length=0;
   renderChat();notify("Conversation sélectionnée supprimée du coffre chiffré.");
  }catch{notify("Effacement incomplet : vérifiez le coffre et réessayez.");}
  finally{clear.disabled=false;}
 });
 panel.append(clear);
 hero.after(panel);
 const feeds=dom("section",undefined,"card v31-feed-panel");
 feeds.append(dom("h3","Flux Internet et informations actuelles"));
 feeds.append(dom("p","Routage automatique des questions météo, qualité de l'air et jours fériés. Bibliothèques : Wikipédia, Wikidata, Wiktionnaire, OpenAlex, Crossref, Open Library, GitHub, Europe PMC. Aucun modèle IA local à installer.","tiny"));
 const cityLabel=dom("label","Ville à interroger");cityLabel.htmlFor="v31-city";
 const city=dom("input");city.id="v31-city";city.type="text";city.maxLength=75;city.value="";city.placeholder="Ex. Châteaubriant ou Nantes";city.autocomplete="off";
 feeds.append(cityLabel,city);
 const consentLabel=dom("label",undefined,"consent");consentLabel.htmlFor="v31-live-consent";
 const consent=dom("input");consent.type="checkbox";consent.id="v31-live-consent";
 consentLabel.append(consent,document.createTextNode(" Autoriser les services publics pour cette session (ville uniquement, pas de dossier médical)."));
 feeds.append(consentLabel);
 const agnesLabel=dom("label",undefined,"consent");agnesLabel.htmlFor="v31-agnes-grounded";
 const agnes=dom("input");agnes.type="checkbox";agnes.id="v31-agnes-grounded";
 agnesLabel.append(agnes,document.createTextNode(" Agnes peut reformuler mes résultats publics datés (appel API potentiellement payant)."));
 feeds.append(agnesLabel);
 const watchLabel=dom("label",undefined,"consent");watchLabel.htmlFor="v31-watch";
 const watch=dom("input");watch.id="v31-watch";watch.type="checkbox";
 watchLabel.append(watch,document.createTextNode(" Suivre météo et qualité de l'air toutes les 5 min lorsque la page est visible"));
 feeds.append(watchLabel);
 const state=dom("p","Veille désactivée.","tiny");state.id="v31-watch-status";state.setAttribute("role","status");feeds.append(state);
 const results=dom("pre","Aucune donnée consultée.","v31-live-output");results.id="v31-live-output";results.setAttribute("aria-live","polite");feeds.append(results);
 const directory=dom("details");directory.className="v31-directory";
 directory.append(dom("summary","Sources disponibles et limites"));
 const list=dom("ul");for(const source of [...PUBLIC_PROVIDERS,...LIVE_SOURCES]){
  const li=dom("li"),link=dom("a",source.name);link.href=source.origin||source.url;link.target="_blank";link.rel="noopener noreferrer";li.append(link);list.append(li);
 }
 directory.append(list,dom("p","Les résultats sont obtenus à la demande. Seuls météo et air sont rafraîchis pendant l'ouverture de la page. Les fournisseurs peuvent imposer des limitations et bloquer les appels navigateur.","tiny"));feeds.append(directory);
 panel.after(feeds);
 const ambient=dom("section",undefined,"card v31-ambient-panel");ambient.setAttribute("aria-label","Ambiances sonores facultatives");
 ambient.append(dom("h3","Ambiance douce et lecture"));
 ambient.append(dom("p","Sons générés par votre navigateur : pluie, vagues et bruits colorés. Ce n'est pas un traitement de la douleur, ni un service de musique.","tiny"));
 const controls=dom("div",undefined,"v31-ambient-controls");
 const audioLabel=dom("p","Aucune ambiance en lecture.","tiny");audioLabel.id="v31-ambient-status";audioLabel.setAttribute("role","status");
 const updateAudio=()=>{const active=ambientPlayer.currentType();for(const button of controls.querySelectorAll("button[data-ambient]"))button.setAttribute("aria-pressed",String(button.dataset.ambient===active));audioLabel.textContent=active?"Ambiance en lecture : "+(AMBIENT_TYPES.find(x=>x.id===active)?.name||active):"Aucune ambiance en lecture.";};
 const volLabel=dom("label","Volume sonore : 25 %");volLabel.htmlFor="v31-ambient-volume";
 const vol=dom("input");vol.id="v31-ambient-volume";vol.type="range";vol.min="0";vol.max="70";vol.step="5";vol.value="25";
 vol.addEventListener("input",()=>{volLabel.textContent="Volume sonore : "+ambientPlayer.setVolume(vol.value)+" %";});
 for(const option of AMBIENT_TYPES){
  const button=dom("button",option.name,"btn light");button.type="button";button.dataset.ambient=option.id;button.setAttribute("aria-pressed","false");
  button.addEventListener("click",async()=>{button.disabled=true;
   try{if(ambientPlayer.currentType()===option.id)ambientPlayer.stop();else await ambientPlayer.play(option.id,vol.value);updateAudio();}
   catch(error){ambientPlayer.stop();updateAudio();notify("Audio indisponible : "+String(error?.message||error).slice(0,110));}
   finally{button.disabled=false;}
  });controls.append(button);
 }
 const stop=dom("button","Arrêter les sons","btn light");stop.type="button";stop.id="v31-ambient-stop";
 stop.addEventListener("click",()=>{ambientPlayer.stop();updateAudio();});
 controls.append(stop);ambient.append(controls,volLabel,vol,audioLabel);
 feeds.after(ambient);
 const status=()=>{state.textContent=feedState({running:feedMonitor?.isActive(),visible:document.visibilityState==="visible",online:navigator.onLine!==false,city:city.value});};
 const refresh=async()=>{
  if(!db||!consent.checked||!city.value.trim())return;
  const chosen=city.value.trim();
  const settle=await Promise.allSettled([publicWeather(chosen,{question:"Quel temps fait-il aujourd'hui ?"}),publicAirQuality(chosen)]);
  if(!db||!watch.checked)return;
  const details=settle.map((r,i)=>r.status==="fulfilled"?r.value.answer:("Service "+(i?"air":"météo")+" indisponible : "+String(r.reason?.message||"erreur").slice(0,130)));
  results.textContent="Consultation à "+new Date().toLocaleTimeString("fr-FR")+" ; chiffres et prévisions susceptibles d'évoluer.\n\n"+details.join("\n\n");
 };
 feedMonitor=createPublicFeedMonitor({refresh});
 const tick=()=>{feedMonitor?.tick({visible:document.visibilityState==="visible",online:navigator.onLine!==false}).catch(()=>{});status();};
 watch.addEventListener("change",()=>{
  if(watch.checked&&!consent.checked){watch.checked=false;notify("Autorisez d'abord les sources publiques.");return;}
  if(watch.checked&&!city.value.trim()){watch.checked=false;notify("Saisissez la ville à suivre.");return;}
  if(watch.checked)feedMonitor.start();else feedMonitor.stop();
  status();tick();
 });
 consent.addEventListener("change",()=>{if(!consent.checked){watch.checked=false;feedMonitor.stop();}status();});
 city.addEventListener("change",()=>{results.textContent="Ville modifiée. Activez ou réactivez le suivi pour rafraîchir.";status();});
 document.addEventListener("visibilitychange",tick);
 window.addEventListener("online",tick);
 window.addEventListener("offline",tick);
 setInterval(tick,300000);status();
}
function setupV32Controls(){
 const chat=$("chat"),agents=chat?.querySelector(".v31-agent-panel");
 if(!chat||!agents)return;
 const quick=dom("section",undefined,"card v32-quick-panel");
 quick.append(dom("h3","Journal express · une seule ligne"),
  dom("p","Note facultative, uniquement dans votre coffre chiffré. Les facteurs notés ne prouvent aucune cause.","tiny"));
 const form=dom("form",undefined,"v32-quick-form");form.id="v32-quick-form";
 const label=dom("label","Douleur, fatigue et énergie (notes sur 10)");label.htmlFor="v32-quick-entry";
 const input=dom("input");input.id="v32-quick-entry";input.type="text";input.maxLength=240;
 input.autocomplete="off";input.placeholder=QUICK_HELP;
 const save=dom("button","Enregistrer dans mon coffre","btn primary");save.type="submit";
 const info=dom("p","Exemple : douleur 7 fatigue 8 stress · cette observation ne remplace pas un examen médical.","tiny");info.id="v32-quick-help";
 const state=dom("p","Aucune nouvelle observation saisie.","tiny");state.id="v32-quick-status";state.setAttribute("role","status");
 input.setAttribute("aria-describedby","v32-quick-help v32-quick-status");
 form.append(label,input,save,info);quick.append(form,state);
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!db||save.disabled){state.textContent="Déverrouillez le coffre pour enregistrer.";return;}
  let parsed;
  try{parsed=parseQuickHealth(input.value,today());}
  catch(error){state.textContent=String(error?.message||error).slice(0,160);return;}
  save.disabled=true;
  try{
   await put(db,"symptoms",parsed.payload);
   input.value="";state.textContent="Observation enregistrée et chiffrée : "+parsed.preview;
   await reload();
  }catch{state.textContent="Enregistrement impossible : vérifiez votre coffre."; }
  finally{save.disabled=false;}
 });
 agents.after(quick);
 const search=dom("details");search.className="card v32-search-panel";search.id="v32-private-search";
 search.append(dom("summary","Rechercher dans mes notes, tâches, rendez-vous et conversations"));
 const searchLabel=dom("label","Recherche privée, sur cet appareil");searchLabel.htmlFor="v32-search-query";
 const query=dom("input");query.id="v32-search-query";query.type="search";query.autocomplete="off";query.maxLength=100;
 query.placeholder="Ex. douleur, kiné, rendez-vous…";
 const output=dom("div",undefined,"v32-search-results");output.id="v32-search-results";output.setAttribute("role","status");
 const redraw=()=>{
  output.replaceChildren();
  if(!db){output.append(dom("p","Coffre verrouillé."));return;}
  if(query.value.trim().length<2){output.append(dom("p","Saisissez au moins deux caractères."));return;}
  const found=searchPrivateRecords(DATA,query.value,{limit:20,agentId:activeAgentId});
  if(!found.length){output.append(dom("p","Aucun résultat dans cet espace (les autres conversations sont séparées)."));return;}
  output.append(dom("p",found.length+" résultat(s) affiché(s), dans votre coffre uniquement.","tiny"));
  for(const item of found){
   const row=dom("article",undefined,"v32-search-result");
   row.append(dom("strong",item.label),dom("small",item.store+" · "+item.date));
   if(item.snippet)row.append(dom("p",item.snippet,"tiny"));
   const button=dom("button","Voir la section","btn light");button.type="button";
   button.addEventListener("click",()=>{search.open=false;tab(item.tab);});
   row.append(button);output.append(row);
  }
 };
 query.addEventListener("input",redraw);
 search.addEventListener("toggle",()=>{if(search.open){redraw();}});
 search.append(searchLabel,query,output);quick.after(search);
 const breath=dom("section",undefined,"card v32-breathing-panel");breath.id="v32-breathing-panel";
 breath.append(dom("h3","Respiration guidée · pause douce"),
  dom("p","Exercice facultatif de détente, non médical. Respirez à votre rythme, sans retenir votre souffle. Arrêtez si vous êtes gêné, étourdi ou essoufflé.","tiny"));
 const row=dom("div",undefined,"v32-breathing-controls");
 const modeLabel=dom("label","Rythme");modeLabel.htmlFor="v32-breath-mode";
 const mode=dom("select");mode.id="v32-breath-mode";
 for(const option of BREATH_PATTERNS){const el=dom("option",option.name);el.value=option.id;mode.append(el);}
 const durationLabel=dom("label","Durée");durationLabel.htmlFor="v32-breath-duration";
 const duration=dom("select");duration.id="v32-breath-duration";
 for(const n of BREATH_DURATIONS){const el=dom("option",n+" minutes");el.value=String(n);duration.append(el);}
 const start=dom("button","Démarrer","btn primary");start.id="v32-breath-start";start.type="button";
 const stop=dom("button","Arrêter","btn light");stop.id="v32-breath-stop";stop.type="button";stop.disabled=true;
 const visual=dom("div","À votre rythme","v32-breath-circle");visual.id="v32-breath-circle";visual.setAttribute("aria-hidden","true");
 const current=dom("p","Prêt · 02:00","v32-breath-status");current.id="v32-breath-status";current.setAttribute("role","status");
 const pause=()=>{stopBreathingSession();start.disabled=false;stop.disabled=true;mode.disabled=false;duration.disabled=false;visual.dataset.phase="rest";};
 start.addEventListener("click",()=>{
  if(!db){notify("Déverrouillez le coffre pour ouvrir votre séance.");return;}
  pause();start.disabled=true;stop.disabled=false;mode.disabled=true;duration.disabled=true;
  const begun=Date.now();
  const refresh=()=>{
   if(!db||document.visibilityState!=="visible"){
    pause();current.textContent="Séance arrêtée : application masquée ou coffre verrouillé.";return;
   }
   const step=breathingStep(Math.max(0,Date.now()-begun),{pattern:mode.value,durationMinutes:Number(duration.value)});
   visual.dataset.phase=step.phase;
   visual.textContent=step.done?"Terminé":step.phase==="inhale"?"Inspirez":"Expirez";
   current.textContent=step.label+" · "+sessionTimeString(step.remainingSeconds)+" restantes"+
     (step.done?"":" · phase "+step.phaseRemainingSeconds+" s");
   if(step.done)pause();
  };
  refresh();breathingTimer=setInterval(refresh,250);
 });
 stop.addEventListener("click",()=>{pause();visual.textContent="À votre rythme";current.textContent="Séance arrêtée.";});
 duration.addEventListener("change",()=>{if(!breathingTimer)current.textContent="Prêt · "+sessionTimeString(Number(duration.value)*60);});
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState!=="visible"&&breathingTimer){pause();visual.textContent="En pause";current.textContent="Séance arrêtée : application masquée.";}})
 row.append(modeLabel,mode,durationLabel,duration,start,stop);
 breath.append(row,visual,current);search.after(breath);
}
function setupV30Controls(){
 document.body.classList.add("v30-simple");
 const chat=$("chat");
 const hero=chat?.querySelector(".assistant-hero");
 const agnes=$("agnes-options");
 if(hero&&agnes){
  hero.after(agnes);
  agnes.classList.add("v30-agnes-primary");
  const summary=agnes.querySelector("summary small");
  if(summary)summary.textContent="Une seule clé, enregistrable dans le coffre chiffré · spécialiste fibromyalgie";
  const intro=agnes.querySelector(".ai-details>p");
  if(intro)intro.textContent="Saisissez votre clé Agnes une fois. FibroBot vous aide pour les questions générales et s'appuie sur ses fiches médicales de référence pour la fibromyalgie. Agnes exige Internet, un compte et un accès API ; les requêtes peuvent être payantes ou bloquées par le navigateur.";
  const form=agnes.querySelector(".form");
  const save=dom("label",undefined,"consent");save.htmlFor="agnes-save-key";
  const checkbox=dom("input");checkbox.id="agnes-save-key";checkbox.type="checkbox";checkbox.checked=true;
  save.append(checkbox,document.createTextNode(" Enregistrer ma clé dans le coffre chiffré de ce téléphone"));
  const session=dom("label",undefined,"consent");session.htmlFor="agnes-session-consent";
  const allow=dom("input");allow.id="agnes-session-consent";allow.type="checkbox";
  session.append(allow,document.createTextNode(" Autoriser mes questions générales admissibles pendant cette session (confirmation au premier envoi)"));
  const medical=dom("label",undefined,"consent");medical.htmlFor="agnes-public-fiches";
  const publicFiche=dom("input");publicFiche.id="agnes-public-fiches";publicFiche.type="checkbox";
  medical.append(publicFiche,document.createTextNode(" Autoriser l'explication des fiches médicales publiques (sans ma question personnelle)"));
  const row=agnes.querySelector(".button-row");
  const forget=dom("button","Supprimer ma clé enregistrée","btn light");forget.id="agnes-forget";forget.type="button";forget.disabled=true;
  row?.append(forget);
  const status=$("agnes-status");status?.before(save,session,medical,
   dom("p","Les questions privées, symptômes, traitements et urgences restent traités dans FibroBot. L'IA distante ne remplace pas un médecin. Le premier accès Internet peut demander une confirmation.","tiny"));
 }
 const toggle=dom("button","Afficher les réglages avancés","btn light");toggle.type="button";toggle.id="v30-advanced-toggle";
 toggle.setAttribute("aria-expanded","false");
 hero?.after(toggle);
 toggle.addEventListener("click",()=>{
  const enabled=document.body.classList.toggle("v30-advanced");
  toggle.setAttribute("aria-expanded",String(enabled));
  toggle.textContent=enabled?"Masquer les réglages avancés":"Afficher les réglages avancés";
 });
}
function setupV29Controls(){
 const reminders=$("medications");
 if(reminders){
  const group=dom("div",undefined,"v29-reminder-optin");
  const label=dom("label",undefined,"consent");label.htmlFor="v29-reminder-opt-in";
  const choice=dom("input");choice.id="v29-reminder-opt-in";choice.type="checkbox";
  label.append(choice,document.createTextNode(" Alerte générique pendant que FibroBot est ouvert (facultatif)"));
  group.append(label,dom("p","Sans nom de médicament dans la notification. Aucune alerte garantie quand l'application est fermée : utilisez une alarme système pour les prises indispensables.","tiny"));
  reminders.append(group);
  choice.addEventListener("change",async()=>{
   const enabled=choice.checked;
   if(!db){choice.checked=false;notify("Déverrouillez d'abord le coffre.");return;}
   try{
    await put(db,"settings",{id:FOREGROUND_REMINDER_OPTIN_ID,value:enabled});
    const index=DATA.settings.findIndex(x=>x.id===FOREGROUND_REMINDER_OPTIN_ID);
    if(index<0)DATA.settings.push({id:FOREGROUND_REMINDER_OPTIN_ID,value:enabled});
    else DATA.settings[index]={id:FOREGROUND_REMINDER_OPTIN_ID,value:enabled};
    if(enabled)notifyForegroundMedicationReminders(dueReminders(DATA.medications,DATA.medicationLogs));
    notify(enabled?"Alertes dans l'application activées. Elles ne sont pas garanties en arrière-plan.":"Alertes de traitements désactivées.");
   }catch{
    choice.checked=!enabled;notify("La préférence de rappel n'a pas été sauvegardée.");
   }
  });
 }
 const search=$("v28-book-query")?.closest(".v28-book-search");
 if(search){
  const label=dom("label","Arrêter automatiquement la lecture après");label.htmlFor="v29-book-sleep";
  const select=dom("select");select.id="v29-book-sleep";select.setAttribute("aria-label","Minuterie de sommeil pour la lecture");
  for(const minutes of BOOK_SLEEP_MINUTES){
   const option=dom("option",minutes?minutes+" minutes":"Pas de minuterie");option.value=String(minutes);select.append(option);
  }
  search.append(label,select,dom("p","La minuterie fonctionne uniquement pendant que cette page reste active.","tiny"));
 }
 if("speechSynthesis" in window&&typeof speechSynthesis.addEventListener==="function"){
  speechSynthesis.addEventListener("voiceschanged",()=>{
   if(!db)return;
   updateVoiceState(localVoice()?"Voix française locale détectée.":"Voix locale indisponible : vérifiez les voix installées sur votre téléphone.");
  });
 }
}
async function init(){
 setupV27Controls();setupV28Controls();setupV29Controls();setupV30Controls();setupV31Controls();setupV32Controls();refreshSimpleAssistant=setupSimpleAssistant({connected:()=>agnesStatus().connected});renderSpecialists();updateEngineNote();syncVoiceControls();refreshComposer();updateDictationButton();updateConnectionState();installGuidance();updateApiBudgetUI();
 window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();pendingInstall=event;installGuidance();});
 window.addEventListener("appinstalled",()=>{pendingInstall=null;installGuidance();});
 window.addEventListener("online",updateConnectionState);
 window.addEventListener("offline",updateConnectionState);
 window.addEventListener("pagehide",()=>{
  activeSession.invalidate();feedMonitor?.stop();ambientPlayer.stop();stopBreathingSession();stopSpeaking();try{activeRecognition?.abort();}catch{}activeRecognition=null;bookText="";bookFile=null;
  disconnectMistral();disconnectAgnes();sessionTurns.length=0;pdfDocumentFile=null;$("preference-share").checked=false;
  $("agnes-key").value="";
  const field=$("mistral-key");if(field)field.value="";
 });
 window.addEventListener("pageshow",event=>{
  if(event.persisted){
   $("agnes-test").disabled=true;$("agnes-disconnect").disabled=true;
   $("agnes-status").textContent="Agnes déconnecté après reprise : reconnectez la clé pour cette session.";
   $("mistral-use").checked=false;$("mistral-use").disabled=true;
   $("mistral-test").disabled=true;$("mistral-disconnect").disabled=true;
   refreshMistralVaultControls();updateEngineNote();
  }
 });
 $("today-date").textContent=new Intl.DateTimeFormat("fr-FR",{dateStyle:"long"}).format(new Date());
 $("health-date").value=today();$("appt-date").value=today();
 forms();events();
  const shortcut=new URLSearchParams(location.search).get("open");
  if(["chat","crisis","tasks","health","appointments","library"].includes(shortcut))tab(shortcut);
   else tab("chat");
 patientUX=setupPatientUX({navigate:tab,getSettings:()=>DATA.settings,saveSetting:async(id,value)=>{
   if(!db)throw Error("Déverrouillez d'abord le coffre.");
   await put(db,"settings",{id,value});
   const i=DATA.settings.findIndex(s=>s.id===id);
   if(i<0)DATA.settings.push({id,value});else DATA.settings[i]={id,value};
 },notify});
 try{db=await openSecureDB();await reload();await restoreAgnesAfterUnlock();refreshSimpleAssistant();setInterval(()=>{lockInactiveVault();if(document.visibilityState==="visible"&&db){renderReminders();renderUpcomingAppointments();}},30000);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){lockInactiveVault();if(db){renderReminders();renderUpcomingAppointments();}}});}
 catch(e){console.error(e);notify("Stockage local indisponible : l'application ne peut pas enregistrer vos données. Autorisez le stockage pour ce site.");}
 if("serviceWorker" in navigator&&window.isSecureContext){navigator.serviceWorker.register("./sw.js").catch(()=>{/* hors ligne facultatif */});}
}
document.addEventListener("DOMContentLoaded",init);
