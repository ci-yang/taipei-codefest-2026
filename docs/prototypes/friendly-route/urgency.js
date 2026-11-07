/* 三急：依目前定位挑該類別直線最近者。純函式，距離由呼叫端注入；不讀地圖視窗、不以地圖中心替代定位。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FriendlyUrgency = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  const CATEGORIES = Object.freeze(['toilet', 'charge', 'wifi']);
  const valid = point => Boolean(point) && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

  // 回傳 { items: [{ store, meters }], stepFreeFallback }。
  // stepFree 為 true 時只在 services 含 accessible 者中挑；一筆都沒有就退回全部並標 stepFreeFallback。
  function rankNearest(stores, position, { category, stepFree = false, limit = 3, distance } = {}) {
    if (!CATEGORIES.includes(category)) throw new Error(`三急：未知類別 ${category}`);
    if (typeof distance !== 'function') throw new TypeError('三急：需要注入 distance(a, b)');
    if (!valid(position)) return { items: [], stepFreeFallback: false };
    const pool = (Array.isArray(stores) ? stores : [])
      .map((store, index) => ({ store, index }))
      .filter(({ store }) => valid(store) && Array.isArray(store.services) && store.services.includes(category));
    const accessible = pool.filter(({ store }) => store.services.includes('accessible'));
    const stepFreeFallback = Boolean(stepFree) && pool.length > 0 && accessible.length === 0;
    const chosen = stepFree && accessible.length ? accessible : pool;
    const items = chosen
      .map(({ store, index }) => ({ store, index, meters: distance(position, store) }))
      .sort((a, b) => a.meters - b.meters || a.index - b.index)
      .slice(0, Math.max(0, limit))
      .map(({ store, meters }) => ({ store, meters }));
    return { items, stepFreeFallback };
  }

  return Object.freeze({ CATEGORIES, rankNearest });
});
