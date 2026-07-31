import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const atlasRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = JSON.parse(fs.readFileSync(path.join(atlasRoot, "content", "youtube-shorts.json"), "utf8"));
const items = source.items.map(item => ({
  id: `youtube-${item.id}`,
  videoId: item.id,
  type: "video",
  source: item.channel,
  author: item.channel,
  title: item.title,
  description: "Short de YouTube enlazado desde Atlas. Se reproduce en YouTube y no se almacena localmente.",
  url: `https://www.youtube.com/shorts/${item.id}`,
  image: `https://i.ytimg.com/vi/${item.id}/hq720_2.jpg`,
  libraryId: "san-josemaria",
  external: true,
  verified: true
}));
fs.writeFileSync(path.join(atlasRoot, "data", "youtube-shorts.json"), `${JSON.stringify({ generatedAt:new Date().toISOString(), channels:source.channels, items }, null, 2)}\n`);
console.log(`Atlas YouTube: ${items.length} linked Shorts, 0 downloaded videos.`);
