/* Appointment reminders are local-only. Never show medical details in OS notifications.
 * This is a foreground PWA reminder, not a guaranteed background alarm.
 */
const pad=n=>String(n).padStart(2,"0");
function localDateString(date){return date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate());}
const validDate=str=>{
 if(typeof str!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(str))return false;
 const [y,m,d]=str.split("-").map(Number),v=new Date(y,m-1,d);
 return v.getFullYear()===y&&v.getMonth()===m-1&&v.getDate()===d;
};
export function upcomingAppointments(appointments,now=new Date(),days=7){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
 if(!Array.isArray(appointments)||!Number.isFinite(days)||days<0)return [];
 return appointments.filter(a=>a&&validDate(a.date)).map(a=>{
  const [y,m,d]=a.date.split("-").map(Number),when=new Date(y,m-1,d);
  const delta=Math.round((when.getTime()-today)/86400000);
  return {id:a.id,date:a.date,time:/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(a.time||"")?a.time:"",title:String(a.title||"Rendez-vous").slice(0,130),inDays:delta};
 }).filter(a=>a.inDays>=0&&a.inDays<=days).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)).slice(0,10);
}
export function appointmentAlertKeys(appointments,now=new Date()){
 const date=localDateString(now);
 return upcomingAppointments(appointments,now,1).filter(a=>a.inDays<=1).map(a=>"rdv-"+String(a.id)+"-"+a.date+"-notice-"+date);
}

/** Private calendar export: contains the date and optional time only.
 * Never disclose the appointment title, location or patient name in the file.
 * The calendar application must be opened/imported by the user explicitly.
 */
export function appointmentCalendarICS(appointment,now=new Date()){
 if(!appointment||!validDate(appointment.date))throw Error("Date de rendez-vous non valide.");
 const [y,m,d]=appointment.date.split("-").map(Number);
 const short=appointment.date.replace(/-/g,"");
 const timed=/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(appointment.time||"");
 let start="",end="";
 if(timed){
  const [hh,mm]=appointment.time.split(":").map(Number);
  const first=new Date(y,m-1,d,hh,mm),last=new Date(first.getTime()+3600000);
  const format=v=>localDateString(v).replace(/-/g,"")+"T"+pad(v.getHours())+pad(v.getMinutes())+"00";
  start="DTSTART:"+format(first);end="DTEND:"+format(last);
 }else{
  const next=new Date(y,m-1,d+1);
  start="DTSTART;VALUE=DATE:"+short;
  end="DTEND;VALUE=DATE:"+localDateString(next).replace(/-/g,"");
 }
 const created=new Date(now).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
 const id=String(appointment.id??"anon").replace(/[^a-zA-Z0-9-]/g,"").slice(0,40)||"anon";
 return [
  "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//FibroBot//RendezVousPrive//FR",
  "BEGIN:VEVENT","UID:fibrobot-"+id+"-"+short+"@calendar.local",
  "DTSTAMP:"+created,start,end,"SUMMARY:Rendez-vous (FibroBot)",
  "DESCRIPTION:Consulter votre agenda personnel. Aucun detail medical inclus.",
  "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:Rendez-vous a venir",
  timed?"TRIGGER:-PT1H":"TRIGGER:-P1D","END:VALARM",
  "END:VEVENT","END:VCALENDAR",""
 ].join("\r\n");
}
