/**
 * TownPass（台北通）殼的 bridge。協定照 apps/web/src/composables/useTownPassBridge.ts、docs/townpass-integration.md 3.2：
 * - Web → App：flutterObject.postMessage(JSON.stringify({ name, data }))。
 * - App → Web：flutterObject 的 'message' 事件，event.data 是 JSON 字串 {"name","data"}；沒有 request id，依 name FIFO 配對。
 * - open_link 成功時不回覆，殼內偵測不到失敗，所以送出就視為成功（sa-2-overview.md 6.1 第 21 項）。
 * - userinfo、phone_call 一定回覆（handler.dart:39-54、142-169）。
 * 沒有 bridge（一般瀏覽器）時：open_link 改用 window.open；userinfo 回 null；phone_call 回 null 由呼叫端走 tel: 連結。
 */

type BridgeListener = (event: { data: unknown }) => void;

interface FlutterObject {
  postMessage(message: string): void;
  addEventListener?(type: 'message', listener: BridgeListener): void;
  removeEventListener?(type: 'message', listener: BridgeListener): void;
}

declare global {
  interface Window {
    flutterObject?: FlutterObject;
  }
}

/** [SUBS-R24] userinfo 等待回覆的上限 */
export const USERINFO_TIMEOUT_MS = 3000;
const PHONE_CALL_TIMEOUT_MS = 5000;

function getFlutterObject(): FlutterObject | null {
  if (typeof window === 'undefined') return null;
  const obj = window.flutterObject;
  return obj && typeof obj.postMessage === 'function' ? obj : null;
}

export function isTownPassBridgeAvailable(): boolean {
  return getFlutterObject() !== null;
}

// ---------- 請求與回覆配對（單一 listener，依 name FIFO） ----------

interface Pending {
  resolve: (data: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}
const pendingByName = new Map<string, Pending[]>();
let listenerAttachedTo: FlutterObject | null = null;

function onBridgeMessage(event: { data: unknown }): void {
  let msg: { name?: unknown; data?: unknown } | null;
  try {
    msg = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data as typeof msg);
  } catch {
    return;
  }
  if (!msg || typeof msg.name !== 'string') return;
  const head = pendingByName.get(msg.name)?.shift();
  if (!head) return;
  clearTimeout(head.timer);
  head.resolve(msg.data);
}

function ensureListener(obj: FlutterObject): boolean {
  if (listenerAttachedTo === obj) return true;
  if (typeof obj.addEventListener !== 'function') return false;
  obj.addEventListener('message', onBridgeMessage);
  listenerAttachedTo = obj;
  return true;
}

/** 送出並等同名回覆；沒有 bridge、殼不支援回覆或逾時都回 timeoutValue */
function request<R>(name: string, data: unknown, timeoutValue: R, timeoutMs: number): Promise<unknown | R> {
  const obj = getFlutterObject();
  if (!obj || !ensureListener(obj)) return Promise.resolve(timeoutValue);
  return new Promise((resolve) => {
    const entry: Pending = {
      resolve,
      timer: setTimeout(() => {
        const queue = pendingByName.get(name);
        const idx = queue?.indexOf(entry) ?? -1;
        if (queue && idx >= 0) queue.splice(idx, 1);
        console.warn(`[townpass] ${name} 等待回覆逾時 ${timeoutMs}ms`);
        resolve(timeoutValue);
      }, timeoutMs),
    };
    const queue = pendingByName.get(name) ?? [];
    queue.push(entry);
    pendingByName.set(name, queue);
    obj.postMessage(JSON.stringify({ name, data }));
  });
}

// ---------- open_link ----------

/**
 * 開外部連結。回 'bridge'＝已交給台北通殼；'browser'＝用 window.open；
 * null＝網址是空字串（模擬資料沒有網址），什麼都不做。
 */
export function openLink(url: string): 'bridge' | 'browser' | null {
  if (typeof url !== 'string' || url.length === 0) return null;
  const obj = getFlutterObject();
  if (obj) {
    obj.postMessage(JSON.stringify({ name: 'open_link', data: url }));
    return 'bridge';
  }
  window.open(url, '_blank', 'noopener');
  return 'browser';
}

// ---------- userinfo（SUBS-R24） ----------

/**
 * 台北通帳號資料：只宣告本服務會讀的兩個欄位（birthday、addresses[0].city）。
 * 其他欄位（idNo、realName…）型別上不存在，程式也不讀（SUBS-R24、ADR-019）。
 */
export interface TownPassAccount {
  birthday?: unknown;
  addresses?: unknown;
}

/**
 * [SUBS-R24] 送 {name:'userinfo',data:null}，等同名回覆，逾時 3 秒。
 * 沒有 bridge、逾時、App 回 []（沒帳號）或不是物件時回 null。
 * 回傳值只交給 lib/userinfo.ts 的 prefillFrom 計算，不送後端、不寫儲存。
 */
export async function requestUserInfo(timeoutMs = USERINFO_TIMEOUT_MS): Promise<TownPassAccount | null> {
  const data = await request('userinfo', null, null, timeoutMs);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as TownPassAccount;
}

// ---------- phone_call ----------

/**
 * 撥號（sa-3-s2.md W11）：有 bridge 時送 phone_call（data 必須是非空字串，handler 收到 null 會拋例外），
 * 回 true／false 為殼的結果、逾時回 false；沒有 bridge 回 null（呼叫端改用 tel: 連結）。
 */
export async function phoneCall(phone: string): Promise<boolean | null> {
  if (!isTownPassBridgeAvailable()) return null;
  if (typeof phone !== 'string' || phone.length === 0) return false;
  const data = await request('phone_call', phone, false, PHONE_CALL_TIMEOUT_MS);
  return data === true;
}
