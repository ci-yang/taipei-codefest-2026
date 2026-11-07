import type { LocationResult, TownPassPosition } from '@/composables/useTownPassBridge';

/** 第一次定位失敗後等多久再試：給使用者按完原生權限框的時間 */
export const LOCATE_RETRY_DELAY_MS = 5_000;

export interface LocateOptions {
  /** 失敗後重試幾次（預設 1） */
  retries?: number;
  retryDelayMs?: number;
  /** 每次重試前呼叫（畫面可改顯示「再試一次」） */
  onRetry?: (attempt: number) => void;
  /** 測試用：可替換等待函式 */
  sleep?: (ms: number) => Promise<void>;
}

export interface LocateOutcome {
  position: TownPassPosition | null;
  attempts: number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * 定位，失敗（回 [] 或逾時）就隔一段時間再試。
 * 不 throw：最後仍失敗時 position 為 null，呼叫端改用預設中心。
 */
export async function locateWithRetry(
  getLocation: () => Promise<LocationResult>,
  options: LocateOptions = {},
): Promise<LocateOutcome> {
  const { retries = 1, retryDelayMs = LOCATE_RETRY_DELAY_MS, onRetry, sleep = defaultSleep } = options;
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const loc = await getLocation();
    if (!Array.isArray(loc)) return { position: loc, attempts };
    if (attempts > retries) return { position: null, attempts };
    onRetry?.(attempts);
    await sleep(retryDelayMs);
  }
}
