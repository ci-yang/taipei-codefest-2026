import fixture from './fixtures/subsidy-list.json';
import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { describe, expect, it } from 'vitest';
import { SubsidyListSchema, type SubsidyItem } from '@app/shared';
import {
  REASON_AGE_CHECK,
  REASON_AGE_INCOME_CHECK,
  REASON_ALL_OK,
  REASON_HAS_STATUS,
  REASON_INCOME_MAY_EXCEED,
  REASON_INCOME_UNKNOWN,
  SOCIAL_WELFARE_CENTER,
  findNoMatch,
  formatYuan,
  groupResults,
  isCompleted,
  matchAll,
  matchItem,
  type CompletedAnswers,
} from '@/lib/match';
import {
  DEMO_SCENARIOS,
  MSG_AGE,
  MSG_IDENTITY,
  MSG_INCOME,
  MSG_RESIDENCY,
  demoAnswers,
  emptyAnswers,
  firstErrorIndex,
  toggleIdentity,
  validateAnswers,
  validateStep,
} from '@/lib/answers';
import {
  AGENCY_FALLBACK,
  agencyShort,
  bigCardDesc,
  bigCardPoints,
  filterSearch,
  matchesSearch,
  searchNoteText,
} from '@/lib/resultView';

/** 2026-11-08 本機 newapp-api 實打 GET /api/v1/subsidies 的回應（data.taipei 10 筆整理後） */
const list = SubsidyListSchema.parse(
  fixture,
);
const items = list.items;
/** 2026-11-08 本機 newapp-api（S2）實打的回應：開放 10 項 + 模擬 3 項 */
const items13 = SubsidyListSchema.parse(fixtureWithMock).items;
const item = (no: number): SubsidyItem => {
  const found = items.find((i) => i.no === no);
  if (!found) throw new Error(`沒有序號 ${no}`);
  return found;
};
const answers = (over: Partial<CompletedAnswers> = {}): CompletedAnswers => ({
  ageBand: '30-44',
  residency: true,
  identities: ['none'],
  incomeBracket: 1,
  ...over,
});

describe('S1 驗收：65歲+、設籍臺北、以上皆無、級距 3', () => {
  const a = answers({ ageBand: '65+', identities: ['none'], incomeBracket: 3 });
  const grouped = groupResults(items, a);

  it('[SUBS-R13][SUBS-R14][SUBS-R15][SUBS-R16] 可能符合恰為中低收入老人生活津貼、市民醫療補助 2 項', () => {
    expect(grouped.eligible.map((r) => r.item.name)).toEqual(['中低收入老人生活津貼', '市民醫療補助']);
  });

  it('[SUBS-R16][SUBS-R17] 急難救助不符合，原因「每人每月收入需在 24,293 元以下」', () => {
    const r = grouped.ineligible.find((x) => x.item.name === '急難救助');
    expect(r?.result.ok).toBe(false);
    expect(r?.result.reason).toBe('每人每月收入需在 24,293 元以下');
  });

  it('[SUBS-R72] 兩組合計等於清單 10 項，每項恰一個結果', () => {
    expect(grouped.eligible.length + grouped.ineligible.length).toBe(10);
    const nos = matchAll(items, a).map((r) => r.no);
    expect(new Set(nos).size).toBe(items.length);
    expect(nos.sort((x, y) => x - y)).toEqual(items.map((i) => i.no).sort((x, y) => x - y));
  });

  it('[SUBS-R17] 可能符合原因為「年齡、設籍、身分、收入都在條件內」', () => {
    expect(grouped.eligible.every((r) => r.result.reason === REASON_ALL_OK)).toBe(true);
  });
});

