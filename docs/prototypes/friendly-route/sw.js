/* Explicit, same-origin offline package. No remote tiles or automatic prefetch. */
const CACHE_NAME = `friendly-route-v3:${new URL(self.registration.scope).pathname}`;
const ASSETS = ['./', './index.html', './app.js', './styles.css', './map-ui.css', './data.js', './routing-data.js', './routing.js', './search.js', './vendor/leaflet.js', './vendor/leaflet.css'];
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_ROUTE') return;
  event.waitUntil((async () => {
    try {
      const responses = await Promise.all(ASSETS.map(async (path) => {
        const url = new URL(path, self.registration.scope).href;
        const response = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
        const finalUrl = new URL(response.url);
        const contentType = response.headers.get('content-type') || '';
        const expectedType = path.endsWith('.js') ? /javascript|ecmascript/ : path.endsWith('.css') ? /text\/css/ : /text\/html/;
        if (!response.ok || response.type === 'opaque' || finalUrl.origin !== self.location.origin || !response.url.startsWith(self.registration.scope) || !expectedType.test(contentType)) throw new Error('部分地圖資產無法下載，或登入已過期，請重新登入後重試。');
        return [url, response];
      }));
      const cache = await caches.open(CACHE_NAME);
      const writes = await Promise.allSettled(responses.map(([url, response]) => cache.put(url, response)));
      if (writes.some((result) => result.status === 'rejected')) {
        await caches.delete(CACHE_NAME);
        throw new Error('離線包更新失敗，已停用，請重新下載。');
      }
      event.ports[0]?.postMessage({ ok: true, version: 'friendly-app-v2' });
    } catch (error) { await caches.delete(CACHE_NAME); event.ports[0]?.postMessage({ ok: false, error: error.message || '離線資料下載失敗。' }); }
  })());
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !event.request.url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    try { return await fetch(event.request); }
    catch {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      if (event.request.mode === 'navigate' && [new URL('./', self.registration.scope).pathname, new URL('./index.html', self.registration.scope).pathname].includes(url.pathname)) {
        const entry = await cache.match(new URL('./index.html', self.registration.scope).href);
        if (entry) return entry;
      }
      return new Response('離線資料尚未下載，請恢復連線後再試。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
