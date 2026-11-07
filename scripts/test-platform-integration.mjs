import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ROOT, TSX, WRANGLER, isMain, readJson, runCommand, sha256 } from './platform-tools.mjs';
import { fetchJson, smokePlatform } from './smoke-platform.mjs';
import { startWorker, waitForPathnameLog } from './platform-local-worker.mjs';

export async function testPlatformIntegration({ build = true } = {}) {
  if (build)
    await runCommand('pnpm', ['run', 'platform:build'], {
      timeoutMs: 300_000,
      env: { ...process.env, VITE_API_BASE: '' },
    });
  const directory = await mkdtemp(resolve(tmpdir(), 'friendly-platform-integration-'));
  const persist = resolve(directory, 'd1');
  const sourceSha = (await runCommand('git', ['rev-parse', 'HEAD'])).stdout.trim();
  const sourceTreeDirty = Boolean(
    (await runCommand('git', ['status', '--porcelain=v1', '--untracked-files=all', '-z'])).stdout,
  );
  const manifest = await readJson(resolve(ROOT, 'data/friendly/manifest.json'));
  const snapshot = await readJson(resolve(ROOT, 'data/friendly/snapshot.json'));
  const importerArgs = [
    'scripts/import-friendly.ts',
    '--local',
    '--database',
    'FRIENDLY_DB',
    '--persist-to',
    persist,
    '--config',
    'wrangler.jsonc',
  ];
  let worker;
  try {
    await runCommand(WRANGLER, [
      'd1',
      'migrations',
      'apply',
      'FRIENDLY_DB',
      '--local',
      '--persist-to',
      persist,
      '--config',
      'wrangler.jsonc',
    ]);
    await runCommand(TSX, importerArgs);
    await runCommand(TSX, importerArgs);
    const { stdout } = await runCommand(WRANGLER, [
      'd1',
      'execute',
      'FRIENDLY_DB',
      '--local',
      '--persist-to',
      persist,
      '--config',
      'wrangler.jsonc',
      '--command',
      'SELECT COUNT(*) AS count FROM friendly_snapshots;',
      '--json',
    ]);
    assert.equal(
      JSON.parse(stdout)[0].results[0].count,
      1,
      'Repeated imports must not duplicate snapshots.',
    );

    const conflict = resolve(directory, 'conflicting-data');
    await cp(resolve(ROOT, 'data/friendly'), conflict, { recursive: true });
    const changed = structuredClone(snapshot);
    changed.stores[0].name += ' [integration conflict fixture]';
    const changedBytes = JSON.stringify(changed, null, 2) + '\n';
    await writeFile(resolve(conflict, 'snapshot.json'), changedBytes);
    const changedManifest = structuredClone(manifest);
    changedManifest.files.snapshot.sha256 = sha256(changedBytes);
    await writeFile(
      resolve(conflict, 'manifest.json'),
      JSON.stringify(changedManifest, null, 2) + '\n',
    );
    await assert.rejects(
      runCommand(TSX, [...importerArgs, '--data-dir', conflict]),
      (error) => /immutable|different|conflict|already exists/i.test(error.output || ''),
      'Same version with different content must be rejected.',
    );
    await runCommand(TSX, importerArgs);

    worker = await startWorker(persist, manifest.version, sourceSha);
    const result = await smokePlatform({
      url: worker.url,
      expectedSha: sourceSha,
      manifest,
      stores: snapshot.stores,
      fetchOptions: { retries: 0 },
    });
    const nearby = '/api/v1/friendly-stores?lat=25.044321&lng=121.529876&radius=123';
    worker.clearOutput();
    await fetchJson(worker.url + nearby);
    const capturedPathname = await waitForPathnameLog(worker.output);
    await worker.stop();
    worker = await startWorker(persist, 'integration-missing-version', sourceSha);
    const unhealthy = await fetchJson(worker.url + '/healthz', { retries: 0 }, 503);
    assert.equal(unhealthy.ok, false);
    assert.equal(unhealthy.data, 'unavailable');
    assert.ok((await fetchJson(worker.url + '/api/v1/friendly-stores', { retries: 0 }, 503)).error);
    assert.ok((await fetchJson(worker.url + '/api/v1/sources', { retries: 0 }, 503)).error);
    // Persisted original bytes were not changed by the rejected import.
    assert.equal(
      sha256(await readFile(resolve(ROOT, 'data/friendly/snapshot.json'))),
      manifest.files.snapshot.sha256,
    );
    return {
      ...result,
      sourceTreeDirty,
      capturedPathname,
      repeatedImport: 'passed',
      immutableConflict: 'passed',
      missingVersion: 'passed',
      spaFallback: 'passed',
      remoteWrites: false,
    };
  } finally {
    if (worker) await worker.stop();
    await rm(directory, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) {
  try {
    if (process.argv.slice(2).some((arg) => arg !== '--skip-build'))
      throw new Error('Only --skip-build is supported.');
    console.log(
      JSON.stringify(
        await testPlatformIntegration({ build: !process.argv.includes('--skip-build') }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(`Local platform integration failed: ${error.message}`);
    process.exitCode = 1;
  }
}
