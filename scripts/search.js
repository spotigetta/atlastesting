(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const catalog = window.ATLAS_CATALOG;
  const normalize = value => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const aliases = catalog.editorial?.aliases || {};
  const libraryMap = new Map(catalog.libraries.map(lib => [lib.id, lib]));
  const documents = catalog.libraries.flatMap(lib => lib.documents.map(doc => ({ ...doc, library: lib })));
  const documentMap = new Map(documents.map(doc => [doc.id, doc]));
  let fullTextPromise;
  const shardPromises = new Map();

  function parseFilter(filter = "all") {
    const parts = String(filter || "all").split("|").filter(Boolean);
    const libraryPart = parts.find(part => part.startsWith("libraries:"));
    const legacyLibrary = parts.find(part => part.startsWith("library:"));
    const documentPart = parts.find(part => part.startsWith("document:"));
    const libraries = new Set((libraryPart ? libraryPart.slice(10).split(",") : legacyLibrary ? [legacyLibrary.slice(8)] : []).filter(Boolean));
    return {
      libraries,
      documentId: documentPart?.slice(9) || "",
      type: parts.find(part => part.startsWith("type:"))?.slice(5) || "",
      status: parts.find(part => part.startsWith("status:"))?.slice(7) || "",
      foreign: parts.includes("language:foreign")
    };
  }

  function allowed(doc, parsed) {
    return (!parsed.libraries.size || parsed.libraries.has(doc.libraryId))
      && (!parsed.documentId || parsed.documentId === doc.id);
  }

  function expanded(value) {
    let text = normalize(value);
    for (const [term, variants] of Object.entries(aliases)) {
      const alternatives = [normalize(term), ...variants.map(normalize)];
      if (alternatives.some(item => text.includes(item))) text += ` ${alternatives.join(" ")}`;
    }
    return text;
  }

  function score(haystack, query, title) {
    const h = expanded(haystack);
    const q = normalize(query);
    if (!h.includes(q) && !expanded(query).split(" ").every(token => !token || h.includes(token))) return 0;
    const t = normalize(title);
    if (t === q) return 100;
    if (t.startsWith(q)) return 75;
    if (t.includes(q)) return 55;
    return 20;
  }

  function search(query, filter = "all", limit = 80) {
    const q = query.trim();
    if (!q) return { documents: [], authors: [], categories: [], collections: [], routes: [], questions: [], libraries: [] };
    const parsed = parseFilter(filter);

    const docResults = documents
      .filter(doc => (!doc.unlockFeature || root.storage.isFeatureUnlocked(doc.unlockFeature)) && allowed(doc, parsed)
        && (!parsed.status || doc.status === parsed.status)
        && (!parsed.foreign || Boolean(doc.language)))
      .map(doc => ({
        ...doc,
        score: score(`${doc.title} ${doc.file} ${doc.originals} ${doc.category} ${doc.author || ""} ${doc.language || ""} ${doc.year || ""} ${doc.status} ${doc.library.name} ${doc.library.short}`, q, doc.title)
      }))
      .filter(doc => doc.score)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, limit);

    const authors = catalog.libraries.flatMap(lib => (lib.authors || []).map(author => ({ ...author, library: lib })))
      .filter(item => !parsed.documentId && (!parsed.libraries.size || parsed.libraries.has(item.library.id)) && score(item.name, q, item.name))
      .sort((a, b) => b.count - a.count).slice(0, 20);
    const categories = catalog.libraries.flatMap(lib => (lib.categories || []).map(category => ({ ...category, library: lib })))
      .filter(item => !parsed.documentId && (!parsed.libraries.size || parsed.libraries.has(item.library.id)) && score(item.name, q, item.name))
      .sort((a, b) => b.count - a.count).slice(0, 20);
    const collections = catalog.collections.filter(item => !parsed.documentId && (!parsed.libraries.size || item.libraryIds.some(id => parsed.libraries.has(id))) && score(`${item.title} ${item.primary} ${item.complementary}`, q, item.title)).slice(0, 20);
    const routes = catalog.routes.filter(item => !parsed.documentId && (!parsed.libraries.size || item.libraryIds.some(id => parsed.libraries.has(id))) && score(`${item.title} ${item.description}`, q, item.title)).slice(0, 20);
    const questions = Object.entries(catalog.editorial?.questions || {}).flatMap(([libraryId, values]) => values.map((text, index) => ({ id: `${libraryId}-${index}`, text, libraryId })))
      .filter(item => !parsed.documentId && (!parsed.libraries.size || parsed.libraries.has(item.libraryId)) && score(item.text, q, item.text)).slice(0, 20);
    const libraries = catalog.libraries.filter(item => !parsed.documentId && (!parsed.libraries.size || parsed.libraries.has(item.id)) && score(`${item.name} ${item.short} ${item.description} ${item.purpose}`, q, item.name));

    const result = { documents: docResults, authors, categories, collections, routes, questions, libraries };
    if (parsed.type && result[parsed.type]) {
      for (const key of Object.keys(result)) if (key !== parsed.type) result[key] = [];
    }
    return result;
  }

  function loadFullText() {
    if (fullTextPromise) return fullTextPromise;
    fullTextPromise = window.AtlasRuntime.fetchJson("data/search/manifest.json").then(manifest => {
      window.ATLAS_FULLTEXT = manifest;
      return manifest;
    });
    return fullTextPromise;
  }

  const shardKey = term => /^[a-z0-9]$/.test(term[0] || "") ? term[0] : "_";

  async function loadShard(index, key) {
    if (!index.shards[key]) return {};
    if (!shardPromises.has(key)) {
      shardPromises.set(key, window.AtlasRuntime.fetchJson(index.shards[key].file).then(payload => payload.terms || {}));
    }
    return shardPromises.get(key);
  }

  function aliasGroup(token) {
    const group = new Set([token]);
    for (const [term, variants] of Object.entries(aliases)) {
      const values = [term, ...variants].flatMap(value => normalize(value).split(/\s+/));
      if (values.includes(token)) values.forEach(value => group.add(value));
    }
    return [...group];
  }

  async function searchFullText(query, filter = "all", limit = 80) {
    const tokens = normalize(query).match(/[\p{L}\p{N}]{3,32}/gu) || [];
    const groups = tokens.map(aliasGroup);
    if (!groups.length) return [];
    const index = await loadFullText();
    const keys = new Set(groups.flat().map(shardKey));
    const loaded = await Promise.all([...keys].map(async key => [key, await loadShard(index, key)]));
    const shardTerms = new Map(loaded);

    let candidates = null;
    for (const alternatives of groups) {
      const union = new Map();
      for (const term of alternatives) {
        const values = shardTerms.get(shardKey(term))?.[term] || [];
        for (let position = 0; position < values.length; position += 2) {
          const docIndex = values[position];
          union.set(docIndex, (union.get(docIndex) || 0) + values[position + 1]);
        }
      }
      if (!union.size) return [];
      if (candidates === null) candidates = union;
      else {
        for (const docIndex of [...candidates.keys()]) {
          if (!union.has(docIndex)) candidates.delete(docIndex);
          else candidates.set(docIndex, candidates.get(docIndex) + union.get(docIndex));
        }
      }
      if (!candidates.size) return [];
    }

    const parsed = parseFilter(filter);
    return [...candidates.entries()]
      .map(([docIndex, occurrences]) => {
        const reference = index.documents[docIndex];
        const document = documentMap.get(reference.id);
        return document ? { ...document, occurrences } : null;
      })
      .filter(document => document && (!document.unlockFeature || root.storage.isFeatureUnlocked(document.unlockFeature)) && allowed(document, parsed))
      .sort((a, b) => b.occurrences - a.occurrences || a.title.localeCompare(b.title))
      .slice(0, limit);
  }

  async function searchLiteral(query, filter = "all", limit = 80) {
    const needle = String(query || "").trim();
    if (needle.length < 3) return [];
    /* El índice solo reduce candidatos; el resultado se confirma leyendo el Markdown real. */
    const candidates = await searchFullText(needle, filter, 500);
    const results = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < candidates.length) {
        const doc = candidates[cursor++];
        try {
          const payload = await window.AtlasRuntime.fetchJson(doc.contentFile);
          const raw = (payload.chunks || []).map(chunk => chunk.markdown || "").join("\n\n");
          const haystack = raw.toLocaleLowerCase("es");
          const exact = needle.toLocaleLowerCase("es");
          const collapsedHaystack = haystack.replace(/\s+/g, " ");
          const collapsedNeedle = exact.replace(/\s+/g, " ");
          const searchable = haystack.includes(exact) ? haystack : collapsedHaystack;
          const sought = haystack.includes(exact) ? exact : collapsedNeedle;
          if (!searchable.includes(sought)) continue;
          let occurrences = 0, position = 0;
          while ((position = searchable.indexOf(sought, position)) >= 0) { occurrences += 1; position += Math.max(1, sought.length); }
          const first = searchable.indexOf(sought);
          const excerpt = searchable.slice(Math.max(0, first - 90), Math.min(searchable.length, first + sought.length + 120)).replace(/\s+/g, " ").trim();
          results.push({ ...doc, occurrences, excerpt, literalVerified: true });
        } catch { /* Un documento aislado no invalida las coincidencias verificadas. */ }
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, candidates.length || 1) }, worker));
    return results.sort((a,b) => b.occurrences - a.occurrences || a.title.localeCompare(b.title)).slice(0, limit);
  }

  root.data = { catalog, documents, documentMap, libraryMap, normalize, expanded };
  root.search = { run: search, loadFullText, runFullText: searchFullText, runLiteral: searchLiteral };
})();
