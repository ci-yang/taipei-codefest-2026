import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocationAdapter, LOCATION_POLICY, validateLocation } from '@/lib/friendly-location';
import type { FriendlyBounds } from '@app/shared';
const bounds: FriendlyBounds = [[25.023, 121.546], [25.044, 121.574]];
const now = 1_800_000_000_000;
const valid = { latitude: 25.035, longitude: 121.56, timestamp: now, accuracy: 10 };
afterEach(() => vi.useRealTimers());

describe('real location boundary', () => {
  it.each([
    [{ ...valid, is_mocked: true }, 'simulated'],
    [{ ...valid, accuracy: 101 }, 'inaccurate'], [{ ...valid, accuracy: undefined }, 'inaccurate'],
    [{ ...valid, timestamp: now - 60_001 }, 'stale'], [{ ...valid, timestamp: now + 2000 }, 'stale'],
    [{ ...valid, latitude: 26 }, 'outside'], [{ ...valid, longitude: NaN }, 'invalid'],
  ] as const)('rejects invalid or unsuitable position %#', (position, reason) => {
    expect(validateLocation(position, bounds, now)).toBe(reason);
  });
  it('accepts a fresh position at the policy accuracy limit', () => {
    expect(validateLocation({ ...valid, accuracy: 100 }, bounds, now)).toBeNull();
  });
  it('keeps browser permission denial distinct from unknown native []', async () => {
    const browser = createLocationAdapter({ nativeAvailable: () => false, getNative: vi.fn(), now: () => now,
      geolocation: { getCurrentPosition: (_ok, fail) => fail?.({ code: 1, message: 'denied' } as GeolocationPositionError) } });
    expect((await browser(bounds, new AbortController().signal)).reason).toBe('denied');
    const native = createLocationAdapter({ nativeAvailable: () => true, getNative: async () => [], now: () => now });
    expect((await native(bounds, new AbortController().signal)).reason).toBe('unknown');
  });
  it('bounds silent native/browser providers to 12 seconds', async () => {
    vi.useFakeTimers();
    for (const nativeAvailable of [true, false]) {
      const locate = createLocationAdapter({ nativeAvailable: () => nativeAvailable, getNative: () => new Promise(() => {}),
        geolocation: { getCurrentPosition: vi.fn() } });
      const request = locate(bounds, new AbortController().signal);
      await vi.advanceTimersByTimeAsync(LOCATION_POLICY.timeoutMs);
      expect((await request).reason).toBe('timeout');
      expect(vi.getTimerCount()).toBe(0);
    }
  });
  it('cancels before a late browser response and releases its timer', async () => {
    vi.useFakeTimers();
    let callback: PositionCallback | undefined;
    const locate = createLocationAdapter({ nativeAvailable: () => false, getNative: vi.fn(), now: () => now,
      geolocation: { getCurrentPosition: (success) => { callback = success; } } });
    const controller = new AbortController();
    const request = locate(bounds, controller.signal);
    const assertion = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    callback?.({ coords: valid, timestamp: now } as unknown as GeolocationPosition);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
