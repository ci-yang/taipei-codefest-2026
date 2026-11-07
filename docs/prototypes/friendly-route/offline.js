/* Scope-isolated app/data caching. Never stores GPS, searches, selected places, or journeys. */
(function (root) {
  'use strict';
  const CHANNEL = 'friendly-offline-v6';
  const VERSION = 'friendly-resource-v6-20261107';
  const base = new URL('./', root.location.href);
  const STATES = new Set(['idle', 'checking', 'downloading', 'ready', 'partial', 'unsupported']);
  let registration = null; let initializing = null; let serial = 0;
  let current = { state: 'idle', completed: 0, total: 14, savedAt: null, failures: [], version: VERSION,
    baseMapBounds: [[25.023, 121.546], [25.044, 121.574]] };
  const listeners = new Set();
  const status = () => JSON.parse(JSON.stringify(current));
  function publish(next) {
    current = next;
    for (const callback of listeners) { try { callback(status()); } catch { /* UI callbacks cannot invalidate the package. */ } }
    return status();
  }
  function failure(asset, message, state = 'partial') {
    return publish({ ...current, state, savedAt: null, failures: [{ asset, label: asset === 'service-worker' ? '離線頁面' : '離線儲存', message }] });
  }
  function supported() {
    return root.isSecureContext !== false && root.navigator && root.navigator.serviceWorker
      && typeof root.MessageChannel === 'function' && 'caches' in root;
  }
  function validStatus(value) {
    return value && STATES.has(value.state) && Number.isInteger(value.completed) && Number.isInteger(value.total)
      && value.completed >= 0 && value.completed <= value.total && value.total > 0
      && (value.savedAt === null || Number.isFinite(value.savedAt)) && typeof value.version === 'string'
      && Array.isArray(value.failures) && value.failures.every((item) => item && typeof item.asset === 'string'
        && typeof item.label === 'string' && typeof item.message === 'string') && Array.isArray(value.baseMapBounds)
      && (value.state !== 'ready' || (value.completed === value.total && value.failures.length === 0 && value.savedAt > 0));
  }
  async function worker() {
    if (registration && registration.active && registration.active.state === 'activated') return registration.active;
    const container = root.navigator.serviceWorker;
    const existing = typeof container.getRegistration === 'function' ? await container.getRegistration(base.href) : null;
    if (root.navigator.onLine === false && existing && existing.scope === base.href) registration = existing;
    else {
      try { registration = await container.register(new URL('sw.js', base).href, { scope: base.href, updateViaCache: 'none' }); }
      catch (error) { if (existing && existing.scope === base.href) registration = existing; else throw error; }
    }
    if (!registration || registration.scope !== base.href) throw new Error('離線頁面範圍不符，請重新整理後再試。');
    const target = registration.installing || registration.waiting || registration.active;
    if (!target) throw new Error('離線頁面尚未就緒。');
    if (target.state === 'activated') return target;
    return new Promise((resolve, reject) => {
      const finish = () => {
        if (target.state !== 'activated' && target.state !== 'redundant') return;
        clearTimeout(timer); target.removeEventListener('statechange', finish);
        if (target.state === 'activated') resolve(target); else reject(new Error('離線頁面安裝失敗。'));
      };
      const timer = setTimeout(() => { target.removeEventListener('statechange', finish); reject(new Error('離線頁面安裝逾時。')); }, 15000);
      target.addEventListener('statechange', finish); finish();
    });
  }
  async function request(action) {
    const target = await worker();
    return new Promise((resolve, reject) => {
      const channel = new root.MessageChannel();
      const id = `offline-${Date.now().toString(36)}-${++serial}`;
      const finish = (error, result) => { clearTimeout(timer); channel.port1.close(); if (error) reject(error); else resolve(result); };
      const timer = setTimeout(() => finish(new Error('離線資料處理逾時，請檢查連線或儲存空間。')), 120000);
      channel.port1.onmessage = (event) => {
        const message = event.data;
        if (!message || message.channel !== CHANNEL || message.id !== id || message.action !== action
          || !['progress', 'result'].includes(message.type) || !validStatus(message.status)) return;
        publish(message.status); if (message.type === 'result') finish(null, status());
      };
      try { target.postMessage({ channel: CHANNEL, id, action, online: root.navigator.onLine !== false }, [channel.port2]); }
      catch (error) { finish(error); }
    });
  }
  async function perform(action) {
    if (!supported()) return failure('service-worker', '此瀏覽器未提供離線儲存，請在支援的 HTTPS 環境開啟。', 'unsupported');
    publish({ ...current, state: 'checking', failures: [] });
    try { return await request(action); }
    catch (error) { return failure('service-worker', error.message || '離線資料尚未就緒。'); }
  }
  function initialize(onProgress) {
    if (typeof onProgress === 'function') { listeners.add(onProgress); try { onProgress(status()); } catch { /* UI only. */ } }
    if (!initializing) initializing = perform('INITIALIZE').finally(() => { initializing = null; });
    return initializing.finally(() => { if (typeof onProgress === 'function') listeners.delete(onProgress); });
  }
  function verify() { return initializing || perform('VERIFY'); }
  async function clear() { if (initializing) await initializing; return perform('CLEAR'); }
  root.FriendlyOffline = Object.freeze({ initialize, status, verify, clear });
})(typeof window === 'undefined' ? globalThis : window);
