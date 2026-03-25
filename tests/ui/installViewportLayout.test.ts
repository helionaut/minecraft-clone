// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { installViewportLayout } from '../../src/ui/installViewportLayout.ts';

type ListenerMap = Map<string, EventListener[]>;

function createViewportMock(width: number, height: number, offsetTop: number, offsetLeft: number) {
  const listeners: ListenerMap = new Map();

  return {
    listeners,
    viewport: {
      width,
      height,
      offsetTop,
      offsetLeft,
      addEventListener(type: string, listener: EventListener) {
        const bucket = listeners.get(type) ?? [];
        bucket.push(listener);
        listeners.set(type, bucket);
      },
      removeEventListener(type: string, listener: EventListener) {
        const bucket = listeners.get(type) ?? [];
        listeners.set(type, bucket.filter((entry) => entry !== listener));
      },
    },
  };
}

describe('installViewportLayout', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
    vi.restoreAllMocks();
  });

  it('syncs visible viewport dimensions and browser chrome offsets into CSS variables', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });

    const { viewport, listeners } = createViewportMock(390, 744, 32, 0);

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    });

    const dispose = installViewportLayout();

    expect(document.documentElement.style.getPropertyValue('--app-width')).toBe('390px');
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('744px');
    expect(document.documentElement.style.getPropertyValue('--browser-ui-top')).toBe('32px');
    expect(document.documentElement.style.getPropertyValue('--browser-ui-bottom')).toBe('68px');
    expect(listeners.get('resize')).toHaveLength(1);
    expect(listeners.get('scroll')).toHaveLength(1);

    viewport.height = 700;
    viewport.offsetTop = 20;

    for (const listener of listeners.get('resize') ?? []) {
      listener(new Event('resize'));
    }

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('700px');
    expect(document.documentElement.style.getPropertyValue('--browser-ui-top')).toBe('20px');
    expect(document.documentElement.style.getPropertyValue('--browser-ui-bottom')).toBe('124px');

    dispose();

    expect(listeners.get('resize')).toHaveLength(0);
    expect(listeners.get('scroll')).toHaveLength(0);
  });

  it('falls back to the window size when visualViewport is unavailable', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: undefined,
    });

    installViewportLayout();

    expect(document.documentElement.style.getPropertyValue('--app-width')).toBe('1280px');
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('720px');
    expect(document.documentElement.style.getPropertyValue('--browser-ui-bottom')).toBe('0px');
  });
});
