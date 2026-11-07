// The page's Content-Security-Policy is the structural guard: the browser itself refuses inline styles, outside
// stylesheets, @import and outside images, however they are spelled. The source scans in situation-inline-style and
// css-audit stay as a second line. These tests check the policy text, then run the real page in headless Chrome.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { launchChrome, serve } from './chrome.mjs';
import { pageDir } from './css-tokens.mjs';

const read = (file) => readFileSync(join(pageDir, file), 'utf8');

const EXPECTED = {
  'default-src': ["'none'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'object-src': ["'none'"],
  'worker-src': ["'none'"],
};

/** Every CSP meta in the page's <head>, parsed into { directive: [sources] }. */
function cspMetas(html) {
  const head = html.slice(0, html.indexOf('</head>'));
  return [...head.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*>/gi)].map(([, content]) => Object.fromEntries(
    content.split(';').map((d) => d.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...sources]) => [name.toLowerCase(), sources])));
}

test('index.html declares exactly the expected CSP, as the first element of <head>', () => {
  const html = read('index.html');
  const metas = cspMetas(html);
  assert.equal(metas.length, 1, 'expected one CSP meta');
  assert.deepEqual(metas[0], EXPECTED);
  assert.match(html, /<head>\s*<meta\s+http-equiv="Content-Security-Policy"/, 'CSP meta must come first so nothing loads before it');
});

