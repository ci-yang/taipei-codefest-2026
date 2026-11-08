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
  newTaipeiResident: true,
  domestic183Days: true,
  monthlyIncomePerPerson: 12_000,
  movableAssetsPerPerson: 80_000,
  realEstateHousehold: 2_000_000,
  traits: [],
};

const program = (id: string) => BENEFIT_PROGRAMS.find((item) => item.id === id)!;

describe('新北市福利資格規則', () => {
  it('28 項規則都有唯一官方 ID、給付內容與 HTTPS 連結', () => {
    expect(BENEFIT_PROGRAMS).toHaveLength(BENEFIT_SOURCE.count);
    expect(new Set(BENEFIT_PROGRAMS.map((item) => item.id)).size).toBe(BENEFIT_SOURCE.count);
    expect(BENEFIT_PROGRAMS.every((item) => item.benefitContent.trim().length > 0)).toBe(true);
    expect(BENEFIT_PROGRAMS.every((item) => item.officialUrl.startsWith('https://'))).toBe(true);
    expect(program('163').benefitContent).toContain('單身 3,500 元');
    expect(program('1008103').benefitContent).toContain('第 1 名 40,000 元');
  });

  it('依生日正確計算週歲，無效日期不猜測', () => {
    expect(ageFromBirthday('2000-11-08', today)).toBe(26);
    expect(ageFromBirthday('2000-11-09', today)).toBe(25);
    expect(ageFromBirthday('2026-02-30', today)).toBeNull();
    expect(ageFromBirthday('', today)).toBeNull();
  });

  it('逐一回傳 28 項深度規則並把較可能項目排前面', () => {
    const results = evaluateBenefits(baseProfile, today);
    expect(results).toHaveLength(28);
    expect(results.map((result) => result.program.id).sort()).toEqual(BENEFIT_PROGRAMS.map((item) => item.id).sort());
    expect(results[0]!.status).not.toBe('unlikely');
  });

  it('低收入戶依 115 年新北門檻判斷所得、動產及不動產', () => {
    expect(evaluateBenefit(program('22024'), baseProfile, today).status).toBe('possible');
    const overIncome = evaluateBenefit(program('22024'), { ...baseProfile, monthlyIncomePerPerson: 17_751 }, today);
    const overAssets = evaluateBenefit(program('22024'), { ...baseProfile, movableAssetsPerPerson: 100_001 }, today);
    expect(overIncome.status).toBe('unlikely');
    expect(overIncome.conflicts.join(' ')).toContain('17,750');
    expect(overAssets.status).toBe('unlikely');
  });

  it('中低收入戶使用 26,625、15 萬與 708 萬門檻', () => {
    const eligible = evaluateBenefit(program('22208'), {
      ...baseProfile,
      monthlyIncomePerPerson: 26_625,
      movableAssetsPerPerson: 150_000,
      realEstateHousehold: 7_080_000,
    }, today);
    const over = evaluateBenefit(program('22208'), { ...baseProfile, monthlyIncomePerPerson: 26_626 }, today);
    expect(eligible.status).toBe('possible');
    expect(over.status).toBe('unlikely');
  });

  it('需要新北市籍的方案不會對未設籍者誤判可能符合', () => {
    const result = evaluateBenefit(program('1008103'), {
      ...baseProfile,
      newTaipeiResident: false,
      traits: ['recentBirth', 'newTaipeiResidentTenMonths', 'birthApplicationInTime'],
    }, today);
    expect(result.status).toBe('unlikely');
    expect(result.conflicts.join(' ')).toContain('未設籍新北市');
  });

  it('青年租金補貼要求年齡、租屋、無房、無重複補助及新北就學就業', () => {
    const eligible = evaluateBenefit(program('163'), {
      ...baseProfile,
      birthday: '1997-01-01',
      traits: ['renter', 'noOwnedHome', 'noOtherHousingSubsidy', 'newTaipeiWorkOrStudy', 'single'],
    }, today);
    const missingExclusivity = evaluateBenefit(program('163'), {
      ...baseProfile,
      birthday: '1997-01-01',
      traits: ['renter', 'noOwnedHome', 'newTaipeiWorkOrStudy', 'single'],
    }, today);
    expect(eligible.status).toBe('possible');
    expect(missingExclusivity.status).toBe('unlikely');
    expect(missingExclusivity.conflicts.join(' ')).toContain('不得重複');
  });

  it('青年租金補貼排除已滿 40 歲申請人', () => {
    const result = evaluateBenefit(program('163'), {
      ...baseProfile,
      birthday: '1980-01-01',
      traits: ['renter', 'noOwnedHome', 'noOtherHousingSubsidy', 'newTaipeiWorkOrStudy', 'single'],
    }, today);
    expect(result.status).toBe('unlikely');
    expect(result.conflicts.join(' ')).toContain('已超過 39 歲');
  });

  it('生育獎勵金須同時符合設籍 10 個月與一年申請期限', () => {
    const eligible = evaluateBenefit(program('1008103'), {
      ...baseProfile,
      traits: ['recentBirth', 'newTaipeiResidentTenMonths', 'birthApplicationInTime'],
    }, today);
    const incomplete = evaluateBenefit(program('1008103'), { ...baseProfile, traits: ['recentBirth'] }, today);
    expect(eligible.status).toBe('possible');
    expect(incomplete.status).toBe('unlikely');
  });

  it('未滿二歲育兒津貼與公共準公共托育補助依照顧方式分流', () => {
    const homeCare = evaluateBenefit(program('1008029'), {
      ...baseProfile,
      traits: ['infantUnder2', 'homeCareWithoutPublicChildcare', 'childNotPubliclyPlaced'],
    }, today);
    const childcare = evaluateBenefit(program('1008042'), {
      ...baseProfile,
      traits: ['infantUnder2', 'publicOrQuasiChildcare', 'childcare30Hours', 'childNotPubliclyPlaced'],
    }, today);
    expect(homeCare.status).toBe('possible');
    expect(childcare.status).toBe('possible');
  });

  it('好孕專車接受孕婦本人設籍或非本國籍孕婦配偶設籍途徑', () => {
    const resident = evaluateBenefit(program('22216'), { ...baseProfile, traits: ['currentlyPregnant'] }, today);
    const spouse = evaluateBenefit(program('22216'), {
      ...baseProfile,
      newTaipeiResident: false,
      traits: ['currentlyPregnant', 'spouseNewTaipeiResident'],
    }, today);
    expect(resident.status).toBe('possible');
    expect(spouse.status).toBe('possible');
  });

  it('帶狀疱疹疫苗分別處理一般市民與原住民年齡門檻', () => {
    const common = evaluateBenefit(program('268437690'), {
      ...baseProfile,
      birthday: '1956-01-01',
      traits: ['middleLowIncome'],
    }, today);
    const indigenous = evaluateBenefit(program('268437690'), {
      ...baseProfile,
      birthday: '1968-01-01',
      traits: ['lowIncome', 'indigenous'],
    }, today);
    expect(common.status).toBe('possible');
    expect(indigenous.status).toBe('possible');
  });

  it('青年就業計畫需要失業、參訓意願與指定青年類型', () => {
    const eligible = evaluateBenefit(program('268437678'), {
      ...baseProfile,
      birthday: '2000-01-01',
      traits: ['unemployed', 'willingToTrain', 'longTermUnemployed180Days'],
    }, today);
    const incomplete = evaluateBenefit(program('268437678'), {
      ...baseProfile,
      birthday: '2000-01-01',
      traits: ['unemployed'],
    }, today);
    expect(eligible.status).toBe('possible');
    expect(incomplete.status).toBe('unlikely');
  });

  it('中低收入老人特別照顧津貼同時核對長者與照顧者條件', () => {
    const complete = evaluateBenefit(program('22008'), {
      ...baseProfile,
      traits: ['elderCareRecipientEligible', 'familyCaregiverEligible'],
    }, today);
    const incomplete = evaluateBenefit(program('22008'), {
      ...baseProfile,
      traits: ['elderCareRecipientEligible'],
    }, today);
    expect(complete.status).toBe('possible');
    expect(incomplete.status).toBe('unlikely');
  });

  it('新北市特有的鮮奶幸福週只在填有符合學童時出現', () => {
    expect(evaluateBenefit(program('268437687'), { ...baseProfile, traits: ['newTaipeiSchoolStudent'] }, today).status).toBe('possible');
    expect(evaluateBenefit(program('268437687'), baseProfile, today).status).toBe('unlikely');
  });
});
