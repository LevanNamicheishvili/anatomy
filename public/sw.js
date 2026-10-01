/*
 * Offline support: after the first visit the atlas keeps working without internet (school networks
 * are often slow or down).
 *  - pages: network first, the saved copy when offline
 *  - Next.js build files (content-hashed): saved once, served from the cache
 *  - 3D models and other files: served from the cache at once, refreshed in the background
 */
const CACHE = "atlas-v2";

// On a developer's machine build files keep their names between changes, so a cache would serve stale
// styles and scripts. There the worker removes its caches, unregisters and reloads open pages.
const LOCAL = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", () => self.skipWaiting());

if (LOCAL) {
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
        await self.registration.unregister();
        for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
      })(),
    );
  });
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match("/")) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return (await refresh) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  if (LOCAL) return;
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") event.respondWith(networkFirst(request));
  else if (url.pathname.startsWith("/_next/static/")) event.respondWith(cacheFirst(request));
  else if (url.pathname.startsWith("/_next/")) return; // dev and data requests: leave alone
  else event.respondWith(staleWhileRevalidate(request, event));
});
