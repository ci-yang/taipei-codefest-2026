import { FriendlyStoresResponseSchema, PlatformConfigSchema, SourceManifestSchema } from '@app/shared';
import { createRouter, RoutingGraphSchema } from '@app/shared/routing';
import { apiGet, fetchValidated } from './api';

export const FRIENDLY_LABELS = { wifi: 'Wi-Fi', charge: '充電', toilet: '廁所', accessible: '無障礙' } as const;
export const friendlyData = {
  stores: (signal: AbortSignal) => apiGet('/api/v1/friendly-stores', FriendlyStoresResponseSchema, undefined, { signal }),
  config: (signal: AbortSignal) => apiGet('/config', PlatformConfigSchema, undefined, { signal }),
  source: (signal: AbortSignal) => apiGet('/api/v1/sources', SourceManifestSchema, undefined, { signal }),
  router: async (path: string, signal: AbortSignal) => createRouter(await fetchValidated(path, RoutingGraphSchema, { signal })),
};
export type FriendlyDataAdapter = typeof friendlyData;
