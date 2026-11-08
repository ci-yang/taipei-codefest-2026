import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import fixtureFull from './fixtures/subsidy-list-full.json';
import { describe, expect, it } from 'vitest';
import { ART_ALIAS, TONE, art, hasArt, toneOf } from '@/lib/illustrations';

describe('插畫（W10）', () => {
  it('[spec 7.10] 13 項補助都有插畫與底色；我的資料 5 張插畫已拿掉（ADR-023）', () => {
    const nos = fixtureWithMock.items.map((i) => i.no);
    expect(nos).toHaveLength(13);
    for (const no of nos) {
      expect(hasArt(no)).toBe(true);
      expect(TONE[no]).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const k of ['p1', 'p2', 'p3', 'p4', 'p5']) expect(hasArt(k)).toBe(false);
  });

  it('[ADR-035] 官方網頁整理 15 項借用既有插畫與底色', () => {
    const curated = fixtureFull.items.filter((i) => i.kind === 'curated').map((i) => i.no);
    expect(curated).toHaveLength(15);
    for (const no of curated) {
      expect(hasArt(no)).toBe(true);
      expect(art(no)).toBe(art(ART_ALIAS[no]!));
      expect(toneOf(no)).toBe(TONE[ART_ALIAS[no]!]);
    }
  });

  it('[spec 7.10] 全為內嵌 SVG，不引用外部圖片或網址', () => {
    for (const k of fixtureWithMock.items.map((i) => i.no)) {
      const svg = art(k);
      expect(svg.startsWith('<svg viewBox="0 0 200 150"')).toBe(true);
      expect(svg).not.toMatch(/https?:|<image|xlink:href|<img/);
      // 只參照本頁的 #g-* 漸層
      for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(m[1]).toMatch(/^g-/);
    }
  });

});
