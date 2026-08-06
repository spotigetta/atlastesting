import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contentDir = path.join(root, "content");
const dataDir = path.join(root, "data");
const read = file => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return {}; }
};
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const stableId = (prefix, value) => `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 14)}`;

const musicConfig = read(path.join(contentDir, "youtube-music.json"));
const musicPath = path.join(dataDir, "youtube-music-cache.json");
const musicSnapshot = read(musicPath);
const manualMusic = (musicConfig.items || []).filter(item => item.videoId).map(item => ({
  ...item,
  id: item.id || `music-${item.videoId}`,
  type: "music",
  source: item.source || item.channel || "Música",
  author: item.author || item.source || item.channel || "Música",
  title: item.title || "Pieza musical",
  description: item.description || "Pieza musical añadida manualmente en el Gestor de Atlas.",
  url: item.url || `https://www.youtube.com/watch?v=${item.videoId}`,
  image: item.image || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
  libraryId: item.libraryId || "liturgy",
  external: true,
  verified: true,
  manual: true
}));
const musicItems = [...new Map([...manualMusic, ...(musicSnapshot.items || [])].map(item => [item.videoId || item.id, item])).values()];
write(musicPath, {
  ...musicSnapshot,
  updatedAt: musicSnapshot.updatedAt || new Date().toISOString(),
  source: musicSnapshot.source || "manual-and-snapshot",
  channels: musicConfig.channels || musicSnapshot.channels || [],
  items: musicItems
});

const instagramConfig = read(path.join(contentDir, "instagram.json"));
const instagramPath = path.join(dataDir, "instagram-cache.json");
const instagramSnapshot = read(instagramPath);
const manualInstagram = (instagramConfig.items || []).filter(item => item.url).map(item => ({
  ...item,
  id: item.id || stableId("instagram", item.url),
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
const profileFallbacks = (instagramConfig.channels || []).filter(channel => channel.enabled !== false).map(channel => ({
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
const instagramItems = [...new Map([
  ...manualInstagram,
  ...(instagramSnapshot.items || []),
  ...profileFallbacks
].map(item => [item.id || item.url, item])).values()];
write(instagramPath, {
  ...instagramSnapshot,
  updatedAt: instagramSnapshot.updatedAt || new Date().toISOString(),
  source: manualInstagram.length ? "manual-and-profiles" : "configured-profiles",
  channels: instagramConfig.channels || [],
  items: instagramItems,
  failures: instagramSnapshot.failures || []
});

console.log(`Contenido manual: ${manualMusic.length} canciones y ${instagramItems.length} tarjetas de Instagram.`);
