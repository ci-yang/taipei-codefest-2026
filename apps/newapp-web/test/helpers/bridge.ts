import { vi } from 'vitest';

/** 台北通開源殼固定假帳號的形狀（docs/townpass-integration.md 3.2）；含 idNo、realName 用來確認畫面與請求都沒有它們 */
export const DEMO_ACCOUNT = {
  id: 'x',
  realName: '測試市民',
  idNo: 'A000000000',
  birthday: '1990/01/01',
  addresses: [{ zip3: 110, city: '臺北市', town: '信義區' }],
};

/**
 * 裝一個會回覆的假 flutterObject：userinfo 回 account（undefined＝不回覆，用來測逾時），phone_call 回 true。
 * 回傳 postMessage spy。
 */
export function installFakeBridge(account: unknown) {
  const listeners = new Set<(e: { data: unknown }) => void>();
  const reply = (name: string, data: unknown) =>
    queueMicrotask(() => listeners.forEach((l) => l({ data: JSON.stringify({ name, data }) })));
  const postMessage = vi.fn((raw: string) => {
    const { name } = JSON.parse(raw) as { name: string };
    if (name === 'userinfo' && account !== undefined) reply(name, account);
    if (name === 'phone_call') reply(name, true);
  });
  vi.stubGlobal('flutterObject', {
    postMessage,
    addEventListener: (_t: string, l: (e: { data: unknown }) => void) => void listeners.add(l),
    removeEventListener: (_t: string, l: (e: { data: unknown }) => void) => void listeners.delete(l),
  });
  return postMessage;
}

export function sentNames(postMessage: ReturnType<typeof installFakeBridge>): string[] {
  return postMessage.mock.calls.map((c) => (JSON.parse(c[0] as string) as { name: string }).name);
}
