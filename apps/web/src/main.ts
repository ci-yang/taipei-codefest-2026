import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { installMockTownPassBridge } from './composables/mockTownPassBridge';
import { router } from './router';
import './style.css';

// 網址帶 ?mockBridge=1（或 VITE_MOCK_BRIDGE=1）時在瀏覽器模擬台北通 bridge；真的在 App 內不覆蓋
installMockTownPassBridge();

createApp(App).use(createPinia()).use(router).mount('#app');
