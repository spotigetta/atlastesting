import { readFile, writeFile } from "node:fs/promises";

const FEED = "https://www.spreaker.com/show/3226894/episodes/feed";
const OUTPUT = new URL("../data/ten-minutes-daily.json", import.meta.url);
const decode = value => String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const field = (xml, name) => decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]);
const attr = (xml, tag, name) => xml.match(new RegExp(`<${tag}[^>]*\\s${name}=["']([^"']+)["']`, "i"))?.[1] || "";

async function main() {
  const response = await fetch(FEED, { headers: { "user-agent": "Atlas-Mercaba/5.8" } });
  if (!response.ok) throw new Error(`RSS ${response.status}`);
  const xml = await response.text();
  const episodes = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 20).map(([, item]) => ({
    title: field(item, "title"),
    publishedAt: new Date(field(item, "pubDate")).toISOString(),
    description: field(item, "description").slice(0, 360),
    pageUrl: field(item, "link") || field(item, "guid") || "https://www.10minutosconjesus.org/",
    audioUrl: attr(item, "enclosure", "url"),
    duration: field(item, "itunes:duration")
  })).filter(item => item.title && item.pageUrl);
  if (!episodes.length) throw new Error("El RSS no devolvió episodios");
  const payload = { updatedAt: new Date().toISOString(), source: FEED, episodes };
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`10 Minutos con Jesús: ${episodes.length} episodios actualizados.`);
}

main().catch(async error => {
  const previous = JSON.parse(await readFile(OUTPUT, "utf8"));
  console.error(`No se actualizó el feed; se conserva ${previous.updatedAt}: ${error.message}`);
  process.exitCode = 1;
});
