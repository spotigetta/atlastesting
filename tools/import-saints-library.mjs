/* Construye la biblioteca Vida de los Santos desde ../Vida de los Santos.
   Mantiene el corpus fuente fuera de la PWA y genera documentos comprimidos,
   catálogo, índice de texto y metadatos del audiolibro de Pedro Ballester. */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, basename } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

const atlas = process.cwd();
const workspace = dirname(atlas);
const source = join(workspace, "Vida de los Santos");
const audioPlaylist = join(workspace, "_audio_pedro_ballester", "playlist.json");
const catalogFile = join(atlas, "data", "catalog.json");
const indexFile = join(atlas, "data", "search", "manifest.json");
const documentsDir = join(atlas, "data", "documents");
const searchDir = join(atlas, "data", "search");
const libraryId = "vida-santos";
const stopwords = new Set("para como desde sobre entre este esta estas estos una unos unas por con sin del las los que y o el la en de se al un es no su sus a ante bajo cabe contra durante mediante segun tras mi tu yo nos vos ello ella ellos ellas fue son han hay muy mas pero porque cuando donde cual cuales quien quienes".split(" "));

const walk = async directory => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]));
  return files.flat();
};
const normalize = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const slug = value => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "documento";
const words = value => (String(value).match(/[\p{L}\p{N}]+/gu) || []).length;
const hash = value => createHash("sha256").update(value).digest("hex").slice(0, 16);
const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const writeJson = async (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");

function frontMatter(markdown) {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?/);
  const fields = {};
  if (!match) return { fields, body: markdown };
  match[1].split(/\r?\n/).forEach(line => {
    const field = line.match(/^([\w-]+):\s*(.*)$/);
    if (!field) return;
    fields[field[1]] = field[2].trim().replace(/^['"]|['"]$/g, "");
  });
  return { fields, body: markdown.slice(match[0].length) };
}

function headingData(markdown, chunks) {
  const anchors = new Map(); const toc = [];
  let offset = 0;
  markdown.split(/\r?\n/).forEach(line => {
    const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (!heading) { offset += line.length + 1; return; }
    const base = slug(heading[2]); const count = (anchors.get(base) || 0) + 1; anchors.set(base, count);
    const chunkIndex = Math.max(0, chunks.findIndex(chunk => offset >= chunk.start && offset < chunk.end));
    toc.push({ level: heading[1].length, title: heading[2].trim(), anchor: `${base}${count > 1 ? `-${count}` : ""}`, chunkIndex });
    offset += line.length + 1;
  });
  return toc;
}

function chunkMarkdown(markdown, max = 42000) {
  const chunks = []; let cursor = 0;
  while (cursor < markdown.length) {
    let end = Math.min(markdown.length, cursor + max);
    if (end < markdown.length) {
      const breakAt = markdown.lastIndexOf("\n", end);
      if (breakAt > cursor + max * .55) end = breakAt + 1;
    }
    chunks.push({ start: cursor, end, markdown: markdown.slice(cursor, end) }); cursor = end;
  }
  return chunks.length ? chunks : [{ start: 0, end: 0, markdown: "" }];
}

function categoryFor(relativePath, fields) {
  if (relativePath.startsWith("Pedro Ballester - Audiolibro")) return "Audiolibro · Pedro Ballester";
  if (/^000\d_/.test(basename(relativePath))) return "Recursos de la biblioteca";
  if (fields.catalog_number === "1188") return "Vida contemporánea · Pedro Ballester";
  const number = Number((basename(relativePath).match(/^(\d{4})_/) || [])[1] || 0);
  if (number <= 1055) return "Santos apostólicos y mártires";
  if (number <= 1097) return "Padres, monjes y alta Edad Media";
  if (number <= 1149) return "Edad Media y renovación";
  return "Santos modernos y contemporáneos";
}

function languageFor(fields, markdown) {
  const value = fields.language || "";
  if (value) return value.replace(/[\[\]'\"]/g, "").replace("spa", "es").replace("eng", "en");
  return /[áéíóúñ¿¡]/i.test(markdown) ? "es" : "";
}

function audioChapters(markdownFiles, playlist) {
  const chapters = markdownFiles.filter(item => item.relative.startsWith("Pedro Ballester - Audiolibro"));
  return chapters.map((item, index) => {
    const { fields, body } = frontMatter(item.markdown);
    const sourceMatch = body.match(/\]\((https:\/\/soundcloud\.com\/[^)]+)\)/);
    return { id: `pedro-ballester-${String(index + 1).padStart(2, "0")}`, title: body.match(/^#\s+(.+)$/m)?.[1]?.trim() || basename(item.relative, ".md"), url: sourceMatch?.[1] || playlist.entries?.[index]?.url || playlist.webpage_url, documentId: `vida-santos-${slug(item.relative.replace(/\.md$/i, ""))}` };
  });
}

function terms(markdown) {
  const counts = new Map();
  for (const term of normalize(markdown).match(/[\p{L}\p{N}]{3,32}/gu) || []) {
    if (stopwords.has(term)) continue;
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  return counts;
}
const shardKey = term => /^[a-z0-9]$/.test(term[0] || "") ? term[0] : "_";

const files = (await walk(source)).filter(file => extname(file).toLowerCase() === ".md").sort((a, b) => a.localeCompare(b, "es"));
const rawFiles = await Promise.all(files.map(async file => ({ file, relative: relative(source, file).replaceAll("\\", "/"), markdown: await readFile(file, "utf8") })));
const playlist = await readJson(audioPlaylist);
await mkdir(documentsDir, { recursive: true });
const previousCatalog = await readJson(catalogFile);
const previousLibrary = previousCatalog.libraries.find(library => library.id === libraryId);
for (const contentFile of new Set(previousLibrary?.documents?.map(document => document.contentFile) || [])) {
  if (contentFile?.startsWith("data/documents/")) await rm(join(atlas, contentFile), { force: true });
}

const saints = [];
for (const item of rawFiles) {
  const { fields, body } = frontMatter(item.markdown);
  const fileStem = basename(item.relative, ".md");
  const id = `${libraryId}-${slug(item.relative.replace(/\.md$/i, ""))}`;
  const title = fields.saint || fields.title || body.match(/^#\s+(.+)$/m)?.[1]?.trim() || fileStem.replace(/^\d+_/, "").replaceAll("_", " ");
  const chunksWithOffsets = chunkMarkdown(item.markdown);
  const toc = headingData(item.markdown, chunksWithOffsets);
  const payload = { id, title, libraryId, words: words(item.markdown), toc, chunks: chunksWithOffsets.map(({ markdown }, index) => ({ index, markdown })) };
  const contentFile = `data/documents/${hash(id)}.json.gz`;
  await writeFile(join(atlas, contentFile), gzipSync(Buffer.from(JSON.stringify(payload))));
  saints.push({ id, contentFile, catalogId: fields.catalog_number || fileStem.match(/^(\d{4})/)?.[1] || "", file: item.relative, title, originals: fields.book_title || fields.title || title, originalNumbers: fields.catalog_number ? [fields.catalog_number] : [], category: categoryFor(item.relative, fields), words: payload.words, author: fields.author || null, year: fields.publication_year && fields.publication_year !== "null" ? Number(fields.publication_year) || fields.publication_year : null, language: languageFor(fields, item.markdown) || null, status: fields.complete === "false" ? "incomplete" : "not-stated", authority: "Biografía y testimonio histórico", libraryId, source: "Vida de los Santos" });
}

const catalog = previousCatalog;
catalog.libraries = catalog.libraries.filter(library => library.id !== libraryId);
const categories = [...new Map([...saints.reduce((map, doc) => map.set(doc.category, (map.get(doc.category) || 0) + 1), new Map())].map(([name, count]) => [name, { name, count }])).values()].sort((a, b) => b.count - a.count);
const authorCounts = new Map(); saints.filter(doc => doc.author).forEach(doc => authorCounts.set(doc.author, (authorCounts.get(doc.author) || 0) + 1));
const authors = [...authorCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
const totalWords = saints.reduce((sum, doc) => sum + doc.words, 0);
const chapters = audioChapters(rawFiles, playlist);
const library = {
  id: libraryId, folder: "Vida de los Santos", short: "Vida de los Santos", mark: "S", tone: "rose", notebookUrl: "https://notebook.google.com/notebook/a221c38c-6219-4591-9fca-7ef2b7dd8b73", name: "Vida de los Santos", description: "Biografías, testimonios y fuentes para conocer la vida, la época y la huella de los santos.", purpose: "Explora la vida de los santos desde fuentes biográficas identificadas, sitúa su contexto histórico y encuentra ejemplos concretos de fe, conversión, misión, servicio y perseverancia.", organization: "Cada Markdown corresponde a una biografía, una fuente de apoyo o a un capítulo del audiolibro de Pedro Ballester. Las transcripciones del audiolibro conservan su enlace de escucha original.", topics: [
    { id: "vida-santos-apostolicos", name: "Santos apostólicos y mártires", primary: "Apóstoles, discípulos, mártires y primeros testigos", complementary: "Contexto de HistorIA y Padres", primaryDocumentIds: saints.filter(d => d.category === "Santos apostólicos y mártires").slice(0, 12).map(d => d.id), complementaryDocumentIds: [] },
    { id: "vida-santos-padres", name: "Padres, monjes y alta Edad Media", primary: "Pastores, doctores, monjes y evangelizadores", complementary: "HistorIA de la Iglesia y los Padres", primaryDocumentIds: saints.filter(d => d.category === "Padres, monjes y alta Edad Media").slice(0, 12).map(d => d.id), complementaryDocumentIds: [] },
    { id: "vida-santos-medievales", name: "Edad Media y renovación", primary: "Órdenes religiosas, reforma y misión", complementary: "Historia de la Iglesia", primaryDocumentIds: saints.filter(d => d.category === "Edad Media y renovación").slice(0, 12).map(d => d.id), complementaryDocumentIds: [] },
    { id: "vida-santos-contemporaneos", name: "Santos modernos y contemporáneos", primary: "Santificación de la vida ordinaria, servicio y martirio", complementary: "Doctrina y Moral · San Josemaría", primaryDocumentIds: saints.filter(d => d.category === "Santos modernos y contemporáneos").slice(0, 12).map(d => d.id), complementaryDocumentIds: [] },
    { id: "vida-santos-pedro", name: "Pedro Ballester · audiolibro", primary: "15 capítulos del audiolibro y transcripción", complementary: "Vida contemporánea y vocación", primaryDocumentIds: saints.filter(d => d.category.includes("Pedro Ballester")).map(d => d.id), complementaryDocumentIds: [] }
  ],
  warnings: ["Las biografías son fuentes históricas y espirituales; no sustituyen la consulta directa de documentos magisteriales para una cuestión doctrinal.", "Las transcripciones del audiolibro de Pedro Ballester requieren revisión editorial y conservan su fuente de escucha original."],
  documents: saints, categories, authors, stats: { documents: saints.length, words: totalWords, categories: categories.length, authors: authors.length, foreignLanguage: saints.filter(doc => doc.language && doc.language !== "es").length },
  audiobooks: [{ id: "pedro-ballester", title: playlist.title, author: "Jorge Boronat · Cobel Ediciones", provider: "SoundCloud · Opus Dei", url: playlist.webpage_url, duration: playlist.duration_string, description: "La vida de Pedro Ballester: una historia de fe, alegría y fidelidad en la enfermedad.", chapters }]
};
catalog.libraries.push(library);
catalog.editorial ||= {}; catalog.editorial.questions ||= {}; catalog.editorial.taglines ||= {};
catalog.editorial.questions[libraryId] = ["¿Qué episodios de la vida de este santo ayudan a comprender su misión?", "Sitúa a este santo en su época, lugar y retos históricos.", "¿Qué virtudes aparecen de forma concreta en esta biografía?", "Compara la experiencia de dos santos ante la enfermedad, la misión o la oración.", "¿Qué fuentes de esta biblioteca permiten profundizar después de una primera semblanza?", "Resume el audiolibro de Pedro Ballester por capítulos y señala ideas para la oración.", "¿Qué puede aprender hoy un universitario de Pedro Ballester?", "Distingue los datos biográficos documentados de las interpretaciones devocionales."];
catalog.editorial.taglines[libraryId] = "Vidas concretas, fuentes identificadas y una escucha guiada del audiolibro de Pedro Ballester.";
catalog.shorts ||= [];
catalog.shorts = catalog.shorts.filter(item => item.id !== "short-saints-pedro-ballester" && item.id !== "short-saints-vida");
catalog.shorts.push({ id: "short-saints-pedro-ballester", type: "fact", external: true, source: "SoundCloud · Opus Dei", libraryId, title: "Pedro Ballester · escuchar una vida", text: "Un audiolibro en quince capítulos para conocer su alegría, su vocación y su fidelidad en la enfermedad.", reference: "Jorge Boronat, Pedro Ballester. Nunca he sido tan feliz", url: playlist.webpage_url }, { id: "short-saints-vida", type: "fact", libraryId, title: "Una santidad situada en la historia", text: `${saints.length} fuentes recorren desde los apóstoles hasta santos contemporáneos.`, reference: "Vida de los Santos · Atlas" });
catalog.meta.documents = catalog.libraries.reduce((sum, item) => sum + item.documents.length, 0);
catalog.meta.words = catalog.libraries.reduce((sum, item) => sum + (item.stats.words || 0), 0);
catalog.meta.dataVersion = "5.6.0"; catalog.meta.generatedAt = new Date().toISOString();
await writeJson(catalogFile, catalog);

const index = await readJson(indexFile);
const kept = index.documents.filter(doc => !doc.id.startsWith(`${libraryId}-`));
const documentOffset = kept.length;
index.documents = [...kept, ...saints.map(doc => ({ id: doc.id, title: doc.title, libraryId }))];
const additions = new Map();
for (let position = 0; position < rawFiles.length; position += 1) {
  const doc = saints[position]; const docIndex = documentOffset + position;
  for (const [term, count] of terms(rawFiles[position].markdown)) {
    const key = shardKey(term); if (!additions.has(key)) additions.set(key, new Map());
    const termMap = additions.get(key); if (!termMap.has(term)) termMap.set(term, []);
    termMap.get(term).push(docIndex, count);
  }
}
for (const [key, termMap] of additions) {
  const descriptor = index.shards[key];
  const relativeFile = descriptor?.file || `data/search/${key === "_" ? "other" : key}.json.gz`;
  const shardPath = join(atlas, relativeFile);
  let payload = { terms: {} };
  try { payload = JSON.parse(gunzipSync(await readFile(shardPath)).toString("utf8")); } catch {}
  for (const [term, values] of Object.entries(payload.terms)) {
    const clean = [];
    for (let index = 0; index < values.length; index += 2) if (values[index] < documentOffset) clean.push(values[index], values[index + 1]);
    if (clean.length) payload.terms[term] = clean; else delete payload.terms[term];
  }
  for (const [term, values] of termMap) payload.terms[term] = [...(payload.terms[term] || []), ...values];
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload)));
  await mkdir(dirname(shardPath), { recursive: true }); await writeFile(shardPath, compressed);
  index.shards[key] = { file: relativeFile, terms: Object.keys(payload.terms).length, bytes: compressed.length };
}
index.meta.version = "5.6.0"; index.meta.generatedAt = new Date().toISOString(); index.meta.documents = index.documents.length; index.meta.terms = Object.values(index.shards).reduce((sum, item) => sum + item.terms, 0);
await writeJson(indexFile, index);

await writeJson(join(atlas, "data", "saints-audiobook.json"), { updatedAt: new Date().toISOString(), libraryId, audiobooks: library.audiobooks });
console.log(`Vida de los Santos integrada: ${saints.length} Markdown, ${totalWords.toLocaleString("es-ES")} palabras y ${chapters.length} capítulos de audiolibro.`);
