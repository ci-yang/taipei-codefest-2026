// Run against an already running friendly-route static server; no server or dependency install.
// NODE_PATH=/path/to/node_modules node scripts/check-friendly-route-browser.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const loadDependency = createRequire(import.meta.url);
const { chromium } = loadDependency('playwright');
const baseURL = process.env.ROUTE_QA_URL || 'http://127.0.0.1:8883/';
const output = process.env.ROUTE_QA_OUTPUT || '/tmp/tcf-route-qa';
const origin = new URL(baseURL).origin;
// Public Taipei City Hall vicinity, deliberately fixed; never the tester's GPS.
const geolocation = { latitude: 25.0375, longitude: 121.5637, accuracy: 10 };
const sizes = [[320, 568], [390, 844], [430, 932], [768, 1024], [844, 390]];
const report = {
  startedAt: new Date().toISOString(), baseURL, geolocation, browser: 'Chromium',
  scope: 'Desktop browser emulation; not physical device or native TownPass validation.',
  seam: 'Only the served app.js response receives a read-only observer closure. No production file changes, state writes, route mocks, or Worker replacement. Service Workers blocked to isolate current source; offline cache persistence is not tested. The large-text check doubles computed font size/line height in this browser only; it is not OS Dynamic Type.',
  networkPolicy: 'External requests blocked; local public graph and real dedicated Worker allowed. Photon is not used; destination is selected from local resources.',
  checks: [], screenshots: [], viewports: [], categories: [], requests: [], workers: [], pageErrors: [], graphLoads: [], routeTimings: [],
};

