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

  it('[SUBS-R21][SUBS-R70][SUBS-R71] 填答與比對全程不發請求，儲存只有上次清單一個鍵', async () => {
    const fetchMock = vi.fn(async () => Response.json(listJson));
    vi.stubGlobal('fetch', fetchMock);
    const q = useQuery();
    await q.loadList();
    fetchMock.mockClear();

    q.setAge(70);
    expect(q.answersState.value).toBe('inProgress');
    q.setResidency(true);
    q.toggleIdentity('none');
    q.setIncomeBracket(3);
    expect(q.answersState.value).toBe('completed');
    expect(q.results.value?.eligible.map((r) => r.item.no)).toEqual([6, 9]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(Object.keys(localStorage)).toEqual([SUBSIDY_CACHE_KEY]);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it('修改答案後結果依新答案更新', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(listJson)));
    const q = useQuery();
    await q.loadList();
    q.setAge(70);
    q.setResidency(true);
    q.toggleIdentity('none');
    q.setIncomeBracket(3);
    expect(q.results.value?.eligible).toHaveLength(2);
    q.setIncomeBracket(1);
    expect(q.results.value?.eligible.map((r) => r.item.no)).toEqual([1, 4, 6, 9, 10]);
  });

  it('0 歲、收入不清楚（0）用 === null 判斷算已答', () => {
    const q = useQuery();
    q.setAge(0);
    q.setResidency(false);
    q.toggleIdentity('none');
    q.setIncomeBracket(0);
    expect(q.answersState.value).toBe('completed');
  });

  it('[SUBS-R20] resetAnswers 重設為未填', () => {
    const q = useQuery();
    q.setAge(30);
    q.resetAnswers();
    expect(q.answersState.value).toBe('empty');
  });

  it('[SUBS-R26][SUBS-R27] 目前題號：預設第 1 題，setQuestion 夾在 0～3，resetAnswers 與 startOver 回第 1 題', () => {
    const q = useQuery();
    expect(q.currentQuestion.value).toBe(0);
    q.setQuestion(2);
    expect(q.currentQuestion.value).toBe(2);
    q.setQuestion(9);
    expect(q.currentQuestion.value).toBe(3);
    q.setQuestion(-1);
    expect(q.currentQuestion.value).toBe(0);
    q.setQuestion(2);
    q.setAge(30);
    q.resetAnswers();
    expect(q.currentQuestion.value).toBe(0);
    expect(q.answersState.value).toBe('empty');
    q.setQuestion(3);
    q.setAge(40);
    q.startOver();
    expect(q.currentQuestion.value).toBe(0);
    expect(q.answersState.value).toBe('empty');
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

  it('[SUBS-R19] 50 歲未設籍以上皆無級距 5 有無符合結果', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixtureWithMock)));
    const q = useQuery();
    await q.loadList();
    q.setAge(50);
    q.setResidency(false);
    q.toggleIdentity('none');
    q.setIncomeBracket(5);
    expect(q.noMatch.value?.closest.map((r) => r.item.no)).toEqual([1, 4, 9]);
  });

  it('[SUBS-R20] 清除填寫答案回未填，補助清單不動', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixtureWithMock)));
    const q = useQuery();
    await q.loadList();
    q.applyDemo(0);
    const listBefore = q.list.value;
    q.resetAnswers();
    expect(q.answersState.value).toBe('empty');
    expect(q.answers.value).toEqual({ age: null, residency: null, identities: [], incomeBracket: null });
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

  it('[SUBS-R24] 進入時讀一次 userinfo 算出 prefill；重複呼叫不再讀', async () => {
    const { DEMO_ACCOUNT, sentNames } = await import('./helpers/bridge');
    const { q, post } = await load(DEMO_ACCOUNT);
    expect(q.prefill.value).toEqual({ age: 36, residency: true });
    await q.loadPrefill(TODAY);
    expect(sentNames(post)).toEqual(['userinfo']);
    // 還沒開始作答：Answers 仍是未填
    expect(q.answersState.value).toBe('empty');
  });

  it('[SUBS-R24] 開始查詢帶入年齡與設籍，其餘未填', async () => {
    const { DEMO_ACCOUNT } = await import('./helpers/bridge');
    const { q } = await load(DEMO_ACCOUNT);
    q.startQuery(0);
    expect(q.answers.value).toEqual({ age: 36, residency: true, identities: [], incomeBracket: null });
    expect(q.currentQuestion.value).toBe(0);
  });

  it('[SUBS-R20] 清除填寫答案後年齡與設籍回填台北通值、回第 1 題，清單不動', async () => {
    const { DEMO_ACCOUNT } = await import('./helpers/bridge');
    const { q } = await load(DEMO_ACCOUNT);
    q.applyDemo(0);
    q.setQuestion(3);
    const listBefore = q.list.value;
    q.resetAnswers();
    expect(q.answers.value).toEqual({ age: 36, residency: true, identities: [], incomeBracket: null });
    expect(q.currentQuestion.value).toBe(0);
    expect(q.list.value).toBe(listBefore);
  });

  it('[SUBS-R27] 重新查詢只清除，不立即帶入；下次開始查詢才帶入', async () => {
    const { DEMO_ACCOUNT } = await import('./helpers/bridge');
    const { q } = await load(DEMO_ACCOUNT);
    q.applyDemo(1);
    q.startOver();
    expect(q.answersState.value).toBe('empty');
    expect(q.answers.value.age).toBeNull();
    q.startQuery(0);
    expect(q.answers.value.age).toBe(36);
  });

  it('[SUBS-R26] 點卡片跳題：未填時帶入並到該題；已完成時保留答案只換題', async () => {
    const { DEMO_ACCOUNT } = await import('./helpers/bridge');
    const { q } = await load(DEMO_ACCOUNT);
    q.startQuery(3);
    expect(q.currentQuestion.value).toBe(3);
    expect(q.answers.value.age).toBe(36);
    q.applyDemo(0);
    q.startQuery(3);
    expect(q.answers.value.age).toBe(70);
    expect(q.answersState.value).toBe('completed');
    expect(q.currentQuestion.value).toBe(3);
  });

  it('[SUBS-R24] 帳號讀不到（回 []）時不帶入，兩題空白', async () => {
    const { q } = await load([]);
    expect(q.prefill.value).toEqual({ age: null, residency: null });
    q.startQuery(0);
    expect(q.answersState.value).toBe('empty');
    expect(q.answers.value.age).toBeNull();
  });

  it('[SUBS-R25] resultView、kindFilter、docsReady 預設 grid、all、全未勾；篩選不改結果與計數；都不寫儲存、不發請求', async () => {
    const { DEMO_ACCOUNT } = await import('./helpers/bridge');
    const { q } = await load(DEMO_ACCOUNT);
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();
    expect(q.resultView.value).toBe('grid');
    expect(q.kindFilter.value).toBe('all');
    expect(q.docsReady.value).toEqual([false, false, false]);
    q.applyDemo(2);
    const before = JSON.stringify(q.results.value);
    q.setKindFilter('mock');
    q.setResultView('list');
    q.toggleDoc(0);
    q.toggleDoc(1);
    q.toggleDoc(2);
    q.toggleDoc(9);
    expect(q.docsReady.value).toEqual([true, true, true]);
    expect(JSON.stringify(q.results.value)).toBe(before);
    expect(q.noMatch.value).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Object.keys(localStorage)).toEqual([SUBSIDY_CACHE_KEY]);
    const stored = localStorage.getItem(SUBSIDY_CACHE_KEY)!;
    for (const word of ['resultView', 'kindFilter', 'docsReady', 'prefill', '1990/01/01', 'A000000000', '測試市民']) {
      expect(stored).not.toContain(word);
    }
    expect(sessionStorage.length).toBe(0);
  });
});
