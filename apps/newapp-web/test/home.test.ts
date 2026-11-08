import fixture from './fixtures/subsidy-list.json';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router';
import type { UseQuery } from '@/composables/useQuery';

/** 只掛首頁與幾個空白頁，不依賴 App 外框與正式路由表（v3 平行改版中） */
const Stub = (name: string) => defineComponent({ name, render: () => h('div', { 'data-test': `stub-${name}` }) });

let wrapper: VueWrapper | null = null;

async function mountHome(listJson: unknown | null): Promise<{ wrapper: VueWrapper; router: Router; q: UseQuery }> {
  const fetchMock = vi.fn(async () =>
    listJson === null ? Response.json({ error: 'subsidies_unavailable' }, { status: 503 }) : Response.json(listJson),
  );
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  const { useQuery } = await import('@/composables/useQuery');
  const HomePage = (await import('@/pages/HomePage.vue')).default;
  const q = useQuery();
  await q.loadList();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomePage },
      { path: '/calc', name: 'calc', component: Stub('calc') },
      { path: '/result', name: 'result', component: Stub('result') },
      { path: '/all', name: 'all', component: Stub('all') },
      { path: '/source', name: 'source', component: Stub('source') },
    ],
  });
  await router.push('/');
  await router.isReady();
  const App = defineComponent({ render: () => h('main', [h(RouterView)]) });
  wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router, q };
}

