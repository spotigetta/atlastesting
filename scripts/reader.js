(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const state = {
    doc: null, payload: null, chunk: 0, continuous: false, fontSize: 19, width: 720,
    query: "", matches: [], matchIndex: -1, sessionStarted: 0, progressTimer: null, toolsOpen: false,
    lastSelection: "", lastSelectionChunk: 0, scrollTimer: null, findTimer: null
  };
  let loading = new Map();

  function loadContent(doc) {
    if (loading.has(doc.id)) return loading.get(doc.id);
    const promise = window.AtlasRuntime.fetchJson(doc.contentFile).then(payload => {
      if (payload?.id !== doc.id) throw new Error("El contenido no corresponde al documento");
      return payload;
    });
    loading.set(doc.id, promise);
    promise.finally(() => loading.delete(doc.id));
    return promise;
  }

  async function open(doc, query = "") {
    stopSession();
    state.doc = doc;
    state.query = query;
    state.matches = [];
    state.matchIndex = -1;
    state.toolsOpen = false;
    const saved = root.storage.getReaderProgress(doc.id);
    state.chunk = saved?.chunkIndex || 0;
    state.fontSize = saved?.fontSize || 19;
    state.width = saved?.width || 720;
    state.continuous = Boolean(saved?.continuous);
    try {
      state.payload = await loadContent(doc);
      if (query) {
        const first = state.payload.chunks.findIndex(chunk => chunk.markdown.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
        if (first >= 0) state.chunk = first;
      }
      state.chunk = Math.min(state.chunk, state.payload.chunks.length - 1);
      render({ restoreSaved: true });
      startSession();
    } catch {
      document.querySelector("#main").innerHTML = root.library.empty("No se pudo abrir el documento", "Comprueba que la construcción pública incluye este documento.");
    }
  }

  function stopSession() {
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
    root.storage.saveReaderProgress(state.doc.id, {
      chunkIndex: state.continuous ? Math.min(state.payload.chunks.length - 1, Math.floor(scrollRatio * state.payload.chunks.length)) : state.chunk,
      scrollRatio, fontSize: state.fontSize, width: state.width,
      continuous: state.continuous,
      percent: state.continuous ? Math.round(scrollRatio * 100) : Math.round(((state.chunk + scrollRatio) / state.payload.chunks.length) * 100)
    });
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

  function render(options = {}) {
    const doc = state.doc;
    const library = doc.library;
    const payload = state.payload;
    const chunks = state.continuous ? payload.chunks : [payload.chunks[state.chunk]];
    const related = relatedDocuments(doc);
    const questions = root.data.catalog.editorial?.questions?.[library.id] || [];
    const annotations = root.storage.getAnnotations(doc.id);
    const collections = root.data.catalog.collections.filter(item => item.documentIds.includes(doc.id));
    const relatedShorts = root.data.catalog.shorts.filter(item => item.sourceDocumentId === doc.id).slice(0, 4);
    const favorite = root.storage.isFavorite("documents", doc.id);
    const savedProgress = root.storage.getReaderProgress(doc.id);
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
      <div class="reader-search" id="reader-search" ${state.query ? "" : "hidden"}><input id="reader-find" value="${esc(state.query)}" placeholder="Buscar literalmente en este documento"><button data-reader-action="previous-match" aria-label="Anterior">↑</button><button data-reader-action="next-match" aria-label="Siguiente">↓</button><span id="reader-match-count">0 / 0</span><button data-reader-action="close-search" aria-label="Cerrar">${root.library.icon("close")}</button></div>
      <div class="reader-layout">
        <main class="reader-scroll">
          <article class="reader-document" style="--reader-size:${state.fontSize}px;--reader-width:${state.width}px">
            <header class="reader-document-head"><span class="eyebrow">${esc(library.short)} · ${esc(doc.category)}</span><h1>${esc(doc.title)}</h1><div class="reader-meta"><span>${Math.max(1, Math.round(doc.words / 220))} min de lectura</span><span>${doc.words.toLocaleString("es-ES")} palabras</span><span>${doc.author ? esc(doc.author) : "Autor no consignado"}</span></div></header>
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
        <form class="reader-note-editor" id="reader-note-form">
          <header><div><span class="eyebrow">Nota personal</span><h2>Guardar una idea</h2></div><button type="button" class="icon-button" data-reader-action="close-note" aria-label="Cerrar">${root.library.icon("close")}</button></header>
          <blockquote id="reader-note-selection"></blockquote>
          <label for="reader-note-text">Tu nota</label>
          <textarea id="reader-note-text" rows="7" maxlength="4000" placeholder="Escribe aquí lo que quieres recordar…" required></textarea>
          <footer><button type="button" class="secondary-button" data-reader-action="close-note">Cancelar</button><button type="submit" class="primary-button">Guardar nota</button></footer>
        </form>
      </div>
    </div>`;
    bind();
    applyAnnotations();
    if (state.query) find(state.query, state.matchIndex < 0);
    if (options.restoreSaved && savedProgress?.scrollRatio && !state.query) requestAnimationFrame(() => {
      const scroll = document.querySelector(".reader-scroll");
      if (scroll) {
        scroll.scrollTop = savedProgress.scrollRatio * Math.max(0, scroll.scrollHeight - scroll.clientHeight);
        updateReaderChrome();
      }
    });
    if (Number.isFinite(options.scrollPercent) && !state.query) requestAnimationFrame(() => {
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
    const blocks = [];
    let paragraph = [];
    let list = null;
    let code = false;
    let codeLines = [];
    const flushParagraph = () => {
      if (paragraph.length) {
        blocks.push(`<p>${paragraph.map((line, index) => `${index ? (paragraph[index - 1].hardBreak ? "<br>" : " ") : ""}${inline(line.text)}`).join("")}</p>`);
        paragraph = [];
      }
    };
    const flushList = () => {
      if (list) {
        blocks.push(`<${list.type}>${list.items.map(item => `<li class="${item.task ? "task-item" : ""}">${item.task ? `<input type="checkbox" disabled ${item.checked ? "checked" : ""}>` : ""}${inline(item.text)}</li>`).join("")}</${list.type}>`);
        list = null;
      }
    };
    const cells = line => line.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
    const lines = source.split(/\r?\n/);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const rawLine = lines[lineIndex];
      if (/^```/.test(rawLine)) {
        flushParagraph(); flushList();
        if (code) { blocks.push(`<pre><code>${esc(codeLines.join("\n"))}</code></pre>`); codeLines = []; }
        code = !code; continue;
      }
      if (code) { codeLines.push(rawLine); continue; }
      const setext = lines[lineIndex + 1]?.match(/^\s*(=+|-+)\s*$/);
      if (rawLine.trim() && setext) {
        flushParagraph(); flushList();
        const level = setext[1][0] === "=" ? 1 : 2;
        const entry = toc[headingIndex++];
        blocks.push(`<h${level} id="${esc(entry?.anchor || "")}">${inline(rawLine.trim())}</h${level}>`);
        lineIndex += 1; continue;
      }
      const heading = rawLine.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        flushParagraph(); flushList();
        const entry = toc[headingIndex++];
        blocks.push(`<h${heading[1].length} id="${esc(entry?.anchor || "")}">${inline(heading[2])}</h${heading[1].length}>`);
        continue;
      }
      if (rawLine.includes("|") && /^\s*\|?\s*:?-{3,}/.test(lines[lineIndex + 1] || "")) {
        flushParagraph(); flushList();
        const headers = cells(rawLine);
        const aligns = cells(lines[lineIndex + 1]).map(cell => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left");
        const rows = [];
        lineIndex += 2;
        while (lineIndex < lines.length && lines[lineIndex].includes("|") && lines[lineIndex].trim()) {
          rows.push(cells(lines[lineIndex])); lineIndex += 1;
        }
        lineIndex -= 1;
        blocks.push(`<div class="reader-table-wrap"><table><thead><tr>${headers.map((cell, index) => `<th style="text-align:${aligns[index] || "left"}">${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map((_, index) => `<td style="text-align:${aligns[index] || "left"}">${inline(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      const bullet = rawLine.match(/^\s*[-*+]\s+(.+)/);
      const ordered = rawLine.match(/^\s*\d+[.)]\s+(.+)/);
      if (bullet || ordered) {
        flushParagraph();
        const type = ordered ? "ol" : "ul";
        if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
        const value = (bullet || ordered)[1];
        const task = value.match(/^\[([ xX])\]\s+(.+)/);
        list.items.push({ text: task ? task[2] : value, task: Boolean(task), checked: task?.[1].toLowerCase() === "x" }); continue;
      }
      if (/^>\s?/.test(rawLine)) {
        flushParagraph(); flushList();
        const quote = [rawLine.replace(/^>\s?/, "")];
        while (/^>\s?/.test(lines[lineIndex + 1] || "")) quote.push(lines[++lineIndex].replace(/^>\s?/, ""));
        blocks.push(`<blockquote>${quote.map(inline).join("<br>")}</blockquote>`); continue;
      }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(rawLine)) { flushParagraph(); flushList(); blocks.push("<hr>"); continue; }
      if (!rawLine.trim()) { flushParagraph(); flushList(); continue; }
      paragraph.push({ text: rawLine.trim(), hardBreak: /\s{2}$/.test(rawLine) });
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

  function inline(value) {
    return esc(value)
      .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, "$1")
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "<strong>$1$2</strong>")
      .replace(/(^|[^\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/(^|[^\w])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
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
    const annotations = root.storage.getAnnotations(state.doc.id);
    panel.innerHTML = annotations.map(annotationItem).join("") || `<p>Todavía no has añadido ninguna.</p>`;
  }

  function applyAnnotations() {
    const highlights = root.storage.getAnnotations(state.doc.id).filter(item => item.type === "highlight" && item.text);
    for (const item of highlights) highlightText(item.text, "user-highlight");
  }

  function find(query, initial = false) {
    state.query = String(query || "");
    state.matches = [];
    clearMarks("search-hit");
    if (!state.query) {
      state.matchIndex = -1;
      updateMatchCount();
      return;
    }
    const lower = state.query.toLocaleLowerCase("es");
    state.payload.chunks.forEach(chunk => {
      let offset = 0;
      const text = chunk.markdown.toLocaleLowerCase("es");
      while ((offset = text.indexOf(lower, offset)) >= 0) {
        state.matches.push({ chunkIndex: chunk.index, offset });
        offset += Math.max(1, lower.length);
      }
    });
    if (!state.matches.length) {
      updateMatchCount();
      return;
    }
    if (initial || state.matchIndex < 0 || state.matchIndex >= state.matches.length) state.matchIndex = 0;
    goMatch(state.matchIndex);
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
    highlightText(state.query, "search-hit");
    const marks = [...document.querySelectorAll("mark.search-hit")];
    const inPriorChunks = state.matches.filter(item => item.chunkIndex < match.chunkIndex).length;
    const localIndex = state.continuous ? state.matchIndex : state.matchIndex - inPriorChunks;
    const target = marks[localIndex] || marks[0];
    document.querySelectorAll("mark.current-hit").forEach(mark => mark.classList.remove("current-hit"));
    target?.classList.add("current-hit");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    updateMatchCount();
  }

  function highlightText(text, className) {
    if (!text) return;
    const rootNode = document.querySelector("#reader-content");
    if (!rootNode) return;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style")) return NodeFilter.FILTER_REJECT;
        if (className === "search-hit") return parent.closest("mark.search-hit") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        return parent.closest("mark") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const pattern = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
    nodes.forEach(node => {
      if (!pattern.test(node.nodeValue)) return;
      pattern.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let last = 0;
      node.nodeValue.replace(pattern, (match, offset) => {
        fragment.append(document.createTextNode(node.nodeValue.slice(last, offset)));
        const mark = document.createElement("mark"); mark.className = className; mark.textContent = match; fragment.append(mark);
        last = offset + match.length;
      });
      fragment.append(document.createTextNode(node.nodeValue.slice(last)));
      node.replaceWith(fragment);
    });
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
    const scroll = document.querySelector(".reader-scroll");
    const ratio = scroll ? scroll.scrollTop / Math.max(1, scroll.scrollHeight - scroll.clientHeight) : 0;
    return Math.min(state.payload.chunks.length - 1, Math.floor(ratio * state.payload.chunks.length));
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
        render({ scrollPercent: 0 });
      }
    });
    document.querySelector("#reader-note-form")?.addEventListener("submit", event => {
      event.preventDefault();
      const note = document.querySelector("#reader-note-text")?.value.trim();
      if (!note) return;
      root.storage.addAnnotation(state.doc.id, {
        type: "note", text: state.lastSelection, note,
        chunkIndex: state.lastSelection ? state.lastSelectionChunk : activeChunkIndex()
      });
      closeNoteEditor(true);
      updateAnnotationPanel();
      root.appToast?.("Nota guardada en este documento.");
    });
    document.querySelector(".reader-app")?.addEventListener("click", event => {
      const target = event.target.closest("button");
      if (!target) return;
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
        state.query = ""; state.matches = []; state.matchIndex = -1;
        clearMarks("search-hit");
        document.querySelector("#reader-search").hidden = true;
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
        root.storage.addAnnotation(state.doc.id, { type: "highlight", text, chunkIndex: state.lastSelection ? state.lastSelectionChunk : activeChunkIndex() });
        highlightText(text, "user-highlight");
        updateAnnotationPanel();
        window.getSelection()?.removeAllRanges();
        state.lastSelection = "";
        root.appToast?.("Fragmento subrayado.");
      }
      if (action === "note") openNoteEditor();
      if (action === "close-note") closeNoteEditor(true);
      if (action === "bookmark") {
        const chunkIndex = activeChunkIndex();
        root.storage.addAnnotation(state.doc.id, { type: "bookmark", chunkIndex, note: `Fragmento ${chunkIndex + 1}` });
        updateAnnotationPanel();
        root.appToast?.("Punto de lectura marcado.");
      }
      if (target.dataset.readerChunk !== undefined) {
        event.preventDefault(); event.stopPropagation();
        const nextChunk = Number(target.dataset.readerChunk);
        const anchor = target.dataset.readerAnchor;
        closePanels();
        if (state.continuous || nextChunk === state.chunk) {
          document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          state.chunk = nextChunk;
          render();
          requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }));
        }
      }
      if (target.dataset.removeAnnotation) {
        root.storage.removeAnnotation(state.doc.id, target.dataset.removeAnnotation);
        clearMarks("user-highlight");
        applyAnnotations();
        if (state.query) goMatch(state.matchIndex);
        updateAnnotationPanel();
      }
    });
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
    render({ scrollPercent: 0 });
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
    const scroll = document.querySelector(".reader-scroll");
    const localRatio = scroll ? scroll.scrollTop / Math.max(1, scroll.scrollHeight - scroll.clientHeight) : 0;
    if (!state.continuous) {
      const absolutePercent = ((state.chunk + localRatio) / state.payload.chunks.length) * 100;
      state.continuous = true;
      render({ scrollPercent: absolutePercent });
      return;
    }
    const absolute = Math.max(0, Math.min(.999999, localRatio));
    const exactChunk = absolute * state.payload.chunks.length;
    state.chunk = Math.floor(exactChunk);
    state.continuous = false;
    render({ scrollPercent: (exactChunk - state.chunk) * 100 });
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
      state.query = ""; state.matches = []; state.matchIndex = -1;
      clearMarks("search-hit"); search.hidden = true;
    }
  });

  root.reader = { open, stop: stopSession };
})();
