(function () {
  "use strict";
  const A = window.Atlas = window.Atlas || {};
  const runtime = window.AtlasRuntime;
  const editions = {
    cee: { manifest: window.ATLAS_BIBLE_MANIFEST, root: "data/bible", label: "Biblia CEE" },
    jerusalem: { manifest: window.ATLAS_BIBLE_JERUSALEM_MANIFEST, root: "data/bible-jerusalem", label: "Biblia de Jerusalén" }
  };
  let editionKey = "cee";
  let manifest = editions.cee.manifest;
  const topics = window.ATLAS_BIBLE_TOPICS?.topics || [];
  const bookCache = new Map();
  const indexPromises = new Map();
  let renderToken = 0;
  let currentRoute = "";
  let previousRoute = "/";
  let returnRoute = "/";
  const STORE_KEY = "atlas-bible-state-v1";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9ñ]+/g, " ").trim();
  const stopwords = new Set("a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era erais eran eras eres es esa esas ese eso esos esta estaba estaban estas este esto estos fue ha hacia hasta hay la las le les lo los mas me mi mis mucha muy no nos o os otra para pero por porque que quien se ser si sin sobre son su sus te tiene todo tras tu tus un una uno unos y ya".split(" "));
  const state = loadState();

  function loadState() {
    try {
      return { fontSize: 21, column: 760, theme: "paper", bookmarks: [], notes: {}, lastRef: null, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
    } catch { return { fontSize: 21, column: 760, theme: "paper", bookmarks: [], notes: {}, lastRef: null }; }
  }
  function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  function savedItems() {
    const notes = Object.entries(state.notes || {}).filter(([, text]) => String(text || "").trim()).map(([key, text]) => {
      const [, book, chapter, verse] = key.split(":"); const range = String(verse || "").match(/(\d+)(?:-(\d+))?/);
      return { key, text: String(text).trim(), ref: { book, chapter: Number(chapter), start: range ? Number(range[1]) : null, end: range?.[2] ? Number(range[2]) : null } };
    });
    return { notes, bookmarks: state.bookmarks || [] };
  }
  function shortName(book) {
    return book.name.replace(/^Evangelio Según San /i, "").replace(/^Epístola (?:A Los|De San|De|A) /i, "").replace(/^Primera /i, "1 ").replace(/^Segunda /i, "2 ").replace(/^Tercera /i, "3 ").replace(/^Libro Primero De (?:Los |Las )?/i, "1 ").replace(/^Libro Segundo De (?:Los |Las )?/i, "2 ").replace(/^Los /i, "");
  }
  function editionPrefix(key = editionKey) { return key === "jerusalem" ? "/jerusalem" : ""; }
  function bibleHomeUrl(key = editionKey) { return `#/bible${editionPrefix(key)}`; }
  function editionName() { return manifest?.translation?.name || editions[editionKey].label; }
  function setEdition(key) { editionKey = key === "jerusalem" && editions.jerusalem.manifest ? "jerusalem" : "cee"; manifest = editions[editionKey].manifest; }
  function normalizeEditionRoute(route) {
    const isJerusalem = route.segments[1] === "jerusalem";
    setEdition(isJerusalem ? "jerusalem" : "cee");
    return isJerusalem ? { ...route, segments: [route.segments[0], ...route.segments.slice(2)] } : route;
  }
  function bookBySlug(slug) { return manifest?.books?.find(book => book.slug === slug); }
  function bookIndex(book) { return manifest.books.indexOf(book); }
  function loadBook(slug) {
    const key = `${editionKey}:${slug}`;
    if (!bookCache.has(key)) bookCache.set(key, runtime.fetchJson(`${editions[editionKey].root}/books/${slug}.json`).catch(error => { bookCache.delete(key); throw error; }));
    return bookCache.get(key);
  }
  function loadIndex() {
    if (!indexPromises.has(editionKey)) indexPromises.set(editionKey, runtime.fetchJson(`${editions[editionKey].root}/search-index.json.gz`).catch(error => { indexPromises.delete(editionKey); throw error; }));
    return indexPromises.get(editionKey);
  }
  function parseReference(value) {
    const normalized = normalize(value);
    const aliases = Object.keys(manifest?.aliasMap || {}).sort((a, b) => b.length - a.length);
    const alias = aliases.find(item => normalized === item || normalized.startsWith(`${item} `));
    if (!alias) return null;
    const rest = normalized.slice(alias.length).trim().match(/^(\d+)(?:\s+(\d+)(?:\s+(\d+))?)?$/);
    if (!rest) return null;
    const book = manifest.books[manifest.aliasMap[alias]];
    return { book: book.slug, chapter: Number(rest[1]), start: rest[2] ? Number(rest[2]) : null, end: rest[3] ? Number(rest[3]) : (rest[2] ? Number(rest[2]) : null) };
  }
  function reference(input) {
    if (!input) return null;
    if (typeof input === "string") return parseReference(input);
    return { book: input.book, chapter: Number(input.chapter), start: input.start == null ? null : Number(input.start), end: input.end == null ? Number(input.start) : Number(input.end) };
  }
  function referenceUrl(input, query = "", targetEdition = editionKey) {
    const ref = reference(input); if (!ref) return "#/bible";
    const verse = ref.start ? `/${ref.start}${ref.end && ref.end !== ref.start ? `-${ref.end}` : ""}` : "";
    return `#/bible${editionPrefix(targetEdition)}/${encodeURIComponent(ref.book)}/${ref.chapter}${verse}${query ? `?q=${encodeURIComponent(query)}` : ""}`;
  }
  function formatReference(input) {
    const ref = reference(input); const book = ref && bookBySlug(ref.book); if (!book) return "";
    return `${shortName(book)} ${ref.chapter}${ref.start ? `,${ref.start}${ref.end && ref.end !== ref.start ? `–${ref.end}` : ""}` : ""}`;
  }
  function parseVerseSpec(value) {
    const match = String(value || "").match(/^(\d+)(?:-(\d+))?$/);
    return match ? { start: Number(match[1]), end: Number(match[2] || match[1]) } : { start: null, end: null };
  }
  function selectionFromRoute(route) {
    const slug = decodeURIComponent(route.segments[1] || "");
    const book = bookBySlug(slug);
    if (!book) return null;
    const chapter = Math.max(1, Math.min(book.chapterCount, Number(route.segments[2]) || 1));
    return { book, chapter, ...parseVerseSpec(route.segments[3]) };
  }
  function categoryBooks(testament) {
    const grouped = new Map();
    manifest.books.filter(book => book.testament === testament).forEach(book => {
      if (!grouped.has(book.category)) grouped.set(book.category, []);
      grouped.get(book.category).push(book);
    });
    return grouped;
  }
  function home() {
    const last = reference(state.lastRef);
    return `<section class="page bible-home">
      <header class="bible-hero"><div><span class="eyebrow">Sagradas Escrituras · Biblia de Jerusalén</span><h1>Lee. Busca.<br>Vuelve al texto.</h1><p>${manifest.stats.books} libros, ${manifest.stats.chapters.toLocaleString("es-ES")} capítulos y ${manifest.stats.verses.toLocaleString("es-ES")} versículos enlazables uno a uno.</p></div><div class="bible-hero-mark" aria-hidden="true"><i></i><span>Ἐν ἀρχῇ</span><b>Palabra</b></div></header>
      <form class="bible-search-box" data-bible-search><label for="bible-home-search">Busca una palabra, frase o referencia</label><div><input id="bible-home-search" name="q" type="search" placeholder="Ej. misericordia · Jn 3,16 · no temas" autocomplete="off"><button class="primary-button">Buscar en la Biblia</button></div><small>Reconoce referencias como Mt 5,1–12, Juan 14:27 o Sal 23.</small></form>
      ${last ? `<a class="bible-continue" href="${referenceUrl(last)}"><span>Continúa leyendo</span><b>${formatReference(last)}</b><i>Volver al pasaje →</i></a>` : ""}
      <section class="bible-topic-section"><div class="section-head"><div><h2>Buscar por temas</h2><p>Pasajes seleccionados como puertas de entrada; nunca sustituyen la lectura en contexto.</p></div><a href="#/bible/topics">Ver todos</a></div><div class="bible-topic-strip">${topics.slice(0, 12).map((topic, index) => topicCard(topic, index)).join("")}</div></section>
      <div class="bible-testaments">${[1,2].map(testament => `<section><header><span>${testament === 1 ? "Antigua Alianza" : "Nueva Alianza"}</span><h2>${testament === 1 ? "Antiguo Testamento" : "Nuevo Testamento"}</h2></header>${[...categoryBooks(testament)].map(([category, books]) => `<div class="bible-book-group"><h3>${esc(category)}</h3><div>${books.map(book => `<a href="#/bible/${book.slug}/1"><b>${esc(shortName(book))}</b><small>${book.chapterCount} cap.</small></a>`).join("")}</div></div>`).join("")}</section>`).join("")}</div>
    </section>`.replace(/Sagradas Escrituras[^<]*?<\/span>/, `Sagradas Escrituras · ${esc(editionName())}</span>`);
  }
  function topicCard(topic, index = 0) {
    return `<a class="bible-topic-card" style="--topic-index:${index}" href="#/bible/topic/${encodeURIComponent(topic.id)}"><span>${String(index + 1).padStart(2, "0")}</span><h3>${esc(topic.title)}</h3><p>${esc(topic.description)}</p><small>${topic.passages.length} pasajes →</small></a>`;
  }
  function topicsPage() {
    return `<section class="page bible-topics-page"><header class="explore-hero"><span class="eyebrow">Biblia · itinerarios temáticos</span><h1>Entra por lo que estás viviendo.</h1><p>Cada tema reúne pasajes de distintos libros y épocas. Abre el fragmento, amplía el capítulo y conserva siempre su contexto.</p></header><div class="bible-topic-grid">${topics.map(topicCard).join("")}</div></section>`;
  }
  async function topicPage(id, token) {
    const topic = topics.find(item => item.id === id);
    if (!topic) return empty("No encontramos ese tema", "Vuelve al índice temático de la Biblia.");
    const passages = await Promise.all(topic.passages.map(async passage => {
      const payload = await loadBook(passage.book);
      const chapter = payload.chapters.find(item => item.number === passage.chapter);
      return { ...passage, meta: bookBySlug(passage.book), verses: chapter?.verses.filter(verse => verse.number >= passage.start && verse.number <= passage.end) || [] };
    }));
    if (token !== renderToken) return "";
    return `<section class="page bible-topic-detail"><header><a href="#/bible/topics">← Todos los temas</a><span class="eyebrow">Itinerario bíblico</span><h1>${esc(topic.title)}</h1><p>${esc(topic.description)}</p></header><div class="bible-passage-grid">${passages.map(passage => `<a href="${referenceUrl(passage)}"><span>${esc(formatReference(passage))}</span><blockquote>${passage.verses.map(verse => `<sup>${verse.number}</sup>${esc(verse.text)}`).join(" ")}</blockquote><b>Leer en su capítulo →</b></a>`).join("")}</div></section>`;
  }
  function intersectSorted(a, b) {
    const result = []; let i = 0; let j = 0;
    while (i < a.length && j < b.length) { if (a[i] === b[j]) { result.push(a[i]); i += 1; j += 1; } else if (a[i] < b[j]) i += 1; else j += 1; }
    return result;
  }
  async function search(query) {
    const parsed = parseReference(query);
    if (parsed) return { reference: parsed, results: [] };
    const normalized = normalize(query);
    const tokens = [...new Set(normalized.split(/\s+/).filter(token => token.length > 2 && !stopwords.has(token)))];
    if (!tokens.length) return { results: [], message: "Escribe al menos una palabra significativa." };
    const index = await loadIndex();
    const postings = tokens.map(token => index.terms[token] || []).sort((a, b) => a.length - b.length);
    if (postings.some(items => !items.length)) return { results: [] };
    let candidateIds = postings[0].slice();
    for (let i = 1; i < postings.length && candidateIds.length; i += 1) candidateIds = intersectSorted(candidateIds, postings[i]);
    const candidates = candidateIds.slice(0, 1600).map(id => ({ id, ref: index.refs[id] }));
    const neededBooks = [...new Set(candidates.map(item => manifest.books[item.ref[0]].slug))];
    await Promise.all(neededBooks.map(loadBook));
    const results = [];
    for (const candidate of candidates) {
      const [bookPosition, chapterNumber, verseNumber] = candidate.ref;
      const meta = manifest.books[bookPosition];
      const payload = await loadBook(meta.slug);
      const verse = payload.chapters.find(item => item.number === chapterNumber)?.verses.find(item => item.number === verseNumber);
      if (!verse || !normalize(verse.text).includes(normalized)) continue;
      results.push({ book: meta, chapter: chapterNumber, verse: verseNumber, text: verse.text });
      if (results.length >= 80) break;
    }
    return { results };
  }
  async function searchPage(query, token) {
    if (!query) return `<section class="page bible-search-page"><header><a href="#/bible">← Biblia</a><span class="eyebrow">Búsqueda bíblica</span><h1>¿Qué quieres encontrar?</h1></header>${searchForm("")}</section>`;
    const outcome = await search(query);
    if (token !== renderToken) return "";
    if (outcome.reference) return `<section class="page bible-search-page"><header><a href="#/bible">← Biblia</a><span class="eyebrow">Referencia reconocida</span><h1>${esc(formatReference(outcome.reference))}</h1><p>Atlas ha reconocido una cita bíblica y puede llevarte directamente al texto.</p><a class="primary-button" href="${referenceUrl(outcome.reference)}">Abrir el pasaje →</a></header>${searchForm(query)}</section>`;
    return `<section class="page bible-search-page"><header><a href="#/bible">← Biblia</a><span class="eyebrow">Búsqueda literal</span><h1>«${esc(query)}»</h1><p>${outcome.results.length ? `${outcome.results.length}${outcome.results.length === 80 ? "+" : ""} coincidencias verificadas en el texto.` : outcome.message || "No aparece esa expresión literal. Prueba una forma más breve."}</p></header>${searchForm(query)}<div class="bible-search-results">${outcome.results.map(item => `<a href="${referenceUrl({ book:item.book.slug, chapter:item.chapter, start:item.verse }, query)}"><span>${esc(formatReference({ book:item.book.slug, chapter:item.chapter, start:item.verse }))}</span><p>${highlight(item.text, query)}</p><b>Abrir y resaltar →</b></a>`).join("")}</div></section>`;
  }
  function searchForm(value) { return `<form class="bible-search-box compact" data-bible-search><div><input name="q" type="search" value="${esc(value)}" placeholder="Palabra, frase o referencia" autocomplete="off"><button class="primary-button">Buscar</button></div></form>`; }
  function highlight(text, query) {
    const safe = esc(text); const literal = String(query || "").trim(); if (!literal) return safe;
    try { return safe.replace(new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), match => `<mark>${match}</mark>`); } catch { return safe; }
  }
  function navigation(book, chapter) {
    const position = bookIndex(book);
    let previous = null; let next = null;
    if (chapter > 1) previous = { book: book.slug, chapter: chapter - 1 };
    else if (position > 0) previous = { book: manifest.books[position - 1].slug, chapter: manifest.books[position - 1].chapterCount };
    if (chapter < book.chapterCount) next = { book: book.slug, chapter: chapter + 1 };
    else if (position < manifest.books.length - 1) next = { book: manifest.books[position + 1].slug, chapter: 1 };
    return { previous, next };
  }
  function selectedText(payload, chapterNumber, start, end) {
    const chapter = payload.chapters.find(item => item.number === chapterNumber);
    return chapter?.verses.filter(verse => verse.number >= start && verse.number <= end).map(verse => `${verse.number} ${verse.text}`).join(" ") || "";
  }
  async function readerPage(selection, query, token) {
    const payload = await loadBook(selection.book.slug);
    if (token !== renderToken) return "";
    const chapter = payload.chapters.find(item => item.number === selection.chapter) || payload.chapters[0];
    const selectedStart = selection.start && chapter.verses.some(item => item.number === selection.start) ? selection.start : null;
    const selectedEnd = selectedStart ? Math.min(selection.end || selectedStart, chapter.verses.at(-1).number) : null;
    const nav = navigation(selection.book, chapter.number);
    const currentRef = { book: selection.book.slug, chapter: chapter.number, start: selectedStart, end: selectedEnd };
    state.lastRef = currentRef; saveState();
    const selected = selectedStart ? selectedText(payload, chapter.number, selectedStart, selectedEnd) : "";
    const noteKey = selectedStart ? `${editionKey}:${selection.book.slug}:${chapter.number}:${selectedStart}-${selectedEnd}` : `${editionKey}:${selection.book.slug}:${chapter.number}`;
    const bookmarked = state.bookmarks.some(item => item.key === noteKey);
    return `<div class="bible-reader theme-${esc(state.theme)}" style="--bible-font:${state.fontSize}px;--bible-column:${state.column}px" data-bible-current="${esc(noteKey)}">
      <header class="bible-reader-header"><button data-bible-action="back" aria-label="Volver">←</button><a href="#/bible"><span>Biblia de Jerusalén</span><small>Edición 1976</small></a><div><button data-bible-action="find" aria-label="Buscar en este capítulo">⌕</button><button data-bible-action="notes" aria-label="Notas y marcadores">✎</button><button data-bible-action="appearance" aria-label="Apariencia">Aa</button></div></header>
      <div class="bible-reader-progress"><span style="width:${Math.round((bookIndex(selection.book) + chapter.number / selection.book.chapterCount) / manifest.books.length * 100)}%"></span></div>
      <aside class="bible-reader-index" id="bible-reader-index"><span class="eyebrow">Navegación</span><label>Libro<select data-bible-select="book">${manifest.books.map(book => `<option value="${book.slug}" ${book.slug === selection.book.slug ? "selected" : ""}>${esc(shortName(book))}</option>`).join("")}</select></label><label>Capítulo<select data-bible-select="chapter">${payload.chapters.map(item => `<option value="${item.number}" ${item.number === chapter.number ? "selected" : ""}>${item.number}</option>`).join("")}</select></label><div class="bible-mini-chapters">${payload.chapters.map(item => `<a class="${item.number === chapter.number ? "active" : ""}" href="#/bible/${selection.book.slug}/${item.number}">${item.number}</a>`).join("")}</div><a href="#/bible">Índice completo</a><a href="#/bible/topics">Temas</a></aside>
      <div class="bible-findbar" id="bible-findbar" ${query ? "" : "hidden"}><form data-bible-chapter-search><input name="q" value="${esc(query)}" placeholder="Buscar en este capítulo"><button>Encontrar</button></form><span>${query ? `${chapter.verses.filter(verse => normalize(verse.text).includes(normalize(query))).length} versículos` : ""}</span><button data-bible-action="close-find">×</button></div>
      <main class="bible-reader-scroll"><article class="bible-chapter"><header><span>${selection.book.testament === 1 ? "Antiguo Testamento" : "Nuevo Testamento"} · ${esc(selection.book.category)}</span><h1>${esc(shortName(selection.book))}</h1><h2>Capítulo ${chapter.number}</h2></header><div class="bible-verses">${chapter.verses.map(verse => { const isSelected = selectedStart && verse.number >= selectedStart && verse.number <= selectedEnd; const isMatch = query && normalize(verse.text).includes(normalize(query)); return `<p id="verse-${verse.number}" class="${isSelected ? "is-selected" : ""} ${isMatch ? "is-match" : ""}" data-bible-verse="${verse.number}"><a href="${referenceUrl({ book:selection.book.slug, chapter:chapter.number, start:verse.number })}" aria-label="Enlazar versículo ${verse.number}">${verse.number}</a><span>${isMatch ? highlight(verse.text, query) : esc(verse.text)}</span></p>`; }).join("")}</div><nav class="bible-chapter-nav">${nav.previous ? `<a href="${referenceUrl(nav.previous)}"><span>← Anterior</span><b>${formatReference(nav.previous)}</b></a>` : "<span></span>"}${nav.next ? `<a href="${referenceUrl(nav.next)}"><span>Siguiente →</span><b>${formatReference(nav.next)}</b></a>` : ""}</nav></article></main>
      <aside class="bible-context" id="bible-context" hidden><header><span class="eyebrow">Tu Biblia</span><h2>${selectedStart ? esc(formatReference(currentRef)) : "Notas y marcadores"}</h2><button data-bible-action="close-panel">×</button></header>${selectedStart ? `<blockquote>${esc(selected)}</blockquote><div class="button-row"><button class="secondary-button ${bookmarked ? "active" : ""}" data-bible-action="bookmark">${bookmarked ? "★ Guardado" : "☆ Guardar pasaje"}</button><button class="secondary-button" data-bible-action="copy">Copiar</button></div><form data-bible-note><label>Nota personal</label><textarea name="note" rows="7" placeholder="¿Qué quieres recordar de este pasaje?">${esc(state.notes[noteKey] || "")}</textarea><button class="primary-button">Guardar nota</button></form>` : `<p>Selecciona el número de un versículo para guardarlo, copiarlo o escribir una nota.</p>${state.bookmarks.length ? `<h3>Marcadores</h3><div class="bible-bookmarks">${state.bookmarks.slice().reverse().map(item => `<a href="${referenceUrl(item.ref)}">${esc(formatReference(item.ref))}</a>`).join("")}</div>` : ""}`}</aside>
      <aside class="bible-appearance" id="bible-appearance" hidden><header><h2>Lectura</h2><button data-bible-action="close-panel">×</button></header><label>Tamaño del texto <output>${fontPercent(state.fontSize)}%</output><input data-bible-setting="fontSize" type="range" min="80" max="155" step="5" value="${fontPercent(state.fontSize)}"></label><label>Ancho de columna <output>${columnPercent(state.column)}%</output><input data-bible-setting="column" type="range" min="55" max="130" step="5" value="${columnPercent(state.column)}"></label><div class="bible-theme-choices"><button data-bible-theme="paper" class="${state.theme === "paper" ? "active" : ""}">Papel</button><button data-bible-theme="light" class="${state.theme === "light" ? "active" : ""}">Claro</button><button data-bible-theme="dark" class="${state.theme === "dark" ? "active" : ""}">Oscuro</button></div></aside>
    </div>`;
  }
  function fontPercent(value) { return Math.round(Number(value || 21) / 21 * 100); }
  function columnPercent(value) { return Math.round(Number(value || 760) / 760 * 100); }
  function loading(label = "Abriendo la Biblia…") { return `<section class="page bible-loading"><i></i><span class="eyebrow">Sagradas Escrituras</span><h1>${esc(label)}</h1></section>`; }
  function empty(title, text) { return `<section class="page"><div class="empty-state"><h1>${esc(title)}</h1><p>${esc(text)}</p><a class="primary-button" href="#/bible">Volver a la Biblia</a></div></section>`; }
  async function render(route, main = document.querySelector("#main")) {
    const token = ++renderToken;
    if (route.raw !== currentRoute) { previousRoute = currentRoute || returnRoute || "/"; currentRoute = route.raw; }
    route = normalizeEditionRoute(route);
    document.body.classList.add("bible-active");
    document.body.classList.remove("bible-reader-active");
    if (!manifest) { main.innerHTML = empty("La Biblia no está construida", "Ejecuta npm run build:bible y vuelve a cargar Atlas."); return; }
    try {
      if (!route.segments[1]) {
        main.innerHTML = home();
        const switcher = document.createElement("nav");
        switcher.className = "bible-edition-switch";
        switcher.setAttribute("aria-label", "Edición bíblica");
        switcher.innerHTML = `<a class="${editionKey === "cee" ? "active" : ""}" href="#/bible">Biblia CEE <small>principal</small></a>${editions.jerusalem.manifest ? `<a class="${editionKey === "jerusalem" ? "active" : ""}" href="#/bible/jerusalem">Jerusalén <small>estudio</small></a>` : ""}`;
        main.querySelector(".bible-hero")?.after(switcher);
        if (editionKey === "jerusalem") main.querySelectorAll(".bible-home a[href^='#/bible/']").forEach(link => { if (!link.getAttribute("href").startsWith("#/bible/jerusalem")) link.setAttribute("href", link.getAttribute("href").replace("#/bible/", "#/bible/jerusalem/")); });
        return;
      }
      if (route.segments[1] === "topics") { main.innerHTML = topicsPage(); return; }
      if (route.segments[1] === "topic") { main.innerHTML = loading("Reuniendo los pasajes…"); const html = await topicPage(decodeURIComponent(route.segments[2] || ""), token); if (token === renderToken) main.innerHTML = html; return; }
      if (route.segments[1] === "search") { main.innerHTML = loading("Buscando en 35.033 versículos…"); const html = await searchPage(route.query.get("q") || "", token); if (token === renderToken) main.innerHTML = html; return; }
      const selection = selectionFromRoute(route);
      if (!selection) { main.innerHTML = empty("No encontramos ese libro", "Comprueba la referencia o vuelve al índice bíblico."); return; }
      main.innerHTML = loading();
      const html = await readerPage(selection, route.query.get("q") || "", token);
      if (token !== renderToken) return;
      main.innerHTML = html;
      document.body.classList.add("bible-reader-active");
      const editionHeading = main.querySelector(".bible-reader-header > a");
      if (editionHeading) { editionHeading.querySelector("span").textContent = editionName(); editionHeading.querySelector("small").textContent = editionKey === "cee" ? "Edición oficial" : "Edición 1976 · estudio"; }
      if (editionKey === "jerusalem") main.querySelectorAll("a[href^='#/bible']").forEach(link => { const href = link.getAttribute("href"); if (!href.startsWith("#/bible/jerusalem")) link.setAttribute("href", href.replace("#/bible", "#/bible/jerusalem")); });
      requestAnimationFrame(() => {
        const target = document.querySelector(selection.start ? `#verse-${selection.start}` : ".bible-reader-scroll");
        target?.scrollIntoView({ block: selection.start ? "center" : "start" });
      });
    } catch (error) { console.error(error); if (token === renderToken) main.innerHTML = empty("No se pudo abrir la Biblia", "Atlas conservará los datos ya guardados. Comprueba la construcción pública e inténtalo de nuevo."); }
  }
  function stop(nextRoute = "") { renderToken += 1; if (nextRoute && !String(nextRoute).startsWith("/bible")) returnRoute = nextRoute; currentRoute = ""; document.body.classList.remove("bible-active", "bible-reader-active", "bible-panel-open"); }
  function currentReaderRef() {
    const route = normalizeEditionRoute(A.router.parse()); return selectionFromRoute(route);
  }
  function openPanel(id) {
    document.querySelectorAll(".bible-context,.bible-appearance").forEach(panel => { panel.hidden = panel.id !== id; });
    document.body.classList.add("bible-panel-open");
  }
  function closePanels() { document.querySelectorAll(".bible-context,.bible-appearance").forEach(panel => panel.hidden = true); document.body.classList.remove("bible-panel-open"); }
  document.addEventListener("submit", event => {
    if (event.target.matches("[data-bible-search]")) { event.preventDefault(); const query = new FormData(event.target).get("q")?.trim(); if (query) A.router.go(`/bible${editionPrefix()}/search?q=${encodeURIComponent(query)}`); }
    if (event.target.matches("[data-bible-chapter-search]")) { event.preventDefault(); const query = new FormData(event.target).get("q")?.trim(); const current = currentReaderRef(); if (current && query) A.router.go(`${referenceUrl({ book:current.book.slug, chapter:current.chapter }).slice(1)}?q=${encodeURIComponent(query)}`); }
    if (event.target.matches("[data-bible-note]")) { event.preventDefault(); const key = document.querySelector(".bible-reader")?.dataset.bibleCurrent; if (!key) return; state.notes[key] = new FormData(event.target).get("note")?.trim() || ""; saveState(); event.target.querySelector("button").textContent = "Nota guardada"; }
  });
  document.addEventListener("change", event => {
    if (event.target.matches("[data-bible-select='book']")) A.router.go(`/bible${editionPrefix()}/${event.target.value}/1`);
    if (event.target.matches("[data-bible-select='chapter']")) { const current = currentReaderRef(); if (current) A.router.go(`/bible${editionPrefix()}/${current.book.slug}/${event.target.value}`); }
    if (event.target.matches("[data-bible-setting]")) {
      const key = event.target.dataset.bibleSetting; const percent = Number(event.target.value); state[key] = key === "fontSize" ? Math.round(21 * percent / 100) : Math.round(760 * percent / 100); saveState();
      const reader = document.querySelector(".bible-reader"); if (reader) reader.style.setProperty(key === "fontSize" ? "--bible-font" : "--bible-column", `${state[key]}px`);
      event.target.closest("label")?.querySelector("output")?.replaceChildren(`${percent}%`);
    }
  });
  document.addEventListener("click", async event => {
    const action = event.target.closest("[data-bible-action]")?.dataset.bibleAction;
    if (!action) return;
    const current = currentReaderRef();
    if (action === "back") A.router.go(previousRoute || returnRoute || "/bible");
    if (action === "find") document.querySelector("#bible-findbar")?.removeAttribute("hidden");
    if (action === "close-find") document.querySelector("#bible-findbar")?.setAttribute("hidden", "");
    if (action === "notes") openPanel("bible-context");
    if (action === "appearance") openPanel("bible-appearance");
    if (action === "close-panel") closePanels();
    if (action === "copy" && current?.start) { const payload = await loadBook(current.book.slug); const text = `${formatReference({ book:current.book.slug, chapter:current.chapter, start:current.start, end:current.end })}\n${selectedText(payload, current.chapter, current.start, current.end)}`; await navigator.clipboard?.writeText(text); event.target.textContent = "Copiado"; }
    if (action === "bookmark" && current?.start) {
      const key = document.querySelector(".bible-reader")?.dataset.bibleCurrent;
      const position = state.bookmarks.findIndex(item => item.key === key);
      if (position >= 0) state.bookmarks.splice(position, 1); else state.bookmarks.push({ key, ref: { book:current.book.slug, chapter:current.chapter, start:current.start, end:current.end }, savedAt: new Date().toISOString() });
      saveState(); render(A.router.parse());
    }
  });
  document.addEventListener("click", event => {
    const theme = event.target.closest("[data-bible-theme]")?.dataset.bibleTheme; if (!theme) return;
    state.theme = theme; saveState(); const reader = document.querySelector(".bible-reader"); if (reader) reader.className = reader.className.replace(/theme-\w+/, `theme-${theme}`); document.querySelectorAll("[data-bible-theme]").forEach(button => button.classList.toggle("active", button.dataset.bibleTheme === theme));
  });
  function linkify(container) {
    const primaryManifest = editions.cee.manifest;
    if (!container || !primaryManifest) return;
    const labels = [...new Set(primaryManifest.books.flatMap(book => [...book.aliases, book.name, shortName(book)]))].filter(label => label.length > 1).sort((a, b) => b.length - a.length).map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`\\b(${labels.join("|")})\\s+(\\d{1,3})\\s*[,.:]\\s*(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3}))?`, "giu");
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, { acceptNode(node) { return node.parentElement?.closest("a,code,pre,script,style,textarea,button") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      pattern.lastIndex = 0; if (!pattern.test(node.data)) return; pattern.lastIndex = 0;
      const fragment = document.createDocumentFragment(); let cursor = 0;
      node.data.replace(pattern, (match, bookLabel, chapter, start, end, offset) => {
        fragment.append(node.data.slice(cursor, offset)); const ref = parseReference(`${bookLabel} ${chapter} ${start}${end ? ` ${end}` : ""}`);
        if (ref) { const anchor = document.createElement("a"); anchor.className = "bible-reference-link"; anchor.href = referenceUrl(ref, "", "cee"); anchor.textContent = match; anchor.title = `Abrir ${formatReference(ref)} en la Biblia CEE`; fragment.append(anchor); } else fragment.append(match);
        cursor = offset + match.length; return match;
      });
      fragment.append(node.data.slice(cursor)); node.replaceWith(fragment);
    });
  }
  A.bible = { render, stop, parseReference, referenceUrl, formatReference, linkify, loadBook, savedItems };
})();
