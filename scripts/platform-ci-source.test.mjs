import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCiDeploySource } from './platform-ci-source.mjs';

const sourceSha = 'a'.repeat(40);
const env = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sourceSha };

test('CI source guard rejects branch, missing SHA, changed checkout and malformed remote responses', async () => {
  const cases = [
    { env: { ...env, GITHUB_REF: 'refs/heads/feature' }, error: /requires refs\/heads\/main/ },
    { env: { ...env, GITHUB_SHA: '' }, error: /must match GITHUB_SHA/ },
    { head: 'b'.repeat(40), error: /checkout HEAD changed/ },
    { remote: '', error: /Cannot resolve remote main/ },
    { remote: `${sourceSha}\trefs/heads/other`, error: /Cannot resolve remote main/ },
    {
      remote: `${sourceSha}\trefs/heads/main\n${sourceSha}\trefs/heads/other`,
      error: /Cannot resolve remote main/,
    },
  ];
  for (const entry of cases) {
    await assert.rejects(
      assertCiDeploySource(
        sourceSha,
        async (_, args) => ({
          stdout: args[0] === 'rev-parse' ? entry.head ?? sourceSha : entry.remote,
        }),
        entry.env ?? env,
      ),
      entry.error,
    );
  }
});

test('CI source guard uses a bounded exact-ref lookup without fetching or switching branches', async () => {
  const calls = [];
  await assertCiDeploySource(
    sourceSha,
    async (command, args, options) => {
      calls.push({ command, args, options });
      return { stdout: args[0] === 'rev-parse' ? sourceSha : `${sourceSha}\trefs/heads/main\n` };
    },
    env,
  );
  assert.deepEqual(calls, [
    { command: 'git', args: ['rev-parse', 'HEAD'], options: undefined },
    {
      command: 'git',
      args: ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'],
      options: { timeoutMs: 30_000 },
    },
  ]);
});
