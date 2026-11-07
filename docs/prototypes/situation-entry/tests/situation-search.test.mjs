import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildData } from '../build-data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pageDir = join(here, '..');
const data = buildData();

function loadApp() {
  const context = { window: {} };
  context.window.window = context.window;
  for (const file of ['core.js', 'app.js']) vm.runInNewContext(readFileSync(join(pageDir, file), 'utf8'), context);
  return context.window.SituationApp;
}

const app = loadApp();
const day = { id: null, period: 'day', district: '' };
const shownIds = (filter) => Array.from(app.filteredGroups(data, filter), (g) => Array.from(g.situations, (s) => s.id)).flat();
const search = (query, category = 'all') => shownIds({ query, category });
const plain = (html) => html.replace(/<[^>]+>/g, '');

test('every situation has its own non-empty keywords list', () => {
  for (const situation of data.situations) {
    assert.ok(Array.isArray(situation.keywords) && situation.keywords.length >= 5, `${situation.id} has too few keywords`);
    for (const word of situation.keywords) assert.ok(typeof word === 'string' && word.trim() === word && word, `${situation.id} has a bad keyword`);
  }
});

const EVERYDAY = [
  ['被騙', 'fraud'], ['轉帳', 'fraud'],
  ['走丟', 'missing'], ['失智', 'missing'],
  ['押金', 'rental'], ['房東', 'rental'],
  ['餓', 'food'], ['沒錢吃飯', 'food'],
  ['薪水', 'labor'], ['資遣', 'labor'],
  ['健保', 'nhi'],
  ['出院', 'discharge'], ['長照', 'discharge'],
];

for (const [query, id] of EVERYDAY) {
  test(`search: 「${query}」 finds the ${id} card`, () => {
    assert.ok(search(query).includes(id), `「${query}」 -> ${search(query).join(',') || 'nothing'}`);
  });
}

test('search: 「沒錢」 finds both money cards; several words must all match', () => {
  assert.deepEqual(search('沒錢'), ['food', 'emergency']);
  assert.deepEqual(search('沒錢  吃飯'), ['food']);
});

test('search: 臺 and 台, upper and lower case, and outer spaces do not matter', () => {
  assert.deepEqual(search('  atm '), ['fraud']);
  assert.deepEqual(search('臺北市'), search('台北市'));
});

test('search: an empty query shows every card, grouped as before', () => {
  assert.deepEqual(search(''), data.situations.map((s) => s.id));
  assert.equal(app.filteredGroups(data, { query: '', category: 'all' }).length, data.categories.length);
});

test('category: picking one shows only that category', () => {
  assert.deepEqual(search('', 'safety'), ['missing', 'fraud']);
  const html = app.renderResults(data, day, { query: '', category: 'safety' });
  assert.equal([...html.matchAll(/<h2 class="group-title"/g)].length, 1);
  assert.ok(html.includes('>人身安全</h2>'));
});

test('category and search combine (intersection)', () => {
  assert.deepEqual(search('報案', 'all'), ['missing', 'fraud']);
  assert.deepEqual(search('報案', 'safety'), ['missing', 'fraud']);
  assert.deepEqual(search('沒錢', 'money'), ['food', 'emergency']);
  assert.deepEqual(search('被騙', 'money'), []);
  assert.deepEqual(search('失智', 'safety'), ['missing']);
});

