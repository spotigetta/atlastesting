/** Apply only hash-proven mappings/normalizations; never edit Markdown sources. */
import { readFile, writeFile, mkdir, copyFile, rename, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { atlasRoot, auditCorpus, hash, safePath } from "./audit-corpus.mjs";

const args=process.argv.slice(2);
if(args.some(a=>a!=="--apply"))throw new Error("Uso: node tools/reconcile-corpus.mjs [--apply]");
const apply=args.includes("--apply"), report=await auditCorpus();
if(report.errors.length)throw new Error(`Auditoría inválida: ${report.errors.join("; ")}`);
const catalogPath=join(atlasRoot,"data/catalog.json"), catalogBytes=await readFile(catalogPath), catalog=JSON.parse(catalogBytes);
if(hash(catalogBytes)!==report.catalogSha256)throw new Error("El catálogo cambió durante la auditoría.");
const byId=new Map(catalog.libraries.flatMap(l=>l.documents.map(d=>[d.id,{library:l,document:d}])));
const writes=new Map(), changes=[];
for(const record of report.documents){
  const {library,document}=byId.get(record.id),change={id:record.id,contentFile:record.contentFile};let changed=false;
  if(record.status==="missing-path-content-found"&&record.sourcePath){document.sourceFile=record.sourcePath;change.mapping={from:record.expectedPath,to:record.sourcePath,sourceSha256:record.sourceSha256,normalizationReports:record.normalizationReports||[]};changed=true;}
  // Normalization changes offsets and chunk references. Mapping proof is retained,
  // but payload text may not change without a separately verified state migration.
  if(record.legacyTextChunks){
    const bytes=await readFile(safePath(atlasRoot,record.contentFile));if(hash(bytes)!==record.payloadSha256)throw new Error(`Payload cambiado: ${record.id}`);
    const payload=JSON.parse(gunzipSync(bytes));
    payload.chunks=payload.chunks.map(({text,...chunk})=>({...chunk,markdown:chunk.markdown??text}));
    const updated=gzipSync(Buffer.from(JSON.stringify(payload)),{level:9,mtime:0});writes.set(record.contentFile,updated);
    change.beforeSha256=hash(bytes);change.afterSha256=hash(updated);change.legacyTextChunks=record.legacyTextChunks;changed=true;
  }
  if(changed)changes.push(change);
}
const saints=catalog.libraries.find(l=>l.id==="vida-santos");
if(saints?.documents.every(d=>d.sourceFile?.startsWith("11_IA_Vida_de_los_Santos/")))saints.folder="11_IA_Vida_de_los_Santos";
for(const library of catalog.libraries){library.stats={...library.stats,documents:library.documents.length,words:library.documents.reduce((n,d)=>n+(d.words||0),0)};}
catalog.meta.documents=catalog.libraries.reduce((n,l)=>n+l.documents.length,0);catalog.meta.words=catalog.libraries.reduce((n,l)=>n+l.stats.words,0);
let payloadBytes=0;const digestRows=[];
for(const path of [...new Set(report.documents.map(d=>d.contentFile))].sort()){const bytes=writes.get(path)||await readFile(safePath(atlasRoot,path));payloadBytes+=bytes.length;digestRows.push(`${path}\t${hash(bytes)}`);}
catalog.meta.contentRevision=hash(digestRows.join("\n"));
const catalogOutput=Buffer.from(`${JSON.stringify(catalog,null,2)}\n`);if(!catalogOutput.equals(catalogBytes))writes.set("data/catalog.json",catalogOutput);
writes.set("data/documents/manifest.json",Buffer.from(`${JSON.stringify({version:catalog.meta.dataVersion,documents:digestRows.length,bytes:payloadBytes,contentDigest:catalog.meta.contentRevision},null,2)}\n`));
const plan={schemaVersion:1,mode:apply?"apply":"dry-run",catalogBeforeSha256:report.catalogSha256,catalogAfterSha256:hash(catalogOutput),auditSummary:report.summary,changedDocuments:changes.length,payloads:writes.size-(writes.has("data/catalog.json")?1:0)-1,changes,pending:report.documents.filter(d=>d.status==="missing-path-unresolved"||d.status==="missing-path-ambiguous"||d.status==="exact-path-content-differs"||d.normalizationReports?.length).map(d=>({id:d.id,status:d.status,path:d.expectedPath,reason:d.normalizationReports?.length?"Normalization proven; preserving chunks and offsets until state migration is verified":"Correspondence not proven",normalizationReports:d.normalizationReports||[]}))};
if(apply){
  const backup=`reports/corpus-backup-${hash(catalogBytes).slice(0,16)}`,backupPath=join(atlasRoot,backup);await mkdir(backupPath,{recursive:true});
  const originals=[];
  // Back up every target, then verify every backup before the first write.
  for(const [path,bytes]of writes){const target=safePath(atlasRoot,path),destination=safePath(backupPath,path);await mkdir(dirname(destination),{recursive:true});try{await access(destination);if(hash(await readFile(destination))!==hash(await readFile(target)))throw new Error(`Backup existente distinto: ${path}`);}catch(error){if(error.code!=="ENOENT")throw error;await copyFile(target,destination);}const original=await readFile(target);if(hash(await readFile(destination))!==hash(original))throw new Error(`Backup inválido: ${path}`);originals.push({path,sha256:hash(original),afterSha256:hash(bytes)});}
  for(const [path,bytes]of writes){const target=safePath(atlasRoot,path),tmp=`${target}.reconcile-tmp`;await writeFile(tmp,bytes);await rename(tmp,target);if(hash(await readFile(target))!==hash(bytes))throw new Error(`Escritura inválida: ${path}`);}
  plan.backup=backup;plan.files=originals;
}
await mkdir(join(atlasRoot,"reports"),{recursive:true});
const reportFile=`reports/corpus-reconciliation-${apply?"apply":"dry-run"}-${report.catalogSha256.slice(0,16)}.json`;
await writeFile(join(atlasRoot,reportFile),`${JSON.stringify(plan,null,2)}\n`);
await writeFile(join(atlasRoot,"reports/corpus-reconciliation-latest.json"),`${JSON.stringify({report:reportFile,mode:plan.mode},null,2)}\n`);
console.log(JSON.stringify({mode:plan.mode,changedDocuments:plan.changedDocuments,payloads:plan.payloads,pending:plan.pending.length,backup:plan.backup},null,2));
