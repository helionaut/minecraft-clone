import { expect, test } from '@playwright/test';
import type { CDPSession } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

import {
  getInvalidProfilingRuntimeReason,
  isStartupProfileSnapshot,
  STARTUP_PROFILE_QUERY,
  summarizeStartupProfile,
} from './startupProfileCaptureHelper.ts';

interface ConsoleEntry {
  readonly type: string;
  readonly text: string;
  readonly location?: string;
}

async function startChromeTrace(session: CDPSession) {
  await session.send('Tracing.start', {
    categories: [
      '-*',
      'blink.user_timing',
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'gpu',
      'toplevel',
      'v8.execute',
    ].join(','),
    options: 'sampling-frequency=10000',
    transferMode: 'ReturnAsStream',
  });
}

async function stopChromeTrace(
  session: CDPSession,
  outputPath: string,
) {
  const traceComplete = new Promise<{ stream: string }>((resolve, reject) => {
    session.on('Tracing.tracingComplete', (payload) => {
      if (!payload.stream) {
        reject(new Error('Chrome trace completed without a readable stream handle.'));
        return;
      }

      resolve({ stream: payload.stream });
    });
  });

  await session.send('Tracing.end');
  const { stream } = await traceComplete;
  let contents = '';
  let eof = false;

  while (!eof) {
    const chunk = await session.send('IO.read', { handle: stream }) as { data: string; eof: boolean };
    contents += chunk.data;
    eof = chunk.eof;
  }

  await session.send('IO.close', { handle: stream });
  await writeFile(outputPath, contents, 'utf8');
}

test('captures startup profiling artifacts for the WebGPU scene startup path', async ({ browser }, testInfo) => {
  test.setTimeout(240_000);

  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
  });
  const page = await context.newPage();
  const consoleEntries: ConsoleEntry[] = [];

  page.on('console', (message) => {
    consoleEntries.push({
      type: message.type(),
      text: message.text(),
      location: message.location().url || undefined,
    });
  });

  const cdpSession = await context.newCDPSession(page);
  const tracePath = testInfo.outputPath('chrome-performance-trace.json');
  const consolePath = testInfo.outputPath('console-messages.json');
  const startupProfilePath = testInfo.outputPath('startup-profile.json');
  const startupSummaryPath = testInfo.outputPath('startup-profile-summary.json');
  const statusPath = testInfo.outputPath('runtime-status.json');
  const screenshotPath = testInfo.outputPath('startup-shell.png');

  await startChromeTrace(cdpSession);
  await page.goto(STARTUP_PROFILE_QUERY, { waitUntil: 'domcontentloaded' });

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        return Boolean((window as Window & {
          __minecraftCloneQa?: {
            getStartupProfile: () => unknown;
          };
        }).__minecraftCloneQa?.getStartupProfile());
      });
    }, {
      timeout: 60_000,
      message: 'Expected the QA harness to expose a startup profile snapshot.',
    })
    .toBe(true);

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const startupProfile = (window as Window & {
          __minecraftCloneQa?: {
            getStartupProfile: () => ({ frameSamples?: unknown[] } | null);
          };
        }).__minecraftCloneQa?.getStartupProfile() as { frameSamples?: unknown[] } | null | undefined;

        return startupProfile?.frameSamples?.length ?? 0;
      });
    }, {
      timeout: 15_000,
      message: 'Expected the startup profile to collect some frame samples after load.',
    })
    .toBeGreaterThan(0);

  await page.waitForTimeout(5_000);
  await page.screenshot({ path: screenshotPath });

  const pageState = await page.evaluate(() => {
    const qa = (window as Window & {
      __minecraftCloneQa?: {
        getStartupProfile: () => unknown;
        getStatus: () => unknown;
      };
    }).__minecraftCloneQa;

    return {
      browserSupportsWebGpu: typeof navigator.gpu !== 'undefined',
      startupProfile: qa?.getStartupProfile() ?? null,
      status: qa?.getStatus() ?? null,
      userAgent: navigator.userAgent,
      webglVendor: null as string | null,
      webglRenderer: null as string | null,
    };
  });

  const graphicsState = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = (
      canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl')
    ) as WebGLRenderingContext | null;

    if (!gl) {
      return {
        webglVendor: null,
        webglRenderer: null,
      };
    }

    const debugRendererInfo = gl.getExtension('WEBGL_debug_renderer_info');

    if (!debugRendererInfo) {
      return {
        webglVendor: null,
        webglRenderer: null,
      };
    }

    return {
      webglVendor: gl.getParameter(debugRendererInfo.UNMASKED_VENDOR_WEBGL) as string,
      webglRenderer: gl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL) as string,
    };
  });

  const runtimeStatus = {
    ...pageState,
    ...graphicsState,
  };

  await writeFile(consolePath, JSON.stringify(consoleEntries, null, 2), 'utf8');
  await writeFile(statusPath, JSON.stringify(runtimeStatus, null, 2), 'utf8');
  await stopChromeTrace(cdpSession, tracePath);

  const invalidRuntimeReason = getInvalidProfilingRuntimeReason(runtimeStatus);

  expect(invalidRuntimeReason).toBeNull();
  expect(isStartupProfileSnapshot(runtimeStatus.startupProfile)).toBe(true);

  if (invalidRuntimeReason) {
    throw new Error(invalidRuntimeReason);
  }

  if (!isStartupProfileSnapshot(runtimeStatus.startupProfile)) {
    throw new Error('Expected a valid startup profile snapshot.');
  }

  await writeFile(startupProfilePath, JSON.stringify(runtimeStatus.startupProfile, null, 2), 'utf8');
  await writeFile(
    startupSummaryPath,
    JSON.stringify(summarizeStartupProfile(runtimeStatus.startupProfile), null, 2),
    'utf8',
  );

  await context.close();
});
