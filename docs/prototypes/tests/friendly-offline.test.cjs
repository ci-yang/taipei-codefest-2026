const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const workerSource = fs.readFileSync(path.join(__dirname, '../friendly-route/sw.js'), 'utf8');
const managerSource = fs.readFileSync(path.join(__dirname, '../friendly-route/offline.js'), 'utf8');
const CHANNEL = 'friendly-offline-v6';
const VERSION = 'friendly-resource-v6-20261107';
const SCOPE = 'https://example.test/app/';

function memoryCaches() {
  const values = new Map();
  return { values, async keys() { return [...values.keys()]; }, async delete(name) { return values.delete(name); }, async open(name) {
    if (!values.has(name)) values.set(name, new Map());
    const cache = values.get(name);
    const key = (request) => typeof request === 'string' ? request : request.url;
    return {
      async put(request, response) { cache.set(key(request), response.clone()); },
      async delete(request) { return cache.delete(key(request)); },
      async match(request, options = {}) {
        const requested = new URL(key(request));
        if (!options.ignoreSearch) return cache.get(requested.href)?.clone();
        for (const [url, response] of cache) if (new URL(url).origin === requested.origin && new URL(url).pathname === requested.pathname) return response.clone();
        return undefined;
      },
    };
  } };
}
function assetResponse(url, options = {}) {
  const pathname = new URL(url).pathname;
  const type = pathname.endsWith('.js') ? 'application/javascript' : pathname.endsWith('.css') ? 'text/css'
    : pathname.endsWith('.txt') ? 'text/plain' : 'text/html';
  const response = new Response(`test fixture: ${pathname}`, { headers: { 'Content-Type': options.type || type }, status: options.status || 200 });
  Object.defineProperty(response, 'url', { value: options.url || url });
  return response;
}
function worker({ scope = SCOPE, caches = memoryCaches(), fail = [], version = VERSION, canonicalIndex = false, responseUrl } = {}) {
  const listeners = new Map(); const requests = []; let sequence = 0; let offline = false;
  const self = { registration: { scope }, location: { origin: new URL(scope).origin },
    addEventListener(name, fn) { listeners.set(name, fn); }, skipWaiting: async () => {},
    clients: { claim: async () => {}, async get(id) { return { id, url: id === 'outside' ? 'https://example.test/other/' : `${scope}index.html` }; } } };
  const fetch = async (request, options) => {
    const url = typeof request === 'string' ? request : request.url; requests.push({ url, options });
    if (canonicalIndex && url.endsWith('index.html')) throw new TypeError('Fixture Pages 308 rejected by redirect:error');
    if (offline || fail.some((asset) => url.endsWith(asset))) throw new Error('Fixture network failure');
    if (fail.includes('html-instead-of-js') && url.endsWith('app.js')) return assetResponse(url, { type: 'text/html' });
    return assetResponse(url, { url: responseUrl });
  };
  vm.runInNewContext(workerSource.replaceAll(VERSION, version), { self, caches, fetch, URL, Response, AbortController, setTimeout, clearTimeout, console });
  return { caches, requests, setOffline(value) { offline = value; }, listeners,
    async message(action = 'INITIALIZE', overrides = {}) {
      const results = []; let waiting;
      const event = { data: { channel: CHANNEL, id: `message-${++sequence}`, action, online: true, ...overrides.data },
        source: { id: overrides.source || 'client' }, origin: overrides.origin || new URL(scope).origin,
        ports: [{ postMessage(value) { results.push(value); } }], waitUntil(value) { waiting = value; } };
      listeners.get('message')(event); if (waiting) await waiting; return results;
    },
    async fetch(url, options = {}) {
      let response;
      listeners.get('fetch')({ request: { url, method: options.method || 'GET', mode: options.mode || 'cors' }, respondWith(value) { response = value; } });
      return response ? await response : null;
    },
  };
}
const result = (messages) => messages.findLast((message) => message.type === 'result')?.status;

test('Pages canonical index redirect still caches both navigation entry points without following redirects', async () => {
  const env = worker({ canonicalIndex: true });
  assert.equal(result(await env.message()).state, 'ready');
  assert.equal(env.requests.filter(({ url }) => url === SCOPE).length, 2);
  assert(!env.requests.some(({ url }) => url.endsWith('index.html')));
  assert(env.requests.every(({ options }) => options.redirect === 'error'));
  env.setOffline(true);
  const count = env.requests.length;
  for (const url of [SCOPE, `${SCOPE}index.html`]) {
    const response = await env.fetch(url, { mode: 'navigate' });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /test fixture: \/app\//);
  }
  assert.equal(env.requests.length, count);
});
test('canonical entry handling does not accept response URLs outside the app scope', async () => {
  const env = worker({ responseUrl: 'https://example.test/another-app/' });
  const state = result(await env.message());
  assert.equal(state.state, 'partial');
  assert.equal(state.completed, 0);
  assert.equal(state.savedAt, null);
});

