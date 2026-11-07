import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ageFromBirthday, prefillFrom, residencyFromAddresses } from '@/lib/userinfo';
import { DEMO_ACCOUNT, installFakeBridge, sentNames } from './helpers/bridge';

const TODAY = new Date(2026, 10, 8); // 2026-11-08

describe('userinfo 純函式', () => {
  it('[SUBS-R24] 1990/01/01 在 2026-11-08 為 36 歲', () => {
    expect(ageFromBirthday('1990/01/01', TODAY)).toBe(36);
  });

  it('[SUBS-R24] 生日當天滿歲，前一天還沒', () => {
    expect(ageFromBirthday('1990/11/08', TODAY)).toBe(36);
    expect(ageFromBirthday('1990/11/09', TODAY)).toBe(35);
    expect(ageFromBirthday('1990/11/07', TODAY)).toBe(36);
  });

  it.each([null, undefined, 19900101, '', '1990-01-01', '1990/13/01', '1990/02/30', 'abc', '2030/01/01', '1800/01/01'])(
    '[SUBS-R24] 生日 %j 格式不對或不合理回 null',
    (bd) => {
      expect(ageFromBirthday(bd, TODAY)).toBeNull();
    },
  );

  it('[SUBS-R24] 縣市：臺北市、台北市為 true，其他縣市 false', () => {
    expect(residencyFromAddresses([{ city: '臺北市' }])).toBe(true);
    expect(residencyFromAddresses([{ city: '台北市' }])).toBe(true);
    expect(residencyFromAddresses([{ city: '新北市' }])).toBe(false);
    expect(residencyFromAddresses([{ city: '新北市' }, { city: '臺北市' }])).toBe(false);
  });

  it.each([undefined, null, [], [{}], [{ city: '' }], [{ city: 1 }], [null], 'x'])(
    '[SUBS-R24] 缺 addresses 或縣市 %j 回 null',
    (addr) => {
      expect(residencyFromAddresses(addr)).toBeNull();
    },
  );

  it('[SUBS-R24] prefillFrom：帳號 null（回 []、逾時、沒 bridge）兩欄都是 null；缺欄位只空該欄', () => {
    expect(prefillFrom(null, TODAY)).toEqual({ age: null, residency: null });
    expect(prefillFrom(DEMO_ACCOUNT, TODAY)).toEqual({ age: 36, residency: true });
    expect(prefillFrom({ birthday: '1990/01/01' }, TODAY)).toEqual({ age: 36, residency: null });
    expect(prefillFrom({ addresses: [{ city: '新北市' }] }, TODAY)).toEqual({ age: null, residency: false });
  });

  it('[SUBS-R24] 只回 age、residency 兩欄，不帶出 idNo、realName', () => {
    const p = prefillFrom(DEMO_ACCOUNT, TODAY);
    expect(Object.keys(p).sort()).toEqual(['age', 'residency']);
    expect(JSON.stringify(p)).not.toContain('A000000000');
    expect(JSON.stringify(p)).not.toContain('測試市民');
  });
});

describe('townpass requestUserInfo、phoneCall', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('[SUBS-R24] 送 {name:userinfo,data:null}，收同名回覆', async () => {
    const post = installFakeBridge(DEMO_ACCOUNT);
    const { requestUserInfo } = await import('@/lib/townpass');
    const acc = await requestUserInfo();
    expect(JSON.parse(post.mock.calls[0]![0] as string)).toEqual({ name: 'userinfo', data: null });
    expect(acc?.birthday).toBe('1990/01/01');
  });

  it('[SUBS-R24] App 回 []（沒帳號）時回 null', async () => {
    installFakeBridge([]);
    const { requestUserInfo } = await import('@/lib/townpass');
    expect(await requestUserInfo()).toBeNull();
  });

  it('[SUBS-R24] 不回覆時 3 秒逾時回 null', async () => {
    vi.useFakeTimers();
    installFakeBridge(undefined);
    const { requestUserInfo, USERINFO_TIMEOUT_MS } = await import('@/lib/townpass');
    expect(USERINFO_TIMEOUT_MS).toBe(3000);
    const p = requestUserInfo();
    await vi.advanceTimersByTimeAsync(2999);
    let done = false;
    void p.then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toBeNull();
  });

  it('[SUBS-R24] 沒有 bridge 回 null，不丟錯', async () => {
    const { requestUserInfo, phoneCall } = await import('@/lib/townpass');
    expect(await requestUserInfo()).toBeNull();
    expect(await phoneCall('1999')).toBeNull();
  });

  it('[W11] phoneCall 送 phone_call 1999，回殼的結果', async () => {
    const post = installFakeBridge(DEMO_ACCOUNT);
    const { phoneCall } = await import('@/lib/townpass');
    expect(await phoneCall('1999')).toBe(true);
    expect(sentNames(post)).toEqual(['phone_call']);
    expect(JSON.parse(post.mock.calls[0]![0] as string)).toEqual({ name: 'phone_call', data: '1999' });
  });

  it('[W11] phoneCall 空字串不送（殼收到 null 會拋例外）', async () => {
    const post = installFakeBridge(DEMO_ACCOUNT);
    const { phoneCall } = await import('@/lib/townpass');
    expect(await phoneCall('')).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
