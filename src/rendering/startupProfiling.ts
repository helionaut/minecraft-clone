export interface StartupProfilePhase {
  readonly name: string;
  readonly durationMs: number;
}

export interface StartupFrameSample {
  readonly index: number;
  readonly durationMs: number;
}

export interface StartupProfileSnapshot {
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly totalDurationMs: number | null;
  readonly phases: readonly StartupProfilePhase[];
  readonly frameSamples: readonly StartupFrameSample[];
  readonly longFrameCount: number;
  readonly maxFrameDurationMs: number;
  readonly longFrameThresholdMs: number;
}

interface StartupProfilerOptions {
  readonly enabled: boolean;
  readonly timeSource?: () => number;
  readonly longFrameThresholdMs?: number;
  readonly maxFrameSamples?: number;
}

interface MutableStartupProfileState {
  startedAt: number;
  completedAt: number | null;
  totalDurationMs: number | null;
  phases: StartupProfilePhase[];
  frameSamples: StartupFrameSample[];
  longFrameCount: number;
  maxFrameDurationMs: number;
  longFrameThresholdMs: number;
  maxFrameSamples: number;
}

export interface StartupProfiler {
  readonly enabled: boolean;
  measure<T>(name: string, run: () => Promise<T> | T): Promise<T>;
  measureSync<T>(name: string, run: () => T): T;
  recordFrame(durationMs: number): void;
  complete(): void;
  snapshot(): StartupProfileSnapshot | null;
}

const DEFAULT_LONG_FRAME_THRESHOLD_MS = 50;
const DEFAULT_MAX_FRAME_SAMPLES = 180;

export function createStartupProfiler(options: StartupProfilerOptions): StartupProfiler {
  if (!options.enabled) {
    return {
      enabled: false,
      async measure<T>(_name: string, run: () => Promise<T> | T): Promise<T> {
        return run();
      },
      measureSync<T>(_name: string, run: () => T): T {
        return run();
      },
      recordFrame(durationMs: number): void {
        void durationMs;
      },
      complete(): void {},
      snapshot(): StartupProfileSnapshot | null {
        return null;
      },
    };
  }

  const timeSource = options.timeSource ?? (() => performance.now());
  const state: MutableStartupProfileState = {
    startedAt: timeSource(),
    completedAt: null,
    totalDurationMs: null,
    phases: [],
    frameSamples: [],
    longFrameCount: 0,
    maxFrameDurationMs: 0,
    longFrameThresholdMs: options.longFrameThresholdMs ?? DEFAULT_LONG_FRAME_THRESHOLD_MS,
    maxFrameSamples: options.maxFrameSamples ?? DEFAULT_MAX_FRAME_SAMPLES,
  };

  const pushPhase = (name: string, durationMs: number) => {
    state.phases.push({
      name,
      durationMs,
    });
  };

  return {
    enabled: true,
    async measure<T>(name: string, run: () => Promise<T> | T): Promise<T> {
      const startedAt = timeSource();
      const result = await run();
      pushPhase(name, timeSource() - startedAt);
      return result;
    },
    measureSync<T>(name: string, run: () => T): T {
      const startedAt = timeSource();
      const result = run();
      pushPhase(name, timeSource() - startedAt);
      return result;
    },
    recordFrame(durationMs: number): void {
      state.maxFrameDurationMs = Math.max(state.maxFrameDurationMs, durationMs);

      if (durationMs >= state.longFrameThresholdMs) {
        state.longFrameCount += 1;
      }

      if (state.frameSamples.length >= state.maxFrameSamples) {
        return;
      }

      state.frameSamples.push({
        index: state.frameSamples.length + 1,
        durationMs,
      });
    },
    complete(): void {
      if (state.completedAt !== null) {
        return;
      }

      state.completedAt = timeSource();
      state.totalDurationMs = state.completedAt - state.startedAt;
    },
    snapshot(): StartupProfileSnapshot | null {
      return {
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        totalDurationMs: state.totalDurationMs,
        phases: [...state.phases],
        frameSamples: [...state.frameSamples],
        longFrameCount: state.longFrameCount,
        maxFrameDurationMs: state.maxFrameDurationMs,
        longFrameThresholdMs: state.longFrameThresholdMs,
      };
    },
  };
}