test('initial download reports progress and ready only after all 18 same-scope files are present', async () => {
  const env = worker(); const messages = await env.message(); const state = result(messages);
  assert.equal(state.state, 'ready'); assert.equal(state.completed, 18); assert.equal(state.total, 18); assert(state.savedAt > 0);
  assert.equal(state.failures.length, 0); assert(messages.filter((message) => message.type === 'progress').length >= 18);
  assert(messages.filter((message) => message.type === 'progress').every((message) => message.status.state === 'downloading' && message.status.savedAt === null));
  assert.equal(env.requests.length, 18); assert(env.requests.every(({ url }) => url.startsWith(SCOPE)));
  assert(env.requests.some(({ url }) => url.endsWith('resources-data.js')));
  assert(!env.requests.some(({ url }) => /tile.openstreetmap|latitude|longitude|[?]/.test(url)));
  const routeAssets = env.requests.filter(({ url }) => /routing|route-client/.test(url)).map(({ url }) => new URL(url).pathname);
  assert.deepEqual(routeAssets.sort(), ['/app/route-client.js','/app/routing-worker.js','/app/routing.js','/app/routing-data.js'].sort());
  assert.deepEqual(JSON.parse(JSON.stringify(state.baseMapBounds)), [[25.023, 121.546], [25.044, 121.574]]);
  const verified = result(await env.message('VERIFY')); assert.equal(verified.state, 'ready'); assert.equal(verified.savedAt, state.savedAt);
});
test('one missing component stays partial; downloaded app shell remains readable offline', async () => {
  const env = worker({ fail: ['resources-data.js'] }); const state = result(await env.message());
  assert.equal(state.state, 'partial'); assert.equal(state.savedAt, null); assert.equal(state.completed, 17);
  assert(state.failures.some((failure) => failure.asset === 'resources-data.js' && failure.label === '全市資源與類別'));
  env.setOffline(true);
  assert.equal((await env.fetch(`${SCOPE}index.html`, { mode: 'navigate' })).status, 200);
  assert.equal((await env.fetch(`${SCOPE}resources-data.js`)).status, 503);
  assert.equal(result(await env.message('VERIFY')).state, 'partial');
});
test('login HTML returned as JavaScript never becomes a ready offline package', async () => {
  const env = worker({ fail: ['html-instead-of-js'] }); const state = result(await env.message());
  assert.equal(state.state, 'partial'); assert(state.failures.some((failure) => failure.asset === 'app.js'));
});
test('offline reopening uses cached shell and data without fetching or persisting user query parameters', async () => {
  const env = worker(); await env.message(); const before = env.requests.length; env.setOffline(true);
  for (const url of [SCOPE, `${SCOPE}index.html?private=not-stored`, `${SCOPE}resources-data.js`, `${SCOPE}data.js`]) {
    const response = await env.fetch(url, { mode: url.includes('index') || url === SCOPE ? 'navigate' : 'cors' });
    assert.equal(response.status, 200);
  }
  assert.equal(env.requests.length, before);
  for (const values of env.caches.values.values()) for (const key of values.keys()) assert(!key.includes('private'));
  const state = result(await env.message('INITIALIZE', { data: { online: false } })); assert.equal(state.state, 'ready');
});
test('worker never intercepts external OSM tiles, non-GET, sibling apps, or unlisted data', async () => {
  const env = worker();
  for (const [url, method] of [['https://tile.openstreetmap.org/10/1/2.png', 'GET'],
    ['https://example.test/app-two/index.html', 'GET'], [`${SCOPE}private.json`, 'GET'], [`${SCOPE}route?latitude=25&longitude=121`, 'GET'], [`${SCOPE}index.html`, 'POST']]) {
    assert.equal(await env.fetch(url, { method }), null);
  }
  assert.equal(env.requests.length, 0);
});
test('missing cache entry is detected even when a saved manifest originally reported complete', async () => {
  const env = worker(); await env.message();
  const cacheName = (await env.caches.keys()).find((name) => name.includes(':assets:'));
  await (await env.caches.open(cacheName)).delete(`${SCOPE}data.js`);
  const state = result(await env.message('VERIFY')); assert.equal(state.state, 'partial'); assert.equal(state.savedAt, null);
  assert(state.failures.some((failure) => failure.asset === 'data.js'));
});
test('failed new version retains old complete package; only successful update replaces it', async () => {
  const caches = memoryCaches(); const old = worker({ caches, version: 'friendly-resource-v6-old' }); await old.message();
  const oldAssets = (await caches.keys()).find((name) => name.includes(':assets:'));
  const next = worker({ caches, fail: ['resources-data.js'] }); assert.equal(result(await next.message()).state, 'partial');
  assert((await caches.keys()).includes(oldAssets)); next.setOffline(true);
  assert.equal((await next.fetch(`${SCOPE}resources-data.js`)).status, 200);
  assert.equal(result(await next.message('VERIFY')).state, 'partial');
  const repaired = worker({ caches }); assert.equal(result(await repaired.message()).state, 'ready');
  assert(!(await caches.keys()).includes(oldAssets));
});
test('clear is scoped to v6 and preserves another application and prior-v4 cache', async () => {
  const caches = memoryCaches(); await caches.open('friendly-route-v4:/app/');
  await caches.open('friendly-route-v6:/another-app/:manifest');
  const env = worker({ caches }); await env.message(); assert.equal(result(await env.message('CLEAR')).state, 'idle');
  assert.deepEqual((await caches.keys()).sort(), ['friendly-route-v4:/app/', 'friendly-route-v6:/another-app/:manifest'].sort());
});
test('worker validates message channel, ID, action and real same-scope client before handling', async () => {
  const env = worker();
  for (const overrides of [{ data: { channel: 'bad' } }, { data: { id: '../../bad' } }, { data: { id: 7 } },
    { data: { action: 'GPS_SAVE' } }, { source: 'outside' }, { origin: 'https://other.test' }]) {
    assert.deepEqual(await env.message('INITIALIZE', overrides), []);
  }
  assert.equal(env.requests.length, 0);
});

