(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const externalSources = {
    news: {
      title: "Noticias", intro: "Actualidad religiosa en medios externos seleccionados.",
      items: [
        ["Omnes", "https://www.omnesmag.com/", "Información y análisis sobre la Iglesia universal."],
        ["Alfa y Omega", "https://alfayomega.es/", "Actualidad eclesial, social y cultural."],
        ["El Debate · Religión", "https://www.eldebate.com/religion/", "Canal de información religiosa."]
      ]
    },
    opinion: {
      title: "Opinión y recursos", intro: "Lecturas de contexto y series temáticas.",
      items: [
        ["Omnes · Recursos", "https://www.omnesmag.com/seccion/recursos/", "Recursos y piezas de profundización."],
        ["Alfa y Omega · Opinión", "https://alfayomega.es/category/opinion/", "Firmas y artículos de opinión."],
        ["Opus Dei · Series temáticas", "https://opusdei.org/es/page/series-tematicas/", "Series organizadas para lectura continuada."]
      ]
    },
    prayer: {
      title: "Oración", intro: "Una puerta de lectura contemplativa del Evangelio.",
      items: [
        ["Como en una película", "https://opusdei.org/es/article/serie-de-textos-como-una-pelicula/", "Escenas, personajes y pasajes del Evangelio para la oración."]
      ]
    },
    books: {
      title: "Novedades y lecturas", intro: "Catálogos editoriales externos para descubrir libros.",
      items: [
        ["Ediciones Palabra", "https://palabra.es/", "Novedades y catálogo editorial."],
        ["Rialp", "https://www.rialp.com/", "Ensayo, espiritualidad, humanidades y literatura."],
        ["Ciudad Nueva", "https://www.ciudadnueva.com/", "Libros y revistas de espiritualidad y cultura."],
        ["Librería San Pablo", "https://libreria.sanpablo.es/", "Espiritualidad, Biblia, catequesis y familia."],
        ["EUNSA", "https://www.eunsa.es/", "Universidad, pensamiento, teología y humanidades."],
        ["Ediciones Encuentro", "https://edicionesencuentro.com/", "Libros para disfrutar, pensar y dialogar."],
        ["Alianza Editorial", "https://www.alianzaeditorial.es/inicio/", "Clásicos, pensamiento, historia y literatura."]
      ]
    }
  };

  function renderTimeline() {
    const groups = new Map();
    root.data.documents.forEach(doc => {
      const match = String(doc.year || "").match(/\b(30|[1-9]\d{2}|1\d{3}|20[0-2]\d)\b/);
      if (!match) return;
      const year = Number(match[1]);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(doc);
    });
    const years = [...groups.keys()].sort((a, b) => a - b);
    const milestoneYears = [30, ...Array.from({ length: 20 }, (_, index) => (index + 1) * 100), 2026];
    const navigationYears = [...new Set([...milestoneYears, ...years])].sort((a, b) => a - b);
    return `<section class="page"><header class="explore-hero"><span class="eyebrow">Cronología viva</span><h1>Dos mil años, una línea para explorar.</h1><p>Solo aparecen fechas explícitamente consignadas en el índice documental. Toca un año para desplegar sus fuentes.</p></header>
      <div class="living-timeline"><div class="timeline-track"><div class="timeline-axis"></div>${navigationYears.map(year => `<button class="living-year ${groups.has(year) ? "has-sources" : ""}" style="--x:${4 + year / 2026 * 92}%" data-timeline-year="${year}"><b>${year}</b><span>${groups.get(year)?.length || "·"}</span></button>`).join("")}</div></div>
      <div id="timeline-detail" class="timeline-detail">${years.length ? timelineGroup(years[0], groups.get(years[0])) : root.library.empty("Sin fechas explícitas", "Atlas no deduce fechas cuando el índice no las consigna.")}</div></section>`;
  }

  function timelineGroup(year, docs) {
    docs ||= [];
    return `<div class="section-head"><div><span class="eyebrow">${year}</span><h2>${docs.length} fuentes fechadas</h2><p>${docs.length ? "Fecha explícita encontrada en el índice." : "No hay una fecha explícita enlazada a este hito; Atlas no la deduce."}</p></div></div>${docs.length ? `<div class="document-grid">${docs.slice(0, 24).map(doc => root.library.docCard(doc, doc.library)).join("")}</div>` : ""}`;
  }

  const places = [
    { id: "roma", name: "Roma", x: 52, y: 45, terms: /roma|romano|romanum|vatican|pontific/i, notable: ["San Pedro", "San Pablo", "Concilios de Letrán", "Concilios Vaticanos"] },
    { id: "hipona", name: "Hipona", x: 48, y: 57, terms: /agust[ií]n|augustin|hipona/i, notable: ["San Agustín", "Concilios de Hipona", "Iglesia norteafricana"] },
    { id: "nicea", name: "Nicea", x: 62, y: 45, terms: /nicea|niceno/i, notable: ["Concilio de Nicea", "Símbolo niceno", "San Atanasio"] },
    { id: "trento", name: "Trento", x: 51, y: 40, terms: /trento|trident/i, notable: ["Concilio de Trento", "Reforma católica", "Textos tridentinos"] },
    { id: "toledo", name: "Toledo", x: 42, y: 47, terms: /toledo|hispan|visig/i, notable: ["Concilios de Toledo", "Iglesia visigoda", "San Isidoro"] },
    { id: "jerusalen", name: "Jerusalén", x: 64, y: 54, terms: /jerusal[eé]n|tierra santa|palestin/i, notable: ["Iglesia apostólica", "San Cirilo de Jerusalén", "Concilio de Jerusalén"] }
  ];

  function placeDocs(place) {
    return root.data.documents.filter(doc => place.terms.test(`${doc.title} ${doc.author || ""} ${doc.category}`)).slice(0, 20);
  }

  function renderMap() {
    return `<section class="page"><header class="explore-hero"><span class="eyebrow">Atlas geográfico</span><h1>Lugares que abren historias.</h1><p>Las chinchetas enlazan documentos por referencias explícitas en título, autor o categoría; no pretenden geolocalizar todo el corpus.</p></header>
      <div class="world-map" role="img" aria-label="Mapa esquemático con seis lugares históricos">
        <svg viewBox="0 0 1000 520" aria-hidden="true"><path class="world-land" d="M80 110 180 65l120 35 65 95-55 75-100 8-65-55-70-30zm350 4 75-58 120 22 64 76 99-1 116 95-40 86-104 11-63-55-107-18-62 96-96-43-21-111zM735 380l78-26 84 63-48 66-90-12z"/></svg>
        ${places.map(place => `<button class="map-pin" style="--x:${place.x}%;--y:${place.y}%" data-map-place="${place.id}"><span></span><b>${place.name}</b><small>${placeDocs(place).length}</small></button>`).join("")}
      </div><div id="map-detail" class="timeline-detail">${placeDetail(places[0])}</div></section>`;
  }

  function placeDetail(place) {
    const docs = placeDocs(place);
    return `<div class="section-head"><div><span class="eyebrow">Lugar</span><h2>${place.name}</h2><p>${docs.length} relaciones textuales encontradas.</p></div></div>
      <div class="chip-row place-notable">${place.notable.map(item => `<button class="chip" data-search-term="${esc(item)}">${esc(item)}</button>`).join("")}</div>
      <div class="document-grid">${docs.map(doc => root.library.docCard(doc, doc.library)).join("") || root.library.empty("Sin coincidencias directas", "Utiliza los accesos temáticos para buscar autores, concilios y obras relacionados.")}</div>`;
  }

  function related(doc) {
    const items = root.data.documents.filter(item => item.id !== doc.id && (
      (doc.author && item.author === doc.author) ||
      root.data.normalize(item.title) === root.data.normalize(doc.title) ||
      (item.libraryId === doc.libraryId && item.category === doc.category)
    ));
    return [...new Map(items.map(item => [item.id, item])).values()].slice(0, 10);
  }

  let graphScale = 1;

  function renderGraph(focusId = "", view = "hierarchy", libraryId = "") {
    const library = root.data.libraryMap.get(libraryId) || root.data.catalog.libraries[0];
    const focus = root.data.documentMap.get(focusId) || library.documents[0];
    const activeView = view === "sources" ? "sources" : "hierarchy";
    return `<section class="page graph-page"><header class="explore-hero"><span class="eyebrow">Atlas conectado</span><h1>${activeView === "hierarchy" ? "IA, categorías y fuentes" : "Conexiones entre documentos"}</h1><p>${activeView === "hierarchy" ? "Recorre tres niveles del corpus. Cada nodo es clicable y conduce al siguiente nivel." : "Las aristas proceden de coincidencias de autor, título, categoría o biblioteca."}</p></header>
      <div class="graph-switcher">
        <a class="chip ${activeView === "hierarchy" ? "active" : ""}" href="#/graph?view=hierarchy&library=${library.id}">Niveles de cada IA</a>
        <a class="chip ${activeView === "sources" ? "active" : ""}" href="#/graph?view=sources&focus=${encodeURIComponent(focus.id)}">Fuentes conectadas</a>
      </div>
      ${activeView === "hierarchy" ? `<div class="chip-row graph-library-filter">${root.data.catalog.libraries.map(lib => `<a class="chip ${lib.id === library.id ? "active" : ""}" href="#/graph?view=hierarchy&library=${lib.id}">${esc(lib.short)}</a>`).join("")}</div>` : ""}
      <div class="graph-toolbar"><button data-graph-zoom="-0.15" aria-label="Alejar">−</button><button data-graph-reset>100%</button><button data-graph-zoom="0.15" aria-label="Acercar">+</button><span>Arrastra las barras de desplazamiento para recorrer el mapa</span></div>
      <div class="relationship-map graph-workspace">${activeView === "hierarchy" ? hierarchyGraph(library) : sourceGraph(focus)}</div>
      ${activeView === "sources" ? `<div class="button-row"><a class="primary-button" href="#/reader/${encodeURIComponent(focus.id)}">Leer documento central</a><a class="secondary-button" href="#/graph?view=hierarchy&library=${focus.libraryId}">Ver su jerarquía</a></div>` : ""}
    </section>`;
  }

  function hierarchyGraph(library) {
    const categories = library.categories.slice(0, 7);
    const rowGap = 132;
    const rows = categories.map((category, index) => ({
      category,
      y: 92 + index * rowGap,
      docs: library.documents.filter(doc => doc.category === category.name).slice(0, 3)
    }));
    const height = Math.max(660, rows.length * rowGap + 84);
    const edges = [];
    const docs = [];
    rows.forEach(row => {
      edges.push(`<path d="M210 360 C320 360 350 ${row.y} 430 ${row.y}"/>`);
      row.docs.forEach((doc, index) => {
        const y = row.y + (index - (row.docs.length - 1) / 2) * 34;
        edges.push(`<path class="graph-edge-secondary" d="M610 ${row.y} C720 ${row.y} 760 ${y} 820 ${y}"/>`);
        docs.push(`<a href="#/graph?view=sources&focus=${encodeURIComponent(doc.id)}"><rect class="graph-document-node" x="820" y="${y - 24}" width="330" height="48" rx="15"/>${svgLabel(doc.title, 985, y, 42, "graph-document-label")}</a>`);
      });
    });
    return `<svg class="nodegraph-svg" viewBox="0 0 1200 ${height}" role="img" aria-label="Jerarquía de ${esc(library.short)}">
      <g class="graph-edges">${edges.join("")}</g>
      <a href="#/library/${library.id}/documents"><circle class="graph-library-node tone-${library.tone}" cx="145" cy="360" r="72"/>${svgLabel(library.short,145,354,19,"graph-library-label")}<text class="graph-node-count" x="145" y="390">${library.stats.documents} fuentes</text></a>
      ${rows.map(row => `<a href="#/library/${library.id}/documents?category=${encodeURIComponent(row.category.name)}"><rect class="graph-category-node" x="420" y="${row.y - 43}" width="200" height="86" rx="24"/>${svgLabel(row.category.name,520,row.y - 7,24,"graph-category-label")}<text class="graph-node-count dark" x="520" y="${row.y + 31}">${row.category.count} fuentes</text></a>`).join("")}
      ${docs.join("")}
      <text class="graph-column-title" x="145" y="34">IA</text><text class="graph-column-title" x="520" y="34">CATEGORÍAS</text><text class="graph-column-title" x="985" y="34">FUENTES · PULSA PARA CONECTAR</text>
    </svg>`;
  }

  function sourceGraph(focus) {
    const nodes = related(focus).slice(0, 16);
    return `<svg class="nodegraph-svg source-nodegraph" viewBox="0 0 1200 760" role="img" aria-label="Fuentes relacionadas con ${esc(focus.title)}">
      <g class="graph-edges">${nodes.map((_, index) => { const p = graphPoint(index, nodes.length, 600, 380, 430, 285); return `<line x1="600" y1="380" x2="${p.x}" y2="${p.y}"/>`; }).join("")}</g>
      <a href="#/reader/${encodeURIComponent(focus.id)}"><circle class="graph-focus-node tone-${focus.library.tone}" cx="600" cy="380" r="96"/>${svgLabel(focus.title,600,370,26,"graph-focus-label")}<text class="graph-node-count" x="600" y="424">${esc(focus.library.short)}</text></a>
      ${nodes.map((node,index) => { const p = graphPoint(index,nodes.length,600,380,430,285); return `<a href="#/reader/${encodeURIComponent(node.id)}"><circle class="graph-related-node tone-${node.library.tone}" cx="${p.x}" cy="${p.y}" r="62"/>${svgLabel(node.title,p.x,p.y,20,"graph-related-label")}<text class="graph-node-count dark" x="${p.x}" y="${p.y+42}">${esc(shorten(node.library.short,16))}</text></a>`; }).join("")}
    </svg>`;
  }

  function svgLabel(value, x, y, max, className) {
    const words = String(value).split(/\s+/);
    const lines = ["", ""];
    for (const word of words) {
      const target = lines[0].length < max ? 0 : 1;
      if (target === 1 && `${lines[1]} ${word}`.trim().length > max) { lines[1] = `${lines[1]}…`; break; }
      lines[target] = `${lines[target]} ${word}`.trim();
    }
    return `<text class="${className}" x="${x}" y="${y - (lines[1] ? 7 : 0)}">${esc(lines[0])}${lines[1] ? `<tspan x="${x}" dy="17">${esc(lines[1])}</tspan>` : ""}</text>`;
  }

  function graphPoint(index, total, cx = 450, cy = 310, rx = 260, ry = 220) {
    const angle = (Math.PI * 2 * index / Math.max(1, total)) - Math.PI / 2;
    return { x: Math.round(cx + Math.cos(angle) * rx), y: Math.round(cy + Math.sin(angle) * ry) };
  }
  function shorten(value, max) { return String(value).length > max ? `${String(value).slice(0, max - 1)}…` : String(value); }

  function renderSources(section = "news") {
    const active = externalSources[section] || externalSources.news;
    const cards = (window.ATLAS_EXTERNAL?.items || []).filter(item => item.type === section);
    return `<section class="page"><header class="explore-hero"><span class="eyebrow">Ventana editorial</span><h1>${active.title}</h1><p>${active.intro} Los enlaces abren el sitio original; Atlas no altera ni atribuye sus contenidos.</p></header>
      <div class="chip-row source-tabs">${Object.entries(externalSources).map(([id, item]) => `<a class="chip ${id === section ? "active" : ""}" href="#/sources?section=${id}">${item.title}</a>`).join("")}</div>
      <div class="editorial-card-grid">${cards.length ? cards.map(editorialCard).join("") : active.items.map(([title, url, text]) => editorialCard({ title, url, description: text, source: title })).join("")}</div></section>`;
  }

  function editorialCard(item) {
    return `<article class="editorial-card ${item.image ? "has-image" : ""}">
      <a href="${esc(item.url)}" target="_blank" rel="noopener">
        <div class="editorial-image">${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${esc((item.source || "A").slice(0, 1))}</span>`}<span class="editorial-category">${esc(item.type === "books" ? "Nueva lectura" : item.type === "prayer" ? "Oración" : "Noticia")}</span></div>
        <div class="editorial-body"><span class="eyebrow">${esc(item.source || "Fuente externa")}</span><h2>${esc(item.title)}</h2><p>${esc(item.description || "")}</p><div class="editorial-meta"><span>${esc(item.author || "")}</span><time>${esc(item.date || "")}</time></div><span class="source-link">Leer en la fuente ${root.library.icon("external")}</span></div>
      </a>
    </article>`;
  }

  function renderMusic() {
    return `<section class="page music-page"><header class="explore-hero"><span class="eyebrow">Atlas sonoro</span><h1>Música para escuchar, rezar y descubrir.</h1><p>Una selección dinámica de artistas y comunidades. Las canciones cambian al actualizar y se reproducen dentro de Atlas mediante el reproductor oficial de YouTube.</p><div class="button-row"><a class="primary-button" href="#/discover?filter=music">Ver música en Shorts</a><button class="secondary-button" data-music-refresh>Nueva mezcla</button></div></header>
      <div id="music-content" class="music-grid">${root.library.empty("Preparando la selección", "Atlas está consultando los canales musicales.")}</div></section>`;
  }

  async function hydrateMusic() {
    const container = document.querySelector("#music-content");
    if (!container) return;
    try {
      const fallback = await window.AtlasRuntime.fetchJson("data/youtube-music-cache.json", { fresh: true });
      const payload = { ...fallback, items: [...(fallback.items || [])].sort(() => Math.random() - .5), total: fallback.items?.length || 0, refreshing: false };
      const disabled = new Set(root.storage.get().settings.disabledMusicChannels || []);
      container.innerHTML = (payload.items || []).filter(item => !disabled.has(item.source)).map(item => `<article class="music-card" data-play-youtube="${esc(item.videoId)}" data-video-title="${esc(item.title)}" data-video-url="${esc(item.url)}">
        <button class="music-cover" aria-label="Reproducir ${esc(item.title)}"><img src="${esc(item.image)}" alt="" loading="lazy"><span>▶</span></button>
        <div><span class="eyebrow">${esc(item.source)}</span><h2>${esc(item.title)}</h2><p>${esc(item.description || "Selección musical de Atlas.")}</p></div>
      </article>`).join("") || root.library.empty("Sin resultados", "Los canales no han devuelto piezas nuevas.");
      if (payload.refreshing && Number(container.dataset.refreshAttempts || 0) < 3) {
        container.dataset.refreshAttempts = String(Number(container.dataset.refreshAttempts || 0) + 1);
        setTimeout(hydrateMusic, 7000);
      }
    } catch {
      container.innerHTML = root.library.empty("Música temporalmente no disponible", "Vuelve a intentarlo cuando Atlas tenga conexión.");
    }
  }

  function renderGuide(initial = "") {
    return `<section class="page guide-page"><header class="explore-hero"><span class="eyebrow">Navegador de Atlas</span><h1>¿Dónde debería buscar esto?</h1><p>Esta guía no responde doctrinalmente. Solo señala bibliotecas, documentos, colecciones y preguntas con coincidencias en el catálogo.</p></header>
      <form class="guide-search" id="guide-form"><input id="guide-query" value="${esc(initial)}" autocomplete="off" placeholder="Ej.: matrimonio, Nicea, liturgia de las horas"><button class="primary-button">Orientarme</button></form>
      <div class="chip-row guide-examples">${["matrimonio","conciencia moral","san Agustín","nulidad","Misal Romano","Nicea"].map(text => `<button class="chip" data-guide-example="${text}">${text}</button>`).join("")}</div>
      <div id="guide-results">${initial ? guideResults(initial) : root.library.empty("Escribe un tema", "Atlas comparará el catálogo sin formular una respuesta doctrinal.")}</div></section>`;
  }

  function guideResults(query) {
    const normalized = root.data.normalize(query);
    if (!normalized) return root.library.empty("Escribe un tema", "Una palabra o una frase es suficiente.");
    const tokens = normalized.split(/\s+/).filter(token => token.length > 2);
    const intents = {
      doctrine: { terms: ["doctrina","dogma","moral","conciencia","pecado","virtud","bioetica","trinidad","cristo","fe","catecismo","revelacion","escritura","social"], reason: "El tema apunta a doctrina, teología, moral o interpretación del Catecismo." },
      canon: { terms: ["canon","canonico","derecho","nulidad","validez","licitud","dispensa","proceso","delito","pena","oficio","competencia","tribunal","impedimento"], reason: "La formulación contiene una cuestión jurídica, procesal o de validez." },
      history: { terms: ["historia","siglo","padres","padre","concilio","herejia","autor","biografia","nicea","trento","agustin","jeronimo","ambrosio","origenes"], reason: "La consulta pide contexto histórico, autores, concilios o Padres de la Iglesia." },
      liturgy: { terms: ["liturgia","misa","misal","rubrica","rito","celebracion","sacramento","sacramentos","horas","adviento","pascua","color","ministro","altar"], reason: "El vocabulario se refiere a celebración, ritos, sacramentos o libros litúrgicos." },
      ortodoxia: { terms: ["explica","comprender","argumento","objecion","dialogo","razon","sentido","por que"], reason: "La pregunta busca una explicación razonada y pedagógica antes de entrar en fuentes especializadas." },
      cinepilot: { terms: ["pelicula","cine","director","actor","genero","violencia","sensual","edad","estrellas","audiovisual"], reason: "La consulta pide identificar o valorar una película, su contenido y el público recomendado." },
      bibliotecaria: { terms: ["literatura","literario","poesia","novela","teatro","romanticismo","ilustracion","lectura","dramaturgia"], reason: "La consulta pide un recorrido literario, contexto histórico o recomendación de lectura." },
      clasicos: { terms: ["clasico","clasicos","obra","autor","leer","canon literario","tradicion cultural"], reason: "La pregunta busca una obra clásica, conexiones entre autores o una orientación de lectura." },
      "san-josemaria": { terms: ["josemaria","escriva","camino","surco","forja","trabajo","vida ordinaria","santificacion"], reason: "La consulta se refiere expresamente a san Josemaría o a sus enseñanzas sobre la vida ordinaria." }
    };
    const docs = root.data.documents.map(doc => {
      const haystack = root.data.normalize(`${doc.title} ${doc.category} ${doc.author || ""} ${doc.file}`);
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { doc, score };
    }).filter(item => item.score).sort((a, b) => b.score - a.score || b.doc.words - a.doc.words);
    const counts = new Map();
    docs.forEach(({ doc, score }) => counts.set(doc.libraryId, (counts.get(doc.libraryId) || 0) + score));
    Object.entries(root.data.catalog.editorial?.questions || {}).forEach(([libraryId, questions]) => {
      const questionScore = questions.reduce((sum, question) => {
        const text = root.data.normalize(question);
        return sum + tokens.reduce((tokenSum, token) => tokenSum + (text.includes(token) ? 2 : 0), 0);
      }, 0);
      if (questionScore) counts.set(libraryId, (counts.get(libraryId) || 0) + questionScore);
    });
    Object.entries(intents).forEach(([libraryId, intent]) => {
      const matches = intent.terms.filter(term => normalized.includes(term));
      if (matches.length) counts.set(libraryId, (counts.get(libraryId) || 0) + matches.length * 5);
    });
    if (normalized.includes("matrimonio")) {
      counts.set("doctrine", (counts.get("doctrine") || 0) + 3);
      counts.set("canon", (counts.get("canon") || 0) + (/(nulidad|validez|impedimento|proceso)/.test(normalized) ? 8 : 3));
      counts.set("liturgy", (counts.get("liturgy") || 0) + (/(rito|celebracion|liturgia)/.test(normalized) ? 6 : 1));
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({ lib: root.data.libraryMap.get(id), score })).filter(item => item.lib);
    const primary = ranked[0];
    const reason = intents[primary?.lib.id]?.reason || "Atlas ha encontrado más coincidencias en los títulos, temas y preguntas de esta biblioteca.";
    const confidence = primary && ranked[1] && primary.score < ranked[1].score * 1.35 ? "Consulta transversal" : "Mejor punto de partida";
    return ranked.length ? `<section class="guide-answer"><span class="eyebrow">Orientación inteligente local · ${confidence}</span><h2>Empieza por ${esc(primary.lib.short)}</h2><p>${esc(reason)} ${docs.length ? `Además, hay ${docs.length} documentos con coincidencias en el catálogo.` : "La recomendación procede del análisis de intención y las preguntas editoriales."}</p>
      ${ranked.length > 1 ? `<div class="guide-ranking">${ranked.slice(0, 4).map(({ lib, score }, index) => `<a href="#/library/${lib.id}/documents"><b>${index + 1}. ${esc(lib.short)}</b><span>${score} señales encontradas</span></a>`).join("")}</div>` : ""}
      <div class="button-row"><a class="primary-button" href="#/library/${primary.lib.id}/documents">Explorar ${esc(primary.lib.short)}</a>${ranked.slice(1, 4).map(({ lib }) => `<a class="secondary-button" href="#/library/${lib.id}/documents">${esc(lib.short)}</a>`).join("")}</div>
      ${docs.length ? `<div class="document-grid">${docs.slice(0, 12).map(({ doc }) => root.library.docCard(doc, doc.library)).join("")}</div>` : ""}
      <button class="primary-button guide-fulltext" data-guide-fulltext="${esc(query)}">Buscar “${esc(query)}” dentro de los documentos</button></section>` : `${root.library.empty(`No encontramos “${query}” en el catálogo`, "La búsqueda textual aún puede encontrarlo dentro del cuerpo de las fuentes.")}<button class="primary-button guide-fulltext" data-guide-fulltext="${esc(query)}">Buscar “${esc(query)}” dentro de los documentos</button>`;
  }

  function renderNotifications() {
    const settings = root.storage.get().notifications || {};
    const options = [
      ["daily", "Selección diaria", "Un documento o Short para volver a Atlas."],
      ["tenMinutes", "10 Minutos con Jesús", "Aviso diario a la hora elegida en Personalización."],
      ["reading", "Continúa leyendo", "Recordatorio de documentos empezados."],
      ["news", "Fuentes editoriales", "Aviso para revisar noticias y novedades."],
      ["routes", "Rutas de estudio", "Recordatorio de recorridos incompletos."],
      ["updates", "Actualizaciones de Atlas", "Cambios de versión y nuevos contenidos."]
    ];
    const permission = !("Notification" in window) ? "no disponible" : Notification.permission === "granted" ? "permitido" : Notification.permission === "denied" ? "bloqueado por el navegador" : "pendiente de permiso";
    return `<section class="page"><header class="explore-hero"><span class="eyebrow">Notificaciones</span><h1>Tú decides qué interrumpe.</h1><p>Las preferencias se guardan localmente. En una PWA estática los avisos funcionan mientras Atlas está abierto o activo; con la aplicación totalmente cerrada requieren un servidor push.</p><div class="button-row"><button class="primary-button" data-notification-permission>Activar permisos</button><button class="secondary-button" data-notification-test>Enviar prueba</button><span class="notification-permission">Estado: ${permission}</span></div></header><div class="notification-list">${options.map(([id,title,text]) => `<label class="notification-row"><span><b>${title}</b><small>${text}</small></span><input type="checkbox" data-notification="${id}" ${settings[id] ? "checked" : ""}></label>`).join("")}</div></section>`;
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-notification-permission]")) { root.requestNotificationPermission?.(); return; }
    if (event.target.closest("[data-notification-test]")) { root.sendAtlasNotification?.("Atlas · Prueba", "Las notificaciones están funcionando correctamente.", "#/notifications", "atlas-test"); return; }
    if (event.target.closest("[data-music-refresh]")) {
      const container = document.querySelector("#music-content");
      if (container) {
        container.dataset.refreshAttempts = "0";
        container.innerHTML = root.library.empty("Creando una mezcla nueva", "Barajando canciones y canales.");
        hydrateMusic();
      }
      return;
    }
    const zoom = event.target.closest("[data-graph-zoom]");
    const reset = event.target.closest("[data-graph-reset]");
    if (zoom || reset) {
      graphScale = reset ? 1 : Math.max(.55, Math.min(1.9, graphScale + Number(zoom.dataset.graphZoom)));
      const svg = document.querySelector(".graph-workspace .nodegraph-svg");
      if (svg) svg.style.transform = `scale(${graphScale})`;
      if (reset) document.querySelector(".graph-workspace")?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
      const label = document.querySelector("[data-graph-reset]");
      if (label) label.textContent = `${Math.round(graphScale * 100)}%`;
    }
    const yearButton = event.target.closest("[data-timeline-year]");
    if (yearButton) {
      const year = Number(yearButton.dataset.timelineYear);
      const docs = root.data.documents.filter(doc => String(doc.year || "").match(new RegExp(`\\b${year}\\b`)));
      document.querySelector("#timeline-detail").innerHTML = timelineGroup(year, docs);
    }
    const placeButton = event.target.closest("[data-map-place]");
    if (placeButton) document.querySelector("#map-detail").innerHTML = placeDetail(places.find(place => place.id === placeButton.dataset.mapPlace));
    const example = event.target.closest("[data-guide-example]");
    if (example) {
      document.querySelector("#guide-query").value = example.dataset.guideExample;
      document.querySelector("#guide-results").innerHTML = guideResults(example.dataset.guideExample);
    }
    const fulltext = event.target.closest("[data-guide-fulltext]");
    if (fulltext) root.openAtlasSearch?.(fulltext.dataset.guideFulltext, true);
  });

  document.addEventListener("submit", event => {
    if (event.target.id !== "guide-form") return;
    event.preventDefault();
    const query = document.querySelector("#guide-query").value.trim();
    document.querySelector("#guide-results").innerHTML = guideResults(query);
  });

  document.addEventListener("change", async event => {
    if (!event.target.dataset.notification) return;
    const enabled = event.target.checked;
    if (enabled && "Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") event.target.checked = false;
    }
    root.storage.setNotification(event.target.dataset.notification, event.target.checked);
    root.appToast?.("Preferencia de notificación guardada.");
  });

  root.extras = { renderTimeline, renderMap, renderGraph, renderSources, renderMusic, hydrateMusic, renderGuide, renderNotifications };
})();
