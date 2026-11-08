import fixtureFull from './fixtures/subsidy-list-full.json';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubsidyListSchema, type SubsidyItem } from '@app/shared';
import { DEMO_SCENARIOS } from '@/lib/answers';
import { groupResults, isCompleted, matchItem, type CompletedAnswers } from '@/lib/match';
import { benefitBrief, sortEligible, statusText } from '@/components/result/cardText';
import { mountApp } from './helpers/mountApp';

/** 官方網頁整理 15 項（ADR-035）：28 項完整清單（開放 10 → 官方網頁整理 15 → 模擬 3） */
const list = SubsidyListSchema.parse(fixtureFull);
const item = (no: number): SubsidyItem => list.items.find((i) => i.no === no)!;
const demo = (i: number): CompletedAnswers => {
  const a = DEMO_SCENARIOS[i]!.answers;
  if (!isCompleted(a)) throw new Error('示範情境沒填完');
  return a;
};

describe('[ADR-035] 比對與排序', () => {
  it('比對不看 kind：官方網頁整理照四題比對', () => {
    // 212 老人健保自付額補助要 elder：65+ 可能符合，40-64 不符合
    expect(matchItem(item(212), demo(0)).ok).toBe(true);
    expect(matchItem(item(212), demo(1)).failures).toEqual(['需具65 歲以上身分']);
    // 203 低收入戶租金補貼要低收入戶：中低收入戶不符合
    expect(matchItem(item(203), demo(2)).ok).toBe(false);
    // 214 好孕 2U 要懷孕
    expect(matchItem(item(214), demo(2)).ok).toBe(true);
  });

  it('[SUBS-R18] 分組排序：開放資料與官方網頁整理同一級依序號，模擬資料排後', () => {
    const g = groupResults(list.items, demo(2));
    const kinds = g.eligible.map((r) => r.item.kind);
    expect(kinds.lastIndexOf('curated')).toBeLessThan(kinds.indexOf('mock'));
    const real = g.eligible.filter((r) => r.item.kind !== 'mock').map((r) => r.item.no);
    expect(real).toEqual([...real].sort((x, y) => x - y));
    const sorted = sortEligible(g.eligible).map((r) => r.item.kind);
    expect(sorted.lastIndexOf('curated')).toBeLessThan(sorted.indexOf('mock'));
  });

  it('示範情境三組的可能符合數（28 項）：12、14、19', () => {
    const counts = DEMO_SCENARIOS.map((_, i) => groupResults(list.items, demo(i)).eligible.map((r) => r.item.no));
    expect(counts.map((c) => c.length)).toEqual([12, 14, 19]);
    expect(counts).toEqual([
      [6, 9, 201, 202, 205, 206, 207, 208, 209, 210, 212, 213],
      [5, 201, 202, 204, 205, 206, 207, 208, 209, 210, 211, 213, 215, 102],
      [4, 7, 8, 9, 10, 201, 202, 205, 206, 207, 208, 209, 210, 213, 214, 215, 101, 102, 103],
    ]);
  });

  it('標籤 2：官方網頁整理寫「官方網頁整理 · 可能符合」，沒作答只寫資料類型', () => {
    const ok = matchItem(item(212), demo(0));
    expect(statusText({ item: item(212), result: ok })).toBe('官方網頁整理 · 可能符合');
    expect(statusText({ item: item(212), result: matchItem(item(212), demo(1)) })).toBe('不符合');
    expect(statusText({ item: item(212), result: null })).toBe('官方網頁整理');
  });
});

describe('卡片實際補助精簡版', () => {
  it('短的原樣顯示；長的依字寬截斷加…，去掉截點前的標點', () => {
    expect(benefitBrief('每人每月 6,825 元')).toBe('每人每月 6,825 元');
    expect(benefitBrief('每人每次補助 1,000 元，每兩個月以申請一次為限。')).toBe('每人每次補助 1,000 元，每兩個…');
    expect(benefitBrief('一二三四五六七八九十一二三四五六七八九十')).toBe('一二三四五六七八九十一二三四五…');
    expect(benefitBrief('一二三四五六七八九十一二三四，五六七八九十')).toBe('一二三四五六七八九十一二三四…');
  });
});

