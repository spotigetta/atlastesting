(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const typeLabels = {
    document: "Documento", fact: "Dato del índice", question: "Pregunta",
    quiz: "Quiz", quote: "Cita para explorar", author: "Autor",
    timeline: "Mini cronología", curiosity: "Sabías que", comparison: "Distinción clave",
    news: "Actualidad", reading: "Nueva lectura", youth: "Youth · Opus Dei", prayer: "Para orar", video: "Vídeo · YouTube", music: "Música · YouTube", instagram: "Instagram",
    "saint-life": "Una vida en 30 segundos", "saint-anecdote": "La anécdota", "saint-quote": "La frase", "saint-decision": "Momento decisivo", "saint-before": "Antes de ser santo", "saint-quiz": "Adivina el santo", "saint-route": "Ruta espiritual"
  };
  let queue = [];
  let cursor = 0;
  let observer;
  let activeFilter = "all";
  let videoCursor = 0;
  let videoHasMore = true;
  let videoLoading = false;
  let musicCursor = 0;
  let musicHasMore = true;
  let musicLoading = false;
  let feedSeed = "";
  let musicRefreshRetries = 0;
  let instagramCursor = 0;
  let instagramHasMore = true;
  let instagramLoading = false;
  let auroraFrame = 0;
  let feedCards = [];
  let activeCard = null;
  let auroraFromLayer = null;
  let auroraToLayer = null;
  let magnetTimer = 0;
  let magnetFrame = 0;
  let magnetizing = false;
  let gestureActive = false;
  let refreshBusy = false;
  let pullStart = 0;
  let pullDistance = 0;
  const batchSize = 18;

  function shuffle(items) {
    return window.AtlasFeedMixer.shuffled(items);
  }

  function interleaveSources(items) {
    const groups = new Map();
    shuffle(items).forEach(item => groups.set(item.source || "", [...(groups.get(item.source || "") || []), item]));
    const result=[]; let buckets=shuffle([...groups.values()]);
    while (buckets.length) { buckets.forEach(bucket=>{const item=bucket.shift();if(item)result.push(item);}); buckets=shuffle(buckets.filter(bucket=>bucket.length)); }
    return result;
  }

  const enabledItems = (items, setting) => {
    const hidden = new Set(root.storage.get().settings[setting] || []);
    return (items || []).filter(item => !hidden.has(item.source || item.name));
  };

  function saintEditorialItem(item) {
    const typeMap = { "life-30s":"saint-life", anecdote:"saint-anecdote", quote:"saint-quote", "decisive-moment":"saint-decision", "before-after":"saint-before", "did-you-know":"curiosity", "against-current":"saint-decision", "guess-saint":"saint-quiz", "who-said":"saint-quiz", decision:"saint-decision" };
    let text = item.body || item.context || item.explanation || item.answer || "";
    if (item.slides?.length) text = item.slides.map(slide => `${slide.eyebrow}: ${slide.text}`).join(" · ");
    if (item.before || item.turningPoint || item.after) text = [`Antes: ${item.before || ""}`, `El giro: ${item.turningPoint || ""}`, `Después: ${item.after || ""}`].join(" · ");
    if (item.clues?.length) text = item.clues.map(clue => `• ${clue}`).join(" ");
    if (item.quote) text = `“${item.quote}”${item.context ? ` ${item.context}` : ""}`;
    if (item.question) text = `${item.placeDate ? `${item.placeDate}. ` : ""}${item.question}`;
    const reveal = item.type === "guess-saint" ? `${item.answer}. ${item.explanation || ""}` : item.type === "who-said" ? `${item.answer}. ${item.context || ""}` : item.type === "decision" ? item.answer : "";
    return { ...item, type:typeMap[item.type] || item.type, text, reveal, author:item.saint || "", reference:"Vida de los Santos · biografía enlazada", verified:true, libraryId:"vida-santos" };
  }

  async function instagramPayload(cursorValue = 0, limit = 24) {
    const payload = await window.AtlasRuntime.fetchJson("data/instagram-cache.json", { fresh: true });
    const concrete = (payload.items || []).filter(item => !item.profileFallback && item.image && /\/(?:p|reel)\//.test(item.url || ""));
    const ordered = shuffle(concrete.length ? concrete : (payload.items || []).filter(item => !item.profileFallback));
    const items = ordered.slice(cursorValue, cursorValue + limit);
    return { ...payload, items, cursor: cursorValue, nextCursor: cursorValue + items.length, hasMore: cursorValue + items.length < ordered.length, total: ordered.length };
  }

  async function musicPayload(cursorValue = 0, limit = 24) {
    const fallback = await window.AtlasRuntime.fetchJson("data/youtube-music-cache.json", { fresh: true });
    const ordered = interleaveSources(fallback.items || []);
    const items = ordered.slice(cursorValue, cursorValue + limit);
    return {
      items, channels: fallback.channels || [], cursor: cursorValue,
      nextCursor: cursorValue + items.length,
      hasMore: cursorValue + items.length < ordered.length,
      total: ordered.length, updatedAt: fallback.updatedAt,
      source: "reserva-local", stale: true, refreshing: false
    };
  }

  function render(filter = "all") {
    activeFilter = filter;
    videoCursor = 0;
    videoHasMore = true;
    musicCursor = 0;
    musicHasMore = true;
    instagramCursor = 0;
    instagramHasMore = true;
    musicRefreshRetries = 0;
    feedSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let shorts = [
      ...root.data.catalog.shorts.filter(item => item.verified),
      ...(window.ATLAS_QUOTES?.items || []),
      ...(window.ATLAS_SAINTS_SHORTS?.items || []).map(saintEditorialItem)
    ];
    const external = (window.ATLAS_EXTERNAL?.items || []).map(item => ({
      ...item, verified: true, external: true, libraryId: externalLibrary(item.type),
      type: item.type === "books" ? "reading" : item.type,
      text: item.description, reference: item.source, reviewedAt: item.date || window.ATLAS_EXTERNAL.generatedAt.slice(0, 10)
    }));
    const videos = enabledItems(window.ATLAS_YOUTUBE?.items, "disabledVideoChannels").map(item => ({
      ...item, text: item.description, reference: `${item.source} · YouTube`,
      reviewedAt: window.ATLAS_YOUTUBE.generatedAt?.slice(0, 10)
    }));
    const music = enabledItems(window.ATLAS_MUSIC?.items, "disabledMusicChannels").map(item => ({
      ...item, type: "music", verified: true, external: true,
      libraryId: item.libraryId || "liturgy", text: item.description,
      reference: `${item.source} · YouTube`, reviewedAt: item.publishedAt?.slice(0, 10) || window.ATLAS_MUSIC?.updatedAt?.slice(0, 10)
    }));
    const instagram = enabledItems(window.ATLAS_INSTAGRAM?.items, "disabledInstagramChannels").map(item => ({
      ...item, type: "instagram", verified: true, external: true,
      libraryId: item.libraryId || "doctrine", text: item.description,
      reference: `${item.source} · Instagram`, reviewedAt: item.publishedAt?.slice(0, 10) || window.ATLAS_INSTAGRAM?.updatedAt?.slice(0, 10)
    }));
    shorts = filter === "all" ? balanceEditorial(shorts) : shorts;
    shorts = mixExternal(shorts, filter === "all" ? balanceExternal([...external, ...videos, ...music, ...instagram]) : [...external, ...videos, ...music, ...instagram]);
    if (filter !== "all") shorts = shorts.filter(item => item.libraryId === filter || item.type === filter);
    const seen = new Set(root.storage.get().seenShorts || []);
    if (root.storage.get().settings.onlyNewShorts) {
      const unseen = shorts.filter(item => !seen.has(item.id));
      /* Nunca dejamos el feed vacío ni reducido a una sola fuente por un snapshot ya visto. */
      if (unseen.length >= Math.min(10, shorts.length)) shorts = unseen;
    }
    queue = filter === "all" ? mixedAll(shorts) : constrained(shorts);
    cursor = 0;
    const initial = nextBatch();
    requestAnimationFrame(() => {
      bind();
      refreshJosemaria();
      if (filter === "all" || filter === "video") loadLiveVideos(true);
      if (filter === "all" || filter === "music") loadLiveMusic(true);
      if (filter === "all" || filter === "instagram") loadLiveInstagram(true);
    });
    const settings=root.storage.get().settings; const hiddenLibraries=new Set(settings.hiddenLibraries||[]);
    const filterLibraries=root.data.catalog.libraries.filter(item=>(!item.unlockFeature||root.storage.isFeatureUnlocked(item.unlockFeature))&&!hiddenLibraries.has(item.id));
    const filters = [["all","Todos"],["video","Vídeos"],["music","Música"],["instagram","Instagram"],["youth","Youth"],["news","Noticias"],["reading","Lecturas"],["prayer","Oración"],["quote","Frases"],["fact","Hechos"],["curiosity","Anécdotas"],
      ["question","Preguntas"],["comparison","Distinciones"],
      ...filterLibraries.map(item => [item.id, settings.libraryLabels?.[item.id]||item.short]), ["document","Documentos"],["quiz","Quiz"],["author","Autores"],["timeline","Cronología"]];
    const primaryFilters = filters.filter(([id]) => ["all","video","quote","music","news","reading"].includes(id));
    const secondaryFilters = filters.filter(([id]) => !primaryFilters.some(([primary]) => primary === id));
    return `<div class="discover-page">
      <div class="short-filters"><div class="chip-row short-filter-desktop">${primaryFilters.map(([id,label]) => `<button class="chip ${filter===id?"active":""}" data-short-filter="${id}">${esc(label)}</button>`).join("")}<details class="short-more-menu"><summary class="${secondaryFilters.some(([id])=>id===filter)?"active":""}">Más <span>＋</span></summary><div>${secondaryFilters.map(([id,label])=>`<button class="${filter===id?"active":""}" data-short-filter="${esc(id)}">${esc(label)}</button>`).join("")}</div></details></div><div class="short-filter-mobile"><div>${primaryFilters.map(([id,label]) => `<button class="${filter===id?"active":""}" data-short-filter="${id}">${esc(label)}</button>`).join("")}</div><details class="short-more-menu"><summary class="${secondaryFilters.some(([id])=>id===filter)?"active":""}">Más <span>＋</span></summary><div>${secondaryFilters.map(([id,label])=>`<button class="${filter===id?"active":""}" data-short-filter="${esc(id)}">${esc(label)}</button>`).join("")}</div></details></div>
      ${filter === "video" ? `<div class="short-channel-row">${enabledItems(window.ATLAS_YOUTUBE?.channels, "disabledVideoChannels").filter(channel => channel.tier !== "reserve" || root.storage.get().settings.showReserveVideos).map(channel => `<a href="${esc(channel.url)}" target="_blank" rel="noopener">${esc(channel.name)} ↗</a>`).join("")}</div>` : ""}
      ${filter === "video" ? `<button class="reserve-video-toggle ${root.storage.get().settings.showReserveVideos ? "active" : ""}" data-toggle-reserve-videos>${root.storage.get().settings.showReserveVideos ? "Canales de reserva activados" : "Canales de reserva desactivados"}</button>` : ""}</div>
      ${["all","video","music","instagram"].includes(filter) ? '<span class="youtube-live-status" id="youtube-live-status">Actualizando canales…</span>' : ""}
      <div class="short-refresh-indicator" aria-live="polite"><span>↻</span><b>Arrastra para actualizar</b></div>
      <div class="short-aurora" aria-hidden="true"><i></i><b></b></div><div class="short-feed">${initial || root.library.empty(filter === "instagram" ? "No hay publicaciones reales disponibles" : "No quedan contenidos nuevos", filter === "instagram" ? "Añade enlaces directos de publicaciones en el Gestor o configura Meta Business Discovery." : "Desactiva «Solo contenido nuevo» en Guardados.")}</div>
    </div>`;
  }

  async function loadLiveVideos(reset = false) {
    if (videoLoading || (!reset && !videoHasMore) || !["all", "video"].includes(activeFilter)) return;
    videoLoading = true;
    const status = document.querySelector("#youtube-live-status");
    if (status) status.textContent = reset ? "Consultando canales…" : "Cargando más vídeos…";
    try {
      const start = reset ? 0 : videoCursor;
      const snapshot = await window.AtlasRuntime.fetchJson("data/youtube-live-cache.json", { fresh: reset });
      const ordered = shuffle(snapshot.items || []);
      const selected = ordered.slice(start, start + 24);
      const payload = {
        ...snapshot, items: selected, cursor: start,
        nextCursor: start + selected.length,
        hasMore: start + selected.length < ordered.length,
        total: ordered.length
      };
      videoCursor = payload.nextCursor;
      videoHasMore = payload.hasMore;
      const known = new Set(queue.map(item => item.id));
      const reserveEnabled = root.storage.get().settings.showReserveVideos;
      let eligible = enabledItems(payload.items, "disabledVideoChannels").filter(item => item.tier !== "reserve" || reserveEnabled);
      if (root.storage.get().settings.onlyNewShorts) { const unseen=eligible.filter(item=>!root.storage.get().seenShorts.includes(item.id)); if(unseen.length>=6) eligible=unseen; }
      const paced = reserveEnabled
        ? [...eligible.filter(item => item.tier !== "reserve"), ...eligible.filter(item => item.tier === "reserve").slice(0, 2)]
        : eligible;
      const fresh = paced.map(item => ({
        ...item,
        text: item.description,
        reference: `${item.source} · YouTube`,
        reviewedAt: item.publishedAt?.slice(0, 10) || payload.updatedAt?.slice(0, 10)
      })).filter(item => !known.has(item.id));
      const randomizedFresh = constrained(fresh);
      const feed = document.querySelector(".short-feed");
      incorporateFresh(randomizedFresh, feed);
      if (status) {
        const updated = payload.updatedAt ? new Date(payload.updatedAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : "ahora";
        status.textContent = `${payload.total} vídeos · actualizado ${updated}`;
      }
    } catch {
      if (status) status.textContent = "Mostrando la última selección guardada";
    } finally {
      videoLoading = false;
    }
  }

  async function loadLiveMusic(reset = false) {
    if (musicLoading || (!reset && !musicHasMore) || !["all", "music"].includes(activeFilter)) return;
    musicLoading = true;
    const status = document.querySelector("#youtube-live-status");
    if (status) status.textContent = reset ? "Afinando la selección musical…" : "Cargando más música…";
    try {
      const start = reset ? 0 : musicCursor;
      const payload = await musicPayload(start, 24);
      musicCursor = payload.nextCursor;
      musicHasMore = payload.hasMore;
      const known = new Set(queue.map(item => item.id));
      let eligibleMusic = enabledItems(payload.items, "disabledMusicChannels");
      if (root.storage.get().settings.onlyNewShorts) { const unseen=eligibleMusic.filter(item=>!root.storage.get().seenShorts.includes(item.id)); if(unseen.length>=6) eligibleMusic=unseen; }
      const fresh = eligibleMusic.map(item => ({
        ...item, libraryId: item.libraryId || "liturgy",
        text: item.description, reference: `${item.source} · YouTube`,
        reviewedAt: item.publishedAt?.slice(0, 10) || payload.updatedAt?.slice(0, 10)
      })).filter(item => !known.has(item.id));
      const randomizedFresh = constrained(fresh);
      const feed = document.querySelector(".short-feed");
      incorporateFresh(randomizedFresh, feed);
      if (status) status.textContent = `${payload.total} propuestas musicales · selección dinámica`;
      if (payload.refreshing && musicRefreshRetries < 3) {
        musicRefreshRetries += 1;
        setTimeout(() => loadLiveMusic(true), 7000);
      }
    } catch {
      if (status && activeFilter === "music") status.textContent = "La selección musical no está disponible todavía";
    } finally {
      musicLoading = false;
    }
  }

  async function loadLiveInstagram(reset = false) {
    if (instagramLoading || (!reset && !instagramHasMore) || !["all", "instagram"].includes(activeFilter)) return;
    instagramLoading = true;
    const status = document.querySelector("#youtube-live-status");
    if (status) status.textContent = "Consultando publicaciones de Instagram…";
    try {
      const start = reset ? 0 : instagramCursor;
      const payload = await instagramPayload(start, 24);
      instagramCursor = payload.nextCursor;
      instagramHasMore = payload.hasMore;
      const known = new Set(queue.map(item => item.id));
      let eligibleInstagram=enabledItems(payload.items, "disabledInstagramChannels");
      if (root.storage.get().settings.onlyNewShorts) { const unseen=eligibleInstagram.filter(item=>!root.storage.get().seenShorts.includes(item.id)); if(unseen.length>=4) eligibleInstagram=unseen; }
      const fresh = shuffle(eligibleInstagram.map(item => ({
        ...item, type: "instagram", external: true, verified: true,
        libraryId: item.libraryId || "doctrine", text: item.description,
        reference: `${item.source} · Instagram`
      })).filter(item => !known.has(item.id)));
      const feed = document.querySelector(".short-feed");
      incorporateFresh(fresh, feed);
      if (status && activeFilter === "instagram") status.textContent = `${payload.total || fresh.length} publicaciones · selección dinámica`;
    } catch {
      if (status && activeFilter === "instagram") status.textContent = "Instagram necesita publicaciones directas o credenciales de Meta configuradas en el Gestor";
    } finally { instagramLoading = false; }
  }

  function externalLibrary(type) {
    if (type === "prayer" || type === "quote") return "doctrine";
    if (type === "books") return "history";
    return "liturgy";
  }

  function mixExternal(shorts, external) {
    if (!external.length) return shorts;
    const mixed = [];
    const editorial = shuffle(shorts);
    const current = shuffle(external);
    let cursor = 0;
    editorial.forEach((item, index) => {
      mixed.push(item);
      if ((index + 1) % 3 === 0 && cursor < current.length) mixed.push(current[cursor++]);
    });
    mixed.push(...current.slice(cursor));
    return mixed;
  }

  function takeRandom(items, limit) { return shuffle(items).slice(0, limit); }

  function balanceEditorial(items) {
    const limits = { document: 3, author: 4, timeline: 10, question: 18, quiz: 14, curiosity: 18, quote: 120 };
    const grouped = new Map();
    items.forEach(item => grouped.set(item.type, [...(grouped.get(item.type) || []), item]));
    return [...grouped.entries()].flatMap(([type, values]) => takeRandom(values, limits[type] || values.length));
  }

  function balanceExternal(items) {
    const limits = { reading: 4, news: 10, prayer: 9, quote: 12, video: 18, music: 8, instagram: 8 };
    const grouped = new Map();
    items.forEach(item => grouped.set(item.type, [...(grouped.get(item.type) || []), item]));
    return [...grouped.entries()].flatMap(([type, values]) => takeRandom(values, limits[type] || 6));
  }

  async function refreshJosemaria() {
    try {
      const snapshot = await window.AtlasRuntime.fetchJson("data/josemaria-quotes.json", { fresh: true });
      const item = shuffle(snapshot.items || [])[0];
      if (!item) return;
      const lib = root.data.libraryMap.get("san-josemaria") || root.data.libraryMap.get("doctrine");
      const quote = {
        ...item, id: item.id || `josemaria-${Date.now()}`,
        type: "quote", verified: true, external: true, libraryId: lib.id,
        text: item.description || item.text, reference: item.reference || "escriva.org · selección publicada",
        reviewedAt: new Date().toISOString().slice(0, 10)
      };
      window.ATLAS_LIVE_SHORTS ||= [];
      window.ATLAS_LIVE_SHORTS = [quote, ...window.ATLAS_LIVE_SHORTS.filter(current => current.id !== quote.id)].slice(0, 12);
      queue = queue.filter(current => current.id !== quote.id);
      const feed = document.querySelector(".short-feed");
      if (feed && !feed.querySelector(`[data-short-id="${CSS.escape(quote.id)}"]`)) {
        queue.splice(Math.min(cursor + 2, queue.length), 0, quote);
      }
    } catch {}
  }

  function constrained(items, prefix = []) {
    const stored = root.storage.get();
    return window.AtlasFeedMixer.constrainedShuffle(items, {
      recent: stored.settings.onlyNewShorts ? stored.seenShorts : [],
      weights: stored.settings.shortTypeWeights || {},
      prefix,
      maxTypeRun: 2,
      maxSourceRun: 2
    });
  }

  function mixedAll(items, prefix = []) {
    const mediaTypes = new Set(["video", "music", "instagram"]);
    const editorial = constrained(items.filter(item => !mediaTypes.has(item.type)), prefix);
    const buckets = {
      video: constrained(items.filter(item => item.type === "video")),
      music: constrained(items.filter(item => item.type === "music")),
      instagram: constrained(items.filter(item => item.type === "instagram"))
    };
    const media = [];
    while (buckets.video.length || buckets.music.length || buckets.instagram.length) {
      shuffle(["video", "music", "instagram"].filter(type => buckets[type].length))
        .forEach(type => media.push(buckets[type].shift()));
    }
    if (!media.length) return editorial;
    const result = [];
    let mediaCursor = 0;
    let gap = 2 + Math.floor(Math.random() * 3);
    for (const item of editorial) {
      result.push(item);
      gap -= 1;
      if (gap <= 0 && mediaCursor < media.length) {
        result.push(media[mediaCursor++]);
        gap = 3 + Math.floor(Math.random() * 3);
      }
    }
    return result.concat(media.slice(mediaCursor));
  }

  function incorporateFresh(items, feed) {
    if (!items.length) return;
    const known = new Set(queue.map(item => item.id));
    const fresh = items.filter(item => !known.has(item.id));
    if (!fresh.length) return;
    if (activeFilter === "all") {
      const prefix = queue.slice(Math.max(0, cursor - 2), cursor);
      queue = [...queue.slice(0, cursor), ...mixedAll([...queue.slice(cursor), ...fresh], prefix)];
    } else {
      queue.push(...constrained(fresh));
    }
    if (feed?.querySelector(".empty-state")) {
      feed.innerHTML = "";
      feed.insertAdjacentHTML("beforeend", nextBatch());
      observeCards();
    }
  }

  function nextBatch() {
    if (!queue.length) return "";
    const cards = [];
    for (let count = 0; count < batchSize; count += 1) {
      const index = cursor % queue.length;
      cards.push(shortCard(queue[index], index, queue.length));
      cursor += 1;
    }
    return cards.join("");
  }

  function appendBatch() {
    const feed = document.querySelector(".short-feed");
    if (!feed || !queue.length) return;
    feed.insertAdjacentHTML("beforeend", nextBatch());
    observeCards();
  }

  function bind() {
    const feed = document.querySelector(".short-feed");
    if (!feed) return;
    feedCards = [...feed.querySelectorAll(".short-card")];
    auroraFromLayer = feed.closest(".discover-page")?.querySelector(".short-aurora i");
    auroraToLayer = feed.closest(".discover-page")?.querySelector(".short-aurora b");
    feed.addEventListener("scroll", () => {
      if (!auroraFrame) auroraFrame = requestAnimationFrame(() => {
        auroraFrame = 0;
        updateAurora(feed);
      });
      if (!magnetizing && !gestureActive) {
        clearTimeout(magnetTimer);
        magnetTimer = setTimeout(() => magneticSnap(feed), Math.max(25, Number(root.storage.get().settings.magnetDelay || 120)));
      }
      if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - feed.clientHeight * 3) {
        appendBatch();
        if (activeFilter === "all" || activeFilter === "video") loadLiveVideos(false);
        if (activeFilter === "all" || activeFilter === "music") loadLiveMusic(false);
        if (activeFilter === "all" || activeFilter === "instagram") loadLiveInstagram(false);
      }
    }, { passive: true });
    const cancelMagnet = () => {
      clearTimeout(magnetTimer);
      cancelAnimationFrame(magnetFrame);
      magnetizing = false;
    };
    feed.addEventListener("wheel", cancelMagnet, { passive: true });
    feed.addEventListener("touchstart", event => {
      gestureActive = true;
      pullStart = feed.scrollTop <= 2 ? event.touches[0]?.clientY || 0 : 0;
      pullDistance = 0;
      cancelMagnet();
    }, { passive: true });
    feed.addEventListener("touchmove", event => {
      if (!pullStart || feed.scrollTop > 2) return;
      pullDistance = Math.max(0, Math.min(105, (event.touches[0]?.clientY || pullStart) - pullStart));
      updatePullIndicator(pullDistance);
    }, { passive: true });
    feed.addEventListener("touchend", () => {
      gestureActive = false;
      const shouldRefresh = pullDistance >= 68;
      pullStart = 0;
      pullDistance = 0;
      if (shouldRefresh) refresh(); else updatePullIndicator(0);
      clearTimeout(magnetTimer);
      magnetTimer = setTimeout(() => magneticSnap(feed), Math.max(20, Number(root.storage.get().settings.magnetDelay || 120) * .55));
    }, { passive: true });
    observeCards();
    requestAnimationFrame(() => updateAurora(feed));
  }

  function updatePullIndicator(distance, label = "") {
    const indicator = document.querySelector(".short-refresh-indicator");
    if (!indicator) return;
    const progress = Math.min(1, distance / 68);
    indicator.style.setProperty("--pull", progress.toFixed(3));
    indicator.classList.toggle("ready", progress >= 1);
    const text = indicator.querySelector("b");
    if (text) text.textContent = label || (progress >= 1 ? "Suelta para actualizar" : "Arrastra para actualizar");
  }

  async function refresh() {
    if (refreshBusy) return;
    refreshBusy = true;
    updatePullIndicator(68, "Comprobando la última publicación…");
    document.querySelector(".short-refresh-indicator")?.classList.add("refreshing");
    try {
      const [external, youtube, music, instagram, quotes] = await Promise.all([
        window.AtlasRuntime.fetchJson("data/external-content.json", { fresh: true }).catch(() => window.ATLAS_EXTERNAL),
        window.AtlasRuntime.fetchJson("data/youtube-live-cache.json", { fresh: true }).catch(() => window.ATLAS_YOUTUBE),
        window.AtlasRuntime.fetchJson("data/youtube-music-cache.json", { fresh: true }).catch(() => window.ATLAS_MUSIC),
        window.AtlasRuntime.fetchJson("data/instagram-cache.json", { fresh: true }).catch(() => window.ATLAS_INSTAGRAM),
        window.AtlasRuntime.fetchJson("data/quotes.json", { fresh: true }).catch(() => window.ATLAS_QUOTES)
      ]);
      window.ATLAS_EXTERNAL = external || window.ATLAS_EXTERNAL;
      window.ATLAS_YOUTUBE = youtube || window.ATLAS_YOUTUBE;
      window.ATLAS_MUSIC = music || window.ATLAS_MUSIC;
      window.ATLAS_INSTAGRAM = instagram || window.ATLAS_INSTAGRAM;
      window.ATLAS_QUOTES = quotes || window.ATLAS_QUOTES;
      window.dispatchEvent(new CustomEvent("atlas:refresh-discover", { detail: { filter: activeFilter } }));
    } finally {
      setTimeout(() => {
        refreshBusy = false;
        updatePullIndicator(0, "Selección renovada");
        document.querySelector(".short-refresh-indicator")?.classList.remove("refreshing");
      }, 500);
    }
  }

  function magneticSnap(feed) {
    const settings = root.storage.get().settings;
    if (!settings.magnetEnabled || magnetizing || !feed.clientHeight) return;
    const position = feed.scrollTop / feed.clientHeight;
    const nearest = Math.round(position);
    const distance = Math.abs(nearest - position);
    const threshold = .1 + Number(settings.magnetStrength || 34) * .006;
    if (distance > threshold || distance < .002) return;
    const start = feed.scrollTop;
    const target = nearest * feed.clientHeight;
    const duration = Math.max(100, Number(settings.magnetDuration || 300));
    const started = performance.now();
    magnetizing = true;
    const animate = now => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      feed.scrollTop = start + (target - start) * eased;
      updateAurora(feed);
      if (progress < 1) magnetFrame = requestAnimationFrame(animate);
      else { magnetizing = false; magnetFrame = 0; }
    };
    magnetFrame = requestAnimationFrame(animate);
  }

  function rgbFor(card) {
    if (card.dataset.glowRgb) return card.dataset.glowRgb.split(",").map(Number);
    const probe = document.createElement("i");
    probe.style.color = getComputedStyle(card).getPropertyValue("--tone").trim() || "#607d72";
    probe.style.display = "none";
    document.body.appendChild(probe);
    const match = getComputedStyle(probe).color.match(/\d+(?:\.\d+)?/g);
    probe.remove();
    const rgb = (match || ["96","125","114"]).slice(0, 3).map(Number);
    card.dataset.glowRgb = rgb.join(",");
    return rgb;
  }

  function updateAurora(feed) {
    const cards = feedCards;
    if (!cards.length || !feed.clientHeight) return;
    const raw = Math.max(0, feed.scrollTop / feed.clientHeight);
    const index = Math.min(cards.length - 1, Math.floor(raw));
    const nextIndex = Math.min(cards.length - 1, index + 1);
    const linear = Math.min(1, raw - index);
    const t = linear * linear * (3 - 2 * linear);
    const from = cards[index];
    const to = cards[nextIndex];
    const lerp = (a, b) => a + (b - a) * t;
    const fromRgb = rgbFor(from);
    const toRgb = rgbFor(to);
    const lightRgb = fromRgb.map((value, channel) => Math.round(lerp(value, toRgb[channel])));
    const page = feed.closest(".discover-page");
    const pair = `${index}-${nextIndex}`;
    if (page?.dataset.auroraPair !== pair) {
      page.dataset.auroraPair = pair;
      page.style.setProperty("--aurora-from", fromRgb.join(","));
      page.style.setProperty("--aurora-to", toRgb.join(","));
    }
    const settings = root.storage.get().settings;
    const motion = Number(settings.motionLevel || 100) / 100;
    const x = (50 + (lerp(Number(from.dataset.glowX), Number(to.dataset.glowX)) - 50) * motion) / 100 * page.clientWidth;
    const y = (50 + (lerp(Number(from.dataset.glowY), Number(to.dataset.glowY)) - 50) * motion) / 100 * page.clientHeight;
    const scale = lerp(Number(from.dataset.glowScale), Number(to.dataset.glowScale));
    const transform = `translate3d(calc(${x}px - 50%),calc(${y}px - 50%),0) scale(${scale})`;
    if (auroraFromLayer) {
      auroraFromLayer.style.transform = transform;
      auroraFromLayer.style.opacity = String((1 - t) * Number(settings.auroraIntensity || 88) / 100);
    }
    if (auroraToLayer) {
      auroraToLayer.style.transform = transform;
      auroraToLayer.style.opacity = String(t * Number(settings.auroraIntensity || 88) / 100);
    }
    illuminatePortrait(from, nextIndex === index ? 1 : 1 - t, x / page.clientWidth * 100, y / page.clientHeight * 100, lightRgb);
    if (nextIndex !== index) illuminatePortrait(to, t, x / page.clientWidth * 100, y / page.clientHeight * 100, lightRgb);
  }

  function illuminatePortrait(card, cardWeight, lightX, lightY, rgb) {
    if (!card?.classList.contains("short-josemaria")) return;
    const portrait = card.querySelector(".josemaria-watermark");
    if (!portrait) return;
    const figureLeft = card.classList.contains("sjm-figure-left");
    const portraitLeft = figureLeft ? 1 : 41;
    const portraitCenter = figureLeft ? 30 : 70;
    const proximity = Math.max(0, 1 - Math.abs(lightX - portraitCenter) / 48);
    const illumination = cardWeight * (.16 + proximity * .84);
    const localX = Math.max(-20, Math.min(120, (lightX - portraitLeft) / 58 * 100));
    const localY = Math.max(-20, Math.min(120, (lightY - 8) / 88 * 100));
    portrait.style.setProperty("--sjm-light-x", `${localX}%`);
    portrait.style.setProperty("--sjm-light-y", `${localY}%`);
    portrait.style.setProperty("--sjm-light-rgb", rgb.join(","));
    portrait.style.setProperty("--sjm-light-alpha", illumination.toFixed(3));
    portrait.style.setProperty("--sjm-halo-alpha", (illumination * .32).toFixed(3));
    portrait.style.setProperty("--sjm-mask-alpha", (illumination * .38).toFixed(3));
  }

  function observeCards() {
    observer ||= new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const active = entry.isIntersecting && entry.intersectionRatio > .65;
        entry.target.classList.toggle("is-active", active);
        if (active) {
          root.storage.markShortSeen(entry.target.dataset.shortId);
          if (activeCard && activeCard !== entry.target) activeCard.classList.remove("is-active");
          activeCard = entry.target;
        }
      });
    }, { threshold: [.65] });
    document.querySelectorAll(".short-card:not([data-observed])").forEach(card => {
      card.dataset.observed = "true";
      observer.observe(card);
    });
    const feed = document.querySelector(".short-feed");
    if (feed) feedCards = [...feed.querySelectorAll(".short-card")];
  }

  function shortCard(item, index, total) {
    const lib = root.data.libraryMap.get(item.libraryId) || root.data.libraryMap.get("doctrine") || root.data.catalog.libraries[0];
    const saved = root.storage.isFavorite("shorts", item.id);
    const image = item.image ? `style="--short-image:url('${esc(item.image)}')"` : "";
    const josemariaMetadata = root.data.normalize([
      item.libraryId, item.author, item.reference, item.source,
      item.title, item.text, item.description, item.url
    ].filter(Boolean).join(" "));
    const josemaria = item.type === "quote" && (
      item.libraryId === "san-josemaria" ||
      /(?:san\s+)?josemaria|escriva|escriva\.org/.test(josemariaMetadata)
    );
    const playable = ["video","music"].includes(item.type) ? `data-play-youtube="${esc(item.videoId)}" data-video-title="${esc(item.title)}" data-video-url="${esc(item.url)}"` : "";
    const glowPositions = [[16,24,1.05],[82,28,1.22],[68,76,.92],[24,70,1.3],[50,18,1.12],[88,62,1.02]];
    const [glowX, glowY, glowScale] = glowPositions[index % glowPositions.length];
    const alignment = root.storage.get().settings.shortAlignment || "mixed";
    const sideSeed = [...String(item.id || index)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const right = alignment === "right" || (alignment === "mixed" && sideSeed % 2 === 1);
    return `<article class="short-card short-type-${item.type} short-variant-${index % 6} ${right ? "text-right" : "text-left"} ${item.external ? "short-external" : ""} ${josemaria ? `short-josemaria sjm-figure-${right ? "left" : "right"}` : ""} tone-${lib.tone}" ${image} ${playable} data-library="${lib.id}" data-glow-x="${glowX}" data-glow-y="${glowY}" data-glow-scale="${glowScale}" data-mark="${item.external ? "A" : lib.mark}" data-short-id="${esc(item.id)}" id="${esc(item.id)}-${cursor}">
      ${josemaria && item.type !== "video" ? '<span class="josemaria-watermark" aria-hidden="true"><i></i></span>' : ""}${["video","music"].includes(item.type) ? '<button class="video-play" aria-label="Reproducir dentro de Atlas">▶</button>' : ""}${item.type === "instagram" && item.image ? `<figure class="instagram-post-preview"><img src="${esc(item.image)}" alt="Publicación de ${esc(item.source)}" loading="lazy"></figure>` : ""}<div class="short-content"><span class="short-type">${index + 1} / ${total} · ${typeLabels[item.type] || item.type} · ${esc(item.external ? item.source : lib.short)}</span><h2>${esc(item.title)}</h2><p>${esc(item.text)}</p>${item.reveal ? `<button class="short-reveal" data-short-reveal>Mostrar respuesta</button><p class="short-reveal-answer" hidden>${esc(item.reveal)}</p>` : ""}${item.author || item.date ? `<p class="short-byline">${esc(item.author || "")}${item.author && item.date ? " · " : ""}${esc(item.date || "")}</p>` : ""}<p class="short-source">Fuente: ${esc(item.reference)}${item.sourceDocumentId ? " · Documento enlazado" : ""}</p>
      <div class="short-actions"><button class="${saved ? "saved" : ""}" data-save-short="${esc(item.id)}" aria-label="Guardar">${root.library.icon("bookmark")}</button><button data-share-short="${esc(item.id)}" aria-label="Compartir">${root.library.icon("share")}</button>${item.sourceDocumentId ? `<a href="#/reader/${encodeURIComponent(item.sourceDocumentId)}" aria-label="Leer documento">${root.library.icon("books")}</a>` : ""}${item.external ? `<a class="wide" href="${esc(item.url)}" target="_blank" rel="noopener">${["video","music"].includes(item.type) ? "Ver en YouTube" : item.type === "instagram" ? "Ver en Instagram" : "Leer original"}${root.library.icon("external")}</a>` : `<a class="wide" href="${esc(lib.notebookUrl)}" target="_blank" rel="noopener">Abrir IA${root.library.icon("external")}</a>`}</div></div>
    </article>`;
  }

  function openVideo(videoId, title, url) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) return;
    const layer = document.querySelector("#video-layer");
    const frame = document.querySelector("#youtube-player");
    const heading = document.querySelector("#video-player-title");
    const original = document.querySelector("#youtube-original-link");
    if (!layer || !frame) return;
    const origin = location.protocol.startsWith("http") ? `&origin=${encodeURIComponent(location.origin)}` : "";
    heading.textContent = title || "Vídeo de YouTube";
    original.href = url || `https://www.youtube.com/shorts/${videoId}`;
    frame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1${origin}`;
    layer.hidden = false;
    document.body.classList.add("modal-open");
    layer.querySelector("[data-video-close]")?.focus();
  }

  function closeVideo() {
    const layer = document.querySelector("#video-layer");
    const frame = document.querySelector("#youtube-player");
    if (!layer || layer.hidden) return;
    layer.hidden = true;
    if (frame) frame.src = "";
    document.body.classList.remove("modal-open");
  }

  document.addEventListener("click", event => {
    const reveal = event.target.closest("[data-short-reveal]");
    if (reveal) { const answer=reveal.nextElementSibling; answer.hidden=!answer.hidden; reveal.textContent=answer.hidden?"Mostrar respuesta":"Ocultar respuesta"; return; }
    if (event.target.closest("[data-toggle-reserve-videos]")) {
      root.storage.setSetting("showReserveVideos", !root.storage.get().settings.showReserveVideos);
      document.querySelector(`[data-short-filter="${activeFilter}"]`)?.click();
      return;
    }
    if (event.target.closest("[data-video-close]")) {
      closeVideo();
      return;
    }
    const trigger = event.target.closest("[data-play-youtube]");
    if (!trigger || event.target.closest(".short-actions")) return;
    event.preventDefault();
    openVideo(trigger.dataset.playYoutube, trigger.dataset.videoTitle, trigger.dataset.videoUrl);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeVideo();
  });

  root.reels = { render, refresh, openVideo, closeVideo };
})();
