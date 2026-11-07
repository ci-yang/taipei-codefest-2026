const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '../friendly-route');

function clientRuntime({ supported = true } = {}) {
  const workers = [];
  class Worker {
    constructor(url) { this.url = url; workers.push(this); }
    postMessage(message) { this.message = message; }
    terminate() { this.terminated = true; }
    reply(data) { this.onmessage?.({ data }); }
  }
  const context = { window: { Worker: supported ? Worker : undefined }, setTimeout, clearTimeout, Error };
  vm.runInNewContext(fs.readFileSync(path.join(base, 'route-client.js'), 'utf8'), context);
  return { workers, create: context.window.FriendlyRouteClient.createClient };
}
const fixture = { coordinates: [[25.03,121.55],[25.031,121.56]], roadSegments: [[[25.03,121.55],[25.031,121.56]]], connectors: [], distanceM: 1200, connectorDistanceM: 0, estimateMinutes: 18, storeIds: ['test-resource'], basis: 'test fixture' };

test('route client returns current Worker result and terminates completed workers', async () => {
  const env = clientRuntime(); const client = env.create();
  const pending = client.route({ points: [{lat:25.03,lng:121.55},{lat:25.031,lng:121.56}], stores: [], radius: 250 });
  assert.equal(env.workers[0].url, './routing-worker.js');
  env.workers[0].reply({ id: env.workers[0].message.id, route: fixture });
  assert.deepEqual(await pending, fixture); assert.equal(env.workers[0].terminated, true);
});
test('new route and clear cancel old work; stale reply never resolves current request', async () => {
  const env = clientRuntime(); const client = env.create();
  const first = client.route({}); const rejection = assert.rejects(first, { name: 'AbortError' });
  const second = client.route({}); await rejection;
  env.workers[0].reply({ id: env.workers[0].message.id, route: fixture });
  assert.equal(env.workers[0].terminated, true);
  const secondRejection = assert.rejects(second, { name: 'AbortError' }); client.cancel(); await secondRejection;
  assert.equal(env.workers[1].terminated, true);
});
test('Worker failure, timeout and missing Worker are explicit failures without network fallback', async () => {
  const unsupported = clientRuntime({ supported:false });
  await assert.rejects(unsupported.create().route({}), /不支援/);
  const env = clientRuntime(); const client = env.create({ timeoutMs: 5 });
  await assert.rejects(client.route({}), /逾時/); assert.equal(env.workers[0].terminated, true);
  const failed = client.route({}); env.workers[1].onerror({ preventDefault() {} });
  await assert.rejects(failed, /路網.*載入/); assert.equal(env.workers[1].terminated, true);
  const invalid = client.route({}); env.workers[2].reply({id:env.workers[2].message.id,route:{distanceM:NaN}});
  await assert.rejects(invalid, /無效/);
});
test('real worker script runs with self only, uses bundled graph and rejects invalid/outside points', () => {
  const replies = []; const scripts = [];
  const self = { postMessage: value => replies.push(value) };
  const context = vm.createContext({ self });
  context.importScripts = (...files) => files.forEach(file => { scripts.push(file); vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), context, { filename: file }); });
  vm.runInContext(fs.readFileSync(path.join(base, 'routing-worker.js'), 'utf8'), context);
  // Fixed public OSM points from the bundled graph; no tester GPS or network API.
  const nodes = self.FRIENDLY_ROUTING_DATA.nodes;
  const edge = self.FRIENDLY_ROUTING_DATA.edges.find(([a,b]) => Math.abs(nodes[a][0]-nodes[b][0])+Math.abs(nodes[a][1]-nodes[b][1]) > 0.00002);
  self.onmessage({ data: { id:1, options:{ points:edge.slice(0,2).map(i=>({lat:nodes[i][0],lng:nodes[i][1]})), stores:[], radius:250 } } });
  assert(replies[0].route.distanceM > 0); assert(replies[0].route.roadSegments.length > 0);
  assert.deepEqual(scripts, ['routing-data.js','routing.js']);
  self.onmessage({ data: { id:2, options:{points:[{lat:0,lng:0},{lat:25.03,lng:121.55}]} } });
  assert.match(replies[1].error, /範圍/);
  self.onmessage({ data: { id:3, options:{points:[{lat:NaN,lng:0}]} } });
  assert.match(replies[2].error, /有效/);
});

test('shortest-only uses the shared 250m corridor and separates roads from estimated connectors', () => {
  const nodes = [[25.033,121.55],[25.033,121.56],[25.04,121.57]];
  const context = { window: { FRIENDLY_ROUTING_DATA: { version:'test-public-geometry', bounds:[[25,121],[26,122]], nodes, edges:[[0,1,1008],[1,0,1008]] } } };
  vm.runInNewContext(fs.readFileSync(path.join(base,'routing.js'),'utf8'), context);
  const run = options => context.window.FriendlyRouter.compare({ shortestOnly:true, radius:250, ...options });
  const stores = [249,251].map(m=>({id:String(m),lat:25.033+m/110540,lng:121.555,services:['toilet']}));
  const result = run({points:[{lat:25.03301,lng:121.55},{lat:25.03301,lng:121.56}],stores});
  assert.equal(result.routes.length,1); assert.equal(result.candidateCount,1);
  assert.deepEqual(Array.from(result.routes[0].storeIds),['249']);
  assert.equal(result.routes[0].connectors.length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(result.routes[0].roadSegments)),[nodes.slice(0,2)]);
  assert.match(run({points:[{lat:25.033,lng:121.55},{lat:25.04,lng:121.57}]}).error,/無法連通/);
});

test('shortest-only considers a connected candidate when the nearest node is isolated', () => {
  const nodes = [[25.033,121.55],[25.033,121.55001],[25.0335,121.55],[25.0335,121.56]];
  const context = { window:{ FRIENDLY_ROUTING_DATA:{bounds:[[25,121],[26,122]],nodes,edges:[[0,1,1],[1,0,1],[2,3,1008],[3,2,1008]]} } };
  vm.runInNewContext(fs.readFileSync(path.join(base,'routing.js'),'utf8'),context);
  const result = context.window.FriendlyRouter.compare({shortestOnly:true,points:[{lat:25.033,lng:121.55},{lat:25.0335,lng:121.56}],stores:[]});
  assert.equal(result.error,undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(result.routes[0].roadSegments)),[nodes.slice(2)]);
  assert(result.routes[0].connectorDistanceM >= 55 && result.routes[0].connectorDistanceM <= 57);
  assert.equal(result.routes[0].distanceM,Math.round(1008 + 6371000 * Math.PI / 180 * 0.0005));
});
