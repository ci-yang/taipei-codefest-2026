import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ROOT, sha256 } from './platform-tools.mjs';
import { capturePrevious, loadReleaseApp, loadReleaseConfig } from './platform-release-state.mjs';
import { APP_FILES } from './app-shell-smoke.mjs';

test('release config pins the exact production origin to its Worker name', async () => {
  const config = await loadReleaseConfig();
  assert.equal(config.origin, 'https://taipei-friendly-platform.jason21131.workers.dev');
  assert.equal(new URL(config.origin).hostname.split('.')[0], config.name);
});

test('release config rejects an origin belonging to another Worker or non-workers.dev host', async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'release-config-test-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const source = JSON.parse(await readFile(resolve(ROOT, 'wrangler.jsonc'), 'utf8'));
  const path = resolve(directory, 'config.json');
  for (const origin of [
    'https://other-worker.jason21131.workers.dev',
    'https://taipei-friendly-platform.example.com',
    'https://taipei-friendly-platform.jason21131.workers.dev:444',
    'http://taipei-friendly-platform.jason21131.workers.dev',
  ]) {
    await writeFile(
      path,
      JSON.stringify({ ...source, vars: { ...source.vars, PUBLIC_ORIGIN: origin } }),
    );
    await assert.rejects(loadReleaseConfig(path));
  }
});

test('release config refuses the old Vue build directory', async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'release-app-config-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const source = JSON.parse(await readFile(resolve(ROOT, 'wrangler.jsonc'), 'utf8'));
  const path = resolve(directory, 'config.json');
  await writeFile(
    path,
    JSON.stringify({ ...source, assets: { ...source.assets, directory: 'apps/web/dist' } }),
  );
  await assert.rejects(loadReleaseConfig(path), /scoped to dist\/app/);
});

const sourceSha = 'a'.repeat(40);
const appHtml =
  '<main id="app" class="friendly-app"><div id="category-filters"></div><button id="search-trigger"></button></main>' +
  `<meta name="app-build-sha" content="${sourceSha}">`;
const appManifest = {
  schemaVersion: 1,
  app: 'friendly-resource',
  sourceSha,
  offlineVersion: 'friendly-resource-v6-0123456789abcdef',
  files: APP_FILES.map((path) => ({
    path,
    sha256: path === '/index.html' ? sha256(Buffer.from(appHtml)) : 'b'.repeat(64),
    bytes: path === '/index.html' ? Buffer.byteLength(appHtml) : 1,
  })),
};
const legacyHtml = '<div id="app"></div><script src="/assets/legacy.js"></script>';
function previousFetch({
  app = false,
  missing = false,
  broken = false,
  runtimeManifest = appManifest,
  runtimeHtml = appHtml,
} = {}) {
  return async (input) => {
    const path = new URL(input).pathname;
    const json = (value) =>
      new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
    if (path === '/config') return json({ version: sourceSha, dataVersion: 'fixture-v1' });
    if (path === '/healthz')
      return json({ ok: true, data: 'ready', version: sourceSha, dataVersion: 'fixture-v1' });
    if (path === '/api/v1/sources') return json({ version: 'fixture-v1' });
    if (path === '/app-manifest.json' && app && !missing)
      return json(broken ? { ...runtimeManifest, sourceSha: 'c'.repeat(40) } : runtimeManifest);
    return new Response(app ? runtimeHtml : legacyHtml, {
      headers: { 'content-type': 'text/html' },
    });
  };
}

test('rollback capture preserves the App manifest and recognizes an actual legacy Vue shell', async () => {
  const modern = await capturePrevious('https://example.test', 'version-id', {
    fetchImpl: previousFetch({ app: true }),
    retries: 0,
  });
  assert.deepEqual(modern.appManifest, appManifest);
  const legacy = await capturePrevious('https://example.test', 'version-id', {
    fetchImpl: previousFetch(),
    retries: 0,
  });
  assert.equal(legacy.appManifest, null);
});

test('broken or missing App manifests cannot masquerade as legacy rollback targets', async () => {
  for (const options of [
    { app: true, missing: true },
    { app: true, broken: true },
  ])
    await assert.rejects(
      capturePrevious('https://example.test', 'version-id', {
        fetchImpl: previousFetch(options),
        retries: 0,
      }),
    );
});

