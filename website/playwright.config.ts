import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4322', browserName: 'chromium', channel: 'chromium', permissions: ['clipboard-read', 'clipboard-write'], trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4322', reuseExistingServer: false }
});
