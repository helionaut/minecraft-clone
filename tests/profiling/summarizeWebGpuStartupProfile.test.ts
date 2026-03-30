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
    });

    expect(report.json.startupTotalDurationMs).toBe(2332.3);
    expect(report.json.topConsoleErrors).toHaveLength(2);
    expect(report.json.remediationCandidates.map((candidate) => candidate.suspect)).toEqual([
      'initial-rebuild-world',
      'post-startup frame loop',
      'invalid-runtime-surface',
    ]);
    expect(report.markdown).toContain('initial-rebuild-world: 2178.3ms');
    expect(report.markdown).toContain('[error] device lost');
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
    });

    expect(report.json.remediationCandidates.map((candidate) => candidate.suspect)).toEqual([
      'create-scene-renderer',
      'create-desktop-volumetric-light-volume',
    ]);
    expect(report.markdown).toContain('create-scene-renderer: 480.0ms');
  });
});
