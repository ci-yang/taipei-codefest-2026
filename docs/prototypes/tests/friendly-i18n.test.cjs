/* 介面語言查表（D17）。Run: node --test docs/prototypes/tests/friendly-i18n.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const file = path.resolve(__dirname, '../friendly-route/i18n.js');
const source = fs.readFileSync(file, 'utf8');
const { STRINGS, LANGS } = require(file);
const BASE = 'zh-TW';

// 以瀏覽器載入方式跑一份獨立的 i18n.js：可注入 localStorage、navigator.language，或改寫原始碼。
function load({ code = source, stored = null, language = '', storageThrows = false } = {}) {
  const writes = [];
  const documentElement = { lang: '' };
  const localStorage = storageThrows
    ? { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }
    : { getItem: key => (key === 'friendly.uiLang' ? stored : null), setItem: (key, value) => writes.push([key, value]) };
  const window = { localStorage, navigator: { language }, document: { documentElement } };
  vm.runInContext(code, vm.createContext({ window }), { filename: 'i18n.js' });
  return { api: window.FriendlyI18n, writes, documentElement };
}

test('四個語言的字典 key 集合相等：en／ja／ko 沒有缺 key，也沒有 zh-TW 以外的 key', () => {
  assert.deepEqual(LANGS.map(lang => lang.code), [BASE, 'en', 'ja', 'ko']);
  const base = Object.keys(STRINGS[BASE]);
  assert.ok(base.length > 200, `zh-TW 基準只有 ${base.length} 個 key`);
  for (const lang of ['en', 'ja', 'ko']) {
    const keys = Object.keys(STRINGS[lang]);
    const missing = base.filter(key => !keys.includes(key));
    const extra = keys.filter(key => !base.includes(key));
    assert.equal(missing.length, 0, `${lang} 缺 ${missing.length} 個 key：${missing.join(', ')}`);
    assert.equal(extra.length, 0, `${lang} 多出 ${extra.length} 個 key：${extra.join(', ')}`);
  }
});

test('字典 key 只用小寫英數與點，值都是非空字串，各語言的置換參數與 zh-TW 一致', () => {
  const params = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [lang, table] of Object.entries(STRINGS)) {
    for (const [key, value] of Object.entries(table)) {
      assert.match(key, /^[a-z0-9.]+$/, `${lang} ${key}`);
      assert.equal(typeof value, 'string', `${lang} ${key}`);
      assert.ok(value.trim().length > 0, `${lang} ${key} 不可空白`);
      assert.deepEqual(params(value), params(STRINGS[BASE][key]), `${lang} ${key} 的 {參數} 與 zh-TW 不同`);
    }
  }
});

test('英日韓檔頭與字典前都註明機器翻譯初稿，專有名詞不翻', () => {
  assert.equal(source.match(/\/\/ 機器翻譯初稿，未經母語者校對（2026-11-08）/g).length, 6);
  for (const lang of ['en', 'ja', 'ko']) {
    assert.match(STRINGS[lang]['service.wifi'], /^Wi-Fi$/, lang);
    assert.match(STRINGS[lang]['settings.osm'], /^OpenStreetMap contributors/, lang);
  }
  assert.match(STRINGS.ja['ext.unsupported'], /台北通/);
  assert.match(STRINGS.en['ext.unsupported'], /TownPass/);
});

test('t()：語言缺 key 時退回 zh-TW，不是空字串也不是 key 名；兩邊都沒有才回 key', () => {
  const zh = STRINGS[BASE]['home.title'];
  const enLine = source.match(/\n {6}'home\.title': 'What do you need most\?',/);
  assert.ok(enLine, '找不到 en 的 home.title 行');
  const { api } = load({ code: source.replace(enLine[0], '') });
  api.setLang('en');
  assert.equal(api.getLang(), 'en');
  assert.equal(api.t('home.title'), zh);
  assert.equal(api.t('home.eyebrow'), STRINGS.en['home.eyebrow']);
  assert.equal(api.t('no.such.key'), 'no.such.key');
});

test('navigator.language 對應：zh*→zh-TW、ja*→ja、ko*→ko、en*→en、其他→zh-TW', () => {
  const { api } = load();
  const cases = { 'zh-TW': 'zh-TW', 'zh-Hant-TW': 'zh-TW', 'zh-CN': 'zh-TW', zh: 'zh-TW', 'ja-JP': 'ja', ja: 'ja', 'ko-KR': 'ko', 'en-US': 'en', 'en-GB': 'en', EN: 'en', 'fr-FR': 'zh-TW', 'vi-VN': 'zh-TW', '': 'zh-TW' };
  for (const [tag, expected] of Object.entries(cases)) assert.equal(api.detectLang(tag), expected, tag);
  assert.equal(api.detectLang(undefined), 'zh-TW');
  assert.equal(load({ language: 'ja-JP' }).api.getLang(), 'ja');
  assert.equal(load({ language: 'fr-FR' }).api.getLang(), 'zh-TW');
});

test('存過的 friendly.uiLang 優先於 navigator.language；無效值或讀取失敗改用 navigator', () => {
  assert.equal(load({ stored: 'ko', language: 'en-US' }).api.getLang(), 'ko');
  assert.equal(load({ stored: 'vi', language: 'en-US' }).api.getLang(), 'en');
  assert.equal(load({ storageThrows: true, language: 'ja' }).api.getLang(), 'ja');
});

test('setLang：寫入 friendly.uiLang、更新 <html lang>；未知語言不切換；載入時不寫儲存', () => {
  const { api, writes, documentElement } = load({ language: 'zh-TW' });
  assert.equal(documentElement.lang, 'zh-Hant-TW');
  assert.equal(writes.length, 0);
  assert.equal(api.setLang('ja'), 'ja');
  assert.equal(documentElement.lang, 'ja');
  assert.deepEqual(writes, [['friendly.uiLang', 'ja']]);
  assert.equal(api.setLang('fr'), 'ja');
  assert.deepEqual(writes, [['friendly.uiLang', 'ja']]);
  const broken = load({ storageThrows: true });
  assert.equal(broken.api.setLang('ko'), 'ko');
  assert.equal(broken.documentElement.lang, 'ko');
});

test('t() 置換 {n} 等參數：數字與單位跟著語言，未提供的參數保留原樣', () => {
  const { api } = load();
  assert.equal(api.t('unit.m', { n: 120 }), '120 公尺');
  assert.equal(api.t('panel.all', { n: 7 }), '全部 7 筆');
  assert.equal(api.t('result.rank', { i: 2, total: 3 }), '直線第 2 近 · 共 3 筆候選');
  assert.equal(api.t('unit.m', {}), '{n} 公尺');
  const expected = { en: ['120 m', '5 min'], ja: ['120 m', '5 分'], ko: ['120 m', '5분'] };
  for (const [lang, [meters, minutes]] of Object.entries(expected)) {
    api.setLang(lang);
    assert.equal(api.t('unit.m', { n: 120 }), meters, lang);
    assert.equal(api.t('unit.min', { n: 5 }), minutes, lang);
    assert.equal(api.t('unit.km', { n: '1.2' }), '1.2 km', lang);
  }
});
