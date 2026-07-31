(async function () {
  "use strict";
  const runtime = window.AtlasRuntime;
  const main = document.querySelector("#main");

  try {
    const [catalog, external, quotes, youtube, channels] = await Promise.all([
      runtime.fetchJson("data/catalog.json"),
      runtime.fetchJson("data/external-content.json").catch(() => ({ generatedAt: "", items: [] })),
      runtime.fetchJson("data/quotes.json").catch(() => ({ generatedAt: "", items: [] })),
      runtime.fetchJson("data/youtube-shorts.json").catch(() => ({ generatedAt: "", channels: [], items: [] })),
      runtime.fetchJson("data/channel-catalog.json").catch(() => ({ youtube: [], music: [], instagram: [] }))
    ]);

    window.ATLAS_CATALOG = catalog;
    window.ATLAS_EXTERNAL = external;
    window.ATLAS_QUOTES = quotes;
    window.ATLAS_YOUTUBE = youtube;
    window.ATLAS_CHANNELS = channels;

    const modules = [
      "scripts/storage.js",
      "scripts/search.js",
      "scripts/repository.js",
      "scripts/share.js",
      "scripts/statistics.js",
      "scripts/library.js",
      "scripts/reader.js",
      "scripts/extras.js",
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
