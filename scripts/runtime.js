(function () {
  "use strict";

  const baseUrl = new URL("./", document.baseURI);
  const jsonCache = new Map();

  function url(relative) {
    return new URL(String(relative || "").replace(/^\/+/, ""), baseUrl).href;
  }

  async function decodeJson(response) {
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const pathname = new URL(response.url).pathname;
    if (!pathname.endsWith(".gz")) return response.json();
    if (!("DecompressionStream" in window)) {
      throw new Error("Este navegador no puede descomprimir el documento.");
    }
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
  }

  async function fetchJson(relative, options = {}) {
    const key = url(relative);
    if (!options.fresh && jsonCache.has(key)) return jsonCache.get(key);
    const request = fetch(key, {
      cache: options.fresh ? "no-store" : "default",
      signal: options.signal,
      headers: options.fresh ? { "cache-control": "no-cache" } : undefined
    }).then(decodeJson).then(async value => {
      await window.AtlasDatabase?.put(key, value);
      return value;
    }).catch(async error => {
      const cached = await window.AtlasDatabase?.get(key);
      if (cached?.value !== undefined) return cached.value;
      throw error;
    });
    if (!options.fresh) jsonCache.set(key, request);
    try {
      return await request;
    } catch (error) {
      jsonCache.delete(key);
      throw error;
    }
  }

  function loadScript(relative) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url(relative);
      script.onload = resolve;
      script.onerror = () => reject(new Error(`No se pudo cargar ${relative}`));
      document.head.append(script);
    });
  }

  window.AtlasRuntime = { baseUrl, url, fetchJson, loadScript };
})();
