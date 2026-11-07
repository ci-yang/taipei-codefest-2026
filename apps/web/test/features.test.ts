import { describe, expect, it } from 'vitest';
import { FEATURES, PLACE_FEATURES, matchFeature } from '@/lib/features';

describe('matchFeature', () => {
  it('一句話裡有關鍵字就導到對應功能', () => {
    expect(matchFeature('附近哪裡有廁所')?.id).toBe('toilet');
    expect(matchFeature('我想借書')?.id).toBe('library');
    expect(matchFeature('哪裡可以裝水')?.id).toBe('water');
    expect(matchFeature('附近有飲水機嗎')?.id).toBe('water');
  });
  it('沒命中或空字串回 null', () => {
    expect(matchFeature('今天天氣如何')).toBeNull();
    expect(matchFeature('   ')).toBeNull();
  });
  it('含「水」但在講避難的句子導去避難，不是飲水機', () => {
    expect(matchFeature('颱風淹水要去哪避難')?.id).toBe('shelter');
    expect(matchFeature('家裡淹水了')?.id).toBe('shelter');
    expect(matchFeature('水溝蓋壞了')).toBeNull();
  });
  it('多類都命中時，命中詞多的勝出（不是註冊順序在前的）', () => {
    // 「喝水」命中 water 一個詞；「地震」「避難」命中 shelter 兩個詞
    expect(matchFeature('地震後去避難處要帶喝水的瓶子')?.id).toBe('shelter');
  });
});

describe('PLACE_FEATURES', () => {
  it('地圖工具列只列地點類別，獨立頁面（about）不在裡面', () => {
    expect(PLACE_FEATURES.map((f) => f.id)).not.toContain('about');
    expect(PLACE_FEATURES.every((f) => f.kind === 'place')).toBe(true);
    expect(FEATURES.find((f) => f.id === 'about')?.kind).toBe('page');
  });
});
