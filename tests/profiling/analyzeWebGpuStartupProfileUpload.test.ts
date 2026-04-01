import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  analyzeStartupProfileUpload,
  buildStartupProfileUploadAnalysisPlan,
  buildRemoteUploadRequestOptions,
  defaultImportedUploadDir,
  findStartupProfileArtifactDir,
  normalizeRemoteUploadSource,
  resolveStartupProfileUploadSource,
} from '../helpers/analyzeWebGpuStartupProfileUpload';

function createRuntimeStatus(renderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D12 vs_5_1 ps_5_1)') {
  return {
    browserSupportsWebGpu: true,
    webglRenderer: renderer,
    status: {
      renderer: `WebGPU | hardware accelerated | ${renderer}`,
    },
    startupProfile: {
      totalDurationMs: 1180,
      longFrameCount: 8,
      maxFrameDurationMs: 410.4,
      longFrameThresholdMs: 50,
      phases: [
        { name: 'initial-rebuild-world', durationMs: 640.0 },
        { name: 'create-scene-renderer', durationMs: 402.5 },
      ],
    },
  };
}

describe('analyzeWebGpuStartupProfileUpload', () => {
  it('requires an upload source path', () => {
    const plan = buildStartupProfileUploadAnalysisPlan({});

    expect(plan.ok).toBe(false);
    if (plan.ok) {
      throw new Error('expected plan to fail');
    }

    expect(plan.error).toContain('STARTUP_PROFILE_UPLOAD_SOURCE is required');
  });

  it('finds the nested artifact directory inside an extracted upload tree', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'hel-142-upload-tree-'));
    const nestedArtifactDir = `${tempRoot}/bundle/artifacts`;

    try {
      await mkdir(nestedArtifactDir, { recursive: true });
      await Promise.all([
        writeFile(`${nestedArtifactDir}/runtime-status.json`, JSON.stringify(createRuntimeStatus()), 'utf8'),
        writeFile(`${nestedArtifactDir}/console-messages.json`, JSON.stringify([]), 'utf8'),
      ]);

      const artifactDir = await findStartupProfileArtifactDir(tempRoot);
      expect(artifactDir).toBe(nestedArtifactDir);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('resolves zip uploads into the default imported analysis directory', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'hel-142-upload-zip-'));
    const zipPath = `${tempRoot}/startup-profile-upload-bundle.zip`;

    try {
      await writeFile(zipPath, 'not-a-real-zip', 'utf8');

      const result = await resolveStartupProfileUploadSource(
        {
          sourcePath: zipPath,
          outputDir: '',
        },
        async (_sourcePath: string, outputDir: string) => {
          const artifactDir = `${outputDir}/artifacts`;
          await mkdir(artifactDir, { recursive: true });
          await Promise.all([
            writeFile(`${artifactDir}/runtime-status.json`, JSON.stringify(createRuntimeStatus()), 'utf8'),
            writeFile(`${artifactDir}/console-messages.json`, JSON.stringify([]), 'utf8'),
          ]);
          return outputDir;
        },
      );

      expect(result.importedFromZip).toBe(true);
      expect(result.analysisRootDir).toBe(defaultImportedUploadDir(zipPath));
      expect(result.artifactDir).toBe(`${defaultImportedUploadDir(zipPath)}/artifacts`);
    } finally {
      await rm(defaultImportedUploadDir(zipPath), { recursive: true, force: true });
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('downloads https upload bundles into the default imported analysis directory before extraction', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'hel-142-upload-remote-'));
    const sourceUrl = 'https://example.com/profiles/startup-profile-upload-bundle.zip';

    try {
      const result = await resolveStartupProfileUploadSource(
        {
          sourcePath: sourceUrl,
          outputDir: '',
        },
        async (_sourcePath: string, outputDir: string) => {
          const artifactDir = `${outputDir}/artifacts`;
          await mkdir(artifactDir, { recursive: true });
          await Promise.all([
            writeFile(`${artifactDir}/runtime-status.json`, JSON.stringify(createRuntimeStatus()), 'utf8'),
            writeFile(`${artifactDir}/console-messages.json`, JSON.stringify([]), 'utf8'),
          ]);
          return outputDir;
        },
        async (_sourceUrl: string, outputDir: string) => {
          const downloadPath = `${outputDir}/startup-profile-upload-bundle.zip`;
          await mkdir(outputDir, { recursive: true });
          await writeFile(downloadPath, 'not-a-real-zip', 'utf8');
          return downloadPath;
        },
      );

      expect(result.importedFromZip).toBe(true);
      expect(result.analysisRootDir).toBe(defaultImportedUploadDir(sourceUrl));
      expect(result.artifactDir).toBe(`${defaultImportedUploadDir(sourceUrl)}/artifacts`);
    } finally {
      await rm(defaultImportedUploadDir(sourceUrl), { recursive: true, force: true });
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('adds GitHub auth headers for private GitHub artifact API URLs when a token is available', async () => {
    const options = await buildRemoteUploadRequestOptions(
      'https://api.github.com/repos/helionaut/minecraft-clone/actions/artifacts/123456789/zip',
      {},
      async () => 'test-token',
    );

    expect(options).toEqual({
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  });

  it('normalizes GitHub web artifact URLs into GitHub artifact API zip URLs', () => {
    expect(
      normalizeRemoteUploadSource(
        'https://github.com/helionaut/minecraft-clone/actions/runs/23780241098/artifacts/6186064743',
      ),
    ).toBe('https://api.github.com/repos/helionaut/minecraft-clone/actions/artifacts/6186064743/zip');
  });

  it('adds GitHub auth headers for normalized GitHub web artifact URLs when a token is available', async () => {
    const options = await buildRemoteUploadRequestOptions(
      'https://github.com/helionaut/minecraft-clone/actions/runs/23780241098/artifacts/6186064743',
      {},
      async () => 'test-token',
    );

    expect(options).toEqual({
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  });

  it('keeps generic https bundle URLs unauthenticated', async () => {
    const options = await buildRemoteUploadRequestOptions(
      'https://example.com/profiles/startup-profile-upload-bundle.zip',
      {},
      async () => 'test-token',
    );

    expect(options).toEqual({});
  });

  it('writes report, comparison, and manifest artifacts for an uploaded artifact directory', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'hel-142-upload-analyze-'));
    const sourceDir = `${tempRoot}/upload`;
    const baselineDir = `${tempRoot}/baseline`;

    try {
      await Promise.all([
        mkdir(sourceDir, { recursive: true }),
        mkdir(baselineDir, { recursive: true }),
      ]);

      await Promise.all([
        writeFile(`${sourceDir}/runtime-status.json`, JSON.stringify(createRuntimeStatus()), 'utf8'),
        writeFile(`${sourceDir}/console-messages.json`, JSON.stringify([
          { type: 'warning', text: 'shader compile slow path' },
        ]), 'utf8'),
        writeFile(`${baselineDir}/startup-profile-report.json`, JSON.stringify({
          startupTotalDurationMs: 2616,
          longFrameCount: 44,
          maxFrameDurationMs: 3133.2,
          runtime: {
            webglRenderer: 'ANGLE (Intel, Intel(R) HD Graphics 4600 Direct3D11 vs_5_0 ps_5_0)',
          },
          topPhases: [
            { name: 'initial-rebuild-world', durationMs: 1820.8 },
            { name: 'create-scene-renderer', durationMs: 91.2 },
          ],
          traceSummary: {
            topGpuTasks: [
              { name: 'RenderPass', durMs: 120.0 },
            ],
          },
        }), 'utf8'),
      ]);

      const result = await analyzeStartupProfileUpload({
        sourcePath: sourceDir,
        outputDir: '',
        baselineReportPath: `${baselineDir}/startup-profile-report.json`,
        baselineArtifactDir: baselineDir,
        baselineLabel: 'windows-intel-control',
        candidateLabel: 'uploaded-rtx-candidate',
      });

      const reportJson = JSON.parse(await readFile(result.reportJsonPath, 'utf8'));
      const comparisonJson = JSON.parse(await readFile(result.comparisonJsonPath, 'utf8'));
      const manifestJson = JSON.parse(await readFile(result.manifestJsonPath, 'utf8'));

      expect(reportJson.targetSurface.status).toBe('matched-rtx-webgpu');
      expect(comparisonJson.candidateLabel).toBe('uploaded-rtx-candidate');
      expect(comparisonJson.highlights.some((highlight: { finding: string }) => highlight.finding === 'renderer-change')).toBe(true);
      expect(manifestJson.files).toContain('startup-profile-report.json');
      expect(manifestJson.files).toContain('startup-profile-comparison.json');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
