import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : 'unknown';
}

function parseJsonFile(path) {
  return readFile(path, 'utf8').then((contents) => JSON.parse(contents));
}

async function parseOptionalJsonFile(path) {
  try {
    return await parseJsonFile(path);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function summarizeStartupProfileSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.phases)) {
    return null;
  }

  return {
    totalDurationMs: snapshot.totalDurationMs ?? null,
    longFrameCount: Number(snapshot.longFrameCount ?? 0),
    maxFrameDurationMs: Number(snapshot.maxFrameDurationMs ?? 0),
    longFrameThresholdMs: Number(snapshot.longFrameThresholdMs ?? 0),
    topPhases: [...snapshot.phases]
      .filter((phase) => phase && typeof phase.name === 'string' && Number.isFinite(phase.durationMs))
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 5),
  };
}

function collectTopConsoleErrors(consoleEntries) {
  return consoleEntries
    .filter((entry) => entry?.type === 'error' || entry?.type === 'warning')
    .slice(0, 5)
    .map((entry) => ({
      type: entry.type,
      text: String(entry.text ?? ''),
      location: entry.location ? String(entry.location) : null,
    }));
}

function collectRemediationCandidates(startupSummary, runtimeStatus) {
  const candidates = [];
  const topPhase = startupSummary?.topPhases?.[0];
  const renderer = String(runtimeStatus?.webglRenderer ?? '');

  if (topPhase?.name === 'initial-rebuild-world') {
    candidates.push({
      priority: 'high',
      suspect: 'initial-rebuild-world',
      rationale: 'Initial world rebuild dominates startup time; inspect voxel iteration, mesh creation, and lighting work before first interaction.',
    });
  }

  if (topPhase?.name === 'create-scene-renderer') {
    candidates.push({
      priority: 'high',
      suspect: 'create-scene-renderer',
      rationale: 'Renderer bootstrap dominates startup time; inspect adapter/device acquisition, renderer.init(), and pipeline/material setup.',
    });
  }

  if (startupSummary?.topPhases?.some((phase) => phase.name === 'create-desktop-volumetric-light-volume')) {
    candidates.push({
      priority: 'medium',
      suspect: 'create-desktop-volumetric-light-volume',
      rationale: 'Desktop volumetric setup is expensive enough to appear in top startup phases; compare startup cost with and without volumetric material initialization.',
    });
  }

  if ((startupSummary?.longFrameCount ?? 0) > 0) {
    candidates.push({
      priority: 'medium',
      suspect: 'post-startup frame loop',
      rationale: `Observed ${startupSummary.longFrameCount} long frames after startup; correlate Chrome trace main-thread slices against world rebuild and render-loop work.`,
    });
  }

  if (/swiftshader|llvmpipe|software/i.test(renderer)) {
    candidates.push({
      priority: 'high',
      suspect: 'invalid-runtime-surface',
      rationale: `Captured renderer is software-backed (${renderer}); treat this run as a control only, not proof of RTX Chrome behavior.`,
    });
  }

  return candidates;
}

function getTraceThreadNames(traceEvents) {
  const threadNames = new Map();

  for (const event of traceEvents) {
    if (event?.ph !== 'M' || event?.name !== 'thread_name') {
      continue;
    }

    const threadName = event?.args?.name;

    if (typeof threadName !== 'string') {
      continue;
    }

    threadNames.set(`${event.pid}:${event.tid}`, threadName);
  }

  return threadNames;
}

function summarizeTrace(traceData) {
  const traceEvents = Array.isArray(traceData?.traceEvents) ? traceData.traceEvents : [];

  if (traceEvents.length === 0) {
    return {
      topMainThreadTasks: [],
      topGpuTasks: [],
    };
  }

  const threadNames = getTraceThreadNames(traceEvents);
  const longDurationEvents = traceEvents
    .filter((event) => event?.ph === 'X' && Number.isFinite(event?.dur) && Number(event.dur) >= 50_000);

  const enrichEvent = (event) => ({
    name: String(event.name ?? 'unknown'),
    cat: String(event.cat ?? ''),
    durMs: Number(event.dur) / 1000,
    tsMs: Number(event.ts ?? 0) / 1000,
    pid: Number(event.pid ?? 0),
    tid: Number(event.tid ?? 0),
    threadName: threadNames.get(`${event.pid}:${event.tid}`) ?? null,
    url: typeof event?.args?.data?.url === 'string' ? event.args.data.url : null,
    functionName: typeof event?.args?.data?.functionName === 'string' ? event.args.data.functionName : null,
    srcFunc: typeof event?.args?.src_func === 'string' ? event.args.src_func : null,
  });

  const topMainThreadTasks = longDurationEvents
    .filter((event) => {
      const category = String(event.cat ?? '');
      const threadName = threadNames.get(`${event.pid}:${event.tid}`) ?? '';
      return /devtools\.timeline|toplevel|v8\.execute/.test(category) || /CrRendererMain|CrBrowserMain/.test(threadName);
    })
    .sort((left, right) => right.dur - left.dur)
    .slice(0, 10)
    .map(enrichEvent);

  const topGpuTasks = longDurationEvents
    .filter((event) => /gpu/i.test(String(event.cat ?? '')) || /gpu/i.test(String(event.name ?? '')))
    .sort((left, right) => right.dur - left.dur)
    .slice(0, 10)
    .map(enrichEvent);

  return {
    topMainThreadTasks,
    topGpuTasks,
  };
}

