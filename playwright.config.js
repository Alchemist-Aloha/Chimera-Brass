import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    launchOptions: {
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command: process.env.BROWSER_PRODUCTION
      ? 'npm run preview -- --host 127.0.0.1 --port 5174 --strictPort'
      : 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    port: 5174, reuseExistingServer: !process.env.CI,
  },
});
