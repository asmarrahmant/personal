'use strict';

/* Service worker for the portfolio PWA.
 * - network-first for navigations + JSON (fresh content, offline fallback)
 * - stale-while-revalidate for other static assets (instant repeat loads)
 * - never touches /.netlify/functions/ (analytics must always be live)
 * - ignores cross-origin requests (fonts, GoatCounter, Cloudflare) — they go to network
 * Bump CACHE to invalidate everything on the next deploy. */

var CACHE = 'asmar-v1';
var PRECACHE = [
  '/', '/index.html', '/data.json', '/testimonials.json', '/manifest.json',
  '/images/profile.jpg', '/images/icon-192.png', '/images/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(PRECACHE).catch(function () {}); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

function cachePut(req, res) {
  var copy = res.clone();
  caches.open(CACHE).then(function (c) { c.put(req, copy); });
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // cross-origin → browser handles
  if (url.pathname.indexOf('/.netlify/') === 0) return;       // never cache serverless functions

  // network-first for page navigations + JSON data (always try fresh, fall back to cache offline)
  if (req.mode === 'navigate' || url.pathname.endsWith('.json')) {
    e.respondWith(
      fetch(req)
        .then(function (res) { return cachePut(req, res); })
        .catch(function () {
          return caches.match(req).then(function (m) { return m || caches.match('/index.html'); });
        })
    );
    return;
  }

  // stale-while-revalidate for everything else same-origin (images, etc.)
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req)
        .then(function (res) { return cachePut(req, res); })
        .catch(function () { return cached; });
      return cached || net;
    })
  );
});
