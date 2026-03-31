import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

import { isExecutedDirectly } from './isExecutedDirectly.mjs';

import { chromium } from '../node_modules/playwright-core/index.mjs';

const STARTUP_PROFILE_QUERY = './?renderer=webgpu&qaHarness=1&startupProfile=1';
const SOFTWARE_RENDERER_PATTERNS = [
  /llvmpipe/i,
  /swiftshader/i,
  /software/i,
  /softpipe/i,
  /lavapipe/i,
];

function buildArtifactOutputDir(env = process.env) {
  const explicitArtifactDir = env.STARTUP_PROFILE_ARTIFACT_DIR?.trim();

  if (explicitArtifactDir) {
    return explicitArtifactDir;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `reports/startup-profiling/test-results/webgpuStartup.cdp-${stamp}`;
}

export function parseBrowserArgs(env = process.env) {
  const rawArgs = env.PLAYWRIGHT_PROFILE_BROWSER_ARGS?.trim() ?? '';

  if (!rawArgs) {
    return [];
  }

  return rawArgs
    .split(/\r?\n|;;/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function summarizeStartupProfile(snapshot) {
  return {
    totalDurationMs: snapshot.totalDurationMs,
    longFrameCount: snapshot.longFrameCount,
    maxFrameDurationMs: snapshot.maxFrameDurationMs,
    longFrameThresholdMs: snapshot.longFrameThresholdMs,
    topPhases: [...snapshot.phases]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 5),
  };
}

function isStartupProfileSnapshot(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return typeof value.startedAt === 'number'
    && Array.isArray(value.phases)
    && Array.isArray(value.frameSamples)
    && typeof value.longFrameCount === 'number'
    && typeof value.maxFrameDurationMs === 'number'
    && typeof value.longFrameThresholdMs === 'number';
}

function getInvalidProfilingRuntimeReason(status) {
  if (status.browserSupportsWebGpu !== true) {
    return `Expected a WebGPU-capable Chrome runtime, but navigator.gpu was unavailable. User agent: ${String(status.userAgent ?? 'unknown')}.`;
  }

  const renderer = typeof status.webglRenderer === 'string' ? status.webglRenderer : '';

  if (renderer && SOFTWARE_RENDERER_PATTERNS.some((pattern) => pattern.test(renderer))) {
    return `Expected hardware-accelerated graphics for profiling, but WebGL renderer was ${renderer}.`;
  }

  return null;
}

async function startChromeTrace(session) {
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

async function stopChromeTrace(session, outputPath) {
  const traceComplete = new Promise((resolve, reject) => {
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
    const chunk = await session.send('IO.read', { handle: stream });
    contents += chunk.data;
    eof = chunk.eof;
  }

  await session.send('IO.close', { handle: stream });
  await writeFile(outputPath, contents, 'utf8');
}

async function expectPoll(poll, predicate, timeoutMs, message) {
  const startedAt = Date.now();

  while ((Date.now() - startedAt) < timeoutMs) {
    const value = await poll();

    if (predicate(value)) {
      return value;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  throw new Error(message);
}

async function main() {
  const cdpEndpointUrl = process.env.PLAYWRIGHT_PROFILE_CDP_ENDPOINT_URL?.trim() ?? '';
  const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() ?? '';
  const executablePath = process.env.PLAYWRIGHT_PROFILE_EXECUTABLE_PATH?.trim() ?? '';
  const browserChannel = process.env.PLAYWRIGHT_PROFILE_BROWSER_CHANNEL?.trim() ?? '';
  const browserArgs = parseBrowserArgs();

  if (!baseURL) {
    throw new Error('PLAYWRIGHT_BASE_URL is required for startup profiling runs.');
  }

  if (!cdpEndpointUrl && !executablePath && !browserChannel) {
    throw new Error('Set PLAYWRIGHT_PROFILE_CDP_ENDPOINT_URL or provide a browser channel/executable path for startup profiling.');
  }

  const artifactOutputDir = buildArtifactOutputDir();
  await mkdir(artifactOutputDir, { recursive: true });

  console.info(`[webgpu-startup-profile:capture] endpoint: ${cdpEndpointUrl}`);
  console.info(`[webgpu-startup-profile:capture] browser channel: ${browserChannel}`);
  console.info(`[webgpu-startup-profile:capture] browser executable: ${executablePath}`);
  console.info(`[webgpu-startup-profile:capture] browser args: ${browserArgs.join(' ')}`);
  console.info(`[webgpu-startup-profile:cdp] base URL: ${baseURL}`);
  console.info(`[webgpu-startup-profile:cdp] output: ${artifactOutputDir}`);

  const browser = cdpEndpointUrl
    ? await chromium.connectOverCDP(cdpEndpointUrl)
    : await chromium.launch({
      channel: executablePath ? undefined : (browserChannel || undefined),
      executablePath: executablePath || undefined,
      headless: true,
      args: browserArgs,
    });

  const context = cdpEndpointUrl
    ? (browser.contexts()[0] ?? await browser.newContext({ viewport: { width: 1600, height: 900 } }))
    : await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const consoleEntries = [];

  page.on('console', (message) => {
    consoleEntries.push({
      type: message.type(),
      text: message.text(),
      location: message.location().url || undefined,
    });
  });

  const cdpSession = await context.newCDPSession(page);
  const tracePath = `${artifactOutputDir}/chrome-performance-trace.json`;
  const consolePath = `${artifactOutputDir}/console-messages.json`;
  const startupProfilePath = `${artifactOutputDir}/startup-profile.json`;
  const startupSummaryPath = `${artifactOutputDir}/startup-profile-summary.json`;
  const statusPath = `${artifactOutputDir}/runtime-status.json`;
  const screenshotPath = `${artifactOutputDir}/startup-shell.png`;

  try {
    await startChromeTrace(cdpSession);
    await page.goto(new URL(STARTUP_PROFILE_QUERY, baseURL).toString(), { waitUntil: 'domcontentloaded' });

    await expectPoll(
      () => page.evaluate(() => {
        return Boolean(globalThis.window.__minecraftCloneQa?.getStartupProfile());
      }),
      (value) => value === true,
      60_000,
      'Expected the QA harness to expose a startup profile snapshot.',
    );

    await expectPoll(
      () => page.evaluate(() => {
        const startupProfile = globalThis.window.__minecraftCloneQa?.getStartupProfile();
        return startupProfile?.frameSamples?.length ?? 0;
      }),
      (value) => Number(value) > 0,
      15_000,
      'Expected the startup profile to collect some frame samples after load.',
    );

    await page.waitForTimeout(5_000);
    await page.screenshot({ path: screenshotPath });

    const pageState = await page.evaluate(() => {
      return {
        browserSupportsWebGpu: typeof navigator.gpu !== 'undefined',
        startupProfile: globalThis.window.__minecraftCloneQa?.getStartupProfile() ?? null,
        status: globalThis.window.__minecraftCloneQa?.getStatus() ?? null,
        userAgent: navigator.userAgent,
      };
    });

    const graphicsState = await page.evaluate(() => {
      const canvas = globalThis.document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

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
        webglVendor: gl.getParameter(debugRendererInfo.UNMASKED_VENDOR_WEBGL),
        webglRenderer: gl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL),
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
  } finally {
    await browser.close();
  }
}

if (isExecutedDirectly(import.meta.url)) {
  await main();
}
