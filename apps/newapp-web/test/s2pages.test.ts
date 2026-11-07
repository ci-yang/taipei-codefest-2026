import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { answerAll, mountApp, settle } from './helpers/mountApp';
import { DEMO_ACCOUNT, installFakeBridge, sentNames } from './helpers/bridge';
import { ageFromBirthday, bandOfAge } from '@/lib/userinfo';
import { SUBSIDY_CACHE_KEY } from '@/lib/subsidyCache';
import { FAVORITES_KEY } from '@/lib/favorites';

/** 示範帳號今天的實歲（1990/01/01；2026-11-08 為 36） */
const DEMO_BAND = bandOfAge(ageFromBirthday(DEMO_ACCOUNT.birthday, new Date()))!;
const AGE70 = { band: '65+', residency: true, identities: ['none'], income: 3 };
const NOMATCH = { band: '45-64', residency: false, identities: ['none'], income: 5 };
const PREG = { band: '30-44', residency: true, identities: ['preg', 'mid'], income: 2 };

function rowNos(wrapper: VueWrapper, list: 'yes' | 'no'): number[] {
  return wrapper.get(`[data-test="list-${list}"]`).findAll('[data-test="row"]').map((r) => Number(r.attributes('data-no')));
}
function bigNos(wrapper: VueWrapper): number[] {
  return wrapper.findAll('[data-test="big-card"]').map((c) => Number(c.attributes('data-no')));
}
async function openRow(wrapper: VueWrapper, no: number): Promise<void> {
  await wrapper.get(`[data-test="row"][data-no="${no}"] [data-test="row-main"]`).trigger('click');
  await settle();
}
async function closeDialog(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[data-test="d-close"]').trigger('click');
  await settle();
}
/** 目前亮著的年齡區間（沒選為空字串） */
const inAge = (w: VueWrapper) =>
  w.findAll('[data-test^="band-"]').filter((b) => b.classes().includes('on')).map((b) => b.attributes('data-test')!.replace('band-', ''))[0] ?? '';
const inRes = (w: VueWrapper) => (w.get('[data-test="in-res"]').element as HTMLSelectElement).value;

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

describe('首頁：上次清單、無法使用與重試（W3）', () => {
  it('[SUBS-R10] 載入過一次後斷網重進：顯示上次資料與更新時間，仍能送出看到結果', async () => {
    await mountApp(fixtureWithMock);
    expect(localStorage.getItem(SUBSIDY_CACHE_KEY)).not.toBeNull();
    document.body.innerHTML = '';
    const { wrapper, router, q } = await mountApp(null);
    expect(q.listState.value).toBe('cached');
    expect(wrapper.get('[data-test="list-cached"]').text()).toBe('目前顯示的是上次載入的資料（2024-12-19）。');
    expect(wrapper.find('[data-test="btn-retry"]').exists()).toBe(true);
    await answerAll(wrapper, AGE70);
    expect(router.currentRoute.value.name).toBe('result');
    expect(q.results.value?.eligible.map((r) => r.item.no)).toEqual([6, 9]);
    expect(wrapper.get('[data-test="result-cached"]').text()).toContain('目前顯示的是上次載入的資料');
  });

  it('[SUBS-R22] 從未載入且沒網路：無法取得與重試，表單整張停用、沒有送出鈕與示範；重試成功後恢復', async () => {
    const { wrapper, q, fetchMock } = await mountApp(null);
    expect(q.listState.value).toBe('unavailable');
    expect(wrapper.get('[data-test="list-unavailable"]').text()).toBe('暫時無法取得補助資料，請稍後重試。');
    expect(wrapper.get('[data-test="q-form"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-test="btn-submit"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(false);
    fetchMock.mockImplementation(async () => Response.json(fixtureWithMock));
    await wrapper.get('[data-test="btn-retry"]').trigger('click');
    await settle();
    expect(q.listState.value).toBe('fresh');
    expect(wrapper.get('[data-test="q-form"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[data-test="btn-submit"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="btn-retry"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(true);
  });
});

describe('模擬資料、無符合、清除、示範情境（W2、W4）', () => {
  it('[SUBS-R07][SUBS-R18] 結果合計 13 項：開放資料在前、模擬 3 項在後且有模擬資料標籤', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="view-list"]').trigger('click');
    const all = [...rowNos(wrapper, 'yes'), ...rowNos(wrapper, 'no')];
    expect(all).toHaveLength(13);
    expect(rowNos(wrapper, 'no').slice(-3)).toEqual([101, 102, 103]);
    for (const no of [101, 102, 103]) {
      expect(wrapper.get(`[data-test="row"][data-no="${no}"] [data-test="kind-tag"]`).text()).toBe('模擬資料');
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
    expect(wrapper.get('[data-test="count-yes"]').text()).toBe('0');
    expect(rowNos(wrapper, 'no').slice(-3)).toEqual([101, 102, 103]);
  });

  it('[SUBS-R20] 結果頁清除填寫答案：回首頁未填，身分收入清空，年齡與戶籍重新顯示台北通值，示範出現', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, router, q } = await mountApp(fixtureWithMock);
    await settle();
    await answerAll(wrapper, { band: '65+', residency: false, identities: ['dis'], income: 4 });
    expect(router.currentRoute.value.name).toBe('result');
    await wrapper.get('[data-test="btn-clear"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(q.answersState.value).toBe('empty');
    expect(inAge(wrapper)).toBe(DEMO_BAND);
    expect(inRes(wrapper)).toBe('true');
    expect(wrapper.get('[data-test="age-tp"]').text()).toBe('台北通帶入・可修改');
    expect(wrapper.get('[data-test="id-dis"]').attributes('aria-pressed')).toBe('false');
    expect(q.answers.value.incomeBracket).toBeNull();
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="toast"]').text()).toBe('已清除填寫答案');
    expect(q.list.value?.items).toHaveLength(13);
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
    expect(bigNos(wrapper)).toHaveLength(n);
  });

  it('示範情境三組的標題與副標照原型', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    const demos = wrapper.get('[data-test="demo-box"]').findAll('.btn.demo');
    expect(demos.map((d) => d.get('b').text())).toEqual(['70 歲長者', '40 歲・身心障礙者', '30 歲・懷孕・中低收入戶']);
    expect(demos.map((d) => d.get('.ico').text())).toEqual(['70', '40', '30']);
  });
});

