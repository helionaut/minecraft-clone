import { describe, expect, it } from 'vitest';

import * as captureScript from '../../scripts/captureWebGpuStartupProfileOverCdp.mjs';

const {
  parseBrowserArgs,
  parseRequireRtxRenderer,
} = captureScript as typeof captureScript & {
  parseBrowserArgs: (env?: NodeJS.ProcessEnv) => string[];
  parseRequireRtxRenderer: (env?: NodeJS.ProcessEnv) => boolean;
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

  it('defaults the low-level capture script to non-RTX mode unless explicitly requested', () => {
    expect(parseRequireRtxRenderer({})).toBe(false);
    expect(parseRequireRtxRenderer({
      PLAYWRIGHT_PROFILE_REQUIRE_RTX: '1',
    })).toBe(true);
    expect(parseRequireRtxRenderer({
      PLAYWRIGHT_PROFILE_REQUIRE_RTX: '0',
    })).toBe(false);
  });
});
