import fixture from './fixtures/subsidy-list.json';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent } from 'vue';
import type { Answers, SubsidyList } from '@app/shared';
import { DEMO_ACCOUNT, installFakeBridge } from './helpers/bridge';

const Stub = defineComponent({ template: '<div />' });
const wrappers: VueWrapper[] = [];
let scrolled: Element[] = [];

/** 只掛試算頁（路由由 E 建立，這裡自建 /、/calc、/result）；每次重載模組讓 useQuery 歸零 */
async function mountCalc(listJson: unknown | null, opts: { bridge?: unknown } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      listJson === null ? Response.json({ error: 'subsidies_unavailable' }, { status: 503 }) : Response.json(listJson),
    ),
  );
  if (opts.bridge !== undefined) installFakeBridge(opts.bridge);
  vi.resetModules();
  const { useQuery } = await import('@/composables/useQuery');
  const Calc = (await import('@/pages/CalculatorPage.vue')).default;
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      { path: '/calc', name: 'calc', component: Calc },
      { path: '/result', name: 'result', component: Stub },
    ],
  });
  await router.push('/calc');
  await router.isReady();
  const q = useQuery();
  await q.loadList();
  await q.loadPrefill(new Date(2026, 10, 8));
  const wrapper = mount(Calc, { global: { plugins: [router] }, attachTo: document.body });
  wrappers.push(wrapper);
  await flushPromises();
  return { wrapper, router, q };
}

const t = (w: VueWrapper, id: string) => w.get(`[data-test="${id}"]`);

