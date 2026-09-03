(() => {
  "use strict";
  const world = document.querySelector("#world");
  const captions = [...document.querySelectorAll(".caption")];
  const obsoleteCaseCaption = captions.find(item => item.dataset.phase === "case-sex-3");
  if (obsoleteCaseCaption) {
    captions.splice(captions.indexOf(obsoleteCaseCaption), 1);
    obsoleteCaseCaption.remove();
    document.querySelector('[data-case="sex-3"]')?.remove();
  }
  const landmarks = [...document.querySelectorAll(".landmark")];
  const progress = document.querySelector("#progress");
  const counter = document.querySelector("#counter");
  const stepLabel = document.querySelector("#step-label");
  const zoomValue = document.querySelector("#zoom-value");
  let current = Math.max(0, Math.min(captions.length - 1, Number((location.hash.match(/\d+/) || [0])[0])));
  let wheelLock = false;
  let touchStart = null;
  let cameraAnimation = null;

  const phaseLandmark = {
    problem: "problem", converge: "problem", overview: "atlas", benefits: "atlas", return: "all", atlas: "atlas", final: "all",
    library: "library", books: "library", field: "library", catalog: "library", "catalog-detail": "library",
    "ia-doctrine": "showcase", "ia-canon": "showcase", "ia-history": "showcase", "ia-liturgy": "showcase",
    "ia-orthodox": "showcase", "ia-cine": "showcase", "ia-books": "showcase", "ia-classics": "showcase",
    "ia-josemaria": "showcase", "ia-prep": "showcase", "ia-saints": "showcase", "ia-prayer": "showcase",
    "ai-tree": "model", vet: "model", sequence: "model", "token-math": "model", matrix: "model", parameters: "model",
    compare: "compare", chatgpt: "compare", notebook: "compare", together: "compare",
    opus: "opus", "opus-map": "opus", "opus-prayer": "opus", "opus-study": "opus", preparador: "opus", life: "life", exam: "life", discover: "discover",
    cases: "cases", "case-prep": "cases", "case-pray": "cases", "case-doctrine": "cases", "case-moral": "cases",
    "case-saint": "cases", "case-liturgy": "cases", "case-debate": "cases", "case-history": "cases", "case-books": "cases",
    "case-classics": "cases", "case-cinema": "cases", "case-circle-result": "cases",
    "case-sex-1": "cases", "case-sex-2": "cases", "case-sex-3": "cases",
    gameplay: "gameplay", "live-home": "gameplay", "live-library": "gameplay", "live-documents": "gameplay",
    "live-authors": "gameplay", "live-topics": "gameplay", "live-reader": "gameplay",
    "live-ask": "gameplay", "live-specialists": "gameplay", "live-pray": "gameplay", "live-gospel": "gameplay",
    "live-bible": "gameplay", "live-form": "gameplay", "live-salvation": "gameplay", "live-opus": "gameplay",
    "live-discover": "gameplay", "live-exam": "gameplay", "live-saved": "gameplay"
  };

  const liveFrame = document.querySelector("#live-atlas-frame");
  const liveBrowser = document.querySelector("#live-browser");
  const liveRouteLabel = document.querySelector("#live-route");
  const liveJourney = [...document.querySelectorAll(".live-journey span")];
  const liveStep = document.querySelector("#live-step");
  const liveTitle = document.querySelector("#live-title");
  const liveDescription = document.querySelector("#live-description");
  let currentLiveRoute = "/";
  const atlasBase = location.protocol === "file:"
    ? "http://127.0.0.1:8766/"
    : new URL("../", location.href).href;
  const originalCaseConfig = {
    prep: { heading: "Caso 1: preparar un círculo", block: 1, ai: "Preparador de Círculos", icon: "◌", title: "Preparar un círculo", prompt: "Doctrina social · Santa Misa · Acordaos · Evangelio Mt 24, 42-51" },
    pray: { heading: "Caso 2: Hacer oración", block: 1, ai: "Oración DiarIA", icon: "✦", title: "Estoy desanimado y no sé rezar", prompt: "Como la samaritana, me refugio en mis comodidades y ya no rezo por mis amigos." },
    doctrine: { heading: "Caso 3: formación doctrinal", block: 1, ai: "Doctrina y Moral", icon: "D", title: "¿Qué es la doctrina social de la Iglesia?", prompt: "Principios, ámbitos que ilumina y horizontes aún por descubrir." },
    moral: { heading: "Caso 4: cuestión de estudio moral y doctrina social", block: 1, ai: "Doctrina y Moral", icon: "D", title: "Nordalia: inmigración y bien común", prompt: "Un caso completo para discernir responsabilidades del Estado, justicia y prudencia política." },
    saint: { heading: "Caso 5: conocer la vida de un santo", block: 1, ai: "Vida de los Santos", icon: "S", title: "Santos en medios y debate público", prompt: "¿Cómo entendieron la prensa, la cultura y la defensa pública de la verdad?" },
    "circle-result": { heading: "Caso 6: conocer casos parecidos", block: 1, ai: "Vida de los Santos", icon: "S", title: "Cuando una institución recibe un golpe", prompt: "Experiencias de santos e instituciones para leer una contrariedad con fe y obediencia." },
    "sex-1": { heading: "Caso 6: conocer casos parecidos 2", block: 1, ai: "Vida de los Santos", icon: "S", title: "Las tres Avemarías al acostarse", prompt: "Qué santos recomendaron esta costumbre y cómo la integraban en la noche." },
    liturgy: { heading: "Caso 7: Cuestiones litúrgicas", block: 1, ai: "LiturgIA", icon: "L", title: "¿Es válida la Misa de un sacerdote sin fe?", prompt: "Presencia real, intención del ministro y eficacia ex opere operato." },
    "sex-2": { heading: "Caso 8 Preguntamos a LiturgIA", block: 1, ai: "LiturgIA", icon: "L", title: "Sacerdote en pecado mortal", prompt: "Cuándo puede celebrar, contrición perfecta y por qué no puede consagrar sin comulgar." },
    debate: { heading: "Caso 9: debate público", block: 1, ai: "OrtodoxIA", icon: "O", title: "¿Por qué las mujeres son tan complicadas?", prompt: "Una pregunta cotidiana, respondida desde la diferencia, la afectividad y la dignidad personal." },
    history: { heading: "Caso 10: Conocer la HistorIA de la Iglesia y Padres", block: 1, ai: "HistorIA de la Iglesia y los Padres", icon: "H", title: "¿Cómo oraban los primeros cristianos?", prompt: "Alabanza, canto, silencio, música y dones: qué dicen realmente las fuentes." },
    books: { heading: "Caso 11: Recomendación BibliotecarIA", block: 1, ai: "BibliotecarIA", icon: "B", title: "Cinco libros para un líder de 16 años", prompt: "Carisma, influencia, decisiones y responsabilidad de guiar a otros." },
    classics: { heading: "Caso 12: Literatura universal.", block: 3, ai: "Los Clásicos", icon: "LC", title: "Una celda entre Raskólnikov y Jean Valjean", prompt: "Justicia humana, ley y posibilidad del perdón en dos grandes novelas." },
    cinema: { heading: "Caso 14: CinePilot, el consejero del mundo del cine", block: 1, ai: "CinePilot", icon: "CP", title: "Perdón familiar y reconciliación", prompt: "Películas con valoración moral adecuada para pensar el perdón." }
  };
  const originalCaseResponses = new Map();

  function escapeHtml(value) {
    const node = document.createElement("span");
    node.textContent = value;
    return node.innerHTML;
  }

  function formatOriginalAnswer(answer) {
    return escapeHtml(answer.trim())
      .replace(/```(?:[a-z]+)?\s*\n([\s\S]*?)\n```/gi, "<pre>$1</pre>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>[\s\S]*?<\/li>)(?:\n<li>)/g, "$1<li>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .split(/\n{2,}/)
      .map(part => /^(<h[34]>|<li>|<pre>)/.test(part) ? part : `<p>${part.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  async function prepareOriginalCaseReader() {
    const reader = document.querySelector("#case-reader");
    const content = document.querySelector("#case-reader-content");
    const title = document.querySelector("#case-reader-title");
    const readerAi = document.querySelector("#case-reader-ai");
    if (!reader || !content || !title || !readerAi) return;
    let source = window.ATLAS_CASES_SOURCE || "";
    if (!source) {
      try { source = await fetch("casos-practicos-originales.md", { cache: "no-store" }).then(response => response.text()); } catch { return; }
    }
    Object.entries(originalCaseConfig).forEach(([key, config]) => {
      const start = source.indexOf(`#### ${config.heading}`);
      if (start < 0) return;
      const end = source.indexOf("\n#### Caso", start + 12);
      const section = source.slice(start, end < 0 ? source.length : end);
      const completeCase = section.replace(/^####[^\n]*\n?/, "").trim();
      if (completeCase) originalCaseResponses.set(key, completeCase);
    });
    document.querySelectorAll(".case-study").forEach(caseStudy => {
      const key = caseStudy.dataset.case;
      const config = originalCaseConfig[key];
      if (!config) return;
      caseStudy.dataset.ai = config.ai;
      const aside = caseStudy.querySelector("aside");
      if (aside) {
        aside.innerHTML = `<div class="case-ai-badge"><i>${config.icon}</i><b>${config.ai}</b></div><small>CASO PRÁCTICO · RESPUESTA ORIGINAL</small><h3>${config.title}</h3><blockquote>${config.prompt}</blockquote><div class="case-tags"><span>Texto completo</span><span>Sin resumir</span></div>`;
      }
      const responsePanel = caseStudy.querySelector("section");
      if (!originalCaseResponses.has(key)) {
        if (responsePanel) responsePanel.innerHTML = `<h4>Caso original completo</h4><div class="case-inline-original"><p class="case-source-note">Este caso no contiene texto en el material original adjunto.</p></div>`;
        return;
      }
      if (responsePanel) responsePanel.innerHTML = `<h4>Caso original completo</h4><div class="case-inline-original">${formatOriginalAnswer(originalCaseResponses.get(key))}</div>`;
      const button = document.createElement("button");
      button.className = "case-original-button";
      button.type = "button";
      button.textContent = "Ver a pantalla completa ↗";
      button.addEventListener("click", () => {
        readerAi.textContent = `${config.ai.toUpperCase()} · RESPUESTA ORIGINAL`;
        title.textContent = caseStudy.querySelector("h3")?.textContent || "Respuesta completa";
        content.innerHTML = formatOriginalAnswer(originalCaseResponses.get(key));
        reader.hidden = false;
        document.body.classList.add("case-reader-open");
      });
      responsePanel?.append(button);
    });
    document.querySelector("#case-reader-close")?.addEventListener("click", () => {
      reader.hidden = true;
      document.body.classList.remove("case-reader-open");
    });
  }

  function seeded(index, factor = 1) {
    const value = Math.sin(index * 9187.13 + factor * 71.9) * 43758.5453;
    return value - Math.floor(value);
  }

  function buildBooks() {
    const colors = ["#173d31", "#e2bd58", "#815b45", "#6b537a", "#315b78", "#d99559"];
    document.querySelector("#book-universe").innerHTML = Array.from({ length: 220 }, (_, i) => {
      const x = 4 + seeded(i, 1) * 92;
      const y = 8 + seeded(i, 2) * 78;
      const height = 24 + seeded(i, 3) * 58;
      const rotate = -18 + seeded(i, 4) * 36;
      return `<i style="--x:${x}%;--y:${y}%;--h:${height}px;--r:${rotate}deg;--c:${colors[i % colors.length]};--d:${(i % 28) * .025}s"></i>`;
    }).join("");
    document.querySelector("#page-carpet").innerHTML = Array.from({ length: 128 }, (_, i) => `<i style="--d:${(i % 32) * .025}s"></i>`).join("");
  }

  function buildNetwork() {
    if (!document.querySelector("#neural-links")) return;
    const layerNodeCounts = [6, 8, 8, 5];
    document.querySelectorAll(".neural-layers .layer").forEach((layer, column) => {
      layer.innerHTML = Array.from({ length: layerNodeCounts[column] }, (_, row) => `<i style="top:${row * (250 / Math.max(1, layerNodeCounts[column] - 1))}px;--d:${(column * .14 + row * .06)}s"></i>`).join("");
    });
    const xs = [87, 297, 517, 727];
    const ys = layerNodeCounts.map(count => Array.from({ length: count }, (_, i) => 70 + i * (250 / Math.max(1, count - 1))));
    const links = [];
    for (let col = 0; col < 3; col += 1) {
      ys[col].forEach((y1, a) => ys[col + 1].forEach((y2, b) => {
        if ((a + b + col) % 2 === 0 || b === a) links.push(`<line x1="${xs[col]}" y1="${y1}" x2="${xs[col + 1]}" y2="${y2}"/>`);
      }));
    }
    document.querySelector("#neural-links").innerHTML = links.join("");
  }

  function buildKnowledgeCloud() {
    const cloud = document.querySelector("#knowledge-cloud");
    if (!cloud) return;
    const points = Array.from({ length: 46 }, (_, i) => {
      const size = 8 + seeded(i, 8) * 30;
      return `<i style="--x:${seeded(i, 9) * 95}%;--y:${seeded(i, 10) * 90}%;--s:${size}px;--d:${(i % 15) * .07}s"></i>`;
    }).join("");
    const topics = ["lenguaje", "historia", "ciencia", "cultura", "patrones", "conversación"]
      .map((topic, i) => `<span style="--x:${12 + (i % 3) * 31}%;--y:${14 + Math.floor(i / 3) * 54}%;--d:${.5 + i * .12}s">${topic}</span>`).join("");
    cloud.innerHTML = points + topics;
  }

  function setCamera(caption, instant = false) {
    const [x, y, declaredScale] = caption.dataset.camera.split(",").map(Number);
    const isLiveRoute = caption.dataset.phase === "gameplay" || caption.dataset.phase.startsWith("live-");
    const scale = isLiveRoute ? .86 : declaredScale;
    const target = phaseLandmark[caption.dataset.phase];
    const caseScene = caption.dataset.phase.startsWith("case-");
    const anchored = innerWidth > 800 && target !== "all" && !caseScene && !isLiveRoute;
    const anchorX = anchored ? (caption.classList.contains("right") ? innerWidth * .31 : innerWidth * .69) : innerWidth / 2;
    const tx = anchorX - x * scale;
    const ty = innerHeight / 2 - y * scale;
    const destination = `translate3d(${tx}px,${ty}px,0) scale(${scale})`;
    if (cameraAnimation) {
      const interruptedPosition = getComputedStyle(world).transform;
      cameraAnimation.cancel();
      cameraAnimation = null;
      world.style.transform = interruptedPosition;
    }
    if (instant) {
      world.style.transform = destination;
    } else {
      const origin = getComputedStyle(world).transform;
      world.style.transform = destination;
      cameraAnimation = world.animate(
        [{ transform: origin }, { transform: destination }],
        { duration: 1550, easing: "cubic-bezier(.16,1,.3,1)" }
      );
      cameraAnimation.addEventListener("finish", () => { cameraAnimation = null; }, { once: true });
    }
    zoomValue.textContent = `${Math.round(scale * 100)}%`;
  }

  function setFocus(phase) {
    const target = phaseLandmark[phase];
    landmarks.forEach(landmark => landmark.classList.toggle("focus", target === "all" || landmark.dataset.landmark === target));
  }

  function go(index, instant = false) {
    current = Math.max(0, Math.min(captions.length - 1, index));
    const caption = captions[current];
    captions.forEach((item, i) => item.classList.toggle("active", i === current));
    document.body.dataset.scene = String(current);
    document.body.dataset.phase = caption.dataset.phase;
    setFocus(caption.dataset.phase);
    setCamera(caption, instant);
    progress.style.width = `${((current + 1) / captions.length) * 100}%`;
    counter.textContent = `${String(current + 1).padStart(2, "0")} / ${String(captions.length).padStart(2, "0")}`;
    stepLabel.textContent = caption.querySelector("small")?.textContent || "ATLAS";
    if (caption.dataset.liveRoute && liveFrame) {
      const route = caption.dataset.liveRoute;
      if (route !== currentLiveRoute) {
        currentLiveRoute = route;
        liveBrowser?.classList.add("loading");
        liveFrame.src = `${atlasBase}#${route}`;
      }
      if (liveRouteLabel) liveRouteLabel.textContent = caption.querySelector("small")?.textContent.replace(" REAL", "") || route;
      const journeyGroups = {
        "live-home": 0,
        "live-library": 1, "live-authors": 1, "live-topics": 1,
        "live-documents": 2, "live-reader": 2,
        "live-ask": 3, "live-specialists": 3,
        "live-pray": 4, "live-gospel": 4, "live-bible": 4,
        "live-form": 5, "live-salvation": 5,
        "live-opus": 6, "live-discover": 7, "live-exam": 8, "live-saved": 9
      };
      const routeIndex = journeyGroups[caption.dataset.phase] ?? -1;
      liveJourney.forEach((item, i) => item.classList.toggle("active", i === routeIndex));
      if (liveStep) liveStep.textContent = `RECORRIDO REAL · ${String(routeIndex + 1).padStart(2, "0")}`;
      if (liveTitle) liveTitle.textContent = caption.querySelector("h1,h2")?.textContent.replace(/\s+/g, " ").trim() || "Atlas";
      if (liveDescription) liveDescription.textContent = caption.querySelector("p")?.textContent.replace(/\s+/g, " ").trim() || "";
    }
    history.replaceState(null, "", `#${current}`);
    document.title = `${caption.querySelector("h1,h2")?.textContent.trim() || "Atlas"} · Atlas`;
  }

  document.querySelector("#next").addEventListener("click", () => go(current + 1));
  document.querySelector("#prev").addEventListener("click", () => go(current - 1));
  document.querySelector("#map-button").addEventListener("click", () => go(0));
  document.querySelector("#fullscreen").addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  document.querySelector("#qr-button")?.addEventListener("click", () => { document.querySelector("#qr-layer").hidden = false; });
  document.querySelector("#qr-close").addEventListener("click", () => { document.querySelector("#qr-layer").hidden = true; });
  document.querySelector("#atlas-qr").src = "../assets/images/atlas-public-qr.svg";
  const openAtlas = document.querySelector("#open-atlas");
  if (openAtlas) openAtlas.href = `${atlasBase}#/`;
  document.querySelectorAll("[data-atlas-route]").forEach(frame => { frame.src = `${atlasBase}#${frame.dataset.atlasRoute}`; });
  document.querySelector(".enable-frame").addEventListener("click", event => {
    const screen = event.currentTarget.closest(".atlas-screen");
    screen.classList.toggle("enabled");
    event.currentTarget.textContent = screen.classList.contains("enabled") ? "Salir de interacción" : "Activar interacción";
  });
  liveFrame?.addEventListener("load", () => liveBrowser?.classList.remove("loading"));
  document.querySelector("#live-interaction")?.addEventListener("click", event => {
    liveBrowser.classList.toggle("interactive");
    event.currentTarget.textContent = liveBrowser.classList.contains("interactive") ? "Volver a la presentación" : "Interactuar con la app";
  });

  document.querySelector("#replay-demo")?.addEventListener("click", () => {
    const phase = captions[current].dataset.phase;
    if (!["chatgpt", "notebook", "together"].includes(phase)) return;
    document.body.classList.add("demo-restart");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.classList.remove("demo-restart");
      document.body.dataset.phase = phase;
    }));
  });

  addEventListener("keydown", event => {
    const openReader = document.querySelector("#case-reader");
    if (openReader && !openReader.hidden) {
      if (event.key === "Escape") document.querySelector("#case-reader-close")?.click();
      return;
    }
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) { event.preventDefault(); go(current + 1); }
    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) { event.preventDefault(); go(current - 1); }
    if (event.key.toLowerCase() === "f") document.querySelector("#fullscreen").click();
    if (event.key.toLowerCase() === "m") go(0);
  });
  addEventListener("wheel", event => {
    // La rueda dentro de una respuesta pertenece al lector, no a la navegación de diapositivas.
    const innerReader = event.target instanceof Element ? event.target.closest(".case-inline-original, .case-reader__content") : null;
    if (innerReader) {
      innerReader.scrollTop += event.deltaY;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (wheelLock || Math.abs(event.deltaY) < 22) return;
    wheelLock = true;
    go(current + (event.deltaY > 0 ? 1 : -1));
    setTimeout(() => { wheelLock = false; }, 900);
  }, { passive: false });
  addEventListener("touchstart", event => { touchStart = event.touches[0].clientX; }, { passive: true });
  addEventListener("touchend", event => {
    if (touchStart === null) return;
    const distance = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(distance) > 45) go(current + (distance < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  addEventListener("resize", () => setCamera(captions[current], true));

  buildBooks();
  buildNetwork();
  buildKnowledgeCloud();
  prepareOriginalCaseReader();
  document.querySelector("#route-line")?.classList.add("traced");
  go(current, true);
})();
