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
      this.textContent = ''; this.hidden = false; this.disabled = false; this.open = false;
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
  const saved = new Map(Object.entries(seed)); const writes = []; const gpsRequests = []; const markers = [];
  const chain = new Proxy({ style: {}, getCenter: () => ({ lat: 25.034, lng: 121.56 }), getZoom: () => 15 }, { get(target, key) { return key in target ? target[key] : key === 'attributionControl' ? chain : () => chain; } });
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
  const source = fs.readFileSync(path.join(base, 'app.js'), 'utf8').replace(/\}\)\(\);\s*$/, 'window.__test = { state, localDate, requestPosition, selectedRoute, renderHistory, renderPlan, restoreSnapshot, workerReady, selectPlace, catalogPlace, currentOrigin, setOrigin, openSearch, renderMap };\n})();');
  vm.runInContext(source, r, { filename: 'app.js' });
  const element = (selector) => { const el = document.querySelector(selector); assert(el, `Missing test element: ${selector}`); return el; };
  return { r, state: r.__test.state, saved, writes, gpsRequests, markers, element, click: (selector) => element(selector).dispatch('click'), async input(selector, value, event = 'input') { element(selector).value = value; await element(selector).dispatch(event); } };
}

function position(lat = 25.034, lng = 121.561, accuracy = 15) { return { coords: { latitude: lat, longitude: lng, accuracy }, timestamp: Date.now() }; }
async function planFromGps(app) {
  await app.click('#home-start'); await app.click('#retry-gps'); app.gpsRequests.at(-1).success(position()); await app.click('#use-gps-origin');
  await app.input('#destination-0', app.r.FRIENDLY_DATA.stores[0].name);
  await app.element('#route-form').dispatch('submit');
  assert.equal(app.state.screen, 'confirm');
}

test('local today, empty history, real GPS API and no implicit persistence', async () => {
  const app = runtime(); assert.equal(app.state.date, '2026-11-07'); assert.equal(app.state.history.length, 0);
  await planFromGps(app);
  assert.equal(app.gpsRequests.length, 1); assert.equal(app.gpsRequests[0].options.maximumAge, 0); assert.equal(app.gpsRequests[0].options.timeout, 12000);
  assert.equal(app.state.points[0].lat, 25.034); assert.equal(app.writes.length, 0);
  assert.equal(app.r.location.search, '');
});

test('manual origin rejects an outstanding GPS callback', async () => {
  const app = runtime(); await app.click('#home-start'); await app.click('#retry-gps'); const pending = app.gpsRequests[0];
  await app.input('#origin-source', 'manual', 'change');
  const store = app.r.FRIENDLY_DATA.stores[1]; await app.input('#origin-store', store.name);
  pending.success(position());
  assert.equal(app.state.originMode, 'manual'); assert.equal(app.state.manualOrigin, store.name); assert.equal(app.state.gps, null);
});

test('out-of-range GPS is retained and never replaced with demo coordinates', async () => {
  const app = runtime(); await app.click('#home-start'); await app.click('#retry-gps'); app.gpsRequests[0].success(position(24.1, 120.7));
  assert.equal(app.state.gps.lat, 24.1); assert.equal(app.state.gps.lng, 120.7);
  await app.input('#destination-0', app.r.FRIENDLY_DATA.stores[0].name); await app.element('#route-form').dispatch('submit');
  assert.equal(app.state.screen, 'plan'); assert.match(app.element('#route-error').textContent, /範圍|路網/); assert.equal(app.state.history.length, 0);
});

test('failed GPS refresh cannot silently reuse an old position', async () => {
  const app = runtime(); await app.click('#home-start'); await app.click('#retry-gps'); app.gpsRequests[0].success(position());
  await app.click('#retry-gps'); app.gpsRequests[1].failure({ code: 3 });
  await app.input('#destination-0', app.r.FRIENDLY_DATA.stores[0].name); await app.element('#route-form').dispatch('submit');
  assert.equal(app.state.screen, 'plan'); assert.match(app.element('#gps-status').textContent, /逾時/);
});

