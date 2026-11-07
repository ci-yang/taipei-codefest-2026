import fixture from './fixtures/subsidy-list.json';
import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { answerAll, mountApp, settle } from './helpers/mountApp';

function names(wrapper: Awaited<ReturnType<typeof mountApp>>['wrapper'], list: 'yes' | 'no'): string[] {
  const el = wrapper.find(`[data-test="list-${list}"]`);
  return el.exists() ? el.findAll('.bcard b').map((b) => b.text()) : [];
}

const AGE70 = { age: '70', residency: true, identities: ['none'], income: 3 };

describe('問答頁', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(['abc', '121', '', '3.5', '-1'])('[SUBS-R11] 年齡輸入「%s」停在第 1 題並提示', async (input) => {
    const { wrapper } = await mountApp(fixture, '/question');
    await wrapper.get('[data-test="in-age"]').setValue(input);
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    expect(wrapper.get('[data-test="q-err"]').text()).toBe('請輸入 0 到 120 的整數');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 1 題，共 4 題');
  });

  it('[SUBS-R11] 0 與 120 歲可過；進度顯示第 2 題共 4 題', async () => {
    const { wrapper } = await mountApp(fixture, '/question');
    await wrapper.get('[data-test="in-age"]').setValue('0');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 2 題，共 4 題');
    await wrapper.get('[data-test="btn-prev"]').trigger('click');
    await wrapper.get('[data-test="in-age"]').setValue('120');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    expect(wrapper.get('[data-test="q-err"]').text()).toBe('');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 2 題，共 4 題');
  });

  it('[SUBS-R11] 身分沒選時停在第 3 題並提示；設籍、收入沒選也停', async () => {
    const { wrapper } = await mountApp(fixture, '/question');
    await wrapper.get('[data-test="in-age"]').setValue('30');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    expect(wrapper.get('[data-test="q-err"]').text()).toBe('請選擇是或否');
    await wrapper.get('[data-test="res-true"]').trigger('change');
    expect(wrapper.get('[data-test="q-err"]').text()).toBe('');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    expect(wrapper.get('[data-test="q-err"]').text()).toBe('請至少選一項，沒有就選以上皆無');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 3 題，共 4 題');
    await wrapper.get('[data-test="id-none"]').trigger('change');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    expect(wrapper.get('[data-test="btn-next"]').text()).toBe('看結果');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    expect(wrapper.get('[data-test="q-err"]').text()).toBe('請選一個級距，不確定就選不清楚');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 4 題，共 4 題');
  });

  it('[SUBS-R12] 選以上皆無清掉其他身分，選其他清掉以上皆無', async () => {
    const { wrapper, q } = await mountApp(fixture, '/question');
    await wrapper.get('[data-test="in-age"]').setValue('30');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    await wrapper.get('[data-test="res-true"]').trigger('change');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    await wrapper.get('[data-test="id-low"]').trigger('change');
    await wrapper.get('[data-test="id-dis"]').trigger('change');
    expect(q.answers.value.identities).toEqual(['low', 'dis']);
    await wrapper.get('[data-test="id-none"]').trigger('change');
    expect(q.answers.value.identities).toEqual(['none']);
    expect((wrapper.get('[data-test="id-low"]').element as HTMLInputElement).checked).toBe(false);
    await wrapper.get('[data-test="id-mid"]').trigger('change');
    expect(q.answers.value.identities).toEqual(['mid']);
  });
});

