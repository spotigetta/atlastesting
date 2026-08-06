import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceRoot = process.env.ATLAS_SOURCE_ROOT || path.join(root, "source", "libraries");
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const normCatalog = read("content/examen/normas.json");
const notifications = read("content/examen/notifications.json");
const sources = read("content/examen/sources.json");
const manualHelps = read("content/examen/manual-helps.json");
const genericQuotes = read("data/quotes.json").items || [];
const catalog = read("data/catalog.json");

const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stableId = (prefix, value) => `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 14)}`;
const compactMarkdown = value => String(value || "")
  .replace(/^---[\s\S]*?---\s*/u, "")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/[*_`>#]/g, "")
  .replace(/\^\d+\^/g, "")
  .replace(/\s+/g, " ").trim();
const truncate = (value, max = 520) => {
  const text = compactMarkdown(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "), max - 80)) || cut}…`;
};

const documents = catalog.documents || catalog.libraries.flatMap(library => library.documents || []);
const documentByFile = new Map(documents.map(document => [`${document.libraryId}|${String(document.file).toLowerCase()}`, document]));

/*
 * Estas reglas son deliberadamente estrictas. Una cita solo se ofrece para una
 * norma si procede de un capítulo temático inequívoco o contiene una expresión
 * específica de esa práctica. No se usan ya palabras genéricas como «Dios».
 */
const sjmRules = {
  "ofrecimiento-obras": { chapters: ["vida sobrenatural", "presencia de dios", "trabajo", "labor"], terms: ["ofrec", "primera hora", "comenzar el dia", "jornada"] },
  "oracion-manana": { chapters: ["oracion"] },
  "oracion-tarde": { chapters: ["oracion"] },
  "santa-misa": { chapters: ["santa misa"] },
  "comunion": { chapters: ["santa misa", "mas de vida interior"], terms: ["comunion", "comul", "eucarist"] },
  "accion-gracias-misa": { chapters: ["santa misa"], terms: ["gracias", "agradec", "comunion", "misa"] },
  "preces": { chapters: ["los medios", "la iglesia"], terms: ["oracion de todos", "iglesia", "almas", "intenciones"] },
  "angelus": { chapters: ["la virgen", "devociones"], terms: ["angelus", "virgen", "nuestra senora", "maria"] },
  "visita-santisimo": { chapters: ["santa misa", "devociones", "mas de vida interior"], terms: ["sagrario", "santisimo", "eucarist"] },
  "rosario": { chapters: ["la virgen", "devociones"], terms: ["rosario", "misterios"] },
  "evangelio": { chapters: ["mas de vida interior", "formacion", "oracion"], terms: ["evangelio", "escritura", "vida de jesus", "vida de cristo"] },
  "lectura-espiritual": { chapters: ["formacion", "estudio", "los medios"], terms: ["lectura", "leer", "libro"] },
  "examen-general": { chapters: ["examen"] },
  "examen-particular": { chapters: ["examen", "propositos"], terms: ["examen particular", "proposito", "lucha concreta"] },
  "tres-avemarias": { chapters: ["la virgen", "devociones"], terms: ["avemaria", "virgen", "nuestra senora", "maria"] },
  "presencia-dios": { chapters: ["presencia de dios"] },
  "acciones-gracias": { chapters: ["vida sobrenatural", "mas de vida interior"], terms: ["gracias", "agradec"] },
  "desagravio": { chapters: ["penitencia", "devociones", "santa misa"], terms: ["desagravio", "repar", "ofensas"] },
  "mortificacion-corporal": { chapters: ["mortificacion", "penitencia"] },
  "mortificaciones-pequenas": { chapters: ["mortificacion", "cosas pequenas"], terms: ["pequen", "detalle", "mortific", "servicio"] },
  "trabajo": { chapters: ["trabajo", "labor"] },
  "estudio": { chapters: ["estudio"] },
  "orden": { chapters: ["caracter", "otras virtudes"], terms: ["orden", "puntual", "tiempo", "horario"] },
  "alegria": { chapters: ["alegria"] },
  "apostolado": { chapters: ["el apostolado", "el apostol", "pescadores de hombres", "fecundidad"] },
  "direccion-espiritual": { chapters: ["direccion", "sinceridad"], terms: ["direccion", "sincer", "confidencia", "hablar claro"] },
  "charla-fraterna": { chapters: ["direccion", "sinceridad"], terms: ["sincer", "confidencia", "hablar claro", "abrir el alma"] },
  "correccion-fraterna": { chapters: ["caridad", "sinceridad", "la lengua"], terms: ["correccion", "reprend", "advert", "caridad"] },
  "dia-guardia": { chapters: ["caridad", "los medios"], terms: ["fratern", "hermano", "servir", "encomienda"] },
  "tiempo-tarde-noche": { chapters: ["presencia de dios", "oracion", "orden"], terms: ["noche", "silencio", "recogimiento", "descanso"] },
  "sinceridad": { chapters: ["sinceridad", "veracidad"] }
};

