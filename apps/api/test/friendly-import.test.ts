import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  importFriendly,
  loadImportSnapshot,
  snapshotInsertSQL,
} from '../../../scripts/import-friendly';
import {
  snapshotHash,
  validateSnapshotRow,
  type SnapshotRow,
} from '../src/friendly/snapshot-validation';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

const canonical = resolve(import.meta.dirname, '../../../data/friendly');
const temporary: string[] = [];
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function fixture(): string {
  const directory = mkdtempSync(resolve(tmpdir(), 'friendly-test-'));
  temporary.push(directory);
  cpSync(canonical, directory, { recursive: true });
  return directory;
}
describe('immutable friendly import', () => {
  it('writes one snapshot atomically, is idempotent, and preserves an existing conflicting version', async () => {
    const snapshot = await loadImportSnapshot(canonical);
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(
        readFileSync(new URL('../migrations/friendly/0001_snapshots.sql', import.meta.url), 'utf8'),
      );
      const hash = await snapshotHash(snapshot);
      const sql = snapshotInsertSQL(snapshot, hash);
      db.exec(sql);
      db.exec(sql);
      expect(db.prepare('SELECT count(*) AS count FROM friendly_snapshots').get()?.count).toBe(1);
      const changed = structuredClone(snapshot);
      changed.stores[0]!.name = "A store's new name";
      db.exec(snapshotInsertSQL(changed, await snapshotHash(changed)));
      const row = db.prepare('SELECT * FROM friendly_snapshots').get() as unknown as SnapshotRow;
      expect(await validateSnapshotRow(row, snapshot.version)).toEqual(snapshot);
      expect(row.content_hash).not.toBe(await snapshotHash(changed));
      expect(() => db.exec('UPDATE friendly_snapshots SET content_hash = content_hash')).toThrow(
        'immutable',
      );
      expect(() => db.exec('DELETE FROM friendly_snapshots')).toThrow('immutable');
    } finally {
      db.close();
    }
  });
  it('rejects changed bytes without an updated manifest', async () => {
    const directory = fixture();
    writeFileSync(resolve(directory, 'snapshot.json'), '{}');
    await expect(loadImportSnapshot(directory)).rejects.toThrow();
  });
  it('rejects tampered graph and duplicate store IDs even with an updated file hash', async () => {
    const directory = fixture();
    writeFileSync(resolve(directory, 'routing-graph.json'), '{}');
    await expect(loadImportSnapshot(directory)).rejects.toThrow('Asset hash mismatch');
    cpSync(canonical, directory, { recursive: true });
    const snapshot = await loadImportSnapshot(directory);
    snapshot.stores[1]!.id = snapshot.stores[0]!.id;
    const bytes = `${JSON.stringify({ version: snapshot.version, stores: snapshot.stores })}\n`;
    writeFileSync(resolve(directory, 'snapshot.json'), bytes);
    snapshot.manifest.files.snapshot.sha256 = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify(snapshot.manifest));
    await expect(loadImportSnapshot(directory)).rejects.toThrow();
  });
});

