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

  it('隱藏未勾選的明確身分案件，勾選後才恢復為候選', () => {
    const ranked = rankCatalogPrograms(profile, new Date(2026, 10, 8));
    expect(ranked.find((item) => item.program.id === 'BE005')).toMatchObject({ excluded: true });
    expect(ranked.find((item) => item.program.id === 'AI013')).toMatchObject({ excluded: true });
    expect(ranked.find((item) => item.program.id === 'AC042')).toMatchObject({ excluded: true });
    expect(ranked.find((item) => item.program.id === 'AF127')).toMatchObject({ excluded: true });

    const indigenousOnly = rankCatalogPrograms({ ...profile, traits: ['indigenous'] }, new Date(2026, 10, 8));
    expect(indigenousOnly.find((item) => item.program.id === 'BE005')).toMatchObject({ excluded: false });
    expect(indigenousOnly.find((item) => item.program.id === 'BE006')).toMatchObject({ excluded: true });

    const selected = rankCatalogPrograms(
      { ...profile, traits: ['indigenous', 'disabled', 'recentBirth'] },
      new Date(2026, 10, 8),
    );
    expect(selected.find((item) => item.program.id === 'BE005')).toMatchObject({ excluded: false });
    expect(selected.find((item) => item.program.id === 'AI013')).toMatchObject({ excluded: false });
    expect(selected.find((item) => item.program.id === 'AC042')).toMatchObject({ excluded: false });
    expect(selected.find((item) => item.program.id === 'AF127')).toMatchObject({ excluded: true });
  });

  it('年齡未填時保留年齡方案供確認，不把未知當成不符', () => {
    const ranked = rankCatalogPrograms({ ...profile, birthday: '' }, new Date(2026, 10, 8));
    expect(ranked.find((item) => item.program.id === 'EP003')).toMatchObject({ excluded: false });
    expect(ranked.find((item) => item.program.id === 'PO003')).toMatchObject({ excluded: false });
  });

  it('可把服務分到使用者看得懂的主題', () => {
    const childbirth = CATALOG_PROGRAMS.find((item) => item.id === 'AC042')!;
    const disability = CATALOG_PROGRAMS.find((item) => item.id === 'AI013')!;
    expect(catalogCategory(childbirth)).toBe('family');
    expect(catalogCategory(disability)).toBe('disability');
  });

  it('優先顯示可確認的實際給付，資料不足時明確標示', () => {
    const childbirth = CATALOG_PROGRAMS.find((item) => item.id === 'AC042')!;
    const ivf = CATALOG_PROGRAMS.find((item) => item.id === 'AL088')!;
    const accelerator = CATALOG_PROGRAMS.find((item) => item.id === 'AF127')!;

    expect(catalogBenefit(childbirth)).toMatchObject({ isConcrete: true });
    expect(catalogBenefit(childbirth).content).toContain('40,000 元');
    expect(catalogBenefit(ivf).content).toContain('25,000 元');
    expect(catalogBenefit(accelerator)).toMatchObject({ isConcrete: false });
    expect(catalogBenefit(accelerator).note).toContain('未提供金額');

    const ranked = rankCatalogPrograms(profile, new Date(2026, 10, 8));
    expect(ranked.find((item) => item.program.id === 'AC042')?.benefit.isConcrete).toBe(true);
  });

  it('把已知停止或不在受理期的案件標為關閉', () => {
    const indigenousRent = CATALOG_PROGRAMS.find((item) => item.id === 'BE018')!;
    const youthSharedSpace = CATALOG_PROGRAMS.find((item) => item.id === 'PO006')!;
    const exhaustedEmployment = CATALOG_PROGRAMS.find((item) => item.id === 'EA016')!;
    const stoppedYouthProgram = CATALOG_PROGRAMS.find((item) => item.id === 'EA026')!;

    expect(catalogAcceptance(indigenousRent, new Date(2026, 7, 15))).toMatchObject({ status: 'open' });
    expect(catalogAcceptance(indigenousRent, new Date(2026, 10, 8))).toMatchObject({ status: 'closed' });
    expect(catalogAcceptance(youthSharedSpace, new Date(2026, 10, 8))).toMatchObject({ status: 'closed' });
    expect(catalogAcceptance(exhaustedEmployment, new Date(2026, 10, 8))).toMatchObject({ status: 'closed' });
    expect(catalogAcceptance(stoppedYouthProgram, new Date(2026, 10, 8))).toMatchObject({
      status: 'closed',
      onlineStatus: 'closed',
      counterStatus: 'closed',
    });
  });

  it('線上暫停但仍可臨櫃的案件不誤標成全面停辦', () => {
    const temporaryWork = CATALOG_PROGRAMS.find((item) => item.id === 'EA003')!;
    expect(temporaryWork.onlineAcceptStatus).toBe('StopAccepting');
    expect(catalogAcceptance(temporaryWork, new Date(2026, 10, 8))).toMatchObject({
      status: 'open',
      onlineStatus: 'closed',
      counterStatus: 'open',
    });
    expect(catalogAcceptance(temporaryWork, new Date(2026, 10, 8)).note).toContain('臨櫃申辦');
  });

  it('候選連結回到台北服務通搜尋，避免直接網址重整後落到 404', () => {
    const program = CATALOG_PROGRAMS.find((item) => item.id === 'AJ054')!;
    const url = new URL(catalogOfficialSearchUrl(program));

    expect(url.origin + url.pathname).toBe('https://service.taipei/search-item');
    expect(url.searchParams.get('keyword')).toBe(program.name);
  });
});
