const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../friendly-route/bridge.js'), 'utf8');
const tick = () => new Promise(setImmediate);
// Synthetic coordinates/messages verify protocol handling; they are not claims about actual visits.
const point = { lat: 25.03, lng: 121.56, name: '測試地點（A）' };
function setup({ native = true, geolocation } = {}) {
  let counter = 0;
  const timers = new Map(); const listeners = new Set(); const sent = [];
  const bridge = { postMessage(raw) { sent.push(JSON.parse(raw)); },
    addEventListener(type, fn) { assert.equal(type, 'message'); listeners.add(fn); },
    removeEventListener(type, fn) { listeners.delete(fn); } };
  const window = { navigator: { onLine: false, geolocation }, open() { throw new Error('Browser navigation is forbidden'); } };
  if (native) window.flutterObject = bridge;
  vm.runInNewContext(source, { window, setTimeout(fn, ms) { const id = ++counter; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); }, Map, Promise, Date, Error });
  return { api: window.FriendlyBridge, sent, window, timers, listeners,
    reply(name, data, overrides = {}) { for (const fn of listeners) fn({ data: JSON.stringify({ name, data }), ...overrides }); },
    timeout(ms) { const found = [...timers].find(([, timer]) => timer.ms === ms); assert(found, `No ${ms} ms timer`); timers.delete(found[0]); found[1].fn(); },
  };
}

test('native location uses one message listener, coalesces duplicate calls and preserves accuracy/time offline', async () => {
  const env = setup();
  const first = env.api.getLocation(); const second = env.api.getLocation(); await tick();
  assert.equal(env.sent.length, 1); assert.deepEqual(env.sent[0], { name: 'location', data: null });
  env.reply('location', { latitude: 25.03, longitude: 121.56, accuracy: 150, timestamp: 1720000000000 });
  const a = await first; const b = await second;
  assert.equal(a.source, 'bridge'); assert.equal(a.accuracy, 150); assert.equal(a.capturedAt, 1720000000000);
  assert.equal(a.lat, point.lat); assert.equal(a.lng, point.lng); assert.deepEqual(a, b);
  assert.equal(env.listeners.size, 1); assert.equal(env.timers.size, 0);
});
test('native [] and malformed/out-of-range coordinates share a failure without browser fallback', async () => {
  for (const payload of [[], {}, { latitude: 100, longitude: 121, timestamp: 1000 },
    { latitude: '25', longitude: 121, timestamp: 1000 }, { latitude: 25, longitude: 121 }]) {
    const env = setup({ geolocation: { getCurrentPosition() { throw new Error('Must not fall back after native failure'); } } });
    const result = env.api.getLocation(); const rejected = assert.rejects(result, (error) => error.code === 'BRIDGE_LOCATION_FAILED');
    await tick(); env.reply('location', payload); await rejected;
  }
});
test('invalid sender, unrelated name and malformed JSON cannot resolve native location', async () => {
  const env = setup(); const result = env.api.getLocation(); let done = false; result.then(() => { done = true; }); await tick();
  const position = { latitude: 25, longitude: 121, timestamp: 1000 };
  env.reply('location', position, { source: {} }); env.reply('location', position, { target: {} });
  env.reply('phone_call', true);
  for (const fn of env.listeners) fn({ data: '{broken' });
  await tick(); assert.equal(done, false);
  env.reply('location', position); await result; assert.equal(done, true);
});
test('native timeout is one failure; browser denied, timeout, unsupported are distinct', async () => {
  const native = setup(); const pending = native.api.getLocation(); const rejected = assert.rejects(pending, { code: 'BRIDGE_LOCATION_FAILED' });
  await tick(); native.timeout(20000); await rejected;
  for (const [code, expected] of [[1, 'GEO_DENIED'], [2, 'GEO_FAILED'], [3, 'GEO_TIMEOUT']]) {
    const env = setup({ native: false, geolocation: { getCurrentPosition(success, fail) { fail({ code }); } } });
    await assert.rejects(env.api.getLocation(), { code: expected });
  }
  await assert.rejects(setup({ native: false }).api.getLocation(), { code: 'GEO_UNSUPPORTED' });
});
test('browser GPS succeeds even when offline without requesting navigation permissions', async () => {
  let options;
  const env = setup({ native: false, geolocation: { getCurrentPosition(success, fail, opts) {
    options = opts; success({ coords: { latitude: 25, longitude: 121, accuracy: 8 }, timestamp: 1000 });
  } } });
  const location = await env.api.getLocation();
  assert.equal(location.source, 'browser'); assert.equal(location.lat, 25); assert.equal(location.accuracy, 8);
  assert.equal(options.enableHighAccuracy, true); assert.equal(env.sent.length, 0);
});
test('navigation sends encoded geo URI then OSM on false and only native true reports opened', async () => {
  const env = setup(); const navigation = env.api.navigate(point); await tick();
  assert.equal(env.sent[0].name, 'launch_map'); assert.equal(env.sent[0].data, 'geo:25.03,121.56?q=25.03,121.56(%E6%B8%AC%E8%A9%A6%E5%9C%B0%E9%BB%9E%EF%BC%88A%EF%BC%89)');
  env.reply('launch_map', false); assert.equal(env.sent.length, 2);
  assert.equal(env.sent[1].data, 'https://www.openstreetmap.org/?mlat=25.03&mlon=121.56#map=18/25.03/121.56');
  env.reply('launch_map', true); assert.equal(await navigation, 'opened');
  assert.equal(env.timers.size, 0);
});
test('5-second geo timeout still attempts OSM; both timeout/false paths never claim success', async () => {
  const env = setup(); const navigation = env.api.navigate(point); await tick();
  env.timeout(5000); assert.equal(env.sent.length, 2); env.reply('launch_map', true);
  assert.equal(await navigation, 'opened');
  const both = setup(); const failure = both.api.navigate(point); await tick();
  both.reply('launch_map', false); both.reply('launch_map', false); assert.equal(await failure, 'failed');
  const silent = setup(); const timeout = silent.api.navigate(point); await tick();
  silent.timeout(5000); silent.timeout(5000); assert.equal(await timeout, 'failed');
});
test('wrong native action/nonboolean response cannot open a map and concurrent destinations are rejected', async () => {
  const env = setup(); const first = env.api.navigate(point); await tick();
  assert.equal(await env.api.navigate({ ...point, name: '另一測試點' }), 'failed');
  env.reply('phone_call', true); env.reply('launch_map', 'true'); assert.equal(env.sent.length, 1);
  env.reply('launch_map', true); assert.equal(await first, 'opened');
});
test('phone calls use native strings, reject malformed data, and report false/timeout', async () => {
  const env = setup(); const phone = env.api.callPhone('02-1234-5678'); await tick();
  assert.deepEqual(env.sent[0], { name: 'phone_call', data: '02-1234-5678' });
  env.reply('phone_call', false); assert.equal(await phone, 'failed');
  const timeout = env.api.callPhone('02-1234-5678'); await tick(); env.timeout(5000); assert.equal(await timeout, 'failed');
  assert.equal(await env.api.callPhone('tel:javascript:alert(1)'), 'failed');
  assert.equal(await env.api.callPhone(null), 'failed');
});
test('without TownPass both native actions are unsupported, never opening browser/tel links', async () => {
  const env = setup({ native: false });
  assert.equal(env.api.available(), false); assert.equal(await env.api.navigate(point), 'unsupported');
  assert.equal(await env.api.callPhone('02-1234-5678'), 'unsupported'); assert.equal(env.sent.length, 0);
});
