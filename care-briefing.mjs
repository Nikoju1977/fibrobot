/* Synthesis from user-declared records stays on the device.
 * No clinical risk scoring, dosage, causality, diagnosis or prescribing.
 */
import {summarizeObservations,planDaily} from "./assistant-engine.mjs";
import {upcomingAppointments} from "./appointment-reminders.mjs";
const trim=(v,n)=>String(v||"").replace(/[\r\n]/g," ").trim().slice(0,n);
export function coordinatedCareBriefing(context={},now=new Date()){
 const observations=Array.isArray(context.symptoms)?context.symptoms:[];
 const medications=Array.isArray(context.medications)?context.medications:[];
 const conditions=Array.isArray(context.conditions)?context.conditions:[];
 const appts=upcomingAppointments(context.appointments||[],now,14);
 const next=appts[0];
 const lines=[
  "BILAN COORDONNÉ — préparation personnelle, non médicale",
  "1. Douleur, fatigue et sommeil · synthèse descriptive",
  summarizeObservations({symptoms:observations}),
  "",
  "2. Activités et énergie · organisation à adapter",
  planDaily({tasks:context.tasks||[],energy:context.energy}),
  "",
  "3. Coordination des soins et rendez-vous",
  next?"Prochain rendez-vous déclaré : "+trim(next.title,100)+" — "+next.date+(next.time?" à "+next.time:"")+".":"Aucun rendez-vous déclaré pour les 14 prochains jours.",
  "Nombre de maladies déclarées : "+conditions.length+". Nombre de traitements déclarés : "+medications.length+".",
  "4. Préparer les questions pour l'équipe soignante",
  "Quels changements de symptômes souhaitez-vous décrire ? Quelles difficultés de sommeil et d'activité noter ? Quels traitements faire vérifier par le prescripteur ou le pharmacien ?",
  "",
  "Ces informations sont issues de vos déclarations dans FibroBot, non vérifiées cliniquement. Aucune relation de cause à effet ni ajustement thérapeutique n'est déduit. Les urgences nécessitent une aide humaine immédiate."
 ];
 return lines.join("\n").slice(0,6500);
}