const directTerms = {
  "ofrecimiento-obras": ["ofrecimiento de obras", "ofrecer el dia", "ofrecer la jornada", "ofrenda del trabajo"],
  "oracion-manana": ["oracion mental", "oracion personal", "tiempo de oracion", "vida de oracion", "ponerse a orar"],
  "oracion-tarde": ["oracion mental", "oracion personal", "tiempo de oracion", "vida de oracion", "orar cada dia"],
  "santa-misa": ["santa misa", "celebracion eucaristica", "sacrificio eucaristico"],
  "comunion": ["sagrada comunion", "recibir la eucaristia", "recibir a cristo", "comunion eucaristica"],
  "accion-gracias-misa": ["accion de gracias despues de la misa", "dar gracias despues de la comunion", "accion de gracias eucaristica"],
  "preces": ["oracion por la iglesia", "rezar por la iglesia", "oracion de intercesion"],
  "angelus": ["angelus", "regina caeli"],
  "visita-santisimo": ["visita al santisimo", "ante el sagrario", "adoracion eucaristica", "santisimo sacramento"],
  "rosario": ["santo rosario", "rezar el rosario", "misterios del rosario"],
  "oracion-tarde": ["oracion mental", "oracion personal", "tiempo de oracion", "vida de oracion", "orar cada dia"],
  "evangelio": ["lectura del evangelio", "leer el evangelio", "palabra de jesus"],
  "lectura-espiritual": ["lectura espiritual", "libro espiritual", "lectura de formacion"],
  "examen-general": ["examen de conciencia", "examinar la conciencia", "examen diario"],
  "examen-particular": ["examen particular", "proposito concreto", "punto de lucha"],
  "tres-avemarias": ["tres avemarias", "tres ave marias"],
  "presencia-dios": ["presencia de dios", "vivir en presencia de dios"],
  "acciones-gracias": ["dar gracias a dios", "accion de gracias", "agradecer a dios"],
  "desagravio": ["acto de desagravio", "reparacion por", "desagraviar"],
  "mortificacion-corporal": ["mortificacion corporal", "penitencia corporal"],
  "mortificaciones-pequenas": ["pequenas mortificaciones", "pequenos sacrificios", "mortificacion cotidiana"],
  "trabajo": ["santificar el trabajo", "trabajo bien hecho", "ofrecer el trabajo"],
  "estudio": ["santificar el estudio", "estudio perseverante", "deber de estudiar"],
  "orden": ["virtud del orden", "orden del dia", "orden en el trabajo", "puntualidad"],
  "alegria": ["alegria cristiana", "sembrar alegria", "vivir con alegria"],
  "apostolado": ["apostolado", "afanes apostolicos", "mision evangelizadora"],
  "direccion-espiritual": ["direccion espiritual", "acompanamiento espiritual", "abrir el alma"],
  "charla-fraterna": ["charla fraterna", "confidencia", "abrir el alma", "direccion espiritual"],
  "correccion-fraterna": ["correccion fraterna"],
  "dia-guardia": ["dia de guardia", "vivir la fraternidad", "encomendar a los hermanos"],
  "tiempo-tarde-noche": ["recogimiento de la noche", "silencio interior", "final del dia"],
  "contricion": ["acto de contricion", "dolor de los pecados", "pedir perdon"],
  "confesion": ["sacramento de la reconciliacion", "sacramento de la penitencia", "confesion frecuente"]
};