async function sourceHashes() {
  const files = ['index.html', 'app.js', 'app-ui.css', 'route-client.js', 'routing-worker.js', 'routing.js', 'routing-data.js'];
  return Object.fromEntries(await Promise.all(files.map(async file => {
    const bytes = await readFile(new URL(`../docs/prototypes/friendly-route/${file}`, import.meta.url));
    return [file, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
  })));
}

function check(name, test, details) {
  try { test(); report.checks.push({ name, pass: true, details }); }
  catch (error) { report.checks.push({ name, pass: false, error: error.message, details }); }
}

// Captures only serializable observations. It does not expose setters or mutate application state.
const observer = `
Object.defineProperty(window, '__friendlyRouteQA', { value: Object.freeze({
  snapshot() {
    const expectedIds = state.route ? stores.filter(s => state.route.storeIds.includes(s.id) && (!state.filters.size || s.services.some(k => state.filters.has(k)))).map(s => s.id).sort() : [];
    const highlightedIds = [...markers].filter(([, marker]) => marker.options.radius === 7 && marker.options.fillOpacity > 0.7).map(([id]) => id).sort();
    return { position: state.position && { lat: state.position.lat, lng: state.position.lng }, destination: state.destination && { name: state.destination.name, lat: state.destination.lat, lng: state.destination.lng },
      selectedId: state.selectedId, filters: [...state.filters].sort(), routeStatus: state.routeStatus,
      route: state.route && JSON.parse(JSON.stringify(state.route)), expectedIds, highlightedIds,
      mapId: map._leaflet_id, mapSize: { x: map.getSize().x, y: map.getSize().y }, mapExpanded: state.mapExpanded,
      routePixels: state.route ? state.route.coordinates.map(point => { const p = map.latLngToContainerPoint(point); return { x: p.x, y: p.y }; }) : [],
      panelCollapsed: state.panelCollapsed, routeLayers: destinationRouteLayer.getLayers().map(layer => ({ dashArray: layer.options.dashArray || null, points: layer.getLatLngs().length })) };
  }
}) });
`;

async function session(browser, viewport, label, extra = {}) {
  const context = await browser.newContext({ viewport, geolocation, permissions: ['geolocation'], locale: 'zh-TW', serviceWorkers: 'block', ...extra });
  const graphStarts = new WeakMap();
  context.on('request', request => {
    report.requests.push({ label, method: request.method(), url: request.url(), body: request.postData() });
    if (new URL(request.url()).pathname.endsWith('/routing-data.js')) graphStarts.set(request, performance.now());
  });
  context.on('requestfinished', request => {
    if (graphStarts.has(request)) report.graphLoads.push({ label, url: request.url(), requestWallMs: Math.round(performance.now() - graphStarts.get(request)) });
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort('blockedbyclient');
    if (url.pathname.endsWith('/app.js')) {
      const response = await route.fetch();
      const source = await response.text();
      assert.match(source, /\}\)\(\);\s*$/);
      return route.fulfill({ response, body: source.replace(/\}\)\(\);\s*$/, `${observer}\n})();`) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('worker', worker => report.workers.push({ label, url: worker.url() }));
  page.on('pageerror', error => report.pageErrors.push({ label, message: error.message }));
  await page.goto(baseURL, { waitUntil: 'load' });
  if (extra.hasTouch) await page.locator('#home-map').tap();
  else await page.locator('#home-map').click();
  await page.waitForFunction(() => window.__friendlyRouteQA?.snapshot().position && document.querySelector('#app').dataset.view === 'map');
  return { context, page };
}

async function snapshot(page) { return page.evaluate(() => window.__friendlyRouteQA.snapshot()); }
async function screenshot(page, name, fullPage = false) {
  const filename = path.join(output, `${name}.png`);
  await page.screenshot({ path: filename, fullPage });
  report.screenshots.push(filename);
}
async function layout(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const el = document.querySelector(selector); const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    };
    const textLines = selector => {
      const el = document.querySelector(selector); const range = document.createRange();
      const textNode = [...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (!textNode) return 0;
      range.selectNodeContents(textNode);
      return new Set([...range.getClientRects()].map(r => Math.round(r.top))).size;
    };
    const focus = document.activeElement;
    return {
      viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
      map: rect('#map'), stage: rect('#map-stage'), button: rect('#start-guidance'), description: rect('#mode-description'),
      descriptionLines: textLines('#mode-description'), startLines: textLines('#start-guidance'),
      searchFocusVisible: document.querySelector('#search-trigger').matches(':focus-visible'),
      active: focus.id || focus.tagName, activeFocusVisible: focus.matches(':focus-visible'), activeOutline: getComputedStyle(focus).outlineWidth,
      mapSize: window.__friendlyRouteQA.snapshot().mapSize,
      overflowNodes: [...document.querySelectorAll('#explore-screen *')].filter(el => !el.closest('#map, #category-filters, #nearby-preview') && el.getClientRects().length && el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, id: el.id, className: el.getAttribute('class'), right: el.getBoundingClientRect().right })).slice(0, 12),
    };
  });
}
async function settledMap(page) {
  await page.waitForFunction(() => {
    const map = document.querySelector('#map').getBoundingClientRect();
    const size = window.__friendlyRouteQA.snapshot().mapSize;
    return Math.abs(map.width - size.x) <= 1 && Math.abs(map.height - size.y) <= 1;
  });
}
function stableState(value) {
  const { position, destination, selectedId, filters, route, mapId } = value;
  return { position, destination, selectedId, filters, route, mapId };
}

