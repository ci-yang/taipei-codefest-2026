import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { stripVTControlCharacters } from 'node:util';
import { ROOT, WRANGLER } from './platform-tools.mjs';
import { fetchResource } from './smoke-platform.mjs';

const pathnameLine = 'GET /api/v1/friendly-stores 200';
export function assertPathnameLog(output) {
  const lines = stripVTControlCharacters(output).split(/\r?\n/);
  assert.ok(
    lines.some((line) => line.trim() === pathnameLine),
    'Captured application pathname log is required.',
  );
  assert.doesNotMatch(
    output,
    /25\.044321|121\.529876|(?:lat|lng|radius)=/,
    'Coordinates must not appear in application logs.',
  );
}

export async function waitForPathnameLog(readOutput) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const output = readOutput();
    if (
      stripVTControlCharacters(output)
        .split(/\r?\n/)
        .some((line) => line.trim() === pathnameLine)
    ) {
      assertPathnameLog(output);
      return pathnameLine;
    }
    await delay(50);
  }
  assertPathnameLog(readOutput());
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

export async function startWorker(persist, dataVersion, sourceSha) {
  const port = await freePort();
  const inspectorPort = await freePort();
  const child = spawn(
    WRANGLER,
    [
      'dev',
      '--local',
      '--config',
      'wrangler.jsonc',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--inspector-port',
      String(inspectorPort),
      '--persist-to',
      persist,
      '--var',
      `DATA_VERSION:${dataVersion}`,
      '--var',
      `BUILD_SHA:${sourceSha}`,
      '--log-level',
      'log',
      '--show-interactive-dev-session=false',
    ],
    {
      cwd: ROOT,
      env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    },
  );
  let output = '',
    spawnError;
  const collect = (chunk) => {
    output = (output + chunk.toString()).slice(-32_000);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.on('error', (error) => {
    spawnError = error;
  });
  const closed = once(child, 'close').catch(() => {});
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode) return;
    const kill = (signal) => {
      try {
        if (process.platform === 'win32') child.kill(signal);
        else process.kill(-child.pid, signal);
      } catch {
        /* Gone. */
      }
    };
    kill('SIGTERM');
    await Promise.race([closed, delay(2000)]);
    if (child.exitCode === null && !child.signalCode) {
      kill('SIGKILL');
      await closed;
    }
  };
  const url = `http://127.0.0.1:${port}`;
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (spawnError || child.exitCode !== null)
        throw new Error('Local Wrangler exited before readiness.');
      try {
        const response = await fetchResource(url + '/healthz', { timeoutMs: 500, retries: 0 });
        assert.ok([200, 503].includes(response.status));
        assert.equal(JSON.parse(response.bytes.toString()).version, sourceSha);
        return {
          url,
          stop,
          output: () => output,
          clearOutput: () => {
            output = '';
          },
        };
      } catch {
        await delay(500);
      }
    }
    throw new Error('Local Wrangler did not become ready within the bounded startup window.');
  } catch (error) {
    await stop();
    throw error;
  }
}