describe('比對規則邊界', () => {
  it('[SUBS-R13] 年齡用區間比：完全在內過、完全在外不過、跨門檻列可能符合並加還需確認（ADR-030）', () => {
    const low = answers({ identities: ['low'] });
    // 序號 2：18～25 歲
    expect(matchItem(item(2), { ...low, ageBand: 'u18' }).reason).toBe('需 18 歲以上');
    expect(matchItem(item(2), { ...low, ageBand: '30-44' }).reason).toBe('需 25 歲以下');
    const cross = matchItem(item(2), { ...low, ageBand: '18-29' });
    expect(cross.ok).toBe(true);
    expect(cross.reason).toBe(REASON_AGE_CHECK);
    expect(cross.toVerify[0]).toBe('年齡：需 25 歲以下，你選的區間跨過門檻');
    expect(cross.toVerify.length).toBe(item(2).toVerify.length + 1);
    // 模擬 102：20～40 歲，30-44 跨上限、18-29 跨下限
    const m102 = items13.find((x) => x.no === 102)!;
    expect(matchItem(m102, answers({ ageBand: '18-29', incomeBracket: 1 })).toVerify[0]).toBe('年齡：需 20 歲以上，你選的區間跨過門檻');
    expect(matchItem(m102, answers({ ageBand: '30-44', incomeBracket: 1 })).toVerify[0]).toBe('年齡：需 40 歲以下，你選的區間跨過門檻');
    expect(matchItem(m102, answers({ ageBand: '45-64', incomeBracket: 1 })).reason).toBe('需 40 歲以下');
  });

  it('[SUBS-R13][SUBS-R17] S1 驗收：18-29歲、設籍、低收入戶、級距 1，序號 3（25 歲以下）年齡要再確認', () => {
    const r = matchItem(item(3), answers({ ageBand: '18-29', identities: ['low'], incomeBracket: 1 }));
    expect(r.ok).toBe(true);
    expect(r.reason).toBe('其他條件都在範圍內，年齡要再確認');
    expect(r.toVerify).toContain('年齡：需 25 歲以下，你選的區間跨過門檻');
  });

  it('[SUBS-R17] 年齡跨門檻又選收入不清楚：年齡與收入要再確認；收入條目排在最前', () => {
    const r = matchItem(item(3), answers({ ageBand: '18-29', identities: ['low'], incomeBracket: 0 }));
    expect(r.ok).toBe(true);
    expect(r.reason).toBe(REASON_AGE_INCOME_CHECK);
    expect(r.reason).toBe('其他條件都在範圍內，年齡與收入要再確認');
    expect(r.toVerify.slice(0, 2)).toEqual(['每人每月收入需在 17,005 元以下（你選了不清楚）', '年齡：需 25 歲以下，你選的區間跨過門檻']);
  });

  it('[SUBS-R13] 18歲以下完全落在 25 歲以下內', () => {
    const r = matchItem(item(3), answers({ ageBand: 'u18', identities: ['low'] }));
    expect(r.ok).toBe(true);
    expect(r.reason).toBe(REASON_ALL_OK);
  });

  it('[SUBS-R14] 需設籍而答否不過', () => {
    const r = matchItem(item(10), answers({ residency: false }));
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toBe('需設籍臺北市');
  });

  it('[SUBS-R15] 選 65歲+ 推得老人；45-64歲不過年齡也不過身分', () => {
    expect(matchItem(item(6), answers({ ageBand: '65+' })).ok).toBe(true);
    const r = matchItem(item(6), answers({ ageBand: '45-64' }));
    expect(r.failures).toEqual(['需 65 歲以上', '需具65 歲以上身分']);
  });

  it('[SUBS-R15] 以上皆無不命中任何身分', () => {
    expect(matchItem(item(5), answers({ identities: ['none'] })).reason).toBe('需具身心障礙者身分');
  });

  it('[SUBS-R15] 中低收入戶身分命中「低收入戶或中低收入戶」，不命中只要低收入戶的項目', () => {
    expect(matchItem(item(8), answers({ identities: ['mid'] })).ok).toBe(true);
    expect(matchItem(item(2), answers({ ageBand: '18-29', identities: ['mid'] })).reason).toBe('需具低收入戶身分');
  });

  it('[SUBS-R15][SUBS-R17] 申請取得身分：無該身分也不判身分；已具該身分改寫原因', () => {
    const none = matchItem(item(1), answers({ identities: ['none'], incomeBracket: 1 }));
    expect(none.ok).toBe(true);
    expect(none.reason).toBe(REASON_ALL_OK);
    const has = matchItem(item(4), answers({ identities: ['mid'], incomeBracket: 2 }));
    expect(has.ok).toBe(true);
    expect(has.reason).toBe(REASON_HAS_STATUS);
  });

  it('[SUBS-R16] 級距上界等於上限算過（級距 3 對 28,550）', () => {
    expect(matchItem(item(9), answers({ incomeBracket: 3 })).ok).toBe(true);
  });

  it('[SUBS-R16] 級距下界超過上限寫金額；級距 5 無上界算跨上限', () => {
    expect(matchItem(item(9), answers({ incomeBracket: 4 })).reason).toBe('每人每月收入需在 28,550 元以下');
    expect(matchItem(item(6), answers({ ageBand: '65+', incomeBracket: 5 })).reason).toBe('每人每月收入需在 33,252 元以下');
  });

  it('[SUBS-R16] 級距跨過上限寫「收入可能超過上限」', () => {
    const fakeItem: SubsidyItem = { ...item(10), incomeMax: 20_000 };
    expect(matchItem(fakeItem, answers({ incomeBracket: 2 })).reason).toBe(REASON_INCOME_MAY_EXCEED);
    const openTop: SubsidyItem = { ...item(10), incomeMax: 40_000 };
    expect(matchItem(openTop, answers({ incomeBracket: 5 })).reason).toBe(REASON_INCOME_MAY_EXCEED);
  });

  it('[SUBS-R16][SUBS-R17] 收入不清楚不判，加一條還需確認並改寫原因', () => {
    const r = matchItem(item(10), answers({ incomeBracket: 0 }));
    expect(r.ok).toBe(true);
    expect(r.reason).toBe(REASON_INCOME_UNKNOWN);
    expect(r.toVerify[0]).toBe('每人每月收入需在 24,293 元以下（你選了不清楚）');
    expect(r.toVerify.length).toBe(item(10).toVerify.length + 1);
  });

  it('[SUBS-R16] incomeMax 為 null 時收入直接過', () => {
    const noIncome: SubsidyItem = { ...item(10), incomeMax: null };
    const r = matchItem(noIncome, answers({ incomeBracket: 0 }));
    expect(r.ok).toBe(true);
    expect(r.reason).toBe(REASON_ALL_OK);
    expect(r.toVerify).toEqual(item(10).toVerify);
  });

  it('[SUBS-R17] 不符合原因取第一條（年齡在前）', () => {
    const r = matchItem(item(2), answers({ ageBand: 'u18', residency: false, identities: ['none'], incomeBracket: 5 }));
    expect(r.failures).toHaveLength(4);
    expect(r.reason).toBe(r.failures[0]);
    expect(r.reason).toBe('需 18 歲以上');
  });

  it('[SUBS-R18] 分組內依序號排列，開放資料在模擬前', () => {
    const mock: SubsidyItem = { ...item(10), no: 101, kind: 'mock', name: '模擬', url: '' };
    const g = groupResults([mock, ...items].reverse(), answers({ ageBand: '65+', incomeBracket: 3 }));
    const nos = g.eligible.map((r) => r.item.no);
    expect(nos).toEqual([6, 9]);
    const inel = g.ineligible.map((r) => r.item.no);
    expect(inel).toEqual([...inel].sort((x, y) => x - y));
    expect(inel.at(-1)).toBe(101);
  });
});

