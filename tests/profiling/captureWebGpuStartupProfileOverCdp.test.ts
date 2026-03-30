import { describe, expect, it } from 'vitest';

import * as captureScript from '../../scripts/captureWebGpuStartupProfileOverCdp.mjs';

const {
  parseBrowserArgs,
} = captureScript as typeof captureScript & {
  parseBrowserArgs: (env?: NodeJS.ProcessEnv) => string[];
};

describe('captureWebGpuStartupProfileOverCdp', () => {
  it('returns no extra args by default', () => {
    expect(parseBrowserArgs({})).toEqual([]);
  });

  it('parses newline-delimited browser args from the environment', () => {
    expect(parseBrowserArgs({
      PLAYWRIGHT_PROFILE_BROWSER_ARGS: '--force_high_performance_gpu\n--enable-unsafe-webgpu\n--ignore-gpu-blocklist',
    })).toEqual([
      '--force_high_performance_gpu',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
    ]);
  });

  it('parses double-semicolon-delimited browser args from the environment', () => {
    expect(parseBrowserArgs({
      PLAYWRIGHT_PROFILE_BROWSER_ARGS: '--flag-a;; --flag-b ;;--flag-c',
    })).toEqual([
      '--flag-a',
      '--flag-b',
      '--flag-c',
    ]);
  });
});
