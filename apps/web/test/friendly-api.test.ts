import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiGet, fetchValidated, REQUEST_TIMEOUT_MS } from '@/lib/api';
import { LocalMapSchema } from '@/lib/friendly-map-data';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const schema = z.object({ ok: z.boolean() });
describe('bounded and validated API / assets', () => {
  it('retains query compatibility and rejects invalid data and invalid local geometry', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 'wrong' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[999, 25], [121, 25]] } }] })));
    vi.stubGlobal('fetch', fetcher);
    expect(await apiGet('/api/example', schema, { value: 'a b', omitted: undefined })).toEqual({ ok: true });
    expect(fetcher.mock.calls[0]![0]).toBe('/api/example?value=a+b');
    await expect(fetchValidated('/invalid', schema)).rejects.toThrow('資料格式不符');
    await expect(fetchValidated('/map.geojson', LocalMapSchema)).rejects.toThrow('資料格式不符');
  });
  it('aborts hanging requests at 15 seconds and on external cancellation', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      signals.push(options.signal); options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    })));
    const timed = fetchValidated('/graph', schema); const timeoutAssertion = expect(timed).rejects.toThrow('逾時');
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS); await timeoutAssertion;
    expect(signals[0]!.aborted).toBe(true);
    const controller = new AbortController();
    const request = fetchValidated('/graph', schema, { signal: controller.signal });
    const cancelled = expect(request).rejects.toMatchObject({ name: 'AbortError' }); controller.abort(); await cancelled;
    expect(signals[1]!.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
});
