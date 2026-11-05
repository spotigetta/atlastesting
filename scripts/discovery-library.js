(function () {
  "use strict";
  const A = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  let data = null, pending = null, error = null;

  function load() {
    if (data) return Promise.resolve(data);
    if (pending) return pending;
    error = null;
    const fetchData = window.AtlasRuntime?.fetchJson
      ? window.AtlasRuntime.fetchJson("data/discovery-library.json")
      : fetch("data/discovery-library.json").then(response => { if (!response.ok) throw new Error("No disponible"); return response.json(); });
    pending = fetchData.then(payload => {
      if (payload.schemaVersion !== 1 || !Array.isArray(payload.topics)) throw new Error("Formato no compatible");
      data = payload;
      window.dispatchEvent(new CustomEvent("atlas:discovery-ready"));
      return data;
    }).catch(reason => {
      error = reason;
      window.dispatchEvent(new CustomEvent("atlas:discovery-error"));
      throw reason;
    }).finally(() => { pending = null; });
    return pending;
  }

  function visibleDocument(id) {
    const doc = A.data?.documentMap?.get(id);
    if (!doc) return null;
    const library = doc.library || A.data.libraryMap.get(doc.libraryId);
    if (!library) return null;
    if ([library.unlockFeature, doc.unlockFeature].some(feature => feature && !A.storage.isFeatureUnlocked(feature))) return null;
    return doc;
  }
  function visibleTopics(group) {
    return (data?.topics || []).filter(topic => (!group || topic.group === group) && topic.sources.some(source => visibleDocument(source.id)));
  }
  function topicUrl(topic, group = "") {
    return `#/mapa-tematico?${group ? `library=${encodeURIComponent(group)}&` : ""}topic=${encodeURIComponent(topic.id)}`;
  }
  function status() {
    if (error) return `<div class="discovery-status" role="alert"><h2>No se pudo cargar el mapa</h2><p>Puedes seguir leyendo los documentos o volver a intentarlo.</p><button type="button" class="secondary-button" data-discovery-retry>Volver a intentar</button><a href="#/biblioteca">Abrir biblioteca</a></div>`;
    if (!pending) load().catch(() => {});
    return `<div class="discovery-status" role="status"><p>Cargando temas y fuentes…</p></div>`;
  }
  function tile(topic, index, group) {
    const sources = topic.sources.filter(source => visibleDocument(source.id));
    return `<a class="discovery-topic topic-${esc(topic.tone)} shape-${esc(topic.shape)}" href="${esc(topicUrl(topic, group))}"><div class="discovery-topic-art" aria-hidden="true"><i></i><i></i><i></i></div><span class="discovery-topic-number">${String(index + 1).padStart(2, "0")}</span><div class="discovery-topic-copy"><small>${topic.group === "clasicos" ? "Los clásicos" : esc(A.data.libraryMap.get(sources[0].libraryId)?.short || "Biblioteca")}</small><h3>${esc(topic.title)}</h3><p>${esc(topic.description)}</p><span class="discovery-topic-question">${esc(topic.question)}</span><b>Explorar tema</b></div></a>`;
  }
  function categoryBrowser(group) {
    const docs = [...(A.data?.documents || [])].filter(doc => (!group || doc.libraryId === group) && visibleDocument(doc.id));
    const categories = new Map();
    docs.forEach(doc => { if (doc.category) categories.set(doc.category, (categories.get(doc.category) || 0) + 1); });
    return `<details class="discovery-categories"><summary>Explorar las categorías del catálogo <span>${categories.size}</span></summary><div>${[...categories].sort((a, b) => b[1] - a[1]).map(([category, count]) => `<a href="#/mapa-tematico?${group ? `library=${encodeURIComponent(group)}&` : ""}category=${encodeURIComponent(category)}"><span>${esc(category)}</span><small>${count} textos</small></a>`).join("")}</div></details>`;
  }
  function documentList(category, group) {
    const docs = (A.data?.documents || []).filter(doc => (!group || doc.libraryId === group) && doc.category === category && visibleDocument(doc.id));
    return `<section class="discovery-category-results"><a class="discovery-back" href="#/mapa-tematico${group ? `?library=${encodeURIComponent(group)}` : ""}">Volver al mapa</a><header><small>Categoría del catálogo</small><h2>${esc(category)}</h2><p>${docs.length} textos disponibles en Atlas.</p></header><div class="discovery-reading-list">${docs.map(doc => `<a href="#/reader/${encodeURIComponent(doc.id)}"><small>${esc(doc.library?.short || A.data.libraryMap.get(doc.libraryId)?.short)}</small><h3>${esc(doc.title)}</h3><span>${esc(doc.author || doc.file?.replace(/\.md$/i, "") || "Leer documento")}</span><b>Leer</b></a>`).join("") || "<p>No hay documentos disponibles en esta categoría.</p>"}</div></section>`;
  }
  function sourceCard(source) {
    return `<a class="discovery-source" href="${esc(source.readerUrl)}"><div class="discovery-book-spine" aria-hidden="true"></div><div><small>${esc(source.author)}</small><h3>${esc(source.title)}</h3>${source.location ? `<p>${esc(source.location)}</p>` : ""}<b>${source.quote ? "Leer el pasaje" : "Leer la obra"}</b></div></a>`;
  }
  function detail(topic, group) {
    const sources = topic.sources.filter(source => visibleDocument(source.id));
    const related = (topic.related || []).filter(source => visibleDocument(source.id));
    const lib = A.data.libraryMap.get(sources[0].libraryId);
    const next = visibleTopics(group).filter(other => other.id !== topic.id).slice(0, 3);
    return `<article class="discovery-detail topic-${esc(topic.tone)}"><a class="discovery-back" href="#/mapa-tematico${group ? `?library=${encodeURIComponent(group)}` : ""}">Volver al mapa</a><header class="discovery-detail-head"><small>${topic.group === "clasicos" ? "Los clásicos · recorrido editorial" : "Biblioteca · recorrido editorial"}</small><h1>${esc(topic.title)}</h1><p>${esc(topic.description)}</p><div class="discovery-detail-art shape-${esc(topic.shape)}" aria-hidden="true"><i></i><i></i><i></i></div></header><section class="discovery-answer"><span>Una pregunta para empezar</span><h2>${esc(topic.question)}</h2><p>${esc(topic.answer)}</p><small>Respuesta editorial de Atlas, apoyada en los pasajes siguientes.</small></section><section class="discovery-citations" aria-label="Pasajes que sustentan la respuesta">${sources.map(source => `<figure><blockquote ${source.language ? `lang="${esc(source.language)}"` : ""}>${esc(source.quote)}</blockquote><figcaption>${esc(source.author)} · <cite>${esc(source.title)}</cite> · ${esc(source.location)}${source.language === "en" ? "<small>Texto conservado en inglés en esta fuente.</small>" : ""}<a href="${esc(source.readerUrl)}">Comprobar en el texto</a></figcaption></figure>`).join("")}</section><section class="discovery-works"><h2>Leer las fuentes</h2><div>${sources.map(sourceCard).join("")}</div></section>${lib?.notebookUrl ? `<section class="discovery-ask"><div><small>IA sobre esta biblioteca</small><h2>Continúa la pregunta en ${esc(lib.short)}</h2><p>Se abrirá NotebookLM. La pregunta se copia para que puedas pegarla allí; la respuesta la genera ese cuaderno.</p></div><button type="button" class="primary-button" data-discovery-ask="${esc(topic.id)}">Copiar pregunta y abrir NotebookLM</button><details><summary>Ver la pregunta que se copiará</summary><p>${esc(topic.followUp)}</p></details></section>` : ""}${related.length ? `<section class="discovery-works"><h2>Otra lectura relacionada</h2><p>Una propuesta editorial para seguir explorando el tema.</p><div>${related.map(sourceCard).join("")}</div></section>` : ""}<nav class="discovery-next" aria-label="Otros temas"><h2>Otros temas</h2><div>${next.map(other => `<a href="${esc(topicUrl(other, group))}">${esc(other.title)}</a>`).join("")}</div></nav></article>`;
  }
  function render(route = {}, options = {}) {
    const query = route.query || new URLSearchParams();
    const group = options.libraryId || query.get("library") || "";
    const topicId = query.get("topic");
    const category = query.get("category");
    const embedded = options.embedded;
    const start = `<section class="${embedded ? "" : "page "}discovery-library ${group === "clasicos" ? "discovery-classics" : ""}">`;
    if (category) return `${start}${documentList(category, group)}</section>`;
    if (!data) return `${start}${status()}</section>`;
    const topics = visibleTopics(group);
    if (topicId) {
      const topic = topics.find(item => item.id === topicId);
      return `${start}${topic ? detail(topic, group) : `<div class="discovery-status"><h1>Tema no disponible</h1><p>Puede que sus fuentes no estén disponibles en este dispositivo.</p><a href="#/mapa-tematico">Volver al mapa</a></div>`}</section>`;
    }
    const classic = group === "clasicos";
    const selection = classic ? topics : topics.filter(topic => topic.group !== "clasicos");
    const heading = embedded ? "h2" : "h1";
    return `${start}<header class="discovery-map-head"><span>${classic ? "Los clásicos" : "Biblioteca e IA"}</span><${heading}>${classic ? "Grandes preguntas, obras para leer" : "Entra por una pregunta"}</${heading}><p>${classic ? "Elige un tema. Lee una respuesta breve, comprueba el pasaje y sigue con la obra." : "Cada tema enlaza una explicación breve con el texto que la sustenta."}</p></header><nav class="discovery-scope" aria-label="Elegir mapa"><a ${!classic ? 'aria-current="page"' : ""} href="#/mapa-tematico">Biblioteca</a><a ${classic ? 'aria-current="page"' : ""} href="#/mapa-tematico?library=clasicos">Los clásicos</a></nav><div class="discovery-map ${classic ? "discovery-map-classics" : ""}">${selection.map((topic, index) => tile(topic, index, group)).join("")}</div>${!classic ? `<a class="discovery-classics-door" href="#/mapa-tematico?library=clasicos"><div class="discovery-classics-art" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div><span>Mapa de los clásicos</span><h2>Felicidad, justicia, vida interior</h2><p>Seis entradas a Homero, Platón y otros autores del catálogo.</p><b>Explorar los clásicos</b></div></a>` : ""}${categoryBrowser(group)}<p class="discovery-editorial-note">${esc(data.editorialNote)}</p></section>`;
  }
  function renderLibraryTopics(library) {
    const query = new URLSearchParams(location.hash.split("?")[1] || "");
    return render({ query }, { libraryId: library.id, embedded: true });
  }

  document.addEventListener("click", async event => {
    const retry = event.target.closest("[data-discovery-retry]");
    if (retry) {
      retry.disabled = true;
      try { await load(); } catch { retry.disabled = false; }
      return;
    }
    const button = event.target.closest("[data-discovery-ask]");
    if (!button) return;
    const topic = visibleTopics().find(item => item.id === button.dataset.discoveryAsk);
    if (!topic) return;
    const source = topic.sources.find(source => visibleDocument(source.id));
    const lib = A.data.libraryMap.get(source.libraryId);
    if (!lib?.notebookUrl || !/^https:\/\/notebooklm\.google\.com\//.test(lib.notebookUrl)) return;
    // Keep window.open inside the user gesture, before awaiting the clipboard.
    const opened = window.open(lib.notebookUrl, "_blank");
    if (opened) opened.opener = null;
    try {
      await A.share.copy(topic.followUp);
      A.appToast?.(opened ? "Pregunta copiada. Pégala en NotebookLM." : "Pregunta copiada. Permite abrir la nueva pestaña o usa Preguntar.");
    } catch {
      button.closest(".discovery-ask")?.querySelector("details")?.setAttribute("open", "");
      A.appToast?.("No se pudo copiar. La pregunta está visible para copiarla manualmente.");
    }
  });
  A.discoveryLibrary = { load, render, renderLibraryTopics };
})();
