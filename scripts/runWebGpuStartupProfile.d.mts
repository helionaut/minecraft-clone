export interface WebGpuStartupProfileRunPlan {
  ok: true;
  baseURL: string;
  browserChannel: string;
  executablePath: string;
  dryRun: boolean;
  artifactDir: string;
  command: string;
  args: string[];
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
