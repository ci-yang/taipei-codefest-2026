/* Local route worker lifecycle. No remote API, storage, logging, or location fallback. */
(() => {
  'use strict';
  function validRoute(route) {
    const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180;
    const line = value => Array.isArray(value) && value.length >= 1 && value.every(point);
    return route && line(route.coordinates) && route.coordinates.length >= 2
      && Array.isArray(route.roadSegments) && route.roadSegments.length > 0 && route.roadSegments.every(line)
      && Array.isArray(route.connectors) && route.connectors.every(line)
      && Number.isFinite(route.distanceM) && route.distanceM >= 0
      && Number.isFinite(route.connectorDistanceM) && route.connectorDistanceM >= 0
      && Number.isFinite(route.estimateMinutes) && route.estimateMinutes >= 0
      && Array.isArray(route.storeIds) && route.storeIds.every(id => typeof id === 'string');
  }
  function createClient({ timeoutMs = 10000 } = {}) {
    let generation = 0; let active = null;
    function cancel() {
      generation += 1;
      active?.finish(Object.assign(new Error('路線計算已取消。'), { name: 'AbortError' }));
    }
    function route(options) {
      cancel();
      if (!window.Worker) return Promise.reject(new Error('此環境不支援本機道路計算，仍可查看資源資訊。'));
      const id = generation;
      return new Promise((resolve, reject) => {
        let worker; let timer; let finished = false;
        const finish = (error, value) => {
          if (finished) return; finished = true;
          clearTimeout(timer); worker?.terminate();
          if (active?.id === id) active = null;
          if (error) reject(error); else resolve(value);
        };
        active = { id, finish };
        try {
          worker = new window.Worker('./routing-worker.js');
          worker.onmessage = ({ data }) => {
            if (id !== generation || data?.id !== id) return;
            if (data.error) finish(new Error(String(data.error)));
            else if (!validRoute(data.route)) finish(new Error('路線資料無效，請重試。'));
            else finish(null, data.route);
          };
          worker.onerror = event => { event.preventDefault?.(); finish(new Error('本機路網無法載入，請連線後重試。')); };
          worker.onmessageerror = () => finish(new Error('路線資料無法讀取，請重試。'));
          timer = setTimeout(() => finish(new Error('路線計算逾時，請重試。')), timeoutMs);
          worker.postMessage({ id, options });
        } catch { finish(new Error('本機路網無法載入，請連線後重試。')); }
      });
    }
    return Object.freeze({ route, cancel });
  }
  window.FriendlyRouteClient = Object.freeze({ createClient });
})();
