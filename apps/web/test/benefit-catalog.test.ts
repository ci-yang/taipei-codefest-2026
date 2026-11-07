import { describe, expect, it } from 'vitest';
import { CATALOG_PROGRAMS, CATALOG_SOURCE, catalogCategory, rankCatalogPrograms } from '@/lib/benefit-catalog';
import type { EligibilityProfile } from '@/lib/benefit-eligibility';

const profile: EligibilityProfile = {
  birthday: '1990-01-01',
  taipeiResident: true,
  domestic183Days: true,
  monthlyIncomePerPerson: null,
  movableAssetsPerPerson: null,
  realEstateHousehold: null,
  traits: [],
};

describe('台北服務通補助候選快照', () => {
  it('保留來源統計與 165 個可追溯官方入口', () => {
    expect(CATALOG_SOURCE.totalServiceCount).toBe(1_647);
    expect(CATALOG_SOURCE.keywordMatchCount).toBe(248);
    expect(CATALOG_SOURCE.candidateCount).toBe(165);
    expect(CATALOG_PROGRAMS).toHaveLength(165);
    expect(new Set(CATALOG_PROGRAMS.map((item) => item.id))).toHaveLength(165);
    expect(CATALOG_PROGRAMS.every((item) => item.officialUrl === `https://service.taipei/case-detail/${item.id}`)).toBe(true);
  });

  it('依身分提高相關案件排序，但沒有把候選誤標為符合資格', () => {
    const ranked = rankCatalogPrograms({ ...profile, traits: ['indigenous'] }, new Date(2026, 10, 8));
    expect(ranked).toHaveLength(165);
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(7);
    expect(ranked[0]!.reasons.join(' ')).toContain('原住民族身分');
    expect(ranked.slice(0, 20).some((item) => item.category === 'indigenous')).toBe(true);
  });

  it('可把服務分到使用者看得懂的主題', () => {
    const childbirth = CATALOG_PROGRAMS.find((item) => item.id === 'AC042')!;
    const disability = CATALOG_PROGRAMS.find((item) => item.id === 'AI013')!;
    expect(catalogCategory(childbirth)).toBe('family');
    expect(catalogCategory(disability)).toBe('disability');
  });
});
