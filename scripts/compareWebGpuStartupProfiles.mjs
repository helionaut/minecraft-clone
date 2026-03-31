import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';

import { isExecutedDirectly } from './isExecutedDirectly.mjs';
import { buildStartupProfilingReportFromArtifactDir } from './summarizeWebGpuStartupProfile.mjs';

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : 'unknown';
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function resolveStartupProfilingReport({ reportPath, artifactDir }) {
  try {
    return await readJson(reportPath);
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  if (!artifactDir) {
    throw new Error(`Baseline report is missing and no artifact directory was provided: ${reportPath}`);
  }

  return (await buildStartupProfilingReportFromArtifactDir(artifactDir)).json;
}

function mapPhases(phases) {
  return new Map(
    Array.isArray(phases)
      ? phases
        .filter((phase) => phase && typeof phase.name === 'string' && Number.isFinite(phase.durationMs))
        .map((phase) => [phase.name, Number(phase.durationMs)])
      : [],
  );
}

function comparePhases(baselineReport, candidateReport) {
  const baselinePhases = mapPhases(baselineReport?.topPhases);
  const candidatePhases = mapPhases(candidateReport?.topPhases);
  const phaseNames = new Set([...baselinePhases.keys(), ...candidatePhases.keys()]);

  return [...phaseNames]
    .map((name) => {
      const baselineDurationMs = baselinePhases.get(name) ?? null;
      const candidateDurationMs = candidatePhases.get(name) ?? null;
      const deltaMs = baselineDurationMs !== null && candidateDurationMs !== null
        ? candidateDurationMs - baselineDurationMs
        : null;

      return {
        name,
        baselineDurationMs,
        candidateDurationMs,
        deltaMs,
      };
    })
    .sort((left, right) => {
      const leftAbs = Math.abs(left.deltaMs ?? left.candidateDurationMs ?? left.baselineDurationMs ?? 0);
      const rightAbs = Math.abs(right.deltaMs ?? right.candidateDurationMs ?? right.baselineDurationMs ?? 0);
      return rightAbs - leftAbs;
    });
}

function firstTraceEvent(traceSummarySection) {
  return Array.isArray(traceSummarySection) && traceSummarySection.length > 0
    ? traceSummarySection[0]
    : null;
}

function collectComparisonHighlights(baselineReport, candidateReport, phaseComparisons) {
  const highlights = [];
  const candidateRenderer = String(candidateReport?.runtime?.webglRenderer ?? '');
  const baselineRenderer = String(baselineReport?.runtime?.webglRenderer ?? '');
  const largestPhaseDelta = phaseComparisons.find((phase) => phase.deltaMs !== null);

  if (candidateRenderer && baselineRenderer && candidateRenderer !== baselineRenderer) {
    highlights.push({
      priority: 'high',
      finding: 'renderer-change',
      summary: `Renderer changed from baseline ${baselineRenderer} to candidate ${candidateRenderer}.`,
    });
  }

  if (largestPhaseDelta && largestPhaseDelta.deltaMs !== null && Math.abs(largestPhaseDelta.deltaMs) >= 50) {
    const direction = largestPhaseDelta.deltaMs > 0 ? 'slower' : 'faster';
    highlights.push({
      priority: 'high',
      finding: 'largest-phase-delta',
      summary: `${largestPhaseDelta.name} is ${direction} by ${formatNumber(Math.abs(largestPhaseDelta.deltaMs))}ms versus baseline.`,
    });
  }

  const baselineLongFrames = Number(baselineReport?.longFrameCount ?? 0);
  const candidateLongFrames = Number(candidateReport?.longFrameCount ?? 0);
  const longFrameDelta = candidateLongFrames - baselineLongFrames;
  if (longFrameDelta !== 0) {
    highlights.push({
      priority: 'medium',
      finding: 'long-frame-delta',
      summary: `Candidate long-frame count changed by ${longFrameDelta > 0 ? '+' : ''}${longFrameDelta} (${baselineLongFrames} -> ${candidateLongFrames}).`,
    });
  }

  const candidateGpuHotspot = firstTraceEvent(candidateReport?.traceSummary?.topGpuTasks);
  const baselineGpuHotspot = firstTraceEvent(baselineReport?.traceSummary?.topGpuTasks);
  if (candidateGpuHotspot?.name || baselineGpuHotspot?.name) {
    highlights.push({
      priority: 'medium',
      finding: 'gpu-hotspot-comparison',
      summary: `Top GPU hotspot baseline=${baselineGpuHotspot?.name ?? 'none'} (${formatNumber(baselineGpuHotspot?.durMs ?? null)}ms), candidate=${candidateGpuHotspot?.name ?? 'none'} (${formatNumber(candidateGpuHotspot?.durMs ?? null)}ms).`,
    });
  }

  return highlights;
}

export function buildStartupProfileComparison({
  baselineLabel,
  candidateLabel,
  baselineReport,
  candidateReport,
}) {
  const phaseComparisons = comparePhases(baselineReport, candidateReport);
  const highlights = collectComparisonHighlights(baselineReport, candidateReport, phaseComparisons);

  const comparison = {
    generatedAt: new Date().toISOString(),
    baselineLabel,
    candidateLabel,
    baseline: {
      startupTotalDurationMs: baselineReport?.startupTotalDurationMs ?? null,
      longFrameCount: baselineReport?.longFrameCount ?? 0,
      maxFrameDurationMs: baselineReport?.maxFrameDurationMs ?? 0,
      renderer: baselineReport?.runtime?.webglRenderer ?? null,
      topGpuHotspot: firstTraceEvent(baselineReport?.traceSummary?.topGpuTasks),
    },
    candidate: {
      startupTotalDurationMs: candidateReport?.startupTotalDurationMs ?? null,
      longFrameCount: candidateReport?.longFrameCount ?? 0,
      maxFrameDurationMs: candidateReport?.maxFrameDurationMs ?? 0,
      renderer: candidateReport?.runtime?.webglRenderer ?? null,
      topGpuHotspot: firstTraceEvent(candidateReport?.traceSummary?.topGpuTasks),
    },
    deltas: {
      startupTotalDurationMs: Number(candidateReport?.startupTotalDurationMs ?? 0) - Number(baselineReport?.startupTotalDurationMs ?? 0),
      longFrameCount: Number(candidateReport?.longFrameCount ?? 0) - Number(baselineReport?.longFrameCount ?? 0),
      maxFrameDurationMs: Number(candidateReport?.maxFrameDurationMs ?? 0) - Number(baselineReport?.maxFrameDurationMs ?? 0),
    },
    phaseComparisons,
    highlights,
  };

  const markdown = [
    '# WebGPU Startup Profile Comparison',
    '',
    `- Baseline: ${baselineLabel}`,
    `- Candidate: ${candidateLabel}`,
    `- Baseline renderer: ${comparison.baseline.renderer ?? 'unknown'}`,
    `- Candidate renderer: ${comparison.candidate.renderer ?? 'unknown'}`,
    `- Startup total delta: ${formatNumber(comparison.deltas.startupTotalDurationMs)}ms`,
    `- Long-frame delta: ${comparison.deltas.longFrameCount > 0 ? '+' : ''}${comparison.deltas.longFrameCount}`,
    `- Max-frame delta: ${formatNumber(comparison.deltas.maxFrameDurationMs)}ms`,
    '',
    '## Highlights',
    ...(comparison.highlights.length > 0
      ? comparison.highlights.map((highlight) => `- ${highlight.priority}: ${highlight.summary}`)
      : ['- none']),
    '',
    '## Phase deltas',
    ...(comparison.phaseComparisons.length > 0
      ? comparison.phaseComparisons.map((phase) => `- ${phase.name}: baseline=${formatNumber(phase.baselineDurationMs)}ms candidate=${formatNumber(phase.candidateDurationMs)}ms delta=${phase.deltaMs === null ? 'unknown' : `${phase.deltaMs > 0 ? '+' : ''}${formatNumber(phase.deltaMs)}ms`}`)
      : ['- none']),
  ].join('\n');

  return {
    json: comparison,
    markdown: `${markdown}\n`,
  };
}

async function main() {
  const baselineReportPath = process.env.STARTUP_PROFILE_BASELINE_REPORT?.trim()
    ?? 'artifacts/startup-profiling-baselines/hel-142-windows-intel-control-startup-profile-report.json';
  const baselineArtifactDir = process.env.STARTUP_PROFILE_BASELINE_ARTIFACT_DIR?.trim()
    ?? dirname(baselineReportPath);
  const candidateReportPath = process.env.STARTUP_PROFILE_CANDIDATE_REPORT?.trim();

  if (!candidateReportPath) {
    throw new Error('STARTUP_PROFILE_CANDIDATE_REPORT is required and should point at the RTX run startup-profile-report.json file.');
  }

  const outputJsonPath = process.env.STARTUP_PROFILE_COMPARISON_JSON?.trim()
    ?? candidateReportPath.replace(/startup-profile-report\.json$/, 'startup-profile-comparison.json');
  const outputMarkdownPath = process.env.STARTUP_PROFILE_COMPARISON_MARKDOWN?.trim()
    ?? candidateReportPath.replace(/startup-profile-report\.json$/, 'startup-profile-comparison.md');

  const [baselineReport, candidateReport] = await Promise.all([
    resolveStartupProfilingReport({
      reportPath: baselineReportPath,
      artifactDir: baselineArtifactDir,
    }),
    readJson(candidateReportPath),
  ]);

  const comparison = buildStartupProfileComparison({
    baselineLabel: process.env.STARTUP_PROFILE_BASELINE_LABEL?.trim() || 'windows-intel-control',
    candidateLabel: process.env.STARTUP_PROFILE_CANDIDATE_LABEL?.trim() || 'candidate',
    baselineReport,
    candidateReport,
  });

  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(comparison.json, null, 2)}\n`, 'utf8'),
    writeFile(outputMarkdownPath, comparison.markdown, 'utf8'),
  ]);

  console.info(`[webgpu-startup-profile-compare] json: ${outputJsonPath}`);
  console.info(`[webgpu-startup-profile-compare] markdown: ${outputMarkdownPath}`);
}

if (isExecutedDirectly(import.meta.url)) {
  await main();
}
