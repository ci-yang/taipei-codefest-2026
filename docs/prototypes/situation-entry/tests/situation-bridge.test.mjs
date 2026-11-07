import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../bridge.js'), 'utf8');
const tick = () => new Promise(setImmediate);

function setup({ native = true } = {}) {
  const sent = [];
  const listeners = new Set();
  const timers = new Map();
  let counter = 0;
  const flutterObject = {
    postMessage(raw) { assert.equal(typeof raw, 'string'); sent.push(JSON.parse(raw)); },
    addEventListener(type, fn) { assert.equal(type, 'message'); listeners.add(fn); },
    removeEventListener(type, fn) { listeners.delete(fn); },
  };
  const window = native ? { flutterObject } : {};
  vm.runInNewContext(source, {
    window,
    setTimeout(fn, ms) { counter += 1; timers.set(counter, { fn, ms }); return counter; },
    clearTimeout(id) { timers.delete(id); },
    Promise, JSON,
  });
  return {
    api: window.SituationBridge, sent, listeners,
    reply(name, data) { for (const fn of [...listeners]) fn({ data: JSON.stringify({ name, data }) }); },
    fireTimeout() { const [id, timer] = [...timers][0]; timers.delete(id); timer.fn(); },
  };
}

test('outside TownPass the bridge reports unsupported so the tel: link is used', async () => {
  const env = setup({ native: false });
  assert.equal(env.api.available(), false);
  assert.equal(await env.api.call('1999'), 'unsupported');
});

test('regular numbers go through phone_call and succeed on a true reply', async () => {
  const env = setup();
  const pending = env.api.call('0227208889');
  await tick();
  assert.deepEqual(env.sent, [{ name: 'phone_call', data: '0227208889' }]);
  env.reply('phone_call', true);
  assert.equal(await pending, 'opened');
  assert.equal(env.listeners.size, 0);
});

test('phone_call false or no reply is reported as failed', async () => {
  const env = setup();
  const refused = env.api.call('0223026355');
  await tick();
  env.reply('phone_call', false);
  assert.equal(await refused, 'failed');

  const silent = env.api.call('0223026355');
  await tick();
  env.fireTimeout();
  assert.equal(await silent, 'failed');
});

test('1999 uses the shell 1999agree flow; silence is never reported as dialed', async () => {
  const env = setup();
  const pending = env.api.call('1999');
  await tick();
  assert.deepEqual(env.sent, [{ name: '1999agree', data: true }]);
  env.fireTimeout();
  assert.equal(await pending, 'unconfirmed');
});

test('1999agree replying false is reported as failed', async () => {
  const env = setup();
  const pending = env.api.call('1999');
  await tick();
  env.reply('1999agree', false);
  assert.equal(await pending, 'failed');
  assert.equal(env.listeners.size, 0);
});

test('1999agree false arriving after the user reads the terms is still reported', async () => {
  const env = setup();
  const late = [];
  const pending = env.api.call('1999', (result) => late.push(result));
  await tick();
  env.fireTimeout();
  assert.equal(await pending, 'unconfirmed');
  env.reply('1999agree', false);
  assert.deepEqual(late, ['failed']);
  assert.equal(env.listeners.size, 0);
});

test('a new call stops listening for an earlier 1999 reply', async () => {
  const env = setup();
  const late = [];
  const first = env.api.call('1999', (result) => late.push(result));
  await tick();
  env.fireTimeout();
  await first;
  const second = env.api.call('0227208889');
  await tick();
  env.reply('1999agree', false);
  env.reply('phone_call', true);
  assert.equal(await second, 'opened');
  assert.deepEqual(late, []);
  assert.equal(env.listeners.size, 0);
});

test('replies for other handlers are ignored', async () => {
  const env = setup();
  const pending = env.api.call('0227208889');
  await tick();
  env.reply('location', true);
  env.reply('phone_call', true);
  assert.equal(await pending, 'opened');
});

test('a second tap while dialing is rejected instead of double-dialing', async () => {
  const env = setup();
  const first = env.api.call('0227208889');
  assert.equal(await env.api.call('0227208889'), 'busy');
  await tick();
  env.reply('phone_call', true);
  assert.equal(await first, 'opened');
  assert.equal(env.sent.length, 1);
});

test('non-dialable input is never sent to the shell', async () => {
  const env = setup();
  assert.equal(await env.api.call('02-2720-8889#7019'), 'failed');
  assert.equal(await env.api.call(''), 'failed');
  assert.equal(env.sent.length, 0);
});