describe('資料來源頁（W5）', () => {
  it('[spec 7.6] 列出資料集、機關、授權、網址、更新時間、門檻提醒與模擬說明；左上首頁鍵回首頁', async () => {
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
  it('[spec 7.9] 進入服務時首頁有小手（掛在 body）與年齡卡皺摺，頁面可見；2 秒內拿掉；回首頁不再播', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    const hand = document.querySelector('[data-test="intro-hand"]');
    expect(hand?.parentElement).toBe(document.body);
    expect(wrapper.get('[data-test="card-age"]').find('[data-test="wrinkles"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="page-start"]').classes()).toContain('pulled');
    await new Promise((r) => setTimeout(r, 1950));
    await settle();
    expect(!!document.querySelector('[data-test="intro-hand"]')).toBe(false);
    expect(wrapper.find('[data-test="wrinkles"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="page-start"]').classes()).not.toContain('pulled');
    await router.push('/source');
    await settle();
    await router.push('/');
    await settle();
    expect(!!document.querySelector('[data-test="intro-hand"]')).toBe(false);
  });

  it('播放中可直接操作表單與送出', async () => {
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
    expect(wrapper.get('[data-test="page-start"]').classes()).not.toContain('pulled');
  });
});

describe('台北通帳號帶入（W7）', () => {
  it('[SUBS-R24] 示範帳號：年齡自動選 30-44歲、戶籍「臺北市 · 信義區」，兩題標台北通帶入；沒有身分證字號與姓名；請求不帶帳號資料', async () => {
    const post = installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, fetchMock, q } = await mountApp(fixtureWithMock);
    await settle();
    expect(sentNames(post)).toContain('userinfo');
    expect(inAge(wrapper)).toBe(DEMO_BAND);
    expect(inRes(wrapper)).toBe('true');
    expect(wrapper.get('[data-test="opt-taipei"]').text()).toBe('臺北市 · 信義區');
    expect(wrapper.get('[data-test="age-tp"]').text()).toBe('台北通帶入・可修改');
    expect(wrapper.get('[data-test="res-tp"]').text()).toBe('來自台北通帳號，可修改');
    expect(wrapper.get('[data-test="home-fine"]').text()).toContain('年齡、戶籍為示範帳號資料');
    expect(q.answersState.value).toBe('empty');
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(true);
    expect(document.body.innerHTML).not.toContain(DEMO_ACCOUNT.idNo);
    expect(document.body.innerHTML).not.toContain(DEMO_ACCOUNT.realName);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe('/api/v1/subsidies');
      expect(init?.body).toBeUndefined();
    }
  });

  it('[SUBS-R24] town 只顯示不送出：比對、請求、儲存都沒有區', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, fetchMock, q } = await mountApp(fixtureWithMock);
    await settle();
    await wrapper.get('[data-test="id-none"]').trigger('click');
    await wrapper.get('[data-test="in-br"]').setValue('3');
    await wrapper.get('[data-test="btn-submit"]').trigger('click');
    await settle();
    expect(q.answersState.value).toBe('completed');
    expect(Object.keys(q.answers.value).sort()).toEqual(['ageBand', 'identities', 'incomeBracket', 'residency']);
    expect(JSON.stringify(q.answers.value)).not.toContain('信義區');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('信義區');
    for (const k of Object.keys(localStorage)) expect(localStorage.getItem(k)).not.toContain('信義區');
    expect(sessionStorage.length).toBe(0);
  });

  it('[SUBS-R24] 改過的值不再標來自台北通帳號，選臺北市也不顯示區', async () => {
    installFakeBridge({ ...DEMO_ACCOUNT, addresses: [{ city: '新北市', town: '板橋區' }] });
    const { wrapper } = await mountApp(fixtureWithMock);
    await settle();
    expect(inRes(wrapper)).toBe('false');
    expect(wrapper.find('[data-test="res-tp"]').exists()).toBe(true);
    await wrapper.get('[data-test="in-res"]').setValue('true');
    expect(wrapper.find('[data-test="res-tp"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="opt-taipei"]').text()).toBe('臺北市');
    await wrapper.get('[data-test="band-45-64"]').trigger('click');
    expect(wrapper.find('[data-test="age-tp"]').exists()).toBe(false);
  });

  it('[SUBS-R24] 示範情境的答案不標台北通帶入：回首頁戶籍只顯示臺北市、沒有來源標示', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper } = await mountApp(fixtureWithMock);
    await settle();
    await wrapper.get('[data-test="demo-0"]').trigger('click');
    await settle();
    await wrapper.get('[data-test="btn-home"]').trigger('click');
    await settle();
    expect(inAge(wrapper)).toBe('65+');
    expect(inRes(wrapper)).toBe('true');
    expect(wrapper.find('[data-test="age-tp"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="res-tp"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="opt-taipei"]').text()).toBe('臺北市');
  });

  it('[SUBS-R24] 帳號資料讀不到（回 []）：年齡與戶籍空白、沒有來源標示，仍可完成查詢', async () => {
    installFakeBridge([]);
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await settle();
    expect(inAge(wrapper)).toBe('');
    expect(inRes(wrapper)).toBe('');
    expect(wrapper.find('[data-test="age-tp"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="res-tp"]').exists()).toBe(false);
    await answerAll(wrapper, AGE70);
    expect(router.currentRoute.value.name).toBe('result');
  });

  it('[SUBS-R27] 重新查詢後立刻帶入台北通的值', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper, q } = await mountApp(fixtureWithMock);
    await settle();
    await wrapper.get('[data-test="band-65+"]').trigger('click');
    await wrapper.get('[data-test="in-res"]').setValue('false');
    await wrapper.get('[data-test="id-low"]').trigger('click');
    expect(q.answersState.value).toBe('inProgress');
    await wrapper.get('[data-test="btn-requery"]').trigger('click');
    await settle();
    expect(q.answersState.value).toBe('empty');
    expect(inAge(wrapper)).toBe(DEMO_BAND);
    expect(inRes(wrapper)).toBe('true');
    expect(wrapper.get('[data-test="opt-taipei"]').text()).toBe('臺北市 · 信義區');
    expect(wrapper.find('[data-test="age-tp"]').exists()).toBe(true);
  });
});

