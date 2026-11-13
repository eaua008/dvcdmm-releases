// Service worker for the iPhone web app ("Add to Home Screen").
// Caches the app shell so it opens offline. The Profile → "Check for updates"
// button calls registration.update(); a new build installs, then we skip
// waiting and reload.
//
// CACHE is stamped with the version by scripts/publish-release.mjs, so each
// release changes this file and phones pick up the new build.
// Paths are relative to where the app is served (works on a sub-path too).
const CACHE = "dvcdmm-shell-v1.0.10";
const SHELL = new URL("./", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([SHELL, SHELL + "manifest.json"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache API / auth calls: always live from Supabase.
  if (url.origin !== self.location.origin) return;
  // Pages: network first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(SHELL)));
    return;
  }
  // Static files: cache first.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
