/* GSM service worker: makes the game installable and keeps the heavy images on the phone.
   Images (club logos, trophies, backdrops) are cached after the first view; pages and data always come from the network,
   so a new version of the game is never stuck behind an old cache. */
const CACHE = "gsm-images-v1";
const IMAGE_PATHS = ["/club-logos/", "/league-logos/", "/trophies/", "/studio/", "/icons/"];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!IMAGE_PATHS.some((p) => url.pathname.startsWith(p))) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
      )
    )
  );
});
