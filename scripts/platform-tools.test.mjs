import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, assertCleanHead, currentVersion, runCommand } from './platform-tools.mjs';
import { fetchResource } from './smoke-platform.mjs';

test('dirty tracked and nonignored untracked files block all build commands', async () => {
  for (const status of [' M apps/web/src/main.ts\0', '?? accidental-secret.txt\0']) {
    const commands = [];
    await assert.rejects(
      assertCleanHead(async (command, args) => {
        commands.push([command, args]);
        return { stdout: status };
      }),
      /clean committed HEAD/,
    );
    assert.equal(commands.length, 1);
    assert.deepEqual(commands[0][1], ['status', '--porcelain=v1', '--untracked-files=all', '-z']);
  }
});

test('lock is exclusive and never removes a pre-existing owner', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'platform-lock-test-'));
  const path = join(directory, 'environment.lock');
  try {
    const release = await acquireLock(path);
    await assert.rejects(acquireLock(path), /already locked/);
    await release();
    const releaseAgain = await acquireLock(path);
    await releaseAgain();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('deployment history selects latest, refuses split traffic and malformed history', () => {
  const version = '12345678-1234-1234-1234-123456789012';
  assert.equal(
    currentVersion([
      { created_on: '2026-11-01T00:00:00Z', versions: [{ version_id: 'old', percentage: 100 }] },
      { created_on: '2026-11-02T00:00:00Z', versions: [{ version_id: version, percentage: 100 }] },
    ]),
    version,
  );
  assert.equal(currentVersion([]), null);
  assert.throws(
    () =>
      currentVersion([
        { created_on: '2026-11-01T00:00:00Z', versions: [{ version_id: version, percentage: 50 }] },
      ]),
    /single 100%/,
  );
  assert.throws(() => currentVersion({}), /history/);
});

test('subprocess time and output are bounded', async () => {
  await assert.rejects(
    runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 30 }),
    /timeout/,
  );
  await assert.rejects(
    runCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(5000))'], {
      maxBytes: 100,
    }),
    /output limit/,
  );
});

test('smoke times out and retries only a bounded number of attempts', async () => {
  let calls = 0;
  await assert.rejects(
    fetchResource('https://example.invalid/', {
      timeoutMs: 10,
      retries: 1,
      fetchImpl: () => {
        calls++;
        return new Promise(() => {});
      },
      retryDelayMs: 0,
    }),
    /timeout/,
  );
  assert.equal(calls, 2);
});
