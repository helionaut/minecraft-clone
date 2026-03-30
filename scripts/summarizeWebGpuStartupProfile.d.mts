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
    topPhases: Array<{
      name: string;
      durationMs: number;
    }>;
    topConsoleErrors: Array<{
      type: string;
      text: string;
      location: string | null;
    }>;
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
