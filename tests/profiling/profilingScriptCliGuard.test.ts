import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const scripts = [
  'scripts/runWebGpuStartupProfile.mjs',
  'scripts/compareWebGpuStartupProfiles.mjs',
  'scripts/summarizeWebGpuStartupProfile.mjs',
  'scripts/captureWebGpuStartupProfileOverCdp.mjs',
  'scripts/runWebGpuStartupProfileLocalPreview.mjs',
  'scripts/stageWindowsStartupProfileRuntime.mjs',
];

describe('profiling script CLI guards', () => {
  it.each(scripts)('does not execute %s when imported as a module', (scriptPath) => {
    const output = execFileSync('node', [
      '--input-type=module',
      '--eval',
      `await import('./${scriptPath}');`,
    ], {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(output).toBe('');
  });
});
