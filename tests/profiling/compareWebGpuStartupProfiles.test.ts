import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

  it('rebuilds the baseline report from raw baseline artifacts when the report file is missing', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'hel-142-compare-'));
    const baselineDir = `${tempRoot}/baseline`;
    const candidateDir = `${tempRoot}/candidate`;

    try {
      await Promise.all([
        mkdir(baselineDir, { recursive: true }),
        mkdir(candidateDir, { recursive: true }),
      ]);

      await Promise.all([
        writeFile(`${baselineDir}/runtime-status.json`, JSON.stringify({
          browserSupportsWebGpu: true,
          webglRenderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
          status: {
            renderer: 'WebGL 2 | software fallback | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
          },
          startupProfile: {
            totalDurationMs: 2616,
            longFrameCount: 44,
            maxFrameDurationMs: 3133.2,
            longFrameThresholdMs: 50,
            phases: [
              { name: 'initial-rebuild-world', durationMs: 2420.8 },
              { name: 'create-scene-renderer', durationMs: 31.2 },
            ],
          },
        }), 'utf8'),
        writeFile(`${baselineDir}/console-messages.json`, JSON.stringify([]), 'utf8'),
        writeFile(`${candidateDir}/startup-profile-report.json`, JSON.stringify({
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
        }), 'utf8'),
      ]);

      const output = execFileSync('node', ['scripts/compareWebGpuStartupProfiles.mjs'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          STARTUP_PROFILE_BASELINE_REPORT: `${baselineDir}/startup-profile-report.json`,
          STARTUP_PROFILE_BASELINE_ARTIFACT_DIR: baselineDir,
          STARTUP_PROFILE_CANDIDATE_REPORT: `${candidateDir}/startup-profile-report.json`,
        },
        encoding: 'utf8',
        stdio: 'pipe',
      });

      expect(output).toContain('startup-profile-comparison.json');

      const comparisonJson = JSON.parse(await readFile(`${candidateDir}/startup-profile-comparison.json`, 'utf8'));
      expect(comparisonJson.baseline.renderer).toContain('SwiftShader');
      expect(comparisonJson.deltas.startupTotalDurationMs).toBeCloseTo(-1436);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('uses the committed Windows Intel control baseline by default when no baseline env is provided', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'hel-142-default-baseline-'));
    const candidateDir = `${tempRoot}/candidate`;

    try {
      await mkdir(candidateDir, { recursive: true });
      await writeFile(`${candidateDir}/startup-profile-report.json`, JSON.stringify({
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
      }), 'utf8');

      execFileSync('node', ['scripts/compareWebGpuStartupProfiles.mjs'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          STARTUP_PROFILE_CANDIDATE_REPORT: `${candidateDir}/startup-profile-report.json`,
        },
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const comparisonJson = JSON.parse(await readFile(`${candidateDir}/startup-profile-comparison.json`, 'utf8'));
      expect(comparisonJson.baselineLabel).toBe('windows-intel-control');
      expect(comparisonJson.baseline.renderer).toContain('Intel(R) HD Graphics 4600');
      expect(comparisonJson.phaseComparisons[0]?.name).toBe('initial-rebuild-world');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
