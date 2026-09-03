// Format Press — Service Worker (offline-first for lab use)
// Caches piexifjs, fonts, and app shell. JPEGs are never cached.
const CACHE = 'format-press-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/piexifjs/1.0.6/piexif.js',
  'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Bebas+Neue&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Never cache image dataURLs or blob: — only GET http(s)
  if (e.request.method !== 'GET' || url.protocol === 'blob:' || url.protocol === 'data:') return;
  // Stale-while-revalidate for CDN, cache-first for app shell
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((resp) => {
        // Cache successful CDN + fonts
        if (resp.ok && (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('fonts.'))) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
