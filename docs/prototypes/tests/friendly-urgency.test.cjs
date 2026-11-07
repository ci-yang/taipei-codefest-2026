/* 三急最近一家排序。Run: node --test docs/prototypes/tests/friendly-urgency.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { rankNearest, CATEGORIES } = require('../friendly-route/urgency.js');

const base = path.resolve(__dirname, '../friendly-route');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(base, 'resources-data.js'), 'utf8'), context, { filename: 'resources-data.js' });
const stores = context.window.FRIENDLY_RESOURCES.stores.map(store => ({ ...store, id: String(store.id) }));
const cityHall = { lat: 25.0375, lng: 121.5637 };

// 獨立重算：平面近似（等距圓柱投影），與 app 的 haversine 不同實作，只比排名。
function planar(a, b) {
  const k = Math.PI / 180; const x = (b.lng - a.lng) * k * Math.cos((a.lat + b.lat) / 2 * k); const y = (b.lat - a.lat) * k;
  return Math.sqrt(x * x + y * y) * 6371000;
}
function haversine(a, b) {
  const r = Math.PI / 180; const x = (b.lat - a.lat) * r; const y = (b.lng - a.lng) * r;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(x / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2)));
}
const coordinates = store => Number.isFinite(store.lat) && Number.isFinite(store.lng);

test('each category returns the real nearest record recomputed outside the module', () => {
  assert.deepEqual([...CATEGORIES], ['toilet', 'charge', 'wifi']);
  for (const category of CATEGORIES) {
    const { items, stepFreeFallback } = rankNearest(stores, cityHall, { category, limit: 3, distance: haversine });
    assert.equal(items.length, 3, category); assert.equal(stepFreeFallback, false);
    const expected = stores.filter(s => coordinates(s) && s.services.includes(category)).sort((a, b) => planar(cityHall, a) - planar(cityHall, b));
    assert.equal(items[0].store.id, expected[0].id, category);
    assert(items.every(item => item.store.services.includes(category)), category);
    assert(items[0].meters <= items[1].meters && items[1].meters <= items[2].meters, category);
    assert(Math.abs(items[0].meters - planar(cityHall, expected[0])) < 1, category);
  }
});

test('next results are the second and third nearest and the list stops at the limit', () => {
  const { items } = rankNearest(stores, cityHall, { category: 'toilet', limit: 3, distance: haversine });
  const all = rankNearest(stores, cityHall, { category: 'toilet', limit: 10, distance: haversine }).items;
  assert.deepEqual(items.map(item => item.store.id), all.slice(0, 3).map(item => item.store.id));
  assert.equal(rankNearest(stores, cityHall, { category: 'toilet', limit: 0, distance: haversine }).items.length, 0);
});

test('step-free preference picks only accessible records when any exist', () => {
  const { items, stepFreeFallback } = rankNearest(stores, cityHall, { category: 'toilet', stepFree: true, limit: 3, distance: haversine });
  assert.equal(stepFreeFallback, false); assert.equal(items.length, 3);
  assert(items.every(item => item.store.services.includes('accessible')));
  const expected = stores.filter(s => coordinates(s) && s.services.includes('toilet') && s.services.includes('accessible')).sort((a, b) => haversine(cityHall, a) - haversine(cityHall, b));
  assert.equal(items[0].store.id, expected[0].id);
});

test('step-free preference falls back to the nearest record and flags missing accessibility data', () => {
  const fixture = [
    { id: 'far', lat: 25.04, lng: 121.57, services: ['charge'] },
    { id: 'near', lat: 25.0376, lng: 121.5637, services: ['charge'] },
    { id: 'toilet-accessible', lat: 25.0375, lng: 121.5638, services: ['toilet', 'accessible'] },
  ];
  const result = rankNearest(fixture, cityHall, { category: 'charge', stepFree: true, limit: 3, distance: haversine });
  assert.equal(result.stepFreeFallback, true); assert.deepEqual(result.items.map(item => item.store.id), ['near', 'far']);
  const off = rankNearest(fixture, cityHall, { category: 'charge', stepFree: false, limit: 3, distance: haversine });
  assert.equal(off.stepFreeFallback, false);
});

test('equal distances keep data order and repeated runs give the same answer', () => {
  const fixture = ['a', 'b', 'c', 'd'].map(id => ({ id, lat: 25.038, lng: 121.5637, services: ['wifi'] }));
  const first = rankNearest(fixture, cityHall, { category: 'wifi', limit: 3, distance: haversine }).items.map(item => item.store.id);
  assert.deepEqual(first, ['a', 'b', 'c']);
  assert.deepEqual(rankNearest(fixture, cityHall, { category: 'wifi', limit: 3, distance: haversine }).items.map(item => item.store.id), first);
});

test('no valid position yields no result instead of a map-centre guess; unknown categories throw', () => {
  for (const position of [null, undefined, { lat: NaN, lng: 121 }, { lat: 91, lng: 0 }]) {
    assert.deepEqual(rankNearest(stores, position, { category: 'toilet', distance: haversine }), { items: [], stepFreeFallback: false });
  }
  assert.throws(() => rankNearest(stores, cityHall, { category: 'accessible', distance: haversine }), /未知類別/);
  assert.throws(() => rankNearest(stores, cityHall, { category: 'toilet' }), /distance/);
  const noCoordinate = [{ id: 'x', services: ['toilet'] }];
  assert.equal(rankNearest(noCoordinate, cityHall, { category: 'toilet', distance: haversine }).items.length, 0);
});
