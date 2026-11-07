/* Run: node --test docs/prototypes/tests/friendly-search.test.cjs */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { searchLocal, createClient, SOURCE_ATTRIBUTION, ERROR_MESSAGES } = require('../friendly-route/search.js');

// Synthetic fixtures exercise the contract, not claims about real places.
const point = (id = 1, overrides = {}) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [121.5645, 25.0338] },
  properties: { name: '測試地點', city: '臺北市', district: '信義區', street: '測試路', housenumber: '1', osm_type: 'N', osm_id: id },
  ...overrides,
});
const collection = (features = [point()]) => ({ type: 'FeatureCollection', features });
const response = (payload = collection(), status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
const tick = () => new Promise(setImmediate);
const errorCode = (code) => (error) => error.code === code && error.message === ERROR_MESSAGES[code];

test('local search folds 台/臺, full-width letters, case and address; it never mutates catalog', () => {
  const stores = Object.freeze([
    Object.freeze({ id: 'a', name: '臺北測試店', address: '臺北市測試路 1 號', lat: 25.03, lng: 121.56, services: Object.freeze(['wifi']) }),
    Object.freeze({ id: 'b', name: 'ＭＯＣＫ Cafe', address: '臺北市範例路 2 號', lat: 25.04, lng: 121.55, services: Object.freeze(['toilet']) }),
  ]);
  const before = JSON.stringify(stores);
  const found = searchLocal('台北測試', stores);
  assert.equal(found.length, 1);
  assert.equal(found[0].storeId, 'a');
  assert.equal(found[0].id, 'catalog:a');
  assert.equal(found[0].source, 'catalog');
  found[0].services.push('charge');
  assert.equal(JSON.stringify(stores), before);
  assert.equal(searchLocal('mock', stores)[0].storeId, 'b');
  assert.equal(searchLocal('範例路', stores)[0].storeId, 'b');
  assert.equal(searchLocal('台北 測試路', stores)[0].storeId, 'a');
  assert.deepEqual(searchLocal('', stores), []);
  assert.deepEqual(searchLocal('測試', [{ name: '測試', lat: NaN, lng: 121.5 }]), []);
});

test('active city resource catalog is searchable without altering source records', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../friendly-route/resources-data.js'), 'utf8'), context);
  const stores = context.window.FRIENDLY_RESOURCES.stores;
  assert.equal(stores.length, 5948);
  assert.deepEqual(new Set(stores.map((store) => store.sourceId)), new Set(['friendly', 'toilets', 'mrt', 'wifi']));
  const before = JSON.stringify(stores);
  const found = searchLocal('新東陽101', stores);
  assert(found.some((place) => place.name === '新東陽101專櫃'));
  assert(searchLocal('北投', stores).length > 0, 'Search must include resources beyond the old local snapshot.');
  assert.equal(JSON.stringify(stores), before);
});

test('request prefers local names, uses fixed Taipei bbox without coordinates or credentials, and exposes attribution', async () => {
  let captured;
  const client = createClient({ fetchImpl: async (url, options) => { captured = { url: new URL(url), options }; return response(); } });
  const places = await client.search(' 台北101 ');
  assert.deepEqual([...captured.url.searchParams.keys()].sort(), ['bbox', 'lang', 'limit', 'q']);
  assert.equal(captured.url.searchParams.get('q'), '台北101');
  assert.equal(captured.url.searchParams.get('bbox'), '121.45,24.95,121.65,25.2');
  assert.equal(captured.url.searchParams.get('limit'), '6');
  assert.equal(captured.url.searchParams.get('lang'), 'default', 'Explicit local names override the browser Accept-Language header.');
  assert.equal(captured.options.credentials, 'omit');
  assert.equal(captured.options.referrerPolicy, 'no-referrer');
  assert.deepEqual(places[0], { id: 'photon:N:1', name: '測試地點', address: '臺北市 信義區 測試路 1', lat: 25.0338, lng: 121.5645, source: 'photon' });
  assert(!Object.hasOwn(places[0], 'services'));
  assert(!Object.hasOwn(places[0], 'storeId'));
  assert.equal(SOURCE_ATTRIBUTION.url, 'https://github.com/komoot/photon#readme');
});

test('remote parsing skips malformed geometry, nonfinite/string/outside coordinates, and duplicate IDs', async () => {
  const features = [null, {}, point(2, { geometry: { type: 'LineString', coordinates: [[121.5, 25.0]] } }),
    point(3, { geometry: { type: 'Point', coordinates: [NaN, 25.03] } }),
    point(4, { geometry: { type: 'Point', coordinates: ['121.56', 25.03] } }),
    point(5, { geometry: { type: 'Point', coordinates: [Infinity, 25.03] } }),
    point(6, { geometry: { type: 'Point', coordinates: [120.0, 23.0] } }),
    point(7, { geometry: { type: 'Point', coordinates: [25.03, 121.56] } }),
    point(8, { properties: null }), point(1), point(1), ...Array.from({ length: 8 }, (_, i) => point(i + 10))];
  const places = await createClient({ fetchImpl: async () => response(collection(features)) }).search('測試地點');
  assert.equal(places.length, 6);
  assert.equal(places[0].id, 'photon:N:1');
  assert.equal(new Set(places.map((place) => place.id)).size, 6);
});

test('remote strings are bounded plain text and valid no-match responses remain empty', async () => {
  const payload = collection([point(1, { properties: { name: '<img src=x onerror=alert(1)>' + '長'.repeat(200), street: '址'.repeat(400) } })]);
  const places = await createClient({ fetchImpl: async () => response(payload) }).search('測試地點');
  assert.equal(Array.from(places[0].name).length, 120);
  assert(Array.from(places[0].address).length <= 240);
  assert(places[0].name.startsWith('<img'), 'The UI escapes plain text; the API must not interpolate HTML.');
  assert.deepEqual(await createClient({ fetchImpl: async () => response(collection([])) }).search('沒有結果'), []);
});

