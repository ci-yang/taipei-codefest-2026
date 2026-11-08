import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { answerAll, mountApp, settle } from './helpers/mountApp';
import { DEMO_ACCOUNT, installFakeBridge, sentNames } from './helpers/bridge';
import { ageFromBirthday, bandOfAge } from '@/lib/userinfo';
import { SUBSIDY_CACHE_KEY } from '@/lib/subsidyCache';
import { FAVORITES_KEY } from '@/lib/favorites';

/**
 * S2 行為的整合測試（v3 路由）：上次清單、模擬資料、無符合、清除、示範情境、資料來源、
 * 入場動畫、台北通帶入、撥號、收藏。版面細節由 home、calc、result.v3、detail、header 各自的測試負責。
 */

/** 示範帳號今天的實歲（1990/01/01；2026-11-08 為 36 → 26-39） */
const DEMO_BAND = bandOfAge(ageFromBirthday(DEMO_ACCOUNT.birthday, new Date()))!;
const AGE70 = { band: '65+', residency: true, identities: ['none'], income: 3 };
const NOMATCH = { band: '40-64', residency: false, identities: ['none'], income: 5 };
const PREG = { band: '26-39', residency: true, identities: ['preg', 'mid'], income: 2 };

function cardNos(wrapper: VueWrapper, list: 'yes' | 'no' | 'fav'): number[] {
  return wrapper
    .get(`[data-test="${list === 'fav' ? 'fav-list' : `list-${list}`}"]`)
    .findAll('[data-test="list-card"]')
    .map((r) => Number(r.attributes('data-no')));
}
const card = (w: VueWrapper, no: number) => w.get(`[data-test="list-card"][data-no="${no}"]`);
async function openCard(wrapper: VueWrapper, no: number): Promise<void> {
  await card(wrapper, no).get('[data-test="card-detail"]').trigger('click');
  await settle();
}
/** 目前選中的年齡區間（沒選為空字串） */
const inAge = (w: VueWrapper) =>
  w
    .findAll('[data-test^="band-"]')
    .filter((b) => b.attributes('aria-checked') === 'true')
    .map((b) => b.attributes('data-test')!.replace('band-', ''))[0] ?? '';
const inRes = (w: VueWrapper) => (w.get('[data-test="in-res"]').element as HTMLSelectElement).value;
async function go(router: { push(p: string): Promise<unknown> }, path: string): Promise<void> {
  await router.push(path);
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  Element.prototype.scrollIntoView = function () {} as typeof Element.prototype.scrollIntoView;
});
afterEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('上次清單（W3）', () => {
  it('[SUBS-R10] 載入過一次後斷網重進：試算頁顯示上次資料與更新時間，仍能送出看到結果', async () => {
    await mountApp(fixtureWithMock);
    expect(localStorage.getItem(SUBSIDY_CACHE_KEY)).not.toBeNull();
    document.body.innerHTML = '';
    const { wrapper, router, q } = await mountApp(null, '/calc');
    expect(q.listState.value).toBe('cached');
    expect(wrapper.get('[data-test="list-cached"]').text()).toBe('目前顯示的是上次載入的資料（2024-12-19）。');
    expect(wrapper.find('[data-test="btn-retry"]').exists()).toBe(true);
    await answerAll(wrapper, AGE70);
    expect(router.currentRoute.value.name).toBe('result');
    expect(q.results.value?.eligible.map((r) => r.item.no)).toEqual([6, 9]);
    expect(wrapper.get('[data-test="result-cached"]').text()).toContain('目前顯示的是上次載入的資料');
  });
});

