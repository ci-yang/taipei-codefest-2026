import fixtureWithMock from './fixtures/subsidy-list-with-mock.json';
import { describe, expect, it } from 'vitest';
import { SubsidyListSchema, type SubsidyItem } from '@app/shared';
import { CATEGORIES, categoryOf, keyCondition } from '@/lib/categories';

const items13 = SubsidyListSchema.parse(fixtureWithMock).items;
const item = (no: number): SubsidyItem => items13.find((i) => i.no === no)!;

describe('分類對照', () => {
  it('六類，順序與標籤照 v3', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual(['生活扶助', '醫療補助', '就學補助', '育兒生育', '長者與身障', '租屋就業']);
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
  });

  it('13 項每項恰屬一類', () => {
    const all = CATEGORIES.flatMap((c) => [...c.nos]).sort((x, y) => x - y);
    expect(all).toEqual(items13.map((i) => i.no).sort((x, y) => x - y));
  });

  it('categoryOf 依序號回分類；不在表內回 null', () => {
    expect(categoryOf(1)?.label).toBe('生活扶助');
    expect(categoryOf(9)?.label).toBe('醫療補助');
    expect(categoryOf(3)?.label).toBe('就學補助');
    expect(categoryOf(101)?.label).toBe('育兒生育');
    expect(categoryOf(6)?.label).toBe('長者與身障');
    expect(categoryOf(103)?.label).toBe('租屋就業');
    expect(categoryOf(999)).toBeNull();
  });
});

describe('keyCondition：收入上限 > 年齡 > 身分 > 不限', () => {
  it('有收入上限就顯示收入', () => {
    expect(keyCondition(item(10))).toEqual({ label: '每人月收入上限', value: '24,293 元' });
    expect(keyCondition(item(6))).toEqual({ label: '每人月收入上限', value: '33,252 元' });
  });

  it('沒有收入上限看年齡', () => {
    expect(keyCondition(item(103))).toEqual({ label: '年齡', value: '18～29 歲' });
    expect(keyCondition({ ...item(6), incomeMax: null })).toEqual({ label: '年齡', value: '65 歲以上' });
    expect(keyCondition({ ...item(3), incomeMax: null })).toEqual({ label: '年齡', value: '25 歲以下' });
  });

  it('收入、年齡都沒有看身分', () => {
    expect(keyCondition(item(101))).toEqual({ label: '身分', value: '懷孕或 60 天內分娩' });
    expect(keyCondition({ ...item(1), incomeMax: null })).toEqual({ label: '身分', value: '低收入戶' });
    expect(keyCondition({ ...item(7), incomeMax: null })).toEqual({ label: '身分', value: '低收入戶或中低收入戶' });
  });

  it('都沒有回不限', () => {
    expect(keyCondition({ ...item(9), incomeMax: null })).toEqual({ label: '條件', value: '不限' });
  });
});
