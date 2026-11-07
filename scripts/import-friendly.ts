import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FriendlySnapshot } from '../packages/shared/src/friendly';
import { SnapshotFriendlyRepository } from '../apps/api/src/friendly/snapshot-repository';
import {
  snapshotHash,
  validateSnapshotRow,
  type SnapshotRow,
} from '../apps/api/src/friendly/snapshot-validation';

const root = resolve(import.meta.dirname, '..');
export async function loadImportSnapshot(directory: string): Promise<FriendlySnapshot> {
  const source: unknown = JSON.parse(readFileSync(resolve(directory, 'snapshot.json'), 'utf8'));
  if (
    !source ||
    typeof source !== 'object' ||
    !('version' in source) ||
    typeof source.version !== 'string'
  )
    throw new Error('Snapshot version missing');
  const snapshot = await new SnapshotFriendlyRepository(directory).read(source.version);
  for (const file of [snapshot.manifest.files.routingGraph, snapshot.manifest.files.mapData]) {
    const bytes = readFileSync(resolve(directory, basename(file.path)));
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256)
      throw new Error('Asset hash mismatch');
  }
  return snapshot;
}
const literal = (value: string): string => `'${value.replaceAll("'", "''")}'`;
export function snapshotInsertSQL(snapshot: FriendlySnapshot, hash: string): string {
  return (
    'INSERT OR IGNORE INTO friendly_snapshots (version, stores_json, manifest_json, content_hash) VALUES (' +
    [snapshot.version, JSON.stringify(snapshot.stores), JSON.stringify(snapshot.manifest), hash]
      .map(literal)
      .join(',') +
    ');\n'
  );
}
interface Options {
  target: '--local' | '--remote';
  database: string;
  dataDir: string;
  config: string;
  persistTo?: string;
}
function options(args: string[]): Options | null {
  if (args.includes('--help')) {
    console.log(
      'Usage: pnpm exec tsx scripts/import-friendly.ts --local|--remote [--database FRIENDLY_DB] [--data-dir data/friendly] [--config wrangler.jsonc] [--persist-to PATH]\nApplies one immutable snapshot after migrations. Reimporting identical content succeeds; a version collision fails without updating existing data. --persist-to is local only.',
    );
    return null;
  }
  const result: Partial<Options> = {
    database: 'FRIENDLY_DB',
    dataDir: resolve(root, 'data/friendly'),
    config: resolve(root, 'wrangler.jsonc'),
  };
  const keys = {
    '--database': 'database',
    '--data-dir': 'dataDir',
    '--config': 'config',
    '--persist-to': 'persistTo',
  } as const;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--local' || arg === '--remote') {
      if (result.target) throw new Error('Choose exactly one target');
      result.target = arg;
    } else if (arg in keys) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      result[keys[arg as keyof typeof keys]] = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!result.target) throw new Error('Explicit --local or --remote is required');
  if (result.persistTo && result.target !== '--local')
    throw new Error('--persist-to requires --local');
  return result as Options;
}
function execute(
  sql: string,
  opts: Options,
  directory: string,
  mode: 'file' | 'command' = 'file',
): string {
  const sqlFile = resolve(directory, 'statement.sql');
  if (mode === 'file') writeFileSync(sqlFile, sql, { mode: 0o600 });
  const args = [
    'd1',
    'execute',
    opts.database,
    opts.target,
    '--config',
    resolve(opts.config),
    ...(mode === 'file' ? ['--file', sqlFile] : ['--command', sql]),
    '--json',
    '--yes',
  ];
  if (opts.persistTo) args.push('--persist-to', resolve(opts.persistTo));
  let output: string;
  try {
    output = execFileSync(resolve(root, 'node_modules/.bin/wrangler'), args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 90_000,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    });
  } catch (error: unknown) {
    const detail = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
    const code =
      typeof detail.code === 'string' && /^E[A-Z0-9_]+$/.test(detail.code)
        ? detail.code
        : 'UNKNOWN';
    const status =
      typeof detail.status === 'number' && Number.isInteger(detail.status) ? detail.status : 'none';
    const signal =
      typeof detail.signal === 'string' && /^SIG[A-Z0-9]+$/.test(detail.signal)
        ? detail.signal
        : 'none';
    throw new Error(
      `D1 command failed (exit=${status}, code=${code}, signal=${signal}); raw output omitted`,
      // eslint-disable-next-line preserve-caught-error -- Child stderr may contain credentials; preserve only safe diagnostic fields.
      { cause: { status, code, signal } },
    );
  }
  return output;
}
function resultRows(output: string): unknown[] {
  let value: unknown;
  try {
    value = JSON.parse(output) as unknown;
  } catch {
    throw new Error('D1 response was not valid JSON; raw output omitted');
  }
  if (!Array.isArray(value)) throw new Error('Unexpected D1 response');
  const rows: unknown[] = [];
  for (const result of value) {
    if (
      !result ||
      typeof result !== 'object' ||
      result.success !== true ||
      !Array.isArray(result.results)
    )
      throw new Error('D1 statement did not succeed');
    rows.push(...result.results);
  }
  return rows;
}
export async function importFriendly(args: string[]): Promise<void> {
  const opts = options(args);
  if (!opts) return;
  const snapshot = await loadImportSnapshot(resolve(opts.dataDir));
  const hash = await snapshotHash(snapshot);
  const temp = mkdtempSync(resolve(tmpdir(), 'friendly-import-'));
  try {
    // One statement publishes the complete version. Concurrent imports cannot replace an existing key.
    // Remote file imports can print progress before JSON; exit zero alone is not success.
    // Ignore that output and require the complete command readback below to validate.
    execute(snapshotInsertSQL(snapshot, hash), opts, temp);
    // Remote --file returns import statistics, while --command returns the SELECT rows.
    const rows = resultRows(
      execute(
        `SELECT version, stores_json, manifest_json, content_hash FROM friendly_snapshots WHERE version = ${literal(snapshot.version)};`,
        opts,
        temp,
        'command',
      ),
    );
    if (rows.length !== 1) throw new Error('Snapshot readback failed');
    const row = rows[0] as SnapshotRow;
    if (row.content_hash !== hash)
      throw new Error(
        'Version conflict: existing snapshot has different content; choose a new version',
      );
    await validateSnapshotRow(row, snapshot.version);
    console.log(
      JSON.stringify({
        ok: true,
        version: snapshot.version,
        storeCount: snapshot.stores.length,
        contentHash: hash,
      }),
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  importFriendly(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Friendly import failed');
    process.exitCode = 1;
  });
}
