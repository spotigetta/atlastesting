(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const esc = root.library?.esc || (value => String(value));
  function render(selectedIds) {
    const libraries = root.data.catalog.libraries;
    const selected = selectedIds.map(id => root.data.libraryMap.get(id)).filter(Boolean);
    const titleSets = selected.map(lib => new Set(lib.documents.map(doc => root.data.normalize(doc.title))));
    const common = selected.length > 1 ? selected[0].documents.filter(doc => titleSets.slice(1).every(set => set.has(root.data.normalize(doc.title)))) : [];
    const rows = [
      ["Documentos", lib => lib.stats.documents],
      ["Palabras", lib => root.library.compact(lib.stats.words)],
      ["Categorías", lib => lib.stats.categories],
      ["Autores identificados", lib => lib.stats.authors],
      ["Documentos históricos", lib => lib.stats.historical],
      ["Otros idiomas indicados", lib => lib.stats.foreignLanguage],
      ["Áreas principales", lib => lib.topics.slice(0, 4).map(topic => topic.name).join(" · ")]
    ];
    return `<section class="page">
      <header class="explore-hero"><span class="eyebrow">Comparador</span><h1>Compara las cuatro miradas.</h1><p>Selecciona entre dos y cuatro bibliotecas. Las coincidencias se calculan por títulos normalizados.</p></header>
      <div class="compare-select">${libraries.map(lib => `<button class="compare-pick tone-${lib.tone} ${selectedIds.includes(lib.id) ? "selected" : ""}" data-compare-library="${lib.id}"><b>${esc(lib.short)}</b><span>${lib.stats.documents} documentos</span></button>`).join("")}</div>
      ${selected.length < 2 ? root.library.empty("Selecciona dos bibliotecas", "Puedes comparar hasta cuatro corpus a la vez.") : `
        <div class="button-row" style="margin-bottom:16px">${selected.map(lib => root.library.notebookButton(lib, `Abrir ${lib.short}`)).join("")}</div>
        <div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>Indicador</th>${selected.map(lib => `<th>${esc(lib.short)}</th>`).join("")}</tr></thead><tbody>${rows.map(([label, getter]) => `<tr><td>${label}</td>${selected.map(lib => `<td>${esc(getter(lib))}</td>`).join("")}</tr>`).join("")}<tr><td>Documentos comunes</td><td colspan="${selected.length}">${common.length ? common.slice(0, 40).map(doc => `<button class="chip" data-open-document="${esc(doc.id)}">${esc(doc.title)}</button>`).join(" ") : "No hay títulos idénticos en toda la selección."}</td></tr></tbody></table></div>
        <section class="section"><div class="section-head"><div><h2>Matriz global</h2><p>Coincidencias verificables entre títulos.</p></div></div>${root.statistics.matrix(selected)}</section>`}
    </section>`;
  }
  root.compare = { render };
})();
