import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { answerAll, mountApp, settle } from './helpers/mountApp';
import { DEMO_ACCOUNT, installFakeBridge, sentNames } from './helpers/bridge';
import { ageFromBirthday } from '@/lib/userinfo';
import { SUBSIDY_CACHE_KEY } from '@/lib/subsidyCache';

/** 示範帳號今天的實歲（1990/01/01；2026-11-08 為 36） */
const DEMO_AGE = ageFromBirthday(DEMO_ACCOUNT.birthday, new Date())!;
const AGE70 = { age: '70', residency: true, identities: ['none'], income: 3 };
const NOMATCH = { age: '50', residency: false, identities: ['none'], income: 5 };

function cardNos(wrapper: VueWrapper, list: 'yes' | 'no'): number[] {
  const el = wrapper.find(`[data-test="list-${list}"]`);
  return el.exists() ? el.findAll('[data-test="card"]').map((c) => Number(c.attributes('data-no'))) : [];
}
function card(wrapper: VueWrapper, i: number) {
  return wrapper.get(`[data-test="card-${i}"]`);
}
/** 轉到第 i 張再點（點非前排的卡只會先轉過去，spec 7.10） */
async function tapCard(wrapper: VueWrapper, i: number): Promise<void> {
  await wrapper.get(`[data-test="dot-${i}"]`).trigger('click');
  await card(wrapper, i).trigger('click');
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('開始頁：上次清單、無法使用與重試（W3）', () => {
  it('[SUBS-R10] 載入過一次後斷網重進：顯示上次資料與更新時間，仍能完成 4 題看到結果', async () => {
    await mountApp(fixtureWithMock);
    expect(localStorage.getItem(SUBSIDY_CACHE_KEY)).not.toBeNull();
    document.body.innerHTML = '';
    const { wrapper, router, q } = await mountApp(null);
    expect(q.listState.value).toBe('cached');
    expect(wrapper.get('[data-test="list-cached"]').text()).toBe('目前顯示的是上次載入的資料（2024-12-19）。');
    expect(wrapper.find('[data-test="btn-retry"]').exists()).toBe(true);
    await answerAll(wrapper, AGE70);
    expect(router.currentRoute.value.name).toBe('result');
    expect(cardNos(wrapper, 'yes')).toEqual([6, 9]);
    expect(wrapper.get('[data-test="result-cached"]').text()).toContain('目前顯示的是上次載入的資料');
  });

  it('[SUBS-R22] 從未載入且沒網路：顯示無法取得與重試，看不到開始與示範；重試成功後出現開始', async () => {
    const { wrapper, q, fetchMock } = await mountApp(null);
    expect(q.listState.value).toBe('unavailable');
    expect(wrapper.get('[data-test="list-unavailable"]').text()).toContain('暫時無法取得補助資料');
    expect(wrapper.find('[data-test="btn-start"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(false);
    // 點卡片也進不了問答頁
    await card(wrapper, 0).trigger('click');
    await settle();
    expect(wrapper.find('[data-test="page-question"]').exists()).toBe(false);
    fetchMock.mockImplementation(async () => Response.json(fixtureWithMock));
    await wrapper.get('[data-test="btn-retry"]').trigger('click');
    await settle();
    expect(q.listState.value).toBe('fresh');
    expect(wrapper.get('[data-test="btn-start"]').text()).toBe('開始查詢');
    expect(wrapper.find('[data-test="btn-retry"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(true);
  });
});

describe('無符合、清除、示範情境（W4）', () => {
  it('[SUBS-R19] 50 歲未設籍以上皆無 33,253 以上：無符合、最接近 3 項各差在哪、社福中心連結；模擬列在不符合組', async () => {
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
    expect(cardNos(wrapper, 'no').slice(-3)).toEqual([101, 102, 103]);
    expect(wrapper.get('[data-test="count-yes"]').text()).toBe('0');
  });

  it('有可能符合時不顯示無符合區塊', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    expect(wrapper.find('[data-test="no-match"]').exists()).toBe(false);
  });

  it('[SUBS-R20] 問答頁按清除填寫答案：回第 1 題，4 題都空（沒有台北通帳號時）', async () => {
    const { wrapper, q } = await mountApp(fixtureWithMock);
    await wrapper.get('[data-test="btn-start"]').trigger('click');
    await settle();
    await wrapper.get('[data-test="in-age"]').setValue('40');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    await wrapper.get('[data-test="res-true"]').trigger('change');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 3 題，共 4 題');
    await wrapper.get('[data-test="btn-clear"]').trigger('click');
    await settle();
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 1 題，共 4 題');
    expect((wrapper.get('[data-test="in-age"]').element as HTMLInputElement).value).toBe('');
    expect(q.answers.value).toEqual({ age: null, residency: null, identities: [], incomeBracket: null });
    // 原型 clearAnswers 的提示
    expect(wrapper.get('[data-test="toast"]').text()).toBe('已清除填寫答案');
  });

  it('[SUBS-R20] 結果頁按清除填寫答案：到問答頁第 1 題，4 題都空', async () => {
    const { wrapper, router, q } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="btn-clear"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('question');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 1 題，共 4 題');
    expect((wrapper.get('[data-test="in-age"]').element as HTMLInputElement).value).toBe('');
    expect(q.answersState.value).toBe('empty');
    expect(q.list.value?.items).toHaveLength(13);
    expect(wrapper.get('[data-test="toast"]').text()).toBe('已清除填寫答案');
  });

  it.each([
    [0, 2],
    [1, 2],
    [2, 7],
  ])('[SUBS-R23] 示範情境第 %i 組一鍵帶入，可能符合 %i 項', async (i, n) => {
    const { wrapper, router, q } = await mountApp(fixtureWithMock);
    await wrapper.get(`[data-test="demo-${i}"]`).trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
    expect(q.answersState.value).toBe('completed');
    expect(wrapper.get('[data-test="count-yes"]').text()).toBe(String(n));
    expect(cardNos(wrapper, 'yes')).toHaveLength(n);
  });

  it('示範情境三組的標題與副標照原型', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    const demos = wrapper.get('[data-test="demo-box"]').findAll('.btn.demo');
    expect(demos.map((d) => d.get('b').text())).toEqual(['70 歲長者', '40 歲・身心障礙者', '30 歲・懷孕・中低收入戶']);
    expect(demos.map((d) => d.get('.ico').text())).toEqual(['70', '40', '30']);
  });
});

describe('資料來源頁（W5）', () => {
  it('[spec 7.6] 列出資料集、機關、授權、網址、更新時間、門檻提醒與模擬說明；左上首頁鍵回開始頁', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await wrapper.get('[data-test="btn-source"]').trigger('click');
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
    // 頁首最左是首頁鍵
    const header = wrapper.get('header.top');
    expect(header.element.firstElementChild?.getAttribute('data-test')).toBe('btn-home');
    await wrapper.get('[data-test="btn-home"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
  });

  it('結果頁底部「資料來源與門檻說明」到資料來源頁，頁底返回回結果頁', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="link-source"]').trigger('click');
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
  it('[spec 7.9] 進入服務時開始頁有小手與前排卡皺摺，頁面可見、按鈕可按；2 秒內拿掉', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    expect(!!document.querySelector('[data-test="intro-hand"]')).toBe(true);
    expect(card(wrapper, 0).find('[data-test="wrinkles"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="page-start"]').classes()).toContain('pulled');
    await new Promise((r) => setTimeout(r, 1950));
    await settle();
    expect(!!document.querySelector('[data-test="intro-hand"]')).toBe(false);
    expect(wrapper.find('[data-test="wrinkles"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="page-start"]').classes()).not.toContain('pulled');
    // 回開始頁不再播
    await wrapper.get('[data-test="btn-start"]').trigger('click');
    await settle();
    await router.push('/');
    await settle();
    expect(!!document.querySelector('[data-test="intro-hand"]')).toBe(false);
  });

  it('播放中可直接按開始查詢', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    expect(!!document.querySelector('[data-test="intro-hand"]')).toBe(true);
    await wrapper.get('[data-test="btn-start"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('question');
  });

  it('[spec 7.9] 減少動態效果時手與皺摺都不出現', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener() {}, removeEventListener() {} })),
    );
    const { wrapper } = await mountApp(fixtureWithMock);
    expect(!!document.querySelector('[data-test="intro-hand"]')).toBe(false);
    expect(wrapper.find('[data-test="wrinkles"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="page-start"]').classes()).not.toContain('pulled');
  });
});

