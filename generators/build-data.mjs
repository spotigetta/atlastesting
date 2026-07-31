import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { atlasRoot, sourceRoot, dataRoot as outputDir } from "./lib/paths.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const registryPath = path.join(atlasRoot, "content", "libraries.json");
const idRegistryPath = path.join(atlasRoot, "source", "id-registry.json");
const idRegistry = fs.existsSync(idRegistryPath)
  ? JSON.parse(fs.readFileSync(idRegistryPath, "utf8"))
  : { schemaVersion: 1, documents: {} };
let idRegistryChanged = false;
function stableDocumentId(folder, file, fallback) {
  const key = `${folder}/${String(file).replaceAll("\\", "/")}`;
  if (!idRegistry.documents[key]) {
    idRegistry.documents[key] = fallback;
    idRegistryChanged = true;
  }
  return idRegistry.documents[key];
}
const registryLibraries = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf8")) : [];
const registeredLibraries = registryLibraries.filter(item => fs.existsSync(path.join(sourceRoot, item.folder)));
const tones = ["amber", "blue", "clay", "violet", "emerald", "rose", "indigo", "gold", "cyan", "olive", "burgundy", "slate"];
const knownFolders = new Set(registeredLibraries.map(item => item.folder));
const knownIds = new Set(registeredLibraries.map(item => item.id));
const discoveredFolders = fs.readdirSync(sourceRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^\d{2,}_IA_/i.test(entry.name) && !knownFolders.has(entry.name))
  .map((entry, index) => {
    const label = entry.name.replace(/^\d{2,}_IA_/, "").replaceAll("_", " ");
    const baseId = label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let id = baseId || `ia-${index + 1}`;
    let suffix = 2;
    while (knownIds.has(id)) id = `${baseId}-${suffix++}`;
    knownIds.add(id);
    return {
      id,
      folder: entry.name,
      short: label,
      mark: label.slice(0, 1).toUpperCase(),
      tone: tones[(registeredLibraries.length + index) % tones.length],
      notebookUrl: "",
      description: `Biblioteca documental ${label}.`
    };
  });
const libraryConfig = [...registeredLibraries, ...discoveredFolders];

const authorRules = [
  [/Agust[ií]n|Augustin/i, "San Agustín"],
  [/Tom[aá]s|Suma Teol[oó]gica|Summa|Contra Gentiles|Quodlibet/i, "Santo Tomás de Aquino"],
  [/Juan Pablo II|JPII/i, "San Juan Pablo II"],
  [/Benedicto XVI/i, "Benedicto XVI"],
  [/\bFrancisco\b/i, "Papa Francisco"],
  [/Ignacio de Antioqu[ií]a/i, "San Ignacio de Antioquía"],
  [/Ireneo/i, "San Ireneo de Lyon"],
  [/Cris[oó]stomo/i, "San Juan Crisóstomo"],
  [/Jerome|Jer[oó]nimo/i, "San Jerónimo"],
  [/Atanasio/i, "San Atanasio"],
  [/Basilio/i, "San Basilio"],
  [/Cirilo/i, "San Cirilo"],
  [/Teresa/i, "Santa Teresa de Jesús"],
  [/Juan de la Cruz/i, "San Juan de la Cruz"],
  [/Bernard/i, "San Bernardo de Claraval"],
  [/Francisco de Sales|F de Sales/i, "San Francisco de Sales"],
  [/Kempis|Imitaci[oó]n de Cristo/i, "Tomás de Kempis"],
  [/Eusebio/i, "Eusebio de Cesarea"],
  [/Or[ií]genes/i, "Orígenes"],
  [/Cipriano/i, "San Cipriano"],
  [/Policarpo/i, "San Policarpo"]
];

const authorityRules = [
  [/Sagrada Escritura|Biblia/i, "Sagrada Escritura"],
  [/Concilio/i, "Concilio"],
  [/Catecismo/i, "Catecismo"],
  [/Libro o normativa litúrgica|Liturgia/i, "Libro o fuente litúrgica"],
  [/Patrística|eclesiástica antigua/i, "Padre de la Iglesia / fuente antigua"],
  [/Derecho|Can[oó]n|juríd/i, "Legislación o fuente canónica"],
  [/Magisterio/i, "Magisterio / documento eclesial"],
  [/Teolog/i, "Teología"],
  [/Espiritual/i, "Espiritualidad"],
  [/Historia/i, "Fuente histórica"]
];