describe('答案驗證與狀態', () => {
  it('[SUBS-R11] 第 1 題、第 3 題未答回提示', () => {
    expect(validateStep(0, emptyAnswers())).toBe(MSG_AGE);
    expect(validateStep(2, emptyAnswers())).toBe(MSG_IDENTITY);
    expect(validateStep(0, { ...emptyAnswers(), ageBand: 'u18' })).toBeNull();
  });

  it('[SUBS-R11] 送出時一次驗四題：四種訊息照 spec 7.2，第一張有錯的卡', () => {
    expect(validateAnswers(emptyAnswers())).toEqual([
      '請選擇年齡區間',
      '請選擇戶籍縣市',
      '請至少選一項，沒有就選以上皆無',
      '請選一個級距，不確定就選不清楚',
    ]);
    expect([MSG_AGE, MSG_RESIDENCY, MSG_IDENTITY, MSG_INCOME]).toEqual(validateAnswers(emptyAnswers()));
    const errs = validateAnswers({ ageBand: '65+', residency: true, identities: [], incomeBracket: null });
    expect(errs).toEqual([null, null, MSG_IDENTITY, MSG_INCOME]);
    expect(firstErrorIndex(errs)).toBe(2);
    expect(firstErrorIndex(validateAnswers({ ageBand: 'u18', residency: false, identities: ['none'], incomeBracket: 0 }))).toBe(-1);
  });

  it('[SUBS-R12] 以上皆無與其他身分互斥', () => {
    expect(toggleIdentity(['low', 'dis'], 'none')).toEqual(['none']);
    expect(toggleIdentity(['none'], 'mid')).toEqual(['mid']);
    expect(toggleIdentity(['low'], 'low')).toEqual([]);
  });

  it('完成判斷用 === null：收入不清楚 0 也算已答', () => {
    expect(isCompleted({ ageBand: 'u18', residency: false, identities: ['none'], incomeBracket: 0 })).toBe(true);
    expect(isCompleted({ ageBand: 'u18', residency: null, identities: ['none'], incomeBracket: 0 })).toBe(false);
    expect(isCompleted({ ageBand: null, residency: true, identities: ['none'], incomeBracket: 1 })).toBe(false);
    expect(isCompleted({ ageBand: '30-44', residency: true, identities: [], incomeBracket: 1 })).toBe(false);
  });

  it('金額千分位', () => {
    expect(formatYuan(24293)).toBe('24,293');
    expect(formatYuan(999)).toBe('999');
  });
});