test('denied and unavailable geolocation report failure without a substitute location', async () => {
  const denied = runtime(); await denied.click('#home-start'); await denied.click('#retry-gps'); denied.gpsRequests[0].failure({ code: 1 });
  assert.equal(denied.state.gps, null); assert.match(denied.element('#gps-status').textContent, /權限/);
  const unavailable = runtime({}, { noGeolocation: true }); await unavailable.click('#home-start'); await unavailable.click('#retry-gps');
  assert.equal(unavailable.state.gps, null); assert.equal(unavailable.gpsRequests.length, 0); assert.match(unavailable.element('#gps-status').textContent, /未提供定位/);
});

test('imprecise GPS keeps the real coordinates and explicitly reports its uncertainty', async () => {
  const app = runtime(); await app.click('#home-start'); await app.click('#retry-gps'); app.gpsRequests[0].success(position(25.034, 121.561, 5000));
  assert.equal(app.state.gps.lat, 25.034); assert.equal(app.state.gps.lng, 121.561); assert.equal(app.state.gps.accuracy, 5000);
  assert.match(`${app.element('#gps-status').textContent} ${app.element('#gps-meta').textContent}`, /精度|誤差/);
  assert.equal(app.state.history.length, 0); assert.equal(app.writes.length, 0);
});

test('changing an input invalidates the previous comparison and start action', async () => {
  const app = runtime(); await planFromGps(app); await app.click('#back-button');
  await app.input('#destination-0', app.r.FRIENDLY_DATA.stores[1].name);
  await app.click('#start-trip'); assert.equal(app.state.screen, 'plan'); assert.equal(app.r.__test.selectedRoute(), null);
});

test('history is saved only explicitly; a restored GPS start is labelled historical', async () => {
  const app = runtime(); await planFromGps(app); assert.equal(app.state.history.length, 0);
  await app.click('#save-history'); assert.equal(app.state.history.length, 1);
  await app.click('#open-history'); await app.click('[data-restore-history]');
  assert.equal(app.state.originMode, 'history'); assert.match(app.element('#origin-note').textContent, /歷史/);
  assert.doesNotMatch(app.element('#origin-store').value, /目前位置/);
  await app.element('#route-form').dispatch('submit'); assert.equal(app.state.points[0].kind, 'history');
  assert.doesNotMatch(app.state.points[0].name, /目前位置/);
});

test('a blocked history write cannot create a successful saved-history state', async () => {
  const app = runtime({}, { denyStorage: true }); await planFromGps(app); await app.click('#save-history');
  assert.equal(app.state.history.length, 0); assert.equal(app.writes.length, 0);
  assert.match(app.element('#toast').textContent, /不可用|沒有新增/);
});

test('saving an offline package does not add history; reload labels its GPS as saved', async () => {
  const app = runtime({}, { worker: true }); await planFromGps(app); await app.click('#save-offline');
  assert(app.state.snapshot); assert.equal(app.state.history.length, 0);
  assert(app.writes.every(([key]) => !key.endsWith(':history')));
  const reopened = runtime(Object.fromEntries(app.saved), { worker: true }); await reopened.r.__test.workerReady;
  assert.equal(reopened.state.gps, null); await reopened.click('#restore-offline');
  assert.equal(reopened.state.screen, 'journey'); assert.equal(reopened.state.points[0].lat, 25.034);
  assert.match(reopened.state.points[0].name, /已保存/); assert.doesNotMatch(reopened.state.points[0].name, /目前位置/);
  assert.equal(reopened.state.history.length, 0);
});

test('fresh offline reload restores complete cached data even when worker registration cannot reach its source', async () => {
  const app = runtime({}, { worker: true }); await planFromGps(app); await app.click('#save-offline');
  const reopened = runtime(Object.fromEntries(app.saved), { worker: true, offline: true, registerFails: true });
  await reopened.r.__test.workerReady;
  assert.equal(reopened.state.cacheVerified, true); assert.equal(reopened.state.screen, 'journey');
  assert.equal(reopened.state.points[0].lat, 25.034); assert.equal(reopened.state.routes.length, 1);
  assert.equal(reopened.element('#no-cache-overlay').hidden, true); assert.equal(reopened.state.history.length, 0);
});

