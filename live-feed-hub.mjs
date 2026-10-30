/* Public feed tracker. Opt-in, visible-tab only, bounded refresh every >= 5 min. */
export const FEED_REFRESH_MINUTES=5;
export function monitoredFeeds(){return Object.freeze(["weather","air"]);}
export function feedState({running=false,visible=true,online=true,city=""}={}){
 if(!running)return "Veille désactivée.";
 if(!city.trim())return "Indiquez une ville pour suivre les flux.";
 if(!online)return "Réseau indisponible ; dernières données potentiellement périmées.";
 if(!visible)return "Veille suspendue : application non visible.";
 return "Veille active pendant que FibroBot reste ouvert. Actualisation toutes les 5 minutes (au mieux).";
}
export function createPublicFeedMonitor({refresh,intervalMs=300000,clock=()=>Date.now()}={}){
 if(typeof refresh!=="function")throw Error("Fonction de mise à jour requise.");
 if(!Number.isFinite(intervalMs)||intervalMs<300000)throw Error("Fréquence maximale : une consultation toutes les 5 minutes.");
 let active=false,lastAt=-Infinity,busy=false;
 return Object.freeze({
  isActive(){return active;},
  start(){active=true;},
  stop(){active=false;},
  async tick({visible=true,online=true}={}){
   if(!active||!visible||!online||busy)return false;
   const now=clock();
   if(now-lastAt<intervalMs)return false;
   lastAt=now;busy=true;
   try{await refresh();return true;}
   finally{busy=false;}
  }
 });
}
