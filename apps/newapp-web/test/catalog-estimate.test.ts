import fixtureFull from './fixtures/subsidy-list-full.json';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubsidyListSchema, type SubsidyItem, type SubsidyList } from '@app/shared';
import { DEMO_SCENARIOS } from '@/lib/answers';
import { ESTIMATE_RULES, estimateFor, formatRange } from '@/lib/estimate';
import { groupResults, isCompleted, kindRank, type CompletedAnswers } from '@/lib/match';
import { cardKey, cardSummary, categoryText, statusText } from '@/components/result/cardText';
import { hasArt } from '@/lib/illustrations';
import { mountApp, settle } from './helpers/mountApp';

/** 後端的官方原文 JSON（估算規則的數字必須逐字出現在這些原文裡） */
const readApiJson = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve(__dirname, '../../newapp-api/src/data', name), 'utf8')) as T;
const curatedJson = readApiJson<{ items: Array<{ no: number; name: string; benefitText: string | null }> }>(
  'curated-subsidies.json',
);
const openBenefitJson = readApiJson<{ items: Array<{ no: number; name: string; benefitText: string | null }> }>(
  'open-benefit-text.json',
);
const catalogEnrichedJson = readApiJson<{ items: Array<{ no: number; name: string; benefitText: string | null }> }>(
  'catalog-enriched.json',
);

/** 28 項完整清單後面接 3 項台北服務通（格式照後端 catalogItem） */
const catalogItem = (no: number, name: string): SubsidyItem => ({
  no,
  kind: 'catalog',
  name,
  ageMin: null,
  ageMax: null,
  residency: false,
  identities: [],
  appliesForStatus: false,
  incomeMax: null,
  toVerify: ['資格條件：未依四題比對，請到台北服務通案件頁確認年齡、設籍、身分與收入等條件', '申辦方式：全程式（案件類別：社政類）'],
  documents: [],
  office: '社會局',
  contact: '請見台北服務通案件頁',
  url: `https://service.taipei/case-detail/AI0${no - 290}`,
  benefitText: null,
  sourceUrl: 'https://data.gov.tw/dataset/157468',
  verifiedAt: '2026-11-08',
});
const base = SubsidyListSchema.parse(fixtureFull);
const withCatalog: SubsidyList = SubsidyListSchema.parse({
  ...base,
  items: [...base.items, catalogItem(301, '發展遲緩兒童早期療育補助'), catalogItem(302, '臨時看護補助'), catalogItem(303, '老人收容安置補助')],
  sources: [
    ...base.sources,
    { kind: 'catalog', label: '台北服務通', description: '台北服務通說明', count: 3, verifiedAt: '2026-11-08' },
  ],
});
const demo = (i: number): CompletedAnswers => {
  const a = DEMO_SCENARIOS[i]!.answers;
  if (!isCompleted(a)) throw new Error('示範情境沒填完');
  return a;
};

describe('[SUBS-R75] 台北服務通不比對', () => {
  it('不進可能符合、不符合兩組，另放 catalog；兩組數量不變', () => {
    for (let i = 0; i < DEMO_SCENARIOS.length; i++) {
      const g = groupResults(withCatalog.items, demo(i));
      const g28 = groupResults(base.items, demo(i));
      expect(g.eligible.map((r) => r.item.no)).toEqual(g28.eligible.map((r) => r.item.no));
      expect(g.ineligible.map((r) => r.item.no)).toEqual(g28.ineligible.map((r) => r.item.no));
      expect(g.catalog.map((it) => it.no)).toEqual([301, 302, 303]);
    }
  });

  it('排序級別最後；卡片不寫「不限」，標籤寫台北服務通；有插畫', () => {
    const it301 = withCatalog.items.find((i) => i.no === 301)!;
    expect(kindRank(it301)).toBe(2);
    expect(statusText({ item: it301, result: null })).toBe('台北服務通');
    expect(categoryText(301, 'catalog')).toBe('申辦服務');
    expect(cardKey({ item: it301, result: null })).toEqual({ label: '資格與金額', value: '見官方案件頁', benefit: false });
    expect(cardSummary({ item: it301, result: null })).toBe('未依四題比對 · 資格請見官方案件頁');
    expect(hasArt(301)).toBe(true);
  });
});

