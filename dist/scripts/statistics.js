(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const colors = ["var(--tone)", "#8aa897", "#c29452", "#7f6d94", "#bd7770", "#5e7f9d", "#7c8b63", "#b59478", "#7b717d", "#a4a39b"];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function bars(library) {
    const top = library.categories.slice(0, 9);
    const max = Math.max(...top.map(item => item.count), 1);
    return `<article class="viz-card"><h3>Distribución por categoría</h3><p>Toque una barra para filtrar el catálogo.</p><div class="bar-chart">${top.map(item => `<button class="chart-action" data-category="${esc(item.name)}" style="border:0;background:none;padding:0;text-align:left"><span class="bar-label"><span>${esc(item.name)}</span><b>${item.count}</b></span><span class="bar-track"><span class="bar-fill" style="width:${item.count / max * 100}%"></span></span></button>`).join("")}</div></article>`;
  }

  function donut(library) {
    const top = library.categories.slice(0, 6);
    const total = top.reduce((sum, item) => sum + item.count, 0) || 1;
    let cursor = 0;
    const segments = top.map((item, index) => {
      const start = cursor; cursor += item.count / total * 100;
      return `${colors[index]} ${start}% ${cursor}%`;
    }).join(",");
    return `<article class="viz-card"><h3>Composición del corpus</h3><p>Porcentaje de las categorías principales.</p><div class="donut-layout"><div class="donut" style="--segments:${segments}"><div class="donut-center"><b>${library.stats.documents}</b><span>fuentes</span></div></div><div class="legend">${top.map((item, index) => `<button class="legend-item chart-action" data-category="${esc(item.name)}" style="border:0;background:none;text-align:left"><i class="legend-dot" style="--dot:${colors[index]}"></i><span>${esc(item.name)}</span><b>${Math.round(item.count / total * 100)}%</b></button>`).join("")}</div></div></article>`;
  }

  function treemap(library) {
    const docs = [...library.documents].sort((a, b) => b.words - a.words).slice(0, 28);
    const max = docs[0]?.words || 1;
    return `<article class="viz-card wide"><h3>Treemap documental</h3><p>El área aproxima la extensión en palabras; muestra las 28 fuentes mayores.</p><div class="treemap">${docs.map(doc => {
      const span = Math.max(1, Math.min(6, Math.ceil(doc.words / max * 6)));
      const rows = Math.max(1, Math.min(3, Math.ceil(doc.words / max * 3)));
      return `<button class="tree-cell" data-doc="${esc(doc.id)}" style="grid-column:span ${span};grid-row:span ${rows}" title="${esc(doc.title)} · ${doc.words.toLocaleString("es-ES")} palabras">${esc(doc.title)}</button>`;
    }).join("")}</div></article>`;
  }

  function bubbles(library) {
    const cats = library.categories.slice(0, 12);
    const max = Math.max(...cats.map(item => item.count), 1);
    return `<article class="viz-card"><h3>Mapa de burbujas</h3><p>Cada burbuja es una categoría; el tamaño refleja documentos.</p><div class="bubble-map">${cats.map(item => `<button class="bubble" data-category="${esc(item.name)}" style="--size:${58 + item.count / max * 75}px">${esc(item.name)}<br>${item.count}</button>`).join("")}</div></article>`;
  }

  function cloud(library) {
    const tags = [...library.authors.slice(0, 12), ...library.categories.slice(0, 8)].slice(0, 20);
    const max = Math.max(...tags.map(item => item.count), 1);
    return `<article class="viz-card"><h3>Nube de autores y temas</h3><p>El tamaño refleja presencia en el catálogo.</p><div class="tag-cloud">${tags.map(item => `<button data-search-term="${esc(item.name)}" style="--tag-size:${12 + item.count / max * 18}px">${esc(item.name)}</button>`).join("")}</div></article>`;
  }

  function timeline(library) {
    const dated = library.documents.filter(doc => doc.year).sort((a, b) => a.year - b.year);
    return `<article class="viz-card wide"><h3>Fechas explícitas</h3><p>Solo aparecen fechas consignadas en los títulos del índice.</p>${dated.length ? `<div class="timeline-chart">${dated.map(doc => `<button class="timeline-point" data-doc="${esc(doc.id)}"><b>${doc.year}</b><span>${esc(doc.title)}</span></button>`).join("")}</div>` : `<div class="empty-state"><p>No hay fechas explícitas suficientes en el índice.</p></div>`}</article>`;
  }

  function shelfStats(library) {
    const docs = [...library.documents].sort((a, b) => b.words - a.words).slice(0, 40);
    const max = docs[0]?.words || 1;
    return `<article class="viz-card wide"><h3>Biblioteca estadística</h3><p>Los lomos más gruesos representan documentos más extensos.</p><div class="shelf">${docs.map(doc => `<button class="book" data-doc="${esc(doc.id)}" style="--book-w:${20 + doc.words / max * 22}px;--book-h:${150 + doc.words / max * 130}px">${esc(doc.title)}</button>`).join("")}</div></article>`;
  }

  function sizeDistribution(library) {
    const bands = [
      { label: "Menos de 10 mil", count: library.documents.filter(doc => doc.words < 10000).length },
      { label: "10–50 mil", count: library.documents.filter(doc => doc.words >= 10000 && doc.words < 50000).length },
      { label: "50–200 mil", count: library.documents.filter(doc => doc.words >= 50000 && doc.words < 200000).length },
      { label: "Más de 200 mil", count: library.documents.filter(doc => doc.words >= 200000).length }
    ];
    const max = Math.max(...bands.map(item => item.count), 1);
    return `<article class="viz-card"><h3>Distribución por extensión</h3><p>Documentos agrupados según su recuento de palabras.</p><div class="bar-chart">${bands.map(item => `<div><span class="bar-label"><span>${item.label}</span><b>${item.count}</b></span><span class="bar-track"><span class="bar-fill" style="width:${item.count / max * 100}%"></span></span></div>`).join("")}</div></article>`;
  }

  function authorityDistribution(library) {
    const counts = new Map();
    library.documents.forEach(doc => counts.set(doc.authority, (counts.get(doc.authority) || 0) + 1));
    const items = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 9);
    const max = Math.max(...items.map(item => item.count), 1);
    return `<article class="viz-card"><h3>Autoridad orientativa</h3><p>Agrupación derivada del género documental consignado.</p><div class="bar-chart">${items.map(item => `<div><span class="bar-label"><span>${esc(item.name)}</span><b>${item.count}</b></span><span class="bar-track"><span class="bar-fill" style="width:${item.count / max * 100}%"></span></span></div>`).join("")}</div></article>`;
  }

  function statusDistribution(library) {
    const items = [
      { name: "Histórico o sustituido", count: library.stats.historical },
      { name: "Incompleto o parcial", count: library.stats.incomplete },
      { name: "Estado no consignado", count: library.stats.documents - library.stats.historical - library.stats.incomplete },
      { name: "Idioma extranjero indicado", count: library.stats.foreignLanguage }
    ];
    const max = Math.max(...items.map(item => item.count), 1);
    return `<article class="viz-card"><h3>Estados documentales</h3><p>No se interpreta como vigente lo que el índice no declara.</p><div class="bar-chart">${items.map(item => `<div><span class="bar-label"><span>${item.name}</span><b>${item.count}</b></span><span class="bar-track"><span class="bar-fill" style="width:${item.count / max * 100}%"></span></span></div>`).join("")}</div></article>`;
  }

  function ranking(library) {
    const docs = [...library.documents].sort((a, b) => b.words - a.words).slice(0, 10);
    return `<article class="viz-card wide"><h3>Documentos más extensos</h3><p>Ranking según el recuento de palabras del índice.</p><div class="ranking-list">${docs.map((doc, index) => `<button data-doc="${esc(doc.id)}"><span>${index + 1}</span><b>${esc(doc.title)}</b><small>${doc.words.toLocaleString("es-ES")} palabras</small></button>`).join("")}</div></article>`;
  }

  function nodeMap(library) {
    const categories = library.categories.slice(0, 6);
    const selectedDocs = [];
    for (const category of categories) {
      selectedDocs.push(...library.documents.filter(doc => doc.category === category.name).sort((a, b) => b.words - a.words).slice(0, 3).map(doc => ({ ...doc, categoryIndex: categories.indexOf(category) })));
    }
    const cx = 400, cy = 290, categoryRadius = 125, documentRadius = 245;
    const categoryNodes = categories.map((category, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / categories.length;
      return { ...category, x: cx + Math.cos(angle) * categoryRadius, y: cy + Math.sin(angle) * categoryRadius, angle };
    });
    const documentNodes = selectedDocs.map((doc, index) => {
      const base = categoryNodes[doc.categoryIndex];
      const siblings = selectedDocs.filter(item => item.categoryIndex === doc.categoryIndex);
      const siblingIndex = siblings.findIndex(item => item.id === doc.id);
      const spread = (siblingIndex - (siblings.length - 1) / 2) * .34;
      const angle = base.angle + spread;
      return { ...doc, x: cx + Math.cos(angle) * documentRadius, y: cy + Math.sin(angle) * documentRadius };
    });
    const lines = [
      ...categoryNodes.map(node => `<line x1="${cx}" y1="${cy}" x2="${node.x.toFixed(1)}" y2="${node.y.toFixed(1)}"/>`),
      ...documentNodes.map(node => {
        const parent = categoryNodes[node.categoryIndex];
        return `<line x1="${parent.x.toFixed(1)}" y1="${parent.y.toFixed(1)}" x2="${node.x.toFixed(1)}" y2="${node.y.toFixed(1)}"/>`;
      })
    ].join("");
    return `<article class="viz-card wide node-viz"><h3>Mapa de conexiones</h3><p>Relaciones verificables: biblioteca → categoría → documento. Toque un nodo para explorar.</p><div class="node-map-wrap"><svg class="node-map" viewBox="0 0 800 580" role="img" aria-label="Grafo de categorías y documentos de ${esc(library.short)}"><g class="node-edges">${lines}</g>
      <a href="#/library/${library.id}/documents"><circle class="node-center" cx="${cx}" cy="${cy}" r="46"/><text class="node-center-label" x="${cx}" y="${cy + 4}">${esc(library.short)}</text></a>
      ${categoryNodes.map(node => `<a href="#/library/${library.id}/documents?category=${encodeURIComponent(node.name)}"><title>${esc(node.name)} · ${node.count} documentos</title><circle class="node-category" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${Math.min(34, 20 + node.count / Math.max(...categories.map(item => item.count), 1) * 14).toFixed(1)}"/><text class="node-label" x="${node.x.toFixed(1)}" y="${(node.y + 4).toFixed(1)}">${esc(shortLabel(node.name, 18))}</text></a>`).join("")}
      ${documentNodes.map(node => `<a href="#/document/${encodeURIComponent(node.id)}"><title>${esc(node.title)} · ${node.words.toLocaleString("es-ES")} palabras</title><circle class="node-document" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${Math.min(15, 8 + Math.log10(Math.max(node.words, 10))).toFixed(1)}"/><text class="node-doc-label" x="${node.x.toFixed(1)}" y="${(node.y + 26).toFixed(1)}">${esc(shortLabel(node.title, 12))}</text></a>`).join("")}
    </svg></div><div class="shelf-legend"><span>Centro · biblioteca</span><span>Nodo medio · categoría</span><span>Nodo exterior · documento</span></div></article>`;
  }

  function shortLabel(value, max) {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  function matrix(libraries) {
    const titles = new Map();
    for (const lib of libraries) for (const doc of lib.documents) {
      const key = root.data.normalize(doc.title);
      if (!titles.has(key)) titles.set(key, { title: doc.title, libs: new Set() });
      titles.get(key).libs.add(lib.id);
    }
    const shared = [...titles.values()].filter(item => item.libs.size > 1).sort((a, b) => b.libs.size - a.libs.size || a.title.localeCompare(b.title)).slice(0, 24);
    return `<article class="viz-card wide"><h3>Matriz de coincidencias</h3><p>Títulos presentes en más de una biblioteca.</p><div class="matrix"><table><thead><tr><th>Documento</th>${libraries.map(lib => `<th>${esc(lib.short)}</th>`).join("")}</tr></thead><tbody>${shared.map(item => `<tr><td>${esc(item.title)}</td>${libraries.map(lib => `<td>${item.libs.has(lib.id) ? `<i class="matrix-hit tone-${lib.tone}"></i>` : "—"}</td>`).join("")}</tr>`).join("")}</tbody></table></div></article>`;
  }

  root.statistics = {
    library(library) { return `<div class="visual-grid">${bars(library)}${donut(library)}${bubbles(library)}${cloud(library)}${sizeDistribution(library)}${authorityDistribution(library)}${statusDistribution(library)}${ranking(library)}${treemap(library)}${timeline(library)}${shelfStats(library)}${nodeMap(library)}</div>`; },
    matrix
  };
})();
