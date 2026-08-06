import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sourceFingerprint } from "./generators/lib/source-state.mjs";

const atlasRoot = path.dirname(fileURLToPath(import.meta.url));
const embeddedWorkspace = path.join(atlasRoot, "source", "libraries");
const workspace = path.resolve(process.env.ATLAS_SOURCE_ROOT || (fs.existsSync(embeddedWorkspace) ? embeddedWorkspace : path.dirname(atlasRoot)));
const dataDir = path.join(atlasRoot, "data");
const contentDir = path.join(atlasRoot, "content");
const registryPath = path.join(contentDir, "libraries.json");
const idRegistryPath = path.join(atlasRoot, "source", "id-registry.json");
const statePath = path.join(dataDir, "source-state.json");
const port = Number(process.env.ATLAS_PORT || 8765);
let rebuilding = false;
let lastBuild = null;
let lastError = "";
const youtubeConfigPath = path.join(contentDir, "youtube-shorts.json");
const youtubeCachePath = path.join(dataDir, "youtube-live-cache.json");
const musicConfigPath = path.join(contentDir, "youtube-music.json");
const musicCachePath = path.join(dataDir, "youtube-music-cache.json");
const instagramConfigPath = path.join(contentDir, "instagram.json");
const instagramCachePath = path.join(dataDir, "instagram-cache.json");
const examNormsPath = path.join(contentDir, "examen", "normas.json");
const examHelpsPath = path.join(contentDir, "examen", "manual-helps.json");
const examSourcesPath = path.join(contentDir, "examen", "sources.json");
const youtubeRefreshMs = 30 * 60 * 1000;
let youtubeRefreshPromise = null;
let musicRefreshPromise = null;
let instagramRefreshPromise = null;
const youtubeMetadataCache = new Map();

const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".md": "text/markdown; charset=utf-8"
};
const json = (res, status, value) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
};
const slug = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 90) || "documento";
const normalize = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").trim();
const randomized = (items, seed = "") => {
  const value = String(seed || Date.now());
  return [...items].sort((a, b) => crypto.createHash("sha1").update(`${value}:${a.videoId || a.id}`).digest("hex")
    .localeCompare(crypto.createHash("sha1").update(`${value}:${b.videoId || b.id}`).digest("hex")));
};
const plainText = value => String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
const decodeXml = value => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const libraries = () => JSON.parse(fs.readFileSync(registryPath, "utf8"));
const writeLibraries = registry => {
  const temporary = `${registryPath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, registryPath);
};
const discoveredLibrary = (folder, registry) => {
  const rawName = folder.replace(/^\d{2,}_IA_/i, "").replace(/_/g, " ").trim() || "Nueva IA";
  const baseId = slug(rawName).replace(/_/g, "-");
  let id = baseId;
  let suffix = 2;
  while (registry.some(item => item.id === id)) id = `${baseId}-${suffix++}`;
  const tones = ["amber", "blue", "clay", "violet", "emerald", "rose", "indigo", "gold", "cyan", "olive", "burgundy", "slate"];
  return {
    id,
    folder,
    short: rawName.replace(/\bIa\b/gi, "IA"),
    mark: rawName.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "").slice(0, 1).toUpperCase() || "A",
    tone: tones[registry.length % tones.length],
    notebookUrl: "",
    description: `Biblioteca documental detectada automáticamente en ${folder}.`
  };
};
function syncDiscoveredLibraries() {
  const registry = libraries();
  const known = new Set(registry.map(item => item.folder.toLowerCase()));
  const folders = fs.readdirSync(workspace, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{2,}_IA_.+/i.test(entry.name))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, "es"));
  const added = [];
  let changed = false;
  for (const folder of folders) {
    if (known.has(folder.toLowerCase())) continue;
    const prefix = folder.match(/^(\d{2,})_IA_/i)?.[1];
    const relocated = registry.find(item =>
      item.folder.match(/^(\d{2,})_IA_/i)?.[1] === prefix &&
      !fs.existsSync(path.join(workspace, item.folder))
    );
    if (relocated) {
      known.delete(relocated.folder.toLowerCase());
      relocated.folder = folder;
      known.add(folder.toLowerCase());
      changed = true;
      continue;
    }
    const library = discoveredLibrary(folder, registry);
    registry.push(library);
    known.add(folder.toLowerCase());
    added.push(library);
  }
  if (added.length || changed) writeLibraries(registry);
  return added;
}
const catalog = () => JSON.parse(fs.readFileSync(path.join(dataDir, "catalog.json"), "utf8"));
const safeLibrary = id => {
  const library = libraries().find(item => item.id === id);
  if (!library) throw new Error("Biblioteca no encontrada");
  const directory = path.resolve(workspace, library.folder);
  if (!directory.startsWith(path.resolve(workspace) + path.sep)) throw new Error("Carpeta no válida");
  return { library, directory };
};
const safeFile = (directory, file) => {
  const target = path.resolve(directory, path.basename(file));
  if (!target.startsWith(directory + path.sep) || !/\.md$/i.test(target)) throw new Error("Archivo no válido");
  return target;
};
const isDocumentFile = file => /\.md$/i.test(file)
  && !/^0000_Indice_y_mapa_de_fuentes\.md$/i.test(file)
  && !/Instrucciones_de_personalizacion|Documentos_para_incluir_en_el_futuro/i.test(file);

function listSourceFiles() {
  const entries = [];
  for (const library of libraries()) {
    const directory = path.join(workspace, library.folder);
    if (!fs.existsSync(directory)) continue;
    for (const file of fs.readdirSync(directory).filter(name => /\.md$/i.test(name)).sort()) {
      const stat = fs.statSync(path.join(directory, file));
      entries.push({ libraryId: library.id, folder: library.folder, file, size: stat.size, modified: stat.mtimeMs });
    }
  }
  return entries;
}

function fingerprint() {
  return sourceFingerprint({ atlasRoot, sourceRoot: workspace });
}

function runNode(script) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(atlasRoot, "generators", script)], { cwd: workspace, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${stdout}\n${stderr}\n${error.message}`));
      else resolve(`${stdout}${stderr}`.trim());
    });
  });
}

