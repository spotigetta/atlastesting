import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog.json"), "utf8"));
const discovery = JSON.parse(fs.readFileSync(path.join(root, "data/discovery-library.json"), "utf8"));
const script = fs.readFileSync(path.join(root, "scripts/discovery-library.js"), "utf8");
function runtime(fetcher = async () => discovery) {
  const documents = catalog.libraries.flatMap(library => library.documents.map(doc => ({ ...doc, library })));
  const listeners = {}, events = [], calls = [];
  const Atlas = {
    data: { documents, catalog, documentMap: new Map(documents.map(doc => [doc.id, doc])), libraryMap: new Map(catalog.libraries.map(lib => [lib.id, lib])) },
    storage: { isFeatureUnlocked: () => false },
    share: { copy: async text => calls.push(["copy", text]) },
    appToast: text => calls.push(["toast", text])
  };
  const window = { Atlas, AtlasRuntime: { fetchJson: fetcher }, dispatchEvent: event => events.push(event.type), open: url => { calls.push(["open", url]); return {}; } };
  const context = { window, location: { hash: "#/mapa-tematico" }, document: { addEventListener: (type, callback) => { listeners[type] = callback; } }, URLSearchParams, CustomEvent: class { constructor(type) { this.type = type; } } };
  vm.runInNewContext(script, context);
  return { api: Atlas.discoveryLibrary, Atlas, calls, events, listeners };
}
const route = query => ({ query: new URLSearchParams(query) });

test("each editorial quotation is literal, readable and unprotected", () => {
  assert.equal(discovery.topics.length, 12);
  let count = 0;
  for (const topic of discovery.topics) {
    assert.ok(topic.answer && topic.question && topic.followUp);
    for (const source of [...topic.sources, ...topic.related]) {
      const library = catalog.libraries.find(lib => lib.id === source.libraryId);
      const doc = library.documents.find(doc => doc.id === source.id);
      assert.ok(doc, source.id);
      assert.ok(!library.unlockFeature && !doc.unlockFeature);
      if (!source.quote) continue;
      const bytes = fs.readFileSync(path.join(root, doc.contentFile));
      const payload = JSON.parse(doc.contentFile.endsWith(".gz") ? gunzipSync(bytes) : bytes.toString("utf8"));
      assert.ok(payload.chunks[source.chunkIndex].markdown.includes(source.quote), `${topic.id} quotation`);
      assert.equal(new URLSearchParams(source.readerUrl.split("?")[1]).get("q"), source.quote);
      count++;
    }
  }
  assert.equal(count, 13);
});

test("maps have six accessible linked entry points per scope", async () => {
  const { api, events } = runtime();
  await api.load();
  assert.deepEqual(events, ["atlas:discovery-ready"]);
  for (const query of ["", "library=clasicos"]) {
    const html = api.render(route(query));
    assert.equal((html.match(/class="discovery-topic topic-/g) || []).length, 6);
    assert.ok(html.includes("Categorías") || html.includes("categorías del catálogo"));
    assert.ok(!html.includes("<canvas"));
  }
});

test("each thematic detail contains answer, source and real NotebookLM action", async () => {
  const { api } = runtime();
  await api.load();
  for (const topic of discovery.topics) {
    const html = api.render(route(`topic=${topic.id}`));
    assert.ok(html.includes(topic.answer), topic.id);
    assert.ok(html.includes("Comprobar en el texto"));
    assert.ok(html.includes("data-discovery-ask="));
    assert.ok(html.includes("Respuesta editorial"));
    assert.ok(!html.includes("<form"));
  }
});

test("catalog categories exclude protected libraries and documents", async () => {
  const { api, Atlas } = runtime();
  Atlas.data.documents.push({ id: "hidden", libraryId: "preparadora-circulos", category: "Secret library category" });
  Atlas.data.documentMap.set("hidden", Atlas.data.documents.at(-1));
  Atlas.data.documents.push({ id: "hidden-doc", libraryId: "clasicos", category: "Secret document category", unlockFeature: "private" });
  Atlas.data.documentMap.set("hidden-doc", Atlas.data.documents.at(-1));
  await api.load();
  const html = api.render(route(""));
  assert.ok(!html.includes("Secret library"));
  assert.ok(!html.includes("Secret document"));
  assert.ok(!api.render(route("category=Secret+library+category")).includes("#/reader/hidden"));
});

test("unknown topics fail closed and category names are escaped", async () => {
  const { api } = runtime();
  await api.load();
  assert.ok(api.render(route("topic=missing")).includes("Tema no disponible"));
  const html = api.render(route("category=%3Cscript%3Ealert(1)%3C%2Fscript%3E"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("failed load offers retry and emits a render event", async () => {
  const { api, events } = runtime(async () => { throw new Error("offline"); });
  await assert.rejects(api.load(), /offline/);
  const html = api.render(route(""));
  assert.ok(html.includes("data-discovery-retry"));
  assert.ok(events.includes("atlas:discovery-error"));
});

test("notebook opens before the asynchronous clipboard call", async () => {
  const { api, listeners, calls } = runtime();
  await api.load();
  const button = { dataset: { discoveryAsk: "vida-buena" } };
  await listeners.click({ target: { closest: selector => selector === "[data-discovery-ask]" ? button : null } });
  assert.equal(calls[0][0], "open");
  assert.match(calls[0][1], /^https:\/\/notebooklm\.google\.com\/notebook\//);
  assert.equal(calls[1][0], "copy");
  assert.ok(calls[1][1].includes("Aristóteles"));
});

test("clipboard failure exposes the question for manual copying", async () => {
  const { api, Atlas, listeners, calls } = runtime();
  await api.load();
  Atlas.share.copy = async () => { throw new Error("permission denied"); };
  const attributes = [];
  const button = { dataset: { discoveryAsk: "vida-buena" }, closest: () => ({ querySelector: () => ({ setAttribute: (...args) => attributes.push(args) }) }) };
  await listeners.click({ target: { closest: selector => selector === "[data-discovery-ask]" ? button : null } });
  assert.equal(attributes[0][0], "open");
  assert.ok(calls.some(call => call[0] === "toast" && call[1].includes("No se pudo copiar")));
});
