(function () {
  "use strict";
  const A = window.Atlas = window.Atlas || {};
  const runtime = window.AtlasRuntime;
  const esc = value => A.library.esc(String(value || ""));
  let data = null;
  const state = { depth:1, level:1, topic:"", expanded:new Set(), theme:localStorage.getItem("atlas-salvation-theme") || "auto", cinematic:false, cinematicIndex:0 };
  let cinematicTimer = 0;
  const LEVELS = ["Mapa", "Alianzas", "Hitos clave", "Relato", "Archivo", "Lectura"];
  const ERA_DATES = { creation:"Orígenes", noah:"Tiempo primordial", patriarchs:"c. 1850 a. C.", moses:"c. 1250 a. C.", land:"c. 1200–1020 a. C.", david:"c. 1000–587 a. C.", return:"587–4 a. C.", christ:"c. 4 a. C.–30 d. C.", church:"Desde 30 d. C.", consummation:"Plenitud" };

  function render() {
    document.body.classList.add("salvation-active");
    requestAnimationFrame(hydrate);
    return `<section class="salvation-loading"><i></i><span class="eyebrow">Historia de la Salvación</span><h1>Abriendo el gran mapa…</h1></section>`;
  }
  async function hydrate() {
    const main = document.querySelector("#main");
    if (!main || A.router.parse().name !== "salvation") return;
    try {
      data = data || await runtime.fetchJson("data/salvation-history.json");
      if (A.router.parse().name === "salvation") main.innerHTML = page();
    } catch (error) {
      console.error(error);
      main.innerHTML = `<section class="page">${A.library.empty("No se pudo abrir la cronología", "Vuelve a cargar Atlas.")}</section>`;
    }
  }
  function page() {
    const light = state.theme === "light" || (state.theme === "auto" && document.documentElement.dataset.theme !== "dark");
    return `<section class="salvation-app ${light ? "is-light" : ""}" data-salvation-zoom="${state.level}" style="--salvation-depth:${state.depth}">
      <header class="salvation-topbar"><a href="#/explore" class="salvation-back" aria-label="Volver">${icon("back")}</a><div><span>Atlas bíblico</span><b>Historia de la Salvación</b></div><div class="salvation-header-actions"><button class="salvation-cinematic-button ${state.cinematic?"is-playing":""}" data-salvation-action="cinematic" aria-label="${state.cinematic?"Pausar recorrido":"Iniciar modo cinemático"}">${icon(state.cinematic?"pause":"play")}<span>${state.cinematic?"Pausar":"Cinemático"}</span></button><button data-salvation-action="theme" aria-label="Cambiar tema">${icon(light ? "moon" : "sun")}</button><button data-salvation-action="panorama" aria-label="Mapa general">${icon("map")}</button></div></header>
      <nav class="salvation-minimap" aria-label="Grandes etapas">${data.eras.map(era=>`<button style="--era:${era.color}" data-salvation-era="${era.id}"><i>${era.symbol}</i><span>${esc(shortEra(era.title))}</span><time>${esc(ERA_DATES[era.id])}</time></button>`).join("")}</nav>
      <main class="salvation-viewport" data-salvation-viewport><section class="salvation-intro"><span class="eyebrow">El plan entero, de un vistazo</span><h1>Una promesa. <em>Una familia.</em></h1><p>Acerca dos dedos para revelar alianzas, fechas, personajes y textos.</p></section><div class="salvation-canvas" data-salvation-canvas>${canvas()}</div><footer class="salvation-source"><span>Hilo conductor</span><h2>Las alianzas amplían la familia de Dios.</h2><p>${esc(data.source.note)}</p>${A.storage.isFeatureUnlocked("scott-hahn-private")?`<a href="${esc(data.source.url)}">Leer «${esc(data.source.title)}», de ${esc(data.source.author)} →</a>`:`<a href="https://www.amazon.es/s?k=Scott+Hahn+Un+padre+fiel+a+sus+promesas" target="_blank" rel="noopener">Comprar el libro de Scott Hahn →</a>`}</footer></main>
      <div class="salvation-mobile-dock"><button data-salvation-action="zoom-out" aria-label="Alejar">${icon("minus")}</button><label><span>${LEVELS[state.level-1]}</span><input type="range" min="1" max="6" step="0.01" value="${state.depth}" data-salvation-zoom><i style="--progress:${(state.depth-1)*20}%"></i></label><button data-salvation-action="zoom-in" aria-label="Acercar">${icon("plus")}</button><details class="salvation-threads"><summary aria-label="Conexiones">${icon("threads")}</summary><div><strong>Hilos de la historia</strong><button class="${state.topic?"":"active"}" data-salvation-topic="">Todos</button>${data.topics.map(topic=>`<button class="${state.topic===topic.id?"active":""}" data-salvation-topic="${topic.id}">${esc(topic.label)} <small>${topic.count}</small></button>`).join("")}</div></details></div>
    </section>`;
  }
  function shortEra(title) { return String(title).replace("Abraham y los patriarcas","Abraham").replace("David, reino y profetas","David").replace("Tierra y jueces","Tierra").replace("Exilio y espera","Exilio"); }
  function eraFont(id) { return ({creation:"Alegreya",noah:"Lora",patriarchs:"Cormorant Garamond",moses:"Montserrat",land:"Merriweather",david:"Cormorant Garamond",return:"Source Sans 3",christ:"Literata",church:"Manrope",consummation:"Alegreya"}[id]||"Literata")+",serif"; }
  function canvas() { return state.level === 1 ? panorama() : data.eras.map((era,index)=>eraSection(era,index)).join(""); }
  function panorama() {
    return `<section class="salvation-panorama"><header><span>Panorama de las alianzas</span><h2>De la creación a la nueva creación</h2><p>Cada alianza ensancha la familia: pareja, casa, tribu, pueblo, reino, Iglesia y humanidad renovada.</p></header><div class="salvation-panorama-map"><svg viewBox="0 0 1000 390" preserveAspectRatio="none" aria-hidden="true"><path d="M40 95 C160 15 210 175 315 95 S500 15 590 95 S765 175 830 95 S930 25 970 95 M970 95 C900 210 830 160 760 275 S580 350 500 275 S310 195 245 275 S85 350 40 275"/></svg>${data.eras.map((era,index)=>`<button class="panorama-era panorama-era-${index+1}" style="--era:${era.color};--accent:${era.accent};--era-font:${eraFont(era.id)}" data-salvation-drill="${era.id}"><i>${era.symbol}</i><b>${esc(shortEra(era.title))}</b><time>${esc(ERA_DATES[era.id])}</time><small>${esc(era.subtitle)}</small></button>`).join("")}</div><footer><b>Abraham</b><span></span><b>David</b><span></span><b>Jesús</b><p>La promesa se vuelve familia, reino y alianza nueva.</p></footer></section>`;
  }
  function eraSection(era,index) {
    const events=selectedEvents(era);
    return `<section class="salvation-era ${era.id==="christ"?"is-center":""}" id="salvation-era-${era.id}" style="--era:${era.color};--accent:${era.accent};--era-index:${index};--era-font:${eraFont(era.id)}"><header><span>${String(index+1).padStart(2,"0")} · Alianza</span><time>${esc(ERA_DATES[era.id])}</time><i>${era.symbol}</i><h2>${esc(era.title)}</h2><p>${esc(era.subtitle)}</p><small>${era.books.map(esc).join(" · ")}</small></header><div class="salvation-path"><i class="salvation-path-line"></i>${events.length?events.map(event=>eventNode(event)).join(""):allianceSummary(era)}</div></section>`;
  }
  function selectedEvents(era) {
    const all=data.events.filter(item=>item.eraId===era.id); if(state.level>=6)return all;if(state.level<=2)return [];
    const stride=state.level===3?28:state.level===4?11:4;return all.filter((item,index)=>index===0||index===all.length-1||index%stride===0||(state.level>=4&&item.importance>=3));
  }
  function allianceSummary(era) {
    const messages={creation:"La humanidad nace como familia e imagen de Dios.",noah:"Dios preserva la familia humana y la creación.",patriarchs:"En Abraham, una familia será bendición para todas.",moses:"Un pueblo liberado recibe una ley y una presencia.",land:"La promesa toma tierra y aprende la fidelidad.",david:"Un reino, una casa y un trono reciben promesa eterna.",return:"En el exilio, la palabra conserva la esperanza.",christ:"El Hijo sella la alianza nueva con su vida.",church:"El Espíritu abre la familia a todas las naciones.",consummation:"Dios será todo en todos: nueva creación y comunión."};
    return `<article class="salvation-alliance-summary"><span>La promesa</span><p>${esc(messages[era.id])}</p><button data-salvation-action="zoom-in">Explorar sus hitos ${icon("plus")}</button></article>`;
  }
  function eventNode(event) {
    const expanded=state.expanded.has(event.id), visible=!state.topic||event.topics.includes(state.topic);
    return `<article class="salvation-event ${expanded?"is-expanded":""} ${visible?"is-thread-match":"is-thread-muted"}" data-salvation-event="${event.id}"><button class="salvation-event-dot"><span>${event.number}</span></button><div class="salvation-event-copy"><div class="salvation-event-meta"><span>Hito ${event.number}</span>${event.date?`<time>${esc(shortDate(event.date))}</time>`:""}</div><h3 title="${esc(event.title)}">${esc(displayTitle(event.title))}</h3>${state.level>=4?references(event.references,state.level===4?2:5):""}${state.level>=5&&event.summary?`<p>${esc(event.summary)}</p>`:""}${state.level===6?`<div class="salvation-event-deep">${event.relation?`<blockquote>${esc(event.relation)}</blockquote>`:""}<button data-salvation-expand="${event.id}">${expanded?"Reducir ↑":"Leer el hito completo ↓"}</button>${expanded?`<div class="salvation-full-text">${richText(event.fullDescription)}${references(event.references,99)}</div>`:""}</div>`:""}</div></article>`;
  }
  function displayTitle(title) { if(state.level>=6)return title;let value=String(title||""),first=value.split(/[:;]| — |\.\s/)[0].trim();if(first.length>=24)value=first;const max=state.level<=3?54:state.level===4?72:96;if(value.length<=max)return value;return `${value.slice(0,max).replace(/\s+\S*$/,"").replace(/[,:;]+$/,"")}…`; }
  function shortDate(date) { return date.length>58?`${date.slice(0,55).trim()}…`:date; }
  function richText(text) { return String(text||"").split(/\n{2,}/).filter(Boolean).map(p=>`<p>${esc(p).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\*([^*]+)\*/g,"<em>$1</em>")}</p>`).join(""); }
  function references(items,limit) { if(!items?.length)return "";return `<div class="salvation-references">${items.slice(0,limit).map(raw=>{const parsed=A.bible?.parseReference(String(raw).replace(/[.:,]/g," ").replace(/[–—-]/g," ").replace(/\s+/g," ").trim());const href=parsed?A.bible.referenceUrl(parsed,"","cee"):`#/bible/search?q=${encodeURIComponent(raw)}`;return `<a href="${href}">${esc(raw)}</a>`;}).join("")}${items.length>limit?`<span>+${items.length-limit}</span>`:""}</div>`; }
  function updateCanvas(anchor="") { const node=document.querySelector("[data-salvation-canvas]");if(!node)return;node.innerHTML=canvas();const app=document.querySelector(".salvation-app");app.dataset.salvationZoom=state.level;app.style.setProperty("--salvation-depth",state.depth);const range=document.querySelector("[data-salvation-zoom]");if(range)range.value=state.depth;const label=document.querySelector(".salvation-mobile-dock label span");if(label)label.textContent=LEVELS[state.level-1];const line=document.querySelector(".salvation-mobile-dock label i");if(line)line.style.setProperty("--progress",`${(state.depth-1)*20}%`);if(anchor)requestAnimationFrame(()=>scrollToEra(anchor)); }
  function setDepth(value) { const next=Math.max(1,Math.min(6,Number(value))),level=Math.max(1,Math.min(6,Math.floor(next+.36))),changed=level!==state.level;state.depth=next;state.level=level;const app=document.querySelector(".salvation-app");app?.style.setProperty("--salvation-depth",next);const line=document.querySelector(".salvation-mobile-dock label i");line?.style.setProperty("--progress",`${(next-1)*20}%`);if(changed){const swap=()=>updateCanvas();document.startViewTransition?document.startViewTransition(swap):swap();} }
  function scrollToEra(id) { const viewport=document.querySelector("[data-salvation-viewport]"),element=document.querySelector(`#salvation-era-${CSS.escape(id)}`);if(viewport&&element)viewport.scrollTo({top:Math.max(0,element.offsetTop-105),behavior:"smooth"}); }
  function toggleTheme() { const app=document.querySelector(".salvation-app"),light=app.classList.toggle("is-light");state.theme=light?"light":"dark";localStorage.setItem("atlas-salvation-theme",state.theme);const button=document.querySelector('[data-salvation-action="theme"]');if(button)button.innerHTML=icon(light?"moon":"sun"); }
  function stopCinematic() { clearTimeout(cinematicTimer);cinematicTimer=0;state.cinematic=false;document.querySelector(".salvation-app")?.classList.remove("is-cinematic");const button=document.querySelector('[data-salvation-action="cinematic"]');if(button){button.classList.remove("is-playing");button.innerHTML=`${icon("play")}<span>Cinemático</span>`;button.setAttribute("aria-label","Iniciar modo cinemático");} }
  function cinematicStep() { if(!state.cinematic||A.router.parse().name!=="salvation")return;const eras=data?.eras||[];if(!eras.length)return;const era=eras[state.cinematicIndex%eras.length];document.querySelectorAll(".salvation-era.is-cinematic-focus").forEach(node=>node.classList.remove("is-cinematic-focus"));scrollToEra(era.id);requestAnimationFrame(()=>document.querySelector(`#salvation-era-${CSS.escape(era.id)}`)?.classList.add("is-cinematic-focus"));state.cinematicIndex=(state.cinematicIndex+1)%eras.length;cinematicTimer=setTimeout(cinematicStep,4300); }
  function toggleCinematic() { if(state.cinematic){stopCinematic();return;}state.cinematic=true;state.cinematicIndex=0;state.depth=2;state.level=2;updateCanvas();const app=document.querySelector(".salvation-app");app?.classList.add("is-cinematic");const button=document.querySelector('[data-salvation-action="cinematic"]');if(button){button.classList.add("is-playing");button.innerHTML=`${icon("pause")}<span>Pausar</span>`;button.setAttribute("aria-label","Pausar recorrido");}requestAnimationFrame(cinematicStep); }
  function icon(name) { const paths={back:'<path d="M19 12H5m6-6-6 6 6 6"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',moon:'<path d="M20 15.5A8 8 0 0 1 8.5 4 8.2 8.2 0 1 0 20 15.5Z"/>',map:'<path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6Z"/><path d="M8 3v15m8-12v15"/>',minus:'<path d="M5 12h14"/>',plus:'<path d="M12 5v14M5 12h14"/>',play:'<path d="m9 6 9 6-9 6V6Z"/>',pause:'<path d="M8 6h3v12H8zm5 0h3v12h-3z"/>',threads:'<circle cx="5" cy="6" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="m7 7 4 10m6-11-4 11M7 6h10"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.map}</svg>`; }
  function stop() { stopCinematic();document.body.classList.remove("salvation-active"); }
  document.addEventListener("click",event=>{
    if(A.router.parse().name!=="salvation")return;const action=event.target.closest("[data-salvation-action]")?.dataset.salvationAction;
    if(action==="cinematic"){toggleCinematic();return;}if(action==="zoom-in")setDepth(Math.ceil(state.depth+.01));if(action==="zoom-out")setDepth(Math.floor(state.depth-.01));if(action==="theme")toggleTheme();if(action==="panorama"){stopCinematic();state.depth=1;state.level=1;updateCanvas();document.querySelector("[data-salvation-viewport]")?.scrollTo({top:0,behavior:"smooth"});}
    const drill=event.target.closest("[data-salvation-drill]")?.dataset.salvationDrill;if(drill){state.depth=2;state.level=2;updateCanvas(drill);return;}
    const era=event.target.closest("[data-salvation-era]")?.dataset.salvationEra;if(era){if(state.level===1){state.depth=2;state.level=2;updateCanvas(era);}else scrollToEra(era);}
    const topic=event.target.closest("[data-salvation-topic]")?.dataset.salvationTopic;if(topic!==undefined){state.topic=topic;updateCanvas();}
    const expand=event.target.closest("[data-salvation-expand]")?.dataset.salvationExpand;if(expand){state.expanded.has(expand)?state.expanded.delete(expand):state.expanded.add(expand);updateCanvas();requestAnimationFrame(()=>document.querySelector(`[data-salvation-event="${CSS.escape(expand)}"]`)?.scrollIntoView({block:"center"}));}
  });
  document.addEventListener("input",event=>{if(event.target.matches("[data-salvation-zoom]"))setDepth(event.target.value);});
  let pinchStart=0,pinchDepth=1;
  document.addEventListener("touchstart",event=>{if(A.router.parse().name!=="salvation"||event.touches.length!==2)return;pinchStart=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);pinchDepth=state.depth;},{passive:true});
  document.addEventListener("touchmove",event=>{if(!pinchStart||event.touches.length!==2)return;event.preventDefault();const distance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);setDepth(pinchDepth+Math.log(distance/pinchStart)*3.2);},{passive:false});
  document.addEventListener("touchend",()=>pinchStart=0,{passive:true});
  A.salvation = { render, stop };
})();
