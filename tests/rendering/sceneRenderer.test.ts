import { describe, expect, it } from 'vitest';

import {
  WEBGPU_SAFE_MODE_STORAGE_KEY,
  clearWebGpuSafeMode,
  getWebGpuPreference,
  isUsableWebGpuAdapter,
  persistWebGpuSafeMode,
} from '../../src/rendering/sceneRenderer.ts';

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

describe('getWebGpuPreference', () => {
  it('forces WebGL after a persisted device-loss safe mode marker', () => {
    expect(getWebGpuPreference('', {
      getItem: (key) => (key === WEBGPU_SAFE_MODE_STORAGE_KEY ? '{"reason":"destroyed"}' : null),
    })).toEqual({
      mode: 'force-webgl',
      reason: 'webgpu-device-lost',
    });
  });

  it('allows a query-string override to retry WebGPU', () => {
    expect(getWebGpuPreference('?renderer=webgpu', {
      getItem: (key) => (key === WEBGPU_SAFE_MODE_STORAGE_KEY ? '{"reason":"destroyed"}' : null),
    })).toEqual({
      mode: 'force-webgpu',
      reason: null,
    });
  });

  it('keeps automatic selection when there is no override or safe-mode marker', () => {
    expect(getWebGpuPreference('', {
      getItem: () => null,
    })).toEqual({
      mode: 'auto',
      reason: null,
    });
  });
});

describe('WebGPU safe mode persistence', () => {
  it('records device-loss details in local storage', () => {
    let storedValue: string | null = null;

    persistWebGpuSafeMode({
      setItem: (_key, value) => {
        storedValue = value;
      },
    }, {
      message: 'Device was destroyed.',
      reason: 'destroyed',
    });

    expect(storedValue).not.toBeNull();
    expect(JSON.parse(storedValue ?? '')).toMatchObject({
      message: 'Device was destroyed.',
      reason: 'destroyed',
    });
  });

  it('clears the persisted safe-mode marker after a successful retry', () => {
    let removedKey: string | null = null;

    clearWebGpuSafeMode({
      removeItem: (key) => {
        removedKey = key;
      },
    });

    expect(removedKey).toBe(WEBGPU_SAFE_MODE_STORAGE_KEY);
  });
});
