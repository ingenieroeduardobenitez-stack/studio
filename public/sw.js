
// Service Worker mínimo para cumplir con los requisitos de instalación de PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // No hacemos nada especial aquí, pero el evento debe existir
  return;
});
