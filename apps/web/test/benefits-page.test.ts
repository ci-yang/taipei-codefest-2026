import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BenefitsPage from '@/pages/BenefitsPage.vue';
import { installMockTownPassBridge } from '@/composables/mockTownPassBridge';

afterEach(() => {
  delete window.flutterObject;
  vi.restoreAllMocks();
});

describe('BenefitsPage TownPass flow', () => {
  it('只帶入生日與臺北市民資訊，送出後呈現全部 19 項', async () => {
    installMockTownPassBridge(true);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const page = mount(BenefitsPage);
    await page.get('.townpass-button').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 180));
    await flushPromises();

    expect((page.get('input[type="date"]').element as HTMLInputElement).value).toBe('1990-01-01');
    expect(page.text()).toContain('姓名、身分證字號、電話與 Email 不會顯示、儲存或用於判斷');
    expect(page.text()).not.toContain('測試市民');

    await page.get('form').trigger('submit');
    await flushPromises();
    expect(page.findAll('.result-card')).toHaveLength(19);
    expect(page.text()).toContain('19 項深度比對');
    expect(page.findAll('.catalog-card')).toHaveLength(24);
    expect(page.get('.catalog-toggle').text()).toContain('顯示全部 165 項');
    await page.get('.catalog-toggle').trigger('click');
    expect(page.findAll('.catalog-card')).toHaveLength(165);
  });
});
