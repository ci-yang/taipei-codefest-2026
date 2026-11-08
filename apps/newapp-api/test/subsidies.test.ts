import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubsidyListSchema, type SubsidyList } from '@app/shared';
import { createApp } from '../src/app';
import curatedJson from '../src/data/curated-subsidies.json';
import openBenefitJson from '../src/data/open-benefit-text.json';
import { DEFAULT_EXTRA_DATA } from '../src/lib/curated';
import {
  CACHE_TTL_MS,
  CURATED_NO_MIN,
  MOCK_NO_MIN,
  RETRY_AFTER_MS,
  buildSubsidyList,
  createSubsidyCache,
  latestImportDate,
  parseAge,
  parseDocuments,
  parseIdentities,
  parseIncome,
  parseResidency,
  type RawRecord,
} from '../src/lib/subsidies';

/** 2026-11-08 實抓 data.taipei rid 549a3347-… 的完整回應（10 筆） */
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/data-taipei-subsidies.json', import.meta.url), 'utf8'),
) as { result: { results: RawRecord[] } };
const records = fixture.result.results;

const byNo = (list: SubsidyList, no: number) => {
  const item = list.items.find((i) => i.no === no);
  if (!item) throw new Error(`沒有序號 ${no}`);
  return item;
};

describe('補助清單整理（純函式）', () => {
  it('[SUBS-R01] 「N歲」取 N，「沒有規範」取 null，文字取 null 並回原文', () => {
    expect(parseAge('65歲')).toEqual({ age: 65, text: null });
    expect(parseAge('沒有規範')).toEqual({ age: null, text: null });
    expect(parseAge('109年臺北市低收入戶家庭生活扶助標準表')).toEqual({
      age: null,
      text: '109年臺北市低收入戶家庭生活扶助標準表',
    });
  });

  it('[SUBS-R02] 設籍條件含台北市或臺北市才需設籍', () => {
    expect(parseResidency('台北市')).toBe(true);
    expect(parseResidency('臺北市')).toBe(true);
    expect(parseResidency('沒有規範')).toBe(false);
  });

  it('[SUBS-R03] 「中低收入戶」整詞比對為 mid，不誤判為低收入戶', () => {
    expect(parseIdentities('中低收入戶')).toEqual(['mid']);
    expect(parseIdentities('低收入戶')).toEqual(['low']);
    expect(parseIdentities('低收入戶或中低收入戶').sort()).toEqual(['low', 'mid']);
    expect(parseIdentities('身心障礙者')).toEqual(['dis']);
    expect(parseIdentities('老人')).toEqual(['elder']);
  });

  it('[SUBS-R03] 含「一般市民」或「沒有規範」取空陣列；對不到的詞不納入並回報', () => {
    expect(parseIdentities('低收及中收入戶、本局予以保護、安置者、符合財稅審核資格之一般市民')).toEqual([]);
    expect(parseIdentities('沒有規範')).toEqual([]);
    const unknown: string[] = [];
    expect(parseIdentities('低收入戶、外星人', (w) => unknown.push(w))).toEqual(['low']);
    expect(unknown).toEqual(['外星人']);
  });

  it('[SUBS-R04] 收入上限取整數元；非數字為 null 並回原文', () => {
    expect(parseIncome('24293')).toEqual({ incomeMax: 24293, text: null });
    expect(parseIncome('24,293')).toEqual({ incomeMax: 24293, text: null });
    expect(parseIncome('沒有規範')).toEqual({ incomeMax: null, text: null });
    expect(parseIncome('依標準表')).toEqual({ incomeMax: null, text: '依標準表' });
  });

  it('[SUBS-R06] 應備文件依換行或連續空白拆開，去掉空字串', () => {
    expect(parseDocuments('1.申請表\n2.影本。\n')).toEqual(['1.申請表', '2.影本。']);
    expect(parseDocuments('1.申請表。      2. 收據正本。   3.證明。\n')).toEqual([
      '1.申請表。',
      '2. 收據正本。',
      '3.證明。',
    ]);
  });

  it('[SUBS-R08] _importdate 物件取最大值並轉成 +08:00', () => {
    const fetchedAt = new Date('2026-11-08T00:00:00Z');
    expect(
      latestImportDate(
        [
          { _importdate: { date: '2024-12-19 19:09:52.918658', timezone: 'Asia/Taipei' } },
          { _importdate: { date: '2024-12-20 08:00:01.1', timezone: 'Asia/Taipei' } },
          { _importdate: { date: '2024-01-01 00:00:00.0', timezone: 'Asia/Taipei' } },
        ],
        fetchedAt,
      ),
    ).toBe('2024-12-20T08:00:01+08:00');
  });

  it('[SUBS-R08] 沒有 _importdate 時用抓取時間', () => {
    expect(latestImportDate([{}], new Date('2026-11-08T01:02:03Z'))).toBe('2026-11-08T09:02:03+08:00');
  });
});

