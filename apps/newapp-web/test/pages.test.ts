import fixture from './fixtures/subsidy-list.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { answerAll, mountApp, settle } from './helpers/mountApp';

const AGE70 = { band: '65+', residency: true, identities: ['none'], income: 3 };

function rowNos(wrapper: VueWrapper, list: 'yes' | 'no'): number[] {
  return wrapper.get(`[data-test="list-${list}"]`).findAll('[data-test="row"]').map((r) => Number(r.attributes('data-no')));
}
function row(wrapper: VueWrapper, no: number) {
  return wrapper.get(`[data-test="row"][data-no="${no}"]`);
}
async function toList(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[data-test="view-list"]').trigger('click');
  await settle();
}

let scrolled: Element[] = [];

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  } as typeof Element.prototype.scrollIntoView;
});
afterEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('結果頁清單（S1）', () => {
  it('[SUBS-R72] HEY 膠囊與大標；可能符合加不符合合計 10 項，清單呈現', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    expect(wrapper.get('[data-test="hey"]').text()).toBe('HEY, 找到了 2 項方案 ✨');
    expect(wrapper.get('[data-test="page-result"]').text()).toContain('為你量身試算的專屬補助方案');
    await toList(wrapper);
    expect(rowNos(wrapper, 'yes').length + rowNos(wrapper, 'no').length).toBe(10);
  });

  it('[SUBS-R13][SUBS-R16][SUBS-R17] 65歲+ 情境：可能符合中低收入老人生活津貼、市民醫療補助；急難救助不符合原因', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await toList(wrapper);
    expect(rowNos(wrapper, 'yes')).toEqual([6, 9]);
    const r10 = row(wrapper, 10);
    expect(r10.classes()).toContain('no');
    expect(r10.get('[data-test="row-why"]').text()).toBe('每人每月收入需在 24,293 元以下');
    expect(wrapper.get('[data-test="answer-summary"]').text()).toBe(
      '你的答案：65歲+・設籍臺北市・無特殊身分・每人月收入 24,294～28,550 元',
    );
    expect(wrapper.get('[data-test="result-notice"]').text()).toContain('門檻以社會局最新公告為準');
  });

  it('計數膠囊與兩組項數一致，清單模式點了捲到該組', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await toList(wrapper);
    expect(Number(wrapper.get('[data-test="count-yes"]').text())).toBe(rowNos(wrapper, 'yes').length);
    expect(Number(wrapper.get('[data-test="count-no"]').text())).toBe(rowNos(wrapper, 'no').length);
    await wrapper.get('[data-test="chip-no"]').trigger('click');
    expect(scrolled.at(-1)?.id).toBe('grp-no');
    expect(wrapper.get('[data-test="chip-no"]').classes()).toContain('on');
    await wrapper.get('[data-test="chip-yes"]').trigger('click');
    expect(scrolled.at(-1)?.id).toBe('grp-yes');
  });

  it('直接開 /result（沒送出）回首頁', async () => {
    const { router } = await mountApp(fixture, '/result');
    expect(router.currentRoute.value.name).toBe('home');
  });
});

describe('詳細資訊彈窗（S1）', () => {
  it('點清單列開彈窗：收件洽辦單位、聯繫方式、應備文件、網址 4 項與資料集原文一致；沒有首頁鍵', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await toList(wrapper);
    await row(wrapper, 10).get('[data-test="row-main"]').trigger('click');
    await settle();
    const d = wrapper.get('[data-test="detail-dialog"]');
    const src = fixture.items.find((x) => x.no === 10)!;
    expect(d.get('[data-test="d-title"]').text()).toBe('急難救助');
    expect(d.get('[data-test="d-office"]').text()).toBe(src.office);
    expect(d.get('[data-test="d-contact"]').text()).toBe(src.contact);
    expect(d.get('[data-test="d-docs"]').findAll('li').map((li) => li.text())).toEqual(src.documents);
    expect(d.get('[data-test="d-url-link"]').text()).toBe(src.url);
    expect(d.get('[data-test="d-verdict"]').text()).toBe('不符合');
    expect(d.get('[data-test="d-why"]').text()).toBe('不符合：每人每月收入需在 24,293 元以下');
    expect(d.get('[data-test="d-notice"]').text()).toContain('門檻以社會局最新公告為準');
    expect(d.find('[data-test="btn-home"]').exists()).toBe(false);
    expect(d.find('[data-test="d-close"]').exists()).toBe(true);
    expect(document.body.classList.contains('locked')).toBe(true);
  });

  it('點網址用外部連結開', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await row(wrapper, 9).get('[data-test="row-main"]').trigger('click');
    await settle();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const a = wrapper.get('[data-test="d-url-link"]');
    await a.trigger('click');
    expect(open).toHaveBeenCalledWith(a.attributes('href'), '_blank', 'noopener');
  });

  it('[4.8] 開啟推一筆 history；按關閉 history.back()、彈窗消失、焦點回到原本的列', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await toList(wrapper);
    const lenBefore = window.history.length;
    const main = row(wrapper, 6).get('[data-test="row-main"]');
    (main.element as HTMLElement).focus();
    await main.trigger('click');
    await settle();
    expect(window.history.length).toBe(lenBefore + 1);
    expect((window.history.state as { detail?: number }).detail).toBe(6);
    const back = vi.spyOn(window.history, 'back');
    await wrapper.get('[data-test="d-close"]').trigger('click');
    await settle();
    expect(back).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-test="detail-dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(main.element);
    expect(document.body.classList.contains('locked')).toBe(false);
  });

  it('[4.8] 返回鍵（popstate）關閉彈窗，不再 history.back()', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await row(wrapper, 6).get('[data-test="row-main"]').trigger('click');
    await settle();
    const back = vi.spyOn(window.history, 'back');
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    await settle();
    expect(wrapper.find('[data-test="detail-dialog"]').exists()).toBe(false);
    expect(back).not.toHaveBeenCalled();
  });

  it('[4.8] Esc 與點背景關閉', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await row(wrapper, 6).get('[data-test="row-main"]').trigger('click');
    await settle();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    expect(wrapper.find('[data-test="detail-dialog"]').exists()).toBe(false);
    await row(wrapper, 9).get('[data-test="row-main"]').trigger('click');
    await settle();
    // 點彈窗內容不關
    await wrapper.get('[data-test="d-title"]').trigger('click');
    expect(wrapper.find('[data-test="detail-dialog"]').exists()).toBe(true);
    await wrapper.get('[data-test="detail-dialog"]').trigger('click');
    await settle();
    expect(wrapper.find('[data-test="detail-dialog"]').exists()).toBe(false);
  });
});