function manager({ supported = true, online = true, reply } = {}) {
  const posts = []; const registrations = [];
  class MessageChannel {
    constructor() {
      this.port1 = { onmessage: null, closed: false, close() { this.closed = true; } };
      this.port2 = { postMessage: (data) => { if (!this.port1.closed) this.port1.onmessage?.({ data }); } };
    }
  }
  const active = { state: 'activated', postMessage(message, ports) { posts.push(message); reply(message, ports[0]); } };
  const registration = { scope: SCOPE, active };
  const window = { location: { href: SCOPE }, isSecureContext: true, caches: {}, MessageChannel,
    navigator: { onLine: online, ...(supported ? { serviceWorker: { getRegistration: async () => registration,
      register: async (...args) => { registrations.push(args); return registration; } } } : {}) } };
  vm.runInNewContext(managerSource, { window, URL, Date, Map, Set, Promise, setTimeout, clearTimeout, Error });
  return { api: window.FriendlyOffline, posts, registrations };
}
const readyStatus = { state: 'ready', completed: 18, total: 18, savedAt: 1000, failures: [], version: VERSION, baseMapBounds: [[25.023, 121.546], [25.044, 121.574]] };
test('manager rejects mismatched replies and inconsistent ready claims before accepting its result', async () => {
  const progress = [];
  const env = manager({ reply(message, port) {
    const response = { ...message, type: 'result', status: readyStatus };
    port.postMessage({ ...response, id: 'other-request' }); port.postMessage({ ...response, action: 'CLEAR' });
    port.postMessage({ ...response, status: { ...readyStatus, completed: 17 } });
    port.postMessage({ ...response, type: 'progress', status: { ...readyStatus, state: 'downloading', completed: 4, savedAt: null } });
    port.postMessage(response);
  } });
  const state = await env.api.initialize((value) => progress.push(value));
  assert.equal(state.state, 'ready'); assert.equal(progress.filter((value) => value.state === 'ready').length, 1);
  assert.equal(env.registrations[0][0], `${SCOPE}sw.js`); assert.equal(env.registrations[0][1].scope, SCOPE);
  const copy = env.api.status(); copy.state = 'partial'; assert.equal(env.api.status().state, 'ready');
});
test('offline manager reuses an installed same-scope worker and verifies downloaded data without registration fetch', async () => {
  const env = manager({ online: false, reply(message, port) { port.postMessage({ ...message, type: 'result', status: readyStatus }); } });
  assert.equal((await env.api.initialize()).state, 'ready'); assert.equal(env.registrations.length, 0); assert.equal(env.posts[0].online, false);
});
test('unsupported browser reports unavailable, never pretends downloaded data is ready', async () => {
  const env = manager({ supported: false }); const state = await env.api.initialize();
  assert.equal(state.state, 'unsupported'); assert.equal(state.savedAt, null); assert.equal(env.posts.length, 0);
});
