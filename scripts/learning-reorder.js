(function () {
  "use strict";
  const A = window.Atlas = window.Atlas || {};
  const esc = value => A.library.esc(String(value || ""));
  const card = ([icon, title, text, href], tone) => `<a class="learning-reordered-card tone-${tone}" href="${href}"><i>${icon}</i><b>${esc(title)}</b><span>${esc(text)}</span><em>Empezar →</em></a>`;
  A.architecture.renderLearning = function renderLearning() {
    const studying = location.hash.includes("/estudiar");
    const faq = (window.ATLAS_FAQ?.items || []).slice(0, 6);
    const questions = faq.length ? faq.map(item => `<details><summary>${esc(item.question || item.title)}</summary><p>${esc(item.answer || item.text || "")}</p></details>`).join("") : "";
    const learn = [["✦","Historia de la Salvación","Alianzas, fechas y Biblia en un mapa vivo.","#/salvation"],["≍","Capacidades de las IA","Qué contiene cada especialista y cómo preguntarle.","#/compare"],["♧","Colecciones","Temas y textos ya reunidos para avanzar con orden.","#/collections"],["↔","Cronologías de santos","Vidas, épocas y recorridos para aprender de ellas.","#/spiritual/timeline"]];
    const study = [["⌁","Autores","Obras y fuentes agrupadas por quien las escribió.","#/biblioteca?view=authors"],["◎","Mapa mundial","Lugares, concilios y protagonistas de la tradición.","#/map"],["⌘","Relaciones","Documentos, autores y categorías conectados.","#/graph"],["↔","Cronología viva","Acontecimientos, autores y documentos fechados.","#/timeline"]];
    const cards = studying ? study : learn;
    return `<section class="page atlas-v7 v7-learning learning-polished learning-reordered"><header class="v7-page-hero"><span>${studying ? "Estudio guiado" : "Aprender desde las fuentes"}</span><h1>${studying ? "Estudiar con profundidad" : "Quiero aprender"}</h1><p>${studying ? "Autores, cronologías y conexiones para investigar con calma." : "Rutas visuales para entrar en la Biblioteca, comprender y rezar."}</p></header><nav class="v7-learning-switch"><a class="${studying ? "" : "active"}" href="#/formarse">Aprender</a><a class="${studying ? "active" : ""}" href="#/formarse/estudiar">Estudiar</a></nav>${!studying ? `<section class="learning-questions"><header><span>Preguntas típicas</span><h2>Empieza por una pregunta real.</h2><p>Una selección que cambia para ayudarte a abrir camino.</p></header><div>${questions}</div><a class="secondary-button" href="#/faq">Ver todas las preguntas frecuentes →</a></section>` : ""}<section class="learning-reordered-grid">${cards.map((item,index) => card(item,["emerald","amber","violet","blue"][index])).join("")}</section></section>`;
  };
})();
