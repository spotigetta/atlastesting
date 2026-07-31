import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const atlasRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.join(atlasRoot, "data", "quotes.json");
const policyPath = path.join(atlasRoot, "content", "quote-policy.json");
const policy = fs.existsSync(policyPath)
  ? JSON.parse(fs.readFileSync(policyPath, "utf8"))
  : { excludeTextContains: [], excludeAttributionContains: [] };
const sources = ["frases.md", "frases copy.md"];
const quotes = [];
const excluded = [];

const normalize = value => String(value || "")
  .normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  .replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim();
const cleanMarkdown = value => String(value || "")
  .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  .replace(/\[([^\]]+)\]\[[^\]]+\]/g, "$1")
  .replace(/\(\s*\[[^\]]+\]\[[^\]]+\]\s*\)/g, "")
  .replace(/[*_`]/g, "")
  .replace(/\s+/g, " ").replace(/\.$/, "").trim();
const cleanHeading = value => cleanMarkdown(value).replace(/^\d+[.)-]?\s*/, "").trim();

const libraryFor = value => {
  const text = normalize(value);
  if (/josemaria|escriva|camino|surco|forja/.test(text)) return "san-josemaria";
  if (/canon|derecho|tribunal|matrimonio nulo/.test(text)) return "canon";
  if (/liturg|misa|eucarist|sacramento|misal/.test(text)) return "liturgy";
  if (/padres|agustin|ireneo|crisostomo|ignacio|historia|concilio/.test(text)) return "history";
  return "doctrine";
};

const denied = (text, attribution) => {
  const normalizedText = normalize(text);
  const normalizedAttribution = normalize(attribution);
  return (policy.excludeTextContains || []).some(value => normalizedText.includes(normalize(value)))
    || (policy.excludeAttributionContains || []).some(value => normalizedAttribution.includes(normalize(value)));
};

for (const filename of sources) {
  const sourcePath = path.join(atlasRoot, filename);
  if (!fs.existsSync(sourcePath)) continue;
  const source = fs.readFileSync(sourcePath, "utf8");
  let section = "Colección de frases de Atlas";
  for (const raw of source.split(/\r?\n/)) {
    const heading = raw.match(/^#{1,4}\s+(.+?)\s*$/);
    if (heading) { section = heading[1].trim(); continue; }
    const match = raw.match(/^\s*\d+\.\s+[“"«](.+?)[”"»](?:[.,])?\s*(?:—\s*)?(.*)$/u);
    if (!match) continue;
    const text = match[1].trim();
    const rawAttribution = cleanMarkdown(match[2]) || cleanHeading(section);
    const copyCollection = filename === "frases copy.md";
    const author = copyCollection ? cleanHeading(section) : cleanMarkdown(rawAttribution.split(",")[0]);
    const work = copyCollection ? rawAttribution : "";
    const attribution = copyCollection
      ? [author, work].filter(Boolean).join(" · ")
      : rawAttribution;
    if (denied(text, attribution)) {
      excluded.push({ text, attribution, source: filename });
      continue;
    }
    const digest = crypto.createHash("sha1").update(`${normalize(text)}|${normalize(attribution)}`).digest("hex").slice(0, 12);
    quotes.push({
      id: `quote-md-${digest}`,
      type: "quote",
      title: `«${text}»`,
      text: work ? `Una frase de ${author}, tomada de ${work}.` : `Una frase de ${author || "la colección de Atlas"}.`,
      author,
      reference: attribution || section,
      libraryId: libraryFor(`${section} ${attribution} ${text}`),
      verified: true,
      reviewedAt: new Date().toISOString().slice(0, 10),
      source: filename
    });
  }
}

const unique = [...new Map(quotes.map(item => [
  `${normalize(item.title)}|${normalize(item.reference)}`, item
])).values()];
const payload = {
  generatedAt: new Date().toISOString(),
  count: unique.length,
  excluded: excluded.length,
  sources,
  items: unique
};
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Atlas quotes: ${unique.length} cards from ${sources.join(" + ")}; ${excluded.length} excluded by policy.`);