describe('試算頁（v3 16.png）', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    scrolled = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    } as typeof Element.prototype.scrollIntoView;
  });
  afterEach(() => {
    for (const w of wrappers.splice(0)) w.unmount();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('進度條 n/4 與百分比隨已填題數變化', async () => {
    const { wrapper: w } = await mountCalc(fixture);
    expect(t(w, 'prog-step').text()).toBe('填寫基本資料 (0/4)');
    expect(t(w, 'prog-pct').text()).toBe('已完成 0%');
    await t(w, 'band-65+').trigger('click');
    expect(t(w, 'prog-step').text()).toBe('填寫基本資料 (1/4)');
    await t(w, 'res-true').trigger('click');
    await t(w, 'id-none').trigger('click');
    expect(t(w, 'prog-pct').text()).toBe('已完成 75%');
    await t(w, 'br-3').trigger('click');
    expect(t(w, 'prog-step').text()).toBe('填寫基本資料 (4/4)');
    expect(t(w, 'prog-pct').text()).toBe('已完成 100%');
  });

  it('即時 N 隨填寫變化，填完時等於正式比對的可能符合項數', async () => {
    const { wrapper: w, q } = await mountCalc(fixture);
    const n = () => Number(w.get('[data-test="live-text"] em').text());
    const total = (fixture as SubsidyList).items.length;
    expect(n()).toBe(total);
    expect(t(w, 'sum-total').text()).toBe(`已比對 ${total} 項`);
    expect(t(w, 'live-pill').text()).toBe('即時比對');
    await t(w, 'band-26-39').trigger('click');
    const afterAge = n();
    expect(afterAge).toBeLessThan(total);
    await t(w, 'res-false').trigger('click');
    expect(n()).toBeLessThanOrEqual(afterAge);
    await t(w, 'id-none').trigger('click');
    await t(w, 'br-5').trigger('click');
    const live = n();
    expect(t(w, 'sum-count').text()).toBe(`${live} 項`);
    expect(t(w, 'btn-submit').text()).toContain(`(${live})`);
    // 填完時與 groupResults 一致
    const { groupResults, isCompleted } = await import('@/lib/match');
    const a: Answers = q.answers.value;
    if (!isCompleted(a)) throw new Error('應已填完');
    expect(live).toBe(groupResults((fixture as SubsidyList).items, a).eligible.length);
  });

  it('年齡單選：選中只有一格、帶勾勾', async () => {
    const { wrapper: w } = await mountCalc(fixture);
    expect(w.findAll('[data-test^="band-"]')).toHaveLength(5);
    expect(t(w, 'band-u18').text()).toContain('就學補助');
    await t(w, 'band-18-25').trigger('click');
    await t(w, 'band-40-64').trigger('click');
    const on = w.findAll('[data-test^="band-"]').filter((b) => b.attributes('aria-checked') === 'true');
    expect(on.map((b) => b.attributes('data-test'))).toEqual(['band-40-64']);
    expect(on[0]!.find('.check').exists()).toBe(true);
    expect(t(w, 'band-18-25').find('.check').exists()).toBe(false);
  });

  it('台北通帶入：年齡區間標「台北通帶入」、戶籍「已定位」、下拉顯示臺北市 · 信義區；會員卡；不顯示姓名身分證', async () => {
    const { wrapper: w } = await mountCalc(fixture, { bridge: DEMO_ACCOUNT });
    // 1990/01/01 → 2026-11-08 為 36 歲
    expect(t(w, 'band-26-39').attributes('aria-checked')).toBe('true');
    expect(t(w, 'band-26-39').find('[data-test="age-tp"]').text()).toBe('台北通帶入');
    expect(t(w, 'res-tp').text()).toContain('已定位');
    expect(t(w, 'res-true').attributes('aria-checked')).toBe('true');
    expect(t(w, 'opt-taipei').text()).toBe('臺北市 · 信義區');
    expect((t(w, 'in-res').element as HTMLSelectElement).value).toBe('true');
    expect(t(w, 'member-title').text()).toContain('台北通會員');
    expect(t(w, 'member-text').text()).toBe('已串接台北通會員資料，年齡區間與戶籍已自動帶入');
    expect(t(w, 'prog-step').text()).toBe('填寫基本資料 (2/4)');
    expect(w.text()).not.toContain(DEMO_ACCOUNT.realName);
    expect(w.text()).not.toContain(DEMO_ACCOUNT.idNo);
    // 改成其他縣市：不再標已定位
    await t(w, 'res-false').trigger('click');
    expect(w.find('[data-test="res-tp"]').exists()).toBe(false);
  });

  it('沒有 bridge：會員卡顯示「未串接台北通，請手動填寫」，沒有帶入標示', async () => {
    const { wrapper: w } = await mountCalc(fixture);
    expect(t(w, 'member-text').text()).toBe('未串接台北通，請手動填寫');
    expect(w.find('[data-test="age-tp"]').exists()).toBe(false);
    expect(w.find('[data-test="res-tp"]').exists()).toBe(false);
  });

  it('「以上皆無」與其他身分互斥', async () => {
    const { wrapper: w } = await mountCalc(fixture);
    const on = () => w.findAll('[data-test^="id-"]').filter((b) => b.attributes('aria-checked') === 'true').map((b) => b.attributes('data-test'));
    await t(w, 'id-low').trigger('click');
    await t(w, 'id-dis').trigger('click');
    expect(on()).toEqual(['id-low', 'id-dis']);
    await t(w, 'id-none').trigger('click');
    expect(on()).toEqual(['id-none']);
    await t(w, 'id-preg').trigger('click');
    expect(on()).toEqual(['id-preg']);
  });

  it('四種錯誤訊息；捲到第一張有錯的卡；改該題清掉該題錯誤', async () => {
    const { wrapper: w, router } = await mountCalc(fixture);
    await t(w, 'btn-submit').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('calc');
    expect(t(w, 'err-0').text()).toBe('請選擇年齡區間');
    expect(t(w, 'err-1').text()).toBe('請選擇戶籍縣市');
    expect(t(w, 'err-2').text()).toBe('請至少選一項，沒有就選以上皆無');
    expect(t(w, 'err-3').text()).toBe('請選一個級距，不確定就選不清楚');
    expect(scrolled[0]).toBe(t(w, 'card-age').element);
    expect(document.activeElement).toBe(t(w, 'band-u18').element);
    await t(w, 'band-65+').trigger('click');
    expect(w.find('[data-test="err-0"]').exists()).toBe(false);
    expect(w.find('[data-test="err-1"]').exists()).toBe(true);
    scrolled = [];
    await t(w, 'btn-submit').trigger('click');
    await flushPromises();
    expect(scrolled[0]).toBe(t(w, 'card-res').element);
  });

  it('四題填完送出導到 /result', async () => {
    const { wrapper: w, router, q } = await mountCalc(fixture);
    await t(w, 'band-65+').trigger('click');
    await t(w, 'in-res').setValue('true');
    await t(w, 'id-none').trigger('click');
    await t(w, 'br-unknown').trigger('click');
    await t(w, 'btn-submit').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('result');
    expect(q.answersState.value).toBe('completed');
  });

  it('清單無法使用：整張表單停用、沒有送出鈕、有重試', async () => {
    const { wrapper: w } = await mountCalc(null);
    expect(t(w, 'q-form').attributes('disabled')).toBeDefined();
    expect(w.find('[data-test="btn-submit"]').exists()).toBe(false);
    expect(w.find('[data-test="list-unavailable"]').exists()).toBe(true);
    expect(w.find('[data-test="btn-retry"]').exists()).toBe(true);
  });

  it('收入長條圖只顯示：選中的那條亮起來', async () => {
    const { wrapper: w } = await mountCalc(fixture);
    await t(w, 'br-2').trigger('click');
    expect(t(w, 'bar-2').classes()).toContain('on');
    expect(w.findAll('.bar.on')).toHaveLength(1);
    expect(t(w, 'income-bars').attributes('aria-hidden')).toBe('true');
    expect(w.text()).toContain('全家每月總收入除以家中人數');
  });
});
