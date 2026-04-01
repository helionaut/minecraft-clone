import { execFile as execFileCallback } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { buildStartupProfileComparison, resolveStartupProfilingReport } from './compareWebGpuStartupProfiles.mjs';
import { isExecutedDirectly } from './isExecutedDirectly.mjs';
import { buildStartupProfilingReportFromArtifactDir } from './summarizeWebGpuStartupProfile.mjs';
import { writeStartupProfileUploadManifest } from './writeWebGpuStartupProfileUploadManifest.mjs';

const execFile = promisify(execFileCallback);

const DEFAULT_BASELINE_REPORT_PATH = 'artifacts/startup-profiling-baselines/hel-142-windows-intel-control-startup-profile-report.json';
const DEFAULT_BASELINE_ARTIFACT_DIR = DEFAULT_BASELINE_REPORT_PATH.replace(/\/startup-profile-report\.json$/, '');
const DEFAULT_IMPORTED_UPLOAD_DIR = 'reports/startup-profiling/imported';
const REQUIRED_ARTIFACT_FILES = [
  'runtime-status.json',
  'console-messages.json',
];

export function buildStartupProfileUploadAnalysisPlan(env = process.env) {
  const sourcePath = env.STARTUP_PROFILE_UPLOAD_SOURCE?.trim() ?? '';

  if (!sourcePath) {
    return {
      ok: false,
      error: 'STARTUP_PROFILE_UPLOAD_SOURCE is required and should point at an artifact directory or startup-profile-upload-bundle.zip file.',
    };
  }

  return {
    ok: true,
    sourcePath,
    outputDir: env.STARTUP_PROFILE_UPLOAD_OUTPUT_DIR?.trim() ?? '',
    baselineReportPath: env.STARTUP_PROFILE_BASELINE_REPORT?.trim() ?? DEFAULT_BASELINE_REPORT_PATH,
    baselineArtifactDir: env.STARTUP_PROFILE_BASELINE_ARTIFACT_DIR?.trim() ?? DEFAULT_BASELINE_ARTIFACT_DIR,
    baselineLabel: env.STARTUP_PROFILE_BASELINE_LABEL?.trim() || 'windows-intel-control',
    candidateLabel: env.STARTUP_PROFILE_CANDIDATE_LABEL?.trim() || 'uploaded-candidate',
  };
}

export function defaultImportedUploadDir(sourcePath) {
  const sourceBaseName = basename(resolveUploadSourceName(sourcePath), extname(resolveUploadSourceName(sourcePath)))
    || 'startup-profile-upload';
  return `${DEFAULT_IMPORTED_UPLOAD_DIR}/${sourceBaseName}`;
}

export function isRemoteUploadSource(sourcePath) {
  return /^https?:\/\//i.test(sourcePath);
}

export function resolveUploadSourceName(sourcePath) {
  if (!isRemoteUploadSource(sourcePath)) {
    return sourcePath;
  }

  try {
    const sourceUrl = new URL(sourcePath);
    const pathName = sourceUrl.pathname.trim();
    return pathName ? basename(pathName) : 'startup-profile-upload-bundle.zip';
  } catch {
    return 'startup-profile-upload-bundle.zip';
  }
}

export function normalizeRemoteUploadSource(sourceUrl) {
  try {
    const parsedUrl = new URL(sourceUrl);
    const webArtifactMatch = parsedUrl.href.match(
      /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/actions\/runs\/\d+\/artifacts\/(\d+)(?:\/.*)?$/i,
    );

    if (webArtifactMatch) {
      const [, owner, repo, artifactId] = webArtifactMatch;
      return `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`;
    }

    return sourceUrl;
  } catch {
    return sourceUrl;
  }
}

export function isGitHubArtifactApiUrl(sourceUrl) {
  return /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/actions\/artifacts\/\d+\/zip(?:\?.*)?$/i.test(
    normalizeRemoteUploadSource(sourceUrl),
  );
}

