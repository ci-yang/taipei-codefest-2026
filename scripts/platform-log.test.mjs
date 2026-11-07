import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPathnameLog } from './platform-local-worker.mjs';

test('pathname log oracle rejects empty output and query-bearing application lines', () => {
  assert.throws(() => assertPathnameLog(''), /application pathname log/);
  assert.throws(
    () => assertPathnameLog('[wrangler:info] GET /api/v1/friendly-stores 200 OK'),
    /application pathname log/,
  );
  assert.throws(
    () =>
      assertPathnameLog(
        'GET /api/v1/friendly-stores?lat=25.044321&lng=121.529876&radius=123 200\n',
      ),
    /application pathname log/,
  );
  assert.throws(
    () => assertPathnameLog('GET /api/v1/friendly-stores 200\nleaked radius=123\n'),
    /Coordinates/,
  );
  assert.doesNotThrow(() => assertPathnameLog('GET /api/v1/friendly-stores 200\n'));
});
