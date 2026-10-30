/* FibroBot: bounded, public, opt-in live services. No patient records or device location sent.
 * Open-Meteo weather and air quality, and public holidays from Nager.Date.
 * Never claims that Agnes has live web access without these tool results.
 */
const fold=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const compact=s=>String(s||"").replace(/[<>\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,120);
const codes={0:"ciel dégagé",1:"plutôt ensoleillé",2:"partiellement nuageux",3:"couvert",45:"brouillard",48:"brouillard givrant",51:"bruine légère",53:"bruine",55:"bruine dense",61:"pluie faible",63:"pluie",65:"forte pluie",66:"pluie verglaçante",67:"forte pluie verglaçante",71:"neige faible",73:"neige",75:"forte neige",77:"neige en grains",80:"averses faibles",81:"averses",82:"fortes averses",85:"averses de neige",86:"fortes averses de neige",95:"orage",96:"orage avec grêle",99:"fort orage avec grêle"};
export const LIVE_SOURCES=Object.freeze([
 {id:"weather",name:"Open-Meteo Prévisions",url:"https://open-meteo.com/",kind:"météo"},
 {id:"air",name:"Open-Meteo Qualité de l’air",url:"https://open-meteo.com/en/docs/air-quality-api",kind:"air"},
 {id:"geocoding",name:"Open-Meteo Géocodage",url:"https://open-meteo.com/en/docs/geocoding-api",kind:"lieux"},
 {id:"holidays",name:"Nager.Date",url:"https://date.nager.at/",kind:"jours fériés"}
]);
export function liveIntent(question){
 const q=fold(question);
 if(/\b(?:meteo|temps (?:fait|fera|fait-il|fera-t-il)|temperature|previsions? meteo|pluie|pleuv(?:ra|oir)|neig(?:e|er)|vent|ensoleill(?:e|ement))\b/.test(q))return "weather";
 if(/\b(?:qualite de l.air|pollution atmospherique|particules fines|pollens?|indice air)\b/.test(q))return "air";
 if(/\b(?:jours? feries?|vacances? feries?|fete nationale)\b/.test(q))return "holidays";
 return null;
}
export function weatherHorizon(question){
 const q=fold(question);
 if(/\b(apres.demain)\b/.test(q))return 2;
 if(/\b(demain)\b/.test(q))return 1;
 if(/\b(cette semaine|7 jours|semaine prochaine)\b/.test(q))return 7;
 return 0;
}
export function explicitWeatherCity(question){
 const q=compact(question);
 const m=q.match(/\b(?:a|à|sur|pour|dans|de|d')\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]{1,70})/i);
 if(!m)return "";
 const city=m[1].replace(/\s+(?:aujourd'hui|demain|après-demain|cette semaine|ce soir|maintenant|actuellement|sur les? .*)$/i,"").trim().replace(/[?!.,]+$/,"");
 if(/^(?:la|le|ce|cette|quel|quelle|demain|aujourd'hui|temps|meteo|pluie|semaine|matin|soir)$/i.test(city))return "";
 return city.slice(0,70);
}
async function getJSON(url,{fetchImpl=globalThis.fetch,signal,timeoutMs=9000}={}){
 if(typeof fetchImpl!=="function")throw Error("Connexion réseau non disponible.");
 const ctrl=new AbortController();
 const abort=()=>ctrl.abort();
 if(signal?.aborted)ctrl.abort();else signal?.addEventListener("abort",abort,{once:true});
 const timer=setTimeout(abort,timeoutMs);
 try{
  const response=await fetchImpl(url,{method:"GET",mode:"cors",credentials:"omit",cache:"no-store",signal:ctrl.signal});
  if(!response.ok)throw Error("Source publique indisponible (HTTP "+response.status+").");
  const result=await response.json();
  if(!result||typeof result!=="object")throw Error("Réponse publique invalide.");
  return result;
 }catch(e){if(e?.name==="AbortError")throw Error("Le fournisseur public a dépassé le délai.");throw e;}
 finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}
export async function resolvePublicCity(city,options={}){
 const requested=compact(city);
 if(requested.length<2||requested.length>80||!/[A-Za-zÀ-ÿ]/.test(requested))throw Error("Précisez une ville pour obtenir une prévision réelle.");
 const url=new URL("https://geocoding-api.open-meteo.com/v1/search");
 url.searchParams.set("name",requested);url.searchParams.set("count","5");url.searchParams.set("language","fr");url.searchParams.set("format","json");
 const data=await getJSON(url.toString(),options);
 const places=Array.isArray(data.results)?data.results:[];
 const best=places.find(x=>fold(x.name)===fold(requested))||places[0];
 if(!best||!Number.isFinite(Number(best.latitude))||!Number.isFinite(Number(best.longitude)))throw Error("Ville introuvable. Précisez le nom et, si besoin, le département.");
 return {name:compact(best.name),region:compact(best.admin1||""),country:compact(best.country||""),latitude:Number(best.latitude),longitude:Number(best.longitude)};
}
const numeric=v=>Number.isFinite(Number(v))?Number(v):null;
const fmt=(n,unit="")=>n===null?"non disponible":Math.round(n*10)/10+unit;
export async function publicWeather(city,{question="",fetchImpl=globalThis.fetch,signal}={}){
 const location=await resolvePublicCity(city,{fetchImpl,signal});
 const url=new URL("https://api.open-meteo.com/v1/forecast");
 for(const [k,v] of Object.entries({latitude:String(location.latitude),longitude:String(location.longitude),
 current:"temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
 daily:"temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
 timezone:"auto",forecast_days:"7"}))url.searchParams.set(k,v);
 const data=await getJSON(url.toString(),{fetchImpl,signal});
 const day=weatherHorizon(question);
 const cityName=[location.name,location.region,location.country].filter(Boolean).join(", ");
 let text;
 if(day===7){
  const rows=(data.daily?.time||[]).slice(0,7).map((date,i)=>date+" : "+(codes[data.daily?.weather_code?.[i]]||"prévision disponible")+", "+fmt(numeric(data.daily?.temperature_2m_min?.[i])," °C")+" à "+fmt(numeric(data.daily?.temperature_2m_max?.[i])," °C")+", pluie "+fmt(numeric(data.daily?.precipitation_probability_max?.[i])," %"));
  if(!rows.length)throw Error("Prévisions météo incomplètes.");
  text="Prévisions à 7 jours pour "+cityName+" (modèles Open-Meteo, susceptibles de changer) :\n"+rows.join("\n");
 }else if(day>=1){
  const date=data.daily?.time?.[day];
  if(!date)throw Error("Prévision demandée indisponible.");
  text=(day===1?"Demain":"Après-demain")+" ("+date+") à "+cityName+" : "+(codes[data.daily?.weather_code?.[day]]||"conditions variables")+", températures entre "+fmt(numeric(data.daily?.temperature_2m_min?.[day])," °C")+" et "+fmt(numeric(data.daily?.temperature_2m_max?.[day])," °C")+", probabilité maximale de précipitations "+fmt(numeric(data.daily?.precipitation_probability_max?.[day])," %")+".";
 }else{
  const v=numeric(data.current?.temperature_2m);
  if(v===null)throw Error("Mesures météo actuelles indisponibles.");
  text="Météo actuelle pour "+cityName+" ("+compact(data.current.time||"heure non fournie")+") : "+(codes[data.current?.weather_code]||"conditions variables")+
  ", "+fmt(v," °C")+" (ressenti "+fmt(numeric(data.current?.apparent_temperature)," °C")+"), humidité "+fmt(numeric(data.current?.relative_humidity_2m)," %")+
  ", vent "+fmt(numeric(data.current?.wind_speed_10m)," km/h")+". Prévision du jour : "+fmt(numeric(data.daily?.temperature_2m_min?.[0])," °C")+" à "+fmt(numeric(data.daily?.temperature_2m_max?.[0])," °C")+".";
 }
 return {kind:"weather",answer:text+"\n\nSource : Open-Meteo, prévision météo actualisée (ni observation locale garantie, ni bulletin officiel d'alerte).",references:[{provider:"Open-Meteo",title:"Données et prévisions météorologiques",url:"https://open-meteo.com/"}],city:location.name};
}
export async function publicAirQuality(city,{fetchImpl=globalThis.fetch,signal}={}){
 const place=await resolvePublicCity(city,{fetchImpl,signal});
 const url=new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
 for(const [k,v] of Object.entries({latitude:String(place.latitude),longitude:String(place.longitude),current:"european_aqi,pm2_5,pm10",timezone:"auto"}))url.searchParams.set(k,v);
 const data=await getJSON(url.toString(),{fetchImpl,signal});
 const aqi=numeric(data.current?.european_aqi);
 if(aqi===null)throw Error("Indice de qualité de l'air indisponible.");
 return {kind:"air",city:place.name,answer:"Qualité de l'air à "+place.name+" ("+compact(data.current.time||"date non renseignée")+") : indice européen "+fmt(aqi)+", particules PM2,5 : "+fmt(numeric(data.current?.pm2_5)," µg/m³")+", PM10 : "+fmt(numeric(data.current?.pm10)," µg/m³")+". Ces estimations ne constituent pas une mesure à domicile ni un avis médical.\n\nSource : Open-Meteo Air Quality.",references:[{provider:"Open-Meteo",title:"Qualité de l'air",url:"https://open-meteo.com/en/docs/air-quality-api"}]};
}
export async function publicFrenchHolidays(question,{fetchImpl=globalThis.fetch,signal,now=new Date()}={}){
 const year=Number(String(question).match(/\b20\d{2}\b/)?.[0]||now.getFullYear());
 if(year<2020||year>2100)throw Error("Année de calendrier non prise en charge.");
 const data=await getJSON("https://date.nager.at/api/v3/PublicHolidays/"+year+"/FR",{fetchImpl,signal});
 if(!Array.isArray(data))throw Error("Liste de fêtes publiques invalide.");
 const rows=data.filter(x=>x?.date&&x?.localName).slice(0,25);
 return {kind:"holidays",answer:"Jours fériés nationaux répertoriés en France en "+year+" :\n"+rows.map(x=>x.date+" — "+compact(x.localName)).join("\n")+"\n\nDes jours spécifiques à certaines régions peuvent s'ajouter. Source : Nager.Date.",references:[{provider:"Nager.Date",title:"Calendrier des jours fériés",url:"https://date.nager.at/"}]};
}