describe('結果頁', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('S1 驗收：70 歲、設籍、以上皆無、24,294～28,550 元 → 可能符合 2 項，急難救助原因正確，合計 10', async () => {
    const { wrapper, router } = await mountApp(fixture);
    const t0 = performance.now();
    await answerAll(wrapper, AGE70);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(router.currentRoute.value.name).toBe('result');
    expect(names(wrapper, 'yes')).toEqual(['中低收入老人生活津貼', '市民醫療補助']);
    const no = wrapper.get('[data-test="list-no"]');
    const emergency = no.findAll('.bcard').find((c) => c.text().includes('急難救助'))!;
    expect(emergency.get('.why').text()).toBe('每人每月收入需在 24,293 元以下');
    // [SUBS-R72] 計數膠囊與兩組實際項數一致，合計 10
    const yes = Number(wrapper.get('[data-test="count-yes"]').text());
    const noCount = Number(wrapper.get('[data-test="count-no"]').text());
    expect(yes).toBe(names(wrapper, 'yes').length);
    expect(noCount).toBe(names(wrapper, 'no').length);
    expect(yes + noCount).toBe(10);
    expect(wrapper.get('[data-test="answer-summary"]').text()).toBe(
      '你的答案：70 歲・設籍臺北市・無特殊身分・每人月收入 24,294～28,550 元',
    );
    // [SUBS-R18] 結果頁門檻提醒
    expect(wrapper.get('[data-test="result-notice"]').text()).toContain('門檻以社會局最新公告為準');
  });

  it('[SUBS-R18][SUBS-R07][SUBS-R73] S2 驗收：合計 13 項，組內開放資料在前、模擬在後，模擬每項有「模擬資料」標籤', async () => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    const all = wrapper.findAll('.bcard').map((c) => Number(c.attributes('data-no')));
    expect(all).toHaveLength(13);
    expect(Number(wrapper.get('[data-test="count-yes"]').text()) + Number(wrapper.get('[data-test="count-no"]').text())).toBe(13);
    for (const list of ['yes', 'no'] as const) {
      const nos = wrapper.get(`[data-test="list-${list}"]`).findAll('.bcard').map((c) => Number(c.attributes('data-no')));
      const open = nos.filter((n) => n <= 10);
      const mock = nos.filter((n) => n >= 101);
      expect(nos).toEqual([...open.sort((a, b) => a - b), ...mock.sort((a, b) => a - b)]);
    }
    const mocks = wrapper.findAll('.bcard[data-kind="mock"]');
    expect(mocks.map((c) => Number(c.attributes('data-no')))).toEqual([101, 102, 103]);
    for (const c of mocks) expect(c.get('[data-test="kind-tag"]').text()).toBe('模擬資料');
    for (const c of wrapper.findAll('.bcard[data-kind="open"]')) expect(c.get('[data-test="kind-tag"]').text()).toBe('開放資料');
    // 育兒、租屋、青年 3 項
    expect(mocks.map((c) => c.get('b').text())).toEqual(['新生兒育兒津貼', '青年租屋補貼', '青年職涯探索補助']);
  });

  it.each([
    // 示範情境三組答案手動作答（含模擬為 2、2、7）
    [{ age: '70', residency: true, identities: ['none'], income: 3 }, [6, 9]],
    [{ age: '40', residency: true, identities: ['dis'], income: 4 }, [5, 102]],
    [{ age: '30', residency: true, identities: ['preg', 'mid'], income: 2 }, [4, 7, 8, 9, 10, 101, 102]],
  ])('[SUBS-R23] 示範答案 %j 手動作答的可能符合項目', async (a, expected) => {
    const { wrapper } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, a);
    const yesNos = wrapper.get('[data-test="list-yes"]').findAll('.bcard').map((c) => Number(c.attributes('data-no')));
    expect(yesNos).toEqual(expected);
    expect(wrapper.get('[data-test="count-yes"]').text()).toBe(String(expected.length));
  });

  it('沒有可能符合時顯示「目前沒有可能符合的補助」區塊', async () => {
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, { age: '50', residency: false, identities: ['none'], income: 5 });
    expect(wrapper.get('[data-test="empty-yes"]').text()).toBe('目前沒有可能符合的補助');
    expect(wrapper.get('[data-test="count-yes"]').text()).toBe('0');
    expect(wrapper.get('[data-test="count-no"]').text()).toBe('10');
  });

  it('點計數膠囊捲到該組', async () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    const { wrapper } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="chip-no"]').trigger('click');
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.contexts[0] as HTMLElement).id).toBe('grp-no');
    expect(wrapper.get('[data-test="chip-no"]').classes()).toContain('on');
    await wrapper.get('[data-test="chip-yes"]').trigger('click');
    expect((spy.mock.contexts[1] as HTMLElement).id).toBe('grp-yes');
  });

  it('修改答案回第 1 題且保留答案，改完結果依新答案更新', async () => {
    const { wrapper, router } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="btn-edit"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('question');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 1 題，共 4 題');
    expect((wrapper.get('[data-test="in-age"]').element as HTMLInputElement).value).toBe('70');
    // 改成收入 17,005 元以下，其餘照舊
    for (let i = 0; i < 3; i++) await wrapper.get('[data-test="btn-next"]').trigger('click');
    await wrapper.get('[data-test="inc-1"]').trigger('change');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
    // 低收入戶生活扶助、中低收入戶是申請取得身分（不判身分）；營養品與生育補助仍需低收或中低收身分
    expect(names(wrapper, 'yes')).toEqual(['低收入戶生活扶助', '中低收入戶', '中低收入老人生活津貼', '市民醫療補助', '急難救助']);
  });

  it('沒答完直接開結果頁或詳細資訊頁回開始頁', async () => {
    const { router } = await mountApp(fixture, '/result');
    expect(router.currentRoute.value.name).toBe('home');
    await router.push('/detail/9');
    expect(router.currentRoute.value.name).toBe('home');
  });

  it('[SUBS-R21][SUBS-R70] 作答到看結果，請求只有一次清單、不帶答案，也不寫答案到儲存', async () => {
    const { wrapper, fetchMock } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/subsidies');
    expect(sessionStorage.length).toBe(0);
    for (let i = 0; i < localStorage.length; i++) {
      const v = localStorage.getItem(localStorage.key(i)!) ?? '';
      expect(v).not.toContain('"age"');
    }
    expect(document.cookie).toBe('');
  });
});

