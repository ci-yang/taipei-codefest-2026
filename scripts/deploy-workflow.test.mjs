import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const workflow = await readFile(
  new URL('../.github/workflows/deploy-cloudflare.yml', import.meta.url),
  'utf8',
);
const MAIN_ONLY = "${{ github.ref == 'refs/heads/main' }}";

// Read only complete job blocks at their YAML indentation, never a whole-file keyword match.
function inspectWorkflow(source) {
  const jobsStart = source.indexOf('\njobs:\n');
  assert.ok(jobsStart >= 0, 'The workflow must have a jobs mapping.');
  const jobs = new Map(
    [
      ...source
        .slice(jobsStart)
        .matchAll(/^ {2}([a-z][a-z0-9_-]*):\n([\s\S]*?)(?=^ {2}[a-z][a-z0-9_-]*:\n|$(?![\s\S]))/gm),
    ].map((match) => [match[1], match[2]]),
  );
  assert.deepEqual([...jobs.keys()], ['preflight', 'verify', 'deploy']);
  const field = (job, name) => jobs.get(job).match(new RegExp(`^    ${name}: (.+)$`, 'm'))?.[1];
  assert.equal(field('verify', 'needs'), 'preflight');
  assert.equal(field('deploy', 'needs'), '[preflight, verify]');
  assert.equal(field('verify', 'if'), MAIN_ONLY);
  assert.equal(field('deploy', 'if'), MAIN_ONLY);
  assert.equal(field('verify', 'uses'), './.github/workflows/ci.yml');
  const outsideDeploy = source.slice(0, jobsStart) + jobs.get('preflight') + jobs.get('verify');
  assert.doesNotMatch(outsideDeploy, /secrets\.|CLOUDFLARE_API_TOKEN|secrets:\s*inherit/);
  assert.equal((jobs.get('deploy').match(/secrets\.CLOUDFLARE_API_TOKEN/g) || []).length, 1);
  const runs = [...jobs.get('preflight').matchAll(/^ {8}run: \|\n((?: {10}[^\n]*\n)+)/gm)];
  assert.equal(runs.length, 1, 'Preflight must execute exactly one explicit ref guard.');
  assert.doesNotMatch(
    jobs.get('preflight'),
    /\buses:/,
    'Preflight must not execute checkout or third-party actions.',
  );
  return runs[0][1].replace(/^ {10}/gm, '');
}

test('deployment has a credential-free preflight and requires both main and successful verification', () => {
  assert.ok(inspectWorkflow(workflow).trim());
});

test('the actual workflow ref guard accepts only the main branch and visibly rejects other refs', () => {
  const script = inspectWorkflow(workflow);
  for (const ref of [
    'refs/heads/main',
    'refs/heads/feature',
    'refs/tags/main',
    'refs/heads/main-evil',
    '',
  ]) {
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', script], {
      env: { PATH: process.env.PATH, GITHUB_REF: ref },
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(
      result.status,
      ref === 'refs/heads/main' ? 0 : 1,
      `Unexpected outcome for ${JSON.stringify(ref)}`,
    );
    if (ref !== 'refs/heads/main') assert.match(result.stdout + result.stderr, /::error::.*main/);
  }
});

test('structural guard rejects removed prerequisites, bypass conditions, and credentials before preflight', () => {
  for (const mutate of [
    (source) => source.replace('    needs: preflight\n', ''),
    (source) => source.replace('    needs: [preflight, verify]', '    needs: preflight'),
    (source) => source.replace(`    if: ${MAIN_ONLY}`, '    if: always()'),
    (source) =>
      source.replace(
        '  preflight:\n',
        '  preflight:\n    env:\n      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n',
      ),
    (source) => source.replace(/^ {2}preflight:\n[\s\S]*?(?=^ {2}verify:)/m, ''),
  ]) {
    const changed = mutate(workflow);
    assert.notEqual(changed, workflow, 'Mutation must affect the inspected workflow.');
    assert.throws(() => inspectWorkflow(changed));
  }
});