describe('[SUBS-R76] 估算可領金額', () => {
  it('每條規則的數字都逐字出現在官方原文，名稱與序號一致', () => {
    const texts = new Map(
      [...openBenefitJson.items, ...curatedJson.items, ...catalogEnrichedJson.items].map((i) => [
        i.no,
        { name: i.name, text: i.benefitText },
      ]),
    );
    for (const r of ESTIMATE_RULES) {
      const src = texts.get(r.no);
      expect(src, `序號 ${r.no}`).toBeDefined();
      expect(src!.name).toBe(r.name);
      expect(src!.text, `序號 ${r.no} 沒有原文`).not.toBeNull();
      for (const f of r.figures) expect(src!.text, `序號 ${r.no} 原文沒有「${f}」`).toContain(f);
      expect(r.unitMin).toBeLessThanOrEqual(r.unitMax);
      expect(r.timesMin).toBeLessThanOrEqual(r.timesMax);
    }
  });

  it('示範情境 1（65+、無特殊身分）：只加總中低收入老人生活津貼與健保自付額補助', () => {
    const g = groupResults(withCatalog.items, demo(0));
    const e = estimateFor(g.eligible, demo(0).identities);
    expect(e.lines.map((l) => [l.no, l.min, l.max])).toEqual([
      [6, 27_480, 99_948],
      [212, 9_912, 9_912],
    ]);
    expect([e.totalMin, e.totalMax]).toEqual([37_392, 109_860]);
    // 核心資格四題沒問到的原住民租屋、生育、育兒、托育不加總
    expect(e.noCondition.map((n) => n.name)).toEqual(['都市原住民家庭租屋補貼', '臺北市生育補助', '育有未滿 2 歲兒童育兒津貼', '公共化／準公共托育補助與臺北市友善托育補助']);
    expect(e.noAmount).toEqual(['市民醫療補助', '300 億元中央擴大租金補貼', '臺北幸福租—民間租屋租金加碼補貼', '就業保險失業給付', '特殊境遇家庭扶助', '臺北市兒童醫療補助']);
  });

  it('示範情境 3（懷孕、中低收入戶）：勾了懷孕，營養品、生育補助、臺北市生育補助、孕婦乘車計入', () => {
    const g = groupResults(withCatalog.items, demo(2));
    const e = estimateFor(g.eligible, demo(2).identities);
    expect(e.lines.map((l) => [l.no, l.min, l.max])).toEqual([
      [7, 1_000, 6_000],
      [8, 33_000, 33_000],
      [206, 40_000, 50_000],
      [214, 10_000, 10_000],
    ]);
    expect([e.totalMin, e.totalMax]).toEqual([84_000, 99_000]);
    expect(e.noCondition.map((n) => n.name)).toEqual(['都市原住民家庭租屋補貼', '育有未滿 2 歲兒童育兒津貼', '公共化／準公共托育補助與臺北市友善托育補助', '中低收入老人特別照顧津貼']);
    // 沒勾懷孕就不算
    expect(estimateFor(g.eligible, ['mid']).lines.map((l) => l.no)).toEqual([214]);
  });

  it('示範情境 2（40-64、身心障礙者）：只加總身心障礙者生活補助', () => {
    const g = groupResults(withCatalog.items, demo(1));
    const e = estimateFor(g.eligible, demo(1).identities);
    expect(e.lines.map((l) => l.no)).toEqual([5]);
    expect([e.totalMin, e.totalMax]).toEqual([48_588, 113_820]);
  });

  it('模擬資料與台北服務通不算、也不列未計入；名稱對不上的規則不套用', () => {
    const g = groupResults(withCatalog.items, demo(2));
    const e = estimateFor(g.eligible, demo(2).identities);
    const counted = [...e.lines.map((l) => l.name), ...e.noAmount, ...e.noCondition.map((n) => n.name)];
    expect(counted.some((n) => ['新生兒育兒津貼', '青年租屋補貼', '青年職涯探索補助'].includes(n))).toBe(false);
    const renamed = { ...base.items.find((i) => i.no === 6)!, name: '改名後的津貼' };
    expect(estimateFor([{ item: renamed }]).noAmount).toEqual(['改名後的津貼']);
  });

  it('金額格式', () => {
    expect(formatRange(9_912, 9_912)).toBe('NT$9,912');
    expect(formatRange(37_392, 109_860)).toBe('NT$37,392～109,860');
  });
});

