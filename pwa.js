// Install and cache only this application, leaving the study app untouched.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(error => console.warn('离线缓存暂未就绪，下次联网打开会重试。', error));
  });
}
