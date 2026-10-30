/* Pure descriptive self-report statistics. No medical inference, scoring or forecasting. */
import {dailyTrend} from "./health-trends.mjs";
export function pairedWellbeingDays(rows=[],{days=14,now=new Date()}={}){
 const pain=dailyTrend(rows,{days,now,metric:"intensity"});
 const sleep=dailyTrend(rows,{days,now,metric:"sleep"});
 const fatigue=dailyTrend(rows,{days,now,metric:"fatigue"});
 return pain.points.flatMap((p,i)=>{
  const s=sleep.points[i],f=fatigue.points[i];
  if(p.value===null||s.value===null)return [];
  return [{date:p.date,pain:p.value,sleep:s.value,fatigue:f.value}];
 });
}
export function descriptiveWellbeingBrief(rows=[],{days=14,now=new Date()}={}){
 const pain=dailyTrend(rows,{days,now,metric:"intensity"});
 const energy=dailyTrend(rows,{days,now,metric:"energy"});
 const sleep=dailyTrend(rows,{days,now,metric:"sleep"});
 const pairs=pairedWellbeingDays(rows,{days,now});
 const parts=["Bilan descriptif sur "+days+" jours, basé uniquement sur vos notes."];
 for(const [label,metric] of [["Douleur",pain],["Énergie",energy],["Sommeil",sleep]]){
  parts.push(label+" : "+(metric.observedDays?metric.average+"/10 en moyenne déclarée sur "+metric.observedDays+" jour(s).":"aucune valeur exploitable."));
 }
 if(pairs.length>=3){
  parts.push("Douleur et sommeil : "+pairs.length+" jour(s) comportent les deux mesures. Consultez vos courbes pour les comparer, sans conclure à une relation de cause à effet.");
 }else parts.push("Comparaison douleur/sommeil insuffisante : au moins trois journées comportant les deux mesures sont nécessaires.");
 parts.push("Les jours sans note ne sont pas remplacés par des zéros. Ces chiffres ne constituent ni un diagnostic, ni un conseil thérapeutique, ni une prédiction.");
 return parts.join("\n");
}
