import fixture from './fixtures/subsidy-list.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { answerAll, fillForm, mountApp, settle } from './helpers/mountApp';

const AGE70 = { band: '65+', residency: true, identities: ['none'], income: 3 };
const selBand = (w: Awaited<ReturnType<typeof mountApp>>['wrapper']) =>
  w.findAll('[data-test^="band-"]').filter((b) => b.classes().includes('on')).map((b) => b.attributes('data-test'));

let scrolled: Element[] = [];

describe('首頁表單（S1 補助通改版）', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    scrolled = [];
    // jsdom 沒有 scrollIntoView；記下捲到哪張卡
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    } as typeof Element.prototype.scrollIntoView;
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('[SUBS-R10][SUBS-R70] 進入服務取一次清單，不帶參數；一頁四張題卡與送出鈕；頂列是補助通', async () => {
    const { wrapper, fetchMock } = await mountApp(fixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/subsidies');
    expect(fetchMock.mock.calls[0]![1]?.body).toBeUndefined();
    expect(wrapper.get('[data-test="app-title"]').text()).toBe('補助通 · 智能試算');
    for (const c of ['card-age', 'card-res', 'card-ids', 'card-br']) expect(wrapper.find(`[data-test="${c}"]`).exists()).toBe(true);
    expect(wrapper.get('[data-test="btn-submit"]').text()).toBe('填寫資料，開始你的智能試算');
    expect(wrapper.get('[data-test="q-form"]').attributes('disabled')).toBeUndefined();
    // 首頁沒有首頁鍵與搜尋鈕，有頭像
    expect(wrapper.find('[data-test="btn-home"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="btn-search"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="btn-avatar"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('門檻以社會局最新公告為準');
  });

  it('[SUBS-R11] 四題填完送出：到結果頁（1 秒內）', async () => {
    const { wrapper, router } = await mountApp(fixture);
    const t0 = Date.now();
    await answerAll(wrapper, AGE70);
    expect(router.currentRoute.value.name).toBe('result');
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('[SUBS-R11] 年齡區間沒選按送出：停在首頁、年齡卡顯示「請選擇年齡區間」並捲到年齡卡', async () => {
    const { wrapper, router } = await mountApp(fixture);
    await fillForm(wrapper, { ...AGE70, band: null });
    await wrapper.get('[data-test="btn-submit"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(wrapper.get('[data-test="err-0"]').text()).toBe('請選擇年齡區間');
    expect(wrapper.get('[data-test="card-age"]').classes()).toContain('err');
    expect(scrolled[0]).toBe(wrapper.get('[data-test="card-age"]').element);
    expect(document.activeElement).toBe(wrapper.get('[data-test="band-u18"]').element);
    for (const i of [1, 2, 3]) expect(wrapper.find(`[data-test="err-${i}"]`).exists()).toBe(false);
    // 選了區間就清掉年齡錯誤
    await wrapper.get('[data-test="band-65+"]').trigger('click');
    expect(wrapper.find('[data-test="err-0"]').exists()).toBe(false);
  });

  it('[SUBS-R11] 戶籍、身分、收入沒選的訊息；捲到第一張有錯的卡；改該題時清掉該題錯誤', async () => {
    const { wrapper, router } = await mountApp(fixture);
    await fillForm(wrapper, { band: '30-44', residency: null, identities: [], income: null });
    await wrapper.get('[data-test="btn-submit"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(wrapper.find('[data-test="err-0"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="err-1"]').text()).toBe('請選擇戶籍縣市');
    expect(wrapper.get('[data-test="err-2"]').text()).toBe('請至少選一項，沒有就選以上皆無');
    expect(wrapper.get('[data-test="err-3"]').text()).toBe('請選一個級距，不確定就選不清楚');
    expect(scrolled[0]).toBe(wrapper.get('[data-test="card-res"]').element);
    await wrapper.get('[data-test="id-dis"]').trigger('click');
    expect(wrapper.find('[data-test="err-2"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="err-1"]').exists()).toBe(true);
  });

  it('[ADR-030] 年齡是五顆單選膠囊、一次只亮一顆，沒有實際歲數輸入框', async () => {
    const { wrapper, q } = await mountApp(fixture);
    const chips = wrapper.findAll('[data-test^="band-"]');
    expect(chips.map((c) => c.text())).toEqual(['18歲以下', '18-29歲', '30-44歲', '45-64歲', '65歲+']);
    expect(wrapper.get('[data-test="age-bands"]').attributes('role')).toBe('radiogroup');
    expect(wrapper.find('input[type="number"]').exists()).toBe(false);
    expect(selBand(wrapper)).toEqual([]);
    await wrapper.get('[data-test="band-18-29"]').trigger('click');
    expect(selBand(wrapper)).toEqual(['band-18-29']);
    await wrapper.get('[data-test="band-65+"]').trigger('click');
    expect(selBand(wrapper)).toEqual(['band-65+']);
    expect(wrapper.get('[data-test="band-65+"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.get('[data-test="band-18-29"]').attributes('aria-checked')).toBe('false');
    expect(q.answers.value.ageBand).toBe('65+');
  });

  it('[SUBS-R13][SUBS-R17] 18-29歲、設籍、低收入戶、17,005 元以下：交通補助列可能符合、年齡要再確認', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, { band: '18-29', residency: true, identities: ['low'], income: 1 });
    const row3 = wrapper.get('[data-test="list-yes"] [data-test="row"][data-no="3"]');
    expect(row3.get('[data-test="row-why"]').text()).toBe('其他條件都在範圍內，年齡要再確認');
    await row3.get('[data-test="row-main"]').trigger('click');
    await settle();
    expect(wrapper.get('[data-test="d-verify"]').text()).toContain('年齡：需 25 歲以下，你選的區間跨過門檻');
  });

  it('[SUBS-R12] 身分膠囊：以上皆無與其他互斥；收入滑桿與不清楚', async () => {
    const { wrapper, q } = await mountApp(fixture);
    await wrapper.get('[data-test="id-low"]').trigger('click');
    await wrapper.get('[data-test="id-none"]').trigger('click');
    expect(q.answers.value.identities).toEqual(['none']);
    expect(wrapper.get('[data-test="id-none"]').attributes('aria-pressed')).toBe('true');
    await wrapper.get('[data-test="in-br"]').setValue('4');
    expect(q.answers.value.incomeBracket).toBe(4);
    expect(wrapper.get('[data-test="br-hint"]').text()).toBe('28,551～33,252 元');
    await wrapper.get('[data-test="br-unknown"]').trigger('click');
    expect(q.answers.value.incomeBracket).toBe(0);
    expect(wrapper.get('[data-test="br-hint"]').text()).toBe('不清楚');
  });

  it('[SUBS-R26] 結果頁按修改答案回首頁表單；改任一題主按鈕變回送出，再送出結果更新', async () => {
    const { wrapper, router, q } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="btn-edit"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(wrapper.find('[data-test="btn-view-result"]').exists()).toBe(true);
    expect(selBand(wrapper)).toEqual(['band-65+']);
    await wrapper.get('[data-test="in-br"]').setValue('1');
    expect(wrapper.find('[data-test="btn-view-result"]').exists()).toBe(false);
    await wrapper.get('[data-test="btn-submit"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
    expect(q.results.value?.eligible.map((r) => r.item.no)).toEqual([1, 4, 6, 9, 10]);
  });

  it('[SUBS-R26][SUBS-R27] 首頁鍵回首頁答案保留：查看結果與上次比對找到 N 項；重新查詢留在首頁回未填', async () => {
    const { wrapper, router, q } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="btn-home"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(wrapper.get('[data-test="done-box"]').text()).toContain('上次比對找到 2 項可能符合');
    expect(wrapper.find('[data-test="btn-submit"]').exists()).toBe(false);
    await wrapper.get('[data-test="btn-view-result"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
    await wrapper.get('[data-test="btn-home"]').trigger('click');
    await settle();
    await wrapper.get('[data-test="btn-requery"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(q.answersState.value).toBe('empty');
    expect(wrapper.find('[data-test="btn-requery"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="done-box"]').exists()).toBe(false);
    expect(selBand(wrapper)).toEqual([]);
    expect(wrapper.get('[data-test="toast"]').text()).toBe('已清除填寫答案');
  });

  it('[SUBS-R26] 填寫中也有重新查詢，清掉各題錯誤', async () => {
    const { wrapper } = await mountApp(fixture);
    expect(wrapper.find('[data-test="btn-requery"]').exists()).toBe(false);
    await wrapper.get('[data-test="id-low"]').trigger('click');
    await wrapper.get('[data-test="btn-submit"]').trigger('click');
    await settle();
    expect(wrapper.find('[data-test="err-0"]').exists()).toBe(true);
    await wrapper.get('[data-test="btn-requery"]').trigger('click');
    await settle();
    expect(wrapper.find('[data-test="err-0"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="id-low"]').attributes('aria-pressed')).toBe('false');
  });

  it('[SUBS-R21][SUBS-R70] 填答到結果全程只有一次清單請求，沒有任何請求帶答案', async () => {
    const { wrapper, fetchMock } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="row-main"]').trigger('click');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/subsidies');
    expect(Object.keys(localStorage)).toEqual(['newapp.subsidyList']);
  });
});