describe('結果頁輪播、清單與篩選（W9、W10）', () => {
  it('[SUBS-R25] 預設輪播只有可能符合的大卡；大卡欄位；營養品補助機關名顯示臺北市政府社會局', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, PREG);
    expect(wrapper.get('[data-test="view-carousel"]').attributes('aria-pressed')).toBe('true');
    expect(bigNos(wrapper)).toEqual([4, 7, 8, 9, 10, 101, 102]);
    expect(wrapper.findAll('[data-test^="dot-"]')).toHaveLength(7);
    const c7 = wrapper.get('[data-test="big-card"][data-no="7"]');
    expect(c7.get('.stat').text()).toBe('開放資料 · 可能符合');
    expect(c7.get('[data-test="big-name"]').text()).toBe('營養品補助');
    expect(c7.get('[data-test="big-org"]').text()).toBe('臺北市政府社會局');
    expect(c7.findAll('[data-test="big-points"] span').map((s) => s.text())).toEqual(['低收入戶、中低收入戶', '不限年齡', '上限 24,293 元 / 月']);
    expect(c7.get('[data-test="big-apply"]').text()).toBe('前往官網申請');
    expect(c7.find('[data-test="card-illus"] svg').exists()).toBe(true);
    const c101 = wrapper.get('[data-test="big-card"][data-no="101"]');
    expect(c101.get('.stat').text()).toBe('模擬資料 · 可能符合');
    const off = c101.get('[data-test="big-apply-off"]');
    expect(off.text()).toBe('模擬資料・沒有官網');
    expect(off.attributes('aria-disabled')).toBe('true');
    expect(off.element.tagName).toBe('SPAN');
  });

  it('[W9] 看不符合的 N 項：切清單；切清單後開關彈窗仍是清單', async () => {
    const { wrapper, q } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, PREG);
    const seeNo = wrapper.get('[data-test="btn-see-no"]');
    expect(seeNo.text()).toBe('看不符合的 6 項');
    await seeNo.trigger('click');
    await settle();
    expect(q.resultView.value).toBe('list');
    expect(wrapper.get('[data-test="view-list"]').attributes('aria-pressed')).toBe('true');
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    await openRow(wrapper, 1);
    expect(wrapper.find('[data-test="detail-dialog"]').exists()).toBe(true);
    await closeDialog(wrapper);
    expect(q.resultView.value).toBe('list');
    expect(wrapper.get('[data-test="view-list-box"]').attributes('style') ?? '').not.toContain('display: none');
  });

  it('[W9] 點大卡名稱開彈窗；點大卡的書籤與官網不開彈窗', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await wrapper.get('[data-test="big-card"][data-no="6"] [data-test="big-apply"]').trigger('click');
    expect(open).toHaveBeenCalledTimes(1);
    await wrapper.get('[data-test="big-card"][data-no="6"] [data-test="fav-6"]').trigger('click');
    await settle();
    expect(wrapper.find('[data-test="detail-dialog"]').exists()).toBe(false);
    await wrapper.get('[data-test="big-card"][data-no="6"] [data-test="big-name"]').trigger('click');
    await settle();
    expect(wrapper.get('[data-test="d-title"]').text()).toBe('中低收入老人生活津貼');
  });

  it('[SUBS-R25] 篩選模擬資料只剩模擬、計數不變；全部恢復', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, PREG);
    await wrapper.get('[data-test="kind-mock"]').trigger('click');
    await settle();
    expect(bigNos(wrapper)).toEqual([101, 102]);
    expect(wrapper.get('[data-test="count-yes"]').text()).toBe('7');
    expect(wrapper.get('[data-test="count-no"]').text()).toBe('6');
    await wrapper.get('[data-test="view-list"]').trigger('click');
    expect([...rowNos(wrapper, 'yes'), ...rowNos(wrapper, 'no')]).toEqual([101, 102, 103]);
    await wrapper.get('[data-test="kind-all"]').trigger('click');
    expect([...rowNos(wrapper, 'yes'), ...rowNos(wrapper, 'no')]).toHaveLength(13);
  });

  it('[W10] 清單列都有原創插畫；不符合列降飽和（class no）；沒有外部圖片', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    const rows = wrapper.findAll('[data-test="row"]');
    expect(rows).toHaveLength(13);
    for (const r of rows) expect(r.find('[data-test="card-illus"] svg').exists()).toBe(true);
    expect(wrapper.get('[data-test="row"][data-no="10"]').classes()).toContain('no');
    expect(document.body.innerHTML).not.toMatch(/<img|<image/);
  });
});

