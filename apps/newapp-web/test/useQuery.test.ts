import fixture from './fixtures/subsidy-list.json';
import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_TIMEOUT_MS, apiGet } from '@/lib/api';
import { openLink } from '@/lib/townpass';
import type { useQuery as UseQueryFn } from '@/composables/useQuery';
import { SUBSIDY_CACHE_KEY } from '@/lib/subsidyCache';
import { ServiceHealthSchema } from '@app/shared';

const listJson = fixture;

/** useQuery 是模組層級狀態，每個測試重新載入模組以免互相影響 */
let useQuery: typeof UseQueryFn;

describe('useQuery', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules();
    ({ useQuery } = await import('@/composables/useQuery'));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('[SUBS-R70] 清單請求沒有 query string 與 body；成功為 fresh', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(listJson));
    vi.stubGlobal('fetch', fetchMock);
    const q = useQuery();
    await q.loadList();
    expect(q.listState.value).toBe('fresh');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/subsidies');
    expect(init?.body).toBeUndefined();
    expect(init?.method).toBeUndefined();
  });

  /** 四題填完並送出 */
  function answer70(q: ReturnType<typeof useQuery>): void {
    q.setAgeBand('65+');
    q.setResidency(true);
    q.toggleIdentity('none');
    q.setIncomeBracket(3);
  }

  it('[SUBS-R21][SUBS-R70][SUBS-R71] 填答與比對全程不發請求，儲存只有上次清單一個鍵', async () => {
    const fetchMock = vi.fn(async () => Response.json(listJson));
    vi.stubGlobal('fetch', fetchMock);
    const q = useQuery();
    await q.loadList();
    fetchMock.mockClear();

    q.setAgeBand('65+');
    expect(q.answersState.value).toBe('inProgress');
    q.setResidency(true);
    q.toggleIdentity('none');
    q.setIncomeBracket(3);
    // 四題都填了但還沒送出：仍是填寫中、沒有結果
    expect(q.answersState.value).toBe('inProgress');
    expect(q.results.value).toBeNull();
    expect(q.submit()).toEqual([null, null, null, null]);
    expect(q.answersState.value).toBe('completed');
    expect(q.results.value?.eligible.map((r) => r.item.no)).toEqual([6, 9]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(Object.keys(localStorage)).toEqual([SUBSIDY_CACHE_KEY]);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it('[SUBS-R11] 送出時有錯不比對：回四個位置的訊息，仍是填寫中', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(listJson)));
    const q = useQuery();
    await q.loadList();
    q.setAgeBand(null);
    q.setResidency(true);
    expect(q.submit()).toEqual(['請選擇年齡區間', null, '請至少選一項，沒有就選以上皆無', '請選一個級距，不確定就選不清楚']);
    expect(q.answersState.value).toBe('inProgress');
    expect(q.results.value).toBeNull();
  });

  it('[SUBS-R22] 清單不能用（notLoaded）時送出不比對', () => {
    const q = useQuery();
    answer70(q);
    expect(q.submit()).toEqual([null, null, null, null]);
    expect(q.answersState.value).toBe('inProgress');
  });

  it('[SUBS-R26] 送出後改任一題變回填寫中、沒有結果；再送出依新答案更新', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(listJson)));
    const q = useQuery();
    await q.loadList();
    answer70(q);
    q.submit();
    expect(q.results.value?.eligible).toHaveLength(2);
    q.setIncomeBracket(1);
    expect(q.answersState.value).toBe('inProgress');
    expect(q.results.value).toBeNull();
    q.submit();
    expect(q.answersState.value).toBe('completed');
    expect(q.results.value?.eligible.map((r) => r.item.no)).toEqual([1, 4, 6, 9, 10]);
  });

  it('18歲以下、收入不清楚（0）用 === null 判斷算已答，可送出', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(listJson)));
    const q = useQuery();
    await q.loadList();
    q.setAgeBand('u18');
    q.setResidency(false);
    q.toggleIdentity('none');
    q.setIncomeBracket(0);
    expect(q.submit()).toEqual([null, null, null, null]);
    expect(q.answersState.value).toBe('completed');
  });

  it('[SUBS-R27] 重新查詢（startOver）回未填、作答旗標清掉', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(listJson)));
    const q = useQuery();
    await q.loadList();
    q.setAgeBand('30-44');
    expect(q.answersState.value).toBe('inProgress');
    q.startOver();
    expect(q.answersState.value).toBe('empty');
    answer70(q);
    q.submit();
    q.startOver();
    expect(q.answersState.value).toBe('empty');
    expect(q.results.value).toBeNull();
  });

  it('[SUBS-R23] 一鍵帶入示範情境直接成為已完成並有結果', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixtureWithMock)));
    const q = useQuery();
    await q.loadList();
    q.applyDemo(2);
    expect(q.answersState.value).toBe('completed');
    expect(q.results.value?.eligible).toHaveLength(7);
    expect(q.noMatch.value).toBeNull();
  });

  it('[SUBS-R23] 三組示範情境可能符合數 2、2、7', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixtureWithMock)));
    const q = useQuery();
    await q.loadList();
    const counts = [0, 1, 2].map((i) => {
      q.applyDemo(i);
      return q.results.value?.eligible.length;
    });
    expect(counts).toEqual([2, 2, 7]);
  });

  it('[SUBS-R19] 50 歲未設籍以上皆無級距 5 送出後有無符合結果', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixtureWithMock)));
    const q = useQuery();
    await q.loadList();
    q.setAgeBand('45-64');
    q.setResidency(false);
    q.toggleIdentity('none');
    q.setIncomeBracket(5);
    q.submit();
    expect(q.noMatch.value?.closest.map((r) => r.item.no)).toEqual([1, 4, 9]);
  });

  it('[SUBS-R20] 清除填寫答案回未填，補助清單不動', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixtureWithMock)));
    const q = useQuery();
    await q.loadList();
    q.applyDemo(0);
    const listBefore = q.list.value;
    q.startOver();
    expect(q.answersState.value).toBe('empty');
    expect(q.answers.value).toEqual({ ageBand: null, residency: null, identities: [], incomeBracket: null });
    expect(q.results.value).toBeNull();
    expect(q.list.value).toBe(listBefore);
    expect(q.listState.value).toBe('fresh');
  });

  it('[SUBS-R10] 清單請求失敗且沒有上次清單為 unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'subsidies_unavailable' }, { status: 503 })));
    const q = useQuery();
    await q.loadList();
    expect(q.listState.value).toBe('unavailable');
  });
});

