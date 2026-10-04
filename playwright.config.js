import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]], workers: 1,
  webServer: [
    { command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 60000 },
    { command: 'npm run server', url: 'http://127.0.0.1:8787/api/session', reuseExistingServer: !process.env.CI, timeout: 60000 },
  ],
})
