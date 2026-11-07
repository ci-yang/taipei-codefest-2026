import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
    { path: '/map', name: 'map', component: () => import('@/pages/FriendlyMapPage.vue') },
    { path: '/about', name: 'about', component: () => import('@/pages/AboutPage.vue') },
    // 新頁面：在這裡加一筆 { path: '/<feature>', name: '<feature>', component: () => import(...) }
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
