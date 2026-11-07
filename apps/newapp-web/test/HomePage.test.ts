import fixture from './fixtures/subsidy-list.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountApp, settle } from './helpers/mountApp';

describe('開始頁', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('[SUBS-R10][SUBS-R70] 進入服務取一次清單，不帶參數；載完可按開始查詢', async () => {
    const { wrapper, fetchMock } = await mountApp(fixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/subsidies');
    expect(fetchMock.mock.calls[0]![1]?.body).toBeUndefined();
    const btn = wrapper.get('[data-test="btn-start"]');
    expect(btn.text()).toBe('開始查詢');
    expect(btn.attributes('disabled')).toBeUndefined();
    expect(wrapper.text()).toContain('門檻以社會局最新公告為準');
  });

  it('[SUBS-R22] 清單取不到（從未載入過）時看不到開始按鈕，顯示無法取得', async () => {
    const { wrapper } = await mountApp(null);
    await settle();
    expect(wrapper.find('[data-test="btn-start"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="list-unavailable"]').text()).toContain('暫時無法取得補助資料');
  });

  it('按開始查詢到第 1 題', async () => {
    const { wrapper, router } = await mountApp(fixture);
    await wrapper.get('[data-test="btn-start"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('question');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 1 題，共 4 題');
  });
});
