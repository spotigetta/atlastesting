import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const atlasRoot = path.resolve(here, "..");
const defaultSource = path.resolve(atlasRoot, "..", "La-Biblia-de-Jerusalen-Project-master", "La-Biblia-de-Jerusalen-Project-master", "La Biblia", "bible-front-end", "data", "bible-static", "es");
const sourceRoot = path.resolve(process.argv.find(value => value.startsWith("--source="))?.slice(9) || defaultSource);
const outputArgument = process.argv.find(value => value.startsWith("--output="))?.slice(9);
const outputRoot = path.resolve(atlasRoot, outputArgument || "data/bible");

const stopwords = new Set("a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era erais eran eras eres es esa esas ese eso esos esta estaba estaban estas este esto estos fue ha hacia hasta hay la las le les lo los mas me mi mis mucha muy no nos o os otra para pero por porque que quien se ser si sin sobre son su sus te tiene todo tras tu tus un una uno unos y ya".split(" "));
const aliasesBySlug = {
  genesis: ["gn", "gen", "genesis"], exodo: ["ex", "exodo"], levitico: ["lv", "lev", "levitico"], numeros: ["nm", "num", "numeros"], deuteronomio: ["dt", "deut", "deuteronomio"],
  josue: ["jos", "josue"], jueces: ["jue", "jueces"], rut: ["rt", "rut"], "libro-primero-de-samuel": ["1 s", "1 sam", "1 samuel", "i samuel"], "libro-segundo-de-samuel": ["2 s", "2 sam", "2 samuel", "ii samuel"],
  "libro-primero-de-los-reyes": ["1 r", "1 re", "1 rey", "1 reyes", "i reyes"], "libro-segundo-de-los-reyes": ["2 r", "2 re", "2 rey", "2 reyes", "ii reyes"], "libro-primero-de-las-cronicas": ["1 cro", "1 cronicas", "i cronicas"], "libro-segundo-de-las-cronicas": ["2 cro", "2 cronicas", "ii cronicas"],
  esdras: ["esd", "esdras"], nehemias: ["neh", "nehemias"], tobias: ["tob", "tobias"], judit: ["jdt", "judit"], ester: ["est", "ester"], "i-macabeos": ["1 mac", "1 macabeos", "i macabeos"], "ii-macabeos": ["2 mac", "2 macabeos", "ii macabeos"],
  job: ["job"], "los-salmos": ["sal", "salmo", "salmos"], proverbios: ["pr", "prov", "proverbios"], eclesiastes: ["qo", "ecl", "eclesiastes", "qohelet"], "cantar-de-los-cantares": ["cant", "ct", "cantar", "cantar de los cantares"], sabiduria: ["sab", "sabiduria"], eclesiastico: ["si", "eclo", "eclesiastico", "siracida"],
  isaias: ["is", "isaias"], jeremias: ["jr", "jer", "jeremias"], lamentaciones: ["lam", "lamentaciones"], baruc: ["bar", "baruc"], ezequiel: ["ez", "ezequiel"], daniel: ["dn", "dan", "daniel"], oseas: ["os", "oseas"], joel: ["jl", "joel"], amos: ["am", "amos"], abdias: ["abd", "abdias"], jonas: ["jon", "jonas"], miqueas: ["miq", "miqueas"], nahum: ["nah", "nahum"], habacuc: ["hab", "habacuc"], sofonias: ["sof", "sofonias"], ageo: ["ag", "ageo"], zacarias: ["zac", "zacarias"], malaquias: ["mal", "malaquias"],
  "evangelio-segun-san-mateo": ["mt", "mateo", "san mateo"], "evangelio-segun-san-marcos": ["mc", "marcos", "san marcos"], "evangelio-segun-san-lucas": ["lc", "lucas", "san lucas"], "evangelio-segun-san-juan": ["jn", "juan", "san juan"], "hechos-de-los-apostoles": ["hch", "hechos", "hechos de los apostoles"],
  "epistola-a-los-romanos": ["rom", "rm", "romanos"], "primera-epistola-a-los-corintios": ["1 cor", "1 corintios", "i corintios"], "segunda-epistola-a-los-corintios": ["2 cor", "2 corintios", "ii corintios"], "epistola-a-los-galatas": ["gal", "galatas"], "epistola-a-los-efesios": ["ef", "efesios"], "epistola-a-los-filipenses": ["flp", "fil", "filipenses"], "epistola-a-los-colosenses": ["col", "colosenses"],
  "primera-epistola-a-los-tesalonicenses": ["1 tes", "1 tesalonicenses", "i tesalonicenses"], "segunda-epistola-a-los-tesalonicenses": ["2 tes", "2 tesalonicenses", "ii tesalonicenses"], "primera-epistola-a-timoteo": ["1 tim", "1 timoteo", "i timoteo"], "segunda-epistola-a-timoteo": ["2 tim", "2 timoteo", "ii timoteo"], "epistola-a-tito": ["tit", "tito"], "epistola-a-filemon": ["flm", "filemon"], "epistola-a-los-hebreos": ["heb", "hebreos"],
  "epistola-de-santiago": ["st", "sant", "santiago"], "primera-epistola-de-san-pedro": ["1 pe", "1 pedro", "i pedro"], "segunda-epistola-de-san-pedro": ["2 pe", "2 pedro", "ii pedro"], "primera-epistola-de-san-juan": ["1 jn", "1 juan", "i juan"], "segunda-epistola-de-san-juan": ["2 jn", "2 juan", "ii juan"], "tercera-epistola-de-san-juan": ["3 jn", "3 juan", "iii juan"], "epistola-de-san-judas": ["jud", "judas"], apocalipsis: ["ap", "apoc", "apocalipsis"]
};

