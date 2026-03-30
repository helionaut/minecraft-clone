import { WebGLRenderer } from 'three';
import { WebGPURenderer } from 'three/webgpu';

import {
  getVolumetricLightingDecision,
  type VolumetricLightingDecision,
  type VolumetricLightingDisableReason,
} from './volumetricLighting.ts';
import type { RendererDiagnostics } from './sandboxStatus.ts';

export type SceneRenderer = WebGLRenderer | WebGPURenderer;
export type SceneRendererBackend = 'webgl' | 'webgpu';

export interface SceneRendererSelection {
  readonly renderer: SceneRenderer;
  readonly backend: SceneRendererBackend;
  readonly volumetricLighting: VolumetricLightingDecision;
}

interface CreateSceneRendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly touchDevice: boolean;
  readonly rendererDiagnostics: RendererDiagnostics;
}

function createWebGlRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  return new WebGLRenderer({
    antialias: true,
    alpha: true,
    canvas,
  });
}

function fallbackSelection(
  canvas: HTMLCanvasElement,
  touchDevice: boolean,
  rendererDiagnostics: RendererDiagnostics,
  reasonOverride?: VolumetricLightingDisableReason,
): SceneRendererSelection {
  return {
    renderer: createWebGlRenderer(canvas),
    backend: 'webgl',
    volumetricLighting: getVolumetricLightingDecision({
      touchDevice,
      rendererMode: rendererDiagnostics.mode,
      browserSupportsWebGpu: typeof navigator.gpu !== 'undefined',
      hasRtxVolumetricPipeline: false,
      reasonOverride,
    }),
  };
}

export async function createSceneRenderer(
  options: CreateSceneRendererOptions,
): Promise<SceneRendererSelection> {
  const { canvas, touchDevice, rendererDiagnostics } = options;
  const browserSupportsWebGpu = typeof navigator.gpu !== 'undefined';
  const preflightDecision = getVolumetricLightingDecision({
    touchDevice,
    rendererMode: rendererDiagnostics.mode,
    browserSupportsWebGpu,
    hasRtxVolumetricPipeline: true,
  });

  if (!preflightDecision.enabled) {
    return fallbackSelection(canvas, touchDevice, rendererDiagnostics);
  }

  const adapter = await navigator.gpu.requestAdapter();

  if (!adapter) {
    return fallbackSelection(canvas, touchDevice, rendererDiagnostics, 'rtx-pipeline-unavailable');
  }

  const renderer = new WebGPURenderer({
    antialias: true,
    alpha: true,
    canvas,
  });

  try {
    await renderer.init();
  } catch {
    renderer.dispose();
    return fallbackSelection(canvas, touchDevice, rendererDiagnostics, 'rtx-pipeline-unavailable');
  }

  if ((renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend !== true) {
    renderer.dispose();
    return fallbackSelection(canvas, touchDevice, rendererDiagnostics, 'rtx-pipeline-unavailable');
  }

  return {
    renderer,
    backend: 'webgpu',
    volumetricLighting: getVolumetricLightingDecision({
      touchDevice,
      rendererMode: rendererDiagnostics.mode,
      browserSupportsWebGpu,
      hasRtxVolumetricPipeline: true,
    }),
  };
}