test('editing a restored offline route uses the saved points, not a later draft', async () => {
  const app = runtime({}, { worker: true }); await planFromGps(app); await app.click('#save-offline');
  const destination = app.state.snapshot.points[1].name;
  await app.click('#back-button'); await app.input('#destination-0', app.r.FRIENDLY_DATA.stores[1].name);
  await app.click('#restore-offline'); await app.click('#edit-trip');
  assert.equal(app.state.destinations[0].name, destination);
  assert.equal(app.state.originMode, 'history'); assert.match(app.state.historyOrigin.name, /已保存/);
});

test('a route calculation completing after input changed cannot restore the old comparison', async () => {
  const app = runtime(); await app.click('#home-start'); await app.click('#retry-gps'); app.gpsRequests[0].success(position()); await app.click('#use-gps-origin');
  await app.input('#destination-0', app.r.FRIENDLY_DATA.stores[0].name);
  let resolve; const compare = app.r.FriendlyRouter.compare;
  app.r.FriendlyRouter.compare = (options) => new Promise((done) => { resolve = () => done(compare(options)); });
  const submitting = app.element('#route-form').dispatch('submit'); await Promise.resolve(); await Promise.resolve();
  assert(resolve); await app.input('#destination-0', app.r.FRIENDLY_DATA.stores[1].name);
  resolve(); await submitting; assert.equal(app.state.screen, 'plan'); assert.equal(app.state.routes.length, 0); assert.equal(app.element('#build-route').disabled, false); app.r.FriendlyRouter.compare = compare; await app.element('#route-form').dispatch('submit'); assert.equal(app.state.screen, 'confirm');
});

test('history preserves its chosen route; an immediate start during recomputation cannot use stale results', async () => {
  const app = runtime({}, { twoRoutes: true }); await planFromGps(app);
  await app.click('[data-route-id="resources"]'); await app.click('#save-history'); await app.click('#start-trip');
  assert.equal(app.state.selectedRouteId, 'resources'); await app.click('#edit-trip');
  await app.input('#trip-date', '2026-11-08', 'change'); await app.click('#open-history'); await app.click('[data-restore-history]');
  let resolve; const compare = app.r.FriendlyRouter.compare;
  app.r.FriendlyRouter.compare = (options) => new Promise((done) => { resolve = () => done(compare(options)); });
  const submitting = app.element('#route-form').dispatch('submit'); await Promise.resolve(); await Promise.resolve();
  assert.equal(app.element('#start-trip').disabled, true); await app.click('#start-trip');
  assert.equal(app.state.screen, 'plan'); assert.equal(app.r.__test.selectedRoute(), null);
  resolve(); await submitting;
  assert.equal(app.state.screen, 'confirm'); assert.equal(app.state.date, '2026-11-08');
  assert.equal(app.state.selectedRouteId, 'resources'); assert.equal(app.element('#start-trip').disabled, false);
  await app.click('#start-trip'); assert.equal(app.state.screen, 'journey'); assert.equal(app.state.selectedRouteId, 'resources');
});

test('the real demo router preserves saved resources preference through date change and immediate start', async () => {
  const app = runtime({}, { realRouter: true }); await app.click('#demo-route'); await app.element('#route-form').dispatch('submit');
  assert.equal(app.state.routes.length, 2); await app.click('[data-route-id="resources"]'); await app.click('#save-history'); await app.click('#start-trip');
  await app.click('#edit-trip'); await app.input('#trip-date', '2026-11-08', 'change'); await app.click('#open-history'); await app.click('[data-restore-history]');
  const submitting = app.element('#route-form').dispatch('submit'); assert.equal(app.element('#start-trip').disabled, true);
  await app.click('#start-trip'); assert.notEqual(app.state.screen, 'journey'); await submitting;
  assert.equal(app.state.selectedRouteId, 'resources'); assert.equal(app.state.routes.find((r) => r.id === 'resources').resourceCount, 36);
  await app.click('#start-trip'); assert.equal(app.state.screen, 'journey'); assert.equal(app.state.selectedRouteId, 'resources');
});

