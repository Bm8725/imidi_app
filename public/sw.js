/* iMIDI service worker (Next.js) */
const VERSION = 'v1'; // schimbă la fiecare release important
const CACHE_NAME = `imidi-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = ['/', OFFLINE_URL, '/manifest.json', '/icon.png'];

// Niciodată cache-uite: API, auth, sync cloud
const NETWORK_ONLY = [/^\/api\//, /^\/auth\//, /^\/sync\//, /^\/_next\/data\//];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('imidi-') && k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return;
  if (NETWORK_ONLY.some((re) => re.test(url.pathname))) return;
  if (url.searchParams.has('_rsc') || request.headers.get('RSC')) return;

  // Pagini: rețea întâi, apoi cache, apoi pagina offline
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) (await caches.open(CACHE_NAME)).put(request, fresh.clone());
          return fresh;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match('/')) ||
            (await caches.match(OFFLINE_URL))
          );
        }
      })()
    );
    return;
  }

  // Asset-uri Next cu hash în nume: cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })()
    );
    return;
  }

  // Restul: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return (await network) || Response.error();
    })()
  );
});