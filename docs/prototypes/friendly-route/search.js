/* Explicit-submit destination search. Photon is a public demo, without an SLA. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FriendlySearch = api;
})(typeof window === 'object' ? window : globalThis, function (root) {
  'use strict';

  const DEFAULT_ENDPOINT = 'https://photon.komoot.io/api/';
  const TAIPEI_BBOX = Object.freeze([121.45, 24.95, 121.65, 25.2]);
  const MAX_RESULTS = 6;
  const SOURCE_ATTRIBUTION = Object.freeze({
    name: 'Photon · OpenStreetMap',
    url: 'https://github.com/komoot/photon#readme',
    dataUrl: 'https://www.openstreetmap.org/copyright',
    notice: 'Photon 公開示範服務；無可用性保證。地點資料 © OpenStreetMap contributors，外部地點不代表友善服務認證。',
  });
  const ERROR_MESSAGES = Object.freeze({
    INVALID_QUERY: '請輸入 2 至 120 字的地名或地址。',
    INVALID_CONFIG: '地點搜尋設定無效，請先使用本地店家搜尋。',
    INVALID_RESPONSE: '地點搜尋回應格式有誤，請先使用本地店家搜尋。',
    RATE_LIMIT: '地點搜尋服務忙碌，請稍後再試；仍可選擇本地店家。',
    SERVER: '地點搜尋服務暫時無法使用，請先選擇本地店家。',
    NETWORK: '無法連線到地點搜尋服務，請檢查網路或選擇本地店家。',
    TIMEOUT: '地點搜尋逾時，請稍後再試或選擇本地店家。',
    ABORTED: '已取消地點搜尋。',
  });

  function searchError(code) {
    const error = new Error(ERROR_MESSAGES[code]);
    error.name = code === 'ABORTED' ? 'AbortError' : 'FriendlySearchError';
    error.code = code;
    return error;
  }

  function cleanText(value, maxLength) {
    return typeof value === 'string'
      ? Array.from(value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, maxLength).join('')
      : '';
  }

  function matchText(value) {
    return cleanText(value, 500).replace(/臺/g, '台').toLowerCase();
  }

  function validCoordinates(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  function searchLocal(query, stores) {
    const text = matchText(query);
    if (!text || Array.from(text).length > 120 || !Array.isArray(stores)) return [];
    const terms = text.split(' ');
    return stores.filter((store) => store && validCoordinates(store.lat, store.lng))
      .map((store) => {
        const name = cleanText(store.name, 120);
        const address = cleanText(store.address, 240);
        const searchable = `${matchText(name)} ${matchText(address)}`;
        const rank = matchText(name) === text ? 0 : matchText(name).startsWith(text) ? 1 : matchText(name).includes(text) ? 2 : 3;
        return { store, name, address, rank, matches: name && terms.every((term) => searchable.includes(term)) };
      })
      .filter((entry) => entry.matches)
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'zh-Hant'))
      .slice(0, MAX_RESULTS)
      .map(({ store, name, address }) => {
        const storeId = String(store.id);
        const place = { id: `catalog:${storeId}`, storeId, name, address, lat: store.lat, lng: store.lng, source: 'catalog' };
        if (Array.isArray(store.services)) place.services = store.services.filter((service) => typeof service === 'string');
        return place;
      });
  }

  function parseResponse(payload) {
    if (!payload || payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) throw searchError('INVALID_RESPONSE');
    const places = [];
    const ids = new Set();
    for (const feature of payload.features.slice(0, 100)) {
      if (!feature || feature.type !== 'Feature' || feature.geometry?.type !== 'Point'
        || !Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length < 2
        || !feature.properties || typeof feature.properties !== 'object') continue;
      const [lng, lat] = feature.geometry.coordinates;
      if (!validCoordinates(lat, lng) || lng < TAIPEI_BBOX[0] || lat < TAIPEI_BBOX[1]
        || lng > TAIPEI_BBOX[2] || lat > TAIPEI_BBOX[3]) continue;
      const props = feature.properties;
      const addressParts = [props.state, props.city, props.district, props.locality,
        [cleanText(props.street, 120), cleanText(props.housenumber, 30)].filter(Boolean).join(' ')];
      const address = cleanText([...new Set(addressParts.map((part) => cleanText(part, 120)).filter(Boolean))].join(' '), 240);
      const name = cleanText(props.name, 120) || cleanText(address, 120);
      if (!name) continue;
      const osmId = typeof props.osm_id === 'number' && Number.isFinite(props.osm_id) ? String(props.osm_id) : cleanText(props.osm_id, 60);
      const osmType = cleanText(props.osm_type, 20);
      const id = osmId && osmType ? `photon:${osmType}:${osmId}` : `photon:${lng},${lat}:${name}`;
      if (ids.has(id)) continue;
      ids.add(id);
      // These are untrusted plain strings: the UI must use textContent or HTML escaping.
      places.push({ id, name, address, lat, lng, source: 'photon' });
      if (places.length === MAX_RESULTS) break;
    }
    return places;
  }

  function clonePlaces(places) {
    return places.map((place) => ({ ...place }));
  }

  function waitFor(ms, signal) {
    if (signal.aborted) return Promise.reject(searchError('ABORTED'));
    return new Promise((resolve, reject) => {
      const done = () => { signal.removeEventListener('abort', abort); resolve(); };
      const timer = setTimeout(done, ms);
      const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(searchError('ABORTED')); };
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  function createClient({ fetchImpl, endpoint, timeoutMs = 10000, minIntervalMs = 1000 } = {}) {
    const fetchRequest = fetchImpl || (typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    const configuredEndpoint = endpoint || root.FRIENDLY_SEARCH_CONFIG?.endpoint || DEFAULT_ENDPOINT;
    const interval = Math.max(1000, Number.isFinite(minIntervalMs) ? minIntervalMs : 1000);
    const timeout = Math.min(10000, Math.max(1, Number.isFinite(timeoutMs) ? timeoutMs : 10000));
    const cache = new Map();
    const pending = new Map();
    let queue = Promise.resolve();
    let lastStarted = -Infinity;

    async function request(query, signal) {
      if (signal.aborted) throw searchError('ABORTED');
      while (Date.now() - lastStarted < interval) {
        await waitFor(interval - (Date.now() - lastStarted), signal);
      }
      if (signal.aborted) throw searchError('ABORTED');
      let url;
      try {
        url = new URL(configuredEndpoint);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw searchError('INVALID_CONFIG');
      } catch { throw searchError('INVALID_CONFIG'); }
      url.search = '';
      url.hash = '';
      url.searchParams.set('q', query);
      url.searchParams.set('limit', String(MAX_RESULTS));
      url.searchParams.set('bbox', TAIPEI_BBOX.join(','));
      // Photon accepts "default" for local names, overriding browser Accept-Language.
      // Public demo verified with en-US headers: Taipei results retain their Chinese OSM names.
      url.searchParams.set('lang', 'default');
      if (!fetchRequest) throw searchError('NETWORK');

      const controller = new AbortController();
      let timer;
      let abort;
      const interrupted = new Promise((resolve, reject) => {
        abort = () => { reject(searchError('ABORTED')); controller.abort(); };
        signal.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => { reject(searchError('TIMEOUT')); controller.abort(); }, timeout);
      });
      lastStarted = Date.now();
      try {
        return await Promise.race([
          (async () => {
            const response = await fetchRequest(url.toString(), {
              signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw searchError(response.status === 429 ? 'RATE_LIMIT' : 'SERVER');
            let payload;
            try { payload = await response.json(); } catch { throw searchError('INVALID_RESPONSE'); }
            return parseResponse(payload);
          })(),
          interrupted,
        ]);
      } catch (error) {
        if (error?.name === 'FriendlySearchError' || error?.name === 'AbortError') throw error;
        throw searchError('NETWORK');
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
    }

    function subscribe(entry, signal) {
      entry.subscribers += 1;
      return new Promise((resolve, reject) => {
        let finished = false;
        function finish(error, places) {
          if (finished) return;
          finished = true;
          signal?.removeEventListener('abort', abort);
          entry.subscribers -= 1;
          if (entry.subscribers === 0 && !entry.settled) {
            if (pending.get(entry.key) === entry) pending.delete(entry.key);
            entry.controller.abort();
          }
          if (error) reject(error); else resolve(clonePlaces(places));
        }
        const abort = () => finish(searchError('ABORTED'));
        signal?.addEventListener('abort', abort, { once: true });
        entry.promise.then((places) => finish(null, places), (error) => finish(error));
        if (signal?.aborted) abort();
      });
    }

    function search(query, { signal } = {}) {
      if (signal?.aborted) return Promise.reject(searchError('ABORTED'));
      const text = cleanText(query, 121);
      const length = Array.from(text).length;
      if (length < 2 || length > 120) return Promise.reject(searchError('INVALID_QUERY'));
      const key = matchText(text);
      if (cache.has(key)) return Promise.resolve(clonePlaces(cache.get(key)));
      let entry = pending.get(key);
      if (!entry) {
        entry = { key, controller: new AbortController(), subscribers: 0, settled: false };
        entry.promise = queue.then(() => request(text, entry.controller.signal)).then((places) => {
          if (entry.controller.signal.aborted) throw searchError('ABORTED');
          cache.set(key, places);
          if (cache.size > 50) cache.delete(cache.keys().next().value);
          return places;
        }).finally(() => {
          entry.settled = true;
          if (pending.get(key) === entry) pending.delete(key);
        });
        queue = entry.promise.catch(() => {});
        pending.set(key, entry);
      }
      return subscribe(entry, signal);
    }

    return { search };
  }

  return Object.freeze({ searchLocal, createClient, SOURCE_ATTRIBUTION, ERROR_MESSAGES, DEFAULT_ENDPOINT, TAIPEI_BBOX });
});
