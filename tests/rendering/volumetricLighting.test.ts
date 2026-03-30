import { describe, expect, it } from 'vitest';

import { getVolumetricLightingDecision } from '../../src/rendering/volumetricLighting.ts';

describe('getVolumetricLightingDecision', () => {
  it('disables volumetric lighting on mobile devices', () => {
    expect(getVolumetricLightingDecision({
      touchDevice: true,
      rendererMode: 'hardware-accelerated',
      browserSupportsWebGpu: true,
      hasRtxVolumetricPipeline: true,
    })).toEqual({
      enabled: false,
      reason: 'mobile',
    });
  });

  it('disables volumetric lighting for software renderers on desktop', () => {
    expect(getVolumetricLightingDecision({
      touchDevice: false,
      rendererMode: 'software-fallback',
      browserSupportsWebGpu: true,
      hasRtxVolumetricPipeline: true,
    })).toEqual({
      enabled: false,
      reason: 'software-renderer',
    });
  });

  it('keeps the effect off when the browser has no WebGPU support', () => {
    expect(getVolumetricLightingDecision({
      touchDevice: false,
      rendererMode: 'hardware-accelerated',
      browserSupportsWebGpu: false,
      hasRtxVolumetricPipeline: true,
    })).toEqual({
      enabled: false,
      reason: 'webgpu-unavailable',
    });
  });

  it('does not misidentify an RTX-class desktop renderer as a working volumetric implementation', () => {
    expect(getVolumetricLightingDecision({
      touchDevice: false,
      rendererMode: 'hardware-accelerated',
      browserSupportsWebGpu: true,
      hasRtxVolumetricPipeline: false,
    })).toEqual({
      enabled: false,
      reason: 'rtx-pipeline-unavailable',
    });
  });

  it('keeps the effect off when runtime initialization falls back after WebGPU detection', () => {
    expect(getVolumetricLightingDecision({
      touchDevice: false,
      rendererMode: 'hardware-accelerated',
      browserSupportsWebGpu: true,
      hasRtxVolumetricPipeline: true,
      reasonOverride: 'rtx-pipeline-unavailable',
    })).toEqual({
      enabled: false,
      reason: 'rtx-pipeline-unavailable',
    });
  });
});