async function layoutChecks(browser, width, height) {
  const label = `${width}x${height}`;
  const { context, page } = await session(browser, { width, height }, label);
  try {
    await settledMap(page);
    const normal = await layout(page);
    report.viewports.push({ label, normal });
    check(`${label}: no horizontal overflow`, () => assert.ok(normal.documentWidth <= width), normal.documentWidth);
    check(`${label}: description and START remain one line`, () => { assert.equal(normal.descriptionLines, 1); assert.equal(normal.startLines, 1); assert.ok(normal.button.height >= 44); }, { descriptionLines: normal.descriptionLines, startLines: normal.startLines, button: normal.button });
    check(`${label}: pointer entry does not focus search`, () => { assert.equal(normal.searchFocusVisible, false); assert.notEqual(normal.active, 'search-trigger'); });
    check(`${label}: entry starts at map top`, () => assert.equal(normal.stage.y, 0), normal.stage);
    await screenshot(page, `${label}-normal`, true);
    await page.keyboard.press('Tab');
    const keyboard = await layout(page);
    check(`${label}: Tab has visible focus`, () => { assert.equal(keyboard.activeFocusVisible, true); assert.ok(parseFloat(keyboard.activeOutline) > 0); }, { active: keyboard.active, outline: keyboard.activeOutline });
    await chooseDestination(page);
    const before = stableState(await snapshot(page));
    await page.locator('#map-expand').click();
    await page.waitForFunction(() => document.querySelector('#map-expand').getAttribute('aria-expanded') === 'true');
    await settledMap(page);
    const expanded = await layout(page); report.viewports.at(-1).expanded = expanded;
    check(`${label}: expanded map fills available viewport`, () => { assert.ok(Math.abs(expanded.stage.height - height) <= 1); assert.ok(Math.abs(expanded.stage.width - width) <= 1); assert.equal(expanded.stage.y, 0); assert.ok(expanded.documentWidth <= width); }, expanded.stage);
    const routeFit = await page.evaluate(() => {
      const panel = document.querySelector('#bottom-panel').getBoundingClientRect();
      const status = document.querySelector('#map-status').getBoundingClientRect();
      const points = window.__friendlyRouteQA.snapshot().routePixels;
      return { points, statusBottom: status.bottom, panel: { left: panel.left, top: panel.top, right: panel.right, bottom: panel.bottom }, width: innerWidth, height: innerHeight };
    });
    check(`${label}: expanded route fits outside floating panel and status`, () => assert.ok(routeFit.points.length > 2 && routeFit.points.every(p => p.x >= 0 && p.x <= width && p.y >= routeFit.statusBottom && p.y <= height && !(p.x > routeFit.panel.left && p.x < routeFit.panel.right && p.y > routeFit.panel.top && p.y < routeFit.panel.bottom))), routeFit);
    await page.locator('#panel-toggle').click();
    const collapsed = await page.evaluate(() => ({ hidden: document.querySelector('#panel-content').hidden, aria: document.querySelector('#panel-toggle').getAttribute('aria-expanded'), controls: document.querySelector('#panel-toggle').getAttribute('aria-controls'), renderedFocusables: [...document.querySelectorAll('#panel-content button, #panel-content a, #panel-content input')].filter(el => el.getClientRects().length > 0).length }));
    check(`${label}: collapsed panel hides descendants and updates aria`, () => assert.deepEqual(collapsed, { hidden: true, aria: 'false', controls: 'panel-content', renderedFocusables: 0 }), collapsed);
    const collapsedHeight = await page.locator('#bottom-panel').evaluate(el => el.getBoundingClientRect().height);
    check(`${label}: collapsed panel frees map area`, () => assert.ok(collapsedHeight < 100), collapsedHeight);
    await screenshot(page, `${label}-expanded-collapsed`);
    await page.keyboard.press('Tab');
    const focusInside = await page.evaluate(() => document.querySelector('#panel-content').contains(document.activeElement));
    check(`${label}: Tab does not enter hidden content`, () => assert.equal(focusInside, false));
    await page.locator('#panel-toggle').click();
    await page.locator('#map-expand').click();
    await settledMap(page);
    const restored = await layout(page);
    check(`${label}: restore retains map dimensions`, () => assert.ok(Math.abs(restored.stage.height - normal.stage.height) <= 1));
    const after = stableState(await snapshot(page));
    check(`${label}: actual restored state equals initial state`, () => assert.deepEqual(after, before));
  } catch (error) {
    check(`${label}: completes browser flow`, () => { throw error; });
    await screenshot(page, `${label}-failure`).catch(() => {});
  } finally { await context.close(); }
}

