import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { isExecutedDirectly } from './isExecutedDirectly.mjs';

const REPO_ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const CDP_CAPTURE_SCRIPT_PATH = fileURLToPath(new URL('./captureWebGpuStartupProfileOverCdp.mjs', import.meta.url));
const REPORT_SCRIPT_PATH = fileURLToPath(new URL('./summarizeWebGpuStartupProfile.mjs', import.meta.url));
const COMPARE_SCRIPT_PATH = fileURLToPath(new URL('./compareWebGpuStartupProfiles.mjs', import.meta.url));
const DEFAULT_BASELINE_REPORT_PATH = 'artifacts/startup-profiling-baselines/hel-142-windows-intel-control-startup-profile-report.json';
const DEFAULT_BASELINE_ARTIFACT_DIR = DEFAULT_BASELINE_REPORT_PATH.replace(/\/startup-profile-report\.json$/, '');
const STARTUP_PROFILE_UPLOAD_FILE_CANDIDATES = [
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

/**
 * @typedef {{
 *   ok: false,
 *   error: string,
 * }} WebGpuStartupProfileRunError
 *
 * @typedef {{
 *   ok: true,
 *   baseURL: string,
 *   browserChannel: string,
 *   executablePath: string,
 *   cdpEndpointUrl: string,
 *   requireRtxRenderer: boolean,
 *   dryRun: boolean,
 *   artifactDir: string,
 *   artifactResultsDir: string,
 *   command: string,
 *   args: string[],
 *   reportCommand: string,
 *   reportArgs: string[],
 *   compareCommand: string,
 *   compareArgs: string[],
 * }} WebGpuStartupProfileRunPlan
 */

const LINUX_CHANNEL_EXECUTABLES = {
  chrome: [
    '/opt/google/chrome/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ],
  'chrome-beta': [
    '/opt/google/chrome-beta/chrome',
    '/usr/bin/google-chrome-beta',
  ],
  'msedge': [
    '/opt/microsoft/msedge/msedge',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
  ],
  'msedge-beta': [
    '/opt/microsoft/msedge-beta/msedge',
    '/usr/bin/microsoft-edge-beta',
  ],
};

export function validateBrowserChannel(env = process.env, browserChannel, pathExists = existsSync) {
  const executablePath = env.PLAYWRIGHT_PROFILE_EXECUTABLE_PATH?.trim() ?? '';

  if (executablePath) {
    return null;
  }

  if (!browserChannel) {
    return null;
  }

  if (process.platform !== 'linux') {
    return null;
  }

  const candidatePaths = LINUX_CHANNEL_EXECUTABLES[browserChannel];

  if (!candidatePaths) {
    return null;
  }

  if (candidatePaths.some((candidatePath) => pathExists(candidatePath))) {
    return null;
  }

  const browsersPath = env.PLAYWRIGHT_BROWSERS_PATH?.trim() ?? '(default Playwright cache)';

  return `Requested browser channel "${browserChannel}" is not installed on this host. Install that browser on the RTX machine or unset PLAYWRIGHT_PROFILE_BROWSER_CHANNEL to use bundled Chromium from PLAYWRIGHT_BROWSERS_PATH=${browsersPath}.`;
}

export function validateBrowserExecutablePath(env = process.env, pathExists = existsSync) {
  const executablePath = env.PLAYWRIGHT_PROFILE_EXECUTABLE_PATH?.trim() ?? '';

  if (!executablePath) {
    return null;
  }

  if (pathExists(executablePath)) {
    return null;
  }

  return `PLAYWRIGHT_PROFILE_EXECUTABLE_PATH points to a missing browser binary: ${executablePath}`;
}

/** @returns {WebGpuStartupProfileRunPlan | WebGpuStartupProfileRunError} */
export function buildWebGpuStartupProfileRun(env = process.env) {
  const baseURL = env.PLAYWRIGHT_BASE_URL?.trim() ?? '';
  const executablePath = env.PLAYWRIGHT_PROFILE_EXECUTABLE_PATH?.trim() ?? '';
  const cdpEndpointUrl = env.PLAYWRIGHT_PROFILE_CDP_ENDPOINT_URL?.trim() ?? '';
  const requestedBrowserChannel = env.PLAYWRIGHT_PROFILE_BROWSER_CHANNEL?.trim() ?? 'chrome';
  const requireRtxRenderer = !/^(0|false|no)$/i.test(env.PLAYWRIGHT_PROFILE_REQUIRE_RTX?.trim() ?? '1');
  const dryRun = env.PLAYWRIGHT_PROFILE_DRY_RUN === '1';
  const artifactDir = 'reports/startup-profiling';

  if (!baseURL) {
    return {
      ok: false,
      error: 'PLAYWRIGHT_BASE_URL is required. Point it at the RTX Chrome target host or preview URL.',
    };
  }

  const browserExecutablePathError = validateBrowserExecutablePath(env);

  if (browserExecutablePathError) {
    return {
      ok: false,
      error: browserExecutablePathError,
    };
  }

  const browserChannel = (executablePath || cdpEndpointUrl) ? '' : requestedBrowserChannel;
  const browserChannelError = validateBrowserChannel(env, browserChannel);

  if (browserChannelError) {
    return {
      ok: false,
      error: browserChannelError,
    };
  }

  return {
    ok: true,
    baseURL,
    browserChannel,
    executablePath,
    cdpEndpointUrl,
    requireRtxRenderer,
    dryRun,
    artifactDir,
    artifactResultsDir: `${artifactDir}/test-results`,
    command: process.execPath,
    args: [CDP_CAPTURE_SCRIPT_PATH],
    reportCommand: process.execPath,
    reportArgs: [REPORT_SCRIPT_PATH],
    compareCommand: process.execPath,
    compareArgs: [COMPARE_SCRIPT_PATH],
  };
}

export async function findLatestArtifactOutputDir(resultsDir) {
  let entries;

  try {
    entries = await readdir(resultsDir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }

  const directories = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const path = `${resultsDir}/${entry.name}`;
      const metadata = await stat(path);
      return {
        path,
        mtimeMs: metadata.mtimeMs,
      };
    }));

  directories.sort((left, right) => right.mtimeMs - left.mtimeMs);

  return directories[0]?.path ?? null;
}

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

