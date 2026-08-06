import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const normCatalog = read("content/examen/normas.json");
const notifications = read("content/examen/notifications.json");
const sources = read("content/examen/sources.json");
const manualHelps = read("content/examen/manual-helps.json");
const quotes = read("data/quotes.json").items || [];
const catalog = read("data/catalog.json");

const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stableId = (prefix, value) => `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 14)}`;
const tagRules = {
  "filiacion-divina": ["hijo de dios", "hijos de dios", "padre", "filiacion"],
  "oracion": ["oracion", "orar", "reza", "plegaria", "contemplacion", "dios"],
  "perseverancia": ["persever", "constancia", "fidelidad", "lucha", "recomenz"],
  "sequedad": ["sequedad", "aridez", "desierto"],
  "distracciones": ["distraccion", "atencion", "recogimiento"],
  "santa-misa": ["misa", "sacrificio", "altar", "liturgia"],
  "eucaristia": ["eucarist", "santisimo", "sagrario", "sacramento"],
  "comunion": ["comunion", "comulgar", "cuerpo de cristo"],
  "accion-de-gracias": ["gracias", "gratitud", "agradecer", "alabanza"],
  "presencia-de-dios": ["presencia de dios", "contemplativo", "recogimiento"],
  "evangelio": ["evangelio", "jesucristo", "jesus", "palabra de dios"],
  "lectura-espiritual": ["lectura", "libro", "escritura", "formacion"],
  "rosario": ["rosario", "misterios"],
  "virgen-maria": ["virgen", "maria", "madre de dios", "nuestra senora"],
  "san-jose": ["san jose", "jose"],
  "examen-conciencia": ["examen", "conciencia", "conocete", "verdad"],
  "examen-particular": ["proposito", "lucha concreta", "defecto dominante"],
  "contricion": ["contricion", "arrepent", "pecado", "perdon", "misericordia"],
  "confesion": ["confesion", "penitencia", "reconciliacion"],
  "trabajo": ["trabajo", "labor", "profesion", "tarea", "santificar"],
  "estudio": ["estudio", "sabiduria", "aprender", "ciencia"],
  "orden": ["orden", "prioridad", "tiempo", "puntual"],
  "alegria": ["alegr", "gozo", "sonrisa", "paz"],
  "caridad": ["caridad", "amor", "amar", "projimo"],
  "fraternidad": ["fratern", "hermano", "unidad", "comunion de los santos"],
  "apostolado": ["apostol", "evangeliza", "almas", "mision"],
  "mortificacion": ["mortific", "sacrificio", "renuncia", "templanza"],
  "desagravio": ["desagravio", "reparacion", "ofensa"],
  "descanso": ["descanso", "dormir", "sueno"],
  "silencio": ["silencio", "callar", "recogimiento"],
  "sinceridad": ["sincer", "verdad", "humildad"],
  "direccion-espiritual": ["direccion espiritual", "director", "acompanamiento"],
  "servicio": ["servir", "servicio", "ayudar", "entrega"],
  "libertad": ["libertad", "libre", "voluntad"],
  "recomenzar": ["recomenz", "levant", "esperanza", "desanimo", "caida"],
  "cansancio": ["cansancio", "fatiga", "debilidad"],
  "trinidad": ["trinidad", "padre hijo espiritu santo"],
  "fe": ["fe", "creer", "credo"]
};

const documents = catalog.documents || catalog.libraries.flatMap(library => library.documents || []);
function contextualDocument(reference, author) {
  const ref = normalize(reference);
  const authorKey = normalize(author);
  return documents.map(document => {
    const title = normalize(document.title);
    let score = 0;
    if (title.length > 5 && ref.includes(title)) score += 8;
    for (const word of title.split(" ").filter(word => word.length > 5)) if (ref.includes(word)) score += 1;
    if (authorKey && normalize(document.author).includes(authorKey)) score += 2;
    return { document, score };
  }).filter(item => item.score >= 5).sort((a, b) => b.score - a.score)[0]?.document;
}

const quoteHelps = quotes.map(quote => {
  const haystack = normalize(`${quote.title} ${quote.author} ${quote.reference}`);
  const tags = Object.entries(tagRules).filter(([, terms]) => terms.some(term => haystack.includes(normalize(term)))).map(([tag]) => tag);
  const usefulTags = tags.length ? tags : ["vida-cristiana"];
  const relatedNormIds = normCatalog.norms.filter(norm => norm.tags.some(tag => usefulTags.includes(tag))).map(norm => norm.id);
  const document = contextualDocument(quote.reference, quote.author);
  const referenceParts = String(quote.reference || "").split(",").map(part => part.trim()).filter(Boolean);
  return {
    id: quote.id,
    kind: "quotation",
    text: quote.title,
    author: quote.author,
    work: referenceParts.slice(1).join(", ") || quote.reference,
    reference: quote.reference,
    tags: usefulTags,
    normIds: relatedNormIds,
    verified: quote.verified === true,
    sourceDocumentId: document?.id || null,
    sourceUrl: null
  };
});

const editorialHelps = normCatalog.norms.flatMap(norm => [
  {
    id: stableId("exam-question", norm.id), kind: "exam-question", text: norm.question,
    author: "Equipo editorial de Atlas", work: "Guía práctica del examen diario",
    reference: norm.sourceUrl || "Catálogo editorial de Atlas", tags: norm.tags,
    normIds: [norm.id], verified: true, sourceDocumentId: null, sourceUrl: norm.sourceUrl || null
  },
  {
    id: stableId("practical-suggestion", norm.id), kind: "practical-suggestion", text: norm.suggestion,
    author: "Equipo editorial de Atlas", work: "Guía práctica del examen diario",
    reference: norm.sourceUrl || "Catálogo editorial de Atlas", tags: norm.tags,
    normIds: [norm.id], verified: true, sourceDocumentId: null, sourceUrl: norm.sourceUrl || null
  }
]);
const normalizedManualHelps = manualHelps.map(item => ({
  ...item,
  id: item.id || stableId("manual-help", `${item.kind}|${item.text}|${item.reference}`),
  tags: Array.isArray(item.tags) ? item.tags : String(item.tags || "").split(",").map(value => value.trim()).filter(Boolean),
  normIds: Array.isArray(item.normIds) ? item.normIds : String(item.normIds || "").split(",").map(value => value.trim()).filter(Boolean),
  verified: item.verified !== false,
  sourceDocumentId: item.sourceDocumentId || null,
  sourceUrl: item.sourceUrl || null
}));

const output = {
  schemaVersion: 1,
  catalogVersion: normCatalog.catalogVersion,
  generatedAt: new Date().toISOString(),
  principles: normCatalog.principles,
  norms: normCatalog.norms,
  helps: [...normalizedManualHelps, ...editorialHelps, ...quoteHelps],
  notifications,
  sources: sources.sources,
  stats: {
    norms: normCatalog.norms.length,
    helps: normalizedManualHelps.length + editorialHelps.length + quoteHelps.length,
    quotations: quoteHelps.length,
    editorial: editorialHelps.length + normalizedManualHelps.filter(item => item.kind !== "quotation").length,
    manual: normalizedManualHelps.length,
    contextualDocuments: quoteHelps.filter(item => item.sourceDocumentId).length
  }
};

fs.writeFileSync(path.join(root, "data", "examen.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Examen diario: ${output.stats.norms} normas y ${output.stats.helps} ayudas (${output.stats.quotations} citas).`);