async function chooseDestination(page, name = '新東陽101專櫃') {
  await page.locator('#search-trigger').click();
  await page.locator('#search-input').fill(name);
  const start = performance.now();
  await page.locator('[data-search-result]').filter({ hasText: name }).first().click();
  await page.waitForFunction(() => ['ready', 'error'].includes(window.__friendlyRouteQA.snapshot().routeStatus));
  const value = await snapshot(page);
  report.routeTimings.push({ destination: name, viewport: page.viewportSize(), status: value.routeStatus, uiSelectionThroughWorkerResultWallMs: Math.round(performance.now() - start) });
  assert.equal(value.routeStatus, 'ready', await page.locator('#destination-route-message').textContent());
  return value;
}

async function crossDistrictChecks(browser) {
  const { context, page } = await session(browser, { width: 390, height: 844 }, 'cross-district');
  try {
    // Explicit test seam: call the unchanged public route client with two public landmarks.
    // This does not write private UI state, replace the Worker, or use real tester GPS.
    const result = await page.evaluate(async () => {
      const client = window.FriendlyRouteClient.createClient();
      const points = [{ lat: 25.0478, lng: 121.5170 }, { lat: 25.0375, lng: 121.5637 }];
      const started = performance.now();
      try {
        const route = await client.route({ points, stores: window.FRIENDLY_RESOURCES.stores, radius: 250 });
        return { status: 'ready', points, route, graphLoadAndComputeWallMs: Math.round(performance.now() - started) };
      } catch (error) {
        return { status: 'error', points, error: error.message, graphLoadAndComputeWallMs: Math.round(performance.now() - started) };
      } finally { client.cancel(); }
    });
    report.crossDistrict = {
      ...result, from: '台北車站', to: '臺北市政府',
      method: 'Public FriendlyRouteClient API; new real Worker; default production timeout; fresh browser context with HTTP cache and Service Workers disabled.',
      timingScope: 'Desktop Chrome on this host against local HTTP; wall time includes Worker startup, static graph download/evaluation, route computation and message delivery. Not a mobile performance measurement.',
    };
    check('public cross-district Taipei Main to City Hall route succeeds', () => {
      assert.equal(result.status, 'ready', result.error);
      assert.ok(result.route.distanceM > 0);
      assert.ok(result.route.roadSegments.flat().length > 2);
      assert.ok(report.workers.some(worker => worker.label === 'cross-district' && worker.url.endsWith('/routing-worker.js')));
    }, { status: result.status, distanceM: result.route?.distanceM, roadPoints: result.route?.roadSegments.flat().length, graphLoadAndComputeWallMs: result.graphLoadAndComputeWallMs, error: result.error });
  } catch (error) {
    check('cross-district browser flow completes', () => { throw error; });
  } finally { await context.close(); }
}

