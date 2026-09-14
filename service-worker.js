const CACHE = 'chiwu-pwa-2262f732e39a';
const BASE = new URL('./', self.location.href);
const SHELL = ['./','./index.html','./manifest.webmanifest','./pwa.js','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('chiwu-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(new URL('index.html', BASE), copy)));
      }
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('index.html', BASE)))));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) await cache.put(event.request, response.clone());
    return response;
  }));
});
