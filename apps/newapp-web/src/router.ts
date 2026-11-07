import { createRouter, createWebHistory, type RouteRecordRaw, type Router, type RouterHistory } from 'vue-router';
import { useQuery } from '@/composables/useQuery';

/** 結果頁與詳細資訊頁需要四題都答完；直接開網址或重新整理（答案已清空）時回開始頁 */
function requireCompleted() {
  return useQuery().answersState.value === 'completed' ? true : { name: 'home' };
}

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
  { path: '/question', name: 'question', component: () => import('@/pages/QuestionPage.vue') },
  {
    path: '/result',
    name: 'result',
    component: () => import('@/pages/ResultPage.vue'),
    beforeEnter: requireCompleted,
  },
  {
    // sa-2-overview.md 4.8：詳細資訊為獨立路由頁，有自己的頂列，不顯示共用標頭
    path: '/detail/:no(\\d+)',
    name: 'detail',
    component: () => import('@/pages/DetailPage.vue'),
    beforeEnter: requireCompleted,
    meta: { fullPage: true },
  },
  // 資料來源頁（spec 7.6、sa-3-s2.md W5）：不需答案，清單沒載到時頁面自己顯示無法取得
  { path: '/source', name: 'source', component: () => import('@/pages/SourcePage.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

/** 每個 router 上一個站內頁面的名稱（直接開網址進來時為 null）；資料來源頁的「返回」用 */
const previousName = new WeakMap<Router, string | null>();

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({
    history,
    routes,
    // 從詳細資訊頁返回結果時回到原本捲動位置（4.8）；其他換頁回頂端
    scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
  });
  router.afterEach((_to, from) => {
    previousName.set(router, typeof from.name === 'string' ? from.name : null);
  });
  return router;
}

/** 上一頁是不是站內頁面（是就能 router.back()） */
export function previousRouteName(router: Router): string | null {
  return previousName.get(router) ?? null;
}

export const router = createAppRouter();
