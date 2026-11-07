/**
 * [SUBS-R28] 收藏存在 localStorage['newapp.favorites']，值只有補助序號整數陣列（ADR-026）。
 * 不含 Answers、台北通帳號資料或比對結果；我的珍藏顯示時再對補助清單與本次比對結果。
 * [SUBS-R71] 本服務寫入的 localStorage 鍵只有 newapp.subsidyList 與這個鍵。
 */
export const FAVORITES_KEY = 'newapp.favorites';

/** 讀收藏：壞 JSON、不是陣列或 storage 例外都視為空陣列，只保留整數（去重、保留順序） */
export function readFavorites(): number[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (raw === null) return [];
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x): x is number => Number.isInteger(x)))];
  } catch (err) {
    console.warn('[favorites] 讀不到收藏：', (err as Error).message);
    return [];
  }
}

/** 整份覆寫；寫入例外回 false，呼叫端只留在頁面記憶體 */
export function writeFavorites(nos: readonly number[]): boolean {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(nos.filter((x) => Number.isInteger(x))));
    return true;
  } catch (err) {
    console.warn('[favorites] 無法寫入收藏：', (err as Error).message);
    return false;
  }
}

/** 切換一個序號：有就移除，沒有就加在最後 */
export function toggleFavorite(nos: readonly number[], no: number): number[] {
  return nos.includes(no) ? nos.filter((x) => x !== no) : [...nos, no];
}
