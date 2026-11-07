// Every colour and type value lives in styles.css, where css-audit checks it. Inline styles would bypass that
// check, so the page has none: not in index.html, not in anything app.js renders, not set from script.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
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

/*
 * Script that writes styles, found on the syntax tree (TypeScript's parser, already a repo devDependency) so spacing,
 * line breaks, bracket access and case cannot hide it. Fails closed: setAttribute is fine only when called directly
 * with a literal attribute name other than style; passing it around (Reflect.apply, .call, a variable) is a hit.
 */
const STYLE_MEMBERS = new Set(['style', 'cssText', 'setProperty', 'insertRule', 'adoptedStyleSheets', 'styleSheets',
  'attributeStyleMap', 'CSSStyleSheet']);
const SET_ATTR = /^(setAttribute|setAttributeNS|setAttributeNode|setAttributeNodeNS|toggleAttribute)$/;
const STYLE_WORD = /^(style|csstext|setattribute(ns)?)$/i;
const STYLE_MARKUP = /<style[\s>/]|\sstyle\s*=/i;

function literalText(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}

function styleWrites(source, file = 'app.js') {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const hits = [];
  const hit = (node, why) => hits.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} ${why}`);
  const memberName = (node) => {
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    if (ts.isElementAccessExpression(node)) return literalText(node.argumentExpression);
    return null;
  };
  const visit = (node) => {
    const name = memberName(node) ?? (ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node.parent) ? node.text : null);
    if (name && STYLE_MEMBERS.has(name)) hit(node, `uses ${name}`);
    if (name && SET_ATTR.test(name) && node.kind !== ts.SyntaxKind.Identifier) {
      const call = node.parent;
      const direct = ts.isCallExpression(call) && call.expression === node;
      const attr = direct ? literalText(call.arguments[/NS$/.test(name) ? 1 : 0]) : null;
      if (attr === null || /^style$/i.test(attr.trim())) hit(node, `${name} that may set style`);
    }
    const text = literalText(node) ?? (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ? node.text : null);
    if (text !== null && (STYLE_WORD.test(text.trim()) || STYLE_MARKUP.test(text))) hit(node, `string ${JSON.stringify(text.slice(0, 40))}`);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

/*
 * Runs app.js for real against a fake page: boots it, draws home and every card, flips day/night and searches.
 * Every element is a proxy that logs reading .style or setting a style attribute, and every innerHTML is scanned.
 */
function runtimeStyleWrites(appSource = read('app.js')) {
  const log = [];
  const listeners = {};
  const on = (key) => (type, fn) => { (listeners[`${key}:${type}`] ||= []).push(fn); };
  const element = (key) => {
    const raw = {
      innerHTML: '', textContent: '', hidden: false, value: '', dataset: {}, open: false,
      addEventListener: on(key), querySelector: () => element('child'), focus() {}, blur() {}, scrollIntoView() {},
      classList: { add() {}, remove() {} }, style: { cssText: '', setProperty() {} }, matches: () => true, closest: () => null,
      setAttribute(name) { if (/^\s*style\s*$/i.test(String(name))) log.push(`setAttribute(${name})`); },
      setAttributeNS(_, name) { if (/^\s*style\s*$/i.test(String(name))) log.push(`setAttributeNS(${name})`); },
    };
    return new Proxy(raw, {
      get(target, prop) {
        if (prop === 'style' || prop === 'attributeStyleMap') log.push(`${key}.${prop}`);
        return target[prop];
      },
      set(target, prop, value) {
        if (prop === 'style') log.push(`${key}.style =`);
        if (prop === 'innerHTML' || prop === 'outerHTML') log.push(...inlineStyles(String(value)));
        target[prop] = value;
        return true;
      },
    });
  };
  const app = element('app');
  const doc = new Proxy({
    visibilityState: 'visible', title: '', styleSheets: [{ insertRule: () => log.push('insertRule') }], body: element('body'), documentElement: element('html'),
    getElementById: (id) => (id === 'app' ? app : element(id)), querySelector: () => element('q'),
    createElement: (tag) => { if (/^style$/i.test(tag)) log.push('createElement(style)'); return element(tag); },
    addEventListener: on('doc'),
  }, { get(target, prop) { if (prop === 'styleSheets' || prop === 'adoptedStyleSheets') log.push(`document.${prop}`); return target[prop]; } });
  const win = { document: doc, location: { search: '', hash: '' }, addEventListener: on('win'), scrollTo() {} };
  win.window = win;
  const context = { window: win, URLSearchParams };
  vm.runInNewContext(read('core.js'), context);
  vm.runInNewContext(appSource, context);
  win.SITUATION_DATA = data;
  win.SituationBridge = { available: () => false, call: async () => 'unsupported' };
  const fire = (key, event = {}) => (listeners[key] || []).forEach((fn) => fn(event));
  fire('doc:DOMContentLoaded');
  const target = (hits) => ({ closest: (sel) => (hits.some((h) => sel.includes(h)) ? element('btn') : null), matches: () => true, value: '被騙', dataset: {} });
  for (const hash of ['', ...data.situations.map((x) => `#/${x.id}`)]) {
    win.location.hash = hash;
    fire('win:hashchange');
    fire('app:click', { target: target(['data-flip-period']) });
    fire('app:click', { target: target(['data-district']) });
  }
  win.location.hash = '';
  fire('win:hashchange');
  fire('app:input', { target: target([]) });
  fire('app:click', { target: target(['data-reset-filter']) });
  return { log, drawn: app.innerHTML.length };
}

