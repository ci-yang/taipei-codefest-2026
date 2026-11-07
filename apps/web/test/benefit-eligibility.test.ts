import { describe, expect, it } from 'vitest';
import { BENEFIT_PROGRAMS } from '@/lib/benefit-data';
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
  it('依生日正確計算週歲，無效日期不猜測', () => {
    expect(ageFromBirthday('2000-11-08', today)).toBe(26);
    expect(ageFromBirthday('2000-11-09', today)).toBe(25);
    expect(ageFromBirthday('2026-02-30', today)).toBeNull();
    expect(ageFromBirthday('', today)).toBeNull();
  });

  it('逐一回傳官方資料集的 10 項，並將較可能的結果排前面', () => {
    const results = evaluateBenefits({ ...baseProfile, traits: ['lowIncome'] }, today);
    expect(results).toHaveLength(10);
    expect(results.map((result) => result.program.id).sort()).toEqual(BENEFIT_PROGRAMS.map((item) => item.id).sort());
    expect(results[0]!.status).toBe('possible');
  });

  it('已具低收入戶資格且門檻內，生活扶助列為值得進一步申請', () => {
    const result = evaluateBenefit(program('1'), { ...baseProfile, traits: ['lowIncome'] }, today);
    expect(result.status).toBe('possible');
    expect(result.conflicts).toHaveLength(0);
    expect(result.matched.join(' ')).toContain('已具低收入戶資格');
  });

  it('缺少既有低收入戶認定時不武斷排除，而是要求補確認', () => {
    const result = evaluateBenefit(program('1'), baseProfile, today);
    expect(result.status).toBe('review');
    expect(result.missing.join(' ')).toContain('先取得');
  });

  it('明確超過所得門檻時標為可能不符，並保留可讀理由', () => {
    const result = evaluateBenefit(program('4'), { ...baseProfile, monthlyIncomePerPerson: 30_000 }, today);
    expect(result.status).toBe('unlikely');
    expect(result.conflicts.join(' ')).toContain('超過資料門檻 24,293 元');
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
});
