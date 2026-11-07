import assert from 'node:assert/strict';
import { sha256 } from './platform-tools.mjs';

export const APP_FILES = [
  '/index.html',
  '/app.js',
  '/app-ui.css',
  '/icons.js',
  '/data.js',
  '/resources-data.js',
  '/search.js',
  '/bridge.js',
  '/offline.js',
  '/sw.js',
  '/vendor/leaflet.js',
  '/vendor/leaflet.css',
  '/vendor/LICENSE-leaflet.txt',
  '/NOTICE.txt',
  '/LICENSE.txt',
  '/_headers',
  '/_redirects',
  '/friendly/snapshot.json',
  '/friendly/routing-graph.json',
  '/friendly/map-data.geojson',
  '/friendly/manifest.json',
];
const configurationFiles = new Set(['/_headers', '/_redirects']);
const requiredAppFiles = ['/index.html', '/app.js', '/offline.js', '/sw.js'];

// Schema 1 is a historical receipt contract, independent of today's build inventory.
export function validateAppManifest(value, expectedSha) {
  assert.ok(
    value && value.schemaVersion === 1 && value.app === 'friendly-resource',
    'App manifest is required.',
  );
  assert.match(value.sourceSha || '', /^[a-f0-9]{40}$/);
  assert.equal(value.sourceSha, expectedSha, 'App manifest source SHA differs.');
  assert.match(value.offlineVersion || '', /^friendly-resource-v[1-9][0-9]*-[a-f0-9]{16}$/);
  assert.ok(Array.isArray(value.files), 'App manifest files are required.');
  const paths = new Set();
  for (const file of value.files) {
    assert.ok(file && typeof file.path === 'string', 'App asset path is required.');
    assert.ok(
      /^\/[a-zA-Z0-9._/-]+$/.test(file.path) &&
        file.path
          .slice(1)
          .split('/')
          .every((segment) => segment && !['.', '..'].includes(segment)) &&
        file.path !== '/app-manifest.json',
      `Unsafe App asset path: ${file.path}`,
    );
    assert.ok(!paths.has(file.path), `Duplicate App asset path: ${file.path}`);
    paths.add(file.path);
    assert.match(file.sha256 || '', /^[a-f0-9]{64}$/);
    assert.ok(
      Number.isSafeInteger(file.bytes) && file.bytes > 0,
      `Invalid asset size: ${file.path}`,
    );
  }
  for (const path of requiredAppFiles)
    assert.ok(paths.has(path), `Required App entry is missing: ${path}`);
  return value;
}

export function validateCurrentAppManifest(value, expectedSha) {
  validateAppManifest(value, expectedSha);
  assert.match(value.offlineVersion, /^friendly-resource-v6-[a-f0-9]{16}$/);
  assert.deepEqual(
    value.files.map((file) => file.path).sort(),
    [...APP_FILES].sort(),
    'App artifact must contain only its current runtime and compatibility assets.',
  );
  return value;
}

