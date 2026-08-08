import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const atlasDir = path.resolve(toolDir, "..");
const dataDir = path.join(atlasDir, "data");

const readJson = (relativePath) => {
  const absolutePath = path.join(atlasDir, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`${relativePath}: JSON no válido (${error.message})`);
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertUnique = (values, label) => {
  const seen = new Set();
  for (const value of values) {
    assert(typeof value === "string" && value.trim(), `${label}: hay un id vacío`);
    assert(!seen.has(value), `${label}: id duplicado ${value}`);
    seen.add(value);
  }
};

const catalog = readJson("data/catalog.json");
const guides = readJson("data/spiritual-guides.json");
const songbook = readJson("data/songbook.json");
const shorts = readJson("data/saints-shorts.json");
const routes = readJson("data/saints-routes.json");

const documents = (catalog.libraries || []).flatMap((library) => library.documents || []);
const documentsById = new Map(documents.map((document) => [document.id, document]));
const documentIds = new Set(documentsById.keys());
const sourceTextCache = new Map();
const normalizeText = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();
const readDocumentText = (documentId) => {
  if (sourceTextCache.has(documentId)) return sourceTextCache.get(documentId);
  const document = documentsById.get(documentId);
  assert(document?.contentFile, `Documento sin contentFile: ${documentId}`);
  const compressed = fs.readFileSync(path.join(atlasDir, document.contentFile));
  const payload = JSON.parse(zlib.gunzipSync(compressed).toString("utf8"));
  const text = normalizeText((payload.chunks || []).map((chunk) => chunk.markdown || "").join("\n"));
  sourceTextCache.set(documentId, text);
  return text;
};
const assertQueriesInSource = (documentId, queries, label) => {
  const sourceText = readDocumentText(documentId);
  for (const query of queries || []) {
    assert(sourceText.includes(normalizeText(query)), `${label}: no se localiza «${query}» en ${documentId}`);
  }
};

assert(guides.confession?.sections?.length >= 3, "La guía de confesión debe tener al menos tres secciones");
assert(guides.confession?.faq?.length >= 8, "La guía de confesión necesita al menos ocho dudas frecuentes");
assert(guides.mass?.parts?.length === 4, "La guía de Misa debe conservar sus cuatro partes principales");
assert(
  guides.mass.parts.every((part) =>
    part.moments.every((moment) => typeof moment.liturgicalExplanation === "string")
  ),
  "Cada momento de la Misa debe incluir liturgicalExplanation"
);
assert(
  guides.escrivaOrg?.officialBaseUrl === "https://escriva.org/es/",
  "La sección escriva.org debe usar el dominio oficial"
);

assertUnique(songbook.categories.map((category) => category.id), "Categorías del cancionero");
assertUnique(songbook.songs.map((song) => song.id), "Canciones");
const categoryIds = new Set(songbook.categories.map((category) => category.id));
for (const song of songbook.songs) {
  assert(song.title && song.artist, `Canción incompleta: ${song.id}`);
  assert(song.categories?.length, `Canción sin categoría: ${song.id}`);
  for (const category of song.categories) {
    assert(categoryIds.has(category), `Categoría desconocida ${category} en ${song.id}`);
  }
  if (String(song.rights).startsWith("copyrighted")) {
    assert(song.lyrics == null, `No se pueden incluir letras modernas protegidas en ${song.id}`);
  }
  assert(song.officialMediaUrl || song.searchUrl, `Canción sin enlace: ${song.id}`);
}

assertUnique(shorts.types.map((type) => type.id), "Tipos de shorts de santos");
assertUnique(shorts.items.map((item) => item.id), "Shorts de santos");
const shortTypeIds = new Set(shorts.types.map((type) => type.id));
for (const item of shorts.items) {
  assert(shortTypeIds.has(item.type), `Tipo desconocido ${item.type} en ${item.id}`);
  assert(documentIds.has(item.sourceDocumentId), `Documento no encontrado en ${item.id}: ${item.sourceDocumentId}`);
  assert(item.evidenceQueries?.length, `Short sin términos de verificación: ${item.id}`);
  assertQueriesInSource(item.sourceDocumentId, item.evidenceQueries, item.id);
}

assertUnique(routes.routes.map((route) => route.id), "Rutas de santos");
for (const route of routes.routes) {
  assert(route.stages?.length >= 5, `Ruta con menos de cinco etapas: ${route.id}`);
  route.stages.forEach((stage, index) => {
    assert(stage.order === index + 1, `Orden incorrecto en ${route.id}, etapa ${index + 1}`);
    assert(documentIds.has(stage.sourceDocumentId), `Documento no encontrado en ${route.id}: ${stage.sourceDocumentId}`);
    assert(stage.sourceLocator?.queries?.length, `Etapa sin localizador de fuente en ${route.id}`);
    assert(stage.reflectionQuestion, `Etapa sin pregunta en ${route.id}`);
    assertQueriesInSource(stage.sourceDocumentId, stage.sourceLocator.queries, `${route.id}, etapa ${index + 1}`);
  });
}

const report = {
  ok: true,
  files: [
    "data/spiritual-guides.json",
    "data/songbook.json",
    "data/saints-shorts.json",
    "data/saints-routes.json"
  ],
  confessionFaq: guides.confession.faq.length,
  massMoments: guides.mass.parts.reduce((total, part) => total + part.moments.length, 0),
  songs: songbook.songs.length,
  saintShorts: shorts.items.length,
  saintRoutes: routes.routes.length,
  routeStages: routes.routes.reduce((total, route) => total + route.stages.length, 0)
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