describe('補助清單整理（實抓資料 10 筆）', () => {
  const list = buildSubsidyList(records, new Date('2026-11-08T00:00:00Z'));

  const OPEN_NOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const CURATED_NOS = Array.from({ length: 15 }, (_, i) => 201 + i);

  it('[SUBS-R07] 共 28 項：開放資料 10 項 → 官方網頁整理 15 項 → 模擬 3 項，通過契約', () => {
    const parsed = SubsidyListSchema.parse(list);
    expect(parsed.items).toHaveLength(28);
    expect(parsed.items.map((i) => i.no)).toEqual([...OPEN_NOS, ...CURATED_NOS, 101, 102, 103]);
    expect(parsed.items.map((i) => i.kind)).toEqual([
      ...OPEN_NOS.map(() => 'open'),
      ...CURATED_NOS.map(() => 'curated'),
      'mock',
      'mock',
      'mock',
    ]);
    expect(list.source.rid).toBe('549a3347-df6e-4bed-b818-368210d01544');
  });

  it('[ADR-035] sources 依序列出三種來源與項數', () => {
    expect(list.sources.map((s) => [s.kind, s.label, s.count, s.verifiedAt])).toEqual([
      ['open', '開放資料', 10, null],
      ['curated', '官方網頁整理', 15, '2026-11-08'],
      ['mock', '模擬資料', 3, null],
    ]);
  });

  it('[SUBS-R74] 開放資料的實際補助原文依序號對上 open-benefit-text；序號 4 查不到為 null', () => {
    for (const b of openBenefitJson.items) {
      const item = byNo(list, b.no);
      expect(item.benefitText).toBe(b.benefitText);
      if (b.benefitText === null) {
        expect(item).toMatchObject({ sourceUrl: null, verifiedAt: null });
      } else {
        expect(item).toMatchObject({ sourceUrl: b.sources[0], verifiedAt: '2026-11-08' });
      }
    }
    expect(byNo(list, 4)).toMatchObject({ benefitText: null, sourceUrl: null, verifiedAt: null });
    expect(byNo(list, 2).benefitText).toContain('6,825 元');
  });

  it('[SUBS-R74] 官方網頁整理照 JSON 原文；benefitText null 的項目仍有來源網址與查證日', () => {
    for (const c of curatedJson.items) {
      expect(byNo(list, c.no)).toMatchObject({
        kind: 'curated',
        name: c.name,
        benefitText: c.benefitText,
        sourceUrl: c.sourceUrl,
        verifiedAt: c.verifiedAt,
      });
    }
    expect(byNo(list, 201)).toMatchObject({ benefitText: null, sourceUrl: 'https://udd.gov.taipei/collection/oo2cmrc' });
    expect(byNo(list, 212).benefitText).toBe('每人每月最多補助 826 元，低於 826 元者核實補助。');
  });

  it('[SUBS-R74] 模擬類別三個欄位都是 null', () => {
    for (const no of [101, 102, 103]) {
      expect(byNo(list, no)).toMatchObject({ benefitText: null, sourceUrl: null, verifiedAt: null });
    }
  });

  it('[SUBS-R74] 開放資料名稱與原文對不上時不補原文', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renamed = records.map((r) => (r['序號'] === '2' ? { ...r, 補助名稱: '改名的補助' } : r));
    const l = buildSubsidyList(renamed, new Date('2026-11-08T00:00:00Z'));
    expect(byNo(l, 2)).toMatchObject({ benefitText: null, sourceUrl: null, verifiedAt: null });
    vi.restoreAllMocks();
  });

  it('[SUBS-R07] 模擬 3 項的名稱與條件', () => {
    expect(byNo(list, 101)).toMatchObject({
      kind: 'mock',
      name: '新生兒育兒津貼',
      ageMin: null,
      ageMax: null,
      residency: true,
      identities: ['preg'],
      incomeMax: null,
      url: '',
    });
    expect(byNo(list, 102)).toMatchObject({
      kind: 'mock',
      name: '青年租屋補貼',
      ageMin: 20,
      ageMax: 40,
      residency: true,
      identities: [],
      incomeMax: 33252,
    });
    expect(byNo(list, 103)).toMatchObject({
      kind: 'mock',
      name: '青年職涯探索補助',
      ageMin: 18,
      ageMax: 29,
      residency: true,
      identities: [],
      incomeMax: null,
    });
  });

  it('[SUBS-R73] 序號區段：1～100 開放、101～200 模擬、201 起官方網頁整理', () => {
    for (const i of list.items) {
      expect(i.kind === 'open').toBe(i.no < MOCK_NO_MIN);
      expect(i.kind === 'mock').toBe(i.no >= MOCK_NO_MIN && i.no < CURATED_NO_MIN);
      expect(i.kind === 'curated').toBe(i.no >= CURATED_NO_MIN);
    }
  });

  it('[SUBS-R73] 官方網頁整理序號落在 200 以下視為整理失敗', () => {
    const bad = {
      ...DEFAULT_EXTRA_DATA,
      curated: { ...curatedJson, items: curatedJson.items.map((c, idx) => (idx === 0 ? { ...c, no: 150 } : c)) },
    };
    expect(() => buildSubsidyList(records, new Date(), bad)).toThrow(/官方網頁整理資料格式錯誤/);
  });

  it('[ADR-035] 官方網頁整理 JSON 缺欄位、開放資料原文格式錯誤都視為整理失敗', () => {
    const noUrl = {
      ...DEFAULT_EXTRA_DATA,
      curated: { ...curatedJson, items: curatedJson.items.map(({ sourceUrl: _drop, ...c }) => c) },
    };
    expect(() => buildSubsidyList(records, new Date(), noUrl)).toThrow(/官方網頁整理資料格式錯誤/);
    const badOpen = { ...DEFAULT_EXTRA_DATA, openBenefit: { meta: openBenefitJson.meta, items: 'x' } };
    expect(() => buildSubsidyList(records, new Date(), badOpen)).toThrow(/開放資料實際補助原文格式錯誤/);
  });

  it('[SUBS-R73] 開放資料序號落在 101 以上視為整理失敗', () => {
    const bad = records.map((r, idx) => (idx === 0 ? { ...r, 序號: '101' } : r));
    expect(() => buildSubsidyList(bad)).toThrow(/模擬類別區段/);
  });

  it('[SUBS-R08] updatedAt 為 2024-12-19T19:09:52+08:00', () => {
    expect(list.updatedAt).toBe('2024-12-19T19:09:52+08:00');
  });

  it('[SUBS-R01][SUBS-R03][SUBS-R04] 序號 6 中低收入老人生活津貼', () => {
    expect(byNo(list, 6)).toMatchObject({
      name: '中低收入老人生活津貼',
      ageMin: 65,
      ageMax: null,
      residency: true,
      identities: ['elder'],
      appliesForStatus: false,
      incomeMax: 33252,
    });
  });

  it('[SUBS-R03] 序號 4「中低收入戶」為 mid 且是申請取得身分；序號 1 以名稱判定申請取得身分', () => {
    expect(byNo(list, 4)).toMatchObject({ identities: ['mid'], appliesForStatus: true });
    expect(byNo(list, 1)).toMatchObject({ identities: ['low'], appliesForStatus: true });
    expect(byNo(list, 2).appliesForStatus).toBe(false);
  });

  it('[SUBS-R03] 序號 7、8「低收入戶或中低收入戶」為 low+mid；序號 9 含一般市民、序號 10 沒有規範為空陣列', () => {
    expect([...byNo(list, 7).identities].sort()).toEqual(['low', 'mid']);
    expect([...byNo(list, 8).identities].sort()).toEqual(['low', 'mid']);
    expect(byNo(list, 9).identities).toEqual([]);
    expect(byNo(list, 10)).toMatchObject({ identities: [], incomeMax: 24293 });
  });

  it('[SUBS-R01][SUBS-R05] 年齡文字欄放還需確認，上下限相同只放一次', () => {
    const item7 = byNo(list, 7);
    expect(item7.ageMin).toBeNull();
    expect(item7.ageMax).toBeNull();
    const ageLines = item7.toVerify.filter((t) => t.startsWith('年齡或對象：'));
    expect(ageLines).toHaveLength(1);
    expect(ageLines[0]).toContain('婦女懷胎分娩者');
    expect(byNo(list, 1).toVerify[0]).toBe('年齡或對象：109年臺北市低收入戶家庭生活扶助標準表');
  });

  it('[SUBS-R05] 動產、其他條件、居住日數原文進還需確認，「沒有規範」開頭的略過', () => {
    expect(byNo(list, 10).toVerify).toEqual(['動產每人上限：15萬', '其他條件：全家人口之不動產(土地及房屋)上限876萬元']);
    expect(byNo(list, 9).toVerify.some((t) => t.startsWith('居住'))).toBe(false);
    expect(byNo(list, 6).toVerify).toContain('居住：最近一年居住國內超過183日');
  });

  it('[SUBS-R06] 序號 9 的應備文件以連續空白拆成 5 項', () => {
    expect(byNo(list, 9).documents).toHaveLength(5);
    expect(byNo(list, 9).documents[4]).toBe('5.一般市民並應檢附家庭應計算人口之各類所得及財產資料。');
  });

  it('詳情 4 項與原文一致', () => {
    const raw10 = records.find((r) => r['序號'] === '10')!;
    const item = byNo(list, 10);
    expect(item.office).toBe(raw10['收件洽辦單位']);
    expect(item.contact).toBe(raw10['聯繫方式']);
    expect(item.url).toBe(raw10['詳細資訊網址']);
    expect(item.documents.length).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/subsidies', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('[SUBS-R70][SUBS-R07][SUBS-R73] 回 28 項補助清單，打 data.taipei 時 URL 只有固定參數', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request) => Response.json(fixture));
    vi.stubGlobal('fetch', fetchMock);
    const res = await createApp().request('/api/v1/subsidies');
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).not.toHaveProperty('fetchedAt'); // [SUBS-R09] fetchedAt 只在伺服器
    expect(json).toHaveProperty('source'); // 向下相容：v3 前端讀 source
    const body = SubsidyListSchema.parse(json);
    expect(body.items).toHaveLength(28);
    expect(body.items.map((i) => [i.no, i.kind])).toEqual([
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((no) => [no, 'open']),
      ...Array.from({ length: 15 }, (_, i) => [201 + i, 'curated']),
      [101, 'mock'],
      [102, 'mock'],
      [103, 'mock'],
    ]);
    expect(body.updatedAt).toBe('2024-12-19T19:09:52+08:00');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://data.taipei/api/v1/dataset/549a3347-df6e-4bed-b818-368210d01544?scope=resourceAquire&limit=100',
    );
  });

  it('data.taipei 第一次失敗會重試一次', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(Response.json(fixture));
    vi.stubGlobal('fetch', fetchMock);
    const res = await createApp().request('/api/v1/subsidies');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('data.taipei 兩次都失敗回 503 subsidies_unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 502 })));
    const res = await createApp().request('/api/v1/subsidies');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'subsidies_unavailable' });
  });

  it('data.taipei 回空資料回 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ result: { count: 0, results: [] } })));
    const res = await createApp().request('/api/v1/subsidies');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'subsidies_unavailable' });
  });

  it('[SUBS-R09] 第二次請求走快取，不再打 data.taipei', async () => {
    const fetchMock = vi.fn(async () => Response.json(fixture));
    vi.stubGlobal('fetch', fetchMock);
    const app = createApp();
    expect((await app.request('/api/v1/subsidies')).status).toBe(200);
    expect((await app.request('/api/v1/subsidies')).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('[SUBS-R09] 伺服器 24 小時快取（假時間）', () => {
  const T0 = Date.parse('2026-11-08T00:00:00Z');
  const okList = buildSubsidyList(records, new Date(T0));
  let clock = T0;
  const now = () => clock;

  beforeEach(() => {
    clock = T0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('[SUBS-R09] 24 小時內回快取，滿 24 小時重抓', async () => {
    const load = vi.fn(async () => okList);
    const cache = createSubsidyCache({ load, now });
    await cache.get();
    clock = T0 + CACHE_TTL_MS - 1;
    await cache.get();
    expect(load).toHaveBeenCalledTimes(1);
    clock = T0 + CACHE_TTL_MS;
    await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('[SUBS-R09] 過期重抓失敗沿用上次成功結果，5 分鐘內不再重抓，5 分鐘後的下一個請求再試', async () => {
    const load = vi.fn<(now: Date) => Promise<SubsidyList>>().mockResolvedValueOnce(okList);
    const cache = createSubsidyCache({ load, now });
    expect(await cache.get()).toBe(okList);

    load.mockRejectedValueOnce(new Error('data.taipei down'));
    const failAt = T0 + CACHE_TTL_MS + 1000;
    clock = failAt;
    expect(await cache.get()).toBe(okList); // 沿用
    expect(load).toHaveBeenCalledTimes(2);

    clock = failAt + RETRY_AFTER_MS - 1;
    expect(await cache.get()).toBe(okList);
    expect(load).toHaveBeenCalledTimes(2); // 5 分鐘內不重抓

    const newer = { ...okList, updatedAt: '2026-11-09T08:00:00+08:00' };
    load.mockResolvedValueOnce(newer);
    clock = failAt + RETRY_AFTER_MS;
    expect(await cache.get()).toBe(newer); // 5 分鐘後再試成功
    expect(load).toHaveBeenCalledTimes(3);

    clock = failAt + RETRY_AFTER_MS + CACHE_TTL_MS - 1;
    expect(await cache.get()).toBe(newer); // 成功後重新計 24 小時
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('[SUBS-R09] 從未成功時丟錯，下一個請求立刻再試', async () => {
    const load = vi
      .fn<(now: Date) => Promise<SubsidyList>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(okList);
    const cache = createSubsidyCache({ load, now });
    await expect(cache.get()).rejects.toThrow('down');
    expect(await cache.get()).toBe(okList);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('[SUBS-R09] 整理失敗（例：開放資料回空）也沿用上次結果', async () => {
    const load = vi
      .fn<(now: Date) => Promise<SubsidyList>>()
      .mockResolvedValueOnce(okList)
      .mockImplementationOnce(async (t) => buildSubsidyList([], t));
    const cache = createSubsidyCache({ load, now });
    await cache.get();
    clock = T0 + CACHE_TTL_MS;
    expect(await cache.get()).toBe(okList);
  });

  it('[SUBS-R09][ADR-035] 官方網頁整理 JSON 驗證失敗也沿用上次結果', async () => {
    const broken = { ...DEFAULT_EXTRA_DATA, curated: { meta: curatedJson.meta, items: [] } };
    const load = vi
      .fn<(now: Date) => Promise<SubsidyList>>()
      .mockResolvedValueOnce(okList)
      .mockImplementationOnce(async (t) => buildSubsidyList(records, t, broken));
    const cache = createSubsidyCache({ load, now });
    await cache.get();
    clock = T0 + CACHE_TTL_MS;
    expect(await cache.get()).toBe(okList);
  });

  it('[SUBS-R09] 同時多個請求只抓一次', async () => {
    const load = vi.fn(async () => okList);
    const cache = createSubsidyCache({ load, now });
    await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('[SUBS-R09] 經 route：從未成功回 503 subsidies_unavailable；之後成功回 200', async () => {
    vi.useFakeTimers({ now: T0, toFake: ['Date'] });
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response('down', { status: 502 }))
        .mockResolvedValueOnce(new Response('down', { status: 502 }))
        .mockResolvedValue(Response.json(fixture));
      vi.stubGlobal('fetch', fetchMock);
      const app = createApp();
      const r1 = await app.request('/api/v1/subsidies');
      expect(r1.status).toBe(503);
      expect(await r1.json()).toEqual({ error: 'subsidies_unavailable' });
      expect((await app.request('/api/v1/subsidies')).status).toBe(200);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
