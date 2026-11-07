import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/pages/HomePage.vue';

describe('HomePage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('API 回應正常時顯示服務名稱', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true, service: 'newapp-api', time: '2026-11-08T00:00:00.000Z' })),
    );
    const wrapper = mount(HomePage);
    await flushPromises();
    expect(wrapper.get('[data-test="api-up"]').text()).toContain('newapp-api');
  });

  it('API 失敗時顯示錯誤', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const wrapper = mount(HomePage);
    await flushPromises();
    expect(wrapper.get('[data-test="api-down"]').text()).toContain('500');
  });
});
