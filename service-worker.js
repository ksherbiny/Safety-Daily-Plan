/* Daily Work Plan — Service Worker
   Strategy: cache-first for app shell, network-first for CDN resources
*/

const CACHE_NAME = 'daily-work-plan-v1';

// App shell: files that make the app work offline
const APP_SHELL = [
  './',
  './index.html',
  './sites-data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ── Fetch: cache-first for same-origin, network-only for CDN ─────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST for analytics)
  if (request.method !== 'GET') return;

  // CDN resources (Google Fonts, ExcelJS): network-first, fall back to cache
  if (url.origin !== self.location.origin) {
    event.respondWith(networkFirstThenCache(request));
    return;
  }

  // Same-origin app shell: cache-first, update cache in background
  event.respondWith(cacheFirstThenNetwork(request));
});

// Cache-first: serve from cache, fall back to network and update cache
async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not in cache — return a minimal offline fallback
    return new Response(
      '<h2 style="font-family:sans-serif;padding:2rem">You are offline. Open the app while online to cache it.</h2>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Network-first: try network, fall back to cache (good for CDN assets)
async function networkFirstThenCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}
