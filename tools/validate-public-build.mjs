import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validate as validateEditions } from "./translate-library.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const required = [
  "index.html", "offline.html", "manifest.webmanifest", "service-worker.js", "build-manifest.json",
  "scripts/bootstrap.js", "scripts/architecture.js", "styles/architecture-6.4.css", "styles/opus-resources.css",
  "assets/images/atlas-share-card.png", "data/catalog.json", "data/version.json", "share/index.html"
];
for (const relative of required) await access(join(root, relative));

const readJson = async relative => JSON.parse(await readFile(join(root, relative), "utf8"));
const [manifest, version, documentsManifest, catalog, webmanifest, serviceWorker] = await Promise.all([
  readJson("build-manifest.json"), readJson("data/version.json"), readJson("data/documents/manifest.json"), readJson("data/catalog.json"), readJson("manifest.webmanifest"), readFile(join(root, "service-worker.js"), "utf8")
]);
const versions = new Set([manifest.version, version.version, documentsManifest.version, catalog.meta?.dataVersion]);
if (versions.size !== 1) throw new Error(`Versiones desincronizadas: ${[...versions].join(", ")}`);
if (!serviceWorker.includes(`BUILD_VERSION = "${manifest.version}-release"`)) throw new Error("El Service Worker no coincide con la versión pública de Atlas");
if (webmanifest.start_url !== "./#/") throw new Error("manifest.webmanifest debe conservar start_url ./#/");
const documentCount = (catalog.libraries || []).reduce((total, library) => total + (library.documents?.length || 0), 0);
if (!catalog.libraries?.length || !documentCount) throw new Error("El catálogo público no contiene bibliotecas o documentos");
const genericCategory = value => !value || /^(nuevos documentos|sin categor[ií]a|sin clasificar|otros|general|documento)$/i.test(String(value).trim());
for (const library of catalog.libraries) {
  const pending = (library.documents || []).filter(doc => genericCategory(doc.category));
  if (pending.length) throw new Error(`${library.id} conserva ${pending.length} documento(s) sin categoría útil`);
  const expected = new Map();
  for (const doc of library.documents || []) expected.set(doc.category, (expected.get(doc.category) || 0) + 1);
  const indexed = new Map((library.categories || []).map(item => [item.name, item.count]));
  if (expected.size !== indexed.size || [...expected].some(([name, count]) => indexed.get(name) !== count)) throw new Error(`El índice de categorías de ${library.id} no coincide con sus documentos`);
}
const hidden = catalog.libraries.find(item => item.id === "preparadora-circulos");
if (!hidden || hidden.unlockFeature !== "preparadora-circulos") throw new Error("El Preparador de Círculos debe permanecer protegido por desbloqueo local");
if (hidden.documents?.length !== 38 || !hidden.notebookUrl?.includes("notebooklm.google.com")) throw new Error("El Preparador debe conservar sus 38 Markdown y el enlace directo a NotebookLM");
const hahn = catalog.libraries.find(item => item.id === "history")?.documents?.find(item => item.id === "history-un-padre-fiel-a-sus-promesas-scott-hahn");
if (!hahn) throw new Error("Falta Un padre fiel a sus promesas en la biblioteca de Historia");
// Validate only public artifacts here: CI does not have the local source corpus.
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const docs = catalog.libraries.flatMap(lib => lib.documents);
const search = await readJson("data/search/manifest.json");
const publicIds = new Set(docs.map(doc => doc.id));
if (publicIds.size !== docs.length || search.documents.length !== docs.length || new Set(search.documents.map(doc => doc.id)).size !== docs.length || search.documents.some(doc => !publicIds.has(doc.id))) throw new Error("Catálogo e índice de búsqueda no contienen los mismos documentos");
const contentRows = [];
for (const path of [...new Set(docs.map(doc => doc.contentFile))].sort()) contentRows.push(`${path}\t${digest(await readFile(join(root, path)))}`);
const contentDigest = digest(contentRows.join("\n"));
if (catalog.meta.contentRevision !== contentDigest || documentsManifest.contentDigest !== contentDigest || search.meta.payloadDigest !== contentDigest) throw new Error("Contenido modificado sin reconciliar el manifiesto y regenerar la búsqueda");
for (const shard of Object.values(search.shards)) {
  if (digest(await readFile(join(root, shard.file))) !== shard.sha256) throw new Error(`Índice alterado: ${shard.file}`);
}
if (catalog.meta.searchRevision !== search.meta.contentRevision) throw new Error("La revisión de búsqueda no coincide con el catálogo");
await validateEditions();
console.log(`Atlas ${manifest.version} validado: ${catalog.libraries.length} bibliotecas y ${documentCount} documentos.`);
