import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contentDir = path.join(root, "content");
const snapshotDir = path.join(root, "source", "providers", "snapshots");
fs.mkdirSync(snapshotDir, { recursive: true });

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (name, value) => {
  const target = path.join(snapshotDir, name);
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, target);
};
const previous = name => {
  try { return read(path.join(snapshotDir, name)); }
  catch { return { items: [] }; }
};
const decode = value => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&amp;/g, "&");

async function get(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Atlas-Mercaba-PWA/5.0 (+GitHub Actions)" }
    });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

const channelIdFromHtml = html =>
  html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/)?.[1] ||
  html.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/)?.[1] ||
  html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/)?.[1];

function parseFeed(xml, channel, type) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(match => {
    const entry = match[1];
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    if (!videoId) return null;
    const title = decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || channel.name);
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] || "";
    return {
      id: `youtube-${videoId}`,
      videoId,
      type,
      source: channel.name,
      author: channel.name,
      title,
      description: type === "music" ? "Pieza musical obtenida del canal oficial." : "Vídeo reciente obtenido del canal configurado en Atlas.",
      url: `https://www.youtube.com/watch?v=${videoId}`,
      image: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      libraryId: type === "music" ? "liturgy" : "doctrine",
      external: true,
      verified: true,
      dynamic: true,
      tier: channel.tier || "main",
      publishedAt
    };
  }).filter(Boolean);
}

async function mapLimit(items, limit, task) {
  const result = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await task(items[index]).catch(error => ({ error: error.message, item: items[index] }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return result;
}

async function refreshYoutube(configName, snapshotName, type) {
  const config = read(path.join(contentDir, configName));
  const responses = await mapLimit(config.channels || [], 6, async channel => {
    const html = await get(channel.url);
    const channelId = channel.channelId || channelIdFromHtml(html);
    if (!channelId) throw new Error("No se encontró el identificador del canal");
    const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
    return { channel: { ...channel, channelId }, items: parseFeed(xml, channel, type) };
  });
  const failures = responses.filter(item => item?.error).map(item => ({ source: item.item.name, error: item.error }));
  const live = responses.flatMap(item => item?.items || []);
  const old = previous(snapshotName).items || [];
  const items = [...new Map([...live, ...old].map(item => [item.id, item])).values()]
    .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))
    .slice(0, type === "music" ? 300 : 2500);
  if (!items.length) throw new Error(`${configName} no produjo ningún elemento y tampoco existe reserva`);
  const value = {
    updatedAt: new Date().toISOString(),
    source: live.length ? "youtube-rss" : "previous-snapshot",
    channels: config.channels,
    items,
    failures
  };
  write(snapshotName, value);
  return { provider: type === "music" ? "music" : "youtube", ok: true, live: live.length, total: items.length, failures: failures.length };
}

async function refreshJosemaria() {
  const old = previous("josemaria-quotes.json").items || [];
  const requests = await Promise.allSettled(Array.from({ length: 12 }, async () => {
    const text = await get("https://escriva.org/api/v1/random-item/?site_id=2", 8000);
    const item = JSON.parse(text);
    const description = item.description || item.text || item.content || "";
    const url = item.url || item.absolute_url || "https://escriva.org/es/";
    return {
      id: `josemaria-${Buffer.from(`${url}|${description}`).toString("base64url").slice(0, 18)}`,
      type: "quote",
      source: "San Josemaría",
      author: "San Josemaría Escrivá",
      title: item.title || "San Josemaría",
      description,
      text: description,
      url,
      reference: "escriva.org",
      external: true,
      verified: true
    };
  }));
  const live = requests.filter(item => item.status === "fulfilled").map(item => item.value).filter(item => item.description);
  const items = [...new Map([...live, ...old].map(item => [item.id, item])).values()].slice(0, 80);
  if (!items.length) throw new Error("No hay frases de reserva de san Josemaría");
  write("josemaria-quotes.json", { updatedAt: new Date().toISOString(), source: live.length ? "escriva.org" : "previous-snapshot", items });
  return { provider: "josemaria", ok: true, live: live.length, total: items.length, failures: requests.length - live.length };
}

function refreshEditorial() {
  try {
    execFileSync(process.execPath, [path.join(root, "generators", "build-external-content.mjs")], {
      cwd: root, stdio: "inherit", timeout: 120000
    });
    const value = read(path.join(root, "data", "external-content.json"));
    if (!value.items?.length) throw new Error("El proveedor editorial devolvió cero elementos");
    write("external-content.json", value);
    return { provider: "editorial", ok: true, total: value.items.length, failures: value.failures?.length || 0 };
  } catch (error) {
    const fallback = previous("external-content.json");
    if (!fallback.items?.length) throw error;
    return { provider: "editorial", ok: false, total: fallback.items.length, error: error.message };
  }
}

const health = [];
for (const operation of [
  () => refreshYoutube("youtube-shorts.json", "youtube-live-cache.json", "video"),
  () => refreshYoutube("youtube-music.json", "youtube-music-cache.json", "music"),
  refreshJosemaria
]) {
  try { health.push(await operation()); }
  catch (error) { health.push({ provider: "unknown", ok: false, error: error.message }); }
}
health.push(refreshEditorial());
health.push({
  provider: "instagram",
  ok: Boolean(previous("instagram-cache.json").items?.length),
  total: previous("instagram-cache.json").items?.length || 0,
  note: "Instagram no ofrece una API pública estable sin autenticación; se conserva el último snapshot válido."
});
write("provider-health.json", { updatedAt: new Date().toISOString(), providers: health });
console.log(JSON.stringify(health, null, 2));
