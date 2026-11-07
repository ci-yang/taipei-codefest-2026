import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  ROOT,
  WRANGLER,
  TSX,
  acquireLock,
  assertCleanHead,
  isMain,
  parseFlags,
  readJson,
  runCommand,
  sha256,
} from './platform-tools.mjs';
import { smokePlatform } from './smoke-platform.mjs';
import { assertCiDeploySource } from './platform-ci-source.mjs';
import {
  assertRollbackData,
  assertVersion,
  capturePrevious,
  loadReleaseConfig,
  loadReleaseData,
  readVersion,
  requireReleaseOrigin,
  rollbackRelease,
  rollbackWorker,
  writeReceipt,
} from './platform-release-state.mjs';

const usage = `Usage:
  node scripts/release-platform.mjs deploy --url https://<worker>.workers.dev [--first-deploy]
  node scripts/release-platform.mjs rollback --receipt .artifacts/releases/<release>.json
Deploy builds clean HEAD, applies D1 migrations and immutable data, deploys, then checks smoke.
Rollback uses the recorded prior Worker version, verifies its D1 snapshot, and leaves all D1 data intact.
Same-environment commands on this machine share a lock. Other hosts must share CI concurrency.
Requires Wrangler OAuth or CLOUDFLARE_API_TOKEN in the environment; secrets are never written to receipts.`;

export async function releasePlatform(action, options, dependencies = {}) {
  const run = dependencies.run || runCommand;
  const smoke = dependencies.smoke || smokePlatform;
  const capture = dependencies.capture || capturePrevious;
  const save = dependencies.save || writeReceipt;
  const config = dependencies.config || (await loadReleaseConfig());
  const lockPath =
    dependencies.lockPath ||
    resolve(
      tmpdir(),
      `friendly-platform-${sha256(`${config.accountId}/${config.name}`).slice(0, 24)}.lock`,
    );
  if (!['deploy', 'rollback'].includes(action)) throw new Error(usage);
  const deployed =
    action === 'rollback'
      ? dependencies.receipt || (await readJson(resolve(ROOT, options.receipt || '')))
      : null;
  const url = requireReleaseOrigin(config, deployed ? deployed.url : options.url);
  const sourceSha = await assertCleanHead(run);
  const unlock = await acquireLock(lockPath);
  const receipt = {
    id: `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`,
    action,
    status: 'started',
    accountId: config.accountId,
    workerName: config.name,
    sourceSha,
    startedAt: new Date().toISOString(),
    databaseRollback: false,
    url,
  };
  let receiptPath;
  try {
    if (action === 'rollback') {
      await rollbackRelease({ run, config, receipt, deployed, smoke, save });
    } else {
      const assertSource = () => assertCiDeploySource(sourceSha, run, dependencies.env ?? process.env);
      await assertSource();
      const priorVersion = await readVersion(run, config, Boolean(options['first-deploy']));
      if (priorVersion === null && !options['first-deploy'])
        throw new Error('No existing Worker; explicitly use --first-deploy.');
      if (priorVersion !== null && options['first-deploy'])
        throw new Error('Worker already exists; remove --first-deploy.');
      receipt.previous = await capture(receipt.url, priorVersion);
      await run('pnpm', ['run', 'platform:build'], {
        timeoutMs: 300_000,
        env: { ...process.env, VITE_API_BASE: '', VITE_BUILD_SHA: sourceSha },
      });
      await assertCleanHead(run, sourceSha);
      const { manifest, snapshot } = await loadReleaseData(config, dependencies);
      receipt.dataVersion = manifest.version;
      receipt.snapshotSha256 = manifest.files.snapshot.sha256;
      receiptPath = await save(receipt);
      await assertVersion(run, config, priorVersion);
      await assertSource();
      await run(
        WRANGLER,
        ['d1', 'migrations', 'apply', config.database, '--config', config.path, '--remote'],
        { timeoutMs: 180_000 },
      );
      await run(
        TSX,
        [
          'scripts/import-friendly.ts',
          '--remote',
          '--database',
          config.database,
          '--config',
          config.path,
        ],
        { timeoutMs: 180_000 },
      );
      await assertCleanHead(run, sourceSha);
      await assertVersion(run, config, priorVersion);
      await assertSource();
      const result = await run(
        WRANGLER,
        [
          'deploy',
          '--config',
          config.path,
          '--var',
          `BUILD_SHA:${sourceSha}`,
          '--tag',
          sourceSha.slice(0, 12),
          '--message',
          `source ${sourceSha}`,
          '--strict',
        ],
        { timeoutMs: 300_000 },
      );
      const versionId = result.stdout.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
      if (!versionId)
        throw new Error(
          'Deployment output had no version ID; inspect Cloudflare before any rollback.',
        );
      receipt.deployedVersion = versionId;
      await save(receipt);
      try {
        await assertVersion(run, config, versionId);
        receipt.smoke = await smoke({
          url: receipt.url,
          expectedSha: sourceSha,
          manifest,
          stores: snapshot.stores,
        });
        await assertVersion(run, config, versionId);
        receipt.status = 'deployed';
      } catch (error) {
        receipt.smokeFailure = error.message;
        if (!receipt.previous) {
          receipt.status = 'failed-no-prior-worker';
          throw new Error(
            'First deploy failed verification; no prior Worker exists. Do not hand off the new URL; keep GCP available.',
            { cause: error },
          );
        }
        // Never undo somebody else's deployment after a failed or stale smoke.
        await assertVersion(run, config, versionId);
        await assertRollbackData(run, config, receipt.previous);
        await assertVersion(run, config, versionId);
        await rollbackWorker(run, config, receipt.previous.versionId);
        await assertVersion(run, config, receipt.previous.versionId);
        receipt.rollbackSmoke = await smoke({
          url: receipt.url,
          expectedSha: receipt.previous.sourceSha,
          manifest: receipt.previous.manifest,
        });
        await assertVersion(run, config, receipt.previous.versionId);
        receipt.status = 'failed-and-rolled-back';
        throw new Error(
          'New deployment failed smoke; previous Worker restored and verified. D1 retained both snapshots.',
          { cause: error },
        );
      }
    }
    receipt.completedAt = new Date().toISOString();
    receiptPath = await save(receipt);
    return { receipt, receiptPath };
  } catch (error) {
    if (receipt.status === 'started') receipt.status = 'failed';
    receipt.failure = error.message;
    receipt.completedAt = new Date().toISOString();
    receiptPath = await save(receipt);
    throw new Error(`${error.message}\nRelease receipt: ${receiptPath}`, { cause: error });
  } finally {
    await unlock();
  }
}

if (isMain(import.meta.url)) {
  try {
    if (process.argv.includes('--help')) console.log(usage);
    else {
      const [action, ...flags] = process.argv.slice(2);
      const args = parseFlags(flags, ['--first-deploy']);
      const allowed = action === 'deploy' ? ['url', 'first-deploy'] : ['receipt'];
      if (Object.keys(args).some((key) => !allowed.includes(key)))
        throw new Error('Unknown release option.');
      if (action === 'deploy' ? !args.url : !args.receipt) throw new Error(usage);
      const { receipt, receiptPath } = await releasePlatform(action, args);
      console.log(
        `${receipt.status}: ${receipt.url}\nSource: ${receipt.sourceSha}\nReceipt: ${receiptPath}\nD1 was not rolled back.`,
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
