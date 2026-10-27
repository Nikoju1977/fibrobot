/* Contrôleur du coffre : ne transmet jamais la clé ou les données à un serveur. */
import {openVaultDB,readEnvelope,createVault,unlockVault,unseal,readLegacy,clearLegacy,clearVault,emptyData,storeEnvelopeIfAbsent,validEnvelope,VaultSession} from "./vault.mjs";
const $=id=>document.getElementById(id);
let active=null, vaultDb=null;
const status=message=>{const el=$("vault-error");if(el)el.textContent=message;};
export const isVaultUnlocked=()=>Boolean(active);
export async function openSecureDB(){
 vaultDb=await openVaultDB();
 const existing=await readEnvelope(vaultDb);
 const form=$("vault-form"),gate=$("vault-gate"),button=$("vault-submit"),instructions=$("vault-instructions"),confirm=$("vault-confirm"),legacy=$("vault-legacy");
 if(!form||!gate)throw Error("Interface de coffre introuvable.");
 gate.hidden=false;
 const appShell=document.querySelector(".shell");
 if(appShell)appShell.inert=true;
 $("vault-password").focus();
 let old=null, hasLegacy=false;
 if(!existing){try{old=await readLegacy();hasLegacy=Object.values(old).some(rows=>rows.length>0);}catch(err){status("Ancienne base illisible : "+err.message);}}
 instructions.textContent=existing?"Coffre existant : saisissez votre phrase secrète pour accéder à vos données. Aucun service ne peut la récupérer.":"Créez une phrase secrète d'au moins 12 caractères. Si vous la perdez, il sera impossible de récupérer les données chiffrées.";
 button.textContent=existing?"Déverrouiller":"Créer le coffre";
 confirm.hidden=Boolean(existing);
 $("vault-confirm-ack").hidden=Boolean(existing);
 $("vault-import").disabled=Boolean(existing);
 legacy.hidden=!hasLegacy;
 if(hasLegacy)legacy.textContent="Anciennes données non chiffrées détectées. Vous pouvez les importer en sélectionnant l'option ci-dessous. Après vérification du chiffrement, leur suppression sera tentée ; si elle échoue, vous en serez averti.";
 $("vault-migrate-wrap").hidden=Boolean(existing)||!hasLegacy;
 return new Promise((resolve,reject)=>{
  form.addEventListener("submit",async event=>{
   event.preventDefault();
   const password=$("vault-password").value;
   button.disabled=true;
   status("Chiffrement / vérification en cours sur cet appareil…");
   try{
    if(!existing){
     if(password.length<12)throw Error("La phrase secrète doit comporter au moins 12 caractères.");
     if(!$("vault-ack").checked)throw Error("Vous devez confirmer avoir compris le risque de perte des données.");
     const migrate=hasLegacy&&$("vault-migrate").checked;
     const file=$("vault-import").files?.[0];
     if(file){
      if(migrate)throw Error("Choisissez soit une restauration, soit une migration de l'ancienne base.");
      if(file.size>30*1024*1024)throw Error("Fichier de sauvegarde trop volumineux.");
      let payload;try{payload=JSON.parse(await file.text());}catch(e){throw Error("Fichier JSON illisible.");}
      if(payload?.format!=="FibroBotVaultEncrypted"||!validEnvelope(payload?.envelope))throw Error("Ce fichier n'est pas une sauvegarde FibroBot chiffrée valide.");
      const opened=await unseal(payload.envelope,password);
      await storeEnvelopeIfAbsent(vaultDb,payload.envelope);
      active=new VaultSession(vaultDb,opened);
      if(hasLegacy)$("vault-post-warning").hidden=false;
     }else{
      if(password!==$("vault-confirm-password").value)throw Error("Les phrases secrètes ne correspondent pas.");
      active=await createVault(vaultDb,password,migrate?old:emptyData());
      if(hasLegacy&&!migrate)$("vault-post-warning").hidden=false;
      // Contrôler l'intégrité de TOUTES les données migrées avant tout effacement.
      const verified=await unseal(await readEnvelope(vaultDb),password);
      if(migrate&&JSON.stringify(verified.data)!==JSON.stringify(old))throw Error("Migration non conforme : les anciennes données n'ont pas été supprimées.");
      // Si une autre fenêtre détient la base historique, conserver les données et avertir explicitement.
      if(migrate){try{await clearLegacy();}catch(error){status("Coffre validé, mais l'ancienne base non chiffrée n'a pas été supprimée : "+error.message);$("vault-post-warning").hidden=false;}}
     }
    }else active=await unlockVault(vaultDb,password);
    $("vault-password").value="";$("vault-confirm-password").value="";
    gate.hidden=true;
    if(appShell)appShell.inert=false;
    $("main")?.focus({preventScroll:true});
    if(!$("vault-post-warning").hidden){const toast=$("toast");if(toast){toast.hidden=false;toast.textContent="Attention : une ancienne base non chiffrée est peut-être présente. Vérifiez « Mes données ».";}}
    resolve(active);
   }catch(error){status(error.message);button.disabled=false;}
  });
 });
}
export const all=(db,store)=>db.all(store);
export const put=(db,store,record)=>db.put(store,record);
export const del=(db,store,id)=>db.del(store,id);
export async function encryptedExport(db){return db.encryptedBackup();}
export async function wipeDB(){if(active){active.close();active=null;}else vaultDb?.close();await clearVault();await clearLegacy();}
export async function eraseLegacy(){await clearLegacy();}
