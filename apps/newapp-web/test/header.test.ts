import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { DEMO_ACCOUNT, installFakeBridge } from './helpers/bridge';

/** 頂列與會員面板（v3）：單獨掛 AppHeader，路由用空白元件 */
const Blank = defineComponent({ render: () => h('div') });
const NAMES = ['home', 'calc', 'result', 'all', 'favorites', 'source'] as const;
const PATHS: Record<(typeof NAMES)[number], string> = {
  home: '/',
  calc: '/calc',
  result: '/result',
  all: '/all',
  favorites: '/favorites',
  source: '/source',
};

let wrapper: VueWrapper | null = null;

async function setup(path = '/', opts: { prefill?: boolean } = {}) {
  vi.stubGlobal('scrollTo', vi.fn());
  vi.resetModules();
  const { useQuery } = await import('@/composables/useQuery');
  const AppHeader = (await import('@/components/AppHeader.vue')).default;
  const router = createRouter({
    history: createMemoryHistory(),
    routes: NAMES.map((name) => ({ path: PATHS[name], name, component: Blank })),
  });
  await router.push(path);
  await router.isReady();
  const q = useQuery();
  if (opts.prefill) await q.loadPrefill(new Date(2026, 10, 8));
  wrapper = mount(AppHeader, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router, q };
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
});

describe('頂列', () => {
  it('標題依頁面切換（v4 原型）；首頁沒有圓標「補」、標題置中，其他頁有圓標', async () => {
    const titles: Record<string, string> = {
      '/': '補助通 · 全民智能試算',
      '/calc': '補助通 · 智能試算',
      '/result': '補助通 · 智能補助試算',
      '/all': '補助通 · 全部補助',
      '/favorites': '補助通 · 我的珍藏',
      '/source': '補助通 · 資料來源',
    };
    for (const [p, title] of Object.entries(titles)) {
      const { wrapper: w } = await setup(p);
      expect(w.get('[data-test="app-title"]').text()).toBe(title);
      if (p === '/') {
        expect(w.find('.logo').exists()).toBe(false);
        expect(w.get('[data-test="app-header"]').classes()).toContain('center');
      } else {
        expect(w.get('.logo').text()).toBe('補');
      }
      expect(w.find('[data-test="btn-avatar"]').exists()).toBe(true);
      expect(w.find('[data-test="btn-favorites"]').exists()).toBe(true);
      w.unmount();
      wrapper = null;
    }
  });

  it('首頁鍵只在非首頁顯示，按了回首頁', async () => {
    const home = await setup('/');
    expect(home.wrapper.find('[data-test="btn-home"]').exists()).toBe(false);
    home.wrapper.unmount();
    wrapper = null;
    for (const p of ['/calc', '/result', '/all', '/favorites', '/source']) {
      const { wrapper: w, router } = await setup(p);
      expect(w.find('[data-test="btn-home"]').exists()).toBe(true);
      await w.get('[data-test="btn-home"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.name).toBe('home');
      expect(w.find('[data-test="btn-home"]').exists()).toBe(false);
      w.unmount();
      wrapper = null;
    }
  });

  it('沒有收藏時書籤沒有徽章；有收藏時徽章顯示數量，書籤連到我的珍藏', async () => {
    const empty = await setup('/');
    expect(empty.wrapper.find('[data-test="fav-count"]').exists()).toBe(false);
    expect(empty.wrapper.get('[data-test="btn-favorites"]').attributes('href')).toBe('/favorites');
    empty.wrapper.unmount();
    wrapper = null;

    window.localStorage.setItem('newapp.favorites', JSON.stringify([1, 8, 101]));
    const { wrapper: w, router } = await setup('/');
    expect(w.get('[data-test="fav-count"]').text()).toBe('3');
    await w.get('[data-test="btn-favorites"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('favorites');
  });

  it('徽章跟著收藏切換更新', async () => {
    const { wrapper: w } = await setup('/');
    const { useFavorites } = await import('@/composables/useFavorites');
    useFavorites().toggle(8);
    await flushPromises();
    expect(w.get('[data-test="fav-count"]').text()).toBe('1');
  });
});

describe('會員面板', () => {
  it('沒有 bridge：標題台北通會員、寫未串接台北通，沒有年齡與戶籍', async () => {
    const { wrapper: w } = await setup('/');
    expect(w.find('[data-test="member-panel"]').exists()).toBe(false);
    await w.get('[data-test="btn-avatar"]').trigger('click');
    const p = w.get('[data-test="member-panel"]');
    expect(p.text()).toContain('台北通會員');
    expect(w.get('[data-test="mp-unlinked"]').text()).toContain('未串接台北通');
    expect(w.find('[data-test="mp-info"]').exists()).toBe(false);
  });

  it('有 bridge：顯示年齡區間與「臺北市 · 信義區」，不顯示姓名與身分證字號', async () => {
    installFakeBridge(DEMO_ACCOUNT);
    const { wrapper: w } = await setup('/', { prefill: true });
    await w.get('[data-test="btn-avatar"]').trigger('click');
    // 1990/01/01 在 2026-11-08 為 36 歲
    expect(w.get('[data-test="mp-band"]').text()).toBe('26–39歲');
    expect(w.get('[data-test="mp-place"]').text()).toBe('臺北市 · 信義區');
    expect(w.find('[data-test="mp-unlinked"]').exists()).toBe(false);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain(DEMO_ACCOUNT.realName);
    expect(text).not.toContain(DEMO_ACCOUNT.idNo);
  });

  it('連結：資料來源與門檻說明、瀏覽全部補助；點了換頁並收起面板', async () => {
    const { wrapper: w, router } = await setup('/');
    await w.get('[data-test="btn-avatar"]').trigger('click');
    expect(w.get('[data-test="mp-source"]').attributes('href')).toBe('/source');
    expect(w.get('[data-test="mp-all"]').attributes('href')).toBe('/all');
    await w.get('[data-test="mp-all"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('all');
    expect(w.find('[data-test="member-panel"]').exists()).toBe(false);
  });

  it('清除填寫答案：答案回未填、toast、面板收起；在結果頁時改到試算頁', async () => {
    const { wrapper: w, router, q } = await setup('/result');
    q.setAgeBand('40-64');
    expect(q.answersState.value).toBe('inProgress');
    await w.get('[data-test="btn-avatar"]').trigger('click');
    await w.get('[data-test="mp-clear"]').trigger('click');
    await flushPromises();
    expect(q.answersState.value).toBe('empty');
    expect(q.answers.value.ageBand).toBeNull();
    const { useToast, MSG_CLEARED } = await import('@/composables/useToast');
    expect(useToast().message.value).toBe(MSG_CLEARED);
    expect(w.find('[data-test="member-panel"]').exists()).toBe(false);
    expect(router.currentRoute.value.name).toBe('calc');
  });

  it('Esc、點背景、關閉鈕都會收起', async () => {
    const { wrapper: w } = await setup('/');
    const btn = w.get('[data-test="btn-avatar"]');
    await btn.trigger('click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(w.find('[data-test="member-panel"]').exists()).toBe(false);
    await btn.trigger('click');
    await w.get('[data-test="member-panel"]').trigger('click');
    expect(w.find('[data-test="member-panel"]').exists()).toBe(false);
    await btn.trigger('click');
    await w.get('[data-test="mp-close"]').trigger('click');
    expect(w.find('[data-test="member-panel"]').exists()).toBe(false);
  });
});
