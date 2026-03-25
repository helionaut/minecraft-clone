// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SandboxStatus } from '../../src/rendering/scene.ts';
import { createAppShell } from '../../src/ui/createAppShell.ts';

type StatusListener = (status: SandboxStatus) => void;

const sandboxStub = {
  setSelectedBlock: vi.fn(),
  craftRecipe: vi.fn(),
  resetWorld: vi.fn(),
  dispose: vi.fn(),
};

let statusListener: StatusListener | null = null;

vi.mock('../../src/rendering/scene.ts', () => ({
  createPlayableScene: vi.fn((_container: HTMLElement, onStatusChange: StatusListener) => {
    statusListener = onStatusChange;
    return sandboxStub;
  }),
}));

describe('createAppShell', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    statusListener = null;
    sandboxStub.setSelectedBlock.mockReset();
    sandboxStub.craftRecipe.mockReset();
    sandboxStub.resetWorld.mockReset();
    sandboxStub.dispose.mockReset();
  });

  it('keeps gameplay HUD minimal and opens inventory/crafting as a modal menu', () => {
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
      target: 'Target grass @ 4, 8, -2 | Place grass @ 4, 9, -2',
      prompt: 'Use the left thumbstick to move, drag anywhere to aim, mine blocks for drops, and craft tools or stations from the drawer.',
      touchDevice: true,
      selectedTool: 'hand',
      stations: 'none nearby',
      inventory: [{ type: 'oak-log', count: 3 }, { type: 'cobblestone', count: 8 }],
      recipes: [{
        id: 'crafting-table',
        label: 'crafting table',
        station: null,
        available: true,
        inputs: [{ type: 'oak-planks', count: 4 }],
        outputs: [{ type: 'crafting-table', count: 1 }],
      }],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 8, sand: 0, 'oak-log': 3, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    expect(root.querySelector('.inventory-grid')).not.toBeNull();
    expect(root.querySelector('.crafting-grid')).not.toBeNull();
    expect(root.querySelector('.menu-modal')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.touch-ui')?.classList.contains('active')).toBe(true);
    expect(root.querySelector('[data-look-surface]')?.classList.contains('active')).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-open-menu]')?.click();

    expect(root.querySelector('.menu-modal')?.hasAttribute('hidden')).toBe(false);
    expect(root.classList.contains('menu-open')).toBe(true);
    expect(root.querySelector('[data-menu-view="crafting"]')?.classList.contains('active')).toBe(true);
    expect(root.textContent).toContain('crafting table');
    expect(root.textContent).toContain('oak log');

    root.querySelector<HTMLButtonElement>('[data-recipe-id="crafting-table"]')?.click();

    expect(sandboxStub.craftRecipe).toHaveBeenCalledWith('crafting-table');
  });

  it('updates hotbar selection and keeps reset inside the world tab menu', () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    createAppShell(root);

    if (!statusListener) {
      throw new Error('Expected scene status listener.');
    }

    statusListener({
      locked: true,
      selectedBlock: 'stone',
      coords: 'X 0.0 Y 5.0 Z 0.0',
      target: 'Aim at terrain',
      prompt: 'Click the viewport to capture the mouse and enter the world.',
      touchDevice: false,
      selectedTool: 'stone-pickaxe',
      stations: 'crafting-table',
      inventory: [{ type: 'stone-pickaxe', count: 1 }],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 5, cobblestone: 0, sand: 0, 'oak-log': 0, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    root.querySelector<HTMLButtonElement>('[data-block-type="stone"]')?.click();

    expect(sandboxStub.setSelectedBlock).toHaveBeenCalledWith('stone');

    root.querySelector<HTMLButtonElement>('[data-open-menu]')?.click();
    root.querySelector<HTMLButtonElement>('[data-menu-tab="world"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-reset]')?.click();

    expect(root.querySelector('[data-menu-view="world"]')?.classList.contains('active')).toBe(true);
    expect(sandboxStub.resetWorld).toHaveBeenCalledTimes(1);
  });
});
