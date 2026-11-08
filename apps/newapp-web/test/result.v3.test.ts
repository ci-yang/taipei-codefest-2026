import fixture from './fixtures/subsidy-list-with-mock.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { Component } from 'vue';
import type { SubsidyItem } from '@app/shared';
import type { UseQuery } from '@/composables/useQuery';
import type { MatchResult } from '@/lib/match';
import { cardKey, cardSummary, sortEligible, statusText } from '@/components/result/cardText';

const FAVORITES_KEY = 'newapp.favorites';
const Stub = { template: '<div />' };
const mounted: VueWrapper[] = [];

interface Setup {
  /** 示範情境序號；null＝不作答 */
  demo?: number | null;
  /** 自訂答案（會送出） */
  answers?: { band: string; residency: boolean; identities: string[]; income: number };
}

/** 每案重新載入模組（useQuery、useFavorites、useDetail 是模組層級狀態），掛單一頁面與記憶體路由 */
async function mountPage(page: 'ResultPage' | 'AllSubsidiesPage' | 'FavoritesPage', path: string, setup: Setup = {}) {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixture)));
  vi.resetModules();
  const { useQuery } = await import('@/composables/useQuery');
  const { useDetail } = await import('@/composables/useDetail');
  const q: UseQuery = useQuery();
  await q.loadList();
  if (setup.demo != null) q.applyDemo(setup.demo);
  if (setup.answers) {
    const a = setup.answers;
    q.setAgeBand(a.band as never);
    q.setResidency(a.residency);
    for (const id of a.identities) q.toggleIdentity(id as never);
    q.setIncomeBracket(a.income as never);
    q.submit();
  }
  const comp = ((await import(`@/pages/${page}.vue`)) as { default: Component }).default;
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      { path: '/calc', name: 'calc', component: Stub },
      { path: '/source', name: 'source', component: Stub },
      { path: '/result', name: 'result', component: comp },
      { path: '/all', name: 'all', component: comp },
      { path: '/favorites', name: 'favorites', component: comp },
    ],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(comp, { global: { plugins: [router] }, attachTo: document.body });
  mounted.push(wrapper);
  await flushPromises();
  return { wrapper, router, q, detail: useDetail() };
}

const cardNos = (w: VueWrapper, sel = '') =>
  w.findAll(`${sel} [data-test="list-card"]`).map((c) => Number(c.attributes('data-no')));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('結果頁（19.png）', () => {
  it('膠囊顯示可能符合數，大標與你的答案、修改答案連到 /calc', async () => {
    const { wrapper, q } = await mountPage('ResultPage', '/result', { demo: 0 });
    const n = q.results.value!.eligible.length;
    expect(n).toBeGreaterThan(0);
    expect(wrapper.get('[data-test="found-pill"]').text()).toBe(`一共找到了 ${n} 項合適計畫`);
    expect(wrapper.text()).toContain('為你量身試算的專屬補助方案');
    expect(wrapper.get('[data-test="answer-summary"]').text()).toContain('65歲以上');
    expect(wrapper.get('[data-test="btn-edit"]').attributes('href')).toBe('/calc');
    expect(wrapper.get('[data-test="result-notice"]').text()).toBe('這是初步篩選，門檻以社會局最新公告為準');
    expect(wrapper.get('[data-test="result-updated"]').text()).toBe('資料每 24 小時自政府資料開放平臺更新・最後更新 2024-12-19');
    expect(wrapper.find('[data-test="carousel"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="kind-all"]').exists()).toBe(false);
  });

  it('可能符合依「開放資料在前、還需確認少的在前」排，不符合摺疊在最後', async () => {
    const { wrapper, q } = await mountPage('ResultPage', '/result', { demo: 0 });
    const expected = sortEligible(q.results.value!.eligible).map((r) => r.item.no);
    expect(cardNos(wrapper, '[data-test="list-yes"]')).toEqual(expected);
    const fold = wrapper.get('[data-test="fold-no"]');
    expect((fold.element as HTMLDetailsElement).open).toBe(false);
    expect(wrapper.get('[data-test="fold-no-summary"]').text()).toBe(`不符合的 ${q.results.value!.ineligible.length} 項`);
    expect(cardNos(wrapper, '[data-test="list-no"]')).toEqual(q.results.value!.ineligible.map((r) => r.item.no));
    expect(fold.findAll('[data-test="tag-status"]').every((t) => t.text().includes('不符合'))).toBe(true);
  });

  it('申辦詳情開詳細資訊彈窗（useDetail）', async () => {
    const { wrapper, q, detail } = await mountPage('ResultPage', '/result', { demo: 0 });
    const no = sortEligible(q.results.value!.eligible)[0]!.item.no;
    await wrapper.get(`[data-test="list-card"][data-no="${no}"] [data-test="card-detail"]`).trigger('click');
    expect(detail.openNo.value).toBe(no);
  });

  it('[SUBS-R19] 沒有任何符合：最接近 3 項與社會福利服務中心', async () => {
    const { wrapper } = await mountPage('ResultPage', '/result', {
      answers: { band: '40-64', residency: false, identities: ['none'], income: 5 },
    });
    expect(wrapper.get('[data-test="found-pill"]').text()).toBe('一共找到了 0 項合適計畫');
    expect(wrapper.get('[data-test="no-match-closest"]').findAll('li')).toHaveLength(3);
    expect(wrapper.get('[data-test="no-match-center"]').text()).toBe('臺北市各區社會福利服務中心');
  });

  it('未完成狀態直接進 /result 導回 /calc', async () => {
    const { router } = await mountPage('ResultPage', '/result');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/calc');
  });
});

