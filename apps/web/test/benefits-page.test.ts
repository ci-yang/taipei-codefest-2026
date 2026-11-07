import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BenefitsPage from '@/pages/BenefitsPage.vue';
import { installMockTownPassBridge } from '@/composables/mockTownPassBridge';
import { rankCatalogPrograms } from '@/lib/benefit-catalog';
import { evaluateBenefits } from '@/lib/benefit-eligibility';
import { benefitAcceptance } from '@/lib/benefit-opportunity';

afterEach(() => {
  delete window.flutterObject;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BenefitsPage TownPass flow', () => {
  it('只帶入生日與臺北市民資訊，送出後隱藏不符與未受理項目', async () => {
    vi.useFakeTimers();
    const today = new Date(2026, 10, 8);
    vi.setSystemTime(today);
    installMockTownPassBridge(true);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const page = mount(BenefitsPage);
    await page.get('.townpass-button').trigger('click');
    await vi.advanceTimersByTimeAsync(180);
    await flushPromises();

    expect((page.get('input[type="date"]').element as HTMLInputElement).value).toBe('1990-01-01');
    expect(page.text()).toContain('姓名、身分證字號、電話與 Email 不會顯示、儲存或用於判斷');
    expect(page.text()).not.toContain('測試市民');

    await page.get('form').trigger('submit');
    await flushPromises();
    const profile = {
      birthday: '1990-01-01',
      taipeiResident: true,
      domestic183Days: null,
      monthlyIncomePerPerson: null,
      movableAssetsPerPerson: null,
      realEstateHousehold: null,
      traits: [],
    } as const;
    const actionableCount = evaluateBenefits({ ...profile, traits: [] }, today).filter(
      (item) => item.status !== 'unlikely' && benefitAcceptance(item.program.id, today).status !== 'closed',
    ).length;
    const catalogCount = rankCatalogPrograms({ ...profile, traits: [] }, today).filter(
      (item) => !item.excluded && item.acceptance.status !== 'closed' && item.score >= 6,
    ).length;

    expect(page.findAll('.result-card')).toHaveLength(actionableCount);
    expect(page.text()).toContain(`${actionableCount} 項可能可申請`);
    expect(page.text()).not.toContain('目前條件可能不符');
    expect(page.text()).toContain('項不符或未開放');
    expect(page.findAll('.catalog-card')).toHaveLength(catalogCount);
    expect(page.text()).toContain(`${catalogCount} 項符合已填身分的官方候選`);
    expect(page.text()).toContain('項未受理案件');
    expect(page.find('.catalog-toggle').exists()).toBe(catalogCount > 24);

    expect(page.get('.opportunity-modal').text()).toContain('沒申請，你可能錯過');
    expect(page.get('.opportunity-modal').text()).toContain('不代表一定沒有福利');
    await page.get('.opportunity-action').trigger('click');
    expect(page.find('.opportunity-modal').exists()).toBe(false);
  });
});
