// Tests d'intégration navigateur SANS poids Gemma (plusieurs Go).
import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({acceptDownloads:true});
const page=await context.newPage();
const URL="http://127.0.0.1:8765";
const secret="phrase de controle longue et unique 2026";
const value="Observation test chiffrée";
try{
 await page.goto(URL,{waitUntil:"networkidle"});
 await page.locator("#vault-gate").waitFor({state:"visible"});
 // Deux onglets ayant ouvert le formulaire de création ne doivent jamais s'écraser.
 const rival=await context.newPage();
 await rival.goto(URL,{waitUntil:"networkidle"});
 await rival.locator("#vault-gate").waitFor({state:"visible"});

 await page.locator("#vault-password").fill(secret);
 await page.locator("#vault-confirm-password").fill(secret);
 await page.locator("#vault-ack").check();
 page.locator("#vault-single-patient").check();
 await page.locator("#vault-submit").click();
 await page.locator("#vault-gate").waitFor({state:"hidden",timeout:20000});
 await rival.locator("#vault-password").fill("une autre phrase secrète longue");
 await rival.locator("#vault-confirm-password").fill("une autre phrase secrète longue");
 await rival.locator("#vault-ack").check();
 rival.locator("#vault-single-patient").check();
 await rival.locator("#vault-submit").click();
 await rival.locator("#vault-error").getByText(/coffre existe déjà|autre onglet/i).waitFor({timeout:20000});
 await rival.close();
 await page.locator("#first-steps").waitFor({state:"visible",timeout:10000});
 assert.equal(await page.locator("#first-steps .step-card").count(),3,"Three simple patient onboarding steps must be visible");
 assert.equal(await page.getByText("Studio Niko Design").first().count(),1,"Designer credit must be visible");
 await page.locator("#dismiss-guide").click();
 await page.locator("#first-steps").waitFor({state:"hidden",timeout:10000});
 await page.locator('[data-tab="health"]').first().click();
 await page.locator("#health-name").fill(value);
 await page.locator("#pain").fill("6");
 await page.locator("#health-form button[type=submit]").click();
 await page.locator("#health-list").getByText(value).waitFor();
 const envelope=await page.evaluate(async()=>{
   return await new Promise((resolve,reject)=>{
     const req=indexedDB.open("FibroBotVault-v1");
     req.onsuccess=()=>{const db=req.result;const get=db.transaction("envelopes","readonly").objectStore("envelopes").get("data");get.onsuccess=()=>{db.close();resolve(get.result);};get.onerror=()=>reject(get.error);};
     req.onerror=()=>reject(req.error);
   });
 });
 assert.equal(envelope?.algorithm,"AES-GCM-256");
 assert.ok(!JSON.stringify(envelope).includes(value),"No plaintext in vault IndexedDB");
 page.once("dialog",dialog=>dialog.accept());
 await page.locator("#lock-vault").click();
 await page.locator("#vault-gate").waitFor({state:"visible",timeout:15000});
 assert.equal(await page.locator("#vault-patient-wrap").isVisible(),false,"Returning patient must not be asked to create another account");
 await page.locator("#vault-password").fill("phrase volontairement incorrecte");
 await page.locator("#vault-submit").click();
 await page.waitForFunction(()=>/incorrect|endommagé/.test(document.getElementById("vault-error").textContent),{timeout:15000});
 await page.locator("#vault-password").fill(secret);
 await page.locator("#vault-submit").click();
 await page.locator("#vault-gate").waitFor({state:"hidden",timeout:15000});
 await page.locator("#first-steps").waitFor({state:"hidden",timeout:10000});
 await page.locator('[data-tab="health"]').first().click();
 await page.locator("#health-list").getByText(value).waitFor();
 await page.locator('[data-tab="chat"]').first().click();
 await page.locator("#prompt").fill("Quelle dose de médicament dois-je prendre ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/je ne peux pas déterminer/i).waitFor({timeout:10000});
 // Two open tabs must not silently overwrite the medical record.
 const sibling=await page.context().newPage();
 try{
  await sibling.goto(URL,{waitUntil:"networkidle"});
  await sibling.locator("#vault-password").fill(secret);
  await sibling.locator("#vault-submit").click();
  await sibling.locator("#vault-gate").waitFor({state:"hidden",timeout:15000});
  await page.locator('[data-tab="health"]').first().click();
  await page.locator("#health-name").fill("Note récente du premier onglet");
  await page.locator("#health-form button[type=submit]").click();
  await page.locator("#health-list").getByText("Note récente du premier onglet").waitFor();
  await sibling.locator('[data-tab="health"]').first().click();
  await sibling.locator("#health-name").fill("Note périmée du second onglet");
  await sibling.locator("#health-form button[type=submit]").click();
  await sibling.locator("#toast").getByText(/autre session|autre onglet|modifié le coffre/i).waitFor({timeout:15000});
  const names=await page.evaluate(async()=>new Promise((resolve,reject)=>{
    const open=indexedDB.open("FibroBotVault-v1");
    open.onsuccess=()=>{
      const db=open.result;
      const req=db.transaction("envelopes","readonly").objectStore("envelopes").get("data");
      req.onsuccess=()=>{resolve(req.result.ciphertext);db.close();};
      req.onerror=()=>reject(req.error);
    };
    open.onerror=()=>reject(open.error);
  }));
  assert.ok(names.length>100);
 }finally{await sibling.close();}
 // L'application statique et le coffre doivent aussi se déverrouiller hors ligne une fois le shell mis en cache.
 await page.evaluate(async()=>{if(!("serviceWorker" in navigator))throw Error("ServiceWorker indisponible");await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error("ServiceWorker non prêt après 15 secondes")),15000))]);});
 await context.setOffline(true);
 try{
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#vault-gate").waitFor({state:"visible",timeout:15000});
  await page.locator("#vault-password").fill(secret);
  await page.locator("#vault-submit").click();
  await page.locator("#vault-gate").waitFor({state:"hidden",timeout:20000});
  await page.locator('[data-tab="health"]').first().click();
  await page.locator("#health-list").getByText(value).waitFor({timeout:10000});
 }finally{await context.setOffline(false);}
 // Restore the encrypted backup in an independent browsing context.
 const restored=await browser.newPage();
 try{
  await restored.goto(URL,{waitUntil:"networkidle"});
  const buffer=Buffer.from(JSON.stringify({format:"FibroBotVaultEncrypted",version:1,envelope}),"utf8");
  await restored.locator("#vault-import").setInputFiles({name:"coffre-chiffre.json",mimeType:"application/json",buffer});
  await restored.locator("#vault-password").fill(secret);
  await restored.locator("#vault-ack").check();
 restored.locator("#vault-single-patient").check();
  await restored.locator("#vault-submit").click();
  await restored.locator("#vault-gate").waitFor({state:"hidden",timeout:20000});
  await restored.locator('[data-tab="health"]').first().click();
  await restored.locator("#health-list").getByText(value).waitFor();
 }finally{await restored.close();}
 // Migration: create a legacy database in a separate context, then opt in.
 const legacy=await browser.newPage();
 try{
  await legacy.goto(URL,{waitUntil:"networkidle"});
  await legacy.evaluate(async()=>{
   await new Promise((resolve,reject)=>{
    const request=indexedDB.open("FibrobotDB",1);
    request.onupgradeneeded=()=>{request.result.createObjectStore("symptoms",{keyPath:"id",autoIncrement:true});};
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction("symptoms","readwrite");
      tx.objectStore("symptoms").put({id:7,name:"Ancienne note",date:"2026-10-26T12:00:00",intensity:5});
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>reject(tx.error);
    };
    request.onerror=()=>reject(request.error);
   });
  });
  await legacy.reload({waitUntil:"networkidle"});
  await legacy.locator("#vault-migrate-wrap").waitFor({state:"visible",timeout:10000});
  await legacy.locator("#vault-migrate").check();
  await legacy.locator("#vault-password").fill(secret);
  await legacy.locator("#vault-confirm-password").fill(secret);
  await legacy.locator("#vault-ack").check();
 legacy.locator("#vault-single-patient").check();
  await legacy.locator("#vault-submit").click();
  await legacy.locator("#vault-gate").waitFor({state:"hidden",timeout:20000});
  await legacy.locator('[data-tab="health"]').first().click();
  await legacy.locator("#health-list").getByText("Ancienne note").waitFor();
  const dbs=await legacy.evaluate(async()=>typeof indexedDB.databases==="function"?await indexedDB.databases():[]);
  if(dbs.length)assert.equal(dbs.some(x=>x.name==="FibrobotDB"),false,"legacy plaintext database must be deleted");
 }finally{await legacy.close();}
 // Responsive layout smoke checks; these emulate viewport sizes, not real iOS/Android.
 for(const width of [390,834,1024]){
   await page.setViewportSize({width,height:850});
   await (width<=930?page.locator('.mobile-dock [data-tab="tasks"]'):page.locator('#nav [data-tab="tasks"]')).click();
   const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
   assert.ok(dimensions.document<=dimensions.viewport+2,"Unexpected page horizontal overflow at "+width+": "+JSON.stringify(dimensions));
 }
 console.log("Chromium vault, restore, migration, medical refusal and mobile/tablet viewport: OK");
}finally{await browser.close();}
