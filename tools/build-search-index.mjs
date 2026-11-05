/** Deterministic full-text index from the exact payloads served by Atlas. */
import { readFile, writeFile, mkdir, rename, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { atlasRoot, readJson, hash, safePath, canonical } from "./audit-corpus.mjs";

const catalog=await readJson(join(atlasRoot,"data/catalog.json")),documents=catalog.libraries.flatMap(l=>l.documents.map(d=>({id:d.id,title:d.title,libraryId:l.id,contentFile:d.contentFile})));
if(new Set(documents.map(d=>d.id)).size!==documents.length)throw new Error("IDs duplicados");
const stopwords=new Set("para como desde sobre entre este esta estas estos una unos unas por con sin del las los que y o el la en de se al un es no su sus a ante bajo cabe contra durante mediante segun tras mi tu yo nos vos ello ella ellos ellas fue son han hay muy mas pero porque cuando donde cual cuales quien quienes".split(" "));
const normalize=value=>value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase();
const keyFor=term=>/^[a-z0-9]$/.test(term[0]||"")?term[0]:"_";
const terms=new Map(),cache=new Map(),payloadRows=[];let postings=0;
for(let docIndex=0;docIndex<documents.length;docIndex++){
  const document=documents[docIndex],bytes=await readFile(safePath(atlasRoot,document.contentFile)),payload=JSON.parse(gunzipSync(bytes));
  if(payload.id!==document.id||payload.libraryId!==document.libraryId)throw new Error(`Identidad inválida: ${document.id}`);
  if(!Array.isArray(payload.chunks)||payload.chunks.some(c=>typeof(c.markdown??c.text)!=="string"))throw new Error(`Texto inválido: ${document.id}`);
  payloadRows.push(`${document.contentFile}\t${hash(bytes)}`);
  const text=canonical(payload.chunks.map(c=>c.markdown??c.text).join("\n")),textHash=hash(text);let counts=cache.get(textHash);
  if(!counts){counts=new Map();for(const match of normalize(text).matchAll(/[\p{L}\p{N}]{3,32}/gu)){const term=match[0];if(!stopwords.has(term))counts.set(term,(counts.get(term)||0)+1);}cache.set(textHash,counts);}
  for(const [term,count]of counts){if(!terms.has(term))terms.set(term,[]);terms.get(term).push(docIndex,count);postings++;}
  if((docIndex+1)%200===0)console.log(`Indexados ${docIndex+1}/${documents.length}`);
}
const contentDigest=hash([...new Set(payloadRows)].sort().join("\n"));
if(catalog.meta.contentRevision&&catalog.meta.contentRevision!==contentDigest)throw new Error("El inventario de payloads cambió después de reconciliar.");
const buckets=new Map();for(const term of [...terms.keys()].sort()){const key=keyFor(term);if(!buckets.has(key))buckets.set(key,{});buckets.get(key)[term]=terms.get(term);}
const writes=new Map(),shards={};
for(const key of [...buckets.keys()].sort()){
  const values=buckets.get(key),file=`data/search/${key==="_"?"other":key}.json.gz`,bytes=gzipSync(Buffer.from(JSON.stringify({terms:values})),{level:9,mtime:0});
  writes.set(file,bytes);shards[key]={file,terms:Object.keys(values).length,bytes:bytes.length,sha256:hash(bytes)};
}
const revision=hash(JSON.stringify({indexVersion:1,contentDigest,documents:documents.map(({contentFile,...d})=>d),shards}));
const manifest={meta:{version:catalog.meta.dataVersion,indexVersion:1,contentRevision:revision,payloadDigest:contentDigest,documents:documents.length,terms:terms.size,postings,method:"Segmented inverted index; exact normalized terms; stopwords excluded"},documents:documents.map(({contentFile,...d})=>d),shards};
writes.set("data/search/manifest.json",Buffer.from(`${JSON.stringify(manifest,null,2)}\n`));
catalog.meta.searchRevision=revision;writes.set("data/catalog.json",Buffer.from(`${JSON.stringify(catalog,null,2)}\n`));
const backup=`reports/search-backup-${revision.slice(0,16)}`;
// Only changed outputs are written; manifest is published after every shard.
let changed=0;const changes=[];
for(const [path,bytes]of writes){const target=safePath(atlasRoot,path);let before;try{before=await readFile(target);}catch(error){if(error.code!=="ENOENT")throw error;}if(before&&hash(before)===hash(bytes))continue;
  if(before){const dest=safePath(join(atlasRoot,backup),path);await mkdir(dirname(dest),{recursive:true});try{const saved=await readFile(dest);if(hash(saved)!==hash(before))throw new Error(`Backup existente distinto: ${path}`);}catch(error){if(error.code!=="ENOENT")throw error;await copyFile(target,dest);}if(hash(await readFile(dest))!==hash(before))throw new Error(`Backup inválido: ${path}`);}
  changes.push({path,beforeSha256:before?hash(before):null,afterSha256:hash(bytes)});
}
for(const change of changes){const target=safePath(atlasRoot,change.path),tmp=`${target}.index-tmp`;await mkdir(dirname(target),{recursive:true});await writeFile(tmp,writes.get(change.path));await rename(tmp,target);changed++;}
await mkdir(join(atlasRoot,"reports"),{recursive:true});
const buildReport=`${JSON.stringify({indexVersion:1,revision,contentDigest,documents:documents.length,uniqueTexts:cache.size,terms:terms.size,postings,changed,backup,changes},null,2)}\n`;
await writeFile(join(atlasRoot,"reports/search-build.json"),buildReport);
if(changed)await writeFile(join(atlasRoot,`reports/search-build-${revision.slice(0,16)}.json`),buildReport);
console.log(JSON.stringify({documents:documents.length,uniqueTexts:cache.size,terms:terms.size,postings,changed,revision},null,2));