describe('清單卡片', () => {
  const base: SubsidyItem = fixture.items.find((x) => x.no === 9) as SubsidyItem;
  const ok: MatchResult = { no: 9, ok: true, reason: '年齡、設籍、身分、收入都在條件內', failures: [], toVerify: ['a', 'b'] };
  const fail: MatchResult = { no: 9, ok: false, reason: '需設籍臺北市', failures: ['需設籍臺北市', '收入可能超過上限'], toVerify: [] };

  it('右側顯示關鍵條件；不符合改顯示第一個不符合原因', () => {
    expect(cardKey({ item: base, result: ok })).toEqual({ label: '每人月收入上限', value: '28,550 元' });
    expect(cardKey({ item: base, result: fail })).toEqual({ label: '不符合原因', value: '需設籍臺北市' });
  });

  it('狀態標籤與底列摘要', () => {
    expect(statusText({ item: base, result: ok })).toBe('開放資料 · 可能符合');
    expect(statusText({ item: base, result: fail })).toBe('不符合');
    expect(statusText({ item: base, result: null })).toBe('開放資料');
    expect(statusText({ item: { ...base, kind: 'mock' }, result: ok })).toBe('模擬資料');
    expect(cardSummary({ item: { ...base, residency: true }, result: ok })).toBe('需設籍臺北市 · 另有 2 項要再確認');
    expect(cardSummary({ item: base, result: fail })).toBe('另有 1 項不符合');
  });

  it('排序：開放資料在前，還需確認少的在前，同數依序號', () => {
    const mk = (no: number, kind: 'open' | 'mock', n: number) => ({
      item: { ...base, no, kind },
      result: { ...ok, no, toVerify: Array.from({ length: n }, () => 'x') },
    });
    const rows = [mk(101, 'mock', 0), mk(5, 'open', 2), mk(9, 'open', 0), mk(1, 'open', 2)];
    expect(sortEligible(rows).map((r) => r.item.no)).toEqual([9, 1, 5, 101]);
  });

  it('卡片右側在畫面上顯示條件', async () => {
    const { wrapper } = await mountPage('AllSubsidiesPage', '/all');
    const card = wrapper.get('[data-test="list-card"][data-no="9"]');
    expect(card.get('[data-test="card-key-label"]').text()).toBe('每人月收入上限');
    expect(card.get('[data-test="card-key-value"]').text()).toBe('28,550 元');
    expect(card.get('[data-test="tag-cat"]').text()).toBe('醫療補助');
    expect(card.get('[data-test="tag-status"]').text()).toBe('開放資料');
  });

  it('書籤切換只存序號陣列', async () => {
    const { wrapper } = await mountPage('AllSubsidiesPage', '/all');
    await wrapper.get('[data-test="fav-9"]').trigger('click');
    await wrapper.get('[data-test="fav-102"]').trigger('click');
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY)!)).toEqual([9, 102]);
    expect(wrapper.get('[data-test="fav-9"]').attributes('aria-pressed')).toBe('true');
    await wrapper.get('[data-test="fav-9"]').trigger('click');
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY)!)).toEqual([102]);
    expect(Object.keys(localStorage).filter((k) => k !== 'newapp.subsidyList')).toEqual([FAVORITES_KEY]);
  });
});

describe('全部補助', () => {
  it('不用作答即可看全部，分類膠囊篩選', async () => {
    const { wrapper } = await mountPage('AllSubsidiesPage', '/all');
    expect(wrapper.get('[data-test="all-title"]').text()).toBe('全部 13 項補助');
    expect(cardNos(wrapper)).toHaveLength(13);
    await wrapper.get('[data-test="cat-family"]').trigger('click');
    expect(cardNos(wrapper)).toEqual([7, 8, 101]);
    expect(wrapper.get('[data-test="cat-family"]').attributes('aria-pressed')).toBe('true');
    await wrapper.get('[data-test="cat-housing-job"]').trigger('click');
    expect(cardNos(wrapper)).toEqual([102, 103]);
    expect(wrapper.findAll('[data-test="tag-status"]').map((t) => t.text())).toEqual(['模擬資料', '模擬資料']);
    await wrapper.get('[data-test="cat-all"]').trigger('click');
    expect(cardNos(wrapper)).toHaveLength(13);
  });
});

describe('我的珍藏', () => {
  it('空狀態：回首頁查詢', async () => {
    const { wrapper } = await mountPage('FavoritesPage', '/favorites');
    expect(wrapper.get('[data-test="fav-empty"]').text()).toContain('還沒有收藏的補助');
    expect(wrapper.get('[data-test="fav-go-home"]').text()).toBe('回首頁查詢');
    expect(wrapper.get('[data-test="fav-go-home"]').attributes('href')).toBe('/');
  });

  it('有收藏時用同一種卡片，作答後帶判定', async () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([9, 999]));
    const { wrapper } = await mountPage('FavoritesPage', '/favorites', { demo: 0 });
    expect(cardNos(wrapper)).toEqual([9]);
    expect(wrapper.get('[data-test="tag-status"]').text()).toBe('開放資料 · 可能符合');
  });
});