describe('我的資料與台北通帳號帶入（W7、W8）', () => {
  it('[SUBS-R24] 示範帳號：年齡卡實歲已填寫且標來自台北通帳號、戶籍設籍臺北市，身分與收入尚未填寫；沒有身分證字號與姓名', async () => {
    const post = installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, fetchMock } = await mountApp(fixtureWithMock);
    await settle();
    expect(sentNames(post)).toContain('userinfo');
    expect(card(wrapper, 0).get('[data-test="card-value"]').text()).toBe(`${DEMO_AGE} 歲`);
    expect(card(wrapper, 0).get('[data-test="card-stat"]').text()).toBe('已填寫');
    expect(card(wrapper, 0).get('[data-test="card-note"]').text()).toContain('來自台北通帳號');
    expect(card(wrapper, 1).get('[data-test="card-value"]').text()).toBe('設籍臺北市');
    expect(card(wrapper, 1).get('[data-test="card-note"]').text()).toContain('來自台北通帳號');
    for (const i of [2, 3]) {
      expect(card(wrapper, i).get('[data-test="card-value"]').text()).toBe('尚未填寫');
      expect(card(wrapper, i).get('[data-test="card-stat"]').text()).toBe('尚未填寫');
    }
    expect(wrapper.findAll('.pcard')).toHaveLength(5);
    expect(wrapper.get('[data-test="acct-note"]').text()).toContain('示範帳號資料');
    expect(document.body.innerHTML).not.toContain(DEMO_ACCOUNT.idNo);
    expect(document.body.innerHTML).not.toContain(DEMO_ACCOUNT.realName);
    // [SUBS-R70] 帳號資料不放進請求
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe('/api/v1/subsidies');
      expect(init?.body).toBeUndefined();
    }
    // 還沒開始作答：仍是未填，有示範情境
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(true);
  });

  it('[SUBS-R24][SUBS-R20] 點收入卡直接到第 4 題；開始查詢第 1 題年齡已帶好可改；問答頁清除後年齡與戶籍回填', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, router, q } = await mountApp(fixtureWithMock);
    await settle();
    await tapCard(wrapper, 3);
    expect(router.currentRoute.value.name).toBe('question');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 4 題，共 4 題');
    // 回首頁重新開始
    q.startOver();
    await router.push('/');
    await settle();
    await wrapper.get('[data-test="btn-start"]').trigger('click');
    await settle();
    const age = wrapper.get('[data-test="in-age"]');
    expect((age.element as HTMLInputElement).value).toBe(String(DEMO_AGE));
    await age.setValue('41');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    expect(q.answers.value.age).toBe(41);
    await wrapper.get('[data-test="res-false"]').trigger('change');
    await wrapper.get('[data-test="btn-clear"]').trigger('click');
    await settle();
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 1 題，共 4 題');
    expect((wrapper.get('[data-test="in-age"]').element as HTMLInputElement).value).toBe(String(DEMO_AGE));
    expect(q.answers.value).toEqual({ age: DEMO_AGE, residency: true, identities: [], incomeBracket: null });
  });

  it('[SUBS-R24] 帳號改過的值不再標來自台北通帳號', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await settle();
    await wrapper.get('[data-test="btn-start"]').trigger('click');
    await settle();
    await wrapper.get('[data-test="in-age"]').setValue('41');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    await router.push('/');
    await settle();
    expect(card(wrapper, 0).get('[data-test="card-value"]').text()).toBe('41 歲');
    expect(card(wrapper, 0).get('[data-test="card-note"]').text()).toBe('點卡片可修改');
    expect(card(wrapper, 1).get('[data-test="card-note"]').text()).toContain('來自台北通帳號');
  });

  it('[SUBS-R24] 帳號資料讀不到（回 []）：年齡與戶籍空白、卡片尚未填寫，仍可完成查詢', async () => {
    installFakeBridge([]);
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await settle();
    expect(card(wrapper, 0).get('[data-test="card-value"]').text()).toBe('尚未填寫');
    expect(card(wrapper, 1).get('[data-test="card-value"]').text()).toBe('尚未填寫');
    await answerAll(wrapper, AGE70);
    expect(router.currentRoute.value.name).toBe('result');
    expect(cardNos(wrapper, 'yes')).toEqual([6, 9]);
  });

  it('[SUBS-R26][SUBS-R27] 已完成按首頁鍵：卡片顯示目前答案、無示範；點收入卡改級距後結果更新；重新查詢後示範出現、卡片仍顯示台北通值', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await settle();
    await wrapper.get('[data-test="demo-0"]').trigger('click');
    await settle();
    expect(wrapper.get('[data-test="count-yes"]').text()).toBe('2');
    await wrapper.get('[data-test="btn-home"]').trigger('click');
    await settle();
    expect(card(wrapper, 0).get('[data-test="card-value"]').text()).toBe('70 歲');
    expect(card(wrapper, 3).get('[data-test="card-value"]').text()).toBe('24,294～28,550 元');
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="btn-view-result"]').exists()).toBe(true);
    await tapCard(wrapper, 3);
    expect(router.currentRoute.value.name).toBe('question');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 4 題，共 4 題');
    await wrapper.get('[data-test="inc-1"]').trigger('change');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
    expect(Number(wrapper.get('[data-test="count-yes"]').text())).toBeGreaterThan(2);
    await wrapper.get('[data-test="btn-home"]').trigger('click');
    await settle();
    await wrapper.get('[data-test="btn-requery"]').trigger('click');
    await settle();
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="toast"]').text()).toBe('已清除填寫答案');
    expect(card(wrapper, 0).get('[data-test="card-value"]').text()).toBe(`${DEMO_AGE} 歲`);
    expect(card(wrapper, 0).get('[data-test="card-note"]').text()).toContain('來自台北通帳號');
    expect(card(wrapper, 1).get('[data-test="card-value"]').text()).toBe('設籍臺北市');
  });

  it('點非前排的卡先轉到那張，不跳題；頁點切換前排', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    expect(card(wrapper, 0).attributes('data-pos')).toBe('0');
    await card(wrapper, 1).trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(card(wrapper, 1).attributes('data-pos')).toBe('0');
    expect(card(wrapper, 0).attributes('data-pos')).toBe('out');
    await wrapper.get('[data-test="dot-4"]').trigger('click');
    expect(card(wrapper, 4).attributes('data-pos')).toBe('0');
    expect(wrapper.get('[data-test="dot-4"]').classes()).toContain('on');
  });

  it('[SUBS-R25][SUBS-R71] 文件卡勾滿 3 項顯示已備齊；重新進入服務後勾選消失；localStorage 只有一個鍵', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await wrapper.get('[data-test="dot-4"]').trigger('click');
    for (const j of [0, 1, 2]) await wrapper.get(`[data-test="doc-${j}"]`).trigger('click');
    expect(card(wrapper, 4).get('[data-test="card-stat"]').text()).toBe('已備齊');
    expect(card(wrapper, 4).get('[data-test="card-value"]').text()).toBe('已準備 3／3');
    expect(wrapper.get('[data-test="doc-0"]').attributes('aria-pressed')).toBe('true');
    expect(Object.keys(localStorage)).toEqual([SUBSIDY_CACHE_KEY]);
    expect(sessionStorage.length).toBe(0);
    document.body.innerHTML = '';
    const again = await mountApp(fixtureWithMock);
    expect(card(again.wrapper, 4).get('[data-test="card-value"]').text()).toBe('已準備 0／3');
    expect(card(again.wrapper, 4).get('[data-test="card-stat"]').text()).toBe('尚未備齊');
  });
});

