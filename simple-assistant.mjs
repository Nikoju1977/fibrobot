/**
 * FibroBot V33 — Interface centrée sur la conversation.
 * Presentation only: no automatic external requests, no weakened consent gates.
 */
export function setupSimpleAssistant({connected}){
 const byId=id=>document.getElementById(id);
 const chat=byId("chat"),hero=chat?.querySelector(".assistant-hero");
 const layout=chat?.querySelector(".chat-layout"),agnes=byId("agnes-options"),oldToggle=byId("v30-advanced-toggle");
 if(!chat||!hero||!layout||!agnes||!oldToggle)return ()=>{};
 const make=(tag,value,className)=>{
  const el=document.createElement(tag);
  if(value!==undefined)el.textContent=value;
  if(className)el.className=className;
  return el;
 };
 document.body.classList.add("v33-simple");
 const intro=make("section",undefined,"v33-start");
 intro.id="v33-start";intro.setAttribute("aria-label","Commencer la conversation");
 const title=make("h3","Écrivez ou parlez, tout simplement.");
 const explanation=make("p","FibroBot choisit automatiquement comment vous aider. Aucun agent à sélectionner.");
 const status=make("p",undefined,"v33-connection-status");
 status.id="v33-connection-status";status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 const connect=make("button","Connecter Agnes pour discuter librement","btn light");
 connect.id="v33-connect-button";connect.type="button";connect.setAttribute("aria-controls","agnes-options");
 connect.addEventListener("click",()=>{
  agnes.open=true;
  agnes.scrollIntoView({block:"start",behavior:"smooth"});
  if(!connected())byId("agnes-key")?.focus({preventScroll:true});
 });
 const crisis=make("button","J'ai besoin d'aide pendant une crise","v33-crisis-link");
 crisis.type="button";crisis.dataset.goto="crisis";
 const actions=make("div",undefined,"v33-start-actions");
 actions.append(connect,crisis);intro.append(title,explanation,status,actions);
 hero.after(intro);intro.after(layout);layout.after(agnes);
 const more=make("button","Afficher les autres outils et réglages","btn light v33-more");
 more.type="button";more.id="v33-more";more.setAttribute("aria-expanded","false");
 more.setAttribute("aria-controls","v33-extra-description");
 const description=make("p","Autres outils : modes d'écoute, suivi, bibliothèque, moteurs et réglages.","tiny");
 description.id="v33-extra-description";description.hidden=true;
 more.addEventListener("click",()=>{
  const show=document.body.classList.toggle("v33-extras");
  document.body.classList.toggle("v30-advanced",show);
  oldToggle.setAttribute("aria-expanded",String(show));
  more.setAttribute("aria-expanded",String(show));
  more.textContent=show?"Masquer les autres outils et réglages":"Afficher les autres outils et réglages";
  description.hidden=!show;
 });
 agnes.after(more,description);
 const input=byId("prompt");
 input.placeholder="Écrivez-moi votre question…";
 const helper=byId("prompt-help");
 if(helper)helper.textContent="Écrivez puis touchez Envoyer, ou utilisez le micro si disponible.";
 const heroTitle=hero.querySelector(".assistant-hero-copy h2");
 if(heroTitle)heroTitle.textContent="Bonjour, je suis FibroBot.";
 const heroText=hero.querySelector(".assistant-hero-copy p");
 if(heroText)heroText.textContent="Parlez-moi naturellement. Je vous aide dans votre quotidien et avec des informations sourcées, sans remplacer un soignant.";
 const refresh=()=>{
  const active=Boolean(connected());
  status.textContent=active
   ?"Agnes est configurée pour cette session. Les envois externes demandent toujours votre accord."
   :"Vous pouvez déjà demander une aide locale. Pour une conversation libre avec Agnes, une clé API est nécessaire.";
  connect.textContent=active?"Gérer ma connexion Agnes":"Connecter Agnes pour discuter librement";
 };
 refresh();
 return refresh;
}
