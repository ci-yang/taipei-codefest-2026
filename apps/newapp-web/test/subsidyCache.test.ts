import fixture from './fixtures/subsidy-list-with-mock.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubsidyListSchema } from '@app/shared';
import type { useQuery as UseQueryFn } from '@/composables/useQuery';
import { SUBSIDY_CACHE_KEY, readCachedList, writeCachedList } from '@/lib/subsidyCache';

/** 2026-11-08 本機 newapp-api（S2）實打 GET /api/v1/subsidies 的回應：開放 10 項 + 模擬 3 項 */
const list = SubsidyListSchema.parse(fixture);
const older = { ...list, updatedAt: '2024-01-01T00:00:00+08:00' };

const ok = (body: unknown = list) => vi.fn(async () => Response.json(body));
const down = () =>
  vi.fn(async () => Response.json({ error: 'subsidies_unavailable' }, { status: 503 }));
const offline = () =>
  vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });

/** 讓 window.localStorage 本身取用就 throw（WebView 停用 storage 的情況） */
function breakLocalStorage(): void {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError');
  });
}

const ANSWER_KEYS = ['age', 'ageBand', 'residency', 'identities', 'incomeBracket'];

describe('subsidyCache', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('[SUBS-R10] 寫入後讀得回同一份清單', () => {
    expect(writeCachedList(list)).toBe(true);
    expect(readCachedList()).toEqual(list);
  });

  it('[SUBS-R10] 沒有、不是 JSON、不過契約都視為沒有上次清單', () => {
    expect(readCachedList()).toBeNull();
    localStorage.setItem(SUBSIDY_CACHE_KEY, '{not json');
    expect(readCachedList()).toBeNull();
    localStorage.setItem(SUBSIDY_CACHE_KEY, JSON.stringify({ items: 'x' }));
    expect(readCachedList()).toBeNull();
  });

  it('[SUBS-R10] localStorage 存取 throw 時讀回 null、寫回 false，不往外丟', () => {
    breakLocalStorage();
    expect(readCachedList()).toBeNull();
    expect(writeCachedList(list)).toBe(false);
  });

  it('[SUBS-R10] setItem throw（例：容量滿）時寫回 false', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(writeCachedList(list)).toBe(false);
  });

  it('[SUBS-R71] 只寫 newapp.subsidyList 一個鍵；契約外的欄位（含 Answers 欄位）不會被存進去', () => {
    const polluted = { ...list, age: 70, identities: ['none'], answers: { age: 70 } };
    writeCachedList(polluted as typeof list);
    expect(Object.keys(localStorage)).toEqual([SUBSIDY_CACHE_KEY]);
    const stored = JSON.parse(localStorage.getItem(SUBSIDY_CACHE_KEY)!) as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(['items', 'source', 'updatedAt']);
    for (const k of [...ANSWER_KEYS, 'answers']) expect(stored).not.toHaveProperty(k);
  });
});

describe('useQuery 清單狀態（S2）', () => {
  let useQuery: typeof UseQueryFn;

  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules();
    ({ useQuery } = await import('@/composables/useQuery'));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('[SUBS-R22] 請求完成前 notLoaded，不能開始也沒有重試', () => {
    const q = useQuery();
    expect(q.listState.value).toBe('notLoaded');
    expect(q.canStart.value).toBe(false);
    expect(q.canRetry.value).toBe(false);
  });

  it('[SUBS-R10] 成功為 fresh 並寫入上次清單；可開始、不顯示重試', async () => {
    vi.stubGlobal('fetch', ok());
    const q = useQuery();
    await q.loadList();
    expect(q.listState.value).toBe('fresh');
    expect(q.canStart.value).toBe(true);
    expect(q.canRetry.value).toBe(false);
    expect(readCachedList()).toEqual(list);
  });

  it('[SUBS-R10] 失敗但有上次清單為 cached，用上次清單比對且顯示重試', async () => {
    writeCachedList(older);
    vi.stubGlobal('fetch', offline());
    const q = useQuery();
    await q.loadList();
    expect(q.listState.value).toBe('cached');
    expect(q.list.value?.updatedAt).toBe(older.updatedAt);
    expect(q.canStart.value).toBe(true);
    expect(q.canRetry.value).toBe(true);
    q.applyDemo(0);
    expect(q.results.value?.eligible.length).toBe(2);
  });

  it('[SUBS-R10][SUBS-R22] 失敗且沒有上次清單為 unavailable：不能開始、顯示重試', async () => {
    vi.stubGlobal('fetch', down());
    const q = useQuery();
    await q.loadList();
    expect(q.listState.value).toBe('unavailable');
    expect(q.list.value).toBeNull();
    expect(q.canStart.value).toBe(false);
    expect(q.canRetry.value).toBe(true);
  });

  it('[SUBS-R10] localStorage 存取 throw 視為沒有上次清單：失敗為 unavailable', async () => {
    breakLocalStorage();
    vi.stubGlobal('fetch', offline());
    const q = useQuery();
    await q.loadList();
    expect(q.listState.value).toBe('unavailable');
  });

  it('[SUBS-R10] localStorage 存取 throw 時成功仍為 fresh', async () => {
    breakLocalStorage();
    vi.stubGlobal('fetch', ok());
    const q = useQuery();
    await q.loadList();
    expect(q.listState.value).toBe('fresh');
  });

  it('[SUBS-R10] cached 重試成功改 fresh 並更新上次清單；查詢答案不變', async () => {
    writeCachedList(older);
    vi.stubGlobal('fetch', offline());
    const q = useQuery();
    await q.loadList();
    q.applyDemo(1);
    const before = q.answers.value;

    vi.stubGlobal('fetch', ok());
    await q.retryList();
    expect(q.listState.value).toBe('fresh');
    expect(q.list.value?.updatedAt).toBe(list.updatedAt);
    expect(readCachedList()?.updatedAt).toBe(list.updatedAt);
    expect(q.answers.value).toEqual(before);
  });

  it('[SUBS-R10] unavailable 重試成功改 fresh；重試失敗維持原狀態', async () => {
    vi.stubGlobal('fetch', down());
    const q = useQuery();
    await q.loadList();
    await q.retryList();
    expect(q.listState.value).toBe('unavailable');
    vi.stubGlobal('fetch', ok());
    await q.retryList();
    expect(q.listState.value).toBe('fresh');
  });

  it('[SUBS-R10] cached 重試又失敗仍為 cached', async () => {
    writeCachedList(older);
    vi.stubGlobal('fetch', offline());
    const q = useQuery();
    await q.loadList();
    await q.retryList();
    expect(q.listState.value).toBe('cached');
  });

  it('[SUBS-R71] 載入、作答、示範、清除全程只有 newapp.subsidyList 一個鍵，內容不含 Answers 欄位', async () => {
    vi.stubGlobal('fetch', ok());
    const q = useQuery();
    await q.loadList();
    q.setAgeBand('40-64');
    q.setResidency(false);
    q.toggleIdentity('none');
    q.setIncomeBracket(5);
    q.applyDemo(2);
    q.startOver();
    expect(Object.keys(localStorage)).toEqual([SUBSIDY_CACHE_KEY]);
    const stored = JSON.parse(localStorage.getItem(SUBSIDY_CACHE_KEY)!) as Record<string, unknown>;
    for (const k of ANSWER_KEYS) expect(stored).not.toHaveProperty(k);
    expect(sessionStorage.length).toBe(0);
  });
});
