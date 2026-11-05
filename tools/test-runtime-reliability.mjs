import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';

// Contract tests, not browser/visual tests. No production code is rewritten.
const root = new URL('../', import.meta.url);
const source = async file => readFile(new URL(file, root), 'utf8');
const base = 'https://atlas.example/atlas/';
const evaluate = async (file, globals) => {
  const context = vm.createContext({ URL, Response, Request, DecompressionStream, console, ...globals });
  vm.runInContext(await source(file), context, { filename: fileURLToPath(new URL(file, root)) });
  return context;
};
const response = (value, url = `${base}data/example.json`, status = 200) => {
  const result = new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  Object.defineProperty(result, 'url', { value: url });
  return result;
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

async function runtimeHarness(fetch, database = new Map()) {
  const window = { DecompressionStream, AtlasDatabase: {
    put: async (key, value) => database.set(key, { value }),
    get: async key => database.get(key)
  } };
  await evaluate('scripts/runtime.js', { window, document: { baseURI: `${base}index.html` }, fetch });
  return { runtime: window.AtlasRuntime, database, window };
}

test('runtime resolves nested public paths and deduplicates concurrent reads', async () => {
  let calls = 0;
  const { runtime } = await runtimeHarness(async url => { calls++; return response({ id: 'a' }, url); });
  assert.equal(runtime.url('/data/documents/a.json.gz'), `${base}data/documents/a.json.gz`);
  const values = await Promise.all([runtime.fetchJson('data/example.json'), runtime.fetchJson('data/example.json')]);
  assert.equal(calls, 1);
  assert.equal(values[0].id, 'a');
  assert.equal(values[0], values[1]);
});

test('runtime failed request can be retried without reloading', async () => {
  let calls = 0;
  const { runtime } = await runtimeHarness(async url => {
    if (++calls === 1) throw new Error('temporary offline');
    return response({ id: 'recovered' }, url);
  });
  await assert.rejects(runtime.fetchJson('data/example.json'), /temporary offline/);
  assert.equal((await runtime.fetchJson('data/example.json')).id, 'recovered');
  assert.equal(calls, 2);
});

test('runtime newly read document survives offline in a new runtime instance', async () => {
  const database = new Map();
  const path = 'data/documents/new.json';
  const online = await runtimeHarness(async url => response({ id: 'new', chunks: [{ markdown: 'Guardado' }] }, url), database);
  await online.runtime.fetchJson(path);
  const offline = await runtimeHarness(async () => { throw new Error('offline'); }, database);
  assert.equal((await offline.runtime.fetchJson(path)).chunks[0].markdown, 'Guardado');
});

test('runtime fresh response replaces an older in-memory value', async () => {
  let version = 1;
  const { runtime } = await runtimeHarness(async url => response({ version }, url));
  assert.equal((await runtime.fetchJson('data/example.json')).version, 1);
  version = 2;
  assert.equal((await runtime.fetchJson('data/example.json', { fresh: true })).version, 2);
  assert.equal((await runtime.fetchJson('data/example.json')).version, 2);
});

test('content revisions invalidate memory and persistent keys without changing document ids', async () => {
  let version = 1;
  const calls = [], database = new Map();
  const harness = await runtimeHarness(async url => { calls.push(url); return response({ id: 'same-document', version }, url); }, database);
  harness.window.ATLAS_CATALOG = { meta: { contentRevision: 'content-1', searchRevision: 'search-1' } };
  assert.equal((await harness.runtime.fetchJson('data/documents/same.json')).version, 1);
  assert.equal((await harness.runtime.fetchJson('data/search/manifest.json')).version, 1);
  version = 2;
  harness.window.ATLAS_CATALOG.meta = { contentRevision: 'content-2', searchRevision: 'search-2' };
  assert.equal((await harness.runtime.fetchJson('data/documents/same.json')).version, 2);
  assert.equal((await harness.runtime.fetchJson('data/search/manifest.json')).version, 2);
  assert.deepEqual(calls.map(url => new URL(url).searchParams.get('revision')), ['content-1', 'search-1', 'content-2', 'search-2']);
  assert.equal(new URL(harness.runtime.url('data/catalog.json')).search, '');
  assert.equal(new URL(harness.runtime.url('scripts/reader.js')).search, '');
  const offline = await runtimeHarness(async () => { throw new Error('offline'); }, database);
  offline.window.ATLAS_CATALOG = harness.window.ATLAS_CATALOG;
  assert.equal((await offline.runtime.fetchJson('data/documents/same.json')).version, 2);
});

test('edition revision invalidates an updated translation at the same public path', async () => {
  let version = 1;
  const h = await runtimeHarness(async url => response({ id: 'original-id', version }, url));
  h.window.ATLAS_EDITIONS = { revision: 'edition-1' };
  assert.equal((await h.runtime.fetchJson('data/editions/work.es.json')).version, 1);
  version = 2;
  h.window.ATLAS_EDITIONS.revision = 'edition-2';
  assert.equal((await h.runtime.fetchJson('data/editions/work.es.json')).version, 2);
  assert.equal(new URL(h.runtime.url('data/editions/work.es.json')).searchParams.get('revision'), 'edition-2');
  assert.equal(new URL(h.runtime.url('data/editions/manifest.json')).search, '');
  const offline = await runtimeHarness(async () => { throw new Error('offline'); }, h.database);
  offline.window.ATLAS_EDITIONS = h.window.ATLAS_EDITIONS;
  assert.equal((await offline.runtime.fetchJson('data/editions/work.es.json')).version, 2);
});

test('an older concurrent response cannot overwrite refreshed offline content', async () => {
  const old = deferred(), database = new Map();
  let calls = 0;
  const { runtime } = await runtimeHarness(async url => ++calls === 1 ? old.promise : response({ version: 2 }, url), database);
  const slow = runtime.fetchJson('data/example.json');
  await runtime.fetchJson('data/example.json', { fresh: true });
  old.resolve(response({ version: 1 }));
  await slow;
  const offline = await runtimeHarness(async () => { throw new Error('offline'); }, database);
  assert.equal((await offline.runtime.fetchJson('data/example.json')).version, 2);
});

test('runtime decodes actual gzip JSON bytes', async () => {
  const { runtime } = await runtimeHarness(async url => {
    const result = new Response(gzipSync(JSON.stringify({ id: 'compressed', text: 'Oración' })));
    Object.defineProperty(result, 'url', { value: url });
    return result;
  });
  assert.equal((await runtime.fetchJson('data/documents/example.json.gz')).text, 'Oración');
});

async function searchHarness(fetchJson) {
  const doc = { id: 'doc', title: 'Documento', libraryId: 'lib', contentFile: 'data/documents/doc.json' };
  const window = { Atlas: { storage: { isFeatureUnlocked: () => true } }, AtlasRuntime: { fetchJson }, ATLAS_CATALOG: {
    libraries: [{ id: 'lib', documents: [doc] }], collections: [], routes: [], editorial: {}
  } };
  await evaluate('scripts/search.js', { window });
  return window.Atlas.search;
}
const index = { documents: [{ id: 'doc' }], shards: { f: { file: 'data/search/f.json' } } };

test('search retries a failed manifest after connection returns', async () => {
  let manifestCalls = 0;
  const search = await searchHarness(async file => {
    if (file.endsWith('manifest.json')) {
      if (++manifestCalls === 1) throw new Error('manifest offline');
      return index;
    }
    return { terms: { fidelidad: [0, 2] } };
  });
  await assert.rejects(search.runFullText('fidelidad'), /manifest offline/);
  assert.equal((await search.runFullText('fidelidad'))[0].id, 'doc');
  assert.equal(manifestCalls, 2);
});

test('search retries a failed shard after connection returns', async () => {
  let shardCalls = 0;
  const search = await searchHarness(async file => {
    if (file.endsWith('manifest.json')) return index;
    if (++shardCalls === 1) throw new Error('shard offline');
    return { terms: { fidelidad: [0, 2] } };
  });
  await assert.rejects(search.runFullText('fidelidad'), /shard offline/);
  assert.equal((await search.runFullText('fidelidad'))[0].occurrences, 2);
  assert.equal(shardCalls, 2);
});

test('literal search confirms the indexed term against document content', async () => {
  const search = await searchHarness(async file => file.endsWith('manifest.json') ? index
    : file.includes('/search/') ? { terms: { fidelidad: [0, 7] } }
    : { chunks: [{ markdown: 'Texto sin la palabra del índice.' }] });
  assert.equal((await search.runLiteral('fidelidad')).length, 0);
});

async function workerHarness(fetch) {
  const listeners = new Map(), storage = new Map();
  const keyOf = value => new URL(typeof value === 'string' ? value : value.url, base).href;
  const caches = {
    open: async name => {
      if (!storage.has(name)) storage.set(name, new Map());
      const values = storage.get(name);
      return {
        addAll: async files => { for (const file of files) values.set(keyOf(file), new Response(file)); },
        match: async key => values.get(keyOf(key))?.clone(),
        put: async (key, value) => { values.set(keyOf(key), value.clone()); }
      };
    },
    keys: async () => [...storage.keys()],
    delete: async name => storage.delete(name),
    match: async key => {
      for (const values of storage.values()) if (values.has(keyOf(key))) return values.get(keyOf(key)).clone();
    }
  };
  const self = { location: { origin: new URL(base).origin }, skipWaiting() {},
    clients: { claim: async () => {} }, addEventListener: (type, handler) => listeners.set(type, handler) };
  // Network promises settle in these tests; avoid real timeout timers retaining Node.
  const context = await evaluate('service-worker.js', { self, caches, fetch, setTimeout: () => 0 });
  const dispatch = async (type, extras = {}) => {
    let result;
    const promises = [];
    listeners.get(type)({ ...extras, waitUntil: p => promises.push(p), respondWith: p => { result = p; } });
    const value = await result;
    await Promise.all(promises);
    return value;
  };
  return { caches, dispatch, context };
}

test('offline shell includes every bootstrap module', async () => {
  const worker = await workerHarness(async () => { throw new Error('offline'); });
  await worker.dispatch('install');
  const bootstrap = await source('scripts/bootstrap.js');
  const modules = [...bootstrap.matchAll(/"(scripts\/[^"\n]+\.js)"/g)].map(match => match[1]);
  const missing = [];
  for (const module of modules) if (!await worker.caches.match(`./${module}`)) missing.push(module);
  assert.deepEqual(missing, [], `Bootstrap modules missing from installed offline shell: ${missing.join(', ')}`);
});

test('offline shell includes all local stylesheets linked from index', async () => {
  const worker = await workerHarness(async () => { throw new Error('offline'); });
  await worker.dispatch('install');
  const html = await source('index.html');
  const styles = [...html.matchAll(/href="(styles\/[^"\n]+\.css)"/g)].map(match => match[1]);
  assert.ok(styles.length > 20, 'Stylesheet inventory must not be empty or truncated');
  const missing = [];
  for (const style of styles) if (!await worker.caches.match(`./${style}`)) missing.push(style);
  assert.deepEqual(missing, [], `Local styles missing from installed offline shell: ${missing.join(', ')}`);
});

test('every offline shell path exists on disk before installation', async () => {
  const worker = await workerHarness(async () => { throw new Error('offline'); });
  const files = vm.runInContext('SHELL', worker.context);
  for (const file of files) await assert.doesNotReject(access(new URL(file, root)), `Missing offline shell path: ${file}`);
});

test('service worker stores a newly opened document for later offline reads', async () => {
  let offline = false;
  const worker = await workerHarness(async request => {
    if (offline) throw new Error('offline');
    return response({ id: 'new' }, request.url);
  });
  const request = new Request(`${base}data/documents/new.json`);
  assert.equal((await (await worker.dispatch('fetch', { request })).json()).id, 'new');
  offline = true;
  assert.equal((await (await worker.dispatch('fetch', { request })).json()).id, 'new');
});

test('service worker stores translation payloads and refreshes their manifest', async () => {
  let offline = false, version = 1;
  const worker = await workerHarness(async request => {
    if (offline) throw new Error('offline');
    return response({ version }, request.url);
  });
  const payloadRequest = new Request(`${base}data/editions/work.es.json?revision=one`);
  const manifestRequest = new Request(`${base}data/editions/manifest.json`);
  await worker.dispatch('fetch', { request: payloadRequest });
  await worker.dispatch('fetch', { request: manifestRequest });
  version = 2;
  assert.equal((await (await worker.dispatch('fetch', { request: manifestRequest })).json()).version, 2);
  offline = true;
  assert.equal((await (await worker.dispatch('fetch', { request: payloadRequest })).json()).version, 1);
  assert.equal((await (await worker.dispatch('fetch', { request: manifestRequest })).json()).version, 2);
});

test('service worker honors an explicit document refresh while keeping offline fallback', async () => {
  let version = 1;
  const worker = await workerHarness(async request => response({ version }, request.url));
  const url = `${base}data/documents/new.json`;
  await worker.dispatch('fetch', { request: new Request(url) });
  version = 2;
  const request = new Request(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
  assert.equal((await (await worker.dispatch('fetch', { request })).json()).version, 2);
});

test('service worker returns cached catalog when server answers HTTP 503', async () => {
  let failing = false;
  const worker = await workerHarness(async request => response({ version: 1 }, request.url, failing ? 503 : 200));
  const request = new Request(`${base}data/catalog.json`);
  await worker.dispatch('fetch', { request });
  failing = true;
  const fallback = await worker.dispatch('fetch', { request });
  assert.equal(fallback.status, 200);
  assert.equal((await fallback.json()).version, 1);
});

async function readerHarness(fetchJson, dom = {}) {
  const button = () => ({
    disabled: false, events: new Map(),
    addEventListener(type, callback, options = {}) { this.events.set(type, { callback, once: Boolean(options.once) }); },
    click() {
      const event = this.events.get('click');
      if (this.disabled || !event) return;
      if (event.once) this.events.delete('click');
      event.callback({ currentTarget: this });
    }
  });
  const main = {
    markup: '', buttons: new Map(),
    get innerHTML() { return this.markup; },
    set innerHTML(value) {
      this.markup = value;
      this.buttons = new Map();
      for (const name of ['data-reader-retry', 'data-reader-error-library']) {
        if (value.includes(name)) this.buttons.set(`[${name}]`, button());
      }
    },
    querySelector(selector) { return this.buttons.get(selector) ?? null; }
  };
  const saved = new Map(), intervals = new Map(), annotations = new Map();
  let interval = 0;
  const library = { id: 'lib', short: 'Lib', tone: 'sage', documents: [] };
  const doc = { id: 'doc', title: 'Documento', words: 100, category: 'Texto', library, contentFile: 'doc.json' };
  library.documents.push(doc);
  const window = { getSelection: () => null, setTimeout: () => 0, AtlasRuntime: { fetchJson }, Atlas: {
    storage: {
      getReaderProgress: id => saved.get(id), saveReaderProgress: (id, value) => saved.set(id, value),
      getAnnotations: id => annotations.get(id) || [], isFavorite: () => false, recordReading() {},
      addAnnotation: (id, value) => annotations.set(id, [...(annotations.get(id) || []), value])
    }, data: { documents: [doc], documentMap: new Map([[doc.id, doc]]), normalize: value => value,
      catalog: { collections: [], shorts: [] } }, library: { icon: () => '', empty: message => message }
  } };
  const context = await evaluate('scripts/reader.js', {
    window, document: { querySelector: selector => selector === '#main' ? main : dom.select?.(selector) ?? null,
      querySelectorAll: selector => dom.all?.(selector) ?? [], addEventListener() {}, getElementById: () => null },
    clearTimeout() {}, setTimeout: () => 0, clearInterval: id => intervals.delete(id),
    setInterval: fn => { intervals.set(++interval, fn); return interval; }, requestAnimationFrame: dom.animation ?? (() => {}),
    location: { hash: '#/reader/doc' }, history: { length: 1, back() {} }
  });
  return { reader: window.Atlas.reader, main, doc, saved, intervals, context, annotations };
}
const payload = { id: 'doc', chunks: [{ index: 0, markdown: '# Título\n\nTexto de lectura.' }], toc: [] };

test('leaving a pending reader does not replace the new route after load success', async () => {
  const loading = deferred();
  const { reader, main, doc, intervals } = await readerHarness(() => loading.promise);
  const opening = reader.open(doc);
  reader.stop();
  main.innerHTML = '<h1>Biblioteca</h1>';
  loading.resolve(payload);
  await opening;
  assert.equal(main.innerHTML, '<h1>Biblioteca</h1>');
  assert.equal(intervals.size, 0);
});

test('leaving a pending reader does not replace the new route after load error', async () => {
  const loading = deferred();
  const { reader, main, doc } = await readerHarness(() => loading.promise);
  const opening = reader.open(doc);
  reader.stop();
  main.innerHTML = '<h1>Biblioteca</h1>';
  loading.reject(new Error('offline'));
  await opening;
  assert.equal(main.innerHTML, '<h1>Biblioteca</h1>');
});

test('reader can reopen a document after a failed load', async () => {
  let calls = 0;
  const { reader, main, doc, saved } = await readerHarness(async () => {
    if (++calls === 1) throw new Error('temporary offline');
    return payload;
  });
  await reader.open(doc);
  assert.match(main.innerHTML, /No se pudo abrir/);
  assert.match(main.innerHTML, /Volver a la biblioteca/);
  const retry = main.querySelector('[data-reader-retry]');
  assert.ok(retry, 'Load failure must expose a working local retry control');
  retry.click();
  retry.click();
  assert.equal(retry.disabled, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2, 'Retry must make exactly one new attempt');
  assert.match(main.innerHTML, /reader-immersive/);
  reader.stop();
  assert.equal(saved.get(doc.id).chunkIndex, 0);
});

test('continuous progress uses visible fragment geometry, not proportional fragment count', async () => {
  const scroll = { scrollTop: 250, scrollHeight: 2000, clientHeight: 500, addEventListener() {}, getBoundingClientRect: () => ({ top: 0 }) };
  const sections = [
    { dataset: { chunk: '0' }, getBoundingClientRect: () => ({ top: -200, bottom: -100, height: 100 }) },
    { dataset: { chunk: '1' }, getBoundingClientRect: () => ({ top: -100, bottom: 900, height: 1000 }) }
  ];
  const { reader, doc, saved } = await readerHarness(async () => ({ ...payload, chunks: [...payload.chunks, { index: 1, markdown: 'Fragmento largo.' }] }), {
    select: selector => selector === '.reader-scroll' ? scroll : null,
    all: selector => selector === '.reader-chunk' ? sections : []
  });
  saved.set(doc.id, { continuous: true, chunkIndex: 1 });
  await reader.open(doc);
  reader.stop();
  assert.equal(saved.get(doc.id).chunkIndex, 1);
  assert.equal(saved.get(doc.id).chunkRatio, 0.1);
});

test('continuous progress from a longer old payload restores to the last valid fragment', async () => {
  const frames = [];
  const scroll = { scrollTop: 0, scrollHeight: 2200, clientHeight: 500, addEventListener() {}, getBoundingClientRect: () => ({ top: 0 }) };
  const app = { addEventListener() {} };
  const section = { getBoundingClientRect: () => ({ top: 1000, bottom: 2000, height: 1000 }) };
  const { reader, doc, saved } = await readerHarness(async () => ({ ...payload, chunks: [...payload.chunks, { index: 1, markdown: 'Último fragmento.' }] }), {
    animation: fn => frames.push(fn),
    select: selector => selector === '.reader-scroll' ? scroll : selector === '.reader-app' ? app
      : selector === '.reader-chunk[data-chunk="1"]' ? section : null
  });
  saved.set(doc.id, { continuous: true, chunkIndex: 99, chunkRatio: 0.2 });
  await reader.open(doc);
  for (const frame of frames) frame();
  assert.equal(scroll.scrollTop, 1200);
  reader.stop();
});

test('reader back uses document details when there is no previous history entry', async () => {
  const events = new Map(), app = { addEventListener: (type, fn) => events.set(type, fn) };
  const { reader, doc, context, saved } = await readerHarness(async () => payload, {
    select: selector => selector === '.reader-app' ? app : null
  });
  await reader.open(doc);
  const button = { dataset: { readerAction: 'exit' } };
  events.get('click')({ target: { closest: selector => selector === 'button' ? button : null } });
  assert.equal(context.location.hash, '/document/doc');
  assert.equal(saved.get(doc.id).chunkIndex, 0);
  reader.stop();
});

test('reader back uses previous history, with fallback only if navigation did not occur', async () => {
  const events = new Map(), timers = [], app = { addEventListener: (type, fn) => events.set(type, fn) };
  const { reader, doc, context } = await readerHarness(async () => payload, {
    select: selector => selector === '.reader-app' ? app : null
  });
  context.history.length = 3;
  context.window.setTimeout = fn => timers.push(fn);
  let backed = 0;
  context.history.back = () => { backed++; context.location.hash = '#/biblioteca'; };
  await reader.open(doc);
  const button = { dataset: { readerAction: 'exit' } };
  const click = () => events.get('click')({ target: { closest: selector => selector === 'button' ? button : null } });
  click(); timers.shift()();
  assert.equal(backed, 1);
  assert.equal(context.location.hash, '#/biblioteca');
  context.location.hash = '#/reader/doc';
  context.history.back = () => { backed++; };
  click(); timers.shift()();
  assert.equal(context.location.hash, '/document/doc');
  reader.stop();
});

test('reader note submission stores the text in the current document and closes its editor', async () => {
  const events = new Map(), field = { value: 'Una nota personal' }, layer = { hidden: false };
  const form = { addEventListener: (type, fn) => events.set(type, fn) };
  const { reader, doc, annotations } = await readerHarness(async () => payload, {
    select: selector => ({ '#reader-note-form': form, '#reader-note-text': field, '#reader-note-layer': layer }[selector] || null)
  });
  await reader.open(doc);
  let prevented = false;
  events.get('submit')({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(annotations.get(doc.id)[0].note, 'Una nota personal');
  assert.equal(annotations.get(doc.id)[0].type, 'note');
  assert.equal(annotations.get(doc.id)[0].chunkIndex, 0);
  assert.equal(layer.hidden, true);
  assert.equal(field.value, '');
  reader.stop();
});

test('saved document, progress and annotation survive storage module reload', async () => {
  const values = new Map();
  const localStorage = {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  const load = async () => {
    const window = {};
    await evaluate('scripts/storage.js', { window, localStorage, structuredClone });
    return window.Atlas.storage;
  };
  const first = await load();
  first.toggleFavorite('documents', 'new-document');
  first.saveReaderProgress('new-document', { chunkIndex: 3, scrollRatio: 0.4, continuous: true, chunkRatio: 0.2 });
  first.addAnnotation('new-document', { type: 'note', text: 'Fragmento', note: 'Nota personal', chunkIndex: 3 });
  const second = await load();
  assert.equal(second.isFavorite('documents', 'new-document'), true);
  assert.equal(second.getReaderProgress('new-document').chunkIndex, 3);
  assert.equal(second.getReaderProgress('new-document').chunkRatio, 0.2);
  assert.equal(second.getAnnotations('new-document')[0].note, 'Nota personal');
});

const settleLiturgy = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const liturgySections = [
  { id: 'laudes', title: 'Laudes', category: 'horas', sha256: 'a'.repeat(64) },
  { id: 'visperas', title: 'Vísperas', category: 'horas', sha256: 'b'.repeat(64) },
  { id: 'lecturas', title: 'Lecturas de la misa', category: 'misa', sha256: 'c'.repeat(64) },
  { id: 'ordinario-base', title: 'Ordinario del Misal', category: 'misal', sha256: 'd'.repeat(64) }
].map(s => ({ ...s, object: `data/liturgy/objects/${s.sha256}.json`, sourceUrl: 'https://www.ibreviary.com/m2/' }));

function liturgyData() {
  const dates = ['2026-11-05', '2026-11-06'];
  const data = new Map([['data/liturgy/manifest.json', {
    schemaVersion: 1, availableFrom: dates[0], availableTo: dates[1], updatedAt: '2026-11-05T10:00:00Z',
    calendar: { notice: 'Comprueba el calendario local.', referenceUrl: 'https://www.conferenciaepiscopal.es/' },
    dates: dates.map(date => ({ date, file: `data/liturgy/days/${date}.json` })),
    common: [liturgySections[3]], attribution: 'Textos castellanos atribuidos a la CEE por iBreviary.'
  }]]);
  for (const date of dates) data.set(`data/liturgy/days/${date}.json`, {
    date, confirmedProviderDate: date, sourceCelebration: `Celebración del proveedor ${date}`,
    calendarStatus: date === dates[0] ? 'mismatch' : 'matched', calendarReason: 'Comprobación de la referencia española.',
    sections: liturgySections.slice(0, 3), errors: [{ id: 'oracion-ausente', title: 'Oración propia ausente' }]
  });
  for (const s of liturgySections) data.set(s.object, { html: `<p>Texto integrado de ${s.title}.</p>`, sha256: s.sha256 });
  return data;
}

async function liturgyHarness({ storedZone = 'Europe/Madrid', online = true, database = new Map(), data = liturgyData(), delay } = {}) {
  const listeners = new Map(), connectionListeners = new Map(), values = new Map([['atlas-liturgy-zone', storedZone]]), calls = [];
  const navigator = { onLine: online }, main = { innerHTML: '' }, status = { textContent: '' }, saveButton = { disabled: false }, anchors = new Map();
  const fragment = () => ({ nodeType: 11, childNodes: [], append(node) { this.childNodes.push(...(node.nodeType === 11 ? node.childNodes : [node])); } });
  const textNode = value => ({ nodeType: 3, textContent: value });
  const output = { textContent: '', contains(node) { return Boolean(node?.insideLiturgicalText); },
    replaceChildren(node) { this.textContent = node.childNodes.map(child => child.textContent).join(''); }, removeAttribute() {} };
  const h = await runtimeHarness(async url => {
    const path = new URL(url).pathname.slice(new URL(base).pathname.length);
    calls.push(path);
    if (!navigator.onLine) throw new Error('offline');
    if (delay) { const result = await delay(path); if (result !== undefined) return response(result, url); }
    if (!data.has(path)) return response({ error: 'Not found' }, url, 404);
    return response(data.get(path), url);
  }, database);
  const window = h.window;
  window.addEventListener = (type, fn) => connectionListeners.set(type, fn);
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-05T23:30:00Z'])); } }
  await evaluate('scripts/liturgy.js', {
    window, navigator, Date: FixedDate, queueMicrotask,
    localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    document: {
      baseURI: `${base}index.html`, addEventListener: (type, fn) => listeners.set(type, fn),
      getElementById: id => anchors.get(id) ?? null,
      querySelector: selector => ({ '#main': main, '#main .liturgy-page': main.innerHTML.includes('liturgy-page') ? {} : null,
        '#liturgy-text': output, '.liturgy-status': status, '#liturgy-save': saveButton }[selector] || null),
      createTextNode: textNode, createDocumentFragment: fragment,
      // Deliberately only parses text-only fixtures. HTML sanitation is tested by the importer's separate suite.
      createElement: tag => tag === 'template' ? { content: fragment(), set innerHTML(value) {
        this.content.childNodes = [textNode(value.replace(/<[^>]*>/g, ''))];
      } } : { append() {}, classList: [], getAttribute: () => null }
    }
  });
  const liturgy = window.Atlas.liturgy;
  const mount = async () => { main.innerHTML = liturgy.render(); await settleLiturgy(); };
  const change = async (id, value) => { listeners.get('change')({ target: { id, value } }); await settleLiturgy(); };
  const click = async (id, dataset = {}) => {
    const button = { id, dataset };
    listeners.get('click')({ target: { closest: selector => selector === 'button' ? button : null } });
    await settleLiturgy();
  };
  return { liturgy, listeners, connectionListeners, navigator, status, main, output, values, calls, database, data, window, anchors, mount, change, click };
}

test('liturgy calculates the civil day independently for Madrid and Canary Islands', async () => {
  const { liturgy } = await liturgyHarness();
  const now = new Date('2026-11-05T23:30:00Z');
  const madrid = liturgy.dayParts(now, 'Europe/Madrid');
  const canary = liturgy.dayParts(now, 'Atlantic/Canary');
  assert.equal(`${madrid.year}-${madrid.month}-${madrid.day} ${madrid.hour}`, '2026-11-06 00');
  assert.equal(`${canary.year}-${canary.month}-${canary.day} ${canary.hour}`, '2026-11-05 23');
  // Summer daylight-saving offsets differ from winter, but remain explicit.
  assert.equal(liturgy.dayParts(new Date('2026-07-01T22:30:00Z'), 'Europe/Madrid').day, '02');
  assert.equal(liturgy.dayParts(new Date('2026-07-01T22:30:00Z'), 'Atlantic/Canary').day, '01');
});

test('liturgy suggests hours but marks a mismatched calendar without inventing propers', async () => {
  const h = await liturgyHarness({ storedZone: 'Atlantic/Canary' }), { liturgy } = h;
  for (const [hour, expected] of [[0, 'compieta'], [5, 'compieta'], [6, 'lodi'], [9, 'lodi'], [10, 'ora_media'], [16, 'ora_media'], [17, 'vespri'], [20, 'vespri'], [21, 'compieta']]) {
    assert.equal(liturgy.suggestedHour(hour), expected);
  }
  await h.mount();
  assert.match(h.main.innerHTML, /No corresponde al propio español de esta fecha/);
  assert.match(h.main.innerHTML, /sin sustituir ni componer los propios que faltan/);
  await h.click('', { liturgyKind: 'misa' });
  assert.match(h.main.innerHTML, /Oración propia ausente/);
  assert.match(h.main.innerHTML, /Atlas no elige un prefacio ni sustituye los propios ausentes/);
  assert.equal(h.output.textContent, 'Texto integrado de Lecturas de la misa.');
});

test('liturgy loads the selected hour, civil date and common Misal inside Atlas', async () => {
  const h = await liturgyHarness();
  await h.mount();
  assert.match(h.main.innerHTML, /id="liturgy-date" type="date" value="2026-11-06"/);
  assert.equal(h.output.textContent, 'Texto integrado de Laudes.');
  await h.change('liturgy-section', 'visperas');
  assert.equal(h.output.textContent, 'Texto integrado de Vísperas.');
  await h.change('liturgy-date', '2026-11-05');
  assert.ok(h.calls.includes('data/liturgy/days/2026-11-05.json'));
  await h.click('', { liturgyKind: 'misal' });
  assert.equal(h.output.textContent, 'Texto integrado de Ordinario del Misal.');
  assert.match(h.main.innerHTML, /Texto común · no asignado automáticamente al día/);
  assert.doesNotMatch(h.main.innerHTML, /<form[^>]*action="https:\/\/www\.ibreviary/);
});

test('liturgy saves a day and Misal and opens them in a new offline runtime', async () => {
  const online = await liturgyHarness(); await online.mount();
  await online.click('liturgy-save');
  assert.match(online.main.innerHTML, /Textos del 2026-11-06 y del Misal guardados en este dispositivo/);
  const offline = await liturgyHarness({ online: false, database: online.database }); await offline.mount();
  assert.equal(offline.output.textContent, 'Texto integrado de Laudes.');
  await offline.change('liturgy-section', 'visperas');
  assert.equal(offline.output.textContent, 'Texto integrado de Vísperas.');
  await offline.click('', { liturgyKind: 'misal' });
  assert.equal(offline.output.textContent, 'Texto integrado de Ordinario del Misal.');
  offline.connectionListeners.get('offline')();
  assert.match(offline.status.textContent, /Sin conexión/);
  offline.navigator.onLine = true; offline.connectionListeners.get('online')();
  assert.match(offline.status.textContent, /Con conexión/);
  const unavailable = await liturgyHarness({ online: false }); await unavailable.mount();
  assert.match(unavailable.main.innerHTML, /No se pudieron cargar los textos/);
  assert.match(unavailable.main.innerHTML, /id="liturgy-retry"/);
});

test('liturgy never claims an offline download succeeded when storage cannot be confirmed', async () => {
  const h = await liturgyHarness(); await h.mount();
  h.window.AtlasDatabase.get = async () => undefined;
  await h.click('liturgy-save');
  assert.match(h.main.innerHTML, /No se completó la descarga/);
  assert.doesNotMatch(h.main.innerHTML, /y del Misal guardados en este dispositivo/);
});

test('internal Misal links scroll inside the liturgical text without native hash navigation', async () => {
  const h = await liturgyHarness(); await h.mount();
  let prevented = false, scrolled = false;
  h.anchors.set('CREDO', { insideLiturgicalText: true, scrollIntoView: () => { scrolled = true; } });
  const anchor = { insideLiturgicalText: true, getAttribute: () => '#CREDO' };
  h.listeners.get('click')({ target: { closest: selector => selector === 'a' ? anchor : null },
    preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(scrolled, true);
});

test('liturgy zone choice persists and Today follows that zone', async () => {
  const harness = await liturgyHarness({ storedZone: 'Atlantic/Canary' });
  await harness.mount();
  assert.match(harness.main.innerHTML, /id="liturgy-date" type="date" value="2026-11-05"/);
  await harness.click('liturgy-today');
  assert.match(harness.main.innerHTML, /value="2026-11-05"/);
  await harness.change('liturgy-zone', 'Europe/Madrid');
  assert.equal(harness.values.get('atlas-liturgy-zone'), 'Europe/Madrid');
  assert.match(harness.main.innerHTML, /id="liturgy-date" type="date" value="2026-11-06"/);
});

test('liturgy rejects a day with the wrong provider date and retries after recovery', async () => {
  const data = liturgyData(), file = 'data/liturgy/days/2026-11-06.json';
  const correct = data.get(file); data.set(file, { ...correct, confirmedProviderDate: '2026-11-05' });
  const h = await liturgyHarness({ data }); await h.mount();
  assert.match(h.main.innerHTML, /No se pudieron cargar los textos/);
  assert.equal(h.output.textContent, '');
  data.set(file, correct);
  await h.click('liturgy-retry');
  assert.equal(h.output.textContent, 'Texto integrado de Laudes.');
});

test('leaving while liturgical text loads cannot overwrite the new route', async () => {
  const pending = deferred();
  const h = await liturgyHarness({ delay: path => path === liturgySections[0].object ? pending.promise : undefined });
  await h.mount();
  h.main.innerHTML = '<h1>Biblioteca</h1>';
  pending.resolve(h.data.get(liturgySections[0].object));
  await settleLiturgy();
  assert.equal(h.main.innerHTML, '<h1>Biblioteca</h1>');
  assert.equal(h.output.textContent, '');
});
