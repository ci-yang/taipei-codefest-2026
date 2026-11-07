/* TownPass native messages are { name, data }; the native protocol has no request ID.
 * A geo/OSM fallback pair is one operation. Different destinations never run concurrently. */
(function (root) {
  'use strict';
  const LOCATION_TIMEOUT = 20000;
  const ACTION_TIMEOUT = 5000;
  const inFlight = new Map();
  const pending = new Map();
  let attached = null;
  let listener = null;
  const messages = {
    BRIDGE_LOCATION_FAILED: '無法取得定位', GEO_DENIED: '定位權限未開啟', GEO_TIMEOUT: '定位逾時，請再試一次',
    GEO_UNSUPPORTED: '此瀏覽器不支援定位', GEO_FAILED: '無法取得定位',
  };
  const makeError = (code) => Object.assign(new Error(messages[code]), { code });
  const object = () => {
    const value = root.flutterObject;
    return value && typeof value.postMessage === 'function' && typeof value.addEventListener === 'function' ? value : null;
  };
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const validPoint = (value) => value && finite(value.lat) && finite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;

  function attach(target) {
    if (target === attached) return;
    if (attached && listener && typeof attached.removeEventListener === 'function') attached.removeEventListener('message', listener);
    for (const item of pending.values()) item.cancel();
    pending.clear(); attached = target;
    listener = (event) => {
      if (object() !== target || (event.target && event.target !== target)
        || (event.currentTarget && event.currentTarget !== target) || (event.source && event.source !== target)) return;
      let message;
      try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!message || typeof message !== 'object' || Array.isArray(message)
        || !['location', 'launch_map', 'phone_call'].includes(message.name)
        || !Object.prototype.hasOwnProperty.call(message, 'data')) return;
      const operation = pending.get(message.name);
      if (operation && operation.target === target) operation.receive(message.data);
    };
    target.addEventListener('message', listener);
  }
  function normalizePosition(value, source) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    const result = { lat: value.latitude, lng: value.longitude };
    if (!validPoint(result) || !finite(value.timestamp) || value.timestamp <= 0) return null;
    return { ...result, accuracy: finite(value.accuracy) && value.accuracy >= 0 ? value.accuracy : null, capturedAt: value.timestamp, source };
  }
  function once(name, data, timeout, validate) {
    const target = object();
    if (!target) return Promise.resolve(null);
    attach(target);
    return new Promise((resolve) => {
      let finished = false;
      const finish = (value) => {
        if (finished) return;
        finished = true; clearTimeout(timer);
        if (pending.get(name) === operation) pending.delete(name);
        resolve(value);
      };
      const operation = { target, cancel: () => finish(null), receive(value) { if (validate(value)) finish(value); } };
      const timer = setTimeout(() => finish(null), timeout);
      pending.set(name, operation);
      try { target.postMessage(JSON.stringify({ name, data })); } catch { finish(null); }
    });
  }
  function browserLocation() {
    const geolocation = root.navigator && root.navigator.geolocation;
    if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') return Promise.reject(makeError('GEO_UNSUPPORTED'));
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value, error) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (error) reject(error); else resolve(value);
      };
      const timer = setTimeout(() => finish(null, makeError('GEO_TIMEOUT')), LOCATION_TIMEOUT + 250);
      try {
        geolocation.getCurrentPosition((position) => {
          const result = normalizePosition({ latitude: position.coords.latitude, longitude: position.coords.longitude,
            accuracy: position.coords.accuracy, timestamp: position.timestamp }, 'browser');
          finish(result, result ? null : makeError('GEO_FAILED'));
        }, (error) => finish(null, makeError(error.code === 1 ? 'GEO_DENIED' : error.code === 3 ? 'GEO_TIMEOUT' : 'GEO_FAILED')),
        { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT, maximumAge: 30000 });
      } catch { finish(null, makeError('GEO_FAILED')); }
    });
  }
  function coalesce(key, action) {
    if (inFlight.has(key)) return inFlight.get(key);
    const promise = Promise.resolve().then(action).finally(() => inFlight.delete(key));
    inFlight.set(key, promise); return promise;
  }
  function getLocation() {
    return coalesce('location', async () => {
      if (!object()) return browserLocation();
      const value = await once('location', null, LOCATION_TIMEOUT, (data) => Array.isArray(data)
        || (data !== null && typeof data === 'object') || data === false || data === null);
      const position = normalizePosition(value, 'bridge');
      if (!position) throw makeError('BRIDGE_LOCATION_FAILED');
      return position;
    });
  }
  function navigate(point) {
    if (!object()) return Promise.resolve('unsupported');
    if (!validPoint(point) || typeof point.name !== 'string' || !point.name.trim()) return Promise.resolve('failed');
    if (inFlight.has('navigation')) return Promise.resolve('failed');
    return coalesce('navigation', () => {
      const target = object();
      if (!target) return 'unsupported';
      attach(target);
      return new Promise((resolve) => {
        const coordinate = `${point.lat},${point.lng}`;
        const encodedName = encodeURIComponent(point.name.trim()).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
        const geo = `geo:${coordinate}?q=${coordinate}(${encodedName})`;
        const osm = `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=18/${point.lat}/${point.lng}`;
        let stage = 0; let responses = 0; let timer; let done = false;
        const finish = (value) => {
          if (done) return;
          done = true; clearTimeout(timer);
          if (pending.get('launch_map') === operation) pending.delete('launch_map');
          resolve(value);
        };
        const send = (url) => {
          try { target.postMessage(JSON.stringify({ name: 'launch_map', data: url })); }
          catch { if (stage === 0) fallback(); else finish('failed'); }
        };
        const fallback = () => {
          if (done || stage === 1) return;
          stage = 1; clearTimeout(timer); timer = setTimeout(() => finish('failed'), ACTION_TIMEOUT); send(osm);
        };
        const operation = { target, cancel: () => finish('failed'), receive(value) {
          if (typeof value !== 'boolean') return;
          responses += 1;
          // A late geo success still concerns this same destination; no unrelated operation is concurrent.
          if (value === true) finish('opened');
          else if (stage === 0) fallback();
          else if (responses >= 2) finish('failed');
        } };
        pending.set('launch_map', operation); timer = setTimeout(fallback, ACTION_TIMEOUT); send(geo);
      });
    });
  }
  function callPhone(phone) {
    if (!object()) return Promise.resolve('unsupported');
    if (typeof phone !== 'string' || !/^\+?[\d\s()\-#]{3,32}$/.test(phone.trim()) || !/\d{2}/.test(phone)) return Promise.resolve('failed');
    if (inFlight.has('phone')) return Promise.resolve('failed');
    return coalesce('phone', async () => (await once('phone_call', phone.trim(), ACTION_TIMEOUT,
      (value) => typeof value === 'boolean')) === true ? 'opened' : 'failed');
  }
  root.FriendlyBridge = Object.freeze({ getLocation, navigate, callPhone, available: () => object() !== null });
})(typeof window === 'undefined' ? globalThis : window);