describe('模擬資料、無符合、清除、示範情境（W2、W4）', () => {
  it('[SUBS-R07][SUBS-R18] 結果合計 13 項：模擬 3 項都標模擬資料', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    expect([...cardNos(wrapper, 'yes'), ...cardNos(wrapper, 'no')]).toHaveLength(13);
    for (const no of [101, 102, 103]) {
      expect(card(wrapper, no).attributes('data-kind')).toBe('mock');
      expect(card(wrapper, no).get('[data-test="tag-status"]').text()).toContain('模擬資料');
    }
  });

  it('[SUBS-R19] 50 歲未設籍以上皆無 33,253 以上：無符合、最接近 3 項各差在哪、社福中心連結', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, NOMATCH);
    const nm = wrapper.get('[data-test="no-match"]');
    expect(nm.text()).toContain('目前沒有可能符合的補助');
    expect(nm.findAll('li').map((li) => li.text())).toEqual([
      '低收入戶生活扶助：差在「需設籍臺北市」',
      '中低收入戶：差在「需設籍臺北市」',
      '市民醫療補助：差在「需設籍臺北市」',
    ]);
    const a = wrapper.get('[data-test="no-match-center"]');
    expect(a.text()).toBe('臺北市各區社會福利服務中心');
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await a.trigger('click');
    expect(open).toHaveBeenCalledWith(a.attributes('href'), '_blank', 'noopener');
    expect(wrapper.get('[data-test="found-pill"]').text()).toBe('一共找到了 0 項合適計畫');
    expect(cardNos(wrapper, 'no')).toHaveLength(13);
  });

  it.each([
    [0, 2],
    [1, 2],
    [2, 8],
  ])('[SUBS-R23] 首頁示範情境第 %i 組一鍵帶入，可能符合 %i 項', async (i, n) => {
    const { wrapper, router, q } = await mountApp(fixtureWithMock);
    await wrapper.get(`[data-test="demo-${i}"]`).trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
    expect(q.answersState.value).toBe('completed');
    expect(wrapper.get('[data-test="found-pill"]').text()).toBe(`一共找到了 ${n} 項合適計畫`);
    expect(cardNos(wrapper, 'yes')).toHaveLength(n);
  });
});

describe('資料來源頁（W5）', () => {
  it('[spec 7.6] 列出資料集、機關、授權、網址、更新時間、門檻提醒與模擬說明；頂列首頁鍵回首頁', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await wrapper.get('[data-test="link-source"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('source');
    expect(wrapper.get('[data-test="src-dataset"]').text()).toBe('臺北市社會救助補助項目');
    expect(wrapper.get('[data-test="src-agency"]').text()).toBe('臺北市政府社會局');
    expect(wrapper.get('[data-test="src-license"]').text()).toBe('政府資料開放授權條款－第1版');
    const url = wrapper.get('[data-test="src-url"]');
    expect(url.attributes('href')).toBe('https://data.gov.tw/dataset/129839');
    expect(url.text()).toBe('data.gov.tw/dataset/129839');
    expect(wrapper.get('[data-test="src-updated"]').text()).toBe('2024-12-19');
    expect(wrapper.get('[data-test="src-threshold"]').text()).toContain('門檻以社會局最新公告為準');
    expect(wrapper.get('[data-test="src-mock"]').text()).toContain('模擬資料');
    const header = wrapper.get('[data-test="app-header"]');
    expect(header.element.firstElementChild?.getAttribute('data-test')).toBe('btn-home');
    await wrapper.get('[data-test="btn-home"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
  });

  it('結果頁底部「資料來源與門檻說明」到資料來源頁，頁底返回回結果頁', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="page-result"] [data-test="link-source"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('source');
    await wrapper.get('[data-test="btn-source-back"]').trigger('click');
    await settle();
    await new Promise((r) => setTimeout(r, 20));
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
  });
});

describe('入場動畫（W6）', () => {
  it('[spec 7.9] 播放中可直接從首頁進試算並送出', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    expect(!!document.querySelector('[data-test="intro-hand"]')).toBe(true);
    await answerAll(wrapper, AGE70);
    expect(router.currentRoute.value.name).toBe('result');
  });

  it('[spec 7.9] 減少動態效果時手與皺摺都不出現', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener() {}, removeEventListener() {} })),
    );
    const { wrapper } = await mountApp(fixtureWithMock);
    expect(!!document.querySelector('[data-test="intro-hand"]')).toBe(false);
    expect(wrapper.find('[data-test="wrinkles"]').exists()).toBe(false);
  });
});