describe('apiGet 逾時', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('[SUBS-R10] 預設 8 秒逾時，請求帶 AbortSignal', async () => {
    expect(API_TIMEOUT_MS).toBe(8000);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ ok: true, service: 'x', time: 't' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await apiGet('/healthz', ServiceHealthSchema);
    expect(fetchMock.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('[SUBS-R10] 逾時會丟錯', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
      ),
    );
    await expect(apiGet('/healthz', ServiceHealthSchema, undefined, { timeoutMs: 20 })).rejects.toBeDefined();
  });
});

describe('openLink', () => {
  afterEach(() => {
    delete window.flutterObject;
    vi.restoreAllMocks();
  });

  it('有 bridge 時送 open_link 訊息', () => {
    const postMessage = vi.fn();
    window.flutterObject = { postMessage };
    expect(openLink('https://dosw.gov.taipei/')).toBe('bridge');
    expect(JSON.parse(postMessage.mock.calls[0]![0] as string)).toEqual({
      name: 'open_link',
      data: 'https://dosw.gov.taipei/',
    });
  });

  it('沒有 bridge 時用 window.open', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    expect(openLink('https://dosw.gov.taipei/')).toBe('browser');
    expect(open).toHaveBeenCalledWith('https://dosw.gov.taipei/', '_blank', 'noopener');
  });

  it('空網址（模擬資料）什麼都不做', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    expect(openLink('')).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });
});