test('a failed offline completeness check clears success state and never writes history', async () => {
  const app = runtime({}, { worker: true, missingAsset: true }); await planFromGps(app); await app.click('#save-offline');
  assert.equal(app.state.snapshot, null); assert.equal(app.state.cacheVerified, false);
  assert.equal(app.state.history.length, 0); assert.match(app.element('#toast').textContent, /失敗|齊全|停用/);
});

test('help is local, requires consent, defaults to no route, and hides data after expiry', async () => {
  const app = runtime(); await planFromGps(app); await app.click('#open-help');
  await app.input('#help-place', String(app.r.FRIENDLY_DATA.stores[0].id)); await app.input('#help-reason', '測試需求');
  await app.element('#help-form').dispatch('submit'); assert.equal(app.state.request, null); assert.match(app.element('#help-error').textContent, /同意/);
  app.element('#help-consent').checked = true; await app.element('#help-consent').dispatch('input');
  await app.element('#help-form').dispatch('submit'); assert.equal(app.state.request.status, 'pending');
  assert.equal(app.state.request.sharedPoints.length, 0); assert.equal(app.state.request.routeCoordinates.length, 0);
  app.state.request.expiresAt = app.r.Date.now() - 1; await app.click('#ack-request');
  assert.equal(app.state.request.status, 'expired'); assert.equal(app.state.request.placeId, ''); assert.equal(app.state.request.reason, '');
  assert.equal(app.writes.length, 0);
});

test('the map starts without an origin; opening planning never requests GPS implicitly', async () => {
  const app = runtime(); assert.equal(app.r.__test.currentOrigin(), null); assert.equal(app.state.gps, null);
  await app.click('#home-start'); assert.equal(app.gpsRequests.length, 0); assert.equal(app.state.originMode, 'unset');
  await app.element('#route-form').dispatch('submit'); assert.match(app.element('#route-error').textContent, /先設定起點/);
});

test('GPS refresh and cancellation preserve a deliberately copied origin and its route', async () => {
  const app = runtime(); await planFromGps(app); const origin = JSON.stringify(app.state.points[0]); const route = app.state.routes[0];
  await app.click('#home-gps'); app.gpsRequests.at(-1).success(position(25.035, 121.563));
  assert.equal(app.state.gps.lat, 25.035); assert.equal(JSON.stringify(app.r.__test.currentOrigin()), origin); assert.equal(app.state.routes[0], route);
  await app.click('#retry-gps'); const pending = app.gpsRequests.at(-1); await app.click('#cancel-gps'); pending.success(position(25.036, 121.564));
  assert.equal(app.state.gps.lat, 25.035); assert.equal(app.state.routes[0], route); assert.equal(JSON.stringify(app.r.__test.currentOrigin()), origin);
});

test('map place selection requires an explicit origin, then previews a route and highlights nearby resources', async () => {
  const app = runtime(); const store = app.r.FRIENDLY_DATA.stores[0];
  await app.r.__test.selectPlace(app.r.__test.catalogPlace(store), { autoPreview: true });
  assert.equal(app.state.routes.length, 0); assert.equal(app.element('#place-preview').hidden, false); assert.equal(app.element('#home-overview').hidden, true);
  assert.match(app.element('#preview-status').textContent, /先設定行程起點/);
  await app.click('#preview-route'); assert.equal(app.element('#search-dialog').open, true);
  await app.click('#search-demo-origin');
  assert.equal(app.state.originPoint.kind, 'demo'); assert.equal(app.state.screen, 'home'); assert.equal(app.state.selectedRouteId, 'shortest');
  assert(app.markers.some((marker) => marker.settings.title?.includes('路線附近')));
  const previous = app.state.routes[0]; const destination = JSON.stringify(app.state.points.at(-1));
  await app.r.__test.selectPlace(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[1]), { autoPreview: true });
  assert.equal(app.state.routes[0], previous); assert.equal(JSON.stringify(app.state.points.at(-1)), destination);
  await app.click('#preview-details'); assert.equal(app.element('#store-drawer').open, true); assert.equal(app.state.routes[0], previous);
  await app.click('#preview-route'); assert.equal(app.state.points.at(-1).name, app.r.FRIENDLY_DATA.stores[1].name);
});

