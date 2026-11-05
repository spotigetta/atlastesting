import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('data/catalog.json', root)));
const data = JSON.parse(await readFile(new URL('data/discovery-library.json', root)));
const source = await readFile(new URL('scripts/discovery-shorts.js', root), 'utf8');
function setup(c = structuredClone(catalog), d = data) {
  const window = {ATLAS_CATALOG:c, ATLAS_DISCOVERY_LIBRARY:d};
  const context = vm.createContext({window});
  vm.runInContext(source, context);
  return {window, context, items:c.shorts.filter(s => s.id.startsWith('library-question-'))};
}
test('each sourced topic becomes a question with a reveal and a precise reader link', () => {
  const {items} = setup();
  assert.equal(items.length, 12);
  for (const item of items) {
    assert.equal(item.type, 'question');
    assert.ok(item.reveal && item.sourceDocumentId);
    assert.ok(item.sourceReaderUrl.startsWith('#/reader/') && item.sourceReaderUrl.includes('?q='));
    assert.match(item.reference, /Síntesis editorial/);
    assert.ok(data.topics.some(t => item.title === t.question && item.reveal === t.answer));
  }
});
test('private and missing source documents cannot become public questions', () => {
  const c = structuredClone(catalog);
  for (const library of c.libraries) library.unlockFeature = 'locked';
  assert.equal(setup(c).items.length, 0);
  assert.equal(setup({libraries:[],shorts:[]}).items.length, 0);
});
test('loading the adapter twice does not duplicate cards or replace existing shorts', () => {
  const original = catalog.shorts.length;
  const {window, context} = setup();
  vm.runInContext(source, context);
  assert.equal(window.ATLAS_CATALOG.shorts.length, original + 12);
});
