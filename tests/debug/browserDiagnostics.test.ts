// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import {
  buildDiagnosticsDownloadName,
  createBrowserDiagnosticsMonitor,
  downloadDiagnosticsReport,
  isDebugDiagnosticsEnabled,
  summarizeSamples,
} from '../../src/debug/browserDiagnostics.ts';

describe('summarizeSamples', () => {
  it('returns rounded aggregate metrics for numeric samples', () => {
    expect(summarizeSamples([16.4, 20.1, 33.8, 55.4])).toEqual({
      count: 4,
      min: 16.4,
      max: 55.4,
      average: 31.42,
      p95: 55.4,
    });
  });
});

describe('isDebugDiagnosticsEnabled', () => {
  it('enables diagnostics for debug builds and query-flagged sessions', () => {
    expect(isDebugDiagnosticsEnabled('', 'debug')).toBe(true);
    expect(isDebugDiagnosticsEnabled('?debug=1', 'production')).toBe(true);
    expect(isDebugDiagnosticsEnabled('?debugDiagnostics=1', 'production')).toBe(true);
    expect(isDebugDiagnosticsEnabled('', 'production')).toBe(false);
  });
});

describe('downloadDiagnosticsReport', () => {
  it('creates a downloadable json artifact with a stable filename', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const filename = downloadDiagnosticsReport(
      { capturedAt: '2026-03-31T08:15:00.000Z', ok: true },
      document,
      { createObjectURL, revokeObjectURL },
    );

    expect(filename).toBe(buildDiagnosticsDownloadName('2026-03-31T08:15:00.000Z'));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

describe('createBrowserDiagnosticsMonitor', () => {
  it('captures recent console issues and browser-level failures', async () => {
    const monitor = createBrowserDiagnosticsMonitor(window, 5);

    console.warn('renderer fallback', { reason: 'swiftshader' });
    console.error('device lost');
    window.dispatchEvent(new ErrorEvent('error', {
      message: 'uncaught boom',
      filename: 'scene.ts',
      lineno: 42,
      colno: 7,
    }));
    const rejectionEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejectionEvent, 'reason', {
      configurable: true,
      value: new Error('late rejection'),
    });
    window.dispatchEvent(rejectionEvent);

    const snapshot = monitor.captureSnapshot();
    monitor.dispose();

    expect(snapshot.environment.href).toContain('http://localhost');
    expect(snapshot.recentConsole).toHaveLength(4);
    expect(snapshot.recentConsole.map((entry) => entry.source)).toEqual([
      'console',
      'console',
      'window-error',
      'unhandledrejection',
    ]);
    expect(snapshot.recentConsole[0]?.message).toContain('renderer fallback');
    expect(snapshot.recentConsole[3]?.message).toContain('late rejection');
    expect(snapshot.longTasks).toEqual([]);
  });
});
