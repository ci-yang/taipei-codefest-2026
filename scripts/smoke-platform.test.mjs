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

function streamedResponse(bytes, options) {
  let offset = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (offset === bytes.length) return controller.close();
        const end = Math.min(offset + 64 * 1024, bytes.length);
        controller.enqueue(bytes.subarray(offset, end));
        offset = end;
      },
    }),
    options,
  );
}

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
  streamAssetPath,
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
      const body =
        wrongShell && path === '/index.html'
          ? '<div id="app"></div><script src="/assets/old.js"></script>'
          : corruptAsset && path === '/app.js'
            ? Buffer.alloc(bytes.length)
            : bytes;
      return path === streamAssetPath
        ? streamedResponse(body, { headers })
        : new Response(body, { headers });
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

function assetFixture(path, bytes, declaredBytes = bytes.length) {
  return {
    app: true,
    runtimeBytes: new Map(appBytes).set(path, bytes),
    runtimeManifest: {
      ...appManifest,
      files: appManifest.files.map((file) =>
        file.path === path ? { ...file, bytes: declaredBytes, sha256: sha256(bytes) } : file,
      ),
    },
    streamAssetPath: path,
  };
}

function assetSmokeOptions(fixture, appManifestMode = 'current', fetchOptions = {}) {
  return {
    url: 'https://example.test',
    expectedSha: sha,
    manifest,
    appManifest: fixture.runtimeManifest,
    appManifestMode,
    fetchOptions: { fetchImpl: fixtureFetch(fixture), retries: 0, ...fetchOptions },
  };
}

test('App asset limits allow large streamed assets and root entries in current and historical smoke', async (context) => {
  assert.ok(appBytes.get('/routing-data.js').length > 8_000_000);
  for (const path of ['/routing-data.js', '/index.html']) {
    const original = appBytes.get(path);
    const bytes = Buffer.concat([
      original,
      Buffer.alloc(Math.max(0, 8_000_001 - original.length), ' '),
    ]);
    const fixture = assetFixture(path, bytes);
    for (const mode of ['current', 'historical'])
      await context.test(`${mode} ${path}`, async () => {
        const result = await smokePlatform(assetSmokeOptions(fixture, mode));
        assert.equal(result.app, 'friendly-resource');
      });
  }
});

test('App asset limits allow the exact 25 MiB asset ceiling', async () => {
  const fixture = assetFixture('/routing-data.js', Buffer.alloc(25 * 1024 * 1024, ' '));
  const result = await smokePlatform(assetSmokeOptions(fixture));
  assert.equal(result.app, 'friendly-resource');
});

test('App asset limits reject oversized manifest entries before any fetch', async (context) => {
  const fixture = assetFixture('/routing-data.js', Buffer.from('fixture'), 25 * 1024 * 1024 + 1);
  for (const mode of ['current', 'historical'])
    await context.test(mode, async () => {
      let fetched = false;
      await assert.rejects(
        smokePlatform(
          assetSmokeOptions(fixture, mode, {
            fetchImpl: async () => {
              fetched = true;
              throw new Error('Oversized manifest must fail before fetch.');
            },
          }),
        ),
        /Invalid asset size/,
      );
      assert.equal(fetched, false);
    });
});

test('App asset limits reject streamed bodies exceeding their declared size', async (context) => {
  for (const path of ['/app.js', '/index.html'])
    await context.test(path, async () => {
      const original = appBytes.get(path);
      const fixture = assetFixture(
        path,
        Buffer.concat([original, Buffer.from(' ')]),
        original.length,
      );
      await assert.rejects(
        smokePlatform(assetSmokeOptions(fixture)),
        /Response exceeds output limit/,
      );
    });
});

test('App asset limits reject a body over 25 MiB despite a valid manifest size', async () => {
  const fixture = assetFixture(
    '/routing-data.js',
    Buffer.alloc(25 * 1024 * 1024 + 1, ' '),
    25 * 1024 * 1024,
  );
  await assert.rejects(smokePlatform(assetSmokeOptions(fixture)), /Response exceeds output limit/);
});

test('App asset limits preserve a caller byte limit below the declared asset size', async (context) => {
  for (const path of ['/routing-data.js', '/index.html'])
    await context.test(path, async () => {
      const original = appBytes.get(path);
      const fixture = assetFixture(
        path,
        Buffer.concat([original, Buffer.alloc(Math.max(0, 8_000_001 - original.length), ' ')]),
      );
      await assert.rejects(
        smokePlatform(assetSmokeOptions(fixture, 'current', { maxBytes: 8_000_000 })),
        /Response exceeds output limit/,
      );
    });
});

test('App asset limits retain the default 8 MB API and App manifest limit', async (context) => {
  for (const path of ['/healthz', '/app-manifest.json'])
    await context.test(path, async () => {
      const fixture = assetFixture('/routing-data.js', appBytes.get('/routing-data.js'));
      const baseFetch = fixtureFetch(fixture);
      await assert.rejects(
        smokePlatform(
          assetSmokeOptions(fixture, 'current', {
            fetchImpl: async (input) => {
              const response = await baseFetch(input);
              if (new URL(input).pathname !== path) return response;
              const bytes = Buffer.from(await response.arrayBuffer());
              return streamedResponse(
                Buffer.concat([bytes, Buffer.alloc(8_000_001 - bytes.length, ' ')]),
                { headers: response.headers },
              );
            },
          }),
        ),
        /Response exceeds output limit/,
      );
    });
});

test('App asset limits still reject a large asset with a different hash', async () => {
  const path = '/routing-data.js';
  const fixture = assetFixture(path, Buffer.from(appBytes.get(path)));
  fixture.runtimeBytes.get(path)[0] ^= 1;
  await assert.rejects(smokePlatform(assetSmokeOptions(fixture)), /App asset hash differs/);
});

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
