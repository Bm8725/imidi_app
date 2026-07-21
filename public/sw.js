const CACHE_NAME = 'imidi-app';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  'https://googleapis.com'
];

// Instalare și adăugare în cache a resurselor esențiale
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Ștergerea cache-urilor vechi la actualizare
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Strategia Stale-While-Revalidate: încarcă rapid din cache, actualizează în fundal
self.addEventListener('fetch', (event) => {
  // Ignoră cererile care nu sunt HTTP/HTTPS (cum ar fi extensiile de browser sau chrome-extension)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cachedResponse); // Dacă pică rețeaua, rămâne pe cache

        return cachedResponse || fetchedResponse;
      });
    })
  );
});
