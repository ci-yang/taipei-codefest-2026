import type { AnswerIdentity, Answers } from '@app/shared';

export const MSG_AGE = '請選擇年齡區間';
export const MSG_IDENTITY = '請至少選一項，沒有就選以上皆無';
export const MSG_RESIDENCY = '請選擇戶籍縣市';
export const MSG_INCOME = '請選一個級距，不確定就選不清楚';

export function emptyAnswers(): Answers {
  return { ageBand: null, residency: null, identities: [], incomeBracket: null };
}

/** [SUBS-R11] 第 step 題（0 年齡、1 戶籍、2 身分、3 收入）不過時回提示文字，過了回 null */
export function validateStep(step: number, a: Answers): string | null {
  if (step === 0) return a.ageBand === null ? MSG_AGE : null;
  if (step === 1) return a.residency === null ? MSG_RESIDENCY : null;
  if (step === 2) return a.identities.length === 0 ? MSG_IDENTITY : null;
  if (step === 3) return a.incomeBracket === null ? MSG_INCOME : null;
  return null;
}

/** 首頁四張題卡的順序（SUBS-R11 送出時捲到第一張有錯的卡） */
export const QUESTION_COUNT = 4;

/** [SUBS-R11] 送出時一次驗四題：回四個位置的錯誤訊息（null＝該題沒問題） */
export function validateAnswers(a: Answers): Array<string | null> {
  return Array.from({ length: QUESTION_COUNT }, (_, step) => validateStep(step, a));
}

/** [SUBS-R11] 第一張有錯的卡（0～3）；都沒錯回 -1 */
export function firstErrorIndex(errors: ReadonlyArray<string | null>): number {
  return errors.findIndex((e) => e !== null);
}

/** [SUBS-R12] 切換身分：選「以上皆無」清掉其他；選其他清掉「以上皆無」 */
export function toggleIdentity(current: AnswerIdentity[], id: AnswerIdentity): AnswerIdentity[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (id === 'none') return ['none'];
  return [...current.filter((x) => x !== 'none'), id];
}

export interface DemoScenario {
  /** 首頁按鈕圖示文字、標題與副標（取自原型） */
  icon: string;
  title: string;
  sub: string;
  answers: Answers;
}

/** [SUBS-R23] 示範情境三組（spec 7.7，前端常數，不是資料）；年齡改區間（ADR-030，v3 五格：70 歲→65+、40 歲→40-64、30 歲→26-39） */
export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    icon: '70',
    title: '70 歲長者',
    sub: '無特殊身分・每人月收入 24,294～28,550 元',
    answers: { ageBand: '65+', residency: true, identities: ['none'], incomeBracket: 3 },
  },
  {
    icon: '40',
    title: '40 歲・身心障礙者',
    sub: '每人月收入 28,551～33,252 元',
    answers: { ageBand: '40-64', residency: true, identities: ['dis'], incomeBracket: 4 },
  },
  {
    icon: '30',
    title: '30 歲・懷孕・中低收入戶',
    sub: '每人月收入 17,006～24,293 元',
    answers: { ageBand: '26-39', residency: true, identities: ['preg', 'mid'], incomeBracket: 2 },
  },
];

/** [SUBS-R23] 取第 index 組示範答案的副本（四題都已填，直接成為已完成） */
export function demoAnswers(index: number): Answers {
  const demo = DEMO_SCENARIOS[index];
  if (!demo) throw new Error(`沒有第 ${index} 組示範情境`);
  return { ...demo.answers, identities: [...demo.answers.identities] };
}