export async function resolveGitHubAuthToken(
  env = process.env,
  execAuthCommand = async () => {
    const result = await execFile('gh', ['auth', 'token']);
    return result.stdout;
  },
) {
  const envToken = env.GITHUB_TOKEN?.trim() || env.GH_TOKEN?.trim();

  if (envToken) {
    return envToken;
  }

  try {
    const stdout = await execAuthCommand();
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function buildRemoteUploadRequestOptions(
  sourceUrl,
  env = process.env,
  resolveAuthTokenFn = resolveGitHubAuthToken,
) {
  const normalizedSourceUrl = normalizeRemoteUploadSource(sourceUrl);

  if (!isGitHubArtifactApiUrl(normalizedSourceUrl)) {
    return {};
  }

  const authToken = await resolveAuthTokenFn(env);

  if (!authToken) {
    return {};
  }

  return {
    headers: {
      Authorization: `Bearer ${authToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };
}

export async function findStartupProfileArtifactDir(rootDir) {
  const queue = [rootDir];
  const visited = new Set();

  while (queue.length > 0) {
    const currentDir = queue.shift();

    if (!currentDir || visited.has(currentDir)) {
      continue;
    }

    visited.add(currentDir);

    if (REQUIRED_ARTIFACT_FILES.every((file) => existsSync(`${currentDir}/${file}`))) {
      return currentDir;
    }

    let entries;

    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOTDIR') {
        continue;
      }

      throw error;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        queue.push(`${currentDir}/${entry.name}`);
      }
    }
  }

  return null;
}

export async function extractStartupProfileUploadArchive(sourcePath, outputDir) {
  await mkdir(outputDir, { recursive: true });

  if (process.platform === 'win32') {
    await execFile('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Expand-Archive -LiteralPath '${sourcePath.replace(/'/g, "''")}' -DestinationPath '${outputDir.replace(/'/g, "''")}' -Force`,
    ]);
    return outputDir;
  }

  await execFile('unzip', ['-oq', sourcePath, '-d', outputDir]);
  return outputDir;
}

export async function downloadStartupProfileUploadSource(
  sourceUrl,
  outputDir,
  buildRequestOptions = buildRemoteUploadRequestOptions,
) {
  await mkdir(outputDir, { recursive: true });

  const downloadName = resolveUploadSourceName(sourceUrl) || 'startup-profile-upload-bundle.zip';
  const downloadPath = `${outputDir}/${downloadName}`;
  const normalizedSourceUrl = normalizeRemoteUploadSource(sourceUrl);
  const response = await fetch(normalizedSourceUrl, await buildRequestOptions(normalizedSourceUrl));

  if (!response.ok) {
    throw new Error(`Could not download upload source ${normalizedSourceUrl}: HTTP ${response.status}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await writeFile(downloadPath, Buffer.from(arrayBuffer));
  return downloadPath;
}

export async function resolveStartupProfileUploadSource(
  plan,
  extractArchive = extractStartupProfileUploadArchive,
  downloadRemoteSource = downloadStartupProfileUploadSource,
) {
  const remoteSource = isRemoteUploadSource(plan.sourcePath);
  const preferredImportedDir = plan.outputDir || defaultImportedUploadDir(plan.sourcePath);
  const localSourcePath = remoteSource
    ? await downloadRemoteSource(plan.sourcePath, preferredImportedDir)
    : plan.sourcePath;
  const sourceStats = await stat(localSourcePath);
  const isZipSource = sourceStats.isFile() && /\.zip$/i.test(localSourcePath);
  const resolvedAnalysisRootDir = isZipSource
    ? preferredImportedDir
    : localSourcePath;

  if (!sourceStats.isDirectory() && !isZipSource) {
    throw new Error(`Unsupported upload source: ${plan.sourcePath}. Provide an artifact directory, a .zip bundle, or an HTTP(S) URL to a .zip bundle.`);
  }

  if (isZipSource) {
    await extractArchive(localSourcePath, resolvedAnalysisRootDir);
  }

  const artifactDir = await findStartupProfileArtifactDir(resolvedAnalysisRootDir);

  if (!artifactDir) {
    throw new Error(`Could not locate runtime-status.json and console-messages.json under ${resolvedAnalysisRootDir}.`);
  }

  return {
    analysisRootDir: resolvedAnalysisRootDir,
    artifactDir,
    importedFromZip: isZipSource,
  };
}

export async function analyzeStartupProfileUpload(
  plan,
  extractArchive = extractStartupProfileUploadArchive,
  downloadRemoteSource = downloadStartupProfileUploadSource,
) {
  const resolvedUpload = await resolveStartupProfileUploadSource(plan, extractArchive, downloadRemoteSource);
  const report = await buildStartupProfilingReportFromArtifactDir(resolvedUpload.artifactDir);
  const reportJsonPath = `${resolvedUpload.artifactDir}/startup-profile-report.json`;
  const reportMarkdownPath = `${resolvedUpload.artifactDir}/startup-profile-report.md`;

  await Promise.all([
    writeFile(reportJsonPath, `${JSON.stringify(report.json, null, 2)}\n`, 'utf8'),
    writeFile(reportMarkdownPath, report.markdown, 'utf8'),
  ]);

  const baselineReport = await resolveStartupProfilingReport({
    reportPath: plan.baselineReportPath,
    artifactDir: plan.baselineArtifactDir,
  });
  const comparison = buildStartupProfileComparison({
    baselineLabel: plan.baselineLabel,
    candidateLabel: plan.candidateLabel,
    baselineReport,
    candidateReport: report.json,
  });
  const comparisonJsonPath = `${resolvedUpload.artifactDir}/startup-profile-comparison.json`;
  const comparisonMarkdownPath = `${resolvedUpload.artifactDir}/startup-profile-comparison.md`;

  await Promise.all([
    writeFile(comparisonJsonPath, `${JSON.stringify(comparison.json, null, 2)}\n`, 'utf8'),
    writeFile(comparisonMarkdownPath, comparison.markdown, 'utf8'),
  ]);

  await writeStartupProfileUploadManifest(resolvedUpload.artifactDir, report.json.targetSurface);

  return {
    ...resolvedUpload,
    reportJsonPath,
    reportMarkdownPath,
    comparisonJsonPath,
    comparisonMarkdownPath,
    manifestJsonPath: `${resolvedUpload.artifactDir}/startup-profile-upload-manifest.json`,
    manifestMarkdownPath: `${resolvedUpload.artifactDir}/startup-profile-upload-manifest.md`,
    targetSurface: report.json.targetSurface,
  };
}

async function main() {
  const plan = buildStartupProfileUploadAnalysisPlan();

  if (!plan.ok) {
    console.error(`[webgpu-startup-profile-upload] ${plan.error}`);
    process.exitCode = 1;
    return;
  }

  const result = await analyzeStartupProfileUpload(plan);

  console.info(`[webgpu-startup-profile-upload] source: ${plan.sourcePath}`);
  console.info(`[webgpu-startup-profile-upload] analysis root: ${result.analysisRootDir}`);
  console.info(`[webgpu-startup-profile-upload] artifact dir: ${result.artifactDir}`);
  console.info(`[webgpu-startup-profile-upload] imported from zip: ${String(result.importedFromZip)}`);
  console.info(`[webgpu-startup-profile-upload] report: ${result.reportJsonPath}`);
  console.info(`[webgpu-startup-profile-upload] comparison: ${result.comparisonJsonPath}`);
  console.info(`[webgpu-startup-profile-upload] upload manifest: ${result.manifestJsonPath}`);

  if (result.targetSurface?.summary) {
    console.info(`[webgpu-startup-profile-upload] target surface verdict: ${result.targetSurface.summary}`);
  }
}

if (isExecutedDirectly(import.meta.url)) {
  await main();
}
