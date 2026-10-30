// Simulations de navigateurs Linux : ni iOS Safari ni Android Chrome matériel.
import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";
const SITE_URL="http://127.0.0.1:8765";
for(const [label,engine,mobile] of [["WebKit format iPhone",webkit,true],["Chromium format Android",chromium,true],["WebKit format tablette",webkit,false]]){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:820,height:1180},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:2});
 const page=await context.newPage();
 const requests=[];
 page.on("request",request=>{if(new URL(request.url()).origin!==new URL(SITE_URL).origin)requests.push(request.url());});
 try{
  await page.goto(SITE_URL,{waitUntil:"networkidle"});
  await page.locator("#vault-gate").waitFor({state:"visible"});
  await page.locator("#vault-password").fill("phrase de passe longue mobile 2026");
  await page.locator("#vault-confirm-password").fill("phrase de passe longue mobile 2026");
  await page.locator("#vault-ack").check();
  await page.locator("#vault-single-patient").check();
  await page.locator("#vault-submit").click();
  await page.locator("#vault-gate").waitFor({state:"hidden",timeout:30000});
  assert.equal(requests.length,0,"No external model API should be called before consent: "+requests);
  // Un patient novice peut terminer la découverte puis rouvrir l'aide à volonté.
  await page.locator("#first-steps").waitFor({state:"visible",timeout:15000});
  await page.locator("#dismiss-guide").click();
  await page.locator("#first-steps").waitFor({state:"hidden",timeout:15000});
  await page.locator("#open-guide").click();
  await page.locator("#first-steps").waitFor({state:"visible",timeout:15000});
  await page.locator("#dismiss-guide").click();
  await page.locator("#first-steps").waitFor({state:"hidden",timeout:15000});
  await page.locator('.mobile-dock [data-tab="tasks"]').click();
  await page.locator("#task-name").fill("Préparer un courrier");
  await page.locator("#task-form button[type=submit]").click();
  await page.locator("#tasks-list").getByText("Préparer un courrier").waitFor({timeout:15000});
  await page.locator('#mobile-menu-toggle').click();
  await page.locator('#app-side [data-tab="conditions"]').click();
  await page.locator("#condition-name").fill("<img src=x onerror=alert(1)>");
  await page.locator("#condition-form button[type=submit]").click();
  await page.locator("#conditions-list").getByText("<img src=x onerror=alert(1)>").waitFor({timeout:15000});
  assert.equal(await page.locator("#conditions-list img").count(),0,"Unsafe HTML injection");
  for(const width of [390,820]){
    await page.setViewportSize({width,height:860});
    const dim=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dim.scroll<=dim.viewport+2,label+": page overflow at "+width+" "+JSON.stringify(dim));
  }
  await page.locator('.mobile-dock [data-tab="chat"]').click();
  // Chat de secours utilisable sur Android et WebKit émulés sans Mistral ni poids IA.
  await page.locator("#prompt").fill("Bonjour");
  await page.locator('#chat-form button[type="submit"]').click();
  await page.locator("#messages .bubble").last().getByText(/Bonjour/).waitFor({timeout:10000});
  await page.locator('#chat-form button[type="submit"]').click({trial:true,timeout:12000}); // attend que la sauvegarde du coffre libère le formulaire
  assert.match(await page.locator("#chat-engine-state").textContent(),/Dernière réponse/);
  assert.equal(await page.locator("#gemma-options").isVisible(),false,"Local LLM panel hidden");
  assert.equal(await page.locator("#agnes-options").isVisible(),true,"Agnes settings visible");
  assert.equal(await page.locator("#mistral-options").isVisible(),false,"Advanced Mistral settings hidden in simple mode");
   await page.locator("#v30-advanced-toggle").click();
   assert.equal(await page.locator("#mistral-options").isVisible(),true,"Mistral settings available on explicit advanced toggle");
  assert.equal(await page.locator("#chat-local-mode").count(),0,"No local-mode button");
  console.log(label+": UI, coffre, formulaire, XSS, responsive OK (émulation, pas de matériel réel)");
 }finally{await browser.close();}
}
