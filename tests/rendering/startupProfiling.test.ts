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
    profiler.recordPhaseMetrics('sync-phase', {
      workUnits: 12,
      queueEntries: 3,
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
        {
          name: 'sync-phase',
          durationMs: 11,
          metrics: {
            workUnits: 12,
            queueEntries: 3,
          },
        },
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

  it('merges phase metrics recorded before and after the timed phase completes', () => {
    let now = 0;
    const profiler = createStartupProfiler({
      enabled: true,
      timeSource: () => now,
    });

    profiler.recordPhaseMetrics('lighting', { queueSeeds: 4 });
    profiler.measureSync('lighting', () => {
      now = 10;
    });
    profiler.recordPhaseMetrics('lighting', { queueIterations: 28 });

    expect(profiler.snapshot()?.phases).toEqual([
      {
        name: 'lighting',
        durationMs: 10,
        metrics: {
          queueSeeds: 4,
          queueIterations: 28,
        },
      },
    ]);
  });
});
