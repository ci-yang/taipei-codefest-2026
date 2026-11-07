import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAVORITES_KEY, readFavorites, toggleFavorite, writeFavorites } from '@/lib/favorites';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('收藏 lib（W8）', () => {
  it('[SUBS-R28] 只存補助序號整數陣列，整份覆寫', () => {
    expect(FAVORITES_KEY).toBe('newapp.favorites');
    expect(readFavorites()).toEqual([]);
    expect(writeFavorites([4, 101])).toBe(true);
    expect(localStorage.getItem(FAVORITES_KEY)).toBe('[4,101]');
    expect(readFavorites()).toEqual([4, 101]);
    writeFavorites([]);
    expect(localStorage.getItem(FAVORITES_KEY)).toBe('[]');
  });

  it('[SUBS-R28] 壞 JSON、非陣列視為空；只保留整數並去重', () => {
    localStorage.setItem(FAVORITES_KEY, '{oops');
    expect(readFavorites()).toEqual([]);
    localStorage.setItem(FAVORITES_KEY, '{"a":1}');
    expect(readFavorites()).toEqual([]);
    localStorage.setItem(FAVORITES_KEY, '[4,"5",1.5,null,4,101]');
    expect(readFavorites()).toEqual([4, 101]);
  });

  it('[SUBS-R28] storage 讀寫例外：讀回空陣列、寫回 false，不丟錯', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(readFavorites()).toEqual([]);
    expect(writeFavorites([1])).toBe(false);
  });

  it('切換：沒有就加在最後，有就移除', () => {
    expect(toggleFavorite([], 4)).toEqual([4]);
    expect(toggleFavorite([4], 101)).toEqual([4, 101]);
    expect(toggleFavorite([4, 101], 4)).toEqual([101]);
  });
});

describe('useFavorites（W8）', () => {
  it('[SUBS-R28] 切換後整份覆寫並 toast；重新進入服務（重載模組）收藏還在', async () => {
    vi.resetModules();
    const { useFavorites, MSG_FAV_ADDED, MSG_FAV_REMOVED } = await import('@/composables/useFavorites');
    const { useToast } = await import('@/composables/useToast');
    const f = useFavorites();
    f.toggle(4);
    expect(useToast().message.value).toBe(MSG_FAV_ADDED);
    f.toggle(101);
    expect(f.count.value).toBe(2);
    expect(localStorage.getItem(FAVORITES_KEY)).toBe('[4,101]');
    vi.resetModules();
    const again = (await import('@/composables/useFavorites')).useFavorites();
    const toast2 = (await import('@/composables/useToast')).useToast();
    expect(again.favorites.value).toEqual([4, 101]);
    again.toggle(4);
    expect(toast2.message.value).toBe(MSG_FAV_REMOVED);
    expect(localStorage.getItem(FAVORITES_KEY)).toBe('[101]');
  });

  it('[SUBS-R28] 寫入例外時只留在頁面記憶體', async () => {
    vi.resetModules();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const f = (await import('@/composables/useFavorites')).useFavorites();
    f.toggle(8);
    expect(f.isFavorite(8)).toBe(true);
    expect(localStorage.getItem(FAVORITES_KEY)).toBeNull();
  });
});
