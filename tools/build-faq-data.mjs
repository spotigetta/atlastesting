import { readFile, writeFile } from "node:fs/promises";

const input = new URL("../content/preguntas/preguntas.md", import.meta.url);
const output = new URL("../data/preguntas-frecuentes.json", import.meta.url);
const markdown = await readFile(input, "utf8");
const lines = markdown.replace(/\r/g, "").split("\n");
const items = [];
let section = "Preguntas frecuentes";
let current = null;
for (const line of lines) {
  if (/^# (?!#)/.test(line)) { section = line.replace(/^#\s+/, "").trim(); continue; }
  if (/^###\s+/.test(line)) {
    if (current) { current.answer = current.answer.join("\n").replace(/\n{3,}/g, "\n\n").trim(); if (current.answer) items.push(current); }
    current = { id: `faq-${items.length + 1}`, section, question: line.replace(/^###\s+/, "").trim(), answer: [] };
  } else if (current) current.answer.push(line);
}
if (current) { current.answer = current.answer.join("\n").replace(/\n{3,}/g, "\n\n").trim(); if (current.answer) items.push(current); }
await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: "content/preguntas/preguntas.md", items }, null, 2)}\n`);
console.log(`Preguntas frecuentes: ${items.length} respuestas.`);
