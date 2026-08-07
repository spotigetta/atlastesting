(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const state = {
    doc: null, payload: null, chunk: 0, continuous: false, fontSize: 19, width: 720,
    query: "", matches: [], matchIndex: -1, sessionStarted: 0, progressTimer: null, toolsOpen: false
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
      render();
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
      chunkIndex: state.chunk, scrollRatio, fontSize: state.fontSize, width: state.width,
      continuous: state.continuous,
      percent: Math.round(((state.chunk + scrollRatio) / state.payload.chunks.length) * 100)
    });
  }

  function render() {
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
    document.querySelector("#main").innerHTML = `<div class="reader-app tone-${library.tone}" data-library="${library.id}">
      <header class="reader-header">
        <a class="icon-button" href="#/document/${encodeURIComponent(doc.id)}" aria-label="Volver a la ficha">${root.library.icon("arrow")}</a>
        <button class="reader-title-button" data-reader-action="toc"><b>${esc(doc.title)}</b><small>${state.chunk + 1} / ${payload.chunks.length} fragmentos</small></button>
        <div class="reader-header-actions"><button class="icon-button" data-reader-action="search" aria-label="Buscar en el documento">${root.library.icon("search")}</button><button class="icon-button" data-reader-action="settings" aria-label="Ajustes de lectura">${root.library.icon("theme")}</button></div>
      </header>
      <div class="reader-progress"><span style="width:${Math.round((state.chunk + 1) / payload.chunks.length * 100)}%"></span></div>
      <aside class="reader-toc" id="reader-toc" hidden><div class="reader-panel-head"><h2>Esquema del documento</h2><button class="icon-button" data-reader-action="close-panels">${root.library.icon("close")}</button></div><p class="toc-help">Despliega los niveles y salta a cualquier apartado.</p><nav>${payload.toc.length ? tocTree(payload.toc) : `<p>No hay encabezados consignados.</p>`}</nav></aside>
      <aside class="reader-settings" id="reader-settings" hidden><div class="reader-panel-head"><h2>Lectura</h2><button class="icon-button" data-reader-action="close-panels">${root.library.icon("close")}</button></div>
        <label>Tamaño de texto <span>${state.fontSize}px</span></label><div class="button-row"><button class="secondary-button" data-reader-action="font-down">A−</button><button class="secondary-button" data-reader-action="font-up">A＋</button></div>
        <label>Ancho de columna <span>${state.width}px</span></label><div class="button-row"><button class="secondary-button" data-reader-action="width-down">Estrechar</button><button class="secondary-button" data-reader-action="width-up">Ampliar</button></div>
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
        <aside class="reader-context"><section><span class="eyebrow">Contexto</span><h2>Mientras lees</h2></section>
          <section><h3>Autor</h3><p>${esc(doc.author || "No consignado en el índice")}</p></section>
          <section><h3>Cronología</h3><p>${doc.year ? esc(doc.year) : "No hay fecha explícita en el índice."}</p></section>
          <section><h3>Relacionados</h3>${related.map(item => `<a href="#/reader/${encodeURIComponent(item.id)}">${esc(item.title)}</a>`).join("") || `<p>No hay relaciones seguras suficientes.</p>`}</section>
          <section><h3>Colecciones</h3>${collections.map(item => `<a href="#/collection/${encodeURIComponent(item.id)}">${esc(item.title)}</a>`).join("") || `<p>No pertenece a una colección enlazada.</p>`}</section>
          <section><h3>Shorts relacionados</h3>${relatedShorts.map(item => `<a href="#/short/${encodeURIComponent(item.id)}">${esc(item.title)}</a>`).join("") || `<p>No hay Shorts directos.</p>`}</section>
          <section><h3>Citas relacionadas</h3><p>Atlas no atribuye citas si el índice no las identifica expresamente.</p></section>
          <section><h3>Preguntas posibles</h3>${questions.slice(0, 5).map(question => `<button data-copy-question="${esc(question)}">${esc(question)}</button>`).join("")}</section>
          <section><h3>Anotaciones</h3><div id="reader-annotations">${annotations.map(annotationItem).join("") || `<p>Todavía no has añadido ninguna.</p>`}</div></section>
          <section><a class="secondary-button" href="#/graph?focus=${encodeURIComponent(doc.id)}">Abrir mapa de relaciones</a></section>
        </aside>
      </div>
      <footer class="reader-tools ${state.toolsOpen ? "is-open" : ""}" aria-label="Herramientas de lectura">
        <button class="reader-tools-toggle" data-reader-action="tools-toggle" aria-label="${state.toolsOpen ? "Ocultar herramientas" : "Mostrar herramientas"}" aria-expanded="${state.toolsOpen}">${state.toolsOpen ? "×" : "✦"}</button>
        <div class="reader-tool-group">
          <button class="${favorite ? "active" : ""}" data-reader-action="favorite"><span class="reader-tool-icon">${root.library.icon("bookmark")}</span><span class="reader-tool-label">${favorite ? "Guardado" : "Guardar"}</span></button>
          <button data-reader-action="highlight"><span class="reader-tool-icon tool-highlight">Aa</span><span class="reader-tool-label">Subrayar</span></button>
          <button data-reader-action="note"><span class="reader-tool-icon tool-note">✎</span><span class="reader-tool-label">Anotar</span></button>
          <button data-reader-action="bookmark"><span class="reader-tool-icon tool-pin">⌖</span><span class="reader-tool-label">Marcar</span></button>
        </div>
      </footer>
    </div>`;
    bind();
    applyAnnotations();
    if (state.query) find(state.query, state.matchIndex < 0);
    const saved = root.storage.getReaderProgress(doc.id);
    if (saved?.scrollRatio && !state.query) requestAnimationFrame(() => {
      const scroll = document.querySelector(".reader-scroll");
      if (scroll) scroll.scrollTop = saved.scrollRatio * Math.max(0, scroll.scrollHeight - scroll.clientHeight);
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
    return `<article class="annotation-item"><b>${label}</b><p>${esc(item.note || item.text || `Fragmento ${item.chunkIndex + 1}`)}</p><button data-remove-annotation="${item.id}">Eliminar</button></article>`;
  }

  function applyAnnotations() {
    const highlights = root.storage.getAnnotations(state.doc.id).filter(item => item.type === "highlight" && item.text);
    for (const item of highlights) highlightText(item.text, "user-highlight");
  }

  function find(query, initial = false) {
    state.query = query;
    state.matches = [];
    if (!query) { render(); return; }
    const lower = query.toLocaleLowerCase("es");
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
    if (initial || state.matchIndex < 0) state.matchIndex = 0;
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
    document.querySelectorAll("mark.search-hit").forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent)));
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
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return node.parentElement.closest("mark,script,style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
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

  function updateMatchCount() {
    const count = document.querySelector("#reader-match-count");
    if (count) count.textContent = state.matches.length ? `${state.matchIndex + 1} / ${state.matches.length}` : "0 / 0";
  }

  function selectionText() { return window.getSelection()?.toString().trim().slice(0, 1000) || ""; }

  function bind() {
    document.querySelector(".reader-scroll")?.addEventListener("scroll", () => {
      clearTimeout(state.scrollTimer); state.scrollTimer = setTimeout(saveProgress, 250);
    });
    document.querySelector("#reader-find")?.addEventListener("input", event => {
      clearTimeout(state.findTimer); state.findTimer = setTimeout(() => find(event.target.value), 180);
    });
    document.querySelector(".reader-app")?.addEventListener("click", event => {
      const target = event.target.closest("button");
      if (!target) return;
      const action = target.dataset.readerAction;
      if (action === "tools-toggle") { state.toolsOpen = !state.toolsOpen; render(); return; }
      if (action === "toc") togglePanel("reader-toc");
      if (action === "settings") togglePanel("reader-settings");
      if (action === "close-panels") closePanels();
      if (action === "search") { document.querySelector("#reader-search").hidden = false; document.querySelector("#reader-find").focus(); }
      if (action === "close-search") { state.query = ""; state.matches = []; state.matchIndex = -1; render(); }
      if (action === "next-match") goMatch(state.matchIndex + 1);
      if (action === "previous-match") goMatch(state.matchIndex - 1);
      if (action === "next-chunk" && state.chunk < state.payload.chunks.length - 1) { state.chunk += 1; render(); }
      if (action === "previous-chunk" && state.chunk > 0) { state.chunk -= 1; render(); }
      if (action === "font-up") { state.fontSize = Math.min(28, state.fontSize + 1); render(); }
      if (action === "font-down") { state.fontSize = Math.max(15, state.fontSize - 1); render(); }
      if (action === "width-up") { state.width = Math.min(980, state.width + 80); render(); }
      if (action === "width-down") { state.width = Math.max(520, state.width - 80); render(); }
      if (action === "continuous") { state.continuous = !state.continuous; render(); }
      if (action === "favorite") { root.storage.toggleFavorite("documents", state.doc.id); root.appToast?.("Documento guardado."); render(); }
      if (action === "highlight") {
        const text = selectionText();
        if (!text) { root.appToast?.("Selecciona primero un fragmento del texto."); return; }
        root.storage.addAnnotation(state.doc.id, { type: "highlight", text, chunkIndex: state.chunk });
        render();
      }
      if (action === "note") {
        const text = selectionText();
        const note = prompt("Escribe tu nota:", "");
        if (note) { root.storage.addAnnotation(state.doc.id, { type: "note", text, note, chunkIndex: state.chunk }); render(); }
      }
      if (action === "bookmark") { root.storage.addAnnotation(state.doc.id, { type: "bookmark", chunkIndex: state.chunk, note: `Fragmento ${state.chunk + 1}` }); render(); }
      if (target.dataset.readerChunk !== undefined) {
        event.preventDefault(); event.stopPropagation();
        state.chunk = Number(target.dataset.readerChunk); state.continuous = false; render();
        requestAnimationFrame(() => document.getElementById(target.dataset.readerAnchor)?.scrollIntoView({ block: "start" }));
      }
      if (target.dataset.removeAnnotation) { root.storage.removeAnnotation(state.doc.id, target.dataset.removeAnnotation); render(); }
    });
  }

  function togglePanel(id) {
    const panel = document.getElementById(id);
    const hidden = panel.hidden; closePanels(); panel.hidden = !hidden;
  }
  function closePanels() {
    document.querySelector("#reader-toc")?.setAttribute("hidden", "");
    document.querySelector("#reader-settings")?.setAttribute("hidden", "");
  }

  root.reader = { open, stop: stopSession };
})();
