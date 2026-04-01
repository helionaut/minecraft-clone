import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from '@playwright/test';

const DEFAULT_PORT = 4173;
const DEFAULT_OUTPUT_PATH = path.resolve('reports/chunk-traversal/profile.json');

function createCommandError(command, exitCode) {
  return new Error(`Command failed (${exitCode ?? 'unknown'}): ${command.join(' ')}`);
}

function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: options.cwd ?? process.cwd(),
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(createCommandError(command, code));
    });
  });
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Preview is still starting up.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function startPreviewServer(port) {
  const child = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });

  child.on('error', (error) => {
    throw error;
  });

  return child;
}

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      output: { type: 'string' },
      'chunk-radius': { type: 'string' },
      'samples-per-chunk': { type: 'string' },
      'clearance-above-terrain': { type: 'string' },
      'camera-pitch': { type: 'string' },
      'timeout-ms': { type: 'string' },
      headed: { type: 'boolean', default: false },
      'skip-build': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const outputPath = path.resolve(values.output ?? DEFAULT_OUTPUT_PATH);
  const timeoutMs = Number(values['timeout-ms'] ?? 120_000);
  const profileOptions = {
    chunkRadius: values['chunk-radius'] ? Number(values['chunk-radius']) : undefined,
    samplesPerChunk: values['samples-per-chunk'] ? Number(values['samples-per-chunk']) : undefined,
    clearanceAboveTerrain: values['clearance-above-terrain']
      ? Number(values['clearance-above-terrain'])
      : undefined,
    cameraPitch: values['camera-pitch'] ? Number(values['camera-pitch']) : undefined,
  };
  let previewServer = null;
  const baseUrl = values.url ?? `http://127.0.0.1:${DEFAULT_PORT}/`;

  if (!values.url) {
    if (!values['skip-build']) {
      await runCommand(['npm', 'run', 'build']);
    }

    previewServer = startPreviewServer(DEFAULT_PORT);
    await waitForUrl(baseUrl, timeoutMs);
  }

  const browser = await chromium.launch({ headless: !values.headed });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const targetUrl = new URL(baseUrl);
    targetUrl.searchParams.set('qaHarness', '1');
    targetUrl.searchParams.set('debugDiagnostics', '1');

    await page.goto(targetUrl.toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForFunction(() => {
      return typeof globalThis.__minecraftCloneQa?.profileChunkTraversal === 'function';
    }, undefined, { timeout: timeoutMs });

    const report = await page.evaluate(async (options) => {
      const qa = globalThis.__minecraftCloneQa;

      if (!qa?.profileChunkTraversal) {
        throw new Error('Chunk traversal profiler is unavailable on the QA harness.');
      }

      const traversalReport = await qa.profileChunkTraversal(options);
      return {
        traversalReport,
        diagnostics: qa.getDiagnostics?.() ?? null,
      };
    }, profileOptions);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const averageFps = report.traversalReport.summary.averageFps ?? 'n/a';
    const frameP95 = report.traversalReport.summary.frameTimingMs.p95 ?? 'n/a';
    const rebuildP95 = report.traversalReport.summary.rebuildTimingMs.p95 ?? 'n/a';
    console.log(`Chunk traversal profile saved to ${outputPath}`);
    console.log(`Average FPS: ${averageFps}`);
    console.log(`Frame p95 (ms): ${frameP95}`);
    console.log(`Rebuild p95 (ms): ${rebuildP95}`);
  } finally {
    await browser.close();

    if (previewServer) {
      previewServer.kill('SIGTERM');
      await new Promise((resolve) => {
        previewServer.once('exit', resolve);
      });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
