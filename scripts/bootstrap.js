(async function () {
  "use strict";
  const runtime = window.AtlasRuntime;
  const main = document.querySelector("#main");

  try {
    const [catalog, external, quotes, youtube, music, instagram, channels, exam] = await Promise.all([
      runtime.fetchJson("data/catalog.json"),
      runtime.fetchJson("data/external-content.json").catch(() => ({ generatedAt: "", items: [] })),
      runtime.fetchJson("data/quotes.json").catch(() => ({ generatedAt: "", items: [] })),
      runtime.fetchJson("data/youtube-shorts.json").catch(() => ({ generatedAt: "", channels: [], items: [] })),
      runtime.fetchJson("data/youtube-music-cache.json").catch(() => ({ updatedAt: "", channels: [], items: [] })),
      runtime.fetchJson("data/instagram-cache.json").catch(() => ({ updatedAt: "", channels: [], items: [] })),
      runtime.fetchJson("data/channel-catalog.json").catch(() => ({ youtube: [], music: [], instagram: [] })),
      runtime.fetchJson("data/examen.json").catch(() => ({ norms: [], helps: [], notifications: {}, sources: [] }))
    ]);

    window.ATLAS_CATALOG = catalog;
    window.ATLAS_EXTERNAL = external;
    window.ATLAS_QUOTES = quotes;
    window.ATLAS_YOUTUBE = youtube;
    window.ATLAS_MUSIC = music;
    window.ATLAS_INSTAGRAM = instagram;
    window.ATLAS_CHANNELS = channels;
    window.ATLAS_EXAM = exam;

    const modules = [
      "scripts/storage.js",
      "scripts/search.js",
      "scripts/repository.js",
      "scripts/share.js",
      "scripts/statistics.js",
      "scripts/library.js",
      "scripts/reader.js",
      "scripts/extras.js",
      "scripts/examen.js",
      "scripts/compare.js",
      "scripts/feed-mixer.js",
      "scripts/reels.js",
      "scripts/router.js",
      "scripts/app.js"
    ];
    for (const module of modules) await runtime.loadScript(module);
  } catch (error) {
    console.error(error);
    if (main) {
      main.innerHTML = `<section class="page"><div class="empty-state"><h1>Atlas no pudo iniciar</h1><p>Falta algún archivo de la construcción pública. Ejecuta <code>npm run build</code> y vuelve a intentarlo.</p></div></section>`;
    }
  }
})();
