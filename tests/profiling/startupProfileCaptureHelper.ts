import type { StartupProfileSnapshot } from '../../src/rendering/startupProfiling.ts';

export const STARTUP_PROFILE_QUERY = './?renderer=webgpu&qaHarness=1&startupProfile=1';

export interface StartupProfileSummary {
  readonly totalDurationMs: number | null;
  readonly longFrameCount: number;
  readonly maxFrameDurationMs: number;
  readonly longFrameThresholdMs: number;
  readonly topPhases: ReadonlyArray<{
    readonly name: string;
    readonly durationMs: number;
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
