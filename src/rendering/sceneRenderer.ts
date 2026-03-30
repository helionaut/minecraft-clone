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
export type WebGpuPreferenceMode = 'auto' | 'force-webgl' | 'force-webgpu';

export const WEBGPU_SAFE_MODE_STORAGE_KEY = 'minecraft-clone:webgpu-safe-mode:v1';

export interface WebGpuDeviceLossInfo {
  readonly api?: string;
  readonly message: string;
  readonly reason?: string | null;
}

export interface WebGpuPreference {
  readonly mode: WebGpuPreferenceMode;
  readonly reason: VolumetricLightingDisableReason | null;
}

export interface WebGpuAutoRendererGate {
  readonly allowed: boolean;
  readonly reason: VolumetricLightingDisableReason | null;
}

interface WebGpuSafeModeStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem: (key: string) => void;
}

export interface SceneRendererSelection {
  readonly renderer: SceneRenderer;
  readonly backend: SceneRendererBackend;
  readonly volumetricLighting: VolumetricLightingDecision;
  readonly fallbackReason: VolumetricLightingDisableReason | null;
}

interface WebGpuLossAwareRenderer<TInfo> {
  onDeviceLost: (info: TInfo) => void;
  setAnimationLoop: (callback: ((time: number) => void) | null) => void;
}

interface CreateSceneRendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly touchDevice: boolean;
  readonly rendererDiagnostics: RendererDiagnostics;
  readonly webGpuPreference?: WebGpuPreference;
  readonly userAgent?: string;
  readonly onWebGpuDeviceLost?: (info: WebGpuDeviceLossInfo) => void;
}

interface StableWebGpuEnvironmentRule {
  readonly id: string;
  readonly browserSubstrings: readonly string[];
  readonly rendererSubstrings: readonly string[];
}

const STABLE_WEBGPU_ENVIRONMENT_ALLOWLIST: readonly StableWebGpuEnvironmentRule[] = [];

export function isUsableWebGpuAdapter(
  adapter: { readonly isFallbackAdapter?: boolean } | null,
): boolean {
  return adapter !== null && adapter.isFallbackAdapter !== true;
}

export function getWebGpuPreference(
  search: string,
  storage: Pick<WebGpuSafeModeStorage, 'getItem'> | null,
): WebGpuPreference {
  const searchParams = new URLSearchParams(search);

  if (searchParams.get('renderer') === 'webgpu') {
    return {
      mode: 'force-webgpu',
      reason: null,
    };
  }

  const storedSafeMode = storage?.getItem(WEBGPU_SAFE_MODE_STORAGE_KEY);

  if (storedSafeMode) {
    return {
      mode: 'force-webgl',
      reason: 'webgpu-device-lost',
    };
  }

  return {
    mode: 'auto',
    reason: null,
  };
}

export function persistWebGpuSafeMode(
  storage: Pick<WebGpuSafeModeStorage, 'setItem'>,
  info: WebGpuDeviceLossInfo,
): void {
  storage.setItem(WEBGPU_SAFE_MODE_STORAGE_KEY, JSON.stringify({
    detectedAt: new Date().toISOString(),
    message: info.message,
    reason: info.reason ?? null,
  }));
}

export function clearWebGpuSafeMode(
  storage: Pick<WebGpuSafeModeStorage, 'removeItem'>,
): void {
  storage.removeItem(WEBGPU_SAFE_MODE_STORAGE_KEY);
}