describe('[ADR-035] 畫面', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('首頁大卡：N 只算開放資料，另一行小字寫官方網頁整理項數', async () => {
    const { wrapper } = await mountApp(fixtureFull);
    expect(wrapper.get('[data-test="big-count"]').text()).toBe('10 項補助');
    expect(wrapper.get('[data-test="alert-pill"]').text()).toBe('⚠️ 臺北市 10 項社會救助補助');
    expect(wrapper.get('[data-test="curated-count"]').text()).toBe('另含 15 項官方網頁整理的補助');
  });

  it('全部補助 28 項；官方網頁整理卡片右側顯示實際補助，標籤寫官方網頁整理', async () => {
    const { wrapper } = await mountApp(fixtureFull, '/all');
    expect(wrapper.get('[data-test="all-title"]').text()).toBe('全部 28 項補助');
    const cards = wrapper.findAll('[data-test="list-card"]');
    expect(cards).toHaveLength(28);
    expect(cards.map((c) => c.attributes('data-kind')).lastIndexOf('curated')).toBeLessThan(
      cards.map((c) => c.attributes('data-kind')).indexOf('mock'),
    );
    const c206 = wrapper.get('[data-test="list-card"][data-no="206"]');
    expect(c206.get('[data-test="tag-status"]').text()).toBe('官方網頁整理');
    expect(c206.get('[data-test="tag-cat"]').text()).toBe('育兒生育');
    expect(c206.get('[data-test="card-key-label"]').text()).toBe('實際補助');
    expect(c206.get('[data-test="card-key-value"]').text().replace(/\u00a0/g, ' ')).toBe(benefitBrief(item(206).benefitText!));
    // 201 查不到金額：照舊顯示關鍵條件
    const c201 = wrapper.get('[data-test="list-card"][data-no="201"]');
    expect(c201.get('[data-test="card-key-label"]').text()).toBe('每人月收入上限');
  });

  it('資料來源頁列出三種來源；官方網頁整理逐項列名稱、來源網址與查證日', async () => {
    const { wrapper } = await mountApp(fixtureFull, '/source');
    expect(wrapper.get('[data-test="src-type-open"]').text()).toContain('開放資料');
    expect(wrapper.get('[data-test="src-type-curated"]').text()).toBe('官方網頁整理 · 15 項');
    expect(wrapper.get('[data-test="src-type-mock"]').text()).toBe('模擬資料 · 3 項');
    const rows = wrapper.findAll('[data-test="src-curated-item"]');
    expect(rows).toHaveLength(15);
    expect(rows[0]!.text()).toContain('300 億元中央擴大租金補貼');
    expect(rows[0]!.text()).toContain('udd.gov.taipei/collection/oo2cmrc');
    expect(rows[0]!.text()).toContain('查證日 2026-11-08');
    expect(wrapper.get('[data-test="src-mock"]').text()).toContain('新生兒育兒津貼、青年租屋補貼、青年職涯探索補助');
  });
});

describe('[ADR-035] 詳情彈窗', () => {
  let wrapper: VueWrapper | null = null;
  async function open(no: number) {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixtureFull)));
    vi.resetModules();
    const { useQuery } = await import('@/composables/useQuery');
    const { useDetail } = await import('@/composables/useDetail');
    const DetailDialog = (await import('@/components/DetailDialog.vue')).default;
    await useQuery().loadList();
    wrapper = mount(DetailDialog, { attachTo: document.body });
    useDetail().open(no);
    await flushPromises();
    return wrapper;
  }
  beforeEach(() => window.history.replaceState(null, '', '/'));
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.unstubAllGlobals();
  });

  it('官方網頁整理：膠囊、實際補助全文、資料來源列、次鈕「查看官方來源」連到 sourceUrl', async () => {
    const w = await open(206);
    const it206 = item(206);
    expect(w.get('[data-test="d-tags"]').text()).toContain('官方網頁整理');
    expect(w.get('[data-test="d-benefit-text"]').text()).toBe(it206.benefitText);
    expect(w.get('[data-test="d-source-url"]').attributes('href')).toBe(it206.sourceUrl);
    expect(w.get('[data-test="d-verified"]').text()).toBe('查證日 2026-11-08');
    expect(w.get('[data-test="d-source-note"]').text()).toContain('門檻年度依來源頁');
    const sec = w.get('[data-test="d-dataset"]');
    expect(sec.text()).toBe('查看官方來源');
    expect(sec.attributes('href')).toBe(it206.sourceUrl);
    expect(w.get('[data-test="d-notice"]').text()).toContain('門檻以主管機關最新公告為準');
    expect(w.find('[data-test="d-apply"]').attributes('href')).toBe(it206.url);
  });

  it('開放資料：有原文也顯示實際補助與資料來源，次鈕仍是查看開放資料來源', async () => {
    const w = await open(2);
    expect(w.get('[data-test="d-tags"]').text()).toContain('開放資料 · 臺北市社會局');
    expect(w.get('[data-test="d-benefit-text"]').text()).toContain('6,825 元');
    expect(w.get('[data-test="d-source-note"]').text()).toContain('收入門檻為資料集原值');
    const sec = w.get('[data-test="d-dataset"]');
    expect(sec.text()).toBe('查看開放資料來源');
    expect(sec.attributes('href')).toBe('https://data.gov.tw/dataset/129839');
  });

  it('沒有原文（序號 4、模擬資料）不顯示實際補助與資料來源列', async () => {
    for (const no of [4, 101]) {
      const w = await open(no);
      expect(w.find('[data-test="d-benefit"]').exists()).toBe(false);
      expect(w.find('[data-test="d-source"]').exists()).toBe(false);
      wrapper?.unmount();
      wrapper = null;
    }
  });
});
