(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const moods = () => window.ATLAS_SAINTS_MOODS?.moods || window.ATLAS_SAINTS_MOODS?.tags || [];
  const guides = () => window.ATLAS_SPIRITUAL_GUIDES || {};
  const songbook = () => window.ATLAS_SONGBOOK || { songs: [], categories: [] };
  const routes = () => window.ATLAS_SAINTS_ROUTES?.routes || [];

  function shell(active, body) {
    const items = [["","Inicio"],["saints","Cómo vivieron"],["routes","Rutas de santos"],["confession","Confesión"],["mass","La Misa"],["songbook","Cancionero"],["escriva","escriva.org"]];
    return `<div class="spiritual-space"><header class="spiritual-header"><a href="#/spiritual" class="spiritual-mark">✦</a><div><span class="eyebrow">Atlas · vida espiritual</span><h1>Aprender desde vidas y fuentes.</h1></div></header><nav class="spiritual-nav">${items.map(([id,label]) => `<a class="${active === id ? "active" : ""}" href="#/spiritual${id ? `/${id}` : ""}">${esc(label)}</a>`).join("")}</nav>${body}</div>`;
  }

  function home() {
    const tagCount = moods().length;
    const passageCount = moods().reduce((total, mood) => total + (mood.passages?.length || 0), 0);
    const cards = [
      ["saints","Ánimo en la vida de los santos",`${tagCount} experiencias · ${passageCount} pasajes biográficos exactos`,"Desolación, miedo, enfermedad, confianza, paz, cruz y mucho más."],
      ["confession","Guía de confesión","Preparación, fórmulas y dudas frecuentes","Un recorrido sobrio para llegar preparado, sin sustituir al confesor."],
      ["mass","Guía de la Misa","Qué sucede en cada momento y por qué","Activa la explicación litúrgica cuando quieras profundizar."],
      ["songbook","Cancionero católico","Cantos por momento, tradición e idioma","Repertorio moderno, tradicional y latino con fuentes responsables."],
      ["escriva","escriva.org","Obras y búsqueda temática","Acceso ordenado a la fuente oficial de san Josemaría."],
      ["routes","Rutas espirituales","Oración, conversión, fortaleza y caridad","Recorridos por santos, textos y preguntas para el estudio personal."]
    ];
    return shell("", `<main class="page spiritual-home"><section class="spiritual-hero"><span>Una pregunta humana</span><h2>¿Cómo lo vivieron quienes caminaron antes?</h2><p>Atlas no convierte el sufrimiento en una frase fácil: abre pasajes concretos, conserva su procedencia y permite leerlos en la biografía completa.</p><a class="primary-button" href="#/spiritual/saints">Encontrar una experiencia</a></section><div class="spiritual-card-grid">${cards.map(([id,title,meta,text],index) => `<a class="spiritual-card spiritual-card-${index + 1}" href="#/spiritual/${id}"><i>${String(index + 1).padStart(2,"0")}</i><span class="eyebrow">${esc(meta)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p><b>Abrir →</b></a>`).join("")}</div></main>`);
  }

  function saintsIndex() {
    const groups = new Map();
    moods().forEach(mood => groups.set(mood.group || "Otras experiencias", [...(groups.get(mood.group || "Otras experiencias") || []), mood]));
    return shell("saints", `<main class="page saints-mode"><header class="saints-hero"><span class="eyebrow">50 experiencias · pasajes verificables</span><h2>¿Qué estás viviendo?</h2><p>Elige una palabra. Encontrarás escenas reales de distintas biografías: qué ocurrió, cómo respondieron y dónde leer el contexto completo.</p><label class="saints-search">⌕<input type="search" data-saints-mood-search placeholder="Escribe: desolación, miedo, paz, enfermedad…"></label></header><div class="saints-groups">${[...groups].map(([group,items]) => `<section><div class="section-head"><div><h3>${esc(group)}</h3><p>${items.length} experiencias relacionadas</p></div></div><div class="saints-tag-grid">${items.map(mood => moodCard(mood)).join("")}</div></section>`).join("")}</div><p class="saints-disclaimer">Los pasajes se ofrecen como acompañamiento de lectura y no sustituyen ayuda médica, psicológica, sacramental o pastoral cuando sea necesaria.</p></main>`);
  }

  function moodCard(mood) {
    return `<a class="saints-tag" data-mood-search="${esc(`${mood.label} ${mood.description || ""} ${mood.keywords?.join(" ") || ""}`.toLocaleLowerCase("es"))}" href="#/spiritual/saints/${encodeURIComponent(mood.id)}"><span>${esc(mood.icon || "✦")}</span><div><h4>${esc(mood.label || mood.name)}</h4><p>${esc(mood.description || "Cómo aparece esta experiencia en vidas concretas.")}</p><small>${mood.passages?.length || 0} santos y pasajes</small></div></a>`;
  }

  function moodDetail(id) {
    const mood = moods().find(item => item.id === id);
    if (!mood) return shell("saints", `<main class="page">${root.library.empty("Experiencia no encontrada", "Vuelve al índice de los santos.")}<a class="primary-button" href="#/spiritual/saints">Ver las 50 experiencias</a></main>`);
    const passages = mood.passages || [];
    return shell("saints", `<main class="page mood-detail"><header class="mood-hero"><a href="#/spiritual/saints">← Las 50 experiencias</a><span class="eyebrow">${esc(mood.group || "Vida de los santos")} · ${passages.length} pasajes</span><h2>${esc(mood.label || mood.name)}</h2><p>${esc(mood.description || "Escenas tomadas de biografías incluidas en Atlas.")}</p>${mood.reflection ? `<blockquote>${esc(mood.reflection)}</blockquote>` : ""}</header><div class="saints-passage-list">${passages.map((passage,index) => passageCard(passage,index)).join("")}</div></main>`);
  }

  function passageCard(passage, index) {
    const doc = root.data.documentMap.get(passage.documentId);
    const title = passage.saint || passage.title || doc?.title || "Vida de un santo";
    const query = passage.query || String(passage.excerpt || "").replace(/\s+/g," ").trim().slice(0,90);
    passage = { ...passage, excerpt: passage.excerptSpanish || passage.excerpt };
    const points = passage.summaryPoints || [];
    return `<article class="saint-passage"><span class="passage-number">${String(index + 1).padStart(2,"0")}</span><div class="saint-passage-content"><span class="eyebrow">${esc(passage.context || passage.theme || "Pasaje biográfico en castellano")}</span><h3>${esc(title)}</h3><div class="saint-passage-frame"><blockquote>${esc(passage.excerpt || passage.text || "")}</blockquote><aside class="saint-passage-summary"><span class="eyebrow">Tres claves</span><ol>${points.map(point => `<li><b>${esc(point.label)}</b><p>${esc(point.text)}</p></li>`).join("")}</ol></aside></div>${passage.takeaway ? `<p class="passage-takeaway"><b>Para mirar despacio</b>${esc(passage.takeaway)}</p>` : ""}<div class="button-row">${doc ? `<a class="primary-button" href="#/reader/${encodeURIComponent(doc.id)}?q=${encodeURIComponent(query)}">Leer en contexto</a>` : ""}${passage.sourceUrl ? `<a class="secondary-button" href="${esc(passage.sourceUrl)}" target="_blank" rel="noopener">Fuente externa ↗</a>` : ""}</div><small>${esc(passage.sourcePath || doc?.file || "Fuente biográfica identificada")}</small></div></article>`;
  }

  function guidePage(id, title, intro) {
    const data = guides()[id] || (guides().guides || []).find(item => item.id === id) || {};
    const steps = id === "mass"
      ? (data.parts || []).flatMap(part => (part.moments || []).map(moment => ({ ...moment, section: part.title, sectionPurpose: part.purpose })))
      : (data.sections || data.steps || []).flatMap(section => section.steps?.length ? section.steps.map(step => ({ ...step, section: section.title, sectionPurpose: section.intro })) : [section]);
    const faq = data.faq || data.questions || [];
    const quick = data.quickStart || [];
    const formulas = data.formulas || [];
    return shell(id, `<main class="page guide-reading"><header><span class="eyebrow">Guía práctica · Atlas</span><h2>${esc(data.title || title)}</h2><p>${esc(data.subtitle || data.introduction || data.description || intro)}</p>${id === "mass" ? `<label class="liturgy-switch"><input type="checkbox" data-liturgical-explanation><span>${esc(data.controls?.liturgicalExplanation?.label || "Activar explicación litúrgica")}</span></label>` : ""}</header>${quick.length ? `<aside class="guide-quick"><span class="eyebrow">En breve</span><ol>${quick.map(item => `<li>${esc(item)}</li>`).join("")}</ol></aside>` : ""}${formulas.length ? `<section class="guide-formulas"><div class="section-head"><div><h2>Fórmulas que puedes usar</h2><p>No necesitas memorizarlas literalmente: sirven como apoyo.</p></div></div><div>${formulas.map(item => `<article><b>${esc(item.label)}</b><blockquote>${esc(item.text)}</blockquote></article>`).join("")}</div></section>` : ""}<div class="guide-steps">${steps.map((step,index) => `<article><span>${String(index + 1).padStart(2,"0")}</span><div>${step.section ? `<small class="guide-section-name">${esc(step.section)}</small>` : ""}<h3>${esc(step.title || step.name || `Paso ${index + 1}`)}</h3><p>${esc(step.body || step.text || step.visibleSummary || step.summary || step.description || step.sectionPurpose || "")}</p>${step.formula || step.response ? `<blockquote>${esc(step.formula || step.response)}</blockquote>` : ""}${step.explanation || step.liturgicalExplanation ? `<aside class="liturgical-explanation">${esc(step.explanation || step.liturgicalExplanation)}</aside>` : ""}${step.participation ? `<p class="guide-participation"><b>Para participar:</b> ${esc(step.participation)}</p>` : ""}${(step.items || []).length ? `<ul>${step.items.map(item => `<li>${esc(typeof item === "string" ? item : item.text || item.title)}</li>`).join("")}</ul>` : ""}</div></article>`).join("")}</div>${faq.length ? `<section class="guide-faq"><div class="section-head"><div><h2>Dudas frecuentes</h2><p>Respuestas orientativas y breves.</p></div></div>${faq.map(item => `<details><summary>${esc(item.question || item.title)}</summary><p>${esc(item.answer || item.text)}</p></details>`).join("")}</section>` : ""}<p class="guide-disclaimer">${esc((data.notes || []).join(" ") || data.disclaimer || guides().disclaimer || "Orientación general: consulta las normas litúrgicas y la ayuda pastoral adecuada cuando corresponda.")}</p></main>`);
  }

  function songbookPage(route) {
    const data = songbook();
    const requested = route.query.get("category") || "all";
    const songs = (data.songs || data.items || []).filter(song => requested === "all" || song.category === requested || song.categories?.includes(requested));
    const categories = data.categories || [...new Set((data.songs || []).flatMap(song => song.categories || [song.category]).filter(Boolean))].map(id => ({ id, label: id }));
    return shell("songbook", `<main class="page songbook-page"><header><span class="eyebrow">Repertorio para celebrar y orar</span><h2>Cancionero católico</h2><p>Busca por momento, tradición o idioma. Atlas muestra letras completas únicamente cuando son de dominio público o han sido incorporadas con permiso; para repertorio moderno enlaza la fuente autorizada.</p></header><div class="chip-row songbook-filters"><a class="chip ${requested === "all" ? "active" : ""}" href="#/spiritual/songbook">Todos</a>${categories.map(category => { const id=typeof category === "string" ? category : category.id; const label=typeof category === "string" ? category : category.label || category.name; return `<a class="chip ${requested === id ? "active" : ""}" href="#/spiritual/songbook?category=${encodeURIComponent(id)}">${esc(label)}</a>`; }).join("")}</div><div class="song-grid">${songs.map(song => { const media=song.officialMediaUrl || song.videoUrl || song.url || song.sourceUrl; const mayShowLyrics=(song.publicDomain || song.rights === "public-domain") && song.lyrics; return `<article class="song-card"><span class="eyebrow">${esc((song.categories || [song.category]).filter(Boolean).join(" · "))}</span><h3>${esc(song.title)}</h3><p>${esc(song.artist || song.tradition || "Tradicional")}${song.language ? ` · ${esc(song.language)}` : ""}</p>${song.useNote ? `<p>${esc(song.useNote)}</p>` : ""}${mayShowLyrics ? `<details><summary>Ver letra completa</summary><pre>${esc(song.lyrics)}</pre></details>` : `<p class="song-rights">Letra no reproducida en Atlas. Ábrela en su fuente autorizada.</p>`}<div class="button-row">${media ? `<a class="secondary-button" href="${esc(media)}" target="_blank" rel="noopener">Escuchar / fuente ↗</a>` : ""}</div></article>`; }).join("") || root.library.empty("No hay cantos en esta categoría", "Prueba otra selección.")}</div></main>`);
  }

  function escrivaPage() {
    const data = guides().escrivaOrg || guides().escriva || {};
    const sections = data.sections || data.areas || [];
    return shell("escriva", `<main class="page escriva-page"><header><span class="eyebrow">Fuente oficial</span><h2>${esc(data.title || "escriva.org dentro de Atlas")}</h2><p>${esc(data.subtitle || data.description || "Accesos para leer las obras de san Josemaría y localizar textos por tema desde su fuente oficial.")}</p><a class="primary-button" href="${esc(data.officialBaseUrl || data.url || "https://escriva.org/es/")}" target="_blank" rel="noopener">Abrir escriva.org ↗</a></header><div class="escriva-grid">${sections.map(section => `<article><span>${esc(section.mark || "E")}</span><h3>${esc(section.title || section.name)}</h3><p>${esc(section.description || section.text || "")}</p>${section.url ? `<a href="${esc(section.url)}" target="_blank" rel="noopener">Abrir →</a>` : ""}</article>`).join("")}</div><section class="escriva-search-card"><h3>Buscar también en tus documentos</h3><p>Atlas puede localizar una expresión literal en las obras indexadas de san Josemaría.</p><button class="primary-button" data-action="search" data-search-library-preset="san-josemaria">Abrir búsqueda textual</button></section></main>`);
  }

  function routesPage() {
    const items = routes();
    return shell("routes", `<main class="page saints-routes"><header><span class="eyebrow">Recorridos guiados</span><h2>Rutas espirituales entre santos.</h2><p>Cada etapa enlaza una vida o una fuente concreta y propone una pregunta para continuar.</p></header><div class="route-grid">${items.map(route => { const steps=route.steps || route.stages || []; return `<article class="route-card"><span class="eyebrow">${steps.length} etapas</span><h3>${esc(route.title)}</h3><p>${esc(route.description || "")}</p><ol>${steps.map(step => { const id=step.documentId || step.sourceDocumentId; return `<li>${id ? `<a href="#/reader/${encodeURIComponent(id)}${step.sourceLocator?.queries?.[0] ? `?q=${encodeURIComponent(step.sourceLocator.queries[0])}` : ""}"><b>${esc(step.saint || step.title)}</b><small>${esc(step.reflectionQuestion || step.question || step.intro || step.text || "Abrir biografía")}</small></a>` : `<span><b>${esc(step.saint || step.title)}</b><small>${esc(step.reflectionQuestion || step.question || step.text || "")}</small></span>`}</li>`; }).join("")}</ol></article>`; }).join("") || root.library.empty("Las rutas se están preparando", "Los pasajes seguirán disponibles por experiencia.")}</div></main>`);
  }

  function render(route) {
    const section = route.segments[1] || "";
    if (!section) return home();
    if (section === "saints" && route.segments[2]) return moodDetail(decodeURIComponent(route.segments.slice(2).join("/")));
    if (section === "saints") return saintsIndex();
    if (section === "confession") return guidePage("confession", "Guía para preparar la confesión", "Preparación, estructura, fórmulas y dudas frecuentes.");
    if (section === "mass") return guidePage("mass", "Comprender la Santa Misa", "Qué sucede en cada momento y por qué.");
    if (section === "songbook") return songbookPage(route);
    if (section === "escriva") return escrivaPage();
    if (section === "routes") return routesPage();
    return home();
  }

  document.addEventListener("input", event => {
    if (!event.target.matches("[data-saints-mood-search]")) return;
    const query = event.target.value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLocaleLowerCase("es");
    document.querySelectorAll("[data-mood-search]").forEach(card => { const text=card.dataset.moodSearch.normalize("NFD").replace(/\p{Diacritic}/gu,""); card.hidden = Boolean(query && !text.includes(query)); });
  });
  document.addEventListener("change", event => {
    if (event.target.matches("[data-liturgical-explanation]")) document.querySelector(".guide-reading")?.classList.toggle("show-liturgical-explanations", event.target.checked);
  });

  root.spiritual = { render };
})();
