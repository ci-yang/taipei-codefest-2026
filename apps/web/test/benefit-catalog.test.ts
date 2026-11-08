import { describe, expect, it } from 'vitest';
import {
  CATALOG_PROGRAMS,
  CATALOG_SOURCE,
  catalogAcceptance,
  catalogBenefit,
  catalogCategory,
  catalogOfficialSearchUrl,
  rankCatalogPrograms,
} from '@/lib/benefit-catalog';
import type { EligibilityProfile } from '@/lib/benefit-eligibility';

const profile: EligibilityProfile = {
  birthday: '1990-01-01',
  newTaipeiResident: true,
  domestic183Days: true,
  monthlyIncomePerPerson: null,
  movableAssetsPerPerson: null,
  realEstateHousehold: null,
  traits: [],
};

describe('新北市福利補助官方快照', () => {
  it('完整保留 152 筆官方開放資料及可追溯明細網址', () => {
    expect(CATALOG_SOURCE.totalServiceCount).toBe(152);
    expect(CATALOG_SOURCE.candidateCount).toBe(152);
    expect(CATALOG_PROGRAMS).toHaveLength(152);
    expect(new Set(CATALOG_PROGRAMS.map((item) => item.id)).size).toBe(152);
    expect(CATALOG_PROGRAMS.every((item) => item.officialUrl === `https://welfare.ntpc.gov.tw/viewService/show/${item.id}?actionName=list6&fromOpa=1`)).toBe(true);
  });

  it('官方欄位包含資格、申請方式、給付內容及更新日期', () => {
    const birth = CATALOG_PROGRAMS.find((item) => item.id === '1008103')!;
    expect(birth.summary).toContain('申請條件');
    expect(birth.applicationMethods).toContain('戶政事務所');
    expect(birth.benefitContent).toContain('4萬元');
    expect(birth.lastUpdated).toMatch(/^2026-/);
  });

  it('依身分提高相關項目排序，但不把目錄候選誤標為完整核定', () => {
    const ranked = rankCatalogPrograms({ ...profile, traits: ['indigenous'] }, new Date(2026, 10, 8));
    expect(ranked).toHaveLength(152);
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(7);
    expect(ranked[0]!.reasons.join(' ')).toContain('原住民族身分');
    expect(ranked.slice(0, 20).some((item) => item.category === 'indigenous')).toBe(true);
  });

  it('未勾選明確身分時排除，勾選後才恢復候選', () => {
    const unselected = rankCatalogPrograms(profile, new Date(2026, 10, 8));
    expect(unselected.find((item) => item.program.id === '1008023')).toMatchObject({ excluded: true });
    expect(unselected.find((item) => item.program.id === '268437101')).toMatchObject({ excluded: true });
    expect(unselected.find((item) => item.program.id === '1008103')).toMatchObject({ excluded: true });

    const selected = rankCatalogPrograms({
      ...profile,
      traits: ['disabled', 'assistiveDeviceNeeded', 'petOwner', 'recentBirth'],
    }, new Date(2026, 10, 8));
    expect(selected.find((item) => item.program.id === '1008023')).toMatchObject({ excluded: false });
    expect(selected.find((item) => item.program.id === '268437101')).toMatchObject({ excluded: false });
    expect(selected.find((item) => item.program.id === '1008103')).toMatchObject({ excluded: false });
  });

  it('年齡未填時不把年齡未知誤當成不符', () => {
    const ranked = rankCatalogPrograms({ ...profile, birthday: '' }, new Date(2026, 10, 8));
    expect(ranked.find((item) => item.program.id === '22036')?.exclusionReasons).not.toContain('年齡與高齡照顧資料不符');
    expect(ranked.find((item) => item.program.id === '268437678')?.exclusionReasons).not.toContain('年齡不在青年方案的保守範圍');
  });

  it('可把服務分到市民看得懂的主題', () => {
    expect(catalogCategory(CATALOG_PROGRAMS.find((item) => item.id === '1008103')!)).toBe('family');
    expect(catalogCategory(CATALOG_PROGRAMS.find((item) => item.id === '1008023')!)).toBe('disability');
    expect(catalogCategory(CATALOG_PROGRAMS.find((item) => item.id === '163')!)).toBe('housing');
  });

  it('優先使用官方實際給付內容，而非只顯示流程摘要', () => {
    const birth = CATALOG_PROGRAMS.find((item) => item.id === '1008103')!;
    const benefit = catalogBenefit(birth);
    expect(benefit).toMatchObject({ isConcrete: true });
    expect(benefit.content).toContain('40,000 元');
  });

  it('只有官方文字明示全年受理時才標為開放，其他狀態保守留白', () => {
    const vaccine = CATALOG_PROGRAMS.find((item) => item.id === '268437690')!;
    const birth = CATALOG_PROGRAMS.find((item) => item.id === '1008103')!;
    expect(catalogAcceptance(vaccine)).toMatchObject({ status: 'open' });
    expect(catalogAcceptance(birth)).toMatchObject({ status: 'unknown' });
  });

  it('候選直接連回新北市福利補助自己查官方明細', () => {
    const program = CATALOG_PROGRAMS.find((item) => item.id === '163')!;
    expect(catalogOfficialSearchUrl(program)).toBe(program.officialUrl);
    expect(new URL(program.officialUrl).hostname).toBe('welfare.ntpc.gov.tw');
  });
});
