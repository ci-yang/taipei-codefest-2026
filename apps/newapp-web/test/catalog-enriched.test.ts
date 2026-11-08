import fixtureFull from './fixtures/subsidy-list-full.json';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubsidyListSchema, type SubsidyItem, type SubsidyList } from '@app/shared';
import { DEMO_SCENARIOS } from '@/lib/answers';
import { estimateFor } from '@/lib/estimate';
import { groupResults, isCompleted, isUnmatched, kindRank, type CompletedAnswers } from '@/lib/match';
import { cardKey, cardSummary, statusText } from '@/components/result/cardText';
import { mountApp, settle } from './helpers/mountApp';

/**
 * ADR-037（SUBS-R77）：台北服務通補好資格條件的項目照四題比對。
 * 補充原文直接讀後端 catalog-enriched.json，組法照後端 enrichedCatalogItem。
 */
type Enriched = Omit<SubsidyItem, 'kind' | 'office' | 'contact' | 'url' | 'enriched'> & { caseId: string };
const enrichedJson = JSON.parse(
  readFileSync(resolve(__dirname, '../../newapp-api/src/data/catalog-enriched.json'), 'utf8'),
) as { items: Enriched[] };
const enrichedOf = (no: number): SubsidyItem => {
  const { caseId, ...e } = enrichedJson.items.find((i) => i.no === no)!;
  return {
    ...e,
    kind: 'catalog',
    toVerify: [...e.toVerify, '申辦方式：全程式（案件類別：社政類）'],
    office: '社會局',
    contact: '請見台北服務通案件頁',
    url: `https://service.taipei/case-detail/${caseId}`,
    enriched: true,
  };
};
const plainCatalog: SubsidyItem = {
  no: 302,
  kind: 'catalog',
  name: '臺北市特殊教育學生獎補助',
  ageMin: null,
  ageMax: null,
  residency: false,
  identities: [],
  appliesForStatus: false,
  incomeMax: null,
  toVerify: ['資格條件：未依四題比對，請到台北服務通案件頁確認年齡、設籍、身分與收入等條件'],
  documents: [],
  office: '教育局',
  contact: '請見台北服務通案件頁',
  url: 'https://service.taipei/case-detail/AE026',
  benefitText: null,
  sourceUrl: 'https://data.gov.tw/dataset/157468',
  verifiedAt: '2026-11-08',
};
const base = SubsidyListSchema.parse(fixtureFull);
/** 304 假牙（55 歲以上＋低／中低）、308 停車位（身障）、314 臨時看護（低收或 65 歲以上）、332 凍卵（40 歲以下） */
const ENRICHED = [304, 308, 314, 332];
const list: SubsidyList = SubsidyListSchema.parse({
  ...base,
  items: [...base.items, plainCatalog, ...ENRICHED.map(enrichedOf)],
  sources: [...base.sources, { kind: 'catalog', label: '台北服務通', description: '說明', count: 5, verifiedAt: '2026-11-08' }],
});
const demo = (i: number): CompletedAnswers => {
  const a = DEMO_SCENARIOS[i]!.answers;
  if (!isCompleted(a)) throw new Error('示範情境沒填完');
  return a;
};
const rowOf = (g: ReturnType<typeof groupResults>, no: number) =>
  [...g.eligible, ...g.ineligible].find((r) => r.item.no === no);

