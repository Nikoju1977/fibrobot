/* Session lock policy, independent of the app and of all personal health data. */
export const AUTO_LOCK_SETTING="auto-lock-minutes-v26";
export const AUTO_LOCK_OPTIONS=Object.freeze([0,5,15,30]);
export function sanitizeAutoLockMinutes(value){
 if(value===null||value===undefined||String(value).trim()==="")throw Error("Délai de verrouillage non valide.");
 const n=Number(value);
 if(!Number.isInteger(n)||!AUTO_LOCK_OPTIONS.includes(n))throw Error("Délai de verrouillage non valide.");
 return n;
}
export function storedAutoLockMinutes(settings=[]){
 const entry=Array.isArray(settings)?settings.find(x=>x?.id===AUTO_LOCK_SETTING):null;
 try{return entry?sanitizeAutoLockMinutes(entry.value):15;}catch{return 15;}
}
export function shouldLockForInactivity(lastActiveAt,now=Date.now(),minutes=15){
 const value=sanitizeAutoLockMinutes(minutes);
 if(!value)return false;
 if(!Number.isFinite(lastActiveAt)||!Number.isFinite(now)||now<lastActiveAt)return false;
 return now-lastActiveAt>=value*60*1000;
}
