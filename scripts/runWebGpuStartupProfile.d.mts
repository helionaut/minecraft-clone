export interface WebGpuStartupProfileRunPlan {
  ok: true;
  baseURL: string;
  browserChannel: string;
  executablePath: string;
  cdpEndpointUrl: string;
  requireRtxRenderer: boolean;
  dryRun: boolean;
  artifactDir: string;
  artifactResultsDir: string;
  command: string;
  args: string[];
  reportCommand: string;
  reportArgs: string[];
}

export interface WebGpuStartupProfileRunError {
  ok: false;
  error: string;
}

export function validateBrowserChannel(
  env?: NodeJS.ProcessEnv,
  browserChannel?: string,
  pathExists?: (path: string) => boolean,
): string | null;

export function validateBrowserExecutablePath(
  env?: NodeJS.ProcessEnv,
  pathExists?: (path: string) => boolean,
): string | null;

export function buildWebGpuStartupProfileRun(
  env?: NodeJS.ProcessEnv,
): WebGpuStartupProfileRunPlan | WebGpuStartupProfileRunError;

export function findLatestArtifactOutputDir(
  resultsDir: string,
): Promise<string | null>;
