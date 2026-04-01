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
    const plan = buildWindowsStartupRuntimePlan({}, () => true) as ReturnType<typeof buildWindowsStartupRuntimePlan> & {
      sharedHelperTarget: string;
      reportScriptTarget: string;
      compareScriptTarget: string;
      uploadManifestScriptTarget: string;
      baselineReportTarget: string;
    };

    expect(plan.ok).toBe(true);
    expect(plan.runtimeDir).toBe('/mnt/c/Temp/hel142-startup-runtime');
    expect(plan.windowsRuntimeDir).toBe('C:\\Temp\\hel142-startup-runtime');
    expect(plan.stagedNodeExeTarget).toBe('/mnt/c/Temp/hel142-startup-runtime/node.exe');
    expect(plan.windowsNodeExe).toBe('C:\\Temp\\hel142-startup-runtime\\node.exe');
    expect(plan.windowsChromeExe).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    expect(plan.baseURL).toBe('http://127.0.0.1:4173/minecraft-clone/');
    expect(plan.captureScriptTarget).toBe('/mnt/c/Temp/hel142-startup-runtime/scripts/captureWebGpuStartupProfileOverCdp.mjs');
    expect(plan.sharedHelperTarget).toBe('/mnt/c/Temp/hel142-startup-runtime/scripts/isExecutedDirectly.mjs');
    expect(plan.reportScriptTarget).toBe('/mnt/c/Temp/hel142-startup-runtime/scripts/summarizeWebGpuStartupProfile.mjs');
    expect(plan.compareScriptTarget).toBe('/mnt/c/Temp/hel142-startup-runtime/scripts/compareWebGpuStartupProfiles.mjs');
    expect(plan.uploadManifestScriptTarget).toBe('/mnt/c/Temp/hel142-startup-runtime/scripts/writeWebGpuStartupProfileUploadManifest.mjs');
    expect(plan.baselineReportTarget).toBe('/mnt/c/Temp/hel142-startup-runtime/baselines/hel-142-windows-intel-control-startup-profile-report.json');
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
    expect(command).toContain('"C:\\Temp\\hel142-startup-runtime\\scripts\\summarizeWebGpuStartupProfile.mjs"');
    expect(command).toContain('"C:\\Temp\\hel142-startup-runtime\\scripts\\compareWebGpuStartupProfiles.mjs"');
    expect(command).toContain('"C:\\Temp\\hel142-startup-runtime\\scripts\\writeWebGpuStartupProfileUploadManifest.mjs"');
    expect(command).toContain('Compress-Archive');
    expect(command).toContain('startup-profile-upload-bundle.zip');
    expect(command).toContain('set "STARTUP_PROFILE_BASELINE_REPORT=C:\\Temp\\hel142-startup-runtime\\baselines\\hel-142-windows-intel-control-startup-profile-report.json"');
    expect(command).toContain('set "STARTUP_PROFILE_CANDIDATE_REPORT=C:\\Temp\\hel142-startup-runtime\\artifacts\\startup-profile-report.json"');
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
    expect(readme).toContain('startup-profile-report.json');
    expect(readme).toContain('startup-profile-comparison.json');
    expect(readme).toContain('startup-profile-upload-manifest.json');
    expect(readme).toContain('startup-profile-upload-bundle.zip');
  });

  it('prints the staging plan during dry run', () => {
    const output = execFileSync('node', [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_PROFILE_DRY_RUN: '1',
        PLAYWRIGHT_WINDOWS_NODE_EXE: process.execPath,
        PLAYWRIGHT_WINDOWS_CHROME_EXE: process.execPath,
      },
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(output).toContain('runtime dir: /mnt/c/Temp/hel142-startup-runtime');
    expect(output).toContain(`node source: ${process.execPath}`);
    expect(output).toContain('bundled node target: /mnt/c/Temp/hel142-startup-runtime/node.exe');
    expect(output).toContain(`windows chrome: ${process.execPath}`);
    expect(output).toContain('dry run only; skipping bundle copy');
  });
});
