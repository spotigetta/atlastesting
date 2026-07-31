import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const atlas = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = name => JSON.parse(fs.readFileSync(path.join(atlas, "content", name), "utf8")).channels || [];
const value = {
  youtube: read("youtube-shorts.json"),
  music: read("youtube-music.json"),
  instagram: read("instagram.json")
};
fs.writeFileSync(path.join(atlas, "data", "channel-catalog.json"), `${JSON.stringify(value, null, 2)}\n`, "utf8");
console.log(`Catálogo de canales: ${value.youtube.length} vídeo, ${value.music.length} música, ${value.instagram.length} Instagram.`);
