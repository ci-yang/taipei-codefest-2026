import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { ROOT, readJson, sha256 } from './platform-tools.mjs';
import { APP_FILES } from './app-shell-smoke.mjs';
import { smokePlatform } from './smoke-platform.mjs';

const manifest = await readJson(resolve(ROOT, 'data/friendly/manifest.json'));
const snapshot = await readJson(resolve(ROOT, 'data/friendly/snapshot.json'));
const sha = 'a'.repeat(40);
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

const offlineVersion = 'friendly-resource-v6-0123456789abcdef';
const appBytes = new Map(
  await Promise.all(
    APP_FILES.map(async (path) => {
      let bytes;
      if (['/_headers', '/_redirects'].includes(path))
        bytes = Buffer.from('test configuration fixture');
      else if (path.startsWith('/friendly/'))
        bytes = await readFile(resolve(ROOT, 'data/friendly', basename(path)));
      else bytes = await readFile(resolve(ROOT, 'docs/prototypes/friendly-route', path.slice(1)));
      if (path === '/index.html')
        bytes = Buffer.from(
          bytes
            .toString()
            .replace('</head>', `<meta name="app-build-sha" content="${sha}"></head>`),
        );
      if (['/sw.js', '/offline.js'].includes(path))
        bytes = Buffer.from(
          bytes.toString().replaceAll('friendly-resource-v6-20261107', offlineVersion),
        );
      return [path, bytes];
    }),
  ),
);
const appManifest = {
  schemaVersion: 1,
  app: 'friendly-resource',
  sourceSha: sha,
  offlineVersion,
  files: [...appBytes].map(([path, bytes]) => ({
    path,
    bytes: bytes.length,
    sha256: sha256(bytes),
  })),
};
function fixtureFetch({
  stale = false,
  fakeStore = false,
  andServices = false,
  app = false,
  corruptAsset = false,
  wrongShell = false,
  badRedirect = false,
  htmlAsset = false,
  missingFallback = false,
  runtimeBytes = appBytes,
  runtimeManifest = appManifest,
  contentTypes = {},
} = {}) {
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
    if (url.pathname === '/api/v1/sources') return json(manifest);
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
    if (app) {
      if (url.pathname === '/app-manifest.json') return json(runtimeManifest);
      if (
        ['/map', '/map/', '/about', '/about/', '/analysis.html', '/spec.html'].includes(
          url.pathname,
        )
      )
        return new Response(null, {
          status: 302,
          headers: { location: badRedirect ? 'https://wrong.example/' : '/' },
        });
      const path = url.pathname === '/' ? '/index.html' : url.pathname;
      const bytes = runtimeBytes.get(path);
      if (!bytes)
        return new Response(missingFallback ? runtimeBytes.get('/index.html') : 'Not found', {
          status: missingFallback ? 200 : 404,
        });
      const type = path.endsWith('.js')
        ? 'application/javascript'
        : path.endsWith('.css')
          ? 'text/css'
          : path.endsWith('.html')
            ? 'text/html'
            : 'text/plain';
      const headers = {
        'content-type': htmlAsset && path === '/app.js' ? 'text/html' : contentTypes[path] || type,
      };
      if (path === '/sw.js')
        Object.assign(headers, { 'cache-control': 'no-cache', 'service-worker-allowed': '/' });
      return new Response(
        wrongShell && path === '/index.html'
          ? '<div id="app"></div><script src="/assets/old.js"></script>'
          : corruptAsset && path === '/app.js'
            ? Buffer.alloc(bytes.length)
            : bytes,
        { headers },
      );
    }
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
    allowLegacy: true,
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
      allowLegacy: true,
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
      allowLegacy: true,
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
      allowLegacy: true,
      fetchOptions: { fetchImpl: fixtureFetch({ andServices: true }), retries: 0 },
    }),
    /OR semantics/,
  );
});

test('App smoke verifies the exact entry, runtime hashes, offline version and canonical redirects', async () => {
  const result = await smokePlatform({
    url: 'https://example.test',
    expectedSha: sha,
    manifest,
    appManifest,
    fetchOptions: { fetchImpl: fixtureFetch({ app: true }), retries: 0 },
  });
  assert.equal(result.app, 'friendly-resource');
  assert.equal(result.offlineVersion, offlineVersion);
});

test('new frontend smoke cannot silently fall back to the legacy Vue shell', async () => {
  await assert.rejects(
    smokePlatform({
      url: 'https://example.test',
      expectedSha: sha,
      manifest,
      fetchOptions: { fetchImpl: fixtureFetch(), retries: 0 },
    }),
    /App manifest is required/,
  );
});

test('wrong App entry, corrupt asset, HTML asset and off-origin redirects cannot pass smoke', async () => {
  for (const failure of [
    'wrongShell',
    'corruptAsset',
    'htmlAsset',
    'badRedirect',
    'missingFallback',
  ]) {
    await assert.rejects(
      smokePlatform({
        url: 'https://example.test',
        expectedSha: sha,
        manifest,
        appManifest,
        fetchOptions: { fetchImpl: fixtureFetch({ app: true, [failure]: true }), retries: 0 },
      }),
      undefined,
      failure,
    );
  }
});

