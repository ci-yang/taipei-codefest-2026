import type { RouteLocationRaw } from 'vue-router';
import type { PlaceCategory } from '@app/shared';

/**
 * 首頁「輸入一句話找服務」與類別 chips 的註冊表。
 * 新增功能切片的最後一步：在這裡加一筆，首頁就會出現 chip、搜尋也找得到。
 */
export interface Feature {
  id: string;
  label: string;
  /**
   * place = 地圖頁的地點類別（會出現在地圖頁工具列，`to` 指向 /map?category=）；
   * page = 獨立頁面（只出現在首頁 chips，不進地圖工具列）。
   */
  kind: 'place' | 'page';
  /**
   * 使用者可能打的字，出現在輸入句子裡就算命中。
   * 用專有詞，不要放「水」「書」這種單字：一句話常同時含好幾類的字，單字會搶走別類（例：「颱風淹水」）。
   */
  keywords: string[];
  to: RouteLocationRaw;
}

const mapFeature = (category: PlaceCategory, label: string, keywords: string[]): Feature => ({
  id: category,
  label,
  kind: 'place',
  keywords,
  to: { name: 'map', query: { category } },
});

export const FEATURES: Feature[] = [
  mapFeature('toilet', '公廁', ['廁所', '公廁', '洗手間', '尿尿', '如廁']),
  mapFeature('water', '飲水機', ['飲水機', '飲水', '喝水', '加水', '裝水']),
  mapFeature('park', '公園', ['公園', '散步', '綠地', '遛狗']),
  mapFeature('library', '圖書館', ['圖書館', '借書', '看書', '自習', '讀書']),
  mapFeature('shelter', '避難處所', ['避難', '淹水', '颱風', '地震', '防空', '疏散']),
  { id: 'about', label: '資料來源', kind: 'page', keywords: ['來源', '授權', '關於', 'about'], to: { name: 'about' } },
];

/** 地圖頁工具列只列地點類別 */
export const PLACE_FEATURES: Feature[] = FEATURES.filter((f) => f.kind === 'place');

/**
 * 純前端關鍵字比對：命中關鍵字最多的功能勝出；同分取命中詞最長的，再同分取註冊順序在前的。
 * 沒命中回 null。
 */
export function matchFeature(input: string, features: Feature[] = FEATURES): Feature | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  let best: { feature: Feature; hits: number; longest: number } | null = null;
  for (const feature of features) {
    const matched = [...new Set([...feature.keywords, feature.label])].filter((k) => text.includes(k.toLowerCase()));
    if (matched.length === 0) continue;
    const longest = Math.max(...matched.map((k) => k.length));
    if (!best || matched.length > best.hits || (matched.length === best.hits && longest > best.longest)) {
      best = { feature, hits: matched.length, longest };
    }
  }
  return best?.feature ?? null;
}