describe('D1 CLI boundary', () => {
  it('executes the installed Wrangler directly and verifies full readback', async () => {
    const snapshot = await loadImportSnapshot(canonical);
    const hash = await snapshotHash(snapshot);
    const row = {
      version: snapshot.version,
      stores_json: JSON.stringify(snapshot.stores),
      manifest_json: JSON.stringify(snapshot.manifest),
      content_hash: hash,
    };
    vi.mocked(execFileSync)
      .mockReturnValueOnce(JSON.stringify([{ success: true, results: [] }]))
      .mockReturnValueOnce(JSON.stringify([{ success: true, results: [row] }]));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await importFriendly(['--local']);
    expect(execFileSync).toHaveBeenCalledTimes(2);
    for (const [binary, args] of vi.mocked(execFileSync).mock.calls) {
      expect(binary).toBe(resolve(canonical, '../../node_modules/.bin/wrangler'));
      expect(args?.slice(0, 2)).toEqual(['d1', 'execute']);
      expect(args).not.toContain('pnpm');
    }
    expect(JSON.parse(log.mock.calls[0]![0] as string)).toMatchObject({
      ok: true,
      contentHash: hash,
    });
  });
  it.each([
    { status: 1, code: undefined, signal: null, expected: 'exit=1, code=UNKNOWN, signal=none' },
    {
      status: null,
      code: 'ETIMEDOUT',
      signal: 'SIGTERM',
      expected: 'exit=none, code=ETIMEDOUT, signal=SIGTERM',
    },
    { status: null, code: 'ENOENT', signal: null, expected: 'exit=none, code=ENOENT, signal=none' },
  ])(
    'classifies command failures without leaking child output: $expected',
    async ({ expected, ...detail }) => {
      vi.mocked(execFileSync).mockImplementationOnce(() => {
        throw Object.assign(new Error('private-secret'), detail, {
          stdout: 'private-secret',
          stderr: 'private-secret',
        });
      });
      let message = '';
      try {
        await importFriendly(['--local']);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain(expected);
      expect(message).not.toContain('private-secret');
      expect(execFileSync).toHaveBeenCalledTimes(1);
    },
  );
  it('distinguishes invalid JSON and never proceeds to readback', async () => {
    vi.mocked(execFileSync).mockReturnValueOnce('Progress: private-secret\n[]');
    await expect(importFriendly(['--local'])).rejects.toThrow(
      'D1 response was not valid JSON; raw output omitted',
    );
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });
});

/** Mirrors Wrangler 4.158.0: remote --file uses import statistics, --command returns query rows. */
function mockWranglerDatabase(db: DatabaseSync): void {
  vi.mocked(execFileSync).mockImplementation((_binary, args) => {
    if (!Array.isArray(args)) throw new Error('Expected Wrangler arguments');
    const fileIndex = args.indexOf('--file');
    const commandIndex = args.indexOf('--command');
    if (fileIndex >= 0 === commandIndex >= 0) throw new Error('Choose file or command');
    const sql =
      fileIndex >= 0 ? readFileSync(args[fileIndex + 1]!, 'utf8') : args[commandIndex + 1]!;
    const isSelect = sql.startsWith('SELECT ');
    const rows = isSelect ? db.prepare(sql).all() : (db.exec(sql), []);
    if (args.includes('--remote') && fileIndex >= 0) {
      return JSON.stringify([
        {
          success: true,
          results: [
            {
              'Total queries executed': 1,
              'Rows read': rows.length,
              'Rows written': isSelect ? 0 : 1,
              'Database size (MB)': '0.01',
            },
          ],
        },
      ]);
    }
    return JSON.stringify([{ success: true, results: rows }]);
  });
}

describe('Wrangler remote import/query readback regression', () => {
  it.each(['--local', '--remote'])(
    '%s preserves identical reimport and validates stored content',
    async (target) => {
      const db = new DatabaseSync(':memory:');
      try {
        db.exec(
          readFileSync(
            new URL('../migrations/friendly/0001_snapshots.sql', import.meta.url),
            'utf8',
          ),
        );
        mockWranglerDatabase(db);
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        await importFriendly([target]);
        await importFriendly([target]);
        expect(db.prepare('SELECT count(*) AS count FROM friendly_snapshots').get()?.count).toBe(1);
        const snapshot = await loadImportSnapshot(canonical);
        const row = db.prepare('SELECT * FROM friendly_snapshots').get() as unknown as SnapshotRow;
        expect(await validateSnapshotRow(row, snapshot.version)).toEqual(snapshot);
        expect(log).toHaveBeenCalledTimes(2);
        const calls = vi.mocked(execFileSync).mock.calls;
        expect(calls).toHaveLength(4);
        expect(calls[0]![1]).toContain('--file');
        if (target === '--remote') expect(calls[1]![1]).toContain('--command');
      } finally {
        db.close();
      }
    },
  );
  it('remote readback rejects a conflicting version without replacing or deleting it', async () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(
        readFileSync(new URL('../migrations/friendly/0001_snapshots.sql', import.meta.url), 'utf8'),
      );
      const original = await loadImportSnapshot(canonical);
      const existing = structuredClone(original);
      existing.stores[0]!.name = 'Existing immutable version';
      const existingHash = await snapshotHash(existing);
      db.exec(snapshotInsertSQL(existing, existingHash));
      mockWranglerDatabase(db);
      await expect(importFriendly(['--remote'])).rejects.toThrow(
        'Version conflict: existing snapshot has different content',
      );
      const row = db.prepare('SELECT * FROM friendly_snapshots').get() as unknown as SnapshotRow;
      expect(await validateSnapshotRow(row, existing.version)).toEqual(existing);
      expect(db.prepare('SELECT count(*) AS count FROM friendly_snapshots').get()?.count).toBe(1);
      expect(vi.mocked(execFileSync).mock.calls).toHaveLength(2);
      expect(vi.mocked(execFileSync).mock.calls[1]![1]).toContain('--command');
    } finally {
      db.close();
    }
  });
});
