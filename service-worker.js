const BUILD_VERSION = "1.0.2-release";
const SHELL_CACHE = `atlas-shell-${BUILD_VERSION}`;
const DATA_CACHE = `atlas-data-${BUILD_VERSION}`;
const DOCUMENT_CACHE = `atlas-documents-${BUILD_VERSION}`;

const SHELL = [
  "./", "./index.html", "./offline.html", "./manifest.webmanifest",
  "./styles/tokens.css", "./styles/base.css", "./styles/components.css",
  "./styles/themes.css", "./styles/responsive.css", "./styles/features-5.4.css", "./styles/features-5.6.css", "./styles/reader-5.6.css", "./styles/saints-5.6.css", "./styles/features-5.7.css", "./styles/bible-6.2.css",
  "./styles/salvation.css", "./styles/salvation-cinematic.css", "./styles/architecture-6.4.css", "./styles/opus-resources.css", "./styles/experience-6.5.css",
  "./scripts/database.js", "./scripts/runtime.js", "./scripts/bootstrap.js", "./scripts/storage.js",
  "./scripts/search.js", "./scripts/repository.js", "./scripts/share.js", "./scripts/statistics.js",
  "./scripts/library.js", "./scripts/reader.js", "./scripts/extras.js",
  "./scripts/spiritual.js",
  "./scripts/examen.js",
  "./scripts/compare.js", "./scripts/feed-mixer.js", "./scripts/reels.js",
  "./scripts/router.js", "./scripts/bible.js", "./scripts/salvation.js", "./scripts/architecture.js", "./scripts/app.js",
  "./data/ten-minutes-daily.json", "./data/gospel-meditations.json", "./data/opusdei-meditations.json",
  "./data/bible/manifest.json", "./data/bible/topics.json", "./data/bible-jerusalem/manifest.json",
  "./assets/images/atlas-public-qr.svg", "./assets/images/atlas-share-card.png", "./assets/images/atlas-library-fallback.svg",
  "./assets/images/libraries/bibliotecariaportada.webp", "./assets/images/libraries/canoniaportada.webp", "./assets/images/libraries/cinepilotportada.webp",
  "./assets/images/libraries/clasicosportada.webp", "./assets/images/libraries/historiaportada.webp", "./assets/images/libraries/liturgiaportada.webp",
  "./assets/images/libraries/ortodoxiaportada.webp", "./assets/images/libraries/portadaSanJosemarIA.webp", "./assets/images/libraries/preparadordecirculosportada.webp",
  "./assets/icons/icon-192.png", "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png", "./assets/icons/apple-touch-icon.png"
];

const timeoutFetch = (request, milliseconds = 4500) => Promise.race([
  fetch(request, { cache: "no-store" }),
  new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), milliseconds))
]);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("atlas-") && ![SHELL_CACHE, DATA_CACHE, DOCUMENT_CACHE].includes(key))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
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

  if (/\/data\/(?:documents|search)\//.test(pathname) || /\/data\/(?:saints-moods|saints-shorts|saints-routes|saints-timelines|spiritual-guides|songbook|josemaria-experiences|exam-guides|examen|quotes|preguntas-frecuentes)\.json$/.test(pathname) || /\/data\/salvation-history\.json$/.test(pathname) || /\/data\/bible(?:-jerusalem)?\/(?:books\/|search-index\.json\.gz$)/.test(pathname) || /\/content\/(?:opusdei-meditations|salvation)\//.test(pathname)) {
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

  if (/\/(?:scripts|styles|assets)\//.test(pathname) || /\.(?:png|jpg|jpeg|webp|svg|webmanifest)$/.test(pathname)) {
    event.respondWith(caches.open(SHELL_CACHE).then(async cache => {
      try {
        const response = await timeoutFetch(event.request, 6000);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch {
        return await cache.match(event.request) || Response.error();
      }
    }));
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_DOCUMENT_CACHE") event.waitUntil(caches.delete(DOCUMENT_CACHE));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const route = new URL(event.notification.data?.route || "#/", self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
    const existing = clients[0];
    if (existing) { await existing.focus(); await existing.navigate(route); return; }
    return self.clients.openWindow(route);
  }));
});
