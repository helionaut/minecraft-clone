import { describe, expect, it } from 'vitest';

import {
  WEBGPU_SAFE_MODE_STORAGE_KEY,
  attachWebGpuDeviceLossHandler,
  clearWebGpuSafeMode,
  getAutoWebGpuRendererGate,
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

describe('getAutoWebGpuRendererGate', () => {
  it('keeps automatic WebGPU disabled until an environment is explicitly allowlisted', () => {
    expect(getAutoWebGpuRendererGate({
      browserSupportsWebGpu: true,
      preferenceMode: 'auto',
      rendererDiagnostics: {
        mode: 'hardware-accelerated',
        summary: 'WebGL 2 | hardware accelerated | ANGLE (NVIDIA, NVIDIA GeForce RTX 3070, OpenGL 4.6)',
      },
      userAgent: 'Mozilla/5.0 Chrome/135.0.0.0 Safari/537.36',
    })).toEqual({
      allowed: false,
      reason: 'webgpu-stability-gated',
    });
  });

  it('preserves the query-string retry override for WebGPU experiments', () => {
    expect(getAutoWebGpuRendererGate({
      browserSupportsWebGpu: true,
      preferenceMode: 'force-webgpu',
      rendererDiagnostics: {
        mode: 'hardware-accelerated',
        summary: 'WebGL 2 | hardware accelerated | ANGLE (NVIDIA, NVIDIA GeForce RTX 3070, OpenGL 4.6)',
      },
      userAgent: 'Mozilla/5.0 Chrome/135.0.0.0 Safari/537.36',
    })).toEqual({
      allowed: true,
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

describe('attachWebGpuDeviceLossHandler', () => {
  it('stops the animation loop and forwards the first device-loss event', () => {
    const loopChanges: Array<((time: number) => void) | null> = [];
    const defaultEvents: unknown[] = [];
    const forwardedEvents: unknown[] = [];
    const renderer = {
      onDeviceLost: (info: unknown) => {
        defaultEvents.push(info);
      },
      setAnimationLoop: (callback: ((time: number) => void) | null) => {
        loopChanges.push(callback);
      },
    };
    const firstInfo = { message: 'GPU reset', reason: 'destroyed' };
    const secondInfo = { message: 'Duplicate loss', reason: 'destroyed' };

    attachWebGpuDeviceLossHandler(renderer, (info) => {
      forwardedEvents.push(info);
    });

    renderer.onDeviceLost(firstInfo);
    renderer.onDeviceLost(secondInfo);

    expect(defaultEvents).toEqual([firstInfo, secondInfo]);
    expect(loopChanges).toEqual([null]);
    expect(forwardedEvents).toEqual([firstInfo]);
  });
});
