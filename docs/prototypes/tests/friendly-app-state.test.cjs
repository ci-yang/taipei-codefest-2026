/* Independent state checks. Run: node --test docs/prototypes/tests/friendly-app-state.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const base = path.resolve(__dirname, '../friendly-route');
process.env.TZ = 'Asia/Taipei';

// Minimal DOM event surface, not a browser or a visual/accessibility check.
function makeDocument(html) {
  let document;
  class Element {
    constructor(tag = 'div', attributes = {}) {
      this.tagName = tag;
      this.attributes = attributes;
      this.id = attributes.id;
      this.dataset = Object.fromEntries(Object.entries(attributes).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
      this.style = {}; this.children = []; this.events = {}; this.value = attributes.value || '';
      this.textContent = ''; this.hidden = 'hidden' in attributes; this.disabled = 'disabled' in attributes; this.open = false;
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    set innerHTML(value) { this.html = value; this.children = parse(String(value)); }
    get innerHTML() { return this.html || ''; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key]; }
    addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
    async dispatch(name) { for (const callback of this.events[name] || []) await callback({ target: this, preventDefault() {} }); }
    insertAdjacentHTML(_, value) { this.children.push(...parse(String(value))); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    scrollIntoView() {}
  }
  function parse(markup) {
    return [...markup.matchAll(/<([a-z][\w-]*)([^>]*)>/gi)].map(([, tag, attributes]) => new Element(tag, Object.fromEntries([...attributes.matchAll(/([\w:-]+)(?:="([^"]*)"|='([^']*)')?/g)].map(([, key, double, single]) => [key, double ?? single ?? '']))));
  }
  function descend(elements) { return elements.flatMap((el) => [el, ...descend(el.children)]); }
  function matches(el, selector) {
    if (selector.startsWith('#')) return el.id === selector.slice(1);
    const attribute = selector.match(/^([\w-]*)\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (attribute) return (!attribute[1] || el.tagName === attribute[1]) && attribute[2] in el.attributes && (attribute[3] === undefined || el.attributes[attribute[2]] === attribute[3]);
    return el.tagName === selector;
  }
  const body = new Element('body'); body.innerHTML = html;
  document = {
    body, activeElement: null, addEventListener() {},
    querySelectorAll(selector) {
      const parts = selector.split(' '); let nodes = descend([body]);
      for (let i = 0; i < parts.length; i++) { nodes = nodes.filter((el) => matches(el, parts[i])); if (i + 1 < parts.length) nodes = descend(nodes.flatMap((el) => el.children)); }
      return nodes;
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
  };
  return document;
}

function runtime(seed = {}, options = {}) {
  const document = makeDocument(fs.readFileSync(path.join(base, 'index.html'), 'utf8'));
  const saved = new Map(Object.entries(seed)); const writes = []; const gpsRequests = []; const markers = []; const mapFits = [];
  const chain = new Proxy({ style: {}, fitBounds(points, options) { mapFits.push({ points, options }); return chain; }, getCenter: () => ({ lat: 25.034, lng: 121.56 }), getZoom: () => 15 }, { get(target, key) { return key in target ? target[key] : key === 'attributionControl' ? chain : () => chain; } });
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-06T17:30:00Z'])); } static now() { return new Date('2026-11-06T17:30:00Z').valueOf(); } }
  const r = {
    document, URL, AbortController, Date: FixedDate, console, location: new URL('https://example.test/friendly/index.html'),
    navigator: { onLine: !options.offline, geolocation: { getCurrentPosition(success, failure, options) { gpsRequests.push({ success, failure, options }); } } },
    isSecureContext: true, L: new Proxy({}, { get: () => () => chain }),
    localStorage: { getItem: (key) => saved.get(key) ?? null, setItem(key, value) { if (options.denyStorage) throw new Error('Storage blocked'); saved.set(key, value); writes.push([key, value]); }, removeItem(key) { saved.delete(key); } },
    requestAnimationFrame(callback) { queueMicrotask(() => callback(0)); return 1; }, cancelAnimationFrame() {},
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
    addEventListener() {}, matchMedia: () => ({ matches: false }), print() {},
  };
  r.L = new Proxy({}, { get: (_, key) => key === 'marker' ? (coordinates, settings) => { const marker = { coordinates, settings, handlers: {}, bindTooltip() { return this; }, on(name, handler) { this.handlers[name] = handler; return this; }, addTo() { markers.push(this); return this; } }; return marker; } : () => chain });
  if (options.searchClient) r.FriendlySearch = { createClient: () => options.searchClient, searchLocal: (query, stores) => stores.filter((store) => store.name.includes(query)).slice(0, 6).map((store) => ({ ...store, id: `catalog:${store.id}`, storeId: String(store.id), source: 'catalog' })) };
  if (options.noGeolocation) delete r.navigator.geolocation;
  if (options.worker) {
    const registration = { active: { postMessage(_, ports) { ports[0].postMessage({ ok: true, version: 'friendly-app-v2' }); } } };
    r.navigator.serviceWorker = { register: async () => { if (options.registerFails) throw new Error('Offline script fetch failed'); return registration; }, getRegistration: async () => options.existingWorker ? registration : undefined, ready: Promise.resolve(registration) };
    r.caches = { open: async () => ({ match: async () => options.missingAsset ? null : { ok: true } }), delete: async () => true };
    r.MessageChannel = class { constructor() { this.port1 = { close() {} }; this.port2 = { postMessage: (data) => queueMicrotask(() => this.port1.onmessage({ data })) }; } };
  }
  r.window = r; vm.createContext(r);
  vm.runInContext(fs.readFileSync(path.join(base, 'data.js'), 'utf8'), r);
  r.FriendlyRouter = {
    contains: (p) => p.lat >= 25.023 && p.lat <= 25.044 && p.lng >= 121.546 && p.lng <= 121.574,
    distanceToRoute: () => 0,
    compare: ({ points }) => ({ routes: [{ id: 'shortest', label: '最短路徑', distanceM: 1000, resourceCount: 3, coordinates: points.map((p) => [p.lat, p.lng]), connectors: [], connectorDistanceM: 0, estimateMinutes: 15 }, ...(options.twoRoutes ? [{ id: 'resources', label: '資源最多', distanceM: 1200, resourceCount: 5, coordinates: points.map((p) => [p.lat, p.lng]), connectors: [], connectorDistanceM: 0, estimateMinutes: 18 }] : [])], warning: '測試路由替身', candidateCount: options.twoRoutes ? 2 : 1 }),
  };
  if (options.realRouter) for (const name of ['routing-data.js', 'routing.js']) vm.runInContext(fs.readFileSync(path.join(base, name), 'utf8'), r, { filename: name });
  const source = fs.readFileSync(path.join(base, 'app.js'), 'utf8').replace(/\}\)\(\);\s*$/, 'window.__test = { state, localDate, requestPosition, selectedRoute, restoreSnapshot, workerReady, selectPlace, catalogPlace, currentOrigin, setDestination, openSearch, renderMap, filteredStores, nearbyDistance, setScreen, enterOffline };\n})();');
  vm.runInContext(source, r, { filename: 'app.js' });
  const element = (selector) => { const el = document.querySelector(selector); assert(el, `Missing test element: ${selector}`); return el; };
  return { r, state: r.__test.state, saved, writes, gpsRequests, markers, mapFits, element, click: (selector) => element(selector).dispatch('click'), async input(selector, value, event = 'input') { element(selector).value = value; await element(selector).dispatch(event); } };
}

function position(lat = 25.034, lng = 121.561, accuracy = 15) { return { coords: { latitude: lat, longitude: lng, accuracy }, timestamp: Date.now() }; }
async function routeFromGps(app, index = 0) {
  await app.gpsRequests.at(-1).success(position());
  await app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[index]));
  assert.equal(app.state.screen, 'home'); assert.equal(app.state.selectedRouteId, 'shortest');
}
const referencePlace = () => ({ id: 'photon:101', name: '台北101', address: '信義路五段7號', lat: 25.0338352, lng: 121.5644995, source: 'photon' });

test('first open requests real GPS without persisting or exposing a planning workflow', async () => {
  const app = runtime(); assert.equal(app.state.date, '2026-11-07'); assert.equal(app.gpsRequests.length, 1);
  assert.equal(app.gpsRequests[0].options.maximumAge, 0); assert.equal(app.gpsRequests[0].options.timeout, 12000);
  await routeFromGps(app); assert.equal(app.state.points[0].lat, 25.034); assert.equal(app.writes.length, 0);
  for (const id of ['home-start', 'origin-source', 'plan-screen', 'confirm-screen', 'journey-screen', 'preview-route', 'preview-plan']) assert.equal(app.r.document.querySelector(`#${id}`), null);
  app.r.__test.setScreen('plan'); assert.equal(app.state.screen, 'home'); assert.equal(app.r.location.search, '');
});

test('clicking resource A then B immediately replaces the shortest route and opens no confirmation', async () => {
  const app = runtime({}, { twoRoutes: true }); await routeFromGps(app);
  const first = app.state.points[1].id; const second = app.r.FRIENDLY_DATA.stores[1];
  await app.r.__test.selectPlace(app.r.__test.catalogPlace(second));
  assert.notEqual(app.state.points[1].id, first); assert.equal(app.state.points[1].id, String(second.id)); assert.equal(app.state.routes.length, 1);
  assert.equal(app.state.selectedRouteId, 'shortest'); assert.equal(app.state.points.length, 2); assert.equal(app.state.screen, 'home');
  assert.match(app.element('#preview-status').textContent, /步行路線.*分/); assert.equal(app.element('#place-preview').hidden, false);
  assert(app.markers.some((marker) => marker.settings.title?.includes('路線附近')));
});

test('a searched destination is an independent marker, never a routing waypoint or resource', async () => {
  const app = runtime(); await routeFromGps(app); const route = app.state.routes[0]; const points = JSON.stringify(app.state.points);
  app.r.__test.setDestination(referencePlace());
  assert.equal(app.state.destinationPlace.name, '台北101'); assert.equal(app.state.routes[0], route); assert.equal(JSON.stringify(app.state.points), points);
  assert.match(app.element('#destination-chip').textContent, /目的地 · 台北101/); assert.equal(app.element('#destination-reference').hidden, false);
  await app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[1]));
  assert.equal(app.state.destinationPlace.name, '台北101'); assert.equal(app.state.points.length, 2); assert.equal(app.state.points[0].kind, 'gps');
  assert.notEqual(app.state.points[1].id, 'photon:101'); const replaced = app.state.routes[0]; await app.click('#clear-destination');
  assert.equal(app.state.destinationPlace, null); assert.equal(app.state.routes[0], replaced);
});

test('GPS success recomputes the selected resource from new coordinates and preserves destination', async () => {
  const app = runtime(); await routeFromGps(app); app.r.__test.setDestination(referencePlace()); const resource = app.state.resourceId;
  await app.click('#preview-refresh-location'); await app.gpsRequests.at(-1).success(position(25.035, 121.563));
  assert.equal(app.state.points[0].lat, 25.035); assert.equal(app.state.points[0].lng, 121.563); assert.equal(app.state.resourceId, resource); assert.equal(app.state.destinationPlace.id, 'photon:101');
  await app.click('#close-preview'); await app.click('#home-gps'); await app.gpsRequests.at(-1).success(position(25.036, 121.562));
  assert.equal(app.state.points[0].lat, 25.036); assert.equal(app.state.previewPlace, null); assert.equal(app.state.resourceId, resource);
});

test('an old GPS callback cannot replace a newer fix or an explicit demo location', async () => {
  const app = runtime(); const old = app.gpsRequests[0]; app.r.__test.requestPosition(); const latest = app.gpsRequests[1];
  await latest.success(position(25.035, 121.563)); await old.success(position(25.034, 121.561)); assert.equal(app.state.gps.lat, 25.035);
  app.r.__test.requestPosition(); const pending = app.gpsRequests.at(-1); await app.click('#demo-location'); const demo = JSON.stringify(app.r.__test.currentOrigin());
  await pending.success(position(24.1, 120.7)); assert.equal(app.state.locationMode, 'demo'); assert.equal(JSON.stringify(app.r.__test.currentOrigin()), demo);
  assert.match(app.element('#home-location-label').textContent, /示範位置.*非目前位置/); assert.equal(app.writes.length, 0);
});

test('fast resource selections ignore a late route result and keep the latest resource', async () => {
  const app = runtime(); await app.gpsRequests[0].success(position()); const pending = []; const compare = app.r.FriendlyRouter.compare;
  app.r.FriendlyRouter.compare = (options) => new Promise((resolve) => pending.push(() => resolve(compare(options))));
  const first = app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[0])); await Promise.resolve(); await Promise.resolve();
  const second = app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[1])); await Promise.resolve(); await Promise.resolve();
  assert.equal(pending.length, 2); pending[1](); await second; const route = app.state.routes[0]; pending[0](); await first;
  assert.equal(app.state.points[1].id, String(app.r.FRIENDLY_DATA.stores[1].id)); assert.equal(app.state.routes[0], route); assert.equal(app.state.calculating, false);
});

test('GPS updating during a calculation invalidates the old route result', async () => {
  const app = runtime(); await app.gpsRequests[0].success(position()); const pending = []; const compare = app.r.FriendlyRouter.compare;
  app.r.FriendlyRouter.compare = (options) => new Promise((resolve) => pending.push(() => resolve(compare(options))));
  const initial = app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[0])); await Promise.resolve(); await Promise.resolve();
  app.r.__test.requestPosition(); const refresh = app.gpsRequests.at(-1).success(position(25.035, 121.563)); await Promise.resolve(); await Promise.resolve();
  pending[0](); await initial; assert.equal(app.state.routes.length, 0); pending[1](); await refresh; assert.equal(app.state.points[0].lat, 25.035);
});

test('denied or unavailable GPS does not fabricate a position or nearby distances', async () => {
  const denied = runtime(); denied.gpsRequests[0].failure({ code: 1 });
  await denied.r.__test.selectPlace(denied.r.__test.catalogPlace(denied.r.FRIENDLY_DATA.stores[0]));
  assert.equal(denied.state.gps, null); assert.equal(denied.state.routes.length, 0); assert.match(denied.element('#home-location-label').textContent, /權限/);
  assert.match(denied.element('#store-list').innerHTML, /距離未知/); assert.match(denied.element('#result-context').textContent, /位置未知/);
  const unavailable = runtime({}, { noGeolocation: true }); assert.equal(unavailable.state.gps, null); assert.equal(unavailable.gpsRequests.length, 0); assert.match(unavailable.element('#home-location-label').textContent, /未提供定位/);
});

test('an out-of-range GPS remains truthful and a reference outside the map cannot poison resource routing', async () => {
  const app = runtime(); await app.gpsRequests[0].success(position(24.1, 120.7));
  await app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[0])); assert.equal(app.state.routes.length, 0); assert.equal(app.state.gps.lat, 24.1);
  assert.match(app.element('#preview-status').textContent, /超出/); app.r.__test.setDestination({ ...referencePlace(), lat: 25.1, lng: 121.6 });
  await app.click('#close-preview'); await app.click('#demo-location'); await app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[0]));
  assert.equal(app.state.points[0].kind, 'demo'); assert.equal(app.state.destinationPlace.lat, 25.1); assert.equal(app.state.points.length, 2); assert.equal(app.state.routes.length, 1);
});

test('low-accuracy GPS is retained with uncertainty; a failed refresh explicitly uses the previous fix', async () => {
  const app = runtime(); await app.gpsRequests[0].success(position(25.034, 121.561, 5000));
  await app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[0])); assert.equal(app.state.points[0].accuracy, 5000);
  assert.match(app.element('#preview-location-note').textContent, /誤差約 5000/); const route = app.state.routes[0];
  await app.click('#preview-refresh-location'); app.gpsRequests.at(-1).failure({ code: 3 });
  assert.equal(app.state.routes[0], route); assert.match(app.element('#home-location-label').textContent, /上次.*逾時/); assert.match(app.element('#preview-location-note').textContent, /上次/);
});

test('nearby list sorts by straight-line distance to active GPS or labelled demo location', async () => {
  const app = runtime(); await app.gpsRequests[0].success(position()); let entries = app.r.__test.filteredStores();
  assert(entries.every((entry, index) => index === 0 || entry.distance >= entries[index - 1].distance)); assert.match(app.element('#store-list').innerHTML, /直線/);
  await app.click('#demo-location'); entries = app.r.__test.filteredStores(); assert.equal(entries[0].distance, 0);
  assert.match(app.element('#result-context').textContent, /示範位置.*直線距離排序/);
  await app.click('#home-resources'); await app.click('[data-store]'); assert.equal(app.element('#resources-dialog').open, false); assert.equal(app.state.points[1].id, entries[0].store.id);
});

test('home service chips pick a single category and pressing it again restores all services', async () => {
  const app = runtime(); const chip = app.element('#map-filters').children.find((element) => element.dataset.service === 'toilet');
  await chip.dispatch('click'); assert.deepEqual([...app.state.filters], ['toilet']);
  await app.element('#map-filters').children.find((element) => element.dataset.service === 'toilet').dispatch('click'); assert.equal(app.state.filters.size, 4);
});

test('search sends only an explicit query, escapes external text, and never changes the route', async () => {
  const requests = []; const place = { ...referencePlace(), name: '<img src=x onerror=alert(1)>', address: '<b>松智路</b>' };
  const app = runtime({}, { searchClient: { async search(query, options) { requests.push({ query, options }); return [place]; } } }); await routeFromGps(app); const route = app.state.routes[0];
  await app.click('#home-search'); await app.input('#place-search', '台北101'); assert.equal(requests.length, 0); await app.element('#search-form').dispatch('submit');
  assert.equal(requests.length, 1); assert.equal(requests[0].query, '台北101'); assert.match(app.element('#search-results').innerHTML, /&lt;img/); assert.doesNotMatch(app.element('#search-results').innerHTML, /<img/);
  await app.click('[data-search-result]'); assert.equal(app.state.destinationPlace.lat, place.lat); assert.equal(app.state.routes[0], route); assert.equal(app.state.points.length, 2);
  assert.equal(app.writes.length, 0);
});

test('new search input aborts a pending query and rejects stale result clicks', async () => {
  let resolve; let signal; const app = runtime({}, { searchClient: { search(_, options) { signal = options.signal; return new Promise((done) => { resolve = done; }); } } });
  await app.click('#home-search'); await app.input('#place-search', app.r.FRIENDLY_DATA.stores[0].name); const staleButton = app.element('[data-search-result]');
  const submitting = app.element('#search-form').dispatch('submit'); assert.match(app.element('#search-status').textContent, /正在搜尋/); await app.input('#place-search', 'new query'); assert.equal(signal.aborted, true);
  resolve([referencePlace()]); await submitting; assert.equal(app.state.searchResults.length, 0); await staleButton.dispatch('click'); assert.equal(app.state.destinationPlace, null);
});

test('search empty and failure states preserve the current destination and resource route', async () => {
  let reject = false; const app = runtime({}, { searchClient: { async search() { if (reject) throw new Error('Network down'); return []; } } });
  await routeFromGps(app); app.r.__test.setDestination(referencePlace()); const route = app.state.routes[0]; await app.click('#home-search'); await app.input('#place-search', 'unknown query');
  await app.element('#search-form').dispatch('submit'); assert.match(app.element('#search-status').textContent, /找不到/); reject = true;
  await app.element('#search-form').dispatch('submit'); assert.match(app.element('#search-status').textContent, /無法使用/); assert.equal(app.state.routes[0], route); assert.equal(app.state.destinationPlace.name, '台北101');
});

test('offline snapshot saves resource and reference separately and restores only the home map', async () => {
  const app = runtime({}, { worker: true }); await routeFromGps(app); app.r.__test.setDestination(referencePlace()); await app.click('#save-offline');
  assert.equal(app.state.snapshot.snapshotVersion, 4); assert.equal(app.state.snapshot.points.length, 2); assert.equal(app.state.snapshot.destinationPlace.id, 'photon:101');
  assert(app.writes.every(([key]) => !key.endsWith(':history')));
  const reopened = runtime(Object.fromEntries(app.saved), { worker: true, offline: true, registerFails: true }); await reopened.r.__test.workerReady;
  assert.equal(reopened.state.screen, 'home'); assert.equal(reopened.gpsRequests.length, 0); assert.equal(reopened.state.gps, null); assert.equal(reopened.state.locationMode, 'saved');
  assert.equal(reopened.state.points[0].kind, 'saved'); assert.match(reopened.element('#home-location-label').textContent, /已保存.*不是新 GPS/);
  assert.equal(reopened.state.destinationPlace.id, 'photon:101'); assert.equal(reopened.state.previewPlace.id, reopened.state.snapshot.resourceId); assert.equal(reopened.element('#no-cache-overlay').hidden, true);
  const route = reopened.state.routes[0]; await reopened.r.__test.selectPlace(reopened.r.__test.catalogPlace(reopened.r.FRIENDLY_DATA.stores[1])); assert.equal(reopened.state.routes[0], route);
  assert.match(reopened.element('#preview-status').textContent, /尚無已下載路線/);
});

test('manual offline restore rejects a pending GPS callback and restores saved reference coordinates', async () => {
  const app = runtime({}, { worker: true }); await routeFromGps(app); app.r.__test.setDestination(referencePlace()); await app.click('#save-offline');
  app.r.__test.requestPosition(); const pending = app.gpsRequests.at(-1); app.r.__test.setDestination({ ...referencePlace(), id: 'other', name: '其他標記', lat: 25.04 });
  await app.click('#restore-offline'); await pending.success(position(25.039, 121.563));
  assert.equal(app.state.locationMode, 'saved'); assert.equal(app.state.destinationPlace.id, 'photon:101'); assert.equal(app.state.points[0].lat, 25.034); assert.equal(app.state.screen, 'home');
});

test('invalid new snapshot fields and older route schemas are not restored as current data', async () => {
  const app = runtime({}, { worker: true }); await routeFromGps(app); await app.click('#save-offline'); const key = [...app.saved.keys()].find((entry) => entry.endsWith(':snapshot'));
  for (const change of [{ snapshotVersion: 3 }, { destinationPlace: { name: 'bad', lat: 25, lng: 121 } }, { resourceId: 'missing' }]) {
    const bad = { ...JSON.parse(app.saved.get(key)), ...change }; const reopened = runtime({ [key]: JSON.stringify(bad) }, { worker: true, offline: true }); await reopened.r.__test.workerReady;
    assert.equal(reopened.state.snapshot, null); assert.equal(reopened.state.routes.length, 0); assert.equal(reopened.state.locationMode, null);
  }
});

test('a failed offline completeness check or blocked storage cannot report successful saving', async () => {
  for (const options of [{ worker: true, missingAsset: true }, { worker: true, denyStorage: true }]) {
    const app = runtime({}, options); await routeFromGps(app); await app.click('#save-offline');
    assert.equal(app.state.snapshot, null); assert.equal(app.state.cacheVerified, false); assert.match(app.element('#toast').textContent, /失敗|齊全|停用/);
  }
});

test('entering offline invalidates a pending route and prevents its later result from appearing', async () => {
  const app = runtime(); await app.gpsRequests[0].success(position()); let resolve; const compare = app.r.FriendlyRouter.compare;
  app.r.FriendlyRouter.compare = (options) => new Promise((done) => { resolve = () => done(compare(options)); });
  const pending = app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[0])); await Promise.resolve(); await Promise.resolve();
  app.r.navigator.onLine = false; app.r.__test.enterOffline(); resolve(); await pending; assert.equal(app.state.routes.length, 0); assert.equal(app.state.calculating, false);
});

test('resource details keep local quality feedback and never send or implicitly save coordinates', async () => {
  const app = runtime(); await routeFromGps(app); const route = app.state.routes[0]; await app.click('#preview-details'); assert.equal(app.element('#store-drawer').open, true);
  await app.input('#review-service', 'wifi'); await app.input('#review-outcome', 'yes'); await app.input('#review-comment', '<b>本機測試</b>'); await app.element('#review-form').dispatch('submit');
  assert.equal(app.state.reviews.length, 1); assert.equal(app.state.routes[0], route); assert(app.writes.every(([key]) => key.endsWith(':reviews'))); assert.match(app.element('#store-detail').innerHTML, /&lt;b&gt;本機測試/);
  await app.click('#clear-reviews'); assert.equal(app.state.reviews.length, 0);
});

test('blocked local review storage does not create a successful feedback record', async () => {
  const app = runtime({}, { denyStorage: true }); await routeFromGps(app); await app.click('#preview-details'); await app.input('#review-service', 'wifi'); await app.input('#review-outcome', 'yes');
  await app.element('#review-form').dispatch('submit'); assert.equal(app.state.reviews.length, 0); assert.match(app.element('#toast').textContent, /尚未保存/);
});

test('help remains local, requires consent, defaults to no route and hides data after expiry', async () => {
  const app = runtime(); await routeFromGps(app); app.r.__test.setDestination(referencePlace()); await app.click('#preview-help');
  await app.input('#help-place', String(app.r.FRIENDLY_DATA.stores[0].id)); await app.input('#help-reason', '測試需求'); await app.element('#help-form').dispatch('submit');
  assert.equal(app.state.request, null); assert.match(app.element('#help-error').textContent, /同意/);
  app.element('#help-consent').checked = true; await app.element('#help-consent').dispatch('input'); await app.element('#help-form').dispatch('submit');
  assert.equal(app.state.request.status, 'pending'); assert.equal(app.state.request.sharedPoints.length, 0); assert.equal(app.state.request.routeCoordinates.length, 0);
  app.state.request.expiresAt = app.r.Date.now() - 1; await app.click('#ack-request'); assert.equal(app.state.request.status, 'expired'); assert.equal(app.state.request.placeId, ''); assert.equal(app.state.request.reason, ''); assert.equal(app.writes.length, 0);
});

test('going offline during initial GPS acquisition can recover and request GPS again', async () => {
  const app = runtime(); const old = app.gpsRequests[0]; assert.equal(app.state.gpsStatus, 'pending');
  app.element('#simulate-offline').checked = true; await app.element('#simulate-offline').dispatch('change');
  assert.equal(app.state.gpsStatus, 'idle'); app.element('#simulate-offline').checked = false; await app.element('#simulate-offline').dispatch('change');
  assert.equal(app.element('#home-gps').disabled, false); assert.equal(app.element('#preview-refresh-location').disabled, false);
  await old.success(position()); assert.equal(app.state.gps, null); await app.click('#home-gps'); await app.gpsRequests.at(-1).success(position()); assert.equal(app.state.gpsStatus, 'ready');
});

test('failed GPS requests remain visible while demo or saved location stays active', async () => {
  const app = runtime({}, { worker: true }); await app.click('#demo-location');
  await app.click('#home-gps'); app.gpsRequests.at(-1).failure({ code: 1 }); assert.equal(app.state.locationMode, 'demo');
  assert.match(app.element('#home-location-label').textContent, /示範位置.*權限/); assert.match(app.element('#home-gps-detail').textContent, /權限/);
  await app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[0])); await app.click('#save-offline'); await app.click('#restore-offline');
  await app.click('#preview-refresh-location'); app.gpsRequests.at(-1).failure({ code: 3 }); assert.equal(app.state.locationMode, 'saved');
  assert.match(app.element('#home-location-label').textContent, /已保存.*逾時/); assert.match(app.element('#home-gps-detail').textContent, /逾時/);
});

test('in-range reference is fitted with the resource route; outside reference never expands the route view', async () => {
  const app = runtime(); await routeFromGps(app); app.r.__test.setDestination(referencePlace());
  const fit = app.mapFits.at(-1); assert(fit.points.some((point) => point[0] === referencePlace().lat && point[1] === referencePlace().lng)); assert.equal(fit.options.paddingTopLeft[1], 250);
  assert(fit.points.some((point) => point[0] === app.state.points[0].lat && point[1] === app.state.points[0].lng));
  app.r.__test.setDestination({ ...referencePlace(), lat: 25.1, lng: 121.6 }); assert(!app.mapFits.at(-1).points.some((point) => point[0] === 25.1));
});

test('real local routing draws GPS to a catalog resource with only two points', async () => {
  const app = runtime({}, { realRouter: true }); await routeFromGps(app); app.r.__test.setDestination(referencePlace());
  assert.equal(app.state.points.length, 2); assert(app.state.routes[0].coordinates.length > 2); assert.equal(app.state.routes[0].id, 'shortest');
  assert.equal(app.state.points[0].lat, 25.034); assert.notEqual(app.state.points[1].source, 'photon');
});

async function cachePackage({ failedAsset = '', failWrite = false } = {}) {
  const handlers = {}; const requested = []; const writes = []; const deleted = []; const replies = []; const opened = [];
  const scope = 'https://example.test/reports/friendly/'; let work;
  const r = {
    URL, Promise, console,
    self: { registration: { scope }, location: { origin: 'https://example.test' }, clients: { claim: async () => {} }, skipWaiting: async () => {}, addEventListener: (name, callback) => { handlers[name] = callback; } },
    caches: { async open(name) { opened.push(name); return { async put(url) { if (failWrite) throw new Error('Quota exceeded'); writes.push(url); }, async match() { return null; } }; }, async delete(name) { deleted.push(name); return true; } },
    async fetch(url) { requested.push(url); if (url.endsWith(failedAsset) && failedAsset) throw new Error('Asset unavailable'); return { ok: true, type: 'basic', url, headers: { get: () => url.endsWith('.js') ? 'application/javascript' : url.endsWith('.css') ? 'text/css' : 'text/html' } }; },
  };
  vm.createContext(r); vm.runInContext(fs.readFileSync(path.join(base, 'sw.js'), 'utf8'), r);
  handlers.message({ data: { type: 'CACHE_ROUTE' }, ports: [{ postMessage: (reply) => replies.push(reply) }], waitUntil: (promise) => { work = promise; } });
  await work;
  return { requested, writes, deleted, replies, opened };
}

test('offline package includes both routing assets and uses a versioned per-path cache', async () => {
  const result = await cachePackage();
  assert.equal(result.replies.at(-1).ok, true);
  assert(result.writes.some((url) => url.endsWith('/search.js'))); assert(result.writes.some((url) => url.endsWith('/map-ui.css'))); assert(result.writes.some((url) => url.endsWith('/routing.js'))); assert(result.writes.some((url) => url.endsWith('/routing-data.js')));
  assert(result.opened.every((key) => key.includes('/reports/friendly/') && !key.startsWith('friendly-route-v1:')));
});

test('an asset download failure never reports cache success', async () => {
  const result = await cachePackage({ failedAsset: '/routing-data.js' });
  assert.equal(result.replies.at(-1).ok, false); assert.equal(result.writes.length, 0);
});

test('partial cache writes are invalidated and never report success', async () => {
  const result = await cachePackage({ failWrite: true });
  assert.equal(result.replies.at(-1).ok, false); assert(result.deleted.length >= 1);
  assert(result.opened.every((key) => result.deleted.includes(key)));
});
