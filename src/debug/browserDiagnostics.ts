export interface NumericSummary {
  readonly count: number;
  readonly min: number | null;
  readonly max: number | null;
  readonly average: number | null;
  readonly p95: number | null;
}

export interface BrowserConsoleEntry {
  readonly timestamp: string;
  readonly level: 'warn' | 'error';
  readonly source: 'console' | 'window-error' | 'unhandledrejection';
  readonly message: string;
}

export interface BrowserLongTaskEntry {
  readonly timestamp: string;
  readonly name: string;
  readonly durationMs: number;
  readonly startTimeMs: number;
}

export interface BrowserEnvironmentSnapshot {
  readonly userAgent: string;
  readonly href: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly pixelRatio: number;
  };
  readonly memory: {
    readonly usedJsHeapSize: number;
    readonly totalJsHeapSize: number;
    readonly jsHeapSizeLimit: number;
  } | null;
}

export interface BrowserDiagnosticsSnapshot {
  readonly environment: BrowserEnvironmentSnapshot;
  readonly recentConsole: readonly BrowserConsoleEntry[];
  readonly longTasks: readonly BrowserLongTaskEntry[];
}

export interface BrowserDiagnosticsMonitor {
  readonly captureSnapshot: () => BrowserDiagnosticsSnapshot;
  readonly dispose: () => void;
}

const DEFAULT_EVENT_LIMIT = 25;

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function pushLimited<T>(buffer: T[], entry: T, limit: number): void {
  buffer.push(entry);

  if (buffer.length > limit) {
    buffer.splice(0, buffer.length - limit);
  }
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function captureEnvironment(windowLike: Window & typeof globalThis): BrowserEnvironmentSnapshot {
  const performanceMemory = (
    'memory' in windowLike.performance
      ? (windowLike.performance as Performance & {
        readonly memory?: {
          readonly usedJSHeapSize?: number;
          readonly totalJSHeapSize?: number;
          readonly jsHeapSizeLimit?: number;
        };
      }).memory
      : undefined
  );

  return {
    userAgent: windowLike.navigator.userAgent,
    href: windowLike.location.href,
    viewport: {
      width: windowLike.innerWidth,
      height: windowLike.innerHeight,
      pixelRatio: roundMetric(windowLike.devicePixelRatio || 1),
    },
    memory: performanceMemory &&
      typeof performanceMemory.usedJSHeapSize === 'number' &&
      typeof performanceMemory.totalJSHeapSize === 'number' &&
      typeof performanceMemory.jsHeapSizeLimit === 'number'
      ? {
        usedJsHeapSize: performanceMemory.usedJSHeapSize,
        totalJsHeapSize: performanceMemory.totalJSHeapSize,
        jsHeapSizeLimit: performanceMemory.jsHeapSizeLimit,
      }
      : null,
  };
}

export function summarizeSamples(samples: readonly number[]): NumericSummary {
  if (samples.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      average: null,
      p95: null,
    };
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

  return {
    count: sorted.length,
    min: roundMetric(sorted[0]),
    max: roundMetric(sorted[sorted.length - 1]),
    average: roundMetric(total / sorted.length),
    p95: roundMetric(sorted[p95Index]),
  };
}

export function isDebugDiagnosticsEnabled(
  search: string,
  mode: string,
): boolean {
  const searchParams = new URLSearchParams(search);
  return mode === 'debug' || searchParams.has('debug') || searchParams.has('debugDiagnostics');
}

export function buildDiagnosticsDownloadName(capturedAt: string): string {
  const sanitizedTimestamp = capturedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-');

  return `minecraft-clone-diagnostics-${sanitizedTimestamp}.json`;
}

export function downloadDiagnosticsReport(
  report: unknown,
  documentLike: Document = document,
  urlApi: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL,
): string {
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const blob = new Blob([json], { type: 'application/json' });
  const objectUrl = urlApi.createObjectURL(blob);
  const link = documentLike.createElement('a');
  const capturedAt = typeof report === 'object' && report && 'capturedAt' in report
    ? String(report.capturedAt)
    : new Date().toISOString();

  link.href = objectUrl;
  link.download = buildDiagnosticsDownloadName(capturedAt);
  link.style.display = 'none';
  documentLike.body.append(link);
  link.click();
  link.remove();
  urlApi.revokeObjectURL(objectUrl);

  return link.download;
}

export function createBrowserDiagnosticsMonitor(
  windowLike: Window & typeof globalThis = window,
  eventLimit = DEFAULT_EVENT_LIMIT,
): BrowserDiagnosticsMonitor {
  const consoleEntries: BrowserConsoleEntry[] = [];
  const longTaskEntries: BrowserLongTaskEntry[] = [];
  const originalWarn = windowLike.console.warn.bind(windowLike.console);
  const originalError = windowLike.console.error.bind(windowLike.console);

  const recordConsoleEntry = (
    level: BrowserConsoleEntry['level'],
    source: BrowserConsoleEntry['source'],
    message: string,
  ) => {
    pushLimited(consoleEntries, {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
    }, eventLimit);
  };

  const onWindowError = (event: ErrorEvent) => {
    recordConsoleEntry(
      'error',
      'window-error',
      [
        event.message,
        event.filename ? `at ${event.filename}:${event.lineno}:${event.colno}` : null,
      ].filter((value): value is string => Boolean(value)).join(' '),
    );
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    recordConsoleEntry(
      'error',
      'unhandledrejection',
      stringifyValue(event.reason),
    );
  };

  windowLike.console.warn = (...args: unknown[]) => {
    recordConsoleEntry('warn', 'console', args.map(stringifyValue).join(' '));
    originalWarn(...args);
  };

  windowLike.console.error = (...args: unknown[]) => {
    recordConsoleEntry('error', 'console', args.map(stringifyValue).join(' '));
    originalError(...args);
  };

  windowLike.addEventListener('error', onWindowError);
  windowLike.addEventListener('unhandledrejection', onUnhandledRejection);

  let observer: PerformanceObserver | null = null;
  const PerformanceObserverCtor = windowLike.PerformanceObserver;
  const supportedEntryTypes = PerformanceObserverCtor?.supportedEntryTypes ?? [];

  if (PerformanceObserverCtor && supportedEntryTypes.includes('longtask')) {
    observer = new PerformanceObserverCtor((list: PerformanceObserverEntryList) => {
      for (const entry of list.getEntries()) {
        pushLimited(longTaskEntries, {
          timestamp: new Date().toISOString(),
          name: entry.name,
          durationMs: roundMetric(entry.duration),
          startTimeMs: roundMetric(entry.startTime),
        }, eventLimit);
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  }

  return {
    captureSnapshot: () => ({
      environment: captureEnvironment(windowLike),
      recentConsole: [...consoleEntries],
      longTasks: [...longTaskEntries],
    }),
    dispose: () => {
      observer?.disconnect();
      windowLike.console.warn = originalWarn;
      windowLike.console.error = originalError;
      windowLike.removeEventListener('error', onWindowError);
      windowLike.removeEventListener('unhandledrejection', onUnhandledRejection);
    },
  };
}
