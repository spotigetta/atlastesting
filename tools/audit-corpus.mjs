/** Read-only reconciliation of sources, catalog, payloads, manifests and search. */
import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

export const atlasRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const workspace = dirname(atlasRoot);
export const hash = value => createHash("sha256").update(value).digest("hex");
export const slash = value => value.split(sep).join("/");
export const canonical = value => value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
export const countWords = value => (value.match(/[\p{L}\p{N}]+/gu) || []).length;
export function safePath(root, path) {
  const full = resolve(root, path), local = relative(root, full);
  if (isAbsolute(local) || local === ".." || local.startsWith(`..${sep}`) || resolve(full) === resolve(root)) throw new Error(`Ruta fuera del directorio permitido: ${path}`);
  return full;
}
export async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
export async function walkMarkdown(root) {
  const files = [];
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      if (entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(path);
    }
  }
  await walk(root); return files;
}
export async function auditCorpus() {
  const catalogBytes = await readFile(join(atlasRoot, "data/catalog.json"));
  const catalog = JSON.parse(catalogBytes), sources = [], byPath = new Map(), byHash = new Map();
  const entries = await readdir(workspace, { withFileTypes: true });
  for (const entry of entries.filter(item => item.isDirectory() && (/^\d{2}_IA_/i.test(item.name) || item.name === "Vida de los Santos")).sort((a,b) => a.name < b.name ? -1 : 1)) {
    for (const path of await walkMarkdown(join(workspace, entry.name))) {
      const bytes = await readFile(path), text = canonical(bytes.toString("utf8"));
      const record = { path: slash(relative(workspace,path)), bytes: bytes.length, sha256: hash(bytes), textSha256: hash(text) };
      sources.push(record); byPath.set(record.path,record);
      if (!byHash.has(record.textSha256)) byHash.set(record.textSha256,[]);
      byHash.get(record.textSha256).push(record.path);
    }
  }
  // Root-level works are explicitly referenced by catalog filenames, never guessed.
  const rootFiles = new Set(catalog.libraries.flatMap(l => l.documents.filter(d => !/[\\/]/.test(d.file)).map(d => d.file)));
  for (const entry of entries.filter(e => e.isFile() && /\.md$/i.test(e.name) && rootFiles.has(e.name))) {
    const bytes = await readFile(join(workspace,entry.name)), record = {path:entry.name,bytes:bytes.length,sha256:hash(bytes),textSha256:hash(canonical(bytes.toString("utf8")))};
    sources.push(record);byPath.set(record.path,record);
    if(!byHash.has(record.textSha256))byHash.set(record.textSha256,[]);
    byHash.get(record.textSha256).push(record.path);
  }
  // Historical apply reports are evidence of normalization, never fuzzy matching.
  const history = new Map(), provenance = [];
  for(const dir of ["output/markdown-normalization","markdown-audit-2026-09-04-structure","atlas/reports/markdown-normalization"]) {
    let names=[];try{names=await readdir(join(workspace,dir));}catch{continue;}
    for(const name of names.filter(n=>/^markdown-normalization-apply-.*\.json$/.test(n)).sort()){
      const path=join(dir,name),bytes=await readFile(join(workspace,path)),report=JSON.parse(bytes);
      if(report.mode!=="apply" || report.summary?.errors?.length)continue;
      provenance.push({path:slash(path),sha256:hash(bytes)});
      for(const record of report.files||[])if(record.original_sha256&&record.proposed_sha256&&record.validation?.valid){
        if(!history.has(record.original_sha256))history.set(record.original_sha256,[]);
        history.get(record.original_sha256).push({hash:record.proposed_sha256,report:slash(path)});
      }
    }
  }
  function historicalMatches(start){
    const result=[],queue=[{hash:start,reports:[]}],seen=new Set();
    while(queue.length){const step=queue.shift();if(seen.has(step.hash))continue;seen.add(step.hash);
      if(step.reports.length)for(const path of byHash.get(step.hash)||[])result.push({path,textSha256:step.hash,normalizationReports:step.reports});
      for(const edge of history.get(step.hash)||[])queue.push({hash:edge.hash,reports:[...step.reports,edge.report]});
    }return result;
  }
  const documents = [], errors = [], ids = new Set(), contentFiles = new Set(); let payloadBytes = 0;
  for (const library of catalog.libraries) for (const document of library.documents) {
    const expectedPath = document.sourceFile || slash(join(library.folder,document.file));
    const record = {id:document.id,libraryId:library.id,expectedPath,contentFile:document.contentFile,sourcePath:byPath.has(expectedPath)?expectedPath:null};
    if(ids.has(document.id))errors.push(`ID duplicado: ${document.id}`);ids.add(document.id);
    try {
      const bytes=await readFile(safePath(atlasRoot,document.contentFile)), payload=JSON.parse(gunzipSync(bytes));
      record.payloadSha256=hash(bytes);
      if(!contentFiles.has(document.contentFile)){payloadBytes+=bytes.length;contentFiles.add(document.contentFile);}
      if(payload.id!==document.id || payload.libraryId!==library.id)errors.push(`Identidad del payload: ${document.id}`);
      if(!Array.isArray(payload.chunks) || payload.chunks.some(c=>typeof (c.markdown??c.text)!=="string"))throw new Error("chunks inválidos");
      record.legacyTextChunks=payload.chunks.filter(c=>typeof c.markdown!=="string").length;
      const matches=new Map();
      for(const separator of ["","\n","\n\n"]) {
        const textSha256=hash(canonical(payload.chunks.map(c=>c.markdown??c.text).join(separator)));
        for(const path of byHash.get(textSha256)||[])matches.set(path,{path,textSha256,separator});
        for(const match of historicalMatches(textSha256))if(!matches.has(match.path))matches.set(match.path,{...match,separator});
      }
      const candidates=[...matches.values()].sort((a,b)=>a.path<b.path?-1:1);
      if(record.sourcePath){
        const match=matches.get(record.sourcePath);record.status=match?(match.normalizationReports?"exact-path-normalization-proven":"exact-path-content"):"exact-path-content-differs";
        record.sourceSha256=byPath.get(record.sourcePath).sha256;
        if(match){record.textSha256=match.textSha256;record.separator=match.separator;if(match.normalizationReports)record.normalizationReports=match.normalizationReports;}
      } else {
        record.status=candidates.length?"missing-path-content-found":"missing-path-unresolved";
        record.candidates=candidates;
        // Prefer the same filename within its library, only after content equality.
        const name=document.file.split(/[\\/]/).at(-1).normalize("NFC").toLowerCase();
        const preferred=candidates.filter(c=>c.path.split("/").at(-1).normalize("NFC").toLowerCase()===name);
        const sameLibrary=candidates.filter(c=>c.path.startsWith(`${library.folder}/`));
        const match=preferred.length===1?preferred[0]:sameLibrary.length===1?sameLibrary[0]:candidates.length===1?candidates[0]:null;
        if(match){record.sourcePath=match.path;record.sourceSha256=byPath.get(match.path).sha256;record.textSha256=match.textSha256;record.separator=match.separator;if(match.normalizationReports)record.normalizationReports=match.normalizationReports;}
        else if(candidates.length)record.status="missing-path-ambiguous";
      }
    } catch(error){record.status="payload-error";record.error=error.message;errors.push(`${document.id}: ${error.message}`);}
    documents.push(record);
  }
  const manifest=await readJson(join(atlasRoot,"data/documents/manifest.json"));
  const search=await readJson(join(atlasRoot,"data/search/manifest.json")),searchIds=new Set(search.documents.map(d=>d.id));
  const missingSearch=[...ids].filter(id=>!searchIds.has(id)),staleSearch=[...searchIds].filter(id=>!ids.has(id));
  const shardErrors=[];let terms=0,postings=0;
  for(const [key,shard] of Object.entries(search.shards))try{
    const bytes=await readFile(safePath(atlasRoot,shard.file)),payload=JSON.parse(gunzipSync(bytes));
    const entries=Object.entries(payload.terms||{});terms+=entries.length;
    if(shard.bytes!==bytes.length || shard.terms!==entries.length || (shard.sha256 && shard.sha256!==hash(bytes)))shardErrors.push(`Metadatos del segmento ${key}`);
    for(const [term,values]of entries){if(values.length%2)shardErrors.push(`Entrada impar: ${term}`);for(let i=0;i<values.length;i+=2){postings++;if(!Number.isInteger(values[i])||values[i]<0||values[i]>=search.documents.length||!(values[i+1]>0))shardErrors.push(`Referencia inválida: ${term}`);}}
  }catch(error){shardErrors.push(`${key}: ${error.message}`);}
  const counts=Object.fromEntries([...new Set(documents.map(d=>d.status))].sort().map(status=>[status,documents.filter(d=>d.status===status).length]));
  const contentDigest=hash(documents.map(d=>`${d.contentFile}\t${d.payloadSha256}`).sort().join("\n"));
  const revisionMatches=(!catalog.meta.contentRevision||catalog.meta.contentRevision===contentDigest)&&(!manifest.contentDigest||manifest.contentDigest===contentDigest)&&(!search.meta.payloadDigest||search.meta.payloadDigest===contentDigest)&&(!catalog.meta.searchRevision||catalog.meta.searchRevision===search.meta.contentRevision);
  const summary={sources:sources.length,uniqueSourceTexts:byHash.size,duplicateSourceCopies:sources.length-byHash.size,documents:documents.length,status:counts,missingPaths:documents.filter(d=>d.status.startsWith("missing-path")).length,payloadFiles:contentFiles.size,payloadBytes,contentDigest,revisionMatches,manifestDocuments:manifest.documents,manifestBytes:manifest.bytes,manifestMatches:manifest.documents===contentFiles.size&&manifest.bytes===payloadBytes,searchDocuments:search.documents.length,missingSearch:missingSearch.length,staleSearch:staleSearch.length,terms,postings,shardErrors:shardErrors.length,errors:errors.length};
  return {schemaVersion:1,mode:"audit",catalogSha256:hash(catalogBytes),summary,sources,provenance,documents,manifest,search:{meta:search.meta,missing:missingSearch,stale:staleSearch,shardErrors},errors};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),output=args.find(a=>a.startsWith("--output="))?.slice(9)||"reports/corpus-audit.json";
  const report=await auditCorpus();await mkdir(dirname(safePath(atlasRoot,output)),{recursive:true});
  await writeFile(safePath(atlasRoot,output),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report.summary,null,2));console.log(`Informe: ${output}`);
  if(report.errors.length||report.search.shardErrors.length||!report.summary.revisionMatches||!report.summary.manifestMatches)process.exitCode=1;
  if(args.includes("--strict") && (report.summary.missingPaths||report.summary.status["exact-path-content-differs"]||report.search.missing.length||report.search.stale.length||report.documents.some(d=>d.legacyTextChunks||d.normalizationReports?.length)))process.exitCode=1;
}
