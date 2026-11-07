import { AGE_MAX, AGE_MIN, type AnswerIdentity, type Answers } from '@app/shared';

export const MSG_AGE = '請輸入 0 到 120 的整數';
export const MSG_IDENTITY = '請至少選一項，沒有就選以上皆無';
export const MSG_RESIDENCY = '請選擇是或否';
export const MSG_INCOME = '請選一個級距，不確定就選不清楚';

export function emptyAnswers(): Answers {
  return { age: null, residency: null, identities: [], incomeBracket: null };
}

/** [SUBS-R11] 年齡須為 0～120 整數；回 null 表示輸入不合法 */
export function parseAgeInput(input: string): number | null {
  const s = input.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= AGE_MIN && n <= AGE_MAX ? n : null;
}

/** [SUBS-R11] 第 step 題（0～3）不過時回提示文字，過了回 null */
export function validateStep(step: number, a: Answers): string | null {
  if (step === 0) return a.age === null ? MSG_AGE : null;
  if (step === 1) return a.residency === null ? MSG_RESIDENCY : null;
  if (step === 2) return a.identities.length === 0 ? MSG_IDENTITY : null;
  if (step === 3) return a.incomeBracket === null ? MSG_INCOME : null;
  return null;
}

/** [SUBS-R12] 切換身分：選「以上皆無」清掉其他；選其他清掉「以上皆無」 */
export function toggleIdentity(current: AnswerIdentity[], id: AnswerIdentity): AnswerIdentity[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (id === 'none') return ['none'];
  return [...current.filter((x) => x !== 'none'), id];
}

export interface DemoScenario {
  /** 開始頁按鈕標題與副標（取自原型） */
  title: string;
  sub: string;
  answers: Answers;
}

/** [SUBS-R23] 示範情境三組（spec 7.7，前端常數，不是資料） */
export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    title: '70 歲長者',
    sub: '無特殊身分・每人月收入 24,294～28,550 元',
    answers: { age: 70, residency: true, identities: ['none'], incomeBracket: 3 },
  },
  {
    title: '40 歲・身心障礙者',
    sub: '每人月收入 28,551～33,252 元',
    answers: { age: 40, residency: true, identities: ['dis'], incomeBracket: 4 },
  },
  {
    title: '30 歲・懷孕・中低收入戶',
    sub: '每人月收入 17,006～24,293 元',
    answers: { age: 30, residency: true, identities: ['preg', 'mid'], incomeBracket: 2 },
  },
];

/** [SUBS-R23] 取第 index 組示範答案的副本（四題都已填，直接成為已完成） */
export function demoAnswers(index: number): Answers {
  const demo = DEMO_SCENARIOS[index];
  if (!demo) throw new Error(`沒有第 ${index} 組示範情境`);
  return { ...demo.answers, identities: [...demo.answers.identities] };
}