describe('結果頁閱讀模式、篩選與插畫（W9、W10）', () => {
  it('[SUBS-R25] 預設大圖；切小圖後兩組都是小圖；打開再關閉詳細資訊仍是小圖', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    expect(wrapper.get('[data-test="view-grid"]').classes()).toContain('on');
    expect(wrapper.findAll('.bcard')).toHaveLength(13);
    await wrapper.get('[data-test="view-list"]').trigger('click');
    expect(wrapper.findAll('.bcard')).toHaveLength(0);
    expect(wrapper.get('[data-test="list-yes"]').findAll('.item')).toHaveLength(2);
    expect(wrapper.get('[data-test="list-no"]').findAll('.item')).toHaveLength(11);
    // 小圖清單多收件單位
    expect(wrapper.get('[data-test="list-yes"]').get('.org').text()).not.toBe('');
    await wrapper.get('[data-test="list-yes"]').get('.item').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('detail');
    await wrapper.get('[data-test="btn-back"]').trigger('click');
    await settle();
    await new Promise((r) => setTimeout(r, 20));
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
    expect(wrapper.findAll('.item')).toHaveLength(13);
    expect(wrapper.get('[data-test="view-list"]').attributes('aria-pressed')).toBe('true');
  });

  it('[SUBS-R25] 篩選模擬資料只剩 3 項、計數不變；開放資料 10 項；全部恢復 13 項', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, { age: '30', residency: true, identities: ['preg', 'mid'], income: 2 });
    expect(wrapper.get('[data-test="kind-all"]').classes()).toContain('on');
    const counts = () => [wrapper.get('[data-test="count-yes"]').text(), wrapper.get('[data-test="count-no"]').text()];
    const before = counts();
    await wrapper.get('[data-test="kind-mock"]').trigger('click');
    const shown = wrapper.findAll('[data-test="card"]');
    expect(shown).toHaveLength(3);
    expect(shown.every((c) => c.attributes('data-kind') === 'mock')).toBe(true);
    expect(counts()).toEqual(before);
    await wrapper.get('[data-test="kind-open"]').trigger('click');
    expect(wrapper.findAll('[data-test="card"]')).toHaveLength(10);
    expect(counts()).toEqual(before);
    await wrapper.get('[data-test="kind-all"]').trigger('click');
    expect(wrapper.findAll('[data-test="card"]')).toHaveLength(13);
  });

  it('[SUBS-R25] 篩選不影響無符合判定', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="kind-mock"]').trigger('click');
    expect(wrapper.find('[data-test="no-match"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="count-yes"]').text()).toBe('2');
  });

  it('[W10] 13 項卡片都有原創插畫，大圖與小圖共用；不符合降飽和（class no）；沒有外部圖片', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    const illus = wrapper.findAll('[data-test="card-illus"]');
    expect(illus).toHaveLength(13);
    for (const el of illus) expect(el.find('svg path, svg rect, svg circle, svg ellipse').exists()).toBe(true);
    expect(wrapper.findAll('.bcard.no')).toHaveLength(11);
    expect(document.querySelectorAll('img')).toHaveLength(0);
    expect(document.body.innerHTML).not.toMatch(/(?:href|src)="https?:\/\/[^"]*\.(?:png|jpe?g|gif|webp|svg)/);
    await wrapper.get('[data-test="view-list"]').trigger('click');
    expect(wrapper.findAll('[data-test="card-illus"] svg')).toHaveLength(13);
  });
});

