/* 開口卡（US-2、FR-004）。Run: node --test docs/prototypes/tests/friendly-speak-card.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const base = path.resolve(__dirname, '../friendly-route');
const STRINGS = require('../friendly-route/speak-card-strings.js');
const card = require('../friendly-route/speak-card.js');
const CATEGORIES = ['toilet', 'charge', 'wifi'];
const LANGS = ['zh-TW', 'en', 'id', 'vi', 'ja', 'ko'];
const MACHINE = LANGS.filter(lang => lang !== 'zh-TW');

test('strings：3 類 × 6 語 × 2 句，無空字串', () => {
  assert.deepEqual(Object.keys(STRINGS.categories).sort(), [...CATEGORIES].sort());
  assert.deepEqual(Object.keys(STRINGS.langs).sort(), [...LANGS].sort());
  for (const category of CATEGORIES) {
    const phrases = STRINGS.categories[category].phrases;
    assert.deepEqual(Object.keys(phrases).sort(), [...LANGS].sort(), category);
    for (const lang of LANGS) {
      for (const key of ['ask', 'thanks']) {
        const value = phrases[lang][key];
        assert.equal(typeof value, 'string', `${category}.${lang}.${key}`);
        assert.ok(value.trim().length > 0, `${category}.${lang}.${key} 不可空白`);
      }
    }
  }
});

test('strings：只有 zh-TW 標 reviewed，且沒有編造校對人', () => {
  for (const lang of LANGS) {
    const meta = STRINGS.langs[lang];
    assert.equal(meta.reviewed, lang === 'zh-TW', lang);
    for (const key of ['reviewedBy', 'reviewedOn']) assert.ok(key in meta, `${lang} 缺 ${key}`);
    if (!meta.reviewed) { assert.equal(meta.reviewedBy, null); assert.equal(meta.reviewedOn, null); }
  }
  assert.match(fs.readFileSync(path.join(base, 'speak-card-strings.js'), 'utf8'), /機器翻譯初稿，未經母語者校對/);
});

test('strings：店員句短、帶敬語，三類各不相同', () => {
  const asks = CATEGORIES.map(c => STRINGS.categories[c].phrases['zh-TW'].ask);
  assert.equal(new Set(asks).size, 3);
  for (const ask of asks) {
    assert.match(ask, /^您好/);
    assert.match(ask, /謝謝$/);
    assert.ok([...ask].length <= 24, `店員句過長：${ask}`);
  }
  assert.equal(STRINGS.categories.toilet.phrases['zh-TW'].ask, '您好，我想借用廁所，請問方便嗎？謝謝');
  assert.equal(Object.isFrozen(STRINGS.categories.toilet.phrases.en), true);
});

test('getAvailableLangs：預設只回 reviewed，includeUnreviewed 回六語', () => {
  assert.deepEqual(card.getAvailableLangs().map(l => l.code), ['zh-TW']);
  assert.deepEqual(card.getAvailableLangs({}).map(l => l.code), ['zh-TW']);
  const all = card.getAvailableLangs({ includeUnreviewed: true });
  assert.deepEqual(all.map(l => l.code).sort(), [...LANGS].sort());
  assert.deepEqual(all.filter(l => !l.reviewed).map(l => l.code).sort(), [...MACHINE].sort());
});

test('planSpeakCard：zh-TW 單面，其他語言雙面且句子一一對應', () => {
  for (const category of CATEGORIES) {
    const single = card.planSpeakCard({ category, lang: 'zh-TW' });
    assert.equal(single.layout, 'single');
    assert.equal(single.user, null);
    assert.equal(single.staff.ask, STRINGS.categories[category].phrases['zh-TW'].ask);
    assert.equal(single.staff.thanks, STRINGS.categories[category].phrases['zh-TW'].thanks);
    for (const lang of MACHINE) {
      const plan = card.planSpeakCard({ category, lang, includeUnreviewed: true });
      assert.equal(plan.layout, 'double');
      assert.equal(plan.staff.lang, 'zh-TW');
      assert.equal(plan.user.lang, lang);
      assert.equal(plan.user.ask, STRINGS.categories[category].phrases[lang].ask);
      assert.equal(plan.user.thanks, STRINGS.categories[category].phrases[lang].thanks);
    }
  }
});

test('planSpeakCard：未上架語言退回中文單面，未知類別拋錯', () => {
  const plan = card.planSpeakCard({ category: 'toilet', lang: 'vi' });
  assert.equal(plan.layout, 'single');
  assert.equal(plan.fellBack, true);
  assert.equal(card.planSpeakCard({ category: 'wifi' }).layout, 'single');
  assert.throws(() => card.planSpeakCard({ category: 'shower' }), /未知類別/);
});

// 極簡假 DOM：只模擬 createElement／append／remove／focus／keydown，不模擬版面。
function makeDom() {
  const docListeners = {};
  class Node {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attributes = {};
      this.dataset = {}; this.listeners = {}; this._text = ''; this.className = '';
      const classes = new Set();
      this.classList = { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) };
    }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    get isConnected() { return this === document.body || this === document.documentElement || Boolean(this.parentNode?.isConnected); }
    set innerHTML(_) { throw new Error('開口卡不應使用 innerHTML'); }
    append(...nodes) { for (const n of nodes) { n.parentNode = this; this.children.push(n); } }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k]; }
    addEventListener(n, cb) { (this.listeners[n] ||= []).push(cb); }
    click() { (this.listeners.click || []).forEach(cb => cb({ target: this })); }
    focus() { document.activeElement = this; }
    all() { return this.children.flatMap(c => [c, ...c.all()]); }
    byClass(name) { return this.all().filter(n => n.className.split(' ').includes(name)); }
  }
  const document = {
    createElement: tag => new Node(tag),
    createTextNode: text => { const n = new Node('#text'); n.textContent = text; return n; },
    addEventListener: (n, cb) => { (docListeners[n] ||= []).push(cb); },
    removeEventListener: (n, cb) => { docListeners[n] = (docListeners[n] || []).filter(x => x !== cb); },
    keydown(key) { const ev = { key, prevented: false, preventDefault() { this.prevented = true; } }; (docListeners.keydown || []).slice().forEach(cb => cb(ev)); return ev; },
    listenerCount: n => (docListeners[n] || []).length,
    activeElement: null,
  };
  document.documentElement = new Node('html');
  document.body = new Node('body');
  document.documentElement.append(document.body);
  return document;
}

function loadInBrowserContext() {
  const document = makeDom();
  const window = { document };
  const net = () => { throw new Error('開口卡不應發網路請求'); };
  const ctx = vm.createContext({ window, document, fetch: net, XMLHttpRequest: net, navigator: { sendBeacon: net },
    localStorage: { setItem: () => { throw new Error('開口卡不應寫 localStorage'); } } });
  for (const file of ['speak-card-strings.js', 'speak-card.js']) vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), ctx, { filename: file });
  return { document, api: window.FriendlySpeakCard };
}

test('openSpeakCard（瀏覽器載入方式）：雙面 DOM、dialog 語意、Esc 關閉並呼叫 onClose', () => {
  const { document, api } = loadInBrowserContext();
  const opener = document.createElement('button');
  document.body.append(opener); opener.focus();
  let closed = 0;
  api.openSpeakCard({ category: 'charge', lang: 'id', includeUnreviewed: true, onClose: () => { closed += 1; } });
  const overlay = document.body.byClass('speak-card')[0];
  assert.ok(overlay);
  assert.equal(overlay.getAttribute('role'), 'dialog');
  assert.equal(overlay.getAttribute('aria-modal'), 'true');
  assert.equal(overlay.dataset.layout, 'double');
  assert.equal(overlay.byClass('speak-card-staff').length, 1);
  assert.equal(overlay.byClass('speak-card-user').length, 1);
  assert.equal(overlay.byClass('speak-card-unreviewed').length, 1);
  assert.match(overlay.byClass('speak-card-staff')[0].textContent, /請給店員看/);
  assert.equal(overlay.byClass('speak-card-thanks').length, 2);
  assert.ok(document.documentElement.classList.contains('speak-card-open'));
  assert.equal(document.activeElement, overlay.byClass('speak-card-close')[0]);

  assert.equal(document.keydown('Tab').prevented, true);
  assert.equal(document.keydown('Escape').prevented, true);
  assert.equal(document.body.byClass('speak-card').length, 0);
  assert.equal(closed, 1);
  assert.equal(document.activeElement, opener);
  assert.equal(document.listenerCount('keydown'), 0);
  assert.equal(document.documentElement.classList.contains('speak-card-open'), false);
  assert.equal(api.closeSpeakCard(), false);
});

test('openSpeakCard：zh-TW 只渲染單面，關閉鈕可關、重開不疊兩層', () => {
  const { document, api } = loadInBrowserContext();
  api.openSpeakCard({ category: 'toilet', lang: 'zh-TW' });
  api.openSpeakCard({ category: 'wifi', lang: 'en' }); // en 未上架 → 退回單面
  const overlays = document.body.byClass('speak-card');
  assert.equal(overlays.length, 1);
  assert.equal(overlays[0].dataset.layout, 'single');
  assert.equal(overlays[0].byClass('speak-card-user').length, 0);
  assert.equal(overlays[0].byClass('speak-card-staff')[0].getAttribute('lang'), 'zh-Hant-TW');
  overlays[0].byClass('speak-card-close')[0].click();
  assert.equal(document.body.byClass('speak-card').length, 0);
});

test('新檔沒有網路請求或儲存 API', () => {
  for (const file of ['speak-card-strings.js', 'speak-card.js', 'speak-card-demo.html']) {
    const source = fs.readFileSync(path.join(base, file), 'utf8');
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|indexedDB/, file);
  }
});
