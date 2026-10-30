/* FibroBot PWA : uniquement les fichiers statiques ; aucune donnée de santé ni réponse API mise en cache. */
const VERSION="fibrobot-shell-v31";
const ASSETS=["./","./index.html","./styles.css","./ux-pro.css","./ux-pro.mjs","./app.mjs","./assistant-engine.mjs","./assistant-diagnostics.mjs","./agent-hub.mjs","./companion-engine.mjs","./conversation-context.mjs","./voice-input.mjs","./appointment-reminders.mjs","./care-briefing.mjs","./safe-preferences.mjs","./health-trends.mjs","./request-budget.mjs","./document-reader.mjs","./session-lock.mjs","./agnes-bridge.mjs","./agnes-credential-vault.mjs","./public-live-services.mjs","./live-feed-hub.mjs","./ambient-sound.mjs","./auto-engine.mjs","./life-actions.mjs","./local-commands.mjs","./medication-calendar.mjs","./reader-bookmark.mjs","./voice-health.mjs","./v28-insights.mjs","./reader-search.mjs","./foreground-reminders.mjs","./reading-range.mjs","./device-readiness.mjs","./session-guard.mjs","./book-reader.mjs","./research-library.mjs","./network-library.mjs","./knowledge-router.mjs","./medical-rag.mjs","./mistral-bridge.mjs","./mistral-credential-vault.mjs","./mistral-routing.mjs","./mcp-fibro-tools.mjs","./vault.mjs","./vault-ui.mjs","./core.mjs","./medical-library.mjs","./manifest.json","./icon.svg"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("fibrobot-shell-")&&k!==VERSION).map(k=>caches.delete(k)))),self.clients.claim()]));
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 const scopePath=new URL(self.registration.scope).pathname;
 const scopedNavigation=event.request.mode==="navigate"&&url.pathname.startsWith(scopePath);
 const assetPath=ASSETS.filter(path=>path!=="./").some(path=>new URL(path,self.registration.scope).pathname===url.pathname);
 if(!assetPath&&!scopedNavigation)return;
 event.respondWith((async()=>{
  const cache=await caches.open(VERSION);
  try{
   const response=await fetch(event.request);
   if(response.ok){await cache.put(event.request.mode==="navigate"?"./index.html":event.request,response.clone());}
   return response;
  }catch(error){
   const saved=await cache.match(event.request.mode==="navigate"?"./index.html":event.request);
   if(saved)return saved;
   throw error;
  }
 })());
});