test('home: search box, 「全部」 plus every category as chips, all rendered without sideways scroll markup', () => {
  const html = app.renderHome(data, day);
  assert.match(html, /<input type="search" data-search /);
  const chips = [...html.matchAll(/data-category="([a-z]+)" aria-pressed="(true|false)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(chips.map((c) => c[0]), ['all', ...data.categories.map((c) => c.id)]);
  assert.deepEqual(chips.filter((c) => c[1] === 'true').map((c) => c[0]), ['all']);
  assert.ok(html.indexOf('data-search') < html.indexOf('data-category'), 'search box sits above the chips');
  assert.ok(html.indexOf('<h1>') < html.indexOf('data-search'), 'search box sits under the title');
});

test('home: the picked chip is pressed and chip counts follow the query', () => {
  const html = app.renderHome(data, day, { query: '報案', category: 'safety' });
  assert.match(html, /data-category="safety" aria-pressed="true">人身安全<span class="cat-count">2<\/span>/);
  assert.match(html, /data-category="money" aria-pressed="false">錢和吃住<span class="cat-count">0<\/span>/);
});

test('no match: offers 1999 as the next step and points to the emergency strip, with no guarantee', () => {
  const html = app.renderResults(data, day, { query: '外星人', category: 'all' });
  const text = plain(html);
  assert.ok(!html.includes('data-situation='), 'no cards should show');
  assert.ok(text.includes('不確定找誰，先打 1999 市民熱線'));
  assert.match(html, /<a class="dial" href="tel:1999" data-dial="1999">/);
  assert.ok(text.includes('110、119、113、1925'));
  assert.ok(html.includes(data.sources['rdec-1999'].url.replace(/&/g, '&amp;')), '1999 claim cites its source');
  for (const word of ['保證', '一定', '必定', '馬上解決', '立即處理']) assert.ok(!text.includes(word), `no-match copy says ${word}`);
  assert.ok(!text.includes('查無結果'));
});

test('no match inside a category offers to search every category instead', () => {
  const html = app.renderResults(data, day, { query: '被騙', category: 'money' });
  assert.ok(plain(html).includes('不確定找誰，先打 1999 市民熱線'));
  assert.match(html, /data-category="all">改在全部分類找（1 張符合）</);
});

test('the query is escaped wherever it is echoed back', () => {
  const html = app.renderHome(data, day, { query: '<img src=x onerror=1>"', category: 'all' });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x onerror=1&gt;'));
});

test('privacy: the query is never stored, put in the URL or sent', () => {
  const code = readFileSync(join(pageDir, 'app.js'), 'utf8');
  for (const api of ['localStorage', 'sessionStorage', 'indexedDB', 'cookie', 'fetch(', 'XMLHttpRequest', 'sendBeacon',
    'pushState', 'replaceState', 'location.hash =', 'location.search', 'location.href =', 'URLSearchParams']) {
    assert.ok(!code.includes(api), `app.js uses ${api}`);
  }
  const html = app.renderHome(data, day, { query: '被騙', category: 'all' });
  assert.ok(!/<form/.test(html), 'a form could submit the query as a URL');
  assert.ok(!/<input[^>]*\sname=/.test(html), 'a named input could end up in a URL');
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) assert.ok(!href.includes('被騙') && !href.includes(encodeURIComponent('被騙')), `link carries the query: ${href}`);
});

const visibleText = (html) => plain(html.replace(/<p class="sr-only"[^>]*>.*?<\/p>/g, ''));
const srOnly = (html) => [...html.matchAll(/<p class="sr-only"[^>]*>(.*?)<\/p>/g)].map((m) => m[1]).join('');

test('result count: no count sentence on screen, only in the sr-only live region', () => {
  for (const filter of [{ query: '被騙', category: 'all' }, { query: '', category: 'safety' }, { query: '外星人', category: 'all' }]) {
    const html = app.renderHome(data, day, filter);
    assert.ok(!/張卡/.test(visibleText(html)), `count sentence visible for ${JSON.stringify(filter)}`);
    assert.ok(srOnly(html).length > 0, `no screen-reader count for ${JSON.stringify(filter)}`);
  }
  assert.match(srOnly(app.renderHome(data, day, { query: '被騙', category: 'all' })), /1 張卡符合「被騙」/);
  assert.match(srOnly(app.renderHome(data, day, { query: '', category: 'safety' })), /「人身安全」裡有 2 張卡/);
});

test('result count: aria-live and role=status only appear on sr-only elements', () => {
  const html = app.renderHome(data, day, { query: '被騙', category: 'all' });
  const live = [...html.matchAll(/<[^>]*(?:aria-live|role="status")[^>]*>/g)].map((m) => m[0]);
  assert.ok(live.length > 0);
  for (const tag of live) assert.match(tag, /class="sr-only"/, tag);
});

test('result count: on the whole page, with index.html as the shell, only sr-only elements carry aria-live', () => {
  const shell = readFileSync(join(pageDir, 'index.html'), 'utf8');
  const rendered = app.renderHome(data, day, { query: '被騙', category: 'all' });
  const page = shell.replace('<main id="app" class="app"></main>', `<main id="app" class="app">${rendered}</main>`);
  assert.notEqual(page, shell, 'index.html shell no longer matches <main id="app" class="app"></main>');
  const live = [...page.matchAll(/<[^>]*\baria-live\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(live.length > 0);
  for (const tag of live) assert.match(tag, /class="sr-only"/, tag);
});

test('result count: the chips keep their numbers', () => {
  const html = app.renderHome(data, day, { query: '', category: 'safety' });
  assert.match(html, /data-category="safety"[^>]*>人身安全<span class="cat-count">2<\/span>/);
});

test('keys: Enter and Esc do nothing while an IME is composing', () => {
  for (const key of ['Enter', 'Escape']) {
    assert.equal(app.searchKeyAction({ key, isComposing: true, keyCode: 13 }, '被'), null, `${key} with isComposing`);
    assert.equal(app.searchKeyAction({ key, isComposing: false, keyCode: 229 }, '被'), null, `${key} with keyCode 229`);
  }
});

test('keys: outside composition Enter closes the keyboard and Esc clears a query', () => {
  assert.equal(app.searchKeyAction({ key: 'Enter', isComposing: false, keyCode: 13 }, '被騙'), 'close');
  assert.equal(app.searchKeyAction({ key: 'Escape', isComposing: false, keyCode: 27 }, '被騙'), 'clear');
  assert.equal(app.searchKeyAction({ key: 'Escape', isComposing: false, keyCode: 27 }, ''), null);
});

test('search: 「房租 繳不起」 and 「付不出」 find the emergency card', () => {
  assert.ok(search('房租 繳不起').includes('emergency'));
  assert.ok(search('付不出').includes('emergency'));
  assert.ok(search('付不起').includes('emergency'));
});
