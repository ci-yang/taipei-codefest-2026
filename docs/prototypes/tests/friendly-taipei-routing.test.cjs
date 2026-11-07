/* Run: node docs/prototypes/tests/friendly-taipei-routing.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const base = path.resolve(__dirname, '../friendly-route');
// Public open-data coordinates, not a device location. The VM has no network API.
// Sources: data.taipei public Wi-Fi dataset 6aa6532d-652f-4c1b-814a-4646b75407af
// and public toilets dataset ca205b54-a06f-4d84-894c-d6ab5079ce79.
const points = [
  { id: 'wifi-c624979e27', name: '臺北車站(忠孝)-W1-忠孝西路一段', lat: 25.0466977, lng: 121.5171673 },
  { id: 'toilet-5a00e06569', name: '捷運市政府站(板南線)', lat: 25.04092, lng: 121.565328 },
];
const runtime = { window: {} };
vm.createContext(runtime);
const loadStarted = performance.now();
for (const name of ['routing-data.js', 'routing.js']) {
  vm.runInContext(fs.readFileSync(path.join(base, name), 'utf8'), runtime, { filename: name });
}
const loadMs = performance.now() - loadStarted;
const graph = runtime.window.FRIENDLY_ROUTING_DATA;
assert(graph.nodes.length > 200000, 'This smoke must use the city runtime graph.');
assert(graph.edges.length > 500000);
assert.equal(graph.policy.largestConnectedComponentOnly, false);
assert(graph.policy.retainedComponentCount > 1);
assert.equal(graph.runtimeFormat, 'compact-v1');
assert.equal(graph.osmNodeIds, undefined);
assert(graph.edges.every((edge) => edge.length === 3));
assert(points.every(runtime.window.FriendlyRouter.contains));
const started = performance.now();
const result = runtime.window.FriendlyRouter.compare({ points, shortestOnly: true, stores: [] });
const elapsedMs = performance.now() - started;
assert.equal(result.error, undefined);
assert.equal(result.routes.length, 1);
assert.equal(result.candidateCount, 1);
const route = result.routes[0];
assert.equal(route.id, 'shortest');
assert.equal(route.resourceCount, 0);
assert.equal(route.roadSegments.length, 1);
assert(route.roadSegments[0].length > 2, 'Return actual road geometry, not a straight line.');
assert.equal(JSON.stringify(route.coordinates[0]), JSON.stringify([points[0].lat, points[0].lng]));
assert.equal(JSON.stringify(route.coordinates.at(-1)), JSON.stringify([points[1].lat, points[1].lng]));
assert(Number.isFinite(route.distanceM) && route.distanceM > 0);
assert(route.connectorDistanceM <= 240, 'Both public endpoints must snap within 120 m.');
console.log(JSON.stringify({
  result: 'PASS', graphVersion: graph.version,
  nodes: graph.nodes.length, directedEdges: graph.edges.length,
  fixedPublicPoints: points,
  loadAndAdjacencyMs: Math.round(loadMs), elapsedMs: Math.round(elapsedMs),
  distanceM: route.distanceM, connectorDistanceM: route.connectorDistanceM,
  roadPointCount: route.roadSegments[0].length,
  note: 'Local Node VM smoke only; not a phone benchmark or a surveyed pedestrian route.',
}, null, 2));
