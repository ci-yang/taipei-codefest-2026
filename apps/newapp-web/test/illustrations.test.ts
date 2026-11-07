import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { describe, expect, it } from 'vitest';
import { TONE, art, hasArt } from '@/lib/illustrations';

describe('插畫（W10）', () => {
  it('[spec 7.10] 13 項補助都有插畫與底色，我的資料 5 張都有', () => {
    const nos = fixtureWithMock.items.map((i) => i.no);
    expect(nos).toHaveLength(13);
    for (const no of nos) {
      expect(hasArt(no)).toBe(true);
      expect(TONE[no]).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const k of ['p1', 'p2', 'p3', 'p4', 'p5']) expect(hasArt(k)).toBe(true);
  });

  it('[spec 7.10] 全為內嵌 SVG，不引用外部圖片或網址', () => {
    for (const k of [...fixtureWithMock.items.map((i) => i.no), 'p1', 'p2', 'p3', 'p4', 'p5']) {
      const svg = art(k);
      expect(svg.startsWith('<svg viewBox="0 0 200 150"')).toBe(true);
      expect(svg).not.toMatch(/https?:|<image|xlink:href|<img/);
      // 只參照本頁的 #g-* 漸層
      for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(m[1]).toMatch(/^g-/);
    }
  });

  it('年齡卡把數字代進插畫，未填為 ?', () => {
    expect(art('p1', 36)).toContain('>36</text>');
    expect(art('p1')).toContain('>?</text>');
  });
});
