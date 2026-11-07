import { SubsidyListSchema, type SubsidyList } from '@app/shared';

/**
 * [SUBS-R71] 本服務寫入 localStorage 的唯一鍵；內容只有 SubsidyList，不含 Answers 欄位。
 * [SUBS-R10] 上次成功載入的清單，供載入失敗時使用（ADR-007）。
 */
export const SUBSIDY_CACHE_KEY = 'newapp.subsidyList';

/** WebView 可能停用 storage，連 `window.localStorage` 本身都會 throw，所以取用也包在 try 裡 */
function storage(): Storage {
  return window.localStorage;
}

/** [SUBS-R10] 讀上次清單；沒有、壞掉、不過契約或 storage 例外一律回 null（視為沒有上次清單） */
export function readCachedList(): SubsidyList | null {
  try {
    const raw = storage().getItem(SUBSIDY_CACHE_KEY);
    if (raw === null) return null;
    return SubsidyListSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.warn('[subsidyCache] 讀不到上次清單：', (err as Error).message);
    return null;
  }
}

/**
 * [SUBS-R10] 寫入上次清單。先過 SubsidyListSchema（會丟掉契約外的欄位），
 * 確保存進去的只有清單（[SUBS-R71]）。寫入失敗回 false，不影響這次使用。
 */
export function writeCachedList(list: SubsidyList): boolean {
  try {
    storage().setItem(SUBSIDY_CACHE_KEY, JSON.stringify(SubsidyListSchema.parse(list)));
    return true;
  } catch (err) {
    console.warn('[subsidyCache] 無法寫入上次清單：', (err as Error).message);
    return false;
  }
}
