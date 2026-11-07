import { computed, readonly, ref } from 'vue';
import { readFavorites, toggleFavorite, writeFavorites } from '@/lib/favorites';
import { showToast } from '@/composables/useToast';

export const MSG_FAV_ADDED = '已加入我的珍藏';
export const MSG_FAV_REMOVED = '已從我的珍藏移除';

/**
 * [SUBS-R28] 收藏的頁面狀態：進入服務時從 localStorage 讀一次，之後每次切換整份覆寫；
 * 寫入失敗時只留在這個 ref（頁面記憶體）。
 */
const favorites = ref<number[]>(readFavorites());

function isFavorite(no: number): boolean {
  return favorites.value.includes(no);
}

/** 書籤：切換收藏並 toast */
function toggle(no: number): void {
  const added = !isFavorite(no);
  favorites.value = toggleFavorite(favorites.value, no);
  writeFavorites(favorites.value);
  showToast(added ? MSG_FAV_ADDED : MSG_FAV_REMOVED);
}

const count = computed(() => favorites.value.length);

export function useFavorites() {
  return { favorites: readonly(favorites), count, isFavorite, toggle };
}