export function getAutoWebGpuRendererGate(input: {
  readonly browserSupportsWebGpu: boolean;
  readonly preferenceMode: WebGpuPreferenceMode;
  readonly rendererDiagnostics: RendererDiagnostics;
  readonly userAgent: string;
}): WebGpuAutoRendererGate {
  if (!input.browserSupportsWebGpu || input.preferenceMode === 'force-webgpu') {
    return {
      allowed: true,
      reason: null,
    };
  }

  const normalizedUserAgent = input.userAgent.toLowerCase();
  const normalizedRendererSummary = input.rendererDiagnostics.summary.toLowerCase();
  const matchedRule = STABLE_WEBGPU_ENVIRONMENT_ALLOWLIST.find((rule) => (
    rule.browserSubstrings.every((substring) => normalizedUserAgent.includes(substring))
      && rule.rendererSubstrings.every((substring) => normalizedRendererSummary.includes(substring))
  ));

  if (matchedRule) {
    return {
      allowed: true,
      reason: null,
    };
  }

  return {
    allowed: false,
    reason: 'webgpu-stability-gated',
  };
}

function createWebGlRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  return new WebGLRenderer({
    antialias: true,
    alpha: true,
    canvas,
  });
}

export function attachWebGpuDeviceLossHandler<TInfo>(
  renderer: WebGpuLossAwareRenderer<TInfo>,
  onDeviceLost?: (info: WebGpuDeviceLossInfo) => void,
  normalizeInfo?: (info: TInfo) => WebGpuDeviceLossInfo,
): void {
  const defaultOnDeviceLost = renderer.onDeviceLost.bind(renderer);
  let handled = false;

  renderer.onDeviceLost = (info) => {
    defaultOnDeviceLost(info);

    if (handled) {
      return;
    }

    handled = true;
    renderer.setAnimationLoop(null);
    onDeviceLost?.(normalizeInfo ? normalizeInfo(info) : (info as WebGpuDeviceLossInfo));
  };
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
    fallbackReason: reasonOverride ?? null,
  };
}

export async function createSceneRenderer(
  options: CreateSceneRendererOptions,
): Promise<SceneRendererSelection> {
  const { canvas, touchDevice, rendererDiagnostics } = options;
  const webGpuPreference = options.webGpuPreference ?? {
    mode: 'auto',
    reason: null,
  };
  const browserSupportsWebGpu = typeof navigator.gpu !== 'undefined';
  const autoWebGpuGate = getAutoWebGpuRendererGate({
    browserSupportsWebGpu,
    preferenceMode: webGpuPreference.mode,
    rendererDiagnostics,
    userAgent: options.userAgent ?? navigator.userAgent,
  });
  const preflightDecision = getVolumetricLightingDecision({
    touchDevice,
    rendererMode: rendererDiagnostics.mode,
    browserSupportsWebGpu,
    hasRtxVolumetricPipeline: true,
  });

  if (!preflightDecision.enabled || webGpuPreference.mode === 'force-webgl') {
    return fallbackSelection(
      canvas,
      touchDevice,
      rendererDiagnostics,
      webGpuPreference.reason ?? preflightDecision.reason ?? undefined,
    );
  }

  if (!autoWebGpuGate.allowed) {
    return fallbackSelection(
      canvas,
      touchDevice,
      rendererDiagnostics,
      autoWebGpuGate.reason ?? undefined,
    );
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });

  if (!isUsableWebGpuAdapter(adapter as { readonly isFallbackAdapter?: boolean } | null)) {
    return fallbackSelection(
      canvas,
      touchDevice,
      rendererDiagnostics,
      'webgpu-fallback-adapter',
    );
  }

  const renderer = new WebGPURenderer({
    antialias: true,
    alpha: true,
    canvas,
  });
  attachWebGpuDeviceLossHandler(renderer, options.onWebGpuDeviceLost, (info) => ({
    api: info.api,
    message: info.message,
    reason: typeof info.reason === 'string' || info.reason === null ? info.reason : null,
  }));

  try {
    await renderer.init();
  } catch {
    renderer.dispose();
    return fallbackSelection(canvas, touchDevice, rendererDiagnostics, 'webgpu-init-failed');
  }

  if ((renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend !== true) {
    renderer.dispose();
    return fallbackSelection(canvas, touchDevice, rendererDiagnostics, 'webgpu-backend-mismatch');
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
    fallbackReason: null,
  };
}
