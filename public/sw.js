// Minimal service worker: enables PWA installability and caches the static app
// shell. Dynamic/DB-backed pages stay network-first so data is never stale.
// Bumped v2 -> v3 to purge any stale /_next/static entries a device cached
// before the recipe-photo banner shipped (see the fix plan for how a device
// with only its LAN-IP origin visited could end up pinned to an old bundle).
const CACHE = "pantry-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for immutable build assets and generated icons.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Network-first for navigations, with a cached shell fallback when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((cached) => cached || caches.match("/"))),
    );
  }
});
