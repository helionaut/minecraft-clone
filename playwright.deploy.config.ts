import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;

if (!baseURL) {
  throw new Error('PLAYWRIGHT_BASE_URL is required for deployment smoke tests.');
}

export default defineConfig({
  testDir: './tests/deploy',
  timeout: 30_000,
  retries: 1,
  workers: 1,
  outputDir: 'reports/deploy-smoke/test-results',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/deploy-smoke/html-report', open: 'never' }],
    ['json', { outputFile: 'reports/deploy-smoke/results.json' }],
  ],
});
