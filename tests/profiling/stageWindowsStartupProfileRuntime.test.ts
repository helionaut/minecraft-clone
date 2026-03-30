import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  buildWindowsRuntimeCommand,
  buildWindowsRuntimeReadme,
  buildWindowsStartupRuntimePlan,
} from '../../scripts/stageWindowsStartupProfileRuntime.mjs';

const scriptPath = 'scripts/stageWindowsStartupProfileRuntime.mjs';

describe('stageWindowsStartupProfileRuntime', () => {
  it('builds the expected default staging plan', () => {
    const plan = buildWindowsStartupRuntimePlan({}, () => true);

    expect(plan.ok).toBe(true);
    expect(plan.runtimeDir).toBe('/mnt/c/Temp/hel142-startup-runtime');
    expect(plan.windowsRuntimeDir).toBe('C:\\Temp\\hel142-startup-runtime');
    expect(plan.stagedNodeExeTarget).toBe('/mnt/c/Temp/hel142-startup-runtime/node.exe');
    expect(plan.windowsNodeExe).toBe('C:\\Temp\\hel142-startup-runtime\\node.exe');
    expect(plan.windowsChromeExe).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    expect(plan.baseURL).toBe('http://127.0.0.1:4173/minecraft-clone/');
  });

  it('reports missing Windows toolchain paths clearly', () => {
    const plan = buildWindowsStartupRuntimePlan({}, () => false);

    expect(plan.ok).toBe(false);
    expect(plan.missing).toContain('Windows Node executable is missing: /home/helionaut/srv/research-cache/minecraft-clone/toolchains/node-v22.22.1-win-x64/node-v22.22.1-win-x64/node.exe');
    expect(plan.missing).toContain('Windows Chrome executable is missing: /mnt/c/Program Files/Google/Chrome/Application/chrome.exe');
  });

  it('supports overriding the staging directory and target URL', () => {
    const plan = buildWindowsStartupRuntimePlan({
      PLAYWRIGHT_WINDOWS_RUNTIME_DIR: '/mnt/d/runtime',
      PLAYWRIGHT_WINDOWS_NODE_EXE: '/mnt/d/node/node.exe',
      PLAYWRIGHT_WINDOWS_CHROME_EXE: '/mnt/d/chrome/chrome.exe',
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:4174/minecraft-clone/',
    }, () => true);

    expect(plan.windowsRuntimeDir).toBe('D:\\runtime');
    expect(plan.stagedNodeExeTarget).toBe('/mnt/d/runtime/node.exe');
    expect(plan.windowsNodeExe).toBe('D:\\runtime\\node.exe');
    expect(plan.windowsChromeExe).toBe('D:\\chrome\\chrome.exe');
    expect(plan.baseURL).toBe('http://127.0.0.1:4174/minecraft-clone/');
  });

  it('writes a launcher command that runs the staged capture script on Windows', () => {
    const plan = buildWindowsStartupRuntimePlan({}, () => true);
    const command = buildWindowsRuntimeCommand(plan);

    expect(command).toContain('set "PLAYWRIGHT_PROFILE_EXECUTABLE_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"');
    expect(command).toContain('"C:\\Temp\\hel142-startup-runtime\\scripts\\captureWebGpuStartupProfileOverCdp.mjs"');
    expect(command).toContain('set "STARTUP_PROFILE_ARTIFACT_DIR=C:\\Temp\\hel142-startup-runtime\\artifacts"');
    expect(command).toContain('"C:\\Temp\\hel142-startup-runtime\\node.exe"');
  });

  it('writes a readme that points at the staged Windows launcher', () => {
    const plan = buildWindowsStartupRuntimePlan({}, () => true);
    const readme = buildWindowsRuntimeReadme(plan);

    expect(readme).toContain('HEL-142 Windows Startup Profiling Runtime');
    expect(readme).toContain('C:\\Temp\\hel142-startup-runtime\\run-startup-profile.cmd');
    expect(readme).toContain('C:\\Temp\\hel142-startup-runtime\\artifacts\\');
    expect(readme).toContain('Bundled Windows Node: C:\\Temp\\hel142-startup-runtime\\node.exe');
    expect(readme).toContain('reports\\startup-profiling\\test-results\\windows-host-runtime-attempt\\');
  });

  it('prints the staging plan during dry run', () => {
    const output = execFileSync('node', [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_PROFILE_DRY_RUN: '1',
      },
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(output).toContain('runtime dir: /mnt/c/Temp/hel142-startup-runtime');
    expect(output).toContain('node source: /home/helionaut/srv/research-cache/minecraft-clone/toolchains/node-v22.22.1-win-x64/node-v22.22.1-win-x64/node.exe');
    expect(output).toContain('bundled node target: /mnt/c/Temp/hel142-startup-runtime/node.exe');
    expect(output).toContain('windows chrome: /mnt/c/Program Files/Google/Chrome/Application/chrome.exe');
    expect(output).toContain('dry run only; skipping bundle copy');
  });
});
