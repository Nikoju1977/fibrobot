/* FibroBot PWA — les données de santé restent dans IndexedDB, jamais dans ce cache. */
const CACHE="fibrobot-shell-v4";
const SHELL=["./","./index.html","./styles.css","./app.mjs","./core.mjs","./medical-library.mjs","./manifest.json","./icon.svg"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(x=>x.startsWith("fibrobot-shell-")&&x!==CACHE).map(x=>caches.delete(x)))),self.clients.claim()]));
});
self.addEventListener("fetch",event=>{
 const u=new URL(event.request.url);
 if(event.request.method!=="GET"||u.origin!==self.location.origin)return;
 if(event.request.mode==="navigate"){
  event.respondWith(fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy)).catch(()=>{});}
   return response;
  }).catch(()=>caches.match("./index.html")));
  return;
 }
 event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
  if(response.ok&&SHELL.some(p=>u.pathname.endsWith(p.slice(2)))){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});}
  return response;
 })));
});