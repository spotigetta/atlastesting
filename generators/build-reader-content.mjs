import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { atlasRoot, sourceRoot, dataRoot } from "./lib/paths.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(dataRoot, "catalog.json");
const outputDir = path.join(dataRoot, "documents");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const targetSize = Number(process.env.ATLAS_READER_CHUNK || 90000);

const slug = value => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "seccion";

function splitDocument(markdown) {
  const lines = markdown.split(/\r?\n/);
  const chunks = [];
  const toc = [];
  let current = [];
  let currentSize = 0;
  let chunkIndex = 0;
  const usedSlugs = new Map();

  function flush() {
    if (!current.length) return;
    chunks.push({ index: chunks.length, markdown: current.join("\n") });
    current = [];
    currentSize = 0;
    chunkIndex = chunks.length;
  }

  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      if (currentSize >= targetSize * .55) flush();
      const base = slug(heading[2]);
      const count = usedSlugs.get(base) || 0;
      usedSlugs.set(base, count + 1);
      toc.push({
        level: heading[1].length,
        title: heading[2].trim(),
        anchor: count ? `${base}-${count + 1}` : base,
        chunkIndex
      });
    } else if (currentSize >= targetSize && /^\s*$/.test(line)) {
      flush();
    }
    current.push(line);
    currentSize += line.length + 1;
  }
  flush();
  return { chunks, toc };
}

if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
let generated = 0;
let bytes = 0;
for (const library of catalog.libraries) {
  for (const document of library.documents) {
    const sourcePath = path.join(sourceRoot, library.folder, document.file);
    if (!fs.existsSync(sourcePath)) continue;
    const markdown = fs.readFileSync(sourcePath, "utf8");
    const parsed = splitDocument(markdown);
    const payload = {
      id: document.id,
      title: document.title,
      libraryId: library.id,
      words: document.words,
      toc: parsed.toc,
      chunks: parsed.chunks
    };
    const target = path.join(atlasRoot, document.contentFile);
    const content = Buffer.from(JSON.stringify(payload), "utf8");
    fs.writeFileSync(target, zlib.gzipSync(content, { level: 9 }));
    generated += 1;
    bytes += fs.statSync(target).size;
  }
}
fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify({
  version: catalog.meta.dataVersion,
  generatedAt: new Date().toISOString(),
  documents: generated,
  bytes
}, null, 2));
console.log(`Reader content: ${generated} documents, ${(bytes / 1048576).toFixed(1)} MB.`);
