import { z } from 'zod';
import { distance, finitePoint, pointArray, type RoutePoint } from './routing-geometry';

const CoordinateSchema = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);
export const RoutingGraphSchema = z.object({
  version: z.string().min(1),
  bounds: z.tuple([CoordinateSchema, CoordinateSchema]),
  nodes: z.array(CoordinateSchema).min(1),
  edges: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().nonnegative(), z.string().optional()])),
}).superRefine((graph, ctx) => {
  const [min, max] = graph.bounds;
  if (min[0] >= max[0] || min[1] >= max[1]) ctx.addIssue({ code: 'custom', message: 'Invalid graph bounds' });
  for (const [a, b] of graph.edges) {
    if (a >= graph.nodes.length || b >= graph.nodes.length) {
      ctx.addIssue({ code: 'custom', message: 'Graph edge references missing node' }); break;
    }
  }
  if (graph.nodes.some(([lat, lng]) => lat < min[0] || lat > max[0] || lng < min[1] || lng > max[1])) {
    ctx.addIssue({ code: 'custom', message: 'Graph node is outside bounds' });
  }
});
export type RoutingGraph = z.infer<typeof RoutingGraphSchema>;
type WeightedNode = [number, number];
export interface ShortestTree { distances: Float64Array; parents: Int32Array; start: number }

class Heap {
  items: WeightedNode[] = [];
  push(item: WeightedNode): void {
    const list = this.items; list.push(item); let index = list.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (list[parent]![0] <= item[0]) break;
      list[index] = list[parent]!; index = parent;
    }
    list[index] = item;
  }
  pop(): WeightedNode {
    const list = this.items; const first = list[0]!; const last = list.pop()!;
    if (list.length) {
      let index = 0;
      while (index * 2 + 1 < list.length) {
        let child = index * 2 + 1;
        if (child + 1 < list.length && list[child + 1]![0] < list[child]![0]) child += 1;
        if (last[0] <= list[child]![0]) break;
        list[index] = list[child]!; index = child;
      }
      list[index] = last;
    }
    return first;
  }
}
export function treePath(tree: ShortestTree, target: number, reversed = false): number[] | null {
  if (!Number.isFinite(tree.distances[target])) return null;
  const path = [target]; let current = target;
  while (current !== tree.start) {
    current = tree.parents[current]!; if (current < 0) return null;
    path.push(current);
  }
  return reversed ? path : path.reverse();
}
export function createGraph(raw: unknown) {
  const graph = RoutingGraphSchema.parse(raw);
  const adjacency: WeightedNode[][] = graph.nodes.map(() => []);
  const reverse: WeightedNode[][] = graph.nodes.map(() => []);
  graph.edges.forEach(([a, b, weight]) => {
    adjacency[a]!.push([b, weight]); reverse[b]!.push([a, weight]);
  });
  function contains(point: unknown): point is RoutePoint {
    return finitePoint(point) && point.lat >= graph.bounds[0][0] && point.lat <= graph.bounds[1][0]
      && point.lng >= graph.bounds[0][1] && point.lng <= graph.bounds[1][1];
  }
  function snap(point: RoutePoint): { node: number; distanceM: number } | null {
    if (!contains(point)) return null;
    const coordinates = pointArray(point); let nearest = -1; let nearestDistance = Infinity;
    graph.nodes.forEach((node, index) => {
      const gap = distance(coordinates, node);
      if (gap < nearestDistance) { nearest = index; nearestDistance = gap; }
    });
    return nearestDistance <= 120 ? { node: nearest, distanceM: nearestDistance } : null;
  }
  function shortestTree(start: number, reversed = false): ShortestTree {
    const edges = reversed ? reverse : adjacency;
    const distances = new Float64Array(edges.length); distances.fill(Infinity); distances[start] = 0;
    const parents = new Int32Array(edges.length); parents.fill(-1);
    const queue = new Heap(); queue.push([0, start]);
    while (queue.items.length) {
      const [cost, node] = queue.pop(); if (cost !== distances[node]) continue;
      for (const [next, weight] of edges[node]!) {
        const proposed = cost + weight;
        if (proposed < distances[next]!) {
          distances[next] = proposed; parents[next] = node; queue.push([proposed, next]);
        }
      }
    }
    return { distances, parents, start };
  }
  return { graph, contains, snap, shortestTree };
}