function runTool(script) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(atlasRoot, "tools", script)], {
      cwd: atlasRoot,
      env: { ...process.env, ATLAS_SOURCE_ROOT: workspace },
      maxBuffer: 50 * 1024 * 1024,
      timeout: 15 * 60 * 1000
    }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${stdout}\n${stderr}\n${error.message}`));
      else resolve(`${stdout}${stderr}`.trim());
    });
  });
}

async function rebuild({ force = false, external = true } = {}) {
  if (rebuilding) return { ok: false, message: "Ya hay una actualización en curso." };
  rebuilding = true;
  lastError = "";
  const output = [];
  try {
    const discovered = syncDiscoveredLibraries();
    if (discovered.length) output.push(`Detectadas automáticamente: ${discovered.map(item => item.short).join(", ")}.`);
    output.push(await runTool("build.mjs"));
    lastBuild = new Date().toISOString();
    return { ok: true, output };
  } catch (error) {
    lastError = error.message;
    return { ok: false, message: error.message, output };
  } finally {
    rebuilding = false;
  }
}

function body(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > limit) { reject(new Error("La petición es demasiado grande")); req.destroy(); }
      else chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch { reject(new Error("JSON no válido")); }
    });
    req.on("error", reject);
  });
}

function parseFrontmatter(markdown) {
  const block = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?/);
  const meta = {};
  if (block) {
    for (const line of block[1].split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
      if (match) meta[match[1].toLowerCase()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return { meta, body: block ? markdown.slice(block[0].length) : markdown };
}

function canonicalContent(markdown) {
  return parseFrontmatter(String(markdown || "")).body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, block => block.replace(/\s+/g, " "))
    .normalize("NFKC").toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function sourceDocuments(filterLibraryId = "") {
  const catalogDocs = new Map(catalog().libraries.flatMap(lib => lib.documents.map(doc => [`${lib.id}/${doc.file}`, doc])));
  const documents = [];
  for (const library of libraries()) {
    if (filterLibraryId && library.id !== filterLibraryId) continue;
    const directory = path.join(workspace, library.folder);
    if (!fs.existsSync(directory)) continue;
    for (const file of fs.readdirSync(directory).filter(isDocumentFile).sort()) {
      const content = fs.readFileSync(path.join(directory, file), "utf8");
      const parsed = parseFrontmatter(content);
      const known = catalogDocs.get(`${library.id}/${file}`);
      const heading = parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim();
      const title = parsed.meta.title || known?.title || heading || file.replace(/^\d{4}(?:_\d{4})?_?/, "").replace(/_/g, " ").replace(/\.md$/i, "");
      documents.push({
        ...(known || {}),
        id: known?.id || `${library.id}-${file.replace(/\.md$/i, "")}`,
        libraryId: library.id, library: library.short, folder: library.folder, file, title,
        category: parsed.meta.category || known?.category || "Pendiente de catalogar",
        words: known?.words || canonicalContent(content).split(/\s+/).filter(Boolean).length,
        canonicalHash: crypto.createHash("sha256").update(canonicalContent(content)).digest("hex")
      });
    }
  }
  return documents;
}

function duplicateReport() {
  const titleGroups = new Map();
  const hashGroups = new Map();
  for (const item of sourceDocuments()) {
    const titleKey = normalize(item.title);
    if (!titleGroups.has(titleKey)) titleGroups.set(titleKey, []);
    titleGroups.get(titleKey).push(item);
    if (!hashGroups.has(item.canonicalHash)) hashGroups.set(item.canonicalHash, []);
    hashGroups.get(item.canonicalHash).push(item);
  }
  return {
    titles: [...titleGroups.values()].filter(group => group.length > 1),
    exact: [...hashGroups.values()].filter(group => group.length > 1)
  };
}

function validateUpload(input, documents) {
  const content = String(input.content || "");
  const title = String(input.title || input.originalName || "").replace(/\.md$/i, "").trim();
  if (!title || !content.trim()) return { error: "Título y contenido son obligatorios." };
  const canonicalHash = crypto.createHash("sha256").update(canonicalContent(content)).digest("hex");
  const sameTitle = documents.filter(doc => normalize(doc.title) === normalize(title));
  const exact = documents.filter(doc => doc.canonicalHash === canonicalHash);
  return { content, title, canonicalHash, sameTitle, exact };
}

function storeUpload(input, documents) {
  const { library, directory } = safeLibrary(input.libraryId);
  const check = validateUpload(input, documents);
  if (check.error) return { status: 400, error: check.error };
  if (!input.force && (check.sameTitle.length || check.exact.length)) {
    return {
      status: 409, error: "Posible duplicado",
      sameTitle: check.sameTitle.map(item => ({ title: item.title, library: item.library, file: item.file })),
      exact: check.exact.map(item => `${item.library}: ${item.file}`)
    };
  }
  const numbers = fs.readdirSync(directory).map(file => Number(file.match(/^(\d{4})/)?.[1])).filter(Number.isFinite);
  const number = String(Math.max(0, ...numbers) + 1).padStart(4, "0");
  const fileName = `${number}_${slug(input.title || input.originalName)}.md`;
  const target = safeFile(directory, fileName);
  const hasFrontmatter = /^---\s*\r?\n/.test(check.content);
  const frontmatter = `---\ntitle: "${String(input.title || check.title).replaceAll('"', '\\"')}"\ncategory: "${String(input.category || "Nuevos documentos").replaceAll('"', '\\"')}"${input.author ? `\nauthor: "${String(input.author).replaceAll('"', '\\"')}"` : ""}${input.year ? `\nyear: ${Number(input.year)}` : ""}\n---\n\n`;
  fs.writeFileSync(target, hasFrontmatter ? check.content : frontmatter + check.content, "utf8");
  documents.push({
    libraryId: library.id, library: library.short, folder: library.folder, file: fileName,
    title: input.title || check.title, canonicalHash: check.canonicalHash
  });
  return { status: 201, ok: true, library: library.short, file: fileName };
}

function youtubeSeedData() {
  return JSON.parse(fs.readFileSync(youtubeConfigPath, "utf8"));
}

function musicSeedData() {
  try { return JSON.parse(fs.readFileSync(musicConfigPath, "utf8")); }
  catch { return { channels: [] }; }
}

function youtubeSeedItems() {
  const config = youtubeSeedData();
  return config.items.map(item => ({
    id: `youtube-${item.id}`,
    videoId: item.id,
    type: "video",
    source: item.channel,
    author: item.channel,
    title: item.title,
    description: "Short de YouTube enlazado desde Atlas. Se reproduce dentro de Atlas y no se almacena localmente.",
    url: `https://www.youtube.com/shorts/${item.id}`,
    image: `https://i.ytimg.com/vi/${item.id}/hq720_2.jpg`,
    libraryId: /josemaria|escriva/.test(normalize(item.title)) ? "san-josemaria" : "doctrine",
    external: true,
    verified: true,
    dynamic: false,
    publishedAt: ""
  }));
}

function readYoutubeCache() {
  try {
    const cache = JSON.parse(fs.readFileSync(youtubeCachePath, "utf8"));
    return Array.isArray(cache.items) ? cache : null;
  } catch {
    return null;
  }
}

function youtubeChannelId(html) {
  return html.match(/"(?:channelId|externalId)":"(UC[A-Za-z0-9_-]{22})"/)?.[1]
    || html.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/)?.[1]
    || "";
}

function youtubeShortIds(html) {
  const ids = [];
  const seen = new Set();
  const patterns = [
    /\/shorts\/([A-Za-z0-9_-]{11})/g,
    /"reelWatchEndpoint":\{"videoId":"([A-Za-z0-9_-]{11})"/g
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      if (seen.has(match[1])) continue;
      seen.add(match[1]);
      ids.push(match[1]);
      if (ids.length >= 36) return ids;
    }
  }
  if (!ids.length) {
    for (const match of html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)) {
      if (seen.has(match[1])) continue;
      seen.add(match[1]);
      ids.push(match[1]);
      if (ids.length >= 36) break;
    }
  }
  return ids;
}

function parseYoutubeFeed(xml) {
  const result = new Map();
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1];
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    if (!videoId) continue;
    result.set(videoId, {
      title: decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ""),
      publishedAt: entry.match(/<published>([^<]+)<\/published>/)?.[1] || "",
      description: decodeXml(entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] || "")
    });
  }
  return result;
}

