import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

describe('unhandled Node API errors', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([Error, TypeError, RangeError, SyntaxError])('records a safe %s category without request data', async (ErrorClass) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp();
    const error = new ErrorClass('Synthetic private request: lat=25.123&lng=121.456');
    error.name = 'Synthetic private name';
    app.get('/__test-error', () => { throw error; });

    const response = await app.request('/__test-error?lat=25.123&lng=121.456');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'internal_error' });
    expect(log).toHaveBeenCalledExactlyOnceWith('api_unhandled_error', { type: ErrorClass.name });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/25\.123|121\.456|private|lat=|lng=/);
  });
});