export function assertAppHtml(html, expectedSha) {
  assert.match(html, /<main\b[^>]*\bid="app"[^>]*\bclass="friendly-app"/);
  assert.match(html, /id="category-filters"/);
  assert.match(html, /id="search-trigger"/);
  assert.match(
    html,
    new RegExp(`<meta\\b(?=[^>]*name="app-build-sha")(?=[^>]*content="${expectedSha}")[^>]*>`),
  );
  assert.doesNotMatch(html, /src="\/assets\//, 'Legacy Vue shell cannot pass App smoke.');
}

export function assertLegacyHtml(html) {
  assert.match(
    html,
    /<div id="app"><\/div>/,
    'Unknown previous frontend; cannot classify as legacy Vue.',
  );
  assert.match(html, /src="\/assets\/[^"?#]+\.js"/, 'Previous legacy Vue bundle is missing.');
  assert.doesNotMatch(
    html,
    /app-build-sha|friendly-app|category-filters/,
    'An App cannot fall back to legacy smoke.',
  );
}

const assetContentTypes = new Map([
  ['js', /javascript/],
  ['mjs', /javascript/],
  ['css', /text\/css/],
  ['html', /text\/html/],
  ['json', /application\/(?:geo\+)?json/],
  ['geojson', /application\/(?:geo\+)?json/],
  ['txt', /text\/plain/],
  ['svg', /image\/svg\+xml/],
  ['png', /image\/png/],
  ['jpg', /image\/jpeg/],
  ['jpeg', /image\/jpeg/],
  ['gif', /image\/gif/],
  ['webp', /image\/webp/],
  ['avif', /image\/avif/],
  ['ico', /image\/(?:x-icon|vnd\.microsoft\.icon)/],
  ['woff', /(?:font\/woff|application\/font-woff)/],
  ['woff2', /font\/woff2/],
  ['wasm', /application\/wasm/],
]);

function assertContentType(path, value) {
  const expected = assetContentTypes.get(path.split('.').at(-1).toLowerCase());
  if (expected) assert.match(value || '', expected, `Wrong content type: ${path}`);
  else {
    // A schema 1 historical manifest may contain asset types introduced after this verifier.
    assert.ok(value, `Missing content type: ${path}`);
    assert.doesNotMatch(
      value,
      /(?:text\/html|application\/xhtml\+xml)/i,
      `Unexpected HTML asset: ${path}`,
    );
  }
}

export async function smokeAppShell({
  origin,
  expectedSha,
  appManifest,
  fetchResource,
  fetchJson,
  fetchOptions,
}) {
  validateAppManifest(appManifest, expectedSha);
  const remote = await fetchJson(origin + '/app-manifest.json', fetchOptions);
  assert.deepEqual(remote, appManifest, 'Published App manifest differs from the built artifact.');
  const response = await fetchResource(origin + '/', fetchOptions);
  assert.equal(response.status, 200);
  assertContentType('/index.html', response.headers.get('content-type'));
  const html = response.bytes.toString();
  assertAppHtml(html, expectedSha);
  for (const file of appManifest.files) {
    if (configurationFiles.has(file.path)) continue;
    const asset =
      file.path === '/index.html'
        ? response
        : await fetchResource(origin + file.path, fetchOptions);
    assert.equal(asset.status, 200, `Missing App asset: ${file.path}`);
    assertContentType(file.path, asset.headers.get('content-type'));
    assert.equal(asset.bytes.length, file.bytes, `App asset size differs: ${file.path}`);
    assert.equal(sha256(asset.bytes), file.sha256, `App asset hash differs: ${file.path}`);
    if (['/sw.js', '/offline.js'].includes(file.path))
      assert.ok(
        asset.bytes.toString().includes(`const VERSION = '${appManifest.offlineVersion}'`),
        `Offline version differs: ${file.path}`,
      );
    if (file.path === '/sw.js') {
      assert.match(asset.headers.get('cache-control') || '', /no-cache/);
      assert.equal(asset.headers.get('service-worker-allowed'), '/');
    }
  }
  for (const path of ['/map', '/map/', '/about', '/about/', '/analysis.html', '/spec.html']) {
    const redirect = await fetchResource(origin + path, { ...fetchOptions, redirect: 'manual' });
    assert.equal(redirect.status, 302, `Legacy entry should redirect: ${path}`);
    assert.equal(
      new URL(redirect.headers.get('location'), origin).href,
      origin + '/',
      'Legacy entry must redirect to the same App root.',
    );
  }
  for (const path of ['/nonexistent-spa-route', '/missing-runtime.js']) {
    const missing = await fetchResource(origin + path, fetchOptions);
    assert.equal(missing.status, 404, 'Missing paths must not receive a successful HTML fallback.');
  }
  return {
    app: appManifest.app,
    offlineVersion: appManifest.offlineVersion,
    appAssetCount: appManifest.files.length,
  };
}