async function fetchYoutubeChannel(channel) {
  const requestOptions = {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "es-ES,es;q=0.9",
      "user-agent": "Mozilla/5.0 AtlasMercaba/3.6"
    },
    signal: AbortSignal.timeout(15000)
  };
  let response;
  try {
    response = await fetch(channel.url, requestOptions);
    if (!response.ok) response = await fetch(channel.url.replace(/\/shorts\/?$/, ""), requestOptions);
  } catch (error) {
    throw new Error(`${channel.name}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${channel.name}: YouTube respondiÃ³ ${response.status}`);
  const html = await response.text();
  const channelId = channel.channelId || youtubeChannelId(html);
  const shortIds = youtubeShortIds(html);
  let feed = new Map();
  if (channelId) {
    try {
      const feedResponse = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
        headers: { accept: "application/atom+xml", "user-agent": "AtlasMercaba/3.6" },
        signal: AbortSignal.timeout(10000)
      });
      if (feedResponse.ok) feed = parseYoutubeFeed(await feedResponse.text());
    } catch {}
  }
  const ids = channel.preferFeed && feed.size ? [...feed.keys()] : (shortIds.length ? shortIds : [...feed.keys()]);
  return ids.slice(0, 30).map(videoId => {
    const metadata = feed.get(videoId) || {};
    const title = metadata.title || `Short reciente de ${channel.name}`;
    return {
      id: `youtube-${videoId}`,
      videoId,
      type: "video",
      source: channel.name,
      author: channel.name,
      title,
      description: plainText(metadata.description).slice(0, 360)
        || `VÃ­deo publicado por ${channel.name}. Se reproduce dentro de Atlas mediante el reproductor oficial de YouTube.`,
      url: `https://www.youtube.com/shorts/${videoId}`,
      image: `https://i.ytimg.com/vi/${videoId}/hq720_2.jpg`,
      libraryId: /josemaria|escriva/.test(normalize(title)) ? "san-josemaria" : "doctrine",
      external: true,
      verified: true,
      dynamic: true,
      tier: channel.tier || "main",
      publishedAt: metadata.publishedAt || ""
    };
  });
}