describe('台北通帳號帶入（W7）', () => {
  it('[SUBS-R24] 示範帳號：試算頁年齡自動選取、戶籍「臺北市 · 信義區」，兩題標台北通帶入；沒有身分證字號與姓名；只有一次 GET 清單', async () => {
    const post = installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, router, fetchMock, q } = await mountApp(fixtureWithMock);
    await settle();
    expect(sentNames(post)).toContain('userinfo');
    await go(router, '/calc');
    expect(inAge(wrapper)).toBe(DEMO_BAND);
    expect(inRes(wrapper)).toBe('true');
    expect(wrapper.get('[data-test="opt-taipei"]').text()).toBe('臺北市 · 信義區');
    expect(wrapper.get('[data-test="age-tp"]').text()).toBe('台北通帶入');
    expect(wrapper.get('[data-test="res-tp"]').text()).toBe('已定位');
    expect(q.answersState.value).toBe('empty');
    expect(document.body.innerHTML).not.toContain(DEMO_ACCOUNT.idNo);
    expect(document.body.innerHTML).not.toContain(DEMO_ACCOUNT.realName);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/subsidies');
    expect(init?.body).toBeUndefined();
  });

  it('[SUBS-R24] town 只顯示不送出：比對、請求、儲存都沒有區；localStorage 只有清單與收藏兩個鍵', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, fetchMock, q } = await mountApp(fixtureWithMock);
    await settle();
    await answerAll(wrapper, { band: null, residency: null, identities: ['none'], income: 3 });
    expect(q.answersState.value).toBe('completed');
    await card(wrapper, 9).get('[data-test="fav-9"]').trigger('click');
    expect(Object.keys(q.answers.value).sort()).toEqual(['ageBand', 'identities', 'incomeBracket', 'residency']);
    expect(JSON.stringify(q.answers.value)).not.toContain('信義區');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('信義區');
    expect(Object.keys(localStorage).sort()).toEqual([FAVORITES_KEY, SUBSIDY_CACHE_KEY].sort());
    for (const k of Object.keys(localStorage)) expect(localStorage.getItem(k)).not.toContain('信義區');
    expect(sessionStorage.length).toBe(0);
  });

  it('[SUBS-R24] 改過的值不再標台北通帶入，選臺北市也不顯示區', async () => {
    installFakeBridge({ ...DEMO_ACCOUNT, addresses: [{ city: '新北市', town: '板橋區' }] });
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await settle();
    await go(router, '/calc');
    expect(inRes(wrapper)).toBe('false');
    expect(wrapper.find('[data-test="res-tp"]').exists()).toBe(true);
    await wrapper.get('[data-test="in-res"]').setValue('true');
    expect(wrapper.find('[data-test="res-tp"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="opt-taipei"]').text()).toBe('臺北市');
    await wrapper.get('[data-test="band-40-64"]').trigger('click');
    expect(wrapper.find('[data-test="age-tp"]').exists()).toBe(false);
  });

  it('[SUBS-R24] 示範情境的答案不標台北通帶入', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await settle();
    await wrapper.get('[data-test="demo-0"]').trigger('click');
    await settle();
    await wrapper.get('[data-test="btn-edit"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('calc');
    expect(inAge(wrapper)).toBe('65+');
    expect(inRes(wrapper)).toBe('true');
    expect(wrapper.find('[data-test="age-tp"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="res-tp"]').exists()).toBe(false);
  });

  it('[SUBS-R24] 帳號資料讀不到（回 []）：年齡與戶籍空白、沒有來源標示，仍可完成查詢', async () => {
    installFakeBridge([]);
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await settle();
    await go(router, '/calc');
    expect(inAge(wrapper)).toBe('');
    expect(inRes(wrapper)).toBe('');
    expect(wrapper.find('[data-test="age-tp"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="res-tp"]').exists()).toBe(false);
    await answerAll(wrapper, AGE70);
    expect(router.currentRoute.value.name).toBe('result');
  });

  it('[SUBS-R27] 首頁重新查詢後立刻帶入台北通的值', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, router, q } = await mountApp(fixtureWithMock);
    await settle();
    await answerAll(wrapper, { band: '65+', residency: false, identities: ['low'], income: 1 });
    await go(router, '/');
    await wrapper.get('[data-test="btn-requery"]').trigger('click');
    await settle();
    expect(q.answersState.value).toBe('empty');
    await go(router, '/calc');
    expect(inAge(wrapper)).toBe(DEMO_BAND);
    expect(inRes(wrapper)).toBe('true');
    expect(wrapper.find('[data-test="age-tp"]').exists()).toBe(true);
  });
});

