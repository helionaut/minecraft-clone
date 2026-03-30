export interface WebGpuStartupProfileLocalPreviewPlan {
  host: string;
  port: string;
  path: string;
  previewURL: string;
  waitTimeoutMs: number;
  dryRun: boolean;
  buildCommand: string;
  buildArgs: string[];
  previewCommand: string;
  previewArgs: string[];
  captureCommand: string;
  captureArgs: string[];
}

export function buildLocalPreviewProfilePlan(
  env?: NodeJS.ProcessEnv,
): WebGpuStartupProfileLocalPreviewPlan;

export function waitForUrl(
  url: string,
  timeoutMs?: number,
  intervalMs?: number,
): Promise<void>;
