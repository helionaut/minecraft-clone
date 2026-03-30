import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, stat, writeFile } from 'node:fs/promises';
import process from 'node:process';

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
  const requestedBrowserChannel = env.PLAYWRIGHT_PROFILE_BROWSER_CHANNEL?.trim() ?? 'chrome';
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

  const browserChannel = executablePath ? '' : requestedBrowserChannel;
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
    dryRun,
    artifactDir,
    artifactResultsDir: `${artifactDir}/test-results`,
    command: 'npx',
    args: ['playwright', 'test', '--config=playwright.profile.config.ts'],
    reportCommand: 'npm',
    reportArgs: ['run', 'profile:webgpu-startup:report'],
    compareCommand: 'npm',
    compareArgs: ['run', 'profile:webgpu-startup:compare'],
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

export function buildStartupProfileUploadManifest(artifactOutputDir) {
  const files = [
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

  return {
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
}

async function writeStartupProfileUploadManifest(artifactOutputDir) {
  const manifest = buildStartupProfileUploadManifest(artifactOutputDir);

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
      shell: process.platform === 'win32',
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

  return artifactOutputDir;
}

async function runPostCaptureComparison(plan, artifactOutputDir) {
  console.info(`[webgpu-startup-profile] generating baseline comparison for ${artifactOutputDir}`);

  await new Promise((resolve, reject) => {
    const compareChild = spawn(plan.compareCommand, plan.compareArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        STARTUP_PROFILE_CANDIDATE_REPORT: `${artifactOutputDir}/startup-profile-report.json`,
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
  console.info(`[webgpu-startup-profile] artifacts: ${plan.artifactDir}`);
  console.info(`[webgpu-startup-profile] report command: ${plan.reportCommand} ${plan.reportArgs.join(' ')}`);
  console.info('[webgpu-startup-profile] comparison is auto-generated after a successful capture');
  console.info('[webgpu-startup-profile] upload manifest is auto-generated after a successful capture');

  if (plan.dryRun) {
    console.info(`[webgpu-startup-profile] dry run command: ${plan.command} ${plan.args.join(' ')}`);
    return;
  }

  const childExitCode = await new Promise((resolve, reject) => {
    const child = spawn(plan.command, plan.args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: plan.baseURL,
        PLAYWRIGHT_PROFILE_BROWSER_CHANNEL: plan.browserChannel,
        PLAYWRIGHT_PROFILE_EXECUTABLE_PATH: plan.executablePath,
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

  if (childExitCode !== 0) {
    return;
  }

  try {
    const artifactOutputDir = await runPostCaptureReport(plan);
    if (artifactOutputDir) {
      await runPostCaptureComparison(plan, artifactOutputDir);
      await writeStartupProfileUploadManifest(artifactOutputDir);
    }
  } catch (error) {
    console.error(`[webgpu-startup-profile] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const scriptPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : '';

if (import.meta.url.endsWith(scriptPath)) {
  await main();
}
