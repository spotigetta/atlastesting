import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { sourceRoot, dataRoot } from "./lib/paths.mjs";

const catalog = JSON.parse(fs.readFileSync(path.join(dataRoot, "catalog.json"), "utf8"));
const outputDir = path.join(dataRoot, "search");
const maxTerms = Number(process.env.ATLAS_FULLTEXT_TERMS || 80000);

const stopwords = new Set(`
para como esta este estos estas desde entre sobre hasta donde cuando porque pero mas muy que del las los una uno unos unas
con sin por sus son fue han hay ser sea al el la de en y o a se no si un su lo le es ya e ni mi tu
dans avec pour les des une sur par est sont que qui pas plus aux ses leur comme mais ou du au
the and for with from that this are was were have has not its into
et in ad de ex non cum per est sunt qui quae quod ut sed aut ab
`.trim().split(/\s+/));

const normalize = value => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const tokenize = line => {
  const words = normalize(line).match(/[\p{L}\p{N}]{3,32}/gu) || [];
  return words.filter(word => !stopwords.has(word) && !/^\d+$/.test(word));
};

const documents = catalog.libraries.flatMap(library => library.documents.map(document => ({
  id: document.id,
  title: document.title,
  libraryId: library.id,
  path: path.join(sourceRoot, library.folder, document.file)
}))).filter(document => fs.existsSync(document.path));

async function scanDocument(filePath, onToken) {
  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    for (const token of tokenize(line)) onToken(token);
  }
}

console.log(`Atlas full text: single pass over ${documents.length} documents...`);
const frequencies = new Map();
const documentCounts = [];
let processed = 0;
for (const document of documents) {
  const counts = new Map();
  await scanDocument(document.path, token => counts.set(token, (counts.get(token) || 0) + 1));
  documentCounts.push(counts);
  for (const [term, count] of counts) frequencies.set(term, (frequencies.get(term) || 0) + count);
  processed += 1;
  if (processed % 25 === 0) console.log(`  ${processed}/${documents.length}`);
}

const selected = new Set([...frequencies.entries()]
  .filter(([, count]) => count >= 3)
  .sort((a, b) => b[1] - a[1])
  .slice(0, maxTerms)
  .map(([term]) => term));
console.log(`Atlas full text: assembling ${selected.size} indexed terms...`);
const postings = new Map([...selected].map(term => [term, []]));
for (let docIndex = 0; docIndex < documentCounts.length; docIndex += 1) {
  for (const [term, count] of documentCounts[docIndex]) {
    if (selected.has(term)) postings.get(term).push(docIndex, count);
  }
}
frequencies.clear();
documentCounts.length = 0;

const terms = Object.fromEntries([...postings.entries()].filter(([, values]) => values.length));
const shardKey = term => /^[a-z0-9]$/.test(term[0] || "") ? term[0] : "_";
const shards = new Map();
for (const [term, values] of Object.entries(terms)) {
  const key = shardKey(term);
  if (!shards.has(key)) shards.set(key, {});
  shards.get(key)[term] = values;
}

if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
const shardManifest = {};
for (const [key, values] of [...shards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const filename = `${key === "_" ? "other" : key}.json.gz`;
  const target = path.join(outputDir, filename);
  const payload = Buffer.from(JSON.stringify({ terms: values }), "utf8");
  fs.writeFileSync(target, zlib.gzipSync(payload, { level: 9 }));
  shardManifest[key] = {
    file: `data/search/${filename}`,
    terms: Object.keys(values).length,
    bytes: fs.statSync(target).size
  };
}

const manifest = {
  meta: {
    version: catalog.meta.dataVersion,
    generatedAt: new Date().toISOString(),
    documents: documents.length,
    terms: Object.keys(terms).length,
    method: "Segmented inverted index; exact normalized terms; stopwords excluded"
  },
  documents: documents.map(({ id, title, libraryId }) => ({ id, title, libraryId })),
  shards: shardManifest
};
fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const totalBytes = Object.values(shardManifest).reduce((sum, shard) => sum + shard.bytes, 0);
console.log(`Segmented full-text index: ${Object.keys(shardManifest).length} shards, ${(totalBytes / 1048576).toFixed(1)} MB.`);
