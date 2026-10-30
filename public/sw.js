/* Minimal offline shell for CRTify (custom domain / site root). */
const CACHE = 'crtify-shell-v4';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './gif.worker.js',
];
/** Hashed build assets pile up across deploys; keep only the most recent entries. */
const MAX_ENTRIES = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

async function trimCache(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_ENTRIES;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

async function store(request, response) {
  if (!response.ok || !request.url.startsWith(self.location.origin)) return;
  const cache = await caches.open(CACHE);
  await cache.delete(request);
  await cache.put(request, response);
  await trimCache(cache);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Pages go network-first so a new deploy is picked up on the next load.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          event.waitUntil(store(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          event.waitUntil(store(request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
