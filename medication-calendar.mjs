/* Optional manual .ics export: only generic events; no drug name, dose or patient data. */
import {medicationReminderTimes} from "./core.mjs";
const pad=n=>String(n).padStart(2,"0");
const dateLocal=d=>d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate());
const dateTime=d=>dateLocal(d)+"T"+pad(d.getHours())+pad(d.getMinutes())+"00";
export function medicationCalendarICS(medication,now=new Date()){
 const times=medicationReminderTimes(medication);
 if(!times.length)throw Error("Ajoutez une heure de rappel avant l'export.");
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error("Date invalide.");
 const stamp=now.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
 const id=String(medication?.id??"manual").replace(/[^a-zA-Z0-9-]/g,"").slice(0,35)||"manual";
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","CALSCALE:GREGORIAN","PRODID:-//FibroBot//RappelsPrives//FR"];
 for(const time of times){
  const [h,m]=time.split(":").map(Number);
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),h,m);
  if(start<=now)start.setDate(start.getDate()+1);
  const end=new Date(start.getTime()+5*60000);
  const uid="fibrobot-rappel-"+id+"-"+time.replace(":","")+"@calendar.local";
  lines.push("BEGIN:VEVENT","UID:"+uid,"DTSTAMP:"+stamp,"DTSTART:"+dateTime(start),"DTEND:"+dateTime(end),
   "RRULE:FREQ=DAILY","SUMMARY:Rappel personnel (FibroBot)",
   "DESCRIPTION:Rappel generique. Verifier votre suivi personnel. Aucune information medicale incluse.",
   "BEGIN:VALARM","ACTION:DISPLAY","TRIGGER:-PT0M","DESCRIPTION:Rappel personnel","END:VALARM","END:VEVENT");
 }
 return lines.concat("END:VCALENDAR","").join("\r\n");
}