export function hasStartupProfileBaselineArtifacts(artifactDir, pathExists = existsSync) {
  return [
    'runtime-status.json',
    'console-messages.json',
  ].every((file) => pathExists(`${artifactDir}/${file}`));
}

async function writeStartupProfileUploadManifest(artifactOutputDir, targetSurface = null) {
  const files = collectExistingStartupProfileBundleFiles(artifactOutputDir);
  const manifest = buildStartupProfileUploadManifest(artifactOutputDir, files, targetSurface);

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

  console.info(`[webgpu-startup-profile] upload manifest: ${artifactOutputDir}/startup-profile-upload-manifest.json`);
}

async function runPostCaptureReport(plan) {
  const artifactOutputDir = await findLatestArtifactOutputDir(plan.artifactResultsDir);

  if (!artifactOutputDir) {
    console.warn(`[webgpu-startup-profile] no Playwright output directory found under ${plan.artifactResultsDir}; skipping report generation`);
    return null;
  }

  console.info(`[webgpu-startup-profile] generating report for ${artifactOutputDir}`);

  await new Promise((resolve, reject) => {
    const reportChild = spawn(plan.reportCommand, plan.reportArgs, {
      stdio: 'inherit',
      cwd: REPO_ROOT_DIR,
      env: {
        ...process.env,
        STARTUP_PROFILE_ARTIFACT_DIR: artifactOutputDir,
      },
    });

    reportChild.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`profile report generation exited via signal ${signal}`));
        return;
      }

      if ((code ?? 1) !== 0) {
        reject(new Error(`profile report generation failed with exit code ${code ?? 1}`));
        return;
      }

      resolve(undefined);
    });
  });

  const reportPath = `${artifactOutputDir}/startup-profile-report.json`;
  let targetSurface = null;

  if (existsSync(reportPath)) {
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    targetSurface = report?.targetSurface ?? null;
    if (targetSurface?.summary) {
      console.info(`[webgpu-startup-profile] target surface verdict: ${targetSurface.summary}`);
    }
  }

  return {
    artifactOutputDir,
    targetSurface,
  };
}

