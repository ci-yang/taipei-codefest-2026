import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, WRANGLER, currentVersion, readJson, validateOrigin } from './platform-tools.mjs';
import { fetchJson, fetchResource } from './smoke-platform.mjs';
import {
  assertAppHtml,
  assertLegacyHtml,
  validateAppManifest,
  validateCurrentAppManifest,
} from './app-shell-smoke.mjs';

export async function loadReleaseConfig(path = resolve(ROOT, 'wrangler.jsonc')) {
  const config = await readJson(path);
  if (
    !/^[a-f0-9]{32}$/.test(config.account_id) ||
    !/^[a-z0-9-]+$/.test(config.name) ||
    config.env ||
    config.routes?.length ||
    config.route ||
    config.workers_dev !== true
  )
    throw new Error('Release only supports the configured standalone workers.dev environment.');
  if (config.d1_databases?.length !== 1 || config.d1_databases[0].binding !== 'FRIENDLY_DB')
    throw new Error('Expected the dedicated FRIENDLY_DB binding.');
  if (config.assets?.directory !== './dist/app' && config.assets?.directory !== 'dist/app')
    throw new Error('Release assets must be scoped to dist/app.');
  const origin = validateOrigin(config.vars?.PUBLIC_ORIGIN);
  const target = new URL(origin);
  const labels = target.hostname.split('.');
  if (
    labels.length !== 4 ||
    labels[0] !== config.name ||
    !labels[1] ||
    labels[2] !== 'workers' ||
    labels[3] !== 'dev' ||
    target.port
  )
    throw new Error('PUBLIC_ORIGIN must name this Worker on its exact workers.dev hostname.');
  return {
    path,
    name: config.name,
    accountId: config.account_id,
    database: 'FRIENDLY_DB',
    dataVersion: config.vars.DATA_VERSION,
    origin,
  };
}

export function requireReleaseOrigin(config, value) {
  const origin = validateOrigin(value);
  if (origin !== config.origin)
    throw new Error('Release URL must match the configured PUBLIC_ORIGIN.');
  return origin;
}

export async function loadReleaseData(config, dependencies = {}) {
  const directory = resolve(ROOT, 'data/friendly');
  const manifest = dependencies.manifest || (await readJson(resolve(directory, 'manifest.json')));
  const snapshot = dependencies.snapshot || (await readJson(resolve(directory, 'snapshot.json')));
  if (manifest.version !== config.dataVersion || snapshot.version !== manifest.version)
    throw new Error('Wrangler DATA_VERSION and canonical data version differ.');
  return { manifest, snapshot };
}

export async function loadReleaseApp(sourceSha, dependencies = {}) {
  const manifest = Object.hasOwn(dependencies, 'appManifest')
    ? dependencies.appManifest
    : await readJson(resolve(ROOT, 'dist/app/app-manifest.json'));
  return validateCurrentAppManifest(manifest, sourceSha);
}

export async function readVersion(run, config, allowMissing = false) {
  try {
    const { stdout } = await run(WRANGLER, [
      'deployments',
      'list',
      '--config',
      config.path,
      '--name',
      config.name,
      '--json',
    ]);
    return currentVersion(JSON.parse(stdout));
  } catch (error) {
    // Cloudflare code 10007 means the script does not exist. Auth/network/other failures are never first deploys.
    if (allowMissing && /\[code: 10007\]/.test(error.output || '')) return null;
    throw error;
  }
}

export async function assertVersion(run, config, expected) {
  const actual = await readVersion(run, config, expected === null);
  if (actual !== expected)
    throw new Error('Worker version changed externally; refusing mutation or automatic rollback.');
}

