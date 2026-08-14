/** Sincroniza en el lector de Atlas los Markdown modificados por la auditoría. */
import { readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";

const atlasRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspace = dirname(atlasRoot);
const catalog = JSON.parse(await readFile(join(atlasRoot, "data", "catalog.json"), "utf8"));
const reportArg = process.argv[2];
if (!reportArg) throw new Error("Uso: node tools/sync-normalized-markdown.mjs <informe-apply.json>");
const reportPath = normalize(join(workspace, reportArg));
const report = JSON.parse(await readFile(reportPath, "utf8"));
if (report.mode !== "apply") throw new Error("El informe debe proceder de una aplicación, no de un dry-run.");

const slug = value => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "seccion";

function splitDocument(markdown, targetSize = 90000) {
  const lines = markdown.split(/\r?\n/), chunks = [], toc = [], used = new Map();
  let current = [], size = 0, chunkIndex = 0;
  const flush = () => { if (!current.length) return; chunks.push({ index: chunks.length, markdown: current.join("\n") }); current=[]; size=0; chunkIndex=chunks.length; };
  for (const line of lines) {
    const heading=line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      if (size >= targetSize * .55) flush();
      const base=slug(heading[2]), count=used.get(base)||0; used.set(base,count+1);
      toc.push({ level:heading[1].length, title:heading[2].trim(), anchor:count?`${base}-${count+1}`:base, chunkIndex });
    } else if (size >= targetSize && /^\s*$/.test(line)) flush();
    current.push(line); size += line.length + 1;
  }
  flush(); return { chunks, toc };
}

const changed = new Set((report.files || []).map(item => String(item.path).split("/").join(sep)));
const mappings = new Map();
for (const library of catalog.libraries || []) for (const document of library.documents || []) {
  mappings.set(join(library.folder, document.file), { library, document });
}

let synced=0, unmapped=[];
for (const sourceRelative of changed) {
  const mapped=mappings.get(sourceRelative);
  if (!mapped) { unmapped.push(sourceRelative); continue; }
  const sourcePath=join(workspace,sourceRelative);
  if (!existsSync(sourcePath)) { unmapped.push(sourceRelative); continue; }
  const markdown=await readFile(sourcePath,"utf8"), parsed=splitDocument(markdown);
  const payload={ id:mapped.document.id, title:mapped.document.title, libraryId:mapped.library.id, words:mapped.document.words, toc:parsed.toc, chunks:parsed.chunks };
  const target=join(atlasRoot,mapped.document.contentFile);
  const compressed=gzipSync(Buffer.from(JSON.stringify(payload),"utf8"),{level:9,mtime:0});
  await writeFile(target,compressed);
  const verified=JSON.parse(gunzipSync(await readFile(target)).toString("utf8"));
  if(verified.id!==mapped.document.id || verified.chunks.map(item=>item.markdown).join("\n").length < markdown.length*.98) throw new Error(`Validación fallida: ${sourceRelative}`);
  synced+=1;
}

const contentFiles=(catalog.libraries||[]).flatMap(lib=>(lib.documents||[]).map(doc=>join(atlasRoot,doc.contentFile))).filter(existsSync);
let bytes=0; for(const file of contentFiles) bytes+=(await stat(file)).size;
await writeFile(join(atlasRoot,"data","documents","manifest.json"),JSON.stringify({version:catalog.meta.dataVersion,generatedAt:new Date().toISOString(),documents:contentFiles.length,bytes},null,2)+"\n","utf8");
console.log(`Lector sincronizado: ${synced} documentos; ${unmapped.length} archivos de control o sin ficha.`);
if(unmapped.length) console.log(unmapped.map(value=>`  - ${value}`).join("\n"));
