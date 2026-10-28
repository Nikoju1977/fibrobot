import {today,text,makeSymptom,makeTask,makeCondition,makeAppointment,makeMedication,energyGuide,rankTasks,reply,dueReminders,reminderLog} from "./core.mjs";
import {LIBRARY} from "./medical-library.mjs";
import {openSecureDB,all,put,del,wipeDB,encryptedExport,eraseLegacy} from "./vault-ui.mjs";
import {loadGemma,unloadGemma,cancelGemmaLoad,canPlanWithGemma,generateLifePlan,generateGeneralChat,summarizePublicSources,testLocalModel,detectWebGPU,listLocalModels,status as llmStatus} from "./gemma-local.mjs";
import {SPECIALISTS,routeSpecialist,runSpecialist} from "./agent-hub.mjs";
import {classifyIntent,summarizeObservations,prepareVisit,planDaily} from "./assistant-engine.mjs";
import {findScientificArticles,externalResearchLink} from "./research-library.mjs";
import {isOnlineEligible,selectPublicProviders,searchPublicQuestion,formatPublicAnswer,safeReferenceUrl,PUBLIC_PROVIDERS} from "./network-library.mjs";
import {setupPatientUX} from "./ux-pro.mjs";
import {HEALTH_CATALOG,retrieveMedicalEvidence,approvedMedicalURL} from "./medical-rag.mjs";
import {connectMistral,disconnectMistral,mistralStatus,generateMistralChat,testMistralConnection} from "./mistral-bridge.mjs";
import {callFibroTool,FIBRO_MCP_TOOLS} from "./mcp-fibro-tools.mjs";
const $=id=>document.getElementById(id);
const TITLES={today:"Aujourd'hui",chat:"Assistant",tasks:"Mes tâches",health:"Suivi santé",conditions:"Mes maladies",medications:"Mes traitements",appointments:"Mes rendez-vous",library:"Bibliothèque médicale",privacy:"Mes données",crisis:"Mode crise"};
const DATA={symptoms:[],tasks:[],conditions:[],medications:[],appointments:[],medicationLogs:[],conversations:[],settings:[]};
const FORMS={tasks:"task-form",symptoms:"health-form",conditions:"condition-form",medications:"med-form",appointments:"appt-form"};
let db=null,energy=5,voice=false,seen=new Set(),timer=null,patientUX=null,lastSpeech="",busyChat=false,networkEnabled=false;
const dom=(tag,string,cls)=>{let n=document.createElement(tag);if(string!==undefined)n.textContent=String(string);if(cls)n.className=cls;return n;};
const val=id=>$(id).value;
function notify(message){$("toast").textContent=message;$("toast").hidden=false;clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>$("toast").hidden=true,5500);}
function tab(name){if(!TITLES[name])return;document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===name));document.querySelectorAll("[data-tab]").forEach(x=>{x.classList.toggle("active",x.dataset.tab===name);x.dataset.tab===name?x.setAttribute("aria-current","page"):x.removeAttribute("aria-current");});$("page-heading").textContent=TITLES[name];document.title=TITLES[name]+" · FibroBot";patientUX?.closeMenu();window.scrollTo(0,0);}
function blank(target,message){target.replaceChildren(dom("div",message,"empty"));}
function action(label,method,store,id){const b=dom("button",label,"mini");b.type="button";b.dataset.action=method;b.dataset.store=store;b.dataset.id=String(id);return b;}
function record(target,title,subtitle,notes,store,id,extra={}){const row=dom("div",undefined,"record"),copy=dom("div"),buttons=dom("div",undefined,"actions");copy.append(dom("strong",title,extra.done?"done":""));if(subtitle)copy.append(dom("small",subtitle));if(notes)copy.append(dom("p",notes));if(extra.tag)copy.append(dom("span",extra.tag,extra.tag==="À reporter"?"tag later":"tag"));if(store==="tasks")buttons.append(action(extra.done?"Réouvrir":"Terminer","toggle",store,id));if(FORMS[store])buttons.append(action("Modifier","edit",store,id));if(store)buttons.append(action("Supprimer","delete",store,id));row.append(copy,buttons);target.append(row);}
async function reload(){for(const name of Object.keys(DATA))DATA[name]=await all(db,name);energy=DATA.settings.find(s=>s.id==="energy")?.value??energy;render();}
function render(){ $("count-tasks").textContent=DATA.tasks.filter(x=>!x.done).length;$("count-health").textContent=DATA.symptoms.length;$("count-conditions").textContent=DATA.conditions.length;$("daily-energy").value=energy;$("energy-out").textContent=energy+"/10";$("energy-guide").textContent=energyGuide(energy).description;renderTasks();renderHealth();renderConditions();renderMeds();renderAppointments();renderLibrary();renderChat();patientUX?.refreshGuide(); }
function renderTasks(){const tasks=rankTasks(DATA.tasks,energy),out=$("tasks-list"),home=$("today-tasks");out.replaceChildren();home.replaceChildren();if(!tasks.length)blank(home,"Aucune tâche urgente. Vous pouvez vous reposer.");else tasks.slice(0,5).forEach(t=>record(home,t.title,"Effort "+t.effort+"/3",null,null,t.id,{tag:t.adapted?"Effort compatible":"À reporter"}));if(!DATA.tasks.length)blank(out,"Vous pouvez ajouter vos tâches ici.");else [...tasks,...DATA.tasks.filter(x=>x.done)].forEach(t=>record(out,t.title,(t.priority==="important"?"Essentielle":t.priority==="delegable"?"Délégable":"Flexible")+" · effort "+t.effort+"/3"+(t.due?" · "+t.due:""),null,"tasks",t.id,{done:t.done,tag:t.done?"Terminée":t.adapted?"Effort compatible":"À reporter"}));}
function renderHealth(){const out=$("health-list");out.replaceChildren();if(!DATA.symptoms.length)blank(out,"Aucune observation enregistrée.");else [...DATA.symptoms].sort((a,b)=>String(b.date).localeCompare(String(a.date))).forEach(s=>{const notes=[s.energy!=null?"Énergie "+s.energy+"/10":"",s.fatigue!=null?"Fatigue "+s.fatigue+"/10":"",s.sleep!=null?"Sommeil "+s.sleep+"/10":"",s.notes].filter(Boolean).join(" · ");record(out,s.name,String(s.date).slice(0,10)+" · Intensité "+s.intensity+"/10"+(s.condition?" · "+s.condition:""),notes,"symptoms",s.id);});const select=$("health-condition"),old=select.value;select.replaceChildren();let option=dom("option","Non précisée");option.value="";select.append(option);for(const c of DATA.conditions){option=dom("option",c.name);option.value=c.name;select.append(option);}select.value=old;}
function renderConditions(){const out=$("conditions-list");out.replaceChildren();if(!DATA.conditions.length)blank(out,"Aucune maladie connue enregistrée.");else DATA.conditions.forEach(c=>record(out,c.name,"Information saisie par vous",c.notes,"conditions",c.id));}
function renderMeds(){const out=$("med-list");out.replaceChildren();if(!DATA.medications.length)blank(out,"Aucun médicament ou traitement déclaré.");else DATA.medications.forEach(m=>record(out,m.name,[m.dose&&"Dose déclarée : "+m.dose,m.schedule&&"Fréquence : "+m.schedule,m.reminderTime&&"Rappel quotidien : "+m.reminderTime,m.prescriber&&"Prescripteur : "+m.prescriber].filter(Boolean).join(" · "),m.notes,"medications",m.id));renderReminders();}
function renderAppointments(){const out=$("appts-list");out.replaceChildren();if(!DATA.appointments.length)blank(out,"Aucun rendez-vous enregistré.");else [...DATA.appointments].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).forEach(a=>record(out,a.title,a.date+(a.time?" à "+a.time:"")+(a.place?" · "+a.place:""),a.questions&&"Questions : "+a.questions,"appointments",a.id));}
function renderLibrary(){const out=$("library-list");out.replaceChildren();for(const d of LIBRARY){const c=dom("article");c.append(dom("h3",d.title),dom("p",d.answer),dom("small",d.source+" · "+d.date));const link=dom("a","Voir la source");link.href=d.url;link.target="_blank";link.rel="noopener noreferrer";c.append(link);out.append(c);}}
function bubble(body,role,source,references=[]){
 const b=dom("div",body,"bubble"+(role==="user"?" user":""));
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
 return b;
}
function setEngineNote(message){
 const node=$("chat-engine-state");if(node)node.textContent=message;
}
function updateEngineNote(){
 const state=llmStatus(),enabled=$("gemma-use")?.checked;
 setEngineNote((state.ready?(enabled?"IA locale active : "+state.modelId:"IA chargée mais désactivée : activez-la dans les options."):"Assistant documentaire actif · IA générative non chargée dans cette session.")+
 (networkEnabled?" · Internet : activé avec confirmation":" · Internet : désactivé")+(mistralStatus().connected?" · Mistral : connecté":""));
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
function renderChat(){const out=$("messages");out.replaceChildren();if(!DATA.conversations.length)out.append(bubble("Bonjour. Je peux vous aider à organiser vos tâches et consulter des informations médicales sourcées. Qu'aimeriez-vous faire aujourd'hui ?","bot"));else DATA.conversations.slice(-100).forEach(m=>out.append(bubble(m.body,m.role,m.sourceId,m.references)));out.scrollTop=out.scrollHeight;}
function localVoice(){return "speechSynthesis" in window?speechSynthesis.getVoices().find(v=>v.localService===true&&v.lang.toLowerCase().startsWith("fr")):null;}
function speak(message){if(!voice)return;const selected=localVoice();if(!selected){notify("Aucune voix française explicitement locale n'est disponible. La lecture a été désactivée.");voice=false;$("voice-toggle").textContent="Voix : off";return;}try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);u.lang="fr-FR";u.voice=selected;u.rate=.92;speechSynthesis.speak(u);}catch(e){notify("Synthèse vocale indisponible.");}}
async function ask(q){
 const input=text(q,2000);if(!input||!db||busyChat)return;
 busyChat=true;
 const button=$("chat-form").querySelector('button[type="submit"]'),prompt=$("prompt");
 button.disabled=true;prompt.disabled=true;
 setEngineNote("Traitement de la question…");
 try{
  const intent=classifyIntent(input),response=reply(input,LIBRARY,{...DATA,energy});
  let answer=response.message+(response.followup?"\n\n"+response.followup:""),sourceId=response.sources?.[0]?.id||"";
  let engine="Assistant documentaire local",references=[],onlineAttempted=false,mistralAttempted=false;
  // Consentement au réseau valable pour cette session, puis validation de chaque
  // question exacte. Pas de synchronisation du coffre ni de recherche médicale libre.
  if(intent==="general"&&networkEnabled&&isOnlineEligible(input)&&["refusal","followup"].includes(response.kind)){
   const servers=selectPublicProviders(input).map(id=>PUBLIC_PROVIDERS.find(p=>p.id===id)?.name).filter(Boolean).join(" et ");
   if(confirm("Recherche Internet facultative sur "+servers+" ?\n\nQuestion envoyée telle quelle aux services publics :\n« "+input+" »\n\nNe poursuivez pas si votre question contient une information personnelle ou médicale.")){
    onlineAttempted=true;setEngineNote("Recherche en cours sur les sources publiques…");
    try{
     const responseOnline=await searchPublicQuestion(input);
     answer=formatPublicAnswer(responseOnline);
     references=responseOnline.results.map(r=>({provider:r.provider,title:r.title,url:r.url,date:r.date}));
     if(references.length&&$("source-synthesis").checked&&$("gemma-use").checked&&llmStatus().ready){
      setEngineNote("Rédaction de la synthèse depuis les extraits publics (IA locale)…");
      try{
       const synthesis=await summarizePublicSources(input,responseOnline.results);
       answer="Synthèse IA locale à vérifier dans les sources ci-dessous :\n"+synthesis+"\n\n"+answer;
      }catch(error){notify("Synthèse locale impossible : extraits documentaires conservés.");}
     }
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
   if($("gemma-use").checked&&llmStatus().ready&&canPlanWithGemma(input)){
    setEngineNote("IA locale : classement des tâches en cours…");
    try{answer=await generateLifePlan(input,{energy,tasks:DATA.tasks})+"\n\n[Suggestion de classement générée localement.]";engine="IA locale : "+llmStatus().modelId;}
    catch(error){engine="Agent activités et énergie (repli local)";notify("Le classement IA a échoué : plan local conservé.");}
   }
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
  }else if(intent==="medical"&&response.kind!=="profile"&&response.kind!=="refusal"&&response.kind!=="urgent"&&response.kind!=="life"){
   const id=routeSpecialist(input);
   if(id){const specialist=runSpecialist(id,{...DATA,energy},input);answer=specialist.answer;sourceId=specialist.sourceId;engine="Agent "+specialist.name;}
  }
  if(intent==="general"&&!onlineAttempted&&["refusal","followup"].includes(response.kind)&&$("mistral-use").checked&&mistralStatus().connected){
   const ok=confirm("Envoyer UNIQUEMENT cette question à l'API Mistral AI ?\n\n« "+input+" »\n\nAucun historique, symptôme, médicament ou dossier n'est transmis. Votre clé API sert à l'authentification ; cette requête peut être facturée et soumise aux règles du prestataire.");
   if(ok){
    setEngineNote("Mistral AI : génération distante en cours…");
    try{
     const result=await generateMistralChat(input,[],{model:$("mistral-model").value});
     answer=result.text+"\n\n[Réponse de Mistral AI, non vérifiée et sans accès au dossier médical.]";
     sourceId="";references=[];engine="Mistral AI : "+result.model;mistralAttempted=true;
    }catch(error){
     notify("Mistral indisponible : "+String(error.message).slice(0,145)+" ; repli local.");
     setEngineNote("Mistral indisponible : repli documentaire/local");
    }
   }
  }
  if(intent==="general"&&!onlineAttempted&&!mistralAttempted&&["refusal","followup"].includes(response.kind)&&$("gemma-use").checked&&llmStatus().ready){
   setEngineNote("IA locale : génération de la réponse en français…");
   try{answer=await generateGeneralChat(input,DATA.conversations);sourceId="";engine="IA locale : "+llmStatus().modelId;}
   catch(error){
    engine="Assistant documentaire (repli : IA en échec)";
    setEngineNote("Échec de génération : "+String(error.message).slice(0,180)+". Réponse de secours affichée.");
    notify("Impossible de générer avec le modèle local. Utilisez « Tester l’IA » dans les options.");
   }
  }
  if(intent==="general"&&!onlineAttempted&&!mistralAttempted&&!($("gemma-use").checked&&llmStatus().ready)&&response.kind==="refusal"){
   answer="Je ne dispose pas d'une réponse documentée pour cette question. Activez la recherche Internet, un modèle IA local ou Mistral facultatif pour les questions générales. Je préfère ne pas inventer de faits.";
   engine="Assistant local : absence de source";
  }
  await put(db,"conversations",{role:"user",body:input,time:Date.now(),purpose:intent==="general"?"general-local":intent});
  DATA.conversations.push({role:"user",body:input,time:Date.now(),purpose:intent==="general"?"general-local":intent});
  const b={role:"bot",body:answer,time:Date.now(),sourceId,references,purpose:intent==="general"?"general-local":intent};
  await put(db,"conversations",b);DATA.conversations.push(b);
  renderChat();tab("chat");speak(answer);lastSpeech=answer;
  if(engine!=="Assistant documentaire (repli : IA en échec)")setEngineNote("Dernière réponse : "+engine+".");
  if(response.kind==="urgent")notify("Une situation potentiellement urgente a été évoquée.");
 }catch(e){
  console.error(e);
  setEngineNote("Erreur de conversation : "+String(e?.message||e).slice(0,170));
  notify("Impossible de traiter la question.");
 }finally{
  busyChat=false;button.disabled=false;prompt.disabled=false;
 }
}
function showLocalAnswer(answer){
 if(!db)return;
 lastSpeech=answer;
 // Ces cartes ne font pas l'objet d'une nouvelle collecte clinique ; rendu textContent uniquement.
 const out=$("messages");out.append(bubble(answer,"bot"));out.scrollTop=out.scrollHeight;
 tab("chat");speak(answer);
}
function renderReminders(){const out=$("due-reminders");out.replaceChildren();const due=dueReminders(DATA.medications,DATA.medicationLogs);if(!due.length){blank(out,"Aucune prise à confirmer maintenant.");return;}for(const x of due){const row=dom("div",undefined,"record"),left=dom("div"),buttons=dom("div",undefined,"actions");left.append(dom("strong",x.name),dom("small","Heure prévue : "+x.time+" (déclarée)"));buttons.append(action("Pris","reminder","taken",x.medicationId),action("Ignoré","reminder","skipped",x.medicationId));row.append(left,buttons);out.append(row);if(!seen.has(x.key)){seen.add(x.key);notify("Un rappel de traitement est à vérifier dans FibroBot.");if("Notification" in window&&Notification.permission==="granted"&&document.visibilityState==="visible"){try{new Notification("FibroBot • rappel",{body:"Consultez votre prise planifiée dans FibroBot.",tag:"fibrobot-"+x.key});}catch(e){/* Indisponible sur certaines PWA */}}}}}
async function write(store,entity,form){const id=Number(form.dataset.edit||0);if(id){const old=DATA[store].find(x=>x.id===id);if(!old)throw Error("Enregistrement introuvable.");entity={...old,...entity,id};}await put(db,store,entity);form.reset();form.dataset.edit="";$("health-date").value=today();$("appt-date").value=today();await reload();notify(id?"Modifications conservées.":"Information enregistrée sur cet appareil.");}
function edit(store,id){const x=DATA[store].find(x=>x.id===id);if(!x)return;tab(store==="symptoms"?"health":store==="medications"?"medications":store);const f=$(FORMS[store]);f.dataset.edit=id;const values=store==="tasks"?{"task-name":x.title,"task-effort":x.effort,"task-priority":x.priority,"task-due":x.due||""}:store==="symptoms"?{"health-name":x.name,"health-date":String(x.date).slice(0,10),"health-condition":x.condition||"","pain":x.intensity,"health-energy":x.energy??"","fatigue":x.fatigue??"","sleep":x.sleep??"","health-notes":x.notes||""}:store==="conditions"?{"condition-name":x.name,"condition-notes":x.notes||""}:store==="medications"?{"med-name":x.name,"med-dose":x.dose||"","med-schedule":x.schedule||"","med-prescriber":x.prescriber||"","med-reminder-time":x.reminderTime||"","med-notes":x.notes||""}:{"appt-name":x.title,"appt-date":x.date,"appt-time":x.time||"","appt-place":x.place||"","appt-questions":x.questions||""};for(const [id,value] of Object.entries(values))$(id).value=value;f.scrollIntoView({behavior:"smooth",block:"start"});f.querySelector("input")?.focus({preventScroll:true});notify("Mode modification : enregistrez pour conserver les changements.");}
async function command(btn){const method=btn.dataset.action,store=btn.dataset.store,id=Number(btn.dataset.id);if(method==="reminder"){await put(db,"medicationLogs",reminderLog(id,store));await reload();notify(store==="taken"?"Prise déclarée enregistrée.":"Rappel ignoré.");return;}if(!DATA[store]||!Number.isInteger(id))return;if(method==="edit"){edit(store,id);return;}const item=DATA[store].find(x=>x.id===id);if(!item)return;if(method==="toggle"&&store==="tasks"){await put(db,"tasks",{...item,done:!item.done});await reload();return;}if(method==="delete"&&confirm("Supprimer définitivement cet enregistrement ?")){await del(db,store,id);if(store==="medications")for(const x of DATA.medicationLogs.filter(x=>x.medicationId===id))await del(db,"medicationLogs",x.id);await reload();notify("Enregistrement supprimé.");}}
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
 $("med-form").addEventListener("submit",async e=>{e.preventDefault();try{await write("medications",makeMedication({name:val("med-name"),dose:val("med-dose"),schedule:val("med-schedule"),reminderTime:val("med-reminder-time"),prescriber:val("med-prescriber"),notes:val("med-notes")}),e.currentTarget);}catch(err){notify(err.message);}});
 $("appt-form").addEventListener("submit",async e=>{e.preventDefault();try{await write("appointments",makeAppointment({title:val("appt-name"),date:val("appt-date"),time:val("appt-time"),place:val("appt-place"),questions:val("appt-questions")}),e.currentTarget);}catch(err){notify(err.message);}});
 $("chat-form").addEventListener("submit",async e=>{e.preventDefault();if(busyChat){notify("Une réponse est déjà en cours.");return;}const q=val("prompt");$("prompt").value="";await ask(q);});
}
function breathing(){const out=$("breath-guide"),button=$("breath-start");if(timer){clearInterval(timer);timer=null;out.textContent="Exercice arrêté. Reposez-vous à votre rythme.";button.textContent="Démarrer un exercice doux";return;}let seconds=0;button.textContent="Arrêter l'exercice";out.textContent="Installez-vous confortablement. Respirez naturellement.";timer=setInterval(()=>{seconds++;const phase=seconds%12;out.textContent=phase<4?"Inspirez doucement, sans forcer.":phase<9?"Expirez tranquillement, sans retenir votre souffle.":"Restez à votre rythme. Si cela vous gêne, arrêtez.";if(seconds>=72){clearInterval(timer);timer=null;button.textContent="Démarrer un exercice doux";out.textContent="Exercice terminé. Vous pouvez vous reposer.";}} ,1000);}
function events(){
 $("mistral-connect").addEventListener("click",()=>{
  try{
   connectMistral($("mistral-key").value);$("mistral-key").value="";
   $("mistral-use").disabled=false;$("mistral-use").checked=false;
   $("mistral-test").disabled=false;$("mistral-disconnect").disabled=false;
   $("mistral-status").textContent="Clé active dans cette session. Testez la connexion. L'envoi des questions exige toujours votre accord.";
   updateEngineNote();
  }catch(e){$("mistral-status").textContent="Connexion refusée : "+e.message;}
 });
 $("mistral-test").addEventListener("click",async()=>{
  if(!mistralStatus().connected)return;
  if(!confirm("Tester Mistral en envoyant une question d'arithmétique publique ? Cette requête peut être facturée."))return;
  const button=$("mistral-test");button.disabled=true;$("mistral-status").textContent="Test API Mistral en cours…";
  try{
   const result=await testMistralConnection({model:$("mistral-model").value});
   $("mistral-status").textContent="Mistral a répondu au test : "+result.model+". Cochez l'utilisation pour vos conversations générales.";
  }catch(e){
   $("mistral-status").textContent="Échec du test : "+e.message+". Le modèle local reste disponible.";
   $("mistral-use").checked=false;
  }finally{button.disabled=!mistralStatus().connected;}
 });
 $("mistral-disconnect").addEventListener("click",()=>{
  disconnectMistral();$("mistral-key").value="";$("mistral-use").checked=false;$("mistral-use").disabled=true;
  $("mistral-test").disabled=true;$("mistral-disconnect").disabled=true;
  $("mistral-status").textContent="Clé effacée de la mémoire de cette session.";updateEngineNote();
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
  const output=b.dataset.assistantAction==="plan"?planDaily({...DATA,energy}):b.dataset.assistantAction==="summary"?summarizeObservations(DATA):prepareVisit(DATA);
  showLocalAnswer(output);
 }else if(b.dataset.action)command(b).catch(err=>notify(err.message));});
 $("daily-energy").addEventListener("input",e=>{energy=Number(e.target.value);$("energy-out").textContent=energy+"/10";$("energy-guide").textContent=energyGuide(energy).description;renderTasks();});
 $("daily-energy").addEventListener("change",async()=>{try{await put(db,"settings",{id:"energy",value:energy});}catch(e){notify("Énergie non sauvegardée.");}});
 $("voice-toggle").addEventListener("click",()=>{if(!voice&&!localVoice()){notify("Aucune voix française garantie locale sur cet appareil. Aucune voix en ligne n'est activée.");return;}voice=!voice;$("voice-toggle").textContent="Voix : "+(voice?"activée":"off");$("voice-toggle").setAttribute("aria-pressed",String(voice));if(!voice&&"speechSynthesis" in window)speechSynthesis.cancel();});
 $("mic").addEventListener("click",async()=>{const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech||typeof Speech.available!=="function"){notify("Reconnaissance vocale strictement locale non vérifiable ici. Utilisez le clavier de l'appareil ; sa dictée suit les règles du fabricant.");return;}try{const availability=await Speech.available({langs:["fr-FR"],processLocally:true});if(availability!=="available"){notify("Modèle de dictée locale non installé ou indisponible.");return;}const recognition=new Speech();recognition.processLocally=true;recognition.lang="fr-FR";recognition.onresult=e=>{$("prompt").value=e.results[0][0].transcript;notify("Texte dicté localement. Vérifiez-le avant d'envoyer.");};recognition.onerror=()=>notify("La dictée locale n'a pas abouti.");recognition.start();}catch(e){notify("Dictée locale indisponible sur ce navigateur.");}});
 $("export").addEventListener("click",()=>exportBackup().catch(e=>notify("Export impossible : "+e.message)));
 $("print-report").addEventListener("click",printReport);
 $("erase").addEventListener("click",async()=>{if(!confirm("Supprimer définitivement toutes les données FibroBot de ce navigateur ?"))return;try{db.close();await wipeDB();location.reload();}catch(e){notify("Effacement bloqué : "+e.message);}});
 $("notification-permission").addEventListener("click",async()=>{if(!("Notification" in window)||typeof Notification.requestPermission!=="function"){notify("Notifications non disponibles ici. Gardez une alarme système pour les prises essentielles.");return;}try{const state=await Notification.requestPermission();notify(state==="granted"?"Notifications autorisées tant que le navigateur le permet.":"Notifications non autorisées. Les rappels restent visibles dans FibroBot.");}catch(e){notify("Notifications non prises en charge.");}});
 $("llm-check").addEventListener("click",async()=>{
  const button=$("llm-check");button.disabled=true;
  $("llm-device").textContent="Vérification du GPU et consultation du catalogue WebLLM…";
  try{
   const cap=await detectWebGPU();if(!cap.supported)throw Error(cap.reason);
   if(!confirm("Vérifier le catalogue des modèles locaux ? Cette action télécharge seulement le moteur WebLLM depuis son hébergeur. Elle ne télécharge aucun poids de modèle et n'envoie aucune donnée patient."))return;
   const models=await listLocalModels();
   const select=$("local-model-select");
   select.querySelectorAll("option[data-dynamic]").forEach(x=>x.remove());
   for(const entry of models.filter(x=>x.estimatedMB===null||x.estimatedMB<5000).sort((a,b)=>(a.estimatedMB||99999)-(b.estimatedMB||99999)).slice(0,35)){
    const option=document.createElement("option");option.dataset.dynamic="1";option.value=entry.id;
    option.textContent=entry.id+(entry.estimatedMB?" · VRAM ~"+Math.round(entry.estimatedMB)+" Mo":" · VRAM inconnue");
    select.append(option);
   }
   $("llm-device").textContent=models.length+" modèles répertoriés · WebGPU disponible · shader-f16 "+(cap.f16?"oui":"non")+". Sélectionnez un modèle adapté à la mémoire de votre appareil.";
  }catch(error){$("llm-device").textContent="Modèles non vérifiés : "+error.message;}
  finally{button.disabled=false;}
 });
 $("gemma-load").addEventListener("click",async()=>{
   const button=$("gemma-load"),cancel=$("gemma-cancel"),progress=$("gemma-progress"),status=$("gemma-status");
   button.disabled=true;status.textContent="Vérification WebGPU…";
   try{
    const cap=await detectWebGPU();if(!cap.supported)throw Error(cap.reason);
    const desired=$("local-model-select").value;
    if(!confirm("Télécharger un modèle IA local"+(desired==="auto"?" léger":desired==="gemma"?" Gemma 4":" sélectionné")+" ? Les poids peuvent faire plusieurs Go et saturer la mémoire GPU. Le calcul a lieu sur cet appareil ; le modèle ne reçoit aucun dossier médical."))return;
    progress.hidden=false;progress.value=0;cancel.hidden=false;cancel.disabled=false;
    const result=await loadGemma({variant:$("gemma-variant").value,model:desired,onProgress:p=>{
     status.textContent=p.text||"Chargement du modèle local…";
     if(Number.isFinite(p.progress))progress.value=Math.max(0,Math.min(1,p.progress));
    }});
    $("gemma-use").disabled=false;$("gemma-use").checked=true;
    $("gemma-unload").disabled=false;$("llm-test").disabled=false;
    status.textContent="Modèle chargé et activé : "+result.modelId+". Testez maintenant la génération pour vérifier qu'il répond.";
    updateEngineNote();
    notify("Modèle local activé. Appuyez sur « Tester la réponse IA » pour vérifier l'inférence.");
   }catch(error){
    $("gemma-use").checked=false;$("gemma-use").disabled=true;
    $("gemma-unload").disabled=true;$("llm-test").disabled=true;updateEngineNote();
    status.textContent="Le modèle n'a pas été chargé : "+error.message+" Le mode sans IA reste disponible. Essayez « Léger automatique » ou un autre navigateur.";
    notify("Échec du modèle : FibroBot reste utilisable.");
   }finally{button.disabled=false;progress.hidden=true;cancel.hidden=true;cancel.disabled=true;}
 });
 $("gemma-cancel").addEventListener("click",()=>{if(cancelGemmaLoad())$("gemma-status").textContent="Chargement annulé ; vous pouvez garder le mode sans IA ou choisir un modèle léger.";});
 $("gemma-use").addEventListener("change",updateEngineNote);
 $("llm-test").addEventListener("click",async()=>{
  const button=$("llm-test");button.disabled=true;
  $("gemma-status").textContent="Test de génération réelle en cours (sans aucune donnée patient)…";
  try{
   const check=await testLocalModel();
   $("gemma-status").textContent="Test réussi : "+check.modelId+" a généré une réponse en "+(check.durationMs/1000).toFixed(1)+" s. L'IA est active pour les questions générales.";
   setEngineNote("Test de génération IA réussi : modèle opérationnel dans cette session.");
  }catch(error){
   $("gemma-status").textContent="Test de génération échoué : "+error.message+". Réessayez avec le modèle léger ou un navigateur compatible.";
   setEngineNote("Modèle chargé, mais inférence en échec : "+String(error.message).slice(0,130));
  }finally{button.disabled=!llmStatus().ready;}
 });
 $("gemma-unload").addEventListener("click",async()=>{
  try{await unloadGemma();$("gemma-use").checked=false;$("gemma-use").disabled=true;$("gemma-unload").disabled=true;$("llm-test").disabled=true;updateEngineNote();$("gemma-status").textContent="Modèle déchargé ; assistant local documentaire toujours disponible.";}
  catch(error){notify("Déchargement impossible : "+error.message);}
 });
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
 $("lock-vault").addEventListener("click",()=>{if(!confirm("Verrouiller le coffre et quitter cette session ?"))return;db?.close();location.reload();});
 $("breath-start")?.addEventListener("click",breathing);
 $("relax-script")?.addEventListener("click",()=>{
   const script="Vous pouvez arrêter à tout moment. Installez-vous si possible dans une position confortable. Prenez conscience des points de contact de votre corps avec le support. Laissez votre respiration trouver son rythme naturel, sans la forcer. Observez les sons autour de vous. Si vous ressentez de l'inconfort, ouvrez les yeux et arrêtez. Vous n'avez rien à réussir. Quel petit geste pourrait rendre cet instant plus confortable ?";
   if(!voice){notify("Activez d'abord « Voix » dans l'en-tête si votre appareil dispose d'une voix française locale.");return;}
   speak(script);
 });
}
async function init(){
 renderSpecialists();updateEngineNote();
 $("today-date").textContent=new Intl.DateTimeFormat("fr-FR",{dateStyle:"long"}).format(new Date());
 $("health-date").value=today();$("appt-date").value=today();
 forms();events();
 patientUX=setupPatientUX({navigate:tab,getSettings:()=>DATA.settings,saveSetting:async(id,value)=>{
   if(!db)throw Error("Déverrouillez d'abord le coffre.");
   await put(db,"settings",{id,value});
   const i=DATA.settings.findIndex(s=>s.id===id);
   if(i<0)DATA.settings.push({id,value});else DATA.settings[i]={id,value};
 },notify});
 try{db=await openSecureDB();await reload();setInterval(()=>{if(document.visibilityState==="visible"&&db)renderReminders();},30000);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&db)renderReminders();});}
 catch(e){console.error(e);notify("Stockage local indisponible : l'application ne peut pas enregistrer vos données. Autorisez le stockage pour ce site.");}
 if("serviceWorker" in navigator&&window.isSecureContext){navigator.serviceWorker.register("./sw.js").catch(()=>{/* hors ligne facultatif */});}
}
document.addEventListener("DOMContentLoaded",init);