export async function capturePrevious(url, versionId, fetchOptions = {}) {
  if (!versionId) return null;
  const [config, health, manifest] = await Promise.all([
    fetchJson(url + '/config', fetchOptions),
    fetchJson(url + '/healthz', fetchOptions),
    fetchJson(url + '/api/v1/sources', fetchOptions),
  ]);
  if (
    !health.ok ||
    health.data !== 'ready' ||
    health.version !== config.version ||
    manifest.version !== config.dataVersion ||
    manifest.version !== health.dataVersion
  )
    throw new Error('Previous Worker is not data-ready; cannot record a safe rollback target.');
  const [root, app] = await Promise.all([
    fetchResource(url + '/', fetchOptions),
    fetchResource(url + '/app-manifest.json', fetchOptions),
  ]);
  assert.equal(root.status, 200, 'Previous frontend is unavailable.');
  assert.match(root.headers.get('content-type') || '', /text\/html/);
  const html = root.bytes.toString();
  let appManifest = null;
  if (app.status === 200 && /application\/json/.test(app.headers.get('content-type') || '')) {
    appManifest = validateAppManifest(JSON.parse(app.bytes.toString()), config.version);
    assertAppHtml(html, config.version);
  } else {
    assertLegacyHtml(html);
    assert.ok(
      app.status === 404 ||
        (app.status === 200 &&
          /text\/html/.test(app.headers.get('content-type') || '') &&
          app.bytes.equals(root.bytes)),
      'Previous App manifest is not safely classifiable.',
    );
  }
  return { versionId, sourceSha: config.version, manifest, appManifest };
}

export async function assertRollbackData(run, config, previous) {
  if (previous.appManifest !== undefined && previous.appManifest !== null)
    validateAppManifest(previous.appManifest, previous.sourceSha);
  const version = previous.manifest.version;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(version))
    throw new Error('Invalid rollback data version.');
  const sql = `SELECT manifest_json FROM friendly_snapshots WHERE version = '${version}';`;
  const { stdout } = await run(WRANGLER, [
    'd1',
    'execute',
    config.database,
    '--config',
    config.path,
    '--remote',
    '--command',
    sql,
    '--json',
  ]);
  const response = JSON.parse(stdout);
  if (!Array.isArray(response) || response.length !== 1 || response[0].results?.length !== 1)
    throw new Error('Previous D1 snapshot is unavailable; refusing rollback.');
  assert.deepEqual(
    JSON.parse(response[0].results[0].manifest_json),
    previous.manifest,
    'Previous D1 snapshot has changed.',
  );
}

export async function writeReceipt(receipt, directory = resolve(ROOT, '.artifacts/releases')) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, `${receipt.id}.json`);
  await writeFile(path, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  return path;
}

export async function rollbackWorker(run, config, version) {
  if (!/^[a-f0-9-]{36}$/.test(version)) throw new Error('Invalid rollback Worker version.');
  await run(
    WRANGLER,
    [
      'rollback',
      version,
      '--config',
      config.path,
      '--name',
      config.name,
      '--message',
      'Restore verified prior platform version; D1 unchanged',
      '--yes',
    ],
    { timeoutMs: 180_000 },
  );
}

export async function rollbackRelease({ run, config, receipt, deployed, smoke, save }) {
  if (
    deployed.action !== 'deploy' ||
    deployed.accountId !== config.accountId ||
    deployed.workerName !== config.name ||
    !deployed.deployedVersion ||
    !deployed.previous?.versionId
  )
    throw new Error(
      'Receipt has no matching prior Worker; first deploy cannot roll back. Keep the GCP entry available.',
    );
  receipt.url = requireReleaseOrigin(config, deployed.url);
  receipt.previous = deployed.previous;
  receipt.fromVersion = deployed.deployedVersion;
  await assertVersion(run, config, deployed.deployedVersion);
  await assertRollbackData(run, config, deployed.previous);
  await assertVersion(run, config, deployed.deployedVersion);
  await save(receipt);
  await rollbackWorker(run, config, deployed.previous.versionId);
  await assertVersion(run, config, deployed.previous.versionId);
  receipt.smoke = await smoke({
    url: receipt.url,
    expectedSha: deployed.previous.sourceSha,
    manifest: deployed.previous.manifest,
    appManifest: deployed.previous.appManifest,
    appManifestMode: 'historical',
    allowLegacy: !deployed.previous.appManifest,
  });
  await assertVersion(run, config, deployed.previous.versionId);
  receipt.status = 'rolled-back';
}
