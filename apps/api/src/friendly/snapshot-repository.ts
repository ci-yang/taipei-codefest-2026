import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FriendlySnapshotSchema, SourceManifestSchema, type FriendlySnapshot } from '@app/shared';
import { FriendlyDataUnavailableError, type FriendlyRepository } from './repository';

export function defaultFriendlyDataDirectory(): string {
  if (process.env.FRIENDLY_DATA_DIR) return resolve(process.env.FRIENDLY_DATA_DIR);
  return (
    [resolve('data/friendly'), resolve('../../data/friendly')].find((dir) =>
      existsSync(resolve(dir, 'manifest.json')),
    ) ?? resolve('data/friendly')
  );
}
export class SnapshotFriendlyRepository implements FriendlyRepository {
  constructor(private readonly directory = defaultFriendlyDataDirectory()) {}
  async read(version: string): Promise<FriendlySnapshot> {
    try {
      const [bytes, manifestJson] = await Promise.all([
        readFile(resolve(this.directory, 'snapshot.json'), 'utf8'),
        readFile(resolve(this.directory, 'manifest.json'), 'utf8'),
      ]);
      const manifest = SourceManifestSchema.parse(JSON.parse(manifestJson) as unknown);
      if (createHash('sha256').update(bytes).digest('hex') !== manifest.files.snapshot.sha256)
        throw new FriendlyDataUnavailableError();
      const data = JSON.parse(bytes) as Record<string, unknown>;
      const snapshot = FriendlySnapshotSchema.parse({ ...data, manifest });
      if (snapshot.version !== version) throw new FriendlyDataUnavailableError();
      return snapshot;
    } catch {
      throw new FriendlyDataUnavailableError();
    }
  }
}
