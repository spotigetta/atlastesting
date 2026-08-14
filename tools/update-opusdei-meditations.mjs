import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const valueOf = name => args[args.indexOf(name) + 1];
const has = name => args.includes(name);
const pad = value => String(value).padStart(2, "0");
const iso = date => date.toISOString().slice(0, 10);
const madridDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const sourceBase = (process.env.OPUSDEI_SOURCE_BASE || "https://opusdei.org/es/meditation").replace(/\/$/, "");
const archiveStart = process.env.OPUSDEI_ARCHIVE_START || "2025-11-30";
const strict = has("--strict");

function range(from, to) {
  const dates = [], cursor = new Date(`${from}T12:00:00Z`), end = new Date(`${to}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || cursor > end) throw new Error("Rango de fechas no válido");
  while (cursor <= end) { dates.push(iso(cursor)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return dates;
}

let dates;
if (has("--all")) dates = range(archiveStart, valueOf("--to") || madridDate());
else if (has("--year")) { const year = valueOf("--year"); dates = range(`${year}-01-01`, `${year}-12-31`); }
else if (has("--from")) dates = range(valueOf("--from"), valueOf("--to") || madridDate());
else dates = [valueOf("--date") || madridDate()];

const decodeEntities = value => String(value || "")
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'")
  .replace(/&laquo;/gi, "«").replace(/&raquo;/gi, "»").replace(/&ndash;/gi, "–").replace(/&mdash;/gi, "—")
  .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&");
const plain = html => decodeEntities(String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
const cleanText = value => decodeEntities(value).replace(/\u00ad/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
const yaml = value => JSON.stringify(String(value ?? "").replace(/\r?\n/g, " "));
const slug = value => cleanText(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "meditacion";

function htmlToMarkdown(input) {
  let html = String(input || "")
    .replace(/<(script|style|nav|footer|form|button|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<hr[^>]*>/gi, "\n\n---\n\n")
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => `\n\n${"#".repeat(Number(level))} ${plain(text)}\n\n`)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, text) => `\n\n${plain(text).split("\n").map(line => `> ${line}`).join("\n")}\n\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => `\n- ${plain(text)}`)
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text) => `**${plain(text)}**`)
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text) => `*${plain(text)}*`)
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${plain(text)}](${decodeEntities(href)})`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, text) => `\n\n${plain(text)}\n\n`)
    .replace(/<[^>]+>/g, " ");
  return cleanText(html).replace(/^\s*[-*]\s*$/gm, "").replace(/\n{3,}/g, "\n\n");
}

function jsonLd(html) {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const raw = JSON.parse(decodeEntities(match[1]));
      const nodes = Array.isArray(raw) ? raw : raw["@graph"] || [raw];
      const article = nodes.find(item => item?.articleBody || /Article|NewsArticle/.test(String(item?.["@type"] || "")));
      if (article?.articleBody) return article;
    } catch {}
  }
  return null;
}

function extract(html, url, date) {
  if (/cf_chl|Enable JavaScript and cookies to continue|Just a moment/i.test(html)) throw new Error("Cloudflare ha bloqueado la descarga; configura las credenciales técnicas de acceso");
  if (String(html).trim().startsWith("{")) {
    try {
      const api = JSON.parse(html), item = api.data || api.article || api;
      const title = cleanText(item.title || item.headline), description = cleanText(item.description || item.summary || "");
      const body = item.bodyMarkdown ? cleanText(item.bodyMarkdown) : item.articleBody ? cleanText(item.articleBody) : htmlToMarkdown(item.bodyHtml || item.html || item.body || "");
      if (title && body.split(/\s+/).length >= 120) return { date, title, description, body, proposedThemes: item.categories || item.themes || [], officialUrl: item.url || url };
    } catch {}
  }
  const ld = jsonLd(html);
  const title = cleanText(ld?.headline || plain(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])).replace(/\s*[-|]\s*Opus Dei\s*$/i, "");
  const description = cleanText(ld?.description || html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)/i)?.[1] || "");
  const articleHtml = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
  const body = cleanText(ld?.articleBody || htmlToMarkdown(articleHtml));
  if (!title || body.split(/\s+/).length < 120) throw new Error("La página no contiene un artículo completo reconocible");
  const bulletSource = `${description}\n${body.slice(0, 2600)}`;
  const proposedThemes = bulletSource.match(/(?:^|\n)\s*[-•]\s+([^\n.]{8,120})/g)?.map(item => cleanText(item.replace(/^(?:\n)?\s*[-•]\s+/, ""))).slice(0, 3) || [];
  return { date, title, description, body, proposedThemes, officialUrl: url };
}

const taxonomy = [
  ["tristeza", /triste|llanto|dolor|desconsuelo|pena/i], ["amargura", /amargura|resentimiento|decepción/i],
  ["oración", /oración|orar|contempl|hablar con jesús/i], ["confianza", /confi|abandono|providencia|seguridad en dios/i],
  ["voluntad de Dios", /voluntad de dios|querer de dios|vocación|llamada/i], ["fiat", /anunciación|fiat|virgen maría|madre de dios/i],
  ["alegría", /alegr|gozo|felicidad/i], ["conversión", /convers|recomenz|arrepent|contrición|perdón/i],
  ["prueba", /prueba|tentaci|desierto|dificultad|sufrimiento/i], ["cruz", /cruz|calvario|pasión|mortificación/i],
  ["caridad", /caridad|servicio|prójimo|misericordia/i], ["fe", /\bfe\b|creer|incredulidad/i],
  ["esperanza", /esperanza|esperar en dios/i], ["eucaristía", /eucarist|sagrario|comunión|santa misa/i],
  ["confesión", /confesión|penitencia|sacramento del perdón/i], ["apostolado", /apostolado|evangeliz|misión|almas/i],
  ["vida ordinaria", /vida ordinaria|trabajo|cotidian|nazaret/i], ["humildad", /humild|soberbia|pequeñez/i],
  ["paz", /\bpaz\b|serenidad/i], ["libertad", /libertad|libres/i]
];
function classify(article) {
  const text = `${article.title} ${article.description} ${article.proposedThemes.join(" ")} ${article.body}`;
  const automatic = taxonomy.filter(([, test]) => test.test(text)).map(([id]) => id);
  return [...new Set([...article.proposedThemes.map(value => value.toLowerCase()), ...automatic])].slice(0, 10);
}
function gospelRefs(body) {
  const refs = body.match(/\b(?:Mt|Mc|Lc|Jn)\s+\d{1,2}[,:]\s*\d{1,2}(?:[-–]\d{1,2})?/g) || [];
  return [...new Set(refs.map(item => item.replace(/\s+/g, " ")))];
}
function markdown(article) {
  const themes = classify(article), refs = gospelRefs(article.body);
  const checksum = createHash("sha256").update(article.body).digest("hex");
  const themeYaml = themes.length ? `categories:\n${themes.map(item => `  - ${yaml(item)}`).join("\n")}` : "categories: []";
  const gospelYaml = refs.length ? `gospel_references:\n${refs.map(item => `  - ${yaml(item)}`).join("\n")}` : "gospel_references: []";
  return `---\ntitle: ${yaml(article.title)}\ndate: ${yaml(article.date)}\nsource: ${yaml("Opus Dei")}\nsource_url: ${yaml(article.officialUrl)}\nlanguage: ${yaml("es")}\ntype: ${yaml("meditacion_diaria")}\n${themeYaml}\n${gospelYaml}\nrights: ${yaml("Reproducción autorizada por el titular para Atlas Mercabá")}\nchecksum_sha256: ${yaml(checksum)}\n---\n\n# ${article.title}\n\n${article.description ? `> ${article.description}\n\n` : ""}${article.body}\n\n---\n\n[Fuente oficial](${article.officialUrl})\n`;
}

