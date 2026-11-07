import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vi } from 'vitest';
import { FriendlyStoresResponseSchema, PlatformConfigSchema, SourceManifestSchema } from '@app/shared';
import { createRouter } from '@app/shared/routing';
import type { FriendlyDataAdapter } from '@/lib/friendly-data';
const read = (name: string): unknown => JSON.parse(readFileSync(resolve(process.cwd(), '../../data/friendly', name), 'utf8'));
export const snapshot = FriendlyStoresResponseSchema.parse(read('snapshot.json'));
export const manifest = SourceManifestSchema.parse(read('manifest.json'));
export const config = PlatformConfigSchema.parse({ version: 'test', dataVersion: snapshot.version, apiBase: '/api/v1', bounds: manifest.bounds,
  assets: { routingGraph: '/friendly/routing-graph.json', mapData: '/friendly/map-data.geojson', manifest: '/friendly/manifest.json' } });
export const graph = read('routing-graph.json');
export function dataAdapter(): FriendlyDataAdapter {
  return { stores: vi.fn(async () => ({ version: snapshot.version, stores: snapshot.stores })),
    config: vi.fn(async () => config), source: vi.fn(async () => manifest), router: vi.fn(async () => createRouter(graph)) };
}
