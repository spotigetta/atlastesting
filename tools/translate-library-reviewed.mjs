/** Publish only complete, explicitly reviewed editorial translations. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root, hash, getDocuments, getSource, registerEdition, atomicJson, glossary } from './translate-library.mjs';

export const prepared = [
  {documentId: 'history-0166_Regle_de_Saint_Augustin_pour_les_serviteurs_de_Dieu', file: 'augustin-regla', title: 'Regla de san Agustín para los siervos de Dios', sourceLanguage: 'fr', scope: 'Tratado completo tal como aparece en el documento fuente catalogado.'},
  {documentId: 'history-0176_Augustin_de_la_discipline_chretienne', file: 'augustin-disciplina', title: 'De la disciplina cristiana', sourceLanguage: 'fr', scope: 'Tratado completo tal como aparece en el documento fuente catalogado.'},
  {documentId: 'history-0178_Augustin_de_l_utilite_du_jeune', file: 'augustin-ayuno', title: 'De la utilidad del ayuno', sourceLanguage: 'fr', scope: 'Tratado completo tal como aparece en el documento fuente catalogado.'},
  {documentId: 'vida-santos-1192-clare-crockett', file: 'clare-crockett', title: 'Clare Crockett', sourceLanguage: 'en', scope: 'Página fuente íntegra sobre la biografía; no contiene la traducción del libro comercial de 428 páginas que anuncia.'},
  {documentId: 'vida-santos-1191-darwin-ramos', file: 'darwin-ramos', title: 'Darwin Ramos', sourceLanguage: 'en', scope: 'Página biográfica fuente íntegra.'}
];

function headings(markdown) { return [...markdown.matchAll(/^(#{1,6})\s+(.+)$/gm)].map(match=>({level: match[1].length, title: match[2].trim()})); }
const urls = text => [...new Set(text.match(/https?:[^\s<>"\)]+/g) || [])].sort();
function structuralChecks(source, target) {
  const errors = [], sourceHeadings = headings(source.text), targetHeadings = headings(target);
  if (source.payload.chunks.length !== 1) errors.push('Curated importer requires one complete source chunk; use per-chunk files for multi-chunk works.');
  if (source.payload.toc.length !== sourceHeadings.length) errors.push('Source table of contents does not match source heading count.');
  if (JSON.stringify(sourceHeadings.map(h=>h.level)) !== JSON.stringify(targetHeadings.map(h=>h.level))) errors.push('Heading count or levels differ.');
  const sourceUrls = urls(source.text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''));
  for (const url of sourceUrls) if (!urls(target).includes(url)) errors.push(`Source body URL missing: ${url}`);
  if (target.length < source.text.length * 0.65) errors.push('Translation substantially shorter than source; completeness requires investigation.');
  return {errors, sourceHeadings, targetHeadings, sourceBodyUrls: sourceUrls.length, translatedBodyUrls: urls(target).length};
}

const documents = await getDocuments(), report = [];
const requested = process.argv[2];
for (const item of prepared.filter(item=>!requested || item.file === requested)) {
  const document = documents.find(document=>document.id === item.documentId);
  const source = await getSource(document);
  let target;
  try {target = await readFile(join(root, `data/editions/reviewed/${item.file}.es.md`), 'utf8');} catch {report.push({...item, state: 'not-prepared'}); continue;}
  const checks = structuralChecks(source, target), targetHash = hash(target);
  let review;
  try {review = JSON.parse(await readFile(join(root, `data/editions/reviewed/${item.file}.approval.json`), 'utf8'));} catch {review = null;}
  const row = {documentId: document.id, file: item.file, sourceHash: source.sourceHash, sourceTextHash: source.textHash, targetHash, sourceCharacters: source.text.length, translatedCharacters: target.length, checks};
  if (checks.errors.length) {report.push({...row, state: 'structural-check-failed'}); continue;}
  if (!review || review.status !== 'approved' || review.targetHash !== targetHash || review.sourceHash !== source.sourceHash || !review.reviewer || review.reviewer === review.translator || review.scope !== 'entire catalogued payload') {report.push({...row, state: 'awaiting-independent-ai-editorial-review'}); continue;}
  const payload = structuredClone(source.payload);
  payload.title = item.title;
  payload.words = (target.match(/\p{L}+(?:[’'-]\p{L}+)*/gu) || []).length;
  payload.chunks[0].markdown = target; delete payload.chunks[0].text;
  payload.toc = source.payload.toc.map((entry,index)=>({...entry, title: checks.targetHeadings[index].title}));
  payload.translation = {language: 'es', sourceLanguage: item.sourceLanguage, status: 'reviewed', sourceHash: source.sourceHash, sourceTextHash: source.textHash, targetHash, translator: review.translator, reviewMethod: 'ai-editorial', humanReviewed: false, glossaryVersion: glossary.version, notes: review.notes || [], scope: item.scope};
  const record = await registerEdition(document, source, payload, {status: 'reviewed', sourceLanguage: item.sourceLanguage, title: item.title, translator: 'Traducción propia al castellano asistida por IA', method: 'ai-authored-translation', reviewMethod: 'ai-editorial', reviewedAt: review.reviewedAt, reviewer: review.reviewer, review: {scope: review.scope, method: 'ai-editorial', reviewer: review.reviewer, humanReviewed: false, evidenceFile: `data/editions/reviewed/${item.file}.approval.json`, notes: review.notes || []}, completeness: {scope: item.scope, sourceChunks: source.payload.chunks.length, translatedChunks: payload.chunks.length, sourceHeadingCount: checks.sourceHeadings.length, translatedHeadingCount: checks.targetHeadings.length}, glossaryVersion: glossary.version, targetHash});
  report.push({...row, state: 'published-reviewed', contentFile: record.contentFile});
}
await atomicJson(join(root, 'data/editions/glossary.json'), glossary);
await atomicJson(join(root, 'reports/translation-prepared.json'), {generatedAt: new Date().toISOString(), note: 'Reviewed means a second AI agent compared the entire translation with the source. It does not mean official, ecclesiastical or human review.', documents: report});
console.log(JSON.stringify(report.map(({checks,...row})=>({...row, errors: checks?.errors})), null, 2));
