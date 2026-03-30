import { describe, expect, it } from 'vitest';

import { buildStartupProfilingReport } from '../../scripts/summarizeWebGpuStartupProfile.mjs';

describe('summarizeWebGpuStartupProfile', () => {
  it('builds a report with top phases, console errors, and remediation candidates', () => {
    const report = buildStartupProfilingReport({
      startupSummary: {
        totalDurationMs: 2332.3,
        longFrameCount: 30,
        maxFrameDurationMs: 2566.4,
        topPhases: [
          { name: 'initial-rebuild-world', durationMs: 2178.3 },
          { name: 'create-scene-renderer', durationMs: 29.5 },
        ],
      },
      runtimeStatus: {
        browserSupportsWebGpu: true,
        userAgent: 'Chrome/145.0.0.0',
        webglVendor: 'Google Inc.',
        webglRenderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
        status: {
          renderer: 'WebGL 2 | software fallback | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
        },
      },
      consoleEntries: [
        { type: 'warning', text: 'adapter fallback detected', location: 'https://example.invalid' },
        { type: 'error', text: 'device lost', location: 'https://example.invalid' },
        { type: 'info', text: 'ignore me', location: 'https://example.invalid' },
      ],
      traceData: {
        traceEvents: [
          { ph: 'M', name: 'thread_name', pid: 1, tid: 10, args: { name: 'CrRendererMain' } },
          { ph: 'M', name: 'thread_name', pid: 1, tid: 20, args: { name: 'GpuMain' } },
          {
            ph: 'X',
            name: 'FunctionCall',
            cat: 'devtools.timeline',
            dur: 520_835,
            ts: 123_000,
            pid: 1,
            tid: 10,
            args: { data: { functionName: 'i', url: 'http://127.0.0.1:4173/assets/index.js' } },
          },
          {
            ph: 'X',
            name: 'GLES2::ReadPixels',
            cat: 'gpu',
            dur: 1_027_101,
            ts: 124_000,
            pid: 1,
            tid: 20,
            args: {},
          },
        ],
      },
    });

    expect(report.json.startupTotalDurationMs).toBe(2332.3);
    expect(report.json.topConsoleErrors).toHaveLength(2);
    expect(report.json.traceSummary.topMainThreadTasks[0]?.name).toBe('FunctionCall');
    expect(report.json.traceSummary.topGpuTasks[0]?.name).toBe('GLES2::ReadPixels');
    expect(report.json.remediationCandidates.map((candidate) => candidate.suspect)).toEqual([
      'initial-rebuild-world',
      'post-startup frame loop',
      'invalid-runtime-surface',
    ]);
    expect(report.markdown).toContain('initial-rebuild-world: 2178.3ms');
    expect(report.markdown).toContain('[error] device lost');
    expect(report.markdown).toContain('FunctionCall: 520.8ms');
    expect(report.markdown).toContain('GLES2::ReadPixels: 1027.1ms');
  });

  it('surfaces renderer initialization and volumetric setup as suspects when they dominate', () => {
    const report = buildStartupProfilingReport({
      startupSummary: {
        totalDurationMs: 820,
        longFrameCount: 0,
        maxFrameDurationMs: 32,
        topPhases: [
          { name: 'create-scene-renderer', durationMs: 480 },
          { name: 'create-desktop-volumetric-light-volume', durationMs: 180 },
        ],
      },
      runtimeStatus: {
        browserSupportsWebGpu: true,
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D12 vs_5_1 ps_5_1)',
      },
      consoleEntries: [],
      traceData: {
        traceEvents: [],
      },
    });

    expect(report.json.remediationCandidates.map((candidate) => candidate.suspect)).toEqual([
      'create-scene-renderer',
      'create-desktop-volumetric-light-volume',
    ]);
    expect(report.markdown).toContain('create-scene-renderer: 480.0ms');
  });

  it('surfaces rebuild-world subphases as the leading suspect when they dominate', () => {
    const report = buildStartupProfilingReport({
      startupSummary: {
        totalDurationMs: 1840,
        longFrameCount: 12,
        maxFrameDurationMs: 610,
        topPhases: [
          { name: 'initial-rebuild-world', durationMs: 1830 },
          { name: 'initial-rebuild-world:compute-lighting', durationMs: 1090 },
          { name: 'initial-rebuild-world:rebuild-visible-meshes', durationMs: 620 },
        ],
      },
      runtimeStatus: {
        browserSupportsWebGpu: true,
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D12 vs_5_1 ps_5_1)',
      },
      consoleEntries: [],
      traceData: {
        traceEvents: [],
      },
    });

    expect(report.json.remediationCandidates.map((candidate) => candidate.suspect)).toEqual([
      'initial-rebuild-world:compute-lighting',
      'initial-rebuild-world:rebuild-visible-meshes',
      'initial-rebuild-world',
      'post-startup frame loop',
    ]);
    expect(report.markdown).toContain('initial-rebuild-world:compute-lighting: 1090.0ms');
  });
});
