import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, vi } from 'vitest';
import { createMemoryHistory, type Router } from 'vue-router';
import type { UseQuery } from '@/composables/useQuery';

/** 掛過的 App；每案結束與下一次掛載前先卸載，避免入場動畫計時器在 DOM 清掉後還去改畫面 */
const mounted: VueWrapper[] = [];
function unmountAll(): void {
  for (const w of mounted.splice(0)) w.unmount();
}
afterEach(unmountAll);

/**
 * useQuery 是模組層級狀態：每次重新載入模組，掛上整個 App 與記憶體路由。
 * fetchImpl 預設回 listJson；給 null 則模擬 #1 失敗（503）。
 */
export async function mountApp(listJson: unknown | null, path = '/') {
  unmountAll();
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    listJson === null ? Response.json({ error: 'subsidies_unavailable' }, { status: 503 }) : Response.json(listJson),
  );
  vi.stubGlobal('fetch', fetchMock);
  // jsdom 沒有實作 scrollTo（router scrollBehavior 會呼叫）
  vi.stubGlobal('scrollTo', vi.fn());
  vi.resetModules();
  const { createAppRouter } = await import('@/router');
  const { useQuery } = await import('@/composables/useQuery');
  const App = (await import('@/App.vue')).default;
  // 先載好各頁（路由是 lazy import），避免第一次換頁還在轉譯時斷言
  await Promise.all([
    import('@/pages/HomePage.vue'),
    import('@/pages/QuestionPage.vue'),
    import('@/pages/ResultPage.vue'),
    import('@/pages/DetailPage.vue'),
    import('@/pages/SourcePage.vue'),
  ]);
  const router: Router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper: VueWrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body });
  mounted.push(wrapper);
  await flushPromises();
  const q: UseQuery = useQuery();
  return { wrapper, router, q, fetchMock };
}

export async function settle(): Promise<void> {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await flushPromises();
}

/** 在畫面上依序回答四題（從開始頁按開始查詢起） */
export async function answerAll(
  wrapper: VueWrapper,
  a: { age: string; residency: boolean; identities: string[]; income: number },
): Promise<void> {
  await wrapper.get('[data-test="btn-start"]').trigger('click');
  await settle();
  await wrapper.get('[data-test="in-age"]').setValue(a.age);
  await wrapper.get('[data-test="btn-next"]').trigger('click');
  await wrapper.get(`[data-test="res-${a.residency}"]`).trigger('change');
  await wrapper.get('[data-test="btn-next"]').trigger('click');
  for (const id of a.identities) await wrapper.get(`[data-test="id-${id}"]`).trigger('change');
  await wrapper.get('[data-test="btn-next"]').trigger('click');
  await wrapper.get(`[data-test="inc-${a.income}"]`).trigger('change');
  await wrapper.get('[data-test="btn-next"]').trigger('click');
  await settle();
}
