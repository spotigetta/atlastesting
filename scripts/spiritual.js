(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const moods = () => window.ATLAS_SAINTS_MOODS?.moods || window.ATLAS_SAINTS_MOODS?.tags || [];
  const guides = () => window.ATLAS_SPIRITUAL_GUIDES || {};
  const songbook = () => window.ATLAS_SONGBOOK || { songs: [], categories: [] };
  const routes = () => window.ATLAS_SAINTS_ROUTES?.routes || [];
  const timelines = () => window.ATLAS_SAINTS_TIMELINES?.timelines || [];
  const josemariaExperiences = () => window.ATLAS_JOSEMARIA_EXPERIENCES?.experiences || [];
  const gospelMeditations = () => window.ATLAS_GOSPEL_MEDITATIONS || { themes: [], meditations: [] };

  const windows1252 = { "€":128,"‚":130,"ƒ":131,"„":132,"…":133,"†":134,"‡":135,"ˆ":136,"‰":137,"Š":138,"‹":139,"Œ":140,"Ž":142,"‘":145,"’":146,"“":147,"”":148,"•":149,"–":150,"—":151,"˜":152,"™":153,"š":154,"›":155,"œ":156,"ž":158,"Ÿ":159 };
  function repairEncoding(value) {
    let text = String(value || "");
    for (let pass = 0; pass < 2 && /(?:Ã.|Â.|â.|ðŸ)/.test(text); pass++) {
      const bytes = [];
      let compatible = true;
      for (const character of text) {
        const code = character.codePointAt(0);
        if (code <= 255) bytes.push(code);
        else if (windows1252[character] !== undefined) bytes.push(windows1252[character]);
        else { compatible = false; break; }
      }
      if (!compatible) break;
      const repaired = new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
      if ((repaired.match(/(?:Ã.|Â.|â.|ðŸ)/g) || []).length >= (text.match(/(?:Ã.|Â.|â.|ðŸ)/g) || []).length) break;
      text = repaired;
    }
    return text;
  }
  function readablePassage(value) {
    return repairEncoding(value)
      .replace(/([\p{L}])-[ \t]*\r?\n[ \t]*([\p{Ll}])/gu, "$1$2")
      .replace(/^[ \t]*(?:Digitized by.*|Project Gutenberg.*|[-—–]\s*\d{1,4}\s*[-—–]|\d{1,4})[ \t]*$/gim, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\r?\n(?:[ \t]*\r?\n){2,}/g, "\n\n")
      .trim();
  }

  function shell(active, body) {
    const items = [["","Inicio"],["saints","Cómo vivieron"],["timeline","Cronología"],["routes","Rutas de santos"],["gospel","Evangelio"],["confession","Confesión"],["mass","La Misa"],["songbook","Cancionero"],["escriva","escriva.org"]];
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
      ,["gospel","Medita el Evangelio para…","Tristeza, oración, fiat, confianza y prueba","Escenas del Evangelio para iluminar lo que vives, desde la serie oficial del Opus Dei."]
      ,["timeline","Vidas en el tiempo",`${timelines().length} biografías con hechos fechados`,"Compara varias vidas a la vez o recorre la cronología de un santo."]
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
    const originalExcerpt = readablePassage(passage.originalExcerpt || passage.excerpt || "");
    const translated = Boolean(passage.translation && passage.translation.method !== "fuente original castellana");
    passage = { ...passage, excerpt: readablePassage(passage.excerptSpanish || passage.excerpt) };
    const points = passage.summaryPoints || [];
    const words = passage.excerpt.split(/\s+/).filter(Boolean).length;
    return `<article class="saint-passage"><span class="passage-number">${String(index + 1).padStart(2,"0")}</span><div class="saint-passage-content"><div class="passage-kicker"><span class="eyebrow">${esc(repairEncoding(passage.context || passage.theme || "Pasaje biográfico en castellano"))}</span><small>${words} palabras · ${Math.max(1, Math.ceil(words / 210))} min</small></div><h3>${esc(repairEncoding(title))}</h3><div class="saint-passage-frame"><div class="saint-passage-reading"><blockquote>${esc(passage.excerpt || passage.text || "")}</blockquote>${translated && originalExcerpt ? `<details class="passage-original"><summary>Ver el texto original</summary><blockquote lang="${esc(passage.language || "")}">${esc(originalExcerpt)}</blockquote></details>` : ""}</div><aside class="saint-passage-summary"><span class="eyebrow">Tres claves</span><ol>${points.map(point => `<li><b>${esc(repairEncoding(point.label))}</b><p>${esc(readablePassage(point.text))}</p></li>`).join("")}</ol>${translated ? `<small>Traducción local al castellano. El original se conserva íntegro.</small>` : `<small>Fuente originalmente en castellano.</small>`}</aside></div>${passage.takeaway ? `<p class="passage-takeaway"><b>Para mirar despacio</b>${esc(readablePassage(passage.takeaway))}</p>` : ""}<div class="button-row">${doc ? `<a class="primary-button" href="#/reader/${encodeURIComponent(doc.id)}?q=${encodeURIComponent(query)}">Leer en contexto</a>` : ""}${passage.sourceUrl ? `<a class="secondary-button" href="${esc(passage.sourceUrl)}" target="_blank" rel="noopener">Fuente externa ↗</a>` : ""}</div><small>${esc(repairEncoding(passage.sourcePath || doc?.file || "Fuente biográfica identificada"))}</small></div></article>`;
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
    const withLyrics = songs.filter(song => Boolean(song.lyrics) && Boolean(song.publicDomain || String(song.rights || "").includes("public-domain"))).length;
    return shell("songbook", `<main class="page songbook-page"><header><span class="eyebrow">Repertorio para celebrar y orar</span><h2>Cancionero católico</h2><p>Busca por momento, tradición o idioma. Atlas muestra dentro de la app la letra completa cuando es de dominio público o está autorizada; las obras modernas conservan enlace a su publicación oficial.</p><aside class="songbook-policy"><span>${withLyrics}</span><div><b>letras completas disponibles en esta selección</b><p>${esc(data.editorialPolicy?.copyright || "Las letras se muestran únicamente cuando su situación jurídica lo permite.")}</p></div></aside></header><div class="chip-row songbook-filters"><a class="chip ${requested === "all" ? "active" : ""}" href="#/spiritual/songbook">Todos</a>${categories.map(category => { const id=typeof category === "string" ? category : category.id; const label=typeof category === "string" ? category : category.label || category.name; return `<a class="chip ${requested === id ? "active" : ""}" href="#/spiritual/songbook?category=${encodeURIComponent(id)}">${esc(label)}</a>`; }).join("")}</div><div class="song-grid">${songs.map(song => { const officialMedia=song.officialMediaUrl || song.videoUrl || song.url || song.sourceUrl; const media=officialMedia || song.searchUrl; const videoId=String(officialMedia||"").match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([\w-]{11})/)?.[1]||""; const mayShowLyrics=Boolean(song.lyrics) && Boolean(song.publicDomain || String(song.rights || "").includes("public-domain")); return `<article class="song-card ${mayShowLyrics ? "has-lyrics" : "protected-lyrics"}"><span class="eyebrow">${esc((song.categories || [song.category]).filter(Boolean).join(" · "))}</span><h3>${esc(song.title)}</h3><p>${esc(song.artist || song.tradition || "Tradicional")}${song.language ? ` · ${esc(song.language)}` : ""}</p>${song.useNote ? `<p>${esc(song.useNote)}</p>` : ""}${mayShowLyrics ? `<details class="song-lyrics"><summary><span>Ver letra completa</span><small>Texto de dominio público</small></summary><pre lang="${esc(song.language || "")}">${esc(song.lyrics)}</pre>${song.lyricsSource ? `<p>${esc(song.lyricsSource)}</p>` : ""}</details>` : `<p class="song-rights"><b>Letra no reproducida dentro de Atlas</b><br>Esta obra moderna conserva derechos. Puedes escucharla o abrir la publicación del titular; si el autor ofrece allí la letra, consúltala en esa fuente autorizada.</p>`}<div class="button-row">${videoId ? `<button class="primary-button" data-play-youtube="${esc(videoId)}" data-video-title="${esc(song.title)}" data-video-url="${esc(officialMedia)}">▶ Escuchar en Atlas</button>` : ""}${media ? `<a class="secondary-button" href="${esc(media)}" target="_blank" rel="noopener">${officialMedia ? "Fuente oficial" : "Buscar interpretación"} ↗</a>` : ""}</div></article>`; }).join("") || root.library.empty("No hay cantos en esta categoría", "Prueba otra selección.")}</div></main>`);
  }

  function escrivaPage() {
    const data = guides().escrivaOrg || guides().escriva || {};
    const sections = data.sections || data.areas || [];
    return shell("escriva", `<main class="page escriva-page"><header><span class="eyebrow">Fuente oficial</span><h2>${esc(data.title || "escriva.org dentro de Atlas")}</h2><p>${esc(data.subtitle || data.description || "Accesos para leer las obras de san Josemaría y localizar textos por tema desde su fuente oficial.")}</p><a class="primary-button" href="${esc(data.officialBaseUrl || data.url || "https://escriva.org/es/")}" target="_blank" rel="noopener">Abrir escriva.org ↗</a></header><a class="josemaria-interior-entry" href="#/spiritual/escriva/interior"><span>30 experiencias contemporáneas</span><h3>La vida interior de san Josemaría</h3><p>Angustia, cansancio, soledad, paz, incomprensión, no llegar a todo, rutina, libertad y recomenzar desde los tres volúmenes de <em>El Fundador</em>.</p><b>Buscar una experiencia →</b></a><div class="escriva-grid">${sections.map(section => `<article><span>${esc(section.mark || "E")}</span><h3>${esc(section.title || section.name)}</h3><p>${esc(section.description || section.text || "")}</p>${section.url ? `<a href="${esc(section.url)}" target="_blank" rel="noopener">Abrir →</a>` : ""}</article>`).join("")}</div><section class="escriva-search-card"><h3>Buscar también en tus documentos</h3><p>Atlas puede localizar una expresión literal en las obras indexadas de san Josemaría.</p><button class="primary-button" data-action="search" data-search-library-preset="san-josemaria">Abrir búsqueda textual</button></section></main>`);
  }

  function josemariaInterior(id="") {
    const items=josemariaExperiences();
    if(id){const experience=items.find(item=>item.id===id);if(!experience)return escrivaPage();return shell("escriva",`<main class="page mood-detail"><header class="mood-hero"><a href="#/spiritual/escriva/interior">← Todas las experiencias</a><span class="eyebrow">El Fundador · ${experience.passages.length} pasajes</span><h2>${esc(experience.label)}</h2><p>${esc(experience.description)}</p></header><div class="saints-passage-list">${experience.passages.map((passage,index)=>passageCard({...passage,saint:"San Josemaría"},index)).join("")}</div></main>`)}
    return shell("escriva",`<main class="page saints-mode"><header class="saints-hero"><span class="eyebrow">El Fundador · tres volúmenes</span><h2>Una vida interior muy humana.</h2><p>Busca una experiencia cotidiana y abre escenas concretas de la biografía de san Josemaría.</p><label class="saints-search">⌕<input type="search" data-spiritual-tag-search placeholder="Escribe: burnout, angustia, paz, rutina…"></label></header><div class="saints-tag-grid">${items.map(item=>`<a class="saints-tag" data-spiritual-search="${esc(`${item.label} ${item.description} ${item.keywords?.join(" ")}`.toLocaleLowerCase("es"))}" href="#/spiritual/escriva/interior/${encodeURIComponent(item.id)}"><span>J</span><div><h4>${esc(item.label)}</h4><p>${esc(item.description)}</p><small>${item.passages.length} pasajes de El Fundador</small></div></a>`).join("")}</div></main>`);
  }

  function timelinePage(route) {
    const all=timelines(),requested=(route.query.get("saints")||"").split(",").filter(Boolean),selected=requested.length?all.filter(item=>requested.includes(item.documentId)):all.slice(0,6);
    const min=Math.min(...selected.map(x=>x.startYear)),max=Math.max(...selected.map(x=>x.endYear)),span=Math.max(1,max-min);
    return shell("timeline",`<main class="page saints-timeline-page"><header class="saints-hero"><span class="eyebrow">${all.length} vidas fechadas</span><h2>Los santos, en simultáneo.</h2><p>Marca u oculta vidas para comparar épocas. Toca un nombre o un hecho para abrir su cronología completa.</p><details class="timeline-picker"><summary>Elegir santos · ${selected.length} visibles</summary><label class="saints-search">⌕<input type="search" data-timeline-search placeholder="Buscar santo"></label><div>${all.map(item=>`<label data-timeline-option="${esc(item.saint.toLocaleLowerCase("es"))}"><input type="checkbox" data-timeline-toggle value="${esc(item.documentId)}" ${selected.some(current=>current.documentId===item.documentId)?"checked":""}><span>${esc(item.saint)}</span><small>${item.startYear}–${item.endYear}</small></label>`).join("")}</div></details></header><div class="timeline-scale"><span>${min}</span><span>${Math.round(min+span/2)}</span><span>${max}</span></div><div class="saints-parallel-timeline">${selected.map(item=>`<article><a href="#/spiritual/timeline/${encodeURIComponent(item.documentId)}"><b>${esc(item.saint)}</b><small>${item.startYear}–${item.endYear}</small></a><div class="life-track">${item.events.map(event=>`<a href="#/reader/${encodeURIComponent(item.documentId)}?q=${encodeURIComponent(event.query)}" style="--event-x:${((event.year-min)/span*100).toFixed(2)}%" title="${esc(event.summary)}"><i></i><span>${event.year}</span></a>`).join("")}</div></article>`).join("")}</div></main>`);
  }

  function timelineDetail(documentId){const item=timelines().find(current=>current.documentId===documentId);if(!item)return timelinePage({query:new URLSearchParams()});return shell("timeline",`<main class="page saint-life-detail"><header><a href="#/spiritual/timeline">← Cronología comparada</a><span class="eyebrow">${item.startYear}–${item.endYear} · ${item.events.length} hechos</span><h2>${esc(item.saint)}</h2><p>Los hechos se extraen de la biografía local. Abre cada escena para leerla en contexto.</p></header><ol>${item.events.map(event=>`<li><time>${event.year}</time><div><h3>${esc(event.title)}</h3><p>${esc(event.summary)}</p><a href="#/reader/${encodeURIComponent(item.documentId)}?q=${encodeURIComponent(event.query)}">Leer este momento →</a></div></li>`).join("")}</ol></main>`)}

  function routesPage() {
    const items = routes();
    return shell("routes", `<main class="page saints-routes"><header><span class="eyebrow">Recorridos guiados</span><h2>Rutas espirituales entre santos.</h2><p>Cada etapa enlaza una vida o una fuente concreta y propone una pregunta para continuar.</p></header><div class="route-grid">${items.map(route => { const steps=route.steps || route.stages || []; return `<article class="route-card"><span class="eyebrow">${steps.length} etapas</span><h3>${esc(route.title)}</h3><p>${esc(route.description || "")}</p><ol>${steps.map(step => { const id=step.documentId || step.sourceDocumentId; return `<li>${id ? `<a href="#/reader/${encodeURIComponent(id)}${step.sourceLocator?.queries?.[0] ? `?q=${encodeURIComponent(step.sourceLocator.queries[0])}` : ""}"><b>${esc(step.saint || step.title)}</b><small>${esc(step.reflectionQuestion || step.question || step.intro || step.text || "Abrir biografía")}</small></a>` : `<span><b>${esc(step.saint || step.title)}</b><small>${esc(step.reflectionQuestion || step.question || step.text || "")}</small></span>`}</li>`; }).join("")}</ol></article>`; }).join("") || root.library.empty("Las rutas se están preparando", "Los pasajes seguirán disponibles por experiencia.")}</div></main>`);
  }

  function gospelPage(route) {
    const data = gospelMeditations();
    const selected = route.query.get("theme") || "all";
    const query = (route.query.get("q") || "").trim().toLocaleLowerCase("es");
    const items = (data.meditations || []).filter(item =>
      (selected === "all" || item.categoryIds?.includes(selected)) &&
      (!query || `${item.title} ${item.description}`.toLocaleLowerCase("es").includes(query))
    );
    const today = new Date().toISOString().slice(0, 10);
    const daily = (window.ATLAS_OPUSDEI_MEDITATIONS?.records || []).find(item => item.date === today);
    const filters = (data.themes || []).map(theme => `<a class="${selected === theme.id ? "active" : ""}" href="#/spiritual/gospel?theme=${encodeURIComponent(theme.id)}"><i>${esc(theme.icon)}</i><span>${esc(theme.label)}</span><small>${theme.count || 0}</small></a>`).join("");
    const cards = items.map(item => `<article class="gospel-card">${item.image ? `<div class="gospel-card-image" style="background-image:url('${esc(item.image)}')"></div>` : ""}<div><span class="eyebrow">${esc((item.categoryIds || []).map(id => data.themes?.find(theme => theme.id === id)?.label).filter(Boolean).slice(0, 3).join(" · "))}</span><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><a class="primary-button" href="${esc(item.url)}" target="_blank" rel="noopener">Meditar en Opus Dei ↗</a></div></article>`).join("");
    return shell("gospel", `<main class="page gospel-meditations"><header class="gospel-hero"><span class="eyebrow">Evangelio contemplado · fuente oficial</span><h2>Medita el Evangelio para…</h2><p>Elige lo que estás viviendo. Atlas te conduce a una escena evangélica y conserva el enlace a la meditación completa del Opus Dei.</p>${daily ? `<a class="gospel-today" href="${esc(daily.officialUrl || daily.url)}" target="_blank" rel="noopener"><span>Hoy · ${esc(today)}</span><b>${esc(daily.title || "Meditación del Evangelio del día")}</b><small>Abrir en la fuente oficial ↗</small></a>` : ""}</header><form class="gospel-search" data-gospel-search><input type="search" name="q" value="${esc(route.query.get("q") || "")}" placeholder="Busca una escena, una dificultad, una persona…"><button>Buscar</button></form><div class="gospel-theme-grid"><a class="${selected === "all" ? "active" : ""}" href="#/spiritual/gospel"><i>∞</i><span>ver todas</span></a>${filters}</div><div class="gospel-card-grid">${cards || root.library.empty("No hay meditaciones con estos filtros", "Prueba otra experiencia o borra la búsqueda.")}</div><p class="guide-disclaimer">Atlas muestra título, resumen editorial y enlace; la meditación completa permanece en su fuente oficial.</p></main>`);
  }

  function render(route) {
    const section = route.segments[1] || "";
    if (!section) return home();
    if (section === "saints" && route.segments[2]) return moodDetail(decodeURIComponent(route.segments.slice(2).join("/")));
    if (section === "saints") return saintsIndex();
    if (section === "timeline" && route.segments[2]) return timelineDetail(decodeURIComponent(route.segments[2]));
    if (section === "timeline") return timelinePage(route);
    if (section === "confession") return guidePage("confession", "Guía para preparar la confesión", "Preparación, estructura, fórmulas y dudas frecuentes.");
    if (section === "mass") return guidePage("mass", "Comprender la Santa Misa", "Qué sucede en cada momento y por qué.");
    if (section === "songbook") return songbookPage(route);
    if (section === "escriva" && route.segments[2] === "interior") return josemariaInterior(decodeURIComponent(route.segments[3] || ""));
    if (section === "escriva") return escrivaPage();
    if (section === "routes") return routesPage();
    if (section === "gospel") return gospelPage(route);
    return home();
  }

  document.addEventListener("input", event => {
    if(event.target.matches("[data-timeline-search]")){const query=event.target.value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLocaleLowerCase("es");document.querySelectorAll("[data-timeline-option]").forEach(item=>item.hidden=Boolean(query&&!item.dataset.timelineOption.normalize("NFD").replace(/\p{Diacritic}/gu,"").includes(query)));return}
    if(event.target.matches("[data-spiritual-tag-search]")){const query=event.target.value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLocaleLowerCase("es");document.querySelectorAll("[data-spiritual-search]").forEach(card=>card.hidden=Boolean(query&&!card.dataset.spiritualSearch.normalize("NFD").replace(/\p{Diacritic}/gu,"").includes(query)));return}
    if (!event.target.matches("[data-saints-mood-search]")) return;
    const query = event.target.value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLocaleLowerCase("es");
    document.querySelectorAll("[data-mood-search]").forEach(card => { const text=card.dataset.moodSearch.normalize("NFD").replace(/\p{Diacritic}/gu,""); card.hidden = Boolean(query && !text.includes(query)); });
  });
  document.addEventListener("change", event => {
    if(event.target.matches("[data-timeline-toggle]")){const ids=[...document.querySelectorAll("[data-timeline-toggle]:checked")].map(input=>input.value).slice(0,12);location.hash=`/spiritual/timeline${ids.length?`?saints=${encodeURIComponent(ids.join(","))}`:""}`;return}
    if (event.target.matches("[data-liturgical-explanation]")) document.querySelector(".guide-reading")?.classList.toggle("show-liturgical-explanations", event.target.checked);
  });
  document.addEventListener("submit", event => {
    if (!event.target.matches("[data-gospel-search]")) return;
    event.preventDefault();
    const query = new FormData(event.target).get("q")?.trim() || "";
    location.hash = `/spiritual/gospel${query ? `?q=${encodeURIComponent(query)}` : ""}`;
  });

  root.spiritual = { render };
})();
