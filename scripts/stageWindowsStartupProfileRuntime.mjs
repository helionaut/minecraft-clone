import { cp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { isExecutedDirectly } from './isExecutedDirectly.mjs';

const REPO_ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_WINDOWS_RUNTIME_DIR = '/mnt/c/Temp/hel142-startup-runtime';
const DEFAULT_WINDOWS_NODE_EXE = '/home/helionaut/srv/research-cache/minecraft-clone/toolchains/node-v22.22.1-win-x64/node-v22.22.1-win-x64/node.exe';
const DEFAULT_WINDOWS_CHROME_EXE = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
const DEFAULT_BASE_URL = 'http://127.0.0.1:4173/minecraft-clone/';

function normalizeWindowsDrivePath(path) {
  const match = /^\/mnt\/([a-zA-Z])\/(.*)$/.exec(path);

  if (!match) {
    return path;
  }

  return `${match[1].toUpperCase()}:\\${match[2].replaceAll('/', '\\')}`;
}

function getRequireRtxRenderer(env = process.env) {
  return !/^(0|false|no)$/i.test(env.PLAYWRIGHT_PROFILE_REQUIRE_RTX?.trim() ?? '1');
}

export function buildWindowsStartupRuntimePlan(env = process.env, pathExists = existsSync) {
  const runtimeDir = env.PLAYWRIGHT_WINDOWS_RUNTIME_DIR?.trim() || DEFAULT_WINDOWS_RUNTIME_DIR;
  const nodeExe = env.PLAYWRIGHT_WINDOWS_NODE_EXE?.trim() || DEFAULT_WINDOWS_NODE_EXE;
  const chromeExe = env.PLAYWRIGHT_WINDOWS_CHROME_EXE?.trim() || DEFAULT_WINDOWS_CHROME_EXE;
  const baseURL = env.PLAYWRIGHT_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const requireRtxRenderer = getRequireRtxRenderer(env);
  const dryRun = env.PLAYWRIGHT_PROFILE_DRY_RUN === '1';

  const missing = [];

  if (!pathExists(nodeExe)) {
    missing.push(`Windows Node executable is missing: ${nodeExe}`);
  }

  if (!pathExists(chromeExe)) {
    missing.push(`Windows Chrome executable is missing: ${chromeExe}`);
  }

  return {
    ok: missing.length === 0,
    missing,
    dryRun,
    runtimeDir,
    nodeExe,
    chromeExe,
    baseURL,
    requireRtxRenderer,
    captureScriptSource: `${REPO_ROOT_DIR}/scripts/captureWebGpuStartupProfileOverCdp.mjs`,
    playwrightCoreSource: `${REPO_ROOT_DIR}/node_modules/playwright-core`,
    runtimeScriptsDir: `${runtimeDir}/scripts`,
    runtimeNodeModulesDir: `${runtimeDir}/node_modules`,
    stagedNodeExeTarget: `${runtimeDir}/node.exe`,
    captureScriptTarget: `${runtimeDir}/scripts/captureWebGpuStartupProfileOverCdp.mjs`,
    playwrightCoreTarget: `${runtimeDir}/node_modules/playwright-core`,
    runCmdPath: `${runtimeDir}/run-startup-profile.cmd`,
    readmePath: `${runtimeDir}/README.txt`,
    windowsRuntimeDir: normalizeWindowsDrivePath(runtimeDir),
    windowsNodeExe: normalizeWindowsDrivePath(`${runtimeDir}/node.exe`),
    windowsChromeExe: normalizeWindowsDrivePath(chromeExe),
  };
}

export function buildWindowsRuntimeReadme(plan) {
  return [
    'HEL-142 Windows Startup Profiling Runtime',
    '',
    `Runtime directory: ${plan.windowsRuntimeDir}`,
    `Bundled Windows Node: ${plan.windowsNodeExe}`,
    `Chrome executable: ${plan.windowsChromeExe}`,
    `Target URL: ${plan.baseURL}`,
    `Require RTX renderer: ${plan.requireRtxRenderer ? 'yes' : 'no'}`,
    '',
    'Run from Windows:',
    `  ${plan.windowsRuntimeDir}\\run-startup-profile.cmd`,
    '',
    'Override the target URL for another local preview before launching if needed:',
    `  set PLAYWRIGHT_BASE_URL=${plan.baseURL}`,
    '',
    'The launcher writes artifacts under:',
    `  ${plan.windowsRuntimeDir}\\artifacts\\`,
    '',
    'Copy that artifact folder back into the repo workspace after the run, for example:',
    '  reports\\startup-profiling\\test-results\\windows-host-runtime-attempt\\',
    '',
  ].join('\r\n');
}

export function buildWindowsRuntimeCommand(plan) {
  return [
    '@echo off',
    'setlocal',
    `if "%PLAYWRIGHT_BASE_URL%"=="" set "PLAYWRIGHT_BASE_URL=${plan.baseURL}"`,
    `if "%PLAYWRIGHT_PROFILE_REQUIRE_RTX%"=="" set "PLAYWRIGHT_PROFILE_REQUIRE_RTX=${plan.requireRtxRenderer ? '1' : '0'}"`,
    `set "PLAYWRIGHT_PROFILE_EXECUTABLE_PATH=${plan.windowsChromeExe}"`,
    `set "STARTUP_PROFILE_ARTIFACT_DIR=${plan.windowsRuntimeDir}\\artifacts"`,
    `"${plan.windowsNodeExe}" "${plan.windowsRuntimeDir}\\scripts\\captureWebGpuStartupProfileOverCdp.mjs"`,
    'endlocal',
    '',
  ].join('\r\n');
}

async function main() {
  const plan = buildWindowsStartupRuntimePlan();

  console.info(`[webgpu-startup-profile:windows-runtime] runtime dir: ${plan.runtimeDir}`);
  console.info(`[webgpu-startup-profile:windows-runtime] node source: ${plan.nodeExe}`);
  console.info(`[webgpu-startup-profile:windows-runtime] bundled node target: ${plan.stagedNodeExeTarget}`);
  console.info(`[webgpu-startup-profile:windows-runtime] windows chrome: ${plan.chromeExe}`);
  console.info(`[webgpu-startup-profile:windows-runtime] base URL: ${plan.baseURL}`);
  console.info(`[webgpu-startup-profile:windows-runtime] require RTX renderer: ${String(plan.requireRtxRenderer)}`);

  if (!plan.ok) {
    throw new Error(plan.missing.join('\n'));
  }

  if (plan.dryRun) {
    console.info('[webgpu-startup-profile:windows-runtime] dry run only; skipping bundle copy');
    return;
  }

  await mkdir(plan.runtimeScriptsDir, { recursive: true });
  await mkdir(plan.runtimeNodeModulesDir, { recursive: true });
  await mkdir(`${plan.runtimeDir}/artifacts`, { recursive: true });

  await cp(plan.nodeExe, plan.stagedNodeExeTarget);
  await cp(plan.captureScriptSource, plan.captureScriptTarget);
  await cp(plan.playwrightCoreSource, plan.playwrightCoreTarget, { recursive: true });
  await writeFile(plan.runCmdPath, buildWindowsRuntimeCommand(plan), 'utf8');
  await writeFile(plan.readmePath, buildWindowsRuntimeReadme(plan), 'utf8');

  console.info(`[webgpu-startup-profile:windows-runtime] staged capture script: ${plan.captureScriptTarget}`);
  console.info(`[webgpu-startup-profile:windows-runtime] staged playwright-core: ${plan.playwrightCoreTarget}`);
  console.info(`[webgpu-startup-profile:windows-runtime] windows launcher: ${plan.runCmdPath}`);
  console.info(`[webgpu-startup-profile:windows-runtime] instructions: ${plan.readmePath}`);
}

if (isExecutedDirectly(import.meta.url)) {
  await main();
}
