// tests/chrome.mjs must not leave Chrome running or its profile on disk when start-up fails part way.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { launchChrome } from './chrome.mjs';

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

test('a failed DevTools connection kills Chrome and removes its profile', async () => {
  const failure = await launchChrome({ mapWsUrl: (url) => url.replace(/:\d+\//, ':1/') }).then(
    () => assert.fail('connecting to port 1 should fail'), (e) => e);
  assert.match(failure.message, /cannot connect to ws:\/\/127\.0\.0\.1:1\//);
  assert.ok(failure.chromePid > 0, 'error should name the Chrome pid');
  assert.equal(alive(failure.chromePid), false, `Chrome ${failure.chromePid} still running`);
  assert.equal(existsSync(failure.profile), false, `profile ${failure.profile} left behind`);
  const leftover = spawnSync('pgrep', ['-f', failure.profile], { encoding: 'utf8' }).stdout.trim();
  assert.equal(leftover, '', `processes still using the profile: ${leftover}`);
});
