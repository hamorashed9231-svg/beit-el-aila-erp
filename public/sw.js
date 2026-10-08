const CACHE_NAME = 'beit-el-aila-offline-v7';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/logo.jpg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Network-First strategy with Offline Cache Fallback for pages & static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Don't cache Firebase RTDB or API state calls in SW (handled by localStorage in api.js)
  if (url.hostname.includes('firebaseio.com') || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // If navigating to /store or / while offline, serve cached /index.html
        if (request.mode === 'navigate') {
          const fallbackHtml = (await caches.match('/index.html')) || (await caches.match('/'));
          if (fallbackHtml) return fallbackHtml;
        }
        throw new Error('Offline and not in cache');
      })
  );
});
