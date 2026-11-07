import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { ROOT, readJson } from './platform-tools.mjs';
import { smokePlatform } from './smoke-platform.mjs';

const manifest = await readJson(resolve(ROOT, 'data/friendly/manifest.json'));
const snapshot = await readJson(resolve(ROOT, 'data/friendly/snapshot.json'));
const sha = 'a'.repeat(40);
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

function fixtureFetch({ stale = false, fakeStore = false, andServices = false } = {}) {
  return async (input) => {
    const url = new URL(input);
    if (url.pathname === '/healthz')
      return json({
        ok: true,
        version: stale ? 'old' : sha,
        dataVersion: manifest.version,
        data: 'ready',
      });
    if (url.pathname === '/config')
      return json({
        version: sha,
        dataVersion: manifest.version,
        apiBase: '/api/v1',
        bounds: manifest.bounds,
        assets: {
          routingGraph: '/friendly/routing-graph.json',
          mapData: '/friendly/map-data.geojson',
          manifest: '/friendly/manifest.json',
        },
      });
    if (url.pathname === '/api/v1/sources' || url.pathname === '/friendly/manifest.json')
      return json(manifest);
    if (url.pathname === '/api/v1/friendly-stores') {
      if (
        url.searchParams.has('limit') ||
        url.searchParams.has('lat') ||
        url.searchParams.get('services') === 'invalid'
      )
        return json({ error: 'invalid_query' }, 400);
      let stores = structuredClone(snapshot.stores);
      if (fakeStore) stores[0].name = '[intentionally corrupted test fixture]';
      if (url.searchParams.has('bbox')) stores = [];
      if (url.searchParams.has('services'))
        stores = stores.filter((store) =>
          andServices
            ? store.services.includes('wifi') && store.services.includes('charge')
            : store.services.includes('wifi') || store.services.includes('charge'),
        );
      return json({ version: manifest.version, stores });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    if (url.pathname.startsWith('/friendly/'))
      return new Response(await readFile(resolve(ROOT, 'data/friendly', basename(url.pathname))), {
        headers: { 'content-type': 'application/json' },
      });
    if (url.pathname.endsWith('.js'))
      return new Response('/* test asset */', {
        headers: { 'content-type': 'application/javascript' },
      });
    return new Response(
      '<!doctype html><div id="app"></div><script src="/assets/test.js"></script>',
      { headers: { 'content-type': 'text/html' } },
    );
  };
}

test('smoke validates real canonical count/source/hash and SPA/API separation', async () => {
  const result = await smokePlatform({
    url: 'https://example.test',
    expectedSha: sha,
    manifest,
    fetchOptions: { fetchImpl: fixtureFetch(), retries: 0 },
  });
  assert.equal(result.storeCount, snapshot.stores.length);
  assert.equal(result.snapshotSha256, manifest.files.snapshot.sha256);
});

test('a stale but healthy deployment cannot pass smoke', async () => {
  await assert.rejects(
    smokePlatform({
      url: 'https://example.test',
      expectedSha: sha,
      manifest,
      fetchOptions: { fetchImpl: fixtureFetch({ stale: true }), retries: 0 },
    }),
  );
});

test('same count with invented store content cannot pass even without a local stores argument', async () => {
  await assert.rejects(
    smokePlatform({
      url: 'https://example.test',
      expectedSha: sha,
      manifest,
      fetchOptions: { fetchImpl: fixtureFetch({ fakeStore: true }), retries: 0 },
    }),
    /API must match the hashed source snapshot/,
  );
});

test('AND semantics for multi-service query cannot pass the OR contract', async () => {
  await assert.rejects(
    smokePlatform({
      url: 'https://example.test',
      expectedSha: sha,
      manifest,
      fetchOptions: { fetchImpl: fixtureFetch({ andServices: true }), retries: 0 },
    }),
    /OR semantics/,
  );
});
