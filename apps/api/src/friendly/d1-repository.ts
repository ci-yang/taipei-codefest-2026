import type { FriendlySnapshot } from '@app/shared';
import { FriendlyDataUnavailableError, type FriendlyRepository } from './repository';
import { validateSnapshotRow, type SnapshotRow } from './snapshot-validation';

/** Narrow readonly D1 contract keeps Node independent of Worker global declarations. */
export interface FriendlyD1Database {
  prepare(sql: string): { bind(...values: string[]): { first<T>(): Promise<T | null> } };
}
export class D1FriendlyRepository implements FriendlyRepository {
  constructor(private readonly database: FriendlyD1Database) {}
  async read(version: string): Promise<FriendlySnapshot> {
    try {
      const row = await this.database
        .prepare(
          'SELECT version, stores_json, manifest_json, content_hash FROM friendly_snapshots WHERE version = ?',
        )
        .bind(version)
        .first<SnapshotRow>();
      return await validateSnapshotRow(row, version);
    } catch {
      throw new FriendlyDataUnavailableError();
    }
  }
}
