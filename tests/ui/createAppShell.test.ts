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
let viewportHeight = 844;
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
          if (query === '(max-width: 700px)') {
            return viewportWidth <= 700;
          }

          if (query === '(max-height: 560px)') {
            return viewportHeight <= 560;
          }

          return false;
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

function emitViewportChange(width: number, height = viewportHeight): void {
  viewportWidth = width;
  viewportHeight = height;

  for (const listener of mediaQueryListeners) {
    listener();
  }
}

describe('createAppShell', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    statusListener = null;
    viewportWidth = 390;
    viewportHeight = 844;
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
    const lookSurface = root.querySelector<HTMLElement>('[data-look-surface]');

    expect(hud?.classList.contains('compact-touch-hud')).toBe(true);
    expect(drawer?.open).toBe(false);
    expect(mobileStatus?.textContent).toContain('drag anywhere');
    expect(mobileCoords?.textContent).toBe('X 4.0 Y 10.0 Z -2.0');
    expect(lookSurface?.classList.contains('active')).toBe(true);

    emitViewportChange(900);

    expect(hud?.classList.contains('compact-touch-hud')).toBe(false);
    expect(drawer?.open).toBe(true);
  });

  it('switches into the compact HUD in mobile landscape even when width is large', () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    createAppShell(root);

    if (!statusListener) {
      throw new Error('Expected scene status listener.');
    }

    emitViewportChange(932, 430);
    statusListener({
      locked: false,
      selectedBlock: 'grass',
      coords: 'X 0.0 Y 5.0 Z 0.0',
      target: 'Aim at a nearby block to mine or place.',
      prompt: 'Use the left stick to move, drag anywhere to aim, tap Jump to swim upward, and use Mine or Place on the targeted block.',
      touchDevice: true,
    });

    const hud = root.querySelector<HTMLElement>('.hud');
    const drawer = root.querySelector<HTMLDetailsElement>('[data-hud-drawer]');

    expect(hud?.classList.contains('compact-touch-hud')).toBe(true);
    expect(drawer?.open).toBe(false);
  });
});
