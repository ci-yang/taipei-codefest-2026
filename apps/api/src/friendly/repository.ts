import type { FriendlySnapshot } from '@app/shared';

export interface FriendlyRepository {
  read(version: string): Promise<FriendlySnapshot>;
}
export class FriendlyDataUnavailableError extends Error {
  constructor() {
    super('Friendly data is unavailable');
    this.name = 'FriendlyDataUnavailableError';
  }
}
