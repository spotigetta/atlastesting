import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {root, hash, detectLanguage, segments, getDocuments, getSource, editionRevision, translationContentHash} from './translate-library.mjs';

test('translated content hash matches builder markdown bytes and detects modified text',()=>{
  const markdown='# Texto\n\nTraducción íntegra.\n';
  const payload={chunks:[{index:0,markdown}]};
  assert.equal(translationContentHash(payload),hash(markdown));
  assert.notEqual(translationContentHash({chunks:[{index:0,markdown:markdown+'Otra frase.'}]}),translationContentHash(payload));
  assert.equal(translationContentHash({chunks:[{text:'uno'},{markdown:'dos'}]}),hash('uno\ndos'));
});

test('edition revision is deterministic and changes for source or translation changes',()=>{
  const a={documentId:'a',language:'es',sourceHash:'source',targetHash:'target',review:{scope:'complete',humanReviewed:false}};
  const b={documentId:'b',language:'es',sourceHash:'other',targetHash:'target-b'};
  assert.equal(editionRevision([a,b]),editionRevision([b,{review:{humanReviewed:false,scope:'complete'},targetHash:'target',sourceHash:'source',language:'es',documentId:'a'}]));
  assert.notEqual(editionRevision([a]),editionRevision([{...a,sourceHash:'changed'}]));
  assert.notEqual(editionRevision([a]),editionRevision([{...a,targetHash:'changed'}]));
});

test('language inference distinguishes the translated corpus languages',()=>{
  const fixtures = {
    en: 'The brothers shall have all things in common and they shall live with their companions. They must not seek their own advantage. ',
    fr: 'Les frères qui sont dans la maison ne doivent pas chercher leur propre bien mais celui de tous. Nous vous demandons de vivre avec les autres. ',
    es: 'Los hermanos que viven en la casa no deben buscar su propio interés, porque todos tienen que vivir con los demás y compartir sus bienes. '
  };
  for (const [language, value] of Object.entries(fixtures)) assert.equal(detectLanguage(value.repeat(12)).language,language);
  assert.equal(detectLanguage('A heading').language, 'und');
});
test('long Spanish wrapper cannot label a French body as Spanish',()=>{
  const text = 'Documento en castellano de los autores para todos los lectores. '.repeat(20) + 'Les frères qui sont dans la maison ne doivent pas chercher leur propre bien mais celui de tous. Nous vous demandons de vivre avec les autres. '.repeat(2000);
  assert.equal(detectLanguage(text).language, 'fr');
});
test('segmenting never truncates text at the model input limit',()=>{
  const source = 'The grace of Christ does not abolish free will, but heals and strengthens it. '.repeat(80);
  const result = segments(source, 600);
  assert.ok(result.length>1);
  assert.ok(result.every(part=>part.length<=600));
  assert.equal(result.join(''),source);
});
test('all source IDs, TOC anchors and chunk indexes stay unchanged in registered editions',async(t)=>{
  let manifest;
  try {manifest = JSON.parse(await readFile(join(root,'data/editions/manifest.json'),'utf8'));} catch(error) {if(error.code==='ENOENT') {t.skip('No editions registered yet'); return;} throw error;}
  if (!manifest.editions.length) {t.skip('No editions registered yet'); return;}
  assert.equal(manifest.revision,editionRevision(manifest.editions));
  const documents = await getDocuments();
  for (const edition of manifest.editions) {
    const document = documents.find(document=>document.id===edition.documentId), source = await getSource(document);
    const translated = JSON.parse(gunzipSync(await readFile(join(root,edition.contentFile))));
    assert.equal(edition.targetHash,translationContentHash(translated));
    assert.equal(edition.sourceHash, hash(source.bytes), edition.documentId);
    assert.equal(translated.id,source.payload.id);
    assert.deepEqual(translated.chunks.map(chunk=>chunk.index),source.payload.chunks.map(chunk=>chunk.index));
    assert.deepEqual(translated.toc.map(({title,...entry})=>entry),source.payload.toc.map(({title,...entry})=>entry));
    if(edition.status==='reviewed') {
      assert.equal(edition.review.humanReviewed,false);
      assert.equal(edition.reviewMethod,'ai-editorial');
      assert.equal(edition.review.scope,'entire catalogued payload');
      const approval = JSON.parse(await readFile(join(root,edition.review.evidenceFile),'utf8'));
      assert.notEqual(approval.reviewer,approval.translator);
      assert.equal(approval.targetHash,hash(translated.chunks[0].markdown));
      assert.equal(approval.sourceHash,edition.sourceHash);
    }
  }
});
