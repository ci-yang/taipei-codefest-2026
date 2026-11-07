import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FriendlyQuerySchema, FriendlySnapshotSchema } from '@app/shared';
import { queryFriendly } from '../src/friendly/query';
import { validateSnapshotRow, snapshotHash } from '../src/friendly/snapshot-validation';

const read = (file: string): string =>
  readFileSync(new URL(`../../../data/friendly/${file}`, import.meta.url), 'utf8');
const data = JSON.parse(read('snapshot.json')) as object;
const snapshot = FriendlySnapshotSchema.parse({
  ...data,
  manifest: JSON.parse(read('manifest.json')) as unknown,
});
describe('friendly query and canonical data', () => {
  it('preserves empty services and OR matches', () => {
    const result = queryFriendly(snapshot, FriendlyQuerySchema.parse({ services: 'wifi,charge' }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.services.includes('wifi') || s.services.includes('charge'))).toBe(
      true,
    );
    expect(snapshot.stores.some((s) => s.services.length === 0)).toBe(true);
    expect(queryFriendly(snapshot, FriendlyQuerySchema.parse({}))).toHaveLength(
      snapshot.manifest.storeCount,
    );
  });
  it('applies bbox, radius, limit and allows empty matches', () => {
    expect(queryFriendly(snapshot, FriendlyQuerySchema.parse({ bbox: '0,0,1,1' }))).toEqual([]);
    const first = snapshot.stores[0]!;
    const nearby = queryFriendly(
      snapshot,
      FriendlyQuerySchema.parse({ lat: `${first.lat}`, lng: `${first.lng}`, radius: '1' }),
    );
    expect(nearby.map((s) => s.id)).toContain(first.id);
    expect(queryFriendly(snapshot, FriendlyQuerySchema.parse({ limit: '2' }))).toHaveLength(2);
  });
  it.each([
    { lat: '25' },
    { lat: '', lng: '121', radius: '10' },
    { lat: 'NaN', lng: '121', radius: '10' },
    { lat: '91', lng: '121', radius: '10' },
    { lat: '25', lng: '181', radius: '10' },
    { lat: '25', lng: '121', radius: '0' },
    { lat: '25', lng: '121', radius: '50001' },
    { bbox: '1,1,0,0' },
    { bbox: '0,0,1,1', lat: '25', lng: '121', radius: '10' },
    { services: 'wifi,unknown' },
    { limit: '0' },
    { limit: '1.5' },
    { limit: '1001' },
    { unknown: 'x' },
  ])('rejects invalid query %j', (query) => {
    expect(FriendlyQuerySchema.safeParse(query).success).toBe(false);
  });
  it('verifies every committed asset hash and source evidence', () => {
    for (const file of Object.values(snapshot.manifest.files)) {
      const bytes = read(file.path.split('/').at(-1)!);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
    }
    expect(snapshot.manifest.source.measuredSha256).toBe(snapshot.manifest.source.declaredSha256);
    expect(
      snapshot.manifest.graph.sources.every((s) => s.measuredSha256 === s.declaredSha256),
    ).toBe(true);
    expect(Object.keys(data).sort()).toEqual(['stores', 'version']);
  });
  it('validates version, schema and hash before serving a D1 snapshot', async () => {
    const hash = await snapshotHash(snapshot);
    const row = {
      version: snapshot.version,
      stores_json: JSON.stringify(snapshot.stores),
      manifest_json: JSON.stringify(snapshot.manifest),
      content_hash: hash,
    };
    expect(await validateSnapshotRow(row, snapshot.version)).toEqual(snapshot);
    await expect(
      validateSnapshotRow({ ...row, content_hash: '0'.repeat(64) }, snapshot.version),
    ).rejects.toThrow();
    await expect(validateSnapshotRow(row, 'missing')).rejects.toThrow();
    await expect(
      validateSnapshotRow({ ...row, stores_json: '[]' }, snapshot.version),
    ).rejects.toThrow();
    await expect(validateSnapshotRow(null, snapshot.version)).rejects.toThrow();
  });
});
