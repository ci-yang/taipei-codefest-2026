import { describe, expect, it } from 'vitest';
import { BENEFIT_PROGRAMS, BENEFIT_SOURCE } from '@/lib/benefit-data';
import {
  ageFromBirthday,
  evaluateBenefit,
  evaluateBenefits,
  type EligibilityProfile,
} from '@/lib/benefit-eligibility';

const today = new Date(2026, 10, 8);
const baseProfile: EligibilityProfile = {
  birthday: '1990-01-01',
  taipeiResident: true,
  domestic183Days: true,
  monthlyIncomePerPerson: 12_000,
  movableAssetsPerPerson: 100_000,
  realEstateHousehold: 2_000_000,
  traits: [],
};

const program = (id: string) => BENEFIT_PROGRAMS.find((item) => item.id === id)!;

describe('benefit eligibility rules', () => {
  it('19 項規則都有唯一識別碼與官方 HTTPS 連結', () => {
    expect(BENEFIT_PROGRAMS).toHaveLength(BENEFIT_SOURCE.count);
    expect(new Set(BENEFIT_PROGRAMS.map((item) => item.id)).size).toBe(BENEFIT_SOURCE.count);
    expect(BENEFIT_PROGRAMS.every((item) => item.officialUrl.startsWith('https://'))).toBe(true);
  });

  it('依生日正確計算週歲，無效日期不猜測', () => {
    expect(ageFromBirthday('2000-11-08', today)).toBe(26);
    expect(ageFromBirthday('2000-11-09', today)).toBe(25);
    expect(ageFromBirthday('2026-02-30', today)).toBeNull();
    expect(ageFromBirthday('', today)).toBeNull();
  });

  it('逐一回傳 19 項深度規則，並將較可能的結果排前面', () => {
    const results = evaluateBenefits({ ...baseProfile, traits: ['lowIncome'] }, today);
    expect(results).toHaveLength(19);
    expect(results.map((result) => result.program.id).sort()).toEqual(BENEFIT_PROGRAMS.map((item) => item.id).sort());
    expect(results[0]!.status).toBe('possible');
  });

  it('已具低收入戶資格且門檻內，生活扶助列為值得進一步申請', () => {
    const result = evaluateBenefit(program('1'), { ...baseProfile, traits: ['lowIncome'] }, today);
    expect(result.status).toBe('possible');
    expect(result.conflicts).toHaveLength(0);
    expect(result.matched.join(' ')).toContain('已具低收入戶資格');
  });

  it('低收入戶使用 115 年度所得門檻 20,744 元', () => {
    const atLimit = evaluateBenefit(
      program('1'),
      { ...baseProfile, monthlyIncomePerPerson: 20_744, traits: ['lowIncome'] },
      today,
    );
    const overLimit = evaluateBenefit(
      program('1'),
      { ...baseProfile, monthlyIncomePerPerson: 20_745, traits: ['lowIncome'] },
      today,
    );

    expect(atLimit.status).toBe('possible');
    expect(overLimit.status).toBe('unlikely');
  });

  it('缺少既有低收入戶認定時不武斷排除，而是要求補確認', () => {
    const result = evaluateBenefit(program('1'), baseProfile, today);
    expect(result.status).toBe('review');
    expect(result.missing.join(' ')).toContain('先取得');
  });

  it('明確超過所得門檻時標為可能不符，並保留可讀理由', () => {
    const result = evaluateBenefit(program('4'), { ...baseProfile, monthlyIncomePerPerson: 30_000 }, today);
    expect(result.status).toBe('unlikely');
    expect(result.conflicts.join(' ')).toContain('超過資料門檻 29,635 元');
  });

  it('年齡未達 65 歲時不把老人津貼列為待補資料', () => {
    const result = evaluateBenefit(program('6'), baseProfile, today);
    expect(result.status).toBe('unlikely');
    expect(result.conflicts).toContain('目前 36 歲，未達 65 歲');
  });

  it('未填金額時保留未知，不以 0 元冒充', () => {
    const result = evaluateBenefit(
      program('4'),
      { ...baseProfile, monthlyIncomePerPerson: null, movableAssetsPerPerson: null, realEstateHousehold: null },
      today,
    );
    expect(result.status).toBe('review');
    expect(result.missing).toHaveLength(3);
  });

  it('中央租金補貼要求租屋且家庭無自有住宅', () => {
    const eligible = evaluateBenefit(program('11'), { ...baseProfile, monthlyIncomePerPerson: 50_000, traits: ['renter', 'noOwnedHome'] }, today);
    const ownsHome = evaluateBenefit(program('11'), { ...baseProfile, monthlyIncomePerPerson: 50_000, traits: ['renter'] }, today);

    expect(eligible.status).toBe('possible');
    expect(ownsHome.status).toBe('unlikely');
    expect(ownsHome.conflicts.join(' ')).toContain('均無自有住宅');
  });

  it('中央租金補貼對新婚或育有未成年子女家庭採較高所得門檻', () => {
    const ordinary = evaluateBenefit(program('11'), { ...baseProfile, monthlyIncomePerPerson: 65_000, traits: ['renter', 'noOwnedHome'] }, today);
    const newlywed = evaluateBenefit(program('11'), { ...baseProfile, monthlyIncomePerPerson: 65_000, traits: ['renter', 'noOwnedHome', 'newlywedWithin2Years'] }, today);

    expect(ordinary.status).toBe('unlikely');
    expect(ordinary.conflicts.join(' ')).toContain('61,137');
    expect(newlywed.status).toBe('possible');
    expect(newlywed.matched.join(' ')).toContain('71,327');
  });

  it('臺北幸福租接受未滿 40 歲單身青年，也接受育有 12 歲以下子女家庭', () => {
    const singleYouth = evaluateBenefit(program('12'), { ...baseProfile, traits: ['renter', 'centralRentApproved', 'single'] }, today);
    const parenting = evaluateBenefit(
      program('12'),
      { ...baseProfile, birthday: '1970-01-01', traits: ['renter', 'centralRentApproved', 'childUnder12'] },
      today,
    );

    expect(singleYouth.status).toBe('possible');
    expect(parenting.status).toBe('possible');
  });

  it('臺北幸福租排除年滿 40 歲、沒有育兒條件的單身申請人', () => {
    const result = evaluateBenefit(
      program('12'),
      { ...baseProfile, birthday: '1980-01-01', traits: ['renter', 'centralRentApproved', 'single'] },
      today,
    );

    expect(result.status).toBe('unlikely');
    expect(result.conflicts.join(' ')).toContain('未滿 40 歲');
  });

  it('一般生育補助須同時符合生育、設籍期間與申請期限', () => {
    const result = evaluateBenefit(
      program('16'),
      { ...baseProfile, traits: ['recentBirth', 'northNorthKeelungTenMonths', 'birthApplicationInTime'] },
      today,
    );

    expect(result.status).toBe('possible');
  });

  it('育兒津貼與公共準公共托育補助依照顧方式分流', () => {
    const homeCare = evaluateBenefit(
      program('17'),
      { ...baseProfile, traits: ['infantUnder2', 'homeCareWithoutPublicChildcare', 'childNotPubliclyPlaced'] },
      today,
    );
    const childcare = evaluateBenefit(
      program('18'),
      { ...baseProfile, traits: ['infantUnder2', 'publicOrQuasiChildcare', 'childcare30Hours', 'childNotPubliclyPlaced'] },
      today,
    );

    expect(homeCare.status).toBe('possible');
    expect(childcare.status).toBe('possible');
  });

  it('失業給付只有在五項必要條件都勾選時列為可能符合', () => {
    const complete = evaluateBenefit(
      program('19'),
      {
        ...baseProfile,
        traits: ['unemployed', 'involuntaryUnemployed', 'employmentInsuranceOneYear', 'willingToWork', 'jobRegistered14Days'],
      },
      today,
    );
    const incomplete = evaluateBenefit(program('19'), { ...baseProfile, traits: ['unemployed', 'involuntaryUnemployed'] }, today);

    expect(complete.status).toBe('possible');
    expect(incomplete.status).toBe('unlikely');
  });
});
