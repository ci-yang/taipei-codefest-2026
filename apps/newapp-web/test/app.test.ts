import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

/** 外框與路由表（v3） */
let wrapper: VueWrapper | null = null;
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
});

describe('路由表', () => {
  it('六個頁面：首頁、試算、結果、全部補助、我的珍藏、資料來源；其他網址回首頁', async () => {
    vi.resetModules();
    const { routes } = await import('@/router');
    const table = routes.filter((r) => r.name).map((r) => [r.path, r.name]);
    expect(table).toEqual([
      ['/', 'home'],
      ['/calc', 'calc'],
      ['/result', 'result'],
      ['/all', 'all'],
      ['/favorites', 'favorites'],
      ['/source', 'source'],
    ]);
    expect(routes.at(-1)).toMatchObject({ path: '/:pathMatch(.*)*', redirect: '/' });
    // 詳情是彈窗，不是路由
    expect(routes.some((r) => r.path.includes('detail'))).toBe(false);
  });

  it('沒送出就開 /result 改到試算頁', async () => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.resetModules();
    const { createAppRouter } = await import('@/router');
    const router = createAppRouter(createMemoryHistory());
    // 不真的載入頁面元件，只看守衛
    for (const r of router.getRoutes()) if (r.components) r.components.default = defineComponent({ render: () => h('div') });
    await router.push('/result');
    expect(router.currentRoute.value.name).toBe('calc');
  });
});

describe('外框', () => {
  it('有頂列、沒有底部導覽列；進入時取一次補助清單', async () => {
    const fetchMock = vi.fn(async (_url: string) => Response.json(fixtureWithMock));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('scrollTo', vi.fn());
    vi.resetModules();
    const App = (await import('@/App.vue')).default;
    const Blank = defineComponent({ render: () => h('div', { 'data-test': 'page' }) });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: ['home', 'calc', 'result', 'all', 'favorites', 'source'].map((name) => ({
        path: name === 'home' ? '/' : `/${name}`,
        name,
        component: Blank,
      })),
    });
    await router.push('/');
    await router.isReady();
    wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
    await flushPromises();
    expect(wrapper.find('[data-test="app-header"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="page"]').exists()).toBe(true);
    expect(document.querySelector('.bnav, [data-test="bottom-nav"]')).toBeNull();
    // 2026-11-08 會員頭像與會員面板已移除，頂列右側只有書籤
    expect(wrapper.find('[data-test="btn-avatar"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="member-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="btn-favorites"]').exists()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/subsidies');
  });

  it('換頁時開著的詳情彈窗收起', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixtureWithMock)));
    vi.stubGlobal('scrollTo', vi.fn());
    vi.resetModules();
    const App = (await import('@/App.vue')).default;
    const { useDetail } = await import('@/composables/useDetail');
    const Blank = defineComponent({ render: () => h('div') });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: Blank },
        { path: '/all', name: 'all', component: Blank },
        { path: '/favorites', name: 'favorites', component: Blank },
        { path: '/source', name: 'source', component: Blank },
        { path: '/calc', name: 'calc', component: Blank },
      ],
    });
    await router.push('/all');
    await router.isReady();
    wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
    await flushPromises();
    useDetail().open(8);
    await flushPromises();
    expect(wrapper.find('[data-test="detail-dialog"]').exists()).toBe(true);
    await router.push('/favorites');
    await flushPromises();
    expect(wrapper.find('[data-test="detail-dialog"]').exists()).toBe(false);
  });
});
