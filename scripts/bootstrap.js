(async function () {
  "use strict";
  const runtime = window.AtlasRuntime;
  const main = document.querySelector("#main");
  const fallback = {
    quotes:{ generatedAt:"", items:[] }, exam:{ norms:[], helps:[], notifications:{}, sources:[] },
    faq:{ items:[] }, saintsMoods:{ moods:[] }, spiritualGuides:{}, songbook:{ songs:[], categories:[] },
    saintsShorts:{ items:[] }, saintsRoutes:{ routes:[] }, saintsTimelines:{ timelines:[] },
    josemariaExperiences:{ experiences:[] }, examGuides:{ guides:[] }
  };

  async function loadDeferredData() {
    const [quotes, exam, faq, saintsMoods, spiritualGuides, songbook, saintsShorts, saintsRoutes, saintsTimelines, josemariaExperiences, examGuides] = await Promise.all([
      runtime.fetchJson("data/quotes.json").catch(() => fallback.quotes),
      runtime.fetchJson("data/examen.json").catch(() => fallback.exam),
      runtime.fetchJson("data/preguntas-frecuentes.json").catch(() => fallback.faq),
      runtime.fetchJson("data/saints-moods.json").catch(() => fallback.saintsMoods),
      runtime.fetchJson("data/spiritual-guides.json").catch(() => fallback.spiritualGuides),
      runtime.fetchJson("data/songbook.json").catch(() => fallback.songbook),
      runtime.fetchJson("data/saints-shorts.json").catch(() => fallback.saintsShorts),
      runtime.fetchJson("data/saints-routes.json").catch(() => fallback.saintsRoutes),
      runtime.fetchJson("data/saints-timelines.json").catch(() => fallback.saintsTimelines),
      runtime.fetchJson("data/josemaria-experiences.json").catch(() => fallback.josemariaExperiences),
      runtime.fetchJson("data/exam-guides.json").catch(() => fallback.examGuides)
    ]);
    Object.assign(window, {
      ATLAS_QUOTES:quotes, ATLAS_EXAM:exam, ATLAS_FAQ:faq, ATLAS_SAINTS_MOODS:saintsMoods,
      ATLAS_SPIRITUAL_GUIDES:spiritualGuides, ATLAS_SONGBOOK:songbook, ATLAS_SAINTS_SHORTS:saintsShorts,
      ATLAS_SAINTS_ROUTES:saintsRoutes, ATLAS_SAINTS_TIMELINES:saintsTimelines,
      ATLAS_JOSEMARIA_EXPERIENCES:josemariaExperiences, ATLAS_EXAM_GUIDES:examGuides
    });
    window.dispatchEvent(new CustomEvent("atlas:data-ready", { detail:{ deferred:true } }));
  }

  try {
    const [catalog, external, youtube, music, instagram, channels, tenMinutes, gospelMeditations, opusdeiMeditations, bibleManifest, bibleTopics, jerusalemBibleManifest] = await Promise.all([
      runtime.fetchJson("data/catalog.json"),
      runtime.fetchJson("data/external-content.json").catch(() => ({ generatedAt:"", items:[] })),
      runtime.fetchJson("data/youtube-shorts.json").catch(() => ({ generatedAt:"", channels:[], items:[] })),
      runtime.fetchJson("data/youtube-music-cache.json").catch(() => ({ updatedAt:"", channels:[], items:[] })),
      runtime.fetchJson("data/instagram-cache.json").catch(() => ({ updatedAt:"", channels:[], items:[] })),
      runtime.fetchJson("data/channel-catalog.json").catch(() => ({ youtube:[], music:[], instagram:[] })),
      runtime.fetchJson("data/ten-minutes-daily.json", { fresh:true }).catch(() => ({ episodes:[] })),
      runtime.fetchJson("data/gospel-meditations.json", { fresh:true }).catch(() => ({ themes:[], meditations:[] })),
      runtime.fetchJson("data/opusdei-meditations.json", { fresh:true }).catch(() => ({ records:[] })),
      runtime.fetchJson("data/bible/manifest.json").catch(() => null),
      runtime.fetchJson("data/bible/topics.json").catch(() => ({ topics:[] })),
      runtime.fetchJson("data/bible-jerusalem/manifest.json").catch(() => null)
    ]);

    Object.assign(window, {
      ATLAS_CATALOG:catalog, ATLAS_EXTERNAL:external, ATLAS_YOUTUBE:youtube, ATLAS_MUSIC:music,
      ATLAS_INSTAGRAM:instagram, ATLAS_CHANNELS:channels, ATLAS_TEN_MINUTES:tenMinutes,
      ATLAS_GOSPEL_MEDITATIONS:gospelMeditations, ATLAS_OPUSDEI_MEDITATIONS:opusdeiMeditations,
      ATLAS_BIBLE_MANIFEST:bibleManifest, ATLAS_BIBLE_TOPICS:bibleTopics,
      ATLAS_BIBLE_JERUSALEM_MANIFEST:jerusalemBibleManifest,
      ATLAS_QUOTES:fallback.quotes, ATLAS_EXAM:fallback.exam, ATLAS_FAQ:fallback.faq,
      ATLAS_SAINTS_MOODS:fallback.saintsMoods, ATLAS_SPIRITUAL_GUIDES:fallback.spiritualGuides,
      ATLAS_SONGBOOK:fallback.songbook, ATLAS_SAINTS_SHORTS:fallback.saintsShorts,
      ATLAS_SAINTS_ROUTES:fallback.saintsRoutes, ATLAS_SAINTS_TIMELINES:fallback.saintsTimelines,
      ATLAS_JOSEMARIA_EXPERIENCES:fallback.josemariaExperiences, ATLAS_EXAM_GUIDES:fallback.examGuides
    });

    const modules = [
      "scripts/storage.js", "scripts/search.js", "scripts/repository.js", "scripts/share.js",
      "scripts/statistics.js", "scripts/library.js", "scripts/reader.js", "scripts/extras.js",
      "scripts/spiritual.js", "scripts/examen.js", "scripts/compare.js", "scripts/feed-mixer.js",
      "scripts/reels.js", "scripts/router.js", "scripts/bible.js", "scripts/salvation.js",
      "scripts/architecture.js", "scripts/app.js"
    ];
    for (const module of modules) await runtime.loadScript(module);
    loadDeferredData().catch(error => console.warn("Atlas: contenido secundario no disponible", error));
  } catch (error) {
    console.error(error);
    if (main) main.innerHTML = `<section class="page"><div class="empty-state"><h1>Atlas no pudo iniciar</h1><p>Falta algún archivo de la construcción pública. Ejecuta <code>npm run build</code> y vuelve a intentarlo.</p></div></section>`;
  }
})();
