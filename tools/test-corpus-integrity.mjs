import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {gunzipSync} from "node:zlib";
import {spawnSync} from "node:child_process";
import {atlasRoot,workspace,hash,readJson,safePath} from "./audit-corpus.mjs";

test("workspace paths cannot escape their declared root",()=>{
  assert.throws(()=>safePath(atlasRoot,"../outside.md"));
  assert.throws(()=>safePath(atlasRoot,"C:/Windows/win.ini"));
  assert.equal(safePath(atlasRoot,"data/catalog.json"),join(atlasRoot,"data/catalog.json"));
});
test("catalog retains every original document ID and library membership",async()=>{
  const plan=await readJson(join(atlasRoot,"reports/corpus-reconciliation-apply.json"));
  const before=await readJson(join(atlasRoot,plan.backup,"data/catalog.json")),after=await readJson(join(atlasRoot,"data/catalog.json"));
  assert.deepEqual(after.libraries.map(l=>[l.id,l.documents.map(d=>d.id)]),before.libraries.map(l=>[l.id,l.documents.map(d=>d.id)]));
});
test("all audited Markdown source bytes remain unchanged",async()=>{
  const audit=await readJson(join(atlasRoot,"reports/corpus-audit-before.json"));
  for(const source of audit.sources)assert.equal(hash(await readFile(safePath(workspace,source.path))),source.sha256,source.path);
});
test("reconciliation backups are exact and editorial provenance continues their baseline",async()=>{
  const plan=await readJson(join(atlasRoot,"reports/corpus-reconciliation-apply.json"));
  const editorial=await readJson(join(atlasRoot,"reports/editorial-corpus-apply.json"));
  const records=new Map(editorial.documents.map(record=>[record.id,record]));
  for(const file of plan.files)assert.equal(hash(await readFile(safePath(join(atlasRoot,plan.backup),file.path))),file.sha256,file.path);
  for(const change of plan.changes.filter(c=>c.afterSha256)){
    const record=records.get(change.id);assert.ok(record,`No editorial provenance for ${change.id}`);
    const expectedBaseline=change.normalization?change.beforeSha256:change.afterSha256;
    assert.equal(record.beforeSha256,expectedBaseline,`Editorial input must match approved reconciliation baseline: ${change.id}`);
    const bytes=await readFile(safePath(atlasRoot,change.contentFile));assert.equal(hash(bytes),record.afterSha256,change.id);
    const payload=JSON.parse(gunzipSync(bytes));assert.equal(payload.id,change.id);
    const before=JSON.parse(gunzipSync(await readFile(safePath(join(atlasRoot,plan.backup),change.contentFile))));
    assert.deepEqual(payload.chunks.map(c=>c.index),before.chunks.map(c=>c.index),`Historical fragment addresses: ${change.id}`);
    const addresses=toc=>(toc||[]).map(({anchor,level,chunkIndex})=>({anchor,level,chunkIndex}));
    assert.deepEqual(addresses(payload.toc),addresses(before.toc),`Historical TOC addresses: ${change.id}`);
  }
});

test("editorial original bytes and extracted metadata remain recoverable",async()=>{
  const editorial=await readJson(join(atlasRoot,"reports/editorial-corpus-apply.json"));
  assert.equal(editorial.mode,"apply");assert.equal(editorial.rules.noRechunk,true);
  assert.equal(editorial.rules.keepEveryRemovedMetadataBlockRaw,true);
  for(const file of editorial.files){
    const original=await readFile(safePath(join(atlasRoot,editorial.backup),file.path));
    assert.equal(hash(original),file.beforeSha256,`Editorial backup ${file.path}`);
  }
  for(const record of editorial.documents){
    const bytes=await readFile(safePath(atlasRoot,record.contentFile));
    assert.equal(hash(bytes),record.afterSha256,`Final payload ${record.id}`);
    const payload=JSON.parse(gunzipSync(bytes));
    for(const block of payload.editorial?.metadataBlocks||[]){
      assert.equal(hash(block.raw),block.rawSha256,`Raw metadata ${record.id}/${block.chunkIndex}`);
      assert.ok(Number.isInteger(block.chunkIndex),`Metadata fragment address ${record.id}`);
    }
    for(const chunk of record.chunks){
      const actual=payload.chunks.find(candidate=>candidate.index===chunk.index);
      assert.ok(actual,`Missing fragment ${record.id}/${chunk.index}`);
      assert.equal(hash(actual.markdown??actual.text),chunk.afterSha256,`Fragment bytes ${record.id}/${chunk.index}`);
    }
  }
});

test("every final fragment equals the authorized editorial transform of its backed-up source",()=>{
  // This invokes the deterministic verifier, not the transformation/apply command.
  // It checks all fragments, preserved TOC addresses, raw metadata hashes and Markdown exports.
  const verified=spawnSync(process.execPath,["tools/editorial-corpus.mjs","--verify"],{
    cwd:atlasRoot,encoding:"utf8",timeout:600000,maxBuffer:4*1024*1024
  });
  assert.ifError(verified.error);
  assert.equal(verified.status,0,`${verified.stdout}\n${verified.stderr}`);
  const proof=JSON.parse(verified.stdout);
  assert.equal(proof.stableIds,true);assert.equal(proof.stableTocAnchors,true);
  assert.ok(proof.fragmentsVerified>0);assert.ok(proof.backupsVerified>0);
});
test("search coverage equals the current catalog and revision is shared",async()=>{
  const catalog=await readJson(join(atlasRoot,"data/catalog.json")),manifest=await readJson(join(atlasRoot,"data/search/manifest.json"));
  const ids=catalog.libraries.flatMap(l=>l.documents.map(d=>d.id));assert.deepEqual(manifest.documents.map(d=>d.id),ids);
  assert.equal(manifest.meta.contentRevision,catalog.meta.searchRevision);assert.equal(manifest.meta.payloadDigest,catalog.meta.contentRevision);
});
