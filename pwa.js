// Remove the retired Wuji worker/cache, then install the Chiwu worker.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.filter(registration => {
        const worker = registration.active || registration.waiting || registration.installing;
        return worker && new URL(worker.scriptURL).pathname.endsWith('/sw.js');
      }).map(registration => registration.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('wuji-')).map(key => caches.delete(key)));
      }
      const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' });
      await registration.update();
    } catch (error) {
      console.warn('离线缓存暂未就绪，下次联网打开会重试。', error);
    }
  });
}
