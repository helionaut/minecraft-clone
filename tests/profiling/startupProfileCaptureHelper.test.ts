import { describe, expect, it } from 'vitest';

import {
  getInvalidProfilingRuntimeReason,
  isStartupProfileSnapshot,
  STARTUP_PROFILE_QUERY,
  summarizeStartupProfile,
} from './startupProfileCaptureHelper.ts';

describe('startupProfileCaptureHelper', () => {
  it('provides the profiling URL with forced WebGPU and QA export flags', () => {
    expect(STARTUP_PROFILE_QUERY).toBe('./?renderer=webgpu&qaHarness=1&startupProfile=1');
  });

  it('recognizes startup profile snapshots and summarizes the heaviest phases', () => {
    const snapshot = {
      startedAt: 0,
      completedAt: 120,
      totalDurationMs: 120,
      phases: [
        { name: 'initial-rebuild-world', durationMs: 78 },
        { name: 'create-scene-renderer', durationMs: 42 },
        { name: 'initial-sync-size', durationMs: 2 },
      ],
      frameSamples: [
        { index: 1, durationMs: 16.7 },
        { index: 2, durationMs: 88 },
      ],
      longFrameCount: 1,
      maxFrameDurationMs: 88,
      longFrameThresholdMs: 50,
    };

    expect(isStartupProfileSnapshot(snapshot)).toBe(true);
    expect(summarizeStartupProfile(snapshot)).toEqual({
      totalDurationMs: 120,
      longFrameCount: 1,
      maxFrameDurationMs: 88,
      longFrameThresholdMs: 50,
      topPhases: [
        { name: 'initial-rebuild-world', durationMs: 78 },
        { name: 'create-scene-renderer', durationMs: 42 },
        { name: 'initial-sync-size', durationMs: 2 },
      ],
    });
  });

  it('rejects incomplete values', () => {
    expect(isStartupProfileSnapshot(null)).toBe(false);
    expect(isStartupProfileSnapshot({ phases: [] })).toBe(false);
  });

  it('rejects non-WebGPU runtimes with a clear reason', () => {
    expect(getInvalidProfilingRuntimeReason({
      browserSupportsWebGpu: false,
      userAgent: 'Chrome/145.0.0.0',
    })).toContain('navigator.gpu was unavailable');
  });

  it('rejects software-rendered runtimes with a clear reason', () => {
    expect(getInvalidProfilingRuntimeReason({
      browserSupportsWebGpu: true,
      webglRenderer: 'ANGLE (Mesa, llvmpipe (LLVM 20.1.2 256 bits), OpenGL 4.5)',
    })).toContain('hardware-accelerated graphics');
  });

  it('accepts a WebGPU-capable hardware runtime', () => {
    expect(getInvalidProfilingRuntimeReason({
      browserSupportsWebGpu: true,
      webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D12 vs_5_1 ps_5_1)',
    })).toBeNull();
  });
});
