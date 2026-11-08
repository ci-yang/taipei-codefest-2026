import { describe, expect, it } from 'vitest';
import { evaluateBenefits, type EligibilityProfile } from '@/lib/benefit-eligibility';
import {
  benefitAcceptance,
  estimateMissedOpportunity,
  formatOpportunityAmount,
} from '@/lib/benefit-opportunity';

const renterProfile: EligibilityProfile = {
  birthday: '1997-10-15',
  newTaipeiResident: true,
  domestic183Days: true,
  monthlyIncomePerPerson: 24_000,
  movableAssetsPerPerson: 0,
  realEstateHousehold: 0,
  traits: ['renter', 'noOwnedHome', 'noOtherHousingSubsidy', 'newTaipeiWorkOrStudy', 'single'],
};

describe('可能錯過的新北福利金額', () => {
  it('依家庭類別計算青年租金補貼並只加總可能符合項目', () => {
    const today = new Date(2026, 10, 8);
    const estimate = estimateMissedOpportunity(evaluateBenefits(renterProfile, today), renterProfile, today);
    expect(estimate.lines).toHaveLength(1);
    expect(estimate.lines[0]).toMatchObject({ programId: '163', minimum: 42_000, maximum: 42_000 });
    expect(formatOpportunityAmount(estimate.totalMinimum, estimate.totalMaximum)).toBe('NT$42,000');
  });

  it('育兒家庭青年租補依未成年子女數提高估算', () => {
    const today = new Date(2026, 10, 8);
    const family = { ...renterProfile, traits: renterProfile.traits.filter((item) => item !== 'single').concat(['married', 'minorChild', 'secondChild']) } as EligibilityProfile;
    const estimate = estimateMissedOpportunity(evaluateBenefits(family, today), family, today);
    expect(estimate.lines.find((line) => line.programId === '163')).toMatchObject({ minimum: 72_000, maximum: 72_000 });
  });

  it('不把待補資料或無法可靠換算的福利灌入總額', () => {
    const incomplete: EligibilityProfile = {
      ...renterProfile,
      monthlyIncomePerPerson: null,
      newTaipeiResident: null,
      traits: [],
    };
    const estimate = estimateMissedOpportunity(
      evaluateBenefits(incomplete, new Date(2026, 10, 8)),
      incomplete,
      new Date(2026, 10, 8),
    );
    expect(estimate.lines).toEqual([]);
    expect(estimate.totalMinimum).toBe(0);
    expect(estimate.totalMaximum).toBe(0);
  });

  it('依 116 年度公告判斷青年租補受理終日', () => {
    expect(benefitAcceptance('163', new Date(2026, 10, 8))).toMatchObject({ status: 'open' });
    expect(benefitAcceptance('163', new Date(2028, 0, 1))).toMatchObject({ status: 'closed' });
    expect(benefitAcceptance('1008103', new Date(2026, 10, 8))).toMatchObject({ status: 'unknown' });
  });
});
