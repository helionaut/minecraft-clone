export interface StartupProfilingReportInput {
  startupSummary: {
    totalDurationMs: number | null;
    longFrameCount: number;
    maxFrameDurationMs: number;
    topPhases: Array<{
      name: string;
      durationMs: number;
    }>;
  };
  runtimeStatus: {
    browserSupportsWebGpu?: boolean | null;
    userAgent?: string | null;
    webglVendor?: string | null;
    webglRenderer?: string | null;
    status?: {
      renderer?: string | null;
    };
  };
  consoleEntries: Array<{
    type?: string;
    text?: string;
    location?: string | null;
  }>;
  traceData?: {
    traceEvents?: Array<Record<string, unknown>>;
  };
}

export interface StartupProfilingReport {
  json: {
    generatedAt: string;
    startupTotalDurationMs: number | null;
    longFrameCount: number;
    maxFrameDurationMs: number;
    runtime: {
      browserSupportsWebGpu: boolean | null;
      userAgent: string | null;
      webglVendor: string | null;
      webglRenderer: string | null;
      rendererStatus: string | null;
    };
    targetSurface: {
      meetsRequirement: boolean;
      status: string;
      summary: string;
      reasons: string[];
    };
    topPhases: Array<{
      name: string;
      durationMs: number;
    }>;
    topConsoleErrors: Array<{
      type: string;
      text: string;
      location: string | null;
    }>;
    traceSummary: {
      topMainThreadTasks: Array<{
        name: string;
        cat: string;
        durMs: number;
        tsMs: number;
        pid: number;
        tid: number;
        threadName: string | null;
        url: string | null;
        functionName: string | null;
        srcFunc: string | null;
      }>;
      topGpuTasks: Array<{
        name: string;
        cat: string;
        durMs: number;
        tsMs: number;
        pid: number;
        tid: number;
        threadName: string | null;
        url: string | null;
        functionName: string | null;
        srcFunc: string | null;
      }>;
    };
    remediationCandidates: Array<{
      priority: string;
      suspect: string;
      rationale: string;
    }>;
  };
  markdown: string;
}

export function buildStartupProfilingReport(
  input: StartupProfilingReportInput,
): StartupProfilingReport;
