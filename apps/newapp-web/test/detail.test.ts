import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeBridge } from './helpers/bridge';

/** 詳情彈窗（v3，20.png）：單獨掛 DetailDialog，清單由 useQuery.loadList 從假 fetch 取得 */
let wrapper: VueWrapper | null = null;

async function setup(opts: { demo?: number } = {}) {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(fixtureWithMock)));
  vi.resetModules();
  const { useQuery } = await import('@/composables/useQuery');
  const { useDetail } = await import('@/composables/useDetail');
  const DetailDialog = (await import('@/components/DetailDialog.vue')).default;
  const q = useQuery();
  await q.loadList();
  if (opts.demo !== undefined) q.applyDemo(opts.demo);
  wrapper = mount(DetailDialog, { attachTo: document.body });
  const detail = useDetail();
  async function open(no: number) {
    detail.open(no);
    await flushPromises();
  }
  return { wrapper, q, detail, open };
}

function popstate(): Promise<void> {
  return new Promise((r) => window.addEventListener('popstate', () => r(), { once: true }));
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
});

describe('詳情彈窗內容', () => {
  it('開放資料序號 8：膠囊、名稱、機關簡稱・臺北市適用、三格摘要、三列重點、收件單位、聯繫方式、門檻提醒', async () => {
    const { wrapper: w, open } = await setup({ demo: 2 });
    await open(8);
    expect(w.find('[data-test="detail-dialog"]').exists()).toBe(true);
    expect(w.get('[data-test="d-tags"]').text()).toContain('開放資料 · 臺北市社會局');
    expect(['可能符合', '不符合']).toContain(w.get('[data-test="d-verdict"]').text());
    expect(w.get('[data-test="d-title"]').text()).toBe('生育補助');
    expect(w.get('[data-test="d-org"]').text()).toBe('臺北市政府社會局社會救助科 · 臺北市適用');
    const sum = w.get('[data-test="d-sum"]').text();
    expect(sum).toContain('身分條件');
    expect(sum).toContain('年齡');
    expect(sum).toContain('收入上限');
    expect(sum).toContain('24,293 元');
    expect(w.find('[data-test="d-why"]').exists()).toBe(true);
    expect(w.find('[data-test="d-verify"]').exists()).toBe(true);
    expect(w.find('[data-test="d-docs"]').exists()).toBe(true);
    expect(w.get('[data-test="d-office"]').text()).toBe('臺北市政府社會局社會救助科');
    expect(w.get('[data-test="d-contact"]').text()).toBe('1999分機1621');
    expect(w.get('[data-test="d-notice"]').text()).toContain('門檻以社會局最新公告為準');
    // 只有關閉鈕，沒有首頁鍵
    expect(w.find('[data-test="d-close"]').exists()).toBe(true);
    expect(w.find('[data-test="btn-home"]').exists()).toBe(false);
  });

  it('機關原文是條文片段（序號 7）時頂部改顯示臺北市政府社會局，收件洽辦單位仍是原文', async () => {
    const { wrapper: w, open } = await setup();
    await open(7);
    expect(w.get('[data-test="d-org"]').text()).toBe('臺北市政府社會局 · 臺北市適用');
    expect(w.get('[data-test="d-office"]').text()).toContain('依前述第1點');
  });

  it('沒送出時判定膠囊為尚未比對', async () => {
    const { wrapper: w, open } = await setup();
    await open(2);
    expect(w.get('[data-test="d-verdict"]').text()).toBe('尚未比對');
  });
});

describe('詳情彈窗按鈕', () => {
  it('開放資料：黃色主鈕前往官網申請走 open_link、次鈕連 data.gov.tw/dataset/129839', async () => {
    const post = installFakeBridge(undefined);
    const { wrapper: w, open } = await setup();
    await open(8);
    const apply = w.get('[data-test="d-apply"]');
    expect(apply.text()).toContain('前往官網申請');
    expect(apply.classes()).toContain('cta');
    await apply.trigger('click');
    const ds = w.get('[data-test="d-dataset"]');
    expect(ds.text()).toContain('查看開放資料來源');
    expect(ds.attributes('href')).toBe('https://data.gov.tw/dataset/129839');
    await ds.trigger('click');
    const sent = post.mock.calls.map((c) => JSON.parse(c[0] as string) as { name: string; data: unknown });
    const url8 = fixtureWithMock.items.find((x) => x.no === 8)!.url;
    expect(sent).toContainEqual({ name: 'open_link', data: url8 });
    expect(sent).toContainEqual({ name: 'open_link', data: 'https://data.gov.tw/dataset/129839' });
  });

  it('模擬資料（序號 101）：主鈕不能按、沒有撥號鈕、次鈕仍在', async () => {
    const { wrapper: w, open } = await setup();
    await open(101);
    expect(w.get('[data-test="d-tags"]').text()).toContain('模擬資料');
    expect(w.find('[data-test="d-apply"]').exists()).toBe(false);
    const off = w.get('[data-test="d-apply-off"]');
    expect(off.attributes('disabled')).toBeDefined();
    expect(off.text()).toContain('模擬資料');
    expect(w.find('[data-test="d-call"]').exists()).toBe(false);
    expect(w.find('[data-test="d-dataset"]').exists()).toBe(true);
  });

  it('撥打 1999 只在聯繫方式含 1999 時出現（序號 8 有、序號 2 沒有）', async () => {
    const { wrapper: w, open, detail } = await setup();
    await open(8);
    const call = w.get('[data-test="d-call"]');
    expect(call.text()).toBe('撥打 1999');
    expect(call.attributes('href')).toBe('tel:1999');
    detail.close(true);
    await open(2);
    expect(w.find('[data-test="d-call"]').exists()).toBe(false);
  });
});

describe('詳情彈窗關閉', () => {
  it('開彈窗推一筆 history state；按返回鍵關閉', async () => {
    const { wrapper: w, open } = await setup();
    await open(8);
    expect((window.history.state as { detail?: number }).detail).toBe(8);
    const popped = popstate();
    window.history.back();
    await popped;
    await flushPromises();
    expect(w.find('[data-test="detail-dialog"]').exists()).toBe(false);
  });

  it('Esc 關閉並退掉彈窗那筆 history', async () => {
    const { wrapper: w, open } = await setup();
    await open(8);
    const popped = popstate();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(w.find('[data-test="detail-dialog"]').exists()).toBe(false);
    await popped;
    expect((window.history.state as { detail?: number } | null)?.detail).toBeUndefined();
  });

  it('點背景關閉；點彈窗本體不關', async () => {
    const { wrapper: w, open } = await setup();
    await open(8);
    await w.get('.modal').trigger('click');
    expect(w.find('[data-test="detail-dialog"]').exists()).toBe(true);
    await w.get('[data-test="detail-dialog"]').trigger('click');
    expect(w.find('[data-test="detail-dialog"]').exists()).toBe(false);
  });

  it('關閉鈕關閉', async () => {
    const { wrapper: w, open } = await setup();
    await open(8);
    await w.get('[data-test="d-close"]').trigger('click');
    expect(w.find('[data-test="detail-dialog"]').exists()).toBe(false);
  });
});
