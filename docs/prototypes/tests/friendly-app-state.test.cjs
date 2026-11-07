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
  const layers = new Set(); const mapEvents = new Map(); const moves = [];
  let center = { lat: 25.0375, lng: 121.5637 }; let zoom = 14.5; let bounds = [[-90, -180], [90, 180]];
  const point = (x, y) => ({ x, y, add(other) { return point(this.x + other.x, this.y + other.y); } });
  const latLng = value => Array.isArray(value) ? { lat: value[0], lng: value[1] } : value;
  const map = {
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
    L: { map: () => map, point, canvas: () => ({}), control: { attribution: () => layer(), scale: () => layer() }, layerGroup: () => layer(), geoJSON: () => layer(), tileLayer: () => layer(), circleMarker: layer, marker: layer, divIcon: settings => settings },
    map, moves, layers,
    async setBounds(value) { bounds = value; mapEvents.get('moveend')?.(); await settle(); },
  };
}

function runtime(options = {}) {
  const document = makeDocument(html); const leaflet = makeLeaflet(); const gpsRequests = []; const storageWrites = []; const bridgeCalls = []; const searchCalls = []; const copied = []; const listeners = new Map(); const cacheCalls = [];
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixedTime])); } static now() { return fixedTime; } }
  const r = {
    document, URL, AbortController, Date: FixedDate, console, innerWidth: 390,
    FRIENDLY_DATA: actualBasemap, FRIENDLY_RESOURCES: actualData, L: leaflet.L,
    location: new URL('https://example.test/friendly/index.html'),
    navigator: { onLine: options.offline !== true, clipboard: { async writeText(text) { copied.push(text); } } },
    FriendlyIcons: { icon: name => `<svg data-test-icon="${name}"></svg>` },
    FriendlyBridge: {
      getLocation: () => new Promise((resolve, reject) => gpsRequests.push({ resolve, reject })),
      async navigate(store) { bridgeCalls.push({ method: 'navigate', value: store }); return options.navigate?.(store) ?? options.externalResult ?? 'opened'; },
      async callPhone(phone) { bridgeCalls.push({ method: 'phone', value: phone }); return options.externalResult ?? 'opened'; },
    },
    FriendlySearch: { createClient: () => ({ async search(query, args) { searchCalls.push({ query, ...args }); return options.search ? options.search(query, args) : []; } }) },
    FriendlyOffline: { async initialize(callback) { cacheCalls.push(callback); const status = options.cacheStatus || { state: 'ready', savedAt: fixedTime, failures: [] }; callback(status); return status; } },
    localStorage: { getItem: () => null, setItem: (key, value) => storageWrites.push([key, value]) },
    requestAnimationFrame(callback) { queueMicrotask(() => callback(0)); return 1; }, cancelAnimationFrame() {},
    ResizeObserver: class { observe() {} disconnect() {} },
    setTimeout() { return 1; }, clearTimeout() {},
    addEventListener(name, callback) { (listeners.get(name) || listeners.set(name, []).get(name)).push(callback); },
    DeviceOrientationEvent: options.orientation,
  };
  r.window = r; vm.createContext(r);
  // Observe private state through an in-memory seam, leaving production files unchanged.
  const seam = 'window.__test = { state, markers, requestPosition, visibleStores, selectResource, setDestination, showDetails, showDirection, externalAction, enableOrientation, orientation, renderAll };';
  const source = fs.readFileSync(path.join(base, 'app.js'), 'utf8'); assert.match(source, /\}\)\(\);\s*$/);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `${seam}\n})();`), r, { filename: 'app.js' });
  const element = selector => { const el = document.querySelector(selector); assert(el, `Missing test element: ${selector}`); return el; };
  return {
    r, state: r.__test.state, gpsRequests, storageWrites, bridgeCalls, searchCalls, copied, cacheCalls, ...leaflet,
    element, click: selector => element(selector).dispatch('click'),
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
  assert.equal(app.state.position.lat, 25.06); assert.equal(app.state.gpsMessage, '');
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
  assert.equal(app.r.__test.markers.size, total); assert([...app.r.__test.markers.values()].every(marker => marker.styles.opacity === .9));
});

test('four categories agree with source flags and zero counts refer to the viewport', async () => {
  const app = runtime({ offline: true }); await settle();
  for (const service of ['toilet', 'charge', 'wifi', 'accessible']) {
    await app.click(`[data-service="${service}"]`);
    assert.equal(app.r.__test.visibleStores().length, actualData.stores.filter(s => hasCoordinates(s) && s.services.includes(service)).length);
    await app.click(`[data-service="${service}"]`);
  }
  await app.click('[data-service="toilet"]'); await app.setBounds([[0, 0], [1, 1]]);
  assert.equal(app.element('#visible-count').textContent, '視窗內 0 筆'); assert.match(app.element('#nearby-preview').innerHTML, /視窗內沒有符合/);
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
  assert.match(app.element('#selected-card').innerHTML, /未提供座標/); assert.equal(app.element('[data-action="navigate"]').disabled, true);
});

test('phone buttons require a normalized number, including Wi-Fi resources with no phone', async () => {
  const app = runtime(); const withPhone = actualData.stores.find(s => s.normalizedPhone); app.r.__test.selectResource(withPhone.id);
  await app.click('[data-action="phone"]'); assert.equal(app.bridgeCalls.at(-1).method, 'phone'); assert.equal(app.bridgeCalls.at(-1).value, withPhone.normalizedPhone);
  const noPhone = actualData.stores.find(s => s.sourceId === 'wifi' && !s.normalizedPhone); app.r.__test.selectResource(noPhone.id);
  assert.equal(app.r.document.querySelector('[data-action="phone"]'), null); assert.match(app.element('#selected-card').innerHTML, /來源：/);
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
  await app.click('[data-action="navigate"]');
  const visibleStatus = `${app.element('#toast').textContent} ${app.element('#external-message').textContent} ${app.element('#sheet-body').innerHTML}`;
  assert.match(visibleStatus, /離線.*可能無法使用|依賴外部程式|通話功能/);
  assert.equal(app.r.document.querySelector('[data-copy="address"]').hidden, false);
});

test('bridge failures and browser fallback preserve copyable details without announcing success', async t => {
  for (const result of ['failed', 'unsupported']) for (const kind of ['navigate', 'phone']) {
    await t.test(`${kind}:${result}`, async () => {
      const app = runtime({ externalResult: result }); const store = actualData.stores.find(s => s.normalizedPhone && hasCoordinates(s)); app.r.__test.selectResource(store.id);
      await app.click(`[data-action="${kind}"]`); assert.equal(app.bridgeCalls.at(-1).method, kind);
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
