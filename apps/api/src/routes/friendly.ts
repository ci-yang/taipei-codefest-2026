import { Hono } from 'hono';
import { FriendlyQuerySchema } from '@app/shared';
import type { FriendlyRepository } from '../friendly/repository';
import { queryFriendly } from '../friendly/query';

export function friendlyRoutes(repository: FriendlyRepository, version: string): Hono {
  const app = new Hono();
  app.get('/friendly-stores', async (c) => {
    // Reject repeated keys too: choosing the first value could silently change a spatial query.
    if (Object.values(c.req.queries()).some((values) => values.length !== 1))
      return c.json({ error: 'invalid_query' }, 400);
    const query = FriendlyQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: 'invalid_query' }, 400);
    try {
      const snapshot = await repository.read(version);
      return c.json({ version: snapshot.version, stores: queryFriendly(snapshot, query.data) });
    } catch {
      return c.json({ error: 'data_unavailable' }, 503);
    }
  });
  app.get('/sources', async (c) => {
    try {
      return c.json((await repository.read(version)).manifest);
    } catch {
      return c.json({ error: 'data_unavailable' }, 503);
    }
  });
  return app;
}
