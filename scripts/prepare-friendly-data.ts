/** One-time, explicit promotion of the team's read-only prototype. Runtime never imports it. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FriendlyBoundsSchema,
  FriendlyStoresResponseSchema,
  SourceManifestSchema,
} from '../packages/shared/src/friendly';

const root = resolve(import.meta.dirname, '..');
const sourceDir = resolve(root, 'docs/prototypes/friendly-route');
const outputDir = resolve(root, 'data/friendly');
const sha = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
function assignment(file: string, prefix: string): unknown {
  const text = readFileSync(resolve(sourceDir, file), 'utf8').trim();
  if (!text.startsWith(prefix)) throw new Error(`Unexpected assignment: ${file}`);
  return JSON.parse(text.slice(prefix.length).replace(/;$/, '')) as unknown;
}
function verify(file: string, declaredSha256: string) {
  const path = resolve('/tmp', file);
  const measuredSha256 = existsSync(path) ? sha(readFileSync(path)) : null;
  if (measuredSha256 && measuredSha256 !== declaredSha256)
    throw new Error(`Source hash mismatch: ${file}`);
  return {
    file,
    declaredSha256,
    measuredSha256,
    verification: measuredSha256 ? 'verified' : 'source-declared',
  };
}
const raw = assignment('data.js', 'window.FRIENDLY_DATA = ') as Record<string, unknown>;
const data = FriendlyStoresResponseSchema.parse({ version: raw.version, stores: raw.stores });
const source = raw.source as { name: string; url: string; updatedAt: string; sha256: string };
const graph = assignment('routing-data.js', 'window.FRIENDLY_ROUTING_DATA = ') as {
  version: string;
  nodes: unknown[];
  edges: unknown[];
  source: string;
  license: string;
  attribution: string;
  sources: { file: string; sha256: string }[];
};
const snapshot = `${JSON.stringify(data)}\n`;
const graphJson = `${JSON.stringify(graph)}\n`;
const mapBytes = readFileSync(resolve(sourceDir, 'map-data.geojson'));
const original = verify('codefest-friendly-data.csv', source.sha256);
const manifest = SourceManifestSchema.parse({
  version: data.version,
  fetchedAt: raw.fetchedAt,
  bounds: FriendlyBoundsSchema.parse(raw.bounds),
  storeCount: data.stores.length,
  source: {
    name: source.name,
    url: source.url,
    updatedAt: source.updatedAt,
    downloadUrl:
      'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=5a5b36e0-f870-4b7f-8378-c91ac5f57941',
    license: '臺北市資料大平臺資料使用規範：https://data.taipei/rule',
    declaredSha256: original.declaredSha256,
    measuredSha256: original.measuredSha256,
    verification: original.verification,
  },
  files: {
    snapshot: { path: '/friendly/snapshot.json', sha256: sha(snapshot) },
    routingGraph: { path: '/friendly/routing-graph.json', sha256: sha(graphJson) },
    mapData: { path: '/friendly/map-data.geojson', sha256: sha(mapBytes) },
  },
  graph: {
    version: graph.version,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    source: graph.source,
    license: graph.license,
    attribution: graph.attribution,
    sources: graph.sources.map((s) => verify(s.file, s.sha256)),
  },
  provenance: {
    stores: 'docs/prototypes/friendly-route/data.js',
    routingGraph: 'docs/prototypes/friendly-route/routing-data.js',
    mapData: 'docs/prototypes/friendly-route/map-data.geojson',
  },
  limitations: [
    '地方快照不是全臺北或即時資料。',
    '服務空白表示未標示；實際可用、營業與消費條件須向店家確認。',
    '路線是本地 OSM 候選計算；接線與現場通行、無障礙條件未驗證。',
  ],
});
mkdirSync(outputDir, { recursive: true });
for (const [name, content] of Object.entries({
  'snapshot.json': snapshot,
  'routing-graph.json': graphJson,
  'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
  'map-data.geojson': mapBytes,
})) {
  writeFileSync(resolve(outputDir, name), content);
}
console.log(
  JSON.stringify({
    version: data.version,
    storeCount: data.stores.length,
    graphNodes: graph.nodes.length,
    graphEdges: graph.edges.length,
    sourceVerification: original.verification,
  }),
);
