import { Hono } from 'hono';
import type { PlatformConfig } from '@app/shared';
import type { FriendlyRepository } from '../friendly/repository';

export interface PlatformVersions {
  dataVersion: string;
  buildSha: string;
}
export function platformRoutes(
  repository: FriendlyRepository,
  versions: PlatformVersions,
  includeHealth = true,
): Hono {
  const app = new Hono();
  app.get('/config', async (c) => {
    try {
      const snapshot = await repository.read(versions.dataVersion);
      const config: PlatformConfig = {
        version: versions.buildSha,
        dataVersion: snapshot.version,
        apiBase: '/api/v1',
        bounds: snapshot.manifest.bounds,
        assets: {
          routingGraph: '/friendly/routing-graph.json',
          mapData: '/friendly/map-data.geojson',
          manifest: '/friendly/manifest.json',
        },
      };
      return c.json(config);
    } catch {
      return c.json({ error: 'data_unavailable' }, 503);
    }
  });
  if (includeHealth)
    app.get('/healthz', async (c) => {
      try {
        await repository.read(versions.dataVersion);
        return c.json({
          ok: true,
          version: versions.buildSha,
          dataVersion: versions.dataVersion,
          data: 'ready' as const,
        });
      } catch {
        return c.json(
          {
            ok: false,
            version: versions.buildSha,
            dataVersion: versions.dataVersion,
            data: 'unavailable' as const,
          },
          503,
        );
      }
    });
  return app;
}
