import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const scriptPath = 'scripts/runWebGpuStartupProfile.mjs';

describe('runWebGpuStartupProfile', () => {
  it('fails with a clear error when PLAYWRIGHT_BASE_URL is missing', () => {
    const env = {
      ...process.env,
    };
    delete env.PLAYWRIGHT_BASE_URL;
    delete env.PLAYWRIGHT_PROFILE_BROWSER_CHANNEL;
    delete env.PLAYWRIGHT_PROFILE_DRY_RUN;

    expect(() => execFileSync('node', [scriptPath], {
      cwd: process.cwd(),
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    })).toThrowError(/PLAYWRIGHT_BASE_URL is required/);
  });

  it('prints the configured target details before invoking Playwright', () => {
    const output = execFileSync('node', [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: 'https://example.invalid',
        PLAYWRIGHT_PROFILE_BROWSER_CHANNEL: 'chrome-beta',
        PLAYWRIGHT_PROFILE_DRY_RUN: '1',
      },
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(output).toContain('base URL: https://example.invalid');
    expect(output).toContain('browser channel: chrome-beta');
    expect(output).toContain('dry run command: npx playwright test --config=playwright.profile.config.ts');
  });
});
