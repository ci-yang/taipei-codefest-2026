/**
 * useTownPassBridge — TownPass（城市通）Flutter 殼 JS bridge 的 Vue 3 composable
 *
 * 協定（已對官方原始碼查證）：
 * - 殼注入全域物件 `flutterObject`（flutter_inappwebview WebMessageListener）。
 * - Web → App：flutterObject.postMessage(JSON.stringify({ name, data }))，只收一個字串，回傳值不是 Promise。
 * - App → Web：flutterObject 的 'message' 事件，event.data 是 JSON 字串 {"name": ..., "data": ...}。
 * - 回覆沒有 request id，只能用 name 對應；同名請求以 FIFO 配對。
 *   已知限制：某次請求逾時被移出佇列後，它晚到的回覆會配給下一個同名請求（例如定位重試）。
 *   對 location 無害（拿到的仍是真位置），其他 handler 不要對同名請求做逾時後重送。
 * - notify / open_link / 1999agree 成功時「不回覆」，只有失敗才回 false，所以不能 await 它們的回覆。
 *
 * 降級：bridge 不存在（一般瀏覽器）時，location 改用 navigator.geolocation，其餘回 null 並 console.warn。
 * location 失敗（權限被拒、逾時、無定位）一律回 []，與 App 端行為一致。
 */
import { onScopeDispose, getCurrentScope, ref, type Ref } from 'vue';

// ---------- 型別 ----------

export type BridgeName =
  | 'userinfo'
  | 'launch_map'
  | 'phone_call'
  | 'location'
  | 'deviceinfo'
  | 'notify'
  | 'open_link'
  | 'qr_code_scan'
  | '1999agree';

export interface TownPassAddress {
  zip3: number;
  city: string;
  town: string;
  village: string;
  street: string;
  usageType: string;
  seq: number;
  priority: boolean;
}

export interface TownPassUser {
  id: string;
  account: string;
  username: string;
  realName: string;
  idNo: string;
  email: string;
  phoneNo: string;
  birthday: string;
  memberType: string;
  verifyLevel: string;
  addresses: TownPassAddress[];
  residentAddress: string;
  citizen: boolean;
  nativePeople: boolean;
  cityInternetUid: string;
}

/** geolocator Position.toJson()；只有 latitude / longitude / timestamp 保證存在 */
export interface TownPassPosition {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  altitude_accuracy?: number;
  heading?: number;
  heading_accuracy?: number;
  speed?: number;
  speed_accuracy?: number;
  floor?: number | null;
  is_mocked?: boolean;
  [key: string]: unknown;
}

/** 失敗時 App 回 []（tp_web_message_handler.dart LocationMessageHandler） */
export type LocationResult = TownPassPosition | [];

export type DeviceInfo = Record<string, unknown>;

interface BridgeMessage<T = unknown> {
  name: string;
  data: T;
}