export function buildStartupProfilingReport({
  startupSummary,
  runtimeStatus,
  consoleEntries,
  traceData,
}) {
  const topPhases = Array.isArray(startupSummary?.topPhases) ? startupSummary.topPhases : [];
  const topConsoleErrors = collectTopConsoleErrors(Array.isArray(consoleEntries) ? consoleEntries : []);
  const traceSummary = summarizeTrace(traceData);
  const report = {
    generatedAt: new Date().toISOString(),
    startupTotalDurationMs: startupSummary?.totalDurationMs ?? null,
    longFrameCount: startupSummary?.longFrameCount ?? 0,
    maxFrameDurationMs: startupSummary?.maxFrameDurationMs ?? 0,
    runtime: {
      browserSupportsWebGpu: runtimeStatus?.browserSupportsWebGpu ?? null,
      userAgent: runtimeStatus?.userAgent ?? null,
      webglVendor: runtimeStatus?.webglVendor ?? null,
      webglRenderer: runtimeStatus?.webglRenderer ?? null,
      rendererStatus: runtimeStatus?.status?.renderer ?? null,
    },
    topPhases,
    topConsoleErrors,
    traceSummary,
    remediationCandidates: collectRemediationCandidates(startupSummary, runtimeStatus),
  };

  const markdownLines = [
    '# WebGPU Startup Profiling Summary',
    '',
    `- Startup total duration: ${formatNumber(report.startupTotalDurationMs)}ms`,
    `- Long frames: ${report.longFrameCount}`,
    `- Max frame duration: ${formatNumber(report.maxFrameDurationMs)}ms`,
    `- WebGPU available: ${String(report.runtime.browserSupportsWebGpu)}`,
    `- WebGL renderer: ${report.runtime.webglRenderer ?? 'unknown'}`,
    '',
    '## Top startup phases',
    ...(
      topPhases.length > 0
        ? topPhases.map((phase) => `- ${phase.name}: ${formatNumber(phase.durationMs)}ms`)
        : ['- none']
    ),
    '',
    '## Console warnings/errors',
    ...(
      topConsoleErrors.length > 0
        ? topConsoleErrors.map((entry) => `- [${entry.type}] ${entry.text}`)
        : ['- none']
    ),
    '',
    '## Trace hotspots',
    '### Main thread',
    ...(
      traceSummary.topMainThreadTasks.length > 0
        ? traceSummary.topMainThreadTasks.slice(0, 5).map((event) => `- ${event.name}: ${formatNumber(event.durMs)}ms${event.functionName ? ` (${event.functionName})` : ''}${event.srcFunc ? ` [${event.srcFunc}]` : ''}`)
        : ['- none']
    ),
    '### GPU / compositor',
    ...(
      traceSummary.topGpuTasks.length > 0
        ? traceSummary.topGpuTasks.slice(0, 5).map((event) => `- ${event.name}: ${formatNumber(event.durMs)}ms${event.threadName ? ` [${event.threadName}]` : ''}`)
        : ['- none']
    ),
    '',
    '## Remediation candidates',
    ...(
      report.remediationCandidates.length > 0
        ? report.remediationCandidates.map((candidate) => `- ${candidate.priority}: ${candidate.suspect} - ${candidate.rationale}`)
        : ['- none']
    ),
  ];

  return {
    json: report,
    markdown: `${markdownLines.join('\n')}\n`,
  };
}

async function main() {
  const artifactDir = process.env.STARTUP_PROFILE_ARTIFACT_DIR?.trim()
    ?? 'reports/startup-profiling/test-results/webgpuStartup.profile-capt-28d63-e-WebGPU-scene-startup-path';
  const outputJsonPath = process.env.STARTUP_PROFILE_REPORT_JSON?.trim()
    ?? `${artifactDir}/startup-profile-report.json`;
  const outputMarkdownPath = process.env.STARTUP_PROFILE_REPORT_MARKDOWN?.trim()
    ?? `${artifactDir}/startup-profile-report.md`;

  const [startupSummaryFile, runtimeStatus, consoleEntries, traceData] = await Promise.all([
    parseOptionalJsonFile(`${artifactDir}/startup-profile-summary.json`),
    parseJsonFile(`${artifactDir}/runtime-status.json`),
    parseJsonFile(`${artifactDir}/console-messages.json`),
    parseOptionalJsonFile(`${artifactDir}/chrome-performance-trace.json`),
  ]);

  const startupSummary = startupSummaryFile
    ?? summarizeStartupProfileSnapshot(runtimeStatus?.startupProfile);

  if (!startupSummary) {
    throw new Error(`No startup profile summary could be derived from ${artifactDir}.`);
  }

  const report = buildStartupProfilingReport({
    startupSummary,
    runtimeStatus,
    consoleEntries,
    traceData,
  });

  await Promise.all([
    writeFile(outputJsonPath, JSON.stringify(report.json, null, 2), 'utf8'),
    writeFile(outputMarkdownPath, report.markdown, 'utf8'),
  ]);

  console.info(`[webgpu-startup-profile-summary] json: ${outputJsonPath}`);
  console.info(`[webgpu-startup-profile-summary] markdown: ${outputMarkdownPath}`);
}

const scriptPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).pathname : '';

if (import.meta.url.endsWith(scriptPath)) {
  await main();
}
