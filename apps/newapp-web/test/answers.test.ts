import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { describe, expect, it } from 'vitest';
import { SubsidyListSchema } from '@app/shared';
import { REASON_AGE_CHECK, REASON_ALL_OK, findNoMatch, groupResults, isCompleted } from '@/lib/match';
import { DEMO_SCENARIOS, demoAnswers } from '@/lib/answers';

/** 2026-11-08 本機 newapp-api（S2）實打的回應：開放 10 項 + 模擬 3 項 */
const items13 = SubsidyListSchema.parse(fixtureWithMock).items;

const grouped = (i: number) => {
  const a = demoAnswers(i);
  if (!isCompleted(a)) throw new Error('示範答案未完成');
  return groupResults(items13, a);
};

describe('[SUBS-R23] 示範情境（v3：65+、40-64、26-39）', () => {
  it('三組，答案四題都已填，年齡區間依序為 65+、40-64、26-39', () => {
    expect(DEMO_SCENARIOS).toHaveLength(3);
    for (let i = 0; i < 3; i++) expect(isCompleted(demoAnswers(i))).toBe(true);
    expect(DEMO_SCENARIOS.map((d) => d.answers.ageBand)).toEqual(['65+', '40-64', '26-39']);
    expect(() => demoAnswers(3)).toThrow();
  });

  it('demoAnswers 回副本，改了不影響常數', () => {
    const a = demoAnswers(2);
    a.identities.push('stu');
    expect(DEMO_SCENARIOS[2]!.answers.identities).toEqual(['preg', 'mid']);
  });

  it('可能符合數分別為 2、2、8', () => {
    expect([0, 1, 2].map((i) => grouped(i).eligible.length)).toEqual([2, 2, 8]);
  });

  it('各組可能符合的項目', () => {
    const nos = (i: number) => grouped(i).eligible.map((r) => r.item.no);
    expect(nos(0)).toEqual([6, 9]);
    expect(nos(1)).toEqual([5, 102]);
    expect(nos(2)).toEqual([4, 7, 8, 9, 10, 101, 102, 103]);
  });

  it('[SUBS-R13][SUBS-R17] 40–64歲對青年租屋補貼（20～40 歲）跨上限：年齡要再確認', () => {
    const r = grouped(1).eligible.find((x) => x.item.no === 102)!;
    expect(r.result.reason).toBe(REASON_AGE_CHECK);
    expect(r.result.toVerify[0]).toBe('年齡：需 40 歲以下，你選的區間跨過門檻');
  });

  it('[SUBS-R13][SUBS-R17] 26–39歲：青年租屋補貼完全在內；青年職涯探索補助（18～29 歲）跨上限', () => {
    const g = grouped(2);
    expect(g.eligible.find((x) => x.item.no === 102)!.result.reason).toBe(REASON_ALL_OK);
    const r103 = g.eligible.find((x) => x.item.no === 103)!;
    expect(r103.result.reason).toBe(REASON_AGE_CHECK);
    expect(r103.result.toVerify[0]).toBe('年齡：需 29 歲以下，你選的區間跨過門檻');
  });

  it('[SUBS-R19] 有可能符合時沒有無符合結果', () => {
    expect(findNoMatch(grouped(0))).toBeNull();
  });
});
