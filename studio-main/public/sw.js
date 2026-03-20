
// Service Worker para el Santuario Nacional NSPS
const CACHE_NAME = 'santuario-nsps-v1';
const ASSETS = [
  '/',
  '/icon.png',
  '/logo.png',
  '/manifest.webmanifest'
];

// Instalación
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Estrategia de red: Network First, falling back to cache
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Manejo de Notificaciones Push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { 
    title: 'Santuario NSPS', 
    body: 'Tienes una nueva actualización en el sistema.' 
  };

  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
