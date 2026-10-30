/* Foreground reminders only: no background scheduling, no medical details in notifications. */
export const FOREGROUND_REMINDER_OPTIN_ID="foreground-reminders-v29";
export function optInForegroundReminders(settings=[]){
 const record=Array.isArray(settings)?settings.find(s=>s?.id===FOREGROUND_REMINDER_OPTIN_ID):null;
 return record?.value===true;
}
const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
export function eligibleForegroundReminders(due=[],alreadySeen=new Set(),now=new Date(),maxAgeMinutes=10){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))return [];
 const limit=Number(maxAgeMinutes);
 if(!Number.isFinite(limit)||limit<0||limit>60)throw Error("Fenêtre de rappel invalide");
 const current=now.getHours()*60+now.getMinutes(),day=localDate(now),handled=alreadySeen instanceof Set?alreadySeen:new Set();
 const result=[];
 for(const item of Array.isArray(due)?due:[]){
  if(item?.date!==day||!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(item.time||"")))continue;
  const [h,m]=item.time.split(":").map(Number);
  if(current-h*60-m<0||current-h*60-m>limit)continue;
  const key=String(item.key||"");
  if(!key||key.length>150||handled.has(key)||result.some(x=>x.key===key))continue;
  result.push({key,title:"FibroBot · rappel personnel",body:"Un horaire déclaré approche ou vient de passer. Consultez FibroBot pour vérifier."});
 }
 return result;
}
