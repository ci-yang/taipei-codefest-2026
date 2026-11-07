/* Run: node docs/prototypes/tests/friendly-routing.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const base = path.resolve(__dirname, '../friendly-route');
// Deliberately no network API in this runtime: the comparison must be local.
const runtime = { window: {} };
vm.createContext(runtime);
// Keep the resource-most comparison oracle bounded to the original public snapshot.
runtime.window.FRIENDLY_ROUTING_DATA = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../data/friendly/routing-graph.json'), 'utf8'));
for (const name of ['data.js', 'routing.js']) {
  vm.runInContext(fs.readFileSync(path.join(base, name), 'utf8'), runtime, { filename: name });
}
const data = runtime.window.FRIENDLY_DATA;
const graph = runtime.window.FRIENDLY_ROUTING_DATA;
const router = runtime.window.FriendlyRouter;
const points = data.demoRoute.map((id) => data.stores.find((store) => store.id === id));
const options = { points, services: ['wifi', 'charge', 'toilet', 'accessible'], radius: 250, stores: data.stores };
const started = performance.now();
const result = router.compare(options);
assert.equal(result.error, undefined);
assert.equal(result.routes.length, 2, 'This snapshot has a resource-increasing alternative.');
assert(result.routes[1].resourceCount > result.routes[0].resourceCount);
assert(result.routes[1].distanceM <= result.maxDistanceM);
assert(result.candidateCount <= 17);

function haversine(a, b) {
  const rad = Math.PI / 180;
  const dlat = (b[0] - a[0]) * rad;
  const dlng = (b[1] - a[1]) * rad;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dlng / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const neighbors = graph.nodes.map(() => []);
for (const [a, b, weight] of graph.edges) neighbors[a].push([b, weight]);
// Separate linear-frontier implementation checks the heap-based production solver.
function referenceDistance(start, end) {
  const frontier = new Map([[start, 0]]);
  const settled = new Set();
  while (frontier.size) {
    let chosen = -1; let cost = Infinity;
    for (const [node, value] of frontier) if (value < cost) { chosen = node; cost = value; }
    if (chosen === end) return cost;
    frontier.delete(chosen); settled.add(chosen);
    for (const [next, weight] of neighbors[chosen]) {
      if (!settled.has(next) && cost + weight < (frontier.get(next) ?? Infinity)) frontier.set(next, cost + weight);
    }
  }
  return Infinity;
}
const inputCoordinates = points.map((point) => [point.lat, point.lng]);
const snapped = inputCoordinates.map((point) => {
  let index = -1; let gap = Infinity;
  graph.nodes.forEach((node, candidate) => { const value = haversine(point, node); if (value < gap) { gap = value; index = candidate; } });
  return { index, gap };
});
let expected = 0;
for (let index = 1; index < snapped.length; index += 1) {
  expected += referenceDistance(snapped[index - 1].index, snapped[index].index) + snapped[index - 1].gap + snapped[index].gap;
}
assert.equal(result.routes[0].distanceM, Math.round(expected));
for (const route of result.routes) {
  assert.equal(JSON.stringify(route.coordinates[0]), JSON.stringify(inputCoordinates[0]));
  assert.equal(JSON.stringify(route.coordinates.at(-1)), JSON.stringify(inputCoordinates.at(-1)));
  assert.equal(route.storeIds.length, new Set(route.storeIds).size);
  assert.equal(route.resourceCount, route.storeIds.length);
  const measured = route.coordinates.slice(1).reduce((sum, point, index) => sum + haversine(route.coordinates[index], point), 0);
  assert(Math.abs(measured - route.distanceM) < 1, 'Distance should agree with rendered geometry.');
}
for (const radius of [100, 250, 500]) {
  const selected = router.compare({ ...options, services: ['accessible'], radius });
  assert(!selected.error);
  for (const route of selected.routes) for (const id of route.storeIds) {
    assert(data.stores.find((store) => String(store.id) === id).services.includes('accessible'));
  }
}
const emptyServices = router.compare({ ...options, services: [] });
assert.equal(emptyServices.routes.length, 1);
assert.equal(emptyServices.routes[0].resourceCount, 0);
assert.equal(router.contains({ lat: 25.05, lng: 121.6 }), false);
assert(router.compare({ ...options, points: [{ lat: 25.05, lng: 121.6 }, points[1]] }).error);
assert(router.compare({ ...options, points: [points[0], points[0]] }).error);
assert(router.compare({ ...options, points: [{ lat: NaN, lng: 121.56 }, points[1]] }).error);
assert(router.compare({ ...options, points: [points[0]] }).error);
assert(router.compare({ ...options, points: Array(7).fill(points[0]) }).error);
assert(router.compare(null).error);
console.log(JSON.stringify({ result: 'PASS', referenceDistanceM: Math.round(expected),
  routes: result.routes.map(({ id, distanceM, resourceCount }) => ({ id, distanceM, resourceCount })),
  elapsedMs: Math.round(performance.now() - started), checks: 'independent shortest solver, geometry, detour limit, filters, empty services, invalid/outside/repeated points, no network' }, null, 2));
