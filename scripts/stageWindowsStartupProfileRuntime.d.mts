export function buildWindowsStartupRuntimePlan(
  env?: NodeJS.ProcessEnv,
  pathExists?: (path: string) => boolean,
): {
  ok: boolean;
  missing: string[];
  dryRun: boolean;
  runtimeDir: string;
  nodeExe: string;
  chromeExe: string;
  baseURL: string;
  captureScriptSource: string;
  playwrightCoreSource: string;
  runtimeScriptsDir: string;
  runtimeNodeModulesDir: string;
  stagedNodeExeTarget: string;
  captureScriptTarget: string;
  playwrightCoreTarget: string;
  runCmdPath: string;
  readmePath: string;
  windowsRuntimeDir: string;
  windowsNodeExe: string;
  windowsChromeExe: string;
};

export function buildWindowsRuntimeReadme(plan: ReturnType<typeof buildWindowsStartupRuntimePlan>): string;
export function buildWindowsRuntimeCommand(plan: ReturnType<typeof buildWindowsStartupRuntimePlan>): string;
