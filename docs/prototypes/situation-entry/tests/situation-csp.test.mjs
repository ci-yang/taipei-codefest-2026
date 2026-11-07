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

/** Serves the page (with optional file overrides), opens it, runs `script` in it, and returns what was logged. */
async function runPage(overrides, script) {
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
    return { result, violations, errors: page.errors, requests: page.requests, origin: server.origin };
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

// Review round 16: the three attacks that got past the source scans, each put into the real file it targets.
const PURPLE = 'rgb(102, 51, 153)';
const ATTACKS = {
  '/index.html': read('index.html').replace('<body>', '<body style="color: rebeccapurple">'),
  '/app.js': read('app.js').replace('return (situation ? renderCard', 'return \'<link rel="stylesheet" href="https://evil.test/x.css">\' + (situation ? renderCard'),
  '/styles.css': `${read('styles.css')}\n.app { background-image: url("ht\\\ntps://evil.test/a.png"); }\n`,
};
const ATTACK_CHECK = `return { bodyColor: getComputedStyle(document.body).color, appBackground: getComputedStyle(document.getElementById('app')).backgroundImage,
  linked: !!document.querySelector('link[href^="https://evil.test"]') };`;

test('attack mutations apply to the served files', () => {
  for (const [path, text] of Object.entries(ATTACKS)) assert.notEqual(text, read(path.slice(1)), `${path} mutation did not apply`);
});

test('in Chrome the CSP blocks a body style attribute, a rendered outside <link> and a backslash-newline url()', async () => {
  const { result, violations } = await runPage(ATTACKS, `await new Promise((r) => setTimeout(r, 300)); ${ATTACK_CHECK}`);
  assert.ok(result.linked, 'app.js did not render the injected <link>');
  assert.match(result.appBackground, /evil\.test/, 'Chrome did not read the backslash-newline url as an outside address');
  assert.notEqual(result.bodyColor, PURPLE, 'the inline body style was applied');
  const seen = (directive, blocked) => violations.some((v) => v.directive === directive && v.blocked.startsWith(blocked));
  assert.ok(seen('style-src-attr', 'inline'), `no violation for the body style: ${JSON.stringify(violations)}`);
  assert.ok(seen('style-src-elem', 'https://evil.test/x.css'), `no violation for the outside <link>: ${JSON.stringify(violations)}`);
  assert.ok(seen('img-src', 'https://evil.test/a.png'), `no violation for the backslash-newline url: ${JSON.stringify(violations)}`);
});

test('mutation: without the CSP meta the same attacks get through (so the test above depends on the CSP)', async () => {
  const noCsp = { ...ATTACKS, '/index.html': ATTACKS['/index.html'].replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, '') };
  assert.notEqual(noCsp['/index.html'], ATTACKS['/index.html'], 'CSP meta was not removed');
  const { result, violations } = await runPage(noCsp, ATTACK_CHECK);
  assert.deepEqual(violations, []);
  assert.equal(result.bodyColor, PURPLE);
});
