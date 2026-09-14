// One-time migration for browsers still controlled by the retired Wuji PWA.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('wuji-')).map(key => caches.delete(key)));
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await self.registration.unregister();
    await Promise.all(clients.map(client => client.navigate(client.url)));
  })());
});
