import { z } from 'zod';
import { SubsidyItemSchema, type SubsidyItem } from '@app/shared';
import curatedJson from '../data/curated-subsidies.json';
import openBenefitJson from '../data/open-benefit-text.json';

/**
 * 官方網頁整理 15 項與開放資料「實際補助」原文（ADR-035）。
 * 兩份 JSON 由人工依各主管機關官方網頁整理，後端靜態 import；每次整理清單時才用 zod 驗證，
 * 驗證失敗由 buildSubsidyList 丟錯，交給 SUBS-R09 沿用上次結果。
 */

/** 官方網頁整理序號區段（SUBS-R73：kind=curated 若且唯若 201 <= no <= 300） */
export const CURATED_NO_MIN = 201;
export const CURATED_NO_MAX = 300;

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const CuratedFileSchema = z.object({
  meta: z.object({
    kind: z.literal('curated'),
    label: z.string(),
    description: z.string(),
    verifiedAt: DateSchema,
  }),
  items: z
    .array(
      SubsidyItemSchema.extend({
        no: z.number().int().min(CURATED_NO_MIN).max(CURATED_NO_MAX),
        kind: z.literal('curated'),
        url: z.string().url(),
        sourceUrl: z.string().url(),
        verifiedAt: DateSchema,
      }),
    )
    .min(1),
});
export type CuratedFile = z.infer<typeof CuratedFileSchema>;

export const OpenBenefitFileSchema = z.object({
  meta: z.object({ description: z.string(), verifiedAt: DateSchema }),
  items: z.array(
    z.object({
      no: z.number().int().positive(),
      name: z.string(),
      benefitText: z.string().nullable(),
      sources: z.array(z.string().url()),
    }),
  ),
});
export type OpenBenefitFile = z.infer<typeof OpenBenefitFileSchema>;

/** 原始 JSON（測試可換成壞資料） */
export interface ExtraData {
  curated: unknown;
  openBenefit: unknown;
  /** 台北服務通（ADR-036）；省略時用預設 JSON */
  catalog?: unknown;
  /** 台北服務通資格補充（ADR-037）；省略時用預設 JSON */
  catalogEnriched?: unknown;
}
export const DEFAULT_EXTRA_DATA: ExtraData = { curated: curatedJson, openBenefit: openBenefitJson };

export interface ParsedExtra {
  curated: CuratedFile;
  openBenefit: OpenBenefitFile;
}

/** 驗證兩份 JSON；不合格丟錯（整理失敗） */
export function parseExtraData(data: ExtraData): ParsedExtra {
  const curated = CuratedFileSchema.safeParse(data.curated);
  if (!curated.success) throw new Error(`官方網頁整理資料格式錯誤：${curated.error.message}`);
  const openBenefit = OpenBenefitFileSchema.safeParse(data.openBenefit);
  if (!openBenefit.success) throw new Error(`開放資料實際補助原文格式錯誤：${openBenefit.error.message}`);
  const nos = curated.data.items.map((i) => i.no);
  if (new Set(nos).size !== nos.length) throw new Error('官方網頁整理序號重複');
  return { curated: curated.data, openBenefit: openBenefit.data };
}

/**
 * [SUBS-R74] 開放資料補上實際補助原文：序號與名稱都對上才補（名稱不同表示資料集改版，不硬套避免張冠李戴）；
 * 有原文時 sourceUrl 取第一個出處、verifiedAt 取查證日；沒有原文三個欄位都是 null。
 */
export function withOpenBenefit(item: SubsidyItem, file: OpenBenefitFile): SubsidyItem {
  const hit = file.items.find((b) => b.no === item.no);
  if (!hit || hit.benefitText === null) return { ...item, benefitText: null, sourceUrl: null, verifiedAt: null };
  if (hit.name !== item.name) {
    console.warn(`[subsidies] 序號 ${item.no} 名稱「${item.name}」與實際補助原文「${hit.name}」不同，不補原文`);
    return { ...item, benefitText: null, sourceUrl: null, verifiedAt: null };
  }
  return { ...item, benefitText: hit.benefitText, sourceUrl: hit.sources[0] ?? null, verifiedAt: file.meta.verifiedAt };
}
