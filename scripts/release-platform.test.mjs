import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { releasePlatform } from './release-platform.mjs';
import { readVersion } from './platform-release-state.mjs';

const prior = '11111111-1111-1111-1111-111111111111';
const next = '22222222-2222-2222-2222-222222222222';
const external = '33333333-3333-3333-3333-333333333333';
const sourceSha = 'a'.repeat(40);
const config = {
  name: 'test-platform',
  accountId: 'a'.repeat(32),
  database: 'FRIENDLY_DB',
  path: 'wrangler.jsonc',
  dataVersion: 'fixture-v1',
  origin: 'https://test-platform.example.workers.dev',
};
const manifest = { version: 'fixture-v1', files: { snapshot: { sha256: 'b'.repeat(64) } } };

async function setup(context, { first = false, onBuild, smoke } = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), 'release-test-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const state = { version: first ? null : prior, calls: [], receipts: [], smokeCalls: 0 };
  const dependencies = {
    config,
    manifest,
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
  assert.ok(
    state.calls.find((call) => call.args[0] === 'deploy').args.includes(`BUILD_SHA:${sourceSha}`),
  );
  assert.ok(
    state.calls
      .find((call) => call.args[0] === 'scripts/import-friendly.ts')
      .args.includes('--remote'),
  );
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
  const { state, dependencies } = await setup(context);
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
