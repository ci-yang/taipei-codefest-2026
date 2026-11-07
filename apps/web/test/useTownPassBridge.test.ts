import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMockTownPassBridge } from '@/composables/mockTownPassBridge';
import { LOCATION_TIMEOUT_MS, useTownPassBridge } from '@/composables/useTownPassBridge';
import { locateWithRetry } from '@/lib/locate';

type Listener = (event: { data: unknown }) => void;
type GeoSuccess = (pos: {
  timestamp: number;
  coords: Partial<GeolocationCoordinates> & { latitude: number; longitude: number };
}) => void;
type GeoError = (err: { code: number; message: string }) => void;

function stubGeolocation(impl: ((ok: GeoSuccess, fail: GeoError) => void) | undefined): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: impl ? { getCurrentPosition: impl } : undefined,
  });
}

/** 模擬真殼：postMessage 回 undefined（不是 Promise），回覆走 'message' 事件 */
function fakeShell(respond: (name: string, data: unknown) => unknown | typeof NO_REPLY) {
  const listeners = new Set<Listener>();
  const sent: Array<{ name: string; data: unknown }> = [];
  window.flutterObject = {
    postMessage(raw: string) {
      const msg = JSON.parse(raw) as { name: string; data: unknown };
      sent.push(msg);
      const reply = respond(msg.name, msg.data);
      if (reply !== NO_REPLY) {
        setTimeout(() => listeners.forEach((l) => l({ data: JSON.stringify({ name: msg.name, data: reply }) })), 1);
      }
    },
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  };
  return { sent };
}
const NO_REPLY = Symbol('no-reply');

describe('useTownPassBridge', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete window.flutterObject;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });
  afterEach(() => {
    delete window.flutterObject;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('沒有 bridge（一般瀏覽器）→ 降級', () => {
    it('isAvailable=false；userinfo / deviceinfo / launch_map / phone_call / notify 回 null 並 console.warn', async () => {
      const b = useTownPassBridge();
      expect(b.isAvailable.value).toBe(false);
      expect(await b.getUserInfo()).toBeNull();
      expect(await b.getDeviceInfo()).toBeNull();
      expect(await b.launchMap('https://example.com')).toBeNull();
      expect(await b.phoneCall('1999')).toBeNull();
      expect(b.notify('t', 'c')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(5);
    });

    it('location 改用 navigator.geolocation', async () => {
      stubGeolocation((ok) => ok({ timestamp: 1, coords: { latitude: 25.03, longitude: 121.56, accuracy: 20 } }));
      expect(await useTownPassBridge().getLocation()).toMatchObject({ latitude: 25.03, longitude: 121.56, accuracy: 20 });
    });

    it('使用者拒絕瀏覽器定位 → []', async () => {
      stubGeolocation((_ok, fail) => fail({ code: 1, message: 'User denied Geolocation' }));
      expect(await useTownPassBridge().getLocation()).toEqual([]);
    });

    it('瀏覽器不支援 geolocation → []', async () => {
      stubGeolocation(undefined);
      expect(await useTownPassBridge().getLocation()).toEqual([]);
    });
  });

  describe('在 TownPass 殼內', () => {
    it('送出 {name, data} JSON，回覆從 message 事件拿（postMessage 不回 Promise）', async () => {
      const { sent } = fakeShell((name) => (name === 'location' ? { latitude: 25.1, longitude: 121.5, timestamp: 1 } : null));
      const b = useTownPassBridge();
      expect(b.isAvailable.value).toBe(true);
      expect(await b.getLocation()).toMatchObject({ latitude: 25.1, longitude: 121.5 });
      expect(sent).toEqual([{ name: 'location', data: null }]);
    });

    it('App 拒絕定位回 [] → []，而且不退回瀏覽器定位', async () => {
      const geo = vi.fn();
      stubGeolocation(geo);
      fakeShell(() => []);
      expect(await useTownPassBridge().getLocation()).toEqual([]);
      expect(geo).not.toHaveBeenCalled();
    });

    it('App 沒回覆 → 逾時回 []', async () => {
      fakeShell(() => NO_REPLY);
      expect(await useTownPassBridge().getLocation({ timeoutMs: 20 })).toEqual([]);
    });

    it('location 預設等 20 秒才判定逾時（App 端第一次定位要先過權限框）', async () => {
      vi.useFakeTimers();
      fakeShell(() => NO_REPLY);
      let settled: unknown = 'pending';
      void useTownPassBridge()
        .getLocation()
        .then((v) => (settled = v));
      expect(LOCATION_TIMEOUT_MS).toBe(20_000);
      await vi.advanceTimersByTimeAsync(LOCATION_TIMEOUT_MS - 1);
      expect(settled).toBe('pending');
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toEqual([]);
    });

    it('第一次逾時、第二次有回覆 → locateWithRetry 拿到位置（模擬權限框按太慢）', async () => {
      vi.useFakeTimers();
      let calls = 0;
      fakeShell((name) => {
        if (name !== 'location') return NO_REPLY;
        calls += 1;
        return calls === 1 ? NO_REPLY : { latitude: 25.05, longitude: 121.52, timestamp: 2 };
      });
      const b = useTownPassBridge();
      const p = locateWithRetry(() => b.getLocation());
      await vi.advanceTimersByTimeAsync(LOCATION_TIMEOUT_MS + 5_000 + 10);
      expect(await p).toMatchObject({ position: { latitude: 25.05 }, attempts: 2 });
      expect(calls).toBe(2);
    });

    it('同名請求依 FIFO 配對，兩個並發 location 都拿得到', async () => {
      let n = 0;
      fakeShell(() => ({ latitude: 25 + ++n / 100, longitude: 121.5, timestamp: n }));
      const b = useTownPassBridge();
      const [a, c] = await Promise.all([b.getLocation(), b.getLocation()]);
      expect(a).toMatchObject({ latitude: 25.01 });
      expect(c).toMatchObject({ latitude: 25.02 });
    });

    it('沒有帳號時 userinfo 回 [] → null', async () => {
      fakeShell(() => []);
      expect(await useTownPassBridge().getUserInfo()).toBeNull();
    });

    it('notify 成功時 App 不回覆：同步回 true，不等回覆', () => {
      const { sent } = fakeShell(() => NO_REPLY);
      expect(useTownPassBridge().notify('標題', '內容')).toBe(true);
      expect(sent).toEqual([{ name: 'notify', data: { title: '標題', content: '內容' } }]);
    });

    it('launch_map 空字串直接回 false，不送給 App', async () => {
      const { sent } = fakeShell(() => true);
      expect(await useTownPassBridge().launchMap('')).toBe(false);
      expect(sent).toHaveLength(0);
    });
  });

  describe('mockTownPassBridge（?mockBridge=1）', () => {
    it('沒帶參數不安裝；force 安裝後 location / userinfo 有假資料；已有 flutterObject 時不覆蓋', async () => {
      expect(installMockTownPassBridge()).toBe(false);
      expect(installMockTownPassBridge(true)).toBe(true);
      const b = useTownPassBridge();
      expect(await b.getLocation()).toMatchObject({ latitude: 25.0375, longitude: 121.5637, is_mocked: true });
      expect(await b.getUserInfo()).toMatchObject({ realName: '測試市民' });
      expect(installMockTownPassBridge(true)).toBe(false);
    });

    it('網址帶 ?mockBridge=1 才安裝', () => {
      window.history.replaceState(null, '', '/map?mockBridge=1');
      expect(installMockTownPassBridge()).toBe(true);
      window.history.replaceState(null, '', '/');
    });
  });
});
