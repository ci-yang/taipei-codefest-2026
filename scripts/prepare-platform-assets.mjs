import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = new URL('data/friendly/', root);
const output = new URL('apps/web/public/friendly/', root);
const manifestBytes = await readFile(new URL('manifest.json', source));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const config = JSON.parse(await readFile(new URL('wrangler.jsonc', root), 'utf8'));
if (manifest.version !== config.vars.DATA_VERSION) {
  throw new Error('Manifest version must match Wrangler DATA_VERSION');
}
const files = [
  ['snapshot', 'snapshot.json'],
  ['routingGraph', 'routing-graph.json'],
  ['mapData', 'map-data.geojson'],
];
// Read and verify the complete bundle before replacing any generated asset.
const verified = await Promise.all(files.map(async ([key, name]) => {
  const entry = manifest.files?.[key];
  const bytes = await readFile(new URL(name, source));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (entry?.path !== `/friendly/${name}` || entry?.sha256 !== hash) {
    throw new Error(`Canonical asset does not match manifest: ${name}`);
  }
  return [name, bytes];
}));
await mkdir(output, { recursive: true });
for (const [name, bytes] of verified) await writeFile(new URL(name, output), bytes);
await writeFile(new URL('manifest.json', output), manifestBytes);
console.log(`Prepared ${verified.length + 1} verified friendly assets in ${fileURLToPath(output)}`);
