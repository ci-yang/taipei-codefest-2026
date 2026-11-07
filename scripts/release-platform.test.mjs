import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { releasePlatform } from './release-platform.mjs';
import { readVersion } from './platform-release-state.mjs';
import { APP_FILES } from './app-shell-smoke.mjs';

const prior = '11111111-1111-1111-1111-111111111111';
const next = '22222222-2222-2222-2222-222222222222';
const external = '33333333-3333-3333-3333-333333333333';
const sourceSha = 'a'.repeat(40);
const ciEnv = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: sourceSha,
};
const config = {
  name: 'test-platform',
  accountId: 'a'.repeat(32),
  database: 'FRIENDLY_DB',
  path: 'wrangler.jsonc',
  dataVersion: 'fixture-v1',
  origin: 'https://test-platform.example.workers.dev',
};
const manifest = { version: 'fixture-v1', files: { snapshot: { sha256: 'b'.repeat(64) } } };
const appManifest = {
  schemaVersion: 1,
  app: 'friendly-resource',
  sourceSha,
  offlineVersion: 'friendly-resource-v6-0123456789abcdef',
  files: APP_FILES.map((path) => ({ path, sha256: 'd'.repeat(64), bytes: 1 })),
};

async function setup(context, { first = false, onBuild, onImport, smoke, env = {} } = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), 'release-test-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const state = {
    version: first ? null : prior,
    mainSha: sourceSha,
    calls: [],
    receipts: [],
    smokeCalls: 0,
  };
  const dependencies = {
    env,
    config,
    manifest,
    appManifest,
    snapshot: { version: manifest.version, stores: [] },
    lockPath: resolve(directory, 'lock'),
    save: async (receipt) => {
      state.receipts.push(structuredClone(receipt));
      return 'ignored-receipt.json';
    },
    capture: async (_, versionId) =>
      versionId ? { versionId, sourceSha: 'old-source', manifest } : null,
    smoke: async (args) => {
      state.smokeCalls++;
      return smoke ? smoke(state, args) : { passed: true };
    },
    run: async (command, args, options) => {
      state.calls.push({ command, args, options });
      if (command === 'git' && args[0] === 'ls-remote') {
        if (state.remoteFailure) throw new Error('Remote unavailable');
        return { stdout: `${state.mainSha}\trefs/heads/main\n` };
      }
      if (command === 'git') return { stdout: args[0] === 'status' ? '' : sourceSha };
      if (command === 'pnpm') {
        if (onBuild) onBuild(state);
        return { stdout: '' };
      }
      if (args[0] === 'deployments')
        return {
          stdout: JSON.stringify(
            state.version
              ? [
                  {
                    created_on: '2026-11-07T00:00:00Z',
                    versions: [{ version_id: state.version, percentage: 100 }],
                  },
                ]
              : [],
          ),
        };
      if (args[0] === 'deploy') {
        state.version = next;
        return { stdout: `Current Version ID: ${next}` };
      }
      if (args[0] === 'rollback') {
        state.version = args[1];
        return { stdout: '' };
      }
      if (args[0] === 'scripts/import-friendly.ts' && onImport) onImport(state);
      if (
        args.includes("SELECT manifest_json FROM friendly_snapshots WHERE version = 'fixture-v1';")
      )
        return {
          stdout: JSON.stringify([{ results: [{ manifest_json: JSON.stringify(manifest) }] }]),
        };
      return { stdout: '' };
    },
  };
  return { state, dependencies };
}

test('deploy records precise source/version, scopes build, imports remotely only after precondition', async (context) => {
  const { state, dependencies } = await setup(context);
  const result = await releasePlatform(
    'deploy',
    { url: 'https://test-platform.example.workers.dev' },
    dependencies,
  );
  assert.equal(result.receipt.status, 'deployed');
  assert.equal(result.receipt.deployedVersion, next);
  assert.equal(result.receipt.previous.versionId, prior);
  assert.equal(result.receipt.sourceSha, sourceSha);
  const build = state.calls.find((call) => call.command === 'pnpm');
  assert.deepEqual(build.args, ['run', 'platform:build']);
  assert.equal(build.options.env.VITE_API_BASE, '');
  assert.equal(build.options.env.APP_BUILD_SHA, sourceSha);
  assert.deepEqual(result.receipt.appManifest, appManifest);
  assert.ok(
    state.calls.find((call) => call.args[0] === 'deploy').args.includes(`BUILD_SHA:${sourceSha}`),
  );
  assert.ok(
    state.calls
      .find((call) => call.args[0] === 'scripts/import-friendly.ts')
      .args.includes('--remote'),
  );
  assert.equal(
    state.calls.some((call) => call.args[0] === 'ls-remote'),
    false,
  );
});

