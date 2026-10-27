/*
 * FibroBot — navigation et première prise en main patient.
 * Studio Niko Design. Aucune donnée clinique ni phrase secrète n'est placée
 * dans localStorage ou dans les URL : l'état de découverte est chiffré dans
 * le coffre existant, via le store settings.
 */
export const GUIDE_SETTING="onboardingComplete";
const $=id=>document.getElementById(id);
export function shouldShowGuide(settings=[]){
 return !Array.isArray(settings)||!settings.some(s=>s?.id===GUIDE_SETTING&&s.value===true);
}
export function setupPatientUX({navigate,getSettings,saveSetting,notify}){
 const side=$("app-side"),toggle=$("mobile-menu-toggle"),close=$("close-mobile-menu"),scrim=$("nav-scrim"),
       guide=$("first-steps"),openGuide=$("open-guide"),dismiss=$("dismiss-guide");
 if(!side||!toggle||!close||!scrim||!guide||!openGuide||!dismiss)throw Error("Interface UX patient incomplète.");
 let menuOpen=false,forceGuide=false,busy=false;
 const mobile=()=>window.matchMedia("(max-width: 930px)").matches;
 const applyMenu=()=>{
  const onMobile=mobile();
  if(!onMobile)menuOpen=false;
  document.body.classList.toggle("menu-open",menuOpen&&onMobile);
  side.inert=onMobile&&!menuOpen;
  side.setAttribute("aria-hidden",String(onMobile&&!menuOpen));
  scrim.hidden=!(menuOpen&&onMobile);
  toggle.setAttribute("aria-expanded",String(menuOpen&&onMobile));
 };
 function closeMenu(restoreFocus=false){const wasOpen=menuOpen;menuOpen=false;applyMenu();if(wasOpen&&restoreFocus&&mobile())toggle.focus();}
 function openMenu(){menuOpen=true;applyMenu();close.focus();}
 toggle.addEventListener("click",()=>{if(menuOpen)closeMenu(true);else openMenu();});
 close.addEventListener("click",()=>closeMenu(true));
 scrim.addEventListener("click",()=>closeMenu(true));
 $("nav").addEventListener("click",e=>{if(e.target.closest("[data-tab]"))closeMenu();});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&menuOpen)closeMenu(true);});
 const media=window.matchMedia("(max-width: 930px)");
 if(typeof media.addEventListener==="function")media.addEventListener("change",applyMenu);
 else if(typeof media.addListener==="function")media.addListener(applyMenu);
 applyMenu();
 function refreshGuide(){
  guide.hidden=!(forceGuide||shouldShowGuide(getSettings()));
  openGuide.setAttribute("aria-expanded",String(!guide.hidden));
 }
 openGuide.setAttribute("aria-controls","first-steps");
 openGuide.addEventListener("click",()=>{
  forceGuide=true;
  navigate("today");
  refreshGuide();
  $("start-title")?.focus({preventScroll:true});
  guide.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});
 });
 dismiss.addEventListener("click",async()=>{
  if(busy)return;
  busy=true;dismiss.disabled=true;
  try{
   await saveSetting(GUIDE_SETTING,true);
   forceGuide=false;
   guide.hidden=true;
   openGuide.setAttribute("aria-expanded","false");
   openGuide.focus({preventScroll:true});
   notify?.("Le guide est masqué. Vous pouvez le retrouver avec « Mode d'emploi ».");
  }catch(error){
   notify?.("Impossible de mémoriser votre choix dans le coffre. "+error.message);
  }finally{busy=false;dismiss.disabled=false;}
 });
 return {refreshGuide,closeMenu};
}
