// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SandboxStatus } from '../../src/rendering/scene.ts';
import { createAppShell } from '../../src/ui/createAppShell.ts';

type StatusListener = (status: SandboxStatus) => void;

const sandboxStub = {
  setSelectedBlock: vi.fn(),
  resetWorld: vi.fn(),
  dispose: vi.fn(),
};

let statusListener: StatusListener | null = null;
let viewportWidth = 390;
const mediaQueryListeners = new Set<() => void>();

vi.mock('../../src/rendering/scene.ts', () => ({
  createPlayableScene: vi.fn((_container: HTMLElement, onStatusChange: StatusListener) => {
    statusListener = onStatusChange;
    return sandboxStub;
  }),
}));

function installMatchMediaMock(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => {
      const mediaQuery = {
        media: query,
        onchange: null,
        get matches() {
          return query === '(max-width: 700px)' ? viewportWidth <= 700 : false;
        },
        addEventListener: (_event: string, listener: () => void) => {
          mediaQueryListeners.add(listener);
        },
        removeEventListener: (_event: string, listener: () => void) => {
          mediaQueryListeners.delete(listener);
        },
        dispatchEvent: () => true,
        addListener: (listener: () => void) => {
          mediaQueryListeners.add(listener);
        },
        removeListener: (listener: () => void) => {
          mediaQueryListeners.delete(listener);
        },
      };

      return mediaQuery;
    },
  });
}

function emitViewportChange(width: number): void {
  viewportWidth = width;

  for (const listener of mediaQueryListeners) {
    listener();
  }
}

describe('createAppShell', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    statusListener = null;
    viewportWidth = 390;
    mediaQueryListeners.clear();
    installMatchMediaMock();
    sandboxStub.setSelectedBlock.mockReset();
    sandboxStub.resetWorld.mockReset();
    sandboxStub.dispose.mockReset();
  });

  it('collapses secondary HUD panels into a compact drawer on narrow touch screens', () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    createAppShell(root);

    if (!statusListener) {
      throw new Error('Expected scene status listener.');
    }

    statusListener({
      locked: false,
      selectedBlock: 'grass',
      coords: 'X 4.0 Y 10.0 Z -2.0',
      target: 'Aim at a nearby block to mine or place.',
      prompt: 'Use the left stick to move, drag the look pad to aim, tap Jump to hop, and use Mine or Place on the targeted block.',
      touchDevice: true,
    });

    const hud = root.querySelector<HTMLElement>('.hud');
    const drawer = root.querySelector<HTMLDetailsElement>('[data-hud-drawer]');
    const mobileStatus = root.querySelector<HTMLElement>('[data-mobile-status]');
    const mobileCoords = root.querySelector<HTMLElement>('[data-mobile-coords]');

    expect(hud?.classList.contains('compact-touch-hud')).toBe(true);
    expect(drawer?.open).toBe(false);
    expect(mobileStatus?.textContent).toContain('Mine or Place');
    expect(mobileCoords?.textContent).toBe('X 4.0 Y 10.0 Z -2.0');

    emitViewportChange(900);

    expect(hud?.classList.contains('compact-touch-hud')).toBe(false);
    expect(drawer?.open).toBe(true);
  });
});
