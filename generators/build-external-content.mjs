import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const atlasRoot = path.dirname(here);
const source = JSON.parse(fs.readFileSync(path.join(atlasRoot, "content", "external-items.json"), "utf8"));
const prayerPath = path.join(atlasRoot, "content", "prayer-series.json");
const prayerItems = fs.existsSync(prayerPath) ? JSON.parse(fs.readFileSync(prayerPath, "utf8")) : [];
const feedsPath = path.join(atlasRoot, "content", "external-feeds.json");
const feeds = fs.existsSync(feedsPath) ? JSON.parse(fs.readFileSync(feedsPath, "utf8")) : [];
const previousPath = path.join(atlasRoot, "data", "external-content.json");
const previousItems = fs.existsSync(previousPath)
  ? JSON.parse(fs.readFileSync(previousPath, "utf8")).items || []
  : [];
const previousByUrl = new Map(previousItems.map(item => [item.url, item]));

function decode(value = "") {
  return value.replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).trim();
}

function meta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i")
  ];
  return decode(patterns.map(pattern => html.match(pattern)?.[1]).find(Boolean) || "");
}

function usableImage(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.hostname === "images.opusdei.net" && url.searchParams.get("url")) return url.searchParams.get("url");
    return value;
  } catch {
    return value;
  }
}