async function mapConcurrent(items, limit, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try { output[index] = { status: "fulfilled", value: await mapper(items[index]) }; }
      catch (reason) { output[index] = { status: "rejected", reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

async function enrichYoutubeItems(items) {
  return Promise.all(items.map(async item => {
    if (!/^Short reciente de /.test(item.title)) return item;
    if (youtubeMetadataCache.has(item.videoId)) return { ...item, ...youtubeMetadataCache.get(item.videoId) };
    try {
      const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${item.videoId}`)}&format=json`;
      const response = await fetch(endpoint, {
        headers: { accept: "application/json", "user-agent": "AtlasMercaba/3.6" },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) return item;
      const value = await response.json();
      const metadata = {
        title: plainText(value.title) || item.title,
        source: plainText(value.author_name) || item.source,
        author: plainText(value.author_name) || item.author
      };
      youtubeMetadataCache.set(item.videoId, metadata);
      return { ...item, ...metadata };
    } catch {
      return item;
    }
  }));
}

async function refreshYoutubeFeed(force = false) {
  const cached = readYoutubeCache();
  const cacheAge = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  if (!force && cached && cacheAge < youtubeRefreshMs) return { ...cached, channels: youtubeSeedData().channels };
  if (!force && cached?.items?.length) {
    if (!youtubeRefreshPromise) refreshYoutubeFeed(true).catch(() => {});
    return {
      ...cached,
      channels: youtubeSeedData().channels,
      stale: true,
      refreshing: true
    };
  }
  if (youtubeRefreshPromise) return youtubeRefreshPromise;
  youtubeRefreshPromise = (async () => {
    const config = youtubeSeedData();
    const settled = await mapConcurrent(config.channels.filter(channel => channel.enabled !== false), 7, fetchYoutubeChannel);
    const live = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
    const failures = settled.filter(result => result.status === "rejected").map(result => result.reason?.message || "Canal no disponible");
    const merged = [...live, ...youtubeSeedItems()];
    const items = [...new Map(merged.map(item => [item.videoId, item])).values()]
      .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
    if (!live.length && cached?.items?.length) return { ...cached, stale: true, failures };
    const value = {
      updatedAt: new Date().toISOString(),
      source: live.length ? "youtube-channels" : "seed",
      channels: config.channels,
      items,
      failures
    };
    fs.writeFileSync(youtubeCachePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return value;
  })().finally(() => { youtubeRefreshPromise = null; });
  return youtubeRefreshPromise;
}

function readMusicCache() {
  try {
    const value = JSON.parse(fs.readFileSync(musicCachePath, "utf8"));
    return Array.isArray(value.items) ? value : null;
  } catch { return null; }
}

async function refreshMusicFeed(force = false) {
  const cached = readMusicCache();
  const cacheAge = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  if (!force && cached?.items?.length && cached.source === "youtube-cache-fallback") {
    if (!musicRefreshPromise) refreshMusicFeed(true).catch(() => {});
    return { ...cached, channels: musicSeedData().channels, stale: true, refreshing: true };
  }
  if (!force && cached && cacheAge < youtubeRefreshMs) return { ...cached, channels: musicSeedData().channels };
  if (!force && cached?.items?.length) {
    if (!musicRefreshPromise) refreshMusicFeed(true).catch(() => {});
    return { ...cached, channels: musicSeedData().channels, stale: true, refreshing: true };
  }
  if (musicRefreshPromise) return musicRefreshPromise;
  musicRefreshPromise = (async () => {
    const config = musicSeedData();
    const settled = await mapConcurrent(config.channels.filter(channel => channel.enabled !== false), 5, channel => fetchYoutubeChannel({ ...channel, preferFeed: true }));
    const live = settled.flatMap(result => result.status === "fulfilled" ? result.value : [])
      .map(item => ({
        ...item,
        type: "music",
        title: item.title.replace(/^Short reciente de /, "Música de "),
        description: item.description.replace("Vídeo publicado", "Música publicada"),
        url: `https://www.youtube.com/watch?v=${item.videoId}`,
        image: `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`
      }));
    const failures = settled.filter(result => result.status === "rejected").map(result => result.reason?.message || "Canal no disponible");
    if (!live.length && cached?.items?.length) return { ...cached, stale: true, failures };
    const value = {
      updatedAt: new Date().toISOString(),
      source: "youtube-music-channels",
      channels: config.channels,
      items: [...new Map(live.map(item => [item.videoId, item])).values()]
        .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""))),
      failures
    };
    fs.writeFileSync(musicCachePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return value;
  })().finally(() => { musicRefreshPromise = null; });
  return musicRefreshPromise;
}

function instagramSeedData() {
  try { return JSON.parse(fs.readFileSync(instagramConfigPath, "utf8")); }
  catch { return { channels: [] }; }
}

function readInstagramCache() {
  try {
    const value = JSON.parse(fs.readFileSync(instagramCachePath, "utf8"));
    return Array.isArray(value.items) ? value : null;
  } catch { return null; }
}

const decodeInstagram = value => String(value || "")
  .replace(/\\u0026/g, "&").replace(/\\u003d/g, "=").replace(/\\u0025/g, "%")
  .replace(/\\\//g, "/").replace(/\\"/g, '"')
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function instagramHtmlPosts(html, channel) {
  const posts = [];
  const seen = new Set();
  const anchorPattern = /<a\b[^>]*href="\/([^/"?#]+)\/(p|reel)\/([A-Za-z0-9_-]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const [, handle, format, code, block] = match;
    if (seen.has(code)) continue;
    const imageTag = block.match(/<img\b[^>]*>/i)?.[0] || "";
    const image = decodeInstagram(imageTag.match(/\bsrc="([^"]+)"/i)?.[1] || "");
    if (!image) continue;
    const alt = plainText(decodeInstagram(imageTag.match(/\balt="([^"]*)"/i)?.[1] || ""));
    const date = alt.match(/\bon ([A-Z][a-z]+ \d{1,2}, \d{4})\b/)?.[1] || "";
    const description = alt.replace(/^Photo by .*? on .*?\.\s*/i, "").replace(/^Photo by .*?\.\s*/i, "").trim();
    seen.add(code);
    posts.push({
      id: `instagram-${channel.handle}-${code}`, type: "instagram", source: channel.name, author: channel.name,
      title: description ? description.slice(0, 105) : `Publicación de ${channel.name}`,
      description: description || `Publicación reciente de @${channel.handle}.`,
      url: `https://www.instagram.com/${handle}/${format}/${code}/`, image,
      libraryId: "doctrine", external: true, verified: true, publishedAt: date
    });
    if (posts.length >= 18) break;
  }
  return posts;
}

async function fetchInstagramChannel(channel) {
  const response = await fetch(channel.url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "es-ES,es;q=0.9",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
    },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`${channel.name}: Instagram respondió ${response.status}`);
  const html = await response.text();
  const htmlPosts = instagramHtmlPosts(html, channel);
  const codes = [...new Set([
    ...[...html.matchAll(/"shortcode":"([A-Za-z0-9_-]+)"/g)].map(match => match[1]),
    ...[...html.matchAll(/"code":"([A-Za-z0-9_-]{5,})"/g)].map(match => match[1])
  ])].slice(0, 12);
  const profileImage = decodeInstagram(html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || "");
  const profileText = plainText(decodeInstagram(html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] || ""));
  const jsonPosts = codes.map(code => {
    const position = html.indexOf(`"${code}"`);
    const nearby = position >= 0 ? html.slice(Math.max(0, position - 5000), position + 5000) : "";
    const image = decodeInstagram(nearby.match(/"(?:display_url|image_versions2)":(?:"|.*?"url":")(https:[^"]+)/)?.[1] || profileImage);
    const caption = plainText(decodeInstagram(nearby.match(/"(?:caption|text)":"([^"]{8,700})"/)?.[1] || ""));
    return {
      id: `instagram-${channel.handle}-${code}`, type: "instagram", source: channel.name, author: channel.name,
      title: caption ? caption.slice(0, 90) : `Publicación de ${channel.name}`,
      description: caption || profileText || `Publicación reciente de @${channel.handle}.`,
      url: `https://www.instagram.com/p/${code}/`, image, libraryId: "doctrine",
      external: true, verified: true, publishedAt: ""
    };
  });
  return [...new Map([...htmlPosts, ...jsonPosts].map(item => [item.id, item])).values()].slice(0, 18);
}

async function refreshInstagramFeed(force = false) {
  const cached = readInstagramCache();
  const age = cached?.updatedAt ? Date.now() - Date.parse(cached.updatedAt) : Infinity;
  if (!force && cached?.items?.length && age < youtubeRefreshMs) return { ...cached, channels: instagramSeedData().channels };
  if (!force && cached?.items?.length) {
    if (!instagramRefreshPromise) refreshInstagramFeed(true).catch(() => {});
    return { ...cached, channels: instagramSeedData().channels, stale: true, refreshing: true };
  }
  if (instagramRefreshPromise) return instagramRefreshPromise;
  instagramRefreshPromise = (async () => {
    const config = instagramSeedData();
    const settled = await mapConcurrent(config.channels.filter(channel => channel.enabled !== false), 3, fetchInstagramChannel);
    const live = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
    const failures = settled.filter(result => result.status === "rejected").map(result => result.reason?.message || "Cuenta no disponible");
    if (!live.length && cached?.items?.length) return { ...cached, channels: config.channels, stale: true, failures };
    const value = { updatedAt: new Date().toISOString(), source: "instagram-public-pages", channels: config.channels, items: live, failures };
    fs.writeFileSync(instagramCachePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return value;
  })().finally(() => { instagramRefreshPromise = null; });
  return instagramRefreshPromise;
}

function readJsonFile(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

function writeJsonFile(file, value) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
}

function publicHttpUrl(value) {
  const parsed = new URL(String(value || "").trim());
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("El enlace debe comenzar por http:// o https://.");
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || /^127\./.test(host) || /^10\./.test(host)
    || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error("No se permiten direcciones locales o privadas.");
  return parsed;
}

function metaValue(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i")
  ];
  return plainText(decodeXml(patterns.map(pattern => html.match(pattern)?.[1]).find(Boolean) || ""));
}

function youtubeVideoId(value) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    return url.searchParams.get("v") || url.pathname.match(/\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})/)?.[1] || "";
  } catch { return ""; }
}

function inferredLinkType(url, requested = "auto") {
  if (requested && requested !== "auto") return requested;
  const host = url.hostname.toLowerCase();
  const value = `${host}${url.pathname}`.toLowerCase();
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("youtube.com") || host === "youtu.be") return "video";
  if (/opusdei\.org|evangeli|oracion|prayer|meditacion/.test(value)) return "prayer";
  if (/rialp|palabra|eunsa|editorial|libreria|book|libro/.test(value)) return "reading";
  return "news";
}

async function previewManagedLink(input) {
  const parsed = publicHttpUrl(input.url);
  const type = inferredLinkType(parsed, input.type);
  let title = String(input.title || "").trim();
  let description = String(input.description || "").trim();
  let source = String(input.source || "").trim();
  let image = String(input.image || "").trim();
  let author = String(input.author || "").trim();
  const videoId = youtubeVideoId(parsed.href);
  try {
    if (videoId) {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.href)}&format=json`, { signal: AbortSignal.timeout(9000) });
      if (response.ok) {
        const metadata = await response.json();
        title ||= metadata.title || ""; source ||= metadata.author_name || "YouTube";
        author ||= metadata.author_name || ""; image ||= metadata.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }
    } else {
      const response = await fetch(parsed.href, { headers: { "user-agent": "Mozilla/5.0 AtlasMercabaManager/5.1", "accept-language": "es-ES,es;q=0.9" }, signal: AbortSignal.timeout(12000) });
      if (response.ok) {
        const html = await response.text();
        title ||= metaValue(html, "og:title") || plainText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
        description ||= metaValue(html, "og:description") || metaValue(html, "description");
        image ||= metaValue(html, "og:image"); author ||= metaValue(html, "article:author") || metaValue(html, "author");
      }
    }
  } catch {}
  source ||= type === "instagram" ? `@${parsed.pathname.split("/").filter(Boolean)[0] || "instagram"}` : parsed.hostname.replace(/^www\./, "");
  title ||= type === "instagram" ? `Publicación de ${source}` : `Contenido de ${source}`;
  description ||= type === "instagram" ? "Publicación o perfil añadido directamente desde el Gestor de Atlas." : "Enlace añadido desde el Gestor; Atlas volverá a consultar sus metadatos al actualizar proveedores.";
  return {
    id: `${type}-${crypto.createHash("sha1").update(parsed.href).digest("hex").slice(0, 14)}`,
    type, url: parsed.href, title: title.slice(0, 240), description: description.slice(0, 600), source: source.slice(0, 120),
    author: author.slice(0, 120), image, videoId, libraryId: input.libraryId || (type === "music" ? "liturgy" : "doctrine"),
    external: true, verified: true, manual: true
  };
}

function managedLinks() {
  const external = readJsonFile(path.join(contentDir, "external-items.json"), []);
  const youtube = readJsonFile(youtubeConfigPath, { items: [] });
  const music = readJsonFile(musicConfigPath, { items: [] });
  const instagram = readJsonFile(instagramConfigPath, { items: [] });
  return [
    ...external.map((item, index) => ({ ...item, managerStore: "external", managerKey: item.id || item.url || String(index) })),
    ...(youtube.items || []).map((item, index) => ({ ...item, type: "video", url: item.url || `https://www.youtube.com/watch?v=${item.videoId || item.id}`, source: item.source || item.channel, managerStore: "youtube", managerKey: item.videoId || item.id || String(index) })),
    ...(music.items || []).map((item, index) => ({ ...item, type: "music", managerStore: "music", managerKey: item.videoId || item.id || String(index) })),
    ...(instagram.items || []).map((item, index) => ({ ...item, type: "instagram", managerStore: "instagram", managerKey: item.id || item.url || String(index) }))
  ];
}

function saveManagedLink(item) {
  if (item.type === "video") {
    if (!item.videoId) throw new Error("No se ha reconocido un identificador de vídeo de YouTube.");
    const config = readJsonFile(youtubeConfigPath, { channels: [], items: [] }); config.items ||= [];
    if (config.items.some(current => (current.videoId || current.id) === item.videoId)) throw new Error("Ese vídeo ya está incluido.");
    config.items.unshift({ id: item.videoId, videoId: item.videoId, title: item.title, channel: item.source, source: item.source, description: item.description, url: item.url, image: item.image, libraryId: item.libraryId });
    writeJsonFile(youtubeConfigPath, config); return;
  }
  const target = item.type === "music" ? musicConfigPath : item.type === "instagram" ? instagramConfigPath : path.join(contentDir, "external-items.json");
  const config = readJsonFile(target, item.type === "music" || item.type === "instagram" ? { channels: [], items: [] } : []);
  const list = Array.isArray(config) ? config : (config.items ||= []);
  if (list.some(current => current.url === item.url)) throw new Error("Ese enlace ya está incluido.");
  list.unshift(item); writeJsonFile(target, config);
}

function deleteManagedLink(store, key) {
  const target = store === "youtube" ? youtubeConfigPath : store === "music" ? musicConfigPath : store === "instagram" ? instagramConfigPath : path.join(contentDir, "external-items.json");
  const config = readJsonFile(target, store === "external" ? [] : { channels: [], items: [] });
  const list = Array.isArray(config) ? config : (config.items ||= []);
  const filtered = list.filter((item, index) => ![item.id, item.videoId, item.url, String(index)].includes(key));
  if (list.length === filtered.length) throw new Error("No se encontró el elemento que se quería retirar.");
  if (Array.isArray(config)) writeJsonFile(target, filtered); else { config.items = filtered; writeJsonFile(target, config); }
}

async function searchManagedDocuments(query, mode = "metadata", libraryId = "") {
  const clean = String(query || "").trim(); if (clean.length < 2) return [];
  const normalized = normalize(clean); const current = catalog();
  const librariesById = new Map(current.libraries.map(library => [library.id, library]));
  const docs = current.libraries.flatMap(library => library.documents.map(document => ({ ...document, library: library.short })));
  if (mode !== "content") return docs.filter(document => (!libraryId || document.libraryId === libraryId) && normalize(`${document.title} ${document.author || ""} ${document.category} ${document.file}`).includes(normalized)).slice(0, 80);
  const results = []; const needle = clean.toLocaleLowerCase("es");
  for (const document of docs) {
    if (libraryId && document.libraryId !== libraryId) continue;
    const library = librariesById.get(document.libraryId); const file = path.join(workspace, library.folder, document.file);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8"); const lower = content.toLocaleLowerCase("es"); const index = lower.indexOf(needle);
    if (index < 0) continue;
    const start = Math.max(0, index - 100);
    results.push({ ...document, library: library.short, matches: lower.split(needle).length - 1, snippet: plainText(content.slice(start, index + clean.length + 150)) });
    if (results.length >= 60) break;
  }
  return results;
}

function managedExamContent() {
  const catalog = readJsonFile(examNormsPath, { schemaVersion: 1, catalogVersion: "1.0.0", norms: [] });
  const helps = readJsonFile(examHelpsPath, []);
  const sources = readJsonFile(examSourcesPath, { schemaVersion: 1, sources: [] });
  const compiled = readJsonFile(path.join(dataDir, "examen.json"), { stats: {} });
  return { catalog, helps, sources, stats: compiled.stats || {} };
}

function upsertExamNorm(input) {
  const catalog = readJsonFile(examNormsPath, { schemaVersion: 1, catalogVersion: "1.0.0", norms: [] });
  const id = String(input.id || slug(input.name)).replace(/_/g, "-");
  if (!input.name || !id) throw new Error("La norma necesita nombre e identificador.");
  const item = {
    id, name: String(input.name).trim(), description: String(input.description || "").trim(),
    type: input.type || "practice", frequency: input.frequency || { type: "daily" },
    periods: Array.isArray(input.periods) && input.periods.length ? input.periods : ["night"],
    partial: input.partial !== false, tags: Array.isArray(input.tags) ? input.tags : [],
    question: String(input.question || "").trim(), suggestion: String(input.suggestion || "").trim(),
    sourceUrl: String(input.sourceUrl || "").trim() || undefined
  };
  const index = catalog.norms.findIndex(norm => norm.id === id);
  if (index >= 0) catalog.norms.splice(index, 1, item); else catalog.norms.push(item);
  writeJsonFile(examNormsPath, catalog); return item;
}

function upsertExamHelp(input) {
  const helps = readJsonFile(examHelpsPath, []);
  if (!input.text || !input.kind) throw new Error("La ayuda necesita tipo y texto.");
  if (input.kind === "quotation" && (!input.author || !input.work || !input.reference)) throw new Error("Una cita textual exige autor, obra y referencia.");
  const id = input.id || `manual-help-${crypto.createHash("sha1").update(`${input.kind}|${input.text}|${input.reference || ""}`).digest("hex").slice(0, 14)}`;
  const item = { ...input, id, verified: true, tags: input.tags || [], normIds: input.normIds || [] };
  const index = helps.findIndex(help => help.id === id); if (index >= 0) helps.splice(index, 1, item); else helps.unshift(item);
  writeJsonFile(examHelpsPath, helps); return item;
}

function upsertExamSource(input) {
  const value = readJsonFile(examSourcesPath, { schemaVersion: 1, sources: [] });
  if (!input.title || !input.url) throw new Error("La fuente necesita título y URL.");
  publicHttpUrl(input.url);
  const item = { id: input.id || `source-${slug(input.title)}`, title: String(input.title).trim(), kind: input.kind || "external-article", status: "metadata-only", url: new URL(input.url).href, notes: String(input.notes || "").trim() };
  const index = value.sources.findIndex(source => source.id === item.id || source.url === item.url); if (index >= 0) value.sources.splice(index, 1, item); else value.sources.push(item);
  writeJsonFile(examSourcesPath, value); return item;
}

function deleteExamItem(kind, id) {
  if (kind === "norm") {
    const value = readJsonFile(examNormsPath, { norms: [] }); const before = value.norms.length; value.norms = value.norms.filter(item => item.id !== id); if (value.norms.length === before) throw new Error("No se encontró la norma."); writeJsonFile(examNormsPath, value); return;
  }
  if (kind === "help") { const value = readJsonFile(examHelpsPath, []); const filtered = value.filter(item => item.id !== id); if (filtered.length === value.length) throw new Error("No se encontró la ayuda."); writeJsonFile(examHelpsPath, filtered); return; }
  if (kind === "source") { const value = readJsonFile(examSourcesPath, { sources: [] }); const before = value.sources.length; value.sources = value.sources.filter(item => item.id !== id); if (value.sources.length === before) throw new Error("No se encontró la fuente."); writeJsonFile(examSourcesPath, value); return; }
  throw new Error("Tipo de contenido de examen desconocido.");
}

async function api(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/exam-content") return json(res, 200, managedExamContent());
    if (req.method === "POST" && url.pathname === "/api/exam-norms") return json(res, 201, { ok: true, item: upsertExamNorm(await body(req)) });
    if (req.method === "POST" && url.pathname === "/api/exam-helps") return json(res, 201, { ok: true, item: upsertExamHelp(await body(req)) });
    if (req.method === "POST" && url.pathname === "/api/exam-sources") return json(res, 201, { ok: true, item: upsertExamSource(await body(req)) });
    if (req.method === "DELETE" && url.pathname === "/api/exam-content") { const input = await body(req); deleteExamItem(String(input.kind || ""), String(input.id || "")); return json(res, 200, { ok: true }); }
    if (req.method === "GET" && url.pathname === "/api/health") return json(res, 200, { ok: true, version: catalog().meta.dataVersion, managerApi: 3 });
    if (req.method === "GET" && url.pathname === "/api/content-links") return json(res, 200, managedLinks());
    if (req.method === "POST" && url.pathname === "/api/link-preview") return json(res, 200, await previewManagedLink(await body(req)));
    if (req.method === "POST" && url.pathname === "/api/content-links") {
      const item = await previewManagedLink(await body(req));
      saveManagedLink(item);
      return json(res, 201, { ok: true, item });
    }
    if (req.method === "DELETE" && url.pathname === "/api/content-links") {
      const input = await body(req);
      deleteManagedLink(String(input.store || ""), String(input.key || ""));
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/manager-search") {
      return json(res, 200, await searchManagedDocuments(url.searchParams.get("q"), url.searchParams.get("mode"), url.searchParams.get("library")));
    }
    if (req.method === "GET" && url.pathname === "/api/josemaria-quote") {
      const response = await fetch("https://escriva.org/api/v1/random-item/?site_id=2", {
        headers: { accept: "application/json", "user-agent": "AtlasMercaba/3.5" },
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error("La fuente de frases no está disponible");
      const value = await response.json();
      const label = String(value.label || "").trim();
      const title = /^\d+$/.test(label)
        ? `${value.book?.name || "Palabras de san Josemaría"} · ${label}`
        : label || value.book?.name || "Palabras de san Josemaría";
      return json(res, 200, {
        id: `sjm-live-${Date.now()}`, type: "quote", source: "San Josemaría",
        author: "San Josemaría Escrivá", title,
        description: plainText(value.text).slice(0, 620),
        url: value.public_url || new URL(value.url || "/", "https://escriva.org/").href,
        date: "", image: "", live: true
      });
    }
    if (req.method === "GET" && url.pathname === "/api/youtube-shorts") {
      const cursor = Math.max(0, Number(url.searchParams.get("cursor")) || 0);
      const limit = Math.max(6, Math.min(30, Number(url.searchParams.get("limit")) || 18));
      const feed = await refreshYoutubeFeed(url.searchParams.get("refresh") === "1");
      const ordered = randomized(feed.items, url.searchParams.get("seed") || "");
      const items = await enrichYoutubeItems(ordered.slice(cursor, cursor + limit));
      return json(res, 200, {
        items,
        channels: feed.channels || youtubeSeedData().channels,
        cursor,
        nextCursor: cursor + items.length,
        hasMore: cursor + items.length < feed.items.length,
        total: feed.items.length,
        updatedAt: feed.updatedAt,
        source: feed.source,
        stale: Boolean(feed.stale),
        refreshing: Boolean(feed.refreshing),
        failures: feed.failures || []
      });
    }
    if (req.method === "GET" && url.pathname === "/api/music") {
      const cursor = Math.max(0, Number(url.searchParams.get("cursor")) || 0);
      const limit = Math.max(6, Math.min(30, Number(url.searchParams.get("limit")) || 18));
      const feed = await refreshMusicFeed(url.searchParams.get("refresh") === "1");
      const ordered = randomized(feed.items, url.searchParams.get("seed") || "");
      const items = await enrichYoutubeItems(ordered.slice(cursor, cursor + limit));
      return json(res, 200, {
        items, channels: feed.channels || [], cursor,
        nextCursor: cursor + items.length,
        hasMore: cursor + items.length < feed.items.length,
        total: feed.items.length, updatedAt: feed.updatedAt,
        stale: Boolean(feed.stale), refreshing: Boolean(feed.refreshing), failures: feed.failures || []
      });
    }
    if (req.method === "GET" && url.pathname === "/api/instagram-shorts") {
      const cursor = Math.max(0, Number(url.searchParams.get("cursor")) || 0);
      const limit = Math.max(6, Math.min(30, Number(url.searchParams.get("limit")) || 18));
      const feed = await refreshInstagramFeed(url.searchParams.get("refresh") === "1");
      const ordered = randomized(feed.items || [], url.searchParams.get("seed") || "");
      const items = ordered.slice(cursor, cursor + limit);
      return json(res, 200, {
        items, channels: feed.channels || [], cursor, nextCursor: cursor + items.length,
        hasMore: cursor + items.length < ordered.length, total: ordered.length,
        updatedAt: feed.updatedAt, stale: Boolean(feed.stale), refreshing: Boolean(feed.refreshing),
        failures: feed.failures || []
      });
    }
    if (req.method === "GET" && url.pathname === "/api/status") {
      const current = catalog();
      const savedFingerprint = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")).fingerprint : "";
      return json(res, 200, {
        rebuilding, lastBuild, lastError, version: current.meta.dataVersion,
        pendingBuild: fingerprint() !== savedFingerprint,
        sourceRoot: workspace,
        documents: current.meta.documents, words: current.meta.words,
        libraries: current.libraries.map(item => ({ id: item.id, short: item.short, folder: item.folder, documents: item.stats.documents })),
        external: JSON.parse(fs.readFileSync(path.join(dataDir, "external-content.json"), "utf8")).items.length,
        youtube: {
          videos: readYoutubeCache()?.items?.length || youtubeSeedItems().length,
          updatedAt: readYoutubeCache()?.updatedAt || null,
          refreshMinutes: youtubeRefreshMs / 60000
        }
      });
    }
    if (req.method === "GET" && url.pathname === "/api/files") {
      const id = url.searchParams.get("library");
      if (!libraries().some(item => item.id === id)) return json(res, 404, { error: "Biblioteca no encontrada" });
      return json(res, 200, sourceDocuments(id).map(({ canonicalHash, ...item }) => item));
    }
    if (req.method === "GET" && url.pathname === "/api/duplicates") return json(res, 200, duplicateReport());
    if (req.method === "GET" && url.pathname === "/api/audit") {
      const current = catalog();
      const currentDocuments = current.libraries.flatMap(library =>
        library.documents.map(document => ({ ...document, library: library.short }))
      );
      const titleGroups = new Map();
      for (const document of currentDocuments) {
        const key = normalize(document.title);
        titleGroups.set(key, [...(titleGroups.get(key) || []), document]);
      }
      const generatedDir = path.join(dataDir, "documents");
      const generated = fs.existsSync(generatedDir) ? fs.readdirSync(generatedDir).filter(file => file.endsWith(".json.gz")) : [];
      const providerHealthPath = path.join(atlasRoot, "source", "providers", "snapshots", "provider-health.json");
      return json(res, 200, {
        version: current.meta.dataVersion,
        libraries: current.libraries.length,
        catalogDocuments: current.meta.documents,
        sourceDocuments: listSourceFiles().filter(item => isDocumentFile(item.file)).length,
        generatedDocuments: generated.length,
        duplicates: {
          titles: [...titleGroups.values()].filter(group => group.length > 1),
          exact: [],
          exactScanDeferred: true
        },
        pendingBuild: fingerprint() !== (fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")).fingerprint : ""),
        sourceRoot: workspace,
        distReady: fs.existsSync(path.join(atlasRoot, "dist", "build-manifest.json")),
        providers: fs.existsSync(providerHealthPath) ? JSON.parse(fs.readFileSync(providerHealthPath, "utf8")) : null
      });
    }
    if (req.method === "GET" && url.pathname === "/api/libraries") return json(res, 200, libraries());
    if (req.method === "GET" && url.pathname === "/api/providers") {
      return json(res, 200, {
        youtube: JSON.parse(fs.readFileSync(youtubeConfigPath, "utf8")),
        music: JSON.parse(fs.readFileSync(musicConfigPath, "utf8")),
        instagram: JSON.parse(fs.readFileSync(instagramConfigPath, "utf8"))
      });
    }
    if (req.method === "GET" && url.pathname === "/api/shorts") {
      const overrides = JSON.parse(fs.readFileSync(path.join(dataDir, "metadata-overrides.json"), "utf8"));
      return json(res, 200, overrides.editorial?.shorts || []);
    }
    if (req.method === "GET" && url.pathname === "/api/external") return json(res, 200, JSON.parse(fs.readFileSync(path.join(contentDir, "external-items.json"), "utf8")));
    if (req.method === "POST" && url.pathname === "/api/upload") {
      const input = await body(req);
      const stored = storeUpload(input, sourceDocuments());
      return json(res, stored.status, stored);
    }
    if (req.method === "POST" && url.pathname === "/api/upload-batch") {
      const input = await body(req, 100 * 1024 * 1024);
      if (!Array.isArray(input.items) || !input.items.length) return json(res, 400, { error: "No se han recibido archivos." });
      if (input.items.length > 100) return json(res, 400, { error: "El máximo por lote es de 100 archivos." });
      const documents = sourceDocuments();
      const results = [];
      for (const item of input.items) results.push({ originalName: item.originalName, ...storeUpload({ ...item, libraryId: input.libraryId }, documents) });
      const created = results.filter(item => item.ok);
      const rejected = results.filter(item => !item.ok);
      return json(res, created.length ? 201 : 409, { ok: Boolean(created.length), created, rejected });
    }
    if (req.method === "POST" && url.pathname === "/api/delete") {
      const input = await body(req);
      if (input.confirm !== true) return json(res, 400, { error: "Falta confirmación." });
      const { directory } = safeLibrary(input.libraryId);
      const target = safeFile(directory, input.file);
      if (/0000_Indice|Instrucciones_de_personalizacion/i.test(path.basename(target))) return json(res, 403, { error: "Archivo protegido." });
      const trashDir = path.join(atlasRoot, ".atlas-trash", input.libraryId);
      fs.mkdirSync(trashDir, { recursive: true });
      let trashName = path.basename(target);
      if (fs.existsSync(path.join(trashDir, trashName))) trashName = `${Date.now()}-${trashName}`;
      fs.renameSync(target, path.join(trashDir, trashName));
      return json(res, 200, { ok: true, trashed: trashName });
    }
    if (req.method === "POST" && url.pathname === "/api/files/rename") {
      const input = await body(req);
      const { library, directory } = safeLibrary(input.libraryId);
      const source = safeFile(directory, input.file);
      const newTitle = String(input.title || "").trim();
      if (newTitle.length < 2) return json(res, 400, { error: "El nuevo título debe tener al menos dos caracteres." });
      const number = path.basename(source).match(/^(\d{4})/)?.[1] || "0001";
      const fileName = `${number}_${slug(newTitle)}.md`;
      const target = safeFile(directory, fileName);
      if (source !== target && fs.existsSync(target)) return json(res, 409, { error: "Ya existe un archivo con ese nombre." });
      let markdown = fs.readFileSync(source, "utf8");
      if (/^---\s*\r?\n[\s\S]*?\r?\n---/.test(markdown)) {
        if (/^title:\s*.*$/mi.test(markdown)) markdown = markdown.replace(/^title:\s*.*$/mi, `title: "${newTitle.replaceAll('"', '\\"')}"`);
        else markdown = markdown.replace(/^---\s*\r?\n/, `---\ntitle: "${newTitle.replaceAll('"', '\\"')}"\n`);
      }
      const temporary = `${source}.tmp`;
      fs.writeFileSync(temporary, markdown, "utf8");
      fs.renameSync(temporary, source);
      if (source !== target) fs.renameSync(source, target);
      if (fs.existsSync(idRegistryPath)) {
        const registry = JSON.parse(fs.readFileSync(idRegistryPath, "utf8"));
        const oldKey = `${library.folder}/${path.basename(source)}`;
        const newKey = `${library.folder}/${fileName}`;
        if (registry.documents?.[oldKey]) {
          registry.documents[newKey] = registry.documents[oldKey];
          delete registry.documents[oldKey];
          fs.writeFileSync(idRegistryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
        }
      }
      return json(res, 200, { ok: true, file: fileName, title: newTitle });
    }
    if (req.method === "POST" && url.pathname === "/api/libraries") {
      const input = await body(req);
      const registry = libraries();
      const short = String(input.short || "").trim();
      if (short.length < 2) return json(res, 400, { error: "El nombre visible debe tener al menos dos caracteres." });
      const next = Math.max(0, ...registry.map(item => Number(item.folder.match(/^(\d{2})/)?.[1]) || 0)) + 1;
      const id = slug(input.id || short).replaceAll("_", "-");
      if (!id || registry.some(item => item.id === id || normalize(item.short) === normalize(short))) return json(res, 409, { error: "La IA ya existe o el nombre no es válido." });
      const folder = `${String(next).padStart(2, "0")}_IA_${slug(short)}`;
      const entry = {
        id, folder, short, mark: (input.mark || short.slice(0, 1)).toUpperCase().slice(0, 2),
        tone: input.tone || ["amber", "blue", "clay", "violet", "emerald", "rose", "indigo", "gold", "cyan", "olive", "burgundy", "slate"][next % 12],
        notebookUrl: input.notebookUrl || "", description: input.description || `Biblioteca documental ${short}.`
      };
      registry.push(entry);
      writeLibraries(registry);
      fs.mkdirSync(path.join(workspace, folder));
      fs.writeFileSync(path.join(workspace, folder, "0000_Indice_y_mapa_de_fuentes.md"), `# Índice y mapa de fuentes — ${short}\n\n## Finalidad\n\n${entry.description}\n\n## Mapa temático\n\n| Tema | Fuentes principales | Fuentes complementarias |\n|---|---|---|\n\n## Advertencias documentales\n\n## Fuentes incluidas\n`, "utf8");
      return json(res, 201, entry);
    }
    const libraryRoute = url.pathname.match(/^\/api\/libraries\/([^/]+)$/);
    if (libraryRoute && req.method === "PATCH") {
      const id = decodeURIComponent(libraryRoute[1]);
      const input = await body(req);
      const registry = libraries();
      const index = registry.findIndex(item => item.id === id);
      if (index < 0) return json(res, 404, { error: "Biblioteca no encontrada." });
      const short = String(input.short || "").trim();
      if (short.length < 2) return json(res, 400, { error: "El nombre visible debe tener al menos dos caracteres." });
      if (registry.some((item, position) => position !== index && normalize(item.short) === normalize(short))) {
        return json(res, 409, { error: "Ya existe otra IA con ese nombre." });
      }
      const notebookUrl = String(input.notebookUrl || "").trim();
      if (notebookUrl && !/^https?:\/\//i.test(notebookUrl)) return json(res, 400, { error: "El enlace debe comenzar por http:// o https://." });
      const allowedTones = new Set(["amber", "blue", "clay", "violet", "emerald", "rose", "indigo", "gold", "cyan", "olive", "burgundy", "slate"]);
      const updated = {
        ...registry[index],
        short,
        mark: String(input.mark || short[0]).trim().toUpperCase().slice(0, 2),
        tone: allowedTones.has(input.tone) ? input.tone : registry[index].tone,
        notebookUrl,
        description: String(input.description || "").trim() || `Biblioteca documental ${short}.`
      };
      registry[index] = updated;
      writeLibraries(registry);
      return json(res, 200, updated);
    }
    if (libraryRoute && req.method === "DELETE") {
      const id = decodeURIComponent(libraryRoute[1]);
      const input = await body(req);
      const registry = libraries();
      const index = registry.findIndex(item => item.id === id);
      if (index < 0) return json(res, 404, { error: "Biblioteca no encontrada." });
      if (registry.length <= 1) return json(res, 409, { error: "Atlas debe conservar al menos una biblioteca." });
      const entry = registry[index];
      if (input.confirmDelete !== true || normalize(input.confirmName) !== normalize(entry.short)) {
        return json(res, 400, { error: `Escribe exactamente “${entry.short}” para confirmar.` });
      }
      const { directory } = safeLibrary(id);
      const markdownFiles = fs.existsSync(directory) ? fs.readdirSync(directory).filter(file => /\.md$/i.test(file)) : [];
      const sourceFiles = markdownFiles.filter(file => !/^0000_Indice_y_mapa_de_fuentes\.md$/i.test(file));
      if (sourceFiles.length && input.deleteDocuments !== true) {
        return json(res, 409, { error: `La IA contiene ${sourceFiles.length} documentos. Debes autorizar expresamente su eliminación.`, documents: sourceFiles.length });
      }
      if (fs.existsSync(directory)) {
        const libraryTrash = path.join(atlasRoot, ".atlas-trash", "libraries");
        fs.mkdirSync(libraryTrash, { recursive: true });
        let trashTarget = path.join(libraryTrash, entry.folder);
        if (fs.existsSync(trashTarget)) trashTarget = path.join(libraryTrash, `${Date.now()}-${entry.folder}`);
        fs.renameSync(directory, trashTarget);
      }
      registry.splice(index, 1);
      writeLibraries(registry);
      return json(res, 200, { ok: true, removed: entry, documentsDeleted: sourceFiles.length });
    }
    if (req.method === "POST" && url.pathname === "/api/shorts") {
      const input = await body(req);
      const target = path.join(dataDir, "metadata-overrides.json");
      const overrides = JSON.parse(fs.readFileSync(target, "utf8"));
      overrides.editorial ||= {};
      overrides.editorial.shorts = input.items || [];
      fs.writeFileSync(target, JSON.stringify(overrides, null, 2));
      return json(res, 200, { ok: true, count: overrides.editorial.shorts.length });
    }
    if (req.method === "POST" && url.pathname === "/api/external") {
      const input = await body(req);
      fs.writeFileSync(path.join(contentDir, "external-items.json"), JSON.stringify(input.items || [], null, 2));
      return json(res, 200, { ok: true, count: (input.items || []).length });
    }
    if (req.method === "POST" && url.pathname === "/api/providers") {
      const input = await body(req);
      const targets = { youtube: youtubeConfigPath, music: musicConfigPath, instagram: instagramConfigPath };
      for (const [key, target] of Object.entries(targets)) {
        if (!input[key] || !Array.isArray(input[key].channels)) return json(res, 400, { error: `${key}: falta channels` });
        const temporary = `${target}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(input[key], null, 2)}\n`, "utf8");
        fs.renameSync(temporary, target);
      }
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/validate") {
      return json(res, 200, { ok: true, output: await runTool("validate.mjs") });
    }
    if (req.method === "POST" && url.pathname === "/api/rebuild") {
      const input = await body(req);
      return json(res, 200, await rebuild({ force: Boolean(input.force), external: input.external !== false }));
    }
    if (req.method === "POST" && url.pathname === "/api/refresh-external") {
      const output = await runTool("refresh-providers.mjs");
      return json(res, 200, { ok: true, output });
    }
    return json(res, 404, { error: `Ruta del Gestor no disponible: ${req.method} ${url.pathname}. Cierra el Gestor antiguo y vuelve a abrir GESTOR_ATLAS.cmd.` });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  if (url.pathname.startsWith("/api/")) return api(req, res, url);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/gestor" || pathname === "/gestor/") pathname = "/gestor/index.html";
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/index.html" && rebuilding) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="3"><title>Actualizando Atlas</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f2ea;color:#1c211d;font-family:system-ui}.box{text-align:center}.a{width:64px;height:64px;margin:auto;display:grid;place-items:center;border-radius:20px;background:#1c211d;color:white;font:700 32px Georgia}.line{width:220px;height:4px;margin:24px auto;border-radius:9px;background:#d9d5ca;overflow:hidden}.line:after{content:"";display:block;width:45%;height:100%;background:#16604c;animation:x 1.2s infinite alternate}@keyframes x{to{transform:translateX(125%)}}</style><div class="box"><div class="a">A</div><h1>Atlas consulta las carpetas</h1><p>Reconstruyendo la base documental…</p><div class="line"></div></div></html>`);
  }
  const infographicRoot = path.join(workspace, "infografiasfinal");
  const target = pathname.startsWith("/infografias/")
    ? path.resolve(infographicRoot, `.${pathname.slice("/infografias".length)}`)
    : path.resolve(atlasRoot, `.${pathname}`);
  const allowedRoot = pathname.startsWith("/infografias/") ? infographicRoot : atlasRoot;
  if (!target.startsWith(allowedRoot + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); return res.end("No encontrado");
  }
  res.writeHead(200, { "content-type": mime[path.extname(target).toLowerCase()] || "application/octet-stream", "cache-control": "no-cache" });
  fs.createReadStream(target).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Atlas:  http://127.0.0.1:${port}`);
  console.log(`Gestor: http://127.0.0.1:${port}/gestor/`);
  console.log("El catálogo no se reconstruye al iniciar. Usa el botón «Actualizar Atlas» del Gestor.");
});
