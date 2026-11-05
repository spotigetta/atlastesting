/** One-time rollback of normalized payloads to preserve persisted chunk references. */
import {readFile,writeFile,rename} from "node:fs/promises";
import {join} from "node:path";
import {atlasRoot,hash,readJson,safePath} from "./audit-corpus.mjs";
const plan=await readJson(join(atlasRoot,"reports/corpus-reconciliation-apply.json"));
const before=await readJson(join(atlasRoot,plan.backup,"data/catalog.json")),catalog=await readJson(join(atlasRoot,"data/catalog.json"));
const oldDocuments=new Map(before.libraries.flatMap(l=>l.documents.map(d=>[d.id,d])));
const currentDocuments=new Map(catalog.libraries.flatMap(l=>l.documents.map(d=>[d.id,d])));
const writes=new Map(),restored=[];
for(const change of plan.changes.filter(c=>c.normalization)){
  const original=await readFile(safePath(join(atlasRoot,plan.backup),change.contentFile)),current=await readFile(safePath(atlasRoot,change.contentFile));
  if(hash(original)!==change.beforeSha256)throw new Error(`Backup inválido: ${change.id}`);
  if(hash(current)!==change.afterSha256&&hash(current)!==change.beforeSha256)throw new Error(`Payload cambiado fuera de la reconciliación: ${change.id}`);
  writes.set(change.contentFile,original);currentDocuments.get(change.id).words=oldDocuments.get(change.id).words;
  restored.push({id:change.id,path:change.contentFile,normalizedSha256:change.afterSha256,restoredSha256:hash(original),source:change.normalization.source,normalizationReports:change.normalization.reports});
}
for(const library of catalog.libraries)library.stats={...library.stats,documents:library.documents.length,words:library.documents.reduce((n,d)=>n+(d.words||0),0)};
catalog.meta.words=catalog.libraries.reduce((n,l)=>n+l.stats.words,0);
const rows=[];let bytes=0;
for(const path of [...new Set(catalog.libraries.flatMap(l=>l.documents.map(d=>d.contentFile)))].sort()){
  const data=writes.get(path)||await readFile(safePath(atlasRoot,path));bytes+=data.length;rows.push(`${path}\t${hash(data)}`);
}
catalog.meta.contentRevision=hash(rows.join("\n"));
writes.set("data/catalog.json",Buffer.from(`${JSON.stringify(catalog,null,2)}\n`));
writes.set("data/documents/manifest.json",Buffer.from(`${JSON.stringify({version:catalog.meta.dataVersion,documents:rows.length,bytes,contentDigest:catalog.meta.contentRevision},null,2)}\n`));
for(const [path,bytes]of writes){const target=safePath(atlasRoot,path),tmp=`${target}.restore-tmp`;await writeFile(tmp,bytes);await rename(tmp,target);if(hash(await readFile(target))!==hash(bytes))throw new Error(`Restauración inválida: ${path}`);}
const report={schemaVersion:1,reason:"Preserve historical chunks/toc and persisted chunkIndex/offset references. No normalization may replace payload text until state migration is verified.",restored:restored.length,preservedMappings:plan.changes.filter(c=>c.mapping).length,preservedSchemaRepairs:plan.changes.filter(c=>c.legacyTextChunks).length,sourceBackup:plan.backup,contentRevision:catalog.meta.contentRevision,documents:restored};
await writeFile(join(atlasRoot,"reports/corpus-normalization-rollback.json"),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify({restored:report.restored,preservedMappings:report.preservedMappings,preservedSchemaRepairs:report.preservedSchemaRepairs,contentRevision:report.contentRevision},null,2));
