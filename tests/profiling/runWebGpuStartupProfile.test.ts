import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import * as startupProfileScript from '../../scripts/runWebGpuStartupProfile.mjs';

const {
  buildWebGpuStartupProfileRun,
  findLatestArtifactOutputDir,
  validateBrowserChannel,
  validateBrowserExecutablePath,
} = startupProfileScript;

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
    expect(output).toContain('browser executable: ');
    expect(output).toContain('report command: npm run profile:webgpu-startup:report');
    expect(output).toContain('dry run command: npx playwright test --config=playwright.profile.config.ts');
  });

  it('fails early when a requested Chrome channel is missing on Linux', () => {
    const error = validateBrowserChannel({
      PLAYWRIGHT_BROWSERS_PATH: '.cache/ms-playwright',
    }, 'chrome', () => false);

    expect(error).toContain('Requested browser channel "chrome" is not installed');
    expect(error).toContain('unset PLAYWRIGHT_PROFILE_BROWSER_CHANNEL to use bundled Chromium');
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

  it('accepts an explicit browser executable path without requiring a channel install', () => {
    const plan = buildWebGpuStartupProfileRun({
      PLAYWRIGHT_BASE_URL: 'https://example.invalid',
      PLAYWRIGHT_PROFILE_BROWSER_CHANNEL: 'chrome',
      PLAYWRIGHT_PROFILE_EXECUTABLE_PATH: process.execPath,
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      throw new Error('expected plan to succeed');
    }

    const comparePlan = plan as typeof plan & {
      compareCommand: string;
      compareArgs: string[];
    };

    expect(plan.browserChannel).toBe('');
    expect(plan.artifactResultsDir).toBe('reports/startup-profiling/test-results');
    expect(plan.reportCommand).toBe('npm');
    expect(plan.reportArgs).toEqual(['run', 'profile:webgpu-startup:report']);
    expect(comparePlan.compareCommand).toBe('npm');
    expect(comparePlan.compareArgs).toEqual(['run', 'profile:webgpu-startup:compare']);
    expect(plan.executablePath).toBe(process.execPath);
  });

  it('fails early when the configured executable path does not exist', () => {
    const error = validateBrowserExecutablePath({
      PLAYWRIGHT_PROFILE_EXECUTABLE_PATH: '/missing/chrome',
    }, () => false);

    expect(error).toContain('PLAYWRIGHT_PROFILE_EXECUTABLE_PATH points to a missing browser binary');
  });

  it('ignores unknown channels in the Linux preflight', () => {
    expect(validateBrowserChannel({
      PLAYWRIGHT_BROWSERS_PATH: '.cache/ms-playwright',
    }, 'chromium')).toBeNull();
  });

  it('finds the newest Playwright output directory for post-processing', async () => {
    const newestDir = await findLatestArtifactOutputDir('reports/startup-profiling/test-results');

    expect([
      null,
      'reports/startup-profiling/test-results/webgpuStartup.profile-capt-28d63-e-WebGPU-scene-startup-path',
    ]).toContain(newestDir);
  });

  it('builds an upload manifest for the generated artifact bundle', () => {
    const manifestBuilder = startupProfileScript as typeof startupProfileScript & {
      buildStartupProfileUploadManifest: (artifactOutputDir: string) => {
        json: {
          artifactDir: string;
          files: string[];
        };
        markdown: string;
      };
    };
    const manifest = manifestBuilder.buildStartupProfileUploadManifest(
      'reports/startup-profiling/test-results/webgpuStartup.profile-capt-28d63-e-WebGPU-scene-startup-path',
    );

    expect(manifest.json.artifactDir).toContain('webgpuStartup.profile-capt-28d63-e-WebGPU-scene-startup-path');
    expect(manifest.json.files).toContain('chrome-performance-trace.json');
    expect(manifest.json.files).toContain('startup-profile-report.json');
    expect(manifest.json.files).toContain('startup-profile-comparison.json');
    expect(manifest.markdown).toContain('startup-profile-report.json');
    expect(manifest.markdown).toContain('startup-profile-comparison.json');
  });
});