test('invalid queries reject before requesting', async () => {
  let calls = 0;
  const client = createClient({ fetchImpl: async () => { calls += 1; return response(); } });
  for (const query of ['', '台', 'x'.repeat(121), null, {}]) await assert.rejects(client.search(query), errorCode('INVALID_QUERY'));
  assert.equal(calls, 0);
});

test('malformed JSON and feature collection are reported separately from no matches', async () => {
  for (const payload of [null, {}, { type: 'FeatureCollection', features: {} }]) {
    await assert.rejects(createClient({ fetchImpl: async () => response(payload) }).search('測試地點'), errorCode('INVALID_RESPONSE'));
  }
  await assert.rejects(createClient({ fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError(); } }) }).search('測試地點'), errorCode('INVALID_RESPONSE'));
});

test('HTTP 429, 5xx and offline failures expose Traditional Chinese fallback errors without a second provider', async () => {
  for (const [status, code] of [[429, 'RATE_LIMIT'], [503, 'SERVER'], [403, 'SERVER']]) {
    let calls = 0;
    await assert.rejects(createClient({ fetchImpl: async () => { calls += 1; return response({}, status); } }).search('測試地點'), errorCode(code));
    assert.equal(calls, 1);
  }
  await assert.rejects(createClient({ fetchImpl: async () => { throw new TypeError('offline'); } }).search('測試地點'), errorCode('NETWORK'));
});

test('cache returns independent results and repeated pending queries coalesce', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const client = createClient({ fetchImpl: async () => { calls += 1; await gate; return response(); } });
  const first = client.search('台北101');
  const second = client.search('臺北101');
  await tick();
  assert.equal(calls, 1);
  release();
  const [a, b] = await Promise.all([first, second]);
  a[0].name = 'changed';
  assert.equal(b[0].name, '測試地點');
  const cached = await client.search('台北101');
  assert.equal(cached[0].name, '測試地點');
  assert.equal(calls, 1);
});

test('different queries are throttled by at least one second even when a shorter interval is configured', async () => {
  const starts = [];
  const client = createClient({ minIntervalMs: 1, fetchImpl: async () => { starts.push(Date.now()); return response(); } });
  await Promise.all([client.search('第一地點'), client.search('第二地點')]);
  assert.equal(starts.length, 2);
  assert(starts[1] - starts[0] >= 1000, `${starts[1] - starts[0]} ms between requests`);
});

test('a canceled subscriber does not cancel a shared request needed by another subscriber', async () => {
  let remoteSignal;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const client = createClient({ fetchImpl: async (url, options) => { remoteSignal = options.signal; await gate; return response(); } });
  const controller = new AbortController();
  const first = client.search('測試地點', { signal: controller.signal });
  const rejected = assert.rejects(first, errorCode('ABORTED'));
  const second = client.search('測試地點');
  await tick();
  controller.abort();
  await rejected;
  assert.equal(remoteSignal.aborted, false);
  release();
  assert.equal((await second).length, 1);
});

test('canceling the final subscriber aborts the fetch and releases the queue even if a fetch implementation ignores abort', async () => {
  let remoteSignal;
  let calls = 0;
  const client = createClient({ fetchImpl: async (url, options) => {
    calls += 1;
    remoteSignal = options.signal;
    if (calls === 1) return new Promise(() => {});
    return response();
  } });
  const controller = new AbortController();
  const first = client.search('測試地點', { signal: controller.signal });
  const rejected = assert.rejects(first, (error) => error.name === 'AbortError' && error.code === 'ABORTED');
  await tick();
  controller.abort();
  await rejected;
  assert.equal(remoteSignal.aborted, true);
  assert.equal((await client.search('測試地點')).length, 1);
  assert.equal(calls, 2, 'Canceled requests must not remain in the coalescing map.');
});

test('canceling queued or already-aborted searches sends no request for those queries', async () => {
  const calls = [];
  const client = createClient({ fetchImpl: async (url) => { calls.push(new URL(url).searchParams.get('q')); return response(); } });
  await client.search('第一地點');
  const controller = new AbortController();
  const queued = client.search('取消地點', { signal: controller.signal });
  const rejected = assert.rejects(queued, errorCode('ABORTED'));
  await tick();
  controller.abort();
  await rejected;
  await assert.rejects(client.search('已取消地點', { signal: controller.signal }), errorCode('ABORTED'));
  assert.deepEqual(calls, ['第一地點']);
});

test('timeout settles even if fetch never settles, and aborts the underlying request', async () => {
  let signal;
  const client = createClient({ timeoutMs: 20, fetchImpl: async (url, options) => { signal = options.signal; return new Promise(() => {}); } });
  await assert.rejects(client.search('測試地點'), errorCode('TIMEOUT'));
  assert.equal(signal.aborted, true);
});

test('browser export honors a public endpoint configuration without forwarding its query parameters', async () => {
  let requested;
  const context = { window: { FRIENDLY_SEARCH_CONFIG: { endpoint: 'https://example.test/api/?lat=25&lon=121' } },
    URL, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../friendly-route/search.js'), 'utf8'), context);
  await context.window.FriendlySearch.createClient({ fetchImpl: async (url) => { requested = new URL(url); return response(); } }).search('測試地點');
  assert.equal(requested.origin, 'https://example.test');
  assert.equal(requested.searchParams.has('lat'), false);
  assert.equal(requested.searchParams.has('lon'), false);
});
