/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // .env 放在 repo 根目錄（所有 app 共用一份）
  const envDir = fileURLToPath(new URL('../..', import.meta.url));
  const env = { ...loadEnv(mode, envDir, ''), ...process.env };
  const apiTarget = env.NEWAPP_VITE_PROXY_TARGET || `http://localhost:${env.NEWAPP_API_PORT || 8788}`;

  return {
    envDir,
    plugins: [vue()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      host: '0.0.0.0', // 手機同網段可用 http://<開發機IP>:5174 連
      port: 5174, // 5173 是 @app/web
      strictPort: true,
      proxy: {
        '/api': apiTarget,
        '/healthz': apiTarget,
      },
    },
    test: {
      environment: 'jsdom',
      include: ['test/**/*.test.ts'],
    },
  };
});
