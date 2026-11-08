/* v6: public app/data only. No user location, queries, routes, or external map tiles. */
const CHANNEL = 'friendly-offline-v6';
const VERSION = 'friendly-resource-v6-20261107';
const SCOPE = new URL(self.registration.scope);
const PREFIX = `friendly-route-v6:${SCOPE.pathname}:`;
const META_CACHE = `${PREFIX}manifest`;
const META_URL = new URL('__offline_manifest__', SCOPE).href;
const BASE_MAP_BOUNDS = [[25.023, 121.546], [25.044, 121.574]];
const ASSETS = [
  ['.', '首頁'], ['index.html', '頁面'], ['app.js', '操作功能'], ['app-ui.css', '介面樣式'],
  ['highlights.css', '城市雷達樣式'], ['highlights.js', '城市雷達'], ['highlight-math.js', '雷達試算'], ['price-data.js', '住宅交易樣本'],
  ['icons.js', '服務圖示'], ['data.js', '信義／大安東及北投學園路底圖'], ['resources-data.js', '全市資源與類別'],
  ['search.js', '本機搜尋'], ['bridge.js', '台北通與定位'], ['offline.js', '離線管理'],
  ['route-client.js', '路線操作'], ['routing-worker.js', '本機路線計算'],
  ['routing.js', '步行路由'], ['routing-data.js', '臺北市步行路網'],
  ['urgency.js', '三急最近一家'], ['speak-card-strings.js', '開口卡文案'], ['speak-card.js', '開口卡'], ['speak-card.css', '開口卡樣式'],
  ['vendor/leaflet.js', '地圖程式'], ['vendor/leaflet.css', '地圖樣式'], ['NOTICE.txt', '資料來源授權'], ['LICENSE.txt', '程式授權'],
].map(([path, label]) => ({ path, label, url: new URL(path, SCOPE).href }));
const ASSET_PATHS = new Set(ASSETS.map((asset) => new URL(asset.url).pathname));
const subscribers = new Set();
const seenMessages = new Set();
let downloadPromise = null;
let lastProgress = null;
function snapshot(overrides = {}) {
  return { state: 'idle', completed: 0, total: ASSETS.length, savedAt: null, failures: [], version: VERSION,
    baseMapBounds: BASE_MAP_BOUNDS, ...overrides };
}
function inScope(value) {
  try { const url = new URL(value); return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname); } catch { return false; }
}
function validManifest(value) {
  return value && value.scope === SCOPE.href && typeof value.cacheName === 'string'
    && value.cacheName.startsWith(`${PREFIX}assets:`) && typeof value.version === 'string'
    && Array.isArray(value.assets) && value.assets.every((url) => typeof url === 'string' && inScope(url))
    && Number.isFinite(value.savedAt) && value.savedAt > 0;
}
async function readRecord() {
  const cache = await caches.open(META_CACHE);
  const response = await cache.match(META_URL);
  if (!response) return { active: null, partial: null };
  try {
    const value = await response.json();
    return { active: validManifest(value.active) ? value.active : null, partial: validManifest(value.partial) ? value.partial : null };
  } catch { return { active: null, partial: null }; }
}
async function writeRecord(record) {
  const cache = await caches.open(META_CACHE);
  await cache.put(META_URL, new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json' } }));
}
function validResponse(response, asset) {
  if (!response || !response.ok || response.type === 'opaque' || (response.url && !inScope(response.url))) return false;
  const contentType = response.headers.get('content-type') || '';
  const expected = asset.path.endsWith('.js') ? /javascript|ecmascript/i
    : asset.path.endsWith('.css') ? /text\/css/i : asset.path.endsWith('.txt') ? /text\/plain/i : /text\/html/i;
  return expected.test(contentType);
}
async function verifyRecord(record) {
  const manifest = record.active || record.partial;
  if (!manifest) return snapshot();
  const cache = await caches.open(manifest.cacheName);
  const failures = []; let completed = 0;
  for (const asset of ASSETS) {
    const response = await cache.match(asset.url);
    if (validResponse(response, asset)) completed += 1;
    else failures.push({ asset: asset.path, label: asset.label, message: '尚未下載或已被瀏覽器清除' });
  }
  if (manifest.version !== VERSION) failures.push({ asset: 'version', label: '資料版本', message: '新版本尚未完整下載，保留原有離線資料。' });
  const ready = failures.length === 0 && manifest.complete === true;
  return snapshot({ state: ready ? 'ready' : 'partial', completed, savedAt: ready ? manifest.savedAt : null, failures });
}
async function verify() {
  try { return await verifyRecord(await readRecord()); }
  catch { return snapshot({ state: 'partial', failures: [{ asset: 'storage', label: '離線儲存', message: '無法讀取儲存空間。' }] }); }
}
function progress(value) { lastProgress = value; for (const callback of subscribers) callback(value); }
async function download() {
  const previous = await readRecord();
  const checked = await verifyRecord(previous);
  if (checked.state === 'ready') return checked;
  const cacheName = `${PREFIX}assets:${VERSION}:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const cache = await caches.open(cacheName);
  const failures = []; const successful = []; let cursor = 0;
  progress(snapshot({ state: 'downloading' }));
  async function run() {
    while (cursor < ASSETS.length) {
      const asset = ASSETS[cursor++];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        // Pages canonicalizes index.html to the directory URL. Fetch that same-scope
        // entry directly, while retaining both cache keys and refusing redirects.
        const downloadUrl = asset.path === 'index.html' ? SCOPE.href : asset.url;
        const response = await fetch(downloadUrl, { cache: 'reload', credentials: 'same-origin', redirect: 'error', signal: controller.signal });
        if (!validResponse(response, asset)) throw new Error('檔案下載失敗或內容格式不符');
        await cache.put(asset.url, response); successful.push(asset.url);
      } catch (error) {
        failures.push({ asset: asset.path, label: asset.label,
          message: error.name === 'AbortError' ? '下載逾時' : '無法下載或儲存，請確認連線與可用空間' });
      } finally { clearTimeout(timer); }
      progress(snapshot({ state: 'downloading', completed: successful.length, failures: [...failures] }));
    }
  }
  await Promise.all([run(), run(), run()]);
  const manifest = { scope: SCOPE.href, version: VERSION, cacheName, assets: successful, savedAt: Date.now(), complete: failures.length === 0 };
  // Commit one pointer only after the complete package was stored. Failed updates retain the previous package.
  await writeRecord(manifest.complete ? { active: manifest, partial: null } : { active: previous.active, partial: manifest });
  if (manifest.complete) {
    for (const name of await caches.keys()) if (name.startsWith(`${PREFIX}assets:`) && name !== cacheName) await caches.delete(name);
    return snapshot({ state: 'ready', completed: ASSETS.length, savedAt: manifest.savedAt });
  }
  return snapshot({ state: 'partial', completed: successful.length, failures });
}
async function initialize(online, callback) {
  if (!online) return verify();
  subscribers.add(callback);
  if (lastProgress && downloadPromise) callback(lastProgress);
  if (!downloadPromise) downloadPromise = download().catch(() => snapshot({ state: 'partial', failures: [
    { asset: 'storage', label: '離線儲存', message: '儲存失敗；已保留先前完整的離線資料。' },
  ] })).finally(() => { downloadPromise = null; lastProgress = null; });
  try { return await downloadPromise; } finally { subscribers.delete(callback); }
}
async function clear() {
  if (downloadPromise) await downloadPromise;
  try {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX)) await caches.delete(name);
    return snapshot();
  } catch { return snapshot({ state: 'partial', failures: [{ asset: 'storage', label: '離線儲存', message: '無法清除離線資料。' }] }); }
}
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || message.channel !== CHANNEL || typeof message.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(message.id)
    || !['INITIALIZE', 'VERIFY', 'CLEAR'].includes(message.action) || !event.ports || !event.ports[0]
    || !event.source || typeof event.source.id !== 'string' || (event.origin && event.origin !== SCOPE.origin)) return;
  event.waitUntil((async () => {
    const client = await self.clients.get(event.source.id);
    if (!client || !inScope(client.url)) return;
    const key = `${client.id}:${message.id}`;
    if (seenMessages.has(key)) return;
    seenMessages.add(key); if (seenMessages.size > 100) seenMessages.delete(seenMessages.values().next().value);
    const reply = (type, status) => event.ports[0].postMessage({ channel: CHANNEL, id: message.id, action: message.action, type, status });
    const status = message.action === 'INITIALIZE' ? await initialize(message.online !== false, (value) => reply('progress', value))
      : message.action === 'CLEAR' ? await clear() : await verify();
    reply('result', status);
  })());
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !inScope(url.href) || !ASSET_PATHS.has(url.pathname)) return;
  event.respondWith((async () => {
    let record;
    try { record = await readRecord(); } catch { record = { active: null, partial: null }; }
    for (const manifest of [record.active, record.partial]) {
      if (!manifest) continue;
      const cache = await caches.open(manifest.cacheName);
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const shell = await cache.match(new URL('index.html', SCOPE).href);
        if (shell) return shell;
      }
    }
    try { return await fetch(event.request); }
    catch { return new Response('此項離線資料尚未下載，請恢復連線後再試。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
  })());
});
