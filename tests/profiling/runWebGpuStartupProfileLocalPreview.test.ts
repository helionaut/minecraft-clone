import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  buildLocalPreviewProfilePlan,
  waitForUrl,
} from '../../scripts/runWebGpuStartupProfileLocalPreview.mjs';

const scriptPath = 'scripts/runWebGpuStartupProfileLocalPreview.mjs';

describe('runWebGpuStartupProfileLocalPreview', () => {
  it('prints the local preview commands during dry run', () => {
    const output = execFileSync('node', [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_PROFILE_DRY_RUN: '1',
      },
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(output).toContain('preview URL: http://127.0.0.1:4173/minecraft-clone/');
    expect(output).toContain('build command: npm run build');
    expect(output).toContain('preview command: npm run preview -- --host 127.0.0.1 --port 4173');
    expect(output).toContain('capture command: npm run profile:webgpu-startup');
  });

  it('builds the expected default local preview plan', () => {
    const plan = buildLocalPreviewProfilePlan({});

    expect(plan.previewURL).toBe('http://127.0.0.1:4173/minecraft-clone/');
    expect(plan.waitTimeoutMs).toBe(30000);
    expect(plan.previewArgs).toEqual(['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173']);
  });

  it('supports overriding the preview host, port, path, and timeout', () => {
    const plan = buildLocalPreviewProfilePlan({
      PLAYWRIGHT_PROFILE_PREVIEW_HOST: '0.0.0.0',
      PLAYWRIGHT_PROFILE_PREVIEW_PORT: '8080',
      PLAYWRIGHT_PROFILE_PREVIEW_PATH: 'custom/',
      PLAYWRIGHT_PROFILE_PREVIEW_TIMEOUT_MS: '12000',
    });

    expect(plan.previewURL).toBe('http://0.0.0.0:8080/custom/');
    expect(plan.waitTimeoutMs).toBe(12000);
  });

  it('times out cleanly when the preview URL never becomes ready', async () => {
    await expect(waitForUrl('http://127.0.0.1:9/minecraft-clone/', 20, 5)).rejects.toThrowError(
      /Timed out waiting for local preview/,
    );
  });
});
