import { describe, expect, it } from 'vitest';
import { evaluateBenefits, type EligibilityProfile } from '@/lib/benefit-eligibility';
import {
  benefitAcceptance,
  estimateMissedOpportunity,
  formatOpportunityAmount,
} from '@/lib/benefit-opportunity';

const renterProfile: EligibilityProfile = {
  birthday: '1997-10-15',
  taipeiResident: false,
  domestic183Days: true,
  monthlyIncomePerPerson: 24_000,
  movableAssetsPerPerson: 0,
  realEstateHousehold: 0,
  traits: [
    'renter',
    'noOwnedHome',
    'married',
    'taipeiResidentFourMonths',
    'taipeiResidentOneYear',
    'unemployed',
    'involuntaryUnemployed',
    'willingToWork',
  ],
};

describe('可能錯過的福利金額', () => {
  it('只加總判定為可能符合且可量化的項目', () => {
    const today = new Date(2026, 10, 8);
    const results = evaluateBenefits(renterProfile, today);
    const estimate = estimateMissedOpportunity(results, renterProfile, today);

    expect(estimate.lines).toHaveLength(1);
    expect(estimate.lines[0]).toMatchObject({
      programId: '11',
      minimum: 36_000,
      maximum: 96_000,
    });
    expect(estimate.totalMinimum).toBe(36_000);
    expect(estimate.totalMaximum).toBe(96_000);
    expect(formatOpportunityAmount(estimate.totalMinimum, estimate.totalMaximum)).toBe('NT$36,000～96,000');
  });

  it('不把待補資料或無法可靠換算的福利灌入總額', () => {
    const incompleteProfile = { ...renterProfile, monthlyIncomePerPerson: null, traits: [] };
    const results = evaluateBenefits(incompleteProfile, new Date(2026, 10, 8));
    const estimate = estimateMissedOpportunity(results, incompleteProfile, new Date(2026, 10, 8));

    expect(estimate.lines).toEqual([]);
    expect(estimate.totalMinimum).toBe(0);
    expect(estimate.totalMaximum).toBe(0);
  });

  it('依官方固定月份排除目前未受理的原住民租屋補貼', () => {
    expect(benefitAcceptance('15', new Date(2026, 7, 15))).toMatchObject({ status: 'open' });
    expect(benefitAcceptance('15', new Date(2026, 10, 8))).toMatchObject({ status: 'closed' });
    expect(benefitAcceptance('11', new Date(2026, 10, 8))).toMatchObject({ status: 'unknown' });
  });
});
