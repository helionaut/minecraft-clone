import { spawn } from 'node:child_process';
import process from 'node:process';

export function buildWebGpuStartupProfileRun(env = process.env) {
  const baseURL = env.PLAYWRIGHT_BASE_URL?.trim() ?? '';
  const browserChannel = env.PLAYWRIGHT_PROFILE_BROWSER_CHANNEL?.trim() ?? 'chrome';
  const dryRun = env.PLAYWRIGHT_PROFILE_DRY_RUN === '1';
  const artifactDir = 'reports/startup-profiling';

  if (!baseURL) {
    return {
      ok: false,
      error: 'PLAYWRIGHT_BASE_URL is required. Point it at the RTX Chrome target host or preview URL.',
    };
  }

  return {
    ok: true,
    baseURL,
    browserChannel,
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
