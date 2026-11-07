import { AGE_BANDS, AGE_MAX, AGE_MIN, type AgeBand } from '@app/shared';
import type { TownPassAccount } from '@/lib/townpass';

/** [SUBS-R24] 台北通帳號帶入值：頁面記憶體，不寫儲存、不放進請求（SUBS-R25） */
export interface Prefill {
  /** 生日算出的實歲對應的年齡區間（ADR-030） */
  ageBand: AgeBand | null;
  residency: boolean | null;
  /** 第一筆地址的區（例「信義區」）：只給首頁戶籍選項顯示「臺北市 · ○○區」，不參與比對、不送後端、不寫儲存 */
  town: string | null;
}

export const EMPTY_PREFILL: Prefill = Object.freeze({ ageBand: null, residency: null, town: null }) as Prefill;

/** 「臺北市」或「台北市」視為設籍臺北市 */
const TAIPEI = new Set(['臺北市', '台北市']);

/**
 * [SUBS-R24] 生日字串（YYYY/MM/DD，台北通殼格式）算到 today 的實歲；
 * 格式不對、日期不存在、晚於今天或超出 0～120 回 null。
 */
export function ageFromBirthday(birthday: unknown, today: Date): number | null {
  if (typeof birthday !== 'string') return null;
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(birthday.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const check = new Date(y, mo - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null;
  let age = today.getFullYear() - y;
  const tm = today.getMonth() + 1;
  if (tm < mo || (tm === mo && today.getDate() < d)) age -= 1;
  return age >= AGE_MIN && age <= AGE_MAX ? age : null;
}

/** [SUBS-R24] 實歲對應的年齡區間（ADR-030）；null 或不在 0～120 回 null */
export function bandOfAge(age: number | null): AgeBand | null {
  if (age === null) return null;
  return AGE_BANDS.find((b) => age >= b.min && age <= b.max)?.value ?? null;
}

/** [SUBS-R24] 第一筆地址的縣市：臺北市／台北市為 true，其他縣市 false，缺欄位或格式不對 null */
export function residencyFromAddresses(addresses: unknown): boolean | null {
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  const first = addresses[0] as { city?: unknown } | null;
  const city = first && typeof first === 'object' ? first.city : undefined;
  if (typeof city !== 'string' || city.trim() === '') return null;
  return TAIPEI.has(city.trim());
}

/** [SUBS-R24] 第一筆地址的區；缺欄位、空字串或不是字串回 null */
export function townFromAddresses(addresses: unknown): string | null {
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  const first = addresses[0] as { town?: unknown } | null;
  const town = first && typeof first === 'object' ? first.town : undefined;
  return typeof town === 'string' && town.trim() !== '' ? town.trim() : null;
}

/**
 * [SUBS-R24] 由台北通帳號資料算帶入值（年齡只留區間，實歲不保留）。只讀 birthday、addresses[0].city、addresses[0].town，其他欄位一律不讀。
 * 帳號為 null（沒有 bridge、逾時、回 []）時三欄都是 null。
 */
export function prefillFrom(account: TownPassAccount | null, today: Date): Prefill {
  if (!account) return { ageBand: null, residency: null, town: null };
  return {
    ageBand: bandOfAge(ageFromBirthday(account.birthday, today)),
    residency: residencyFromAddresses(account.addresses),
    town: townFromAddresses(account.addresses),
  };
}
