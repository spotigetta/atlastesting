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
  const enabledChannels = (config.channels || []).filter(channel => channel.enabled !== false);
  const responses = await mapLimit(enabledChannels, 6, async channel => {
    const html = await get(channel.url);
    const channelId = channel.channelId || channelIdFromHtml(html);
    if (!channelId) throw new Error("No se encontró el identificador del canal");
    const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
    return { channel: { ...channel, channelId }, items: parseFeed(xml, channel, type) };
  });
  const failures = responses.filter(item => item?.error).map(item => ({ source: item.item.name, error: item.error }));
  const live = responses.flatMap(item => item?.items || []);
  const manual = (config.items || []).map(item => {
    const videoId = item.videoId || item.id;
    if (!videoId) return null;
    return {
      ...item,
      id: item.id?.startsWith("youtube-") || item.id?.startsWith("music-") ? item.id : `${type === "music" ? "music" : "youtube"}-${videoId}`,
      videoId,
      type,
      source: item.source || item.channel || (type === "music" ? "Música" : "YouTube"),
      author: item.author || item.source || item.channel || "",
      title: item.title || (type === "music" ? "Pieza musical" : "Vídeo de YouTube"),
      description: item.description || "Contenido añadido manualmente desde el Gestor de Atlas.",
      url: item.url || `https://www.youtube.com/watch?v=${videoId}`,
      image: item.image || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      libraryId: item.libraryId || (type === "music" ? "liturgy" : "doctrine"),
      external: true,
      verified: true,
      manual: true,
      tier: item.tier || "main"
    };
  }).filter(Boolean);
  const old = previous(snapshotName).items || [];
  const items = [...new Map([...manual, ...live, ...old].map(item => [item.videoId || item.id, item])).values()]
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

async function refreshInstagram() {
  const config = read(path.join(contentDir, "instagram.json"));
  const old = previous("instagram-cache.json").items || [];
  const manual = (config.items || []).filter(item => item.url).map(item => ({
    ...item,
    id: item.id || `instagram-${Buffer.from(item.url).toString("base64url").slice(0, 18)}`,
    type: "instagram",
    source: item.source || item.author || "Instagram",
    author: item.author || item.source || "Instagram",
    title: item.title || "Publicación de Instagram",
    description: item.description || "Publicación añadida desde el Gestor de Atlas.",
    libraryId: item.libraryId || "doctrine",
    external: true,
    verified: true,
    manual: true
  }));
  const enabledChannels = (config.channels || []).filter(channel => channel.enabled !== false);
  const responses = await mapLimit(enabledChannels, 3, async channel => {
    const html = await get(channel.url, 12000);
    const codes = [...new Set([
      ...[...html.matchAll(/\"shortcode\":\"([A-Za-z0-9_-]+)\"/g)].map(match => match[1]),
      ...[...html.matchAll(/\"code\":\"([A-Za-z0-9_-]{5,})\"/g)].map(match => match[1])
    ])].slice(0, 12);
    const image = decode(html.match(/<meta property=["']og:image["'] content=["']([^"']+)/i)?.[1] || "");
    const description = decode(html.match(/<meta property=["']og:description["'] content=["']([^"']+)/i)?.[1] || "");
    return codes.map(code => ({
      id: `instagram-${channel.handle}-${code}`, type: "instagram", source: channel.name, author: channel.name,
      title: `Publicación de ${channel.name}`, description: description || `Publicación reciente de @${channel.handle}.`,
      url: `https://www.instagram.com/p/${code}/`, image, libraryId: "doctrine",
      external: true, verified: true, dynamic: true
    }));
  });
  const live = responses.flatMap(result => Array.isArray(result) ? result : []);
  const failures = responses.filter(result => result?.error).map(result => ({ source: result.item.name, error: result.error }));
  const profiles = enabledChannels.map(channel => ({
    id: `instagram-profile-${channel.handle}`,
    type: "instagram",
    source: channel.name,
    author: channel.name,
    title: `Publicaciones de ${channel.name}`,
    description: "Accede al perfil configurado y a sus publicaciones recientes en Instagram.",
    url: channel.url,
    libraryId: "doctrine",
    external: true,
    verified: true,
    profileFallback: true
  }));
  const items = [...new Map([...manual, ...live, ...old, ...profiles].map(item => [item.id || item.url, item])).values()];
  write("instagram-cache.json", {
    updatedAt: new Date().toISOString(),
    source: live.length ? "instagram-public-pages" : manual.length ? "manual-and-profiles" : "configured-profiles",
    channels: config.channels || [],
    items,
    failures
  });
  return { provider: "instagram", ok: Boolean(items.length), total: items.length, live: live.length, manual: manual.length, failures: failures.length };
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
try { health.push(await refreshInstagram()); }
catch (error) { health.push({ provider: "instagram", ok: false, error: error.message }); }
write("provider-health.json", { updatedAt: new Date().toISOString(), providers: health });
console.log(JSON.stringify(health, null, 2));
