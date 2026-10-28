/* FibroBot local-first : seulement les fichiers statiques, jamais IndexedDB. */
const VERSION="fibrobot-shell-v16";
const ASSETS=["./","./index.html","./styles.css","./ux-pro.css","./ux-pro.mjs","./app.mjs","./gemma-local.mjs","./gemma-worker.mjs","./assistant-engine.mjs","./agent-hub.mjs","./research-library.mjs","./network-library.mjs","./knowledge-router.mjs","./medical-rag.mjs","./mistral-bridge.mjs","./mistral-credential-vault.mjs","./mistral-routing.mjs","./mcp-fibro-tools.mjs","./vault.mjs","./vault-ui.mjs","./core.mjs","./medical-library.mjs","./manifest.json","./icon.svg"];
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
 const allowed=ASSETS.filter(path=>path!=="./").some(path=>url.pathname.endsWith(path.slice(2)))||event.request.mode==="navigate";
 if(!allowed)return;
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