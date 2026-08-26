(function () {
  "use strict";
  const A = window.Atlas = window.Atlas || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const section = (eyebrow, title, text = "") => `<header class="polish-section-head"><span>${esc(eyebrow)}</span><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ""}</header>`;

  A.architecture.renderOpusDei = function renderOpusDeiSimple() {
    const prep = A.data.libraryMap.get("preparadora-circulos");
    const sjm = A.data.libraryMap.get("san-josemaria");
    const unlocked = A.storage.isFeatureUnlocked("preparadora-circulos");
    const latest = (window.ATLAS_EXTERNAL?.items || []).filter(item => item.source === "Opus Dei").slice(0, 2);
    const prepUrl = unlocked && prep?.notebookUrl ? prep.notebookUrl : "#/mi-atlas";
    const prepAction = unlocked && prep?.notebookUrl
      ? `<a class="prep-open" href="${esc(prep.notebookUrl)}" target="_blank" rel="noopener">Abrir Preparador ↗</a>`
      : `<a class="prep-open" href="#/mi-atlas">Desbloquear en Mi Atlas</a>`;
    const cards = [
      ["Vida cristiana", "Rezar", "Meditaciones y Evangelio.", "#/spiritual/gospel"],
      ["Jóvenes", "Youth", "Historias y preguntas para hoy.", "#/youth"],
      ["Mirar y escuchar", "Vídeos", "Canal oficial del Opus Dei.", "https://www.youtube.com/@opusdei/videos", true],
      ["Estudio", "Romana", "Artículos y estudios.", "https://romana.org/", true],
      ["Textos", "Cartas y documentos", "Prelado y materiales públicos.", "https://opusdei.org/es/section/del-prelado/", true],
      ["Actualidad", "Opusdei.org", "Noticias y recursos oficiales.", "https://opusdei.org/es/", true]
    ];
    const cardsHtml = cards.map(([eyebrow, title, text, url, external, variant]) => `<a class="${variant || ""}" href="${esc(url)}" ${external ? 'target="_blank" rel="noopener"' : ""}><span>${esc(eyebrow)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></a>`).join("");
    const latestHtml = latest.map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener" style="--opus-image:url('${esc(item.image || "")}')"><span>${esc(item.date || "Opus Dei")}</span><h3>${esc(item.title)}</h3><b>Leer →</b></a>`).join("") || `<a class="v7-opus-latest-empty" href="https://opusdei.org/es/" target="_blank" rel="noopener"><span>Opus Dei</span><h3>Consulta la actualidad oficial.</h3><b>Abrir →</b></a>`;
    const guide = unlocked
      ? `<section class="opus-prep-guide"><header><span>Cómo utilizar este cuaderno</span><h2>Preparador de círculos</h2></header><div class="prep-mode-grid"><article><i>01</i><div><b>Opción 1. Preparar un círculo a partir de temas</b><p>Indica los temas de:</p><ol><li>Doctrina.</li><li>Norma de piedad.</li><li>Costumbre o lucha.</li></ol><small>Recibirás un esquema de ideas breves, con referencias a las fuentes y un hilo conductor para desarrollar posteriormente el círculo.</small></div></article><article><i>02</i><div><b>Opción 2. Preparar un círculo a partir de temas y Evangelio</b><p>Además de los <strong>temas</strong>, adjunta el <strong>Evangelio</strong> del día.</p><small>Recibirás:</small><ol><li>Una <strong>meditación</strong> del Evangelio al estilo de san Josemaría.</li><li>El <strong>esquema</strong> completo del círculo, conectado con el Evangelio y los temas propuestos.</li></ol></div></article></div><p class="prep-purpose">El objetivo es <strong>facilitar</strong> la <em>preparación</em> personal del círculo, no <strong>sustituirla</strong>, ayudándote a estudiar las fuentes y a transmitir su mensaje con unidad, profundidad y sentido pastoral, enriquecer la formación y mirada del formador.</p><footer>${prepAction}<a href="#/library/preparadora-circulos/documents">Ver documentos →</a></footer></section>`
      : `<a class="opus-prep-locked-card" href="#/mi-atlas"><span>Preparar</span><h3>Preparador de círculos</h3><p>Una ayuda con fuentes para preparar tus círculos.</p><b>Desbloquear en Mi Atlas →</b></a>`;
    return `<section class="page atlas-v7 v7-opus opus-simple"><header><span>Recursos reunidos</span><h1>Opus Dei</h1><p>Oración, formación y vida cristiana, cerca.</p></header><section class="v7-opus-lead"><div style="--v7-image:url('../assets/images/fondo_sjm.png')"><span>San Josemaría</span><h2>Encontrar a Dios en la vida ordinaria.</h2><p>Obras, oración y recursos para vivir la fe hoy.</p><div><a href="#/library/san-josemaria/documents">Abrir biblioteca</a><a href="#/spiritual/escriva">Escriva.org</a></div></div><a href="${esc(sjm?.notebookUrl || "#/library/san-josemaria/documents")}" ${sjm?.notebookUrl ? 'target="_blank" rel="noopener"' : ""}><small>Especialista</small><b>Preguntar a San Josemaría →</b></a></section><section class="v7-opus-grid opus-simple-grid">${cardsHtml}</section>${guide}<section class="v7-opus-latest opus-simple-latest">${section("Actualidad", "Lo último", "Dos contenidos, actualizados cada día.")}<div>${latestHtml}</div></section></section>`;
  };
})();