test('the CSP allows no inline, eval, wildcard or scheme source (data: only for images)', () => {
  for (const [directive, sources] of Object.entries(cspMetas(read('index.html'))[0])) {
    for (const source of sources) {
      assert.ok(!["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "'wasm-unsafe-eval'"].includes(source), `${directive} ${source}`);
      assert.ok(!source.includes('*'), `${directive} ${source}`);
      assert.ok(!/^(https?|wss?|blob|filesystem):/i.test(source), `${directive} ${source}`);
      if (source === 'data:') assert.equal(directive, 'img-src', `data: only belongs on img-src, found on ${directive}`);
    }
  }
});

let chrome;
before(async () => { chrome = await launchChrome(); });
after(async () => { await chrome?.close(); });

/**
 * Serves the page (with optional file overrides), opens it, runs `script` in it, and returns what was logged.
 * `outside` (optional) is a second local server standing in for another site; its `hits` show what reached it.
 */
async function runPage(overrides, script, outside) {
  const server = await serve(pageDir, overrides);
  try {
    const page = await chrome.open(`${server.origin}/index.html`);
    const result = await page.evaluate(`(async () => {
      const tick = () => new Promise((r) => setTimeout(r, 80));
      await tick();
      ${script}
    })()`);
    const violations = await page.evaluate('window.__csp');
    await page.close();
    return { result, violations, errors: page.errors, requests: page.requests, origin: server.origin, outsideHits: [...(outside?.hits ?? [])] };
  } finally {
    await server.close();
  }
}

// Home, search, category, reset, every card, district pick, checkbox, day/night flip — the way a user does it.
const USER_FLOW = `
  const app = document.getElementById('app');
  const q = (s) => app.querySelector(s);
  const log = {};
  log.stylesheetRules = document.styleSheets[0].cssRules.length;
  log.homeCards = app.querySelectorAll('[data-situation]').length;
  const input = q('[data-search]');
  input.value = '被騙';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  log.searchCards = app.querySelectorAll('[data-situation]').length;
  q('[data-clear-search]').click();
  log.clearedCards = app.querySelectorAll('[data-situation]').length;
  q('[data-category]:not([aria-pressed="true"])').click();
  log.categoryCards = app.querySelectorAll('[data-situation]').length;
  q('[data-category="all"]').click();
  log.allCards = app.querySelectorAll('[data-situation]').length;
  log.cards = [];
  for (const s of window.SITUATION_DATA.situations) {
    location.hash = '#/' + s.id;
    await tick();
    const card = { id: s.id, title: q('#card-title')?.textContent };
    const pick = q('[data-district]');
    if (pick) { const d = pick.dataset.district; pick.click(); card.picked = !q('[data-district]') && app.textContent.includes(d); }
    const box = q('[data-check]');
    const before = q('[data-tally]').textContent;
    box.click();
    card.tallyChanged = q('[data-tally]').textContent !== before;
    const period = q('[data-flip-period]').textContent;
    q('[data-flip-period]').click();
    card.flipped = q('[data-flip-period]').textContent !== period;
    log.cards.push(card);
  }
  location.hash = '#/';
  await tick();
  log.backHome = app.querySelectorAll('[data-situation]').length;
  log.appFont = getComputedStyle(app).fontFamily;
  return log;`;

test('in Chrome the page works under its CSP with zero violations, errors or outside requests', async () => {
  const data = (await import('../build-data.mjs')).buildData();
  const { result, violations, errors, requests, origin } = await runPage({}, USER_FLOW);
  assert.deepEqual(violations, [], 'CSP violations during normal use');
  assert.deepEqual(errors, [], 'console errors or exceptions');
  assert.deepEqual(requests.filter((u) => !u.startsWith(`${origin}/`)), [], 'requests that leave the page origin');
  assert.ok(result.stylesheetRules > 50, 'styles.css did not load');
  assert.equal(result.homeCards, data.situations.length);
  assert.ok(result.searchCards > 0 && result.searchCards < result.homeCards, `search 被騙 shows ${result.searchCards} cards`);
  assert.equal(result.clearedCards, result.homeCards);
  assert.ok(result.categoryCards > 0 && result.categoryCards < result.homeCards, `category shows ${result.categoryCards} cards`);
  assert.equal(result.allCards, result.homeCards);
  assert.equal(result.cards.length, data.situations.length);
  for (const card of result.cards) {
    assert.ok(card.title, `${card.id} card did not render`);
    assert.ok(card.tallyChanged, `${card.id} checkbox did not update the tally`);
    assert.ok(card.flipped, `${card.id} day/night switch did nothing`);
    if ('picked' in card) assert.ok(card.picked, `${card.id} district pick did nothing`);
  }
  assert.ok(result.cards.some((c) => c.picked), 'no card exercised the district picker');
  assert.equal(result.backHome, data.situations.length);
});

// Review rounds 16 and 17: the attacks that got past the source scans, each put into the real file it targets. The
// "outside site" is a second local server on another port (another origin), so nothing leaves the machine and the
// test can see whether a request reached it.
const PURPLE = 'rgb(102, 51, 153)';
const OUTSIDE_FILES = { '/x.css': '#app { letter-spacing: 7px; }', '/a.png': 'not really a png', '/from-worker': 'ok' };
const ATTACK_NAMES = ['body', 'link', 'url', 'worker'];

/** File overrides that plant the named attacks; `outside` is the outside server's origin. */
function plant(names, outside, base = {}) {
  const files = { ...base };
  const edit = (path, change) => { files[path] = change(files[path] ?? read(path.slice(1))); };
  for (const name of names) {
    if (name === 'body') edit('/index.html', (t) => t.replace('<body>', '<body style="color: rebeccapurple">'));
    if (name === 'link') edit('/app.js', (t) => t.replace('return (situation ? renderCard', `return '<link rel="stylesheet" href="${outside}/x.css">' + (situation ? renderCard`));
    if (name === 'url') edit('/styles.css', (t) => `${t}\n.app { background-image: url("${outside.replace('http', 'ht\\\ntp')}/a.png"); }\n`);
    if (name === 'worker') files['/worker.js'] = `fetch('${outside}/from-worker').catch(() => {}); postMessage('ran');`;
  }
  return files;
}

// Starts a same-origin Worker (a 404 when the worker attack is not planted), then lets every request settle.
const ATTACK_CHECK = `let workerRan = false, workerError = '';
  try {
    const w = new Worker('/worker.js');
    await new Promise((r) => { w.onmessage = () => { workerRan = true; r(); }; w.onerror = () => r(); setTimeout(r, 1000); });
  } catch (e) { workerError = e.name; }
  await new Promise((r) => setTimeout(r, 300));
  const app = document.getElementById('app');
  return { bodyColor: getComputedStyle(document.body).color, appBackground: getComputedStyle(app).backgroundImage,
    appLetterSpacing: getComputedStyle(app).letterSpacing, linked: !!document.querySelector('link[href$="/x.css"]'), workerRan, workerError };`;

/** Whether each attack actually took effect: the style applied, or the request reached the outside server. */
function landed({ result, outsideHits }) {
  return {
    body: result.bodyColor === PURPLE,
    link: outsideHits.includes('/x.css') && result.appLetterSpacing === '7px',
    url: outsideHits.includes('/a.png') && /127\.0\.0\.1/.test(result.appBackground),
    worker: result.workerRan && outsideHits.includes('/from-worker'),
  };
}
const assertAllLanded = (run) => assert.deepEqual(landed(run), Object.fromEntries(ATTACK_NAMES.map((n) => [n, true])),
  `attacks that did not take effect without the CSP: ${JSON.stringify({ result: run.result, outsideHits: run.outsideHits })}`);

/** Runs the page with `names` planted, against a fresh outside server. `edit` can change the served index.html. */
async function runAttacks(names, edit = (html) => html) {
  const outside = await serve(pageDir, OUTSIDE_FILES);
  try {
    const files = plant(names, outside.origin);
    files['/index.html'] = edit(files['/index.html'] ?? read('index.html'));
    return await runPage(files, ATTACK_CHECK, outside);
  } finally {
    await outside.close();
  }
}
const CSP_META = /\s*<meta http-equiv="Content-Security-Policy"[^>]*>/;
const withoutCsp = (html) => { const out = html.replace(CSP_META, ''); assert.notEqual(out, html, 'CSP meta was not removed'); return out; };

test('attack mutations apply to the served files', () => {
  const files = plant(ATTACK_NAMES, 'http://127.0.0.1:9');
  for (const path of ['/index.html', '/app.js', '/styles.css']) assert.notEqual(files[path], read(path.slice(1)), `${path} mutation did not apply`);
  assert.ok(files['/worker.js']);
});

test('in Chrome the CSP blocks a body style, an outside <link>, a backslash-newline url() and a same-origin Worker', async () => {
  const run = await runAttacks(ATTACK_NAMES);
  const { result, violations, outsideHits } = run;
  assert.ok(result.linked, 'app.js did not render the injected <link>');
  assert.match(result.appBackground, /127\.0\.0\.1/, 'Chrome did not read the backslash-newline url as an outside address');
  assert.deepEqual(landed(run), { body: false, link: false, url: false, worker: false });
  assert.deepEqual(outsideHits, [], 'requests reached the outside server');
  const seen = (directive, blocked) => violations.some((v) => v.directive === directive && v.blocked.startsWith(blocked));
  assert.ok(seen('style-src-attr', 'inline'), `no violation for the body style: ${JSON.stringify(violations)}`);
  assert.ok(seen('style-src-elem', 'http://127.0.0.1:'), `no violation for the outside <link>: ${JSON.stringify(violations)}`);
  assert.ok(seen('img-src', 'http://127.0.0.1:'), `no violation for the backslash-newline url: ${JSON.stringify(violations)}`);
  assert.ok(violations.some((v) => v.directive === 'worker-src' && v.blocked.endsWith('/worker.js')), `no violation for the Worker: ${JSON.stringify(violations)}`);
});

test('control: without the CSP meta every attack takes effect and reaches the outside server', async () => {
  const run = await runAttacks(ATTACK_NAMES, withoutCsp);
  assert.deepEqual(run.violations, []);
  assertAllLanded(run);
});

test('mutation: the control fails when any one attack is left out', async () => {
  for (const missing of ATTACK_NAMES) {
    const run = await runAttacks(ATTACK_NAMES.filter((n) => n !== missing), withoutCsp);
    assert.throws(() => assertAllLanded(run), `control still passed without the ${missing} attack`);
    assert.equal(landed(run)[missing], false, `${missing} counted as landed although it was not planted`);
  }
});

test('mutation: without worker-src a same-origin Worker runs (script-src \'self\' would allow it) and reaches the outside server', async () => {
  const run = await runAttacks(['worker'], (html) => { const out = html.replace("; worker-src 'none'", ''); assert.notEqual(out, html); return out; });
  assert.equal(landed(run).worker, true, JSON.stringify(run.result));
});

test('in Chrome default-src \'none\' already blocks frames, media and the web app manifest', async () => {
  const outside = await serve(pageDir, {});
  try {
    const { violations, outsideHits } = await runPage({}, `
      const add = (html) => document.body.insertAdjacentHTML('beforeend', html);
      add('<iframe src="${outside.origin}/frame"></iframe><audio src="${outside.origin}/a.mp3" autoplay></audio><video src="${outside.origin}/v.mp4"></video>');
      document.head.insertAdjacentHTML('beforeend', '<link rel="manifest" href="${outside.origin}/m.json">');
      await new Promise((r) => setTimeout(r, 500));`, outside);
    assert.deepEqual(outsideHits, [], 'requests reached the outside server');
    for (const directive of ['frame-src', 'media-src', 'manifest-src']) {
      assert.ok(violations.some((v) => v.directive === directive), `no ${directive} violation: ${JSON.stringify(violations)}`);
    }
  } finally {
    await outside.close();
  }
});