describe('詳細資訊頁', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('點補助進 /detail/:no，4 項與資料原文一致，網址開外部連結，返回結果回結果頁', async () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const { wrapper, router } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="list-yes"] .bcard[data-no="9"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.fullPath).toBe('/detail/9');
    const item = fixture.items.find((i) => i.no === 9)!;
    expect(wrapper.get('[data-test="d-title"]').text()).toContain('市民醫療補助');
    expect(wrapper.get('[data-test="d-office"]').element.textContent).toBe(item.office);
    expect(wrapper.get('[data-test="d-contact"]').element.textContent).toBe(item.contact);
    expect(wrapper.get('[data-test="d-docs"]').findAll('li').map((l) => l.element.textContent)).toEqual(item.documents);
    expect(wrapper.get('[data-test="d-url-link"]').attributes('href')).toBe(item.url);
    expect(wrapper.get('[data-test="d-why"]').text()).toContain('可能符合：');
    // [SUBS-R18] 每筆詳情都有門檻提醒
    expect(wrapper.get('[data-test="d-notice"]').text()).toBe('門檻以社會局最新公告為準。');
    // 標頭只在一般頁面出現，詳細資訊頁有自己的頂列
    expect(wrapper.find('header.top').exists()).toBe(false);

    await wrapper.get('[data-test="d-url-link"]').trigger('click');
    expect(openSpy).toHaveBeenCalledWith(item.url, '_blank', 'noopener');

    await wrapper.get('[data-test="btn-back"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
    expect(names(wrapper, 'yes')).toEqual(['中低收入老人生活津貼', '市民醫療補助']);
  });

  it('每一項開放資料的詳細資訊 4 項都有內容', async () => {
    const { wrapper, router } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    for (const item of fixture.items) {
      await router.push(`/detail/${item.no}`);
      await settle();
      for (const f of ['d-office', 'd-contact', 'd-url']) {
        expect(wrapper.get(`[data-test="${f}"]`).text().length, `${item.no} ${f}`).toBeGreaterThan(0);
      }
      expect(wrapper.get('[data-test="d-docs"]').findAll('li').length, `${item.no} docs`).toBeGreaterThan(0);
      expect(wrapper.find('[data-test="d-notice"]').exists()).toBe(true);
    }
  });

  it('台北通殼內點網址走 open_link', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('flutterObject', { postMessage });
    const { wrapper, router } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await router.push('/detail/6');
    await settle();
    await wrapper.get('[data-test="d-url-link"]').trigger('click');
    const item = fixture.items.find((i) => i.no === 6)!;
    expect(JSON.parse(postMessage.mock.calls[0]![0] as string)).toEqual({ name: 'open_link', data: item.url });
  });

  it('序號不在結果裡（亂打）回結果頁', async () => {
    const { wrapper, router } = await mountApp(fixtureWithMock);
    await answerAll(wrapper, AGE70);
    await router.push('/detail/999');
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
  });
});

