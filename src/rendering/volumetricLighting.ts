import type { RendererMode } from './sandboxStatus.ts';

export type VolumetricLightingDisableReason =
  | 'mobile'
  | 'software-renderer'
  | 'webgpu-unavailable'
  | 'webgpu-stability-gated'
  | 'webgpu-device-lost'
  | 'webgpu-fallback-adapter'
  | 'webgpu-init-failed'
  | 'webgpu-backend-mismatch'
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
  readonly reasonOverride?: VolumetricLightingDisableReason;
}

export function getVolumetricLightingDecision(
  input: VolumetricLightingSupportInput,
): VolumetricLightingDecision {
  if (input.reasonOverride) {
    return {
      enabled: false,
      reason: input.reasonOverride,
    };
  }

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
