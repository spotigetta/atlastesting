import { readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const dataUrl = name => new URL(`data/${name}`, root);
const distUrl = name => new URL(`dist/data/${name}`, root);
const readJson = async (name, fallback = {}) => { try { return JSON.parse(await readFile(dataUrl(name), "utf8")); } catch { return fallback; } };
const semantic = value => JSON.stringify(value, (key, item) => ["updatedAt", "generatedAt"].includes(key) ? undefined : item);
const writeJson = async (name, value) => {
  const previous = await readJson(name, null);
  const selected = previous && semantic(previous) === semantic(value) ? previous : value;
  const text = `${JSON.stringify(selected, null, 2)}\n`;
  if (selected === value) await writeFile(dataUrl(name), text, "utf8");
  try {
    await access(new URL("dist/data/", root));
    const published = await readFile(distUrl(name), "utf8").catch(() => "");
    if (published !== text) await writeFile(distUrl(name), text, "utf8");
  } catch {}
};
const decode = value => String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
async function get(url, timeout = 15000) {
  const response = await fetch(url, { headers: { "user-agent": "Atlas-Mercaba-PWA/8 (+GitHub Actions)", accept: "text/html,application/xml,application/rss+xml" }, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`${response.status} ${new URL(url).hostname}`);
  return response.text();
}
const channelId = html => html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/)?.[1] || html.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/)?.[1] || html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/)?.[1];
function parseYoutube(xml, channel, type) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entry]) => {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]; if (!videoId) return null;
    return { id: `youtube-${videoId}`, videoId, type, source: channel.name, author: channel.name,
      title: decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || channel.name),
      description: type === "music" ? "Pieza musical obtenida del canal oficial." : "Vídeo reciente del canal configurado en Atlas.",
      url: `https://www.youtube.com/watch?v=${videoId}`, image: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      libraryId: type === "music" ? "liturgy" : "doctrine", external: true, verified: true, dynamic: true,
      tier: channel.tier || "main", publishedAt: entry.match(/<published>([^<]+)<\/published>/)?.[1] || "" };
  }).filter(Boolean);
}
async function mapLimit(items, limit, task) {
  const output = []; let cursor = 0;
  async function worker() { while (cursor < items.length) { const index = cursor++; try { output[index] = { value: await task(items[index]) }; } catch (error) { output[index] = { error: error.message, item: items[index] }; } } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return output;
}
async function refreshYoutube(kind, channels) {
  const file = kind === "music" ? "youtube-music-cache.json" : "youtube-live-cache.json";
  const previous = await readJson(file, { items: [] });
  const responses = await mapLimit(channels, 6, async channel => {
    const direct = channel.url.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/)?.[1];
    const id = direct || channel.channelId || channelId(await get(channel.url));
    if (!id) throw new Error("No se encontró el identificador del canal");
    return parseYoutube(await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`), channel, kind);
  });
  const live = responses.flatMap(result => result.value || []);
  const items = [...new Map([...live, ...(previous.items || [])].map(item => [item.videoId || item.id, item])).values()]
    .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""))).slice(0, kind === "music" ? 300 : 2500);
  if (!items.length) throw new Error(`${kind}: no hay resultados ni caché anterior`);
  const failures = responses.filter(item => item.error).map(item => ({ source: item.item?.name, error: item.error }));
  await writeJson(file, { updatedAt: new Date().toISOString(), source: live.length ? "youtube-rss" : "previous-snapshot", channels, items, failures });
  return { provider: kind, ok: Boolean(live.length), live: live.length, total: items.length, failures: failures.length };
}
const editorialFeeds = [
  { type: "news", source: "Omnes", url: "https://www.omnesmag.com/feed/", take: 10 },
  { type: "news", source: "Alfa y Omega", url: "https://alfayomega.es/feed/", take: 10 },
  { type: "news", source: "El Debate · Religión", url: "https://www.eldebate.com/rss/religion.xml", take: 10 },
  { type: "reading", source: "Opus Dei", url: "https://opusdei.org/es/", take: 8, parser: "opus-home" }
];
const youthItem = { id:"opusdei-youth", type:"youth", source:"Opus Dei · Youth", url:"https://opusdei.org/es/youth/", title:"Youth · Opus Dei", description:"Artículos, vídeos, podcasts y propuestas para vivir la fe en el siglo XXI.", image:"https://images.opusdei.net/?url=https://s3-eu-west-1.amazonaws.com/images-opus-dei/page/2024/6/Tweets-con-Dios-Tu-historia20240605114626427371.png&w=1200&il&output=jpg&q=75", fetched:true, dynamic:true };
const booksItem = { id:"opusdei-ebooks", type:"reading", source:"Opus Dei · Libros electrónicos", url:"https://opusdei.org/es/page/libros-electronicos/", title:"Libros electrónicos · Opus Dei", description:"Selección oficial de libros sobre vida cristiana, doctrina católica, cartas de san Josemaría, novenas y textos de los Papas.", fetched:true, dynamic:true };
const youthUrl = "https://opusdei.org/es/youth/";
const madridToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
function parseOpusGospel(html, date) {
  const title = decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const description = decode(html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1] || html.match(/<p\b[^>]*class=["'][^"']*(?:entradilla|summary|lead)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
  if (!title) throw new Error("Evangelio de Opus Dei sin título");
  return { id: `opus-gospel-${date}`, type: "gospel", source: "Opus Dei", url: `https://opusdei.org/es/gospel/${date}/`, title, description: description.slice(0, 360), date, fetched: true, dynamic: true };
}
async function refreshOpusGospel() {
  const date = madridToday();
  return parseOpusGospel(await get(`https://opusdei.org/es/gospel/${date}/`), date);
}
function parseYouthCards(html) {
  const cards = []; const seen = new Set();
  const cardPattern = /<a\b(?=[^>]*\bhref=["']([^"']*\/es\/article\/[^"']+))[\s\S]*?(?=[^>]*\btitle=["']([^"']+))[\s\S]*?<img\b[^>]*\bsrc=["']([^"']+)["'][\s\S]*?<\/a>/gi;
  for (const match of html.matchAll(cardPattern)) {
    const url = new URL(decode(match[1]), youthUrl).href;
    const title = decode(match[2]); const image = decode(match[3]).replace(/^\/\//, "https://");
    if (!title || !image || seen.has(url)) continue;
    seen.add(url);
    cards.push({ id:`youth-${createHash("sha1").update(url).digest("hex").slice(0,12)}`, type:"youth", source:"Opus Dei · Youth", url, title,
      description:"Propuesta reciente de Youth: vídeo, artículo, podcast o historia para vivir la fe hoy.", image, fetched:true, dynamic:true });
  }
  return cards.slice(0, 24);
}
async function refreshYouth() {
  const cards = parseYouthCards(await get(youthUrl));
  if (!cards.length) throw new Error("Youth no devolvió tarjetas reconocibles");
  return cards;
}
function rssItems(xml, feed) {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0, feed.take).map(([, block]) => {
    const tag = name => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "";
    const url = decode(tag("link")) || decode(tag("guid")), title = decode(tag("title")); if (!url || !title) return null;
    const rawDescription = tag("description");
    const image = block.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)/i)?.[1] || rawDescription.match(/<img[^>]+src=["']([^"']+)/i)?.[1] || "";
    return { id: `external-${createHash("sha1").update(url).digest("hex").slice(0, 12)}`, type: feed.type, source: feed.source, url, title,
      description: decode(rawDescription).slice(0, 360), author: decode(tag("dc:creator")),
      date: tag("pubDate") ? new Date(decode(tag("pubDate"))).toISOString().slice(0, 10) : "", image, fetched: true };
  }).filter(Boolean);
}
function opusHomeItems(html, feed) {
  const cards = [], seen = new Set();
  const headings = [...html.matchAll(/<h2\b[^>]*>\s*<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi)];
  for (let index = 0; index < headings.length && cards.length < feed.take; index += 1) {
    const match = headings[index];
    const snippet = html.slice(match.index, headings[index + 1]?.index || match.index + 9000);
    const url = new URL(decode(match[1]), feed.url).href;
    const title = decode(match[2]);
    if (!title || !url || seen.has(url) || !/\/es\/article\//.test(url)) continue;
    seen.add(url);
    const image = decode(snippet.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || "").replace(/^\/\//, "https://");
    const date = snippet.match(/<time\b[^>]*\bdatetime=["']([^"']+)["']/i)?.[1] || "";
    const description = decode(snippet.match(/<p\b[^>]*\bclass=["'][^"']*\bclamp\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] || "").slice(0, 360);
    cards.push({
      id: `external-${createHash("sha1").update(url).digest("hex").slice(0, 12)}`,
      type: feed.type, source: feed.source, url, title, description, image,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "", fetched: true, dynamic: true
    });
  }
  return cards;
}
function feedItems(xml, feed) {
  if (feed.parser === "opus-home") return opusHomeItems(xml, feed);
  const rss=rssItems(xml, feed); if (rss.length) return rss;
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].slice(0,feed.take).map(([,block]) => {
    const tag=name=>block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"))?.[1]||"";
    const url=block.match(/<link\b[^>]*\bhref=["']([^"']+)/i)?.[1]||decode(tag("link"));
    const title=decode(tag("title")); if(!url||!title)return null;
    const summary=tag("summary")||tag("content");
    const image=block.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)/i)?.[1]||summary.match(/<img[^>]+src=["']([^"']+)/i)?.[1]||"";
    const date=decode(tag("updated")||tag("published"));
    return {id:`external-${createHash("sha1").update(url).digest("hex").slice(0,12)}`,type:feed.type,source:feed.source,url,title,description:decode(summary).slice(0,360),author:decode(tag("author")||tag("name")),date:date?new Date(date).toISOString().slice(0,10):"",image,fetched:true};
  }).filter(Boolean);
}
async function refreshEditorial() {
  const previous = await readJson("external-content.json", { items: [] });
  const responses = await Promise.allSettled([...editorialFeeds.map(async feed => feedItems(await get(feed.url), feed)), refreshYouth(), refreshOpusGospel()]);
  const gospelResult = responses.at(-1), youthResult = responses.at(-2);
  const gospel = gospelResult.status === "fulfilled" ? gospelResult.value : null;
  const youth = youthResult.status === "fulfilled" ? youthResult.value : [];
  const live = responses.slice(0,-2).flatMap(result => result.status === "fulfilled" ? result.value : []);
  const curated = [...youth, youthItem, booksItem, ...(gospel ? [gospel] : [])];
  const items = [...new Map([...curated, ...live, ...(previous.items || [])].map(item => [item.url, item])).values()].slice(0, 300);
  if (!items.length) throw new Error("Editorial: no hay resultados ni caché anterior");
  const failures = responses.filter(item => item.status === "rejected").map(item => item.reason?.message || "Proveedor no disponible");
  await writeJson("external-content.json", { generatedAt: new Date().toISOString(), items, failures });
  return { provider: "editorial", ok: Boolean(live.length), live: live.length, total: items.length, failures: failures.length };
}
const catalog = await readJson("channel-catalog.json", { youtube: [], music: [] });
const health = [];
for (const operation of [() => refreshYoutube("video", (catalog.youtube || []).filter(item => item.enabled !== false)), () => refreshYoutube("music", (catalog.music || []).filter(item => item.enabled !== false)), refreshEditorial]) {
  try { health.push(await operation()); } catch (error) { health.push({ provider: "unknown", ok: false, error: error.message }); }
}
await writeJson("provider-health.json", { updatedAt: new Date().toISOString(), providers: health });
console.log(JSON.stringify(health, null, 2));
