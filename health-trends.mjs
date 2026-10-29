/* Descriptive self-reported daily values, no diagnosis, no prediction, no cloud. */
import {dateOK} from "./core.mjs";
export const TREND_METRICS=Object.freeze([
 Object.freeze({key:"intensity",label:"Intensité déclarée"}),
 Object.freeze({key:"fatigue",label:"Fatigue déclarée"}),
 Object.freeze({key:"energy",label:"Énergie déclarée"}),
 Object.freeze({key:"sleep",label:"Sommeil déclaré"})
]);
const localDate=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const rating=x=>x!==null&&x!==undefined&&x!==""&&Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=10?Number(x):null;
export function dailyTrend(rows=[],{metric="intensity",days=14,now=new Date()}={}){
 if(!TREND_METRICS.some(m=>m.key===metric))throw Error("Mesure inconnue.");
 if(![7,14,30,90].includes(Number(days)))throw Error("Période non prise en charge.");
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 start.setDate(start.getDate()-Number(days)+1);
 const first=localDate(start),last=localDate(now),byDate=new Map();
 if(Array.isArray(rows))for(const r of rows){
  if(!r||!dateOK(r.date)||r.date<first||r.date>last)continue;
  const val=rating(r[metric]);if(val===null)continue;
  const item=byDate.get(r.date)||{sum:0,count:0};
  item.sum+=val;item.count++;byDate.set(r.date,item);
 }
 const points=[];
 for(let d=new Date(start),i=0;i<Number(days);i++,d.setDate(d.getDate()+1)){
  const date=localDate(d),value=byDate.get(date);
  points.push({date,value:value?Math.round(value.sum/value.count*10)/10:null,count:value?.count||0});
 }
 const measured=points.filter(p=>p.value!==null);
 return {metric,days:Number(days),points,observedDays:measured.length,observations:measured.reduce((a,b)=>a+b.count,0),
  average:measured.length?Math.round(measured.reduce((a,b)=>a+b.value*b.count,0)/measured.reduce((a,b)=>a+b.count,0)*10)/10:null};
}
export function trendDescription(trend){
 if(!trend?.observations)return "Aucune valeur de cette mesure n'a été déclarée sur la période. Les journées sans note ne sont pas considérées comme zéro.";
 return trend.observations+" note(s) sur "+trend.observedDays+" jour(s) renseigné(s) · moyenne descriptive "+trend.average+"/10. Les journées sans note ne sont pas interpolées. Ce graphique ne démontre pas une amélioration ou une aggravation clinique.";
}