test('historical App smoke follows its own inventory and version while new builds stay strict', async () => {
  for (const version of [5, 7]) {
    const historicalVersion = `friendly-resource-v${version}-0123456789abcdef`;
    const runtimeBytes = new Map(appBytes);
    // In this historical fixture search was bundled into app.js, not a separate file.
    runtimeBytes.set(
      '/app.js',
      Buffer.concat([appBytes.get('/search.js'), appBytes.get('/app.js')]),
    );
    runtimeBytes.delete('/search.js');
    runtimeBytes.set(
      '/index.html',
      Buffer.from(
        appBytes.get('/index.html').toString().replace('<script src="./search.js"></script>', ''),
      ),
    );
    runtimeBytes.set('/release-notes.txt', Buffer.from('Historical release fixture.'));
    runtimeBytes.set(
      '/icons/resource.svg',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    );
    runtimeBytes.set('/map.data', Buffer.from('Historical binary fixture.'));
    const contentTypes = {
      '/icons/resource.svg': 'image/svg+xml',
      '/map.data': 'application/octet-stream',
    };
    for (const path of ['/sw.js', '/offline.js'])
      runtimeBytes.set(
        path,
        Buffer.from(
          appBytes
            .get(path)
            .toString()
            .replaceAll(offlineVersion, historicalVersion)
            .replaceAll("'./search.js',", ''),
        ),
      );
    const historicalManifest = {
      ...appManifest,
      offlineVersion: historicalVersion,
      files: [...runtimeBytes].map(([path, bytes]) => ({
        path,
        bytes: bytes.length,
        sha256: sha256(bytes),
      })),
    };
    const options = {
      url: 'https://example.test',
      expectedSha: sha,
      manifest,
      appManifest: historicalManifest,
      fetchOptions: {
        fetchImpl: fixtureFetch({
          app: true,
          runtimeBytes,
          runtimeManifest: historicalManifest,
          contentTypes,
        }),
        retries: 0,
      },
    };
    const result = await smokePlatform({ ...options, appManifestMode: 'historical' });
    assert.equal(result.offlineVersion, historicalVersion);
    await assert.rejects(smokePlatform(options));
    contentTypes['/map.data'] = 'text/html';
    await assert.rejects(
      smokePlatform({ ...options, appManifestMode: 'historical' }),
      /Unexpected HTML asset/,
    );
    contentTypes['/map.data'] = 'application/octet-stream';
    runtimeBytes.set('/release-notes.txt', Buffer.from('corrupted historical file'));
    await assert.rejects(
      smokePlatform({ ...options, appManifestMode: 'historical' }),
      /App asset (size|hash) differs/,
    );
  }
});

test('historical smoke accepts changed DOM and offline declaration syntax; current smoke rejects both', async () => {
  for (const change of ['dom', 'syntax']) {
    const runtimeBytes = new Map(appBytes);
    if (change === 'dom')
      runtimeBytes.set(
        '/index.html',
        Buffer.from(
          appBytes
            .get('/index.html')
            .toString()
            .replaceAll('<main', '<section')
            .replaceAll('</main>', '</section>')
            .replaceAll('category-filters', 'resource-categories')
            .replaceAll('search-trigger', 'destination-search'),
        ),
      );
    else
      for (const path of ['/sw.js', '/offline.js'])
        runtimeBytes.set(
          path,
          Buffer.from(
            appBytes
              .get(path)
              .toString()
              .replace(/\bVERSION\b/g, 'CACHE_VERSION')
              .replace(
                `const CACHE_VERSION = '${offlineVersion}'`,
                `const CACHE_VERSION = "${offlineVersion}"`,
              ),
          ),
        );
    const runtimeManifest = {
      ...appManifest,
      files: [...runtimeBytes].map(([path, bytes]) => ({
        path,
        bytes: bytes.length,
        sha256: sha256(bytes),
      })),
    };
    const options = {
      url: 'https://example.test',
      expectedSha: sha,
      manifest,
      appManifest: runtimeManifest,
      fetchOptions: {
        fetchImpl: fixtureFetch({ app: true, runtimeBytes, runtimeManifest }),
        retries: 0,
      },
    };
    const result = await smokePlatform({ ...options, appManifestMode: 'historical' });
    assert.equal(result.offlineVersion, offlineVersion);
    await assert.rejects(
      smokePlatform(options),
      change === 'syntax' ? /Offline version differs/ : undefined,
    );
    runtimeBytes.set(
      '/index.html',
      Buffer.from(runtimeBytes.get('/index.html').toString().replace('description', 'descriptioX')),
    );
    await assert.rejects(
      smokePlatform({ ...options, appManifestMode: 'historical' }),
      /Historical App entry hash differs/,
    );
  }
});
