(function () {
  "use strict";
  const A=window.Atlas=window.Atlas||{};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const state={manifest:null,day:null,date:null,kind:"horas",selected:null,calendar:"spain",request:0,loading:false,error:"",notice:"",font:20};
  const names={horas:"Liturgia de las horas",misa:"Lecturas y propios",misal:"Ordinario y textos del misal"};
  const hourIds={lodi:"laudes",ora_media:"intermedia",vespri:"visperas",compieta:"completas",ufficio_delle_letture:"oficio"};
  function zone(){try{return localStorage.getItem("atlas-liturgy-zone")==="Atlantic/Canary"?"Atlantic/Canary":"Europe/Madrid";}catch{return "Europe/Madrid";}}
  function dayParts(now=new Date(),timeZone=zone()){return Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(now).map(p=>[p.type,p.value]));}
  function today(){const p=dayParts();return `${p.year}-${p.month}-${p.day}`;}
  function suggestedHour(h){return h<6||h>=21?"compieta":h<10?"lodi":h<17?"ora_media":"vespri";}
  function dateLabel(d){return new Intl.DateTimeFormat("es-ES",{timeZone:"UTC",dateStyle:"full"}).format(new Date(`${d}T12:00:00Z`));}
  function active(){return Boolean(document.querySelector("#main .liturgy-page"));}
  function sections(){return state.kind==="misal"?(state.manifest?.common||[]):(state.day?.sections||[]).filter(s=>s.category===state.kind);}
  function selected(){return sections().find(s=>s.id===state.selected)||sections()[0];}
  async function json(path,fresh=false){
    if(!/^data\/liturgy\/(?:manifest\.json|days\/\d{4}-\d\d-\d\d\.json|objects\/[a-f0-9]{64}\.json)$/.test(path))throw Error("Ruta litúrgica no válida");
    if(window.AtlasRuntime)return window.AtlasRuntime.fetchJson(path,{fresh});
    const r=await fetch(new URL(path,document.baseURI),{cache:fresh?"no-store":"default",signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();
  }
  function options(){
    const list=sections();if(!list.length)return '<option value="">Sin textos disponibles</option>';
    const option=s=>`<option value="${esc(s.id)}" ${s.id===state.selected?"selected":""}>${esc(s.title)}</option>`;
    if(state.kind!=="misal")return list.map(option).join("");
    return [["ordinario-","Ordinario"],["prefazio-","Prefacios"],["preghiera_eucaristica-","Plegarias eucarísticas"]].map(([prefix,label])=>`<optgroup label="${label}">${list.filter(s=>s.id.startsWith(prefix)).map(option).join("")}</optgroup>`).join("");
  }
  function markup(){
    const m=state.manifest,date=state.date||today(),s=selected(),missing=(state.day?.errors||[]).filter(e=>state.kind==="misa"&&!['oficio','laudes','intermedia','visperas','completas'].includes(e.id));
    const mismatch=state.day?.calendarStatus==="mismatch";
    return `<section class="page liturgy-page" aria-labelledby="liturgy-title"><a class="liturgy-back" href="#/rezar">Volver a rezar</a>
      <header><p class="liturgy-eyebrow">Rito romano · textos en castellano</p><h1 id="liturgy-title">Horas y misa</h1><p>Reza y sigue los textos dentro de Atlas.</p></header>
      <section class="liturgy-controls" aria-label="Fecha y oración"><div class="liturgy-date-row">
        <label>Fecha<input id="liturgy-date" type="date" value="${esc(date)}" ${m?`min="${m.availableFrom}" max="${m.availableTo}"`:""}></label><button id="liturgy-today" type="button">Hoy</button><button id="liturgy-refresh" type="button">Actualizar</button>
        <label>Zona horaria<select id="liturgy-zone"><option value="Europe/Madrid" ${zone()==="Europe/Madrid"?"selected":""}>Península y Baleares</option><option value="Atlantic/Canary" ${zone()==="Atlantic/Canary"?"selected":""}>Canarias</option></select></label>
        <label>Referencia del calendario<select id="liturgy-calendar"><option value="spain" ${state.calendar==="spain"?"selected":""}>España · comprobación CEE</option><option value="provider" ${state.calendar==="provider"?"selected":""}>Calendario del proveedor</option></select></label></div>
        <nav class="liturgy-tabs" aria-label="Tipo de texto">${Object.entries(names).map(([k,n])=>`<button type="button" data-liturgy-kind="${k}" aria-pressed="${k===state.kind}">${n}</button>`).join("")}</nav>
        <label class="liturgy-section-label">${state.kind==="horas"?"Hora":state.kind==="misa"?"Parte de la misa":"Texto del misal"}<select id="liturgy-section" ${sections().length?"":"disabled"}>${options()}</select></label>
        ${m?`<p class="liturgy-availability">Fechas descargadas: ${esc(m.availableFrom)} a ${esc(m.availableTo)}. La hora sugerida es orientativa; puedes elegir otra.</p>`:""}</section>
      <p class="liturgy-status" role="status" aria-live="polite">${state.loading?"Cargando textos…":state.error?esc(state.error):state.notice?esc(state.notice):navigator.onLine?"Con conexión. Los textos abiertos se conservan cuando el almacenamiento del dispositivo está disponible.":"Sin conexión. Se usan los textos ya guardados en este dispositivo."}</p>
      ${state.day?`<aside class="liturgy-calendar ${mismatch?"liturgy-calendar-mismatch":""}" ${mismatch?'role="note"':""}><p><strong>${esc(dateLabel(date))}</strong><br>El proveedor indica: ${esc(state.day.sourceCelebration)}.</p><p><strong>${mismatch?"No corresponde al propio español de esta fecha.":state.day.calendarStatus==="matched"?"Celebración general contrastada con la CEE; comprueba los propios locales.":"La coincidencia con el calendario español no está certificada."}</strong></p><p>${esc(state.day.calendarReason||state.day.calendarNotice||m.calendar.notice)}</p>${state.calendar==="spain"?`<p>Se muestran los textos ofrecidos por iBreviary, sin sustituir ni componer los propios que faltan.</p>`:""}<a href="${esc(m.calendar.referenceUrl)}" target="_blank" rel="noopener noreferrer">Comprobar calendario oficial de la CEE</a></aside>`:""}
      ${missing.length?`<aside class="liturgy-missing"><strong>El proveedor no ofrece estas secciones para la fecha</strong><p>${missing.map(e=>esc(e.title)).join("; ")}. Los textos comunes están en «Ordinario y textos del misal»; Atlas no elige un prefacio ni sustituye los propios ausentes.</p></aside>`:""}
      <div class="liturgy-reader-toolbar"><div><button type="button" data-liturgy-font="-1" aria-label="Reducir tamaño de letra">A−</button><button type="button" data-liturgy-font="1" aria-label="Aumentar tamaño de letra">A+</button></div><button type="button" id="liturgy-save" ${m&&state.day?"":"disabled"}>Guardar este día y el misal sin conexión</button></div>
      <article class="liturgy-reading" style="--liturgy-font:${state.font}px" aria-labelledby="liturgy-reading-title"><header><p>${state.kind==="misal"?"Texto común · no asignado automáticamente al día":esc(dateLabel(date))}</p><h2 id="liturgy-reading-title">${esc(s?.title||names[state.kind])}</h2></header><div id="liturgy-text" ${state.loading?'aria-busy="true"':""}>${state.error?`<p>${esc(state.error)}</p><button type="button" id="liturgy-retry">Volver a intentar</button>`:!s&&!state.loading?"<p>No hay textos descargados para esta selección. Elige una fecha disponible o actualiza los datos de Atlas.</p>":"<p>Cargando el texto…</p>"}</div></article>
      <footer class="liturgy-attribution"><p>${esc(m?.attribution||"Textos castellanos atribuidos a la Conferencia Episcopal Española por iBreviary.")}</p>${m?`<p>Importación: ${esc(new Date(m.updatedAt).toLocaleString("es-ES"))}. Edición concreta del proveedor no identificada.</p>`:""}${s?`<a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener noreferrer">Página de origen en iBreviary</a>`:""} <a href="https://www.ibreviary.com/credits_en.html" target="_blank" rel="noopener noreferrer">Créditos de los textos</a><p>El enlace de origen usa la fecha de la sesión del proveedor. La fecha del texto integrado se comprueba al importarlo.</p></footer></section>`;
  }
  function paint(){if(active())document.querySelector("#main").innerHTML=markup();}
  function cleanHtml(html){
    const template=document.createElement("template");template.innerHTML=html;
    const allowed=new Set("P DIV SPAN BR H1 H2 H3 H4 H5 H6 EM STRONG B I U SMALL BLOCKQUOTE OL UL LI SUP SUB TABLE TR TD TH TBODY THEAD HR A".split(" "));
    const classes=new Set("rubrica sezione titulo citazione paragrafo_piccolo capolettera_grande capolettera_piccolo body_2 titolo".split(" "));
    function copy(node){if(node.nodeType===3)return document.createTextNode(node.textContent);if(node.nodeType!==1||!allowed.has(node.tagName))return document.createDocumentFragment();const el=document.createElement(node.tagName.toLowerCase());const cls=[...node.classList].filter(c=>classes.has(c));if(cls.length)el.className=cls.join(" ");const id=node.getAttribute("id");if(id&&/^[a-zA-Z][\w:.-]{0,100}$/.test(id))el.id=id;if(node.tagName==="A"){const href=node.getAttribute("href")||"";try{const u=new URL(href,document.baseURI);if(["https:","http:"].includes(u.protocol)){el.href=href.startsWith("#")?href:u.href;if(!href.startsWith("#")){el.target="_blank";el.rel="noopener noreferrer";}}}catch{}}for(const child of node.childNodes)el.append(copy(child));return el;}
    const fragment=document.createDocumentFragment();for(const node of template.content.childNodes)fragment.append(copy(node));return fragment;
  }
  async function showText(token){
    const s=selected();if(!s)return;
    try{const p=await json(s.object);if(typeof p.html!=="string"||p.sha256!==s.sha256)throw Error("Contenido no válido");if(window.crypto?.subtle){const b=await window.crypto.subtle.digest("SHA-256",new TextEncoder().encode(p.html)),d=[...new Uint8Array(b)].map(b=>b.toString(16).padStart(2,"0")).join("");if(d!==s.sha256)throw Error("Hash incorrecto");}if(token!==state.request||!active())return;document.querySelector("#liturgy-text").replaceChildren(cleanHtml(p.html));document.querySelector("#liturgy-text").removeAttribute("aria-busy");}
    catch{if(token!==state.request||!active())return;state.error="No se pudo abrir este texto. Comprueba la conexión o elige uno guardado en el dispositivo.";paint();}
  }
  async function load(refresh=false){
    const token=++state.request;state.loading=true;state.error="";state.day=null;paint();
    try{if(!state.manifest||refresh)state.manifest=await json("data/liturgy/manifest.json",true);if(state.manifest.schemaVersion!==1||!Array.isArray(state.manifest.dates)||!Array.isArray(state.manifest.common))throw Error("Manifiesto no válido");const entry=state.manifest.dates.find(d=>d.date===state.date);let day=null;if(entry){day=await json(entry.file,refresh);if(day.date!==state.date||day.confirmedProviderDate!==state.date||!Array.isArray(day.sections))throw Error("Fecha incorrecta");}if(token!==state.request||!active())return;state.day=day;if(!sections().some(s=>s.id===state.selected))state.selected=sections()[0]?.id||null;state.loading=false;paint();await showText(token);}
    catch{if(token!==state.request||!active())return;state.loading=false;state.error="No se pudieron cargar los textos. Sin conexión solo puedes abrir los guardados antes en este dispositivo.";paint();}
  }
  function render(){if(!state.date){state.date=today();state.selected=hourIds[suggestedHour(Number(dayParts().hour))];}queueMicrotask(()=>load(true));return markup();}
  async function save(){
    if(!state.day||!window.AtlasRuntime||!window.AtlasDatabase){state.notice="El almacenamiento sin conexión no está disponible en este navegador.";paint();showText(state.request);return;}
    const token=state.request,day=state.day,paths=["data/liturgy/manifest.json",`data/liturgy/days/${day.date}.json`,...day.sections.map(s=>s.object),...state.manifest.common.map(s=>s.object)];const button=document.querySelector("#liturgy-save");if(button)button.disabled=true;
    try{for(let i=0;i<paths.length;i++){await json(paths[i]);const saved=await window.AtlasDatabase.get(window.AtlasRuntime.url(paths[i]));if(saved?.value===undefined)throw Error("No se confirmó el almacenamiento");if(token===state.request){const status=document.querySelector(".liturgy-status");if(status)status.textContent=`Guardando sin conexión: ${i+1} de ${paths.length}…`;}}state.notice=`Textos del ${day.date} y del Misal guardados en este dispositivo. Las secciones ausentes del proveedor no se han guardado.`;}
    catch{state.notice="No se completó la descarga. Se conservan los textos que el navegador sí pudo guardar.";}if(token===state.request&&active()){paint();await showText(token);}
  }
  document.addEventListener("change",event=>{
    if(event.target.id==="liturgy-zone"){try{localStorage.setItem("atlas-liturgy-zone",event.target.value);}catch{}state.date=today();state.selected=hourIds[suggestedHour(Number(dayParts().hour))];state.notice="";load();}
    if(event.target.id==="liturgy-date"&&/^\d{4}-\d\d-\d\d$/.test(event.target.value)){state.date=event.target.value;state.notice="";load();}
    if(event.target.id==="liturgy-section"){state.selected=event.target.value;state.error="";state.loading=false;const token=++state.request;paint();showText(token);}
    if(event.target.id==="liturgy-calendar"){state.calendar=event.target.value;paint();showText(state.request);}
  });
  document.addEventListener("click",event=>{
    const link=event.target.closest("a"),content=document.querySelector("#liturgy-text");
    if(link&&content?.contains(link)&&(link.getAttribute("href")||"").startsWith("#")){
      event.preventDefault();let id;try{id=decodeURIComponent(link.getAttribute("href").slice(1));}catch{return;}const target=document.getElementById(id);if(target&&content.contains(target))target.scrollIntoView({block:"start"});return;
    }
    const b=event.target.closest("button");if(!b)return;if(b.dataset.liturgyKind){state.kind=b.dataset.liturgyKind;state.selected=state.kind==="horas"?hourIds[suggestedHour(Number(dayParts().hour))]:null;state.error="";load();}if(b.id==="liturgy-today"){state.date=today();state.notice="";load(true);}if(b.id==="liturgy-retry"||b.id==="liturgy-refresh")load(true);if(b.id==="liturgy-save")save();if(b.dataset.liturgyFont){state.font=Math.max(16,Math.min(30,state.font+Number(b.dataset.liturgyFont)));document.querySelector(".liturgy-reading")?.style.setProperty("--liturgy-font",`${state.font}px`);}
  });
  for(const t of ["online","offline"])window.addEventListener(t,()=>{if(active()){state.notice="";const el=document.querySelector(".liturgy-status");if(el)el.textContent=navigator.onLine?"Con conexión. Puedes actualizar o guardar los textos.":"Sin conexión. Se usan los textos guardados en este dispositivo.";}});
  A.liturgy={render,dayParts,suggestedHour};
})();
