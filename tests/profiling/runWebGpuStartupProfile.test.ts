import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    expect(output).toContain('CDP endpoint: ');
    expect(output).toContain('require RTX renderer: true');
    expect(output).toContain(`report command: ${process.execPath} `);
    expect(output).toContain('summarizeWebGpuStartupProfile.mjs');
    expect(output).toContain(`dry run command: ${process.execPath} `);
    expect(output).toContain('captureWebGpuStartupProfileOverCdp.mjs');
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
    expect(plan.requireRtxRenderer).toBe(true);
    expect(plan.artifactResultsDir).toBe('reports/startup-profiling/test-results');
    expect(plan.reportCommand).toBe(process.execPath);
    expect(plan.reportArgs[0]).toContain('summarizeWebGpuStartupProfile.mjs');
    expect(comparePlan.compareCommand).toBe(process.execPath);
    expect(comparePlan.compareArgs[0]).toContain('compareWebGpuStartupProfiles.mjs');
    expect(plan.args[0]).toContain('captureWebGpuStartupProfileOverCdp.mjs');
    expect(plan.executablePath).toBe(process.execPath);
    expect(plan.cdpEndpointUrl).toBe('');
  });

  it('switches to the CDP capture command when a CDP endpoint is configured', () => {
    const plan = buildWebGpuStartupProfileRun({
      PLAYWRIGHT_BASE_URL: 'https://example.invalid',
      PLAYWRIGHT_PROFILE_CDP_ENDPOINT_URL: 'http://127.0.0.1:9333',
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      throw new Error('expected plan to succeed');
    }

    expect(plan.cdpEndpointUrl).toBe('http://127.0.0.1:9333');
    expect(plan.requireRtxRenderer).toBe(true);
    expect(plan.command).toBe(process.execPath);
    expect(plan.args[0]).toContain('captureWebGpuStartupProfileOverCdp.mjs');
  });

  it('allows the wrapper to disable the RTX requirement explicitly', () => {
    const plan = buildWebGpuStartupProfileRun({
      PLAYWRIGHT_BASE_URL: 'https://example.invalid',
      PLAYWRIGHT_PROFILE_BROWSER_CHANNEL: '',
      PLAYWRIGHT_PROFILE_REQUIRE_RTX: '0',
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      throw new Error('expected plan to succeed');
    }

    expect(plan.requireRtxRenderer).toBe(false);
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
    const tempRoot = await mkdtemp(join(tmpdir(), 'hel-142-profile-results-'));
    const oldestDir = join(tempRoot, 'oldest');
    const newestExpectedDir = join(tempRoot, 'newest');

    try {
      await mkdir(oldestDir);
      await mkdir(newestExpectedDir);

      await utimes(oldestDir, new Date('2026-03-30T00:00:00.000Z'), new Date('2026-03-30T00:00:00.000Z'));
      await utimes(newestExpectedDir, new Date('2026-03-31T00:00:00.000Z'), new Date('2026-03-31T00:00:00.000Z'));

      const newestDir = await findLatestArtifactOutputDir(tempRoot);

      expect(newestDir).toBe(newestExpectedDir);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('builds an upload manifest for the generated artifact bundle', () => {
    const manifestBuilder = startupProfileScript as typeof startupProfileScript & {
      buildStartupProfileUploadManifest: (artifactOutputDir: string, files?: string[]) => {
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

  it('can enrich the upload manifest with a target-surface verdict', () => {
    const manifestBuilder = startupProfileScript as typeof startupProfileScript & {
      buildStartupProfileUploadManifest: (
        artifactOutputDir: string,
        files?: string[],
        targetSurface?: Record<string, unknown> | null,
      ) => {
        json: Record<string, unknown>;
        markdown: string;
      };
    };
    const manifest = manifestBuilder.buildStartupProfileUploadManifest(
      'reports/startup-profiling/test-results/example-artifact-dir',
      ['runtime-status.json', 'startup-profile-report.json'],
      {
        meetsRequirement: false,
        status: 'non-rtx-surface',
        summary: 'Did not match the requested RTX/WebGPU target surface (renderer does not identify an RTX GPU).',
        reasons: ['renderer does not identify an RTX GPU'],
      },
    );

    expect(manifest.json.targetSurface).toBeTruthy();
    expect(manifest.markdown).toContain('## Target surface verdict');
    expect(manifest.markdown).toContain('Did not match the requested RTX/WebGPU target surface');
  });

  it('filters the upload bundle down to files that actually exist', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'hel-142-profile-bundle-'));
    const manifestHelpers = startupProfileScript as typeof startupProfileScript & {
      collectExistingStartupProfileBundleFiles: (
        artifactOutputDir: string,
        pathExists?: (path: string) => boolean,
      ) => string[];
    };

    try {
      await mkdir(tempRoot, { recursive: true });
      const files = manifestHelpers.collectExistingStartupProfileBundleFiles(
        tempRoot,
        (path: string) => path.endsWith('runtime-status.json') || path.endsWith('startup-profile-report.json'),
      );

      expect(files).toEqual([
        'runtime-status.json',
        'startup-profile-report.json',
      ]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('accepts raw baseline artifacts when the baseline report file is missing', () => {
    const baselineHelpers = startupProfileScript as typeof startupProfileScript & {
      hasStartupProfileBaselineArtifacts: (
        artifactDir: string,
        pathExists?: (path: string) => boolean,
      ) => boolean;
    };
    const hasBaseline = baselineHelpers.hasStartupProfileBaselineArtifacts(
      'reports/startup-profiling/test-results/webgpuStartup.profile-capt-28d63-e-WebGPU-scene-startup-path',
      (path: string) => path.endsWith('runtime-status.json') || path.endsWith('console-messages.json'),
    );

    expect(hasBaseline).toBe(true);
  });
});
