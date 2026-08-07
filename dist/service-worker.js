const BUILD_VERSION = "5.3.2-6fa38cd7e9a5";
const LOCAL_DEVELOPMENT = ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);
const SHELL_CACHE = `atlas-shell-${BUILD_VERSION}`;
const DATA_CACHE = `atlas-data-${BUILD_VERSION}`;
const DOCUMENT_CACHE = "atlas-documents-v1";

const SHELL = [
  "./", "./index.html", "./offline.html", "./manifest.webmanifest",
  "./styles/tokens.css", "./styles/base.css", "./styles/components.css",
  "./styles/themes.css", "./styles/responsive.css",
  "./scripts/database.js", "./scripts/runtime.js", "./scripts/bootstrap.js", "./scripts/storage.js",
  "./scripts/search.js", "./scripts/repository.js", "./scripts/share.js", "./scripts/statistics.js",
  "./scripts/library.js", "./scripts/reader.js", "./scripts/extras.js",
  "./scripts/examen.js",
  "./scripts/compare.js", "./scripts/feed-mixer.js", "./scripts/reels.js",
  "./scripts/router.js", "./scripts/app.js",
  "./assets/icons/icon-192.png", "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png", "./assets/icons/apple-touch-icon.png"
];

const timeoutFetch = (request, milliseconds = 4500) => Promise.race([
  fetch(request, { cache: "no-store" }),
  new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), milliseconds))
]);

self.addEventListener("install", event => {
  if (LOCAL_DEVELOPMENT) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    if (LOCAL_DEVELOPMENT) {
      await Promise.all(keys.filter(key => key.startsWith("atlas-")).map(key => caches.delete(key)));
      await self.clients.claim();
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach(client => client.postMessage({ type: "ATLAS_LOCAL_CACHE_CLEARED" }));
      return;
    }
    await Promise.all(keys
      .filter(key => key.startsWith("atlas-") && ![SHELL_CACHE, DATA_CACHE, DOCUMENT_CACHE].includes(key))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (LOCAL_DEVELOPMENT) return;
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const pathname = url.pathname;

  if (event.request.mode === "navigate") {
    event.respondWith(timeoutFetch(event.request).catch(async () =>
      await caches.match("./index.html") || await caches.match("./offline.html")
    ));
    return;
  }

  if (/\/data\/(?:documents|search)\//.test(pathname)) {
    event.respondWith(caches.open(DOCUMENT_CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }));
    return;
  }

  if (/\/(?:build-manifest\.json|data\/(?:catalog|version|external-content|youtube-live-cache|youtube-music-cache|instagram-cache|josemaria-quotes)\.json)$/.test(pathname)) {
    event.respondWith(caches.open(DATA_CACHE).then(async cache => {
      try {
        const response = await timeoutFetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch {
        return await cache.match(event.request) || Response.error();
      }
    }));
    return;
  }

  if (/\/(?:scripts|styles|assets)\//.test(pathname) || /\.(?:png|jpg|jpeg|svg|webmanifest)$/.test(pathname)) {
    event.respondWith(caches.open(SHELL_CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }));
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_DOCUMENT_CACHE") event.waitUntil(caches.delete(DOCUMENT_CACHE));
});