test('CI deploy checks the same checkout and current main before each mutation phase', async (context) => {
  const { state, dependencies } = await setup(context, { env: ciEnv });
  await releasePlatform('deploy', { url: config.origin }, dependencies);
  const mainChecks = state.calls.flatMap((call, index) =>
    call.args[0] === 'ls-remote' ? [index] : [],
  );
  assert.equal(mainChecks.length, 3);
  const build = state.calls.findIndex((call) => call.command === 'pnpm');
  const migration = state.calls.findIndex((call) => call.args.includes('migrations'));
  const upload = state.calls.findIndex((call) => call.args[0] === 'deploy');
  assert.ok(mainChecks[0] < build && mainChecks[1] > build && mainChecks[1] < migration);
  assert.ok(mainChecks[2] > migration && mainChecks[2] < upload);
});

test('CI main advancing during build prevents D1 mutation and Worker upload', async (context) => {
  const { state, dependencies } = await setup(context, {
    env: ciEnv,
    onBuild: (state) => {
      state.mainSha = 'c'.repeat(40);
    },
  });
  await assert.rejects(
    releasePlatform('deploy', { url: config.origin }, dependencies),
    /refusing stale CI deployment/,
  );
  assert.equal(
    state.calls.some((call) =>
      ['d1', 'deploy', 'rollback', 'scripts/import-friendly.ts'].includes(call.args[0]),
    ),
    false,
  );
  assert.equal(state.version, prior);
});

test('CI main advancing after D1 import keeps the data and refuses Worker upload', async (context) => {
  const { state, dependencies } = await setup(context, {
    env: ciEnv,
    onImport: (state) => {
      state.mainSha = 'c'.repeat(40);
    },
  });
  await assert.rejects(
    releasePlatform('deploy', { url: config.origin }, dependencies),
    /refusing stale CI deployment/,
  );
  assert.ok(state.calls.some((call) => call.args[0] === 'scripts/import-friendly.ts'));
  assert.equal(
    state.calls.some((call) => ['deploy', 'rollback'].includes(call.args[0])),
    false,
  );
  assert.equal(state.version, prior);
  assert.equal(state.receipts.at(-1).status, 'failed');
});

test('CI SHA mismatch and unavailable remote fail before building or touching Cloudflare', async (context) => {
  for (const failure of ['sha', 'remote']) {
    const { state, dependencies } = await setup(context, {
      env: failure === 'sha' ? { ...ciEnv, GITHUB_SHA: 'c'.repeat(40) } : ciEnv,
    });
    state.remoteFailure = failure === 'remote';
    await assert.rejects(
      releasePlatform('deploy', { url: config.origin }, dependencies),
      failure === 'sha' ? /source must match GITHUB_SHA/ : /Cannot verify remote main/,
    );
    assert.ok(state.calls.every((call) => call.command === 'git'));
    assert.equal(state.version, prior);
  }
});

test('external deployment during build prevents D1 mutation and Worker upload', async (context) => {
  const { state, dependencies } = await setup(context, {
    onBuild: (state) => {
      state.version = external;
    },
  });
  await assert.rejects(
    releasePlatform('deploy', { url: config.origin }, dependencies),
    /changed externally/,
  );
  assert.equal(
    state.calls.some((call) =>
      ['d1', 'deploy', 'rollback', 'scripts/import-friendly.ts'].includes(call.args[0]),
    ),
    false,
  );
});

test('failed smoke restores captured previous Worker and verifies it, never down-migrates D1', async (context) => {
  const { state, dependencies } = await setup(context, {
    smoke: (state, args) => {
      if (state.smokeCalls === 1) throw new Error('Bad new asset');
      assert.equal(args.expectedSha, 'old-source');
      assert.equal(args.allowLegacy, true);
      assert.equal(args.appManifest, undefined);
      return { passed: true };
    },
  });
  await assert.rejects(
    releasePlatform('deploy', { url: config.origin }, dependencies),
    /previous Worker restored/,
  );
  assert.equal(state.version, prior);
  assert.equal(state.smokeCalls, 2);
  assert.equal(state.receipts.at(-1).status, 'failed-and-rolled-back');
  assert.equal(state.calls.filter((call) => call.args[0] === 'rollback').length, 1);
  assert.equal(
    state.calls.some((call) => call.args.includes('down')),
    false,
  );
});

test('stale failed smoke never rolls back another operator’s newer deployment', async (context) => {
  const { state, dependencies } = await setup(context, {
    smoke: (state) => {
      state.version = external;
      throw new Error('stale smoke');
    },
  });
  await assert.rejects(
    releasePlatform('deploy', { url: config.origin }, dependencies),
    /changed externally/,
  );
  assert.equal(
    state.calls.some((call) => call.args[0] === 'rollback'),
    false,
  );
  assert.equal(state.version, external);
});

test('first deploy failure records no prior Worker, preserves GCP, does not invent rollback', async (context) => {
  const { state, dependencies } = await setup(context, {
    first: true,
    smoke: () => {
      throw new Error('failed smoke');
    },
  });
  await assert.rejects(
    releasePlatform('deploy', { url: config.origin, 'first-deploy': true }, dependencies),
    /keep GCP available/,
  );
  assert.equal(state.receipts.at(-1).status, 'failed-no-prior-worker');
  assert.equal(
    state.calls.some((call) => call.args[0] === 'rollback'),
    false,
  );
});