async function enrich(item) {
  try {
    const response = await fetch(item.url, { headers: { "user-agent": "AtlasMercaba/3.1 (+editorial metadata reader)", "accept-language": "es" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(String(response.status));
    const html = await response.text();
    return {
      ...item,
      title: meta(html, "og:title") || item.title,
      description: meta(html, "og:description") || meta(html, "description") || item.description,
      image: usableImage(meta(html, "og:image") || item.image || ""),
      author: meta(html, "article:author") || meta(html, "author") || item.author || "",
      date: (meta(html, "article:published_time") || item.date || "").slice(0, 10),
      fetched: true
    };
  } catch {
    const previous = previousByUrl.get(item.url) || {};
    return {
      ...previous, ...item,
      image: item.image || previous.image || "",
      author: item.author || previous.author || "",
      date: item.date || previous.date || "",
      fetched: false
    };
  }
}

function xmlText(value = "") {
  return decode(value.replace(/^<!\[CDATA\[|\]\]>$/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function attribute(block, name) {
  const match = block.match(new RegExp(`\\b${name}=(?:["']([^"']*)["']|([^\\s>]+))`, "i"));
  return decode(match?.[1] || match?.[2] || "");
}

function resolveUrl(base, value) {
  try { return new URL(value, base).href; } catch { return ""; }
}

function htmlText(block = "") {
  return decode(block.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = crypto.randomInt(index + 1);
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

function tag(block, name) {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "";
}

async function discoverFeed(feed) {
  try {
    const response = await fetch(feed.url, { headers: { "user-agent": "AtlasMercaba/3.2", accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(String(response.status));
    const xml = await response.text();
    const candidates = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match => {
      const block = match[1];
      const url = xmlText(tag(block, "link")) || block.match(/<link>(https?:\/\/[^<\s]+)/i)?.[1] || "";
      return {
        type: feed.type, source: feed.source, url,
        title: xmlText(tag(block, "title")),
        description: xmlText(tag(block, "description")).slice(0, 320),
        author: xmlText(tag(block, "dc:creator")),
        date: tag(block, "pubDate") ? new Date(xmlText(tag(block, "pubDate"))).toISOString().slice(0, 10) : ""
      };
    }).filter(item => /^https?:\/\//.test(item.url));
    return shuffle(candidates).slice(0, Number(feed.take) || 3);
  } catch {
    return [];
  }
}

async function discoverHtml(feed) {
  try {
    const response = await fetch(feed.url, { headers: { "user-agent": "AtlasMercaba/3.3", "accept-language": "es" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(String(response.status));
    const html = await response.text();
    let candidates = [];
    if (feed.kind === "omnes-resources") {
      candidates = [...html.matchAll(/<article\b[^>]*class=["'][^"']*\bnoticia\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)].map(match => {
        const block = match[1];
        const anchor = block.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1] || "";
        return {
          type: "news", source: feed.source, url: resolveUrl(feed.url, anchor),
          title: htmlText(block.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ""),
          description: htmlText(block.match(/<span\b[^>]*class=["'][^"']*categoria[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || "Recursos"),
          author: htmlText(block.match(/<span\b[^>]*class=["'][^"']*autor[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || ""),
          date: htmlText(block.match(/<span\b[^>]*class=["'][^"']*fecha[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || "")
        };
      });
    }
    if (feed.kind === "rialp-books") {
      candidates = [...html.matchAll(/<li\b[^>]*class=["'][^"']*\bbook\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)].map(match => {
        const block = match[1];
        const cover = block.match(/<img\b[^>]*class=["'][^"']*book-cover[^"']*["'][^>]*>/i)?.[0] || "";
        const titleBlock = block.match(/<h4\b[^>]*class=["'][^"']*book-title[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1] || "";
        const href = titleBlock.match(/href=["']([^"']+)["']/i)?.[1] || block.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1] || "";
        return {
          type: "books", source: feed.source, url: resolveUrl(feed.url, href),
          title: htmlText(titleBlock), author: htmlText(block.match(/class=["'][^"']*book-author[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] || ""),
          description: htmlText(block.match(/class=["'][^"']*book-synopsis[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || ""),
          image: resolveUrl(feed.url, attribute(cover, "src") || attribute(cover, "data-src"))
        };
      });
    }
    if (feed.kind === "palabra-books") {
      candidates = [...html.matchAll(/<div\b[^>]*class=(?:["'][^"']*carrusel-book[^"']*["']|carrusel-book)[^>]*>([\s\S]*?)<\/div>/gi)].map(match => {
        const block = match[1];
        const anchorTag = block.match(/<a\b[^>]*>/i)?.[0] || "";
        const href = attribute(anchorTag, "href");
        const imageTag = block.match(/<img\b[^>]*class=(?:["'][^"']*book-cover[^"']*["']|book-cover)[^>]*>/i)?.[0] || "";
        return {
          type: "books", source: feed.source, url: resolveUrl(feed.url, href),
          title: htmlText(block.match(/class=(?:["'][^"']*book-title[^"']*["']|book-title)[^>]*>([\s\S]*?)<\//i)?.[1] || attribute(imageTag, "alt")),
          author: htmlText(block.match(/class=(?:["'][^"']*book-author[^"']*["']|book-author)[^>]*>([\s\S]*?)<\//i)?.[1] || ""),
          description: "Novedad editorial seleccionada por Atlas.",
          image: resolveUrl(feed.url, attribute(imageTag, "src") || attribute(imageTag, "data-src"))
        };
      });
    }
    if (feed.kind === "eunsa-books") {
      candidates = [...html.matchAll(/<li\b[^>]*class=["'][^"']*\blslide\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)].map(match => {
        const block = match[1];
        const href = block.match(/<a\b[^>]*href=["']([^"']*\/libro\/[^"']+)["']/i)?.[1] || "";
        const imageTag = block.match(/<img\b[^>]*class=["'][^"']*book-cover[^"']*["'][^>]*>/i)?.[0] || "";
        return {
          type: "books", source: feed.source, url: resolveUrl(feed.url, href),
          title: htmlText(block.match(/<span\b[^>]*class=["']title["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || attribute(imageTag, "alt")),
          author: htmlText(block.match(/<span\b[^>]*class=["']author["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || block.match(/class=["'][^"']*book-author[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] || ""),
          description: htmlText(block.match(/<span\b[^>]*class=["']synopsis["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || "Novedad editorial de EUNSA."),
          image: resolveUrl(feed.url, attribute(imageTag, "src") || attribute(imageTag, "data-src"))
        };
      });
    }
    if (feed.kind === "encuentro-books") {
      candidates = [...html.matchAll(/<div\b[^>]*class=["'][^"']*recp_libro_destacado[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?=<div\b[^>]*class=["'][^"']*(?:recp_libro_destacado|vermasdestacado))/gi)].map(match => {
        const block = match[1];
        const anchor = block.match(/<a\b[^>]*class=["'][^"']*titulodestacado[^"']*["'][^>]*>/i)?.[0] || "";
        const imageTag = block.match(/<img\b[^>]*class=["'][^"']*wp-post-image[^"']*["'][^>]*>/i)?.[0] || "";
        return {
          type: "books", source: feed.source, url: resolveUrl(feed.url, attribute(anchor, "href")),
          title: htmlText(block.match(/class=["'][^"']*titulodestacado[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || attribute(anchor, "title")),
          author: htmlText(block.match(/class=["'][^"']*autordestacado[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || ""),
          description: htmlText(block.match(/class=["'][^"']*infonovedad[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "Novedad de Ediciones Encuentro.").slice(0, 320),
          image: resolveUrl(feed.url, attribute(imageTag, "src"))
        };
      });
    }
    return shuffle(candidates.filter(item => item.title && /^https?:\/\//.test(item.url))).slice(0, Number(feed.take) || 4);
  } catch {
    return [];
  }
}

async function discoverEscriva(feed) {
  const take = Number(feed.take) || 5;
  const items = new Map();
  for (let index = 0; index < take * 4 && items.size < take; index += 1) {
    try {
      const response = await fetch(feed.url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) continue;
      const value = await response.json();
      const url = value.public_url || resolveUrl("https://escriva.org/", value.url);
      if (!value.text || !url) continue;
      items.set(url, {
        type: "quote", source: "San Josemaría", url,
        title: value.label || value.book?.name || "Palabras de san Josemaría",
        description: htmlText(value.text).slice(0, 520),
        author: "San Josemaría Escrivá", date: "", image: ""
      });
    } catch {}
  }
  return [...items.values()];
}

const discovered = [];
for (const feed of feeds) {
  if (feed.kind === "escriva-random") discovered.push(...await discoverEscriva(feed));
  else if (feed.kind) discovered.push(...await discoverHtml(feed));
  else discovered.push(...await discoverFeed(feed));
}
const uniqueSource = [...new Map([...discovered, ...prayerItems, ...source].map(item => [item.url, item])).values()];
const items = [];
for (let offset = 0; offset < uniqueSource.length; offset += 6) {
  const batch = uniqueSource.slice(offset, offset + 6);
  const enrichedBatch = await Promise.all(batch.map(enrich));
  enrichedBatch.forEach((enriched, index) => {
    const item = batch[index];
    items.push({ id: `external-${crypto.createHash("sha1").update(item.url).digest("hex").slice(0, 12)}`, ...enriched });
  });
}
const payload = { generatedAt: new Date().toISOString(), items };
fs.writeFileSync(path.join(atlasRoot, "data", "external-content.json"), JSON.stringify(payload, null, 2));
console.log(`External content: ${items.length} cards, ${items.filter(item => item.image).length} images, ${items.filter(item => item.fetched).length} fetched.`);