describe('詳細資訊彈窗動作（W11）', () => {
  it('[W11] 序號 8 生育補助：主鈕前往官網申請、次鈕查看開放資料來源 data.gov.tw、撥打 1999（瀏覽器為 tel: 連結）', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, PREG);
    await openRow(wrapper, 8);
    const item = fixtureWithMock.items.find((i) => i.no === 8)!;
    expect(wrapper.get('[data-test="d-tags"]').text()).toContain('開放資料 · 臺北市社會局');
    expect(wrapper.get('[data-test="d-verdict"]').text()).toBe('可能符合');
    expect(wrapper.find('[data-test="detail-dialog"] [data-test="card-illus"] svg').exists()).toBe(true);
    expect(wrapper.get('[data-test="d-sum"]').text()).toContain('24,293 元');
    const apply = wrapper.get('[data-test="d-apply"]');
    expect(apply.text()).toBe('前往官網申請');
    expect(apply.attributes('href')).toBe(item.url);
    const ds = wrapper.get('[data-test="d-dataset"]');
    expect(ds.text()).toBe('查看開放資料來源');
    expect(ds.attributes('href')).toBe('https://data.gov.tw/dataset/129839');
    const call = wrapper.get('[data-test="d-call"]');
    expect(call.attributes('href')).toBe('tel:1999');
    expect(call.text()).toBe('撥打 1999');
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await apply.trigger('click');
    await ds.trigger('click');
    expect(open.mock.calls.map((c) => c[0])).toEqual([item.url, 'https://data.gov.tw/dataset/129839']);
  });

  it('[W11] 台北通殼內按撥打走 bridge phone_call 1999', async () => {
    const post = installFakeBridge(DEMO_ACCOUNT);
    const { wrapper } = await mountApp(fixtureWithMock);
    await settle();
    await answerAll(wrapper, { ...PREG, residency: null });
    await openRow(wrapper, 8);
    await wrapper.get('[data-test="d-call"]').trigger('click');
    await settle();
    const call = post.mock.calls.map((c) => JSON.parse(c[0] as string)).find((m) => m.name === 'phone_call');
    expect(call).toEqual({ name: 'phone_call', data: '1999' });
  });

  it('[W11] 聯繫方式不含 1999 的開放資料沒有撥號鈕', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await openRow(wrapper, 6);
    expect(wrapper.find('[data-test="d-call"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="d-apply"]').exists()).toBe(true);
  });

  it('[W11] 模擬資料序號 101：主鈕「模擬資料・沒有官網」不能按、次鈕可按、沒有撥號、網址欄無（模擬資料）', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await openRow(wrapper, 101);
    expect(wrapper.get('[data-test="d-tags"]').text()).toContain('模擬資料');
    const off = wrapper.get('[data-test="d-apply-off"]');
    expect(off.text()).toBe('模擬資料・沒有官網');
    expect(off.attributes('aria-disabled')).toBe('true');
    expect(off.element.tagName).toBe('SPAN');
    expect(wrapper.find('[data-test="d-dataset"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="d-call"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="d-url"]').text()).toBe('無（模擬資料）');
    expect(wrapper.get('[data-test="d-notice"]').text()).toContain('門檻以社會局最新公告為準');
  });
});

