export interface StartupProfileComparisonInput {
  baselineLabel: string;
  candidateLabel: string;
  baselineReport: {
    startupTotalDurationMs?: number | null;
    longFrameCount?: number;
    maxFrameDurationMs?: number;
    runtime?: {
      webglRenderer?: string | null;
    };
    topPhases?: Array<{
      name: string;
      durationMs: number;
    }>;
    traceSummary?: {
      topGpuTasks?: Array<{
        name?: string;
        durMs?: number;
      }>;
    };
  };
  candidateReport: {
    startupTotalDurationMs?: number | null;
    longFrameCount?: number;
    maxFrameDurationMs?: number;
    runtime?: {
      webglRenderer?: string | null;
    };
    topPhases?: Array<{
      name: string;
      durationMs: number;
    }>;
    traceSummary?: {
      topGpuTasks?: Array<{
        name?: string;
        durMs?: number;
      }>;
    };
  };
}

export interface StartupProfileComparison {
  json: {
    generatedAt: string;
    baselineLabel: string;
    candidateLabel: string;
    baseline: {
      startupTotalDurationMs: number | null;
      longFrameCount: number;
      maxFrameDurationMs: number;
      renderer: string | null;
      topGpuHotspot: {
        name: string;
        durMs: number;
      } | null;
    };
    candidate: {
      startupTotalDurationMs: number | null;
      longFrameCount: number;
      maxFrameDurationMs: number;
      renderer: string | null;
      topGpuHotspot: {
        name: string;
        durMs: number;
      } | null;
    };
    deltas: {
      startupTotalDurationMs: number;
      longFrameCount: number;
      maxFrameDurationMs: number;
    };
    phaseComparisons: Array<{
      name: string;
      baselineDurationMs: number | null;
      candidateDurationMs: number | null;
      deltaMs: number | null;
    }>;
    highlights: Array<{
      priority: string;
      finding: string;
      summary: string;
    }>;
  };
  markdown: string;
}

export function buildStartupProfileComparison(
  input: StartupProfileComparisonInput,
): StartupProfileComparison;
