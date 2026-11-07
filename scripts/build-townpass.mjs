import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, isMain, runCommand, sha256 } from './platform-tools.mjs';

const usage = `Usage: CODEFEST_SERVICE_URL=https://<verified-origin> TOWNPASS_DIR=/path/to/TownPass-platform bash scripts/build-townpass.sh [--townpass-dir PATH] [--debug|--check|--dry-run]
Delegates URL validation and Flutter build to TownPass scripts/build-codefest.sh.
Records both source commits, dirty state and APK SHA-256 under .artifacts/townpass/.
Requires the external repository's Flutter/Dart, Python 3, Java 17 and Android SDK.`;

async function gitState(directory, run) {
  const sha = (await run('git', ['rev-parse', 'HEAD'], { cwd: directory })).stdout.trim();
  const dirty = Boolean(
    (
      await run('git', ['status', '--porcelain=v1', '--untracked-files=all', '-z'], {
        cwd: directory,
      })
    ).stdout,
  );
  return { sourceSha: sha, repoDirty: dirty };
}

export async function buildTownpass(args, { env = process.env, run = runCommand } = {}) {
  let townpass = env.TOWNPASS_DIR;
  const forwarded = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--townpass-dir') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--townpass-dir requires a path.');
      townpass = value;
    } else forwarded.push(args[index]);
  }
  if (!townpass)
    throw new Error(
      'Set TOWNPASS_DIR or --townpass-dir to the existing TownPass-platform checkout.',
    );
  const directory = resolve(townpass);
  const mode = forwarded.includes('--debug') ? 'debug' : 'release';
  const producesApk = !forwarded.includes('--dry-run') && !forwarded.includes('--check');
  const apkPath = resolve(directory, `build/app/outputs/flutter-apk/app-${mode}.apk`);
  const previousApk = producesApk
    ? await stat(apkPath).catch((error) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      })
    : null;
  const before = await gitState(directory, run);
  const platform = await gitState(ROOT, run);
  const buildStartedMs = Date.now();
  const startedAt = new Date(buildStartedMs).toISOString();
  console.log('TownPass: delegating URL validation and build to scripts/build-codefest.sh.');
  // The external script is the single owner of URL parsing and supported Flutter flags.
  await run('bash', ['scripts/build-codefest.sh', ...forwarded], {
    cwd: directory,
    env,
    timeoutMs: 1_800_000,
    maxBytes: 8_000_000,
  });
  const after = await gitState(directory, run);
  const receipt = {
    startedAt,
    completedAt: new Date().toISOString(),
    serviceUrl: env.CODEFEST_SERVICE_URL,
    platform,
    townpass: { path: directory, before, after },
    sourceCommitRepresentsBuild:
      !before.repoDirty && !after.repoDirty && before.sourceSha === after.sourceSha,
    mode,
    signing: 'not-verified-by-wrapper',
    deviceValidation: 'not-run',
  };
  if (forwarded.includes('--dry-run') || forwarded.includes('--check')) {
    receipt.status = forwarded.includes('--dry-run') ? 'dry-run' : 'configuration-checked';
  } else {
    const metadata = await stat(apkPath);
    if (!metadata.isFile() || metadata.size === 0 || metadata.size > 512 * 1024 * 1024)
      throw new Error('Expected APK is missing, empty or exceeds the bounded size.');
    const unchanged =
      previousApk &&
      previousApk.ino === metadata.ino &&
      previousApk.mtimeMs === metadata.mtimeMs &&
      previousApk.ctimeMs === metadata.ctimeMs &&
      previousApk.size === metadata.size;
    // Allow a two-second filesystem timestamp bucket, while separately rejecting an unchanged file.
    if (unchanged || metadata.mtimeMs < Math.floor(buildStartedMs / 2000) * 2000)
      throw new Error(
        'Expected APK is stale or unchanged; the external script did not produce a fresh artifact.',
      );
    receipt.apk = { path: apkPath, bytes: metadata.size, sha256: sha256(await readFile(apkPath)) };
    receipt.status = 'apk-built';
  }
  const artifacts = resolve(ROOT, '.artifacts/townpass');
  await mkdir(artifacts, { recursive: true, mode: 0o700 });
  const receiptPath = resolve(artifacts, `${startedAt.replaceAll(':', '-')}.json`);
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  return { receipt, receiptPath };
}

if (isMain(import.meta.url)) {
  try {
    if (process.argv.includes('--help')) console.log(usage);
    else {
      const { receipt, receiptPath } = await buildTownpass(process.argv.slice(2));
      console.log(`${receipt.status}\nReceipt: ${receiptPath}`);
      if (receipt.apk) console.log(`APK: ${receipt.apk.path}\nSHA-256: ${receipt.apk.sha256}`);
    }
  } catch (error) {
    console.error(`TownPass build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
