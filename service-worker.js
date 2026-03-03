/* Daily Work Plan — Service Worker
   Fetch strategies:
     index.html / bare path  → network-first   (picks up new deploys immediately)
     all other same-origin   → cache-first + background revalidate
     CDN assets              → network-first, fall back to cache

   How updates roll out on Netlify:
     - Each deploy bumps BUILD_TIMESTAMP → new CACHE_NAME → old caches deleted
       on activate → clients.claim() makes the new SW take effect right away.
     - Users see the new version on their next page load with no manual steps.
*/

const CACHE_VERSION   = 'v1';
const CACHE_NAME      = `daily-plan-${CACHE_VERSION}-20260303120000`;

// Files to pre-cache on install so the app works offline from the first visit
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './sites-data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './data/lists.xlsx',
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  // Skip waiting so this SW activates as soon as it installs
  self.skipWaiting();
});

// ── Activate: purge old caches then claim all clients immediately ──────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key  => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET (e.g. POST to analytics)
  if (request.method !== 'GET') return;

  // CDN resources (Google Fonts, ExcelJS, SheetJS): network-first, cache as fallback
  if (url.origin !== self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // index.html and bare root path: always network-first so new deployments
  // are picked up on the very next page load
  const { pathname } = url;
  if (pathname === '/' || pathname.endsWith('/index.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Everything else (icons, manifest, lists.xlsx, sites-data.js, …): cache-first
  // with a silent background revalidation so cached copies stay fresh
  event.respondWith(cacheFirst(request));
});

// ── Network-first ─────────────────────────────────────────────────────────────
// Try the network; cache a fresh copy on success; fall back to cache if offline
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Offline and nothing cached — friendly HTML fallback for page requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response(
        '<h2 style="font-family:sans-serif;padding:2rem">You are offline. ' +
        'Open the app while online at least once to enable offline mode.</h2>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    return Response.error();
  }
}

// ── Cache-first with background revalidation (stale-while-revalidate) ─────────
// Serve instantly from cache; silently fetch a fresh copy in the background
// so the next request gets the updated file
async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    // Background refresh — fire and forget
    fetch(request)
      .then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response));
        }
      })
      .catch(() => { /* offline — keep using the cached copy */ });
    return cached;
  }

  // Not cached yet — fetch, cache, and return
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}
