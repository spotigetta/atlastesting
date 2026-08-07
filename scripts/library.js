(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.NumberFormat("es-ES");
  const compact = value => value >= 1e6 ? `${(value / 1e6).toFixed(1).replace(".", ",")} M` : value >= 1e3 ? `${Math.round(value / 1e3)} mil` : fmt.format(value);

  function icon(id) { return `<svg aria-hidden="true"><use href="#icon-${id}"></use></svg>`; }
  function notebookButton(library, label = `Abrir ${library.short}`) {
    return library.notebookUrl ? `<a class="notebook-button" href="${esc(library.notebookUrl)}" target="_blank" rel="noopener">${esc(label)}${icon("external")}</a>` : "";
  }

  function cover(library) {
    return `<section class="library-cover tone-${library.tone}" data-library="${library.id}">
      <div class="library-cover-inner library-cover-grid">
        <div>
          <div class="library-identity"><span class="library-mark">${library.mark}</span><div><span class="eyebrow">Biblioteca especializada</span><h1>${esc(library.short)}</h1></div></div>
          <p>${esc(library.purpose)}</p>
          <div class="button-row"><a class="secondary-button" href="#/explore">Todas las bibliotecas</a>${notebookButton(library)}</div>
        </div>
        <div class="metric-scroller">
          ${metric(library.stats.documents, "Documentos")}
          ${metric(compact(library.stats.words), "Palabras")}
          ${metric(library.stats.categories, "Categorías")}
          ${metric(library.stats.authors, "Autores")}
          ${metric(library.stats.foreignLanguage, "Otros idiomas")}
        </div>
      </div>
    </section>`;
  }

  function metric(value, label) { return `<div class="metric-card"><b>${value}</b><span>${label}</span></div>`; }

  function tabs(library, active) {
    const items = [["documents", "Documentos"], ["shelf", "Biblioteca visual"], ["topics", "Mapa temático"], ["authors", "Autores"], ["stats", "Estadísticas"], ["questions", "Qué puedo preguntar"]];
    return `<nav class="library-tabs tone-${library.tone}"><div class="chip-row">${items.map(([id, label]) => `<a class="chip ${active === id ? "active" : ""}" href="#/library/${library.id}/${id}">${label}</a>`).join("")}</div></nav>`;
  }

  function docCard(doc, library) {
    const saved = root.storage.isFavorite("documents", doc.id);
    return `<article class="document-card tone-${library.tone}" data-library="${library.id}">
      <div style="display:flex;justify-content:space-between;gap:8px"><span class="doc-kicker">${esc(doc.category)}</span><button class="save-dot ${saved ? "saved" : ""}" data-save-document="${esc(doc.id)}" aria-label="${saved ? "Quitar de guardados" : "Guardar documento"}">${icon("bookmark")}</button></div>
      <button data-open-document="${esc(doc.id)}" style="border:0;background:none;padding:0;text-align:left"><h3>${esc(doc.title)}</h3><p>${esc(doc.author || `Original ${doc.originals}`)}</p></button>
      <div class="doc-footer"><span>${compact(doc.words)} palabras</span><span>${doc.status === "historical" ? "Histórico" : doc.status === "incomplete" ? "Incompleto" : "Ver ficha →"}</span></div>
    </article>`;
  }

  function docRow(doc) {
    return `<button class="document-row" data-open-document="${esc(doc.id)}"><b>${esc(doc.title)}</b><span>${esc(doc.category)}</span><span>${compact(doc.words)} palabras</span></button>`;
  }

  function documentView(library, options = {}) {
    const query = options.query || "";
    const category = options.category || "all";
    const status = options.status || "all";
    const view = options.view || "cards";
    const term = root.data.expanded(query);
    const docs = library.documents.filter(doc => {
      const matchesTerm = !term || root.data.expanded(`${doc.title} ${doc.file} ${doc.category} ${doc.author || ""} ${doc.originals}`).includes(term);
      return matchesTerm && (category === "all" || doc.category === category) && (status === "all" || doc.status === status);
    });
    const content = view === "list" ? `<div class="document-list">${docs.map(docRow).join("")}</div>` : `<div class="document-grid">${docs.map(doc => docCard(doc, library)).join("")}</div>`;
    return `<div class="library-toolbar">
      <input class="library-filter" id="library-query" value="${esc(query)}" placeholder="Buscar en ${esc(library.short)}…" aria-label="Buscar en esta biblioteca">
      <select class="library-filter" id="library-category" aria-label="Filtrar por categoría"><option value="all">Todas las categorías</option>${library.categories.map(item => `<option value="${esc(item.name)}" ${category === item.name ? "selected" : ""}>${esc(item.name)} (${item.count})</option>`).join("")}</select>
      <div class="view-toggle"><button data-doc-view="cards" class="${view === "cards" ? "active" : ""}" aria-label="Vista de tarjetas">${icon("grid")}</button><button data-doc-view="list" class="${view === "list" ? "active" : ""}" aria-label="Vista de lista">${icon("list")}</button></div>
    </div>
    <div class="chip-row"><button class="chip ${status === "all" ? "active" : ""}" data-status="all">Todos</button><button class="chip ${status === "historical" ? "active" : ""}" data-status="historical">Históricos</button><button class="chip ${status === "incomplete" ? "active" : ""}" data-status="incomplete">Incompletos</button><button class="chip" data-sort="words">Más extensos</button></div>
    <div class="result-meta"><span>${docs.length} documentos</span><span>Datos del índice</span></div>${docs.length ? content : empty("No hay coincidencias", "Prueba otra palabra o elimina algún filtro.")}`;
  }

  function shelfView(library) {
    const docs = [...library.documents].sort((a, b) => b.words - a.words).slice(0, 100);
    const max = docs[0]?.words || 1;
    return `<div class="section-head"><div><h2>Biblioteca visual</h2><p>Los lomos varían según la extensión real; se muestran hasta 100 para mantener el rendimiento.</p></div></div>
      <div class="shelf">${docs.map(doc => `<button class="book" data-open-document="${esc(doc.id)}" title="${esc(doc.title)} · ${fmt.format(doc.words)} palabras" style="--book-w:${20 + doc.words / max * 26}px;--book-h:${145 + doc.words / max * 160}px">${esc(doc.title)}</button>`).join("")}</div>
      <div class="shelf-legend"><span>Libro fino · documento breve</span><span>Libro grueso · documento extenso</span><span>Color · ${esc(library.short)}</span></div>
      <div class="section"><h2 class="serif">Exploración alternativa</h2><p class="muted small">La vista documental ofrece una alternativa textual completa y accesible.</p><a class="secondary-button" href="#/library/${library.id}/documents">Abrir lista de documentos</a></div>`;
  }

  function topicsView(library) {
    return `<div class="section-head"><div><h2>Mapa temático</h2><p>Áreas, fuentes principales y complementarias consignadas en el índice.</p></div></div><div class="topic-list">${library.topics.map(topic => `<details class="topic-card"><summary><h3>${esc(topic.name)}</h3><span>＋</span></summary><div class="topic-body"><div class="source-block"><b>Fuentes principales</b><p>${esc(topic.primary)}</p></div><div class="source-block"><b>Complementarias</b><p>${esc(topic.complementary)}</p></div><div class="topic-actions"><button class="secondary-button" data-save-collection="${esc(topic.id)}">Guardar</button>${notebookButton(library, `Consultar en ${library.short}`)}</div></div></details>`).join("")}</div>`;
  }

  function authorsView(library) {
    return `<div class="section-head"><div><h2>Autores identificados</h2><p>La atribución se basa únicamente en nombres reconocibles dentro del título del archivo.</p></div></div>${library.authors.length ? `<div class="author-grid">${library.authors.map(author => `<button class="author-card" data-search-term="${esc(author.name)}"><span class="author-initial">${esc(author.name.split(" ").filter(Boolean).slice(-1)[0][0])}</span><h3>${esc(author.name)}</h3><p>${author.count} documento${author.count === 1 ? "" : "s"}</p></button>`).join("")}</div>` : empty("Autores no consignados", "El índice no permite identificar autores de forma segura.")}`;
  }

  function questionsView(library) {
    const questions = root.data.catalog.editorial?.questions?.[library.id] || [];
    const tagline = root.data.catalog.editorial?.taglines?.[library.id] || "Ejemplos preparados para orientar una consulta en el cuaderno.";
    return `<div class="section-head"><div><h2>¿Qué puedo preguntar?</h2><p>${esc(tagline)}</p></div></div><div class="question-list">${questions.map((question, index) => `<article class="question-card"><span class="question-number">${index + 1}</span><p>${esc(question)}</p><div class="question-actions"><button data-copy-question="${esc(question)}">Copiar</button><button data-save-question="${library.id}-${index}">Guardar</button><a href="${esc(library.notebookUrl)}" target="_blank" rel="noopener">Llevar a la IA</a></div></article>`).join("")}</div>`;
  }

  function empty(title, text) {
    return `<div class="empty-state"><span class="empty-glyph">${icon("search")}</span><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
  }

  function render(library, active = "documents", options = {}) {
    let content;
    if (active === "shelf") content = shelfView(library);
    else if (active === "topics") content = topicsView(library);
    else if (active === "authors") content = authorsView(library);
    else if (active === "stats") content = root.statistics.library(library);
    else if (active === "questions") content = questionsView(library);
    else content = documentView(library, options);
    return `<div class="tone-${library.tone}" data-library="${library.id}">${cover(library)}${tabs(library, active)}<section class="page">${content}</section></div>`;
  }

  function detail(doc) {
    const library = doc.library;
    const saved = root.storage.isFavorite("documents", doc.id);
    const related = library.documents.filter(item => item.id !== doc.id && item.category === doc.category).slice(0, 5);
    const questions = root.data.catalog.editorial?.questions?.[library.id]?.slice(0, 3) || [];
    const status = doc.status === "historical" ? "Histórico o sustituido" : doc.status === "incomplete" ? "Incompleto o parcial" : "No consignado en el índice";
    return `<div class="tone-${library.tone}" data-library="${library.id}">
      <header class="detail-header"><button class="icon-button" data-action="close-detail" aria-label="Cerrar">${icon("close")}</button><div style="display:flex;gap:8px"><button class="icon-button ${saved ? "saved" : ""}" data-save-document="${esc(doc.id)}" aria-label="Guardar">${icon("bookmark")}</button><button class="icon-button" data-share-document="${esc(doc.id)}" aria-label="Compartir">${icon("share")}</button></div></header>
      <div class="detail-body"><span class="detail-mark">${library.mark}</span><div class="eyebrow" style="margin-top:18px">${esc(library.short)} · ${esc(doc.category)}</div><h1 id="detail-title">${esc(doc.title)}</h1><p class="detail-lead">Fuente registrada en el índice documental de ${esc(library.name)}.</p>
        <a class="primary-button detail-read-button" href="#/reader/${encodeURIComponent(doc.id)}">${icon("books")} Leer documento completo</a>
        <dl class="metadata-list">
          ${row("Archivo", doc.file)}${row("Número de catálogo", doc.catalogId || "No consignado en el índice")}${row("Números originales", doc.originals)}${row("Biblioteca", library.name)}${row("Categoría", doc.category)}${row("Autor", doc.author || "No consignado en el índice")}${row("Fecha", doc.year || "No consignada en el índice")}${row("Idioma", doc.language || "No consignado en el índice")}${row("Extensión", `${fmt.format(doc.words)} palabras`)}${row("Autoridad orientativa", doc.authority)}${row("Estado", status)}
        </dl>
        <div class="authority-note"><b>Cómo leer esta etiqueta</b><br>El nivel depende del tipo de consulta. Una norma jurídica responde a una cuestión jurídica; un libro litúrgico vigente responde a una rúbrica; un Padre de la Iglesia ayuda a interpretar, pero no sustituye al Magisterio.</div>
        <section class="detail-section"><h2>Preguntas sugeridas</h2><div class="question-list">${questions.map(question => `<article class="question-card"><p>${esc(question)}</p><div class="question-actions"><button data-copy-question="${esc(question)}">Copiar</button><a href="${esc(library.notebookUrl)}" target="_blank" rel="noopener">Abrir IA</a></div></article>`).join("")}</div></section>
        <section class="detail-section"><h2>Documentos de la misma categoría</h2><div class="document-list">${related.map(docRow).join("") || `<p class="muted small">No hay otros documentos en esta categoría.</p>`}</div></section>
      </div>
      <footer class="detail-actions"><a class="primary-button" href="#/reader/${encodeURIComponent(doc.id)}">${icon("books")} Leer</a>${notebookButton(library, "Consultar en la IA")}<button class="icon-button" data-save-document="${esc(doc.id)}" aria-label="Guardar">${icon("bookmark")}</button><button class="icon-button" data-share-document="${esc(doc.id)}" aria-label="Compartir">${icon("share")}</button></footer>
    </div>`;
  }

  function row(label, value) { return `<div class="metadata-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`; }

  root.library = { render, detail, notebookButton, docCard, docRow, compact, fmt, esc, icon, empty };
})();
