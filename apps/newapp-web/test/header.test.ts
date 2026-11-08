import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

/** 頂列（v3）：單獨掛 AppHeader，路由用空白元件。會員頭像與會員面板已移除（2026-11-08） */
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

async function setup(path = '/') {
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
      expect(w.find('[data-test="btn-avatar"]').exists()).toBe(false);
      expect(w.find('[data-test="member-panel"]').exists()).toBe(false);
      expect(w.find('[data-test="btn-favorites"]').exists()).toBe(true);
      expect(w.find('[data-test="header-spacer"]').exists()).toBe(p === '/');
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
