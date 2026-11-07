/* Local OSM candidate routing. No requests, tracking, or remote route service. */
(() => {
  'use strict';
  const graph = window.FRIENDLY_ROUTING_DATA;
  const VALID_SERVICES = new Set(['wifi', 'charge', 'toilet', 'accessible']);
  const MAX_CANDIDATES = 16;
  const SNAP_LIMIT_M = 120;
  const EARTH_RADIUS_M = 6371000;
  const projectionCos = Math.cos(25.033 * Math.PI / 180);
  const toXY = ([lat, lng]) => [lng * 111320 * projectionCos, lat * 110540];
  const pointArray = (point) => [Number(point.lat), Number(point.lng)];
  const finitePoint = (point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng);
  function distance(a, b) {
    const lat1 = a[0] * Math.PI / 180; const lat2 = b[0] * Math.PI / 180;
    const dlat = lat2 - lat1; const dlng = (b[1] - a[1]) * Math.PI / 180;
    const value = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
  }
  function contains(point) {
    return Boolean(graph && finitePoint(point) && point.lat >= graph.bounds[0][0]
      && point.lat <= graph.bounds[1][0] && point.lng >= graph.bounds[0][1]
      && point.lng <= graph.bounds[1][1]);
  }
  const adjacency = graph ? graph.nodes.map(() => []) : [];
  let reverse = null;
  if (graph) graph.edges.forEach(([a, b, weight]) => {
    adjacency[a].push([b, weight]);
  });
  function reverseEdges() {
    if (!reverse) {
      reverse = graph ? graph.nodes.map(() => []) : [];
      if (graph) graph.edges.forEach(([a, b, weight]) => reverse[b].push([a, weight]));
    }
    return reverse;
  }
  class Heap {
    constructor() { this.items = []; }
    push(item) {
      const list = this.items; list.push(item); let index = list.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (list[parent][0] <= item[0]) break;
        list[index] = list[parent]; index = parent;
      }
      list[index] = item;
    }
    pop() {
      const list = this.items; const first = list[0]; const last = list.pop();
      if (list.length) {
        let index = 0;
        while (index * 2 + 1 < list.length) {
          let child = index * 2 + 1;
          if (child + 1 < list.length && list[child + 1][0] < list[child][0]) child += 1;
          if (last[0] <= list[child][0]) break;
          list[index] = list[child]; index = child;
        }
        list[index] = last;
      }
      return first;
    }
  }
  function shortestTree(start, reversed = false, seeds = null) {
    const edges = reversed ? reverseEdges() : adjacency;
    const distances = new Float64Array(edges.length); distances.fill(Infinity);
    const parents = new Int32Array(edges.length); parents.fill(-1);
    const queue = new Heap();
    for (const seed of seeds || [{ node: start, distanceM: 0 }]) {
      distances[seed.node] = seed.distanceM; queue.push([seed.distanceM, seed.node]);
    }
    while (queue.items.length) {
      const [cost, node] = queue.pop(); if (cost !== distances[node]) continue;
      for (const [next, weight] of edges[node]) {
        const proposed = cost + weight;
        if (proposed < distances[next]) {
          distances[next] = proposed; parents[next] = node; queue.push([proposed, next]);
        }
      }
    }
    return { distances, parents, start: seeds ? null : start };
  }
  function treePath(tree, target, reversed = false) {
    if (!Number.isFinite(tree.distances[target])) return null;
    const path = [target]; let current = target;
    while (current !== tree.start) {
      current = tree.parents[current];
      if (current < 0) { if (tree.start === null) break; return null; }
      path.push(current);
    }
    return reversed ? path : path.reverse();
  }
  function snap(point) {
    if (!contains(point)) return null;
    const coordinates = pointArray(point); let nearest = -1; let nearestDistance = Infinity;
    graph.nodes.forEach((node, index) => {
      const gap = distance(coordinates, node);
      if (gap < nearestDistance) { nearest = index; nearestDistance = gap; }
    });
    return nearestDistance <= SNAP_LIMIT_M ? { node: nearest, distanceM: nearestDistance } : null;
  }
  function snapCandidates(point) {
    if (!contains(point)) return [];
    const coordinates = pointArray(point); const candidates = [];
    graph.nodes.forEach((node, index) => {
      const gap = distance(coordinates, node);
      if (gap <= SNAP_LIMIT_M) candidates.push({ node: index, distanceM: gap });
    });
    return candidates.sort((a, b) => a.distanceM - b.distanceM);
  }
  function segmentDistanceXY(point, a, b) {
    const dx = b[0] - a[0]; const dy = b[1] - a[1];
    const t = dx || dy ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
  }
  function routeGap(point, coordinates) {
    const xy = toXY(pointArray(point)); let result = Infinity;
    for (let index = 1; index < coordinates.length; index += 1) {
      result = Math.min(result, segmentDistanceXY(xy, toXY(coordinates[index - 1]), toXY(coordinates[index])));
    }
    return result;
  }
  function resourceIds(coordinates, stores, radius) {
    const line = coordinates.map(toXY); const ids = new Set();
    for (const store of stores) {
      const point = toXY(pointArray(store));
      for (let index = 1; index < line.length; index += 1) {
        if (segmentDistanceXY(point, line[index - 1], line[index]) <= radius) { ids.add(String(store.id)); break; }
      }
    }
    return [...ids];
  }
  function compare(options = {}) {
    const fail = (error) => ({ routes: [], candidateCount: 0, warning: '', error });
    if (!options || typeof options !== 'object') return fail('請提供有效的行程設定。');
    if (!graph || !graph.nodes.length) return fail('本地路網尚未載入，請先下載地圖或恢復連線。');
    const points = options.points;
    if (!Array.isArray(points) || points.length < 2 || points.length > 6 || points.some((point) => !finitePoint(point))) return fail('請設定有效起點與 1–5 個目的地。');
    const outside = points.findIndex((point) => !contains(point));
    if (outside !== -1) return fail(`${outside === 0 ? '目前位置' : '目的地'}超出本機路網範圍（${graph.coverageLabel || '信義區與大安東側'}）。仍可查看全市資源，這段路線尚無法計算。`);
    for (let a = 0; a < points.length; a += 1) {
      for (let b = a + 1; b < points.length; b += 1) {
        if (distance(pointArray(points[a]), pointArray(points[b])) < 1) return fail('起點與目的地有重複位置，請選擇不同地點。');
      }
    }
    const selected = new Set((Array.isArray(options.services) ? options.services : [...VALID_SERVICES]).filter((key) => VALID_SERVICES.has(key)));
    const radius = [100, 250, 500].includes(options.radius) ? options.radius : 250;
    const stores = (Array.isArray(options.stores) ? options.stores : []).filter((store) => finitePoint(store) && store.id != null && Array.isArray(store.services) && store.services.some((key) => selected.has(key)));
    const candidateSets = options.shortestOnly ? points.map(snapCandidates) : null;
    const snapped = candidateSets ? candidateSets.map(candidates => candidates[0]) : points.map(snap);
    const missing = snapped.findIndex((point) => !point);
    if (missing !== -1) return fail(`${missing === 0 ? '起點' : `目的地 ${missing}`}距可用路網超過 ${SNAP_LIMIT_M} 公尺；本版無法建立可靠接線，請改選附近地點。`);
    const trees = new Map();
    const getTree = (node, reversed = false) => {
      const key = `${node}:${reversed}`;
      if (!trees.has(key)) trees.set(key, shortestTree(node, reversed));
      return trees.get(key);
    };
    const baseLegs = [];
    for (let index = 1; index < points.length; index += 1) {
      let from = snapped[index - 1]; let to = snapped[index];
      // A closest node can belong to an isolated courtyard/platform component.
      // Virtual source/target connectors consider every candidate within the same 120m limit.
      const forward = candidateSets ? shortestTree(from.node, false, candidateSets[index - 1]) : getTree(from.node);
      const backward = options.shortestOnly ? null : getTree(to.node, true);
      if (candidateSets) to = candidateSets[index].reduce((best, candidate) =>
        forward.distances[candidate.node] + candidate.distanceM < forward.distances[best.node] + best.distanceM ? candidate : best, to);
      const nodePath = treePath(forward, to.node);
      if (!nodePath) return fail('這些地點在目前路網快照中無法連通；請改選地點，不以直線冒充可行路線。');
      if (candidateSets) from = candidateSets[index - 1].find(candidate => candidate.node === nodePath[0]);
      baseLegs.push({ from: index - 1, to: index, nodePath,
        graphDistanceM: forward.distances[to.node] - (candidateSets ? from.distanceM : 0),
        startGap: from.distanceM, endGap: to.distanceM, forward, backward });
    }
    function assemble(legs, id, label, viaLabel = '') {
      const coordinates = []; const connectors = []; const roadSegments = []; let distanceM = 0; let connectorDistanceM = 0;
      for (const leg of legs) {
        const start = pointArray(points[leg.from]); const end = pointArray(points[leg.to]);
        const path = leg.nodePath.map((node) => graph.nodes[node]);
        roadSegments.push(path);
        const firstGap = leg.startGap ?? snapped[leg.from].distanceM; const lastGap = leg.endGap ?? snapped[leg.to].distanceM;
        const legCoordinates = [start, ...path, end];
        coordinates.push(...(coordinates.length ? legCoordinates.slice(1) : legCoordinates));
        connectorDistanceM += firstGap + lastGap;
        distanceM += leg.graphDistanceM + firstGap + lastGap;
        if (firstGap > 1) connectors.push([start, path[0]]);
        if (lastGap > 1) connectors.push([path[path.length - 1], end]);
      }
      const storeIds = resourceIds(coordinates, stores, radius);
      return { id, label, coordinates, distanceM: Math.round(distanceM), connectorDistanceM: Math.round(connectorDistanceM),
        connectors, roadSegments, resourceCount: storeIds.length, storeIds, estimateMinutes: Math.ceil(distanceM / (4000 / 60)), viaLabel,
        basis: '本地 OSM 候選路網；起終點與路網接線為估計，未驗證實際入口。' };
    }
    const shortest = assemble(baseLegs, 'shortest', '最短路徑');
    if (options.shortestOnly) return { routes: [shortest], candidateCount: 1, radius, bounds: graph.bounds, graphVersion: graph.version };
    const maxDistanceM = Math.min(shortest.distanceM * 1.6, shortest.distanceM + 1000);
    const covered = new Set(shortest.storeIds); const consideredNodes = new Set();
    const candidates = stores.filter((store) => !covered.has(String(store.id))).map((store) => {
      const candidateSnap = snap(store);
      if (!candidateSnap || consideredNodes.has(candidateSnap.node)) return null;
      consideredNodes.add(candidateSnap.node);
      let bestLeg = -1; let leastExtra = Infinity;
      baseLegs.forEach((leg, index) => {
        const extra = leg.forward.distances[candidateSnap.node] + leg.backward.distances[candidateSnap.node] - leg.graphDistanceM;
        if (extra < leastExtra) { leastExtra = extra; bestLeg = index; }
      });
      if (bestLeg < 0 || shortest.distanceM + leastExtra > maxDistanceM || !Number.isFinite(leastExtra)) return null;
      const nearby = stores.filter((other) => !covered.has(String(other.id)) && distance(pointArray(store), pointArray(other)) <= radius).length;
      return { store, node: candidateSnap.node, legIndex: bestLeg, extra: leastExtra, priority: nearby * 1000 / (leastExtra + 100) };
    }).filter(Boolean).sort((a, b) => b.priority - a.priority || a.extra - b.extra).slice(0, MAX_CANDIDATES);
    let resourceRoute = null; let candidateCount = 1;
    for (const candidate of candidates) {
      const original = baseLegs[candidate.legIndex];
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
  window.FriendlyRouter = Object.freeze({ compare, contains, distanceToRoute: routeGap, bounds: graph?.bounds || null });
})();
