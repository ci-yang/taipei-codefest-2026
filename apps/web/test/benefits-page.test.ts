import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BenefitsPage from '@/pages/BenefitsPage.vue';
import { rankCatalogPrograms } from '@/lib/benefit-catalog';
import { evaluateBenefits } from '@/lib/benefit-eligibility';
import { benefitAcceptance } from '@/lib/benefit-opportunity';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BenefitsPage 新北市福利流程', () => {
  it('只使用手動基本資料，送出後隱藏明確不符與未受理項目', async () => {
    vi.useFakeTimers();
    const today = new Date(2026, 10, 8);
    vi.setSystemTime(today);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const page = mount(BenefitsPage);

    expect(page.text()).toContain('新北福利雷達');
    expect(page.text()).toContain('152 項官方候選');
    expect(page.text()).not.toContain('從台北通帶入');
    expect(page.text()).toContain('不要求姓名、身分證字號、電話或 Email');

    await page.get('input[type="date"]').setValue('2015-01-01');
    await page.findAll('select')[0]!.setValue('true');
    await page.get('input[value="newTaipeiSchoolStudent"]').setValue(true);
    await page.get('form').trigger('submit');
    await flushPromises();

    const profile = {
      birthday: '2015-01-01',
      newTaipeiResident: true,
      domestic183Days: null,
      monthlyIncomePerPerson: null,
      movableAssetsPerPerson: null,
      realEstateHousehold: null,
      traits: ['newTaipeiSchoolStudent'] as const,
    };
    const actionableCount = evaluateBenefits({ ...profile, traits: [...profile.traits] }, today).filter(
      (item) => item.status !== 'unlikely' && benefitAcceptance(item.program.id, today).status !== 'closed',
    ).length;
    const catalogCount = rankCatalogPrograms({ ...profile, traits: [...profile.traits] }, today).filter(
      (item) => !item.excluded && item.acceptance.status !== 'closed' && item.score >= 6,
    ).length;

    expect(page.findAll('.result-card')).toHaveLength(actionableCount);
    expect(page.text()).toContain(`${actionableCount} 項可能可申請`);
    expect(page.text()).not.toContain('目前條件可能不符');
    expect(page.findAll('.catalog-card')).toHaveLength(Math.min(catalogCount, 24));
    expect(page.text()).toContain(`${catalogCount} 項符合已填身分的官方候選`);
    expect(page.get('.opportunity-modal').text()).toContain('沒申請，你可能錯過');
    await page.get('.opportunity-action').trigger('click');
    expect(page.find('.opportunity-modal').exists()).toBe(false);
  });
});
