// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SandboxStatus } from '../../src/rendering/scene.ts';
import { createAppShell } from '../../src/ui/createAppShell.ts';
import type { HotbarSelectionControls } from '../../src/rendering/scene.ts';

type StatusListener = (status: SandboxStatus) => void;

const sandboxStub = {
  setSelectedBlock: vi.fn(),
  craftRecipe: vi.fn(),
  profileChunkTraversal: vi.fn(),
  placeSelectedBlockOnNearestSurface: vi.fn(),
  getBlockAt: vi.fn(),
  getStatusSnapshot: vi.fn(),
  getDiagnosticsSnapshot: vi.fn(),
  resetWorld: vi.fn(),
  dispose: vi.fn(),
};

let statusListener: StatusListener | null = null;
let hotbarControls: HotbarSelectionControls | null = null;

vi.mock('../../src/rendering/scene.ts', () => ({
  createPlayableScene: vi.fn(async (
    _container: HTMLElement,
    onStatusChange: StatusListener,
    _touchControls: unknown,
    nextHotbarControls: HotbarSelectionControls,
  ) => {
    statusListener = onStatusChange;
    hotbarControls = nextHotbarControls;
    return sandboxStub;
  }),
}));

describe('createAppShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
    statusListener = null;
    hotbarControls = null;
    sandboxStub.setSelectedBlock.mockReset();
    sandboxStub.craftRecipe.mockReset();
    sandboxStub.profileChunkTraversal.mockReset();
    sandboxStub.placeSelectedBlockOnNearestSurface.mockReset();
    sandboxStub.getBlockAt.mockReset();
    sandboxStub.getStatusSnapshot.mockReset();
    sandboxStub.getDiagnosticsSnapshot.mockReset();
    sandboxStub.resetWorld.mockReset();
    sandboxStub.dispose.mockReset();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens a Minecraft-style inventory window with storage grid, hotbar row, and recipe book', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    await createAppShell(root);

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
      nearbyStations: [],
      renderer: 'WebGL 2 | software fallback | SwiftShader',
      inventory: [{ type: 'oak-log', count: 3 }, { type: 'cobblestone', count: 8 }],
      recipes: [
        {
          id: 'crafting-table',
          label: 'crafting table',
          station: null,
          available: true,
          inputs: [{ type: 'oak-planks', count: 4 }],
          outputs: [{ type: 'crafting-table', count: 1 }],
        },
        {
          id: 'wooden-pickaxe',
          label: 'wooden pickaxe',
          station: 'crafting table',
          available: false,
          inputs: [{ type: 'oak-planks', count: 3 }, { type: 'stick', count: 2 }],
          outputs: [{ type: 'wooden-pickaxe', count: 1 }],
        },
      ],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 8, sand: 0, 'oak-log': 3, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    expect(root.querySelector('.inventory-window')).not.toBeNull();
    expect(root.querySelector('.inventory-storage-grid')).not.toBeNull();
    expect(root.querySelector('.inventory-hotbar-grid')).not.toBeNull();
    expect(root.querySelector('.recipe-book')).not.toBeNull();
    expect(root.querySelector<HTMLElement>('[data-slot-index="27"] .item-icon')?.getAttribute('style')).toContain('/textures/inventory/oak-log.svg');
    expect(root.querySelector('.menu-modal')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.touch-ui')?.classList.contains('active')).toBe(true);
    expect(root.querySelector('[data-look-surface]')?.classList.contains('active')).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-open-menu]')?.click();

    expect(root.querySelector('.menu-modal')?.hasAttribute('hidden')).toBe(false);
    expect(root.classList.contains('menu-open')).toBe(true);
    expect(root.textContent).toContain('Inventory');
    expect(root.textContent).toContain('Recipe Book');
    expect(root.textContent).toContain('How crafting works');
    expect(root.textContent).toContain('Craft the table');
    expect(root.textContent).toContain('Use the crafting table recipe button in the Recipe Book.');
    expect(root.textContent).toContain('crafting table');
    expect(root.textContent).toContain('Place crafting table nearby to unlock this recipe');
    expect(root.textContent).toContain('Oak Log');
    expect(root.textContent).toContain('Renderer: WebGL 2 | software fallback | SwiftShader');
    expect(root.querySelector<HTMLButtonElement>('[data-slot-index="27"]')?.dataset.itemType).toBe('oak-log');

    root.querySelector<HTMLButtonElement>('[data-recipe-id="crafting-table"]')?.click();

    expect(sandboxStub.craftRecipe).toHaveBeenCalledWith('crafting-table');
  });

  it('updates hotbar selection and keeps reset inside the inventory overlay', async () => {
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

    await createAppShell(root);

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
      nearbyStations: ['crafting table'],
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

  it('shows diagnostics download controls in debug mode and exports a report', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    window.history.replaceState({}, '', '/?debug=1');
    const createObjectURL = vi.fn(() => 'blob:diagnostics');
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL,
      revokeObjectURL,
    }));
    sandboxStub.getDiagnosticsSnapshot.mockReturnValue({
      capturedAt: '2026-03-31T08:15:00.000Z',
      renderer: { summary: 'WebGL 2', backend: 'webgl' },
    });

    await createAppShell(root);

    const downloadButton = root.querySelector<HTMLButtonElement>('[data-download-diagnostics]');
    expect(downloadButton).not.toBeNull();
    expect(root.textContent).toContain('Debug build hotkey: Alt+Shift+D');

    downloadButton?.click();

    expect(sandboxStub.getDiagnosticsSnapshot).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagnostics');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('exposes chunk traversal profiling through the QA harness', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    sandboxStub.profileChunkTraversal.mockResolvedValue({
      capturedAt: '2026-04-01T00:00:00.000Z',
      options: {
        chunkRadius: 2,
        samplesPerChunk: 3,
        clearanceAboveTerrain: 2.2,
        cameraPitch: -0.26,
      },
      route: [],
      summary: {
        sampledFrames: 0,
        frameTimingMs: { count: 0, min: null, max: null, average: null, p95: null },
        chunkLoadTimingMs: { count: 0, min: null, max: null, average: null, p95: null },
        rebuildTimingMs: { count: 0, min: null, max: null, average: null, p95: null },
        averageFps: null,
        maxLoadedChunkCount: 0,
        maxWorldMeshCount: 0,
      },
      samples: [],
    });
    window.history.replaceState({}, '', '/?qaHarness=1');

    await createAppShell(root);

    const result = await window.__minecraftCloneQa?.profileChunkTraversal?.({
      chunkRadius: 2,
    });

    expect(sandboxStub.profileChunkTraversal).toHaveBeenCalledWith({
      chunkRadius: 2,
    });
    expect(result?.options.chunkRadius).toBe(2);
  });

  it('renders the main HUD hotbar from the real hotbar layout after moving a crafting table into it', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    await createAppShell(root);

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
      nearbyStations: [],
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

  it('raises the hotbar on touch layouts when the center gap is too narrow for the controls and hotbar to share the bottom band', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: undefined,
    });

    await createAppShell(root);

    const hotbarShell = root.querySelector<HTMLElement>('.hotbar-shell');
    const moveCluster = root.querySelector<HTMLElement>('.touch-move');
    const actionsPanel = root.querySelector<HTMLElement>('.touch-actions-panel');

    if (!statusListener || !hotbarShell || !moveCluster || !actionsPanel) {
      throw new Error('Expected touch HUD layout nodes and scene status listener.');
    }

    vi.spyOn(hotbarShell, 'getBoundingClientRect').mockReturnValue({
      x: 40,
      y: 492,
      width: 320,
      height: 48,
      top: 492,
      right: 360,
      bottom: 540,
      left: 40,
      toJSON: () => ({}),
    });
    vi.spyOn(moveCluster, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 500,
      width: 120,
      height: 120,
      top: 500,
      right: 120,
      bottom: 620,
      left: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(actionsPanel, 'getBoundingClientRect').mockReturnValue({
      x: 250,
      y: 500,
      width: 120,
      height: 120,
      top: 500,
      right: 370,
      bottom: 620,
      left: 250,
      toJSON: () => ({}),
    });

    statusListener({
      locked: false,
      activeItem: 'grass',
      selectedBlock: 'grass',
      coords: 'X 4.0 Y 10.0 Z -2.0',
      target: 'Aim at terrain',
      prompt: 'Use touch controls.',
      touchDevice: true,
      selectedTool: 'hand',
      stations: 'none nearby',
      nearbyStations: [],
      renderer: 'WebGL 2 | software fallback | SwiftShader',
      inventory: [{ type: 'oak-log', count: 3 }, { type: 'cobblestone', count: 8 }],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 8, sand: 0, 'oak-log': 3, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    expect(root.style.getPropertyValue('--hotbar-raise-offset')).toBe('64px');
  });

  it('keeps the hotbar at its baseline position when touch controls leave enough center gap', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: undefined,
    });

    await createAppShell(root);

    const hotbarShell = root.querySelector<HTMLElement>('.hotbar-shell');
    const moveCluster = root.querySelector<HTMLElement>('.touch-move');
    const actionsPanel = root.querySelector<HTMLElement>('.touch-actions-panel');

    if (!statusListener || !hotbarShell || !moveCluster || !actionsPanel) {
      throw new Error('Expected touch HUD layout nodes and scene status listener.');
    }

    vi.spyOn(hotbarShell, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 492,
      width: 160,
      height: 48,
      top: 492,
      right: 260,
      bottom: 540,
      left: 100,
      toJSON: () => ({}),
    });
    vi.spyOn(moveCluster, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 500,
      width: 120,
      height: 120,
      top: 500,
      right: 120,
      bottom: 620,
      left: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(actionsPanel, 'getBoundingClientRect').mockReturnValue({
      x: 300,
      y: 500,
      width: 120,
      height: 120,
      top: 500,
      right: 420,
      bottom: 620,
      left: 300,
      toJSON: () => ({}),
    });

    statusListener({
      locked: false,
      activeItem: 'grass',
      selectedBlock: 'grass',
      coords: 'X 4.0 Y 10.0 Z -2.0',
      target: 'Aim at terrain',
      prompt: 'Use touch controls.',
      touchDevice: true,
      selectedTool: 'hand',
      stations: 'none nearby',
      nearbyStations: [],
      renderer: 'WebGL 2 | software fallback | SwiftShader',
      inventory: [{ type: 'oak-log', count: 3 }, { type: 'cobblestone', count: 8 }],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 8, sand: 0, 'oak-log': 3, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    expect(root.style.getPropertyValue('--hotbar-raise-offset')).toBe('');
  });

  it('supports selecting and moving inventory items between storage and hotbar slots', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    window.localStorage.setItem('minecraft-clone:inventory-layout:v1', JSON.stringify([
      { type: 'oak-log', count: 3 },
      { type: 'cobblestone', count: 8 },
      { type: 'stone-pickaxe', count: 1 },
      null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
    ]));

    await createAppShell(root);

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
      nearbyStations: [],
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
    expect(movedHotbarSlot?.classList.contains('selected')).toBe(false);
    expect(sandboxStub.setSelectedBlock).toHaveBeenCalledWith('oak-log');

    const storageCobblestoneSlot = root.querySelector<HTMLButtonElement>('[data-slot-index="1"]');
    storageCobblestoneSlot?.click();

    expect(root.querySelector<HTMLButtonElement>('[data-slot-index="1"]')?.classList.contains('selected')).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-slot-index="27"]')?.dataset.itemType).toBe('oak-log');

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
      nearbyStations: [],
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

  it('auto-populates the hotbar with visible inventory items when no hotbar layout is saved yet', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    await createAppShell(root);

    if (!statusListener) {
      throw new Error('Expected scene status listener.');
    }

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
      nearbyStations: [],
      renderer: 'WebGL 2 | hardware accelerated',
      inventory: [
        { type: 'oak-log', count: 3 },
        { type: 'cobblestone', count: 8 },
        { type: 'stone-pickaxe', count: 1 },
      ],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 8, sand: 0, 'oak-log': 3, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    expect(root.querySelector<HTMLButtonElement>('[data-slot-index="27"]')?.dataset.itemType).toBe('oak-log');
    expect(root.querySelector<HTMLButtonElement>('[data-slot-index="28"]')?.dataset.itemType).toBe('cobblestone');
    expect(root.querySelector<HTMLButtonElement>('[data-slot-index="29"]')?.dataset.itemType).toBe('stone-pickaxe');
    expect(root.querySelector<HTMLButtonElement>('[data-hud-hotbar-slot="0"]')?.dataset.itemType).toBe('oak-log');
    expect(root.querySelector<HTMLButtonElement>('[data-hud-hotbar-slot="0"]')?.classList.contains('active')).toBe(true);
  });

  it('lets tool hotbar slots become active without treating them as placeable blocks', async () => {
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

    await createAppShell(root);

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
      nearbyStations: [],
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

  it('keeps the selected hotbar slot highlighted after closing inventory, even when that slot is empty', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    window.localStorage.setItem('minecraft-clone:inventory-layout:v1', JSON.stringify([
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      { type: 'oak-log', count: 5 },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]));

    await createAppShell(root);

    if (!statusListener || !hotbarControls) {
      throw new Error('Expected scene status listener and hotbar controls.');
    }

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
      nearbyStations: [],
      renderer: 'WebGL 2 | hardware accelerated',
      inventory: [
        { type: 'oak-log', count: 5 },
      ],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 0, sand: 0, 'oak-log': 5, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    root.querySelector<HTMLButtonElement>('[data-open-menu]')?.click();
    root.querySelector<HTMLButtonElement>('[data-slot-index="28"]')?.click();
    root.querySelector<HTMLButtonElement>('button[data-close-menu]')?.click();

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
      nearbyStations: [],
      renderer: 'WebGL 2 | hardware accelerated',
      inventory: [
        { type: 'oak-log', count: 5 },
      ],
      recipes: [],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 0, sand: 0, 'oak-log': 5, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    const selectedHudSlot = root.querySelector<HTMLButtonElement>('[data-hud-hotbar-slot="1"]');

    expect(hotbarControls.getSelectedHotbarSlotIndex()).toBe(1);
    expect(selectedHudSlot?.classList.contains('active')).toBe(true);
    expect(selectedHudSlot?.dataset.itemType).toBeUndefined();
    expect(sandboxStub.setSelectedBlock).not.toHaveBeenCalled();
  });

  it('auto-collapses touch help while keeping a reopen control available on mobile', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    await createAppShell(root);

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
      nearbyStations: [],
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

  it('walks the player from crafted table to placed table with explicit onboarding copy', async () => {
    const root = document.querySelector<HTMLDivElement>('#app');

    if (!root) {
      throw new Error('Expected #app test root.');
    }

    window.localStorage.setItem('minecraft-clone:inventory-layout:v1', JSON.stringify([
      { type: 'crafting-table', count: 1 },
      null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
    ]));

    await createAppShell(root);

    if (!statusListener) {
      throw new Error('Expected scene status listener.');
    }

    root.querySelector<HTMLButtonElement>('[data-open-menu]')?.click();

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
      nearbyStations: [],
      renderer: 'WebGL 2 | hardware accelerated',
      inventory: [
        { type: 'crafting-table', count: 1 },
      ],
      recipes: [
        {
          id: 'wooden-pickaxe',
          label: 'wooden pickaxe',
          station: 'crafting table',
          available: false,
          inputs: [{ type: 'oak-planks', count: 3 }, { type: 'stick', count: 2 }],
          outputs: [{ type: 'wooden-pickaxe', count: 1 }],
        },
      ],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 0, sand: 0, 'oak-log': 0, 'oak-planks': 0, 'crafting-table': 1, furnace: 0 },
    });

    expect(root.textContent).toContain('Move table to hotbar');

    root.querySelector<HTMLButtonElement>('[data-slot-index="0"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-slot-index="27"]')?.click();

    expect(root.textContent).toContain('Place the table nearby');
    expect(root.textContent).toContain('Reopen the inventory after placing it.');

    statusListener({
      locked: false,
      activeItem: 'crafting-table',
      selectedBlock: 'crafting-table',
      coords: 'X 2.0 Y 8.0 Z 1.0',
      target: 'Aim at terrain',
      prompt: 'Click the viewport to capture the mouse and enter the world.',
      touchDevice: false,
      selectedTool: 'hand',
      stations: 'crafting-table',
      nearbyStations: ['crafting table'],
      renderer: 'WebGL 2 | hardware accelerated',
      inventory: [],
      recipes: [
        {
          id: 'wooden-pickaxe',
          label: 'wooden pickaxe',
          station: 'crafting table',
          available: true,
          inputs: [{ type: 'oak-planks', count: 3 }, { type: 'stick', count: 2 }],
          outputs: [{ type: 'wooden-pickaxe', count: 1 }],
        },
      ],
      placeableCounts: { grass: 0, dirt: 0, stone: 0, cobblestone: 0, sand: 0, 'oak-log': 0, 'oak-planks': 0, 'crafting-table': 0, furnace: 0 },
    });

    expect(root.textContent).toContain('Crafting table active');
    expect(root.textContent).toContain('Tool and station recipes are unlocked while you stay near the placed crafting table.');
    expect(root.textContent).toContain('Ready at nearby crafting table');
  });
});