describe('撥打 1999（W11）', () => {
  it('[W11] 台北通殼內按撥打走 bridge phone_call 1999', async () => {
    const post = installFakeBridge(DEMO_ACCOUNT);
    const { wrapper } = await mountApp(fixtureWithMock);
    await settle();
    await answerAll(wrapper, PREG);
    await openCard(wrapper, 8);
    await wrapper.get('[data-test="d-call"]').trigger('click');
    await settle();
    const call = post.mock.calls.map((c) => JSON.parse(c[0] as string)).find((m) => m.name === 'phone_call');
    expect(call).toEqual({ name: 'phone_call', data: '1999' });
  });

  it('[W10] 卡片與彈窗都用原創插畫，沒有外部圖片', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await openCard(wrapper, 101);
    expect(wrapper.find('[data-test="detail-dialog"] [data-test="card-illus"] svg').exists()).toBe(true);
    expect(document.body.innerHTML).not.toMatch(/<img|<image/);
  });
});

describe('收藏與我的珍藏（W8）', () => {
  it('[SUBS-R28][SUBS-R71] 書籤加入收藏：徽章 +1、toast；我的珍藏帶判定；只存序號', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    expect(wrapper.find('[data-test="fav-count"]').exists()).toBe(false);
    await card(wrapper, 4).get('[data-test="fav-4"]').trigger('click');
    expect(wrapper.get('[data-test="fav-count"]').text()).toBe('1');
    expect(wrapper.get('[data-test="toast"]').text()).toBe('已加入我的珍藏');
    await card(wrapper, 101).get('[data-test="fav-101"]').trigger('click');
    expect(wrapper.get('[data-test="fav-count"]').text()).toBe('2');
    expect(Object.keys(localStorage).sort()).toEqual([FAVORITES_KEY, SUBSIDY_CACHE_KEY].sort());
    expect(localStorage.getItem(FAVORITES_KEY)).toBe('[4,101]');
    await wrapper.get('[data-test="btn-favorites"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('favorites');
    expect(cardNos(wrapper, 'fav')).toEqual([4, 101]);
    expect(card(wrapper, 4).attributes('data-status')).toBe('ineligible');
    expect(card(wrapper, 4).get('[data-test="card-key-value"]').text()).toBe('每人每月收入需在 24,293 元以下');
    await card(wrapper, 4).get('[data-test="fav-4"]').trigger('click');
    expect(localStorage.getItem(FAVORITES_KEY)).toBe('[101]');
    expect(wrapper.get('[data-test="toast"]').text()).toBe('已從我的珍藏移除');
  });

  it('[SUBS-R28] 重新進入服務收藏還在；沒送出時開彈窗判定為尚未比對', async () => {
    localStorage.setItem(FAVORITES_KEY, '[4,101]');
    const { wrapper } = await mountApp(fixtureWithMock, '/favorites');
    expect(wrapper.get('[data-test="fav-count"]').text()).toBe('2');
    expect(cardNos(wrapper, 'fav')).toEqual([4, 101]);
    expect(card(wrapper, 4).attributes('data-status')).toBe('none');
    await openCard(wrapper, 4);
    expect(wrapper.get('[data-test="d-verdict"]').text()).toBe('尚未比對');
    expect(wrapper.get('[data-test="d-why"]').text()).toBe('尚未比對，到試算頁填完四題就會看到判定。');
  });

  it('[W8] 我的珍藏空狀態：回首頁查詢', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock, '/favorites');
    expect(wrapper.get('[data-test="fav-empty"]').text()).toContain('還沒有收藏的補助');
    await wrapper.get('[data-test="fav-go-home"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
  });
});
