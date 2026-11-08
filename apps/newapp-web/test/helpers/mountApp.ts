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
    import('@/pages/CalculatorPage.vue'),
    import('@/pages/ResultPage.vue'),
    import('@/pages/AllSubsidiesPage.vue'),
    import('@/pages/FavoritesPage.vue'),
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

export interface FormInput {
  /** 年齡區間值（u18、18-25、26-39、40-64、65+），null 不選 */
  band: string | null;
  residency: boolean | null;
  identities: string[];
  /** 1～5 級距、0 不清楚、null 不填 */
  income: number | null;
}

/** 不在試算頁就先換到 /calc（v3 表單搬到試算頁） */
async function toCalc(wrapper: VueWrapper): Promise<void> {
  const router = wrapper.vm.$router;
  if (router.currentRoute.value.name !== 'calc') {
    await router.push('/calc');
    await settle();
  }
}

/** 在試算頁填四題（不送出） */
export async function fillForm(wrapper: VueWrapper, a: FormInput): Promise<void> {
  await toCalc(wrapper);
  if (a.band !== null) await wrapper.get(`[data-test="band-${a.band}"]`).trigger('click');
  if (a.residency !== null) await wrapper.get('[data-test="in-res"]').setValue(String(a.residency));
  for (const id of a.identities) await wrapper.get(`[data-test="id-${id}"]`).trigger('click');
  if (a.income === 0) await wrapper.get('[data-test="br-unknown"]').trigger('click');
  else if (a.income !== null) await wrapper.get(`[data-test="br-${a.income}"]`).trigger('click');
}

/** 在試算頁填四題並按送出 */
export async function answerAll(wrapper: VueWrapper, a: FormInput): Promise<void> {
  await fillForm(wrapper, a);
  await wrapper.get('[data-test="btn-submit"]').trigger('click');
  await settle();
}
