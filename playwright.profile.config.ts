import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;

if (!baseURL) {
  throw new Error('PLAYWRIGHT_BASE_URL is required for startup profiling runs.');
}

export default defineConfig({
  testDir: './tests/profiling',
  testMatch: ['*.profile.spec.ts'],
  timeout: 180_000,
  retries: 0,
  workers: 1,
  outputDir: 'reports/startup-profiling/test-results',
  use: {
    baseURL,
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_PROFILE_BROWSER_CHANNEL || undefined,
    trace: 'retain-on-failure',
    viewport: { width: 1600, height: 900 },
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/startup-profiling/html-report', open: 'never' }],
    ['json', { outputFile: 'reports/startup-profiling/results.json' }],
  ],
});