describe('收藏與我的珍藏（W8）', () => {
  it('[SUBS-R28][SUBS-R71] 書籤加入收藏：徽章 +1、toast；我的珍藏帶判定；localStorage 兩個鍵且只有序號', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    expect(wrapper.find('[data-test="fav-count"]').exists()).toBe(false);
    await wrapper.get('[data-test="row"][data-no="4"] [data-test="fav-4"]').trigger('click');
    expect(wrapper.get('[data-test="fav-count"]').text()).toBe('1');
    expect(wrapper.get('[data-test="toast"]').text()).toBe('已加入我的珍藏');
    await wrapper.get('[data-test="row"][data-no="101"] [data-test="fav-101"]').trigger('click');
    expect(wrapper.get('[data-test="fav-count"]').text()).toBe('2');
    expect(Object.keys(localStorage).sort()).toEqual([FAVORITES_KEY, SUBSIDY_CACHE_KEY].sort());
    expect(localStorage.getItem(FAVORITES_KEY)).toBe('[4,101]');
    await wrapper.get('[data-test="nav-fav"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('favorites');
    expect(wrapper.get('[data-test="nav-fav"]').classes()).toContain('on');
    const whys = wrapper.get('[data-test="fav-list"]').findAll('[data-test="row-why"]').map((w) => w.text());
    expect(whys).toEqual(['不符合：每人每月收入需在 24,293 元以下', '不符合：需具懷孕或 60 天內分娩身分']);
    // 取消收藏
    await wrapper.get('[data-test="fav-list"] [data-test="fav-4"]').trigger('click');
    expect(localStorage.getItem(FAVORITES_KEY)).toBe('[101]');
    expect(wrapper.get('[data-test="toast"]').text()).toBe('已從我的珍藏移除');
  });

  it('[SUBS-R28] 重新進入服務收藏還在；沒送出時寫尚未比對，點列開彈窗判定為尚未比對', async () => {
    localStorage.setItem(FAVORITES_KEY, '[4,101]');
    const { wrapper } = await mountApp(fixtureWithMock, '/favorites');
    expect(wrapper.get('[data-test="fav-count"]').text()).toBe('2');
    const rows = wrapper.get('[data-test="fav-list"]').findAll('[data-test="row"]');
    expect(rows.map((r) => r.attributes('data-no'))).toEqual(['4', '101']);
    expect(rows[0]!.get('[data-test="row-why"]').text()).toBe('尚未比對，回首頁填完四題就會看到判定。');
    await rows[0]!.get('[data-test="row-main"]').trigger('click');
    await settle();
    expect(wrapper.get('[data-test="d-verdict"]').text()).toBe('尚未比對');
    expect(wrapper.get('[data-test="d-why"]').text()).toBe('尚未比對，回首頁填完四題就會看到判定。');
  });

  it('[W8] 我的珍藏空狀態：回首頁查詢', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock, '/favorites');
    expect(wrapper.get('[data-test="fav-empty"]').text()).toContain('還沒有收藏的補助');
    await wrapper.get('[data-test="fav-go-home"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
  });
});

