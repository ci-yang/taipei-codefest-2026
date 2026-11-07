import {
  SubsidyListSchema,
  type SubsidyIdentity,
  type SubsidyItem,
  type SubsidyList,
  type SubsidySource,
} from '@app/shared';

const DATA_TAIPEI_API = 'https://data.taipei/api/v1/dataset';
export const SUBSIDY_RID = '549a3347-df6e-4bed-b818-368210d01544';
const FETCH_LIMIT = 100;
const FETCH_TIMEOUT_MS = 5000;
/** data.taipei 偶爾 TLS timeout / connection reset，重試一次（沿用 apps/api opendata.ts） */
const FETCH_ATTEMPTS = 2;

/** 資料來源（data.gov.tw/dataset/129839 實查 2026-11-08：資料集名稱、授權條款第 1 版） */
export const SUBSIDY_SOURCE: SubsidySource = {
  dataset: '臺北市社會救助補助項目',
  agency: '臺北市政府社會局',
  license: '政府資料開放授權條款－第1版',
  url: 'https://data.gov.tw/dataset/129839',
  rid: SUBSIDY_RID,
};

export type RawRecord = Record<string, unknown>;

const NO_RULE = '沒有規範';

function text(raw: RawRecord, key: string): string {
  const v = raw[key];
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

function warn(no: number, msg: string): void {
  console.warn(`[subsidies] 序號 ${no}：${msg}`);
}

/** [SUBS-R01] 「N歲」取 N；「沒有規範」或空白取 null；其他文字取 null 並回傳原文給 R05 */
export function parseAge(value: string): { age: number | null; text: string | null } {
  const m = /^(\d+)\s*歲$/.exec(value);
  if (m) return { age: Number(m[1]), text: null };
  if (value === '' || value === NO_RULE) return { age: null, text: null };
  return { age: null, text: value };
}

/** [SUBS-R02] 設籍條件含台北市或臺北市時需設籍 */
export function parseResidency(value: string): boolean {
  return value.includes('台北市') || value.includes('臺北市');
}

/** [SUBS-R03] 整詞對照表；整詞比對所以「中低收入戶」不會被當成「低收入戶」 */
const IDENTITY_WORDS: ReadonlyArray<readonly [string, SubsidyIdentity]> = [
  ['中低收入戶', 'mid'],
  ['中收入戶', 'mid'],
  ['低收入戶', 'low'],
  ['低收', 'low'],
  ['身心障礙者', 'dis'],
  ['老人', 'elder'],
];

/** [SUBS-R03] 身份欄切詞後整詞比對取聯集；含「一般市民」或整欄「沒有規範」取空陣列 */
export function parseIdentities(value: string, onUnknown?: (word: string) => void): SubsidyIdentity[] {
  if (value === '' || value === NO_RULE || value.includes('一般市民')) return [];
  const found = new Set<SubsidyIdentity>();
  for (const word of value.split(/[或、及]/).map((w) => w.trim())) {
    if (word === '') continue;
    const hit = IDENTITY_WORDS.find(([w]) => w === word);
    if (hit) found.add(hit[1]);
    else onUnknown?.(word);
  }
  return [...found];
}

/** [SUBS-R03] 申請取得身分的項目以補助名稱判定（ADR-013） */
const APPLIES_FOR_STATUS_NAMES = ['低收入戶生活扶助', '中低收入戶'];
export function isAppliesForStatus(name: string): boolean {
  return APPLIES_FOR_STATUS_NAMES.includes(name);
}

/** [SUBS-R04] 收入上限取整數元；「沒有規範」或空白為 null；其他非數字為 null 並回傳原文 */
export function parseIncome(value: string): { incomeMax: number | null; text: string | null } {
  const digits = value.replace(/,/g, '');
  if (/^\d+$/.test(digits)) return { incomeMax: Number(digits), text: null };
  if (value === '' || value === NO_RULE) return { incomeMax: null, text: null };
  return { incomeMax: null, text: value };
}

/** [SUBS-R06] 應備文件依換行或連續空白拆成清單，去掉空字串 */
export function parseDocuments(value: string): string[] {
  return value
    .split(/\r?\n|\s{2,}/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** [SUBS-R05] 原文以「沒有規範」開頭的略過 */
function verifyEntry(label: string, value: string): string | null {
  if (value === '' || value.startsWith(NO_RULE)) return null;
  return `${label}：${value}`;
}

/** 把一筆 data.taipei 原始資料整理成 SubsidyItem（SUBS-R01～R06）；回 null 表示序號無法辨識 */
export function normalizeSubsidy(raw: RawRecord): SubsidyItem | null {
  const no = Number(text(raw, '序號'));
  if (!Number.isInteger(no) || no <= 0) {
    console.warn('[subsidies] 序號無法辨識，略過：', raw['序號']);
    return null;
  }
  const name = text(raw, '補助名稱');

  // [SUBS-R01]
  const ageMin = parseAge(text(raw, '補助對象年齡下限'));
  const ageMax = parseAge(text(raw, '補助對象年齡上限'));

  // [SUBS-R03]
  const identities = parseIdentities(text(raw, '身份'), (word) => warn(no, `身份詞「${word}」對不到代碼，不納入`));

  // [SUBS-R04]
  const income = parseIncome(text(raw, '收入條件每人每月上限金額'));
  if (income.text !== null) warn(no, `收入條件不是數字：${income.text}`);

  // [SUBS-R05] 年齡文字（上下限相同只放一次）、動產、其他條件、居住日數，加上無法解析的收入原文
  const ageTexts = [...new Set([ageMin.text, ageMax.text].filter((t): t is string => t !== null))];
  const toVerify = [
    ...ageTexts.map((t) => `年齡或對象：${t}`),
    income.text === null ? null : `收入條件：${income.text}`,
    verifyEntry('動產每人上限', text(raw, '動產條件每人上限')),
    verifyEntry('其他條件', text(raw, '其他條件')),
    verifyEntry('居住', text(raw, '居住日數是否需大於規定日數')),
  ].filter((t): t is string => t !== null);

  return {
    no,
    kind: 'open',
    name,
    ageMin: ageMin.age,
    ageMax: ageMax.age,
    residency: parseResidency(text(raw, '設籍條件')), // [SUBS-R02]
    identities,
    appliesForStatus: isAppliesForStatus(name), // [SUBS-R03]
    incomeMax: income.incomeMax,
    toVerify,
    documents: parseDocuments(text(raw, '應備文件')), // [SUBS-R06]
    office: text(raw, '收件洽辦單位'),
    contact: text(raw, '聯繫方式'),
    url: text(raw, '詳細資訊網址'),
  };
}

/** 把時間格式化成 YYYY-MM-DDTHH:mm:ss+08:00 */
function toTaipeiIso(date: Date): string {
  const t = new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 19);
  return `${t}+08:00`;
}

/**
 * [SUBS-R08] 取 _importdate 最大值。_importdate 是物件 { date: 'YYYY-MM-DD HH:mm:ss.ffffff', timezone: 'Asia/Taipei' }。
 * 沒有任何可用的 _importdate 時用抓取時間。
 */
export function latestImportDate(records: RawRecord[], fetchedAt: Date): string {
  let max: string | null = null;
  for (const r of records) {
    const imp = r._importdate;
    const date = typeof imp === 'object' && imp !== null ? (imp as { date?: unknown }).date : imp;
    if (typeof date !== 'string') continue;
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(date);
    if (!m) continue;
    const iso = `${m[1]}T${m[2]}+08:00`;
    if (max === null || iso > max) max = iso;
  }
  return max ?? toTaipeiIso(fetchedAt);
}

/** 模擬類別序號起點（SUBS-R73：kind=mock 若且唯若 no >= 101） */
export const MOCK_NO_MIN = 101;

/**
 * [SUBS-R07] 模擬類別 3 項，名稱與條件都是示範值（ADR-012）；其他欄位取自原型 prd-4-prototype。
 * 模擬項目沒有網址（url 空字串）。
 */
export const MOCK_SUBSIDIES: readonly SubsidyItem[] = [
  {
    no: 101,
    kind: 'mock',
    name: '新生兒育兒津貼',
    ageMin: null,
    ageMax: null,
    residency: true,
    identities: ['preg'],
    appliesForStatus: false,
    incomeMax: null,
    toVerify: ['子女出生登記（模擬條件）'],
    documents: ['申請表（模擬）', '戶口名簿影本（模擬）'],
    office: '戶籍所在地區公所（模擬）',
    contact: '1999（模擬）',
    url: '',
  },
  {
    no: 102,
    kind: 'mock',
    name: '青年租屋補貼',
    ageMin: 20,
    ageMax: 40,
    residency: true,
    identities: [],
    appliesForStatus: false,
    incomeMax: 33_252,
    toVerify: ['租賃契約（模擬條件）', '名下無自有住宅（模擬條件）'],
    documents: ['申請表（模擬）', '租賃契約影本（模擬）'],
    office: '都市發展局（模擬）',
    contact: '1999（模擬）',
    url: '',
  },
  {
    no: 103,
    kind: 'mock',
    name: '青年職涯探索補助',
    ageMin: 18,
    ageMax: 29,
    residency: true,
    identities: [],
    appliesForStatus: false,
    incomeMax: null,
    toVerify: ['參加指定課程（模擬條件）'],
    documents: ['申請表（模擬）'],
    office: '勞動局（模擬）',
    contact: '1999（模擬）',
    url: '',
  },
];

/** 整理整份清單並用契約驗證：開放資料依序號排，模擬類別接在尾端（SUBS-R07） */
export function buildSubsidyList(records: RawRecord[], fetchedAt: Date = new Date()): SubsidyList {
  const items = records
    .map(normalizeSubsidy)
    .filter((i): i is SubsidyItem => i !== null)
    .sort((a, b) => a.no - b.no);
  if (items.length === 0) throw new Error('整理後沒有任何補助項目');
  // [SUBS-R73] 開放資料序號撞進模擬區段就當整理失敗，交給 SUBS-R09 沿用上次結果
  const clash = items.find((i) => i.no >= MOCK_NO_MIN);
  if (clash) throw new Error(`開放資料序號 ${clash.no} 落在模擬類別區段（>= ${MOCK_NO_MIN}）`);
  return SubsidyListSchema.parse({
    items: [...items, ...MOCK_SUBSIDIES.map((m) => structuredClone(m))],
    updatedAt: latestImportDate(records, fetchedAt),
    source: SUBSIDY_SOURCE,
  });
}

/** data.taipei 回傳格式：{ result: { count, results: [...] } }；5 秒逾時、重試 1 次 */
export async function fetchSubsidyRecords(): Promise<RawRecord[]> {
  const url = `${DATA_TAIPEI_API}/${SUBSIDY_RID}?scope=resourceAquire&limit=${FETCH_LIMIT}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`data.taipei HTTP ${res.status}`);
      const json = (await res.json()) as { result?: { results?: unknown } };
      const results = json.result?.results;
      if (!Array.isArray(results) || results.length === 0) throw new Error('data.taipei 回傳空資料');
      return results as RawRecord[];
    } catch (err) {
      lastError = err;
      console.warn(`[subsidies] 第 ${attempt} 次打 data.taipei 失敗：`, (err as Error).message);
    }
  }
  throw lastError;
}

/** 抓取並整理一次（不經快取） */
export async function loadSubsidyList(now: Date = new Date()): Promise<SubsidyList> {
  const records = await fetchSubsidyRecords();
  return buildSubsidyList(records, now);
}

/** [SUBS-R09] 整理結果保留 24 小時 */
export const CACHE_TTL_MS = 24 * 3600_000;
/** [SUBS-R09] 重抓失敗後，5 分鐘後的下一個請求再試 */
export const RETRY_AFTER_MS = 5 * 60_000;

export interface SubsidyCacheOptions {
  /** 抓取並整理；預設 loadSubsidyList */
  load?: (now: Date) => Promise<SubsidyList>;
  /** 現在時間（毫秒）；測試注入假時間 */
  now?: () => number;
}

export interface SubsidyCache {
  /** 回快取或重抓後的清單；從未成功過且這次也失敗時丟錯（route 轉 503） */
  get(): Promise<SubsidyList>;
}

/**
 * [SUBS-R09] 伺服器記憶體快取。fetchedAt 只在這裡，不進契約（sa-2-overview 6.2）。
 * - 未過期：直接回快取。
 * - 過期：重抓；失敗沿用上次成功結果，並在 RETRY_AFTER_MS 內不再重抓。
 * - 從未成功：每個請求都重抓，失敗就丟錯。
 * 同時多個請求只會觸發一次抓取。
 */
export function createSubsidyCache(options: SubsidyCacheOptions = {}): SubsidyCache {
  const load = options.load ?? loadSubsidyList;
  const now = options.now ?? Date.now;
  let list: SubsidyList | null = null;
  let fetchedAt = 0;
  let retryAt = 0;
  let inflight: Promise<SubsidyList> | null = null;

  async function refresh(): Promise<SubsidyList> {
    const t = now();
    try {
      const fresh = await load(new Date(t));
      list = fresh;
      fetchedAt = t;
      retryAt = 0;
      return fresh;
    } catch (err) {
      if (list === null) throw err;
      retryAt = t + RETRY_AFTER_MS;
      console.warn('[subsidies] 重抓失敗，沿用上次成功結果：', (err as Error).message);
      return list;
    }
  }

  return {
    async get() {
      const t = now();
      if (list !== null && (t - fetchedAt < CACHE_TTL_MS || t < retryAt)) return list;
      inflight ??= refresh().finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}