describe('首頁（v3，18.png）', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('大標兩行與「補助計畫」標籤；N 取開放資料筆數', async () => {
    const { wrapper } = await mountHome(fixture);
    const title = wrapper.get('[data-test="hero-title"]');
    expect(title.text()).toBe('規劃你的未來，領取你的補助計畫');
    expect(title.find('br').exists()).toBe(true);
    expect(title.get('.tagword').text()).toBe('補助計畫');
    expect(wrapper.get('[data-test="alert-pill"]').text()).toBe('⚠️ 臺北市 10 項社會救助補助');
    expect(wrapper.get('[data-test="big-count"]').text()).toBe('10 項補助');
    expect(wrapper.text()).toContain('依臺北市社會局公告');
    expect(wrapper.text()).toContain('若是未經試算，您可能正在錯過');
    expect(wrapper.text()).toContain('補助多需主動申請，未申請就領不到');
    expect(wrapper.text()).toContain('資料來源：臺北市社會局・政府資料開放平臺');
    // 首頁不再有表單
    expect(wrapper.find('[data-test="q-form"]').exists()).toBe(false);
    // 不放編造數字
    expect(wrapper.text()).not.toMatch(/\$|%|人找回/);
  });

  it('三列真實補助與關鍵條件（keyCondition；第三列照原型用年齡）', async () => {
    const { wrapper } = await mountHome(fixture);
    const rows = wrapper.findAll('[data-test^="feat-"]');
    expect(rows.map((r) => r.get('.fname').text())).toEqual(['中低收入戶', '市民醫療補助', '中低收入老人生活津貼']);
    expect(wrapper.get('[data-test="feat-4"] .fcond').text()).toBe('每人月收入上限 24,293 元');
    expect(wrapper.get('[data-test="feat-9"] .fcond').text()).toBe('每人月收入上限 28,550 元');
    expect(wrapper.get('[data-test="feat-6"] .fcond').text()).toBe('需 65 歲以上');
  });

  it('CTA 與「即刻免費試算」導向 /calc；「瀏覽全部」導向 /all（含模擬資料的總筆數）', async () => {
    const withMock = (await import('./fixtures/subsidy-list-with-mock.json')).default;
    const { wrapper, router } = await mountHome(withMock);
    const cta = wrapper.get('[data-test="btn-cta"]');
    expect(cta.text()).toBe('填寫資料，開始你的智能試算');
    await cta.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/calc');

    await router.push('/');
    await flushPromises();
    expect(wrapper.get('[data-test="link-calc-pill"]').attributes('href')).toBe('/calc');
    const all = wrapper.get('[data-test="link-all"]');
    expect(all.text()).toBe('瀏覽全部 13 項補助');
    expect(all.attributes('href')).toBe('/all');
    // 社會局公告只算開放資料
    expect(wrapper.get('[data-test="big-count"]').text()).toBe('10 項補助');
  });

  it('[SUBS-R26][SUBS-R27] 已完成：「查看上次結果」到 /result；「重新查詢」呼叫 startOver 回未填', async () => {
    const { wrapper, router, q } = await mountHome(fixture);
    expect(wrapper.find('[data-test="btn-requery"]').exists()).toBe(false);
    q.applyDemo(0);
    await flushPromises();
    expect(q.answersState.value).toBe('completed');
    const cta = wrapper.get('[data-test="btn-cta"]');
    expect(cta.text()).toBe('查看上次結果');
    // 已完成時不顯示示範情境
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(false);

    await wrapper.get('[data-test="btn-requery"]').trigger('click');
    await flushPromises();
    expect(q.answersState.value).toBe('empty');
    expect(router.currentRoute.value.path).toBe('/');
    expect(wrapper.get('[data-test="btn-cta"]').text()).toBe('填寫資料，開始你的智能試算');

    q.applyDemo(1);
    await flushPromises();
    await wrapper.get('[data-test="btn-cta"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/result');
  });

  it('[SUBS-R23] 示範情境三組，點了帶入答案並到 /result', async () => {
    const { wrapper, router, q } = await mountHome(fixture);
    const demos = wrapper.findAll('[data-test^="demo-"]').filter((d) => d.element.tagName === 'BUTTON');
    expect(demos).toHaveLength(3);
    await wrapper.get('[data-test="demo-2"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/result');
    expect(q.answers.value.ageBand).toBe('26-39');
    expect(q.answersState.value).toBe('completed');
  });

  it('[SUBS-R10][SUBS-R22] 清單無法取得：顯示錯誤與重試，沒有 CTA 與示範情境；重試成功後恢復', async () => {
    const { wrapper } = await mountHome(null);
    expect(wrapper.get('[data-test="list-unavailable"]').text()).toContain('暫時無法取得補助資料');
    expect(wrapper.find('[data-test="btn-cta"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="demo-box"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="link-all"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="alert-pill"]').text()).toBe('⚠️ 臺北市社會救助補助');

    vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixture)));
    await wrapper.get('[data-test="btn-retry"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="list-unavailable"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="big-count"]').text()).toBe('10 項補助');
    expect(wrapper.find('[data-test="btn-cta"]').exists()).toBe(true);
  });

  it('[SUBS-R10] 用上次清單時顯示提示與重試', async () => {
    // 先成功一次寫入上次清單，再讓下一次失敗
    localStorage.clear();
    const first = await mountHome(fixture);
    first.wrapper.unmount();
    wrapper = null;
    const { wrapper: w2 } = await mountHome(null);
    expect(w2.get('[data-test="list-cached"]').text()).toContain('目前顯示的是上次載入的資料');
    expect(w2.find('[data-test="btn-retry"]').exists()).toBe(true);
    expect(w2.get('[data-test="big-count"]').text()).toBe('10 項補助');
  });

  it('[W6] 入場小手只播一次，抓大卡右上 1/3；皺摺放射中心對準 2/3 處', async () => {
    const { wrapper } = await mountHome(fixture);
    const hand = document.body.querySelector('[data-test="intro-hand"]') as SVGElement | null;
    expect(hand).not.toBeNull();
    expect(hand!.parentElement).toBe(document.body);
    expect(hand!.getAttribute('style')).toMatch(/left: -?\d+px/);
    const wr = wrapper.get('[data-test="hero-card"] [data-test="wrinkles"]');
    expect(wr.attributes('style')).toMatch(/left: calc\(66\.6+\d*% - 170px\)/);
  });
});
