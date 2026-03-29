import type { RendererMode } from './sandboxStatus.ts';

export type VolumetricLightingDisableReason =
  | 'mobile'
  | 'software-renderer'
  | 'webgpu-unavailable'
  | 'rtx-pipeline-unavailable';

export interface VolumetricLightingDecision {
  readonly enabled: boolean;
  readonly reason: VolumetricLightingDisableReason | null;
}

export interface VolumetricLightingSupportInput {
  readonly touchDevice: boolean;
  readonly rendererMode: RendererMode;
  readonly browserSupportsWebGpu: boolean;
  readonly hasRtxVolumetricPipeline: boolean;
}

export function getVolumetricLightingDecision(
  input: VolumetricLightingSupportInput,
): VolumetricLightingDecision {
  if (input.touchDevice) {
    return {
      enabled: false,
      reason: 'mobile',
    };
  }

  if (input.rendererMode !== 'hardware-accelerated') {
    return {
      enabled: false,
      reason: 'software-renderer',
    };
  }

  if (!input.browserSupportsWebGpu) {
    return {
      enabled: false,
      reason: 'webgpu-unavailable',
    };
  }

  if (!input.hasRtxVolumetricPipeline) {
    return {
      enabled: false,
      reason: 'rtx-pipeline-unavailable',
    };
  }

  return {
    enabled: true,
    reason: null,
  };
}
