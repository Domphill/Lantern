/* Lantern — offline support. Every app file is cached when this worker installs, so Lantern opens
   without a connection, and a page always gets all of its files from one version. Bump VERSION
   whenever a file in FILES changes, or phones keep using the old copy; the new version is picked up
   on the next launch after that. Entries never pass through here: they live in the browser's own
   storage. Only caches named lantern-* are touched, because other apps share this origin. */
const VERSION = 'lantern-v1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
  'fonts/fonts.css',
  'fonts/alegreya-italic-400-700-latin-ext.woff2',
  'fonts/alegreya-italic-400-700-latin.woff2',
  'fonts/alegreya-normal-400-700-latin-ext.woff2',
  'fonts/alegreya-normal-400-700-latin.woff2',
  'fonts/alegreya-sans-italic-400-latin-ext.woff2',
  'fonts/alegreya-sans-italic-400-latin.woff2',
  'fonts/alegreya-sans-normal-400-latin-ext.woff2',
  'fonts/alegreya-sans-normal-400-latin.woff2',
  'fonts/alegreya-sans-normal-500-latin-ext.woff2',
  'fonts/alegreya-sans-normal-500-latin.woff2',
  'fonts/alegreya-sans-normal-700-latin-ext.woff2',
  'fonts/alegreya-sans-normal-700-latin.woff2',
  'src/app.css',
  'src/core.js',
  'src/crypto.js',
  'src/store.js',
  'src/ui.js',
  'src/charts.js',
  'src/view-today.js',
  'src/view-journal.js',
  'src/view-goals.js',
  'src/view-insights.js',
  'src/view-toolkit.js',
  'src/view-support.js',
  'src/view-settings.js',
  'src/demo.js',
  'src/app.js'
];

self.addEventListener('install', (e) => {
  /* cache: 'reload' skips the browser's HTTP cache, so a new version never precaches stale files. */
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lantern-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        if (hit) return hit;
        return fetch(req)
          .then((res) => {
            /* Anything outside the list is kept once seen, so it also works offline next time. */
            if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
            return res;
          })
          .catch((err) => {
            /* Offline and not cached: any page within Lantern falls back to the app itself. */
            if (req.mode === 'navigate') return cache.match('./').then((page) => page || Promise.reject(err));
            throw err;
          });
      })
    )
  );
});