async function get(url) {
  const headers = { "user-agent": "Atlas-Mercaba-PWA/10 (contenido autorizado; contacto editorial)", accept: "text/html,application/xhtml+xml" };
  if (process.env.OPUSDEI_CF_ACCESS_CLIENT_ID) headers["CF-Access-Client-Id"] = process.env.OPUSDEI_CF_ACCESS_CLIENT_ID;
  if (process.env.OPUSDEI_CF_ACCESS_CLIENT_SECRET) headers["CF-Access-Client-Secret"] = process.env.OPUSDEI_CF_ACCESS_CLIENT_SECRET;
  if (process.env.OPUSDEI_API_TOKEN) headers.authorization = `Bearer ${process.env.OPUSDEI_API_TOKEN}`;
  const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

const dataFile = join(root, "data", "opusdei-meditations.json");
const previous = JSON.parse(await readFile(dataFile, "utf8").catch(() => '{"records":[]}'));
const records = new Map((previous.records || []).map(item => [item.date, item]));
const failures = [];
for (const date of dates) {
  const url = `${sourceBase}/${date}/`;
  try {
    const article = extract(await get(url), url, date);
    const themes = classify(article), refs = gospelRefs(article.body), fileName = `${date}_${slug(article.title)}.md`;
    const contentFile = records.get(date)?.contentFile || `content/opusdei-meditations/${date.slice(0, 4)}/${fileName}`;
    const destination = join(root, ...contentFile.split("/"));
    const text = markdown(article);
    await mkdir(dirname(destination), { recursive: true });
    if (await readFile(destination, "utf8").catch(() => "") !== text) await writeFile(destination, text, "utf8");
    const published = join(root, "dist", ...contentFile.split("/"));
    await mkdir(dirname(published), { recursive: true });
    if (await readFile(published, "utf8").catch(() => "") !== text) await writeFile(published, text, "utf8");
    records.set(date, { date, title: article.title, officialUrl: url, themes, gospelRefs: refs, excerpt: article.description || article.body.slice(0, 280), status: "downloaded", contentFile, words: article.body.split(/\s+/).length });
    console.log(`OK ${date} · ${article.title}`);
  } catch (error) {
    failures.push({ date, url, error: error.message });
    console.error(`ERROR ${date} · ${error.message}`);
  }
}

const sorted = [...records.values()].sort((a, b) => a.date.localeCompare(b.date));
const payload = { schemaVersion: 2, generatedAt: new Date().toISOString(), source: `${sourceBase}/`, rightsPolicy: "Reproducción autorizada por el titular para Atlas Mercabá.", records: sorted, stats: { total: sorted.length, downloaded: sorted.filter(item => item.status === "downloaded").length, failedThisRun: failures.length }, failures };
const serialized = `${JSON.stringify(payload, null, 2)}\n`;
await writeFile(dataFile, serialized, "utf8");
await mkdir(join(root, "dist", "data"), { recursive: true });
await writeFile(join(root, "dist", "data", "opusdei-meditations.json"), serialized, "utf8");

for (const year of [...new Set(sorted.map(item => item.date.slice(0, 4)))]) {
  const folder = join(root, "content", "opusdei-meditations", year);
  await mkdir(folder, { recursive: true });
  for (let month = 1; month <= 12; month++) {
    const prefix = `${year}-${pad(month)}`, items = sorted.filter(item => item.date.startsWith(prefix));
    if (!items.length) continue;
    const index = [`# Meditaciones · ${prefix}`, "", "> Corpus diario autorizado y conservado en Markdown.", "", ...items.flatMap(item => [`## ${item.date} · ${item.title}`, "", `- Estado: ${item.status}`, `- Categorías: ${(item.themes || []).join(", ") || "pendientes"}`, item.contentFile ? `- [Leer Markdown](./${item.contentFile.split("/").pop()})` : `- [Fuente oficial](${item.officialUrl})`, ""])].join("\n");
    await writeFile(join(folder, `${prefix}.md`), `${index}\n`, "utf8");
  }
}
console.log(`Corpus: ${payload.stats.downloaded} descargadas; ${failures.length} fallos en esta ejecución.`);
if (strict && failures.length) process.exitCode = 1;
