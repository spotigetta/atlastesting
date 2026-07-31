import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const targetRoot = process.argv.includes("--dist") ? path.join(root, "dist") : root;
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const readJson = relative => JSON.parse(fs.readFileSync(path.join(targetRoot, relative), "utf8"));
const failures = [];
const checks = [];
const check = (condition, label, detail = "") => {
  (condition ? checks : failures).push({ label, detail });
  console.log(`${condition ? "✓" : "✗"} ${label}${detail ? ` · ${detail}` : ""}`);
};

const catalog = readJson("data/catalog.json");
const readerManifest = readJson("data/documents/manifest.json");
const searchManifest = readJson("data/search/manifest.json");
const documents = catalog.libraries.flatMap(library => library.documents);
const ids = new Set(documents.map(document => document.id));
const contentFiles = new Set(documents.map(document => document.contentFile.replace(/^data\/documents\//, "")));
const physicalContent = new Set(fs.readdirSync(path.join(targetRoot, "data", "documents"))
  .filter(file => file.endsWith(".json.gz")));

check(packageMetadata.version === catalog.meta.dataVersion, "Versión única", catalog.meta.dataVersion);
check(ids.size === documents.length, "IDs documentales únicos", `${ids.size}`);
check(readerManifest.documents === documents.length, "Catálogo y lector sincronizados", `${documents.length}`);
check(searchManifest.meta.documents === documents.length, "Catálogo e índice sincronizados", `${documents.length}`);
check(contentFiles.size === physicalContent.size &&
  [...contentFiles].every(file => physicalContent.has(file)), "Sin documentos generados huérfanos", `${physicalContent.size}`);
check(Object.keys(searchManifest.shards || {}).length >= 20, "Índice textual segmentado", `${Object.keys(searchManifest.shards || {}).length} fragmentos`);

for (const document of documents.slice(0, 3)) {
  const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(targetRoot, document.contentFile))));
  check(payload.id === document.id && Array.isArray(payload.chunks), `Documento comprimido legible`, document.id);
}

const publicFiles = [
  "index.html", "manifest.webmanifest", "service-worker.js", "scripts/runtime.js",
  "scripts/bootstrap.js", "data/catalog.json", "data/external-content.json"
];
for (const file of publicFiles) check(fs.existsSync(path.join(targetRoot, file)), `Recurso público`, file);

const searchableFiles = ["index.html", ...fs.readdirSync(path.join(targetRoot, "scripts")).filter(file => file.endsWith(".js")).map(file => `scripts/${file}`)];
const absoluteLocalRoutes = [];
const publicApiCalls = [];
for (const file of searchableFiles) {
  const text = fs.readFileSync(path.join(targetRoot, file), "utf8");
  if (/(?:src|href)=["']\/(?!\/)/.test(text)) absoluteLocalRoutes.push(file);
  if (/fetch\(\s*[`"']\/api\//.test(text)) publicApiCalls.push(file);
}
check(!absoluteLocalRoutes.length, "Sin assets absolutos incompatibles con Pages", absoluteLocalRoutes.join(", "));
check(!publicApiCalls.length, "La PWA pública no depende de /api", publicApiCalls.join(", "));

const manifest = readJson("manifest.webmanifest");
check(String(manifest.start_url || "").startsWith("./"), "Manifest relativo", manifest.start_url);

if (process.argv.includes("--dist")) {
  const buildManifest = readJson("build-manifest.json");
  check(!buildManifest.buildId.includes("__ATLAS_VERSION__"), "Build público versionado", buildManifest.buildId);
  const sw = fs.readFileSync(path.join(targetRoot, "service-worker.js"), "utf8");
  check(!sw.includes("__ATLAS_VERSION__"), "Service Worker materializado");
}

if (failures.length) {
  console.error(`\n${failures.length} comprobaciones fallidas.`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} comprobaciones superadas.`);
