import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  FriendlyStoresResponseSchema,
  PlatformConfigSchema,
  PlatformHealthSchema,
  SourceManifestSchema,
} from '@app/shared';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import { createEdgeApp, type PlatformBindings } from '../src/edge-app';
import worker from '../src/worker';
import { SnapshotFriendlyRepository } from '../src/friendly/snapshot-repository';
import { snapshotHash, type SnapshotRow } from '../src/friendly/snapshot-validation';

const repository = new SnapshotFriendlyRepository();
const version = 'friendly-route-2026-11-07-v1';
const bindings: PlatformBindings = {
  DATA_VERSION: version,
  BUILD_SHA: 'test-commit',
  FRIENDLY_DB: {
    prepare: () => ({ bind: () => ({ first: async <T>(): Promise<T | null> => null }) }),
  },
};
afterAll(() => pool.end());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Node and Worker platform contracts', () => {
  for (const runtime of ['Node', 'Worker'] as const) {
    const app = () =>
      runtime === 'Node' ? createApp(undefined, repository) : createEdgeApp(bindings, repository);
    it(`${runtime} serves schema-validated stores, sources and public config`, async () => {
      const server = app();
      const stores = await server.request('/api/v1/friendly-stores?services=wifi,charge&limit=3');
      expect(stores.status).toBe(200);
      const parsed = FriendlyStoresResponseSchema.parse(await stores.json());
      expect(parsed.stores).toHaveLength(3);
      expect(
        parsed.stores.every((s) => s.services.includes('wifi') || s.services.includes('charge')),
      ).toBe(true);
      const source = SourceManifestSchema.parse(
        await (await server.request('/api/v1/sources')).json(),
      );
      expect(source.storeCount).toBe(103);
      const config = PlatformConfigSchema.parse(await (await server.request('/config')).json());
      expect(config.dataVersion).toBe(version);
      expect(Object.keys(config).sort()).toEqual([
        'apiBase',
        'assets',
        'bounds',
        'dataVersion',
        'version',
      ]);
    });
    it(`${runtime} has empty, invalid and unknown API JSON responses`, async () => {
      const server = app();
      const empty = await server.request('/api/v1/friendly-stores?bbox=0,0,1,1');
      expect(await empty.json()).toEqual({ version, stores: [] });
      for (const query of [
        'lat=25',
        'services=wifi&services=toilet',
        'limit=1001',
        'radius=-1',
        'services=unknown',
      ]) {
        const bad = await server.request(`/api/v1/friendly-stores?${query}`);
        expect(bad.status).toBe(400);
        expect(await bad.json()).toEqual({ error: 'invalid_query' });
      }
      const unknown = await server.request('/api/v1/does-not-exist');
      expect(unknown.status).toBe(404);
      expect(unknown.headers.get('content-type')).toContain('application/json');
    });
    it(`${runtime} never logs GPS queries in a non-test environment`, async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const server = app();
      await server.request('/api/v1/friendly-stores?lat=25.035123&lng=121.562789&radius=500');
      expect(log).toHaveBeenCalled();
      const output = JSON.stringify(log.mock.calls);
      expect(output).toContain('/api/v1/friendly-stores');
      expect(output).not.toMatch(/25\.035123|121\.562789|lat=|lng=|radius=|\?/);
    });
    it(`${runtime} fails closed without leaking repository errors`, async () => {
      const broken = {
        read: async () => {
          throw new Error('secret-token=private&lat=25.035123');
        },
      };
      const server =
        runtime === 'Node' ? createApp(undefined, broken) : createEdgeApp(bindings, broken);
      server.get('/explode', () => {
        throw new Error('private-token');
      });
      for (const path of ['/api/v1/friendly-stores', '/api/v1/sources', '/config']) {
        const response = await server.request(path);
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: 'data_unavailable' });
      }
      const unexpected = await server.request('/explode');
      expect(unexpected.status).toBe(500);
      expect(await unexpected.json()).toEqual({ error: 'internal_error' });
    });
  }
  it('Worker health checks exact D1 snapshot, handles corrupt and missing versions', async () => {
    const snapshot = await repository.read(version);
    let row: SnapshotRow | null = {
      version,
      stores_json: JSON.stringify(snapshot.stores),
      manifest_json: JSON.stringify(snapshot.manifest),
      content_hash: await snapshotHash(snapshot),
    };
    const queried: string[] = [];
    const env: PlatformBindings = {
      ...bindings,
      FRIENDLY_DB: {
        prepare: () => ({
          bind: (key: string) => {
            queried.push(key);
            return { first: async <T>(): Promise<T | null> => row as T | null };
          },
        }),
      },
    };
    let response = await worker.fetch(new Request('http://localhost/healthz'), env);
    expect(response.status).toBe(200);
    expect(PlatformHealthSchema.parse(await response.json())).toEqual({
      ok: true,
      data: 'ready',
      version: 'test-commit',
      dataVersion: version,
    });
    expect(queried).toEqual([version]);
    row = { ...row, content_hash: '0'.repeat(64) };
    response = await worker.fetch(new Request('http://localhost/api/v1/friendly-stores'), env);
    expect(response.status).toBe(503);
    row = null;
    response = await worker.fetch(new Request('http://localhost/healthz'), env);
    expect(response.status).toBe(503);
    expect(PlatformHealthSchema.parse(await response.json()).data).toBe('unavailable');
  });
});
