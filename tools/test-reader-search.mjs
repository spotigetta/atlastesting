/** Search algorithms on a small deterministic DOM graph, without a browser. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

class Node {
  constructor(name, value = "") { this.nodeName = name; this.nodeType = name === "#text" ? 3 : 1; this.nodeValue = value; this.children = []; this.parentElement = null; this.dataset = {}; this.className = ""; }
  append(...children) {
    for (const child of children) {
      if (child.nodeName === "#fragment") { this.append(...child.children); continue; }
      this.children.push(child); child.parentElement = this;
    }
  }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.children.map(child => child.textContent).join(""); }
  set textContent(value) { this.children = []; this.append(text(value)); }
  matches(selector) {
    return selector.split(",").some(part => {
      if (part.startsWith("[")) return part === "[data-reader-search-ignore]" && this.ignore;
      const [tag, className] = part.split(".");
      return (!tag || tag.toUpperCase() === this.nodeName) && (!className || this.className.split(" ").includes(className));
    });
  }
  closest(selector) { for (let current = this; current; current = current.parentElement) if (current.matches(selector)) return current; return null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  replaceWith(replacement) {
    const parent = this.parentElement, index = parent.children.indexOf(this);
    const children = replacement.nodeName === "#fragment" ? replacement.children : [replacement];
    parent.children.splice(index, 1, ...children); children.forEach(child => child.parentElement = parent);
  }
  normalize() {
    this.children.forEach(child => child.normalize());
    for (let i = this.children.length - 1; i > 0; i -= 1) if (this.children[i].nodeType === 3 && this.children[i - 1].nodeType === 3) {
      this.children[i - 1].nodeValue += this.children[i].nodeValue; this.children.splice(i, 1);
    }
  }
}
const text = value => new Node("#text", value);
const element = (tag, ...children) => { const node = new Node(tag.toUpperCase()); node.append(...children); return node; };
const section = (index, ...children) => { const node = element("section", ...children); node.className = "reader-chunk"; node.dataset.chunk = String(index); return node; };
let content;
const document = {
  addEventListener() {}, querySelector: selector => selector === "#reader-content" ? content : null,
  createTextNode: text, createElement: tag => element(tag), createDocumentFragment: () => new Node("#fragment"),
  createTreeWalker(root, mask, filter) {
    const nodes = [];
    const visit = node => {
      const decision = filter.acceptNode(node);
      if (decision === 1) nodes.push(node);
      if (decision !== 2) node.children.forEach(visit);
    };
    root.children.forEach(visit); let index = -1;
    return { currentNode: null, nextNode() { this.currentNode = nodes[++index]; return Boolean(this.currentNode); } };
  }
};
const source = readFileSync(new URL("../scripts/reader.js", import.meta.url), "utf8");
const context = { window: {}, document, NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 }, Map, Set };
vm.runInNewContext(source.replace("root.reader = { open, stop: stopSession };", "root.reader = { searchableText, highlightText, clearMarks };"), context);
const reader = context.window.Atlas.reader;
let checks = 0;
function check(name, test) { test(); console.log(`ok ${++checks} - ${name}`); }

check("visible inline text is contiguous while separate blocks are not", () => {
  content = element("div", section(0, element("p", text("Una "), element("strong", text("palabra")), text(" unida.")), element("p", text("Otra línea."))));
  assert.equal(reader.searchableText(content).text, "Una palabra unida.\nOtra línea.");
});
check("phrases across emphasis receive a mark for each intersecting text node", () => {
  const hits = reader.highlightText("palabra unida", "search-hit");
  assert.equal(hits.length, 1); assert.equal(hits[0].offset, 4); assert.equal(hits[0].marks.length, 2);
  assert.equal(hits[0].marks.map(mark => mark.textContent).join(""), "palabra unida");
  assert.equal(content.textContent, "Una palabra unida.Otra línea.");
});
check("removing marks retains emphasis and the exact visible text", () => {
  reader.clearMarks("search-hit");
  assert.equal(content.querySelectorAll("mark.search-hit").length, 0);
  assert.equal(content.querySelectorAll("strong")[0].textContent, "palabra");
  assert.equal(reader.searchableText(content).text, "Una palabra unida.\nOtra línea.");
});
check("hard breaks before nested inline markup remain search boundaries", () => {
  content = element("div", section(0, element("p", text("Uno"), element("br"), element("strong", text("Dos")))));
  assert.equal(reader.searchableText(content).text, "Uno\nDos");
  assert.equal(reader.highlightText("UnoDos", "search-hit").length, 0);
});
check("equal phrases in another fragment do not receive a saved highlight", () => {
  content = element("div", section(0, element("p", text("La frase."))), section(1, element("p", text("La "), element("em", text("frase")), text("."))));
  const hits = reader.highlightText("La frase", "user-highlight", 1);
  assert.equal(hits.length, 1); assert.equal(hits[0].chunkIndex, 1); assert.equal(hits[0].marks.length, 2);
  assert.equal(content.children[0].querySelectorAll("mark").length, 0);
});
check("search can wrap saved highlights without removing them when cleared", () => {
  const hits = reader.highlightText("La frase", "search-hit");
  assert.equal(hits.length, 2); reader.clearMarks("search-hit");
  assert.equal(content.querySelectorAll("mark.user-highlight").length, 2);
});
check("repeated literal matches keep offsets and do not interpret regex syntax", () => {
  content = element("div", section(0, element("p", text("[a]+ [a]+"))));
  const hits = reader.highlightText("[a]+", "search-hit");
  assert.deepEqual(Array.from(hits, hit => hit.offset), [0, 5]);
});
check("reapplying highlights does not nest marks or join text across old highlights", () => {
  content = element("div", section(0, element("p", text("uno dos tres"))));
  reader.highlightText("dos ", "user-highlight", 0);
  assert.equal(reader.highlightText("uno tres", "user-highlight", 0).length, 0);
  assert.equal(reader.highlightText("dos ", "user-highlight", 0).length, 0);
  assert.equal(content.querySelectorAll("mark.user-highlight").length, 1);
});
console.log(`${checks} reader search graph checks passed.`);
