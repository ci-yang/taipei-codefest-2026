import { z } from 'zod';

/** newapp（暫名）後端 /healthz 回應：不查 DB，只回服務名稱與時間 */
export const ServiceHealthSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  time: z.string(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

// ---------- 補助清單契約（GET /api/v1/subsidies） ----------

/** 補助項目要求的身分代碼。elder 由年齡推得，不在答案選項裡（ADR-002） */
export const SUBSIDY_IDENTITIES = ['low', 'mid', 'dis', 'elder', 'preg'] as const;
export const SubsidyIdentitySchema = z.enum(SUBSIDY_IDENTITIES);
export type SubsidyIdentity = z.infer<typeof SubsidyIdentitySchema>;

/** open＝開放資料、curated＝官方網頁整理（人工整理，非 data.gov.tw 資料集）、mock＝模擬資料（ADR-035） */
export const SubsidyKindSchema = z.enum(['open', 'curated', 'mock']);
export type SubsidyKind = z.infer<typeof SubsidyKindSchema>;

export const SubsidyItemSchema = z.object({
  /** 序號區段（SUBS-R73）：1～100 開放資料（資料集「序號」）、101～200 模擬資料、201 起官方網頁整理 */
  no: z.number().int().positive(),
  kind: SubsidyKindSchema,
  name: z.string(),
  /** 整數歲；null 表示無限制（SUBS-R01） */
  ageMin: z.number().int().nullable(),
  ageMax: z.number().int().nullable(),
  /** true 表示需設籍臺北市（SUBS-R02） */
  residency: z.boolean(),
  /** 空陣列表示無身分限制（SUBS-R03） */
  identities: z.array(SubsidyIdentitySchema),
  /** 申請取得身分的項目，比對時不判身分（ADR-013） */
  appliesForStatus: z.boolean(),
  /** 每人每月收入上限，新臺幣元、含上限；null 表示無收入條件（SUBS-R04） */
  incomeMax: z.number().int().nullable(),
  /** 四題判不出、要自己確認的原文條件（SUBS-R05） */
  toVerify: z.array(z.string()),
  /** 應備文件（SUBS-R06） */
  documents: z.array(z.string()),
  office: z.string(),
  contact: z.string(),
  /** 服務說明頁；模擬類別為空字串 */
  url: z.string(),
  /** 「實際補助」原文（金額只照官方原文，SUBS-R74）；null 表示查不到可核對的金額，模擬類別一律 null */
  benefitText: z.string().nullable(),
  /** benefitText 原文所在頁；官方網頁整理一定有，開放資料沒有 benefitText 時與模擬類別為 null */
  sourceUrl: z.string().nullable(),
  /** 人工查證日 YYYY-MM-DD；與 sourceUrl 同時有值或同時為 null */
  verifiedAt: z.string().nullable(),
});
export type SubsidyItem = z.infer<typeof SubsidyItemSchema>;

export const SubsidySourceSchema = z.object({
  dataset: z.string(),
  agency: z.string(),
  license: z.string(),
  url: z.string(),
  rid: z.string(),
});
export type SubsidySource = z.infer<typeof SubsidySourceSchema>;

/** 清單裡每一種資料來源的說明（資料來源頁用，ADR-035）；依 open、curated、mock 順序 */
export const SubsidySourceTypeSchema = z.object({
  kind: SubsidyKindSchema,
  /** 畫面標籤：開放資料／官方網頁整理／模擬資料 */
  label: z.string(),
  description: z.string(),
  /** 這種來源在清單裡的項數 */
  count: z.number().int().nonnegative(),
  /** 人工查證日 YYYY-MM-DD；開放資料、模擬資料為 null */
  verifiedAt: z.string().nullable(),
});
export type SubsidySourceType = z.infer<typeof SubsidySourceTypeSchema>;

export const SubsidyListSchema = z.object({
  items: z.array(SubsidyItemSchema),
  /** 開放資料 _importdate 最大值，格式 YYYY-MM-DDTHH:mm:ss+08:00（SUBS-R08） */
  updatedAt: z.string(),
  /** 開放資料集（向下相容：v3 前端只讀這個欄位） */
  source: SubsidySourceSchema,
  /** 三種資料來源的說明與項數（ADR-035） */
  sources: z.array(SubsidySourceTypeSchema),
});
export type SubsidyList = z.infer<typeof SubsidyListSchema>;

/** 503 時的回應 */
export const SUBSIDIES_UNAVAILABLE = 'subsidies_unavailable';

// ---------- 查詢答案（只在手機記憶體，SUBS-R21） ----------

/** 身分複選六項，「以上皆無」與其他互斥（ADR-002） */
export const ANSWER_IDENTITIES = [
  { value: 'low', label: '低收入戶' },
  { value: 'mid', label: '中低收入戶' },
  { value: 'dis', label: '身心障礙者' },
  { value: 'preg', label: '懷孕或 60 天內分娩' },
  { value: 'stu', label: '在學學生' },
  { value: 'none', label: '以上皆無' },
] as const;
export const AnswerIdentitySchema = z.enum(['low', 'mid', 'dis', 'preg', 'stu', 'none']);
export type AnswerIdentity = z.infer<typeof AnswerIdentitySchema>;

/** 補助身分代碼的白話（不符合原因用）；elder 由年齡 65 歲以上推得 */
export const SUBSIDY_IDENTITY_LABELS: Record<SubsidyIdentity, string> = {
  low: '低收入戶',
  mid: '中低收入戶',
  dis: '身心障礙者',
  elder: '65 歲以上',
  preg: '懷孕或 60 天內分娩',
};

/**
 * 年齡區間（ADR-030，SUBS-R11、R13；v3 改為五格）：試算頁五顆單選膠囊；min、max 為涵蓋的歲數（含）。
 * 「18歲以下」涵蓋 0～17 歲，「65歲以上」涵蓋 65～120 歲。
 */
export const AGE_BANDS = [
  { value: 'u18', label: '18歲以下', min: 0, max: 17 },
  { value: '18-25', label: '18–25歲', min: 18, max: 25 },
  { value: '26-39', label: '26–39歲', min: 26, max: 39 },
  { value: '40-64', label: '40–64歲', min: 40, max: 64 },
  { value: '65+', label: '65歲以上', min: 65, max: 120 },
] as const;
export type AgeBand = (typeof AGE_BANDS)[number]['value'];

/** 選這個區間時視同具備 elder（SUBS-R15，ADR-030）；只有 65+ 算 elder */
export const ELDER_BAND: AgeBand = '65+';

/** 每人月收入級距（ADR-006）。0 為不清楚；max 為 null 表示無上限 */
export const INCOME_BRACKETS = [
  { value: 1, label: '17,005 元以下', min: 0, max: 17_005 },
  { value: 2, label: '17,006～24,293 元', min: 17_006, max: 24_293 },
  { value: 3, label: '24,294～28,550 元', min: 24_294, max: 28_550 },
  { value: 4, label: '28,551～33,252 元', min: 28_551, max: 33_252 },
  { value: 5, label: '33,253 元以上', min: 33_253, max: null },
] as const;
export const INCOME_UNKNOWN = 0;
export const INCOME_UNKNOWN_LABEL = '不清楚';
export const INCOME_HINT = '全家每月總收入除以家中人數';
export type IncomeBracket = 0 | 1 | 2 | 3 | 4 | 5;

/** 查詢答案；未答一律是 null，判斷用 `=== null`（收入不清楚 0 也算有值） */
export interface Answers {
  /** 年齡區間（ADR-030：只選區間，不填實際歲數） */
  ageBand: AgeBand | null;
  residency: boolean | null;
  identities: AnswerIdentity[];
  incomeBracket: IncomeBracket | null;
}

/** 實歲合理範圍（台北通生日換算用，SUBS-R24） */
export const AGE_MIN = 0;
export const AGE_MAX = 120;
