/* Contrôleur du coffre : ne transmet jamais la clé ou les données à un serveur. */
import {openVaultDB,readEnvelope,createVault,unlockVault,readLegacy,clearLegacy,clearVault,emptyData} from "./vault.mjs";
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
 let old=null, hasLegacy=false;
 if(!existing){try{old=await readLegacy();hasLegacy=Object.values(old).some(rows=>rows.length>0);}catch(err){status("Ancienne base illisible : "+err.message);}}
 instructions.textContent=existing?"Coffre existant : saisissez votre phrase secrète pour accéder à vos données. Aucun service ne peut la récupérer.":"Créez une phrase secrète d'au moins 12 caractères. Si vous la perdez, il sera impossible de récupérer les données chiffrées.";
 button.textContent=existing?"Déverrouiller":"Créer le coffre";
 confirm.hidden=Boolean(existing);
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
    if(!existing){if(password.length<12)throw Error("La phrase secrète doit comporter au moins 12 caractères.");if(password!==$("vault-confirm-password").value)throw Error("Les phrases secrètes ne correspondent pas.");if(!$("vault-ack").checked)throw Error("Vous devez confirmer avoir compris le risque de perte des données.");
     const migrate=hasLegacy&&$("vault-migrate").checked;
     active=await createVault(vaultDb,password,migrate?old:emptyData());
     // Vérification indépendante avant suppression irréversible de la base historique.
     const verified=await unlockVault(vaultDb,password);
     const verifiedRows=await verified.all("symptoms");
     if(migrate&&verifiedRows.length!==(old.symptoms||[]).length)throw Error("Échec de vérification des données migrées.");
     verified.close();
     // unlockVault.close ferme la connexion partagée ; réouvrir pour la session active.
     vaultDb=await openVaultDB();active=await unlockVault(vaultDb,password);
     if(migrate){try{await clearLegacy();}catch(error){status("Migration chiffrée réussie. ATTENTION : ancienne base non chiffrée non supprimée : "+error.message);$("vault-post-warning").hidden=false;}}
    }else active=await unlockVault(vaultDb,password);
    $("vault-password").value="";$("vault-confirm-password").value="";
    gate.hidden=true;
    resolve(active);
   }catch(error){status(error.message);active=null;button.disabled=false;}
  });
 });
}
export const all=(db,store)=>db.all(store);
export const put=(db,store,record)=>db.put(store,record);
export const del=(db,store,id)=>db.del(store,id);
export async function encryptedExport(db){return db.encryptedBackup();}
export async function wipeDB(){if(active){active.close();active=null;}else vaultDb?.close();await clearVault();await clearLegacy();}
export async function eraseLegacy(){await clearLegacy();}