test('manual rollback requires receipt current version and retained snapshot', async (context) => {
  const { state, dependencies } = await setup(context, {
    env: { ...ciEnv, GITHUB_REF: 'refs/heads/recovery', GITHUB_SHA: 'c'.repeat(40) },
  });
  state.version = next;
  dependencies.receipt = {
    action: 'deploy',
    accountId: config.accountId,
    workerName: config.name,
    url: config.origin,
    deployedVersion: next,
    previous: { versionId: prior, sourceSha: 'old-source', manifest },
  };
  const result = await releasePlatform('rollback', { receipt: 'ignored.json' }, dependencies);
  assert.equal(result.receipt.status, 'rolled-back');
  assert.equal(state.version, prior);
  assert.equal(
    state.calls.some((call) => call.command === 'pnpm' || call.args.includes('migrations')),
    false,
  );
  assert.equal(
    state.calls.some((call) => call.args[0] === 'ls-remote'),
    false,
  );
});

test('authentication errors cannot masquerade as the first deployment', async () => {
  await assert.rejects(
    readVersion(
      async () => {
        const error = new Error('Wrangler failed');
        error.output = '[code: 10000] Authentication error';
        throw error;
      },
      config,
      true,
    ),
    /Wrangler failed/,
  );
});

test('wrong deploy origin is rejected before build, D1, capture or receipt writes', async (context) => {
  const { state, dependencies } = await setup(context);
  dependencies.capture = async () => {
    throw new Error('capture must not run');
  };
  await assert.rejects(
    releasePlatform('deploy', { url: 'https://other.example.workers.dev' }, dependencies),
    /configured PUBLIC_ORIGIN/,
  );
  assert.equal(state.calls.length, 0);
  assert.equal(state.receipts.length, 0);
});

test('receipt for a different origin cannot trigger rollback or a remote lookup', async (context) => {
  const { state, dependencies } = await setup(context);
  dependencies.receipt = {
    action: 'deploy',
    accountId: config.accountId,
    workerName: config.name,
    url: 'https://other.example.workers.dev',
    deployedVersion: next,
    previous: { versionId: prior, sourceSha: 'old-source', manifest },
  };
  await assert.rejects(
    releasePlatform('rollback', { receipt: 'ignored.json' }, dependencies),
    /configured PUBLIC_ORIGIN/,
  );
  assert.equal(state.calls.length, 0);
  assert.equal(state.receipts.length, 0);
});

test('new deployments reject missing or stale App manifests before D1 writes', async (context) => {
  for (const value of [null, { ...appManifest, sourceSha: 'b'.repeat(40) }]) {
    const { state, dependencies } = await setup(context);
    dependencies.appManifest = value;
    await assert.rejects(
      releasePlatform('deploy', { url: config.origin }, dependencies),
      /App manifest/,
    );
    assert.equal(
      state.calls.some((call) => ['d1', 'deploy'].includes(call.args[0])),
      false,
    );
  }
});

test('failed App release rollback verifies the captured previous App manifest', async (context) => {
  const oldApp = { ...appManifest, sourceSha: 'b'.repeat(40) };
  const { state, dependencies } = await setup(context, {
    smoke: (state, args) => {
      if (state.smokeCalls === 1) {
        assert.deepEqual(args.appManifest, appManifest);
        assert.notEqual(args.allowLegacy, true);
        throw new Error('Bad new App asset');
      }
      assert.deepEqual(args.appManifest, oldApp);
      assert.equal(args.allowLegacy, false);
      assert.equal(args.expectedSha, oldApp.sourceSha);
      return { passed: true };
    },
  });
  dependencies.capture = async () => ({
    versionId: prior,
    sourceSha: oldApp.sourceSha,
    manifest,
    appManifest: oldApp,
  });
  await assert.rejects(
    releasePlatform('deploy', { url: config.origin }, dependencies),
    /previous Worker restored/,
  );
  assert.equal(state.version, prior);
});

test('manual App rollback forwards its manifest without enabling legacy smoke', async (context) => {
  const oldApp = { ...appManifest, sourceSha: 'b'.repeat(40) };
  const { state, dependencies } = await setup(context, {
    smoke: (_, args) => {
      assert.deepEqual(args.appManifest, oldApp);
      assert.equal(args.allowLegacy, false);
      return { passed: true };
    },
  });
  state.version = next;
  dependencies.receipt = {
    action: 'deploy',
    accountId: config.accountId,
    workerName: config.name,
    url: config.origin,
    deployedVersion: next,
    previous: { versionId: prior, sourceSha: oldApp.sourceSha, manifest, appManifest: oldApp },
  };
  await releasePlatform('rollback', { receipt: 'ignored.json' }, dependencies);
  assert.equal(state.version, prior);
});
