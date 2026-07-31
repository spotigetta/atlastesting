(function () {
  "use strict";
  const A = window.Atlas;
  const app = document.querySelector("#main");
  const searchSheet = document.querySelector("#search-sheet");
  const searchInput = document.querySelector("#global-search");
  const searchResults = document.querySelector("#search-results");
  const detailLayer = document.querySelector("#detail-layer");
  const detailContent = document.querySelector("#detail-content");
  const shareLayer = document.querySelector("#share-layer");
  const settingsLayer = document.querySelector("#settings-layer");
  const tutorialLayer = document.querySelector("#tutorial-layer");
  const tutorialContent = document.querySelector("#tutorial-content");
  const tutorialProgress = document.querySelector("#tutorial-progress");
  const tutorialSpotlight = document.querySelector("#tutorial-spotlight");
  const fullTextStatus = document.querySelector("#fulltext-status");
  const placeholders = ["Misal Romano", "San Agustín", "canon 212", "matrimonio", "Vaticano II", "0348"];
  const state = {
    previousRoute: "/",
    library: { query: "", category: "all", status: "all", view: "cards" },
    compare: ["doctrine", "canon"],
    searchFilter: "all",
    shortFilter: "all",
    savedTab: "documents"
  };
  let libraryTimer;
  let recognition;
  let sharePayload = null;
  let tutorialIndex = 0;
  let routeTransitioning = false;
  const personalizationDefaults = {
    magnetEnabled:true, magnetStrength:34, magnetDelay:120, magnetDuration:300,
    auroraIntensity:88, auroraSize:100, motionLevel:100, josemariaPortraitIntensity:18, shortTextScale:100,
    shortContentWidth:720, shortAlignment:"mixed", interfaceScale:100,
    cornerRadius:100, fontStyle:"editorial", compactMode:false, showExternalImages:true
  };
  const libraryGuides = {
    doctrine: { file: "infodoctrina_textogrande.html", purpose: "Aclara qué enseña la Iglesia y cómo se fundamenta en Escritura, Tradición, Magisterio, teología y moral.", examples: ["¿Qué enseña el Catecismo sobre la conciencia?", "Distingue doctrina definida, opinión teológica y criterio pastoral."] },
    canon: { file: "infografiaCanonIA_v2.html", purpose: "Localiza normas, cánones, procesos y criterios interpretativos del Derecho de la Iglesia.", examples: ["¿Qué diferencia hay entre validez y licitud?", "¿Qué fuentes regulan un proceso matrimonial?"] },
    history: { file: "infohistoria.html", purpose: "Sitúa acontecimientos, concilios, autores y Padres de la Iglesia en su contexto y conecta fuentes de distintas épocas.", examples: ["¿Qué ocurrió entre Nicea y Constantinopla?", "Compara a san Ireneo y san Agustín."] },
    liturgy: { file: "infografiaLiturgIA_v2.html", purpose: "Explica el sentido teológico de la celebración y consulta libros, normas, ritos y desarrollo histórico.", examples: ["¿Qué significa este gesto de la Misa?", "¿Qué indican el Misal y la IGMR?"] },
    ortodoxia: { file: "infoCirculos.html", purpose: "Ayuda a comprender la lógica interna de la fe con lenguaje razonado antes de acudir a fuentes especializadas.", examples: ["Explica esta objeción sin caricaturizarla.", "¿Qué presupuestos conviene distinguir?"] },
    cinepilot: { file: "infografiaCinepilot.html", purpose: "Consulta películas por ficha técnica, calidad artística, edad, contenido y orientación moral.", examples: ["¿Es adecuada para adolescentes?", "Compara dos películas por temas y tratamiento."] },
    bibliotecaria: { file: "infobib.html", purpose: "Descubre libros y diseña recorridos literarios por autores, géneros, épocas, temas o nivel lector.", examples: ["Haz una ruta por la novela rusa.", "¿Qué leer después de esta obra?"] },
    clasicos: { file: "infografiaLosClasicos_v2.html", purpose: "Explora el canon literario, consulta obras completas y relaciona grandes autores y tradiciones.", examples: ["Compara la tragedia griega y Shakespeare.", "Propón cinco clásicos sobre libertad."] },
    "san-josemaria": { file: "infoSJM.html", purpose: "Profundiza en sus obras y enseñanzas sobre oración, trabajo, libertad y santidad cotidiana.", examples: ["Busca textos sobre santificar el trabajo.", "Relaciona Camino, Surco y Forja sobre la alegría."] }
  };
  const tutorialSteps = [
    { mark: "A", route: "/", target: ".brand", eyebrow: "Primero · qué es", title: "Atlas es la puerta de entrada a tus IA", text: "Reúne fuentes, organiza bibliotecas y te ayuda a decidir dónde leer o qué IA consultar. No sustituye los documentos ni inventa una respuesta.", bullets: ["Ejemplo: busca «matrimonio» y compara doctrina, Derecho e historia.", "El logotipo siempre devuelve al Inicio."] },
    { mark: "↳", route: "/", target: ".home-hero", eyebrow: "Cómo se usa", title: "Buscar, descubrir y profundizar", text: "Puedes empezar con una pregunta, dejarte sorprender por una tarjeta o entrar directamente en una biblioteca.", bullets: ["Buscar: localiza fuentes y texto literal.", "Descubrir: frases, vídeos, hechos y preguntas.", "Profundizar: lector, notas, rutas y grafos."] },
    { mark: "MD", route: "/", target: '[data-home-block="libraries"]', eyebrow: "Cómo se construye", title: "Las carpetas son la base de datos", text: "Cada carpeta NN_IA_Nombre se convierte en una biblioteca. Al añadir o retirar Markdown, Atlas reconstruye catálogo, lector y buscador.", bullets: ["No necesitas editar HTML ni JSON.", "Ejemplo: 10_IA_FilosofIA aparece al siguiente arranque."] },
    { mark: "?", route: "/", target: ".help-button", eyebrow: "Ayuda permanente", title: "Repite la visita cuando quieras", text: "El botón de ayuda vuelve a iniciar este recorrido guiado desde cualquier pantalla.", bullets: ["También puedes buscar «cómo usar Atlas».", "El círculo luminoso señala el control explicado."] },
    { mark: "⌕", route: "/", target: '.header-tools [data-action="search"]', eyebrow: "Búsqueda", title: "Busca en todo Atlas", text: "Abre el buscador de títulos, autores, categorías y texto literal dentro de los documentos.", bullets: ["Ejemplo: «matrimonio» o «san Agustín».", "Ctrl K abre la búsqueda desde un teclado."] },
    { mark: "◐", route: "/", target: '.header-tools [data-action="theme"]', eyebrow: "Apariencia", title: "Cambia el modo de lectura", text: "Este botón alterna el tema claro, oscuro y el del sistema.", bullets: ["El contraste puede ajustarse también en Guardados.", "El lector conserva sus propios controles tipográficos."] },
    { mark: "⌕", route: "/", open: "search", target: ".search-input-wrap", eyebrow: "Buscador · controles", title: "Escribe, dicta o cierra", text: "El campo acepta texto libre; el micrófono permite dictarlo cuando el navegador ofrece reconocimiento de voz.", bullets: ["Los filtros reducen resultados por biblioteca.", "«Cerrar» devuelve a la pantalla anterior."] },
    { mark: "TXT", route: "/", open: "search", target: ".fulltext-bar", eyebrow: "Buscador · texto e IA", title: "Dos búsquedas muy diferentes", text: "«Buscar dentro» localiza la expresión literal en el cuerpo; «¿A qué IA?» interpreta la intención y recomienda dónde preguntar.", bullets: ["Ejemplo literal: «salus animarum».", "Ejemplo orientativo: «¿cómo se declara una nulidad?»"] },
    { mark: "⌕", route: "/", target: ".hero-search", eyebrow: "Inicio · buscador", title: "Una entrada directa al corpus", text: "La barra grande abre la búsqueda global y propone ejemplos para empezar.", bullets: ["Busca números de catálogo, títulos o preguntas.", "Activa «buscar dentro de documentos» para coincidencia literal."] },
    { mark: "✦", route: "/", target: '[data-home-block="today"]', eyebrow: "Inicio · Atlas Hoy", title: "Una selección nueva cada día", text: "Aquí aparecen documento, descubrimiento, frase célebre y pregunta del día.", bullets: ["La selección cambia con la fecha.", "Puedes subir o bajar este bloque desde «Personalizar Inicio»."] },
    { mark: "IA", route: "/", target: '[data-home-block="libraries"]', eyebrow: "Inicio · Bibliotecas", title: "Entra en una IA", text: "Cada tarjeta muestra tamaño, categorías y acceso a sus fuentes o a su cuaderno.", bullets: ["Explorar fuentes abre Atlas.", "Abrir IA lleva al Notebook configurado."] },
    { mark: "B", route: `/library/${A.data.catalog.libraries[0]?.id || "doctrine"}/documents`, target: ".library-tabs", eyebrow: "Biblioteca · secciones", title: "Cambia de vista sin perder la IA", text: "Las pestañas abren documentos, mapa, preguntas, autores y estadísticas de la biblioteca seleccionada.", bullets: ["La barra inferior filtra y ordena fuentes.", "Cada ficha permite leer, guardar, compartir o abrir la IA."] },
    { mark: "L", route: `/reader/${encodeURIComponent(A.data.documents[0]?.id || "")}`, target: ".reader-tools", eyebrow: "Lector · herramientas", title: "Lee como en un libro de estudio", text: "La barra reúne esquema, búsqueda, subrayado, nota y marcador.", bullets: ["El esquema muestra hasta cuatro niveles.", "Los ajustes cambian letra, tamaño y anchura de columna."] },
    { mark: "◇", route: "/explore", target: ".explore-grid", eyebrow: "Explorar", title: "Doce formas de entrar en el conocimiento", text: "Colecciones, rutas, mapas, comparación, cronología y noticias ofrecen perspectivas distintas.", bullets: ["Pulsa «Personalizar botones» para reordenarlos.", "Cada botón puede tener su propio color."] },
    { mark: "◎", route: "/graph", target: ".graph-workspace", eyebrow: "Grafos", title: "Mira la estructura y las conexiones", text: "Un grafo muestra IA, categorías y fuentes por niveles; el otro cruza documentos relacionados.", bullets: ["Pulsa cualquier nodo para abrirlo.", "Usa +, − y centrar para inspeccionar nombres largos."] },
    { mark: "✦", route: "/discover", target: ".short-filters", eyebrow: "Descubrir", title: "Filtra el feed vivo", text: "Los filtros separan frases, hechos, anécdotas, oración, noticias, IA y formatos.", bullets: ["Las frases de san Josemaría llegan aleatoriamente de escriva.org.", "Guarda, comparte o abre la fuente original."] },
    { mark: "⇄", route: "/compare", target: ".compare-select", eyebrow: "Comparar", title: "Cruza varias bibliotecas", text: "Selecciona IA para descubrir coincidencias y diferencias de catálogo.", bullets: ["Puedes comparar hasta cuatro.", "Las coincidencias proceden de títulos normalizados."] },
    { mark: "★", route: "/saved", target: ".saved-tabs", eyebrow: "Guardados", title: "Tu actividad queda reunida", text: "Aquí vuelves a documentos, Shorts, colecciones, rutas y preguntas guardadas.", bullets: ["También encontrarás progreso y estadísticas de estudio.", "Puedes exportar o importar tus datos locales."] }
  ];

  tutorialSteps.splice(11, 0, ...A.data.catalog.libraries.map(lib => {
    const guide = libraryGuides[lib.id];
    return {
      mark: lib.mark, route: "/", target: `[data-library="${lib.id}"]`,
      eyebrow: `IA · ${lib.short}`, title: `Para qué sirve ${lib.short}`,
      text: guide?.purpose || lib.description,
      bullets: guide?.examples || ["Explora sus fuentes y formula preguntas concretas.", "Comprueba la respuesta en los documentos citados."],
      infographic: guide?.file, libraryId: lib.id
    };
  }));
  tutorialSteps.splice(20, 0, {
    mark: "▣", route: "/infographics", target: ".ia-guide-grid",
    eyebrow: "Guía visual", title: "Resúmenes e infografías siempre accesibles",
    text: "Esta galería reúne para qué sirve cada IA, ejemplos de preguntas y la pieza visual original completa.",
    bullets: ["Las vistas previas ayudan a reconocer rápidamente cada cuaderno.", "«Infografía completa» abre el diseño original sin reducirlo.", "Las nueve piezas se sincronizan desde infografiasfinal al actualizar Atlas."]
  });
  tutorialSteps.splice(-1, 0, {
    mark: "♫", route: "/music", target: ".music-page",
    eyebrow: "Música", title: "Canciones que cambian con cada mezcla",
    text: "Atlas consulta nueve canales, baraja las canciones y permite escucharlas sin abandonar la aplicación.",
    bullets: ["«Nueva mezcla» cambia el orden inmediatamente.", "El filtro Música las presenta también como Shorts.", "Si la actualización tarda, Atlas usa la última selección guardada y continúa en segundo plano."]
  });

  function esc(value) { return A.library.esc(value); }
  const infographicUrl = file => window.AtlasRuntime.url(`assets/infografias/${encodeURIComponent(file)}`);
  function tutorialMiniInfographic(step) {
    const lib = A.data.libraryMap.get(step.libraryId);
    const guide = libraryGuides[step.libraryId];
    if (!lib || !guide) return "";
    return `<div class="tutorial-mini-infographic mini-${esc(lib.id)}">
      <header><span class="mini-mark">${esc(lib.mark)}</span><span><small>Atlas · guía esencial</small><b>${esc(lib.short)}</b></span></header>
      <div class="mini-purpose">${esc(guide.purpose)}</div>
      <div class="mini-infographic-grid"><section><small>Úsala para</small>${guide.examples.map((item,index) => `<p><i>0${index + 1}</i>${esc(item)}</p>`).join("")}</section><section><small>Su base documental</small><strong>${lib.stats.documents}</strong><span>fuentes · ${lib.stats.categories} áreas</span><em>Pregunta con precisión y comprueba las citas.</em></section></div>
      <footer><span>Resumen visual adaptado</span><button class="secondary-button" data-open-infographic="${esc(guide.file)}" data-infographic-title="${esc(lib.short)}" data-infographic-tone="${esc(lib.tone)}">Componer infografía completa</button></footer>
    </div>`;
  }
  function route() { return A.router.parse(); }
  function daySeed() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }
  function dailyPick(items, offset = 0) { return items.length ? items[(daySeed() + offset) % items.length] : null; }

  function renderTutorialStep() {
    const step = tutorialSteps[tutorialIndex];
    if (step.route && location.hash !== `#${step.route}`) location.hash = step.route;
    if (step.open === "search") setTimeout(() => openSearch(), 40);
    else closeSearch();
    tutorialLayer.classList.toggle("has-infographic", Boolean(step.infographic));
    tutorialContent.innerHTML = `<div class="tutorial-visual"><span class="tutorial-glyph">${step.mark}</span></div><div class="tutorial-copy"><span class="eyebrow">${step.eyebrow}</span><h2 id="tutorial-title">${step.title}</h2><p>${step.text}</p><ul>${step.bullets.map(item => `<li>${item}</li>`).join("")}</ul>${step.infographic ? tutorialMiniInfographic(step) : ""}</div>`;
    tutorialContent.style.setProperty("--tutorial-progress", `${Math.round((tutorialIndex + 1) / tutorialSteps.length * 100)}%`);
    tutorialProgress.textContent = `${tutorialIndex + 1} de ${tutorialSteps.length}`;
    tutorialLayer.querySelector('[data-action="tutorial-previous"]').disabled = tutorialIndex === 0;
    tutorialLayer.querySelector('[data-action="tutorial-next"]').textContent = tutorialIndex === tutorialSteps.length - 1 ? "Empezar" : "Siguiente";
    setTimeout(() => positionTutorialSpotlight(step), 180);
  }

  function positionTutorialSpotlight(step, attempt = 0) {
    const target = step.target ? document.querySelector(step.target) : null;
    if (!target) {
      tutorialSpotlight.hidden = true;
      if (attempt < 8) setTimeout(() => positionTutorialSpotlight(step, attempt + 1), 250);
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const pad = 9;
      tutorialSpotlight.hidden = false;
      tutorialSpotlight.style.left = `${Math.max(5, rect.left - pad)}px`;
      tutorialSpotlight.style.top = `${Math.max(5, rect.top - pad)}px`;
      tutorialSpotlight.style.width = `${Math.min(innerWidth - 10, rect.width + pad * 2)}px`;
      tutorialSpotlight.style.height = `${Math.min(innerHeight - 10, rect.height + pad * 2)}px`;
    }, 220);
  }

  function openTutorial(index = 0) {
    tutorialIndex = Math.max(0, Math.min(tutorialSteps.length - 1, index));
    renderTutorialStep();
    tutorialLayer.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeTutorial() {
    tutorialLayer.hidden = true;
    tutorialSpotlight.hidden = true;
    A.storage.setSetting("tutorialSeen", true);
    if (searchSheet.hidden && detailLayer.hidden && shareLayer.hidden) document.body.classList.remove("modal-open");
  }

  function renderHome() {
    const catalog = A.data.catalog;
    const settings = A.storage.get().settings;
    const homeBlocks = ["today", "libraries", "reading", "history"];
    const homeOrder = [...new Set([...(settings.homeOrder || []), ...homeBlocks])].filter(id => homeBlocks.includes(id));
    const homeLabels = { today: "Atlas Hoy", libraries: "Explora las IA", reading: "Continúa leyendo", history: "Continúa explorando" };
    const todayDoc = dailyPick(A.data.documents.filter(doc => doc.status !== "incomplete"), 3);
    const todayShort = dailyPick(catalog.shorts.filter(item => item.verified), 7);
    const todayQuote = dailyPick([
      ...catalog.shorts.filter(item => item.verified && item.type === "quote"),
      ...(window.ATLAS_QUOTES?.items || []),
      ...(window.ATLAS_EXTERNAL?.items || []).filter(item => item.type === "quote").map(item => ({ ...item, text: item.description, reference: item.source }))
    ], 19);
    const uniqueDocs = A.data.documents.filter(doc => A.data.documents.filter(other => A.data.normalize(other.title) === A.data.normalize(doc.title)).length === 1);
    const quizDoc = dailyPick(uniqueDocs, 11);
    const history = A.storage.get().history.map(id => A.data.documentMap.get(id)).filter(Boolean).slice(0, 4);
    const lastLib = A.data.libraryMap.get(A.storage.get().lastLibrary);
    const reading = Object.entries(A.storage.get().readerProgress || {})
      .map(([id, progress]) => ({ doc: A.data.documentMap.get(id), progress }))
      .filter(item => item.doc)
      .sort((a, b) => Date.parse(b.progress.updatedAt || 0) - Date.parse(a.progress.updatedAt || 0))
      .slice(0, 3);
    return `<section class="page home-page">
      <div class="home-hero">
        <div><span class="eyebrow">Atlas · Mercabá</span><h1>${catalog.libraries.length} bibliotecas.<br>Miles de fuentes.</h1></div>
        <p>Descubre qué sabe cada IA, qué documentos contiene y qué puedes preguntarle.</p>
        <div class="hero-search"><button data-action="search">${A.library.icon("search")}<span id="hero-placeholder">Busca “${placeholders[daySeed() % placeholders.length]}”</span><kbd>Ctrl K</kbd></button></div>
        <button class="customize-trigger subtle" data-action="customize-home" title="Cambiar el orden de Inicio">↕ Personalizar</button>
      </div>

      ${settings.customizeHome ? `<section class="customize-panel" style="order:.5"><span class="eyebrow">Orden de Inicio</span><h2>Organiza todos los bloques</h2>${homeOrder.map((id,index) => `<div class="customize-row"><b>${homeLabels[id]}</b><span><button data-home-move="${id}" data-direction="-1" ${index===0?"disabled":""}>↑</button><button data-home-move="${id}" data-direction="1" ${index===homeOrder.length-1?"disabled":""}>↓</button></span></div>`).join("")}</section>` : ""}

      <section class="section" data-home-block="today" style="order:${homeOrder.indexOf("today") + 1}"><div class="section-head"><div><h2>Atlas Hoy</h2><p>Una selección diaria calculada en tu dispositivo.</p></div><a href="#/discover">Ver Shorts</a></div>
        <div class="daily-strip">
          ${todayDoc ? `<article class="daily-card tone-${todayDoc.library.tone}" data-library="${todayDoc.libraryId}"><span class="eyebrow">Documento del día · ${esc(todayDoc.library.short)}</span><h3>${esc(todayDoc.title)}</h3><p>${A.library.compact(todayDoc.words)} palabras · ${esc(todayDoc.category)}</p><button class="ghost-button" data-open-document="${esc(todayDoc.id)}" style="margin-top:15px">Abrir ficha</button></article>` : ""}
          ${todayShort ? `<article class="daily-card"><span class="eyebrow">Descubrimiento del día</span><h3>${esc(todayShort.title)}</h3><p>${esc(todayShort.text)}</p><a class="ghost-button" href="#/short/${todayShort.id}" style="margin-top:15px">Ver contenido</a></article>` : ""}
          ${todayQuote ? `<article class="daily-card daily-quote"><span class="eyebrow">Frase célebre del día</span><h3>${esc(todayQuote.title)}</h3><p>${esc(todayQuote.text || todayQuote.description || "")}</p><small>${esc(todayQuote.reference || todayQuote.source || "")}</small></article>` : ""}
          ${quizDoc ? `<article class="daily-card tone-${quizDoc.library.tone}" data-library="${quizDoc.libraryId}"><span class="eyebrow">Pregunta del día</span><h3>¿En qué biblioteca aparece «${esc(quizDoc.title)}»?</h3><div class="button-row">${catalog.libraries.map(lib => `<button class="ghost-button" data-quiz-answer="${lib.id}" data-quiz-correct="${quizDoc.libraryId}">${esc(lib.short)}</button>`).join("")}</div></article>` : ""}
        </div>
      </section>

      <section class="section" data-home-block="libraries" style="order:${homeOrder.indexOf("libraries") + 1}"><div class="section-head"><div><h2>Explora las IA</h2><p>Fuentes reales extraídas de sus carpetas.</p></div></div><div class="library-deck">${catalog.libraries.map(libraryCard).join("")}</div><div class="section-head ia-guide-heading"><div><h2>Guía visual de cada IA</h2><p>Resumen práctico e infografía completa siempre disponibles.</p></div><a href="#/infographics">Ver las nueve</a></div><div class="ia-guide-strip">${catalog.libraries.map(lib => guideCard(lib)).join("")}</div></section>

      ${reading.length ? `<section class="section" data-home-block="reading" style="order:${homeOrder.indexOf("reading") + 1}"><div class="section-head"><div><h2>Continúa leyendo</h2><p>Retoma cada fuente exactamente donde la dejaste.</p></div><a href="#/saved">Ver actividad</a></div><div class="continue-reading-grid">${reading.map(item => readingItem(item.doc, item.progress)).join("")}</div></section>` : ""}

      ${(history.length || lastLib) ? `<section class="section" data-home-block="history" style="order:${homeOrder.indexOf("history") + 1}"><div class="section-head"><div><h2>Continúa explorando</h2><p>Actividad guardada solo en este dispositivo.</p></div><a href="#/saved">Ver historial</a></div><div style="display:grid;gap:9px">
        ${lastLib ? continueItem(lastLib, `#/library/${lastLib.id}/documents`, "Última biblioteca visitada") : ""}
        ${history.map(doc => continueItem(doc.library, `#/document/${doc.id}`, doc.title)).join("")}
      </div></section>` : ""}
    </section>`;
  }

  function libraryCard(lib) {
    const guide = libraryGuides[lib.id];
    return `<article class="library-card tone-${lib.tone}" data-library="${lib.id}">
      <div class="library-top"><span class="library-mark">${lib.mark}</span><span class="eyebrow">${lib.stats.categories} categorías</span></div>
      <h3>${esc(lib.short)}</h3><p>${esc(lib.description)}</p>
      ${guide ? `<details class="library-purpose"><summary>¿Para qué sirve?</summary><p>${esc(guide.purpose)}</p><ul>${guide.examples.map(item => `<li>${esc(item)}</li>`).join("")}</ul><button class="text-button" data-open-infographic="${esc(guide.file)}" data-infographic-title="${esc(lib.short)}" data-infographic-tone="${esc(lib.tone)}">Ver infografía completa ↗</button></details>` : ""}
      <div class="mini-stats"><div><b>${lib.stats.documents}</b><span>Documentos</span></div><div><b>${A.library.compact(lib.stats.words)}</b><span>Palabras</span></div><div><b>${lib.stats.authors}</b><span>Autores</span></div></div>
      <div class="library-actions"><a class="secondary-button" href="#/library/${lib.id}/documents">Explorar fuentes</a>${A.library.notebookButton(lib, "Abrir IA")}</div>
    </article>`;
  }

  function guideCard(lib, full = false) {
    const guide = libraryGuides[lib.id];
    if (!guide) return "";
    return `<article class="ia-guide-card tone-${lib.tone}" data-library="${lib.id}">
      <div class="ia-guide-preview"><iframe src="${infographicUrl(guide.file)}" title="Vista previa de ${esc(lib.short)}" loading="lazy" tabindex="-1"></iframe><span class="library-mark">${esc(lib.mark)}</span></div>
      <div class="ia-guide-copy"><span class="eyebrow">${esc(lib.short)}</span><h3>¿Para qué sirve?</h3><p>${esc(guide.purpose)}</p>${full ? `<ul>${guide.examples.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}<div class="button-row"><button class="secondary-button" data-open-infographic="${esc(guide.file)}" data-infographic-title="${esc(lib.short)}" data-infographic-tone="${esc(lib.tone)}">Infografía completa</button><a class="ghost-button" href="#/library/${lib.id}/documents">Ver fuentes</a></div></div>
    </article>`;
  }

  function renderInfographics() {
    return `<section class="page infographic-library"><header class="explore-hero"><span class="eyebrow">Guía visual</span><h1>Qué puede hacer cada IA.</h1><p>Lee el resumen operativo o abre la infografía original completa. Estas copias se sincronizan automáticamente desde <code>infografiasfinal</code>.</p></header><div class="ia-guide-grid">${A.data.catalog.libraries.map(lib => guideCard(lib, true)).join("")}</div></section>`;
  }

  function continueItem(lib, href, label) {
    return `<a class="continue-card tone-${lib.tone}" data-library="${lib.id}" href="${href}"><span class="library-mark">${lib.mark}</span><span><h3>${esc(label)}</h3><p>${esc(lib.short)}</p></span>${A.library.icon("arrow")}</a>`;
  }

  function readingItem(doc, progress) {
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
    return `<a class="reading-card tone-${doc.library.tone}" data-library="${doc.libraryId}" href="#/reader/${encodeURIComponent(doc.id)}">
      <span class="eyebrow">${esc(doc.library.short)} · ${percent}% leído</span>
      <h3>${esc(doc.title)}</h3>
      <div class="progress"><span style="width:${percent}%"></span></div>
      <p>${progress.chunkIndex ? `Fragmento ${progress.chunkIndex + 1}` : "Desde el comienzo"} · ${Math.max(1, Math.ceil(doc.words / 230))} min</p>
    </a>`;
  }

  function renderExplore() {
    const catalog = A.data.catalog;
    const settings = A.storage.get().settings;
    const tiles = [
      ["libraries","books", "Bibliotecas", `${catalog.libraries.length} IA y todos sus documentos`, "#/explore?section=libraries"],
      ["infographics","books", "Guía visual de las IA", "Resúmenes e infografías completas", "#/infographics"],
      ["collections","grid", "Colecciones", `${catalog.collections.length} colecciones desde mapas temáticos`, "#/collections"],
      ["routes","compass", "Rutas", `${catalog.routes.length} recorridos verificables`, "#/routes"],
      ["discover","spark", "Descubrir", "Shorts documentados y contenido diario", "#/discover"],
      ["stats","theme", "Estadísticas", "Siete visualizaciones por biblioteca", `#/library/${catalog.libraries[0].id}/stats`],
      ["compare","search", "Comparar", "Coincidencias y diferencias entre IA", "#/compare"],
      ["timeline","clock", "Cronología viva", "Autores, concilios y documentos fechados", "#/timeline"],
      ["map","compass", "Mapa mundial", "Roma, Hipona, Nicea, Trento, Toledo y Jerusalén", "#/map"],
      ["graph","grid", "Mapa de relaciones", "Documentos, autores, categorías e IA conectados", "#/graph"],
      ["guide","search", "¿Dónde buscar?", "Atlas orienta sin responder doctrinalmente", "#/guide"],
      ["sources","spark", "Noticias y lecturas", "Medios, opinión, oración y novedades editoriales", "#/sources"],
      ["music","spark", "Música", "Canciones, oración cantada y artistas seleccionados", "#/music"],
      ["notifications","bookmark", "Notificaciones", "Avisos configurables y guardados localmente", "#/notifications"]
    ];
    const order = settings.exploreOrder?.length ? settings.exploreOrder : tiles.map(item => item[0]);
    const ordered = [...tiles].sort((a,b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    const tones = ["amber","blue","clay","violet","emerald","rose","indigo","gold","cyan","olive","burgundy","slate"];
    const groups = [
      ["Bibliotecas y estudio", "Elige un corpus o sigue un recorrido.", ["libraries","infographics","collections","routes","guide"]],
      ["Descubrir y actualidad", "Contenido vivo, lecturas y propuestas para volver cada día.", ["discover","sources","music","notifications"]],
      ["Mapas y análisis", "Compara, sitúa y visualiza las conexiones.", ["stats","compare","timeline","map","graph"]]
    ];
    return `<section class="page"><header class="explore-hero"><span class="eyebrow">Explorar</span><h1>El conocimiento, desde varios ángulos.</h1><p>No tienes que empezar por una lista. Entra por una biblioteca, una colección, una ruta o una visualización.</p><button class="customize-trigger" data-action="customize-explore">Personalizar botones</button></header>
      ${settings.customizeExplore ? `<section class="customize-panel"><span class="eyebrow">Tu espacio</span><h2>Ordena y colorea Explorar</h2>${ordered.map(([id,,title],index) => `<div class="customize-row"><b>${title}</b><span><button data-explore-move="${id}" data-direction="-1" ${index===0?"disabled":""}>↑</button><button data-explore-move="${id}" data-direction="1" ${index===ordered.length-1?"disabled":""}>↓</button><select data-explore-color="${id}">${tones.map(tone=>`<option value="${tone}" ${(settings.exploreColors?.[id] || tones[index%tones.length])===tone?"selected":""}>${tone}</option>`).join("")}</select></span></div>`).join("")}</section>` : ""}
      <div class="explore-panels">${groups.map(([title,intro,ids]) => `<section class="explore-panel"><header><span class="eyebrow">${title}</span><p>${intro}</p></header><div class="explore-grid">${ordered.filter(([id]) => ids.includes(id)).map(([id,icon,tileTitle,text,href],index) => `<a class="explore-tile tone-${settings.exploreColors?.[id] || tones[(ordered.findIndex(item => item[0] === id) + index)%tones.length]}" data-explore-id="${id}" href="${href}">${A.library.icon(icon)}<h3>${tileTitle}</h3><p>${text}</p></a>`).join("")}</div></section>`).join("")}</div>
      <section class="section" id="explore-libraries"><div class="section-head"><div><h2>Bibliotecas</h2><p>Elige el corpus desde el que quieres comenzar.</p></div></div><div class="library-deck">${catalog.libraries.map(libraryCard).join("")}</div></section>
    </section>`;
  }

  function renderCollections() {
    return `<section class="page"><header class="explore-hero"><span class="eyebrow">Colecciones</span><h1>Áreas para descubrir.</h1><p>Cada colección procede directamente de un mapa temático de los índices.</p></header><div class="collection-grid">${A.data.catalog.collections.map(collection => {
      const lib = A.data.libraryMap.get(collection.libraryIds[0]);
      const saved = A.storage.isFavorite("collections", collection.id);
      return `<article class="collection-card tone-${lib.tone}" data-library="${lib.id}"><span class="eyebrow">${esc(lib.short)}</span><h3>${esc(collection.title)}</h3><p>${esc(collection.description)}</p><div class="collection-meta"><span>${collection.documentIds.length} documentos enlazados</span><span>Verificada</span></div><div class="button-row"><a class="secondary-button" href="#/collection/${collection.id}">Abrir colección</a><button class="icon-button ${saved ? "saved" : ""}" data-save-collection="${collection.id}" aria-label="Guardar">${A.library.icon("bookmark")}</button></div></article>`;
    }).join("")}</div></section>`;
  }

  function renderCollection(id) {
    const collection = A.data.catalog.collections.find(item => item.id === id);
    if (!collection) return notFound();
    const lib = A.data.libraryMap.get(collection.libraryIds[0]);
    const docs = collection.documentIds.map(docId => A.data.documentMap.get(docId)).filter(Boolean);
    return `<section class="page tone-${lib.tone}" data-library="${lib.id}"><header class="explore-hero"><span class="eyebrow">${esc(lib.short)} · Colección temática</span><h1>${esc(collection.title)}</h1><p>${esc(collection.description)}</p><div class="button-row"><button class="secondary-button" data-save-collection="${collection.id}">Guardar colección</button>${A.library.notebookButton(lib, `Abrir ${lib.short}`)}</div></header><div class="topic-card" style="margin-bottom:20px"><div class="topic-body" style="padding-top:18px"><div class="source-block"><b>Fuentes principales</b><p>${esc(collection.primary)}</p></div><div class="source-block"><b>Complementarias</b><p>${esc(collection.complementary)}</p></div></div></div><div class="document-grid">${docs.map(doc => A.library.docCard(doc, lib)).join("") || A.library.empty("Sin enlaces directos", "El mapa cita fuentes que no han podido enlazarse automáticamente.")}</div></section>`;
  }

  function renderRoutes() {
    return `<section class="page"><header class="explore-hero"><span class="eyebrow">Rutas de aprendizaje</span><h1>Recorridos que puedes continuar.</h1><p>El orden sigue las fuentes principales y complementarias consignadas en los mapas temáticos.</p></header><div class="route-grid">${A.data.catalog.routes.map(routeCard).join("")}</div></section>`;
  }

  function routeCard(item) {
    const lib = A.data.libraryMap.get(item.libraryIds[0]);
    const complete = A.storage.get().routeProgress[item.id]?.length || 0;
    const percent = Math.round(complete / item.steps.length * 100);
    return `<article class="route-card tone-${lib.tone}" data-library="${lib.id}"><span class="eyebrow">${esc(lib.short)}</span><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><div class="collection-meta"><span>${item.steps.length} pasos</span><span>${percent}% completado</span></div><div class="progress"><span style="width:${percent}%"></span></div><a class="secondary-button" href="#/route/${item.id}" style="margin-top:14px;width:100%">${percent ? "Continuar ruta" : "Comenzar"}</a></article>`;
  }

  function renderRoute(id) {
    const item = A.data.catalog.routes.find(route => route.id === id);
    if (!item) return notFound();
    const lib = A.data.libraryMap.get(item.libraryIds[0]);
    const completed = A.storage.get().routeProgress[item.id] || [];
    return `<section class="page tone-${lib.tone}" data-library="${lib.id}"><header class="explore-hero"><span class="eyebrow">${esc(lib.short)} · Ruta</span><h1>${esc(item.title)}</h1><p>${esc(item.description)}</p>${A.library.notebookButton(lib, `Consultar dudas en ${lib.short}`)}</header><div class="route-steps">${item.steps.map((step,index) => {
      const doc = A.data.documentMap.get(step.documentId);
      if (!doc) return "";
      const done = completed.includes(step.documentId);
      return `<article class="route-step"><button class="step-check ${done ? "done" : ""}" data-route-step="${item.id}" data-document-id="${doc.id}" aria-label="${done ? "Marcar pendiente" : "Marcar completado"}">${done ? A.library.icon("check") : index + 1}</button><button data-open-document="${doc.id}" style="border:0;background:none;text-align:left;padding:0"><h4>${esc(doc.title)}</h4><p>${esc(step.level)} · ${A.library.compact(doc.words)} palabras</p></button></article>`;
    }).join("")}</div></section>`;
  }

  function rangeSetting(key, label, min, max, step, suffix = "") {
    const value = A.storage.get().settings[key];
    return `<label class="setting-range"><span><b>${label}</b><output data-setting-output="${key}">${value}${suffix}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-setting-range="${key}" data-suffix="${suffix}"></label>`;
  }

  function toggleSetting(key, label, description) {
    return `<label class="setting-toggle"><span><b>${label}</b><small>${description}</small></span><input type="checkbox" data-setting-toggle="${key}" ${A.storage.get().settings[key] ? "checked" : ""}><i></i></label>`;
  }

  function renderSettings() {
    const settings = A.storage.get().settings;
    return `<div class="settings-sections">
      <section><span class="eyebrow">Movimiento de Shorts</span><h3>Imán</h3>${toggleSetting("magnetEnabled","Alineación magnética","Ajusta suavemente el final del gesto a la tarjeta más cercana.")}${rangeSetting("magnetStrength","Zona de atracción",5,65,1,"%")}${rangeSetting("magnetDelay","Espera antes de atraer",25,350,5," ms")}${rangeSetting("magnetDuration","Tiempo de alineación",100,700,10," ms")}</section>
      <section><span class="eyebrow">Atmósfera</span><h3>Iluminación</h3>${rangeSetting("auroraIntensity","Intensidad de la luz",20,100,1,"%")}${rangeSetting("auroraSize","Tamaño del foco",60,145,1,"%")}${rangeSetting("motionLevel","Recorrido de la luz",0,140,1,"%")}${rangeSetting("josemariaPortraitIntensity","Presencia de san Josemaría",5,42,1,"%")}</section>
      <section><span class="eyebrow">Lectura de tarjetas</span><h3>Texto y composición</h3>${rangeSetting("shortTextScale","Tamaño del texto",80,135,1,"%")}${rangeSetting("shortContentWidth","Anchura del texto",480,1000,10," px")}
        <label class="setting-select"><span><b>Colocación del texto</b><small>San Josemaría permanece siempre a la izquierda.</small></span><select data-setting-select="shortAlignment"><option value="mixed" ${settings.shortAlignment==="mixed"?"selected":""}>Alternada</option><option value="left" ${settings.shortAlignment==="left"?"selected":""}>Siempre izquierda</option><option value="right" ${settings.shortAlignment==="right"?"selected":""}>Siempre derecha</option></select></label>
        ${toggleSetting("showExternalImages","Fotografías externas","Muestra imágenes en noticias, Instagram, música y vídeos.")}</section>
      <section><span class="eyebrow">Interfaz</span><h3>Apariencia general</h3>${rangeSetting("interfaceScale","Escala de la interfaz",85,120,1,"%")}${rangeSetting("cornerRadius","Redondez",35,140,1,"%")}
        <label class="setting-select"><span><b>Personalidad tipográfica</b><small>Editorial prioriza Literata; moderna prioriza DM Sans.</small></span><select data-setting-select="fontStyle"><option value="editorial" ${settings.fontStyle==="editorial"?"selected":""}>Editorial</option><option value="modern" ${settings.fontStyle==="modern"?"selected":""}>Moderna</option></select></label>
        ${toggleSetting("compactMode","Modo compacto","Reduce espacios en listados, paneles y cabeceras.")}</section>
    </div>`;
  }

  function applyPersonalization() {
    const s = A.storage.get().settings;
    const root = document.documentElement;
    root.style.setProperty("--short-text-scale", Number(s.shortTextScale || 100) / 100);
    root.style.setProperty("--short-content-width", `${Number(s.shortContentWidth || 720)}px`);
    root.style.setProperty("--ui-scale", Number(s.interfaceScale || 100) / 100);
    root.style.setProperty("--corner-scale", Number(s.cornerRadius || 100) / 100);
    const auroraSize = Number(s.auroraSize || 100) / 100;
    root.style.setProperty("--aurora-diameter", `${76 * auroraSize}vmax`);
    root.style.setProperty("--aurora-max", `${1050 * auroraSize}px`);
    root.style.setProperty("--sjm-portrait-opacity", Number(s.josemariaPortraitIntensity || 18) / 100);
    document.body.dataset.fontStyle = s.fontStyle || "editorial";
    document.body.classList.toggle("compact-ui", Boolean(s.compactMode));
    document.body.classList.toggle("hide-external-images", !s.showExternalImages);
  }

  function openSettings() {
    settingsLayer.querySelector("#settings-content").innerHTML = renderSettings();
    settingsLayer.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeSettings() {
    settingsLayer.hidden = true;
    if (searchSheet.hidden && detailLayer.hidden && shareLayer.hidden && tutorialLayer.hidden) document.body.classList.remove("modal-open");
  }

  function renderSaved() {
    const stored = A.storage.get();
    const today = stored.study?.[new Date().toISOString().slice(0, 10)] || { milliseconds: 0, documents: [], collections: [] };
    const tabs = [["documents","Documentos"],["shorts","Shorts"],["collections","Colecciones"],["routes","Rutas"],["history","Historial"],["channels","Canales"]];
    let content = "";
    if (state.savedTab === "documents") {
      const docs = stored.favorites.documents.map(id => A.data.documentMap.get(id)).filter(Boolean);
      content = docs.length ? `<div class="document-grid">${docs.map(doc => A.library.docCard(doc, doc.library)).join("")}</div>` : A.library.empty("Aún no has guardado documentos", "Toca el marcador de cualquier ficha o tarjeta.");
    } else if (state.savedTab === "shorts") {
      const items = A.data.catalog.shorts.filter(item => stored.favorites.shorts.includes(item.id));
      content = items.length ? `<div class="collection-grid">${items.map(item => {
        const lib = A.data.libraryMap.get(item.libraryId); return `<article class="collection-card tone-${lib.tone}"><span class="eyebrow">${esc(lib.short)}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p><a class="secondary-button" href="#/short/${item.id}">Abrir Short</a></article>`;
      }).join("")}</div>` : A.library.empty("No hay Shorts guardados", "Guarda contenidos desde el modo Descubrir.");
    } else if (state.savedTab === "collections") {
      const items = A.data.catalog.collections.filter(item => stored.favorites.collections.includes(item.id));
      content = items.length ? `<div class="collection-grid">${items.map(item => `<article class="collection-card"><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><a class="secondary-button" href="#/collection/${item.id}">Abrir</a></article>`).join("")}</div>` : A.library.empty("No hay colecciones guardadas", "Puedes guardar cualquier área de los mapas temáticos.");
    } else if (state.savedTab === "routes") {
      const items = A.data.catalog.routes.filter(item => stored.favorites.routes.includes(item.id) || stored.routeProgress[item.id]?.length);
      content = items.length ? `<div class="route-grid">${items.map(routeCard).join("")}</div>` : A.library.empty("No has empezado ninguna ruta", "El progreso se guardará automáticamente.");
    } else if (state.savedTab === "history") {
      const docs = stored.history.map(id => A.data.documentMap.get(id)).filter(Boolean);
      content = docs.length ? `<div class="document-list">${docs.map(A.library.docRow).join("")}</div>` : A.library.empty("Historial vacío", "Los documentos que abras aparecerán aquí.");
    } else {
      const groups = [["youtube","Vídeos de YouTube","disabledVideoChannels"],["music","Música de YouTube","disabledMusicChannels"],["instagram","Instagram","disabledInstagramChannels"]];
      content = `<div class="channel-manager">${groups.map(([kind,title,setting]) => {
        const channels = window.ATLAS_CHANNELS?.[kind] || [];
        const disabled = new Set(stored.settings[setting] || []);
        return `<section class="channel-group"><div class="section-head"><div><h2>${title}</h2><p>${channels.length} fuentes configuradas · elige cuáles aparecen en Descubrir.</p></div><div class="channel-bulk"><button class="text-button" data-channel-group="${kind}" data-channel-state="on">Todas</button><button class="text-button" data-channel-group="${kind}" data-channel-state="off">Ninguna</button></div></div><div class="channel-switches">${channels.map(channel => `<label class="channel-switch"><span><b>${esc(channel.name)}</b><small>${esc(channel.handle ? `@${channel.handle}` : channel.tier === "reserve" ? "Canal de reserva" : "Canal de YouTube")}</small></span><input type="checkbox" data-channel-toggle="${kind}" value="${esc(channel.name)}" ${disabled.has(channel.name) ? "" : "checked"}><i aria-hidden="true"></i></label>`).join("")}</div></section>`;
      }).join("")}</div>`;
    }
    return `<section class="page"><header class="explore-hero"><span class="eyebrow">Tu Atlas · versión ${esc(A.data.catalog.meta.dataVersion)}</span><h1>Guardados e historial.</h1><p>Todo permanece en este dispositivo. No necesitas una cuenta.</p><span class="app-version-badge">Atlas ${esc(A.data.catalog.meta.dataVersion)}</span></header>
      <section class="study-summary"><div><strong>${Math.round((today.milliseconds || 0) / 60000)}</strong><span>minutos hoy</span></div><div><strong>${today.documents?.length || 0}</strong><span>documentos</span></div><div><strong>${today.collections?.length || 0}</strong><span>colecciones</span></div></section>
      <div class="chip-row saved-tabs">${tabs.map(([id,label]) => `<button class="chip ${state.savedTab===id?"active":""}" data-saved-tab="${id}">${label}</button>`).join("")}</div>${content}
      <section class="section"><div class="section-head"><div><h2>Preferencias</h2><p>Adapta lectura, movimiento, iluminación y apariencia.</p></div></div><div class="button-row"><button class="primary-button" data-action="settings">Personalizar Atlas</button><button class="secondary-button" data-action="toggle-contrast">${stored.settings.contrast ? "Desactivar" : "Activar"} alto contraste</button><button class="secondary-button" data-action="toggle-random">${stored.settings.randomShorts ? "Orden diario" : "Orden aleatorio"}</button><button class="secondary-button" data-action="toggle-only-new">${stored.settings.onlyNewShorts ? "Mostrar todos" : "Solo contenido nuevo"}</button></div></section>
      <section class="section"><div class="section-head"><div><h2>Datos locales</h2><p>Exporta una copia, impórtala o borra todo.</p></div></div><div class="button-row"><button class="secondary-button" data-action="export-data">Exportar</button><button class="secondary-button" data-action="import-data">Importar</button><button class="secondary-button" data-action="clear-data">Borrar</button><input id="import-file" type="file" accept=".json,application/json" hidden></div></section></section>`;
  }

  async function refreshAtlas(button) {
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = "↻ <span>Actualizando…</span>";
    toast("Atlas está comprobando la última versión publicada.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const manifest = await window.AtlasRuntime.fetchJson("build-manifest.json", { fresh: true, signal: controller.signal });
      await navigator.serviceWorker?.getRegistration()?.then(registration => registration?.update());
      const current = A.data.catalog.meta.dataVersion;
      if (manifest.version !== current || !String(manifest.buildId || "").startsWith(current)) {
        toast("Hay una versión nueva. Actualizando Atlas…");
        setTimeout(() => location.reload(), 350);
      } else {
        toast("Atlas ya utiliza la última versión publicada.");
        button.disabled = false;
        button.innerHTML = original;
      }
    } catch (error) {
      toast(error.name === "AbortError" ? "La comprobación ha tardado demasiado." : "No se pudo comprobar la versión publicada.");
      button.disabled = false;
      button.innerHTML = original;
    } finally { clearTimeout(timer); }
  }

  function renderUpdates() {
    const entries = A.data.catalog.editorial?.changelog || [];
    return `<section class="page"><header class="explore-hero"><span class="eyebrow">Novedades de Atlas</span><h1>La biblioteca sigue creciendo.</h1><p>Versión de datos ${esc(A.data.catalog.meta.dataVersion)} · catálogo generado ${new Date(A.data.catalog.meta.generatedAt).toLocaleDateString("es-ES")}.</p></header><div class="collection-grid">${entries.map(entry => `<article class="collection-card"><span class="eyebrow">Versión ${esc(entry.version)} · ${esc(entry.date)}</span><h3>${esc(entry.title)}</h3><ul>${entry.changes.map(change => `<li>${esc(change)}</li>`).join("")}</ul></article>`).join("")}</div></section>`;
  }

  function notFound() { return `<section class="page">${A.library.empty("No encontramos esa página", "Vuelve a Explorar o utiliza la búsqueda global.")}<a class="primary-button" href="#/explore">Ir a Explorar</a></section>`; }

  function renderRouteView() {
    if (!routeTransitioning && document.startViewTransition) {
      routeTransitioning = true;
      document.startViewTransition(() => renderRouteView()).finished.finally(() => { routeTransitioning = false; });
      return;
    }
    const current = route();
    if (current.name !== "reader") A.reader?.stop();
    closeDetail(false);
    setActiveNav(current.name);
    if (current.name === "home") app.innerHTML = renderHome();
    else if (current.name === "explore") app.innerHTML = renderExplore();
    else if (current.name === "infographics") app.innerHTML = renderInfographics();
    else if (current.name === "discover") {
      state.shortFilter = current.query.get("filter") || state.shortFilter;
      app.innerHTML = A.reels.render(state.shortFilter);
    }
    else if (current.name === "short") {
      app.innerHTML = A.reels.render(state.shortFilter);
      requestAnimationFrame(() => document.getElementById(current.segments[1])?.scrollIntoView());
    }
    else if (current.name === "compare") app.innerHTML = A.compare.render(state.compare);
    else if (current.name === "collections") app.innerHTML = renderCollections();
    else if (current.name === "collection") app.innerHTML = renderCollection(current.segments[1]);
    else if (current.name === "routes") app.innerHTML = renderRoutes();
    else if (current.name === "route") app.innerHTML = renderRoute(current.segments[1]);
    else if (current.name === "saved") app.innerHTML = renderSaved();
    else if (current.name === "updates") app.innerHTML = renderUpdates();
    else if (current.name === "timeline") app.innerHTML = A.extras.renderTimeline();
    else if (current.name === "map") app.innerHTML = A.extras.renderMap();
    else if (current.name === "graph") app.innerHTML = A.extras.renderGraph(current.query.get("focus") || "", current.query.get("view") || "hierarchy", current.query.get("library") || "");
    else if (current.name === "sources") app.innerHTML = A.extras.renderSources(current.query.get("section") || "news");
    else if (current.name === "music") {
      app.innerHTML = A.extras.renderMusic();
      requestAnimationFrame(() => A.extras.hydrateMusic());
    }
    else if (current.name === "guide") app.innerHTML = A.extras.renderGuide(current.query.get("q") || "");
    else if (current.name === "notifications") app.innerHTML = A.extras.renderNotifications();
    else if (current.name === "reader") {
      const doc = A.data.documentMap.get(decodeURIComponent(current.segments.slice(1).join("/")));
      if (!doc) app.innerHTML = notFound();
      else {
        app.innerHTML = `<section class="page"><div class="empty-state"><span class="empty-glyph">${A.library.icon("books")}</span><h2>Abriendo el documento…</h2></div></section>`;
        A.reader.open(doc, current.query.get("q") || "");
      }
    }
    else if (current.name === "library") {
      const lib = A.data.libraryMap.get(current.segments[1]);
      if (!lib) app.innerHTML = notFound();
      else {
        A.storage.setLastLibrary(lib.id);
        const tab = current.segments[2] || "documents";
        state.library.category = current.query.get("category") || state.library.category;
        app.innerHTML = A.library.render(lib, tab, state.library);
      }
    } else if (current.name === "document") {
      app.innerHTML = renderExplore();
      const doc = A.data.documentMap.get(decodeURIComponent(current.segments.slice(1).join("/")));
      if (doc) openDetail(doc, false); else app.innerHTML = notFound();
    } else if (current.name === "author") {
      app.innerHTML = renderExplore(); openSearch(decodeURIComponent(current.segments.slice(1).join("/")));
    } else app.innerHTML = notFound();
    document.title = titleFor(current);
    app.focus({ preventScroll: true });
    if (current.name === "explore" && current.query.get("section") === "libraries") {
      requestAnimationFrame(() => document.querySelector("#explore-libraries")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function titleFor(current) {
    if (current.name === "library") return `${A.data.libraryMap.get(current.segments[1])?.short || "Biblioteca"} · Atlas`;
    if (current.name === "discover") return "Descubrir · Atlas";
    if (current.name === "compare") return "Comparar · Atlas";
    if (current.name === "saved") return "Guardados · Atlas";
    return "Atlas · Mercabá";
  }

  function setActiveNav(name) {
    const mapped = name === "library" || name === "collections" || name === "routes" || name === "compare" ? (name === "compare" ? "compare" : "explore") : name === "short" ? "discover" : name;
    document.querySelectorAll("[data-nav]").forEach(item => item.classList.toggle("active", item.dataset.nav === mapped));
  }

  function openDetail(doc, updateHash = true) {
    if (updateHash) {
      state.previousRoute = route().raw;
      location.hash = `/document/${encodeURIComponent(doc.id)}`;
      return;
    }
    A.storage.addHistory(doc.id);
    detailContent.innerHTML = A.library.detail(doc);
    detailLayer.hidden = false;
    document.body.classList.add("modal-open");
    detailLayer.querySelector("[data-action='close-detail']")?.focus();
  }

  function closeDetail(navigate = true) {
    if (detailLayer.hidden) return;
    detailLayer.hidden = true; document.body.classList.remove("modal-open");
    if (navigate && route().name === "document") location.hash = state.previousRoute || "/";
  }

  function openSearch(value = "") {
    searchSheet.hidden = false;
    document.body.classList.add("modal-open");
    searchInput.placeholder = `Busca “${placeholders[daySeed() % placeholders.length]}”`;
    searchInput.value = value;
    renderSearch(value);
    requestAnimationFrame(() => searchInput.focus());
  }
  A.openAtlasSearch = (value = "", fullText = false) => {
    openSearch(value);
    if (fullText) requestAnimationFrame(renderFullTextSearch);
  };

  function closeSearch() { searchSheet.hidden = true; document.body.classList.remove("modal-open"); }

  function openShare(payload) {
    sharePayload = payload;
    document.querySelector("#share-title").textContent = payload.title;
    document.querySelector("#share-preview").textContent = payload.text;
    shareLayer.hidden = false;
    document.body.classList.add("modal-open");
    shareLayer.querySelector("[data-share-choice]")?.focus();
  }

  function closeShare() {
    shareLayer.hidden = true;
    sharePayload = null;
    if (searchSheet.hidden && detailLayer.hidden) document.body.classList.remove("modal-open");
  }

  function searchFilters() {
    const filters = [["all","Todo"],["library:doctrine","Doctrina"],["library:canon","CanonIA"],["library:history","HistorIA"],["library:liturgy","LiturgIA"],["type:documents","Documentos"],["type:authors","Autores"],["type:categories","Categorías"],["status:historical","Históricos"],["status:incomplete","Incompletos"],["language:foreign","Otros idiomas"]];
    document.querySelector("#search-filters").innerHTML = filters.map(([id,label]) => `<button class="chip ${state.searchFilter===id?"active":""}" data-search-filter="${id}">${label}</button>`).join("");
  }

  function renderSearch(value) {
    searchFilters();
    const q = value.trim();
    if (!q) {
      const recent = A.storage.get().recentSearches;
      searchResults.innerHTML = recent.length ? `<div class="result-group"><h3>Búsquedas recientes</h3>${recent.map(term => `<button class="search-result" data-search-term="${esc(term)}"><span class="result-mark">⌕</span><span><b>${esc(term)}</b><small>Buscar de nuevo</small></span><span>→</span></button>`).join("")}</div>` : A.library.empty("Busca en 476 fuentes", "Escribe un título, autor, categoría o número de catálogo.");
      return;
    }
    const results = A.search.run(q, state.searchFilter);
    const groups = [
      ["documents","Documentos", item => searchDoc(item)],
      ["authors","Autores", item => searchEntity(item.name, `${item.count} documentos · ${item.library.short}`, `#/author/${encodeURIComponent(item.name)}`, item.library)],
      ["categories","Categorías", item => searchEntity(item.name, `${item.count} documentos · ${item.library.short}`, `#/library/${item.library.id}/documents?category=${encodeURIComponent(item.name)}`, item.library)],
      ["collections","Colecciones", item => searchEntity(item.title, `${item.documentIds.length} documentos`, `#/collection/${item.id}`, A.data.libraryMap.get(item.libraryIds[0]))],
      ["routes","Rutas", item => searchEntity(item.title, `${item.steps.length} pasos`, `#/route/${item.id}`, A.data.libraryMap.get(item.libraryIds[0]))],
      ["questions","Preguntas", item => searchEntity(item.text, "Pregunta preparada", A.data.libraryMap.get(item.libraryId).notebookUrl, A.data.libraryMap.get(item.libraryId), true)],
      ["libraries","Bibliotecas", item => searchEntity(item.short, item.description, `#/library/${item.id}/documents`, item)]
    ];
    const html = groups.filter(([key]) => results[key].length).map(([key,label,renderer]) => `<div class="result-group"><h3>${label} · ${results[key].length}</h3>${results[key].slice(0,key==="documents"?30:8).map(renderer).join("")}</div>`).join("");
    const help = /(?:como|cómo)\s+(?:se\s+)?(?:usa|usar|funciona)|tutorial|ayuda.*atlas/i.test(q)
      ? `<div class="result-group"><h3>Ayuda de Atlas</h3><button class="search-result" data-action="tutorial"><span class="result-mark">?</span><span><b>Ver tutorial de todas las pantallas</b><small>Inicio, buscador, IA, bibliotecas, lector, Descubrir y Explorar</small></span><span>→</span></button></div>` : "";
    searchResults.innerHTML = help + (html || (help ? "" : A.library.empty(`No encontramos “${q}”`, "Prueba otra grafía, un número de catálogo o una categoría.")));
  }

  async function renderFullTextSearch() {
    const query = searchInput.value.trim();
    if (query.length < 3) {
      toast("Escribe al menos tres caracteres antes de buscar en el texto.");
      return;
    }
    fullTextStatus.textContent = "Cargando el índice completo y buscando…";
    searchResults.innerHTML = `<div class="empty-state"><span class="empty-glyph">${A.library.icon("books")}</span><h2>Buscando dentro de los documentos</h2><p>La primera búsqueda puede tardar unos segundos.</p></div>`;
    try {
      const results = await A.search.runFullText(query, state.searchFilter);
      fullTextStatus.textContent = `Índice textual activo · ${window.ATLAS_FULLTEXT.meta.terms.toLocaleString("es-ES")} términos`;
      searchResults.innerHTML = results.length
        ? `<div class="result-group"><h3>Coincidencias dentro del texto · ${results.length}</h3>${results.map(doc => `<button class="search-result tone-${doc.library.tone}" data-open-reader="${esc(doc.id)}" data-reader-query="${esc(query)}"><span class="result-mark">${doc.library.mark}</span><span><b>${esc(doc.title)}</b><small>${esc(doc.category)} · ${esc(doc.library.short)}</small></span><span>${doc.occurrences.toLocaleString("es-ES")} apariciones</span></button>`).join("")}</div>`
        : A.library.empty(`No aparece “${query}” en el índice textual`, "Prueba una palabra más general o una equivalencia.");
      A.storage.addSearch(query);
    } catch (error) {
      fullTextStatus.textContent = "No se pudo cargar el índice textual.";
      searchResults.innerHTML = A.library.empty("Búsqueda textual no disponible", "Comprueba que el índice segmentado está publicado junto a Atlas.");
    }
  }

  function searchDoc(doc) {
    return `<button class="search-result tone-${doc.library.tone}" data-open-document="${esc(doc.id)}"><span class="result-mark">${doc.library.mark}</span><span><b>${esc(doc.title)}</b><small>${esc(doc.category)} · ${esc(doc.library.short)}</small></span><span>${A.library.compact(doc.words)}</span></button>`;
  }
  function searchEntity(title, subtitle, href, lib, external = false) {
    const tag = external ? "a" : "a";
    return `<${tag} class="search-result tone-${lib.tone}" href="${esc(href)}" ${external ? 'target="_blank" rel="noopener"' : ""}><span class="result-mark">${lib.mark}</span><span><b>${esc(title)}</b><small>${esc(subtitle)}</small></span><span>→</span></${tag}>`;
  }

  function toggleTheme() {
    const current = A.storage.get().settings.theme;
    const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
    A.storage.setSetting("theme", next); applyTheme(); toast(`Tema: ${next === "system" ? "sistema" : next}`);
  }
  function applyTheme() {
    const setting = A.storage.get().settings.theme;
    const dark = setting === "dark" || (setting === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.contrast = A.storage.get().settings.contrast ? "high" : "normal";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#111512" : "#f4f0e7";
  }

  function checkNotifications() {
    const stored = A.storage.get();
    const day = new Date().toISOString().slice(0, 10);
    if (!stored.notifications?.daily || !("Notification" in window) || Notification.permission !== "granted" || stored.settings.lastDailyNotification === day) return;
    try {
      const item = dailyPick(A.data.documents.filter(doc => doc.status !== "incomplete"), 5);
      const notification = new Notification("Atlas · Lectura del día", { body: item?.title || "Hay una nueva selección preparada para ti.", icon: "assets/icons/icon-192.png" });
      notification.onclick = () => { window.focus(); if (item) location.hash = `/reader/${encodeURIComponent(item.id)}`; };
      A.storage.setSetting("lastDailyNotification", day);
    } catch { /* El navegador puede restringir avisos fuera de una PWA instalada. */ }
  }

  function toast(message) {
    const node = document.createElement("div"); node.className = "toast"; node.textContent = message;
    document.querySelector("#toast-region").append(node); setTimeout(() => node.remove(), 2600);
  }
  A.appToast = toast;

  async function saveAsFile(name, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast("La búsqueda por voz no está disponible en este navegador."); return; }
    recognition = new SpeechRecognition(); recognition.lang = "es-ES"; recognition.interimResults = false;
    recognition.onresult = event => { searchInput.value = event.results[0][0].transcript; renderSearch(searchInput.value); };
    recognition.onerror = () => toast("No se pudo completar la búsqueda por voz.");
    recognition.start(); toast("Escuchando…");
  }

  function moveSetting(key, id, direction, fallback) {
    const current = [...(A.storage.get().settings[key]?.length ? A.storage.get().settings[key] : fallback)];
    const from = current.indexOf(id);
    const to = Math.max(0, Math.min(current.length - 1, from + Number(direction)));
    if (from < 0 || from === to) return;
    [current[from], current[to]] = [current[to], current[from]];
    A.storage.setSetting(key, current);
    renderRouteView();
  }

  function openInfographic(file, title = "Infografía", tone = "amber") {
    const layer = document.querySelector("#infographic-layer");
    const frame = document.querySelector("#infographic-frame");
    if (!layer || !frame || !/^[\wÁÉÍÓÚÜÑáéíóúüñ .-]+\.html$/u.test(file || "")) return;
    layer.className = `infographic-layer tone-${tone}`;
    layer.hidden = false;
    layer.querySelector("#infographic-title").textContent = title;
    layer.querySelector(".composition-mark").textContent = title.split(/\s+/).map(word => word[0]).join("").slice(0, 2).toUpperCase();
    const url = infographicUrl(file);
    layer.querySelector("#infographic-new-window").href = url;
    frame.onload = () => {
      fitInfographic(frame);
      frame.contentDocument?.fonts?.ready.then(() => fitInfographic(frame)).catch(() => {});
    };
    frame.src = url;
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => {
      layer.classList.add("is-assembling");
      setTimeout(() => layer.classList.add("is-composed"), 340);
    });
  }

  function fitInfographic(frame) {
    const wrap = frame.closest(".infographic-frame-wrap");
    if (!wrap) return;
    try {
      const doc = frame.contentDocument;
      const root = doc?.documentElement;
      const body = doc?.body;
      if (!root || !body) return;
      frame.style.cssText = "";
      const sourceWidth = Math.max(root.scrollWidth, body.scrollWidth, root.offsetWidth, body.offsetWidth);
      const sourceHeight = Math.max(root.scrollHeight, body.scrollHeight, root.offsetHeight, body.offsetHeight);
      const availableWidth = Math.max(1, wrap.clientWidth - 20);
      const availableHeight = Math.max(1, wrap.clientHeight - 20);
      const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight, 1);
      frame.style.width = `${sourceWidth}px`;
      frame.style.height = `${sourceHeight}px`;
      frame.style.minHeight = "0";
      frame.style.transform = `scale(${scale})`;
      frame.style.transformOrigin = "center center";
      frame.style.flex = `0 0 ${sourceWidth}px`;
      wrap.style.setProperty("--infographic-source-width", `${sourceWidth}px`);
      wrap.style.setProperty("--infographic-source-height", `${sourceHeight}px`);
      wrap.style.setProperty("--infographic-scale", String(scale));
      wrap.dataset.fitted = "true";
    } catch {
      frame.style.width = "100%";
      frame.style.height = "100%";
    }
  }

  function closeInfographic() {
    const layer = document.querySelector("#infographic-layer");
    if (!layer || layer.hidden) return;
    layer.classList.add("is-closing");
    setTimeout(() => {
      layer.hidden = true;
      layer.classList.remove("is-assembling", "is-composed", "is-closing");
      const frame = document.querySelector("#infographic-frame");
      if (frame) { frame.onload = null; frame.src = ""; frame.style.cssText = ""; }
      if (tutorialLayer.hidden && searchSheet.hidden && detailLayer.hidden && shareLayer.hidden) document.body.classList.remove("modal-open");
    }, 300);
  }

  document.addEventListener("click", async event => {
    const infographicTrigger = event.target.closest("[data-open-infographic]");
    if (infographicTrigger) {
      openInfographic(infographicTrigger.dataset.openInfographic, infographicTrigger.dataset.infographicTitle, infographicTrigger.dataset.infographicTone);
      return;
    }
    if (event.target.closest("[data-close-infographic]")) {
      closeInfographic();
      return;
    }
    const target = event.target.closest("button,a");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "search") { event.preventDefault(); openSearch(); }
    if (action === "settings") { event.preventDefault(); openSettings(); }
    if (action === "close-settings") closeSettings();
    if (action === "reset-personalization") {
      Object.entries(personalizationDefaults).forEach(([key,value]) => A.storage.setSetting(key,value));
      applyPersonalization();
      settingsLayer.querySelector("#settings-content").innerHTML = renderSettings();
      toast("Personalización restablecida.");
    }
    if (action === "tutorial") { event.preventDefault(); closeSearch(); openTutorial(); }
    if (action === "tutorial-close") closeTutorial();
    if (action === "tutorial-previous") { tutorialIndex = Math.max(0, tutorialIndex - 1); renderTutorialStep(); }
    if (action === "tutorial-next") {
      if (tutorialIndex >= tutorialSteps.length - 1) closeTutorial();
      else { tutorialIndex += 1; renderTutorialStep(); }
    }
    if (action === "close-search") closeSearch();
    if (action === "fulltext-search") renderFullTextSearch();
    if (action === "atlas-guide") {
      event.preventDefault();
      const query = searchInput.value.trim();
      closeSearch();
      location.hash = `/guide${query ? `?q=${encodeURIComponent(query)}` : ""}`;
    }
    if (action === "theme") toggleTheme();
    if (action === "close-detail") closeDetail();
    if (action === "close-share") closeShare();
    if (action === "voice-search") startVoiceSearch();
    if (action === "export-data") saveAsFile(`atlas-guardados-${new Date().toISOString().slice(0,10)}.json`, A.storage.export());
    if (action === "import-data") document.querySelector("#import-file")?.click();
    if (action === "clear-data" && confirm("¿Borrar todos los guardados, historial y progreso de este dispositivo?")) { A.storage.clear(); renderRouteView(); toast("Datos locales borrados."); }
    if (action === "toggle-contrast") { A.storage.setSetting("contrast", !A.storage.get().settings.contrast); applyTheme(); renderRouteView(); }
    if (action === "toggle-random") { A.storage.setSetting("randomShorts", !A.storage.get().settings.randomShorts); renderRouteView(); }
    if (action === "toggle-only-new") { A.storage.setSetting("onlyNewShorts", !A.storage.get().settings.onlyNewShorts); renderRouteView(); }
    if (action === "customize-home") { A.storage.setSetting("customizeHome", !A.storage.get().settings.customizeHome); renderRouteView(); }
    if (action === "customize-explore") { A.storage.setSetting("customizeExplore", !A.storage.get().settings.customizeExplore); renderRouteView(); }
    if (action === "apply-update") location.reload();
    if (action === "refresh-atlas") { event.preventDefault(); refreshAtlas(target); }
    if (target.dataset.channelGroup) {
      const map = { youtube: "disabledVideoChannels", music: "disabledMusicChannels", instagram: "disabledInstagramChannels" };
      const channels = window.ATLAS_CHANNELS?.[target.dataset.channelGroup] || [];
      A.storage.setSetting(map[target.dataset.channelGroup], target.dataset.channelState === "on" ? [] : channels.map(channel => channel.name));
      renderRouteView();
      toast(target.dataset.channelState === "on" ? "Canales habilitados." : "Canales deshabilitados.");
    }

    if (target.dataset.openDocument) { event.preventDefault(); closeSearch(); openDetail(A.data.documentMap.get(target.dataset.openDocument)); }
    if (target.dataset.openReader) {
      event.preventDefault();
      closeSearch();
      const query = target.dataset.readerQuery ? `?q=${encodeURIComponent(target.dataset.readerQuery)}` : "";
      location.hash = `/reader/${encodeURIComponent(target.dataset.openReader)}${query}`;
    }
    if (target.dataset.doc) { event.preventDefault(); openDetail(A.data.documentMap.get(target.dataset.doc)); }
    if (target.dataset.saveDocument) { event.preventDefault(); event.stopPropagation(); const saved = A.storage.toggleFavorite("documents", target.dataset.saveDocument); target.classList.toggle("saved", saved); toast(saved ? "Documento guardado." : "Documento retirado."); }
    if (target.dataset.saveShort) { const saved = A.storage.toggleFavorite("shorts", target.dataset.saveShort); target.classList.toggle("saved", saved); toast(saved ? "Short guardado." : "Short retirado."); }
    if (target.dataset.saveCollection) { const saved = A.storage.toggleFavorite("collections", target.dataset.saveCollection); target.classList.toggle("saved", saved); toast(saved ? "Colección guardada." : "Colección retirada."); }
    if (target.dataset.saveQuestion) { const saved = A.storage.toggleFavorite("questions", target.dataset.saveQuestion); toast(saved ? "Pregunta guardada." : "Pregunta retirada."); }
    if (target.dataset.copyQuestion) { await A.share.copy(target.dataset.copyQuestion); toast("Pregunta copiada."); }
    if (target.dataset.shareDocument) {
      const doc = A.data.documentMap.get(target.dataset.shareDocument);
      const url = `${location.href.split("#")[0]}#/document/${encodeURIComponent(doc.id)}`;
      openShare({ title: `${doc.title} · Atlas`, text: `${doc.title} — ${doc.library.short}`, url });
    }
    if (target.dataset.shareShort) {
      const item = A.data.catalog.shorts.find(short => short.id === target.dataset.shareShort)
        || (window.ATLAS_EXTERNAL?.items || []).find(short => short.id === target.dataset.shareShort)
        || (window.ATLAS_QUOTES?.items || []).find(short => short.id === target.dataset.shareShort)
        || (window.ATLAS_YOUTUBE?.items || []).find(short => short.id === target.dataset.shareShort)
        || (window.ATLAS_LIVE_SHORTS || []).find(short => short.id === target.dataset.shareShort);
      if (!item) { toast("No se ha podido recuperar esta tarjeta."); return; }
      const url = `${location.href.split("#")[0]}#/short/${encodeURIComponent(item.id)}`;
      openShare({ title: `${item.title} · Atlas`, text: `${item.text || item.description}\nFuente: ${item.reference || item.source}`, url: item.url || url });
    }
    if (target.dataset.shareChoice && sharePayload) {
      const choice = target.dataset.shareChoice;
      if (choice === "native") {
        const result = await A.share.share(sharePayload);
        if (result === "copied") toast("Texto y enlace copiados.");
      } else if (choice === "whatsapp") A.share.whatsapp(sharePayload.text, sharePayload.url);
      else if (choice === "copy-link") { await A.share.copy(sharePayload.url); toast("Enlace copiado."); }
      else if (choice === "copy-text") { await A.share.copy(`${sharePayload.text}\n${sharePayload.url}`); toast("Texto y enlace copiados."); }
      if (choice !== "whatsapp") closeShare();
    }
    if (target.dataset.searchFilter) { state.searchFilter = target.dataset.searchFilter; renderSearch(searchInput.value); }
    if (target.dataset.searchTerm) { event.preventDefault(); openSearch(target.dataset.searchTerm); }
    if (target.dataset.docView) { state.library.view = target.dataset.docView; renderRouteView(); }
    if (target.dataset.status) { state.library.status = target.dataset.status; renderRouteView(); }
    if (target.dataset.sort === "words") { const lib = A.data.libraryMap.get(route().segments[1]); lib.documents.sort((a,b)=>b.words-a.words); renderRouteView(); }
    if (target.dataset.category) { const libId = route().segments[1]; location.hash = `/library/${libId}/documents?category=${encodeURIComponent(target.dataset.category)}`; }
    if (target.dataset.compareLibrary) {
      const id = target.dataset.compareLibrary;
      state.compare = state.compare.includes(id) ? state.compare.filter(item => item !== id) : state.compare.length < 4 ? [...state.compare,id] : state.compare;
      renderRouteView();
    }
    if (target.dataset.shortFilter) { state.shortFilter = target.dataset.shortFilter; renderRouteView(); }
    if (target.dataset.savedTab) { state.savedTab = target.dataset.savedTab; renderRouteView(); }
    if (target.dataset.routeStep) { A.storage.toggleRouteStep(target.dataset.routeStep, target.dataset.documentId); renderRouteView(); }
    if (target.dataset.quizAnswer) { const correct = target.dataset.quizAnswer === target.dataset.quizCorrect; A.storage.recordQuiz(correct); toast(correct ? "Correcto. Esa fuente aparece en esa biblioteca." : "No es esa biblioteca. Puedes abrir la ficha para comprobarlo."); }
    if (target.dataset.homeMove) moveSetting("homeOrder", target.dataset.homeMove, target.dataset.direction, ["today","libraries","reading","history"]);
    if (target.dataset.exploreMove) moveSetting("exploreOrder", target.dataset.exploreMove, target.dataset.direction, ["libraries","collections","routes","discover","stats","compare","timeline","map","graph","guide","sources","notifications"]);
  });

  document.addEventListener("input", event => {
    if (event.target === searchInput) { clearTimeout(libraryTimer); libraryTimer = setTimeout(() => { renderSearch(searchInput.value); A.storage.addSearch(searchInput.value); }, 100); }
    if (event.target.id === "library-query") {
      const value = event.target.value; clearTimeout(libraryTimer);
      libraryTimer = setTimeout(() => { state.library.query = value; renderRouteView(); requestAnimationFrame(() => { const input=document.querySelector("#library-query"); input?.focus(); input?.setSelectionRange(value.length,value.length); }); }, 140);
    }
    if (event.target.dataset.settingRange) {
      const key = event.target.dataset.settingRange;
      A.storage.setSetting(key, Number(event.target.value));
      const output = settingsLayer.querySelector(`[data-setting-output="${key}"]`);
      if (output) output.textContent = `${event.target.value}${event.target.dataset.suffix || ""}`;
      applyPersonalization();
    }
  });

  document.addEventListener("change", async event => {
    if (event.target.id === "library-category") { state.library.category = event.target.value; renderRouteView(); }
    if (event.target.id === "import-file" && event.target.files[0]) {
      try { A.storage.import(await event.target.files[0].text()); renderRouteView(); toast("Datos importados."); }
      catch { toast("El archivo no es una exportación válida de Atlas."); }
    }
    if (event.target.dataset.exploreColor) {
      A.storage.setSetting("exploreColors", { ...(A.storage.get().settings.exploreColors || {}), [event.target.dataset.exploreColor]: event.target.value });
      renderRouteView();
    }
    if (event.target.dataset.channelToggle) {
      const map = { youtube: "disabledVideoChannels", music: "disabledMusicChannels", instagram: "disabledInstagramChannels" };
      const key = map[event.target.dataset.channelToggle];
      const disabled = new Set(A.storage.get().settings[key] || []);
      if (event.target.checked) disabled.delete(event.target.value);
      else disabled.add(event.target.value);
      A.storage.setSetting(key, [...disabled]);
      toast(event.target.checked ? "Canal habilitado." : "Canal oculto.");
    }
    if (event.target.dataset.settingToggle) {
      A.storage.setSetting(event.target.dataset.settingToggle, event.target.checked);
      applyPersonalization();
    }
    if (event.target.dataset.settingSelect) {
      A.storage.setSetting(event.target.dataset.settingSelect, event.target.value);
      applyPersonalization();
      if (event.target.dataset.settingSelect === "shortAlignment" && route().name === "discover") renderRouteView();
    }
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
    if (event.key === "Escape") { closeSearch(); closeDetail(); closeShare(); closeSettings(); closeInfographic(); if (!tutorialLayer.hidden) closeTutorial(); }
  });

  function registerPwa() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("./service-worker.js").then(registration => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) document.querySelector("#update-banner").hidden = false;
        });
      });
      navigator.serviceWorker.addEventListener("message", event => {
        if (event.data?.type === "ATLAS_UPDATED" && navigator.serviceWorker.controller) {
          document.querySelector("#update-banner").hidden = false;
        }
      });
    }).catch(() => {});
  }

  window.addEventListener("hashchange", renderRouteView);
  window.addEventListener("resize", () => {
    const frame = document.querySelector("#infographic-frame");
    if (frame?.src && !document.querySelector("#infographic-layer")?.hidden) fitInfographic(frame);
  }, { passive: true });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
  applyTheme(); applyPersonalization(); registerPwa(); renderRouteView(); checkNotifications();
  if (!A.storage.get().settings.tutorialSeen) setTimeout(() => openTutorial(), 350);
})();
