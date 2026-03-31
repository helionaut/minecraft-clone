import { spawn } from 'node:child_process';
import process from 'node:process';

import { isExecutedDirectly } from './isExecutedDirectly.mjs';

const DEFAULT_PREVIEW_HOST = '127.0.0.1';
const DEFAULT_PREVIEW_PORT = '4173';
const DEFAULT_PREVIEW_PATH = '/minecraft-clone/';
const DEFAULT_WAIT_TIMEOUT_MS = 30_000;
const DEFAULT_WAIT_INTERVAL_MS = 500;

export function buildLocalPreviewProfilePlan(env = process.env) {
  const host = env.PLAYWRIGHT_PROFILE_PREVIEW_HOST?.trim() || DEFAULT_PREVIEW_HOST;
  const port = env.PLAYWRIGHT_PROFILE_PREVIEW_PORT?.trim() || DEFAULT_PREVIEW_PORT;
  const path = env.PLAYWRIGHT_PROFILE_PREVIEW_PATH?.trim() || DEFAULT_PREVIEW_PATH;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const previewURL = `http://${host}:${port}${normalizedPath}`;
  const waitTimeoutMs = Number.parseInt(env.PLAYWRIGHT_PROFILE_PREVIEW_TIMEOUT_MS ?? '', 10) || DEFAULT_WAIT_TIMEOUT_MS;
  const dryRun = env.PLAYWRIGHT_PROFILE_DRY_RUN === '1';

  return {
    host,
    port,
    path: normalizedPath,
    previewURL,
    waitTimeoutMs,
    dryRun,
    buildCommand: 'npm',
    buildArgs: ['run', 'build'],
    previewCommand: 'npm',
    previewArgs: ['run', 'preview', '--', '--host', host, '--port', port],
    captureCommand: 'npm',
    captureArgs: ['run', 'profile:webgpu-startup'],
  };
}

export async function waitForUrl(url, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS, intervalMs = DEFAULT_WAIT_INTERVAL_MS) {
  const startedAt = Date.now();

  while ((Date.now() - startedAt) < timeoutMs) {
    try {
      const response = await fetch(url, {
        redirect: 'manual',
      });

      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      // Server not ready yet.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw new Error(`Timed out waiting for local preview at ${url}`);
}

function spawnCommand(command, args, extraEnv = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

async function runCommand(command, args, extraEnv = {}) {
  await new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, extraEnv);

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} exited via signal ${signal}`));
        return;
      }

      if ((code ?? 1) !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 1}`));
        return;
      }

      resolve(undefined);
    });
  });
}

async function main() {
  const plan = buildLocalPreviewProfilePlan();

  console.info(`[webgpu-startup-profile:local-preview] preview URL: ${plan.previewURL}`);
  console.info(`[webgpu-startup-profile:local-preview] build command: ${plan.buildCommand} ${plan.buildArgs.join(' ')}`);
  console.info(`[webgpu-startup-profile:local-preview] preview command: ${plan.previewCommand} ${plan.previewArgs.join(' ')}`);
  console.info(`[webgpu-startup-profile:local-preview] capture command: ${plan.captureCommand} ${plan.captureArgs.join(' ')}`);
  console.info(`[webgpu-startup-profile:local-preview] require RTX renderer: ${process.env.PLAYWRIGHT_PROFILE_REQUIRE_RTX?.trim() || '1'}`);
  console.info('[webgpu-startup-profile:local-preview] comparison is auto-generated after a successful capture');
  console.info('[webgpu-startup-profile:local-preview] upload manifest is auto-generated after a successful capture');

  if (plan.dryRun) {
    return;
  }

  await runCommand(plan.buildCommand, plan.buildArgs);

  const previewChild = spawnCommand(plan.previewCommand, plan.previewArgs);
  let previewClosed = false;

  const stopPreview = () => {
    if (previewClosed) {
      return;
    }

    previewClosed = true;
    previewChild.kill('SIGTERM');
  };

  previewChild.on('exit', () => {
    previewClosed = true;
  });

  process.on('SIGINT', stopPreview);
  process.on('SIGTERM', stopPreview);

  try {
    await waitForUrl(plan.previewURL, plan.waitTimeoutMs);
    await runCommand(plan.captureCommand, plan.captureArgs, {
      PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL?.trim() || plan.previewURL,
    });
  } finally {
    stopPreview();
    process.off('SIGINT', stopPreview);
    process.off('SIGTERM', stopPreview);
  }
}

if (isExecutedDirectly(import.meta.url)) {
  await main();
}
