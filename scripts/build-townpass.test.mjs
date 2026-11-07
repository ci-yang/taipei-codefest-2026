import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildTownpass } from './build-townpass.mjs';

test('wrapper delegates flags and URL unchanged, records dirty sources and does not claim a dry-run APK', async () => {
  const calls = [];
  const env = {
    TOWNPASS_DIR: '/tmp/townpass-wrapper-fixture',
    CODEFEST_SERVICE_URL: 'https://example.test',
  };
  const run = async (command, args, options) => {
    calls.push({ command, args, options });
    return {
      stdout:
        command === 'git' ? (args[0] === 'status' ? ' M changed-file\0' : 'a'.repeat(40)) : '',
    };
  };
  const { receipt, receiptPath } = await buildTownpass(['--dry-run', '--debug'], { env, run });
  try {
    const build = calls.find((call) => call.command === 'bash');
    assert.deepEqual(build.args, ['scripts/build-codefest.sh', '--dry-run', '--debug']);
    assert.equal(build.options.env.CODEFEST_SERVICE_URL, env.CODEFEST_SERVICE_URL);
    assert.equal(receipt.townpass.before.repoDirty, true);
    assert.equal(receipt.townpass.after.repoDirty, true);
    assert.equal(receipt.sourceCommitRepresentsBuild, false);
    assert.equal(receipt.status, 'dry-run');
    assert.equal(receipt.apk, undefined);
    assert.equal(receipt.deviceValidation, 'not-run');
  } finally {
    await rm(receiptPath);
  }
});

test('external URL/parser/build failure stops wrapper before any APK receipt', async () => {
  await assert.rejects(
    buildTownpass(['--dry-run'], {
      env: { TOWNPASS_DIR: '/tmp/townpass-wrapper-fixture' },
      run: async (command, args) => {
        if (command === 'bash') throw new Error('external URL validation failed');
        return { stdout: args[0] === 'status' ? '' : 'a'.repeat(40) };
      },
    }),
    /external URL validation failed/,
  );
});

test('a successful external script cannot attribute an unchanged existing APK to the new build', async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'townpass-stale-apk-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const apkPath = resolve(directory, 'build/app/outputs/flutter-apk/app-release.apk');
  await mkdir(resolve(apkPath, '..'), { recursive: true });
  await writeFile(apkPath, 'old test APK');
  // A pre-existing file may even have a future timestamp: timestamp alone is not sufficient.
  await utimes(apkPath, Date.now() / 1000 + 60, Date.now() / 1000 + 60);
  await assert.rejects(
    buildTownpass([], {
      env: { TOWNPASS_DIR: directory, CODEFEST_SERVICE_URL: 'https://example.test' },
      run: async (command, args) => ({
        stdout: command === 'git' && args[0] !== 'status' ? 'a'.repeat(40) : '',
      }),
    }),
    /stale|unchanged/,
  );
});

test('a fresh regenerated APK may have identical bytes and still gets its own receipt', async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'townpass-new-apk-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const apkPath = resolve(directory, 'build/app/outputs/flutter-apk/app-release.apk');
  await mkdir(resolve(apkPath, '..'), { recursive: true });
  await writeFile(apkPath, 'reproducible test APK');
  await utimes(apkPath, 1000, 1000);
  const { receipt, receiptPath } = await buildTownpass([], {
    env: { TOWNPASS_DIR: directory, CODEFEST_SERVICE_URL: 'https://example.test' },
    run: async (command, args) => {
      if (command === 'bash') await writeFile(apkPath, 'reproducible test APK');
      return { stdout: command === 'git' && args[0] !== 'status' ? 'a'.repeat(40) : '' };
    },
  });
  context.after(() => rm(receiptPath));
  assert.equal(receipt.status, 'apk-built');
  assert.ok(receipt.apk.sha256);
});

test('a script that copies an old timestamp into a new APK cannot claim a fresh build', async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'townpass-copied-apk-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const apkPath = resolve(directory, 'build/app/outputs/flutter-apk/app-release.apk');
  await mkdir(resolve(apkPath, '..'), { recursive: true });
  await assert.rejects(
    buildTownpass([], {
      env: { TOWNPASS_DIR: directory, CODEFEST_SERVICE_URL: 'https://example.test' },
      run: async (command, args) => {
        if (command === 'bash') {
          await writeFile(apkPath, 'old copied test APK');
          await utimes(apkPath, 1000, 1000);
        }
        return { stdout: command === 'git' && args[0] !== 'status' ? 'a'.repeat(40) : '' };
      },
    }),
    /stale/,
  );
});
