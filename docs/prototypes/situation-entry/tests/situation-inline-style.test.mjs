// Every colour and type value lives in styles.css, where css-audit checks it. Inline styles would bypass that
// check, so the page has none: not in index.html, not in anything app.js renders, not set from script.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { buildData } from '../build-data.mjs';
import { pageDir } from './css-tokens.mjs';

const data = buildData();
const read = (file) => readFileSync(join(pageDir, file), 'utf8');
const SCRIPTS = ['app.js', 'core.js', 'bridge.js'];

function loadApp(appSource = read('app.js')) {
  const context = { window: {} };
  context.window.window = context.window;
  vm.runInNewContext(read('core.js'), context);
  vm.runInNewContext(appSource, context);
  return context.window.SituationApp;
}

/** Home (each filter state) and every card, day and night, with and without a district picked. */
function renderedPages(app) {
  const out = [];
  for (const period of ['day', 'night']) {
    for (const filter of [{ query: '', category: 'all' }, { query: '被騙', category: 'all' }, { query: '外星人', category: 'all' },
      { query: '', category: data.categories[0].id }]) {
      out.push([`home ${period} ${filter.query || filter.category}`, app.render(data, { id: null, period, district: '' }, new Set(), filter)]);
    }
    for (const s of data.situations) {
      for (const district of ['', '中正區']) {
        out.push([`${s.id} ${period} ${district || 'no district'}`, app.render(data, { id: s.id, period, district }, new Set([`${s.id}:0`]))]);
      }
    }
  }
  return out;
}

/** Inline style in markup: a style attribute on any element, or a <style> element. */
function inlineStyles(html) {
  return [...html.matchAll(/<[a-z][^>]*?\sstyle\s*=|<style[\s>]/gi)].map((m) => m[0]);
}

// Script that writes styles directly: el.style…, setProperty, cssText, setAttribute('style'), stylesheet APIs.
const STYLE_WRITE = /\.style\b|\bsetProperty\s*\(|\bcssText\b|setAttribute\(\s*['"`]style|\binsertRule\b|\badoptedStyleSheets\b|\bCSSStyleSheet\b|\sstyle\s*=|<style/;

test('index.html has no style attribute and no <style> element', () => {
  assert.deepEqual(inlineStyles(read('index.html')), []);
});

test('nothing app.js renders carries an inline style (home, search, no match, category, every card day and night)', () => {
  const pages = renderedPages(loadApp());
  assert.ok(pages.length >= 40, 'too few pages rendered');
  for (const [name, html] of pages) assert.deepEqual(inlineStyles(html), [], `${name} has an inline style`);
});

test('no page script writes styles directly', () => {
  for (const file of SCRIPTS) {
    const hit = read(file).split('\n').findIndex((line) => STYLE_WRITE.test(line));
    assert.equal(hit, -1, `${file}:${hit + 1} writes a style`);
  }
});

// Review round 14: each injection must make the checks above fail.
const INJECTED = 'style="color: rebeccapurple !important; font-weight: 900"';

test('mutation: a style attribute on <body> in index.html is caught', () => {
  const html = read('index.html').replace('<body>', `<body ${INJECTED}>`);
  assert.notDeepEqual(inlineStyles(html), []);
});

test('mutation: a style attribute app.js puts on every home mini-band is caught', () => {
  const source = read('app.js').replace('<span class="mini-band">', `<span class="mini-band" ${INJECTED.replace(/"/g, '\\"')}>`);
  assert.notEqual(source, read('app.js'), 'mutation did not apply');
  const home = renderedPages(loadApp(source)).find(([name]) => name.startsWith('home day'))[1];
  assert.notDeepEqual(inlineStyles(home), []);
  assert.ok(STYLE_WRITE.test(source), 'source scan missed the style attribute');
});

for (const line of [
  "app.style.color = 'rebeccapurple';",
  "app.style.setProperty('font-weight', '900');",
  "root.document.body.style.cssText = 'color: red';",
  "app.setAttribute('style', 'font-weight: 900');",
  'root.document.styleSheets[0].insertRule(".dial { color: red }");',
  "const tag = '<style>.dial { color: red }</style>';",
]) {
  test(`mutation: the source scan catches ${line}`, () => {
    assert.ok(STYLE_WRITE.test(line));
  });
}
