import type { StartupProfileSnapshot } from '../../src/rendering/startupProfiling.ts';

export const STARTUP_PROFILE_QUERY = './?renderer=webgpu&qaHarness=1&startupProfile=1';

export interface StartupProfileRuntimeStatus {
  readonly browserSupportsWebGpu?: unknown;
  readonly userAgent?: unknown;
  readonly webglVendor?: unknown;
  readonly webglRenderer?: unknown;
  readonly status?: {
    readonly renderer?: unknown;
  } | null;
}

export interface StartupProfileSummary {
  readonly totalDurationMs: number | null;
  readonly longFrameCount: number;
  readonly maxFrameDurationMs: number;
  readonly longFrameThresholdMs: number;
  readonly topPhases: ReadonlyArray<{
    readonly name: string;
    readonly durationMs: number;
    readonly metrics?: Readonly<Record<string, number>>;
  }>;
}

export function isStartupProfileSnapshot(value: unknown): value is StartupProfileSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StartupProfileSnapshot>;

  return typeof candidate.startedAt === 'number'
    && Array.isArray(candidate.phases)
    && Array.isArray(candidate.frameSamples)
    && typeof candidate.longFrameCount === 'number'
    && typeof candidate.maxFrameDurationMs === 'number'
    && typeof candidate.longFrameThresholdMs === 'number';
}

export function summarizeStartupProfile(snapshot: StartupProfileSnapshot): StartupProfileSummary {
  return {
    totalDurationMs: snapshot.totalDurationMs,
    longFrameCount: snapshot.longFrameCount,
    maxFrameDurationMs: snapshot.maxFrameDurationMs,
    longFrameThresholdMs: snapshot.longFrameThresholdMs,
    topPhases: [...snapshot.phases]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 5),
  };
}

const SOFTWARE_RENDERER_PATTERNS = [
  /llvmpipe/i,
  /swiftshader/i,
  /software/i,
  /softpipe/i,
  /lavapipe/i,
];

export function getInvalidProfilingRuntimeReason(status: StartupProfileRuntimeStatus): string | null {
  return getInvalidProfilingRuntimeReasonForTarget(status, {});
}

export function getInvalidProfilingRuntimeReasonForTarget(
  status: StartupProfileRuntimeStatus,
  options: {
    readonly requireRtxRenderer?: boolean;
  },
): string | null {
  if (status.browserSupportsWebGpu !== true) {
    return `Expected a WebGPU-capable Chrome runtime, but navigator.gpu was unavailable. User agent: ${String(status.userAgent ?? 'unknown')}.`;
  }

  const renderer = typeof status.webglRenderer === 'string' ? status.webglRenderer : '';
  const rendererStatus = typeof status.status?.renderer === 'string' ? status.status.renderer : '';
  const combinedRendererText = `${renderer} ${rendererStatus}`.trim();

  if (combinedRendererText && SOFTWARE_RENDERER_PATTERNS.some((pattern) => pattern.test(combinedRendererText))) {
    return `Expected hardware-accelerated graphics for profiling, but WebGL renderer was ${combinedRendererText}.`;
  }

  if (/fallback-adapter|software fallback/i.test(rendererStatus)) {
    return `Expected the requested RTX/WebGPU target surface, but the runtime reported a fallback adapter: ${rendererStatus}.`;
  }

  if (options.requireRtxRenderer === true && !/\bRTX\b/i.test(combinedRendererText)) {
    return `Expected an RTX-class renderer for profiling, but captured ${combinedRendererText || 'unknown renderer'}.`;
  }

  return null;
}
