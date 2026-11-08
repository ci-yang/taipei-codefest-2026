import { z } from 'zod';
import { SubsidyItemSchema, type SubsidyItem } from '@app/shared';
import catalogJson from '../data/catalog-subsidies.json';
import catalogEnrichedJson from '../data/catalog-enriched.json';

/**
 * 台北服務通申辦服務（ADR-036）：政府資料開放平臺「臺北市政府台北服務通申辦服務及承辦單位資訊」
 * （data.gov.tw/dataset/157468）的補助類個人申請案件，靜態 JSON 快照，執行期不連線。
 * 資料集只有案件名稱、類別、承辦單位、申辦方式與案件頁網址，沒有年齡、設籍、身分、收入與金額，
 * 所以四題不比對（SUBS-R75），資格一律列在還需確認。
 * ADR-037：其中一部分另依官方案件頁、社會局說明頁或臺北市法規原文補上資格條件（catalog-enriched.json），
 * 這些項目帶 enriched=true，照四題比對（SUBS-R77）；其餘維持不比對。
 */

/** 台北服務通序號起點（SUBS-R73：kind=catalog 若且唯若 no >= 301） */
export const CATALOG_NO_MIN = 301;

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const CatalogFileSchema = z.object({
  meta: z.object({
    kind: z.literal('catalog'),
    label: z.string(),
    description: z.string(),
    dataset: z.object({
      name: z.string(),
      agency: z.string(),
      license: z.string(),
      url: z.string().url(),
      resourceUrl: z.string().url(),
      downloadedAt: DateSchema,
    }),
  }),
  items: z
    .array(
      z.object({
        no: z.number().int().min(CATALOG_NO_MIN),
        caseId: z.string(),
        name: z.string().min(1),
        category: z.string(),
        office: z.string(),
        method: z.string(),
        url: z.string().url(),
      }),
    )
    .min(1),
});
export type CatalogFile = z.infer<typeof CatalogFileSchema>;
export type CatalogRow = CatalogFile['items'][number];

export const DEFAULT_CATALOG_DATA: unknown = catalogJson;

/** 驗證 JSON；不合格或序號重複丟錯（整理失敗，交給 SUBS-R09 沿用上次結果） */
export function parseCatalogData(data: unknown): CatalogFile {
  const parsed = CatalogFileSchema.safeParse(data);
  if (!parsed.success) throw new Error(`台北服務通資料格式錯誤：${parsed.error.message}`);
  const nos = parsed.data.items.map((i) => i.no);
  if (new Set(nos).size !== nos.length) throw new Error('台北服務通序號重複');
  return parsed.data;
}

export const CatalogEnrichedFileSchema = z.object({
  meta: z.object({ description: z.string(), verifiedAt: DateSchema }),
  items: z.array(
    SubsidyItemSchema.pick({
      ageMin: true,
      ageMax: true,
      residency: true,
      identities: true,
      appliesForStatus: true,
      incomeMax: true,
      toVerify: true,
      documents: true,
      benefitText: true,
    }).extend({
      no: z.number().int().min(CATALOG_NO_MIN),
      caseId: z.string(),
      name: z.string().min(1),
      toVerify: z.array(z.string()).min(1),
      sourceUrl: z.string().url(),
      verifiedAt: DateSchema,
    }),
  ),
});
export type CatalogEnrichedFile = z.infer<typeof CatalogEnrichedFileSchema>;
export type CatalogEnrichment = CatalogEnrichedFile['items'][number];

export const DEFAULT_CATALOG_ENRICHED_DATA: unknown = catalogEnrichedJson;

/**
 * [SUBS-R77] 驗證資格補充 JSON：序號、案件編號、名稱三者都要對上台北服務通快照（免得改版後張冠李戴），
 * 序號不得重複；任一不合格丟錯（整理失敗，交給 SUBS-R09）。回傳依序號查的對照表。
 */
export function parseCatalogEnriched(data: unknown, catalog: CatalogFile): Map<number, CatalogEnrichment> {
  const parsed = CatalogEnrichedFileSchema.safeParse(data);
  if (!parsed.success) throw new Error(`台北服務通資格補充格式錯誤：${parsed.error.message}`);
  const map = new Map<number, CatalogEnrichment>();
  for (const e of parsed.data.items) {
    if (map.has(e.no)) throw new Error(`台北服務通資格補充序號重複：${e.no}`);
    const row = catalog.items.find((r) => r.no === e.no);
    if (!row || row.caseId !== e.caseId || row.name !== e.name) {
      throw new Error(`台北服務通資格補充序號 ${e.no}（${e.caseId}）與快照對不上`);
    }
    map.set(e.no, e);
  }
  return map;
}

/** [SUBS-R75] 四題判不出的條件全部放還需確認 */
export const CATALOG_VERIFY = '資格條件：未依四題比對，請到台北服務通案件頁確認年齡、設籍、身分與收入等條件';
export const CATALOG_CONTACT = '請見台北服務通案件頁';

/**
 * [SUBS-R75] 一列資料集轉成 SubsidyItem：條件欄全部是「不設限」的值（不參與比對，不代表沒有限制），
 * benefitText 為 null（資料集沒有金額），sourceUrl 放資料集頁、verifiedAt 放下載日。
 */
export function catalogItem(row: CatalogRow, file: CatalogFile, enrichment?: CatalogEnrichment): SubsidyItem {
  if (enrichment) return enrichedCatalogItem(row, enrichment);
  return {
    no: row.no,
    kind: 'catalog',
    name: row.name,
    ageMin: null,
    ageMax: null,
    residency: false,
    identities: [],
    appliesForStatus: false,
    incomeMax: null,
    toVerify: [CATALOG_VERIFY, `申辦方式：${row.method || '未標示'}（案件類別：${row.category}）`],
    documents: [],
    office: row.office,
    contact: CATALOG_CONTACT,
    url: row.url,
    benefitText: null,
    sourceUrl: file.meta.dataset.url,
    verifiedAt: file.meta.dataset.downloadedAt,
  };
}

/**
 * [SUBS-R77] 補好資格條件的台北服務通項目（ADR-037）：條件欄照官方原文整理，enriched=true 讓前端照四題比對；
 * 名稱、機關、案件頁沿用資料集，申辦方式附在還需確認最後一條，sourceUrl 是條件與金額原文所在頁。
 */
export function enrichedCatalogItem(row: CatalogRow, e: CatalogEnrichment): SubsidyItem {
  return {
    no: row.no,
    kind: 'catalog',
    name: row.name,
    ageMin: e.ageMin,
    ageMax: e.ageMax,
    residency: e.residency,
    identities: [...e.identities],
    appliesForStatus: e.appliesForStatus,
    incomeMax: e.incomeMax,
    toVerify: [...e.toVerify, `申辦方式：${row.method || '未標示'}（案件類別：${row.category}）`],
    documents: [...e.documents],
    office: row.office,
    contact: CATALOG_CONTACT,
    url: row.url,
    benefitText: e.benefitText,
    sourceUrl: e.sourceUrl,
    verifiedAt: e.verifiedAt,
    enriched: true,
  };
}
