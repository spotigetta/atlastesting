(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const state = {
    doc: null, payload: null, chunk: 0, continuous: false, fontSize: 19, width: 720,
    query: "", matches: [], matchIndex: -1, sessionStarted: 0, progressTimer: null, toolsOpen: false,
    lastSelection: "", lastSelectionChunk: 0, scrollTimer: null, findTimer: null,
    searchIndex: null, references: new Map(), footnotes: new Map(), openRequest: 0, renderVersion: 0,
    edition: null, originalPayload: null, editionNotice: ""
  };
  let loading = new Map();

  function loadContent(doc, contentFile = doc.contentFile) {
    const key = `${doc.id}|${contentFile}`;
    if (loading.has(key)) return loading.get(key);
    const promise = window.AtlasRuntime.fetchJson(contentFile).then(payload => {
      if (payload?.id !== doc.id) throw new Error("El contenido no corresponde al documento");
      return payload;
    });
    loading.set(key, promise);
    promise.then(() => loading.delete(key), () => loading.delete(key));
    return promise;
  }

  function documentEditions(doc) {
    const manifest = window.ATLAS_EDITIONS;
    const editions = Array.isArray(manifest) ? manifest : manifest?.editions;
    return Array.isArray(editions) ? editions.filter(item => item.documentId === doc.id && item.language === "es") : [];
  }

  function reviewedEdition(doc) {
    return documentEditions(doc).find(item => item.status === "reviewed" && typeof item.contentFile === "string" && item.contentFile && typeof item.sourceHash === "string" && item.sourceHash) || null;
  }

  function editionStorageKey(doc = state.doc, edition = state.edition) {
    return edition ? `${doc.id}::edition:${edition.language}:${edition.sourceHash}` : doc.id;
  }

  function validateEdition(payload, original) {
    if (!Array.isArray(original.chunks) || !Array.isArray(payload.chunks) || payload.chunks.length !== original.chunks.length) throw new Error("La traducción no conserva los fragmentos del original");
    if (payload.chunks.some((chunk, index) => chunk.index !== original.chunks[index].index || typeof chunk.markdown !== "string" || !chunk.markdown.trim())) throw new Error("Traducción incompleta");
    if (!Array.isArray(payload.toc) || payload.toc.length !== (original.toc || []).length || payload.toc.some((entry, index) => entry.anchor !== original.toc[index].anchor || entry.chunkIndex !== original.toc[index].chunkIndex || entry.level !== original.toc[index].level)) throw new Error("El esquema de la traducción no coincide con el original");
  }

  async function open(doc, query = "", options = {}) {
    stopSession();
    const request = ++state.openRequest;
    state.doc = doc;
    state.payload = null;
    state.originalPayload = null;
    state.edition = options.edition === "es" ? reviewedEdition(doc) : null;
    state.editionNotice = options.edition === "es" && !state.edition ? "No hay una traducción al castellano revisada. Se muestra el original." : "";
    state.searchIndex = null;
    state.query = query;
    state.matches = [];
    state.matchIndex = -1;
    state.toolsOpen = false;
    state.lastSelection = "";
    clearTimeout(state.findTimer);
    clearTimeout(state.scrollTimer);
    const saved = root.storage.getReaderProgress(editionStorageKey());
    state.chunk = saved?.chunkIndex || 0;
    state.fontSize = Math.max(15, Math.min(28, Number(saved?.fontSize) || 19));
    state.width = Math.max(520, Math.min(980, Number(saved?.width) || 720));
    state.continuous = Boolean(saved?.continuous);
    try {
      const original = await loadContent(doc);
      if (request !== state.openRequest) return;
      state.originalPayload = original;
      let payload = original;
      if (state.edition) {
        payload = await loadContent(doc, state.edition.contentFile);
        if (request !== state.openRequest) return;
        validateEdition(payload, original);
      }
      if (!Array.isArray(payload.chunks) || !payload.chunks.length) throw new Error("Documento vacío");
      state.payload = { ...payload, toc: Array.isArray(payload.toc) ? payload.toc : [], chunks: payload.chunks.map((chunk, index) => ({ ...chunk, index, markdown: String(chunk.markdown ?? chunk.text ?? "") })) };
      collectReferences(state.payload.chunks);
      if (query && !options.position) {
        const first = state.payload.chunks.findIndex(chunk => chunk.markdown.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
        if (first >= 0) state.chunk = first;
      }
      state.chunk = Math.max(0, Math.min(Math.floor(Number(state.chunk) || 0), state.payload.chunks.length - 1));
      if (options.position) state.chunk = Math.max(0, Math.min(options.position.index, state.payload.chunks.length - 1));
      if (options.position) render({ position: options.position, keepPosition: true });
      else render({ restoreSaved: true });
      startSession();
    } catch {
      if (request !== state.openRequest) return;
      const main = document.querySelector("#main");
      if (!main) return;
      main.innerHTML = `<section class="reader-load-error" role="alert">${root.library.empty("No se pudo abrir el documento", "Comprueba tu conexión e inténtalo de nuevo. Si el problema continúa, el archivo puede no estar disponible.")}<div class="button-row"><button class="primary-button" data-reader-retry>Reintentar</button>${state.edition ? `<button class="secondary-button" data-reader-error-original>Leer original</button>` : ""}<button class="secondary-button" data-reader-error-library>Volver a la biblioteca</button></div></section>`;
      main.querySelector("[data-reader-retry]")?.addEventListener("click", event => {
        if (request !== state.openRequest) return;
        event.currentTarget.disabled = true;
        open(doc, query, options);
      }, { once: true });
      main.querySelector("[data-reader-error-original]")?.addEventListener("click", () => {
        if (request === state.openRequest) open(doc, query);
      }, { once: true });
      main.querySelector("[data-reader-error-library]")?.addEventListener("click", () => {
        if (request !== state.openRequest) return;
        stopSession();
        location.hash = `/library/${encodeURIComponent(doc.library.id)}/documents`;
      }, { once: true });
    }
  }

  function stopSession() {
    state.openRequest += 1;
    state.renderVersion += 1;
    clearTimeout(state.findTimer);
    clearTimeout(state.scrollTimer);
    if (state.sessionStarted && state.doc) {
      const collectionIds = root.data.catalog.collections.filter(item => item.documentIds.includes(state.doc.id)).map(item => item.id);
      root.storage.recordReading(state.doc.id, Date.now() - state.sessionStarted, collectionIds);
      saveProgress();
    }
    state.sessionStarted = 0;
    clearInterval(state.progressTimer);
  }

  function startSession() {
    state.sessionStarted = Date.now();
    state.progressTimer = setInterval(saveProgress, 15000);
  }

  function saveProgress() {
    if (!state.doc || !state.payload) return;
    const article = document.querySelector(".reader-scroll");
    const scrollRatio = article ? article.scrollTop / Math.max(1, article.scrollHeight - article.clientHeight) : 0;
    root.storage.saveReaderProgress(editionStorageKey(), {
      chunkIndex: state.continuous ? visibleChunk().index : state.chunk,
      scrollRatio, fontSize: state.fontSize, width: state.width,
      continuous: state.continuous,
      chunkRatio: state.continuous ? visibleChunk().ratio : scrollRatio,
      percent: state.continuous ? Math.round(scrollRatio * 100) : Math.round(((state.chunk + scrollRatio) / state.payload.chunks.length) * 100)
    });
  }

  // Unequal fragment lengths make a percentage of the whole document an unreliable
  // fragment address. Store the visible fragment and a position within it instead.
  function visibleChunk() {
    const scroll = document.querySelector(".reader-scroll");
    const sections = [...document.querySelectorAll(".reader-chunk")];
    if (!scroll || !sections.length) return { index: state.chunk, ratio: 0 };
    const top = scroll.getBoundingClientRect().top;
    const section = sections.find(item => item.getBoundingClientRect().bottom > top + 1) || sections.at(-1);
    const rect = section.getBoundingClientRect();
    return { index: Number(section.dataset.chunk), ratio: Math.max(0, Math.min(1, (top - rect.top) / Math.max(1, rect.height))) };
  }

  function restoreChunkPosition(index, ratio = 0) {
    const scroll = document.querySelector(".reader-scroll");
    const section = document.querySelector(`.reader-chunk[data-chunk="${Number(index)}"]`);
    if (!scroll || !section) return;
    const rect = section.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, Number(ratio) || 0));
    scroll.scrollTop += rect.top - scroll.getBoundingClientRect().top + rect.height * fraction;
    updateReaderChrome();
  }

  function readerPercent() {
    const scroll = document.querySelector(".reader-scroll");
    if (state.continuous && scroll) {
      return Math.round((scroll.scrollTop / Math.max(1, scroll.scrollHeight - scroll.clientHeight)) * 100);
    }
    return Math.round(((state.chunk + (scroll ? scroll.scrollTop / Math.max(1, scroll.scrollHeight - scroll.clientHeight) : 0)) / Math.max(1, state.payload?.chunks.length || 1)) * 100);
  }

  function updateReaderChrome() {
    const percent = Math.max(0, Math.min(100, readerPercent()));
    const progress = document.querySelector(".reader-progress span");
    const rail = document.querySelector("#reader-rail-range");
    const railValue = document.querySelector("#reader-rail-value");
    if (progress) progress.style.width = `${percent}%`;
    if (rail) rail.value = state.continuous ? String(percent) : String(state.chunk);
    if (railValue) railValue.textContent = `${percent}%`;
  }

  function sourceLanguage() {
    const edition = state.edition || documentEditions(state.doc)[0];
    const payload = state.originalPayload;
    const value = edition?.sourceLanguage || payload?.editorial?.sourceLanguage || payload?.workMetadata?.language || state.doc.language;
    return typeof value === "string" ? value : "";
  }

  function languageLabel(language) {
    return ({ en: "inglés", es: "castellano", la: "latín", it: "italiano", fr: "francés", de: "alemán", pt: "portugués", el: "griego" })[language.toLowerCase()] || language || "idioma no consignado";
  }

  function editionHeader() {
    const available = reviewedEdition(state.doc);
    const language = sourceLanguage();
    const spanish = /^(?:es(?:[-_].*)?|español|castellano|spanish)$/i.test(language);
    const selector = available ? `<div class="reader-edition-switch" role="group" aria-label="Edición del documento"><button type="button" data-reader-edition="original" aria-pressed="${!state.edition}">Original</button><button type="button" data-reader-edition="es" aria-pressed="${Boolean(state.edition)}">Castellano</button></div>` : "";
    if (state.edition) {
      const edition = state.edition;
      const aiReview = edition.reviewMethod === "ai-editorial" || edition.review?.method === "ai-editorial";
      const review = aiReview ? `Revisión editorial con IA${edition.review?.humanReviewed === false ? "; sin revisión humana" : ""}` : "Traducción revisada";
      const date = edition.reviewedAt ? ` · ${String(edition.reviewedAt).slice(0, 10)}` : "";
      return `<section class="reader-edition-info" aria-label="Información de la edición">${selector}<p><strong>Traducción propia de Atlas</strong><span>Original: ${esc(languageLabel(language))} · ${esc(review)}${esc(date)}</span></p></section>`;
    }
    const notice = state.editionNotice || (!available && !spanish ? "No hay una traducción al castellano revisada. Se muestra el original." : "");
    return selector || notice ? `<section class="reader-edition-info" aria-label="Información de la edición">${selector}<p><strong>Edición original${language ? ` en ${esc(languageLabel(language))}` : ""}</strong>${notice ? `<span>${esc(notice)}</span>` : ""}</p></section>` : "";
  }

  function switchEdition(language) {
    const next = language === "es" ? reviewedEdition(state.doc) : null;
    if ((language === "es" && !next) || Boolean(next) === Boolean(state.edition)) return;
    const position = visibleChunk();
    return open(state.doc, state.query, { edition: next ? "es" : "original", position });
  }

  function render(options = {}) {
    const doc = state.doc;
    const library = doc.library;
    const payload = state.payload;
    const version = ++state.renderVersion;
    const afterRender = callback => requestAnimationFrame(() => {
      if (version === state.renderVersion && document.querySelector(".reader-app")) callback();
    });
    const chunks = state.continuous ? payload.chunks : [payload.chunks[state.chunk]];
    const related = relatedDocuments(doc);
    const questions = root.data.catalog.editorial?.questions?.[library.id] || [];
    const annotations = root.storage.getAnnotations(editionStorageKey());
    const collections = root.data.catalog.collections.filter(item => item.documentIds.includes(doc.id));
    const relatedShorts = root.data.catalog.shorts.filter(item => item.sourceDocumentId === doc.id).slice(0, 4);
    const favorite = root.storage.isFavorite("documents", doc.id);
    const savedProgress = root.storage.getReaderProgress(editionStorageKey());
    document.querySelector("#main").innerHTML = `<div class="reader-app reader-immersive tone-${library.tone}" data-library="${library.id}">
      <header class="reader-header">
        <button class="reader-back icon-button" data-reader-action="exit" aria-label="Volver a la pantalla anterior">${root.library.icon("arrow")}</button>
        <div class="reader-title-button"><b>${esc(doc.title)}</b><small>${state.chunk + 1} / ${payload.chunks.length} fragmentos</small></div>
        <div class="reader-header-actions">
          <button class="reader-header-button reader-toc-trigger" data-reader-action="toc" aria-label="Abrir esquema"><span>${root.library.icon("list")}</span><b>Índice</b></button>
          <button class="reader-header-button" data-reader-action="search" aria-label="Buscar en el documento"><span>${root.library.icon("search")}</span><b>Buscar</b></button>
          <button class="reader-header-button" data-reader-action="context" aria-label="Abrir notas y contexto"><span>${root.library.icon("bookmark")}</span><b>Notas</b></button>
          <button class="reader-header-button" data-reader-action="settings" aria-label="Ajustes de lectura"><span>${root.library.icon("theme")}</span><b>Lectura</b></button>
        </div>
      </header>
      <div class="reader-progress" aria-hidden="true"><span style="width:${readerPercent()}%"></span></div>
      <button class="reader-panel-backdrop" data-reader-action="close-panels" aria-label="Cerrar panel" hidden></button>
      <aside class="reader-toc" id="reader-toc" hidden><div class="reader-panel-head"><h2>Esquema del documento</h2><button class="icon-button" data-reader-action="close-panels">${root.library.icon("close")}</button></div><p class="toc-help">Despliega los niveles y salta a cualquier apartado.</p><nav>${payload.toc.length ? tocTree(payload.toc) : `<p>No hay encabezados consignados.</p>`}</nav></aside>
      <aside class="reader-settings" id="reader-settings" hidden><div class="reader-panel-head"><h2>Lectura</h2><button class="icon-button" data-reader-action="close-panels">${root.library.icon("close")}</button></div>
        <label>Tamaño de texto <span id="reader-font-value">${state.fontSize}px</span></label><div class="button-row"><button class="secondary-button" data-reader-action="font-down">A−</button><button class="secondary-button" data-reader-action="font-up">A＋</button></div>
        <label>Ancho de columna <span id="reader-width-value">${state.width}px</span></label><div class="button-row"><button class="secondary-button" data-reader-action="width-down">Estrechar</button><button class="secondary-button" data-reader-action="width-up">Ampliar</button></div>
        <button class="secondary-button" data-reader-action="continuous">${state.continuous ? "Lectura por fragmentos" : "Activar lectura continua"}</button>
        <button class="secondary-button" data-action="theme">Cambiar tema de Atlas</button>
      </aside>
      <div class="reader-search" id="reader-search" role="search" ${state.query ? "" : "hidden"}><input id="reader-find" type="search" aria-label="Buscar en el texto del documento" value="${esc(state.query)}" placeholder="Buscar literalmente en este documento"><button data-reader-action="previous-match" aria-label="Coincidencia anterior">↑</button><button data-reader-action="next-match" aria-label="Coincidencia siguiente">↓</button><span id="reader-match-count" aria-live="polite">0 / 0</span><button data-reader-action="close-search" aria-label="Cerrar búsqueda">${root.library.icon("close")}</button></div>
      <div class="reader-layout">
        <main class="reader-scroll">
          <article class="reader-document" style="--reader-size:${state.fontSize}px;--reader-width:${state.width}px">
            <header class="reader-document-head"><span class="eyebrow">${esc(library.short)} · ${esc(doc.category)}</span><h1>${esc(state.edition ? (payload.title || doc.title) : doc.title)}</h1><div class="reader-meta"><span>${Math.max(1, Math.round((payload.words || doc.words) / 220))} min de lectura</span><span>${Number(payload.words || doc.words).toLocaleString("es-ES")} palabras</span><span>${doc.author ? esc(doc.author) : "Autor no consignado"}</span></div>${editionHeader()}</header>
            <div id="reader-content">${chunks.map(chunk => `<section class="reader-chunk" data-chunk="${chunk.index}">${markdown(chunk.markdown, chunk.index)}</section>`).join("")}</div>
            ${!state.continuous ? `<nav class="reader-pagination"><button class="secondary-button" data-reader-action="previous-chunk" ${state.chunk === 0 ? "disabled" : ""}>← Anterior</button><span>Fragmento ${state.chunk + 1} de ${payload.chunks.length}</span><button class="secondary-button" data-reader-action="next-chunk" ${state.chunk >= payload.chunks.length - 1 ? "disabled" : ""}>Siguiente →</button></nav>` : ""}
          </article>
        </main>
        <aside class="reader-context" id="reader-context" hidden><section class="reader-panel-head"><div><span class="eyebrow">Contexto</span><h2>Mientras lees</h2></div><button class="icon-button" data-reader-action="close-panels">${root.library.icon("close")}</button></section>
          <section><h3>Autor</h3><p>${esc(doc.author || "No consignado en el índice")}</p></section>
          <section><h3>Cronología</h3><p>${doc.year ? esc(doc.year) : "No hay fecha explícita en el índice."}</p></section>
          <section><h3>Relacionados</h3>${related.map(item => `<a href="#/reader/${encodeURIComponent(item.id)}">${esc(item.title)}</a>`).join("") || `<p>No hay relaciones seguras suficientes.</p>`}</section>
          <section><h3>Colecciones</h3>${collections.map(item => `<a href="#/collection/${encodeURIComponent(item.id)}">${esc(item.title)}</a>`).join("") || `<p>No pertenece a una colección enlazada.</p>`}</section>
          <section><h3>Shorts relacionados</h3>${relatedShorts.map(item => `<a href="#/short/${encodeURIComponent(item.id)}">${esc(item.title)}</a>`).join("") || `<p>No hay Shorts directos.</p>`}</section>
          <section><h3>Citas relacionadas</h3><p>Atlas no atribuye citas si el índice no las identifica expresamente.</p></section>
          <section><h3>Preguntas posibles</h3>${questions.slice(0, 5).map(question => `<button data-copy-question="${esc(question)}">${esc(question)}</button>`).join("")}</section>
          <section><h3>Tus anotaciones</h3><div id="reader-annotations">${annotations.map(annotationItem).join("") || `<p>Todavía no has añadido ninguna.</p>`}</div></section>
          <section><a class="secondary-button" href="#/graph?focus=${encodeURIComponent(doc.id)}">Abrir mapa de relaciones</a></section>
        </aside>
      </div>
      <aside class="reader-rail" aria-label="Progreso y navegación del documento">
        <button data-reader-action="previous-chunk" ${state.chunk === 0 && !state.continuous ? "disabled" : ""} aria-label="Fragmento anterior">↑</button>
        <input id="reader-rail-range" type="range" min="0" max="${state.continuous ? 100 : Math.max(0, payload.chunks.length - 1)}" value="${state.continuous ? readerPercent() : state.chunk}" step="1" aria-label="Desplazarse por el documento">
        <span id="reader-rail-value">${readerPercent()}%</span>
        <button data-reader-action="next-chunk" ${state.chunk >= payload.chunks.length - 1 && !state.continuous ? "disabled" : ""} aria-label="Fragmento siguiente">↓</button>
      </aside>
      <footer class="reader-tools ${state.toolsOpen ? "is-open" : ""}" aria-label="Herramientas de lectura">
        <button class="reader-tools-toggle" data-reader-action="tools-toggle" aria-label="${state.toolsOpen ? "Ocultar herramientas" : "Mostrar herramientas"}" aria-expanded="${state.toolsOpen}">${state.toolsOpen ? "×" : "✦"}</button>
        <div class="reader-tool-group">
          <button class="${favorite ? "active" : ""}" data-reader-action="favorite"><span class="reader-tool-icon">${root.library.icon("bookmark")}</span><span class="reader-tool-label">${favorite ? "Guardado" : "Guardar"}</span></button>
          <button data-reader-action="highlight"><span class="reader-tool-icon tool-highlight">Aa</span><span class="reader-tool-label">Subrayar</span></button>
          <button data-reader-action="note"><span class="reader-tool-icon tool-note">✎</span><span class="reader-tool-label">Anotar</span></button>
          <button data-reader-action="bookmark"><span class="reader-tool-icon tool-pin">⌖</span><span class="reader-tool-label">Marcar</span></button>
        </div>
      </footer>
      <div class="reader-note-layer" id="reader-note-layer" hidden>
        <form class="reader-note-editor" id="reader-note-form" role="dialog" aria-modal="true" aria-labelledby="reader-note-title">
          <header><div><span class="eyebrow">Nota personal</span><h2 id="reader-note-title">Guardar una idea</h2></div><button type="button" class="icon-button" data-reader-action="close-note" aria-label="Cerrar">${root.library.icon("close")}</button></header>
          <blockquote id="reader-note-selection"></blockquote>
          <label for="reader-note-text">Tu nota</label>
          <textarea id="reader-note-text" rows="7" maxlength="4000" placeholder="Escribe aquí lo que quieres recordar…" required></textarea>
          <footer><button type="button" class="secondary-button" data-reader-action="close-note">Cancelar</button><button type="submit" class="primary-button">Guardar nota</button></footer>
        </form>
      </div>
    </div>`;
    bind();
    applyAnnotations();
    root.bible?.linkify(document.querySelector("#reader-content"));
    if (state.query) find(state.query, state.matchIndex < 0, !options.keepPosition);
    if (options.restoreSaved && savedProgress?.continuous && Number.isFinite(savedProgress.chunkRatio) && !state.query) {
      afterRender(() => restoreChunkPosition(state.chunk, savedProgress.chunkRatio));
    } else if (options.restoreSaved && savedProgress?.scrollRatio && !state.query) afterRender(() => {
      const scroll = document.querySelector(".reader-scroll");
      if (scroll) {
        scroll.scrollTop = savedProgress.scrollRatio * Math.max(0, scroll.scrollHeight - scroll.clientHeight);
        updateReaderChrome();
      }
    });
    if (options.position && (!state.query || options.keepPosition)) afterRender(() => restoreChunkPosition(options.position.index, options.position.ratio));
    if (Number.isFinite(options.scrollPercent) && (!state.query || options.keepPosition)) afterRender(() => {
      const scroll = document.querySelector(".reader-scroll");
      if (scroll) {
        scroll.scrollTop = (options.scrollPercent / 100) * Math.max(0, scroll.scrollHeight - scroll.clientHeight);
        updateReaderChrome();
      }
    });
  }

  function markdown(source, chunkIndex) {
    if (chunkIndex === 0) source = source.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n)?/, "");
    source = source.replace(/<!--[\s\S]*?-->/g, "");
    const toc = state.payload.toc.filter(item => item.chunkIndex === chunkIndex);
    let headingIndex = 0;
    const headingId = (title, level) => {
      const entry = toc.find(item => item.title === title && item.level === level && !usedAnchors.has(item.anchor));
      const anchor = entry?.anchor || `reader-heading-${chunkIndex}-${headingIndex}`;
      usedAnchors.add(anchor); headingIndex += 1;
      return esc(anchor);
    };
    const usedAnchors = new Set();
    const blocks = [];
    let paragraph = [];
    let list = null;
    let code = null;
    let codeLines = [];
    const flushParagraph = () => {
      if (paragraph.length) {
        blocks.push(`<p>${paragraph.map((line, index) => `${index ? (paragraph[index - 1].hardBreak ? "<br>" : " ") : ""}${inline(line.text, chunkIndex)}`).join("")}</p>`);
        paragraph = [];
      }
    };
    const flushList = () => {
      if (list) {
        blocks.push(`<${list.type}${list.start > 1 ? ` start="${list.start}"` : ""}>${list.items.map(item => `<li class="${item.task ? "task-item" : ""}">${item.task ? `<input type="checkbox" disabled ${item.checked ? "checked" : ""}>` : ""}${inline(item.text, chunkIndex)}</li>`).join("")}</${list.type}>`);
        list = null;
      }
    };
    const cells = tableCells;
    const lines = source.split(/\r?\n/);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const rawLine = lines[lineIndex];
      const fence = rawLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence && (!code || (fence[1][0] === code.char && fence[1].length >= code.length && !fence[2].trim()))) {
        flushParagraph(); flushList();
        if (code) { blocks.push(`<pre><code>${esc(codeLines.join("\n"))}</code></pre>`); codeLines = []; code = null; }
        else code = { char: fence[1][0], length: fence[1].length };
        continue;
      }
      if (code) { codeLines.push(rawLine); continue; }
      const note = rawLine.match(/^ {0,3}\[\^([^\]]+)\]:\s*(.*)$/);
      if (note) {
        flushParagraph(); flushList();
        const content = [note[2]];
        while (/^(?: {4}|\t)/.test(lines[lineIndex + 1] || "")) content.push(lines[++lineIndex].replace(/^(?: {4}|\t)/, ""));
        blocks.push(`<aside class="reader-footnote" id="${footnoteId(note[1])}"><span class="reader-footnote-label">[${esc(note[1])}]</span> ${inline(content.join(" "), chunkIndex)}</aside>`);
        continue;
      }
      if (/^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(].*["')])?\s*$/.test(rawLine)) { flushParagraph(); flushList(); continue; }
      const setext = lines[lineIndex + 1]?.match(/^\s*(=+|-+)\s*$/);
      if (rawLine.trim() && setext) {
        flushParagraph(); flushList();
        const level = setext[1][0] === "=" ? 1 : 2;
        blocks.push(`<h${level} id="${headingId(rawLine.trim(), level)}">${inline(rawLine.trim(), chunkIndex)}</h${level}>`);
        lineIndex += 1; continue;
      }
      const heading = rawLine.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        flushParagraph(); flushList();
        blocks.push(`<h${heading[1].length} id="${headingId(heading[2], heading[1].length)}">${inline(heading[2], chunkIndex)}</h${heading[1].length}>`);
        continue;
      }
      if (rawLine.includes("|") && cells(lines[lineIndex + 1] || "").every(cell => /^:?-{3,}:?$/.test(cell)) && cells(lines[lineIndex + 1] || "").length === cells(rawLine).length) {
        flushParagraph(); flushList();
        const headers = cells(rawLine);
        const aligns = cells(lines[lineIndex + 1]).map(cell => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left");
        const rows = [];
        lineIndex += 2;
        while (lineIndex < lines.length && lines[lineIndex].includes("|") && lines[lineIndex].trim()) {
          rows.push(cells(lines[lineIndex])); lineIndex += 1;
        }
        lineIndex -= 1;
        const width = Math.max(headers.length, ...rows.map(row => row.length));
        blocks.push(`<div class="reader-table-wrap" tabindex="0" role="region" aria-label="Tabla desplazable"><table><thead><tr>${Array.from({ length: width }, (_, index) => `<th scope="col" style="text-align:${aligns[index] || "left"}">${inline(headers[index] || "", chunkIndex)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${Array.from({ length: width }, (_, index) => `<td style="text-align:${aligns[index] || "left"}">${inline(row[index] || "", chunkIndex)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      const bullet = rawLine.match(/^\s*[-*+]\s+(.+)/);
      const ordered = rawLine.match(/^\s*\d+[.)]\s+(.+)/);
      if (bullet || ordered) {
        flushParagraph();
        const type = ordered ? "ol" : "ul";
        if (!list || list.type !== type) { flushList(); list = { type, items: [], start: ordered ? Number(rawLine.trim().match(/^\d+/)[0]) : 1 }; }
        const value = (bullet || ordered)[1];
        const task = value.match(/^\[([ xX])\]\s+(.+)/);
        list.items.push({ text: task ? task[2] : value, task: Boolean(task), checked: task?.[1].toLowerCase() === "x" }); continue;
      }
      if (/^>\s?/.test(rawLine)) {
        flushParagraph(); flushList();
        const quote = [rawLine.replace(/^>\s?/, "")];
        while (/^>\s?/.test(lines[lineIndex + 1] || "")) quote.push(lines[++lineIndex].replace(/^>\s?/, ""));
        blocks.push(`<blockquote>${quote.map(line => inline(line, chunkIndex)).join("<br>")}</blockquote>`); continue;
      }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(rawLine)) { flushParagraph(); flushList(); blocks.push("<hr>"); continue; }
      if (!rawLine.trim()) { flushParagraph(); flushList(); continue; }
      flushList();
      const hardSlash = /(?:^|[^\\])(?:\\\\)*\\$/.test(rawLine);
      paragraph.push({ text: hardSlash ? rawLine.trim().slice(0, -1) : rawLine.trim(), hardBreak: /\s{2}$/.test(rawLine) || hardSlash });
    }
    flushParagraph(); flushList();
    if (codeLines.length) blocks.push(`<pre><code>${esc(codeLines.join("\n"))}</code></pre>`);
    return blocks.join("");
  }

  function tocTree(items) {
    const roots = [];
    const stack = [];
    items.forEach(item => {
      const node = { ...item, children: [] };
      while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
      if (stack.length) stack[stack.length - 1].children.push(node);
      else roots.push(node);
      stack.push(node);
    });
    const renderNode = node => {
      const button = `<button data-reader-chunk="${node.chunkIndex}" data-reader-anchor="${esc(node.anchor)}" style="--level:${node.level}">${esc(node.title)}</button>`;
      return node.children.length
        ? `<details class="toc-level toc-level-${Math.min(node.level, 4)}" ${node.level <= 4 ? "open" : ""}><summary>${button}</summary><div>${node.children.map(renderNode).join("")}</div></details>`
        : button;
    };
    return roots.map(renderNode).join("");
  }

  function referenceKey(value) { return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es"); }
  function footnoteId(value) { return `reader-footnote-${encodeURIComponent(value)}`; }

  function collectReferences(chunks) {
    state.references = new Map(); state.footnotes = new Map();
    chunks.forEach(chunk => {
      let fence = null;
      for (const line of chunk.markdown.split(/\r?\n/)) {
        const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (marker && (!fence || (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()))) { fence = fence ? null : marker[1]; continue; }
        if (fence) continue;
        const note = line.match(/^ {0,3}\[\^([^\]]+)\]:/);
        if (note) { if (!state.footnotes.has(note[1])) state.footnotes.set(note[1], chunk.index); continue; }
        const reference = line.match(/^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(].*["')])?\s*$/);
        if (reference && !state.references.has(referenceKey(reference[1]))) state.references.set(referenceKey(reference[1]), reference[2]);
      }
    });
  }

  function tableCells(line) {
    let value = line.trim().replace(/^\|/, "");
    if (/(?<!\\)\|$/.test(value)) value = value.slice(0, -1);
    const cells = []; let cell = "", fence = 0;
    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      if (char === "\\" && value[index + 1] === "|") { cell += "|"; index += 1; continue; }
      if (char === "`") {
        const run = value.slice(index).match(/^`+/)[0];
        if (!fence) fence = run.length; else if (fence === run.length) fence = 0;
        cell += run; index += run.length - 1; continue;
      }
      if (char === "|" && !fence) { cells.push(cell.trim()); cell = ""; }
      else cell += char;
    }
    cells.push(cell.trim()); return cells;
  }

  function safeLink(destination) {
    const value = destination.trim();
    // Relative document paths have no public mapping. Preserve their label and
    // destination as text rather than creating a broken or executable link.
    return /^(?:https?:\/\/|mailto:|#)/i.test(value) && !/[\u0000-\u0020]/.test(value) ? value : null;
  }

  function inline(value, chunkIndex = 0, allowLinks = true, inheritedTokens = null) {
    const tokens = inheritedTokens ? [...inheritedTokens] : [];
    const protect = html => `\u0000${tokens.push(html) - 1}\u0000`;
    let text = inheritedTokens ? String(value) : String(value).replace(/\u0000/g, "");
    // Protect generated HTML before applying emphasis or autolinks. Otherwise a
    // URL in a link label, image, or code span can become a nested anchor.
    text = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, marker, code) => protect(`<code>${esc(code.replace(/\n/g, " "))}</code>`));
    text = text.replace(/\\([\\`*_[\]{}()#+\-.!>|])/g, (_, char) => protect(esc(char)));
    if (allowLinks) {
      text = text.replace(/\[\^([^\]]+)\]/g, (whole, label) => state.footnotes.has(label)
        ? protect(`<sup class="reader-footnote-ref"><a href="#${esc(footnoteId(label))}" data-reader-link-chunk="${state.footnotes.get(label)}">[${esc(label)}]</a></sup>`) : whole);
      const link = (whole, image, label, destination) => {
        const url = safeLink(destination);
        if (!url) return protect(esc(whole));
        if (image) return /^https?:\/\//i.test(url) ? protect(`<img src="${esc(url)}" alt="${esc(label)}" loading="lazy">`) : protect(esc(whole));
        return protect(`<a href="${esc(url)}"${/^https?:\/\//i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${inline(label, chunkIndex, false, tokens)}</a>`);
      };
      // Balanced pairs in common URL paths, e.g. Wikipedia's (...), are retained.
      text = text.replace(/(!?)\[([^\]]*)\]\(\s*(<[^>]+>|(?:[^\s()]+|\([^\s()]*\))+)(?:\s+["'][^"']*["'])?\s*\)/g,
        (whole, image, label, destination) => link(whole, image, label, destination.replace(/^<|>$/g, "")));
      text = text.replace(/(!?)\[([^\]]+)\](?:\[([^\]]*)\])?/g, (whole, image, label, reference) => {
        const destination = state.references.get(referenceKey(reference || label));
        return destination ? link(whole, image, label, destination) : whole;
      });
      text = text.replace(/<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)>/gi, (_, url) => protect(`<a href="${esc(url)}"${/^https?:/i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(url)}</a>`));
      text = text.replace(/https?:\/\/[^\s<>\u0000]+/gi, value => {
        let url = value.replace(/[.,;:!?]+$/, "");
        while (url.endsWith(")") && (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length) url = url.slice(0, -1);
        return protect(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`) + value.slice(url.length);
      });
    }
    return esc(text)
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "<strong>$1$2</strong>")
      .replace(/(^|[^\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/(^|[^\w])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
      .replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
  }

  function relatedDocuments(doc) {
    const sameTitle = root.data.documents.filter(item => item.id !== doc.id && root.data.normalize(item.title) === root.data.normalize(doc.title));
    const sameAuthor = doc.author ? root.data.documents.filter(item => item.id !== doc.id && item.author === doc.author) : [];
    const sameCategory = doc.library.documents.filter(item => item.id !== doc.id && item.category === doc.category).map(item => root.data.documentMap.get(item.id));
    const collectionDocs = root.data.catalog.collections
      .filter(item => item.documentIds.includes(doc.id))
      .flatMap(item => item.documentIds)
      .map(id => root.data.documentMap.get(id))
      .filter(item => item && item.id !== doc.id);
    return [...new Map([...sameTitle, ...sameAuthor, ...collectionDocs, ...sameCategory].filter(Boolean).map(item => [item.id, item])).values()].slice(0, 10);
  }

  function annotationItem(item) {
    const label = item.type === "highlight" ? "Subrayado" : item.type === "note" ? "Nota" : "Marcador";
    return `<article class="annotation-item"><b>${label}</b><p>${esc(item.note || item.text || `Fragmento ${item.chunkIndex + 1}`)}</p>${item.note && item.text ? `<small>“${esc(item.text)}”</small>` : ""}<button data-remove-annotation="${item.id}">Eliminar</button></article>`;
  }

  function updateAnnotationPanel() {
    const panel = document.querySelector("#reader-annotations");
    if (!panel) return;
    const annotations = root.storage.getAnnotations(editionStorageKey());
    panel.innerHTML = annotations.map(annotationItem).join("") || `<p>Todavía no has añadido ninguna.</p>`;
  }

  function applyAnnotations() {
    const highlights = root.storage.getAnnotations(editionStorageKey()).filter(item => item.type === "highlight" && item.text);
    for (const item of highlights) highlightText(item.text, "user-highlight", item.chunkIndex);
  }

  function searchableText(rootNode, className = "search-hit") {
    const segments = []; let text = "", previousBlock = null;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === 1) {
          if (node.matches("script,style,[data-reader-search-ignore]")) return NodeFilter.FILTER_REJECT;
          return node.nodeName === "BR" ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style,[data-reader-search-ignore]")) return NodeFilter.FILTER_REJECT;
        if (className === "search-hit" && parent.closest("mark.search-hit")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeName === "BR") { text += "\n"; continue; }
      const block = node.parentElement.closest("p,h1,h2,h3,h4,h5,h6,li,td,th,pre,blockquote,aside") || rootNode;
      if (previousBlock && block !== previousBlock) text += "\n";
      segments.push({ node, start: text.length, end: text.length + node.nodeValue.length });
      text += node.nodeValue; previousBlock = block;
    }
    return { text, segments };
  }

  function buildSearchIndex() {
    if (state.searchIndex) return state.searchIndex;
    state.searchIndex = state.payload.chunks.map(chunk => {
      const container = document.createElement("div");
      container.innerHTML = markdown(chunk.markdown, chunk.index);
      return { chunkIndex: chunk.index, text: searchableText(container).text.toLocaleLowerCase("es") };
    });
    return state.searchIndex;
  }

  function find(query, initial = false, navigate = true) {
    state.query = String(query || "");
    state.matches = [];
    clearMarks("search-hit");
    if (!state.query) {
      state.matchIndex = -1;
      updateMatchCount();
      return;
    }
    const lower = state.query.toLocaleLowerCase("es");
    buildSearchIndex().forEach(chunk => {
      let offset = 0;
      const text = chunk.text;
      while ((offset = text.indexOf(lower, offset)) >= 0) {
        state.matches.push({ chunkIndex: chunk.chunkIndex, offset });
        offset += Math.max(1, lower.length);
      }
    });
    if (!state.matches.length) {
      state.matchIndex = -1;
      updateMatchCount();
      return;
    }
    if (initial || state.matchIndex < 0 || state.matchIndex >= state.matches.length) state.matchIndex = 0;
    if (navigate) goMatch(state.matchIndex);
    else { highlightText(state.query, "search-hit"); updateMatchCount(); }
  }

  function goMatch(index) {
    if (!state.matches.length) return;
    state.matchIndex = (index + state.matches.length) % state.matches.length;
    const match = state.matches[state.matchIndex];
    if (!state.continuous && match.chunkIndex !== state.chunk) {
      state.chunk = match.chunkIndex;
      render();
      return;
    }
    clearMarks("search-hit");
    const groups = highlightText(state.query, "search-hit");
    const current = groups.find(group => group.chunkIndex === match.chunkIndex && group.offset === match.offset);
    const target = current?.marks[0];
    document.querySelectorAll("mark.current-hit").forEach(mark => mark.classList.remove("current-hit"));
    current?.marks.forEach(mark => mark.classList.add("current-hit"));
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    updateMatchCount();
  }

  function highlightText(text, className, chunkIndex = null) {
    if (!text) return [];
    const rootNode = document.querySelector("#reader-content");
    if (!rootNode) return [];
    const groups = [], ranges = new Map(), needle = text.toLocaleLowerCase("es");
    rootNode.querySelectorAll(".reader-chunk").forEach(section => {
      if (chunkIndex !== null && Number(section.dataset.chunk) !== Number(chunkIndex)) return;
      const content = searchableText(section, className), lower = content.text.toLocaleLowerCase("es");
      let offset = 0, segmentIndex = 0;
      while ((offset = lower.indexOf(needle, offset)) >= 0) {
        while (segmentIndex < content.segments.length && content.segments[segmentIndex].end <= offset) segmentIndex += 1;
        const intersecting = [];
        for (let index = segmentIndex; index < content.segments.length && content.segments[index].start < offset + needle.length; index += 1) intersecting.push(content.segments[index]);
        if (className === "user-highlight" && intersecting.some(segment => segment.node.parentElement.closest("mark.user-highlight"))) {
          offset += Math.max(1, needle.length); continue;
        }
        const group = { chunkIndex: Number(section.dataset.chunk), offset, marks: [] };
        groups.push(group);
        for (const segment of intersecting) {
          const start = Math.max(offset, segment.start), end = Math.min(offset + needle.length, segment.end);
          if (end <= start) continue;
          if (!ranges.has(segment.node)) ranges.set(segment.node, []);
          ranges.get(segment.node).push({ start: start - segment.start, end: end - segment.start, group });
        }
        offset += Math.max(1, needle.length);
      }
    });
    ranges.forEach((items, node) => {
      const fragment = document.createDocumentFragment(); let last = 0;
      items.forEach(item => {
        fragment.append(document.createTextNode(node.nodeValue.slice(last, item.start)));
        const mark = document.createElement("mark"); mark.className = className;
        mark.textContent = node.nodeValue.slice(item.start, item.end);
        fragment.append(mark); item.group.marks.push(mark); last = item.end;
      });
      fragment.append(document.createTextNode(node.nodeValue.slice(last))); node.replaceWith(fragment);
    });
    return groups;
  }

  function clearMarks(className) {
    const rootNode = document.querySelector("#reader-content");
    rootNode?.querySelectorAll(`mark.${className}`).forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent)));
    rootNode?.normalize();
  }

  function updateMatchCount() {
    const count = document.querySelector("#reader-match-count");
    if (count) count.textContent = state.matches.length ? `${state.matchIndex + 1} / ${state.matches.length}` : "0 / 0";
  }

  function selectionText() {
    const live = window.getSelection()?.toString().trim().slice(0, 1000) || "";
    return live || state.lastSelection;
  }

  function activeChunkIndex() {
    if (!state.continuous) return state.chunk;
    const selection = window.getSelection();
    const selectionElement = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection?.anchorNode?.parentElement;
    const selectedChunk = selectionElement?.closest?.(".reader-chunk");
    if (selectedChunk) return Number(selectedChunk.dataset.chunk);
    return visibleChunk().index;
  }

  function bind() {
    const scroll = document.querySelector(".reader-scroll");
    scroll?.addEventListener("scroll", () => {
      updateReaderChrome();
      clearTimeout(state.scrollTimer); state.scrollTimer = setTimeout(saveProgress, 250);
    });
    document.querySelector("#reader-find")?.addEventListener("input", event => {
      clearTimeout(state.findTimer); state.findTimer = setTimeout(() => find(event.target.value, true), 180);
    });
    document.querySelector("#reader-find")?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault(); clearTimeout(state.findTimer);
      if (state.query !== event.target.value) find(event.target.value, true);
      else goMatch(state.matchIndex + (event.shiftKey ? -1 : 1));
    });
    document.querySelector("#reader-rail-range")?.addEventListener("input", event => {
      if (!state.continuous) return;
      const readerScroll = document.querySelector(".reader-scroll");
      if (readerScroll) readerScroll.scrollTop = (Number(event.target.value) / 100) * Math.max(0, readerScroll.scrollHeight - readerScroll.clientHeight);
    });
    document.querySelector("#reader-rail-range")?.addEventListener("change", event => {
      if (state.continuous) return;
      const chunk = Number(event.target.value);
      if (Number.isFinite(chunk) && chunk !== state.chunk) {
        state.chunk = chunk;
        state.lastSelection = "";
        render({ scrollPercent: 0, keepPosition: true });
      }
    });
    document.querySelector("#reader-note-form")?.addEventListener("submit", event => {
      event.preventDefault();
      const note = document.querySelector("#reader-note-text")?.value.trim();
      if (!note) return;
      root.storage.addAnnotation(editionStorageKey(), {
        type: "note", text: state.lastSelection, note,
        chunkIndex: state.lastSelection ? state.lastSelectionChunk : activeChunkIndex()
      });
      closeNoteEditor(true);
      updateAnnotationPanel();
      root.appToast?.("Nota guardada en este documento.");
    });
    document.querySelector(".reader-app")?.addEventListener("click", event => {
      const link = event.target.closest("#reader-content a[href^='#']");
      if (link) {
        event.preventDefault();
        const href = link.getAttribute("href").slice(1);
        let anchor;
        try { anchor = decodeURIComponent(href); } catch { anchor = href; }
        // Footnote ids intentionally encode their source label.
        if (href.startsWith("reader-footnote-")) anchor = href;
        const entry = state.payload.toc.find(item => item.anchor === anchor);
        const chunk = link.dataset.readerLinkChunk !== undefined ? Number(link.dataset.readerLinkChunk) : entry?.chunkIndex;
        if (document.getElementById(anchor) || Number.isFinite(chunk)) {
          navigateToAnchor(chunk ?? state.chunk, anchor);
        } else {
          root.appToast?.("Este apartado no tiene un destino identificado en el documento.");
        }
        return;
      }
      const target = event.target.closest("button");
      if (!target) return;
      if (target.dataset.readerEdition) { switchEdition(target.dataset.readerEdition); return; }
      const action = target.dataset.readerAction;
      if (action === "exit") { exitReader(); return; }
      if (action === "tools-toggle") {
        state.toolsOpen = !state.toolsOpen;
        const tools = document.querySelector(".reader-tools");
        tools?.classList.toggle("is-open", state.toolsOpen);
        target.setAttribute("aria-expanded", String(state.toolsOpen));
        target.setAttribute("aria-label", state.toolsOpen ? "Ocultar herramientas" : "Mostrar herramientas");
        target.textContent = state.toolsOpen ? "×" : "✦";
        return;
      }
      if (action === "toc") togglePanel("reader-toc");
      if (action === "settings") togglePanel("reader-settings");
      if (action === "context") togglePanel("reader-context");
      if (action === "close-panels") closePanels();
      if (action === "search") { document.querySelector("#reader-search").hidden = false; document.querySelector("#reader-find").focus(); }
      if (action === "close-search") {
        clearTimeout(state.findTimer);
        state.query = ""; state.matches = []; state.matchIndex = -1;
        clearMarks("search-hit");
        document.querySelector("#reader-search").hidden = true;
        document.querySelector("#reader-find").value = "";
        updateMatchCount();
      }
      if (action === "next-match") goMatch(state.matchIndex + 1);
      if (action === "previous-match") goMatch(state.matchIndex - 1);
      if (action === "next-chunk") navigateChunk(1);
      if (action === "previous-chunk") navigateChunk(-1);
      if (action === "font-up") adjustReading("font", 1);
      if (action === "font-down") adjustReading("font", -1);
      if (action === "width-up") adjustReading("width", 80);
      if (action === "width-down") adjustReading("width", -80);
      if (action === "continuous") toggleContinuous();
      if (action === "favorite") {
        const saved = root.storage.toggleFavorite("documents", state.doc.id);
        target.classList.toggle("active", saved);
        const label = target.querySelector(".reader-tool-label");
        if (label) label.textContent = saved ? "Guardado" : "Guardar";
        root.appToast?.(saved ? "Documento guardado." : "Documento quitado de guardados.");
      }
      if (action === "highlight") {
        const text = selectionText();
        if (!text) { root.appToast?.("Selecciona primero un fragmento del texto."); return; }
        root.storage.addAnnotation(editionStorageKey(), { type: "highlight", text, chunkIndex: state.lastSelection ? state.lastSelectionChunk : activeChunkIndex() });
        highlightText(text, "user-highlight", state.lastSelection ? state.lastSelectionChunk : activeChunkIndex());
        updateAnnotationPanel();
        window.getSelection()?.removeAllRanges();
        state.lastSelection = "";
        root.appToast?.("Fragmento subrayado.");
      }
      if (action === "note") openNoteEditor();
      if (action === "close-note") closeNoteEditor(true);
      if (action === "bookmark") {
        const chunkIndex = activeChunkIndex();
        root.storage.addAnnotation(editionStorageKey(), { type: "bookmark", chunkIndex, note: `Fragmento ${chunkIndex + 1}` });
        updateAnnotationPanel();
        root.appToast?.("Punto de lectura marcado.");
      }
      if (target.dataset.readerChunk !== undefined) {
        event.preventDefault(); event.stopPropagation();
        const nextChunk = Number(target.dataset.readerChunk);
        const anchor = target.dataset.readerAnchor;
        closePanels();
        navigateToAnchor(nextChunk, anchor);
      }
      if (target.dataset.removeAnnotation) {
        root.storage.removeAnnotation(editionStorageKey(), target.dataset.removeAnnotation);
        clearMarks("user-highlight");
        applyAnnotations();
        if (state.query) goMatch(state.matchIndex);
        updateAnnotationPanel();
      }
    });
  }

  function navigateToAnchor(chunk, anchor) {
    if (!state.continuous && chunk !== state.chunk) {
      state.chunk = chunk; state.lastSelection = "";
      render({ keepPosition: true });
    }
    const target = document.getElementById(anchor);
    target?.scrollIntoView({ block: "start" });
    if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
    saveProgress();
  }

  function navigateChunk(direction) {
    if (state.continuous) {
      const scroll = document.querySelector(".reader-scroll");
      scroll?.scrollBy({ top: direction * Math.max(280, scroll.clientHeight * .78), behavior: "smooth" });
      return;
    }
    const next = Math.max(0, Math.min(state.payload.chunks.length - 1, state.chunk + direction));
    if (next === state.chunk) return;
    state.chunk = next;
    state.lastSelection = "";
    render({ scrollPercent: 0, keepPosition: true });
  }

  function adjustReading(kind, amount) {
    if (kind === "font") state.fontSize = Math.max(15, Math.min(28, state.fontSize + amount));
    else state.width = Math.max(520, Math.min(980, state.width + amount));
    const documentElement = document.querySelector(".reader-document");
    if (documentElement) {
      documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
      documentElement.style.setProperty("--reader-width", `${state.width}px`);
    }
    const fontValue = document.querySelector("#reader-font-value");
    const widthValue = document.querySelector("#reader-width-value");
    if (fontValue) fontValue.textContent = `${state.fontSize}px`;
    if (widthValue) widthValue.textContent = `${state.width}px`;
    requestAnimationFrame(updateReaderChrome);
    saveProgress();
  }

  function toggleContinuous() {
    if (!state.continuous) {
      const position = visibleChunk();
      state.continuous = true;
      render({ position, keepPosition: true });
      return;
    }
    const position = visibleChunk();
    state.chunk = position.index;
    state.continuous = false;
    render({ position, keepPosition: true });
  }

  function openNoteEditor() {
    const liveSelection = selectionText();
    if (liveSelection) state.lastSelection = liveSelection;
    const selectionPreview = document.querySelector("#reader-note-selection");
    if (selectionPreview) {
      selectionPreview.textContent = state.lastSelection || "Nota general sobre este punto de la lectura";
      selectionPreview.classList.toggle("is-general", !state.lastSelection);
    }
    const layer = document.querySelector("#reader-note-layer");
    if (layer) layer.hidden = false;
    requestAnimationFrame(() => document.querySelector("#reader-note-text")?.focus({ preventScroll: true }));
  }

  function closeNoteEditor(clearSelection = false) {
    const layer = document.querySelector("#reader-note-layer");
    if (layer) layer.hidden = true;
    const field = document.querySelector("#reader-note-text");
    if (field) field.value = "";
    if (clearSelection) state.lastSelection = "";
  }

  function exitReader() {
    saveProgress();
    const currentHash = location.hash;
    const fallback = () => { location.hash = `/document/${encodeURIComponent(state.doc.id)}`; };
    if (history.length <= 1) { fallback(); return; }
    history.back();
    window.setTimeout(() => {
      if (location.hash === currentHash && document.querySelector(".reader-app")) fallback();
    }, 350);
  }

  function togglePanel(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    const hidden = panel.hidden; closePanels(); panel.hidden = !hidden;
    const backdrop = document.querySelector(".reader-panel-backdrop");
    if (backdrop) backdrop.hidden = hidden ? false : true;
  }
  function closePanels() {
    document.querySelector("#reader-toc")?.setAttribute("hidden", "");
    document.querySelector("#reader-settings")?.setAttribute("hidden", "");
    document.querySelector("#reader-context")?.setAttribute("hidden", "");
    document.querySelector(".reader-panel-backdrop")?.setAttribute("hidden", "");
  }

  document.addEventListener("selectionchange", () => {
    if (!state.doc || !document.querySelector(".reader-app")) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim().slice(0, 1000) || "";
    if (!text) return;
    const element = selection.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode?.parentElement;
    if (!element?.closest?.("#reader-content")) return;
    state.lastSelection = text;
    state.lastSelectionChunk = Number(element.closest(".reader-chunk")?.dataset.chunk || state.chunk);
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !document.querySelector(".reader-app")) return;
    const noteLayer = document.querySelector("#reader-note-layer");
    if (noteLayer && !noteLayer.hidden) { closeNoteEditor(true); return; }
    const openPanel = document.querySelector("#reader-toc:not([hidden]),#reader-settings:not([hidden]),#reader-context:not([hidden])");
    if (openPanel) { closePanels(); return; }
    const search = document.querySelector("#reader-search");
    if (search && !search.hidden) {
      clearTimeout(state.findTimer);
      state.query = ""; state.matches = []; state.matchIndex = -1;
      clearMarks("search-hit"); search.hidden = true;
      document.querySelector("#reader-find").value = ""; updateMatchCount();
    }
  });

  root.reader = { open, stop: stopSession };
})();