describe('useQuery（S2：台北通帳號帶入、畫面狀態）', () => {
  let useQueryS2: typeof UseQueryFn;
  const TODAY = new Date(2026, 10, 8);
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function load(account: unknown) {
    const { installFakeBridge } = await import('./helpers/bridge');
    const post = installFakeBridge(account);
    ({ useQuery: useQueryS2 } = await import('@/composables/useQuery'));
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixtureWithMock)));
    const q = useQueryS2();
    await q.loadList();
    await q.loadPrefill(TODAY);
    return { q, post };
  }

  it('[SUBS-R24] 進入時讀一次 userinfo 算出 prefill（含區）並立刻帶入；帶入不算作答；重複呼叫不再讀', async () => {
    const { DEMO_ACCOUNT, sentNames } = await import('./helpers/bridge');
    const { q, post } = await load(DEMO_ACCOUNT);
    expect(q.prefill.value).toEqual({ ageBand: '30-44', residency: true, town: '信義區' });
    await q.loadPrefill(TODAY);
    expect(sentNames(post)).toEqual(['userinfo']);
    expect(q.answers.value).toEqual({ ageBand: '30-44', residency: true, identities: [], incomeBracket: null });
    expect(q.answersState.value).toBe('empty');
  });

  it('[SUBS-R24] 帳號回來前市民已動過表單，就不覆蓋答案', async () => {
    const { DEMO_ACCOUNT, installFakeBridge } = await import('./helpers/bridge');
    installFakeBridge(DEMO_ACCOUNT);
    ({ useQuery: useQueryS2 } = await import('@/composables/useQuery'));
    const q = useQueryS2();
    const pending = q.loadPrefill(TODAY);
    q.setAgeBand('45-64');
    await pending;
    expect(q.answers.value.ageBand).toBe('45-64');
    expect(q.answers.value.residency).toBeNull();
    expect(q.prefill.value.ageBand).toBe('30-44');
  });

  it('[SUBS-R20][SUBS-R27] 重新查詢、清除後立刻帶入台北通值，其餘未填，清單不動', async () => {
    const { DEMO_ACCOUNT } = await import('./helpers/bridge');
    const { q } = await load(DEMO_ACCOUNT);
    q.setAgeBand('65+');
    q.toggleIdentity('dis');
    q.setIncomeBracket(2);
    q.submit();
    const listBefore = q.list.value;
    q.startOver();
    expect(q.answers.value).toEqual({ ageBand: '30-44', residency: true, identities: [], incomeBracket: null });
    expect(q.answersState.value).toBe('empty');
    expect(q.list.value).toBe(listBefore);
  });

  it('[SUBS-R24] 帳號讀不到（回 []）時不帶入，兩題空白', async () => {
    const { q } = await load([]);
    expect(q.prefill.value).toEqual({ ageBand: null, residency: null, town: null });
    q.startOver();
    expect(q.answersState.value).toBe('empty');
    expect(q.answers.value.ageBand).toBeNull();
    expect(q.answers.value.residency).toBeNull();
  });

  it('[SUBS-R25] resultView、kindFilter、searchQuery 預設 carousel、all、空；只改顯示；都不寫儲存、不發請求', async () => {
    const { DEMO_ACCOUNT } = await import('./helpers/bridge');
    const { q } = await load(DEMO_ACCOUNT);
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();
    expect(q.resultView.value).toBe('carousel');
    expect(q.kindFilter.value).toBe('all');
    expect(q.searchQuery.value).toBe('');
    q.applyDemo(2);
    const before = JSON.stringify(q.results.value);
    q.setKindFilter('mock');
    q.setResultView('list');
    q.setSearchQuery('補助');
    expect(JSON.stringify(q.results.value)).toBe(before);
    expect(q.noMatch.value).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Object.keys(localStorage)).toEqual([SUBSIDY_CACHE_KEY]);
    const stored = localStorage.getItem(SUBSIDY_CACHE_KEY)!;
    for (const word of ['resultView', 'kindFilter', 'searchQuery', 'prefill', '信義區', '1990/01/01', 'A000000000', '測試市民']) {
      expect(stored).not.toContain(word);
    }
    expect(sessionStorage.length).toBe(0);
  });
});
