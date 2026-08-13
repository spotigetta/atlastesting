(async function () {
  "use strict";
  const runtime = window.AtlasRuntime;
  const main = document.querySelector("#main");

  try {
    const [catalog, external, quotes, youtube, music, instagram, channels, exam, saintsMoods, spiritualGuides, songbook, saintsShorts, saintsRoutes, saintsTimelines, josemariaExperiences, examGuides, tenMinutes] = await Promise.all([
      runtime.fetchJson("data/catalog.json"),
      runtime.fetchJson("data/external-content.json").catch(() => ({ generatedAt: "", items: [] })),
      runtime.fetchJson("data/quotes.json").catch(() => ({ generatedAt: "", items: [] })),
      runtime.fetchJson("data/youtube-shorts.json").catch(() => ({ generatedAt: "", channels: [], items: [] })),
      runtime.fetchJson("data/youtube-music-cache.json").catch(() => ({ updatedAt: "", channels: [], items: [] })),
      runtime.fetchJson("data/instagram-cache.json").catch(() => ({ updatedAt: "", channels: [], items: [] })),
      runtime.fetchJson("data/channel-catalog.json").catch(() => ({ youtube: [], music: [], instagram: [] })),
      runtime.fetchJson("data/examen.json").catch(() => ({ norms: [], helps: [], notifications: {}, sources: [] })),
      runtime.fetchJson("data/saints-moods.json").catch(() => ({ moods: [] })),
      runtime.fetchJson("data/spiritual-guides.json").catch(() => ({})),
      runtime.fetchJson("data/songbook.json").catch(() => ({ songs: [], categories: [] })),
      runtime.fetchJson("data/saints-shorts.json").catch(() => ({ items: [] })),
      runtime.fetchJson("data/saints-routes.json").catch(() => ({ routes: [] })),
      runtime.fetchJson("data/saints-timelines.json").catch(() => ({ timelines: [] })),
      runtime.fetchJson("data/josemaria-experiences.json").catch(() => ({ experiences: [] })),
      runtime.fetchJson("data/exam-guides.json").catch(() => ({ guides: [] })),
      runtime.fetchJson("data/ten-minutes-daily.json", { fresh: true }).catch(() => ({ episodes: [] }))
    ]);

    window.ATLAS_CATALOG = catalog;
    window.ATLAS_EXTERNAL = external;
    window.ATLAS_QUOTES = quotes;
    window.ATLAS_YOUTUBE = youtube;
    window.ATLAS_MUSIC = music;
    window.ATLAS_INSTAGRAM = instagram;
    window.ATLAS_CHANNELS = channels;
    window.ATLAS_EXAM = exam;
    window.ATLAS_SAINTS_MOODS = saintsMoods;
    window.ATLAS_SPIRITUAL_GUIDES = spiritualGuides;
    window.ATLAS_SONGBOOK = songbook;
    window.ATLAS_SAINTS_SHORTS = saintsShorts;
    window.ATLAS_SAINTS_ROUTES = saintsRoutes;
    window.ATLAS_SAINTS_TIMELINES = saintsTimelines;
    window.ATLAS_JOSEMARIA_EXPERIENCES = josemariaExperiences;
    window.ATLAS_EXAM_GUIDES = examGuides;
    window.ATLAS_TEN_MINUTES = tenMinutes;

    const modules = [
      "scripts/storage.js",
      "scripts/search.js",
      "scripts/repository.js",
      "scripts/share.js",
      "scripts/statistics.js",
      "scripts/library.js",
      "scripts/reader.js",
      "scripts/extras.js",
      "scripts/spiritual.js",
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
