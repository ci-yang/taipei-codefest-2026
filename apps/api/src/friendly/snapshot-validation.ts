import { FriendlySnapshotSchema, Sha256Schema, type FriendlySnapshot } from '@app/shared';
import { FriendlyDataUnavailableError } from './repository';

export interface SnapshotRow {
  version: string;
  stores_json: string;
  manifest_json: string;
  content_hash: string;
}
export async function snapshotHash(snapshot: FriendlySnapshot): Promise<string> {
  const canonical = FriendlySnapshotSchema.parse(snapshot);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(canonical)),
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function validateSnapshotRow(
  row: SnapshotRow | null,
  version: string,
): Promise<FriendlySnapshot> {
  try {
    if (!row || row.version !== version) throw new FriendlyDataUnavailableError();
    const snapshot = FriendlySnapshotSchema.parse({
      version: row.version,
      stores: JSON.parse(row.stores_json) as unknown,
      manifest: JSON.parse(row.manifest_json) as unknown,
    });
    if (Sha256Schema.parse(row.content_hash) !== (await snapshotHash(snapshot)))
      throw new FriendlyDataUnavailableError();
    return snapshot;
  } catch {
    throw new FriendlyDataUnavailableError();
  }
}
