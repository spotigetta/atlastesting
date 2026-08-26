import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

// Construye los ficheros públicos de la edición oficial CEE a partir de las
// páginas de cada libro. El origen de cada libro queda anotado en su JSON.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const sourceRoot = "https://www.conferenciaepiscopal.es/biblia/";
const outputRoot = path.join(root, "data", "bible");
const jerusalemRoot = path.join(root, "data", "bible-jerusalem");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stopwords = new Set("a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era erais eran eras eres es esa esas ese eso esos esta estaba estaban estas este esto fue ha hacia hasta hay la las le les lo los mas me mi mis mucha muy no nos o os otra para pero por porque que quien se ser si sin sobre son su sus te tiene todo tras tu tus un una uno unos y ya".split(" "));

function decode(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&laquo;/gi, "«").replace(/&raquo;/gi, "»").replace(/&ndash;/gi, "–").replace(/&mdash;/gi, "—")
    .replace(/&amp;/gi, "&").replace(/&([a-z]+);/gi, (_, entity) => ({ aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ordm: "º", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’" }[entity] || `&${entity};`))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, " ").trim();
}
const normalize = value => decode(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9ñ]+/g, " ").trim();
const tokenize = value => [...new Set(normalize(value).split(/\s+/).filter(token => token.length > 2 && !stopwords.has(token)))];

function sourceSlugByBook() {
  return new Map([
    ["genesis", "genesis"], ["exodo", "exodo"], ["levitico", "levitico"], ["numeros", "numeros"], ["deuteronomio", "deuteronomio"], ["josue", "josue"], ["jueces", "jueces"], ["rut", "rut"],
    ["libro-primero-de-samuel", "1-samuel"], ["libro-segundo-de-samuel", "2-samuel"], ["libro-primero-de-los-reyes", "1-reyes"], ["libro-segundo-de-los-reyes", "2-reyes"], ["libro-primero-de-las-cronicas", "1-cronicas"], ["libro-segundo-de-las-cronicas", "2-cronicas"],
    ["esdras", "esdras"], ["nehemias", "nehemias"], ["tobias", "tobias"], ["judit", "judit"], ["ester", "ester"], ["i-macabeos", "1-macabeos"], ["ii-macabeos", "2-macabeos"], ["job", "job"], ["los-salmos", "salmos"], ["proverbios", "proverbios"], ["eclesiastes", "eclesiastes"], ["cantar-de-los-cantares", "cantar-de-los-cantares"], ["sabiduria", "sabiduria"], ["eclesiastico", "eclesiastico"],
    ["isaias", "isaias"], ["jeremias", "jeremias"], ["lamentaciones", "lamentaciones"], ["baruc", "baruc"], ["ezequiel", "ezequiel"], ["daniel", "daniel"], ["oseas", "oseas"], ["joel", "joel"], ["amos", "amos"], ["abdias", "abdias"], ["jonas", "jonas"], ["miqueas", "miqueas"], ["nahum", "nahun"], ["habacuc", "habacuc"], ["sofonias", "sofonias"], ["ageo", "ageo"], ["zacarias", "zacarias"], ["malaquias", "malaquias"],
    ["evangelio-segun-san-mateo", "mateo"], ["evangelio-segun-san-marcos", "marcos"], ["evangelio-segun-san-lucas", "lucas"], ["evangelio-segun-san-juan", "juan"], ["hechos-de-los-apostoles", "hechos-de-los-apostoles"], ["epistola-a-los-romanos", "romanos"], ["primera-epistola-a-los-corintios", "1-corintios"], ["segunda-epistola-a-los-corintios", "2-corintios"], ["epistola-a-los-galatas", "galatas"], ["epistola-a-los-efesios", "efesios"], ["epistola-a-los-filipenses", "filipenses"], ["epistola-a-los-colosenses", "colosenses"], ["primera-epistola-a-los-tesalonicenses", "1-tesalonicenses"], ["segunda-epistola-a-los-tesalonicenses", "2-tesalonicenses"], ["primera-epistola-a-timoteo", "1-timoteo"], ["segunda-epistola-a-timoteo", "2-timoteo"], ["epistola-a-tito", "tito"], ["epistola-a-filemon", "filemon"], ["epistola-a-los-hebreos", "hebreos"], ["epistola-de-santiago", "santiago"], ["primera-epistola-de-san-pedro", "1-pedro"], ["segunda-epistola-de-san-pedro", "2-pedro"], ["epistola-de-san-judas", "judas"], ["apocalipsis", "apocalipsis"]
  ]);
}

function extractChapters(html, url) {
  // Algunos capítulos contienen divs internos. Separamos por el inicio del
  // siguiente capítulo, no por el primer cierre de div que aparezca.
  const starts = [...html.matchAll(/<div\s+class=["']capitulo["'][^>]*>/gi)];
  const chapters = starts.map((match, index) => {
    const body = html.slice(match.index + match[0].length, starts[index + 1]?.index ?? html.length);
    const number = Number(body.match(/class=["']numcap["'][^>]*>\s*(\d+)/i)?.[1] || index + 1);
    const verses = [...body.matchAll(/<span\s+class=["']numvers["'][^>]*>([\s\S]*?)<\/span>\s*<span\s+class=["']contenido["'][^>]*>([\s\S]*?)<\/span>/gi)]
      .map(item => ({ number: Number(decode(item[1])), text: decode(item[2]) })).filter(item => item.number && item.text);
    return { number, verses };
  }).filter(chapter => chapter.verses.length);
  if (!chapters.length) throw new Error(`No se hallaron capítulos en ${url}`);
  return chapters;
}

async function fetchPage(slug) {
  const url = new URL(`${slug}/`, sourceRoot).href;
  const response = await fetch(url, { headers: { "User-Agent": "Atlas-Mercaba Bible importer (local build)" } });
  if (!response.ok) throw new Error(`${response.status} al leer ${url}`);
  return { url, html: await response.text() };
}

await fs.mkdir(path.join(outputRoot, "books"), { recursive: true });
const oldManifest = JSON.parse(await fs.readFile(path.join(jerusalemRoot, "manifest.json"), "utf8"));
const sourceSlugs = sourceSlugByBook();
const refs = [], terms = new Map(), books = [];
let chapterCount = 0, verseCount = 0, wordCount = 0;
const sharedLetters = await fetchPage("juan-cartas-1-3");

for (let index = 0; index < oldManifest.books.length; index += 1) {
  const inherited = oldManifest.books[index];
  let chapters, sourceUrl;
  if (["primera-epistola-de-san-juan", "segunda-epistola-de-san-juan", "tercera-epistola-de-san-juan"].includes(inherited.slug)) {
    const all = extractChapters(sharedLetters.html, sharedLetters.url);
    const expected = inherited.chapterCount;
    const start = inherited.slug.startsWith("primera") ? 0 : inherited.slug.startsWith("segunda") ? 5 : 6;
    chapters = all.slice(start, start + expected).map((chapter, chapterIndex) => ({ ...chapter, number: chapterIndex + 1 }));
    sourceUrl = sharedLetters.url;
  } else {
    const sourceSlug = sourceSlugs.get(inherited.slug);
    if (!sourceSlug) throw new Error(`Falta el mapa CEE de ${inherited.slug}`);
    const page = await fetchPage(sourceSlug); sourceUrl = page.url; chapters = extractChapters(page.html, sourceUrl);
  }
  // La edición CEE une los salmos 9 y 10 en su presentación web: después de
  // 9 aparece 11 (10). Se conserva exactamente la numeración de la fuente.
  const validChapterCounts = inherited.slug === "los-salmos" ? [148, 149, 150] : [inherited.chapterCount];
  if (!validChapterCounts.includes(chapters.length)) throw new Error(`${inherited.name}: CEE ${chapters.length} capítulos, esperados ${inherited.chapterCount}.`);
  const book = { testament: inherited.testament, order: inherited.order, slug: inherited.slug, name: inherited.name, category: inherited.category, aliases: inherited.aliases, sourceUrl, chapters };
  const totalVerses = chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0);
  books.push({ testament: book.testament, order: book.order, slug: book.slug, name: book.name, category: book.category, aliases: book.aliases, chapterCount: chapters.length, verseCount: totalVerses, file: `data/bible/books/${book.slug}.json`, sourceUrl });
  chapterCount += chapters.length;
  for (const chapter of chapters) for (const verse of chapter.verses) {
    const verseId = refs.length; refs.push([index, chapter.number, verse.number]); verseCount += 1; wordCount += verse.text.split(/\s+/).filter(Boolean).length;
    for (const term of tokenize(verse.text)) { if (!terms.has(term)) terms.set(term, []); terms.get(term).push(verseId); }
  }
  await fs.writeFile(path.join(outputRoot, "books", `${book.slug}.json`), JSON.stringify(book), "utf8");
  console.log(`${String(index + 1).padStart(2, "0")}/73 ${book.name}: ${totalVerses} versículos`);
  await sleep(120);
}
const aliasMap = {}; books.forEach((book, index) => book.aliases.forEach(alias => { aliasMap[normalize(alias)] = index; }));
const manifest = { schemaVersion: 2, generatedAt: new Date().toISOString(), translation: { name: "Sagrada Biblia. Versión oficial de la Conferencia Episcopal Española", abbreviation: "CEE", edition: "2010", language: "es", sourceUrl: sourceRoot }, stats: { books: books.length, chapters: chapterCount, verses: verseCount, words: wordCount }, books, aliasMap };
await fs.writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
const indexPayload = { schemaVersion: 1, refs, terms: Object.fromEntries([...terms.entries()].sort(([a], [b]) => a.localeCompare(b, "es"))) };
await fs.writeFile(path.join(outputRoot, "search-index.json.gz"), gzipSync(Buffer.from(JSON.stringify(indexPayload)), { level: 9 }));
const topics = JSON.parse(await fs.readFile(path.join(jerusalemRoot, "topics.json"), "utf8"));
await fs.writeFile(path.join(outputRoot, "topics.json"), JSON.stringify(topics, null, 2) + "\n", "utf8");
console.log(`CEE lista: ${books.length} libros, ${chapterCount} capítulos y ${verseCount} versículos.`);
