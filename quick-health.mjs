/* Explicit, patient-owned quick self tracking. No clinical inference or network. */
import {makeSymptom,today} from "./core.mjs";
export const QUICK_HELP="Exemple : douleur 7 fatigue 8 énergie 3 stress";
const fold=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function parseQuickHealth(raw,date=today()){
 const line=fold(raw).replace(/\s+/g," ").trim();
 if(!line||line.length>240)throw Error("Saisissez une note courte (240 caractères maximum).");
 const metrics={};
 const found=[...line.matchAll(/\b(douleur|fatigue|energie|sommeil)\s*[:=]?\s*(-?\d{1,3})(?!\d)/g)];
 for(const m of found){
  if(Object.hasOwn(metrics,m[1]))throw Error("Chaque mesure ne doit apparaître qu'une seule fois.");
  const n=Number(m[2]);
  if(!Number.isInteger(n)||n<0||n>10)throw Error("Les mesures sont comprises entre 0 et 10.");
  metrics[m[1]]=n;
 }
 for(const word of ["douleur","fatigue","energie","sommeil"]){
  if(new RegExp("\\b"+word+"\\b").test(line)&&!Object.hasOwn(metrics,word))throw Error("Indiquez une note sur 10 après « "+word+" ».");
 }
 if(metrics.douleur===undefined)throw Error("Indiquez « douleur 0 à 10 » pour une note complète.");
 const factors=["stress","meteo","surmenage","infection","alimentation"].filter(f=>new RegExp("\\b"+f+"\\b").test(line));
 const payload=makeSymptom({name:"Auto-suivi rapide",date,intensity:metrics.douleur,
  fatigue:metrics.fatigue??null,energy:metrics.energie??null,sleep:metrics.sommeil??null,
  condition:"",notes:factors.length?"Facteurs évoqués (association non démontrée) : "+factors.join(", "):""});
 return {payload,metrics,factors,preview:"Douleur "+metrics.douleur+"/10"+
  (metrics.fatigue!==undefined?" · fatigue "+metrics.fatigue+"/10":"")+
  (metrics.energie!==undefined?" · énergie "+metrics.energie+"/10":"")+
  (metrics.sommeil!==undefined?" · qualité de sommeil "+metrics.sommeil+"/10":"")+
  (factors.length?" · facteurs mentionnés : "+factors.join(", "):"")};
}
