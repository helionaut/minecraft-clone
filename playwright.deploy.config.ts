import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;

if (!baseURL) {
  throw new Error('PLAYWRIGHT_BASE_URL is required for deployment smoke tests.');
}

export default defineConfig({
  testDir: './tests/deploy',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  reporter: [['list']],
});
