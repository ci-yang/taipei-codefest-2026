import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ROOT, isMain, runCommand, sha256 } from './platform-tools.mjs';

const compatFiles = [
  ['snapshot', 'snapshot.json'],
  ['routingGraph', 'routing-graph.json'],
  ['mapData', 'map-data.geojson'],
];
const headers = `/sw.js
  Cache-Control: no-cache
  Service-Worker-Allowed: /
/index.html
  Cache-Control: no-cache
/
  Cache-Control: no-cache
/app-manifest.json
  Cache-Control: no-cache
`;
const redirects =
  ['/map', '/map/*', '/about', '/about/*', '/analysis', '/analysis.html', '/spec', '/spec.html']
    .map((path) => `${path} / 302`)
    .join('\n') + '\n';

async function requireGeneratedDirectory(path) {
  try {
    const entry = await lstat(path);
    if (!entry.isDirectory() || entry.isSymbolicLink())
      throw new Error(`Generated output must be a real directory: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function collectFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      files.push(...(await collectFiles(join(directory, entry.name), relative)));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unexpected non-file in App artifact: ${relative}`);
  }
  return files.sort();
}

/** Replaces only this repository's generated dist/app after every source file is verified. */
export async function buildFriendlyApp({ root = ROOT, env = process.env } = {}) {
  const sourceSha =
    env.APP_BUILD_SHA ||
    env.GITHUB_SHA ||
    (await runCommand('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('App build requires a full commit SHA.');

  const source = resolve(root, 'data/friendly');
  const sourceManifestBytes = await readFile(join(source, 'manifest.json'));
  const sourceManifest = JSON.parse(sourceManifestBytes.toString('utf8'));
  const config = JSON.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8'));
  if (sourceManifest.version !== config.vars.DATA_VERSION)
    throw new Error('Friendly manifest version must match Wrangler DATA_VERSION.');
  const compatible = [];
  for (const [key, name] of compatFiles) {
    const bytes = await readFile(join(source, name));
    const record = sourceManifest.files?.[key];
    if (record?.path !== `/friendly/${name}` || record.sha256 !== sha256(bytes))
      throw new Error(`Canonical asset does not match manifest: ${name}`);
    compatible.push([name, bytes]);
  }
  compatible.push(['manifest.json', sourceManifestBytes]);

  const dist = resolve(root, 'dist');
  const output = join(dist, 'app');
  await requireGeneratedDirectory(dist);
  await requireGeneratedDirectory(output);
  await mkdir(dist, { recursive: true });
  const staged = await mkdtemp(join(dist, '.app-build-'));
  try {
    await runCommand(
      'python3',
      [resolve(root, 'tools/package-friendly-prototype.py'), staged, '--build-sha', sourceSha],
      { cwd: root },
    );
    const index = await readFile(join(staged, 'index.html'), 'utf8');
    if (
      !index.includes('<main id="app" class="friendly-app"') ||
      !index.includes(`<meta name="app-build-sha" content="${sourceSha}">`)
    )
      throw new Error('Root entry must be the stamped Friendly App.');
    const sw = await readFile(join(staged, 'sw.js'), 'utf8');
    const offline = await readFile(join(staged, 'offline.js'), 'utf8');
    const offlineVersion = sw.match(/friendly-resource-v6-[a-f0-9]{16}/)?.[0];
    if (!offlineVersion || !offline.includes(offlineVersion))
      throw new Error('Offline controller and service worker must share a content version.');
    await writeFile(join(staged, '_headers'), headers);
    await writeFile(join(staged, '_redirects'), redirects);
    await mkdir(join(staged, 'friendly'));
    for (const [name, bytes] of compatible) await writeFile(join(staged, 'friendly', name), bytes);
    const files = await Promise.all(
      (await collectFiles(staged)).map(async (name) => {
        const bytes = await readFile(join(staged, name));
        return { path: `/${name}`, sha256: sha256(bytes), bytes: bytes.length };
      }),
    );
    const manifest = {
      schemaVersion: 1,
      app: 'friendly-resource',
      sourceSha,
      offlineVersion,
      files,
    };
    await writeFile(join(staged, 'app-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await requireGeneratedDirectory(dist);
    await requireGeneratedDirectory(output);
    await rm(output, { recursive: true, force: true });
    await rename(staged, output);
    return manifest;
  } finally {
    await rm(staged, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) {
  try {
    const manifest = await buildFriendlyApp();
    console.log(
      `Built Friendly App ${manifest.sourceSha}: ${manifest.files.length} files, ${manifest.offlineVersion}`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
