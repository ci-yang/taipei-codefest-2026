import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', alias: '/benefits', name: 'benefits', component: () => import('@/pages/BenefitsPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
