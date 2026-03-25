import type { SandboxStatus } from './scene.ts';

export type RendererMode = 'hardware-accelerated' | 'software-fallback' | 'unavailable';

export interface RendererDiagnosticsSource {
  readonly version: string | null;
  readonly vendor: string | null;
  readonly renderer: string | null;
}

export interface RendererDiagnostics {
  readonly mode: RendererMode;
  readonly summary: string;
}

function canonicalizeStatus(status: SandboxStatus): string {
  return JSON.stringify(status);
}

export function shouldPublishSandboxStatus(
  previous: SandboxStatus | null,
  next: SandboxStatus,
): boolean {
  if (!previous) {
    return true;
  }

  return canonicalizeStatus(previous) !== canonicalizeStatus(next);
}

export function buildRendererDiagnostics(source: RendererDiagnosticsSource): RendererDiagnostics {
  const version = source.version?.trim() ?? 'WebGL unavailable';
  const renderer = source.renderer?.trim() ?? 'renderer unknown';
  const vendor = source.vendor?.trim() ?? 'vendor unknown';
  const normalized = `${vendor} ${renderer}`.toLowerCase();

  if (
    normalized.includes('swiftshader') ||
    normalized.includes('llvmpipe') ||
    normalized.includes('software') ||
    normalized.includes('softpipe')
  ) {
    return {
      mode: 'software-fallback',
      summary: `${version} | software fallback | ${renderer}`,
    };
  }

  if (!source.version) {
    return {
      mode: 'unavailable',
      summary: 'WebGL unavailable',
    };
  }

  return {
    mode: 'hardware-accelerated',
    summary: `${version} | hardware accelerated | ${renderer}`,
  };
}
