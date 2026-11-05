/** Deterministic renderer regressions. Run: node tools/test-reader.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../scripts/reader.js", import.meta.url), "utf8");
const context = { window: {}, document: { addEventListener() {} }, Map, Set, console };
vm.runInNewContext(source.replace("root.reader = { open, stop: stopSession };", "root.reader = { open, stop: stopSession, markdown, inline, tableCells, collectReferences, state };"), context);
const reader = context.window.Atlas.reader;
let count = 0;
function check(name, test) { test(); count += 1; console.log(`ok ${count} - ${name}`); }
function render(markdown, toc = []) {
  reader.state.payload = { chunks: [{ index: 0, markdown }], toc };
  reader.collectReferences(reader.state.payload.chunks);
  return reader.markdown(markdown, 0);
}

check("paragraph soft and hard breaks", () => assert.equal(render("Una línea\ncontinúa.  \nSalto.\n\nOtro párrafo."), "<p>Una línea continúa.<br>Salto.</p><p>Otro párrafo.</p>"));
check("backslash hard breaks preserve literal escaped backslashes", () => {
  assert.equal(render("Uno\\\nDos"), "<p>Uno<br>Dos</p>");
  assert.equal(render("Uno\\\\\nDos"), "<p>Uno\\ Dos</p>");
});
check("inline code remains literal and cannot contain links", () => assert.equal(reader.inline("`**no** https://ejemplo.test`"), "<code>**no** https://ejemplo.test</code>"));
check("escaping does not create emphasis", () => assert.equal(reader.inline("\\*literal\\*"), "*literal*"));
check("links have no nested anchor when label is a URL", () => {
  const html = reader.inline("[https://ejemplo.test](https://ejemplo.test)");
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.match(html, />https:\/\/ejemplo.test<\/a>$/);
});
check("link labels retain inline code and emphasis", () => {
  assert.match(reader.inline("[**Lee** `esto`](https://ejemplo.test)"), /><strong>Lee<\/strong> <code>esto<\/code><\/a>/);
});
check("link destinations retain balanced parentheses and escaped ampersands", () => {
  const html = reader.inline("[Libro](https://ejemplo.test/a_(b)?x=1&y=2)");
  assert.match(html, /href="https:\/\/ejemplo.test\/a_\(b\)\?x=1&amp;y=2"/);
});
check("autolinks exclude terminal punctuation", () => assert.match(reader.inline("Visita https://ejemplo.test/a."), /href="https:\/\/ejemplo.test\/a".*<\/a>\.$/));
check("unsafe and unmapped destinations remain visible, not executable", () => {
  assert.equal(reader.inline("[ataque](javascript:alert(1))"), "[ataque](javascript:alert(1))");
  assert.equal(reader.inline("[fuente](../fuente.md)"), "[fuente](../fuente.md)");
});
check("raw HTML is escaped", () => assert.equal(render('<script>alert("x")</script>'), '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>'));
check("images accept empty alt and never acquire anchors", () => {
  const html = reader.inline("![](https://ejemplo.test/x.png)");
  assert.match(html, /^<img /); assert.equal(html.includes("<a"), false);
});
check("reference links resolve across fragments", () => {
  reader.collectReferences([{ index: 0, markdown: "[Fuente][a]" }, { index: 1, markdown: "[a]: https://ejemplo.test" }]);
  assert.match(reader.inline("[Fuente][a]"), /^<a href="https:\/\/ejemplo.test"/);
});
check("footnote text and destination are preserved across fragments", () => {
  reader.collectReferences([{ index: 0, markdown: "Texto[^nota]" }, { index: 1, markdown: "[^nota]: Una **nota**\n    continuada." }]);
  reader.state.payload = { toc: [] };
  assert.match(reader.inline("Texto[^nota]"), /data-reader-link-chunk="1"/);
  assert.match(reader.markdown("[^nota]: Una **nota**\n    continuada.", 1), /Una <strong>nota<\/strong> continuada\./);
});
check("reference syntax within fences stays literal", () => {
  reader.collectReferences([{ index: 0, markdown: "```\n[a]: https://ejemplo.test\n```" }]);
  assert.equal(reader.inline("[a]"), "[a]");
});
check("setext headings do not consume the next ATX anchor", () => {
  const html = render("Sin ficha\n===\n\n## Con ficha", [{ title: "Con ficha", level: 2, anchor: "con-ficha", chunkIndex: 0 }]);
  assert.match(html, /<h1 id="reader-heading-0-0">Sin ficha<\/h1>/);
  assert.match(html, /<h2 id="con-ficha">Con ficha<\/h2>/);
});
check("table pipes inside code and escaped pipes stay within cells", () => {
  assert.deepEqual(Array.from(reader.tableCells("| a \\| b | `x|y` |")), ["a | b", "`x|y`"]);
});
check("table surplus cells are never dropped", () => {
  const html = render("| A | B |\n| --- | --- |\n| uno | dos | tres |");
  assert.match(html, /<td[^>]*>tres<\/td>/);
  assert.equal((html.match(/<th /g) || []).length, 3);
});
check("invalid table divider stays visible as text", () => {
  const html = render("a | b\n--- basura | ---\nuno | dos");
  assert.equal(html.includes("<table>"), false); assert.match(html, /basura/);
});
check("fences close only with matching character and adequate length", () => {
  assert.equal(render("~~~~\n```\ntexto\n~~~\n~~~~"), "<pre><code>```\ntexto\n~~~</code></pre>");
});
check("ordered lists preserve their starting number", () => assert.match(render("7. siete\n8. ocho"), /^<ol start="7">/));
check("block sequence preserves list before subsequent paragraph", () => assert.match(render("- Lista\nTexto"), /^<ul>.*<\/ul><p>Texto<\/p>$/));

// Exercise the real open/catch and local button handlers. Only the successful
// render call is replaced; these checks need no HTML parser or browser engine.
function errorHarness() {
  let calls = 0, succeed = false;
  const button = () => ({ disabled: false, listener: null, once: false,
    addEventListener(type, callback, options) { this.listener = callback; this.once = Boolean(options?.once); },
    click() { if (this.disabled || !this.listener) return; const callback = this.listener; if (this.once) this.listener = null; callback({ currentTarget: this }); }
  });
  const main = { html: "", buttons: {}, set innerHTML(value) {
    this.html = value; this.buttons = { "[data-reader-retry]": button(), "[data-reader-error-library]": button() };
  }, get innerHTML() { return this.html; }, querySelector(selector) { return this.buttons[selector] || null; } };
  const app = {
    storage: { getReaderProgress: () => null },
    library: { empty: (title, message) => `<h2>${title}</h2><p>${message}</p>` }
  };
  const fixtureDoc = { id: "retry-doc", contentFile: "retry-doc.json", library: { id: "mi biblioteca" } };
  const sandbox = {
    window: { Atlas: app, AtlasRuntime: { fetchJson: () => { calls += 1; return succeed ? Promise.resolve({ id: fixtureDoc.id, chunks: [{ markdown: "Texto" }], toc: [] }) : Promise.reject(new Error("offline")); } } },
    document: { addEventListener() {}, querySelector: selector => selector === "#main" ? main : null },
    location: { hash: "#/reader/retry-doc" }, clearTimeout() {}, clearInterval() {}, Map, Set
  };
  vm.runInNewContext(source.replace("render({ restoreSaved: true });", "window.testRendered = { doc: state.doc.id, query: state.query };").replace("      startSession();", "      // Session clock omitted in this isolated error-path fixture."), sandbox);
  return { sandbox, main, doc: fixtureDoc, reader: app.reader, get calls() { return calls; }, succeed() { succeed = true; } };
}
const settle = async () => { for (let index = 0; index < 8; index += 1) await Promise.resolve(); };
{
  const harness = errorHarness();
  await harness.reader.open(harness.doc, "consulta original");
  check("load error explains recovery and exposes retry and library buttons", () => {
    assert.match(harness.main.innerHTML, /conexión/); assert.match(harness.main.innerHTML, /Reintentar/); assert.match(harness.main.innerHTML, /Volver a la biblioteca/);
  });
  harness.succeed();
  const retry = harness.main.querySelector("[data-reader-retry]"); retry.click(); retry.click(); await settle();
  check("retry button makes one new attempt and preserves document and query", () => {
    assert.equal(harness.calls, 2); assert.equal(retry.disabled, true);
    assert.deepEqual({ ...harness.sandbox.window.testRendered }, { doc: harness.doc.id, query: "consulta original" });
  });
}
{
  const harness = errorHarness(); await harness.reader.open(harness.doc);
  const staleRetry = harness.main.querySelector("[data-reader-retry]"); harness.reader.stop(); staleRetry.click(); await settle();
  check("retry from an obsolete error view cannot reopen the reader", () => assert.equal(harness.calls, 1));
}
{
  const harness = errorHarness(); await harness.reader.open(harness.doc);
  harness.main.querySelector("[data-reader-error-library]").click();
  check("library recovery button cancels reader and returns to its library", () => assert.equal(harness.sandbox.location.hash, "/library/mi%20biblioteca/documents"));
}
console.log(`${count} reader renderer and recovery checks passed.`);
