import { describe, expect, it } from 'vitest';

import { isUsableWebGpuAdapter } from '../../src/rendering/sceneRenderer.ts';

describe('isUsableWebGpuAdapter', () => {
  it('rejects a missing adapter', () => {
    expect(isUsableWebGpuAdapter(null)).toBe(false);
  });

  it('rejects fallback adapters', () => {
    expect(isUsableWebGpuAdapter({
      isFallbackAdapter: true,
    })).toBe(false);
  });

  it('accepts a non-fallback adapter', () => {
    expect(isUsableWebGpuAdapter({
      isFallbackAdapter: false,
    })).toBe(true);
  });
});
