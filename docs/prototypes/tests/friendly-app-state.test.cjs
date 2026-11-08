/* D6 P0 integration checks. Run: node --test docs/prototypes/tests/friendly-app-state.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const base = path.resolve(__dirname, '../friendly-route');
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
const dataContext = vm.createContext({ window: {} });
for (const filename of ['data.js', 'resources-data.js']) vm.runInContext(fs.readFileSync(path.join(base, filename), 'utf8'), dataContext, { filename });
const actualData = dataContext.window.FRIENDLY_RESOURCES;
const actualBasemap = dataContext.window.FRIENDLY_DATA;
const hasCoordinates = p => Number.isFinite(p.lat) && Number.isFinite(p.lng);
const fixedTime = Date.parse('2026-11-07T09:30:00Z');
const settle = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
process.env.TZ = 'Asia/Taipei';

// Models bubbling, descendant replacement and modal focus; not browser layout,
// Leaflet rendering, accessibility or Service Worker behaviour.
function makeDocument(markup) {
  let document;
  const matches = (el, selector) => {
    if (selector.startsWith('#')) return el.id === selector.slice(1);
    const attr = selector.match(/^([\w-]*)\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (attr) return (!attr[1] || el.tagName === attr[1]) && attr[2] in el.attributes && (attr[3] === undefined || el.attributes[attr[2]] === attr[3]);
    return el.tagName === selector;
  };
  const descendants = root => root.children.flatMap(el => [el, ...descendants(el)]);
  class Element {
    constructor(tag, attributes = {}) {
      this.tagName = tag; this.attributes = attributes; this.id = attributes.id;
      this.dataset = Object.fromEntries(Object.entries(attributes).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
      this.children = []; this.parentNode = null; this.events = {}; this.value = attributes.value || '';
      this.hidden = 'hidden' in attributes; this.disabled = 'disabled' in attributes; this.open = false;
      this.style = { setProperty(name, value) { this[name] = value; } };
      const classes = new Set((attributes.class || '').split(/\s+/));
      this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle(name, force) { const present = force ?? !classes.has(name); present ? classes.add(name) : classes.delete(name); return present; } };
      this._text = '';
    }
    set innerHTML(value) { this.children.forEach(child => { child.parentNode = null; }); this._html = String(value); this._text = ''; this.children = parse(this._html, this); }
    get innerHTML() { return this._html || ''; }
    set textContent(value) { this._text = String(value); this.children.forEach(child => { child.parentNode = null; }); this.children = []; this._html = ''; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    get isConnected() { return this === document || Boolean(this.parentNode?.isConnected); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name]; }
    querySelectorAll(selector) { return descendants(this).filter(el => matches(el, selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return matches(this, selector) ? this : this.parentNode?.closest?.(selector) || null; }
    addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
    async dispatch(name, extra = {}) {
      if (name === 'click' && this.disabled) return;
      const event = { target: this, currentTarget: this, preventDefault() {}, stopPropagation() { this.stopped = true; }, ...extra };
      for (let el = this; el; el = el.parentNode) {
        event.currentTarget = el;
        // Native dispatch does not wait for async listeners (GPS/search may be pending).
        for (const callback of el.events[name] || []) callback(event);
        if (event.stopped) break;
      }
      await settle();
    }
    focus() { document.activeElement = this; }
    blur() { if (document.activeElement === this) document.activeElement = document.body; }
    showModal() { this.open = true; this.querySelector('button')?.focus(); }
    close() { this.open = false; }
    getBoundingClientRect() { return { top: 200, left: 0, right: 390, bottom: 600, width: 390, height: this.id === 'bottom-panel' ? 260 : 400 }; }
  }
  function parse(source, parent) {
    const root = { children: [], parentNode: parent }; const stack = [root];
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    for (const token of source.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?([a-z][\w-]*)([^>]*)>|([^<]+)/gi)) {
      if (token[3]) { if (stack.at(-1) instanceof Element) stack.at(-1)._text += token[3]; continue; }
      if (!token[1]) continue;
      const tag = token[1].toLowerCase();
      if (token[0].startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      const attrs = Object.fromEntries([...token[2].matchAll(/([\w:-]+)(?:="([^"]*)"|='([^']*)')?/g)].map(([, key, double, single]) => [key, double ?? single ?? '']));
      const element = new Element(tag, attrs); element.parentNode = stack.length === 1 ? parent : stack.at(-1); stack.at(-1).children.push(element);
      if (!voidTags.has(tag) && !token[0].endsWith('/>')) stack.push(element);
    }
    return root.children;
  }
  document = new Element('document'); document.children = parse(markup, document);
  document.documentElement = document.querySelector('html'); document.body = document.querySelector('body'); document.activeElement = document.body;
  return document;
}

function makeLeaflet() {
  const layers = new Set(); const mapEvents = new Map(); const moves = []; const invalidations = []; const fittedBounds = [];
  let center = { lat: 25.0375, lng: 121.5637 }; let zoom = 14.5; let bounds = [[-90, -180], [90, 180]];
  const point = (x, y) => ({ x, y, add(other) { return point(this.x + other.x, this.y + other.y); } });
  const latLng = value => Array.isArray(value) ? { lat: value[0], lng: value[1] } : value;
  const map = {
    invalidateSize(options) { invalidations.push(options); return this; },
    fitBounds(value, options) { fittedBounds.push({ value, options }); center = { lat: (value[0][0] + value[1][0]) / 2, lng: (value[0][1] + value[1][1]) / 2 }; return this; },
    setView(value, nextZoom) { center = latLng(value); zoom = nextZoom; moves.push({ center: { ...center }, zoom }); return this; },
    getCenter: () => center, getZoom: () => zoom, getSize: () => point(390, 844),
    getBounds: () => ({ getSouthWest: () => latLng(bounds[0]), getNorthEast: () => latLng(bounds[1]), contains(value) { const p = latLng(value); return p.lat >= bounds[0][0] && p.lat <= bounds[1][0] && p.lng >= bounds[0][1] && p.lng <= bounds[1][1]; } }),
    project(value) { const p = latLng(value); return point(p.lng * 10000, -p.lat * 10000); },
    unproject(value) { return { lat: -value.y / 10000, lng: value.x / 10000 }; },
    latLngToContainerPoint(value) { const p = latLng(value); return point((p.lng - center.lng) * 30000 + 195, (center.lat - p.lat) * 30000 + 422); },
    removeLayer(layer) { layers.delete(layer); layer?.parent?.children?.delete(layer); return this; },
    hasLayer: layer => layers.has(layer),
    on(names, callback) { names.split(' ').forEach(name => mapEvents.set(name, callback)); return this; },
  };
  const layer = (coordinates, options = {}) => ({
    coordinates, options, styles: { ...options }, handlers: {}, children: new Set(),
    addTo(parent) { this.parent = parent; parent.children?.add(this); layers.add(this); return this; },
    on(name, callback) { this.handlers[name] = callback; return this; },
    setStyle(style) { Object.assign(this.styles, style); return this; },
    bringToBack() { return this; }, clearLayers() { this.children.forEach(child => layers.delete(child)); this.children.clear(); return this; },
    addAttribution() { return this; },
  });
  return {
    L: { map: () => map, point, canvas: () => ({}), control: { attribution: () => layer(), scale: () => layer() }, layerGroup: () => layer(), geoJSON: () => layer(), tileLayer: () => layer(), circleMarker: layer, marker: layer, polyline: (coordinates, options) => Object.assign(layer(coordinates, options), { kind: 'polyline' }), divIcon: settings => settings },
    map, moves, layers, invalidations, fittedBounds,
    async setBounds(value) { bounds = value; mapEvents.get('moveend')?.(); await settle(); },
  };
}

// Session history model: pushState/replaceState/go fire popstate asynchronously like a browser; going
// below the first entry records that the user left the micro-service. go(0) would reload, so it throws.
function makeHistory(listeners, initialState = null) {
  const history = { entries: [initialState], index: 0, calls: [], exited: false };
  Object.defineProperty(history, 'state', { get() { return history.entries[history.index] ?? null; } });
  history.pushState = state => { history.calls.push(['push', state]); history.entries = history.entries.slice(0, history.index + 1); history.entries.push(structuredClone(state)); history.index += 1; };
  history.replaceState = state => { history.calls.push(['replace', state]); history.entries[history.index] = structuredClone(state); };
  history.go = delta => {
    history.calls.push(['go', delta]); if (!delta) throw new Error('history.go(0) reloads the page');
    const next = history.index + delta; if (next < 0) { history.exited = true; return; }
    history.index = next; const state = history.state;
    queueMicrotask(() => { for (const cb of listeners.get('popstate') || []) cb({ state }); });
  };
  history.back = () => history.go(-1);
  return history;
}

// Records calls only; the real overlay is covered by friendly-speak-card.test.cjs and the browser script.
function makeSpeakCard(calls, langs = [{ code: 'zh-TW', label: '中文', reviewed: true }]) {
  let current = null;
  return {
    getAvailableLangs: () => langs,
    openSpeakCard(options) { calls.push({ method: 'open', ...options }); current = options; return { layout: 'single', fellBack: false }; },
    closeSpeakCard({ silent = false } = {}) { calls.push({ method: 'close', silent }); if (!current) return false; const { onClose } = current; current = null; if (!silent) onClose?.(); return true; },
    get isOpen() { return Boolean(current); },
  };
}

function runtime(options = {}) {
  const document = makeDocument(html); const leaflet = makeLeaflet(); const gpsRequests = []; const storageWrites = []; const speakCalls = []; const bridgeCalls = []; const searchCalls = []; const copied = []; const listeners = new Map(); const cacheCalls = []; const routeRequests = []; const routeCancels = []; const observed = [];
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixedTime])); } static now() { return fixedTime; } }
  const r = {
    document, URL, AbortController, Date: FixedDate, console, innerWidth: 390, structuredClone,
    FRIENDLY_DATA: actualBasemap, FRIENDLY_RESOURCES: options.resources || actualData, L: leaflet.L,
    history: makeHistory(listeners, options.historyState || null), FriendlySpeakCard: makeSpeakCard(speakCalls, options.speakLangs),
    FriendlyHighlights: options.highlightCalls ? { create: () => ({ update() {}, open() {}, handleResource: () => false, openToilet: (store, route) => options.highlightCalls.push({ method: 'openToilet', id: String(store.id), route }), pauseGuide: () => options.highlightCalls.push({ method: 'pauseGuide' }), close: () => options.highlightCalls.push({ method: 'close' }) }) } : undefined,
    location: new URL('https://example.test/friendly/index.html'),
    navigator: { onLine: options.offline !== true, language: options.language, clipboard: { async writeText(text) { copied.push(text); } } },
    FriendlyIcons: { icon: name => `<svg data-test-icon="${name}"></svg>` },
    FriendlyBridge: {
      getLocation: () => new Promise((resolve, reject) => gpsRequests.push({ resolve, reject })),
      async navigate(store) { bridgeCalls.push({ method: 'navigate', value: store }); return options.navigate?.(store) ?? options.externalResult ?? 'opened'; },
      async callPhone(phone) { bridgeCalls.push({ method: 'phone', value: phone }); return options.externalResult ?? 'opened'; },
    },
    FriendlySearch: { createClient: () => ({ async search(query, args) { searchCalls.push({ query, ...args }); return options.search ? options.search(query, args) : []; } }) },
    FriendlyRouteClient: options.noRouter ? undefined : { createClient: () => ({ route(input) { return new Promise((resolve, reject) => routeRequests.push({ input, resolve, reject })); }, cancel() { routeCancels.push(true); } }) },
    FriendlyOffline: { async initialize(callback) { cacheCalls.push(callback); const status = options.cacheStatus || { state: 'ready', savedAt: fixedTime, failures: [] }; callback(status); return status; } },
    localStorage: options.storageThrows ? { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } : { getItem: key => options.storage?.[key] ?? null, setItem: (key, value) => storageWrites.push([key, value]), removeItem: key => storageWrites.push([key, null]) },
    requestAnimationFrame(callback) { queueMicrotask(() => callback(0)); return 1; }, cancelAnimationFrame() {},
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe(target) { observed.push({ target, callback: this.callback }); } disconnect() {} },
    // 以減少動態模式跑：首頁按鈕不等卡住動畫，點下就換頁（setTimeout 在此不執行）。
    matchMedia: query => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
    setTimeout() { return 1; }, clearTimeout() {},
    addEventListener(name, callback) { (listeners.get(name) || listeners.set(name, []).get(name)).push(callback); },
    DeviceOrientationEvent: options.orientation,
  };
  r.window = r; vm.createContext(r);
  for (const filename of ['i18n.js', 'urgency.js']) vm.runInContext(fs.readFileSync(path.join(base, filename), 'utf8'), r, { filename });
  if (options.realHighlights) {
    const panes = new Map();
    Object.assign(leaflet.map, { getPane: name => panes.get(name), createPane: name => panes.set(name, { style: {} }).get(name), off() { return this; }, panTo() { return this; } });
    leaflet.L.circle = leaflet.L.circleMarker;
    Object.assign(r, { MutationObserver: class { observe() {} disconnect() {} }, setInterval: () => 1, clearInterval() {}, matchMedia: query => ({ matches: query === '(prefers-reduced-motion: reduce)', addEventListener() {}, removeEventListener() {} }) });
    for (const filename of ['highlight-math.js', 'highlights.js']) vm.runInContext(fs.readFileSync(path.join(base, filename), 'utf8'), r, { filename });
  }
  // Observe private state through an in-memory seam, leaving production files unchanged.
  const seam = 'window.__test = { state, markers, requestPosition, visibleStores, selectResource, setDestination, showDetails, showDirection, externalAction, enableOrientation, orientation, renderAll, setView, endGuidance, openUrgency, renderResult, nextResult, applyScreen, goBack, goHome, speakCategory, openMap }; ';
  const source = fs.readFileSync(path.join(base, 'app.js'), 'utf8'); assert.match(source, /\}\)\(\);\s*$/);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `${seam}\n})();`), r, { filename: 'app.js' });
  const element = selector => { const el = document.querySelector(selector); assert(el, `Missing test element: ${selector}`); return el; };
  return {
    r, state: r.__test.state, history: r.history, speakCard: r.FriendlySpeakCard, speakCalls, gpsRequests, storageWrites, bridgeCalls, searchCalls, copied, cacheCalls, routeRequests, routeCancels, observed, ...leaflet,
    element, click: selector => element(selector).dispatch('click'),
    // 選取卡的「帶我去」取代了舊的 START 鈕。
    goSelected: () => element('#selected-card').querySelector('[data-action="go"]').dispatch('click'),
    async input(selector, value) { const el = element(selector); el.value = value; await el.dispatch('input'); },
    async fix(index = gpsRequests.length - 1, values = {}) { gpsRequests[index].resolve({ lat: 25.034, lng: 121.561, accuracy: 15, capturedAt: fixedTime, source: 'browser', ...values }); await settle(); },
    async fail(code, index = gpsRequests.length - 1) { gpsRequests[index].reject(Object.assign(new Error('Explicit test error'), { code })); await settle(); },
    async connectivity(online) { r.navigator.onLine = online; for (const cb of listeners.get(online ? 'online' : 'offline') || []) cb(); await settle(); },
    async event(name, event) { for (const cb of listeners.get(name) || []) cb(event); await settle(); },
  };
}

test('first open requests location and automatic caching without planning or interaction workflow', async () => {
  const app = runtime(); await settle();
  assert.equal(app.gpsRequests.length, 1); assert.equal(app.cacheCalls.length, 1); assert.equal(app.state.position, null);
  await app.fix(); assert.equal(app.state.position.lat, 25.034); assert.equal(app.storageWrites.length, 0);
  assert.match(app.element('#location-status').textContent, /15 m/); assert.match(app.element('#location-status').textContent, /17:30/);
  assert.doesNotMatch(html, /(?:id|data-action)="(?:review|comment|help|plan|confirm|history)(?:-|")|type="date"/i);
  assert.equal(app.r.document.querySelector('[data-action="help"]'), null);
});

test('location failures disclose a non-GPS map centre and retain a retry action', async t => {
  for (const [code, expected] of [['BRIDGE_LOCATION_FAILED', /無法取得定位/], ['GEO_DENIED', /定位權限未開啟/], ['GEO_TIMEOUT', /定位逾時/], ['GEO_UNSUPPORTED', /不支援定位/]]) {
    await t.test(code, async () => {
      const app = runtime(); await app.fail(code);
      assert.equal(app.state.position, null); assert.equal(app.state.gpsPending, false);
      assert.match(app.element('#location-status').textContent, /目前非您的位置/);
      assert.match(app.element('#location-notice').innerHTML, expected); assert.match(app.element('#location-notice').innerHTML, /重新定位/);
      const store = actualData.stores.find(hasCoordinates); app.r.__test.selectResource(store.id);
      assert.match(app.element('#selected-card').innerHTML, /直線距離（非步行路線）.*依地圖中心估算/);
      assert.doesNotMatch(app.element('#selected-card').innerHTML, /NaN|undefined/);
    });
  }
});

test('accuracy above 100 m remains valid and prominently warns about uncertainty', async () => {
  const app = runtime(); await app.fix(0, { accuracy: 101 });
  assert.equal(app.state.position.accuracy, 101); assert.match(app.element('#location-status').textContent, /精度不足.*101 m/);
  assert.equal(app.element('#location-notice').hidden, false); assert.match(app.element('#location-notice').innerHTML, /精度不足/);
  await app.click('#gps-button'); await app.fix(1, { accuracy: 100 }); assert.doesNotMatch(app.element('#location-status').textContent, /精度不足/);
});

test('late location success or failure cannot overwrite a newer request', async () => {
  const app = runtime(); const latest = app.r.__test.requestPosition();
  await app.fix(1, { lat: 25.06, lng: 121.57 }); await latest; await app.fail('GEO_DENIED', 0);
  assert.equal(app.state.position.lat, 25.06); assert.equal(app.state.gpsError, null);
  const third = app.r.__test.requestPosition(); const fourth = app.r.__test.requestPosition();
  await app.fix(3, { lat: 25.08 }); await fourth; await app.fix(2, { lat: 24.8 }); await third;
  assert.equal(app.state.position.lat, 25.08); assert.equal(app.state.gpsPending, false);
});

test('offline reopening requests GPS; OR category highlighting never removes nonmatches', async () => {
  const app = runtime({ offline: true }); await app.fix();
  assert.equal(app.gpsRequests.length, 1); assert.equal(app.state.position.lat, 25.034);
  const total = actualData.stores.filter(hasCoordinates).length; assert.equal(app.r.__test.markers.size, total);
  await app.click('[data-service="wifi"]'); await app.click('[data-service="charge"]');
  assert.deepEqual([...app.state.filters].sort(), ['charge', 'wifi']); assert.equal(app.r.__test.markers.size, total);
  for (const store of actualData.stores.filter(hasCoordinates)) {
    const marker = app.r.__test.markers.get(store.id); const matches = store.services.some(service => ['wifi', 'charge'].includes(service));
    assert.equal(marker.styles.radius, matches ? 7 : 4, store.id); assert.equal(marker.styles.opacity, matches ? .9 : .2, store.id);
  }
  assert.equal(app.r.__test.visibleStores().length, actualData.stores.filter(s => hasCoordinates(s) && s.services.some(service => ['wifi', 'charge'].includes(service))).length);
  await app.click('[data-service="wifi"]'); assert.deepEqual([...app.state.filters], ['charge']);
  await app.click('[data-service="charge"]'); assert.equal(app.state.filters.size, 0);
  assert.equal(app.r.__test.markers.size, total); assert([...app.r.__test.markers.values()].every(marker => marker.styles.opacity === .2 && marker.styles.radius === 4));
});

test('no selected category means no resources: empty list, dim dots and an explicit empty state', async () => {
  const app = runtime({ offline: true }); await app.fix(); await app.click('#home-map');
  assert.equal(app.state.filters.size, 0); assert.equal(app.r.__test.visibleStores().length, 0);
  assert.equal(app.element('#panel-summary').textContent, '附近資源 · 尚未選類別');
  assert.match(app.element('#nearby-preview').innerHTML, /data-empty="no-category"/); assert.match(app.element('#nearby-preview').innerHTML, /先選一種服務/);
  assert([...app.r.__test.markers.values()].every(marker => marker.styles.opacity === .2));
  await app.click('#list-button'); assert.match(app.element('#sheet-body').innerHTML, /先選一種服務/);
  assert.equal(app.element('#sheet-body').querySelectorAll('[data-resource]').length, 0);
  await app.click('#sheet-close'); await app.click('[data-service="wifi"]');
  assert(app.r.__test.visibleStores().length > 0); assert.doesNotMatch(app.element('#nearby-preview').innerHTML, /no-category/);
});

test('four categories agree with source flags and zero counts refer to the viewport', async () => {
  const app = runtime({ offline: true }); await settle();
  for (const service of ['toilet', 'charge', 'wifi', 'accessible']) {
    await app.click(`[data-service="${service}"]`);
    assert.equal(app.r.__test.visibleStores().length, actualData.stores.filter(s => hasCoordinates(s) && s.services.includes(service)).length);
    await app.click(`[data-service="${service}"]`);
  }
  await app.click('[data-service="toilet"]'); await app.setBounds([[0, 0], [1, 1]]);
  assert.equal(app.element('#panel-summary').textContent, '附近資源 · 視窗內 0 筆'); assert.match(app.element('#nearby-preview').innerHTML, /視窗內沒有符合/);
  assert.deepEqual([...app.state.filters], ['toilet']); assert(app.r.__test.markers.size > 0);
});

test('offline local destination search works independently from the selected resource', async () => {
  const app = runtime({ offline: true }); const resource = actualData.stores.find(s => hasCoordinates(s) && s.phone); app.r.__test.selectResource(resource.id);
  const destination = actualData.stores.find(s => hasCoordinates(s) && s.id !== resource.id && s.name !== resource.name);
  await app.click('#search-trigger'); await app.input('#search-input', destination.name); await app.element('#search-form').dispatch('submit');
  assert.match(app.element('#search-message').textContent, /僅搜尋已下載資料/); assert.equal(app.searchCalls.length, 0);
  assert(!app.state.searchResults.some(place => place.source === 'photon'));
  await app.click('[data-search-result="0"]'); assert.equal(app.state.destination.name, destination.name); assert.equal(app.state.selectedId, resource.id);
  assert.equal(app.element('#app-sheet').open, false); assert.equal(app.element('#destination-clear').hidden, false);
  await app.click('#destination-clear'); assert.equal(app.state.destination, null); assert.equal(app.state.selectedId, resource.id);
});

test('online search sends an explicit query only, escapes output and ignores stale responses', async () => {
  let finish;
  const app = runtime({ search: () => new Promise(resolve => { finish = resolve; }) });
  await app.click('#search-trigger'); await app.input('#search-input', '測試目的地'); assert.equal(app.searchCalls.length, 0);
  const submitting = app.element('#search-form').dispatch('submit'); await settle();
  assert.equal(app.searchCalls[0].query, '測試目的地'); assert.deepEqual(Object.keys(app.searchCalls[0]).sort(), ['query', 'signal']);
  await app.input('#search-input', '另一個測試'); assert.equal(app.searchCalls[0].signal.aborted, true);
  assert.equal(app.element('#search-submit').disabled, false, 'Editing a pending query must allow submitting the replacement query');
  finish([{ id: 'test:remote', name: '<img src=x>', address: '<b>測試用地址</b>', lat: 25.03, lng: 121.56, source: 'photon' }]); await submitting; await settle();
  assert.equal(app.state.searchResults.length, 0); assert.equal(app.state.destination, null);
  const next = runtime({ search: async () => [{ id: 'test:remote', name: '<img src=x>', address: '<b>測試用地址</b>', lat: 25.03, lng: 121.56, source: 'photon' }] });
  await next.click('#search-trigger'); await next.input('#search-input', '測試目的地'); await next.element('#search-form').dispatch('submit');
  assert.match(next.element('#search-results').innerHTML, /&lt;img/); assert.doesNotMatch(next.element('#search-results').innerHTML, /<img/);
});

test('cards show source/update date, straight-line distance and truthful missing fields', async () => {
  const app = runtime(); await app.fix();
  for (const sourceId of ['friendly', 'toilets', 'mrt', 'wifi']) {
    const entry = actualData.stores.find(s => s.sourceId === sourceId && hasCoordinates(s)); app.r.__test.selectResource(entry.id);
    const rendered = app.element('#selected-card').innerHTML;
    assert(rendered.includes(entry.sourceName), sourceId); assert(rendered.includes(entry.sourceUrl.replace(/&/g, '&amp;')), sourceId);
    assert(rendered.includes(entry.updatedAt.slice(0, 10)), sourceId);
  }
  const store = actualData.stores.find(s => hasCoordinates(s) && s.services.length === 0); app.r.__test.selectResource(store.id);
  const card = app.element('#selected-card').innerHTML;
  assert(card.includes(store.sourceName)); assert(card.includes(store.sourceUrl.replace(/&/g, '&amp;'))); assert(card.includes(store.updatedAt.slice(0, 10)));
  assert.match(card, /直線距離（非步行路線）/); assert.match(card, /服務未標示/);
  await app.click('[data-action="detail"]'); assert.match(app.element('#sheet-body').innerHTML, /待確認/); assert.match(app.element('#sheet-body').innerHTML, /未標示/);
  const noCoordinate = actualData.stores.find(s => !hasCoordinates(s)); app.r.__test.selectResource(noCoordinate.id);
  assert.match(app.element('#selected-card').innerHTML, /未提供座標/); assert.equal(app.element('#selected-card').querySelector('[data-action="go"]').disabled, true);
});

test('inferred services are visibly separated from official evidence', async () => {
  const app = runtime(); await app.fix();
  const store = actualData.stores.find(entry => hasCoordinates(entry) && entry.inferredServices?.length);
  assert(store, 'Generated data must include a common-knowledge annotation');
  app.r.__test.selectResource(store.id);
  const card = app.element('#selected-card').innerHTML;
  assert.match(card, /· 推定/);
  assert.match(card, /常識推定/);
  assert.match(card, /不是單店官方保證/);
  assert(card.includes(store.sourceName));
  app.r.__test.showDetails(store);
  assert.match(app.element('#sheet-body').innerHTML, /· 官方/);
  assert.match(app.element('#sheet-body').innerHTML, /· 推定/);
});

test('phone buttons require a normalized number, including Wi-Fi resources with no phone', async () => {
  const app = runtime(); const withPhone = actualData.stores.find(s => s.normalizedPhone); app.r.__test.selectResource(withPhone.id);
  assert.equal(app.element('#selected-card').querySelector('[data-action="phone"]'), null, 'dialing lives in the detail sheet');
  await app.click('[data-action="detail"]'); await app.element('#sheet-body').querySelector('[data-action="phone"]').dispatch('click');
  assert.equal(app.bridgeCalls.at(-1).method, 'phone'); assert.equal(app.bridgeCalls.at(-1).value, withPhone.normalizedPhone);
  const noPhone = actualData.stores.find(s => s.sourceId === 'wifi' && !s.normalizedPhone); app.r.__test.selectResource(noPhone.id);
  await app.click('[data-action="detail"]'); assert.equal(app.element('#sheet-body').querySelector('[data-action="phone"]'), null); assert.match(app.element('#selected-card').innerHTML, /來源：/);
});

test('straight-line distance and north-based bearing agree with a known geometric offset', async () => {
  const store = actualData.stores.find(hasCoordinates); const app = runtime({ offline: true });
  // Test GPS is exactly 0.001 degree north of an unchanged real resource.
  await app.fix(0, { lat: store.lat + .001, lng: store.lng }); app.r.__test.selectResource(store.id);
  assert.match(app.element('#selected-card').innerHTML, /111 公尺/);
  app.r.__test.showDirection(); const content = app.element('#direction-content').innerHTML;
  assert.match(content, /您的南方（以正北為基準）/); assert.match(content, /rotate\(180deg\)/); assert.match(content, /111 公尺/);
});

test('a delayed navigation failure cannot reopen stale resource details or mix copied addresses', async () => {
  let finish; const app = runtime({ navigate: () => new Promise(resolve => { finish = resolve; }) });
  const [first, second] = actualData.stores.filter(s => hasCoordinates(s) && s.normalizedPhone);
  app.r.__test.selectResource(first.id); const pending = app.r.__test.externalAction('navigate'); await settle();
  app.r.__test.selectResource(second.id); finish('failed'); await pending;
  assert.equal(app.state.selectedId, second.id);
  assert.equal(app.state.activeSheet, null, 'A stale result must not open A details over selected resource B');
  app.r.__test.showDetails(second); await app.click('[data-copy="address"]'); assert.equal(app.copied.at(-1), second.address);
});

test('offline external actions retain the external-program warning after the result arrives', async () => {
  const app = runtime({ offline: true, externalResult: 'unsupported' });
  app.r.__test.selectResource(actualData.stores.find(s => hasCoordinates(s) && s.normalizedPhone).id);
  await app.click('[data-action="detail"]'); await app.element('#sheet-body').querySelector('[data-action="navigate"]').dispatch('click');
  const visibleStatus = `${app.element('#toast').textContent} ${app.element('#external-message').textContent} ${app.element('#sheet-body').innerHTML}`;
  assert.match(visibleStatus, /離線.*可能無法使用|依賴外部程式|通話功能/);
  assert.equal(app.r.document.querySelector('[data-copy="address"]').hidden, false);
});

test('bridge failures and browser fallback preserve copyable details without announcing success', async t => {
  for (const result of ['failed', 'unsupported']) for (const kind of ['navigate', 'phone']) {
    await t.test(`${kind}:${result}`, async () => {
      const app = runtime({ externalResult: result }); const store = actualData.stores.find(s => s.normalizedPhone && hasCoordinates(s)); app.r.__test.selectResource(store.id);
      await app.click('[data-action="detail"]'); await app.element('#sheet-body').querySelector(`[data-action="${kind}"]`).dispatch('click'); assert.equal(app.bridgeCalls.at(-1).method, kind);
      const expected = result === 'unsupported' ? /需在台北通 App 內使用/ : kind === 'navigate' ? /無法開啟外部地圖/ : /無法撥號/;
      assert.match(app.element('#external-message').textContent, expected); assert.doesNotMatch(app.element('#toast').textContent, /已交由/);
      await app.click('[data-copy="address"]'); await app.click('[data-copy="phone"]'); assert.deepEqual(app.copied, [store.address, store.phone]);
    });
  }
});

test('offline outside basemap automatically shows distance and a north-based static direction', async () => {
  const app = runtime({ offline: true }); await app.fix(0, { lat: 25.12, lng: 121.5 });
  const store = actualData.stores.find(s => hasCoordinates(s) && s.lat > 25.13 && s.lng > 121.51); assert(store, 'Real source must contain a northeast resource');
  app.r.__test.selectResource(store.id); assert.equal(app.state.activeSheet, 'direction');
  const content = app.element('#direction-content').innerHTML;
  assert.match(content, /店家在您的.*方（以正北為基準）/); assert.match(content, /直線距離（非步行路線）/); assert.match(content, /transform:rotate\(/);
  await app.click('[data-action="orientation"]'); assert.match(app.element('#direction-content').innerHTML, /不支援方位感測.*以正北為基準/);
});

test('no arrow without location; rejected sensor permission retains the text fallback', async () => {
  const missing = runtime({ offline: true }); await missing.fail('GEO_DENIED'); missing.r.__test.selectResource(actualData.stores.find(hasCoordinates).id); missing.r.__test.showDirection();
  assert.match(missing.element('#direction-content').innerHTML, /需要定位才能指向/); assert.doesNotMatch(missing.element('#direction-content').innerHTML, /direction-arrow/);
  const denied = runtime({ offline: true, orientation: { requestPermission: async () => 'denied' } }); await denied.fix(); denied.r.__test.selectResource(actualData.stores.find(hasCoordinates).id); denied.r.__test.showDirection();
  await denied.click('[data-action="orientation"]'); assert.match(denied.element('#direction-content').innerHTML, /未取得方位權限.*以正北為基準/); assert.match(denied.element('#direction-content').innerHTML, /直線距離/);
});

test('absolute heading requires opt-in and rotates the arrow without changing distance', async () => {
  const app = runtime({ orientation: {} }); await app.fix(); app.r.__test.selectResource(actualData.stores.find(hasCoordinates).id); app.r.__test.showDirection();
  const initial = app.element('#direction-content').innerHTML;
  await app.event('deviceorientationabsolute', { absolute: true, alpha: 270 }); assert.equal(app.element('#direction-content').innerHTML, initial);
  await app.click('[data-action="orientation"]'); await app.event('deviceorientationabsolute', { absolute: true, alpha: 270 });
  assert.equal(app.state.heading, 90); assert.notEqual(app.element('#direction-content').innerHTML, initial); assert.match(app.element('#direction-content').innerHTML, /箭頭依裝置方位調整/);
  assert.equal(app.element('#direction-content').innerHTML.match(/direction-distance">([^<]+)/)[1], initial.match(/direction-distance">([^<]+)/)[1]);
});

test('partial cache is not shown as complete and settings name the missing part', async () => {
  const app = runtime({ cacheStatus: { state: 'partial', completed: 3, total: 4, failures: [{ asset: 'resources-data.js', label: '全市資源點位' }] } }); await settle();
  assert.match(app.element('#cache-status').textContent, /快取未完整/); assert.doesNotMatch(app.element('#cache-status').textContent, /已快取/);
  await app.click('#settings-button'); assert.match(app.element('#settings-cache').innerHTML, /全市資源點位/); assert.match(app.element('#settings-cache').innerHTML, /未完成/);
});

test('home is the first screen with three urgencies; the map is a second layer and home preserves location', async () => {
  const app = runtime(); await settle();
  assert.equal(app.state.view, 'home'); assert.equal(app.element('#app').dataset.view, 'home');
  assert.equal(app.element('#home-screen').hidden, false); assert.equal(app.element('#explore-screen').hidden, true); assert.equal(app.element('#result-screen').hidden, true);
  assert.deepEqual(app.r.document.querySelectorAll('[data-urgency]').map(el => el.dataset.urgency), ['toilet', 'charge', 'wifi']);
  for (const removed of ['#enter-app', '#highlight-launch', '#welcome-screen', '#transport-status', '[data-transport]']) assert.equal(app.r.document.querySelector(removed), null, removed);
  assert(app.element('#highlight-map-launch'), 'the radar entry stays on the map page');
  assert.equal(app.state.theme, 'light'); assert.equal(app.state.mode, 'free');
  assert.match(app.element('#home-location').textContent, /正在定位/); assert.match(app.element('#home-cache').textContent, /已快取/);
  assert.deepEqual(app.history.state, { view: 'home', depth: 0 });
  await app.click('#home-map');
  assert.equal(app.state.view, 'map'); assert.equal(app.element('#app').dataset.view, 'map'); assert.equal(app.state.gpsPending, true); assert(app.invalidations.length > 0);
  await app.fix(); const position = app.state.position; assert.match(app.element('#home-location').textContent, /±15 m/);
  await app.click('#home-button'); assert.equal(app.state.view, 'home'); assert.equal(app.state.position, position); assert.equal(app.history.index, 0);
  await app.click('#home-map'); assert.equal(app.element('#panel-summary').textContent, '附近資源 · 尚未選類別');
  assert.equal(app.state.selectedId, null); assert.equal(app.gpsRequests.length, 1); assert.equal(app.state.position, position);
  await app.click('#map-back'); assert.equal(app.state.view, 'home'); assert(app.history.calls.every(([kind, value]) => kind !== 'go' || value !== 0));
});

test('resource guidance shows the GPS straight distance without drawing a line; destinations and filters survive exit and free-mode reset', async () => {
  const app = runtime(); const [resource, destination] = actualData.stores.filter(hasCoordinates);
  await app.fix(0, { lat: resource.lat + .001, lng: resource.lng }); await app.click('#home-map');
  app.r.__test.selectResource(resource.id); app.r.__test.setDestination(destination);
  await app.click('[data-service="wifi"]'); await app.goSelected();
  assert.equal(app.state.view, 'guide'); assert.equal(app.state.mode, 'resource');
  assert.match(app.element('#guidance-distance').textContent, /^直線 111 公尺$/);
  assert.match(app.element('#guidance-bearing').textContent, /南方.*正北/); assert.doesNotMatch(app.element('#guidance-bearing').textContent, /非步行路線/);
  assert.equal(straightLines(app).length, 0, 'guide draws no straight line to the resource'); assert.equal(app.fittedBounds.length, 1);
  const another = actualData.stores.find(s => hasCoordinates(s) && s.id !== resource.id && s.id !== destination.id);
  app.r.__test.setDestination(another);
  assert.equal(app.state.selectedId, resource.id); assert.equal(app.state.mode, 'resource');
  await app.click('#exit-guidance'); assert.equal(app.state.view, 'map');
  assert.equal(app.state.destination.id, another.id); assert.equal(app.state.selectedId, resource.id); assert(app.state.filters.has('wifi'));
  assert.equal(straightLines(app).length, 0, 'the map screen draws no straight line to the selection');
  await app.click('[data-action="clear"]'); assert.equal(app.state.mode, 'free'); assert.equal(app.state.selectedId, null);
  assert.equal([...app.layers].filter(layer => layer.kind === 'polyline').length, 0); assert.equal(app.state.destination.id, another.id);
  assert(app.state.filters.has('wifi'));
});

test('the transport preference is removed; map cards keep the straight-line label without implying routes', async () => {
  const app = runtime(); await app.fix(); await app.click('#home-map'); app.r.__test.selectResource(actualData.stores.find(hasCoordinates).id);
  assert.doesNotMatch(html, /data-transport|transport-status|enter-app|出發/); assert.equal('transport' in app.state, false);
  assert.match(app.element('#selected-card').innerHTML, /直線距離（非步行路線）/); assert.doesNotMatch(app.element('#selected-card').innerHTML, /捷運|單車|開車/);
  assert.equal(straightLines(app).length, 0);
  assert.equal(app.searchCalls.length, 0); assert.equal(app.bridgeCalls.length, 0); assert.equal(app.storageWrites.length, 0);
});

test('guidance without GPS has no route or arrow and opens a source-attributed detail card', async () => {
  const app = runtime(); await app.fail('GEO_DENIED'); const resource = actualData.stores.find(hasCoordinates); await app.click('#home-map');
  app.r.__test.selectResource(resource.id); await app.goSelected();
  assert.equal(app.state.view, 'guide'); assert.match(app.element('#guidance-distance').textContent, /需要定位/);
  assert.match(app.element('#guidance-bearing').textContent, /需要定位/); assert.match(app.element('#guidance-location').textContent, /定位權限未開啟/);
  assert.equal([...app.layers].filter(layer => layer.kind === 'polyline').length, 0);
  await app.click('#guidance-detail'); assert.equal(app.element('#app-sheet').dataset.sheet, 'detail');
  const details = app.element('#sheet-body').innerHTML;
  assert(details.includes(resource.sourceName)); assert(details.includes(resource.updatedAt.slice(0, 10)));
  assert.match(details, /現場使用條件、營業狀態與免消費條件：待確認/); assert.match(details, /直線距離（非步行路線）/);
  await app.click('#sheet-close'); await app.click('#guidance-end'); assert.equal(app.state.view, 'map'); assert.equal(app.state.selectedId, resource.id);
});

test('map taps only select; details open from the card button; an unlocated search record never replaces selection', async () => {
  const app = runtime(); await app.fix(); const [resource, destination] = actualData.stores.filter(hasCoordinates);
  await app.click('#home-map'); await app.click('[data-service="toilet"]');
  app.r.__test.markers.get(resource.id).handlers.click(); await settle();
  assert.equal(app.state.selectedId, resource.id); assert.equal(app.element('#app-sheet').open, false); assert.equal(app.state.activeSheet, null);
  assert.equal(app.element('#selected-card').hidden, false);
  await app.click('[data-action="clear"]');
  const listed = app.element('#nearby-preview').querySelector('[data-resource]'); await listed.dispatch('click');
  assert.equal(app.state.selectedId, listed.dataset.resource); assert.equal(app.element('#app-sheet').open, false);
  await app.element('#selected-card').querySelector('[data-action="detail"]').dispatch('click'); assert.equal(app.element('#app-sheet').dataset.sheet, 'detail');
  await app.click('#sheet-close');
  app.r.__test.selectResource(resource.id); app.r.__test.setDestination(destination);
  const missing = actualData.stores.find(s => !hasCoordinates(s)); app.r.__test.setDestination(missing);
  assert.equal(app.state.selectedId, resource.id); assert.equal(app.state.destination.id, destination.id);
  assert.equal(app.state.detailId, missing.id); assert(app.element('#sheet-body').textContent.includes(missing.name));
  assert.match(app.element('#sheet-body').innerHTML, /未提供座標/); assert.match(app.element('#toast').textContent, /未提供座標/);
});

test('late GPS in resource guidance fits the actual position and resource together', async () => {
  const app = runtime(); const resource = actualData.stores.find(hasCoordinates); await app.click('#home-map');
  app.r.__test.selectResource(resource.id); await app.goSelected(); assert.equal(app.fittedBounds.length, 0);
  await app.fix(0, { lat: resource.lat + .05, lng: resource.lng });
  assert.equal(app.state.view, 'guide'); assert.equal(app.state.selectedId, resource.id);
  assert.equal(app.fittedBounds.length, 1); const bounds = app.fittedBounds[0].value;
  assert.equal(bounds[0][0], resource.lat + .05); assert.equal(bounds[1][0], resource.lat);
  assert.equal(straightLines(app).length, 0);
});

test('closing or replacing a detail sheet cancels UI reactions from an older external action', async () => {
  for (const trigger of ['#sheet-close', '#search-trigger']) {
    let finish; const app = runtime({ navigate: () => new Promise(resolve => { finish = resolve; }) });
    const resource = actualData.stores.find(hasCoordinates); app.r.__test.selectResource(resource.id); app.r.__test.showDetails(resource);
    const pending = app.r.__test.externalAction('navigate'); await settle(); await app.click(trigger);
    const expectedSheet = trigger === '#sheet-close' ? null : 'search'; finish('failed'); await pending;
    assert.equal(app.state.activeSheet, expectedSheet); assert.equal(app.element('#app-sheet').open, expectedSheet !== null);
  }
});

test('late GPS refreshes the open detail distance without reopening the sheet or changing focus', async () => {
  const app = runtime(); const resource = actualData.stores.find(hasCoordinates);
  app.r.__test.markers.get(resource.id).handlers.click(); await app.click('[data-action="detail"]');
  assert.match(app.element('#detail-distance').textContent, /依地圖中心估算/);
  const active = app.r.document.activeElement; const body = app.element('#sheet-body'); const distanceNode = app.element('#detail-distance');
  await app.fix(0, { lat: resource.lat + .001, lng: resource.lng });
  assert.equal(app.state.activeSheet, 'details'); assert.equal(app.element('#sheet-body'), body);
  assert.equal(app.r.document.activeElement, active); assert.equal(app.element('#detail-distance'), distanceNode, 'Update the existing distance node without replacing the modal contents');
  assert.match(app.element('#detail-distance').textContent, /111 公尺/); assert.doesNotMatch(app.element('#detail-distance').textContent, /依地圖中心估算/);
});

test('detail overlay closes from the side backdrop and escaped source names stay plain text', async () => {
  const app = runtime(); const resource = actualData.stores.find(hasCoordinates);
  app.r.__test.selectResource(resource.id); app.r.__test.showDetails({ ...resource, name: '<img src=x onerror=alert(1)>長名稱測試', address: '<b>測試地址</b>' });
  assert.match(app.element('#sheet-body').innerHTML, /&lt;img/); assert.doesNotMatch(app.element('#sheet-body').innerHTML, /<img|<b>/);
  const dialog = app.element('#app-sheet'); await dialog.dispatch('pointerdown', { clientX: 400, clientY: 300 }); await dialog.dispatch('click', { clientX: 400, clientY: 300 });
  assert.equal(dialog.open, false); assert.equal(app.state.activeSheet, null); assert.notEqual(app.r.document.activeElement.id, 'search-trigger', 'Pointer close must not force focus onto search');
});

test('offline outside cached basemap coverage shows a map notice, clearing online or on return', async () => {
  const app = runtime(); await app.click('#home-map');
  const [[south, west], [north, east]] = actualBasemap.regions[0].bounds;
  const outside = { lat: north + .02, lng: east + .02 };
  const inside = { lat: (south + north) / 2, lng: (west + east) / 2 };
  await app.fix(0, outside);
  assert.equal(app.element('#basemap-notice').hidden, true, 'Online OSM coverage must not display an offline warning');
  await app.connectivity(false);
  assert.equal(app.element('#basemap-notice').hidden, false);
  assert.match(app.element('#basemap-notice').textContent, /此區尚無離線底圖.*資源與直線距離/);
  assert.doesNotMatch(app.element('#basemap-notice').textContent, /25\.\d|121\.\d/);
  app.r.__test.setView('guide'); assert.equal(app.element('#basemap-notice').hidden, false);
  await app.connectivity(true); assert.equal(app.element('#basemap-notice').hidden, true);
  await app.connectivity(false); assert.equal(app.element('#basemap-notice').hidden, false);
  assert.equal(app.storageWrites.length, 0);
  app.map.setView([inside.lat, inside.lng], 17); await app.setBounds(actualBasemap.regions[0].bounds);
  assert.equal(app.element('#basemap-notice').hidden, true); assert.equal(app.element('#basemap-notice').textContent, '');
  assert.equal(app.state.position.lat, outside.lat, 'Panning the map must not change GPS');
});

test('offline basemap covers every listed region but not the gap between them', async () => {
  assert.ok(actualBasemap.regions.length >= 2, 'Basemap must list its separate offline regions');
  const app = runtime(); await app.click('#home-map'); await app.connectivity(false);
  const centerOf = ({ bounds: [[south, west], [north, east]] }) => ({ lat: (south + north) / 2, lng: (west + east) / 2 });
  for (const region of actualBasemap.regions) {
    const center = centerOf(region); app.map.setView([center.lat, center.lng], 17); await app.setBounds(region.bounds);
    assert.equal(app.element('#basemap-notice').hidden, true, `${region.name} must render the offline basemap`);
  }
  const [first, second] = actualBasemap.regions.map(centerOf);
  app.map.setView([(first.lat + second.lat) / 2, (first.lng + second.lng) / 2], 17); await app.setBounds(actualBasemap.bounds);
  assert.equal(app.element('#basemap-notice').hidden, false, 'The envelope between regions has no offline basemap');
});

test('compact cards expose address, complete source and update date as separate fields', async () => {
  const app = runtime(); await settle(); await app.click('[data-service="toilet"]');
  const preview = app.element('#nearby-preview').innerHTML;
  assert.match(preview, /class="resource-card-address"/);
  assert.match(preview, /class="resource-card-source"/);
  assert.match(preview, /class="resource-card-updated">更新 \d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(preview, /resource-card-meta">[^<]/);
});

// Synthetic route results exercise the controller contract; geometry is verified by router tests.
const routeResult = (ids = []) => ({ coordinates: [[25.034, 121.561], [25.035, 121.562], [25.036, 121.563]], roadSegments: [[[25.0341, 121.5611], [25.0359, 121.5629]]], connectors: [[[25.034, 121.561], [25.0341, 121.5611]], [[25.0359, 121.5629], [25.036, 121.563]]], distanceM: 310, connectorDistanceM: 30, estimateMinutes: 5, storeIds: ids, basis: 'OSM 本機步行路網' });

test('destination waits for real GPS, then draws distinct road and estimated connectors', async () => {
  const app = runtime(); const destination = actualData.stores.find(hasCoordinates);
  app.r.__test.setDestination(destination);
  assert.equal(app.state.routeStatus, 'waiting-location'); assert.equal(app.routeRequests.length, 0);
  assert.match(app.element('#destination-route-message').textContent, /定位/);
  await app.fix(); assert.equal(app.state.routeStatus, 'loading'); assert.equal(app.routeRequests.length, 1);
  assert.equal(app.routeRequests[0].input.points[0].lat, app.state.position.lat);
  assert.equal(app.routeRequests[0].input.points[1].lat, destination.lat);
  assert.equal(app.routeRequests[0].input.radius, 250);
  assert.equal(app.routeRequests[0].input.stores.length, actualData.stores.length);
  const route = routeResult([destination.id]); app.routeRequests[0].resolve(route); await settle();
  assert.equal(app.state.routeStatus, 'ready'); assert.equal(app.state.route, route);
  const lines = [...app.layers].filter(layer => layer.kind === 'polyline');
  assert.equal(lines.length, 3); assert.equal(lines.filter(line => !line.options.dashArray).length, 1);
  assert.equal(lines.filter(line => line.options.dashArray).length, 2);
  assert.match(app.element('#destination-route-message').textContent, /步行.*310 公尺/);
  assert.match(app.element('#destination-route-note').textContent, /250m.*非可達保證/);
  assert.equal(app.storageWrites.length, 0); assert.equal(app.searchCalls.length, 0);
});

test('replacement, clear and GPS failure invalidate old destination requests and clear geometry', async () => {
  const app = runtime(); const [first, second] = actualData.stores.filter(hasCoordinates); await app.fix();
  app.r.__test.setDestination(first); app.r.__test.setDestination(second);
  app.routeRequests[0].resolve(routeResult([first.id])); await settle();
  assert.equal(app.state.route, null); assert.equal(app.state.routeStatus, 'loading');
  const current = routeResult([second.id]); app.routeRequests[1].resolve(current); await settle();
  assert.equal(app.state.route, current);
  await app.click('[data-service="wifi"]'); app.r.__test.setDestination(first);
  assert.equal([...app.layers].filter(layer => layer.kind === 'polyline').length, 0);
  await app.click('#destination-clear'); app.routeRequests[2].resolve(routeResult([first.id])); await settle();
  assert.equal(app.state.route, null); assert.equal(app.state.routeStatus, 'idle'); assert.equal(app.state.destination, null);
  assert(app.state.filters.has('wifi')); assert.match(app.element('#panel-summary').textContent, /視窗內/);
  app.r.__test.setDestination(second); await app.click('#gps-button'); await app.fail('GEO_DENIED');
  app.routeRequests[3].resolve(current); await settle();
  assert.equal(app.state.position, null); assert.equal(app.state.route, null); assert.equal(app.state.routeStatus, 'waiting-location');
  assert.equal([...app.layers].filter(layer => layer.kind === 'polyline').length, 0);
  assert(app.routeCancels.length >= 4);
});

test('route IDs and OR categories drive one list, count and highlight even outside viewport', async () => {
  const app = runtime(); await app.fix(); const routeStores = actualData.stores.filter(hasCoordinates).slice(0, 40);
  app.r.__test.setDestination(routeStores[0]); app.routeRequests[0].resolve(routeResult(routeStores.map(s => s.id))); await settle();
  await app.click('[data-service="wifi"]'); await app.click('[data-service="charge"]');
  const wanted = routeStores.filter(s => s.services.includes('wifi') || s.services.includes('charge')); assert(wanted.length > 0);
  await app.setBounds([[0, 0], [1, 1]]);
  assert.equal(app.routeRequests.length, 1, 'Category and viewport changes must not recompute a route');
  assert.deepEqual([...app.r.__test.visibleStores()].map(s => s.id).sort(), Array.from(wanted, s => s.id).sort());
  assert.equal(app.element('#panel-summary').textContent, `沿線資源 · ${wanted.length} 筆`);
  await app.click('#list-button'); assert.equal(app.element('#sheet-body').querySelectorAll('[data-resource]').length, wanted.length);
  const expected = new Set(wanted.map(s => s.id));
  for (const [id, marker] of app.r.__test.markers) assert.equal(marker.styles.opacity, expected.has(id) ? .9 : .2);
  assert.equal(app.storageWrites.length, 0);
});

test('resource selection and repeated renders preserve destination layers without duplication', async () => {
  const app = runtime(); await app.fix(); const resources = actualData.stores.filter(hasCoordinates);
  app.r.__test.setDestination(resources[0]); const route = routeResult([resources[1].id]); app.routeRequests[0].resolve(route); await settle();
  const destinationLines = [...app.layers].filter(layer => layer.kind === 'polyline');
  app.r.__test.markers.get(resources[1].id).handlers.click(); assert.equal(app.state.selectedId, resources[1].id); assert.equal(app.state.activeSheet, null);
  app.r.__test.renderAll(); app.r.__test.renderAll();
  destinationLines.forEach(layer => assert(app.layers.has(layer)));
  assert.equal([...app.layers].filter(layer => layer.kind === 'polyline').length, 3, 'only the destination route, no straight line to the selection');
  assert.equal(app.state.route, route); assert.equal(app.routeRequests.length, 1);
  await app.click('[data-action="clear"]'); destinationLines.forEach(layer => assert(app.layers.has(layer)));
  assert.equal([...app.layers].filter(layer => layer.kind === 'polyline').length, 3);
});

test('routing errors remain actionable and retry uses current real GPS', async () => {
  const app = runtime(); await app.fix(); app.r.__test.setDestination(actualData.stores.find(hasCoordinates));
  app.routeRequests[0].reject(new Error('目的地超出目前路網範圍')); await settle();
  assert.equal(app.state.routeStatus, 'error'); assert.match(app.element('#destination-route-message').textContent, /超出目前路網/);
  assert.equal(app.element('#route-retry').hidden, false); assert.equal(app.element('#route-retry').disabled, false);
  assert.equal([...app.layers].filter(layer => layer.kind === 'polyline').length, 0);
  await app.click('#route-retry'); assert.equal(app.routeRequests.length, 2); assert.equal(app.state.routeStatus, 'loading');
  const missing = runtime({ noRouter: true }); await missing.fix(); missing.r.__test.setDestination(actualData.stores.find(hasCoordinates)); await settle();
  assert.equal(missing.state.routeStatus, 'error'); assert.match(missing.element('#destination-route-message').textContent, /路由.*載入/);
});

test('map expansion and panel collapse are independent and preserve the map and route state', async () => {
  const app = runtime(); await app.fix(); await app.click('#home-map');
  const resource = actualData.stores.find(hasCoordinates); app.r.__test.setDestination(resource); app.routeRequests[0].resolve(routeResult([resource.id])); await settle();
  app.r.__test.selectResource(resource.id); await app.click('[data-service="wifi"]');
  const snapshot = { position: app.state.position, route: app.state.route, destination: app.state.destination, selectedId: app.state.selectedId };
  await app.click('#map-expand'); assert.equal(app.state.mapExpanded, true);
  assert.equal(app.element('#map-expand').getAttribute('aria-expanded'), 'true');
  await app.click('#panel-toggle'); assert.equal(app.state.panelCollapsed, true); assert.equal(app.element('#panel-content').hidden, true);
  assert.equal(app.element('#panel-toggle').getAttribute('aria-expanded'), 'false');
  await app.click('#map-expand'); assert.equal(app.state.mapExpanded, false); assert.equal(app.state.panelCollapsed, true);
  await app.click('#panel-toggle'); assert.equal(app.element('#panel-content').hidden, false);
  for (const [key, value] of Object.entries(snapshot)) assert.equal(app.state[key], value);
  assert(app.state.filters.has('wifi')); assert.equal(app.routeRequests.length, 1);
  const stageObserver = app.observed.find(item => item.target.id === 'map-stage'); assert(stageObserver);
  const invalidations = app.invalidations.length; stageObserver.callback(); assert.equal(app.invalidations.length, invalidations + 1);
  assert(app.fittedBounds.some(fit => fit.options.paddingTopLeft && fit.options.paddingBottomRight));
});

test('pointer entry and sheet close do not focus search, keyboard entry restores a visible focus target', async () => {
  const app = runtime(); await settle(); await app.element('#home-map').dispatch('pointerdown'); await app.click('#home-map');
  assert.notEqual(app.r.document.activeElement, app.element('#search-trigger'));
  await app.click('#search-trigger'); await app.element('#sheet-close').dispatch('pointerdown'); await app.click('#sheet-close');
  assert.notEqual(app.r.document.activeElement, app.element('#search-trigger'));
  await app.click('#home-button'); await app.r.document.dispatch('keydown', { key: 'Tab' }); await app.click('#home-map');
  assert.equal(app.r.document.activeElement, app.element('#search-trigger'));
  await app.click('#search-trigger'); await app.element('#app-sheet').dispatch('cancel');
  assert.equal(app.r.document.activeElement, app.element('#search-trigger'));
});

// Independent ranking for the three urgencies: planar approximation, not the app's haversine.
const planar = (a, b) => { const k = Math.PI / 180; const x = (b.lng - a.lng) * k * Math.cos((a.lat + b.lat) / 2 * k); const y = (b.lat - a.lat) * k; return Math.hypot(x, y) * 6371000; };
const cityHall = { lat: 25.0375, lng: 121.5637 };
const straightLines = app => [...app.layers].filter(layer => layer.kind === 'polyline' && layer.options.dashArray === '7 9');
const nearestIds = (category, from = cityHall, filter = () => true) => actualData.stores.filter(s => hasCoordinates(s) && s.services.includes(category) && filter(s)).sort((a, b) => planar(from, a) - planar(from, b)).map(s => String(s.id));
const resultId = app => app.r.document.querySelector('[data-result-id]')?.attributes['data-result-id'] ?? null;

test('a result whose urgency hit is inferred says so, and list rows label inferred services', async () => {
  const store = actualData.stores.find(entry => hasCoordinates(entry) && entry.inferredServices?.includes('charge'));
  assert(store, 'Generated data must include an inferred charge point');
  const app = runtime(); await app.fix(0, { lat: store.lat, lng: store.lng, accuracy: 15 });
  await app.click('[data-urgency="charge"]');
  assert.equal(resultId(app), String(store.id));
  assert.match(app.element('#result-body').innerHTML, /service-tag inferred[^>]*>.*充電點 · 推定，請向現場確認/);
  const t = app.r.__test; t.state.filters = new Set(['charge']); t.renderAll();
  const rows = app.element('#nearby-preview').innerHTML;
  assert.match(rows, new RegExp(`data-resource="${store.id}"[^]*?service-tag inferred[^>]*>[^]*?充電 · 推定`));
});

test('each urgency button shows the straight-line nearest record and next walks to the second and third', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall, accuracy: 15 });
  for (const category of ['toilet', 'charge', 'wifi']) {
    await app.click(`[data-urgency="${category}"]`);
    assert.equal(app.state.view, 'result'); assert.equal(app.element('#app').dataset.view, 'result'); assert.equal(app.element('#result-screen').hidden, false);
    const expected = nearestIds(category);
    assert.equal(resultId(app), expected[0], category);
    const body = app.element('#result-body').innerHTML; const store = actualData.stores.find(s => String(s.id) === expected[0]);
    assert(body.includes(store.sourceName) && body.includes(store.updatedAt.slice(0, 10)), category);
    assert.match(body, /直線 \d/); assert.doesNotMatch(body, /約 \d/); assert.match(body, /在您的.+方 · 正北基準/); assert.match(body, /無障礙 · (有標示|未標示)/);
    for (const action of ['go', 'map', 'next']) assert.match(body, new RegExp(`data-action="${action}"`), `${category} ${action}`);
    assert.equal(/data-action="speak"/.test(body), store.sourceId !== 'wifi', `${category} speak card only where staff exist`);
    assert.equal(/data-action="phone"/.test(body), /^\+?\d{8,15}$/.test(store.normalizedPhone || ''), `${category} phone only with a number`);
    assert.equal(/免費 Wi-Fi 熱點，不保證訊號/.test(body), category === 'wifi');
    assert.equal(/推定，請向現場確認/.test(body), (store.inferredServices || []).includes(category), `${category} inferred hit is labelled`);
    const pushes = app.history.calls.filter(([kind]) => kind === 'push').length;
    await app.click('[data-action="next"]'); assert.equal(resultId(app), expected[1]);
    await app.click('[data-action="next"]'); assert.equal(resultId(app), expected[2]);
    assert.equal(app.element('[data-action="next"]').disabled, true); assert.match(app.element('#result-body').innerHTML, /已是最後一筆候選/);
    assert.equal(app.history.calls.filter(([kind]) => kind === 'push').length, pushes, 'next replaces history instead of pushing');
    assert.equal(app.history.state.index, 2);
    await app.click('#result-back'); assert.equal(app.state.view, 'home');
  }
  assert.equal(app.routeRequests.length, 0, 'home and result never start routing');
});

test('accuracy above 100 m keeps the result but prefixes the straight-line distance with 約', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall, accuracy: 180 });
  await app.click('[data-urgency="toilet"]');
  assert.match(app.element('#result-distance').textContent, /^直線 約 \d/); assert.match(app.element('#result-body').innerHTML, /精度不足/);
  assert.match(app.element('#home-location').textContent, /精度不足/);
});

test('without a valid location the result asks for location, offers the map, and never ranks from the map centre', async () => {
  const app = runtime(); await settle();
  await app.click('[data-urgency="charge"]');
  assert.equal(resultId(app), null); assert.match(app.element('#result-body').innerHTML, /需要定位才能找最近/); assert.match(app.element('#result-body').innerHTML, /正在取得定位/);
  await app.fail('GEO_DENIED');
  assert.equal(resultId(app), null); assert.match(app.element('#result-body').innerHTML, /需要定位才能找最近/); assert.match(app.element('#result-body').innerHTML, /定位權限未開啟/);
  assert.match(app.element('#home-location').textContent, /無法取得定位 · 定位權限未開啟/); assert.equal(app.element('#home-location').dataset.state, 'failed');
  await app.click('[data-action="map"]');
  assert.equal(app.state.view, 'map'); assert.deepEqual([...app.state.filters], ['charge']); assert.equal(app.state.selectedId, null);
  await app.click('#map-back'); assert.equal(app.state.view, 'result');
  const pushes = app.history.calls.filter(([kind]) => kind === 'push').length;
  await app.click('#home-gps'); await app.fix(1, { ...cityHall });
  assert.equal(resultId(app), nearestIds('charge')[0], 'a later fix fills the card in place');
  assert.equal(app.history.calls.filter(([kind]) => kind === 'push').length, pushes, 'location updates replace history');
});

test('step-free preference picks accessible records and falls back with a visible note when none exist', async () => {
  const app = runtime({ storage: { 'friendly-step-free-v1': '1' } }); await app.fix(0, { ...cityHall });
  assert.equal(app.state.prefs.stepFree, true);
  for (const category of ['toilet', 'charge', 'wifi']) {
    await app.click(`[data-urgency="${category}"]`);
    assert.equal(resultId(app), nearestIds(category, cityHall, s => s.services.includes('accessible'))[0], category);
    assert.match(app.element('#result-body').innerHTML, /無障礙 · 有標示/); assert.doesNotMatch(app.element('#result-body').innerHTML, /無障礙資料不足/);
    await app.click('#result-back');
  }
  const fixture = [
    { ...actualData.stores.find(s => hasCoordinates(s) && s.services.includes('charge')), id: 'far', lat: 25.04, lng: 121.57, services: ['charge'] },
    { ...actualData.stores.find(s => hasCoordinates(s) && s.services.includes('charge')), id: 'near', lat: 25.0376, lng: 121.5637, services: ['charge'] },
  ];
  const fallback = runtime({ storage: { 'friendly-step-free-v1': '1' }, resources: { ...actualData, stores: fixture } }); await fallback.fix(0, { ...cityHall });
  await fallback.click('[data-urgency="charge"]');
  assert.equal(resultId(fallback), 'near'); assert.match(fallback.element('#result-body').innerHTML, /無障礙資料不足/); assert.match(fallback.element('#result-body').innerHTML, /無障礙 · 未標示/);
  const off = runtime({ resources: { ...actualData, stores: fixture } }); await off.fix(0, { ...cityHall }); await off.click('[data-urgency="charge"]');
  assert.doesNotMatch(off.element('#result-body').innerHTML, /無障礙資料不足/);
});

test('nested back: home → result → map → speak card unwinds one screen per back and leaves on the fourth', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="toilet"]'); const id = resultId(app);
  await app.click('[data-action="map"]');
  assert.equal(app.state.view, 'map'); assert.deepEqual([...app.state.filters], ['toilet']); assert.equal(app.state.selectedId, id);
  assert.equal(app.element('#selected-card').hidden, false); assert.match(app.element('#selected-card').innerHTML, /data-action="go"/); assert.doesNotMatch(app.element('#selected-card').innerHTML, /data-action="navigate"/);
  await app.element('#selected-card').querySelector('[data-action="speak"]').dispatch('click');
  assert.equal(app.state.view, 'card'); assert.equal(app.element('#app').dataset.view, 'map', 'the card overlays the map without a relayout');
  const open = app.speakCalls.filter(call => call.method === 'open').at(-1);
  assert.equal(open.category, 'toilet'); assert.equal(open.lang, 'zh-TW'); assert.equal(open.includeUnreviewed, true);
  app.history.back(); await settle();
  assert.equal(app.state.view, 'map'); assert.equal(app.state.selectedId, id); assert.equal(app.speakCard.isOpen, false);
  assert(app.speakCalls.some(call => call.method === 'close' && call.silent), 'system back closes the card silently');
  app.history.back(); await settle(); assert.equal(app.state.view, 'result'); assert.equal(resultId(app), id);
  app.history.back(); await settle(); assert.equal(app.state.view, 'home');
  app.history.back(); await settle(); assert.equal(app.history.exited, true);
});

test('map from home is empty even after a result card left a category and selection', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="toilet"]'); await app.click('[data-action="map"]');
  assert.deepEqual([...app.state.filters], ['toilet']); assert.notEqual(app.state.selectedId, null);
  app.history.back(); await settle(); app.history.back(); await settle(); assert.equal(app.state.view, 'home');
  await app.click('#home-map');
  assert.equal(app.state.view, 'map'); assert.equal(app.state.filters.size, 0); assert.equal(app.state.selectedId, null); assert.equal(app.state.mode, 'free');
  assert.equal(app.element('#selected-card').hidden, true); assert.match(app.element('#nearby-preview').innerHTML, /先選一種服務/);
  assert.equal(app.element('#category-filters').querySelectorAll('.selected').length, 0);
});

test('closing the speak card returns to its source: result card from results, selected map card from the map', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="charge"]'); await app.click('[data-action="next"]'); const id = resultId(app);
  await app.element('#result-body').querySelector('[data-action="speak"]').dispatch('click');
  assert.equal(app.state.view, 'card'); assert.equal(app.element('#app').dataset.view, 'result'); assert.equal(app.speakCalls.at(-1).category, 'charge');
  app.speakCard.closeSpeakCard(); await settle();
  assert.equal(app.state.view, 'result'); assert.equal(resultId(app), id, 'the same next-ranked record is still shown');
  await app.click('[data-action="map"]'); await app.element('#selected-card').querySelector('[data-action="speak"]').dispatch('click');
  app.speakCard.closeSpeakCard(); await settle();
  assert.equal(app.state.view, 'map'); assert.equal(app.state.selectedId, id); assert.equal(app.element('#selected-card').hidden, false);
  assert.equal(app.storageWrites.length, 0);
});

test('map card offers go, speak and details; navigate and phone live in the detail sheet; speak follows urgency or services', async () => {
  const app = runtime(); await app.fix(); await app.click('#home-map');
  const phoned = actualData.stores.find(s => hasCoordinates(s) && s.services.includes('charge') && /^\+?\d{8,15}$/.test(s.normalizedPhone || ''));
  app.r.__test.selectResource(phoned.id); const card = app.element('#selected-card').innerHTML;
  for (const action of ['go', 'speak', 'detail']) assert.match(card, new RegExp(`data-action="${action}"`), action);
  for (const action of ['navigate', 'phone', 'direction']) assert.doesNotMatch(card, new RegExp(`data-action="${action}"`), action);
  assert.match(card, new RegExp(`data-action="go" data-cat="${phoned.services[0]}"`), 'without a filter the button takes the first listed service colour');
  await app.click('[data-service="charge"]'); assert.match(app.element('#selected-card').innerHTML, /data-action="go" data-cat="charge"/);
  await app.click('[data-action="detail"]'); for (const action of ['navigate', 'phone', 'direction']) assert.match(app.element('#sheet-body').innerHTML, new RegExp(`data-action="${action}"`), action);
  await app.click('#sheet-close');
  assert.equal(app.r.__test.speakCategory(phoned), phoned.services.find(s => ['toilet', 'charge', 'wifi'].includes(s)));
  const none = actualData.stores.find(s => hasCoordinates(s) && !s.services.some(v => ['toilet', 'charge', 'wifi'].includes(v)));
  app.r.__test.selectResource(none.id); assert.doesNotMatch(app.element('#selected-card').innerHTML, /data-action="speak"/);
  const both = actualData.stores.find(s => hasCoordinates(s) && s.services[0] === 'wifi' && s.services.includes('toilet'));
  if (both) { app.state.urgency = 'toilet'; assert.equal(app.r.__test.speakCategory(both), 'toilet'); app.state.urgency = null; assert.equal(app.r.__test.speakCategory(both), 'wifi'); }
});

test('guide draws the arrow and straight distance at once, switches the big number to walking after the local route, and never recomputes on moves', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall });
  await app.click('#home-map'); const destination = actualData.stores.filter(hasCoordinates)[5]; app.r.__test.setDestination(destination);
  const destinationRequest = app.routeRequests.at(-1); const destinationGeneration = app.state.routeGeneration;
  await app.click('#map-back'); await app.click('[data-urgency="toilet"]'); const id = resultId(app);
  await app.click('[data-action="go"]');
  assert.equal(app.state.view, 'guide'); assert.equal(app.state.selectedId, id);
  assert.match(app.element('#guide-arrow').style.transform, /^rotate\(-?\d/); assert.equal(app.element('#guide-arrow').dataset.ready, 'true');
  assert.match(app.element('#guidance-distance').textContent, /^直線 \d/); assert.equal(app.element('#guide-walk').hidden, true);
  assert.equal(app.r.document.querySelector('#guide-timer-status'), null, 'the countdown status line is gone');
  const guideRequest = app.routeRequests.at(-1); assert.notEqual(guideRequest, destinationRequest);
  assert.equal(guideRequest.input.stores.length, 0); assert.equal(String(guideRequest.input.points[1].lat), String(actualData.stores.find(s => String(s.id) === id).lat));
  assert.equal(app.state.routeGeneration, destinationGeneration, 'entering guide does not cancel the destination route');
  guideRequest.resolve(routeResult()); await settle();
  assert.match(app.element('#guidance-distance').textContent, /^步行 310 公尺$/, 'the big number is the walking distance once the route is ready');
  assert.match(app.element('#guidance-bearing').textContent, /^直線 \d+ 公尺 · .*正北基準/, 'the straight distance stays on screen as small text');
  assert.match(app.element('#guide-walk').textContent, /^約 5 分鐘/); assert.doesNotMatch(app.element('#guide-walk').textContent, /310/, 'the walking number is not repeated');
  assert.equal(app.element('#guide-walk').hidden, true, 'toilet guide carries the minutes in the guide tool, not twice');
  const guideRequests = () => app.routeRequests.filter(request => request.input.stores.length === 0).length; const before = guideRequests();
  await app.click('#gps-button'); await app.fix(1, { lat: cityHall.lat + .0002, lng: cityHall.lng });
  assert.equal(app.state.guideRoute.distanceM, 310); assert.equal(guideRequests(), before, 'no new guide route on a position update');
  await app.click('#exit-guidance'); assert.equal(app.state.view, 'result'); assert.equal(app.state.guideRoute, null); assert.equal(app.state.guideStatus, 'idle');
});

test('a guide route that arrives after leaving guide is discarded; routing failure keeps arrow and straight distance', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="toilet"]'); await app.click('[data-action="go"]'); const late = app.routeRequests.at(-1);
  await app.click('#guidance-end'); assert.equal(app.state.view, 'result');
  late.resolve(routeResult()); await settle(); assert.equal(app.state.guideRoute, null);
  await app.click('[data-action="go"]'); app.routeRequests.at(-1).reject(new Error('本機步行路網逾時')); await settle();
  assert.equal(app.state.guideStatus, 'error'); assert.match(app.element('#guidance-distance').textContent, /^直線 /); assert.equal(app.element('#guide-walk').hidden, true);
  assert.equal(app.element('#guide-retry').hidden, false);
  await app.click('#guide-retry'); assert.equal(app.state.guideStatus, 'loading');
});

test('toilet guide shows the walking distance instead of a countdown, with pending and straight-line fallback labels', async () => {
  const app = runtime({ realHighlights: true }); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="toilet"]'); await app.click('[data-action="go"]');
  const tool = () => app.element('#guide-timer');
  assert.equal(tool().hidden, false); assert.match(tool().textContent, /步行距離計算中/); assert.match(app.element('#guidance-distance').textContent, /^直線 /);
  app.routeRequests.at(-1).resolve({ ...routeResult(), distanceM: 1260 }); await settle();
  assert.equal(app.element('#guidance-distance').textContent, `步行 ${tool().querySelector('strong').textContent}`, 'HUD and walk card show the same route number');
  await app.click('#guidance-end'); await app.click('[data-action="go"]');
  app.routeRequests.at(-1).resolve(routeResult()); await settle();
  assert(tool().querySelector('div[data-kind="walk"]'), 'the walk value uses the brown walk style');
  assert.match(tool().textContent, /步行距離/); assert.match(tool().querySelector('strong').textContent, /^310 公尺$/); assert.match(tool().textContent, /約 5 分鐘/);
  assert.doesNotMatch(tool().innerHTML, /data-hl-countdown|start-timer|pause-timer|reset-timer/); assert.doesNotMatch(tool().textContent, /\d{2}:\d{2}/);
  assert.equal(straightLines(app).length, 0);
  await app.click('#guidance-end'); await app.click('[data-action="go"]');
  app.routeRequests.at(-1).reject(new Error('本機步行路網逾時')); await settle();
  assert(tool().querySelector('div[data-kind="straight"]')); assert.match(tool().querySelector('strong').textContent, /^直線 \d+ 公尺$/);
  assert.equal(app.element('#guidance-distance').textContent, tool().querySelector('strong').textContent, 'a failed route keeps the straight number in both places');
  assert.doesNotMatch(tool().textContent, /\d{2}:\d{2}/);
});

test('preferences are local only: invalid stored language falls back to Chinese with a notice; storage failures are tolerated', async () => {
  const app = runtime({ storage: { 'friendly-native-language-v1': 'vi' } }); await settle();
  assert.equal(app.state.prefs.lang, 'zh-TW');
  await app.click('#home-settings'); assert.equal(app.element('#app-sheet').open, true);
  assert.match(app.element('#sheet-body').innerHTML, /已改用中文單面/); assert.match(app.element('#sheet-body').innerHTML, /data-lang-choice="zh-TW"/); assert.doesNotMatch(app.element('#sheet-body').innerHTML, /data-lang-choice="vi"/);
  await app.click('[data-step-free-choice="1"]'); await app.click('[data-lang-choice="zh-TW"]');
  assert.deepEqual(app.storageWrites, [['friendly-native-language-v1', null], ['friendly-step-free-v1', '1'], ['friendly-native-language-v1', 'zh-TW']]);
  assert.equal(app.state.prefs.stepFree, true);
  const broken = runtime({ storageThrows: true }); await broken.fix(0, { ...cityHall });
  assert.equal(broken.state.prefs.lang, 'zh-TW'); await broken.click('#home-settings'); await broken.click('[data-step-free-choice="1"]');
  assert.equal(broken.state.prefs.stepFree, true); await broken.click('#sheet-close'); await broken.click('[data-urgency="toilet"]');
  assert.equal(resultId(broken), nearestIds('toilet', cityHall, s => s.services.includes('accessible'))[0]);
});

test('reloading with a saved history entry restores that screen instead of stacking home on top', async () => {
  const app = runtime({ historyState: { view: 'result', urgency: 'wifi', index: 0, depth: 1 } }); await settle();
  assert.equal(app.state.view, 'result'); assert.equal(app.history.calls.filter(([kind]) => kind === 'replace' || kind === 'push').length, 0);
  assert.match(app.element('#result-body').innerHTML, /需要定位才能找最近/);
  await app.fix(0, { ...cityHall }); assert.equal(resultId(app), nearestIds('wifi')[0]);
});

test('toilet guide hands the countdown its walking route only after success and pauses it when guide is left', async () => {
  const calls = []; const app = runtime({ highlightCalls: calls }); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="toilet"]'); await app.click('[data-action="go"]');
  assert.equal(calls.filter(call => call.method === 'openToilet').length, 0, 'no countdown before the route exists');
  app.routeRequests.at(-1).resolve(routeResult()); await settle();
  const opened = calls.filter(call => call.method === 'openToilet');
  assert.equal(opened.length, 1); assert.equal(opened[0].id, app.state.selectedId); assert.equal(opened[0].route.distanceM, 310);
  await app.click('#exit-guidance'); assert.equal(calls.at(-1).method, 'pauseGuide');
  await app.click('[data-action="go"]'); const late = app.routeRequests.at(-1); await app.click('#guidance-end');
  late.resolve(routeResult()); await settle();
  assert.equal(calls.filter(call => call.method === 'openToilet').length, 1, 'a route arriving after leaving guide never opens the countdown');
  await app.click('#result-back'); await app.click('[data-urgency="charge"]'); await app.click('[data-action="go"]');
  app.routeRequests.at(-1).resolve(routeResult()); await settle();
  assert.equal(calls.filter(call => call.method === 'openToilet').length, 1, 'charge guidance has no toilet countdown');
});

test('review #1: picking another resource during guide pushes a new guide for it instead of mixing two places', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="toilet"]'); const first = resultId(app); await app.click('[data-action="go"]');
  app.routeRequests.at(-1).resolve(routeResult()); await settle();
  assert.match(app.element('#guidance-distance').textContent, /^步行 310 公尺$/);
  const other = actualData.stores.find(s => hasCoordinates(s) && String(s.id) !== first && s.sourceId === 'wifi' && !s.services.includes('toilet'));
  const depth = app.history.state.depth; const requests = app.routeRequests.length;
  await app.click('#guidance-resources'); app.r.document.querySelector('#sheet-body').innerHTML = `<button class="resource-row" data-resource="${other.id}"></button>`;
  await app.element(`[data-resource="${other.id}"]`).dispatch('click');
  assert.equal(app.state.view, 'guide'); assert.equal(app.state.selectedId, String(other.id));
  assert.equal(app.history.state.storeId, String(other.id), 'history records the new target'); assert.equal(app.history.state.depth, depth + 1);
  assert.equal(app.routeRequests.length, requests + 1, 'a walking route is requested for the new target');
  assert.equal(String(app.routeRequests.at(-1).input.points[1].lat), String(other.lat));
  assert.equal(app.state.guideRoute, null); assert.equal(app.element('#guide-walk').hidden, true, 'the old walking number is gone');
  assert.equal(app.element('#app-sheet').open, false);
  app.history.back(); await settle();
  assert.equal(app.state.view, 'guide'); assert.equal(app.state.selectedId, first); assert.equal(String(app.routeRequests.at(-1).input.points[1].lat), String(actualData.stores.find(s => String(s.id) === first).lat));
});

test('review #2: opening the map from a result card closes any radar mode left open', async () => {
  const calls = []; const app = runtime({ highlightCalls: calls }); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="charge"]'); await app.click('[data-action="map"]');
  assert.equal(app.state.view, 'map'); assert(calls.some(call => call.method === 'close'), 'radar closed before showing the selected card');
  const before = calls.filter(call => call.method === 'close').length; await app.click('#home-button'); await app.click('#home-map');
  assert.equal(calls.filter(call => call.method === 'close').length, before, 'plain home → map keeps whatever radar mode the user chose');
});

test('review #3: guide says "nearest" only for the result-card record, otherwise "selected resource"', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="toilet"]'); await app.click('[data-action="go"]');
  assert.equal(app.element('#guidance-heading').textContent, '最近的廁所');
  await app.click('#exit-guidance'); await app.click('[data-action="map"]');
  const other = actualData.stores.find(s => hasCoordinates(s) && s.services.includes('toilet') && String(s.id) !== app.state.selectedId);
  app.r.__test.selectResource(other.id); await app.goSelected();
  assert.equal(app.state.view, 'guide'); assert.equal(app.element('#guidance-heading').textContent, '前往選取的資源');
});

test('review small items: no speak card for public Wi-Fi hotspots, guide filters to the urgency, unlisted language is cleared once', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall });
  const hotspot = actualData.stores.find(s => hasCoordinates(s) && s.sourceId === 'wifi');
  assert.equal(app.r.__test.speakCategory(hotspot), null);
  await app.click('#home-map'); app.r.__test.selectResource(hotspot.id); assert.doesNotMatch(app.element('#selected-card').innerHTML, /data-action="speak"/);
  await app.click('#map-back'); await app.click('[data-urgency="charge"]'); await app.click('[data-action="go"]');
  assert.deepEqual([...app.state.filters], ['charge']);
  const stale = runtime({ storage: { 'friendly-native-language-v1': 'vi' } }); await settle();
  assert.equal(stale.state.prefs.lang, 'zh-TW'); assert(stale.storageWrites.some(([key, value]) => key === 'friendly-native-language-v1' && value === null), 'the unlisted value is removed');
});

test('review F-8: after switching guide targets twice, ending guidance returns to the result card in one press', async () => {
  const app = runtime(); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="toilet"]'); const first = resultId(app); await app.click('[data-action="go"]');
  const others = actualData.stores.filter(s => hasCoordinates(s) && s.services.includes('toilet') && String(s.id) !== first).slice(0, 2);
  for (const other of others) {
    await app.click('#guidance-resources'); app.r.document.querySelector('#sheet-body').innerHTML = `<button class="resource-row" data-resource="${other.id}"></button>`;
    await app.element(`[data-resource="${other.id}"]`).dispatch('click');
  }
  assert.equal(app.state.selectedId, String(others[1].id));
  app.history.back(); await settle(); assert.equal(app.state.view, 'guide', 'system back still steps to the previous target');
  assert.equal(app.state.selectedId, String(others[0].id));
  await app.click('#guidance-end'); assert.equal(app.state.view, 'result'); assert.equal(resultId(app), first);
  await app.click('[data-action="go"]');
  for (const other of others) {
    await app.click('#guidance-resources'); app.r.document.querySelector('#sheet-body').innerHTML = `<button class="resource-row" data-resource="${other.id}"></button>`;
    await app.element(`[data-resource="${other.id}"]`).dispatch('click');
  }
  await app.click('#guidance-end'); assert.equal(app.state.view, 'result', 'one press of 結束導引 leaves guidance');
  app.history.back(); await settle(); assert.equal(app.state.view, 'home');
});

test('review F-9: reloading on a result-card guide keeps the "nearest" heading once location returns', async () => {
  const nearest = nearestIds('toilet')[0];
  const app = runtime({ historyState: { view: 'guide', urgency: 'toilet', storeId: nearest, index: 0, depth: 2 } }); await settle();
  assert.equal(app.state.view, 'guide'); await app.fix(0, { ...cityHall });
  assert.equal(app.element('#guidance-heading').textContent, '最近的廁所');
});

test('review F-10: switching guide targets cleans up the old guide before the new one starts', async () => {
  const calls = []; const app = runtime({ highlightCalls: calls }); await app.fix(0, { ...cityHall });
  await app.click('[data-urgency="toilet"]'); const first = resultId(app); await app.click('[data-action="go"]');
  const stale = app.routeRequests.at(-1);
  const other = actualData.stores.find(s => hasCoordinates(s) && s.services.includes('toilet') && String(s.id) !== first);
  const pausesBefore = calls.filter(call => call.method === 'pauseGuide').length;
  await app.click('#guidance-resources'); app.r.document.querySelector('#sheet-body').innerHTML = `<button class="resource-row" data-resource="${other.id}"></button>`;
  await app.element(`[data-resource="${other.id}"]`).dispatch('click');
  assert.equal(calls.filter(call => call.method === 'pauseGuide').length, pausesBefore + 1, 'the old countdown is paused on switch');
  stale.resolve(routeResult()); await settle();
  assert.equal(app.state.guideRoute, null, 'the old target route is ignored'); assert.equal(calls.filter(call => call.method === 'openToilet').length, 0);
  app.routeRequests.at(-1).resolve(routeResult()); await settle();
  assert.equal(calls.filter(call => call.method === 'openToilet').at(-1).id, String(other.id));
});

test('interface language: switching to English re-renders home, result card and guide HUD; switching back restores Chinese', async () => {
  const { STRINGS } = require('../friendly-route/i18n.js'); const en = STRINGS.en; const zh = STRINGS['zh-TW'];
  const cjk = /[㐀-鿿]/;
  const speakLangs = [{ code: 'zh-TW', label: '中文', reviewed: true }, { code: 'en', label: 'English', reviewed: false }, { code: 'ja', label: '日本語', reviewed: false }];
  const app = runtime({ speakLangs }); await app.fix(0, { ...cityHall });
  assert.equal(app.element('#home-heading').textContent, zh['home.title']);
  await app.click('#home-settings'); await app.click('[data-ui-lang="en"]');
  assert.equal(app.r.document.documentElement.lang, 'en');
  assert(app.storageWrites.some(([key, value]) => key === 'friendly.uiLang' && value === 'en'), 'the choice is stored');
  assert.equal(app.state.prefs.lang, 'en', 'the ask card language follows the interface language');
  assert.match(app.element('#sheet-body').innerHTML, new RegExp(en['speak.machine']), 'unreviewed languages are labelled machine translated');
  assert.match(app.element('#sheet-body').innerHTML, new RegExp(en['settings.ui.lang.note']));
  assert.equal(app.element('#home-heading').textContent, en['home.title']);
  for (const key of ['toilet', 'charge', 'wifi']) {
    const label = app.element(`[data-urgency="${key}"]`).textContent;
    assert.equal(label, `${en[`urgency.${key}.button`]}${en[`urgency.${key}.hint`]}`, key); assert.doesNotMatch(label, cjk, key);
  }
  await app.click('[data-urgency="toilet"]');
  assert.equal(app.element('#result-title').textContent, en['urgency.toilet.title']);
  const card = app.element('#result-body').textContent;
  assert.match(card, /^No\. 1 by straight line · \d candidates/); assert.match(card, new RegExp(en['common.go'])); assert.match(card, /Straight \d+ m/);
  await app.element('#result-body').querySelector('[data-action="go"]').dispatch('click');
  assert.equal(app.state.view, 'guide');
  assert.equal(app.element('#guidance-heading').textContent, en['urgency.toilet.title']);
  assert.match(app.element('#guidance-distance').textContent, /^Straight \d+ m$/);
  assert.match(app.element('#guidance-bearing').textContent, /^To the (north|northeast|east|southeast|south|southwest|west|northwest) · north-up · Compass not used$/);
  for (const selector of ['#guidance-heading', '#guidance-distance', '#guidance-bearing', '#guidance-location', '#guidance-end', '#guidance-resources']) assert.doesNotMatch(app.element(selector).textContent, cjk, selector);
  await app.click('#settings-button'); await app.click('[data-ui-lang="zh-TW"]');
  assert.equal(app.r.document.documentElement.lang, 'zh-Hant-TW');
  assert.equal(app.state.prefs.lang, 'en', 'back to Chinese keeps the chosen ask card language');
  assert.equal(app.element('#guidance-heading').textContent, zh['urgency.toilet.title']);
  assert.match(app.element('#guidance-distance').textContent, /^直線 \d+ 公尺$/);
  assert.match(app.element('#guidance-bearing').textContent, /方 · 正北基準 · 未使用方位感測$/);
  assert.equal(app.element('#guidance-end').textContent, zh['guide.end']);
  assert.equal(app.element('#home-heading').textContent, zh['home.title']);
  assert.equal(app.element('[data-urgency="toilet"]').textContent, `${zh['urgency.toilet.button']}${zh['urgency.toilet.hint']}`);
});

test('interface language from navigator.language: a Japanese device opens in Japanese with the ask card in Japanese', async () => {
  const { STRINGS } = require('../friendly-route/i18n.js');
  const speakLangs = [{ code: 'zh-TW', label: '中文', reviewed: true }, { code: 'ja', label: '日本語', reviewed: false }];
  const app = runtime({ speakLangs, language: 'ja-JP' }); await app.fix(0, { ...cityHall });
  assert.equal(app.r.document.documentElement.lang, 'ja');
  assert.equal(app.element('#home-heading').textContent, STRINGS.ja['home.title']);
  assert.equal(app.element('[data-urgency="wifi"]').textContent, `${STRINGS.ja['urgency.wifi.button']}${STRINGS.ja['urgency.wifi.hint']}`);
  assert.equal(app.state.prefs.lang, 'ja');
  assert.equal(app.storageWrites.length, 0, 'opening does not write storage');
  const stored = runtime({ speakLangs, language: 'ja-JP', storage: { 'friendly.uiLang': 'zh-TW', 'friendly-native-language-v1': 'zh-TW' } }); await settle();
  assert.equal(stored.element('#home-heading').textContent, STRINGS['zh-TW']['home.title'], 'a stored choice wins over the device language');
  assert.equal(stored.state.prefs.lang, 'zh-TW');
});