test('historical capture accepts changed safe inventories and cache versions but current builds reject them', async () => {
  for (const version of [5, 7]) {
    const runtimeManifest = {
      ...appManifest,
      offlineVersion: `friendly-resource-v${version}-0123456789abcdef`,
      files: [
        ...appManifest.files.filter((file) => file.path !== '/search.js'),
        { path: '/release-notes.txt', sha256: 'c'.repeat(64), bytes: 3 },
      ],
    };
    const result = await capturePrevious('https://example.test', 'version-id', {
      fetchImpl: previousFetch({ app: true, runtimeManifest }),
      retries: 0,
    });
    assert.deepEqual(result.appManifest, runtimeManifest);
    await assert.rejects(loadReleaseApp(sourceSha, { appManifest: runtimeManifest }));
  }
  await assert.rejects(
    loadReleaseApp(sourceSha, {
      appManifest: {
        ...appManifest,
        files: appManifest.files.filter((file) => file.path !== '/search.js'),
      },
    }),
    /current runtime/,
  );
});

test('historical capture rejects unsafe paths, duplicate entries, missing core files and malformed metadata', async () => {
  const extra = { path: '/extra.txt', sha256: 'c'.repeat(64), bytes: 1 };
  const unsafePaths = [
    'https://elsewhere.example/app.js',
    '//elsewhere.example/app.js',
    '/a/../app.js',
    '/a/./app.js',
    '/a//app.js',
    '/%2e%2e/app.js',
    '/a\\app.js',
    '/app.js?redirect=1',
    '/app.js#fragment',
    '/app.js\n',
    '/app-manifest.json',
  ];
  const invalid = [
    ...unsafePaths.map((path) => ({
      ...appManifest,
      files: [...appManifest.files, { ...extra, path }],
    })),
    { ...appManifest, files: [...appManifest.files, appManifest.files[0]] },
    { ...appManifest, files: appManifest.files.filter((file) => file.path !== '/index.html') },
    { ...appManifest, files: [...appManifest.files, { ...extra, sha256: 'invalid' }] },
    { ...appManifest, files: [...appManifest.files, { ...extra, bytes: -1 }] },
    { ...appManifest, schemaVersion: 2 },
    { ...appManifest, offlineVersion: "friendly-resource-v7-invalid'" },
  ];
  for (const runtimeManifest of invalid)
    await assert.rejects(
      capturePrevious('https://example.test', 'version-id', {
        fetchImpl: previousFetch({ app: true, runtimeManifest }),
        retries: 0,
      }),
    );
});

test('historical capture uses its hashed entry bytes instead of current DOM names', async () => {
  const runtimeHtml = `<!doctype html><meta name="app-build-sha" content="${sourceSha}"><section id="old-map"><form id="destination-search"></form></section>`;
  const withEntry = (html) => ({
    ...appManifest,
    files: appManifest.files.map((file) =>
      file.path === '/index.html'
        ? { ...file, bytes: Buffer.byteLength(html), sha256: sha256(Buffer.from(html)) }
        : file,
    ),
  });
  const runtimeManifest = withEntry(runtimeHtml);
  const captured = await capturePrevious('https://example.test', 'version-id', {
    fetchImpl: previousFetch({ app: true, runtimeManifest, runtimeHtml }),
    retries: 0,
  });
  assert.deepEqual(captured.appManifest, runtimeManifest);
  for (const [html, error] of [
    [runtimeHtml.replace('old-map', 'bad-map'), /entry hash differs/],
    [runtimeHtml + ' ', /entry size differs/],
  ])
    await assert.rejects(
      capturePrevious('https://example.test', 'version-id', {
        fetchImpl: previousFetch({ app: true, runtimeManifest, runtimeHtml: html }),
        retries: 0,
      }),
      error,
    );
  const wrongStamp = runtimeHtml.replace(sourceSha, 'b'.repeat(40));
  await assert.rejects(
    capturePrevious('https://example.test', 'version-id', {
      fetchImpl: previousFetch({
        app: true,
        runtimeManifest: withEntry(wrongStamp),
        runtimeHtml: wrongStamp,
      }),
      retries: 0,
    }),
  );
});
