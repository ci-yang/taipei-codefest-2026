import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ROOT } from './platform-tools.mjs';
import { loadReleaseConfig } from './platform-release-state.mjs';

test('release config pins the exact production origin to its Worker name', async () => {
  const config = await loadReleaseConfig();
  assert.equal(config.origin, 'https://taipei-friendly-platform.jason21131.workers.dev');
  assert.equal(new URL(config.origin).hostname.split('.')[0], config.name);
});

test('release config rejects an origin belonging to another Worker or non-workers.dev host', async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'release-config-test-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const source = JSON.parse(await readFile(resolve(ROOT, 'wrangler.jsonc'), 'utf8'));
  const path = resolve(directory, 'config.json');
  for (const origin of [
    'https://other-worker.jason21131.workers.dev',
    'https://taipei-friendly-platform.example.com',
    'https://taipei-friendly-platform.jason21131.workers.dev:444',
    'http://taipei-friendly-platform.jason21131.workers.dev',
  ]) {
    await writeFile(
      path,
      JSON.stringify({ ...source, vars: { ...source.vars, PUBLIC_ORIGIN: origin } }),
    );
    await assert.rejects(loadReleaseConfig(path));
  }
});
