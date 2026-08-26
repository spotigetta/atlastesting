import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const atlas = dirname(dirname(fileURLToPath(import.meta.url)));
const workspace = dirname(atlas);
const source = join(workspace, "12_IA_Meditacion_DiarIA");
const catalogFile = join(atlas, "data", "catalog.json");
const catalog = JSON.parse(await readFile(catalogFile, "utf8"));
const meditationFiles = (await readdir(source)).filter(file => {
  if (file === "001_Meditaciones_Opus_Dei.md" || file === "002_Como_en_una_pelicula.md") return true;
  return /^003_10_Minutos_con_Jesus_P\d{2}\.md$/.test(file);
}).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

const specs = meditationFiles.map(file => {
  if (file === "001_Meditaciones_Opus_Dei.md") return [file, "Meditaciones del Opus Dei", "Meditaciones diarias", "Opus Dei"];
  if (file === "002_Como_en_una_pelicula.md") return [file, "Como en una película", "Escenas del Evangelio", "Opus Dei"];
  const part = Number(file.match(/P(\d{2})\.md$/)?.[1] || "1");
  return [file, `10 Minutos con Jesús - Parte ${String(part)}`, "Meditaciones y audios", "10 Minutos con Jesús"];
});
const hash = value => createHash("sha256").update(value).digest("hex").slice(0, 18);
const clean = value => String(value || "").replace(/\r/g, "").trim();
const words = value => (value.match(/[\p{L}\p{N}]+/gu) || []).length;
const chunks = markdown => {
  const blocks = clean(markdown).split(/\n\s*\n/); const result = []; let text = "";
  for (const block of blocks) { if ((text + "\n\n" + block).length > 7200 && text) { result.push({ index: result.length, text }); text = block; } else text += `${text ? "\n\n" : ""}${block}`; }
  if (text) result.push({ index: result.length, text }); return result;
};
const toc = markdown => clean(markdown).split("\n").filter(line => /^#{1,4}\s+/.test(line)).slice(0, 300).map((line, index) => ({ level: line.match(/^#+/)[0].length, text: line.replace(/^#+\s+/, "").trim(), chunkIndex: index }));
const prior = catalog.libraries.find(item => item.id === "meditacion-diaria");
const preparador = catalog.libraries.find(item => item.id === "preparadora-circulos");
if (preparador) { preparador.short = "Preparador de Círculos"; preparador.name = "Preparador de Círculos"; preparador.description = "Corpus reservado para preparar círculos con obras de san Josemaría y textos pontificios."; }
for (const doc of prior?.documents || []) if (doc.contentFile?.startsWith("data/documents/")) await rm(join(atlas, doc.contentFile), { force: true });
const documents = [];
for (const [file, title, category, author] of specs) {
  const markdown = await readFile(join(source, file), "utf8"); const id = `meditacion-diaria-${file.replace(/\.md$/i, "")}`; const contentFile = `data/documents/${hash(id)}.json.gz`;
  const payload = { id, title, libraryId: "meditacion-diaria", words: words(markdown), toc: toc(markdown), chunks: chunks(markdown) };
  await mkdir(dirname(join(atlas, contentFile)), { recursive: true });
  await writeFile(join(atlas, contentFile), gzipSync(Buffer.from(JSON.stringify(payload))));
  documents.push({ id, contentFile, catalogId: "", file, title, originals: title, originalNumbers: [], category, words: payload.words, author, year: null, language: "es", status: "not-stated", authority: "Meditación espiritual", libraryId: "meditacion-diaria", source: "Oración DiarIA" });
}
const library = { id: "meditacion-diaria", folder: "12_IA_Meditacion_DiarIA", short: "Palabras para orar", mark: "PO", tone: "violet", notebookUrl: "https://notebook.google.com/notebook/01074bc9-b6bd-4f84-80dc-2275f5286983", name: "Palabras para orar", description: "Una IA para encontrar palabras sinceras con las que hablar a Dios desde lo que estás viviendo.", purpose: "Te ayuda a convertir una alegría, una herida, una duda o un silencio en oración personal dirigida a Dios.", organization: "Meditaciones, escenas del Evangelio y audios para sostener una conversación real con Dios.", topics: [], warnings: ["No sustituye el acompañamiento espiritual, psicológico o médico cuando sea necesario."], documents, questions: ["Ayúdame a hablar con Dios desde lo que me está pasando.", "No sé cómo dar gracias: pon palabras a mi agradecimiento.", "Tengo miedo: ayúdame a decírselo a Jesús sin esconderme.", "Ayúdame a pedir perdón con sinceridad.", "Quiero permanecer un rato delante del Santísimo: guíame.", "No puedo más: ayúdame a hacer oración sin fingir."], authors: [], stats: { documents: documents.length, words: documents.reduce((sum, item) => sum + item.words, 0), categories: 3, authors: 3, historical: 0, incomplete: 0, foreignLanguage: 0, dated: 0 } };
catalog.libraries = catalog.libraries.filter(item => item.id !== library.id); catalog.libraries.push(library);
catalog.meta.documents = catalog.libraries.reduce((sum, item) => sum + item.documents.length, 0);
catalog.meta.words = catalog.libraries.reduce((sum, item) => sum + (item.stats?.words || 0), 0);
catalog.meta.source = "Doce bibliotecas documentales y Sagradas Escrituras enlazables";
catalog.meta.dataVersion ||= "6.4.0";
catalog.meta.generatedAt = new Date().toISOString();
await writeFile(catalogFile, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Palabras para orar integrada: ${documents.length} fuentes.`);
