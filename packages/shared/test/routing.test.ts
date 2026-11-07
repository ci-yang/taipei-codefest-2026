import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createRouter, RoutingGraphSchema, type RouteComparison, type RoutePoint, type RouteResource } from '../src/routing';

const root = new URL('../../../', import.meta.url);
const graph = JSON.parse(readFileSync(new URL('data/friendly/routing-graph.json', root), 'utf8'));
const snapshot = JSON.parse(readFileSync(new URL('data/friendly/snapshot.json', root), 'utf8')) as { stores: RouteResource[] };
// These stops belong to the platform's v1 snapshot (5aabb36), not the evolving App catalogue.
const demoRoute = ['tpe-0360', 'tpe-0538', 'tpe-0007'];
const data = { stores: snapshot.stores, demoRoute };
const runtime = vm.createContext({ window: { FRIENDLY_ROUTING_DATA: graph } });
vm.runInContext(readFileSync(new URL('./routing-prototype.fixture.cjs', import.meta.url), 'utf8'), runtime);
const baseline = runtime.window.FriendlyRouter as { compare: (options: unknown) => RouteComparison };
const points = data.demoRoute.map((id) => data.stores.find((store) => store.id === id)!);

function summary(result: RouteComparison): unknown {
  return JSON.parse(JSON.stringify(result));
}

describe('device router — frozen prototype differential', () => {
  it('uses the exact published snapshot and original graph inputs for both solvers', () => {
    const manifest = JSON.parse(readFileSync(new URL('data/friendly/manifest.json', root), 'utf8'));
    for (const [file, key] of [['snapshot.json', 'snapshot'], ['routing-graph.json', 'routingGraph']] as const) {
      const bytes = readFileSync(new URL(`data/friendly/${file}`, root));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.files[key].sha256);
    }
    expect(points.every(Boolean)).toBe(true);
    expect(new Set(demoRoute).size).toBe(demoRoute.length);
    expect(graph).toEqual(JSON.parse(JSON.stringify(runtime.window.FRIENDLY_ROUTING_DATA)));
  });
  it.each([100, 250, 500])('preserves ordered stops, distance, connectors and OR resource IDs at %s m', (radius) => {
    const router = createRouter(graph);
    for (const services of [['wifi', 'toilet'], ['accessible'], [], ['wifi', 'charge', 'toilet', 'accessible']]) {
      const options = { points, stores: data.stores, services, radius };
      expect(summary(router.compare(options))).toEqual(summary(baseline.compare(options)));
    }
  });
  it('preserves invalid, outside, repeated and unsnappable point errors', () => {
    const router = createRouter(graph);
    for (const input of [null, {}, { points: [points[0]] }, { points: [points[0], points[0]] },
      { points: [{ lat: 26, lng: 122 }, points[1]] }, { points: [{ lat: NaN, lng: 121.55 }, points[1]] },
      { points: [{ lat: 25.023, lng: 121.546 }, points[1]] }]) {
      expect(summary(router.compare(input))).toEqual(summary(baseline.compare(input)));
    }
  });
  it('rejects malformed graph edges and reports disconnected directed nodes without straight-line routes', () => {
    expect(() => createRouter({ ...graph, edges: [[0, 9999999, 1]] })).toThrow();
    expect(() => createRouter({ ...graph, edges: [[0, 1, -1]] })).toThrow();
    const tiny = { version: 'test', bounds: [[25, 121], [26, 122]], nodes: [[25.1, 121.1], [25.2, 121.2]], edges: [] };
    expect(RoutingGraphSchema.safeParse(tiny).success).toBe(true);
    const result = createRouter(tiny).compare({ points: tiny.nodes.map(([lat, lng]) => ({ lat, lng })) });
    expect(result.routes).toEqual([]);
    expect(result.error).toContain('無法連通');
  });
  it('limits alternatives and includes ordered waypoints without network or window', () => {
    const result = createRouter(graph).compare({ points, stores: data.stores });
    expect(result.error).toBeUndefined();
    expect(result.candidateCount).toBeLessThanOrEqual(17);
    for (const route of result.routes) {
      expect(route.distanceM).toBeLessThanOrEqual(result.maxDistanceM!);
      expect(new Set(route.storeIds).size).toBe(route.resourceCount);
      let offset = 0;
      for (const point of points as RoutePoint[]) {
        const index = route.coordinates.findIndex(([lat, lng], i) => i >= offset && lat === point.lat && lng === point.lng);
        expect(index).toBeGreaterThanOrEqual(offset);
        offset = index;
      }
    }
  });
});