describe('[ADR-036] 畫面', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('結果頁：估算區標「估算」並附算法、明細可展開；台北服務通摺疊展開才畫卡片', async () => {
    const { wrapper, q, router } = await mountApp(withCatalog);
    q.applyDemo(0);
    await router.push('/result');
    await settle();
    const est = wrapper.get('[data-test="estimate"]');
    expect(est.get('[data-test="estimate-tag"]').text()).toBe('估算');
    expect(est.get('[data-test="estimate-total"]').text()).toBe('一年合計約 NT$37,392～109,860');
    expect(est.get('[data-test="estimate-method"]').text()).toContain('月額 × 12');
    expect(est.get('[data-test="estimate-method"]').text()).toContain('實際以主管機關核定為準');
    expect(est.get('[data-test="estimate-uncounted"]').text()).toContain('另有 10 項未計入');
    expect(est.findAll('[data-test="estimate-line"]')).toHaveLength(2);
    // 可能符合清單不含台北服務通
    expect(wrapper.findAll('[data-test="list-yes"] [data-kind="catalog"]')).toHaveLength(0);
    const fold = wrapper.get('[data-test="fold-catalog"]');
    expect(fold.get('[data-test="fold-catalog-summary"]').text()).toBe('台北服務通其他服務 3 項（未依四題比對）');
    expect(fold.find('[data-test="list-catalog"]').exists()).toBe(false);
    (fold.element as HTMLDetailsElement).open = true;
    await fold.trigger('toggle');
    expect(fold.findAll('[data-test="list-catalog"] [data-test="list-card"]')).toHaveLength(3);
  });

  it('全部補助：多一顆「台北服務通」膠囊，只列台北服務通', async () => {
    const { wrapper } = await mountApp(withCatalog, '/all');
    expect(wrapper.get('[data-test="all-title"]').text()).toBe('全部 31 項補助');
    await wrapper.get('[data-test="cat-catalog"]').trigger('click');
    const cards = wrapper.findAll('[data-test="list-card"]');
    expect(cards.map((c) => c.attributes('data-no'))).toEqual(['301', '302', '303']);
  });

  it('資料來源頁列出台北服務通資料集與下載日', async () => {
    const { wrapper } = await mountApp(withCatalog, '/source');
    expect(wrapper.get('[data-test="src-type-catalog"]').text()).toBe('台北服務通 · 3 項');
    expect(wrapper.get('[data-test="src-catalog-table"]').text()).toContain('臺北市政府台北服務通申辦服務及承辦單位資訊');
    expect(wrapper.get('[data-test="src-catalog-url"]').attributes('href')).toBe('https://data.gov.tw/dataset/157468');
    expect(wrapper.get('[data-test="src-catalog-date"]').text()).toBe('2026-11-08');
  });
});

describe('[ADR-036] 詳情彈窗（台北服務通）', () => {
  let wrapper: VueWrapper | null = null;
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.unstubAllGlobals();
  });

  it('判定寫未依四題比對、摘要寫見案件頁、次鈕連到資料集 157468、主鈕連到案件頁', async () => {
    window.history.replaceState(null, '', '/');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(withCatalog)));
    vi.resetModules();
    const { useQuery } = await import('@/composables/useQuery');
    const { useDetail } = await import('@/composables/useDetail');
    const DetailDialog = (await import('@/components/DetailDialog.vue')).default;
    await useQuery().loadList();
    useQuery().applyDemo(0);
    wrapper = mount(DetailDialog, { attachTo: document.body });
    useDetail().open(301);
    await flushPromises();
    const w = wrapper;
    expect(w.get('[data-test="d-tags"]').text()).toContain('台北服務通 · 開放資料');
    expect(w.get('[data-test="d-verdict"]').text()).toBe('未依四題比對');
    expect(w.get('[data-test="d-sum"]').text()).toContain('見案件頁');
    expect(w.get('[data-test="d-why"]').text()).toContain('未依四題比對');
    expect(w.get('[data-test="d-verified"]').text()).toBe('資料下載日 2026-11-08');
    expect(w.get('[data-test="d-source-note"]').text()).toContain('臺北市政府台北服務通申辦服務及承辦單位資訊');
    const sec = w.get('[data-test="d-dataset"]');
    expect(sec.text()).toBe('查看開放資料來源');
    expect(sec.attributes('href')).toBe('https://data.gov.tw/dataset/157468');
    expect(w.get('[data-test="d-apply"]').attributes('href')).toBe('https://service.taipei/case-detail/AI011');
    expect(w.find('[data-test="d-benefit"]').exists()).toBe(false);
  });
});