async function runPostCaptureComparison(plan, artifactOutputDir) {
  const baselineReportPath = process.env.STARTUP_PROFILE_BASELINE_REPORT?.trim() || DEFAULT_BASELINE_REPORT_PATH;
  const baselineArtifactDir = process.env.STARTUP_PROFILE_BASELINE_ARTIFACT_DIR?.trim() || DEFAULT_BASELINE_ARTIFACT_DIR;
  const candidateReportPath = `${artifactOutputDir}/startup-profile-report.json`;

  if (!existsSync(candidateReportPath)) {
    console.warn(`[webgpu-startup-profile] skipping comparison because candidate report is missing: ${candidateReportPath}`);
    return false;
  }

  if (!existsSync(baselineReportPath) && !hasStartupProfileBaselineArtifacts(baselineArtifactDir)) {
    console.warn(`[webgpu-startup-profile] skipping comparison because baseline report and baseline artifacts are missing: ${baselineReportPath}`);
    return false;
  }

  console.info(`[webgpu-startup-profile] generating baseline comparison for ${artifactOutputDir}`);

  await new Promise((resolve, reject) => {
    const compareChild = spawn(plan.compareCommand, plan.compareArgs, {
      stdio: 'inherit',
      cwd: REPO_ROOT_DIR,
      env: {
        ...process.env,
        STARTUP_PROFILE_BASELINE_REPORT: baselineReportPath,
        STARTUP_PROFILE_BASELINE_ARTIFACT_DIR: baselineArtifactDir,
        STARTUP_PROFILE_CANDIDATE_REPORT: candidateReportPath,
      },
    });

    compareChild.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`startup profile comparison exited via signal ${signal}`));
        return;
      }

      if ((code ?? 1) !== 0) {
        reject(new Error(`startup profile comparison failed with exit code ${code ?? 1}`));
        return;
      }

      resolve(undefined);
    });
  });

  return true;
}

async function main() {
  const plan = buildWebGpuStartupProfileRun();

  if (!plan.ok) {
    console.error(`[webgpu-startup-profile] ${plan.error}`);
    process.exitCode = 1;
    return;
  }

  console.info(`[webgpu-startup-profile] base URL: ${plan.baseURL}`);
  console.info(`[webgpu-startup-profile] browser channel: ${plan.browserChannel}`);
  console.info(`[webgpu-startup-profile] browser executable: ${plan.executablePath}`);
  console.info(`[webgpu-startup-profile] CDP endpoint: ${plan.cdpEndpointUrl}`);
  console.info(`[webgpu-startup-profile] require RTX renderer: ${String(plan.requireRtxRenderer)}`);
  console.info(`[webgpu-startup-profile] artifacts: ${plan.artifactDir}`);
  console.info(`[webgpu-startup-profile] report command: ${plan.reportCommand} ${plan.reportArgs.join(' ')}`);
  console.info('[webgpu-startup-profile] post-capture report generation is attempted whenever a Playwright artifact directory exists');
  console.info('[webgpu-startup-profile] comparison is auto-generated when both baseline and candidate reports are available');
  console.info('[webgpu-startup-profile] upload manifest is auto-generated from the files that were actually produced');

  if (plan.dryRun) {
    console.info(`[webgpu-startup-profile] dry run command: ${plan.command} ${plan.args.join(' ')}`);
    return;
  }

  const childExitCode = await new Promise((resolve, reject) => {
    const child = spawn(plan.command, plan.args, {
      stdio: 'inherit',
      cwd: REPO_ROOT_DIR,
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: plan.baseURL,
        PLAYWRIGHT_PROFILE_BROWSER_CHANNEL: plan.browserChannel,
        PLAYWRIGHT_PROFILE_EXECUTABLE_PATH: plan.executablePath,
        PLAYWRIGHT_PROFILE_CDP_ENDPOINT_URL: plan.cdpEndpointUrl,
        PLAYWRIGHT_PROFILE_REQUIRE_RTX: plan.requireRtxRenderer ? '1' : '0',
      },
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`profiling capture exited via signal ${signal}`));
        return;
      }

      resolve(code ?? 1);
    });
  });

  process.exitCode = childExitCode;

  try {
    const reportResult = await runPostCaptureReport(plan);
    if (reportResult) {
      await runPostCaptureComparison(plan, reportResult.artifactOutputDir);
      await writeStartupProfileUploadManifest(reportResult.artifactOutputDir, reportResult.targetSurface);
    }
  } catch (error) {
    console.error(`[webgpu-startup-profile] ${error instanceof Error ? error.message : String(error)}`);

    if (childExitCode === 0) {
      process.exitCode = 1;
    }
  }
}

if (isExecutedDirectly(import.meta.url)) {
  await main();
}
