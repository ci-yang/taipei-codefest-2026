import { runCommand } from './platform-tools.mjs';

/** Only GitHub Actions deploys require the current main tip; explicit rollback is separate. */
export async function assertCiDeploySource(sourceSha, run = runCommand, env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true') return;
  if (env.GITHUB_REF !== 'refs/heads/main')
    throw new Error('CI deployment requires refs/heads/main.');
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') || env.GITHUB_SHA !== sourceSha)
    throw new Error('CI deployment source must match GITHUB_SHA.');
  const head = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim();
  if (head !== sourceSha) throw new Error('CI checkout HEAD changed during release.');

  let remote;
  try {
    remote = await run('git', ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'], {
      timeoutMs: 30_000,
    });
  } catch (error) {
    throw new Error('Cannot verify remote main; refusing CI deployment.', { cause: error });
  }
  const mainSha = remote.stdout.trim().match(/^([a-f0-9]{40})\trefs\/heads\/main$/)?.[1];
  if (!mainSha) throw new Error('Cannot resolve remote main; refusing CI deployment.');
  if (mainSha !== sourceSha)
    throw new Error('Remote main has changed; refusing stale CI deployment.');
}