const normalize = value => String(value ?? "")
  .normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function cleanTitle(fileName) {
  return path.basename(fileName, ".md")
    .replace(/^\d{4}(?:_\d{4})?_/, "")
    .replace(/_parte_\d+$/, "")
    .replace(/_ES$/, "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentFileFor(id) {
  return `data/documents/${crypto.createHash("sha1").update(id).digest("hex").slice(0, 18)}.json.gz`;
}

function extractSection(markdown, heading, nextHeading) {
  const start = markdown.indexOf(`## ${heading}`);
  if (start < 0) return "";
  const contentStart = start + heading.length + 3;
  const end = nextHeading ? markdown.indexOf(`## ${nextHeading}`, contentStart) : markdown.length;
  return markdown.slice(contentStart, end < 0 ? markdown.length : end).trim();
}

function parseNumberSet(text) {
  const values = new Set();
  for (const match of text.matchAll(/\b(\d{4})(?:-(\d{4}))?\b/g)) {
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    if (to >= from && to - from <= 100) {
      for (let value = from; value <= to; value += 1) values.add(String(value).padStart(4, "0"));
    }
  }
  return values;
}

function getAuthor(title) {
  return authorRules.find(([rule]) => rule.test(title))?.[1] ?? null;
}

function getAuthority(category) {
  return authorityRules.find(([rule]) => rule.test(category))?.[1] ?? "Según género documental";
}

function readFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  return Object.fromEntries(match[1].split(/\r?\n/).map(line => {
    const separator = line.indexOf(":");
    if (separator < 0) return null;
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^["']|["']$/g, "")];
  }).filter(Boolean));
}

function countWords(markdown) {
  const body = markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---/, "").replace(/<[^>]+>/g, " ");
  return (body.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;
}

function isDocumentFile(file) {
  return /\.md$/i.test(file)
    && !/^0000_Indice_y_mapa_de_fuentes\.md$/i.test(file)
    && !/Instrucciones_de_personalizacion|Documentos_para_incluir_en_el_futuro/i.test(file);
}

function parseLibrary(config) {
  const indexPath = path.join(sourceRoot, config.folder, "0000_Indice_y_mapa_de_fuentes.md");
  const markdown = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : `# Índice — ${config.short}\n`;
  const title = markdown.match(/^#\s+.+?—\s*(.+)$/m)?.[1]?.trim() ?? config.short;
  const purpose = extractSection(markdown, "Finalidad", "Cómo están ordenadas las fuentes")
    .replace(/\s+/g, " ").trim();
  const organization = extractSection(markdown, "Cómo están ordenadas las fuentes", "Mapa temático")
    .replace(/\s+/g, " ").trim();
  const warningsBlock = extractSection(markdown, "Advertencias documentales", "Fuentes incluidas");
  const warnings = [...warningsBlock.matchAll(/^-\s+(.+)$/gm)].map(match => match[1].replaceAll("`", "").trim());
  const foreignNumbers = parseNumberSet(warnings.find(item => /^Documentos en latín o francés/i.test(item)) ?? "");
  const historicalNumbers = parseNumberSet(warnings.find(item => /^Históricos o sustituidos/i.test(item)) ?? "");
  const incompleteNumbers = parseNumberSet(warnings.find(item => /^Textos incompletos o parciales/i.test(item)) ?? "");

  const topicsBlock = extractSection(markdown, "Mapa temático", "Jerarquía y lectura crítica");
  const topics = [];
  for (const line of topicsBlock.split(/\r?\n/)) {
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
    if (!match || match[1].trim() === "Tema" || /^-+$/.test(match[1].trim())) continue;
    topics.push({
      id: `${config.id}-${slug(match[1])}`,
      name: match[1].trim(),
      primary: match[2].trim(),
      complementary: match[3].trim(),
      source: "Mapa temático del índice"
    });
  }

  const sourceBlock = extractSection(markdown, "Fuentes incluidas");
  const documents = [];
  for (const line of sourceBlock.split(/\r?\n/)) {
    const match = line.match(/^- `([^`]+\.md)` — originales ([^;]+);\s*(.+?);\s*([\d,.]+) palabras\.$/);
    if (!match) continue;
    const [file, originals, category, wordText] = match.slice(1);
    const originalNumbers = [...originals.matchAll(/\d{4}/g)].map(item => item[0]);
    const titleValue = cleanTitle(file);
    const yearMatch = titleValue.match(/(?<!\d)(1\d{3}|20\d{2})(?!\d)/);
    const isHistorical = originalNumbers.some(number => historicalNumbers.has(number));
    const isIncomplete = originalNumbers.some(number => incompleteNumbers.has(number));
    const isForeign = originalNumbers.some(number => foreignNumbers.has(number));
    const id = stableDocumentId(config.folder, file, `${config.id}-${path.basename(file, ".md")}`);
    documents.push({
      id,
      contentFile: contentFileFor(id),
      catalogId: originalNumbers[0] ?? null,
      file,
      title: titleValue,
      originals,
      originalNumbers,
      category: category.trim(),
      words: Number(wordText.replace(/\D/g, "")),
      author: getAuthor(titleValue),
      year: yearMatch ? Number(yearMatch[1]) : null,
      language: isForeign ? "Latín o francés (el índice no distingue)" : null,
      status: isIncomplete ? "incomplete" : isHistorical ? "historical" : "not-stated",
      authority: getAuthority(category),
      libraryId: config.id,
      source: "0000_Indice_y_mapa_de_fuentes.md"
    });
  }

  // La carpeta es la fuente de verdad: conserva metadatos del índice cuando
  // existen y descubre automáticamente cualquier Markdown nuevo.
  const actualFiles = fs.readdirSync(path.join(sourceRoot, config.folder))
    .filter(isDocumentFile).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const actualSet = new Set(actualFiles);
  const indexedByFile = new Map(documents.filter(doc => actualSet.has(doc.file)).map(doc => [doc.file, doc]));
  for (const file of actualFiles) {
    if (indexedByFile.has(file)) continue;
    const sourcePath = path.join(sourceRoot, config.folder, file);
    const sourceMarkdown = fs.readFileSync(sourcePath, "utf8");
    const frontmatter = readFrontmatter(sourceMarkdown);
    const titleValue = frontmatter.title || sourceMarkdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || cleanTitle(file);
    const originals = frontmatter.original_numbers || [...file.matchAll(/\d{4}/g)].map(item => item[0]).join(", ");
    const originalNumbers = [...String(originals).matchAll(/\d{1,4}/g)].map(item => item[0].padStart(4, "0"));
    const category = frontmatter.category || "Nuevos documentos";
    const yearMatch = String(frontmatter.year || titleValue).match(/(?<!\d)(1\d{3}|20\d{2})(?!\d)/);
    const id = stableDocumentId(config.folder, file, `${config.id}-${path.basename(file, ".md")}`);
    indexedByFile.set(file, {
      id,
      contentFile: contentFileFor(id),
      catalogId: originalNumbers[0] ?? null,
      file,
      title: titleValue,
      originals: originals || "No consignados",
      originalNumbers,
      category,
      words: Number(frontmatter.words) || countWords(sourceMarkdown),
      author: frontmatter.author || getAuthor(titleValue),
      year: yearMatch ? Number(yearMatch[1]) : null,
      language: frontmatter.language || null,
      status: frontmatter.status || "not-stated",
      authority: frontmatter.authority || getAuthority(category),
      libraryId: config.id,
      source: "Descubierto directamente en la carpeta"
    });
  }
  documents.splice(0, documents.length, ...actualFiles.map(file => indexedByFile.get(file)));

  for (const topic of topics) {
    const primaryNumbers = parseNumberSet(topic.primary);
    const complementaryNumbers = parseNumberSet(topic.complementary);
    topic.primaryDocumentIds = documents
      .filter(doc => doc.originalNumbers.some(number => primaryNumbers.has(number)))
      .map(doc => doc.id);
    topic.complementaryDocumentIds = documents
      .filter(doc => doc.originalNumbers.some(number => complementaryNumbers.has(number)))
      .map(doc => doc.id);
  }

  const categories = groupCount(documents, doc => doc.category);
  const authors = groupCount(documents.filter(doc => doc.author), doc => doc.author);
  return {
    ...config,
    name: title,
    purpose,
    organization,
    topics,
    warnings,
    documents,
    categories,
    authors,
    stats: {
      documents: documents.length,
      words: documents.reduce((sum, doc) => sum + doc.words, 0),
      categories: categories.length,
      authors: authors.length,
      historical: documents.filter(doc => doc.status === "historical").length,
      incomplete: documents.filter(doc => doc.status === "incomplete").length,
      foreignLanguage: documents.filter(doc => doc.language).length,
      dated: documents.filter(doc => doc.year).length
    }
  };
}

function slug(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function groupCount(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildCollections(libraries) {
  return libraries.flatMap(library => library.topics.map(topic => {
    const ids = [...new Set([...topic.primaryDocumentIds, ...topic.complementaryDocumentIds])];
    return {
      id: topic.id,
      title: topic.name,
      libraryIds: [library.id],
      description: `Colección construida desde el mapa temático de ${library.short}.`,
      primary: topic.primary,
      complementary: topic.complementary,
      documentIds: ids,
      source: "Mapa temático del índice",
      verified: true
    };
  })).filter(collection => collection.documentIds.length);
}

function buildRoutes(collections) {
  return collections.filter(collection => collection.documentIds.length >= 2).map(collection => ({
    id: `route-${collection.id}`,
    title: `Ruta: ${collection.title}`,
    description: `Recorrido por las fuentes identificadas en el mapa temático «${collection.title}».`,
    libraryIds: collection.libraryIds,
    source: collection.source,
    verified: true,
    steps: collection.documentIds.slice(0, 8).map((documentId, index) => ({
      documentId,
      level: index < 2 ? "Introducción" : index < 5 ? "Intermedio" : "Profundización"
    }))
  }));
}

function buildShorts(libraries) {
  const shorts = [];
  const reviewedAt = new Date().toISOString().slice(0, 10);
  for (const library of libraries) {
    library.documents.forEach((document, index) => {
      shorts.push({
        id: `short-${library.id}-document-${index}`,
        type: index % 5 === 0 ? "document" : index % 5 === 1 ? "author" : index % 5 === 2 ? "timeline" : index % 5 === 3 ? "curiosity" : "document",
        title: document.title,
        text: index % 5 === 1 && document.author
          ? `El índice atribuye esta fuente a ${document.author}. Puedes abrirla y seguir desde ella otras obras del mismo autor.`
          : index % 5 === 2 && document.year
            ? `El catálogo la sitúa en ${document.year}. Ábrela para incorporarla a tu recorrido cronológico.`
            : index % 5 === 3
              ? `Una fuente de ${document.category.toLocaleLowerCase("es")} con ${document.words.toLocaleString("es-ES")} palabras: aproximadamente ${Math.max(1, Math.round(document.words / 220))} minutos de lectura.`
              : `${document.category} · ${document.words.toLocaleString("es-ES")} palabras${document.author ? ` · ${document.author}` : ""}${document.year ? ` · ${document.year}` : ""}.`,
        libraryId: library.id,
        sourceDocumentId: document.id,
        reference: `Índice documental · ${document.file}`,
        verified: true,
        reviewedAt
      });
    });
    const warning = library.warnings[0];
    if (warning) {
      shorts.push({
        id: `short-${library.id}-warning`,
        type: "fact",
        title: "Lee el corpus con criterio",
        text: warning,
        libraryId: library.id,
        sourceDocumentId: null,
        reference: "Advertencias documentales del índice",
        verified: true,
        reviewedAt
      });
    }
    library.topics.forEach((topic, index) => {
      shorts.push({
        id: `short-${library.id}-topic-${index}`,
        type: index % 2 ? "quiz" : "question",
        title: index % 2 ? "Desliza para investigar" : "Pregunta rápida",
        text: `¿Qué fuentes del cuaderno están relacionadas con «${topic.name}»?`,
        libraryId: library.id,
        sourceDocumentId: topic.primaryDocumentIds[0] ?? null,
        reference: "Mapa temático del índice",
        verified: true,
        reviewedAt
      });
    });
  }
  return shorts;
}

function validate(libraries) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  for (const library of libraries) {
    if (!library.documents.length) warnings.push(`${library.id}: no documents parsed`);
    for (const document of library.documents) {
      if (ids.has(document.id)) errors.push(`duplicate id: ${document.id}`);
      ids.add(document.id);
      if (!document.category) warnings.push(`${document.id}: missing category`);
      if (!document.words) warnings.push(`${document.id}: missing word count`);
    }
  }
  return { errors, warnings };
}

fs.mkdirSync(outputDir, { recursive: true });
const overridesPath = path.join(outputDir, "metadata-overrides.json");
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, "utf8")) : {};
const promptsPath = path.join(atlasRoot, "content", "library-prompts.json");
const libraryPrompts = fs.existsSync(promptsPath) ? JSON.parse(fs.readFileSync(promptsPath, "utf8")) : {};
const editorial = {
  ...(overrides.editorial || {}),
  questions: {
    ...(overrides.editorial?.questions || {}),
    ...Object.fromEntries(Object.entries(libraryPrompts).map(([id, value]) => [id, value.questions || []]))
  },
  taglines: Object.fromEntries(Object.entries(libraryPrompts).map(([id, value]) => [id, value.tagline || ""]))
};
const libraries = libraryConfig.map(parseLibrary);
const collections = buildCollections(libraries);
const routes = buildRoutes(collections);
const editorialShorts = (overrides.editorial?.shorts || []).map((item, index) => ({
  id: item.id || `short-editorial-${index}`,
  type: item.type || "fact",
  libraryId: item.libraryId || "doctrine",
  sourceDocumentId: item.sourceDocumentId || null,
  verified: true,
  reviewedAt: item.reviewedAt || new Date().toISOString().slice(0, 10),
  ...item
}));
const promptShorts = Object.entries(editorial.questions || {}).flatMap(([libraryId, questions]) =>
  questions.map((question, index) => ({
    id: `short-prompt-${libraryId}-${index + 1}`,
    type: "question",
    libraryId,
    sourceDocumentId: null,
    verified: true,
    reviewedAt: new Date().toISOString().slice(0, 10),
    title: editorial.taglines?.[libraryId] || "Una pregunta para empezar",
    text: question,
    reference: "Preguntas sugeridas de la biblioteca"
  }))
);
const shorts = [...editorialShorts, ...promptShorts, ...buildShorts(libraries)];
const validation = validate(libraries);
if (validation.errors.length) {
  console.error(validation.errors.join("\n"));
  process.exit(1);
}

const generatedAt = new Date().toISOString();
const packageMetadata = JSON.parse(fs.readFileSync(path.join(atlasRoot, "package.json"), "utf8"));
const catalog = {
  meta: {
    app: "ATLAS",
    dataVersion: packageMetadata.version,
    generatedAt,
    source: "Four 0000_Indice_y_mapa_de_fuentes.md files",
    documents: libraries.reduce((sum, library) => sum + library.documents.length, 0),
    words: libraries.reduce((sum, library) => sum + library.stats.words, 0)
  },
  libraries,
  collections,
  routes,
  shorts,
  editorial
};

for (const library of libraries) {
  fs.writeFileSync(path.join(outputDir, `${library.id}.json`), JSON.stringify(library, null, 2));
}
fs.writeFileSync(path.join(outputDir, "catalog.json"), JSON.stringify(catalog, null, 2));
fs.writeFileSync(path.join(outputDir, "collections.json"), JSON.stringify(collections, null, 2));
fs.writeFileSync(path.join(outputDir, "routes.json"), JSON.stringify(routes, null, 2));
fs.writeFileSync(path.join(outputDir, "shorts.json"), JSON.stringify(shorts, null, 2));
fs.writeFileSync(path.join(outputDir, "import-report.json"), JSON.stringify({
  generatedAt,
  dataVersion: catalog.meta.dataVersion,
  counts: libraries.map(library => ({ library: library.id, ...library.stats })),
  validation
}, null, 2));
fs.writeFileSync(path.join(outputDir, "version.json"), JSON.stringify({
  version: catalog.meta.dataVersion,
  generatedAt,
  documents: catalog.meta.documents
}, null, 2));
if (idRegistryChanged) {
  fs.mkdirSync(path.dirname(idRegistryPath), { recursive: true });
  const ordered = Object.fromEntries(Object.entries(idRegistry.documents).sort(([a], [b]) => a.localeCompare(b, "es")));
  fs.writeFileSync(idRegistryPath, `${JSON.stringify({ schemaVersion: 1, documents: ordered }, null, 2)}\n`, "utf8");
}
console.log(`Atlas data ${catalog.meta.dataVersion}: ${catalog.meta.documents} documents, ${catalog.meta.words} words.`);
