/* Guided breathing: optional wellbeing timer, never a medical treatment.
 * No microphone, no network, no patient data, no forced breath-holding.
 */
export const BREATH_PATTERNS=Object.freeze([
 Object.freeze({id:"calm",name:"Douce 5/5",inhale:5,exhale:5}),
 Object.freeze({id:"relax",name:"Détente 4/6",inhale:4,exhale:6})
]);
export const BREATH_DURATIONS=Object.freeze([2,5,10]);
export function breathingStep(elapsedMs,{pattern="calm",durationMinutes=2}={}){
 const config=BREATH_PATTERNS.find(p=>p.id===pattern);
 if(!config)throw Error("Rythme respiratoire inconnu.");
 if(!BREATH_DURATIONS.includes(Number(durationMinutes)))throw Error("Durée de séance non valide.");
 const t=Number(elapsedMs);
 if(!Number.isFinite(t)||t<0)throw Error("Temps de séance non valide.");
 const totalMs=Number(durationMinutes)*60000;
 if(t>=totalMs)return {done:true,phase:"end",label:"Séance terminée",remainingSeconds:0,elapsedSeconds:Math.floor(totalMs/1000),progress:1};
 const cycleMs=(config.inhale+config.exhale)*1000;
 const inside=t%cycleMs;
 const inhale=inside<config.inhale*1000;
 const phase=inhale?"inhale":"exhale";
 const phaseElapsed=inhale?inside:inside-config.inhale*1000;
 const phaseLength=inhale?config.inhale:config.exhale;
 return {
  done:false,phase,label:inhale?"Inspirez doucement":"Expirez sans forcer",
  phaseRemainingSeconds:Math.ceil(phaseLength-phaseElapsed/1000),
  remainingSeconds:Math.ceil((totalMs-t)/1000),
  elapsedSeconds:Math.floor(t/1000),progress:t/totalMs
 };
}
export function sessionTimeString(seconds){
 const total=Math.max(0,Math.floor(Number(seconds)||0));
 return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");
}
