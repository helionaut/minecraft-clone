import { describe, expect, it } from 'vitest';

import { buildStartupProfileComparison } from '../../scripts/compareWebGpuStartupProfiles.mjs';

describe('compareWebGpuStartupProfiles', () => {
  it('builds a delta report between a SwiftShader baseline and an RTX candidate', () => {
    const comparison = buildStartupProfileComparison({
      baselineLabel: 'swiftshader-control',
      candidateLabel: 'rtx-candidate',
      baselineReport: {
        startupTotalDurationMs: 2616,
        longFrameCount: 44,
        maxFrameDurationMs: 3133.2,
        runtime: {
          webglRenderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
        },
        topPhases: [
          { name: 'initial-rebuild-world', durationMs: 2420.8 },
          { name: 'create-scene-renderer', durationMs: 31.2 },
        ],
        traceSummary: {
          topGpuTasks: [
            { name: 'GLES2::ReadPixels', durMs: 579.0 },
          ],
        },
      },
      candidateReport: {
        startupTotalDurationMs: 1180,
        longFrameCount: 8,
        maxFrameDurationMs: 410.4,
        runtime: {
          webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D12 vs_5_1 ps_5_1)',
        },
        topPhases: [
          { name: 'initial-rebuild-world', durationMs: 640.0 },
          { name: 'create-scene-renderer', durationMs: 402.5 },
        ],
        traceSummary: {
          topGpuTasks: [
            { name: 'RenderPass', durMs: 88.2 },
          ],
        },
      },
    });

    expect(comparison.json.deltas.startupTotalDurationMs).toBeCloseTo(-1436);
    expect(comparison.json.deltas.longFrameCount).toBe(-36);
    expect(comparison.json.phaseComparisons[0]?.name).toBe('initial-rebuild-world');
    expect(comparison.json.highlights.map((highlight: { finding: string }) => highlight.finding)).toContain('renderer-change');
    expect(comparison.markdown).toContain('Baseline: swiftshader-control');
    expect(comparison.markdown).toContain('Candidate: rtx-candidate');
    expect(comparison.markdown).toContain('initial-rebuild-world: baseline=2420.8ms candidate=640.0ms delta=-1780.8ms');
  });
});
