(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const source = window.ATLAS_EXAM || { norms: [], helps: [], notifications: {}, sources: [] };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const answerLabels = { yes: "Sí", partial: "Parcialmente", no: "No", na: "No aplica" };
  const answerMarks = { yes: "✓", partial: "◐", no: "×", na: "—" };
  const kindLabels = { quotation: "Cita textual", "exam-question": "Pregunta para el examen", "practical-suggestion": "Sugerencia práctica", "editorial-advice": "Consejo editorial", prayer: "Oración breve" };
  let run = null;
  let activeHelp = new Map();
  let pointer = null;
  const briefNormIds = new Set(["presencia-dios", "acciones-gracias", "oracion-manana", "santa-misa", "trabajo", "alegria", "apostolado", "examen-general"]);
  const pad = number => String(number).padStart(2, "0");
  const dayKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseDay = value => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); };
  const todayKey = () => dayKey(new Date());
  const stored = () => root.storage.get().exam;

  function combinedNorms(includeArchived = false) {
    const exam = stored();
    return [...source.norms, ...(exam.customNorms || [])].map((norm, index) => ({
      ...norm, ...(exam.normOverrides[norm.id] || {}), _catalogIndex: index,
      personalNote: (exam.normOverrides[norm.id] || {}).personalNote || norm.personalNote || ""
    })).map(norm => norm.id === "dia-guardia" && exam.config.guardIntention
      ? { ...norm, personalNote: exam.config.guardIntention }
      : norm).filter(norm => includeArchived || !exam.archivedNormIds.includes(norm.id))
      .sort((a, b) => Number(a.order ?? a._catalogIndex) - Number(b.order ?? b._catalogIndex));
  }

  function due(norm, date) {
    if (norm.hidden || norm.paused) return false;
    const frequency = norm.frequency || { type: "daily" };
    if (frequency.type === "daily") return true;
    if (frequency.type === "weekdays") return (frequency.days || []).includes(date.getDay());
    if (frequency.type === "guard-day") return date.getDay() === Number(stored().config.guardDay);
    if (frequency.type === "monthly" && frequency.rule === "third-sunday") return date.getDay() === 0 && date.getDate() >= 15 && date.getDate() <= 21;
    if (frequency.type === "date") return frequency.date === dayKey(date);
    if (frequency.type === "range") return (!frequency.start || dayKey(date) >= frequency.start) && (!frequency.end || dayKey(date) <= frequency.end);
    if (frequency.type === "manual") return Boolean(norm.activeToday);
    return true;
  }

  function normsFor(period, date = new Date()) {
    return combinedNorms().filter(norm => (norm.periods || ["night"]).includes(period) && due(norm, date));
  }

  function session(date, period) {
    return stored().records[date]?.[period] || { status: "pending", mode: stored().config.defaultMode || "quick", answers: {} };
  }

  function statusText(value) {
    return value === "complete" ? "Terminado" : value === "started" ? "Iniciado" : value === "skipped" ? "Omitido hoy" : "Pendiente";
  }

  function periodCard(period, title, subtitle) {
    const date = todayKey();
    const current = session(date, period);
    const norms = normsFor(period);
    const answered = Object.keys(current.answers || {}).filter(id => norms.some(norm => norm.id === id)).length;
    const disabled = period === "midday" && !stored().config.middayEnabled;
    const briefCount = norms.filter(norm => briefNormIds.has(norm.id)).length || Math.min(6, norms.length);
    return `<article class="exam-period-card ${disabled ? "disabled" : ""}"><span class="exam-period-mark">${period === "midday" ? "☼" : "◒"}</span><div><span class="eyebrow">${esc(statusText(current.status))}</span><h2>${esc(title)}</h2><p>${esc(subtitle)}</p>${disabled ? `<button class="text-button" data-exam-open-settings>Activar</button>` : `<div class="exam-start-types"><a class="exam-start-brief" href="#/examen/run?period=${period}&mode=quick&scope=brief"><b>Breve</b><small>${briefCount} esenciales · pocos minutos</small></a><a href="#/examen/run?period=${period}&mode=quick&scope=complete"><b>Completo</b><small>${norms.length} aspectos · recorrido habitual</small></a></div>${answered ? `<small class="exam-resume-note">${answered} respuestas guardadas hoy</small>` : ""}`}</div></article>`;
  }

  function descriptiveSummary(days = 7) {
    const end = new Date();
    const records = [];
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(end); date.setDate(end.getDate() - offset);
      const key = dayKey(date); const night = stored().records[key]?.night;
      if (night) records.push(...Object.entries(night.answers || {}).map(([normId, value]) => ({ normId, answer: value.answer })));
    }
    if (!records.length) return "Cuando haya varios días registrados, Atlas señalará observaciones descriptivas sin convertirlas en una puntuación.";
    const counts = new Map();
    records.forEach(item => { const current = counts.get(item.normId) || { yes: 0, partial: 0, no: 0, na: 0 }; current[item.answer] = (current[item.answer] || 0) + 1; counts.set(item.normId, current); });
    const named = combinedNorms(true).map(norm => ({ norm, values: counts.get(norm.id) })).filter(item => item.values);
    const partial = named.sort((a, b) => (b.values.partial + b.values.no) - (a.values.partial + a.values.no))[0];
    if (!partial) return "Hay registros suficientes para revisar el periodo con calma.";
    const value = partial.values;
    return `${partial.norm.name} aparece ${value.partial ? `parcialmente ${value.partial} ${value.partial === 1 ? "día" : "días"}` : ""}${value.partial && value.no ? " y " : ""}${value.no ? `como no realizada ${value.no} ${value.no === 1 ? "día" : "días"}` : ""}. Es una observación del registro, no un juicio sobre la vida espiritual.`;
  }

  function dashboard() {
    const config = stored().config;
    return `<section class="page exam-page"><header class="exam-hero"><div><span class="eyebrow">Examen diario · privado y local</span><h1>Mirar el día con verdad y con paz.</h1><p>Sin puntos, rachas ni porcentajes. Un espacio para agradecer, rectificar y recomenzar con libertad.</p></div><span class="exam-privacy-seal">⌂<b>Solo en este dispositivo</b><small>Atlas no recibe tus respuestas ni tus notas.</small></span></header>
      <div class="exam-type-intro"><span>Dos maneras de empezar</span><b>Breve</b><small>lo esencial</small><i></i><b>Completo</b><small>todo tu plan</small></div><div class="exam-period-grid">${periodCard("midday", "Examen de mediodía", config.middayEnabled ? `Aviso previsto a las ${config.middayTime}` : "Una pausa breve y opcional para rectificar la tarde.")}${periodCard("night", "Examen de la noche", `Aviso previsto a las ${config.nightTime}`)}</div>
      <section class="exam-observation"><span>Una observación, no una nota</span><p>${esc(descriptiveSummary(7))}</p></section>
      <nav class="exam-dashboard-nav"><a href="#/examen/week"><b>Semana</b><span>Revisa días, estados y notas.</span></a><a href="#/examen/month"><b>Mes</b><span>Cuadrícula sobria y accesible.</span></a><a href="#/examen/norms"><b>Mi plan de vida</b><span>Añade, pausa y ordena normas.</span></a><a href="#/examen/prepare"><b>Preparar una conversación</b><span>Vista privada y opcional.</span></a><a href="#/examen/settings"><b>Avisos y día de guardia</b><span>Horarios, días y preferencias.</span></a><a href="#/examen/sources"><b>Fuentes y ayudas</b><span>${source.stats?.helps || source.helps.length} piezas identificadas.</span></a></nav>
      <p class="exam-principle">El examen ayuda a mirar; no diagnostica la conciencia ni sustituye la dirección espiritual o la confesión.</p></section>`;
  }

  function homeCard() {
    const date = todayKey(); const night = session(date, "night"); const midday = session(date, "midday"); const config = stored().config;
    const order = (root.storage.get().settings.homeOrder || ["exam"]).indexOf("exam") + 1;
    return `<section class="section exam-home-card" data-home-block="exam" style="order:${Math.max(1,order)}"><div><span class="eyebrow">Examen diario · privado</span><h2>Agradecer, rectificar y recomenzar.</h2><p>Sin puntuaciones. Tus respuestas y notas permanecen únicamente en este dispositivo.</p></div><div class="exam-home-status">${config.middayEnabled ? `<span><i>☼</i><b>Mediodía</b><small>${statusText(midday.status)}</small></span>` : ""}<span><i>◒</i><b>Noche</b><small>${statusText(night.status)}</small></span></div><div class="button-row"><a class="primary-button" href="#/examen">Abrir examen</a>${night.status === "started" ? `<a class="secondary-button" href="#/examen/run?period=night&mode=${esc(night.mode || config.defaultMode)}">Continuar</a>` : ""}<a class="text-button" href="#/examen/week">Ver semana</a></div></section>`;
  }

  function frequencyLabel(norm) {
    const frequency = norm.frequency || {};
    if (frequency.type === "daily") return "Diaria";
    if (frequency.type === "weekdays") return `Días ${frequency.days.join(", ")}`;
    if (frequency.type === "guard-day") return "Día de guardia";
    if (frequency.rule === "third-sunday") return "Tercer domingo de mes";
    if (frequency.type === "manual") return "Cuando corresponda";
    return "Frecuencia personal";
  }

  function chooseHelp(norm, answer = "", another = false) {
    const recent = new Set(stored().recentHelpIds || []);
    const current = activeHelp.get(norm.id);
    let candidates = source.helps.filter(help => help.normIds?.includes(norm.id) && help.verified !== false);
    if (answer === "partial" || answer === "no") {
      const preferred = candidates.filter(help => help.kind !== "quotation" || help.tags?.some(tag => ["recomenzar", "perseverancia", "misericordia", "sinceridad"].includes(tag)));
      if (preferred.length >= 3) candidates = preferred;
    }
    if (another) candidates = candidates.filter(help => help.id !== current?.id);
    const fresh = candidates.filter(help => !recent.has(help.id));
    const pool = fresh.length ? fresh : candidates;
    if (!pool.length) return null;
    const help = pool[Math.floor(Math.random() * pool.length)];
    activeHelp.set(norm.id, help); root.storage.rememberExamHelp(help.id); return help;
  }

  function helpCard(norm, answer = "", force = false) {
    const help = activeHelp.get(norm.id) || (force ? chooseHelp(norm, answer) : null);
    if (!help) return "";
    const favorite = stored().favoriteHelpIds.includes(help.id);
    const query = help.sourceQuery || (help.kind === "quotation" ? help.text.slice(0, 150) : "");
    return `<aside class="exam-help" data-help-id="${esc(help.id)}"><span class="eyebrow">${esc(kindLabels[help.kind] || "Ayuda")}</span><blockquote>${esc(help.text)}</blockquote><p>${esc(help.author)}${help.work ? ` · <cite>${esc(help.work)}</cite>` : ""}</p>${help.relevanceBasis ? `<small class="exam-help-relevance">Por qué aparece: ${esc(help.relevanceBasis)}</small>` : ""}<div class="button-row"><button class="text-button" data-exam-another-help="${esc(norm.id)}">Otra ayuda</button><button class="text-button ${favorite ? "saved" : ""}" data-exam-save-help="${esc(help.id)}">${favorite ? "★ Guardada" : "☆ Guardar"}</button>${help.sourceDocumentId ? `<a class="text-button" href="#/reader/${encodeURIComponent(help.sourceDocumentId)}${query ? `?q=${encodeURIComponent(query)}` : ""}">Leer en contexto</a>` : help.sourceUrl ? `<a class="text-button" href="${esc(help.sourceUrl)}" target="_blank" rel="noopener">Abrir fuente ↗</a>` : ""}</div></aside>`;
  }

  function initRun(period, mode, date = todayKey(), persist = true, scope = "complete") {
    const allNorms = normsFor(period, parseDay(date));
    const essential = allNorms.filter(norm => briefNormIds.has(norm.id));
    const norms = scope === "brief" ? (essential.length ? essential : allNorms.slice(0, Math.min(6, allNorms.length))) : allNorms;
    const current = session(date, period);
    const firstUnanswered = norms.findIndex(norm => !current.answers?.[norm.id]);
    run = { period, mode, scope, date, norms, index: Math.max(0, firstUnanswered), reviewing: current.status === "complete", preview: !persist };
    if (persist) root.storage.setExamSession(date, period, { status: current.status === "complete" ? "complete" : "started", mode, scope });
  }

  function runView(route) {
    const period = route.query.get("period") === "midday" ? "midday" : "night";
    const mode = route.query.get("mode") === "paused" ? "paused" : "quick";
    const scope = route.query.get("scope") === "brief" ? "brief" : "complete";
    const date = route.query.get("date") || todayKey();
    const tutorialPreview = route.query.get("tutorial") === "1";
    if (!run || run.period !== period || run.mode !== mode || run.scope !== scope || run.date !== date || run.preview !== tutorialPreview) initRun(period, mode, date, !tutorialPreview, scope);
    const current = session(date, period);
    if (!run.norms.length) return `<section class="page exam-page">${root.library.empty("Hoy no hay elementos previstos", "Puedes activar normas o modificar sus frecuencias en Mi plan de vida.")}<a class="primary-button" href="#/examen/norms">Configurar el plan</a></section>`;
    if (run.index >= run.norms.length) return finishView();
    const norm = run.norms[run.index];
    const saved = current.answers?.[norm.id]?.answer || "";
    const note = stored().notes[`${date}|${period}|${norm.id}`] || {};
    const showGesture = !root.storage.get().settings.examSwipeSeen;
    return `<section class="exam-run exam-run-full"><header class="exam-run-head"><a href="#/examen" class="exam-exit" aria-label="Salir">×</a><span><b>${scope === "brief" ? "Breve" : "Completo"}</b> · ${run.index + 1} / ${run.norms.length}</span><i aria-hidden="true"></i></header><div class="exam-progress"><i style="width:${((run.index + 1) / run.norms.length) * 100}%"></i></div>
      <div class="exam-card-stage"><article class="exam-swipe-card" data-exam-norm="${esc(norm.id)}"><span class="eyebrow">${esc(frequencyLabel(norm))}</span><h1>${esc(norm.name)}</h1>${norm.description ? `<p>${esc(norm.description)}</p>` : ""}${mode === "paused" ? `<p class="exam-question">${esc(norm.question || "¿Cómo he vivido hoy este aspecto?")}</p>${helpCard(norm, saved, true)}<label class="exam-inline-note"><span>Nota privada</span><textarea data-exam-note="${esc(norm.id)}" placeholder="Opcional">${esc(note.text || "")}</textarea></label>` : ""}<div class="exam-swipe-feedback" aria-hidden="true"></div><div class="exam-swipe-directions" aria-hidden="true"><span>← Sí</span><span>No →</span></div></article></div>
      <button class="exam-detail-toggle exam-detail-below" data-exam-toggle-mode>${mode === "quick" ? "Reflexión y consejo" : "Volver al modo sencillo"}</button>
      ${showGesture ? `<aside class="exam-gesture-guide exam-gesture-simple"><button data-exam-dismiss-gestures aria-label="Cerrar">×</button><b>Desliza: Sí ← · No →</b><p>También puedes tocar los dos botones inferiores.</p></aside>` : ""}
      <div class="exam-answer-buttons exam-primary-answers"><button data-exam-answer="yes"><i>←</i>Sí</button><button data-exam-answer="no">No<i>→</i></button></div>
      <details class="exam-more-answers"><summary>Otra respuesta</summary><div>${norm.partial !== false ? `<button data-exam-answer="partial">Parcial</button>` : ""}<button data-exam-answer="na">No aplica</button><a href="#/examen/norms?focus=${encodeURIComponent(norm.id)}">Configurar</a></div></details></section>`;
  }

  function finishView() {
    const current = session(run.date, run.period);
    const values = Object.values(current.answers || {}).map(item => item.answer);
    const counts = Object.fromEntries(["yes", "partial", "no", "na"].map(answer => [answer, values.filter(value => value === answer).length]));
    if (run.scope === "brief") root.storage.setExamSession(run.date, run.period, { briefCompletedAt: new Date().toISOString(), mode: run.mode, scope: run.scope });
    else if (current.status !== "complete") root.storage.setExamSession(run.date, run.period, { status: "complete", completedAt: new Date().toISOString(), mode: run.mode, scope: run.scope });
    return `<section class="page exam-finish"><span class="exam-finish-mark">✦</span><span class="eyebrow">Examen ${run.scope === "brief" ? "breve" : "completo"} terminado</span><h1>Gracias. Rectificar y descansar también forman parte del camino.</h1><p>Este resumen describe lo que has marcado; no calcula una nota.</p><div class="exam-result-summary">${Object.entries(counts).filter(([,count]) => count).map(([answer,count]) => `<span data-answer="${answer}"><i>${answerMarks[answer]}</i><b>${count}</b><small>${answerLabels[answer]}</small></span>`).join("")}</div><div class="button-row"><a class="primary-button" href="#/examen">Terminar</a>${run.scope === "brief" ? `<a class="secondary-button" href="#/examen/run?period=${run.period}&mode=quick&scope=complete&date=${run.date}">Continuar con el completo</a>` : `<a class="secondary-button" href="#/examen/run?period=${run.period}&mode=paused&scope=complete&date=${run.date}">Revisar despacio</a>`}</div><p class="exam-principle">Si algo no salió, mañana no empieza desde cero: empieza desde la experiencia de hoy.</p></section>`;
  }

  function weekStart(date = new Date()) { const result = new Date(date); const day = result.getDay() || 7; result.setDate(result.getDate() - day + 1); result.setHours(0,0,0,0); return result; }
  function addDays(date, amount) { const result = new Date(date); result.setDate(result.getDate() + amount); return result; }
  function easterSunday(year) {
    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;
    return new Date(year, month - 1, day);
  }
  function calendarInfo(date) {
    const fixed = { "01-01":"Santa María, Madre de Dios", "01-06":"Epifanía del Señor", "03-19":"San José", "03-25":"Anunciación del Señor", "06-29":"Santos Pedro y Pablo", "08-15":"Asunción de la Virgen", "11-01":"Todos los Santos", "12-08":"Inmaculada Concepción", "12-25":"Natividad del Señor" };
    const easter = easterSunday(date.getFullYear());
    const movable = new Map([[-46,"Miércoles de Ceniza"],[-7,"Domingo de Ramos"],[0,"Domingo de Pascua"],[42,"Ascensión del Señor"],[49,"Pentecostés"],[56,"Santísima Trinidad"],[63,"Corpus Christi"],[68,"Sagrado Corazón de Jesús"]].map(([offset,name]) => [dayKey(addDays(easter, offset)), name]));
    const feast = fixed[dayKey(date).slice(5)] || movable.get(dayKey(date)) || "";
    return { feast, className: `${date.getDay() === 0 ? "is-sunday" : ""} ${feast ? "is-feast" : ""}`.trim(), title: feast || (date.getDay() === 0 ? "Domingo" : "") };
  }
  function weekView() {
    const start = weekStart(); const days = Array.from({ length: 7 }, (_, index) => addDays(start, index)); const norms = combinedNorms();
    return `<section class="page exam-page"><header class="section-head"><div><span class="eyebrow">Vista semanal · visión global</span><h1>Siete días, sin reducirlos a una nota.</h1><p>La semana cabe completa también en el móvil. Domingos y festividades tienen una columna propia.</p></div><a class="secondary-button" href="#/examen">Hoy</a></header><div class="exam-calendar-key"><span class="is-sunday">Domingo</span><span class="is-feast">Festividad</span></div><div class="exam-table-wrap overview"><table class="exam-grid-table exam-overview week"><thead><tr><th>Norma</th>${days.map(date => { const info=calendarInfo(date); return `<th class="${info.className}" title="${esc(info.title)}"><b>${date.toLocaleDateString("es", { weekday: "short" })}</b><small>${date.getDate()}</small>${info.feast ? `<i>✦</i>` : ""}</th>`; }).join("")}</tr></thead><tbody>${norms.map(norm => `<tr><th title="${esc(norm.name)}">${esc(norm.name)}</th>${days.map(date => { const key = dayKey(date); const expected = due(norm, date) && (norm.periods || ["night"]).includes("night"); const value = stored().records[key]?.night?.answers?.[norm.id]?.answer; const info=calendarInfo(date); return `<td class="${info.className}"><a class="exam-cell state-${value || (expected ? "empty" : "na")}" href="#/examen/run?period=night&mode=paused&date=${key}" title="${esc([info.title,value ? answerLabels[value] : expected ? "Sin registrar" : "No correspondía"].filter(Boolean).join(" · "))}">${value ? answerMarks[value] : expected ? "·" : "—"}</a></td>`; }).join("")}</tr>`).join("")}</tbody></table></div><section class="exam-observation"><span>Lectura descriptiva</span><p>${esc(descriptiveSummary(7))}</p></section></section>`;
  }

  function monthView(route) {
    const requested = route.query.get("month"); const base = requested ? new Date(`${requested}-01T12:00:00`) : new Date();
    const year = base.getFullYear(), month = base.getMonth(); const count = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: count }, (_, index) => new Date(year, month, index + 1)); const norms = combinedNorms();
    const previous = new Date(year, month - 1, 1), next = new Date(year, month + 1, 1);
    return `<section class="page exam-page"><header class="section-head"><div><span class="eyebrow">Vista mensual · visión global</span><h1>${base.toLocaleDateString("es", { month: "long", year: "numeric" })}</h1><p>Todo el mes cabe en pantalla; toca una marca para abrir el día. ✦ identifica festividades.</p></div><div class="button-row"><a class="secondary-button" href="#/examen/month?month=${dayKey(previous).slice(0,7)}">←</a><a class="secondary-button" href="#/examen/month?month=${dayKey(next).slice(0,7)}">→</a></div></header><div class="exam-calendar-key"><span class="is-sunday">Domingo</span><span class="is-feast">Festividad</span></div><div class="exam-table-wrap monthly overview"><table class="exam-grid-table exam-overview month"><thead><tr><th>Norma</th>${days.map(date => { const info=calendarInfo(date); return `<th class="${info.className}" title="${esc(info.title)}">${date.getDate()}${info.feast ? `<i>✦</i>` : ""}</th>`; }).join("")}</tr></thead><tbody>${norms.map(norm => `<tr><th title="${esc(norm.name)}">${esc(norm.name)}</th>${days.map(date => { const key = dayKey(date); const expected = due(norm, date); const value = stored().records[key]?.night?.answers?.[norm.id]?.answer; const info=calendarInfo(date); return `<td class="${info.className}"><a class="exam-cell state-${value || (expected ? "empty" : "na")}" href="#/examen/run?period=night&mode=paused&date=${key}" title="${esc([info.title,value ? answerLabels[value] : expected ? "Sin registrar" : "No correspondía"].filter(Boolean).join(" · "))}">${value ? answerMarks[value] : expected ? "·" : "—"}</a></td>`; }).join("")}</tr>`).join("")}</tbody></table></div><div class="exam-legend">${Object.entries({ yes:"Sí",partial:"Parcial",no:"No",na:"No aplica",empty:"Sin registrar" }).map(([key,label]) => `<span class="state-${key}"><i>${answerMarks[key] || "·"}</i>${label}</span>`).join("")}</div></section>`;
  }

  function normManager(route) {
    const archived = new Set(stored().archivedNormIds); const focus = route.query.get("focus") || "";
    const rows = combinedNorms(true).map(norm => `<article class="exam-norm-row ${focus === norm.id ? "focus" : ""} ${archived.has(norm.id) ? "archived" : ""}" data-norm-row="${esc(norm.id)}"><div><span class="eyebrow">${norm.custom ? "Personal" : esc(frequencyLabel(norm))}</span><h3>${esc(norm.name)}</h3><p>${esc(norm.description || "")}</p>${norm.personalNote ? `<small>Tu nota: ${esc(norm.personalNote)}</small>` : ""}</div><div class="exam-norm-actions"><button data-exam-move="${esc(norm.id)}" data-direction="-1" title="Subir">↑</button><button data-exam-move="${esc(norm.id)}" data-direction="1" title="Bajar">↓</button><button data-exam-pause="${esc(norm.id)}">${norm.paused ? "Reanudar" : "Pausar"}</button><button data-exam-archive="${esc(norm.id)}">${archived.has(norm.id) ? "Recuperar" : "Archivar"}</button>${norm.custom ? `<button data-exam-edit-custom="${esc(norm.id)}">Editar</button>` : ""}</div></article>`).join("");
    const plain = (stored().customNorms || []).map(norm => norm.name).join("\n");
    return `<section class="page exam-page"><header class="section-head"><div><span class="eyebrow">Mi plan de vida</span><h1>Edita tu examen sin pelearte con formularios.</h1><p>El editor rápido usa una línea por norma. Las opciones detalladas quedan disponibles solo cuando las necesitas.</p></div><a class="secondary-button" href="#/examen">Volver</a></header>
      <form id="exam-plain-form" class="exam-plain-editor"><div><span class="eyebrow">Editor rápido</span><h2>Una línea = una norma personal</h2><p>Ejemplo:<br><code>Oración mental<br>Lectura del Evangelio<br>Charla fraterna</code></p></div><label><span>Mis normas personales</span><textarea name="norms" rows="8" placeholder="Oración mental&#10;Lectura espiritual&#10;Examen particular">${esc(plain)}</textarea></label><button class="primary-button" type="submit">Guardar lista</button><small>Las líneas nuevas se crean como normas diarias del examen de la noche. Abre «Opciones avanzadas» para cambiar frecuencia, pregunta o consejo.</small></form>
      <details class="exam-advanced-editor"><summary>Opciones avanzadas de una norma</summary><div class="exam-manager-layout"><form id="exam-custom-form" class="card exam-custom-form"><input type="hidden" name="id"><span class="eyebrow">Norma personal</span><h2>Añadir o editar</h2><label>Nombre<input name="name" required maxlength="100"></label><label>Descripción<textarea name="description" maxlength="300"></textarea></label><div class="form-row"><label>Frecuencia<select name="frequency"><option value="daily">Diaria</option><option value="weekdays">Días concretos</option><option value="manual">Cuando corresponda</option></select></label><label>Días (0 domingo…6 sábado)<input name="days" placeholder="1,2,3,4,5"></label></div><div class="form-row"><label>Examen<select name="period"><option value="night">Noche</option><option value="midday">Mediodía</option><option value="both">Ambos</option></select></label><label class="check"><input type="checkbox" name="partial" checked> Admite «parcialmente»</label></div><label>Nota fija personal<textarea name="personalNote" maxlength="400"></textarea></label><label>Pregunta concreta<input name="question" maxlength="220"></label><label>Consejo personal<input name="suggestion" maxlength="220"></label><button class="primary-button" type="submit">Guardar norma personal</button><p class="result" id="exam-custom-result"></p></form></div></details>
      <div class="exam-norm-list">${rows}</div></section>`;
  }

  function settingsView() {
    const config = stored().config;
    const dayOptions = [[1,"L"],[2,"M"],[3,"X"],[4,"J"],[5,"V"],[6,"S"],[0,"D"]];
    const daySelector = (name, selected) => `<fieldset class="exam-day-selector"><legend>Días activos</legend>${dayOptions.map(([value, label]) => `<label><input type="checkbox" name="${name}" value="${value}" ${(selected || []).includes(value) ? "checked" : ""}><span>${label}</span></label>`).join("")}</fieldset>`;
    return `<section class="page exam-page"><header class="section-head"><div><span class="eyebrow">Configuración</span><h1>Avisos discretos y enteramente opcionales.</h1><p>En una PWA estática los avisos programados funcionan mientras Atlas está abierto o cuando el sistema mantiene la PWA activa.</p></div><a class="secondary-button" href="#/examen">Volver</a></header><form id="exam-settings-form" class="exam-settings-grid">
      <section><h2>Mediodía</h2><label class="notification-row"><span><b>Examen breve</b><small>Una pausa que no cuenta como incumplida si se omite.</small></span><input type="checkbox" name="middayEnabled" ${config.middayEnabled ? "checked" : ""}></label><label>Hora<input type="time" name="middayTime" value="${esc(config.middayTime)}"></label>${daySelector("middayDays", config.middayDays)}</section>
      <section><h2>Noche</h2><label class="notification-row"><span><b>Recordatorio nocturno</b><small>No se muestra si el examen ya está terminado.</small></span><input type="checkbox" name="nightEnabled" ${config.nightEnabled ? "checked" : ""}></label><label>Hora<input type="time" name="nightTime" value="${esc(config.nightTime)}"></label>${daySelector("nightDays", config.nightDays)}<label class="notification-row"><span><b>Segundo aviso</b><small>Opcional y también sin tono culpabilizador.</small></span><input type="checkbox" name="nightSecondEnabled" ${config.nightSecondEnabled ? "checked" : ""}></label><label>Segunda hora<input type="time" name="nightSecondTime" value="${esc(config.nightSecondTime)}"></label></section>
      <section><h2>Descanso y día de guardia</h2><div class="form-row"><label>Silencio desde<input type="time" name="quietFrom" value="${esc(config.quietFrom || "23:30")}"></label><label>Hasta<input type="time" name="quietTo" value="${esc(config.quietTo || "07:30")}"></label></div><p>Durante esta franja Atlas no mostrará recordatorios.</p><label>Día de guardia<select name="guardDay">${dayOptions.map(([value,label]) => `<option value="${value}" ${Number(config.guardDay)===value?"selected":""}>${label}</option>`).join("")}</select></label><label>Intención personal<textarea name="guardIntention">${esc(config.guardIntention || "")}</textarea></label></section>
      <section><h2>Modo habitual</h2><label><select name="defaultMode"><option value="quick" ${config.defaultMode==="quick"?"selected":""}>Rápido</option><option value="paused" ${config.defaultMode==="paused"?"selected":""}>Pausado</option></select></label><p>Tus cambios no modifican el catálogo general y sobreviven a las actualizaciones.</p></section><button class="primary-button" type="submit">Guardar configuración</button></form></section>`;
  }

  function prepareView() {
    const since = dayKey(addDays(new Date(), -6));
    const notes = Object.entries(stored().notes).filter(([key,note]) => key.slice(0,10) >= since && note.text).sort((a,b) => a[0].localeCompare(b[0])).slice(0, 80);
    const normMap = new Map(combinedNorms(true).map(norm => [norm.id, norm]));
    const weekly = combinedNorms(true).map(norm => { let partial=0,no=0,yes=0; for(let offset=0;offset<7;offset+=1){const key=dayKey(addDays(new Date(),-offset));const answer=stored().records[key]?.night?.answers?.[norm.id]?.answer;if(answer==="yes")yes+=1;if(answer==="partial")partial+=1;if(answer==="no")no+=1;} return {norm,yes,partial,no}; }).filter(item => item.yes || item.partial || item.no).sort((a,b)=>(b.partial+b.no)-(a.partial+a.no));
    return `<section class="page exam-page"><header class="section-head"><div><span class="eyebrow">Charla fraterna · preparación privada</span><h1>Ordenar la semana antes de conversar.</h1><p>Atlas reúne registros y notas; tú decides qué llevar. No redacta confesiones ni formula juicios.</p></div><a class="secondary-button" href="#/examen">Volver</a></header><div class="exam-private-banner"><b>Privacidad</b><span>Nada sale del dispositivo sin una acción expresa. El informe es descriptivo y editable.</span></div><section class="exam-week-brief"><h2>Vista de la semana</h2>${weekly.length ? weekly.slice(0,12).map(item => `<span><b>${esc(item.norm.name)}</b><small>${item.yes} sí · ${item.partial} parcial · ${item.no} no</small></span>`).join("") : `<p>Aún no hay respuestas esta semana.</p>`}</section><section class="exam-prepare"><div><h2>Notas de los últimos siete días</h2><p>Selecciona únicamente lo que quieras llevar a la Charla.</p>${notes.length ? notes.map(([key,note]) => { const [date,period,normId] = key.split("|"); return `<label class="exam-review-item"><input type="checkbox" data-prep-note="${esc(key)}" ${note.review ? "checked" : ""}><span><b>${esc(normMap.get(normId)?.name || normId)}</b><small>${esc(note.text)} · ${new Date(`${date}T12:00:00`).toLocaleDateString("es",{weekday:"short",day:"numeric"})} · ${period === "midday" ? "mediodía" : "noche"}</small></span></label>`; }).join("") : `<p>No has escrito notas esta semana.</p>`}</div><label>Agradecimientos, asuntos o preguntas<textarea id="exam-prep-free" placeholder="Escribe solo lo que quieras recordar"></textarea></label><button class="primary-button" data-exam-generate-prep>Preparar informe para la Charla</button><div id="exam-prep-output" class="exam-prep-output" hidden></div></section></section>`;
  }

  function sourcesView() {
    return `<section class="page exam-page"><header class="section-head"><div><span class="eyebrow">Fuentes y ayudas</span><h1>Procedencia visible, tipos distintos.</h1><p>Las citas conservan autor, obra y relación temática. Los consejos de Atlas se identifican siempre como editoriales.</p></div><a class="secondary-button" href="#/examen">Volver</a></header><div class="exam-source-stats"><span><b>${source.stats?.helps || source.helps.length}</b>ayudas</span><span><b>${source.stats?.quotations || 0}</b>citas textuales</span><span><b>${source.stats?.sanJosemaria || 0}</b>de san Josemaría</span><span><b>${source.stats?.papal || 0}</b>pontificias</span><span><b>${source.stats?.contextualDocuments || 0}</b>contextos exactos</span></div><div class="exam-source-list">${source.sources.map(item => `<article><span class="eyebrow">${esc(item.kind)} · ${item.status === "indexed" ? "Indexada localmente" : "Metadatos y enlace"}</span><h3>${esc(item.title)}</h3><p>${esc(item.notes || "Se respeta el acceso y las condiciones de la fuente.")}</p>${item.location ? `<code>${esc(item.location)}</code>` : ""}${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">Abrir fuente ↗</a>` : ""}</article>`).join("")}</div></section>`;
  }

  function render(route) {
    const section = route.segments[1] || "";
    if (section === "run") return runView(route);
    if (section === "week") return weekView();
    if (section === "month") return monthView(route);
    if (section === "norms") return normManager(route);
    if (section === "settings") return settingsView();
    if (section === "prepare") return prepareView();
    if (section === "sources") return sourcesView();
    return dashboard();
  }

  function rerender() { window.dispatchEvent(new CustomEvent("atlas:exam-changed")); }

  function recordAnswer(answer, card) {
    if (!run) return;
    const norm = run.norms[run.index];
    const move = answer === "yes" ? "left" : answer === "no" ? "right" : answer === "partial" ? "up" : "fade";
    card?.classList.add(`answered-${move}`);
    setTimeout(() => {
      root.storage.setExamAnswer(run.date, run.period, norm.id, answer);
      run.index += 1;
      if (run.index >= run.norms.length) root.storage.setExamSession(run.date, run.period, run.scope === "brief" ? { briefCompletedAt: new Date().toISOString(), mode: run.mode, scope: run.scope } : { status: "complete", completedAt: new Date().toISOString(), mode: run.mode, scope: run.scope });
      rerender();
    }, card ? 190 : 0);
  }

  function fillCustomForm(norm) {
    const form = document.querySelector("#exam-custom-form"); if (!form) return;
    form.elements.id.value = norm.id; form.elements.name.value = norm.name || ""; form.elements.description.value = norm.description || "";
    form.elements.frequency.value = norm.frequency?.type || "daily"; form.elements.days.value = (norm.frequency?.days || []).join(",");
    form.elements.period.value = (norm.periods || []).length > 1 ? "both" : norm.periods?.[0] || "night";
    form.elements.partial.checked = norm.partial !== false; form.elements.personalNote.value = norm.personalNote || "";
    form.elements.question.value = norm.question || ""; form.elements.suggestion.value = norm.suggestion || ""; form.scrollIntoView({ behavior: "smooth" });
  }

  document.addEventListener("click", event => {
    const answer = event.target.closest("[data-exam-answer]"); if (answer) { recordAnswer(answer.dataset.examAnswer, document.querySelector(".exam-swipe-card")); return; }
    if (event.target.closest("[data-exam-dismiss-gestures]")) { root.storage.setSetting("examSwipeSeen", true); document.querySelector(".exam-gesture-guide")?.remove(); return; }
    if (event.target.closest("[data-exam-toggle-mode]")) { location.hash = `/examen/run?period=${run.period}&mode=${run.mode === "quick" ? "paused" : "quick"}&scope=${run.scope}&date=${run.date}`; return; }
    const helpButton = event.target.closest("[data-exam-help], [data-exam-another-help]");
    if (helpButton) { const id = helpButton.dataset.examHelp || helpButton.dataset.examAnotherHelp; const norm = combinedNorms(true).find(item => item.id === id); if (norm) { chooseHelp(norm, session(run.date, run.period).answers?.[norm.id]?.answer, true); rerender(); } return; }
    const saveHelp = event.target.closest("[data-exam-save-help]"); if (saveHelp) { root.storage.toggleExamHelp(saveHelp.dataset.examSaveHelp); rerender(); return; }
    if (event.target.closest("[data-exam-open-settings]")) { location.hash = "/examen/settings"; return; }
    const pause = event.target.closest("[data-exam-pause]"); if (pause) { const norm = combinedNorms(true).find(item => item.id === pause.dataset.examPause); root.storage.updateExamNorm(norm.id, { paused: !norm.paused }); rerender(); return; }
    const archive = event.target.closest("[data-exam-archive]"); if (archive) { const id = archive.dataset.examArchive; root.storage.archiveExamNorm(id, !stored().archivedNormIds.includes(id)); rerender(); return; }
    const edit = event.target.closest("[data-exam-edit-custom]"); if (edit) { fillCustomForm(stored().customNorms.find(norm => norm.id === edit.dataset.examEditCustom)); return; }
    const move = event.target.closest("[data-exam-move]"); if (move) { const norms = combinedNorms(true); const index = norms.findIndex(norm => norm.id === move.dataset.examMove); const target = Math.max(0, Math.min(norms.length - 1, index + Number(move.dataset.direction))); if (target !== index) { const a = norms[index], b = norms[target]; root.storage.updateExamNorm(a.id, { order: target }); root.storage.updateExamNorm(b.id, { order: index }); rerender(); } return; }
    if (event.target.closest("[data-exam-generate-prep]")) {
      event.preventDefault(); const selected = [...document.querySelectorAll("[data-prep-note]:checked")].map(input => input.dataset.prepNote); const output = document.querySelector("#exam-prep-output");
      const lines = selected.map(key => { const [date,period,normId] = key.split("|"); return `• ${date} · ${combinedNorms(true).find(norm => norm.id === normId)?.name || normId}: ${stored().notes[key].text} (${period})`; });
      const observations = combinedNorms(true).map(norm => { let partial=0,no=0; for(let offset=0;offset<7;offset+=1){const key=dayKey(addDays(new Date(),-offset));const answer=stored().records[key]?.night?.answers?.[norm.id]?.answer;if(answer==="partial")partial+=1;if(answer==="no")no+=1;} return {name:norm.name,partial,no}; }).filter(item=>item.partial||item.no).sort((a,b)=>(b.partial+b.no)-(a.partial+a.no)).slice(0,8).map(item=>`• ${item.name}: ${item.partial} parcial · ${item.no} no`);
      const free = document.querySelector("#exam-prep-free")?.value.trim();
      const report=["OBSERVACIONES DE LA SEMANA",...(observations.length?observations:["• Sin incidencias seleccionadas"]),"","NOTAS ELEGIDAS",...(lines.length?lines:["• Ninguna nota seleccionada"]),free?`\nOTROS ASUNTOS\n${free}`:""].filter(value=>value!=="");
      output.hidden = false; output.innerHTML = `<span class="eyebrow">Informe privado para la Charla fraterna</span><h2>Semana ordenada por ti</h2><pre>${esc(report.join("\n"))}</pre><button class="secondary-button" data-exam-copy-prep>Copiar conscientemente</button>`; return;
    }
    if (event.target.closest("[data-exam-copy-prep]")) { navigator.clipboard?.writeText(document.querySelector("#exam-prep-output pre")?.innerText || ""); root.appToast?.("Resumen copiado por decisión tuya."); }
  });

  document.addEventListener("submit", event => {
    if (event.target.id === "exam-plain-form") {
      event.preventDefault();
      const lines = String(new FormData(event.target).get("norms") || "").split(/\r?\n/);
      root.storage.setCustomNormsFromLines(lines);
      root.appToast?.("Lista personal actualizada.");
      rerender();
      return;
    }
    if (event.target.id === "exam-custom-form") {
      event.preventDefault(); const form = new FormData(event.target); const frequencyType = form.get("frequency"); const days = String(form.get("days") || "").split(",").map(Number).filter(day => day >= 0 && day <= 6);
      const period = form.get("period"); root.storage.upsertCustomNorm({ id: form.get("id") || undefined, name: String(form.get("name")).trim(), description: String(form.get("description") || "").trim(), type: "personal", frequency: { type: frequencyType, ...(frequencyType === "weekdays" ? { days } : {}) }, periods: period === "both" ? ["midday","night"] : [period], partial: form.has("partial"), personalNote: String(form.get("personalNote") || "").trim(), question: String(form.get("question") || "").trim(), suggestion: String(form.get("suggestion") || "").trim(), tags: ["personal"] }); event.target.reset(); rerender(); return;
    }
    if (event.target.id === "exam-settings-form") {
      event.preventDefault(); const form = new FormData(event.target); root.storage.updateExamConfig({ middayEnabled: form.has("middayEnabled"), middayTime: form.get("middayTime"), middayDays: form.getAll("middayDays").map(Number), nightEnabled: form.has("nightEnabled"), nightTime: form.get("nightTime"), nightDays: form.getAll("nightDays").map(Number), nightSecondEnabled: form.has("nightSecondEnabled"), nightSecondTime: form.get("nightSecondTime"), quietFrom: form.get("quietFrom"), quietTo: form.get("quietTo"), guardDay: Number(form.get("guardDay")), guardIntention: String(form.get("guardIntention") || ""), defaultMode: form.get("defaultMode") });
      if ((form.has("middayEnabled") || form.has("nightEnabled")) && "Notification" in window && Notification.permission === "default") Notification.requestPermission(); root.appToast?.("Configuración del examen guardada."); rerender();
    }
  });

  document.addEventListener("change", event => {
    if (event.target.dataset.examReviewNote && run) { const note = document.querySelector(`[data-exam-note="${CSS.escape(event.target.dataset.examReviewNote)}"]`); root.storage.setExamNote(run.date, run.period, event.target.dataset.examReviewNote, note?.value || "", event.target.checked); }
  });
  document.addEventListener("focusout", event => { if (event.target.dataset.examNote && run) { const review = document.querySelector(`[data-exam-review-note="${CSS.escape(event.target.dataset.examNote)}"]`); root.storage.setExamNote(run.date, run.period, event.target.dataset.examNote, event.target.value, review?.checked); } });

  document.addEventListener("pointerdown", event => { const card = event.target.closest(".exam-swipe-card"); if (!card || event.target.closest("button,a,textarea,input")) return; pointer = { card, x: event.clientX, y: event.clientY, dx: 0, dy: 0 }; card.setPointerCapture?.(event.pointerId); });
  document.addEventListener("pointermove", event => { if (!pointer) return; pointer.dx = event.clientX - pointer.x; pointer.dy = event.clientY - pointer.y; const dx = Math.abs(pointer.dx) > Math.abs(pointer.dy) ? pointer.dx : pointer.dx * .35; pointer.card.style.transform = `translate3d(${dx}px,0,0) rotate(${dx * .018}deg)`; pointer.card.style.setProperty("--swipe-strength", Math.min(1, Math.abs(dx) / 120)); const feedback = pointer.card.querySelector(".exam-swipe-feedback"); if (feedback) feedback.textContent = Math.abs(dx) > 18 ? dx < 0 ? "Sí" : "No" : ""; });
  document.addEventListener("pointerup", () => { if (!pointer) return; const { card, dx, dy } = pointer; pointer = null; card.style.transform = ""; card.style.removeProperty("--swipe-strength"); if (Math.abs(dx) > Math.abs(dy) && dx < -90) recordAnswer("yes", card); else if (Math.abs(dx) > Math.abs(dy) && dx > 90) recordAnswer("no", card); });

  function checkReminders() {
    const config = stored().config; if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date(), date = dayKey(now), weekday = now.getDay(), minute = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const quiet = config.quietFrom && config.quietTo && (config.quietFrom <= config.quietTo
      ? minute >= config.quietFrom && minute < config.quietTo
      : minute >= config.quietFrom || minute < config.quietTo);
    if (quiet) return;
    const options = [
      { period: "midday", enabled: config.middayEnabled && config.middayDays.includes(weekday), time: config.middayTime },
      { period: "night", enabled: config.nightEnabled && config.nightDays.includes(weekday), time: config.nightTime },
      { period: "night", suffix: "second", enabled: config.nightSecondEnabled && config.nightDays.includes(weekday), time: config.nightSecondTime }
    ];
    options.forEach(option => {
      const key = `${date}|${option.period}|${option.suffix || "first"}`;
      if (!option.enabled || minute !== option.time || config.lastReminderKey === key || session(date, option.period).status === "complete") return;
      const messages = source.notifications?.[option.period] || []; const body = messages[Math.floor(Math.random() * messages.length)] || "Un momento breve para agradecer y recomenzar.";
      const notification = new Notification(option.period === "midday" ? "Atlas · Examen de mediodía" : "Atlas · Examen de la noche", { body, icon: "assets/icons/icon-192.png", tag: `atlas-exam-${option.period}` });
      notification.onclick = () => { window.focus(); location.hash = `/examen/run?period=${option.period}&mode=${config.defaultMode || "quick"}`; };
      root.storage.updateExamConfig({ lastReminderKey: key });
    });
  }
  setInterval(checkReminders, 30000);
  root.exam = { render, homeCard, checkReminders, normsFor };
})();
