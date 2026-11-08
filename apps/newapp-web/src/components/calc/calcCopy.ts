import type { AgeBand, AnswerIdentity } from '@app/shared';

/** 年齡區間格子的副標：該區間會碰到的補助類型（對應 lib/categories 的分類，不放金額） */
export const AGE_BAND_SUB: Record<AgeBand, string> = {
  u18: '就學補助',
  '18-25': '就學・租屋',
  '26-39': '青年・育兒',
  '40-64': '生活・醫療',
  '65+': '長者津貼',
};

/** 身分勾選列的副標：一句白話說明（資格認定以主管機關核定為準） */
export const IDENTITY_SUB: Record<AnswerIdentity, string> = {
  low: '取得區公所核定的低收入戶資格',
  mid: '取得區公所核定的中低收入戶資格',
  dis: '領有身心障礙證明',
  preg: '目前懷孕，或分娩後 60 天內',
  stu: '目前在學、具有學籍',
  none: '以上身分都不符合',
};

/** 身分勾選列圖示（24×24 線條 path） */
export const IDENTITY_ICON: Record<AnswerIdentity, string> = {
  low: 'M4 10l8-6 8 6v10H4z M10 20v-6h4v6',
  mid: 'M3 20h18 M5 20V10l7-5 7 5v10 M9 14h6',
  dis: 'M12 5a1.5 1.5 0 1 0 0-.01 M10 9h4l-1 5h4l2 5 M13 14a5 5 0 1 1-6-3',
  preg: 'M12 4a2.5 2.5 0 1 0 0 .01 M9 21v-6l-1-4a4 4 0 0 1 8 2c0 2-1.5 3-3 3 M15 21v-4',
  stu: 'M2 9l10-5 10 5-10 5z M6 11v5c2 2 10 2 12 0v-5 M22 9v6',
  none: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M6 18L18 6',
};
