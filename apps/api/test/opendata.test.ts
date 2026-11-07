import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenDataResponseSchema } from '@app/shared';
import { createApp } from '../src/app';
import { env } from '../src/env';
import { normalizeRecord } from '../src/routes/opendata';

// 垃圾車點位（rid a6e90031-...）2026-11-07 實測回傳的第 1 筆
const GARBAGE_TRUCK_ROW = {
  _id: 1,
  _importdate: { date: '2026-11-02 15:23:37.672557', timezone_type: 3, timezone: 'Asia/Taipei' },
  行政區: '士林區',
  路線: '天母-1',
  抵達時間: '1630',
  地點: '臺北市士林區天母西路48號',
  經度: '121.525',
  緯度: '25.11836',
};

describe('normalizeRecord', () => {
  it('垃圾車點位：字串經緯度轉數字，沒有「名稱」時用「地點」', () => {
    expect(normalizeRecord(GARBAGE_TRUCK_ROW, 0)).toMatchObject({
      id: '1',
      name: '臺北市士林區天母西路48號',
      address: '臺北市士林區天母西路48號',
      lat: 25.11836,
      lng: 121.525,
    });
  });

  it('公廁這類有「名稱」欄位的資料集優先用名稱', () => {
    const item = normalizeRecord({ _id: 7, 公廁名稱: '某公廁', 公廁地址: '臺北市', 緯度: '25.03', 經度: '121.5' }, 0);
    expect(item).toMatchObject({ name: '某公廁', address: '臺北市', lat: 25.03, lng: 121.5 });
  });

  it('座標不是數字時回 null，不要回 NaN', () => {
    const item = normalizeRecord({ name: 'x', lat: '', lng: 'abc' }, 3);
    expect(item.lat).toBeNull();
    expect(item.lng).toBeNull();
    expect(item.id).toBe('3');
  });
});

describe('GET /api/v1/opendata/sample（fetch 已 stub，不打真的 data.taipei）', () => {
  const app = createApp();
  const originalRid = env.OPENDATA_SAMPLE_RID;
  afterEach(() => {
    env.OPENDATA_SAMPLE_RID = originalRid;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('上游成功：回正規化資料、mocked=false、來源帶 rid', async () => {
    env.OPENDATA_SAMPLE_RID = 'rid-ok';
    const fetchMock = vi.fn(async (_url: string) => Response.json({ result: { count: 1, results: [GARBAGE_TRUCK_ROW] } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request('/api/v1/opendata/sample?limit=1');
    expect(res.status).toBe(200);
    const body = OpenDataResponseSchema.parse(await res.json());
    expect(body.mocked).toBe(false);
    expect(body.reason).toBeNull();
    expect(body.source.rid).toBe('rid-ok');
    expect(body.items[0]).toMatchObject({ lat: 25.11836, lng: 121.525 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('rid-ok?scope=resourceAquire&limit=1');
  });

  it('上游一直失敗：重試 1 次後回 mock，標 mocked:true 與 reason', async () => {
    env.OPENDATA_SAMPLE_RID = 'rid-down';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request('/api/v1/opendata/sample');
    expect(res.status).toBe(200);
    const body = OpenDataResponseSchema.parse(await res.json());
    expect(body.mocked).toBe(true);
    expect(body.reason).toContain('fetch failed');
    expect(body.items.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('逾時（AbortSignal.timeout）也算失敗，回 mock', async () => {
    env.OPENDATA_SAMPLE_RID = 'rid-slow';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetchMock);
    const body = OpenDataResponseSchema.parse(await (await app.request('/api/v1/opendata/sample')).json());
    expect(body.mocked).toBe(true);
    expect(body.reason).toContain('timeout');
  });

  it('第一次失敗、第二次成功：回 200', async () => {
    env.OPENDATA_SAMPLE_RID = 'rid-flaky';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('ECONNRESET'))
      .mockResolvedValueOnce(Response.json({ result: { results: [GARBAGE_TRUCK_ROW] } }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await app.request('/api/v1/opendata/sample')).status).toBe(200);
  });

  it('?mock=1 或沒設 rid：不打上游，回內建 mock', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    env.OPENDATA_SAMPLE_RID = 'rid-ok';
    const forced = OpenDataResponseSchema.parse(await (await app.request('/api/v1/opendata/sample?mock=1')).json());
    env.OPENDATA_SAMPLE_RID = '';
    const unset = OpenDataResponseSchema.parse(await (await app.request('/api/v1/opendata/sample')).json());
    expect(forced.mocked && unset.mocked).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
