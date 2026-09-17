const CACHE = "tamio-rhythm-v2";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/storage.js",
  "./js/haptics.js",
  "./js/spinner.js",
  "./js/fullscreen.js",
  "./js/slide-render.js",
  "./js/editor.js",
  "./js/player.js",
  "./js/app.js",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for the app shell so a new deploy shows up on the very next
// reload instead of waiting on a stale cache; falls back to cache when
// offline. Videos are never cached here (they're large and change often).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.includes("/videos/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
