import fixture from './fixtures/subsidy-list.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { answerAll, mountApp, settle } from './helpers/mountApp';

/** v3 主流程整合測試：首頁 → 試算頁填四題 → 結果頁清單卡 → 詳情彈窗（細節各頁另有單元測試） */
const AGE70 = { band: '65+', residency: true, identities: ['none'], income: 3 };

function cardNos(wrapper: VueWrapper, list: 'yes' | 'no'): number[] {
  return wrapper
    .get(`[data-test="list-${list}"]`)
    .findAll('[data-test="list-card"]')
    .map((r) => Number(r.attributes('data-no')));
}
function card(wrapper: VueWrapper, no: number) {
  return wrapper.get(`[data-test="list-card"][data-no="${no}"]`);
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  Element.prototype.scrollIntoView = function () {} as typeof Element.prototype.scrollIntoView;
});
afterEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('主流程：首頁 → 試算 → 結果（S1）', () => {
  it('首頁 CTA 到試算頁，填完四題送出到結果頁；可能符合加不符合合計 10 項', async () => {
    const { wrapper, router } = await mountApp(fixture);
    await wrapper.get('[data-test="btn-cta"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('calc');
    await answerAll(wrapper, AGE70);
    expect(router.currentRoute.value.name).toBe('result');
    expect(wrapper.get('[data-test="found-pill"]').text()).toBe('一共找到了 2 項合適計畫');
    expect(cardNos(wrapper, 'yes').length + cardNos(wrapper, 'no').length).toBe(10);
  });

  it('[SUBS-R13][SUBS-R16][SUBS-R17] 65歲以上情境：可能符合中低收入老人生活津貼、市民醫療補助；急難救助不符合原因', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    expect([...cardNos(wrapper, 'yes')].sort((a, b) => a - b)).toEqual([6, 9]);
    expect(wrapper.get('[data-test="fold-no-summary"]').text()).toBe('不符合的 8 項');
    const c10 = card(wrapper, 10);
    expect(c10.attributes('data-status')).toBe('ineligible');
    expect(c10.get('[data-test="card-key-value"]').text()).toBe('每人每月收入需在 24,293 元以下');
    expect(wrapper.get('[data-test="answer-summary"]').text()).toContain('65歲以上');
    expect(wrapper.get('[data-test="result-notice"]').text()).toContain('門檻以社會局最新公告為準');
  });

  it('修改答案回試算頁，答案還在', async () => {
    const { wrapper, router, q } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="btn-edit"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('calc');
    expect(q.answers.value.ageBand).toBe('65+');
    expect(wrapper.get('[data-test="band-65+"]').attributes('aria-checked')).toBe('true');
  });
});

describe('結果頁開詳情彈窗（S1）', () => {
  it('申辦詳情：收件洽辦單位、聯繫方式、應備文件與資料集原文一致；不符合原因；鎖背景捲動', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await card(wrapper, 10).get('[data-test="card-detail"]').trigger('click');
    await settle();
    const d = wrapper.get('[data-test="detail-dialog"]');
    const src = fixture.items.find((x) => x.no === 10)!;
    expect(d.get('[data-test="d-title"]').text()).toBe('急難救助');
    expect(d.get('[data-test="d-office"]').text()).toBe(src.office);
    expect(d.get('[data-test="d-contact"]').text()).toBe(src.contact);
    for (const doc of src.documents) expect(d.get('[data-test="d-docs"]').text()).toContain(doc);
    expect(d.get('[data-test="d-verdict"]').text()).toBe('不符合');
    expect(d.get('[data-test="d-why"]').text()).toContain('每人每月收入需在 24,293 元以下');
    expect(d.get('[data-test="d-notice"]').text()).toContain('門檻以社會局最新公告為準');
    expect(document.body.classList.contains('locked')).toBe(true);
  });

  it('[4.8] 關閉後 history.back()、彈窗消失、焦點回到原本的按鈕', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    const btn = card(wrapper, 6).get('[data-test="card-detail"]');
    (btn.element as HTMLElement).focus();
    await btn.trigger('click');
    await settle();
    expect((window.history.state as { detail?: number }).detail).toBe(6);
    const back = vi.spyOn(window.history, 'back');
    await wrapper.get('[data-test="d-close"]').trigger('click');
    await settle();
    expect(back).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-test="detail-dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(btn.element);
    expect(document.body.classList.contains('locked')).toBe(false);
  });

  it('前往官網申請用外部連結開', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await card(wrapper, 9).get('[data-test="card-detail"]').trigger('click');
    await settle();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const a = wrapper.get('[data-test="d-apply"]');
    await a.trigger('click');
    expect(open).toHaveBeenCalledWith(a.attributes('href'), '_blank', 'noopener');
  });
});
