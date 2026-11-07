import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const WRANGLER = resolve(ROOT, 'node_modules/.bin/wrangler');
export const TSX = resolve(ROOT, 'node_modules/.bin/tsx');
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
export const isMain = (url) => process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url);

/** No shell interpolation, no inherited stdin, bounded capture, and no secret-bearing logs. */
export function runCommand(
  command,
  args,
  { cwd = ROOT, timeoutMs = 120_000, maxBytes = 4_000_000, env = process.env } = {},
) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let stdout = '',
      stderr = '',
      size = 0,
      failure;
    const kill = () => {
      try {
        if (process.platform === 'win32') child.kill('SIGKILL');
        else process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* Already exited. */
      }
    };
    const timer = setTimeout(() => {
      failure = 'timeout';
      kill();
    }, timeoutMs);
    const collect = (kind, chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        failure = 'output limit exceeded';
        kill();
        return;
      }
      if (kind === 'stdout') stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    child.stdout.on('data', (chunk) => collect('stdout', chunk));
    child.stderr.on('data', (chunk) => collect('stderr', chunk));
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error(`Cannot start ${command}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (failure || code !== 0) {
        const error = new Error(`${command} failed: ${failure || `exit ${code}`}`);
        // Kept for precise API error classification; never interpolated into public errors/receipts.
        Object.defineProperty(error, 'output', { value: stdout + stderr });
        reject(error);
      } else resolveResult({ stdout, stderr });
    });
  });
}

export async function assertCleanHead(run = runCommand, expected) {
  const status = await run('git', ['status', '--porcelain=v1', '--untracked-files=all', '-z']);
  if (status.stdout)
    throw new Error(
      'Release requires a clean committed HEAD, including nonignored untracked files.',
    );
  const sha = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim();
  if (!/^[a-f0-9]{40}$/.test(sha) || (expected && expected !== sha))
    throw new Error('Source HEAD changed during release.');
  return sha;
}

export async function acquireLock(path) {
  await mkdir(dirname(path), { recursive: true });
  try {
    await mkdir(path);
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(
        `Environment already locked: ${path}. Inspect its owner; never remove an active lock.`,
        { cause: error },
      );
    throw error;
  }
  const owner = { pid: process.pid, token: randomUUID(), startedAt: new Date().toISOString() };
  try {
    await writeFile(resolve(path, 'owner.json'), JSON.stringify(owner), { mode: 0o600 });
  } catch (error) {
    await rm(path, { recursive: true });
    throw error;
  }
  return async () => {
    const current = await readJson(resolve(path, 'owner.json'));
    if (current.token !== owner.token)
      throw new Error('Lock ownership changed; refusing to remove it.');
    await rm(path, { recursive: true });
  };
}

export function currentVersion(history) {
  if (!Array.isArray(history)) throw new Error('Invalid deployment history.');
  if (!history.length) return null;
  if (history.some((entry) => !Number.isFinite(Date.parse(entry.created_on))))
    throw new Error('Invalid deployment history date.');
  const latest = [...history].sort(
    (a, b) => Date.parse(b.created_on) - Date.parse(a.created_on),
  )[0];
  if (
    latest.versions?.length !== 1 ||
    latest.versions[0].percentage !== 100 ||
    !/^[a-f0-9-]{36}$/.test(latest.versions[0].version_id)
  )
    throw new Error('Release requires a single 100% Worker version.');
  return latest.versions[0].version_id;
}

export function parseFlags(argv, booleanFlags = []) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith('--') || Object.hasOwn(result, key.slice(2)))
      throw new Error(`Invalid or repeated option: ${key}`);
    if (booleanFlags.includes(key)) result[key.slice(2)] = true;
    else {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: ${key}`);
      result[key.slice(2)] = value;
    }
  }
  return result;
}

export function validateOrigin(value, allowLocal = false) {
  const url = new URL(value);
  if (
    (url.protocol !== 'https:' &&
      !(
        allowLocal &&
        url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost'].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Use an HTTPS origin without credentials, query, fragment or path.');
  return url.origin;
}
