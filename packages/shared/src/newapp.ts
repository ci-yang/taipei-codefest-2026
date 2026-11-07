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

export const SubsidyKindSchema = z.enum(['open', 'mock']);
export type SubsidyKind = z.infer<typeof SubsidyKindSchema>;

export const SubsidyItemSchema = z.object({
  /** 開放資料用資料集「序號」；模擬類別 101 起（SUBS-R73） */
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
  /** 模擬類別為空字串 */
  url: z.string(),
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

export const SubsidyListSchema = z.object({
  items: z.array(SubsidyItemSchema),
  /** 開放資料 _importdate 最大值，格式 YYYY-MM-DDTHH:mm:ss+08:00（SUBS-R08） */
  updatedAt: z.string(),
  source: SubsidySourceSchema,
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

/** 年齡達此值視同具備 elder（SUBS-R15） */
export const ELDER_AGE = 65;

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

/** 查詢答案；未答一律是 null，判斷用 `=== null`（0 歲與收入不清楚 0 都算有值） */
export interface Answers {
  age: number | null;
  residency: boolean | null;
  identities: AnswerIdentity[];
  incomeBracket: IncomeBracket | null;
}

export const AGE_MIN = 0;
export const AGE_MAX = 120;
