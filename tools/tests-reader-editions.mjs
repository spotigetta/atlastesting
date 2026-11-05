/** Edition contract tests, without a browser or external dependencies. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../scripts/reader.js", import.meta.url), "utf8");
const original = { id: "doc", title: "Original title", chunks: [{ index: 0, markdown: "## Original heading\n\nThe original remains intact." }, { index: 1, markdown: "## Second\n\nOriginal conclusion." }], toc: [{ title: "Original heading", level: 2, anchor: "heading", chunkIndex: 0 }, { title: "Second", level: 2, anchor: "second", chunkIndex: 1 }] };
const translated = { id: "doc", title: "Título traducido", chunks: [{ index: 0, markdown: "## Encabezado traducido\n\nEl original se conserva intacto." }, { index: 1, markdown: "## Segundo\n\nConclusión traducida." }], toc: [{ title: "Encabezado traducido", level: 2, anchor: "heading", chunkIndex: 0 }, { title: "Segundo", level: 2, anchor: "second", chunkIndex: 1 }] };
const edition = { documentId: "doc", language: "es", sourceLanguage: "en", contentFile: "data/editions/doc.es.json", sourceHash: "source-hash", status: "reviewed", translator: "Traducción propia asistida por IA", reviewMethod: "ai-editorial", reviewedAt: "2026-11-05", review: { humanReviewed: false, reviewer: "Codex" } };
const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; };

function harness({ editions = [edition], translatedPayload = translated, fetchJson, stubRender = false } = {}) {
  const buttons = new Map(), storageCalls = [], saved = new Map(), notes = new Map();
  const makeButton = () => ({ disabled: false, callback: null, addEventListener(type, callback) { this.callback = callback; }, click() { if (!this.disabled) this.callback?.({ currentTarget: this }); } });
  const main = { markup: "", set innerHTML(value) {
    this.markup = value; buttons.clear();
    for (const name of ["retry", "error-original", "error-library"]) if (value.includes(`data-reader-${name}`)) buttons.set(`[data-reader-${name}]`, makeButton());
  }, get innerHTML() { return this.markup; }, querySelector: selector => buttons.get(selector) || null };
  const library = { id: "library", short: "Biblioteca", tone: "sage", documents: [] };
  const doc = { id: "doc", title: "Original title", words: 100, category: "Texto", language: "en", library, contentFile: "original.json" };
  library.documents.push(doc);
  const fetches = [];
  const window = { ATLAS_EDITIONS: { editions }, getSelection: () => null, AtlasRuntime: { fetchJson: path => {
    fetches.push(path); return fetchJson ? fetchJson(path) : Promise.resolve(path === doc.contentFile ? original : translatedPayload);
  } }, Atlas: {
    storage: {
      getReaderProgress: key => { storageCalls.push(["getProgress", key]); return saved.get(key); },
      saveReaderProgress: (key, value) => { storageCalls.push(["saveProgress", key]); saved.set(key, value); },
      getAnnotations: key => { storageCalls.push(["getNotes", key]); return notes.get(key) || []; },
      isFavorite: (kind, key) => { storageCalls.push(["favorite", key]); return false; },
      recordReading: key => storageCalls.push(["recordReading", key])
    }, data: { documents: [doc], documentMap: new Map([[doc.id, doc]]), normalize: value => value, catalog: { collections: [], shorts: [] } }, library: { icon: () => "", empty: (title, message) => `${title}: ${message}` }
  } };
  const frames = [];
  const context = { window, document: { addEventListener() {}, querySelector: selector => selector === "#main" ? main : null, querySelectorAll: () => [], getElementById: () => null }, clearTimeout() {}, clearInterval() {}, setInterval: () => 1, requestAnimationFrame: callback => frames.push(callback), location: { hash: "#/reader/doc" } };
  let code = source.replace("root.reader = { open, stop: stopSession };", "root.reader = { open, stop: stopSession, state, editionStorageKey, editionHeader, switchEdition, validateEdition, saveProgress, markdown };");
  if (stubRender) code = code.replace("function render(options = {}) {", "function render(options = {}) { window.testRender = { options, payload: state.payload }; return;");
  vm.runInNewContext(code, context);
  return { reader: window.Atlas.reader, main, doc, window, storageCalls, saved, notes, fetches, frames };
}

test("original is default, unmodified, and exposes a reviewed alternative", async () => {
  const before = JSON.stringify(original), h = harness(); await h.reader.open(h.doc);
  assert.equal(h.reader.state.edition, null);
  assert.match(h.main.innerHTML, /The original remains intact/);
  assert.match(h.main.innerHTML, /data-reader-edition="original" aria-pressed="true"/);
  assert.match(h.main.innerHTML, /data-reader-edition="es" aria-pressed="false"/);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(h.fetches, ["original.json"]);
});

test("reviewed Castellano renders its text, preserved anchors and truthful provenance", async () => {
  const h = harness(); await h.reader.open(h.doc, "", { edition: "es" });
  assert.match(h.main.innerHTML, /El original se conserva intacto/);
  assert.doesNotMatch(h.main.innerHTML, /The original remains intact/);
  assert.match(h.main.innerHTML, /<h2 id="heading">Encabezado traducido/);
  assert.match(h.main.innerHTML, /Traducción propia de Atlas/);
  assert.match(h.main.innerHTML, /Original: inglés/);
  assert.match(h.main.innerHTML, /Revisión editorial con IA; sin revisión humana/);
  assert.match(h.main.innerHTML, /2026-11-05/);
  assert.match(h.main.innerHTML, /data-reader-edition="original" aria-pressed="false"/);
});

test("draft translations are neither offered nor loaded as Castellano", async () => {
  const h = harness({ editions: [{ ...edition, status: "draft" }] }); await h.reader.open(h.doc, "", { edition: "es" });
  assert.equal(h.reader.state.edition, null); assert.doesNotMatch(h.main.innerHTML, /data-reader-edition=/);
  assert.match(h.main.innerHTML, /No hay una traducción al castellano revisada/);
  assert.deepEqual(h.fetches, ["original.json"]);
});

test("missing translation has a short notice without an empty selector", async () => {
  const h = harness({ editions: [] }); await h.reader.open(h.doc);
  assert.match(h.main.innerHTML, /Se muestra el original/); assert.doesNotMatch(h.main.innerHTML, /data-reader-edition=/);
});

test("a Spanish original is not falsely labelled as a translation", async () => {
  const h = harness({ editions: [] }); h.doc.language = "es"; await h.reader.open(h.doc);
  assert.doesNotMatch(h.main.innerHTML, /Traducción propia de Atlas|No hay una traducción/);
});

test("unknown source language is not guessed or advertised as Castellano", async () => {
  const h = harness({ editions: [] }); h.doc.language = null; await h.reader.open(h.doc);
  assert.match(h.main.innerHTML, /Edición original/); assert.match(h.main.innerHTML, /No hay una traducción al castellano revisada/);
  assert.doesNotMatch(h.main.innerHTML, /Edición original en castellano|data-reader-edition=/);
});

test("progress and notes are scoped by edition while favorite identity stays original", async () => {
  const h = harness(); await h.reader.open(h.doc); h.reader.saveProgress();
  const originalKey = h.reader.editionStorageKey(); await h.reader.open(h.doc, "", { edition: "es" }); h.reader.saveProgress();
  const spanishKey = h.reader.editionStorageKey();
  assert.equal(originalKey, "doc"); assert.equal(spanishKey, "doc::edition:es:source-hash");
  assert.ok(h.saved.has(originalKey) && h.saved.has(spanishKey));
  assert.ok(h.storageCalls.some(([method, key]) => method === "getNotes" && key === spanishKey));
  assert.ok(h.storageCalls.filter(([method]) => method === "favorite").every(([, key]) => key === "doc"));
  assert.ok(h.storageCalls.filter(([method]) => method === "recordReading").every(([, key]) => key === "doc"));
});

test("saved original and translated reading positions restore independently", async () => {
  const h = harness(); h.saved.set("doc", { chunkIndex: 0 }); h.saved.set("doc::edition:es:source-hash", { chunkIndex: 1 });
  await h.reader.open(h.doc, "", { edition: "es" }); assert.equal(h.reader.state.chunk, 1);
  await h.reader.open(h.doc); assert.equal(h.reader.state.chunk, 0);
});

test("switching editions preserves the search query and logical fragment position", async () => {
  const h = harness({ stubRender: true }); await h.reader.open(h.doc); h.reader.state.chunk = 1; h.reader.state.query = "consulta";
  await h.reader.switchEdition("es");
  assert.equal(h.reader.state.query, "consulta"); assert.equal(h.reader.state.chunk, 1);
  assert.equal(h.window.testRender.options.position.index, 1); assert.equal(h.window.testRender.options.keepPosition, true);
  await h.reader.switchEdition("original"); assert.equal(h.reader.state.edition, null); assert.equal(h.reader.state.query, "consulta");
});

test("incomplete or reanchored translations are rejected and original remains accessible", async () => {
  const h = harness({ translatedPayload: { ...translated, toc: [{ ...translated.toc[0], anchor: "changed" }, translated.toc[1]] } });
  await h.reader.open(h.doc, "", { edition: "es" });
  assert.match(h.main.innerHTML, /data-reader-error-original/); assert.doesNotMatch(h.main.innerHTML, /El original se conserva intacto/);
  h.main.querySelector("[data-reader-error-original]").click();
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  assert.equal(h.reader.state.edition, null); assert.match(h.main.innerHTML, /The original remains intact/);
  assert.throws(() => h.reader.validateEdition({ ...translated, chunks: translated.chunks.slice(0, 1) }, original));
});

test("leaving during translation loading cannot overwrite the next route", async () => {
  const delayed = deferred(), h = harness({ fetchJson: path => path === "original.json" ? Promise.resolve(original) : delayed.promise });
  const pending = h.reader.open(h.doc, "", { edition: "es" });
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
  h.reader.stop(); h.main.innerHTML = "Otra pantalla"; delayed.resolve(translated); await pending;
  assert.equal(h.main.innerHTML, "Otra pantalla");
});
