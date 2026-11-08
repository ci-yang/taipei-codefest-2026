// 三急主流程 390px 走查：首頁 → 結果卡 → 帶我去（步行距離）→ 開口卡 → 看地圖 → 連按返回；另測無定位、充電生存圈、地圖第二層的類別與 pin，以及日英韓介面。
// 對已啟動的 `pnpm prototype` 執行，不安裝依賴、不改程式：
// NODE_PATH=/path/to/node_modules node scripts/check-three-urgencies-browser.mjs
// 定位固定為臺北市政府附近的公開座標，不是測試者的 GPS；外部請求一律阻擋，Service Worker 停用。
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.URGENCY_QA_URL || 'http://127.0.0.1:8766/';
const out = process.env.URGENCY_QA_OUTPUT || fileURLToPath(new URL('../docs/prototypes/screenshots/three-urgencies', import.meta.url));
const origin = new URL(base);
await mkdir(out, { recursive: true });
const log = [];
const ok = (name, cond, extra = '') => { log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' · ' + extra : ''}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, geolocation: { latitude: 25.0375, longitude: 121.5637, accuracy: 10 }, permissions: ['geolocation'], locale: 'zh-TW', serviceWorkers: 'block' });
const external = [];
await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== origin.host) { external.push(u.href); return r.abort(); } return r.continue(); });
// 地圖用 canvas 畫線，DOM 查不到；載入前掛鉤 Leaflet，記下目前在地圖上的 polyline。
await ctx.addInitScript(() => {
  let leaflet; window.__livePolylines = new Set();
  Object.defineProperty(window, 'L', { configurable: true, get: () => leaflet, set(value) {
    leaflet = value; const proto = value?.Polyline?.prototype; if (!proto || proto.__tracked) return;
    const { onAdd, onRemove } = proto; proto.__tracked = true;
    proto.onAdd = function (map) { window.__livePolylines.add(this); return onAdd.call(this, map); };
    proto.onRemove = function (map) { window.__livePolylines.delete(this); return onRemove.call(this, map); };
  } });
});
const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
const view = () => page.evaluate(() => document.querySelector('#app').dataset.view);
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const shot = async n => page.screenshot({ path: `${out}/${n}.png` });
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => /±/.test(document.querySelector('#home-location').textContent));
ok('first screen is home', await view() === 'home'); ok('three buttons', (await page.locator('[data-urgency]').count()) === 3);
ok('home no overflow', await overflow() <= 0, String(await overflow())); await shot('01-home');
const domes = await page.$$eval('button.urgency-button[data-urgency]', els => els.map(el => Boolean(el.querySelector('.unit .dome svg'))));
ok('each urgency button has an e-stop dome with its icon', domes.length === 3 && domes.every(Boolean), JSON.stringify(domes));
const t0 = Date.now(); await page.click('[data-urgency="toilet"]'); await page.waitForSelector('[data-result-id]');
ok('result within 3s', Date.now() - t0 < 3000, `${Date.now() - t0} ms`); ok('result view', await view() === 'result');
ok('result no overflow', await overflow() <= 0); await shot('02-result-toilet');
await page.click('[data-action="go"]'); await page.waitForFunction(() => document.querySelector('#app').dataset.view === 'guide');
ok('arrow rotated immediately', /rotate/.test(await page.locator('#guide-arrow').getAttribute('style')));
ok('straight label', /^直線 /.test(await page.locator('#guidance-distance').textContent()));
await page.waitForFunction(() => document.querySelector('#guide-timer [data-kind]')?.dataset.kind !== 'pending', null, { timeout: 30000 }).catch(() => {});
const walkValue = () => page.evaluate(() => { const el = document.querySelector('#guide-timer .hl-walk-distance'); return el && { kind: el.closest('[data-kind]').dataset.kind, text: el.textContent, color: getComputedStyle(el).color, tool: document.querySelector('#guide-timer').textContent }; });
const walk = await walkValue();
ok('walk distance in guide tool', walk?.kind === 'walk' && /步行距離/.test(walk.tool) && /^[\d.]+ (公尺|km)$/.test(walk.text), JSON.stringify(walk));
const hud = await page.evaluate(() => ({ big: document.querySelector('#guidance-distance').textContent, small: document.querySelector('#guidance-bearing').textContent }));
ok('HUD big number switches to the walk distance', walk?.kind === 'walk' && hud.big === `步行 ${walk.text}`, JSON.stringify(hud));
ok('straight distance stays as small text', /^直線 [\d.]+ (公尺|km) · /.test(hud.small), hud.small);
ok('walk distance is brown (secondary-800)', walk?.color === 'rgb(116, 82, 27)', walk?.color);
ok('no countdown in guide', (await page.locator('#guide-timer [data-hl-countdown], #guide-timer [data-hl-action$="-timer"]').count()) === 0 && !/\d{2}:\d{2}/.test(walk?.tool || ''));
const straightLines = target => target.evaluate(() => [...window.__livePolylines].filter(line => line.options.dashArray === '7 9').length);
ok('no straight line in guide', await straightLines(page) === 0);
ok('guide no overflow', await overflow() <= 0); await shot('03-guide-toilet-walk');
await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
const darkWalk = await walkValue(); ok('dark walk distance uses secondary-400', darkWalk?.color === 'rgb(240, 200, 124)', darkWalk?.color); await shot('04-guide-toilet-walk-dark');
await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
await page.click('#exit-guidance'); await page.waitForFunction(() => document.querySelector('#app').dataset.view === 'result');
ok('back to result', true);
await page.click('#result-body [data-action="speak"]'); await page.waitForSelector('.speak-card'); await page.waitForTimeout(500);
ok('card overlay over result', await view() === 'result'); ok('card no overflow', await overflow() <= 0); await shot('05-speak-card');
await page.click('.speak-card-close'); await page.waitForSelector('.speak-card', { state: 'detached' });
ok('card closed back to result', await view() === 'result');
await page.click('#result-body [data-action="map"]'); await page.waitForFunction(() => document.querySelector('#app').dataset.view === 'map');
await page.waitForTimeout(500);
ok('map has radar entry', await page.locator('#highlight-map-launch').isVisible()); ok('selected card open', await page.locator('#selected-card').isVisible());
ok('no straight line on map with a selection', await straightLines(page) === 0);
ok('map no overflow', await overflow() <= 0); await shot('06-map-from-result');
await page.click('#selected-card [data-action="speak"]'); await page.waitForSelector('.speak-card'); await page.waitForTimeout(500); await shot('07-map-speak-card');
const back = async () => { await page.goBack({ waitUntil: 'commit' }).catch(() => {}); await page.waitForTimeout(400); };
await back(); ok('back1 -> map, card closed', await view() === 'map' && (await page.locator('.speak-card').count()) === 0); await shot('08-back1-map');
await back(); ok('back2 -> result', await view() === 'result'); await shot('09-back2-result');
await back(); ok('back3 -> home', await view() === 'home'); await shot('10-back3-home');
// charge guide with manual survival circle
await page.click('[data-urgency="charge"]'); await page.waitForSelector('[data-result-id]'); await shot('11-result-charge');
await page.click('[data-action="go"]'); await page.waitForTimeout(800);
await page.locator('#guide-timer [data-hl-action="manual-battery"]').click().catch(() => {}); await page.waitForTimeout(600); await shot('12-guide-charge-circle');
// 生存圈遮罩畫在 highlight-mask pane 的 canvas；以非透明像素數判斷有沒有遮罩。
const maskPixels = () => page.evaluate(() => [...document.querySelectorAll('.leaflet-highlight-mask-pane canvas')].reduce((sum, canvas) => {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height); let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n += 1; return sum + n; }, 0));
const box = await page.locator('#map').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height * .6);
for (let i = 0; i < 6; i += 1) { await page.mouse.wheel(0, 400); await page.waitForTimeout(250); }
await page.waitForTimeout(600); const guideMask = await maskPixels();
ok('charge guide draws survival mask (manual 18%)', guideMask > 0, `${guideMask} px`); await shot('12b-guide-charge-mask-zoomed-out');
await page.click('#exit-guidance'); await page.waitForTimeout(300);
await page.click('#result-body [data-action="map"]'); await page.waitForFunction(() => document.querySelector('#app').dataset.view === 'map'); await page.waitForTimeout(600);
const mapMask = await maskPixels(); ok('no survival mask after leaving guide', mapMask === 0, `${mapMask} px`); await shot('12c-map-after-guide-no-mask');
await back();
await page.click('#result-back'); await page.waitForTimeout(300);
await page.click('[data-urgency="wifi"]'); await page.waitForSelector('[data-result-id]'); await shot('13-result-wifi');
ok('wifi note', /不保證訊號/.test(await page.locator('#result-body').textContent()));
await page.click('#result-back'); await page.waitForTimeout(300);
// 審查情境 1：導引中從「附近資源」換地點，必須整筆換成新目標的導引。
const g = await ctx.newPage(); g.on('pageerror', e => errors.push(e.message));
await g.goto(base); await g.waitForFunction(() => /±/.test(document.querySelector('#home-location').textContent));
await g.click('[data-urgency="toilet"]'); await g.waitForSelector('[data-result-id]'); await g.click('[data-action="go"]');
await g.waitForFunction(() => document.querySelector('#guide-timer [data-kind="walk"]'), null, { timeout: 30000 });
const firstStore = await g.evaluate(() => history.state.storeId);
await g.click('#guidance-resources'); await g.waitForSelector('#sheet-body .resource-row'); await g.locator('#sheet-body .resource-row').nth(2).click();
await g.waitForTimeout(300);
const switched = await g.evaluate(() => ({ view: document.querySelector('#app').dataset.view, storeId: history.state.storeId, sheet: document.querySelector('#app-sheet').open, heading: document.querySelector('#guidance-heading').textContent, walkHidden: document.querySelector('#guide-walk').hidden }));
ok('guide switch records the new target', switched.view === 'guide' && switched.storeId !== firstStore && !switched.sheet, JSON.stringify(switched));
ok('guide switch heading is not "nearest"', switched.heading === '前往選取的資源', switched.heading);
await g.screenshot({ path: `${out}/15-guide-switched-target.png` });
await g.goBack(); await g.waitForTimeout(500);
ok('back returns to the first guide target', await g.evaluate(() => history.state.storeId) === firstStore);
await g.goForward(); await g.waitForTimeout(500);
await g.click('#guidance-end'); await g.waitForTimeout(500);
ok('one press of 結束導引 after switching returns to the result card', await g.evaluate(() => document.querySelector('#app').dataset.view) === 'result');
// 審查情境 2：雷達殘留不得蓋掉從結果卡帶去的卡片。
const r = await ctx.newPage(); r.on('pageerror', e => errors.push(e.message));
await r.goto(base); await r.waitForFunction(() => /±/.test(document.querySelector('#home-location').textContent));
await r.click('#home-map'); await r.waitForTimeout(300); await r.click('#highlight-map-launch'); await r.waitForTimeout(300);
await r.click('#home-button'); await r.waitForTimeout(400);
await r.click('[data-urgency="charge"]'); await r.waitForSelector('[data-result-id]'); await r.click('#result-body [data-action="map"]'); await r.waitForTimeout(600);
const radar = await r.evaluate(() => ({ hl: document.body.classList.contains('hl-active'), card: Boolean(document.querySelector('#selected-card').getClientRects().length), filters: Boolean(document.querySelector('#category-filters').getClientRects().length) }));
ok('result → map after radar shows filters and selected card', !radar.hl && radar.card && radar.filters, JSON.stringify(radar));
await r.screenshot({ path: `${out}/16-map-after-radar-from-result.png` });
// 地圖第二層：未選類別是空狀態；選類別才有 pin；點 pin 只選取、不開對話框。
const m = await ctx.newPage(); m.on('pageerror', e => errors.push(e.message));
await m.goto(base); await m.waitForFunction(() => /±/.test(document.querySelector('#home-location').textContent));
await m.click('#home-map'); await m.waitForFunction(() => document.querySelector('#app').dataset.view === 'map'); await m.waitForTimeout(500);
const pins = () => m.locator('.resource-map-pin').count();
const empty = await m.evaluate(() => ({ state: Boolean(document.querySelector('#nearby-preview [data-empty="no-category"]')), rows: document.querySelectorAll('#nearby-preview [data-resource]').length, count: document.querySelector('#panel-summary').textContent }));
const emptyPins = await pins();
ok('map from home starts with no category: empty state and zero pins', empty.state && empty.rows === 0 && emptyPins === 0, JSON.stringify({ ...empty, pins: emptyPins }));
await m.screenshot({ path: `${out}/17-map-no-category.png`, fullPage: true });
await m.click('[data-service="toilet"]'); await m.waitForTimeout(400);
const chipPins = await pins(); ok('choosing a category draws pins', chipPins > 0, `${chipPins} pins`);
await m.screenshot({ path: `${out}/18-map-category-toilet.png`, fullPage: true });
const stage = await m.locator('#map-stage').boundingBox();
const target = await m.evaluate(({ top, bottom }) => [...document.querySelectorAll('.resource-map-pin:not(.is-selected) button')].map(el => el.getBoundingClientRect()).map(r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })).find(p => p.y > top + 150 && p.y < bottom - 40), { top: stage.y, bottom: stage.y + stage.height });
if (target) await m.mouse.click(target.x, target.y);
await m.waitForTimeout(500);
const picked = await m.evaluate(() => ({ sheetOpen: document.querySelector('#app-sheet').hasAttribute('open'), cardHidden: document.querySelector('#selected-card').hidden }));
ok('tapping a map pin selects without opening the detail dialog', Boolean(target) && !picked.sheetOpen && !picked.cardHidden, JSON.stringify({ target, ...picked }));
await m.screenshot({ path: `${out}/19-map-selected-card.png`, fullPage: true });
// 首頁「看地圖」一律空狀態：結果卡留下的類別與選取不能帶進來。
const e = await ctx.newPage(); e.on('pageerror', err => errors.push(err.message));
await e.goto(base); await e.waitForFunction(() => /±/.test(document.querySelector('#home-location').textContent));
await e.click('[data-urgency="toilet"]'); await e.waitForSelector('[data-result-id]'); await e.click('#result-body [data-action="map"]'); await e.waitForTimeout(500);
await e.goBack(); await e.waitForTimeout(300); await e.goBack(); await e.waitForTimeout(300);
await e.click('#home-map'); await e.waitForFunction(() => document.querySelector('#app').dataset.view === 'map'); await e.waitForTimeout(500);
const reset = await e.evaluate(() => ({ empty: /先選一種服務/.test(document.querySelector('#nearby-preview').textContent), pins: document.querySelectorAll('.resource-map-pin').length, cardHidden: document.querySelector('#selected-card').hidden, chips: document.querySelectorAll('#category-filters .selected').length }));
ok('home map after result map starts empty: no category, no pins, no selected card', reset.empty && reset.pins === 0 && reset.cardHidden && reset.chips === 0, JSON.stringify(reset));
await e.screenshot({ path: `${out}/20-home-map-after-result.png`, fullPage: true });
// no location
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'zh-TW', serviceWorkers: 'block' });
await ctx2.route('**/*', r => new URL(r.request().url()).host !== origin.host ? r.abort() : r.continue());
const p2 = await ctx2.newPage(); await p2.goto(base); await p2.waitForFunction(() => /無法取得|尚未/.test(document.querySelector('#home-location').textContent), null, { timeout: 20000 }).catch(() => {});
await p2.click('[data-urgency="toilet"]'); await p2.waitForTimeout(400);
ok('no-location message', /需要定位才能找最近/.test(await p2.locator('#result-body').textContent())); ok('no card without location', (await p2.locator('[data-result-id]').count()) === 0);
await p2.screenshot({ path: `${out}/14-result-need-location.png` });
// 介面語言（D17）：存 friendly.uiLang 後重載，首頁標題換語言；390px 首頁、結果卡、選取卡不得橫向溢出，按鈕文字不換行。
// 各段文字各自算行數：同一個文字節點的 client rect 有幾種 top 就是幾行。頁尾四格按鈕是直排設計，允許兩行。
const wrapped = target => target.evaluate(selectors => {
  const lines = node => { const range = document.createRange(); range.selectNodeContents(node); const tops = []; for (const rect of range.getClientRects()) if (rect.width > 0 && !tops.some(top => Math.abs(top - rect.top) < 4)) tops.push(rect.top); return tops.length; };
  const out = [];
  for (const button of document.querySelectorAll(selectors)) {
    if (!button.getClientRects().length) continue;
    const limit = button.classList.contains('footer-action') ? 2 : 1;
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent.trim() && lines(node) > limit) out.push(`${button.id || button.dataset.action || button.dataset.urgency || button.className}: ${node.textContent.trim()} (${lines(node)})`);
  }
  return out;
}, '#home-screen button, #result-body button, #selected-card button, .guidance-header button, #guidance-hud button, .guidance-buttons button, .footer-actions button');
const scripts = { ja: /[぀-ヿ]/, ko: /[가-힯]/, en: /^[\x20-\x7e]+$/ };
for (const lang of ['ja', 'en', 'ko']) {
  const lp = await ctx.newPage(); lp.on('pageerror', err => errors.push(`${lang}: ${err.message}`));
  await lp.goto(base); await lp.evaluate(code => localStorage.setItem('friendly.uiLang', code), lang); await lp.reload({ waitUntil: 'load' });
  await lp.waitForFunction(() => /±/.test(document.querySelector('#home-location').textContent));
  const home = await lp.evaluate(() => ({ h1: document.querySelector('#home-heading').textContent, lang: document.documentElement.lang, labels: [...document.querySelectorAll('[data-urgency] .lbl')].map(el => el.textContent) }));
  ok(`${lang} home title after reload`, home.lang === lang && scripts[lang].test(home.h1) && home.labels.every(label => !/[一-鿿]/.test(label) || lang === 'ja'), JSON.stringify(home));
  const lpOverflow = () => lp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(`${lang} home no overflow`, await lpOverflow() <= 0, String(await lpOverflow()));
  let wraps = await wrapped(lp); ok(`${lang} home buttons do not wrap`, wraps.length === 0, wraps.join(' | '));
  await lp.screenshot({ path: `${out}/home-${lang}.png` });
  await lp.click('[data-urgency="toilet"]'); await lp.waitForSelector('[data-result-id]');
  ok(`${lang} result title`, scripts[lang].test(await lp.locator('#result-title').textContent()), await lp.locator('#result-title').textContent());
  ok(`${lang} result no overflow`, await lpOverflow() <= 0, String(await lpOverflow()));
  wraps = await wrapped(lp); ok(`${lang} result buttons do not wrap`, wraps.length === 0, wraps.join(' | '));
  await lp.screenshot({ path: `${out}/result-${lang}.png` });
  await lp.click('#result-body [data-action="go"]'); await lp.waitForFunction(() => document.querySelector('#app').dataset.view === 'guide'); await lp.waitForTimeout(800);
  const hud = await lp.evaluate(() => ({ heading: document.querySelector('#guidance-heading').textContent, distance: document.querySelector('#guidance-distance').textContent, end: document.querySelector('#guidance-end').textContent }));
  ok(`${lang} guide HUD`, Object.values(hud).every(text => !/[一-鿿]/.test(text) || lang === 'ja') && scripts[lang].test(hud.end), JSON.stringify(hud));
  ok(`${lang} guide no overflow`, await lpOverflow() <= 0, String(await lpOverflow()));
  wraps = await wrapped(lp); ok(`${lang} guide buttons do not wrap`, wraps.length === 0, wraps.join(' | '));
  if (lang === 'ja') {
    await lp.waitForFunction(() => document.querySelector('#guide-timer [data-kind]')?.dataset.kind === 'walk', null, { timeout: 30000 }).catch(() => {});
    const jaWalk = await lp.evaluate(() => document.querySelector('#guide-timer').textContent);
    ok('ja guide walk card has no zh-only words and uses m', !/公尺|步行|分鐘/.test(jaWalk) && /\d m\b/.test(jaWalk), jaWalk);
    await lp.screenshot({ path: `${out}/guide-ja.png` });
  }
  await lp.click('#exit-guidance'); await lp.waitForFunction(() => document.querySelector('#app').dataset.view === 'result');
  await lp.click('#result-body [data-action="map"]'); await lp.waitForFunction(() => document.querySelector('#app').dataset.view === 'map'); await lp.waitForTimeout(500);
  ok(`${lang} selected card open`, await lp.locator('#selected-card').isVisible());
  ok(`${lang} selected card no overflow`, await lpOverflow() <= 0, String(await lpOverflow()));
  wraps = await wrapped(lp); ok(`${lang} selected card buttons do not wrap`, wraps.length === 0, wraps.join(' | '));
  await lp.screenshot({ path: `${out}/map-${lang}.png`, fullPage: true });
  await lp.close();
}
log.push(`pageErrors: ${JSON.stringify(errors)}`); log.push(`external blocked: ${external.length}`);
console.log(log.join('\n')); await browser.close();
if (log.some(line => line.startsWith('FAIL')) || errors.length) process.exitCode = 1;
