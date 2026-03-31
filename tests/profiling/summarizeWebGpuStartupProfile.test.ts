import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import * as summarizeStartupProfileScript from '../../scripts/summarizeWebGpuStartupProfile.mjs';

const { buildStartupProfilingReport } = summarizeStartupProfileScript;

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
    expect(report.json.targetSurface.meetsRequirement).toBe(false);
    expect(report.json.targetSurface.status).toBe('control-or-fallback-surface');
    expect(report.json.remediationCandidates.map((candidate) => candidate.suspect)).toEqual([
      'initial-rebuild-world',
      'post-startup frame loop',
      'invalid-runtime-surface',
    ]);
    expect(report.markdown).toContain('initial-rebuild-world: 2178.3ms');
    expect(report.markdown).toContain('Target surface verdict: Did not match the requested RTX/WebGPU target surface');
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
    expect(report.json.targetSurface.meetsRequirement).toBe(true);
    expect(report.json.targetSurface.status).toBe('matched-rtx-webgpu');
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

  it('surfaces nested compute-lighting subphases when they dominate', () => {
    const startupSummary = {
      totalDurationMs: 1900,
      longFrameCount: 10,
      maxFrameDurationMs: 540,
      topPhases: [
        {
          name: 'initial-rebuild-world:compute-lighting:propagate-light-queue',
          durationMs: 980,
          metrics: {
            queueSeeds: 144,
            processedEntries: 912,
          },
        },
        { name: 'initial-rebuild-world:compute-lighting', durationMs: 1280 },
        { name: 'initial-rebuild-world', durationMs: 1850 },
      ],
    };

    const report = buildStartupProfilingReport({
      startupSummary,
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
      'initial-rebuild-world:compute-lighting:propagate-light-queue',
      'initial-rebuild-world:compute-lighting',
      'post-startup frame loop',
    ]);
    expect(report.markdown).toContain('initial-rebuild-world:compute-lighting:propagate-light-queue: 980.0ms');
    expect(report.markdown).toContain('processedEntries=912');
  });

  it('rebuilds a startup profiling report from an artifact directory when only raw files exist', async () => {
    const artifactDir = await mkdtemp(join(tmpdir(), 'hel-142-startup-artifacts-'));
    const summarizeHelpers = summarizeStartupProfileScript as typeof summarizeStartupProfileScript & {
      buildStartupProfilingReportFromArtifactDir: (artifactDir: string) => Promise<{
        json: {
          startupTotalDurationMs: number;
          targetSurface: {
            status: string;
          };
          topPhases: Array<{ name: string }>;
          traceSummary: {
            topGpuTasks: Array<{ name: string }>;
          };
        };
      }>;
    };

    try {
      await mkdir(artifactDir, { recursive: true });
      await Promise.all([
        writeFile(`${artifactDir}/runtime-status.json`, JSON.stringify({
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
        writeFile(`${artifactDir}/console-messages.json`, JSON.stringify([
          { type: 'warning', text: 'GPU stall due to ReadPixels' },
        ]), 'utf8'),
        writeFile(`${artifactDir}/chrome-performance-trace.json`, JSON.stringify({
          traceEvents: [
            { ph: 'M', name: 'thread_name', pid: 1, tid: 20, args: { name: 'CrGpuMain' } },
            { ph: 'X', name: 'GLES2::ReadPixels', cat: 'gpu', dur: 579_000, ts: 124_000, pid: 1, tid: 20, args: {} },
          ],
        }), 'utf8'),
      ]);

      const report = await summarizeHelpers.buildStartupProfilingReportFromArtifactDir(artifactDir);

      expect(report.json.startupTotalDurationMs).toBe(2616);
      expect(report.json.targetSurface.status).toBe('control-or-fallback-surface');
      expect(report.json.topPhases[0]?.name).toBe('initial-rebuild-world');
      expect(report.json.traceSummary.topGpuTasks[0]?.name).toBe('GLES2::ReadPixels');
    } finally {
      await rm(artifactDir, { recursive: true, force: true });
    }
  });

  it('classifies non-RTX hardware-accelerated runs as controls rather than target-surface matches', () => {
    const report = buildStartupProfilingReport({
      startupSummary: {
        totalDurationMs: 1200,
        longFrameCount: 4,
        maxFrameDurationMs: 120,
        topPhases: [
          { name: 'initial-rebuild-world:compute-lighting', durationMs: 820 },
        ],
      },
      runtimeStatus: {
        browserSupportsWebGpu: true,
        webglRenderer: 'ANGLE (Intel, Intel(R) HD Graphics 4600 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        status: {
          renderer: 'WebGL 2 | hardware accelerated | ANGLE (Intel, Intel(R) HD Graphics 4600 Direct3D11 vs_5_0 ps_5_0, D3D11) | volumetric lighting disabled (webgpu-fallback-adapter)',
        },
      },
      consoleEntries: [],
      traceData: {
        traceEvents: [],
      },
    });

    expect(report.json.targetSurface.meetsRequirement).toBe(false);
    expect(report.json.targetSurface.status).toBe('control-or-fallback-surface');
    expect(report.json.targetSurface.summary).toContain('fallback adapter detected');
  });
});
