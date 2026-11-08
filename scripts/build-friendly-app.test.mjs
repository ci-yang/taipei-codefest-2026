import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { buildFriendlyApp } from './build-friendly-app.mjs';
import { ROOT, runCommand, sha256 } from './platform-tools.mjs';

const sourceSha = 'a'.repeat(40);

async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'friendly-app-build-test-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  for (const path of [
    'tools/package-friendly-prototype.py',
    'docs/prototypes/friendly-route',
    'data/friendly',
    'wrangler.jsonc',
  ]) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await cp(resolve(ROOT, path), resolve(root, path), { recursive: true });
  }
  return root;
}

async function artifactPaths(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      result.push(...(await artifactPaths(join(directory, entry.name), name)));
    else result.push(`/${name}`);
  }
  return result.sort();
}

test('real App build contains only runtime, licenses, compatibility data and deployment metadata', async (context) => {
  const root = await fixture(context);
  const output = join(root, 'dist/app');
  await mkdir(join(output, 'assets'), { recursive: true });
  await writeFile(join(output, 'assets/old-vue.js'), 'old Vue bundle');
  await writeFile(join(output, 'analysis.html'), 'old analysis page');
  const manifest = await buildFriendlyApp({ root, env: { APP_BUILD_SHA: sourceSha } });
  const persisted = JSON.parse(await readFile(join(output, 'app-manifest.json'), 'utf8'));
  assert.deepEqual(persisted, manifest);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.app, 'friendly-resource');
  assert.equal(manifest.sourceSha, sourceSha);
  assert.match(manifest.offlineVersion, /^friendly-resource-v6-[a-f0-9]{16}$/);
  const html = await readFile(join(output, 'index.html'), 'utf8');
  assert.match(html, /<main id="app" class="friendly-app"/);
  assert.ok(html.includes(`<meta name="app-build-sha" content="${sourceSha}">`));
  assert.doesNotMatch(html, /\/assets\/|analysis\.html|spec\.html/);
  const linked = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)].map((match) => `/${match[1]}`);
  const expected = [
    ...linked,
    '/index.html',
    '/sw.js',
    '/routing-worker.js',
    '/routing.js',
    '/routing-data.js',
    '/NOTICE.txt',
    '/LICENSE.txt',
    '/vendor/LICENSE-leaflet.txt',
    '/_headers',
    '/_redirects',
    '/friendly/snapshot.json',
    '/friendly/routing-graph.json',
    '/friendly/map-data.geojson',
    '/friendly/manifest.json',
  ].sort();
  assert.deepEqual(
    manifest.files.map((file) => file.path),
    expected,
  );
  assert.deepEqual(await artifactPaths(output), [...expected, '/app-manifest.json'].sort());
  for (const file of manifest.files) {
    const bytes = await readFile(join(output, file.path.slice(1)));
    assert.equal(file.sha256, sha256(bytes), file.path);
    assert.equal(file.bytes, bytes.length, file.path);
  }
  for (const path of ['sw.js', 'offline.js']) {
    const script = await readFile(join(output, path), 'utf8');
    assert.ok(script.includes(manifest.offlineVersion));
    assert.ok(!script.includes('friendly-resource-v6-20261107'));
  }
  const headers = await readFile(join(output, '_headers'), 'utf8');
  assert.match(headers, /\/sw\.js\n {2}Cache-Control: no-cache\n {2}Service-Worker-Allowed: \//);
  const redirects = await readFile(join(output, '_redirects'), 'utf8');
  for (const path of [
    '/map',
    '/map/*',
    '/about',
    '/about/*',
    '/analysis',
    '/analysis.html',
    '/spec',
    '/spec.html',
  ])
    assert.ok(redirects.split('\n').includes(`${path} / 302`));
  assert.equal(
    (await readdir(join(root, 'dist'))).some((name) => name.startsWith('.app-build-')),
    false,
  );
});

test('production SHA changes invalidate offline cache; equal inputs give an identical manifest', async (context) => {
  const root = await fixture(context);
  const first = await buildFriendlyApp({
    root,
    env: { APP_BUILD_SHA: sourceSha, GITHUB_SHA: 'b'.repeat(40) },
  });
  const repeat = await buildFriendlyApp({ root, env: { APP_BUILD_SHA: sourceSha } });
  assert.deepEqual(repeat, first);
  assert.equal(first.sourceSha, sourceSha, 'Explicit release SHA must override runner SHA.');
  const next = await buildFriendlyApp({ root, env: { GITHUB_SHA: 'b'.repeat(40) } });
  assert.equal(next.sourceSha, 'b'.repeat(40));
  assert.notEqual(next.offlineVersion, first.offlineVersion);
  for (const path of ['/index.html', '/sw.js', '/offline.js'])
    assert.notEqual(
      next.files.find((file) => file.path === path).sha256,
      first.files.find((file) => file.path === path).sha256,
    );
});

test('invalid SHA or mismatched canonical data cannot replace an existing artifact', async (context) => {
  const root = await fixture(context);
  const output = join(root, 'dist/app');
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'keep.txt'), 'previous good artifact');
  await assert.rejects(
    buildFriendlyApp({ root, env: { APP_BUILD_SHA: 'not-a-commit' } }),
    /full commit SHA/,
  );
  await writeFile(join(root, 'data/friendly/snapshot.json'), '{}');
  await assert.rejects(
    buildFriendlyApp({ root, env: { APP_BUILD_SHA: sourceSha } }),
    /does not match manifest/,
  );
  assert.equal(await readFile(join(output, 'keep.txt'), 'utf8'), 'previous good artifact');
});

test('generated output refuses symlinked directories rather than deleting their targets', async (context) => {
  const root = await fixture(context);
  const outside = join(root, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'keep.txt'), 'untouched');
  await symlink(outside, join(root, 'dist'));
  await assert.rejects(
    buildFriendlyApp({ root, env: { APP_BUILD_SHA: sourceSha } }),
    /real directory/,
  );
  assert.equal(await readFile(join(outside, 'keep.txt'), 'utf8'), 'untouched');
});

test('the original share packager still works without a build SHA and includes Leaflet license', async (context) => {
  const root = await fixture(context);
  const output = join(root, 'share');
  const args = [join(root, 'tools/package-friendly-prototype.py'), output];
  await runCommand('python3', args, { cwd: root });
  assert.equal(
    await readFile(join(output, 'index.html'), 'utf8'),
    await readFile(join(root, 'docs/prototypes/friendly-route/index.html'), 'utf8'),
  );
  assert.match(
    await readFile(join(output, 'vendor/LICENSE-leaflet.txt'), 'utf8'),
    /BSD 2-Clause License/,
  );
  assert.ok(!(await artifactPaths(output)).includes('/app-manifest.json'));
  // 打包白名單 28 項 = sw.js 離線清單 27 項 − 首頁別名 '.' ＋ sw.js 本身 ＋ vendor/LICENSE-leaflet.txt；兩份清單的差異是刻意的。
  const packaged = await artifactPaths(output);
  assert.equal(packaged.length, 28);
  for (const path of ['/urgency.js', '/i18n.js', '/speak-card-strings.js', '/speak-card.js', '/speak-card.css']) assert.ok(packaged.includes(path), path);
  assert.ok(!packaged.includes('/speak-card-demo.html'));
  const sw = await readFile(join(output, 'sw.js'), 'utf8');
  await runCommand('python3', args, { cwd: root });
  assert.equal(await readFile(join(output, 'sw.js'), 'utf8'), sw);
});