describe('搜尋與頭像（W12、W13）', () => {
  it('[SUBS-R25] 結果頁搜尋「補助」：輪播只剩名稱含補助的項目、計數不變；關閉搜尋恢復；首頁沒有搜尋鈕', async () => {
    const { wrapper, router, q } = await mountApp(fixtureWithMock);
    expect(wrapper.find('[data-test="btn-search"]').exists()).toBe(false);
    await answerAll(wrapper, PREG);
    await wrapper.get('[data-test="btn-search"]').trigger('click');
    await settle();
    await wrapper.get('[data-test="search-input"]').setValue('補助');
    await settle();
    expect(bigNos(wrapper)).toEqual([7, 8, 9]);
    expect(wrapper.get('[data-test="count-yes"]').text()).toBe('7');
    expect(wrapper.get('[data-test="search-note"]').text()).toBe('名稱含「補助」：7 項');
    await wrapper.get('[data-test="search-close"]').trigger('click');
    await settle();
    expect(q.searchQuery.value).toBe('');
    expect(bigNos(wrapper)).toHaveLength(7);
    // 離開頁面清空
    await wrapper.get('[data-test="btn-search"]').trigger('click');
    await wrapper.get('[data-test="search-input"]').setValue('醫療');
    await router.push('/source');
    await settle();
    expect(q.searchQuery.value).toBe('');
    expect(wrapper.find('[data-test="search-bar"]').exists()).toBe(false);
  });

  it('[SUBS-R25] 我的珍藏搜尋只改顯示', async () => {
    localStorage.setItem(FAVORITES_KEY, '[4,9,101]');
    const { wrapper } = await mountApp(fixtureWithMock, '/favorites');
    await wrapper.get('[data-test="btn-search"]').trigger('click');
    await wrapper.get('[data-test="search-input"]').setValue('補助');
    await settle();
    const nos = wrapper.get('[data-test="fav-list"]').findAll('[data-test="row"]').map((r) => r.attributes('data-no'));
    expect(nos).toEqual(['9']);
    expect(wrapper.get('[data-test="fav-search-note"]').text()).toBe('名稱含「補助」：1 項');
    expect(wrapper.get('[data-test="fav-count"]').text()).toBe('3');
    await wrapper.get('[data-test="search-input"]').setValue('不存在');
    await settle();
    expect(wrapper.get('[data-test="fav-search-empty"]').text()).toBe('沒有名稱符合搜尋的收藏');
  });

  it('[W13] 在我的珍藏按頭像回首頁表單，搜尋鈕隱藏', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock, '/favorites');
    expect(wrapper.find('[data-test="btn-search"]').exists()).toBe(true);
    await wrapper.get('[data-test="btn-avatar"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(wrapper.find('[data-test="btn-search"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="card-age"]').exists()).toBe(true);
  });
});