describe('S2 驗收：13 項清單、示範情境、無符合', () => {
  it('[SUBS-R07][SUBS-R18] 結果合計 13 項，模擬 3 項排在各組開放資料之後', () => {
    const g = groupResults(items13, answers({ ageBand: '30-44', identities: ['preg', 'mid'], incomeBracket: 2 }));
    expect(g.eligible.length + g.ineligible.length).toBe(13);
    for (const group of [g.eligible, g.ineligible]) {
      const kinds = group.map((r) => r.item.kind);
      expect(kinds).toEqual([...kinds].sort((x, y) => (x === y ? 0 : x === 'open' ? -1 : 1)));
    }
  });

  it('[SUBS-R23] 示範情境三組，答案四題都已填', () => {
    expect(DEMO_SCENARIOS).toHaveLength(3);
    for (let i = 0; i < 3; i++) expect(isCompleted(demoAnswers(i))).toBe(true);
    expect(() => demoAnswers(3)).toThrow();
  });

  it('[SUBS-R23] demoAnswers 回副本，改了不影響常數', () => {
    const a = demoAnswers(2);
    a.identities.push('stu');
    expect(DEMO_SCENARIOS[2]!.answers.identities).toEqual(['preg', 'mid']);
  });

  it('[SUBS-R23] 示範情境可能符合數分別為 2、2、7', () => {
    const counts = [0, 1, 2].map((i) => {
      const a = demoAnswers(i);
      if (!isCompleted(a)) throw new Error('示範答案未完成');
      return groupResults(items13, a).eligible.length;
    });
    expect(counts).toEqual([2, 2, 7]);
  });

  it('[SUBS-R23] 示範情境各組可能符合的項目', () => {
    const eligibleNos = (i: number) => {
      const a = demoAnswers(i);
      if (!isCompleted(a)) throw new Error('示範答案未完成');
      return groupResults(items13, a).eligible.map((r) => r.item.no);
    };
    expect(eligibleNos(0)).toEqual([6, 9]);
    expect(eligibleNos(1)).toEqual([5, 102]);
    expect(eligibleNos(2)).toEqual([4, 7, 8, 9, 10, 101, 102]);
  });

  it('[SUBS-R13][SUBS-R17] 示範第 2、3 組的青年租屋補貼（20～40 歲）因年齡跨門檻列可能符合並帶一條還需確認', () => {
    for (const i of [1, 2]) {
      const a = demoAnswers(i);
      if (!isCompleted(a)) throw new Error('示範答案未完成');
      const r = groupResults(items13, a).eligible.find((x) => x.item.no === 102)!;
      expect(r.result.reason).toBe(REASON_AGE_CHECK);
      expect(r.result.toVerify[0]).toBe('年齡：需 40 歲以下，你選的區間跨過門檻');
    }
  });

  it('[SUBS-R19] 有可能符合時沒有無符合結果', () => {
    const a = demoAnswers(0);
    if (!isCompleted(a)) throw new Error('示範答案未完成');
    expect(findNoMatch(groupResults(items13, a))).toBeNull();
  });

  describe('[SUBS-R19] 45-64歲、未設籍、以上皆無、級距 5', () => {
    const a = answers({ ageBand: '45-64', residency: false, identities: ['none'], incomeBracket: 5 });
    const g = groupResults(items13, a);
    const nm = findNoMatch(g);

    it('[SUBS-R19] 可能符合（含模擬）為 0，產生無符合結果', () => {
      expect(g.eligible).toHaveLength(0);
      expect(nm).not.toBeNull();
    });

    it('[SUBS-R19] 最接近 3 項為開放資料中不過條件最少者（同數依序號），各帶第一條不過的條件', () => {
      expect(nm!.closest.map((r) => [r.item.no, r.item.name, r.result.failures.length, r.firstFailure])).toEqual([
        [1, '低收入戶生活扶助', 2, '需設籍臺北市'],
        [4, '中低收入戶', 2, '需設籍臺北市'],
        [9, '市民醫療補助', 2, '需設籍臺北市'],
      ]);
      expect(nm!.closest.every((r) => r.item.kind === 'open')).toBe(true);
    });

    it('[SUBS-R19] 附社會福利服務中心連結；模擬類別照常在不符合組', () => {
      expect(nm!.center).toBe(SOCIAL_WELFARE_CENTER);
      expect(nm!.center.url).toMatch(/^https:\/\/dosw\.gov\.taipei\//);
      expect(g.ineligible.filter((r) => r.item.kind === 'mock').map((r) => r.item.no)).toEqual([101, 102, 103]);
      expect(g.ineligible).toHaveLength(13);
    });
  });

  it('[SUBS-R20] 清除後答案回到未填（四題都空）', () => {
    const cleared = emptyAnswers();
    expect(cleared).toEqual({ ageBand: null, residency: null, identities: [], incomeBracket: null });
    expect(isCompleted(cleared)).toBe(false);
  });
});

describe('結果頁顯示用純函式', () => {
  it('[SUBS-R29] agencyShort：取第一段；條文片段（編號、依）或空白改顯示臺北市政府社會局', () => {
    // 營養品補助（序號 7）的收件洽辦單位以「1.依前述…」開頭
    expect(agencyShort(item(7).office)).toBe(AGENCY_FALLBACK);
    expect(AGENCY_FALLBACK).toBe('臺北市政府社會局');
    expect(agencyShort('戶籍所在地區公所')).toBe('戶籍所在地區公所');
    expect(agencyShort('臺北市政府社會局社會救助科')).toBe('臺北市政府社會局社會救助科');
    expect(agencyShort('都市發展局（模擬）')).toBe('都市發展局（模擬）');
    expect(agencyShort('甲單位。乙單位')).toBe('甲單位');
    expect(agencyShort('甲單位；乙單位')).toBe('甲單位');
    expect(agencyShort('甲單位;乙單位')).toBe('甲單位');
    expect(agencyShort('甲單位 乙單位')).toBe('甲單位');
    expect(agencyShort('1、某單位')).toBe(AGENCY_FALLBACK);
    expect(agencyShort('1．某單位')).toBe(AGENCY_FALLBACK);
    expect(agencyShort('依規定辦理')).toBe(AGENCY_FALLBACK);
    expect(agencyShort('')).toBe(AGENCY_FALLBACK);
    expect(agencyShort('   ')).toBe(AGENCY_FALLBACK);
  });

  it('[W9] 大卡三點重點與說明', () => {
    expect(bigCardPoints(item(6))).toEqual(['65 歲以上', '65 歲以上', '上限 33,252 元 / 月']);
    expect(bigCardPoints(item(9))).toEqual(['不限身分', '不限年齡', '上限 28,550 元 / 月']);
    const mock = SubsidyListSchema.parse(fixtureWithMock).items.find((x) => x.no === 103)!;
    expect(bigCardPoints(mock)).toEqual(['不限身分', '18～29 歲', '不限收入']);
    expect(bigCardDesc({ reason: '年齡、設籍、身分、收入都在條件內', toVerify: ['a', 'b'] })).toBe('年齡、設籍、身分、收入都在條件內；另有 2 項條件要再確認。');
    expect(bigCardDesc({ reason: 'x', toVerify: [] })).toBe('x。');
  });

  it('[SUBS-R25] 搜尋只看名稱包含關鍵字，空白不算；提示文字', () => {
    expect(matchesSearch('市民醫療補助', '補助')).toBe(true);
    expect(matchesSearch('中低收入戶', '補助')).toBe(false);
    expect(matchesSearch('中低收入戶', '  ')).toBe(true);
    const rows = items.map((it) => ({ item: it }));
    expect(filterSearch(rows, ' 補助 ').map((r) => r.item.no)).toEqual(
      items.filter((it) => it.name.includes('補助')).map((it) => it.no),
    );
    expect(searchNoteText(' 補助 ', 3)).toBe('名稱含「補助」：3 項');
  });
});
