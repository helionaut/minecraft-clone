// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SandboxStatus } from '../../src/rendering/scene.ts';
import { createAppShell } from '../../src/ui/createAppShell.ts';

type StatusListener = (status: SandboxStatus) => void;

const sandboxStub = {
  setSelectedBlock: vi.fn(),
  craftRecipe: vi.fn(),
  placeSelectedBlockOnNearestSurface: vi.fn(),
  getBlockAt: vi.fn(),
  getStatusSnapshot: vi.fn(),
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
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
    statusListener = null;
    sandboxStub.setSelectedBlock.mockReset();
    sandboxStub.craftRecipe.mockReset();
    sandboxStub.placeSelectedBlockOnNearestSurface.mockReset();
    sandboxStub.getBlockAt.mockReset();
    sandboxStub.getStatusSnapshot.mockReset();
    sandboxStub.resetWorld.mockReset();
    sandboxStub.dispose.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a Minecraft-style inventory window with storage grid, hotbar row, and recipe book', () => {
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
      activeItem: 'grass',
      selectedBlock: 'grass',
      coords: 'X 4.0 Y 10.0 Z -2.0',
      target: 'Target grass @ 4, 8, -2 | Place grass @ 4, 9, -2',
      prompt: 'Use the left thumbstick to move, drag anywhere to aim, mine blocks for drops, and craft tools or stations from the drawer.',
      touchDevice: true,
      selectedTool: 'hand',
      stations: 'none nearby',
      renderer: 'WebGL 2 | software fallback | SwiftShader',
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

    expect(root.querySelector('.inventory-window')).not.toBeNull();
    expect(root.querySelector('.inventory-storage-grid')).not.toBeNull();
    expect(root.querySelector('.inventory-hotbar-grid')).not.toBeNull();
    expect(root.querySelector('.recipe-book')).not.toBeNull();
    expect(root.querySelector<HTMLElement>('[data-slot-index="0"] .item-icon')?.getAttribute('style')).toContain('/textures/inventory/oak-log.svg');
    expect(root.querySelector('.menu-modal')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.touch-ui')?.classList.contains('active')).toBe(true);
    expect(root.querySelector('[data-look-surface]')?.classList.contains('active')).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-open-menu]')?.click();

    expect(root.querySelector('.menu-modal')?.hasAttribute('hidden')).toBe(false);
    expect(root.classList.contains('menu-open')).toBe(true);
    expect(root.textContent).toContain('Inventory');
    expect(root.textContent).toContain('Recipe Book');
    expect(root.textContent).toContain('crafting table');
    expect(root.textContent).toContain('Oak Log');
    expect(root.textContent).toContain('Renderer: WebGL 2 | software fallback | SwiftShader');
    expect(root.querySelector('[data-slot-index="27"]')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[data-recipe-id="crafting-table"]')?.click();

    expect(sandboxStub.craftRecipe).toHaveBeenCalledWith('crafting-table');
  });

  it('updates hotbar selection and keeps reset inside the inventory overlay', () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    window.localStorage.setItem('minecraft-clone:inventory-layout:v1', JSON.stringify([
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      { type: 'stone', count: 5 },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]));

    createAppShell(root);

    if (!statusListener) {
      throw new Error('Expected scene status listener.');
    }

    statusListener({
      locked: true,
      activeItem: 'stone',
      selectedBlock: 'stone',
      coords: 'X 0.0 Y 5.0 Z 0.0',
      target: 'Aim at terrain',
      prompt: 'Click the viewport to capture the mouse and enter the world.',
      touchDevice: false,
      selectedTool: 'stone-pickaxe',
      stations: 'crafting-table',
      renderer: 'WebGL 2 | hardware accelerated | ANGLE (NVIDIA, NVIDIA GeForce RTX 3070, OpenGL 4.6)',
      inventory: [{ type: 'stone', count: 5 }, { type: 'stone-pickaxe', count: 1 }],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 5, cobblestone: 0, sand: 0, 'oak-log': 0, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    expect(root.querySelector<HTMLButtonElement>('[data-hud-hotbar-slot="0"]')?.dataset.itemType).toBe('stone');
    root.querySelector<HTMLButtonElement>('[data-hud-hotbar-slot="0"]')?.click();

    expect(sandboxStub.setSelectedBlock).toHaveBeenCalledWith('stone');

    root.querySelector<HTMLButtonElement>('[data-open-menu]')?.click();
    root.querySelector<HTMLButtonElement>('[data-reset]')?.click();

    expect(root.textContent).toContain('Best tool: stone-pickaxe');
    expect(root.textContent).toContain('Stations: crafting-table');
    expect(sandboxStub.resetWorld).toHaveBeenCalledTimes(1);
  });

  it('renders the main HUD hotbar from the real hotbar layout after moving a crafting table into it', () => {
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
      activeItem: 'crafting-table',
      selectedBlock: 'grass',
      coords: 'X 2.0 Y 8.0 Z 1.0',
      target: 'Aim at terrain',
      prompt: 'Click the viewport to capture the mouse and enter the world.',
      touchDevice: false,
      selectedTool: 'hand',
      stations: 'none nearby',
      renderer: 'WebGL 2 | hardware accelerated',
      inventory: [
        { type: 'crafting-table', count: 1 },
        { type: 'oak-log', count: 3 },
      ],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 0, sand: 0, 'oak-log': 3, 'oak-planks': 0, 'crafting-table': 1, furnace: 0 },
    });

    root.querySelector<HTMLButtonElement>('[data-open-menu]')?.click();

    const craftingTableSlot = root.querySelector<HTMLButtonElement>('[data-item-type="crafting-table"]');
    const emptyHotbarSlot = root.querySelector<HTMLButtonElement>('[data-slot-index="27"]');

    craftingTableSlot?.click();
    emptyHotbarSlot?.click();
    root.querySelector<HTMLButtonElement>('button[data-close-menu]')?.click();

    const hudHotbarSlot = root.querySelector<HTMLButtonElement>('[data-hud-hotbar-slot="0"]');
    expect(hudHotbarSlot?.dataset.itemType).toBe('crafting-table');
    expect(hudHotbarSlot?.classList.contains('active')).toBe(true);
    expect(hudHotbarSlot?.textContent).toContain('1');
  });

  it('supports selecting and moving inventory items between storage and hotbar slots', () => {
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
      activeItem: 'grass',
      selectedBlock: 'grass',
      coords: 'X 2.0 Y 8.0 Z 1.0',
      target: 'Aim at terrain',
      prompt: 'Click the viewport to capture the mouse and enter the world.',
      touchDevice: false,
      selectedTool: 'hand',
      stations: 'none nearby',
      renderer: 'WebGL 2 | hardware accelerated',
      inventory: [
        { type: 'oak-log', count: 3 },
        { type: 'cobblestone', count: 8 },
        { type: 'stone-pickaxe', count: 1 },
      ],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 8, sand: 0, 'oak-log': 3, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    const storageOakLogSlot = root.querySelector<HTMLButtonElement>('[data-slot-index="0"]');
    const emptyHotbarSlot = root.querySelector<HTMLButtonElement>('[data-slot-index="27"]');

    storageOakLogSlot?.click();
    expect(root.querySelector<HTMLButtonElement>('[data-slot-index="0"]')?.classList.contains('selected')).toBe(true);

    emptyHotbarSlot?.click();

    const movedHotbarSlot = root.querySelector<HTMLButtonElement>('[data-slot-index="27"]');
    expect(movedHotbarSlot?.dataset.itemType).toBe('oak-log');
    expect(movedHotbarSlot?.classList.contains('selected')).toBe(true);
    expect(sandboxStub.setSelectedBlock).toHaveBeenCalledWith('oak-log');

    statusListener({
      locked: false,
      activeItem: 'oak-log',
      selectedBlock: 'oak-log',
      coords: 'X 2.0 Y 8.0 Z 1.0',
      target: 'Aim at terrain',
      prompt: 'Click the viewport to capture the mouse and enter the world.',
      touchDevice: false,
      selectedTool: 'hand',
      stations: 'none nearby',
      renderer: 'WebGL 2 | hardware accelerated',
      inventory: [
        { type: 'oak-log', count: 5 },
        { type: 'cobblestone', count: 8 },
        { type: 'stone-pickaxe', count: 1 },
      ],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 8, sand: 0, 'oak-log': 5, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    const refreshedHotbarSlot = root.querySelector<HTMLButtonElement>('[data-slot-index="27"]');
    expect(refreshedHotbarSlot?.dataset.itemType).toBe('oak-log');
    expect(refreshedHotbarSlot?.textContent).toContain('5');
    expect(refreshedHotbarSlot?.classList.contains('active')).toBe(true);
  });

  it('lets tool hotbar slots become active without treating them as placeable blocks', () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    window.localStorage.setItem('minecraft-clone:inventory-layout:v1', JSON.stringify([
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      { type: 'stone-pickaxe', count: 1 },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]));

    createAppShell(root);

    if (!statusListener) {
      throw new Error('Expected scene status listener.');
    }

    statusListener({
      locked: false,
      activeItem: 'grass',
      selectedBlock: 'grass',
      coords: 'X 2.0 Y 8.0 Z 1.0',
      target: 'Aim at terrain',
      prompt: 'Click the viewport to capture the mouse and enter the world.',
      touchDevice: false,
      selectedTool: 'stone-pickaxe',
      stations: 'none nearby',
      renderer: 'WebGL 2 | hardware accelerated',
      inventory: [
        { type: 'stone-pickaxe', count: 1 },
      ],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 0, sand: 0, 'oak-log': 0, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    root.querySelector<HTMLButtonElement>('[data-hud-hotbar-slot="0"]')?.click();

    expect(root.querySelector<HTMLButtonElement>('[data-hud-hotbar-slot="0"]')?.classList.contains('active')).toBe(true);
    expect(sandboxStub.setSelectedBlock).not.toHaveBeenCalled();
  });

  it('auto-collapses touch help while keeping a reopen control available on mobile', () => {
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
      activeItem: 'grass',
      selectedBlock: 'grass',
      coords: 'X 4.0 Y 10.0 Z -2.0',
      target: 'Target grass @ 4, 8, -2 | Place grass @ 4, 9, -2',
      prompt: 'Use the left thumbstick to move, drag anywhere to aim, mine blocks for drops, and craft tools or stations from the drawer.',
      touchDevice: true,
      selectedTool: 'hand',
      stations: 'none nearby',
      renderer: 'WebGL 2 | software fallback | SwiftShader',
      inventory: [],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 0, sand: 0, 'oak-log': 0, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    const hudStatus = root.querySelector<HTMLElement>('[data-hud-status]');
    const openHelpButton = root.querySelector<HTMLButtonElement>('[data-open-help]');
    const dismissHelpButton = root.querySelector<HTMLButtonElement>('[data-dismiss-help]');

    expect(hudStatus?.hidden).toBe(false);
    expect(openHelpButton?.hidden).toBe(true);
    expect(dismissHelpButton?.hidden).toBe(false);

    vi.advanceTimersByTime(2400);

    expect(hudStatus?.hidden).toBe(true);
    expect(openHelpButton?.hidden).toBe(false);
    expect(dismissHelpButton?.hidden).toBe(true);

    openHelpButton?.click();
    expect(hudStatus?.hidden).toBe(false);
    expect(openHelpButton?.hidden).toBe(true);
    expect(dismissHelpButton?.hidden).toBe(false);

    dismissHelpButton?.click();
    expect(hudStatus?.hidden).toBe(true);
    expect(openHelpButton?.hidden).toBe(false);
  });
});
