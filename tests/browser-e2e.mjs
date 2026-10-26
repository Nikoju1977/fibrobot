// Tests d'intégration navigateur SANS poids Gemma (plusieurs Go).
import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({acceptDownloads:true});
const URL="http://127.0.0.1:8765";
const secret="phrase de controle longue et unique 2026";
const value="Observation test chiffrée";
try{
 await page.goto(URL,{waitUntil:"networkidle"});
 await page.locator("#vault-gate").waitFor({state:"visible"});
 await page.locator("#vault-password").fill(secret);
 await page.locator("#vault-confirm-password").fill(secret);
 await page.locator("#vault-ack").check();
 await page.locator("#vault-submit").click();
 await page.locator("#vault-gate").waitFor({state:"hidden",timeout:20000});
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
 await page.locator("#vault-password").fill("phrase volontairement incorrecte");
 await page.locator("#vault-submit").click();
 await page.waitForFunction(()=>/incorrect|endommagé/.test(document.getElementById("vault-error").textContent),{timeout:15000});
 await page.locator("#vault-password").fill(secret);
 await page.locator("#vault-submit").click();
 await page.locator("#vault-gate").waitFor({state:"hidden",timeout:15000});
 await page.locator('[data-tab="health"]').first().click();
 await page.locator("#health-list").getByText(value).waitFor();
 await page.locator('[data-tab="chat"]').first().click();
 await page.locator("#prompt").fill("Quelle dose de médicament dois-je prendre ?");
 await page.locator('#chat-form button[type="submit"]').click();
 await page.locator("#messages").getByText(/je ne peux pas déterminer/i).waitFor({timeout:10000});
 console.log("Chromium local vault + medical refusal smoke test OK");
}finally{await browser.close();}
