import { createApp } from 'vue';
import App from './App.vue';
import { installMockTownPassBridge } from './lib/mockTownPassBridge';
import { router } from './router';
import './style.css';

// 網址帶 ?mockBridge=1（或 VITE_MOCK_BRIDGE=1）時在瀏覽器模擬台北通 bridge；真的在台北通殼內不覆蓋（docs/townpass-integration.md 3.4）
installMockTownPassBridge();

createApp(App).use(router).mount('#app');