function parsePointBooks() {
  const books = [
    { file: "camino.md", slug: "camino", work: "Camino" },
    { file: "surco.md", slug: "surco", work: "Surco" },
    { file: "forja.md", slug: "forja", work: "Forja" }
  ];
  const helps = [];
  for (const book of books) {
    const file = path.join(sourceRoot, "09_IA_San_JosemarIA", book.file);
    if (!fs.existsSync(file)) continue;
    const document = documentByFile.get(`san-josemaria|${book.file}`);
    const markdown = fs.readFileSync(file, "utf8");
    const chapters = [...markdown.matchAll(/^##\s+(.+)\r?$/gm)];
    for (let chapterIndex=0;chapterIndex<chapters.length;chapterIndex+=1) {
      const chapterMatch=chapters[chapterIndex]; const chapter = chapterMatch[1].trim();
      const chapterBody=markdown.slice(chapterMatch.index+chapterMatch[0].length,chapters[chapterIndex+1]?.index||markdown.length);
      const points=[...chapterBody.matchAll(/^###\s+(\d+)\r?$/gm)];
      for (let pointIndex=0;pointIndex<points.length;pointIndex+=1) {
        const pointMatch=points[pointIndex]; const point = pointMatch[1];
        const pointBody=chapterBody.slice(pointMatch.index+pointMatch[0].length,points[pointIndex+1]?.index||chapterBody.length);
        const firstParagraph = pointBody.split(/\r?\n\s*\r?\n/).map(compactMarkdown).find(Boolean) || "";
        if (firstParagraph.length < 24) continue;
        const normalizedText = normalize(firstParagraph);
        const related = Object.entries(sjmRules).filter(([, rule]) => {
          if (!rule.chapters.includes(normalize(chapter))) return false;
          return !rule.terms?.length || rule.terms.some(term => normalizedText.includes(normalize(term)));
        }).map(([normId]) => normId);
        if (!related.length) continue;
        const sourceUrl = `https://escriva.org/es/${book.slug}/${point}/`;
        helps.push({
          id: stableId("sjm", `${book.slug}|${point}`), kind: "quotation",
          text: truncate(firstParagraph), author: "San Josemaría Escrivá", work: `${book.work}, punto ${point}`,
          reference: `${book.work} ${point} · capítulo «${chapter}»`, tags: related.flatMap(id => normCatalog.norms.find(norm => norm.id === id)?.tags || []),
          normIds: related, verified: true, sourceDocumentId: document?.id || null, sourceUrl,
          sourceQuery: firstParagraph.slice(0, 170), relevanceBasis: `Capítulo temático «${chapter}»`
        });
      }
    }
  }
  return helps;
}

function parsePapalCollections() {
  const folder = path.join(sourceRoot, "01_IA_Doctrina_Teologia_Moral");
  if (!fs.existsSync(folder)) return [];
  const files = fs.readdirSync(folder).filter(file => /papa_(francisco|leon_xiv)/i.test(file) && file.endsWith(".md"));
  const candidates = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(folder, file), "utf8");
    const document = documentByFile.get(`doctrine|${file.toLowerCase()}`);
    const author = /leon_xiv/i.test(file) ? "Papa León XIV" : "Papa Francisco";
    let sourceUrl = ""; let work = file.replace(/\.md$/i, "");
    for (const block of raw.split(/\r?\n\s*\r?\n/)) {
      const url = block.match(/^### Fuente:\s*\[[^\]]*\]\((https?:\/\/[^)]+)\)/)?.[1];
      if (url) { sourceUrl = url; continue; }
      const heading = block.match(/^##\s+(.+)/)?.[1];
      if (heading) { work = compactMarkdown(heading); continue; }
      if (/^(?:[-*]|\[|!\[|[A-Z]{1,3}\]\()/u.test(block.trim())) continue;
      const plain = compactMarkdown(block);
      if (plain.length < 70 || plain.length > 1300 || (plain.match(/https?:/g) || []).length) continue;
      for (const sentence of plain.match(/[^.!?…]+[.!?…]+(?:[»”’])?/g) || [plain]) {
        const text = sentence.trim();
        if (text.length < 70 || text.length > 520) continue;
        const normalizedText = normalize(text);
        const related = Object.entries(directTerms)
          .filter(([, terms]) => terms.some(term => normalizedText.includes(normalize(term))))
          .map(([normId]) => normId);
        if (!related.length) continue;
        candidates.push({
          id: stableId("papal", `${author}|${work}|${text}`), kind: "quotation", text,
          author, work, reference: `${work} · Santa Sede`,
          tags: related.flatMap(id => normCatalog.norms.find(norm => norm.id === id)?.tags || []), normIds: related,
          verified: true, sourceDocumentId: document?.id || null, sourceUrl: sourceUrl || null,
          sourceQuery: text.slice(0, 170), relevanceBasis: "Coincidencia literal específica con la norma"
        });
      }
    }
  }
  const counts = new Map();
  return candidates.filter(item => item.normIds.some(normId => {
    const key = `${normId}|${item.author}`; const count = counts.get(key) || 0;
    if (count >= 3) return false; counts.set(key, count + 1); return true;
  }));
}

function strictGenericHelps() {
  const counts = new Map();
  return genericQuotes.filter(quote => quote.verified === true).flatMap(quote => {
    const text = quote.title || quote.text || "";
    const normalizedText = normalize(text);
    const related = Object.entries(directTerms).filter(([, terms]) => terms.some(term => normalizedText.includes(normalize(term)))).map(([id]) => id);
    const allowed = related.filter(id => (counts.get(id) || 0) < 3);
    if (!allowed.length) return [];
    allowed.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    const referenceParts = String(quote.reference || "").split(",").map(part => part.trim()).filter(Boolean);
    return [{
      id: quote.id, kind: "quotation", text: truncate(text), author: quote.author,
      work: referenceParts.slice(1).join(", ") || quote.reference, reference: quote.reference,
      tags: allowed.flatMap(id => normCatalog.norms.find(norm => norm.id === id)?.tags || []), normIds: allowed,
      verified: true, sourceDocumentId: null, sourceUrl: quote.url || null, sourceQuery: null,
      relevanceBasis: "Coincidencia literal específica con la norma"
    }];
  });
}

const sourceHelps = [...parsePointBooks(), ...parsePapalCollections(), ...strictGenericHelps()];
const editorialHelps = normCatalog.norms.flatMap(norm => [
  {
    id: stableId("exam-question", norm.id), kind: "exam-question", text: norm.question,
    author: "Equipo editorial de Atlas", work: "Guía práctica del examen diario",
    reference: norm.sourceUrl || "Catálogo editorial de Atlas", tags: norm.tags,
    normIds: [norm.id], verified: true, sourceDocumentId: null, sourceUrl: norm.sourceUrl || null,
    relevanceBasis: "Pregunta propia de la norma"
  },
  {
    id: stableId("practical-suggestion", norm.id), kind: "practical-suggestion", text: norm.suggestion,
    author: "Equipo editorial de Atlas", work: "Guía práctica del examen diario",
    reference: norm.sourceUrl || "Catálogo editorial de Atlas", tags: norm.tags,
    normIds: [norm.id], verified: true, sourceDocumentId: null, sourceUrl: norm.sourceUrl || null,
    relevanceBasis: "Sugerencia propia de la norma"
  }
]);
const normalizedManualHelps = manualHelps.map(item => ({
  ...item,
  id: item.id || stableId("manual-help", `${item.kind}|${item.text}|${item.reference}`),
  tags: Array.isArray(item.tags) ? item.tags : String(item.tags || "").split(",").map(value => value.trim()).filter(Boolean),
  normIds: Array.isArray(item.normIds) ? item.normIds : String(item.normIds || "").split(",").map(value => value.trim()).filter(Boolean),
  verified: item.verified !== false, sourceDocumentId: item.sourceDocumentId || null,
  sourceUrl: item.sourceUrl || null, sourceQuery: item.sourceQuery || null,
  relevanceBasis: item.relevanceBasis || "Asignación editorial manual"
}));

const helps = [...normalizedManualHelps, ...editorialHelps, ...sourceHelps];
const coverage = Object.fromEntries(normCatalog.norms.map(norm => [norm.id, helps.filter(help => help.normIds?.includes(norm.id)).length]));
const output = {
  schemaVersion: 2, catalogVersion: normCatalog.catalogVersion, generatedAt: new Date().toISOString(),
  principles: normCatalog.principles, norms: normCatalog.norms, helps, notifications,
  sources: sources.sources, coverage,
  stats: {
    norms: normCatalog.norms.length, helps: helps.length,
    quotations: sourceHelps.length + normalizedManualHelps.filter(item => item.kind === "quotation").length,
    editorial: editorialHelps.length + normalizedManualHelps.filter(item => item.kind !== "quotation").length,
    manual: normalizedManualHelps.length,
    contextualDocuments: helps.filter(item => item.sourceDocumentId && item.sourceQuery).length,
    sanJosemaria: sourceHelps.filter(item => item.author === "San Josemaría Escrivá").length,
    papal: sourceHelps.filter(item => /^Papa /.test(item.author)).length,
    minimumCoverage: Math.min(...Object.values(coverage))
  }
};

fs.writeFileSync(path.join(root, "data", "examen.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Examen diario: ${output.stats.norms} normas y ${output.stats.helps} ayudas; ${output.stats.sanJosemaria} de san Josemaría y ${output.stats.papal} pontificias. Cobertura mínima: ${output.stats.minimumCoverage}.`);
