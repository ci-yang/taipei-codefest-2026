import { describe, expect, it, vi } from 'vitest';
import type { LocationResult } from '@/composables/useTownPassBridge';
import { LOCATE_RETRY_DELAY_MS, locateWithRetry } from '@/lib/locate';

const POS = { latitude: 25.04, longitude: 121.56, timestamp: 1 };

function sequence(...results: LocationResult[]) {
  const fn = vi.fn<() => Promise<LocationResult>>();
  for (const r of results) fn.mockResolvedValueOnce(r);
  return fn;
}

describe('locateWithRetry', () => {
  it('第一次就成功：不重試、不等待', async () => {
    const get = sequence(POS);
    const sleep = vi.fn(async () => undefined);
    const out = await locateWithRetry(get, { sleep });
    expect(out).toEqual({ position: POS, attempts: 1 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('第一次回 []（權限框還沒按完／逾時）→ 等 5 秒自動重試一次，第二次成功', async () => {
    const get = sequence([], POS);
    const sleep = vi.fn(async () => undefined);
    const onRetry = vi.fn();
    const out = await locateWithRetry(get, { sleep, onRetry });
    expect(out).toEqual({ position: POS, attempts: 2 });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(LOCATE_RETRY_DELAY_MS);
    expect(LOCATE_RETRY_DELAY_MS).toBe(5_000);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('兩次都失敗 → position null，只試兩次（不無限重試）', async () => {
    const get = sequence([], [], POS);
    const out = await locateWithRetry(get, { sleep: async () => undefined });
    expect(out).toEqual({ position: null, attempts: 2 });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('預設 sleep 真的會等 retryDelayMs 才發第二次', async () => {
    vi.useFakeTimers();
    try {
      const get = sequence([], POS);
      const p = locateWithRetry(get);
      await vi.advanceTimersByTimeAsync(LOCATE_RETRY_DELAY_MS - 1);
      expect(get).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(get).toHaveBeenCalledTimes(2);
      expect((await p).position).toEqual(POS);
    } finally {
      vi.useRealTimers();
    }
  });
});