const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9ñ]+/g, " ").trim();
const tokenize = value => [...new Set(normalize(value).split(/\s+/).filter(token => token.length > 2 && !stopwords.has(token)))];
const prettyName = value => String(value || "").toLocaleLowerCase("es").replace(/(^|\s)(\p{L})/gu, (_, lead, letter) => lead + letter.toLocaleUpperCase("es"));

await fs.mkdir(path.join(outputRoot, "books"), { recursive: true });
const sourceManifest = JSON.parse(await fs.readFile(path.join(sourceRoot, "manifest.json"), "utf8"));
if (!Array.isArray(sourceManifest.books) || sourceManifest.books.length !== 73) throw new Error(`Se esperaban 73 libros y se encontraron ${sourceManifest.books?.length || 0}.`);

const refs = [];
const terms = new Map();
const books = [];
const bookPayloads = new Map();
let chapterCount = 0;
let verseCount = 0;
let wordCount = 0;

for (let bookIndex = 0; bookIndex < sourceManifest.books.length; bookIndex += 1) {
  const meta = sourceManifest.books[bookIndex];
  const sourceBook = JSON.parse(await fs.readFile(path.join(sourceRoot, "books", `${meta.slug}.json`), "utf8"));
  const aliases = aliasesBySlug[meta.slug] || [normalize(meta.nameEs)];
  const book = {
    testament: Number(sourceBook.testament), order: Number(sourceBook.order), slug: sourceBook.slug,
    name: prettyName(sourceBook.nameEs), category: meta.category, aliases,
    chapters: sourceBook.chapters.map(chapter => ({
      number: Number(chapter.number),
      verses: chapter.verses.map(verse => ({ number: Number(verse.verseNumber), text: String(verse.text).trim() }))
    }))
  };
  if (!book.chapters.length || book.chapters.some(chapter => !chapter.verses.length)) throw new Error(`Libro incompleto: ${book.slug}`);
  books.push({ testament: book.testament, order: book.order, slug: book.slug, name: book.name, category: book.category, aliases, chapterCount: book.chapters.length, verseCount: book.chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0), file: `data/bible/books/${book.slug}.json` });
  bookPayloads.set(book.slug, book);
  chapterCount += book.chapters.length;
  for (const chapter of book.chapters) {
    for (const verse of chapter.verses) {
      const verseId = refs.length;
      refs.push([bookIndex, chapter.number, verse.number]);
      verseCount += 1;
      wordCount += String(verse.text).split(/\s+/).filter(Boolean).length;
      for (const term of tokenize(verse.text)) {
        if (!terms.has(term)) terms.set(term, []);
        terms.get(term).push(verseId);
      }
    }
  }
  await fs.writeFile(path.join(outputRoot, "books", `${book.slug}.json`), JSON.stringify(book), "utf8");
}

const aliasMap = {};
books.forEach((book, index) => book.aliases.forEach(alias => { aliasMap[normalize(alias)] = index; }));
const manifest = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), translation: { name: "Biblia de Jerusalén", abbreviation: "BJ1976", edition: "1976", language: "es" },
  stats: { books: books.length, chapters: chapterCount, verses: verseCount, words: wordCount }, books, aliasMap
};
await fs.writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

const indexPayload = { schemaVersion: 1, refs, terms: Object.fromEntries([...terms.entries()].sort(([a], [b]) => a.localeCompare(b, "es"))) };
await fs.writeFile(path.join(outputRoot, "search-index.json.gz"), gzipSync(Buffer.from(JSON.stringify(indexPayload)), { level: 9 }));

const topicsSource = JSON.parse(await fs.readFile(path.join(here, "bible-topics.json"), "utf8"));
function parseReference(input) {
  const match = normalize(input).match(/^(.+?)\s+(\d+)\s+(\d+)(?:\s+(\d+))?$/);
  if (!match) return null;
  const bookIndex = aliasMap[match[1]];
  if (!Number.isInteger(bookIndex)) return null;
  return { bookIndex, chapter: Number(match[2]), start: Number(match[3]), end: Number(match[4] || match[3]) };
}
for (const topic of topicsSource.topics) {
  topic.passages = topic.references.map(reference => {
    const parsed = parseReference(reference);
    if (!parsed) throw new Error(`Referencia temática no reconocida: ${reference}`);
    const book = books[parsed.bookIndex];
    const chapter = bookPayloads.get(book.slug).chapters.find(item => item.number === parsed.chapter);
    if (!chapter || !chapter.verses.some(item => item.number === parsed.start) || !chapter.verses.some(item => item.number === parsed.end)) throw new Error(`Referencia temática fuera de rango: ${reference}`);
    return { book: book.slug, chapter: parsed.chapter, start: parsed.start, end: parsed.end };
  });
  delete topic.references;
}
await fs.writeFile(path.join(outputRoot, "topics.json"), JSON.stringify(topicsSource, null, 2) + "\n", "utf8");

console.log(`Biblia construida: ${books.length} libros, ${chapterCount} capítulos, ${verseCount} versículos, ${wordCount} palabras, ${terms.size} términos.`);