describe('詳細資訊頁動作（W11）', () => {
  it('[W11] 開放資料序號 8 生育補助：大插畫、膠囊、官網、開官網、撥打 1999（瀏覽器為 tel: 連結）、門檻提醒', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, { age: '30', residency: true, identities: ['preg', 'mid'], income: 2 });
    await router.push('/detail/8');
    await settle();
    expect(wrapper.find('[data-test="d-illus"] svg').exists()).toBe(true);
    expect(wrapper.get('[data-test="d-pill-kind"]').text()).toBe('開放資料');
    expect(wrapper.get('[data-test="d-pill-verdict"]').text()).toBe('可能符合');
    const item = fixtureWithMock.items.find((i) => i.no === 8)!;
    expect(wrapper.get('[data-test="d-act"]').attributes('href')).toBe(item.url);
    expect(wrapper.get('[data-test="btn-site"]').attributes('href')).toBe(item.url);
    const call = wrapper.get('[data-test="btn-call"]');
    expect(call.attributes('href')).toBe('tel:1999');
    expect(call.attributes('aria-label')).toBe('撥打 1999');
    expect(wrapper.get('[data-test="d-notice"]').text()).toBe('門檻以社會局最新公告為準。');
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await wrapper.get('[data-test="btn-site"]').trigger('click');
    expect(open).toHaveBeenCalledWith(item.url, '_blank', 'noopener');
  });

  it('[W11] 台北通殼內按撥打走 bridge phone_call 1999', async () => {
    const post = installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, { age: '30', residency: true, identities: ['preg', 'mid'], income: 2 });
    await router.push('/detail/8');
    await settle();
    await wrapper.get('[data-test="btn-call"]').trigger('click');
    await settle();
    const call = post.mock.calls.map((c) => JSON.parse(c[0] as string)).find((m) => m.name === 'phone_call');
    expect(call).toEqual({ name: 'phone_call', data: '1999' });
  });

  it('[W11] 聯繫方式不含 1999 的開放資料沒有撥號鈕', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await router.push('/detail/6');
    await settle();
    expect(wrapper.find('[data-test="btn-call"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="btn-site"]').exists()).toBe(true);
  });

  it('[W11] 模擬資料序號 101：官網鈕顯示「模擬資料」不可按，沒有開官網與撥號，網址欄為無（模擬資料）', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await router.push('/detail/101');
    await settle();
    expect(router.currentRoute.value.name).toBe('detail');
    const off = wrapper.get('[data-test="d-act-off"]');
    expect(off.text()).toBe('模擬資料');
    expect(off.attributes('aria-disabled')).toBe('true');
    expect(off.element.tagName).toBe('SPAN');
    expect(wrapper.find('[data-test="d-act"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="btn-site"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="btn-call"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="d-url"]').text()).toBe('無（模擬資料）');
    expect(wrapper.get('[data-test="d-title"]').text()).toContain('模擬資料');
    expect(wrapper.get('[data-test="d-notice"]').text()).toBe('門檻以社會局最新公告為準。');
    expect(wrapper.find('[data-test="d-illus"] svg').exists()).toBe(true);
  });
});
