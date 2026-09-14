'use strict';
const PREFIX='wuji-'+self.registration.scope+'-';
const CACHE=PREFIX+'v2.1.0';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'].map(p=>new URL(p,self.registration.scope).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>response.ok?response:caches.match(SHELL[1]).then(cached=>cached||response)).catch(()=>caches.match(SHELL[1])));
 }else if(SHELL.includes(event.request.url)){
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
 }
});
