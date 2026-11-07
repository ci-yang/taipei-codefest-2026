/** Port of the frozen local prototype: ordered stops and bounded resource detours. */
import { createGraph, treePath, type ShortestTree, type RoutingGraph } from './routing-graph';
import { distance, distanceToRoute, finitePoint, pointArray, resourceIds, type RouteCoordinate, type RoutePoint, type RouteResource } from './routing-geometry';
export { RoutingGraphSchema } from './routing-graph';
export type { RoutingGraph } from './routing-graph';
export type { RouteCoordinate, RoutePoint, RouteResource } from './routing-geometry';

export interface CompareOptions { points: RoutePoint[]; services?: string[]; radius?: number; stores?: RouteResource[] }
export interface RouteCandidate {
  id: string; label: string; coordinates: RouteCoordinate[]; distanceM: number; connectorDistanceM: number;
  connectors: [RouteCoordinate, RouteCoordinate][]; resourceCount: number; storeIds: string[];
  estimateMinutes: number; viaLabel: string; basis: string;
}
export interface RouteComparison {
  routes: RouteCandidate[]; candidateCount: number; warning: string; error?: string;
  radius?: number; bounds?: RoutingGraph['bounds']; maxDistanceM?: number; graphVersion?: string;
  comparison?: { maxCandidateRoutes: number; detourRatio: number; maxExtraM: number };
}
interface Leg {
  from: number; to: number; nodePath: number[]; graphDistanceM: number; forward: ShortestTree; backward: ShortestTree;
}
export function createRouter(raw: unknown) {
  const { graph, contains, snap, shortestTree } = createGraph(raw);
  const VALID_SERVICES = new Set(['wifi', 'charge', 'toilet', 'accessible']);
  const MAX_CANDIDATES = 16;
  const SNAP_LIMIT_M = 120;
  function compare(input: unknown = {}): RouteComparison {
    const options = input as CompareOptions;
    const fail = (error: string): RouteComparison => ({ routes: [], candidateCount: 0, warning: '', error });
    if (!options || typeof options !== 'object') return fail('請提供有效的行程設定。');
    if (!graph || !graph.nodes.length) return fail('本地路網尚未載入，請先下載地圖或恢復連線。');
    const points = options.points;
    if (!Array.isArray(points) || points.length < 2 || points.length > 6 || points.some((point) => !finitePoint(point))) return fail('請設定有效起點與 1–5 個目的地。');
    const outside = points.findIndex((point) => !contains(point));
    if (outside !== -1) return fail(`${outside === 0 ? '起點' : `目的地 ${outside}`}超出本版路網範圍。保留你的真實位置，請手動選取範圍內地點或明確載入示範。`);
    for (let a = 0; a < points.length; a += 1) {
      for (let b = a + 1; b < points.length; b += 1) {
        if (distance(pointArray(points[a]!), pointArray(points[b]!)) < 1) return fail('起點與目的地有重複位置，請選擇不同地點。');
      }
    }
    const selected = new Set((Array.isArray(options.services) ? options.services : [...VALID_SERVICES]).filter((key) => VALID_SERVICES.has(key)));
    const radius = options.radius !== undefined && [100, 250, 500].includes(options.radius) ? options.radius : 250;
    const stores = (Array.isArray(options.stores) ? options.stores : []).filter((store) => finitePoint(store) && store.id != null && Array.isArray(store.services) && store.services.some((key) => selected.has(key)));
    const snapped = points.map(snap); const missing = snapped.findIndex((point) => !point);
    if (missing !== -1) return fail(`${missing === 0 ? '起點' : `目的地 ${missing}`}距可用路網超過 ${SNAP_LIMIT_M} 公尺；本版無法建立可靠接線，請改選附近地點。`);
    const trees = new Map<string, ShortestTree>();
    const getTree = (node: number, reversed = false): ShortestTree => {
      const key = `${node}:${reversed}`;
      if (!trees.has(key)) trees.set(key, shortestTree(node, reversed));
      return trees.get(key)!;
    };
    const baseLegs: Leg[] = [];
    for (let index = 1; index < points.length; index += 1) {
      const from = snapped[index - 1]!; const to = snapped[index]!;
      const forward = getTree(from.node); const backward = getTree(to.node, true);
      const nodePath = treePath(forward, to.node);
      if (!nodePath) return fail('這些地點在目前路網快照中無法連通；請改選地點，不以直線冒充可行路線。');
      baseLegs.push({ from: index - 1, to: index, nodePath, graphDistanceM: forward.distances[to.node]!, forward, backward });
    }
    function assemble(legs: Leg[], id: string, label: string, viaLabel = ''): RouteCandidate {
      const coordinates: RouteCoordinate[] = []; const connectors: [RouteCoordinate, RouteCoordinate][] = []; let distanceM = 0; let connectorDistanceM = 0;
      for (const leg of legs) {
        const start = pointArray(points[leg.from]!); const end = pointArray(points[leg.to]!);
        const path = leg.nodePath.map((node) => graph.nodes[node]!);
        const firstGap = snapped[leg.from]!.distanceM; const lastGap = snapped[leg.to]!.distanceM;
        const legCoordinates = [start, ...path, end];
        coordinates.push(...(coordinates.length ? legCoordinates.slice(1) : legCoordinates));
        connectorDistanceM += firstGap + lastGap;
        distanceM += leg.graphDistanceM + firstGap + lastGap;
        if (firstGap > 1) connectors.push([start, path[0]!]);
        if (lastGap > 1) connectors.push([path[path.length - 1]!, end]);
      }
      const storeIds = resourceIds(coordinates, stores, radius);
      return { id, label, coordinates, distanceM: Math.round(distanceM), connectorDistanceM: Math.round(connectorDistanceM),
        connectors, resourceCount: storeIds.length, storeIds, estimateMinutes: Math.ceil(distanceM / (4000 / 60)), viaLabel,
        basis: '本地 OSM 候選路網；起終點與路網接線為估計，未驗證實際入口。' };
    }
    const shortest = assemble(baseLegs, 'shortest', '最短路徑');
    const maxDistanceM = Math.min(shortest.distanceM * 1.6, shortest.distanceM + 1000);
    const covered = new Set(shortest.storeIds); const consideredNodes = new Set();
    const candidates = stores.filter((store) => !covered.has(String(store.id))).map((store) => {
      const candidateSnap = snap(store);
      if (!candidateSnap || consideredNodes.has(candidateSnap.node)) return null;
      consideredNodes.add(candidateSnap.node);
      let bestLeg = -1; let leastExtra = Infinity;
      baseLegs.forEach((leg, index) => {
        const extra = leg.forward.distances[candidateSnap.node]! + leg.backward.distances[candidateSnap.node]! - leg.graphDistanceM;
        if (extra < leastExtra) { leastExtra = extra; bestLeg = index; }
      });
      if (bestLeg < 0 || shortest.distanceM + leastExtra > maxDistanceM || !Number.isFinite(leastExtra)) return null;
      const nearby = stores.filter((other) => !covered.has(String(other.id)) && distance(pointArray(store), pointArray(other)) <= radius).length;
      return { store, node: candidateSnap.node, legIndex: bestLeg, extra: leastExtra, priority: nearby * 1000 / (leastExtra + 100) };
    }).filter((candidate) => candidate !== null).sort((a, b) => b.priority - a.priority || a.extra - b.extra).slice(0, MAX_CANDIDATES);
    let resourceRoute: RouteCandidate | null = null; let candidateCount = 1;
    for (const candidate of candidates) {
      const original = baseLegs[candidate.legIndex]!;
      const first = treePath(original.forward, candidate.node); const second = treePath(original.backward, candidate.node, true);
      if (!first || !second) continue;
      const alternate = { ...original, nodePath: [...first, ...second.slice(1)], graphDistanceM: original.graphDistanceM + candidate.extra };
      const legs = baseLegs.map((leg, index) => index === candidate.legIndex ? alternate : leg);
      const route = assemble(legs, 'resources', '資源最多', candidate.store.name || '沿途資源點');
      candidateCount += 1;
      if (route.resourceCount > shortest.resourceCount && (!resourceRoute || route.resourceCount > resourceRoute.resourceCount || (route.resourceCount === resourceRoute.resourceCount && route.distanceM < resourceRoute.distanceM))) resourceRoute = route;
    }
    const routes = resourceRoute ? [shortest, resourceRoute] : [shortest];
    const warning = `最短限目前地方路網與既定站序；資源最多限本次 ${candidateCount} 條候選，依所選服務及沿線 ${radius} m 計算。${resourceRoute ? '' : '未找到增加資源的替代路線。'}起終點接線為估計；時間以每小時 4 公里估算。非即時導航，也不保證無障礙或店家可用。`;
    return { routes, candidateCount, warning, radius, bounds: graph.bounds, maxDistanceM: Math.round(maxDistanceM),
      graphVersion: graph.version, comparison: { maxCandidateRoutes: MAX_CANDIDATES + 1, detourRatio: 1.6, maxExtraM: 1000 } };
  }
  return Object.freeze({ compare, contains, distanceToRoute, bounds: graph.bounds });
}
