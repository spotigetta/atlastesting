/** Offline library-edition workflow. Never replaces catalogued source payloads. */
import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const hash = value => createHash('sha256').update(value).digest('hex');
const tokens = {
  es: 'que los las del una por para con pero como este esta sus más también cuando entre hasta desde donde hay muy fue son tiene nuestro nuestra porque sin sobre todos cada quien está será',
  en: 'the and that with from this have which their shall would thou thee thine unto hath them were been will your they these those upon must what should when into',
  fr: 'les des une dans pour avec est qui que pas sont nous vous leur cette ces aux mais par ses sur comme plus ont même tous dont bien sans fait être',
  it: 'che della delle degli nella nelle sono per gli una con non nel alla alle dei questo come tutti anche della suoi suo più hanno essere dalla',
  pt: 'que não uma dos das para com são pelo pela aos nas nos seus suas como mais também muito este esta foi tem quando mas isso ser',
  de: 'und der die das nicht ist ein eine den dem des sich mit auf für von zu sie wir auch als wird sind haben werden dieser seine durch aber oder',
  la: 'et est sunt autem enim quod qui quae quia non eius esse cum ad sed ut nec atque etiam hoc haec ergo sit cuius quam quid quoniam igitur ipsius'
};
const lexicons = Object.fromEntries(Object.entries(tokens).map(([key, value]) => [key, new Set(value.split(' '))]));
export function detectLanguage(text) {
  // Spread samples through the body: a Spanish wrapper must not label a French book Spanish.
  const samples = text.length < 160000 ? text : Array.from({length: 8}, (_, i) => text.slice(Math.floor((text.length - 20000) * i / 7), Math.floor((text.length - 20000) * i / 7) + 20000)).join('\n');
  const cleaned = samples.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/<!--[\s\S]*?-->/g, '').replace(/https?:\S+/g, '');
  const words = cleaned.toLocaleLowerCase().match(/\p{L}+/gu) || [];
  const scores = Object.fromEntries(Object.entries(lexicons).map(([lang, lexicon]) => [lang, words.reduce((sum, word) => sum + Number(lexicon.has(word)), 0)]));
  const ordered = Object.entries(scores).sort((a,b) => b[1] - a[1]);
  const [language, count] = ordered[0];
  const ratio = count / Math.max(1, ordered[1][1]);
  return { language: count >= 20 && ratio >= 1.15 ? language : 'und', confidence: ratio >= 1.8 ? 'high' : ratio >= 1.3 ? 'medium' : 'low', scores, sampledWords: words.length, method: 'Distributed stopword heuristic; not a verified bibliographic language attribution' };
}
export async function getDocuments() {
  const catalog = JSON.parse(await readFile(join(root, 'data/catalog.json'), 'utf8'));
  return catalog.libraries.flatMap(library => library.documents.map(document => ({...document, libraryId: library.id})));
}
export async function getSource(document) {
  const path = resolve(root, document.contentFile);
  if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) throw new Error('Source outside project');
  const bytes = await readFile(path);
  const payload = JSON.parse(gunzipSync(bytes));
  const text = payload.chunks.map(chunk => chunk.markdown ?? chunk.text).join('\n');
  return {bytes, payload, text, sourceHash: hash(bytes), textHash: hash(text)};
}
export async function atomicJson(path, value) {
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path + '.tmp', JSON.stringify(value, null, 2) + '\n');
  await rename(path + '.tmp', path);
}
export const bodyFingerprint = text => hash(text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/\s+/g, ' ').trim().normalize('NFC'));
export async function snapshotSource(documentId) {
  const document = (await getDocuments()).find(document=>document.id===documentId);
  if (!document) throw new Error(`Unknown document ${documentId}`);
  const source = await getSource(document);
  const path = join(root,'data/editions/checkpoints',`source-${hash(documentId).slice(0,20)}.json`);
  // Keep the source actually read by author/reviewer, even if the editorial source pipeline later reformats it.
  let existing; try {existing=JSON.parse(await readFile(path,'utf8'));} catch {}
  if(existing && existing.sourceHash!==source.sourceHash) throw new Error('Snapshot already exists for another source revision; never overwrite review evidence.');
  await atomicJson(path,{schemaVersion:1,documentId,sourceHash:source.sourceHash,sourceTextHash:source.textHash,bodyFingerprint:bodyFingerprint(source.text),sourceLanguage:detectLanguage(source.text).language,capturedAt:new Date().toISOString(),chunks:source.payload.chunks,toc:source.payload.toc});
  console.log(`${documentId}: source snapshot saved`);
}
export async function rebaseReviews() {
  const directory=join(root,'data/editions/reviewed'),documents=await getDocuments(),rows=[];
  for(const file of (await readdir(directory)).filter(file=>file.endsWith('.approval.json'))){
    const path=join(directory,file),review=JSON.parse(await readFile(path,'utf8'));
    const document=documents.find(document=>document.id===review.documentId);
    if(!document)throw new Error(`Unknown review source ${review.documentId}`);
    const source=await getSource(document);
    if(source.sourceHash===review.sourceHash){rows.push({documentId:document.id,changed:false});continue;}
    const snapshotFile=`data/editions/checkpoints/source-${hash(document.id).slice(0,20)}.json`;
    const snapshot=JSON.parse(await readFile(join(root,snapshotFile),'utf8'));
    if(snapshot.sourceHash!==(review.sourceHashAtReview||review.sourceHash))throw new Error(`Review snapshot mismatch ${document.id}`);
    if(snapshot.bodyFingerprint!==bodyFingerprint(source.text))throw new Error(`Source body changed beyond whitespace/frontmatter; new full review required: ${document.id}`);
    if(JSON.stringify(snapshot.toc)!==JSON.stringify(source.payload.toc))throw new Error(`Source table of contents changed; new full review required: ${document.id}`);
    if(JSON.stringify(snapshot.chunks.map(c=>c.index))!==JSON.stringify(source.payload.chunks.map(c=>c.index)))throw new Error(`Source chunk indexes changed ${document.id}`);
    review.sourceHashAtReview??=review.sourceHash;
    review.sourceHash=source.sourceHash;
    review.sourceTextHash=source.textHash;
    review.sourceNormalization={method:'Exact body comparison after stripping leading YAML and collapsing whitespace; exact TOC and chunk indexes unchanged',snapshotFile,bodyFingerprint:bodyFingerprint(source.text),checkedAt:new Date().toISOString()};
    await atomicJson(path,review);
    rows.push({documentId:document.id,changed:true,sourceHash:source.sourceHash,sourceHashAtReview:review.sourceHashAtReview,bodyUnchanged:true});
  }
  await atomicJson(join(root,'reports/translation-review-rebase.json'),{generatedAt:new Date().toISOString(),rows});
  console.log(JSON.stringify(rows,null,2));
}
export async function inventory() {
  const documents = await getDocuments(), rows = [], groups = new Map();
  for (const document of documents) {
    const source = await getSource(document), detected = detectLanguage(source.text);
    const row = {documentId: document.id, title: document.title, libraryId: document.libraryId, contentFile: document.contentFile, sourceHash: source.sourceHash, textHash: source.textHash, characters: source.text.length, chunks: source.payload.chunks.length, ...detected};
    rows.push(row);
    if (!groups.has(row.textHash)) groups.set(row.textHash, []);
    groups.get(row.textHash).push(row.documentId);
  }
  const byLanguage = {};
  for (const row of rows) {
    const total = byLanguage[row.language] ??= {documents: 0, characters: 0, uniqueTexts: 0, uniqueCharacters: 0};
    total.documents++; total.characters += row.characters;
  }
  for (const [textHash, documentIds] of groups) {
    const row = rows.find(row => row.textHash === textHash), total = byLanguage[row.language];
    total.uniqueTexts++; total.uniqueCharacters += row.characters;
  }
  const report = {schemaVersion: 1, generatedAt: new Date().toISOString(), warning: 'Language detection is heuristic. Low-confidence and mixed-language works require inspection before translating.', totalDocuments: rows.length, totalCharacters: rows.reduce((sum, row) => sum + row.characters, 0), uniqueTexts: groups.size, byLanguage, duplicateGroups: [...groups].filter(([,ids]) => ids.length > 1).map(([textHash, documentIds]) => ({textHash, documentIds})), documents: rows};
  await atomicJson(join(root, 'reports/translation-inventory.json'), report);
  console.log(JSON.stringify({totalDocuments: report.totalDocuments, totalCharacters: report.totalCharacters, uniqueTexts: report.uniqueTexts, byLanguage}, null, 2));
  return report;
}
export async function planCorpus() {
  const report = JSON.parse(await readFile(join(root, 'reports/translation-inventory.json'), 'utf8'));
  let manifest={editions:[]}; try {manifest=JSON.parse(await readFile(join(root,'data/editions/manifest.json'),'utf8'));}catch{}
  const reviewedById=new Map(manifest.editions.filter(edition=>edition.status==='reviewed').map(edition=>[edition.documentId,edition]));
  const grouped = new Map();
  for (const document of report.documents.filter(document=>document.language !== 'es')) {
    if (!grouped.has(document.textHash)) grouped.set(document.textHash, {sourceTextHash: document.textHash, sourceLanguage: document.language, languageConfidence: document.confidence, characters: document.characters, documentIds: [], state: 'pending', sourceStatus: 'original-preserved', glossaryVersion: 1, translationMethodAvailable: document.language === 'en' ? 'offline-opus-draft-then-specialist-editorial-review' : 'ai-editorial-translation-and-independent-review', humanReviewed: false});
    grouped.get(document.textHash).documentIds.push(document.documentId);
  }
  const queue = [...grouped.values()].sort((a,b)=>{
    const priority = item => Number(!item.documentIds.some(id=>/agust|august/i.test(id))) * 1e12 + item.characters;
    return priority(a)-priority(b);
  });
  for(const item of queue){
    item.reviewedDocumentIds=item.documentIds.filter(id=>reviewedById.get(id)?.sourceTextHash===item.sourceTextHash);
    if(item.reviewedDocumentIds.length===item.documentIds.length)item.state='reviewed';
    else if(item.reviewedDocumentIds.length)item.state='partially-reviewed';
  }
  const pending=queue.filter(item=>item.state!=='reviewed');
  const plan = {schemaVersion: 1, inventoryGeneratedAt: report.generatedAt, warning: 'This is a work queue, not translated content. Only state reviewed identifies registered complete editions; pending entries are untranslated. Heuristic language attribution requires source inspection. Source originals are retained.', uniquePendingSourceTexts: pending.length, uniqueReviewedSourceTexts:queue.length-pending.length, uniqueSourceCharacters: queue.reduce((sum,item)=>sum+item.characters,0), uniquePendingSourceCharacters:pending.reduce((sum,item)=>sum+item.characters,0), queue};
  await atomicJson(join(root,'reports/translation-queue.json'), plan);
  console.log(JSON.stringify({uniquePendingSourceTexts:plan.uniquePendingSourceTexts,uniqueReviewedSourceTexts:plan.uniqueReviewedSourceTexts,uniqueSourceCharacters:plan.uniqueSourceCharacters,uniquePendingSourceCharacters:plan.uniquePendingSourceCharacters}));
  return plan;
}
export const glossary = {
  version: 1,
  scope: 'Christian patristic and spiritual literature. Context controls every rendering; substitutions alone are not review.',
  terms: [
    {concept: 'gratia', en: 'grace', fr: 'grâce', es: 'gracia'},
    {concept: 'caritas', en: 'charity', fr: 'charité', es: 'caridad'},
    {concept: 'liberum arbitrium', en: 'free will', fr: 'libre arbitre', es: 'libre albedrío'},
    {concept: 'concupiscentia', en: 'concupiscence', fr: 'concupiscence', es: 'concupiscencia'},
    {concept: 'continentia', en: 'continence', fr: 'continence', es: 'continencia'},
    {concept: 'iustificatio', en: 'justification', fr: 'justification', es: 'justificación'},
    {concept: 'regula', en: 'rule', fr: 'règle', es: 'regla'},
    {concept: 'praepositus', en: 'superior', fr: 'supérieur', es: 'superior'},
    {concept: 'presbyter', en: 'priest', fr: 'prêtre', es: 'presbítero'},
    {concept: 'saeculum', en: 'world', fr: 'siècle', es: 'mundo (según el contexto)'}
  ]
};
export function segments(text, maximum = 600) {
  const parts = text.match(/[^.!?\n]+[.!?]+(?:\s|$)|[^\n]+|\n/g) || [];
  const result = []; let current = '';
  for (const part of parts) {
    if (current.length + part.length > maximum && current) { result.push(current); current = ''; }
    if (part.length > maximum) {
      const words = part.match(/\S+\s*/g) || [];
      for (const word of words) { if (current.length + word.length > maximum && current) { result.push(current); current = ''; } current += word; }
    } else current += part;
  }
  if (current) result.push(current);
  return result;
}
export function editionRevision(editions) {
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return hash(JSON.stringify(canonical([...editions].sort((a,b)=>a.documentId.localeCompare(b.documentId)||a.language.localeCompare(b.language)))));
}
export const translationContentHash = payload => hash(payload.chunks.map(chunk=>chunk.markdown??chunk.text).join('\n'));
export async function registerEdition(document, source, payload, metadata) {
  const targetHash = translationContentHash(payload);
  if (metadata.targetHash && metadata.targetHash !== targetHash) throw new Error('Declared targetHash does not match translated content');
  const editionsRoot = join(root, 'data/editions'); await mkdir(editionsRoot, {recursive: true});
  const contentFile = `data/editions/${hash(document.id).slice(0,20)}.es.json.gz`;
  await writeFile(join(root, contentFile), gzipSync(JSON.stringify(payload), {mtime: 0}));
  let manifest; try { manifest = JSON.parse(await readFile(join(editionsRoot, 'manifest.json'), 'utf8')); } catch { manifest = {schemaVersion: 1, editions: []}; }
  const record = {documentId: document.id, language: 'es', contentFile, sourceHash: source.sourceHash, sourceTextHash: source.textHash, sourceLanguage: detectLanguage(source.text).language, ...metadata, targetHash};
  manifest.editions = manifest.editions.filter(edition => !(edition.documentId === document.id && edition.language === 'es')).concat(record).sort((a,b) => a.documentId.localeCompare(b.documentId));
  manifest.updatedAt = new Date().toISOString();
  manifest.revision = editionRevision(manifest.editions);
  await atomicJson(join(editionsRoot, 'manifest.json'), manifest);
  return record;
}
async function translate(documentId) {
  const document = (await getDocuments()).find(document => document.id === documentId);
  if (!document) throw new Error(`Unknown document ${documentId}`);
  const source = await getSource(document), language = detectLanguage(source.text);
  if (language.language !== 'en' || language.confidence === 'low') throw new Error(`Local model only supports English; detected ${language.language} (${language.confidence})`);
  const {pipeline, env} = await import('@huggingface/transformers');
  env.allowRemoteModels = false; env.allowLocalModels = true; env.cacheDir = join(root, '.translation-models');
  const model = 'Xenova/opus-mt-en-es';
  const translator = await pipeline('translation', join(root, '.translation-models', model), {dtype: 'q8'});
  const checkpointPath = join(root, 'data/editions/checkpoints', hash(documentId).slice(0,20) + '.json');
  let checkpoint;
  try { checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8')); } catch { checkpoint = null; }
  if (!checkpoint || checkpoint.sourceHash !== source.sourceHash || checkpoint.model !== model) checkpoint = {documentId, sourceHash: source.sourceHash, sourceLanguage: 'en', glossaryVersion: glossary.version, model, dtype: 'q8', reviewStatus: 'not-reviewed', translations: {}};
  const started = Date.now();
  async function translatePlain(text) {
    if (!text.trim() || !/\p{L}/u.test(text)) return text;
    const result = [];
    for (const segment of segments(text)) {
      const key = hash(segment);
      if (!checkpoint.translations[key]) {
        const output = await translator(segment, {max_new_tokens: 320, repetition_penalty: 1.05});
        const translated = output[0]?.translation_text;
        if (!translated?.trim()) throw new Error('Empty model output; checkpoint retained');
        if (segment.length > 100 && (translated.length < segment.length * 0.4 || translated.length > segment.length * 2.8)) throw new Error('Implausible output length; checkpoint retained, no edition published');
        checkpoint.translations[key] = {source: segment, target: translated, reviewed: false};
        checkpoint.updatedAt = new Date().toISOString();
        await atomicJson(checkpointPath, checkpoint);
      }
      result.push(checkpoint.translations[key].target);
    }
    return result.join(' ');
  }
  async function translateMarkdown(markdown) {
    let frontmatter = false, fence = false;
    const lines = markdown.split('\n'), translated = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && line === '---') {frontmatter = true; translated.push(line); continue;}
      if (frontmatter) {translated.push(line); if(line === '---') frontmatter = false; continue;}
      if (/^\s*```/.test(line)) {fence = !fence; translated.push(line); continue;}
      if (fence || !line.trim() || /^\s*(?:<!--|---|https?:|[-*]\s+[^\n]*https?:)/.test(line)) {translated.push(line); continue;}
      // Protect destinations, HTML anchors and reference markers from the model.
      const protectedParts = [];
      const safe = line.replace(/https?:[^\s)]+|<[^>]+>|\[\^[^\]]+\]|\{#[^}]+\}/g, value => {protectedParts.push(value); return `ZXQ${protectedParts.length - 1}QXZ`;});
      const prefix = safe.match(/^(?:\s*#{1,6}\s+|\s*[-*>]\s+|\s*\d+[.)]\s+)/)?.[0] || '';
      const output = await translatePlain(safe.slice(prefix.length));
      let restored = output.replace(/ZXQ\s*(\d+)\s*QXZ/g, (_, n) => protectedParts[Number(n)]);
      if (protectedParts.some(part => !restored.includes(part))) throw new Error('Protected token lost in translation; no edition published');
      translated.push(prefix + restored);
    }
    return translated.join('\n');
  }
  const payload = structuredClone(source.payload);
  for (const chunk of payload.chunks) {chunk.markdown = await translateMarkdown(chunk.markdown ?? chunk.text); delete chunk.text; console.log(`${documentId}: chunk ${chunk.index} complete; ${Math.round((Date.now()-started)/1000)} seconds`);}
  payload.title = await translatePlain(payload.title);
  for (const entry of payload.toc || []) entry.title = await translatePlain(entry.title);
  payload.translation = {language: 'es', status: 'draft', sourceHash: source.sourceHash, method: 'Offline OPUS-MT en-es machine translation; not specialist-reviewed', glossaryVersion: glossary.version};
  await registerEdition(document, source, payload, {status: 'draft', translator: 'Xenova/opus-mt-en-es (local int8)', method: 'machine-translation', review: {status: 'not-reviewed', note: 'Draft. Theological and stylistic review required.'}, completeness: {scope: 'entire catalogued payload', chunks: payload.chunks.length, sourceChunks: source.payload.chunks.length}, glossaryVersion: glossary.version});
}
export async function validate() {
  const documents = await getDocuments(), manifest = JSON.parse(await readFile(join(root, 'data/editions/manifest.json'), 'utf8'));
  const errors = [], rows = [];
  if (manifest.revision !== editionRevision(manifest.editions)) errors.push('Manifest revision missing or does not match deterministic editions digest');
  for (const edition of manifest.editions) {
    const document = documents.find(document => document.id === edition.documentId);
    if (!document) {errors.push(`Unknown document ${edition.documentId}`); continue;}
    const source = await getSource(document), translated = JSON.parse(gunzipSync(await readFile(join(root, edition.contentFile))));
    const localErrors = [];
    if (source.sourceHash !== edition.sourceHash) localErrors.push('sourceHash mismatch');
    const actualTargetHash = translationContentHash(translated);
    if (edition.targetHash !== actualTargetHash) localErrors.push('targetHash mismatch: translated payload content differs from approved manifest');
    if (translated.translation?.targetHash && translated.translation.targetHash !== actualTargetHash) localErrors.push('payload translation.targetHash mismatch');
    if (translated.id !== source.payload.id) localErrors.push('payload id changed');
    if (translated.chunks.length !== source.payload.chunks.length) localErrors.push('chunk count changed');
    if (JSON.stringify(translated.chunks.map(c=>c.index)) !== JSON.stringify(source.payload.chunks.map(c=>c.index))) localErrors.push('chunk indexes changed');
    if (JSON.stringify((translated.toc||[]).map(({title,...entry})=>entry)) !== JSON.stringify((source.payload.toc||[]).map(({title,...entry})=>entry))) localErrors.push('toc anchors or chunk references changed');
    if (translated.chunks.some(c=>!(c.markdown??c.text)?.trim())) localErrors.push('empty chunk');
    if (!['draft','reviewed'].includes(edition.status)) localErrors.push('invalid status');
    if (edition.status === 'reviewed' && !edition.review?.scope) localErrors.push('reviewed edition lacks review scope');
    const detected = detectLanguage(translated.chunks.map(c=>c.markdown??c.text).join('\n'));
    if (detected.language !== 'es') localErrors.push(`output language ${detected.language}`);
    errors.push(...localErrors.map(error=>`${edition.documentId}: ${error}`));
    rows.push({documentId: edition.documentId, status: edition.status, sourceHashVerified: source.sourceHash === edition.sourceHash, targetHashVerified: edition.targetHash === actualTargetHash, chunks: translated.chunks.length, outputLanguage: detected.language, errors: localErrors});
  }
  const report = {generatedAt: new Date().toISOString(), revision: manifest.revision, revisionVerified: manifest.revision === editionRevision(manifest.editions), editions: rows.length, rows, errors};
  await atomicJson(join(root, 'reports/translation-validation.json'), report);
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) throw new Error(`${errors.length} validation errors`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, argument] = process.argv.slice(2);
  if (command === 'inventory') await inventory();
  else if (command === 'plan') await planCorpus();
  else if (command === 'snapshot') await snapshotSource(argument);
  else if (command === 'rebase-reviews') await rebaseReviews();
  else if (command === 'translate') await translate(argument);
  else if (command === 'validate') await validate();
  else console.log('node tools/translate-library.mjs inventory|plan|snapshot <documentId>|rebase-reviews|translate <documentId>|validate');
}