test('no page script writes styles directly (syntax-tree scan of app.js, core.js, bridge.js)', () => {
  for (const file of SCRIPTS) assert.deepEqual(styleWrites(read(file), file), [], `${file} writes a style`);
});

test('running app.js (boot, home, every card, day/night flip, district, search) puts no style on the page', () => {
  const { log, drawn } = runtimeStyleWrites();
  assert.ok(drawn > 1000, 'the fake page drew nothing; the runtime check is not exercising app.js');
  assert.deepEqual(log, []);
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
  assert.notDeepEqual(styleWrites(source), [], 'source scan missed the style attribute');
});

// Review rounds 14–15: each line, put into app.js where it runs on boot, must fail both the source scan and the run.
const BOOT = "const app = root.document.getElementById('app');";
for (const line of [
  'app.setAttribute ("style", "color: rebeccapurple; font-weight:900");',
  "app['setAttribute']('style', 'color: red');",
  'app.style.cssText = "color: red";',
  "app.setAttribute('STYLE', 'color: red');",
  "app\n  .setAttribute(\n    'style',\n    'color: red');",
  "app[`setAttribute`](`Style`, 'color: red');",
  "Reflect.apply(app.setAttribute, app, ['style', 'color: red']);",
  "app.setAttribute.call(app, 'style', 'color: red');",
  "app.style.color = 'rebeccapurple';",
  "app.style.setProperty('font-weight', '900');",
  "root.document.body['style'].cssText = 'color: red';",
  "root.document.styleSheets[0] && root.document.styleSheets[0].insertRule('.dial { color: red }');",
  "app.innerHTML = '<style>.dial { color: red }</style>';",
]) {
  test(`mutation: app.js running ${JSON.stringify(line)} is caught`, () => {
    const source = read('app.js').replace(BOOT, `${BOOT}\n      ${line}`);
    assert.notEqual(source, read('app.js'), 'mutation did not apply');
    assert.notDeepEqual(styleWrites(source), [], 'source scan missed it');
    assert.notDeepEqual(runtimeStyleWrites(source).log, [], 'runtime check missed it');
  });
}

test('the source scan still allows a non-style attribute set directly', () => {
  assert.deepEqual(styleWrites("el.setAttribute('aria-hidden', 'true');"), []);
});
