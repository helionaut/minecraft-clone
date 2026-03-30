import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

// @ts-expect-error importing untyped ESM helper for direct wrapper-plan tests
import { buildWebGpuStartupProfileRun, validateBrowserChannel } from '../../scripts/runWebGpuStartupProfile.mjs';

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
        PLAYWRIGHT_PROFILE_BROWSER_CHANNEL: '',
        PLAYWRIGHT_PROFILE_DRY_RUN: '1',
      },
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(output).toContain('base URL: https://example.invalid');
    expect(output).toContain('browser channel: ');
    expect(output).toContain('dry run command: npx playwright test --config=playwright.profile.config.ts');
  });

  it('fails early when a requested Chrome channel is missing on Linux', () => {
    const plan = buildWebGpuStartupProfileRun({
      PLAYWRIGHT_BASE_URL: 'https://example.invalid',
      PLAYWRIGHT_PROFILE_BROWSER_CHANNEL: 'chrome',
      PLAYWRIGHT_BROWSERS_PATH: '.cache/ms-playwright',
    });

    expect(plan.ok).toBe(false);
    if (plan.ok) {
      throw new Error('expected plan to fail');
    }

    expect(plan.error).toContain('Requested browser channel "chrome" is not installed');
    expect(plan.error).toContain('unset PLAYWRIGHT_PROFILE_BROWSER_CHANNEL to use bundled Chromium');
  });

  it('allows bundled Chromium when the browser channel is explicitly empty', () => {
    const plan = buildWebGpuStartupProfileRun({
      PLAYWRIGHT_BASE_URL: 'https://example.invalid',
      PLAYWRIGHT_PROFILE_BROWSER_CHANNEL: '',
      PLAYWRIGHT_BROWSERS_PATH: '.cache/ms-playwright',
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      throw new Error('expected plan to succeed');
    }

    expect(plan.browserChannel).toBe('');
  });

  it('ignores unknown channels in the Linux preflight', () => {
    expect(validateBrowserChannel({
      PLAYWRIGHT_BROWSERS_PATH: '.cache/ms-playwright',
    }, 'chromium')).toBeNull();
  });
});