interface FlutterObject {
  postMessage(message: string): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

declare global {
  interface Window {
    flutterObject?: FlutterObject;
  }
}

// ---------- 底層：單一全域 listener + 依 name 的 FIFO 佇列 ----------

const DEFAULT_TIMEOUT_MS = 10_000;
/**
 * location 專用逾時。App 端 GeoLocatorService.position() 沒有逾時：第一次會先跳原生權限框，
 * 再做 GPS 冷啟動，室內或使用者還在看權限框時常超過 10 秒（docs/E2E-IOS-2026-11-07.md）。
 */
export const LOCATION_TIMEOUT_MS = 20_000;

interface Pending {
  resolve: (data: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingByName = new Map<string, Pending[]>();
let listenerAttachedTo: FlutterObject | null = null;

function getFlutterObject(): FlutterObject | null {
  if (typeof window === 'undefined') return null;
  const obj = window.flutterObject;
  return obj && typeof obj.postMessage === 'function' ? obj : null;
}

export function isTownPassBridgeAvailable(): boolean {
  return getFlutterObject() !== null;
}

function onBridgeMessage(event: { data: unknown }): void {
  let msg: BridgeMessage | null;
  try {
    msg = typeof event.data === 'string' ? (JSON.parse(event.data) as BridgeMessage) : (event.data as BridgeMessage);
  } catch {
    console.warn('[TownPassBridge] 無法解析 App 回傳：', event.data);
    return;
  }
  if (!msg || typeof msg.name !== 'string') return;
  const queue = pendingByName.get(msg.name);
  const head = queue?.shift();
  if (!head) return; // 不是我們發的（例如官方 useHandleConnectionData 的請求），忽略
  clearTimeout(head.timer);
  head.resolve(msg.data);
}

function ensureListener(obj: FlutterObject): void {
  if (listenerAttachedTo === obj) return;
  obj.addEventListener('message', onBridgeMessage);
  listenerAttachedTo = obj;
}

/** 送出但不等回覆（notify / open_link / 1999agree 用） */
function post<T>(name: BridgeName, data: T): boolean {
  const obj = getFlutterObject();
  if (!obj) return false;
  ensureListener(obj);
  obj.postMessage(JSON.stringify({ name, data }));
  return true;
}

/** 送出並等同名回覆；逾時回 timeoutValue */
function request<T, R>(name: BridgeName, data: T, timeoutValue: R, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown | R> {
  const obj = getFlutterObject();
  if (!obj) return Promise.resolve(timeoutValue);
  ensureListener(obj);
  return new Promise((resolve) => {
    const entry: Pending = {
      resolve,
      timer: setTimeout(() => {
        const queue = pendingByName.get(name);
        const idx = queue?.indexOf(entry) ?? -1;
        if (queue && idx >= 0) queue.splice(idx, 1);
        console.warn(`[TownPassBridge] ${name} 等待回覆逾時 ${timeoutMs}ms`);
        resolve(timeoutValue);
      }, timeoutMs),
    };
    const queue = pendingByName.get(name) ?? [];
    queue.push(entry);
    pendingByName.set(name, queue);
    obj.postMessage(JSON.stringify({ name, data }));
  });
}

function warnNoBridge(name: string): null {
  console.warn(`[TownPassBridge] 找不到 flutterObject（非 TownPass 環境），${name} 回傳 null`);
  return null;
}

// ---------- 瀏覽器降級：定位 ----------

function browserLocation(timeoutMs: number): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.warn('[TownPassBridge] 瀏覽器不支援 geolocation，location 回傳 []');
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: pos.timestamp,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude ?? 0,
          altitude_accuracy: pos.coords.altitudeAccuracy ?? 0,
          heading: pos.coords.heading ?? -1,
          speed: pos.coords.speed ?? 0,
          floor: null,
          is_mocked: false,
        }),
      (err) => {
        console.warn(`[TownPassBridge] navigator.geolocation 失敗（code ${err.code}）：${err.message}，回傳 []`);
        resolve([]);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

function isPosition(v: unknown): v is TownPassPosition {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as TownPassPosition).latitude === 'number' &&
    typeof (v as TownPassPosition).longitude === 'number'
  );
}

// ---------- 對外 API ----------

export interface UseTownPassBridge {
  /** 呼叫當下是否在 TownPass 殼內（bridge 物件是否存在） */
  isAvailable: Ref<boolean>;
  getUserInfo(): Promise<TownPassUser | null>;
  getLocation(options?: { timeoutMs?: number }): Promise<LocationResult>;
  getDeviceInfo(): Promise<DeviceInfo | null>;
  /** true = App 判定可開啟並已開啟；false = 不可開啟；null = 非 TownPass 環境 */
  launchMap(url: string): Promise<boolean | null>;
  /** true = 可撥號並已呼叫撥號；false = 不可；null = 非 TownPass 環境 */
  phoneCall(phone: string): Promise<boolean | null>;
  /**
   * 送出本機通知。App 成功時不回覆，所以這裡只代表「已送出」：
   * true = 已交給 App；null = 非 TownPass 環境。
   * content 若為「已訂閱xxx」「已取消訂閱xxx」會被 App 當成訂閱狀態變更。
   */
  notify(title: string, content: string): boolean | null;
}

export function useTownPassBridge(): UseTownPassBridge {
  const isAvailable = ref(isTownPassBridgeAvailable());

  // iOS 上 flutterObject 可能比 setup 晚一點出現：短暫輪詢 3 秒更新旗標
  if (!isAvailable.value && typeof window !== 'undefined') {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (isTownPassBridgeAvailable()) {
        isAvailable.value = true;
        clearInterval(timer);
      } else if (tries >= 15) {
        clearInterval(timer);
      }
    }, 200);
    if (getCurrentScope()) onScopeDispose(() => clearInterval(timer));
  }

  async function getUserInfo(): Promise<TownPassUser | null> {
    if (!isTownPassBridgeAvailable()) return warnNoBridge('userinfo');
    const data = await request('userinfo', null, null);
    // App 沒有帳號時回 []
    if (!data || Array.isArray(data)) return null;
    return data as TownPassUser;
  }

  async function getLocation(options: { timeoutMs?: number } = {}): Promise<LocationResult> {
    const timeoutMs = options.timeoutMs ?? LOCATION_TIMEOUT_MS;
    if (!isTownPassBridgeAvailable()) {
      console.warn('[TownPassBridge] 非 TownPass 環境，location 改用 navigator.geolocation');
      return browserLocation(timeoutMs);
    }
    const data = await request('location', null, [] as [], timeoutMs);
    return isPosition(data) ? data : [];
  }

  async function getDeviceInfo(): Promise<DeviceInfo | null> {
    if (!isTownPassBridgeAvailable()) return warnNoBridge('deviceinfo');
    const data = await request('deviceinfo', null, null);
    if (!data || Array.isArray(data)) return null;
    return data as DeviceInfo;
  }

  async function launchMap(url: string): Promise<boolean | null> {
    if (!isTownPassBridgeAvailable()) return warnNoBridge('launch_map');
    // 官方 handler 在 data 非字串時會先回 false 再拋例外，所以這裡先擋
    if (typeof url !== 'string' || url.length === 0) return false;
    const data = await request('launch_map', url, null);
    return typeof data === 'boolean' ? data : null;
  }

  async function phoneCall(phone: string): Promise<boolean | null> {
    if (!isTownPassBridgeAvailable()) return warnNoBridge('phone_call');
    if (typeof phone !== 'string' || phone.length === 0) return false;
    const data = await request('phone_call', phone, null);
    return typeof data === 'boolean' ? data : null;
  }

  function notify(title: string, content: string): boolean | null {
    if (!isTownPassBridgeAvailable()) return warnNoBridge('notify');
    return post('notify', { title, content });
  }

  return { isAvailable, getUserInfo, getLocation, getDeviceInfo, launchMap, phoneCall, notify };
}
