import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { ROOT, isMain, parseFlags, readJson, sha256, validateOrigin } from './platform-tools.mjs';
import { assertLegacyHtml, smokeAppShell, validateAppManifest } from './app-shell-smoke.mjs';

/** Timeout covers headers AND body. A retry is bounded and does not log response data. */
export async function fetchResource(
  url,
  {
    timeoutMs = 20_000,
    retries = 1,
    retryDelayMs = 300,
    fetchImpl = fetch,
    maxBytes = 8_000_000,
    redirect = 'error',
  } = {},
) {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchImpl(url, {
            signal: controller.signal,
            redirect,
            cache: 'no-store',
          });
          const chunks = [];
          let size = 0;
          for await (const chunk of response.body || []) {
            size += chunk.length;
            if (size > maxBytes) {
              controller.abort();
              throw new Error('Response exceeds output limit.');
            }
            chunks.push(chunk);
          }
          return {
            status: response.status,
            headers: response.headers,
            bytes: Buffer.concat(chunks),
          };
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Smoke request timeout.'));
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      if (attempt >= retries) throw error;
      await delay(retryDelayMs);
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function fetchJson(url, options, status = 200) {
  const response = await fetchResource(url, options);
  assert.equal(response.status, status, `Unexpected HTTP status for ${new URL(url).pathname}`);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  return JSON.parse(response.bytes.toString());
}

const sorted = (stores) => [...stores].sort((a, b) => a.id.localeCompare(b.id));

export async function smokePlatform({
  url,
  expectedSha,
  manifest,
  stores,
  appManifest,
  allowLegacy = false,
  fetchOptions = {},
}) {
  const origin = validateOrigin(url, true);
  assert.ok(expectedSha, 'An expected source SHA is required; stale deployments cannot pass.');
  assert.ok(manifest.storeCount > 0, 'Smoke baseline must contain real stores.');
  if (!allowLegacy || appManifest) validateAppManifest(appManifest, expectedSha);
  const get = (path, status) => fetchJson(origin + path, fetchOptions, status);
  const health = await get('/healthz');
  assert.deepEqual(health, {
    ok: true,
    version: expectedSha,
    dataVersion: manifest.version,
    data: 'ready',
  });
  const config = await get('/config');
  assert.deepEqual(Object.keys(config).sort(), [
    'apiBase',
    'assets',
    'bounds',
    'dataVersion',
    'version',
  ]);
  assert.equal(config.version, expectedSha);
  assert.equal(config.dataVersion, manifest.version);
  assert.equal(config.apiBase, '/api/v1');
  assert.deepEqual(config.bounds, manifest.bounds);
  assert.deepEqual(config.assets, {
    routingGraph: '/friendly/routing-graph.json',
    mapData: '/friendly/map-data.geojson',
    manifest: '/friendly/manifest.json',
  });
  assert.deepEqual(await get('/api/v1/sources'), manifest);
  const all = await get('/api/v1/friendly-stores');
  assert.equal(all.version, manifest.version);
  assert.equal(all.stores.length, manifest.storeCount);
  assert.equal(new Set(all.stores.map((store) => store.id)).size, manifest.storeCount);
  if (stores) assert.deepEqual(sorted(all.stores), sorted(stores));
  const expectedOr = all.stores.filter(
    (store) => store.services.includes('wifi') || store.services.includes('charge'),
  );
  const selected = await get('/api/v1/friendly-stores?services=wifi,charge');
  assert.deepEqual(sorted(selected.stores), sorted(expectedOr), 'Services must use OR semantics.');
  assert.equal(selected.version, manifest.version);
  assert.deepEqual((await get('/api/v1/friendly-stores?bbox=0,0,1,1')).stores, []);
  for (const path of [
    '/api/v1/friendly-stores?services=invalid',
    '/api/v1/friendly-stores?lat=91&lng=121&radius=100',
    '/api/v1/friendly-stores?limit=0',
  ])
    assert.ok((await get(path, 400)).error);
  assert.ok((await get('/api/not-a-real-endpoint', 404)).error);

  let appResult = {};
  if (appManifest) {
    appResult = await smokeAppShell({
      origin,
      expectedSha,
      appManifest,
      fetchResource,
      fetchJson,
      fetchOptions,
    });
  } else {
    let index;
    for (const path of ['/', '/map', '/about', '/nonexistent-spa-route']) {
      const response = await fetchResource(origin + path, fetchOptions);
      assert.equal(response.status, 200, `${path} should resolve the SPA.`);
      assert.match(response.headers.get('content-type') || '', /text\/html/);
      const html = response.bytes.toString();
      assertLegacyHtml(html);
      if (index) assert.equal(html, index);
      else index = html;
    }
    const assets = [...index.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(
      (match) => match[1],
    );
    assert.ok(
      assets.some((path) => path.endsWith('.js')),
      'Built JS asset not found.',
    );
    for (const path of assets) {
      const response = await fetchResource(origin + path, fetchOptions);
      assert.equal(response.status, 200);
      assert.ok(response.bytes.length > 0);
      assert.match(
        response.headers.get('content-type') || '',
        path.endsWith('.js') ? /javascript/ : /text\/css/,
      );
    }
  }
  for (const file of Object.values(manifest.files)) {
    const response = await fetchResource(origin + file.path, fetchOptions);
    assert.equal(response.status, 200);
    assert.equal(sha256(response.bytes), file.sha256, `Asset hash differs: ${file.path}`);
    if (file.path === manifest.files.snapshot.path)
      assert.deepEqual(
        sorted(all.stores),
        sorted(JSON.parse(response.bytes.toString()).stores),
        'API must match the hashed source snapshot.',
      );
  }
  assert.deepEqual(await get('/friendly/manifest.json'), manifest);
  return {
    url: origin,
    sourceSha: expectedSha,
    dataVersion: manifest.version,
    storeCount: all.stores.length,
    snapshotSha256: manifest.files.snapshot.sha256,
    checkedAt: new Date().toISOString(),
    ...appResult,
  };
}

if (isMain(import.meta.url)) {
  try {
    const args = parseFlags(process.argv.slice(2));
    if (Object.keys(args).some((key) => !['url', 'sha', 'data-dir'].includes(key)))
      throw new Error('Unknown smoke option.');
    const directory = resolve(ROOT, args['data-dir'] || 'data/friendly');
    const manifest = await readJson(resolve(directory, 'manifest.json'));
    const snapshot = await readJson(resolve(directory, 'snapshot.json'));
    const appManifest = await readJson(resolve(ROOT, 'dist/app/app-manifest.json'));
    console.log(
      JSON.stringify(
        await smokePlatform({
          url: args.url,
          expectedSha: args.sha,
          manifest,
          stores: snapshot.stores,
          appManifest,
        }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(`Smoke failed: ${error.message}`);
    process.exitCode = 1;
  }
}