async function routeChecks(browser) {
  const { context, page } = await session(browser, { width: 390, height: 844 }, 'route');
  try {
    const initial = await chooseDestination(page);
    report.route = initial;
    check('real local Worker returns road geometry and distance', () => { assert.ok(initial.route.distanceM > 0); assert.ok(initial.route.roadSegments.flat().length > 2); assert.ok(report.workers.some(w => w.label === 'route' && w.url.endsWith('/routing-worker.js'))); }, { distanceM: initial.route.distanceM, roadPoints: initial.route.roadSegments.flat().length, connectorDistanceM: initial.route.connectorDistanceM });
    check('road and estimated connectors use distinct line styles', () => { assert.ok(initial.routeLayers.some(l => !l.dashArray)); assert.ok(initial.routeLayers.some(l => l.dashArray)); }, initial.routeLayers);
    await screenshot(page, 'route-ready', true);
    const workersBeforeFilters = report.workers.length;
    for (const categories of [[], ['wifi'], ['toilet'], ['charge'], ['accessible'], ['wifi', 'charge']]) {
      const current = (await snapshot(page)).filters;
      for (const key of ['wifi', 'toilet', 'charge', 'accessible']) {
        if (current.includes(key) !== categories.includes(key)) await page.locator(`[data-service="${key}"]`).click();
      }
      const value = await snapshot(page);
      const countText = await page.locator('#visible-count').textContent();
      await page.locator('#list-button').click();
      const listIds = await page.locator('#sheet-body [data-resource]').evaluateAll(els => els.map(el => el.dataset.resource).sort());
      const sample = { categories, expected: value.expectedIds.length, highlighted: value.highlightedIds.length, listed: listIds.length, countText };
      report.categories.push(sample);
      check(`category ${categories.join('+') || 'all'}: highlight/count/list match same route set`, () => { assert.deepEqual(value.highlightedIds, value.expectedIds); assert.deepEqual(listIds, value.expectedIds); assert.equal(Number(countText.match(/\d+/)?.[0]), value.expectedIds.length); assert.deepEqual(value.route, initial.route); }, sample);
      await page.locator('#sheet-close').click();
    }
    check('category filters do not create new route Workers', () => assert.equal(report.workers.length, workersBeforeFilters));
    await page.locator('#list-button').click();
    await page.locator('#sheet-body [data-resource]').first().click();
    await page.waitForFunction(() => document.querySelector('#app-sheet').dataset.sheet === 'detail');
    const selected = await snapshot(page);
    const detail = await page.locator('#sheet-body').textContent();
    check('resource details preserve destination route and show provenance', () => { assert.ok(selected.selectedId); assert.deepEqual(selected.route, initial.route); assert.deepEqual(selected.destination, initial.destination); assert.match(detail, /來源/); assert.match(detail, /資料更新/); });
    await screenshot(page, 'route-resource-details');
    await page.locator('#sheet-close').click();
    const beforeLayout = stableState(await snapshot(page));
    for (let i = 0; i < 2; i += 1) {
      await page.locator('#map-expand').click(); await settledMap(page);
      await page.locator('#panel-toggle').click();
      await page.locator('#panel-toggle').click();
      await page.locator('#map-expand').click(); await settledMap(page);
    }
    const afterLayout = stableState(await snapshot(page));
    check('two expand/collapse/restore cycles preserve GPS/destination/route/category/selected resource/map instance', () => assert.deepEqual(afterLayout, beforeLayout));
    await screenshot(page, 'route-selected-restored', true);
    await page.locator('#destination-clear').click();
    const cleared = await snapshot(page);
    check('clear removes route layers/IDs and preserves categories', () => { assert.equal(cleared.route, null); assert.equal(cleared.destination, null); assert.equal(cleared.routeStatus, 'idle'); assert.equal(cleared.routeLayers.length, 0); assert.deepEqual(cleared.expectedIds, []); assert.deepEqual(cleared.filters, selected.filters); });
    await screenshot(page, 'route-cleared', true);
  } catch (error) {
    check('route flow completes', () => { throw error; });
    await screenshot(page, 'route-failure').catch(() => {});
  } finally { await context.close(); }
}