test('home service chips pick one category and pressing it again restores all services', async () => {
  const app = runtime(); const chip = app.element('#map-filters').children.find((element) => element.dataset.service === 'toilet');
  await chip.dispatch('click'); assert.deepEqual([...app.state.filters], ['toilet']);
  const selected = app.element('#map-filters').children.find((element) => element.dataset.service === 'toilet'); await selected.dispatch('click'); assert.equal(app.state.filters.size, 4);
});

test('search runs locally on input, only submits remotely, escapes labels, and preserves arbitrary coordinates', async () => {
  const requests = []; const place = { id: 'photon:101', name: '<img src=x onerror=alert(1)>', address: '<b>松智路</b>', lat: 25.0338352, lng: 121.5644995, source: 'photon' };
  const app = runtime({}, { searchClient: { async search(query, options) { requests.push({ query, options }); return [place]; } } });
  await app.click('#home-search'); await app.input('#place-search', '台北101'); assert.equal(requests.length, 0);
  await app.element('#search-form').dispatch('submit'); assert.equal(requests.length, 1); assert.equal(requests[0].query, '台北101');
  assert.match(app.element('#search-results').innerHTML, /&lt;img/); assert.doesNotMatch(app.element('#search-results').innerHTML, /<img/);
  await app.click('[data-search-result]'); assert.equal(app.state.previewPlace.lat, place.lat); assert.equal(app.state.previewPlace.lng, place.lng); assert.equal(app.state.routes.length, 0);
  await app.click('#preview-route'); await app.click('#search-demo-origin'); assert.equal(app.state.points.at(-1).lat, place.lat);
  await app.click('#home-start'); await app.input('#destination-0', '另一個尚未選定地點'); assert.equal(typeof app.state.destinations[0], 'string');
  await app.element('#route-form').dispatch('submit'); assert.equal(app.state.routes.length, 0); assert.match(app.element('#route-error').textContent, /尚未選定/);
});

test('new search input aborts an old request and prevents old result selection', async () => {
  let resolve; let signal; const app = runtime({}, { searchClient: { search(_, options) { signal = options.signal; return new Promise((done) => { resolve = done; }); } } });
  await app.click('#home-search'); await app.input('#place-search', app.r.FRIENDLY_DATA.stores[0].name);
  const staleButton = app.element('[data-search-result]'); const submitting = app.element('#search-form').dispatch('submit');
  await app.input('#place-search', 'new query'); assert.equal(signal.aborted, true);
  resolve([{ id: 'old', name: 'old', lat: 25.034, lng: 121.561, source: 'photon' }]); await submitting;
  assert.equal(app.state.searchResults.length, 0); await staleButton.dispatch('click'); assert.equal(app.state.previewPlace, null);
});

test('outside search results retain their coordinates but cannot create a fake route', async () => {
  const app = runtime(); await app.r.__test.setOrigin(app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[0]));
  await app.r.__test.selectPlace({ id: 'remote', name: '範圍外地點', lat: 24, lng: 120, source: 'photon' }, { autoPreview: true });
  assert.equal(app.state.previewPlace.lat, 24); assert.equal(app.state.routes.length, 0); assert.equal(app.element('#preview-route').disabled, true);
  assert.match(app.element('#preview-status').textContent, /超出/);
});

test('arbitrary destination coordinates survive history and offline restoration', async () => {
  const app = runtime({}, { worker: true }); const origin = app.r.__test.catalogPlace(app.r.FRIENDLY_DATA.stores[0]);
  const destination = { id: 'photon:101', name: '台北101', address: '信義路五段7號', lat: 25.0338352, lng: 121.5644995, source: 'photon' };
  await app.r.__test.setOrigin(origin); await app.r.__test.selectPlace(destination, { autoPreview: true }); await app.click('#save-history'); await app.click('#save-offline');
  await app.click('#open-history'); await app.click('[data-restore-history]'); assert.equal(app.state.destinations[0].lat, destination.lat); assert.equal(app.state.destinations[0].source, 'photon');
  await app.element('#route-form').dispatch('submit'); assert.equal(app.state.points.at(-1).lng, destination.lng);
  await app.click('#restore-offline'); assert.equal(app.state.destinations[0].lat, destination.lat); assert.equal(app.state.points.at(-1).source, 'photon');
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
