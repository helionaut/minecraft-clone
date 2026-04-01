import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

import { isExecutedDirectly } from './isExecutedDirectly.mjs';

export const STARTUP_PROFILE_UPLOAD_FILE_CANDIDATES = [
  'runtime-status.json',
  'console-messages.json',
  'chrome-performance-trace.json',
  'startup-profile.json',
  'startup-profile-summary.json',
  'startup-profile-report.json',
  'startup-profile-report.md',
  'startup-profile-comparison.json',
  'startup-profile-comparison.md',
];

export function collectExistingStartupProfileBundleFiles(artifactOutputDir, pathExists = existsSync) {
  return STARTUP_PROFILE_UPLOAD_FILE_CANDIDATES
    .filter((file) => pathExists(`${artifactOutputDir}/${file}`));
}

export function buildStartupProfileUploadManifest(
  artifactOutputDir,
  files = STARTUP_PROFILE_UPLOAD_FILE_CANDIDATES,
  targetSurface = null,
) {
  const manifest = {
    json: {
      generatedAt: new Date().toISOString(),
      artifactDir: artifactOutputDir,
      files,
      uploadInstruction: 'Upload this artifact directory back to PR #52 / HEL-142 after the RTX run completes.',
    },
    markdown: [
      '# WebGPU Startup Profile Upload Bundle',
      '',
      `Artifact directory: ${artifactOutputDir}`,
      '',
      'Upload the whole directory or at minimum these files:',
      ...files.map((file) => `- ${file}`),
      '',
      'Use this bundle for PR #52 / HEL-142 so the trace, console export, runtime status, report, and comparison stay together.',
      '',
    ].join('\n'),
  };

  if (targetSurface && typeof targetSurface === 'object') {
    manifest.json.targetSurface = targetSurface;
    manifest.markdown += [
      '## Target surface verdict',
      '',
      `- ${String(targetSurface.summary ?? 'unknown')}`,
      '',
    ].join('\n');
  }

  return manifest;
}

async function loadTargetSurfaceVerdict(artifactOutputDir) {
  const reportPath = `${artifactOutputDir}/startup-profile-report.json`;

  if (!existsSync(reportPath)) {
    return null;
  }

  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  return report?.targetSurface ?? null;
}

export async function writeStartupProfileUploadManifest(artifactOutputDir, targetSurface = undefined) {
  const resolvedTargetSurface = targetSurface === undefined
    ? await loadTargetSurfaceVerdict(artifactOutputDir)
    : targetSurface;
  const files = collectExistingStartupProfileBundleFiles(artifactOutputDir);
  const manifest = buildStartupProfileUploadManifest(artifactOutputDir, files, resolvedTargetSurface);

  await Promise.all([
    writeFile(
      `${artifactOutputDir}/startup-profile-upload-manifest.json`,
      `${JSON.stringify(manifest.json, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      `${artifactOutputDir}/startup-profile-upload-manifest.md`,
      manifest.markdown,
      'utf8',
    ),
  ]);

  return manifest;
}

async function main() {
  const artifactOutputDir = process.env.STARTUP_PROFILE_ARTIFACT_DIR?.trim() ?? '';

  if (!artifactOutputDir) {
    throw new Error('STARTUP_PROFILE_ARTIFACT_DIR is required.');
  }

  const manifest = await writeStartupProfileUploadManifest(artifactOutputDir);
  console.info(`[webgpu-startup-profile] upload manifest: ${artifactOutputDir}/startup-profile-upload-manifest.json`);

  if (manifest.json.targetSurface?.summary) {
    console.info(`[webgpu-startup-profile] target surface verdict: ${manifest.json.targetSurface.summary}`);
  }
}

if (isExecutedDirectly(import.meta.url)) {
  await main();
}
