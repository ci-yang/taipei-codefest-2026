import type { FriendlyBounds } from '@app/shared';
import type { TownPassPosition, LocationResult } from '@/composables/useTownPassBridge';

export const LOCATION_POLICY = { timeoutMs: 12_000, maximumAgeMs: 60_000, maximumAccuracyM: 100 } as const;
export type LocationFailure = 'simulated' | 'denied' | 'timeout' | 'unavailable' | 'unknown' | 'inaccurate' | 'stale' | 'outside' | 'invalid';
export interface LocationReading { source: 'native' | 'browser'; position: TownPassPosition | null; reason?: LocationFailure; message: string }
export interface LocationDependencies {
  nativeAvailable: () => boolean;
  getNative: (options: { timeoutMs: number }) => Promise<LocationResult>;
  geolocation?: Pick<Geolocation, 'getCurrentPosition'>;
  now?: () => number;
}
export const LOCATION_MESSAGES: Record<LocationFailure, string> = {
  simulated: '收到模擬位置，未作為真實起點。請手動選擇名冊中的起點。',
  denied: '定位權限被拒絕。可開啟權限後重試，或手動選起點。',
  timeout: '定位超過 12 秒。請重試或手動選起點。',
  unavailable: '目前無法取得定位。請重試或手動選起點。',
  unknown: '台北通未提供位置或失敗原因。請重試或手動選起點。',
  inaccurate: '定位精度超過 100 公尺或未知，暫不採用。請移到開闊處重試或手動選起點。',
  stale: '定位超過 60 秒或時間無效，暫不採用。請重試或手動選起點。',
  outside: '目前位置超出這份地方路網範圍，未作為起點。請手動選範圍內的地點。',
  invalid: '收到的位置格式無效。請重試或手動選起點。',
};
export function validateLocation(position: TownPassPosition, bounds: FriendlyBounds, now = Date.now()): LocationFailure | null {
  if (position.is_mocked === true) return 'simulated';
  if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) return 'invalid';
  if (!Number.isFinite(position.timestamp) || now - position.timestamp > LOCATION_POLICY.maximumAgeMs || position.timestamp > now + 1000) return 'stale';
  if (typeof position.accuracy !== 'number' || !Number.isFinite(position.accuracy) || position.accuracy < 0 || position.accuracy > LOCATION_POLICY.maximumAccuracyM) return 'inaccurate';
  const [[south, west], [north, east]] = bounds;
  if (position.latitude < south || position.latitude > north || position.longitude < west || position.longitude > east) return 'outside';
  return null;
}
export function createLocationAdapter(deps: LocationDependencies) {
  return (bounds: FriendlyBounds, signal: AbortSignal): Promise<LocationReading> => new Promise((resolve, reject) => {
    const source = deps.nativeAvailable() ? 'native' : 'browser';
    let settled = false;
    const finish = (position: TownPassPosition | null, reason?: LocationFailure): void => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
      resolve({ source, position, reason, message: reason ? LOCATION_MESSAGES[reason] : `已用${source === 'native' ? '台北通' : '瀏覽器'}位置作為起點。` });
    };
    const abort = (): void => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => finish(null, 'timeout'), LOCATION_POLICY.timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    const accept = (position: TownPassPosition): void => finish(position, validateLocation(position, bounds, deps.now?.() ?? Date.now()) ?? undefined);
    if (source === 'native') {
      void deps.getNative({ timeoutMs: LOCATION_POLICY.timeoutMs }).then((value) => {
        if (Array.isArray(value)) finish(null, 'unknown'); else accept(value);
      }).catch(() => finish(null, 'unknown'));
    } else if (!deps.geolocation) finish(null, 'unavailable');
    else {
      try {
        deps.geolocation.getCurrentPosition(
          (value) => accept({ latitude: value.coords.latitude, longitude: value.coords.longitude, timestamp: value.timestamp, accuracy: value.coords.accuracy }),
          (error) => finish(null, error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable'),
          { enableHighAccuracy: true, timeout: LOCATION_POLICY.timeoutMs, maximumAge: LOCATION_POLICY.maximumAgeMs },
        );
      } catch { finish(null, 'unavailable'); }
    }
  });
}
export type LocationAdapter = ReturnType<typeof createLocationAdapter>;