describe('[SUBS-R77] 補好資格條件的台北服務通照四題比對', () => {
  it('補充檔每項都有序號、案件編號、原文來源與查證日，數字項有 benefitText 或為 null', () => {
    expect(enrichedJson.items.length).toBeGreaterThanOrEqual(20);
    for (const e of enrichedJson.items) {
      expect(e.no).toBeGreaterThanOrEqual(301);
      expect(e.caseId).toMatch(/^[A-Z]{2}\d{3}$/);
      expect(e.sourceUrl).toMatch(/^https:\/\//);
      expect(e.verifiedAt).toBe('2026-11-08');
      expect(e.toVerify.length).toBeGreaterThan(0);
    }
  });

  it('enriched 的不算未比對、排序級別與真實資料同級；沒補的照舊', () => {
    expect(isUnmatched(enrichedOf(304))).toBe(false);
    expect(kindRank(enrichedOf(304))).toBe(0);
    expect(isUnmatched(plainCatalog)).toBe(true);
    expect(kindRank(plainCatalog)).toBe(2);
  });

  it('示範情境 1（65+、無特殊身分）：臨時看護可能符合；假牙、停車位、凍卵不符合；摺疊區只剩沒補的', () => {
    const g = groupResults(list.items, demo(0));
    expect(g.catalog.map((i) => i.no)).toEqual([302]);
    expect(rowOf(g, 314)!.result.ok).toBe(true);
    expect(rowOf(g, 304)!.result.failures).toEqual(['需具低收入戶或中低收入戶身分']);
    expect(rowOf(g, 308)!.result.failures).toEqual(['需具身心障礙者身分']);
    expect(rowOf(g, 332)!.result.failures).toEqual(['需 40 歲以下']);
  });

  it('示範情境 2（40-64、身心障礙者）：停車位可能符合；凍卵 40 歲以下跨門檻列還需確認；假牙缺身分', () => {
    const g = groupResults(list.items, demo(1));
    expect(rowOf(g, 308)!.result.ok).toBe(true);
    expect(rowOf(g, 332)!.result.toVerify[0]).toBe('年齡：需 40 歲以下，你選的區間跨過門檻');
    expect(rowOf(g, 304)!.result.failures).toEqual(['需具低收入戶或中低收入戶身分']);
    expect(rowOf(g, 314)!.result.ok).toBe(false);
  });

  it('示範情境 3（30 歲、懷孕、中低收入戶）：凍卵年齡在內、可能符合；假牙年齡不到', () => {
    const g = groupResults(list.items, demo(2));
    const r332 = rowOf(g, 332)!;
    expect(r332.result.ok).toBe(true);
    expect(r332.result.toVerify[0]).toBe(enrichedOf(332).toVerify[0]);
    expect(rowOf(g, 304)!.result.failures).toEqual(['需 55 歲以上']);
  });

  it('卡片：狀態寫「台北服務通 · 可能符合」，右側顯示實際補助原文，底列照一般項目', () => {
    const g = groupResults(list.items, demo(1));
    const row = rowOf(g, 308)!;
    expect(statusText(row)).toBe('台北服務通 · 可能符合');
    expect(cardKey(row)).toEqual({ label: '實際補助', value: enrichedOf(308).benefitText, benefit: true });
    expect(cardSummary(row)).toBe(`需設籍臺北市 · 另有 ${row.result.toVerify.length} 項要再確認`);
  });

  it('估算：有規則但核心資格沒問到的列未計入（不加總）；沒有規則的列推不出金額', () => {
    const g = groupResults(list.items, demo(1));
    const e = estimateFor(g.eligible, demo(1).identities);
    expect(e.lines.map((l) => l.no)).toEqual([5]);
    expect(e.noCondition.map((n) => n.name)).toContain('身心障礙者承租停車位租金補助');
    const g0 = groupResults(list.items, demo(0));
    expect(estimateFor(g0.eligible, demo(0).identities).noAmount).toContain('臨時看護補助');
  });
});

describe('[ADR-037] 畫面', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('結果頁：補好的台北服務通進可能符合清單，摺疊區標題寫剩餘數量', async () => {
    const { wrapper, q, router } = await mountApp(list);
    q.applyDemo(1);
    await router.push('/result');
    await settle();
    const yes = wrapper.findAll('[data-test="list-yes"] [data-kind="catalog"]');
    expect(yes.map((c) => c.attributes('data-no'))).toEqual(['332', '308']);
    expect(wrapper.get('[data-test="fold-catalog-summary"]').text()).toBe('台北服務通其他服務 1 項（未依四題比對）');
  });
});

describe('[ADR-037] 詳情彈窗（補好條件的台北服務通）', () => {
  let wrapper: VueWrapper | null = null;
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.unstubAllGlobals();
  });

  it('判定照四題、三格摘要寫條件、次鈕「查看官方來源」連到原文頁、顯示實際補助', async () => {
    window.history.replaceState(null, '', '/');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(list)));
    vi.resetModules();
    const { useQuery } = await import('@/composables/useQuery');
    const { useDetail } = await import('@/composables/useDetail');
    const DetailDialog = (await import('@/components/DetailDialog.vue')).default;
    await useQuery().loadList();
    useQuery().applyDemo(1);
    wrapper = mount(DetailDialog, { attachTo: document.body });
    useDetail().open(308);
    await flushPromises();
    const w = wrapper;
    expect(w.get('[data-test="d-tags"]').text()).toContain('台北服務通 · 資格已整理');
    expect(w.get('[data-test="d-verdict"]').text()).toBe('可能符合');
    expect(w.get('[data-test="d-sum"]').text()).toContain('身心障礙者');
    expect(w.get('[data-test="d-why"]').text()).toContain('可能符合');
    expect(w.get('[data-test="d-verified"]').text()).toBe('查證日 2026-11-08');
    expect(w.get('[data-test="d-benefit-text"]').text()).toContain('每月補助金額不得逾新臺幣一千元');
    const sec = w.get('[data-test="d-dataset"]');
    expect(sec.text()).toBe('查看官方來源');
    expect(sec.attributes('href')).toBe('https://dosw.gov.taipei/cp.aspx?n=4B447000B62AC93C');
    expect(w.get('[data-test="d-apply"]').attributes('href')).toBe('https://service.taipei/case-detail/AI020');
  });
});
