(function () {
  "use strict";
  const A = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const section = (eyebrow, title, text) => `<header class="polish-section-head"><span>${esc(eyebrow)}</span><h2>${esc(title)}</h2><p>${esc(text)}</p></header>`;
  const cards = items => items.map(([icon, title, url]) => `<a href="${url}"><i>${icon}</i><b>${esc(title)}</b><span>Empezar →</span></a>`).join("");

  A.architecture.renderLearning = function renderLearning() {
    const studying = location.hash.includes("/estudiar");
    const questions = [...(window.ATLAS_FAQ?.items || [])].sort(() => Math.random() - .5).slice(0, 6);
    const faqCards = questions.length
      ? questions.map(item => `<details><summary>${esc(item.question || item.title)}</summary><p>${esc(item.answer || item.text || "")}</p></details>`).join("")
      : `<details open><summary>¿Por dónde empiezo?</summary><p>Elige una pregunta concreta, abre el especialista sugerido y comprueba las fuentes.</p></details>`;
    const studyTools = [["↔", "Cronología viva", "#/timeline"], ["◎", "Mapa mundial", "#/map"], ["⌘", "Relaciones", "#/graph"], ["✦", "Capacidades", "#/compare"]];
    const startTools = [["✦", "Historia de la Salvación", "#/salvation"], ["⌕", "¿Dónde buscar?", "#/preguntar"], ["◌", "Rutas de estudio", "#/routes"], ["♧", "Colecciones", "#/collections"]];
    return `<section class="page atlas-v7 v7-learning learning-polished"><header class="v7-page-hero"><span>Formación acompañada</span><h1>${studying ? "Estudiar con método" : "Quiero aprender"}</h1><p>${studying ? "Mapas, cronologías y conexiones para profundizar." : "Preguntas típicas, recorridos y un punto de partida claro."}</p></header><nav class="v7-learning-switch"><a class="${studying ? "" : "active"}" href="#/formarse">Aprender</a><a class="${studying ? "active" : ""}" href="#/formarse/estudiar">Estudiar</a></nav>${studying ? `<section class="learning-tools learning-varied">${cards(studyTools)}</section>` : `<section class="learning-questions">${section("Preguntas típicas", "Empieza por una pregunta real.", "Una selección nueva cada vez que vuelves.")}<div>${faqCards}</div><a class="secondary-button" href="#/faq">Ver todas las preguntas frecuentes →</a></section><section class="learning-tools learning-start learning-varied">${cards(startTools)}</section>`}</section>`;
  };
})();
