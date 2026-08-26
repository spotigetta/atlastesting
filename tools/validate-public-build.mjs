import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const required = [
  "index.html", "offline.html", "manifest.webmanifest", "service-worker.js", "build-manifest.json",
  "scripts/bootstrap.js", "scripts/architecture.js", "styles/architecture-6.4.css", "styles/opus-resources.css",
  "assets/images/atlas-share-card.png", "data/catalog.json", "data/version.json", "share/index.html"
];
for (const relative of required) await access(join(root, relative));

const readJson = async relative => JSON.parse(await readFile(join(root, relative), "utf8"));
const [manifest, version, catalog, webmanifest] = await Promise.all([
  readJson("build-manifest.json"), readJson("data/version.json"), readJson("data/catalog.json"), readJson("manifest.webmanifest")
]);
const versions = new Set([manifest.version, version.version, catalog.meta?.dataVersion]);
if (versions.size !== 1) throw new Error(`Versiones desincronizadas: ${[...versions].join(", ")}`);
if (webmanifest.start_url !== "./#/") throw new Error("manifest.webmanifest debe conservar start_url ./#/");
const documentCount = (catalog.libraries || []).reduce((total, library) => total + (library.documents?.length || 0), 0);
if (!catalog.libraries?.length || !documentCount) throw new Error("El catálogo público no contiene bibliotecas o documentos");
const hidden = catalog.libraries.find(item => item.id === "preparadora-circulos");
if (!hidden || hidden.unlockFeature !== "preparadora-circulos") throw new Error("El Preparador de Círculos debe permanecer protegido por desbloqueo local");
if (hidden.documents?.length !== 38 || !hidden.notebookUrl?.includes("notebooklm.google.com")) throw new Error("El Preparador debe conservar sus 38 Markdown y el enlace directo a NotebookLM");
const hahn = catalog.libraries.find(item => item.id === "history")?.documents?.find(item => item.id === "history-un-padre-fiel-a-sus-promesas-scott-hahn");
if (!hahn) throw new Error("Falta Un padre fiel a sus promesas en la biblioteca de Historia");
console.log(`Atlas ${manifest.version} validado: ${catalog.libraries.length} bibliotecas y ${documentCount} documentos.`);