describe('首頁鍵與開始頁狀態', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('開始頁沒有首頁鍵；未填時是開始查詢，沒有重新查詢', async () => {
    const { wrapper } = await mountApp(fixture);
    expect(wrapper.find('[data-test="btn-home"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="btn-start"]').text()).toBe('開始查詢');
    expect(wrapper.find('[data-test="btn-continue"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="btn-requery"]').exists()).toBe(false);
  });

  it('[SUBS-R26] 填寫中按首頁鍵回開始頁、答案保留，繼續作答回到原題', async () => {
    const { wrapper, router, q } = await mountApp(fixture);
    await wrapper.get('[data-test="btn-start"]').trigger('click');
    await settle();
    await wrapper.get('[data-test="in-age"]').setValue('70');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    await wrapper.get('[data-test="res-true"]').trigger('change');
    await wrapper.get('[data-test="btn-next"]').trigger('click');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 3 題，共 4 題');
    const home = wrapper.get('[data-test="btn-home"]');
    expect(home.attributes('aria-label')).toBe('回首頁');
    await home.trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(q.answers.value.age).toBe(70);
    expect(q.answersState.value).toBe('inProgress');
    expect(wrapper.find('[data-test="btn-start"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="btn-requery"]').exists()).toBe(true);
    await wrapper.get('[data-test="btn-continue"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('question');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 3 題，共 4 題');
  });

  it('[SUBS-R26] 已完成按首頁鍵回開始頁顯示查看結果，按了回結果頁', async () => {
    const { wrapper, router } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="btn-home"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(wrapper.find('[data-test="btn-continue"]').exists()).toBe(false);
    await wrapper.get('[data-test="btn-view-result"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('result');
    expect(wrapper.get('[data-test="count-yes"]').text()).toBe('2');
  });

  it('[SUBS-R27] 重新查詢清除答案、留在開始頁回到未填；再開始從第 1 題', async () => {
    const { wrapper, router, q } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="btn-home"]').trigger('click');
    await settle();
    await wrapper.get('[data-test="btn-requery"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(q.answersState.value).toBe('empty');
    expect(q.currentQuestion.value).toBe(0);
    expect(wrapper.get('[data-test="btn-start"]').text()).toBe('開始查詢');
    expect(wrapper.find('[data-test="btn-requery"]').exists()).toBe(false);
    await wrapper.get('[data-test="btn-start"]').trigger('click');
    await settle();
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 1 題，共 4 題');
    expect((wrapper.get('[data-test="in-age"]').element as HTMLInputElement).value).toBe('');
  });

  it('詳細資訊頁同時有返回結果與首頁鍵，各走各的', async () => {
    const { wrapper, router } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await router.push('/detail/9');
    await settle();
    const top = wrapper.get('.d-top');
    expect(top.get('[data-test="btn-back-top"]').attributes('aria-label')).toBe('返回結果');
    expect(top.get('[data-test="btn-home"]').attributes('aria-label')).toBe('回首頁');
    await top.get('[data-test="btn-home"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('home');
    expect(wrapper.find('[data-test="btn-view-result"]').exists()).toBe(true);
  });

  it('修改答案從第 1 題開始（即使上次停在別題）', async () => {
    const { wrapper, router } = await mountApp(fixture);
    await answerAll(wrapper, AGE70);
    await wrapper.get('[data-test="btn-edit"]').trigger('click');
    await settle();
    expect(router.currentRoute.value.name).toBe('question');
    expect(wrapper.get('[data-test="q-step"]').text()).toBe('第 1 題，共 4 題');
  });
});
