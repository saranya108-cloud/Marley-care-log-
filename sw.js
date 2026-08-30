/* Marley Care Log service worker — caches the app shell so it works offline.
   Bump the cache version when shipping changes to any cached file. */
"use strict";

const CACHE = "marley-care-log-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: serve from cache immediately, refresh the cache in
// the background so the next load picks up updates.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  const cacheKey = req.mode === "navigate" ? "./index.html" : req;
  event.respondWith(
    (async () => {
      const cached = await caches.match(cacheKey);
      const fresh = fetch(req)
        .then(async (res) => {
          if (res && res.ok) {
            const cache = await caches.open(CACHE);
            cache.put(cacheKey, res.clone());
          }
          return res;
        })
        .catch(() => null);
      return cached || (await fresh) || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    })()
  );
});
