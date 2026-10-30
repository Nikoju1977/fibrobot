// Tests d'intégration navigateur SANS poids Gemma (plusieurs Go).
import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({acceptDownloads:true});
const page=await context.newPage();
const URL="http://127.0.0.1:8765";
function storedArchive(entries){
 const locals=[],centrals=[];let offset=0;
 for(const [name,content] of entries){
  const n=Buffer.from(name,"utf8"),data=Buffer.from(content,"utf8");
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(n.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
  central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(n.length,28);central.writeUInt32LE(offset,42);
  locals.push(local,n,data);centrals.push(central,n);offset+=local.length+n.length+data.length;
 }
 const cd=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,cd,end]);
}
const secret="phrase de controle longue et unique 2026";
const value="Observation test chiffrée";
try{
 await page.goto(URL,{waitUntil:"networkidle"});
 await page.locator("#vault-gate").waitFor({state:"visible"});
 // Deux onglets ayant ouvert le formulaire de création ne doivent jamais s'écraser.
 const rival=await context.newPage();
 await rival.goto(URL,{waitUntil:"networkidle"});
 await rival.locator("#vault-gate").waitFor({state:"visible"});

 await page.locator("#vault-password").fill(secret);
 await page.locator("#vault-confirm-password").fill(secret);
 await page.locator("#vault-ack").check();
 await page.locator("#vault-single-patient").check();
 await page.locator("#vault-submit").click();
 await page.locator("#vault-gate").waitFor({state:"hidden",timeout:20000});
 await page.locator('#nav [data-tab="privacy"]').click();
 assert.equal(await page.locator("#auto-lock-minutes").inputValue(),"15","Secure default inactivity timeout");
 await page.locator("#auto-lock-minutes").selectOption("30");
 await page.locator("#auto-lock-status").getByText(/30 minutes/).waitFor({timeout:15000});
 await page.locator('#nav [data-tab="today"]').click();
 await rival.locator("#vault-password").fill("une autre phrase secrète longue");
 await rival.locator("#vault-confirm-password").fill("une autre phrase secrète longue");
 await rival.locator("#vault-ack").check();
 await rival.locator("#vault-single-patient").check();
 await rival.locator("#vault-submit").click();
 await rival.locator("#vault-error").getByText(/coffre existe déjà|autre onglet/i).waitFor({timeout:20000});
 await rival.close();
 await page.locator("#first-steps").waitFor({state:"visible",timeout:10000});
 assert.equal(await page.locator("#first-steps .step-card").count(),3,"Three simple patient onboarding steps must be visible");
 assert.equal(await page.getByText("Studio Niko Design").first().count(),1,"Designer credit must be visible");
 await page.locator("#dismiss-guide").click();
 await page.locator("#first-steps").waitFor({state:"hidden",timeout:10000});
 await page.locator("#install-app").click();
 assert.match(await page.locator("#install-status").textContent(),/Android|installer|installée|accueil/i);
 // V25: appointment reminder visible in the encrypted home dashboard.
 const tomorrow=await page.evaluate(()=>{
  const d=new Date();d.setDate(d.getDate()+1);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
 });
 await page.locator('#nav [data-tab="appointments"]').click();
 await page.locator("#appt-name").fill("Consultation V25 privée");
 await page.locator("#appt-date").fill(tomorrow);
 await page.locator("#appt-form button[type=submit]").click();
 await page.locator('#nav [data-tab="today"]').click();
 await page.locator("#upcoming-appointments").getByText("Consultation V25 privée").waitFor({timeout:10000});
 const [ics]=await Promise.all([
  page.waitForEvent("download"),
  page.locator('#upcoming-appointments button[data-calendar-id]').first().click()
 ]);
 assert.match(ics.suggestedFilename(),/^fibrobot-rendez-vous-\d{4}-\d{2}-\d{2}\.ics$/);
 assert.ok(!ics.suggestedFilename().includes("Consultation"),"Calendar export filename must not leak a medical topic");
 // Internet : jamais d'appel sans double consentement explicite,
 // requête seule (pas de note patient), citations vérifiables et mode local intact.
 await page.locator('#nav [data-tab="chat"]').click();
 // Nouvelle expérience : la discussion est la première section visible.
 assert.equal(await page.locator("#chat-form textarea#prompt").count(),1,"Multiline composer");
 assert.ok((await page.locator("#agnes-options").boundingBox()).y <
  (await page.locator("#chat .chat-card").boundingBox()).y,"Agnes setup shown before chat");
 assert.equal(await page.locator("#mistral-options").isVisible(),false,"Advanced settings hidden in simple mode");
 assert.equal(await page.locator("#v30-advanced-toggle").getAttribute("aria-expanded"),"false");
 assert.equal(await page.locator(".v31-agent-buttons button").count(),9,"General plus eight specialist agents");
 assert.equal(await page.locator("#v31-ambient-controls").count(),0,"Audio controls use class, not a phantom ID");
 assert.equal(await page.locator(".v31-ambient-controls button[data-ambient]").count(),5,"Five browser-only soundscapes");
 assert.equal(await page.locator("#v31-ambient-volume").inputValue(),"25");
 await page.locator("#v31-ambient-volume").evaluate(el=>{el.value="30";el.dispatchEvent(new Event("input",{bubbles:true}));});
 assert.match(await page.locator(".v31-ambient-panel").textContent(),/Volume sonore : 30 %/);
 assert.equal(await page.locator("#v31-ambient-status").textContent(),"Aucune ambiance en lecture.");
  assert.equal(await page.locator("#v32-breath-mode").inputValue(),"calm");
  assert.equal(await page.locator("#v32-breath-duration").inputValue(),"2");
  await page.locator("#v32-breath-start").click();
  assert.equal(await page.locator("#v32-breath-start").isDisabled(),true);
  assert.match(await page.locator("#v32-breath-status").textContent(),/Inspirez doucement/);
  await page.locator("#v32-breath-stop").click();
  assert.equal(await page.locator("#v32-breath-start").isDisabled(),false);
  assert.match(await page.locator("#v32-breath-status").textContent(),/arrêtée/);

 assert.equal(await page.locator("#v31-watch").isChecked(),false,"No feed monitoring without consent");
 assert.equal(await page.locator("#v31-live-consent").isChecked(),false,"No public API without consent");
 await page.locator("#v30-advanced-toggle").click();
 assert.equal(await page.locator("#chat-voice-toggle").getAttribute("aria-pressed"),"false");
 assert.equal(await page.locator("#chat-memory-optin").isChecked(),false,"Session memory must be opt-in");
 assert.equal(await page.locator("#sources-first").isChecked(),false,"Sourced search must be opt-in");
 // V26: encrypted preference is opt-in and cannot contain clinical information.
 assert.equal(await page.locator("#preference-share").isChecked(),false);
 await page.locator("#general-preference").fill("Je préfère des réponses claires et des exemples.");
 await page.locator("#preference-save").click();
 await page.locator("#preference-status").getByText(/coffre chiffré/i).waitFor({timeout:15000});
 await page.locator("#preference-share").check();
 await page.locator("#api-budget-select").selectOption("5");
 assert.match(await page.locator("#api-budget-status").textContent(),/5 restant/);
 await page.locator("#api-budget-select").selectOption("20");
 await page.locator("#easy-reading").check();
 assert.equal(await page.locator("body").evaluate(e=>e.classList.contains("easy-reading")),true);
 await page.locator("#reading-size").selectOption("extra");
 assert.equal(await page.locator("body").getAttribute("data-reading-size"),"extra");
 await page.locator("#easy-reading").uncheck();
 await page.locator("#chat-memory-optin").check();
 assert.match(await page.locator("#chat-memory-state").textContent(),/prochains échanges/i);
 await page.locator("#chat-memory-clear").click();
 assert.match(await page.locator("#chat-memory-state").textContent(),/effacée/i);
 await page.locator("#chat-memory-optin").uncheck();
 assert.equal(await page.locator("#chat-memory-optin").isChecked(),false);
 await page.locator("#chat-voice-speed").selectOption("1.15");
 assert.equal(await page.locator("#chat-voice-speed").inputValue(),"1.15");
 await page.locator("#v28-quiet-toggle").click();
 assert.equal(await page.locator("#v28-quiet-toggle").getAttribute("aria-pressed"),"true");
 assert.equal(await page.locator("body").evaluate(e=>e.classList.contains("v28-quiet")),true);
 await page.locator("#v28-quiet-toggle").click();
 await page.locator("#chat-voice-stop").click();
 await page.locator("#chat-voice-pause").click();
 await page.locator("#chat-voice-resume").click();
 // V25: browser-service dictation must be enabled and consented to by the user.
 assert.equal(await page.locator("#dictation-browser-service").isChecked(),false);
 await page.evaluate(()=>{
  window.SpeechRecognition=class{
   start(){setTimeout(()=>{this.onresult?.({results:[[{transcript:"Phrase vocale de test"}]]});this.onend?.();},20);}
   abort(){this.onend?.();}
  };
 });
 await page.locator("#dictation-browser-service").check();
 page.once("dialog",dialog=>{assert.match(dialog.message(),/voix aux serveurs/i);dialog.accept();});
 await page.locator("#mic").click();
 await page.waitForFunction(()=>document.getElementById("prompt")?.value.includes("Phrase vocale de test"),{timeout:8000});
 assert.match(await page.locator("#prompt").inputValue(),/Phrase vocale de test/);
 await page.locator("#dictation-browser-service").uncheck();

 await page.locator('[data-assistant-action="briefing"]').click();
 await page.locator("#messages").getByText(/BILAN COORDONNÉ/).last().waitFor({timeout:10000});
 await page.locator("#book-panel summary").click();
 await page.locator("#book-file").setInputFiles({name:"rapport.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7\ncontenu de test")});
 await page.locator("#book-pdf-open").waitFor({state:"visible",timeout:10000});
 assert.match(await page.locator("#book-state").textContent(),/PDF prêt/i);
 await page.locator("#book-file").setInputFiles({name:"livre.txt",mimeType:"text/plain",buffer:Buffer.from("Mon livre privé de test.")});
 await page.locator("#book-page").getByText(/Mon livre privé de test/).waitFor({timeout:10000});
 assert.equal(await page.locator("#book-pdf-open").isVisible(),false);
 await page.locator("#v28-book-query").fill("livre");
 await page.locator("#v28-book-search").click();
 await page.locator("#v28-search-results button").getByText(/Mon livre privé/).waitFor();
 await page.locator("#v28-search-results button").first().click();
 assert.match(await page.locator("#book-page").textContent(),/Mon livre privé/);
 assert.equal(await page.locator("#v29-book-sleep").inputValue(),"0");
 await page.locator("#v29-book-sleep").selectOption("10");
 assert.equal(await page.locator("#v29-book-sleep").inputValue(),"10");
 await page.locator("#v29-book-sleep").selectOption("0");
 const docx=storedArchive([["word/document.xml",'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Chapitre DOCX privé</w:t></w:r></w:p></w:body></w:document>']]);
 await page.locator("#book-file").setInputFiles({name:"page.docx",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",buffer:docx});
 await page.locator("#book-page").getByText(/Chapitre DOCX privé/).waitFor({timeout:10000});
 const epub=storedArchive([
  ["META-INF/container.xml",'<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'],
  ["OEBPS/content.opf",'<package><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>'],
  ["OEBPS/chapter.xhtml",'<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Chapitre EPUB privé.</p></body></html>']
 ]);
 await page.locator("#book-file").setInputFiles({name:"page.epub",mimeType:"application/epub+zip",buffer:epub});
 await page.locator("#book-page").getByText(/Chapitre EPUB privé/).waitFor({timeout:10000});

 await page.locator("#prompt").fill("Une question");
 assert.match(await page.locator("#prompt-count").textContent(),/12 \/ 2000/);
 await page.locator("#prompt").press("Shift+Enter");
 assert.match(await page.locator("#prompt").inputValue(),/Une question\n/);
 await page.locator("#prompt").fill("");

 // Mode Auto (par défaut) : seul un fournisseur connecté peut être essayé ;
 // une question générale exige l'accord avant une requête distante.
 assert.equal(await page.locator("#auto-mode").isChecked(),true);
 await page.locator("#agnes-options summary").click();
 assert.equal(await page.locator("#agnes-save-key").isChecked(),true);
 assert.equal(await page.locator("#agnes-session-consent").isChecked(),false);
 await page.locator("#agnes-key").fill("une-cle-fictive-agnes-de-test");
 await page.locator("#agnes-connect").click();
 assert.equal(await page.locator("#agnes-key").inputValue(),"","Agnes key must leave the input field.");
 await page.locator("#agnes-status").getByText(/chiffrée dans le coffre/).waitFor({timeout:15000});
 let agnesCalls=0,agnesPost="";
 await page.route("https://apihub.agnes-ai.com/**",async route=>{
  if(route.request().method()==="OPTIONS"){
   await route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"authorization, content-type"}});return;
  }
  agnesCalls++;agnesPost=route.request().postData()||"";
  const isFiche=agnesPost.includes("Explique cette fiche documentaire publique");
  const responseText=isFiche?"La fibromyalgie peut s'accompagner de douleurs chroniques et de fatigue.":"La Tour Eiffel utilise du fer puddlé.";
  await route.fulfill({status:200,contentType:"application/json",
   headers:{"access-control-allow-origin":"*"},body:JSON.stringify({choices:[{message:{content:responseText}}]})});
 });
 page.once("dialog",dialog=>{assert.match(dialog.message(),/Agnes AI/);dialog.accept();});
 await page.locator("#prompt").fill("Quel matériau a été utilisé pour la Tour Eiffel ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/fer puddlé/).waitFor({timeout:12000});
 assert.equal(agnesCalls,1,"Agnes must be called with explicit consent");
 assert.equal(await page.locator("#agnes-session-consent").isChecked(),true,"Session consent recorded");
 assert.ok(!agnesPost.includes(secret),"No vault secret sent to Agnes");
 assert.deepEqual(JSON.parse(agnesPost).messages.map(x=>x.role),["system","user","assistant","user"],"Explicitly shared style preference should be visible in AI request");
 assert.ok(agnesPost.includes("Je préfère des réponses claires"),"Opted-in encrypted preference transmitted only with consent");
 assert.match(await page.locator("#api-budget-status").textContent(),/1 appel/);
 await page.locator("#preference-share").uncheck();
 page.once("dialog",dialog=>{assert.match(dialog.message(),/fiche médicale publique/);dialog.accept();});
 await page.locator("#prompt").fill("Quels sont les symptômes de la fibromyalgie ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Agnes AI — explication pédagogique/).last().waitFor({timeout:12000});
 assert.equal(agnesCalls,2,"Only a source-backed medical explanation may call Agnes");
 assert.ok(agnesPost.includes("Explique cette fiche documentaire publique"));
 assert.ok(!agnesPost.includes("Quels sont les symptômes de la fibromyalgie"),"Never send personal medical question");
 assert.ok(!agnesPost.includes(secret),"Never send the vault secret");
 // V31: weather routes directly to a public API, then optionally Agnes.
 let geoCalls=0,weatherCalls=0;
 await page.route("https://geocoding-api.open-meteo.com/**",async route=>{
  geoCalls++;
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},
   body:JSON.stringify({results:[{name:"Nantes",latitude:47.2,longitude:-1.5,country:"France"}]})});
 });
 await page.route("https://api.open-meteo.com/**",async route=>{
  weatherCalls++;
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},
   body:JSON.stringify({current:{time:"2026-10-30T14:00",temperature_2m:17,apparent_temperature:16,relative_humidity_2m:60,weather_code:2,wind_speed_10m:9},
   daily:{time:["2026-10-30","2026-10-31","2026-11-01","2026-11-02","2026-11-03","2026-11-04","2026-11-05"],temperature_2m_min:[8,7],temperature_2m_max:[20,18],precipitation_probability_max:[10,70],weather_code:[2,61]}})});
 });
 page.once("dialog",dialog=>{assert.match(dialog.message(),/données publiques actuelles/);dialog.accept();});
 await page.locator("#prompt").fill("Quelle météo à Nantes ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Météo actuelle pour Nantes/).last().waitFor({timeout:15000});
 assert.equal(geoCalls,1);
 assert.equal(weatherCalls,1);
 assert.equal(await page.locator("#v31-live-consent").isChecked(),true,"Weather session consent is opt-in");
 assert.equal(agnesCalls,2,"Weather does not call Agnes without separate grounded-rephrasing consent");
 await page.locator("#v31-agnes-grounded").check();
 await page.locator("#prompt").fill("Quelle météo à Nantes ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Données originales de la source/).last().waitFor({timeout:15000});
 assert.equal(agnesCalls,3,"Agnes can summarize opt-in source data");
 await page.locator("#agnes-disconnect").click();
 assert.equal(await page.locator("#agnes-test").isDisabled(),true);
 await page.locator("#auto-mode").uncheck();
 // Tous les scénarios de diagnostic utilisent uniquement les moteurs locaux.
 await page.locator("#assistant-diagnostics-panel summary").click();
 await page.locator("#assistant-diagnostics-run").click();
 assert.match(await page.locator("#assistant-diagnostics-state").textContent(),/Diagnostic local terminé/);
 const diagnosis=await page.locator("#assistant-diagnostics-result").textContent();
 assert.match(diagnosis,/4 scénarios locaux réussis/);
 assert.match(diagnosis,/Bibliothèque médicale locale : prêt/);
 assert.match(diagnosis,/Mistral AI : déconnecté/);
 await page.locator("#v28-device-check").click();
 assert.match(await page.locator("#assistant-diagnostics-result").textContent(),/Contexte HTTPS/);
 assert.match(await page.locator("#assistant-diagnostics-result").textContent(),/pas de garantie app fermée|Autorisation absente/);
 assert.equal(await page.locator("#network-mode").isChecked(),false,"Network must be opt-in");
 let wikipediaQueries=0;
 await page.route("https://fr.wikipedia.org/**",async route=>{
  wikipediaQueries++;
  await route.fulfill({status:200,contentType:"application/json",
   headers:{"access-control-allow-origin":"*"},
   body:JSON.stringify({query:{pages:{"102":{title:"Marie Curie",extract:"Physicienne et chimiste."}}}})});
 });
 await page.locator("#prompt").fill("Qui était Marie Curie ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Agnes AI n.a pas pu répondre/).waitFor();
 assert.equal(wikipediaQueries,0,"Network forbidden until enabled");
 await page.locator("#network-mode").check();
 page.once("dialog",dialog=>{assert.match(dialog.message(),/Qui était Marie Curie/);dialog.dismiss();});
 await page.locator("#prompt").fill("Qui était Marie Curie ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Agnes AI n.a pas pu répondre/).last().waitFor();
 assert.equal(wikipediaQueries,0,"Consent to session is not consent to send each question");
 page.once("dialog",dialog=>{assert.match(dialog.message(),/Wikipédia/);dialog.accept();});
 await page.locator("#prompt").fill("Qui était Marie Curie ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages a[href*='fr.wikipedia.org/wiki/Marie_Curie']").waitFor({timeout:12000});
 assert.equal(wikipediaQueries,1);
 assert.match(await page.locator("#chat-engine-state").textContent(),/Internet publiques/);
 const onlineText=await page.locator("#messages").textContent();
 assert.match(onlineText,/Physicienne et chimiste/);
 await page.locator("#network-mode").uncheck();
 await page.locator("#prompt").fill("Quels traitements pour ma fibromyalgie ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/recommandations|fibromyalgie|documentation/i).first().waitFor({timeout:12000});
 assert.equal(wikipediaQueries,1,"No patient question must hit Wikipedia");

 await page.locator('#nav [data-tab="health"]').click();
 await page.locator("#health-name").fill(value);
 await page.locator("#pain").fill("6");
 await page.locator("#health-form button[type=submit]").click();
 await page.locator("#health-list").getByText(value).waitFor();
 assert.match(await page.locator("#trend-summary").textContent(),/1 note/);
 assert.ok(await page.locator("#trend-chart svg circle").count()>0,"Trends must display a declared observation");
 await page.locator("#trend-metric").selectOption("fatigue");
 assert.match(await page.locator("#trend-summary").textContent(),/Aucune valeur/);
 await page.locator("#trend-metric").selectOption("intensity");
 await page.locator("#v28-health-brief").click();
 assert.match(await page.locator("#v28-health-output").textContent(),/Bilan descriptif/);
 assert.match(await page.locator("#v28-health-output").textContent(),/aucune valeur exploitable/);
 await page.locator('#nav [data-tab="medications"]').click();
 assert.equal(await page.locator("#v29-reminder-opt-in").isChecked(),false,"No foreground medication alert without opt-in");
 await page.locator("#v29-reminder-opt-in").check();
 await page.locator("#toast").getByText(/Alertes dans l'application activées/).waitFor({timeout:12000});
 assert.equal(await page.locator("#v29-reminder-opt-in").isChecked(),true);
 await page.locator("#v29-reminder-opt-in").uncheck();
 await page.locator("#toast").getByText(/Alertes de traitements désactivées/).waitFor({timeout:12000});
 // JARVIS distant : mémoire volatile, double consentement, aucun patient.
 await page.locator('#nav [data-tab="chat"]').click();
 await page.locator("#mistral-options summary").click();
 await page.locator("#mistral-key").fill("cle-fictive-de-test-non-utilisable");
 await page.locator("#mistral-save-key").check();
 await page.locator("#mistral-connect").click();
 await page.waitForFunction(()=>!document.getElementById("mistral-restore").disabled,{timeout:15000});
 assert.equal(await page.locator("#mistral-save-key").isChecked(),false,"Saving key is opt-in each time");
 assert.match(await page.locator("#mistral-status").textContent(),/chiffrée/);
 assert.equal(await page.locator("#mistral-key").inputValue(),"","The API key must leave the input after connecting.");
 await page.locator("#mistral-use").check();
 let mistralCalls=0,bodyMistral="",mistralRateLimited=false;
 await page.route("https://api.mistral.ai/**",async route=>{
  const req=route.request();
  if(req.method()==="OPTIONS"){
   await route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"authorization, content-type"}});
   return;
  }
  mistralCalls++;bodyMistral=req.postData()||"";
  const mistralPayload=JSON.parse(bodyMistral);
  const lastUser=mistralPayload.messages?.at(-1)?.content||"";
  let mockedAnswer="Voici une histoire de test sur la lune.";
  if(lastUser.includes("Explique cette fiche documentaire publique"))
   mockedAnswer="La fibromyalgie comprend notamment des douleurs persistantes et une fatigue. Ceci reste une information générale.";
  else if(lastUser.includes("sans données concernant une personne"))
   mockedAnswer="Fractionnez les activités en étapes simples, avec des pauses régulières.";

  if(mistralRateLimited){
   await route.fulfill({status:429,contentType:"application/json",
    headers:{"access-control-allow-origin":"*","access-control-expose-headers":"retry-after","retry-after":"120"},
    body:JSON.stringify({object:"error",code:"rate_limit_error",message:"Too many requests"})});
   return;
  }
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},
   body:JSON.stringify({choices:[{message:{content:mockedAnswer}}]})});
 });
 page.once("dialog",dialog=>{assert.match(dialog.message(),/histoire courte/);dialog.accept();});
 await page.locator("#prompt").fill("Raconte une histoire courte sur la lune");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/histoire de test sur la lune/).waitFor({timeout:14000});
 assert.equal(mistralCalls,1);
 // Mistral explique une fiche médicale publique sans recevoir la question patient.
 page.once("dialog",dialog=>{assert.match(dialog.message(),/Fiche publique/);dialog.accept();});
 await page.locator("#prompt").fill("Quels sont les symptômes de la fibromyalgie ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Mistral explique une fiche médicale publique/).last().waitFor({timeout:13000});
 assert.equal(mistralCalls,2,"Mistral should explain source-backed fibromyalgia guidance.");
 assert.doesNotMatch(bodyMistral,/Quels sont les symptômes de la fibromyalgie/,"Medical user question must not be sent.");
 assert.match(bodyMistral,/Explique cette fiche documentaire publique/);
 // Organisation : Mistral ne reçoit ni les tâches réelles ni le journal.
 page.once("dialog",dialog=>{assert.match(dialog.message(),/ORGANISATION|GENERIQUES/i);dialog.accept();});
 await page.locator("#prompt").fill("Comment organiser mes tâches aujourd'hui ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Conseils généraux formulés par Mistral/).last().waitFor({timeout:13000});
 assert.equal(mistralCalls,3);
 assert.doesNotMatch(bodyMistral,/Comment organiser mes tâches aujourd'hui/);
 assert.ok(!bodyMistral.includes(value),"Patient note leaked to external LLM.");
 assert.ok(!bodyMistral.includes(secret),"Vault secret leaked to external LLM.");
 assert.ok(!bodyMistral.includes("medications"),"No clinical context sent.");
 await page.locator("#prompt").fill("Quelle dose de morphine dois-je prendre ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/je ne peux pas déterminer/i).last().waitFor({timeout:10000});
 assert.equal(mistralCalls,3,"Prescription query must not invoke remote Mistral.");
 // Régression observée chez les utilisateurs : après HTTP 429, FibroBot
 // doit continuer à répondre immédiatement via ses ressources locales.
 mistralRateLimited=true;
 page.once("dialog",dialog=>{assert.match(dialog.message(),/histoire courte/);dialog.accept();});
 await page.locator("#prompt").fill("Raconte une histoire courte sur la lune");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Agnes AI n.a pas pu répondre/).last().waitFor({timeout:15000});
 assert.equal(mistralCalls,4,"One request only on 429");
 await page.waitForFunction(()=>/pause|quota/i.test(document.getElementById("mistral-status")?.textContent||""),{timeout:12000});
 assert.equal(await page.locator("#mistral-use").isChecked(),false,"Disable Mistral automatically when rate-limited");
 await page.waitForFunction(()=>!document.querySelector('#chat-form button[type="submit"]')?.disabled,{timeout:12000});
 assert.equal(await page.locator('#chat-form button[type="submit"]').isDisabled(),false,"Chat form must be re-enabled");
 await page.locator("#prompt").fill("Bonjour");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Bonjour !/).last().waitFor({timeout:10000});
 assert.equal(mistralCalls,4,"Local chat still works, no extra Mistral calls");
 assert.equal(await page.locator("#chat-local-mode").count(),0,"No visible local-mode button");
 assert.equal(await page.locator("#network-mode").isChecked(),false);
 assert.equal(await page.locator("#mistral-use").isChecked(),false);
 assert.equal(await page.locator("#auto-mode").isChecked(),false,"AI setting unchanged by 429");
 await page.locator("#prompt").fill("Quels sont les symptômes de la fibromyalgie ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/fibromyalgie/i).last().waitFor({timeout:10000});
 assert.equal(mistralCalls,4,"Documented medical reply remains fully offline after 429");
 await page.locator("#mistral-disconnect").click();
 assert.equal(await page.locator("#mistral-use").isChecked(),false);
 assert.equal(await page.locator("#mistral-restore").isDisabled(),false,"Encrypted key remains available after disconnect.");
 await page.locator("#mistral-restore").click();
 await page.waitForFunction(()=>!document.getElementById("mistral-use").disabled,{timeout:12000});
 assert.equal(mistralCalls,4,"Restoring encrypted key must not call Mistral.");
 assert.equal(await page.locator("#mistral-key").inputValue(),"","Restored secret never enters a visible field.");
 assert.match(await page.locator("#mistral-status").textContent(),/déchiffrée et activée/);
 page.once("dialog",dialog=>dialog.accept());
 await page.locator("#mistral-forget").click();
 await page.waitForFunction(()=>document.getElementById("mistral-restore").disabled,{timeout:12000});
 assert.equal(await page.locator("#mistral-forget").isDisabled(),true);
 assert.equal(await page.locator("#mistral-use").isDisabled(),true);
 assert.equal(mistralCalls,4,"Forgetting key is an offline operation.");
 await page.locator('#nav [data-tab="health"]').click();
 const envelope=await page.evaluate(async()=>{
   return await new Promise((resolve,reject)=>{
     const req=indexedDB.open("FibroBotVault-v1");
     req.onsuccess=()=>{const db=req.result;const get=db.transaction("envelopes","readonly").objectStore("envelopes").get("data");get.onsuccess=()=>{db.close();resolve(get.result);};get.onerror=()=>reject(get.error);};
     req.onerror=()=>reject(req.error);
   });
 });
 assert.equal(envelope?.algorithm,"AES-GCM-256");
 assert.ok(!JSON.stringify(envelope).includes(value),"No plaintext in vault IndexedDB");
 assert.ok(!JSON.stringify(envelope).includes("cle-fictive-de-test-non-utilisable"),"API key must never be stored in IndexedDB plaintext");
 assert.ok(!JSON.stringify(envelope).includes("une-cle-fictive-agnes-de-test"),"Agnes key must never be stored in IndexedDB plaintext");
 await page.locator('#nav [data-tab="chat"]').click();
 await page.locator("#v28-quiet-toggle").click();
 await page.locator("#toast").getByText(/Mode calme activé et conservé dans le coffre/).waitFor({timeout:12000});
 page.once("dialog",dialog=>dialog.accept());
 await page.locator("#lock-vault").click();
 await page.locator("#vault-gate").waitFor({state:"visible",timeout:15000});
 assert.equal(await page.locator("#vault-patient-wrap").isVisible(),false,"Returning patient must not be asked to create another account");
 await page.locator("#vault-password").fill("phrase volontairement incorrecte");
 await page.locator("#vault-submit").click();
 await page.waitForFunction(()=>/incorrect|endommagé/.test(document.getElementById("vault-error").textContent),{timeout:15000});
 await page.locator("#vault-password").fill(secret);
 await page.locator("#vault-submit").click();
 await page.locator("#vault-gate").waitFor({state:"hidden",timeout:15000});
 await page.locator('#nav [data-tab="privacy"]').click();
 assert.equal(await page.locator("#auto-lock-minutes").inputValue(),"30","Encrypted inactivity setting should survive lock and reopen");
 await page.waitForFunction(()=>/Agnes chargé depuis le coffre/.test(document.getElementById("agnes-status")?.textContent||""),{timeout:15000});
 await page.locator('#nav [data-tab="chat"]').click();
 await page.locator("#v30-advanced-toggle").click();
 assert.equal(await page.locator("#v28-quiet-toggle").getAttribute("aria-pressed"),"true","Calm preference must be restored from vault");
 await page.locator('#nav [data-tab="chat"]').click();
 await page.locator("#v28-quiet-toggle").click();
 await page.locator("#toast").getByText(/préférence conservée/).waitFor({timeout:12000});
 await page.locator('#nav [data-tab="today"]').click();
 await page.locator("#first-steps").waitFor({state:"hidden",timeout:10000});
 await page.locator('#nav [data-tab="chat"]').click();
 assert.equal(await page.locator("#general-preference").inputValue(),"Je préfère des réponses claires et des exemples.","Encrypted preference must survive vault lock/unlock");
 assert.equal(await page.locator("#preference-share").isChecked(),false,"Preference remote-sharing consent must be session-only");
 await page.locator('#nav [data-tab="health"]').click();
 await page.locator("#health-list").getByText(value).waitFor();
 await page.locator('#nav [data-tab="chat"]').click();
 await page.locator('#specialist-list [data-specialist="sleep"]').click();
 await page.locator("#messages").getByText(/Sommeil — assistant d'information/).waitFor({timeout:10000});
 assert.equal(await page.locator("#llm-test").count(),0,"No on-device inference controls remain");
 assert.match(await page.locator("#chat-engine-state").textContent(),/agent Sommeil/);
 await page.locator("#prompt").fill("Bonjour");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Bonjour !/).last().waitFor({timeout:10000});
 await page.locator("#prompt").fill("Quelle dose de médicament dois-je prendre ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/je ne peux pas déterminer/i).last().waitFor({timeout:10000});
 // Medical content stays on the deterministic route even if local AI options exist.
 await page.locator("#prompt").fill("Résume mes observations");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Synthèse descriptive/).last().waitFor({timeout:10000});
 await page.locator("#prompt").fill("Préparer ma consultation médicale");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/Préparation de consultation/).last().waitFor({timeout:10000});
 await page.locator("#prompt").fill("Organise mes tâches");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/tâche enregistrée|Proposition d’organisation/).last().waitFor({timeout:10000});
 assert.equal(await page.locator("#gemma-options").isVisible(),false,"Local LLM setup not exposed");
 assert.equal(await page.locator("#agnes-options").isVisible(),true,"Remote AI configuration visible");
 await page.locator('#nav [data-tab="library"]').click();
 assert.equal(await page.locator("#research-search").isVisible(),true);
 assert.equal(await page.locator("#research-topic").inputValue(),"fibromyalgia");
 // Reject network consent: there must be no Europe PMC request from a single-patient vault.
 let researchCalls=0;
 page.on("request",r=>{if(r.url().includes("ebi.ac.uk/europepmc"))researchCalls++;});
 page.once("dialog",d=>d.dismiss());
 await page.locator("#research-search").click();
 assert.equal(researchCalls,0);

 // Two open tabs must not silently overwrite the medical record.
 const sibling=await page.context().newPage();
 try{
  await sibling.goto(URL,{waitUntil:"networkidle"});
  await sibling.locator("#vault-password").fill(secret);
  await sibling.locator("#vault-submit").click();
  await sibling.locator("#vault-gate").waitFor({state:"hidden",timeout:15000});
  await page.locator('#nav [data-tab="health"]').click();
  await page.locator("#health-name").fill("Note récente du premier onglet");
  await page.locator("#health-form button[type=submit]").click();
  await page.locator("#health-list").getByText("Note récente du premier onglet").waitFor();
  await sibling.locator('#nav [data-tab="health"]').click();
  await sibling.locator("#health-name").fill("Note périmée du second onglet");
  await sibling.locator("#health-form button[type=submit]").click();
  await sibling.locator("#toast").getByText(/autre session|autre onglet|modifié le coffre/i).waitFor({timeout:15000});
  const names=await page.evaluate(async()=>new Promise((resolve,reject)=>{
    const open=indexedDB.open("FibroBotVault-v1");
    open.onsuccess=()=>{
      const db=open.result;
      const req=db.transaction("envelopes","readonly").objectStore("envelopes").get("data");
      req.onsuccess=()=>{resolve(req.result.ciphertext);db.close();};
      req.onerror=()=>reject(req.error);
    };
    open.onerror=()=>reject(open.error);
  }));
  assert.ok(names.length>100);
 }finally{await sibling.close();}
 // L'application statique et le coffre doivent aussi se déverrouiller hors ligne une fois le shell mis en cache.
 await page.evaluate(async()=>{if(!("serviceWorker" in navigator))throw Error("ServiceWorker indisponible");await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error("ServiceWorker non prêt après 15 secondes")),15000))]);});
 await context.setOffline(true);
 await page.locator("#connection-state").getByText(/Hors ligne/).waitFor({timeout:10000});
 try{
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#vault-gate").waitFor({state:"visible",timeout:15000});
  await page.locator("#vault-password").fill(secret);
  await page.locator("#vault-submit").click();
  await page.locator("#vault-gate").waitFor({state:"hidden",timeout:20000});
  await page.locator('#nav [data-tab="health"]').click();
  await page.locator("#health-list").getByText(value).waitFor({timeout:10000});
 }finally{await context.setOffline(false);}
 await page.locator("#connection-state").getByText(/Connexion disponible/).waitFor({timeout:10000});
 // Restore the encrypted backup in an independent browsing context.
 const restored=await browser.newPage();
 try{
  await restored.goto(URL,{waitUntil:"networkidle"});
  const buffer=Buffer.from(JSON.stringify({format:"FibroBotVaultEncrypted",version:1,envelope}),"utf8");
  await restored.locator("#vault-import").setInputFiles({name:"coffre-chiffre.json",mimeType:"application/json",buffer});
  await restored.locator("#vault-password").fill(secret);
  await restored.locator("#vault-ack").check();
 await restored.locator("#vault-single-patient").check();
  await restored.locator("#vault-submit").click();
  await restored.locator("#vault-gate").waitFor({state:"hidden",timeout:20000});
  await restored.locator('#nav [data-tab="health"]').click();
  await restored.locator("#health-list").getByText(value).waitFor();
 }finally{await restored.close();}
 // Migration: create a legacy database in a separate context, then opt in.
 const legacy=await browser.newPage();
 try{
  await legacy.goto(URL,{waitUntil:"networkidle"});
  await legacy.evaluate(async()=>{
   await new Promise((resolve,reject)=>{
    const request=indexedDB.open("FibrobotDB",1);
    request.onupgradeneeded=()=>{request.result.createObjectStore("symptoms",{keyPath:"id",autoIncrement:true});};
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction("symptoms","readwrite");
      tx.objectStore("symptoms").put({id:7,name:"Ancienne note",date:"2026-10-26T12:00:00",intensity:5});
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>reject(tx.error);
    };
    request.onerror=()=>reject(request.error);
   });
  });
  await legacy.reload({waitUntil:"networkidle"});
  await legacy.locator("#vault-migrate-wrap").waitFor({state:"visible",timeout:10000});
  await legacy.locator("#vault-migrate").check();
  await legacy.locator("#vault-password").fill(secret);
  await legacy.locator("#vault-confirm-password").fill(secret);
  await legacy.locator("#vault-ack").check();
 await legacy.locator("#vault-single-patient").check();
  await legacy.locator("#vault-submit").click();
  await legacy.locator("#vault-gate").waitFor({state:"hidden",timeout:20000});
  await legacy.locator('#nav [data-tab="health"]').click();
  await legacy.locator("#health-list").getByText("Ancienne note").waitFor();
  const dbs=await legacy.evaluate(async()=>typeof indexedDB.databases==="function"?await indexedDB.databases():[]);
  if(dbs.length)assert.equal(dbs.some(x=>x.name==="FibrobotDB"),false,"legacy plaintext database must be deleted");
 }finally{await legacy.close();}
 // Responsive layout smoke checks; these emulate viewport sizes, not real iOS/Android.
 for(const width of [390,834,1024]){
   await page.setViewportSize({width,height:850});
   await (width<=930?page.locator('.mobile-dock [data-tab="tasks"]'):page.locator('#nav [data-tab="tasks"]')).click();
   const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
   assert.ok(dimensions.document<=dimensions.viewport+2,"Unexpected page horizontal overflow at "+width+": "+JSON.stringify(dimensions));
 }
 console.log("Chromium vault, restore, migration, medical refusal and mobile/tablet viewport: OK");
}finally{await browser.close();}
