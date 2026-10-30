/* Conservative local diagnostics - reports capabilities, not actual permissions or reliability. */
export function deviceReadiness({secure=false,storage=false,serviceWorker=false,notifications=false,notificationPermission="default",recognition=false,localSpeech=false,installed=false,online=true}={}){
 return [
  {id:"secure",ok:Boolean(secure),label:"Contexte HTTPS",detail:secure?"Disponible":"Nécessaire pour le coffre et la PWA"},
  {id:"vault",ok:Boolean(storage),label:"Stockage chiffré",detail:storage?"Déverrouillé dans cette session":"Non déverrouillé"},
  {id:"offline",ok:Boolean(serviceWorker),label:"Cache PWA",detail:serviceWorker?"Mécanisme présent ; mode hors ligne à tester":"Service worker indisponible"},
  {id:"voice",ok:Boolean(localSpeech),label:"Voix française locale",detail:localSpeech?"Détectée, lecture à tester":"Non détectée"},
  {id:"mic",ok:Boolean(recognition),label:"API de dictée",detail:recognition?"Détectée ; autorisations et mode local non vérifiés":"Non détectée"},
  {id:"alerts",ok:notifications&&notificationPermission==="granted",label:"Notifications",detail:notifications&&notificationPermission==="granted"?"Autorisation accordée ; pas de garantie app fermée":"Autorisation absente ou refusée"},
  {id:"install",ok:Boolean(installed),label:"Installation",detail:installed?"Mode application détecté":"Utilisation possible dans le navigateur"},
  {id:"network",ok:Boolean(online),label:"Réseau",detail:online?"Appareil déclaré en ligne ; API non testées":"Hors ligne"}
 ];
}