async function accessibilityChecks(browser) {
  const { context, page } = await session(browser, { width: 320, height: 568 }, 'touch-large-text', { hasTouch: true, reducedMotion: 'reduce' });
  try {
    const touch = await layout(page);
    check('touch entry does not create search focus outline', () => { assert.equal(touch.searchFocusVisible, false); assert.notEqual(touch.active, 'search-trigger'); });
    // Test-only text scaling of computed CSS values, not an assertion about OS Dynamic Type.
    await page.evaluate(() => {
      const values = [...document.querySelectorAll('#explore-screen *')].filter(el => !(el instanceof SVGElement)).map(el => {
        const style = getComputedStyle(el);
        return { el, font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
      });
      for (const { el, font, line } of values) {
        el.style.fontSize = `${font * 2}px`;
        if (Number.isFinite(line)) el.style.lineHeight = `${line * 2}px`;
      }
    });
    await page.locator('#start-guidance').scrollIntoViewIfNeeded();
    const large = await layout(page); report.largeText = large;
    check('200% computed text remains readable without document overflow', () => { assert.ok(large.documentWidth <= 320); assert.ok(large.description.scrollWidth <= large.description.clientWidth + 1); assert.ok(large.button.scrollWidth <= large.button.clientWidth + 1); }, large);
    await screenshot(page, '320x568-text-200-percent', true);
    await page.locator('#map-expand').tap(); await settledMap(page);
    await page.locator('#panel-toggle').tap();
    const reducedMotion = await page.evaluate(() => ({ preference: matchMedia('(prefers-reduced-motion: reduce)').matches, expanded: document.querySelector('#map-expand').getAttribute('aria-expanded'), collapsed: document.querySelector('#panel-content').hidden }));
    check('touch and reduced-motion can expand and collapse', () => assert.deepEqual(reducedMotion, { preference: true, expanded: 'true', collapsed: true }), reducedMotion);
    await page.locator('#map-expand').tap(); await settledMap(page);
    const restored = await snapshot(page);
    check('large text touch actually restores map', () => assert.equal(restored.mapExpanded, false));
  } catch (error) {
    check('touch/large text/reduced motion flow completes', () => { throw error; });
    await screenshot(page, 'touch-large-text-failure').catch(() => {});
  } finally { await context.close(); }
}

await mkdir(output, { recursive: true });
report.sourceBefore = await sourceHashes();
const browser = await chromium.launch({ headless: true, channel: process.env.ROUTE_QA_CHANNEL || 'chrome' });
try {
  report.browserVersion = browser.version();
  for (const [width, height] of sizes) { console.log(`Checking ${width}x${height}`); await layoutChecks(browser, width, height); }
  console.log('Checking real local routing and state preservation');
  await routeChecks(browser);
  console.log('Checking touch, 200% computed text, and reduced motion');
  await accessibilityChecks(browser);
  console.log('Checking public cross-district route with real city graph');
  await crossDistrictChecks(browser);
  const outgoingCoordinates = report.requests.filter(r => new URL(r.url).origin !== origin && /25\.0375|121\.5637|25\.0478|121\.517/.test(`${r.url} ${r.body || ''}`));
  check('fixed GPS is not sent to external routing or search requests', () => assert.equal(outgoingCoordinates.length, 0), outgoingCoordinates);
  const externalRequests = report.requests.filter(r => new URL(r.url).origin !== origin);
  check('external request attempts are only basemap tiles, never routing/search APIs', () => assert.ok(externalRequests.every(r => new URL(r.url).hostname === 'tile.openstreetmap.org' && r.method === 'GET' && !r.body)), { attempts: externalRequests.length, hosts: [...new Set(externalRequests.map(r => new URL(r.url).hostname))] });
  check('real Worker loads bundled graph and router', () => { assert.ok(report.requests.some(r => r.url.endsWith('/routing-data.js'))); assert.ok(report.requests.some(r => r.url.endsWith('/routing.js'))); });
  check('no uncaught browser application errors', () => assert.deepEqual(report.pageErrors, []), report.pageErrors);
} finally {
  await browser.close();
  report.sourceAfter = await sourceHashes();
  check('runtime source files remain stable during browser verification', () => assert.deepEqual(report.sourceAfter, report.sourceBefore));
  report.finishedAt = new Date().toISOString();
  report.passed = report.checks.filter(c => c.pass).length;
  report.failed = report.checks.filter(c => !c.pass).length;
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, report: path.join(output, 'report.json'), failures: report.checks.filter(c => !c.pass) }, null, 2));
  if (report.failed) process.exitCode = 1;
}
