import { describe, expect, it } from 'vitest';

import { createStartupProfiler } from '../../src/rendering/startupProfiling.ts';

describe('createStartupProfiler', () => {
  it('records measured phases, frame samples, and total startup duration', async () => {
    let now = 10;
    const profiler = createStartupProfiler({
      enabled: true,
      timeSource: () => now,
      longFrameThresholdMs: 40,
      maxFrameSamples: 2,
    });

    now = 18;
    profiler.measureSync('sync-phase', () => {
      now = 29;
    });

    now = 35;
    await profiler.measure('async-phase', async () => {
      now = 52;
      return 'done';
    });

    profiler.recordFrame(16.7);
    profiler.recordFrame(55);
    profiler.recordFrame(83);
    now = 71;
    profiler.complete();

    const snapshot = profiler.snapshot();

    expect(snapshot).toEqual({
      startedAt: 10,
      completedAt: 71,
      totalDurationMs: 61,
      phases: [
        { name: 'sync-phase', durationMs: 11 },
        { name: 'async-phase', durationMs: 17 },
      ],
      frameSamples: [
        { index: 1, durationMs: 16.7 },
        { index: 2, durationMs: 55 },
      ],
      longFrameCount: 2,
      maxFrameDurationMs: 83,
      longFrameThresholdMs: 40,
    });
  });

  it('returns null snapshots when profiling is disabled', async () => {
    const profiler = createStartupProfiler({ enabled: false });

    const result = await profiler.measure('phase', async () => 'value');
    profiler.recordFrame(100);
    profiler.complete();

    expect(result).toBe('value');
    expect(profiler.snapshot()).toBeNull();
  });
});
