import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

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
    command: 'npx',
    args: ['playwright', 'test', '--config=playwright.profile.config.ts'],
  };
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

  if (plan.dryRun) {
    console.info(`[webgpu-startup-profile] dry run command: ${plan.command} ${plan.args.join(' ')}`);
    return;
  }

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
      process.kill(process.pid, signal);
      return;
    }

    process.exitCode = code ?? 1;
  });
}

const scriptPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : '';

if (import.meta.url.endsWith(scriptPath)) {
  await main();
}
