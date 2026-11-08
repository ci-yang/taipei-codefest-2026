import { createRouter, createWebHistory, type RouteRecordRaw, type Router, type RouterHistory } from 'vue-router';
import { useQuery } from '@/composables/useQuery';

/** 結果頁需要送出過（已完成）；直接開網址或重新整理（答案已清空）時改到試算頁 */
function requireCompleted() {
  return useQuery().answersState.value === 'completed' ? true : { name: 'calc' };
}

/**
 * 補助通 v3：首頁、試算（表單）、結果、全部補助、我的珍藏、資料來源；詳細資訊是彈窗（useDetail 的 history state），
 * 不另開路由。沒有底部導覽列。
 */
export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
  { path: '/calc', name: 'calc', component: () => import('@/pages/CalculatorPage.vue') },
  {
    path: '/result',
    name: 'result',
    component: () => import('@/pages/ResultPage.vue'),
    beforeEnter: requireCompleted,
  },
  // 全部補助：不需答案，有結果時帶判定
  { path: '/all', name: 'all', component: () => import('@/pages/AllSubsidiesPage.vue') },
  // 我的珍藏（W8）：不需答案，沒送出時列「尚未比對」
  { path: '/favorites', name: 'favorites', component: () => import('@/pages/FavoritesPage.vue') },
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
    // 換頁回頂端；同一頁（關詳細資訊彈窗時 history.back 回到同一網址）不動捲動位置（sa-2-overview.md 4.8）
    scrollBehavior: (to, from, savedPosition) => {
      if (to.fullPath === from.fullPath) return false;
      return savedPosition ?? { top: 0 };
    },
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
