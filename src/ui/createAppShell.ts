import {
  type HotbarBlockType,
  PLACEABLE_BLOCK_ORDER,
  type PlaceableBlockType,
} from '../gameplay/blocks.ts';
import type { InventoryItemType } from '../gameplay/progression.ts';
import {
  createPlayableScene,
  type InventoryStatusEntry,
  type RecipeStatusEntry,
  type SandboxStatus,
  type TouchUiControls,
} from '../rendering/scene.ts';
import { getInventoryIcon } from './inventoryIcons.ts';

declare global {
  interface Window {
    __minecraftCloneQa?: {
      readonly craftRecipe: (recipeId: string) => void;
      readonly setSelectedBlock: (type: HotbarBlockType) => void;
      readonly placeSelectedBlockOnNearestSurface: () => {
        readonly placed: boolean;
        readonly position: { readonly x: number; readonly y: number; readonly z: number } | null;
      };
      readonly getBlockAt: (x: number, y: number, z: number) => string | null;
      readonly getStatus: () => SandboxStatus | null;
      readonly moveInventorySlot: (fromIndex: number, toIndex: number) => void;
      readonly setMenuOpen: (open: boolean) => void;
    };
  }
}

const BLOCK_ORDER: readonly PlaceableBlockType[] = PLACEABLE_BLOCK_ORDER;
const STORAGE_SLOT_COUNT = 27;
const HOTBAR_SLOT_COUNT = 9;
const TOTAL_INVENTORY_SLOT_COUNT = STORAGE_SLOT_COUNT + HOTBAR_SLOT_COUNT;
const INVENTORY_LAYOUT_STORAGE_KEY = 'minecraft-clone:inventory-layout:v1';

interface InventoryLayoutSlot {
  readonly type: InventoryItemType;
  readonly count: number;
}

function inventoryItemTypeFrom(value: string): InventoryItemType {
  return value as InventoryItemType;
}

function createItemIcon(type: InventoryItemType, count?: number): string {
  const icon = getInventoryIcon(type);

  return `
    <span
      class="item-icon item-icon-${type}"
      style="--item-icon-image: url('${icon.assetPath}');"
      aria-hidden="true"
    ></span>
    <span class="sr-only">${icon.label}</span>
    ${typeof count === 'number' ? `<span class="item-count">${count}</span>` : ''}
  `;
}

function isHotbarSelectableItem(type: InventoryItemType): type is HotbarBlockType {
  return BLOCK_ORDER.includes(type as HotbarBlockType);
}

function createEmptyInventoryLayout(): Array<InventoryLayoutSlot | null> {
  return Array.from({ length: TOTAL_INVENTORY_SLOT_COUNT }, () => null);
}

function loadInventoryLayout(): Array<InventoryLayoutSlot | null> {
  try {
    const rawValue = window.localStorage.getItem(INVENTORY_LAYOUT_STORAGE_KEY);

    if (!rawValue) {
      return createEmptyInventoryLayout();
    }

    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return createEmptyInventoryLayout();
    }

    return Array.from({ length: TOTAL_INVENTORY_SLOT_COUNT }, (_unused, index) => {
      const slot = parsed[index];

      if (
        !slot ||
        typeof slot !== 'object' ||
        typeof slot.type !== 'string' ||
        typeof slot.count !== 'number' ||
        slot.count <= 0
      ) {
        return null;
      }

      return {
        type: inventoryItemTypeFrom(slot.type),
        count: slot.count,
      };
    });
  } catch {
    return createEmptyInventoryLayout();
  }
}

function persistInventoryLayout(slots: readonly (InventoryLayoutSlot | null)[]): void {
  if (slots.every((slot) => slot === null)) {
    window.localStorage.removeItem(INVENTORY_LAYOUT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(INVENTORY_LAYOUT_STORAGE_KEY, JSON.stringify(slots));
}

function findNextOpenInventorySlot(slots: readonly (InventoryLayoutSlot | null)[]): number {
  for (let index = 0; index < STORAGE_SLOT_COUNT; index += 1) {
    if (!slots[index]) {
      return index;
    }
  }

  for (let index = STORAGE_SLOT_COUNT; index < TOTAL_INVENTORY_SLOT_COUNT; index += 1) {
    if (!slots[index]) {
      return index;
    }
  }

  return -1;
}

function reconcileInventoryLayout(
  currentSlots: readonly (InventoryLayoutSlot | null)[],
  entries: readonly InventoryStatusEntry[],
): Array<InventoryLayoutSlot | null> {
  const nextSlots = createEmptyInventoryLayout();
  const countsByType = new Map(entries.map((entry) => [entry.type, entry.count]));
  const assignedTypes = new Set<string>();

  for (let index = 0; index < TOTAL_INVENTORY_SLOT_COUNT; index += 1) {
    const slot = currentSlots[index];

    if (!slot || assignedTypes.has(slot.type)) {
      continue;
    }

    const count = countsByType.get(slot.type);

    if (!count || count <= 0) {
      continue;
    }

    nextSlots[index] = {
      type: inventoryItemTypeFrom(slot.type),
      count,
    };
    assignedTypes.add(slot.type);
  }

  for (const entry of entries) {
    if (assignedTypes.has(entry.type)) {
      continue;
    }

    const nextIndex = findNextOpenInventorySlot(nextSlots);

    if (nextIndex === -1) {
      break;
    }

    nextSlots[nextIndex] = {
      type: inventoryItemTypeFrom(entry.type),
      count: entry.count,
    };
    assignedTypes.add(entry.type);
  }

  return nextSlots;
}

function renderInventorySlot(
  slot: InventoryLayoutSlot | null,
  slotIndex: number,
  options: {
    readonly selected: boolean;
    readonly active: boolean;
    readonly dragging: boolean;
  },
): string {
  if (!slot) {
    return `
      <button
        class="inventory-slot inventory-slot-button inventory-slot-empty"
        type="button"
        data-slot-index="${slotIndex}"
        aria-label="Empty inventory slot"
      ></button>
    `;
  }

  const icon = getInventoryIcon(slot.type);

  return `
    <button
      class="inventory-slot inventory-slot-button${options.selected ? ' selected' : ''}${options.active ? ' active' : ''}${options.dragging ? ' dragging' : ''}"
      type="button"
      data-slot-index="${slotIndex}"
      data-item-type="${slot.type}"
      aria-label="${icon.label} x${slot.count}"
      draggable="true"
    >
      ${createItemIcon(slot.type, slot.count)}
    </button>
  `;
}

function renderStorageSlots(
  slots: readonly (InventoryLayoutSlot | null)[],
  selectedSlotIndex: number | null,
  draggedSlotIndex: number | null,
): string {
  return slots.slice(0, STORAGE_SLOT_COUNT).map((slot, index) => {
    return renderInventorySlot(slot, index, {
      selected: selectedSlotIndex === index,
      active: false,
      dragging: draggedSlotIndex === index,
    });
  }).join('');
}

function renderMenuHotbar(
  slots: readonly (InventoryLayoutSlot | null)[],
  selectedSlotIndex: number | null,
  selectedBlock: PlaceableBlockType,
  draggedSlotIndex: number | null,
): string {
  return slots.slice(STORAGE_SLOT_COUNT).map((slot, offset) => {
    const slotIndex = STORAGE_SLOT_COUNT + offset;
    const active = Boolean(slot && isHotbarSelectableItem(slot.type) && slot.type === selectedBlock);

    return renderInventorySlot(slot, slotIndex, {
      selected: selectedSlotIndex === slotIndex,
      active,
      dragging: draggedSlotIndex === slotIndex,
    });
  }).join('');
}

function renderRecipeCost(entries: readonly InventoryStatusEntry[]): string {
  return entries.map((entry) => {
    const type = inventoryItemTypeFrom(entry.type);
    const icon = getInventoryIcon(type);

    return `
      <span class="recipe-ingredient" aria-label="${icon.label} x${entry.count}">
        ${createItemIcon(type)}
        <span>${entry.count}</span>
      </span>
    `;
  }).join('');
}

function renderRecipes(recipes: readonly RecipeStatusEntry[]): string {
  if (recipes.length === 0) {
    return `
      <div class="recipe-book-empty">
        <p>No recipes unlocked.</p>
        <p>Mine logs, stone, and ore to reveal new crafting paths.</p>
      </div>
    `;
  }

  return recipes.map((recipe) => {
    const output = recipe.outputs[0];
    const outputType = inventoryItemTypeFrom(output?.type ?? recipe.id);
    const outputLabel = getInventoryIcon(outputType).label;

    return `
      <button
        class="recipe-row${recipe.available ? ' available' : ''}"
        type="button"
        data-recipe-id="${recipe.id}"
        aria-label="${outputLabel} recipe"
        ${recipe.available ? '' : 'disabled'}
      >
        <span class="recipe-row-output">
          <span class="inventory-slot inventory-slot-small">
            ${createItemIcon(outputType, output?.count)}
          </span>
          <span class="recipe-row-copy">
            <span class="recipe-row-name">${recipe.label}</span>
            <span class="recipe-row-meta">${recipe.station ? `Needs ${recipe.station}` : 'Hand craft'}</span>
          </span>
        </span>
        <span class="recipe-row-costs">${renderRecipeCost(recipe.inputs)}</span>
      </button>
    `;
  }).join('');
}

export function createAppShell(root: HTMLDivElement): void {
  root.innerHTML = `
    <main class="shell">
      <section class="sandbox">
        <div class="viewport-wrap">
          <div class="viewport" data-viewport></div>
          <div class="hud" aria-live="polite">
            <header class="hud-topbar">
              <div class="hud-status-pill" data-hud-status>
                <div class="hud-status-copy">
                  <p class="eyebrow">Minecraft Clone</p>
                  <p class="hud-prompt" data-prompt></p>
                </div>
                <div class="hud-status-metrics">
                  <p class="hud-inline" data-target></p>
                  <p class="hud-inline" data-coords></p>
                </div>
              </div>
              <div class="hud-topbar-actions">
                <button class="hud-help-toggle" type="button" data-open-help hidden>Help</button>
                <button class="hud-help-dismiss" type="button" data-dismiss-help hidden>Hide help</button>
                <button class="menu-toggle" type="button" data-open-menu>Inventory</button>
              </div>
            </header>

            <div class="crosshair" aria-hidden="true"></div>
            <div class="touch-look-surface" data-look-surface aria-hidden="true">
              <span class="touch-look-hint">Drag to look</span>
            </div>

            <div class="touch-ui" data-touch-ui aria-label="Mobile gameplay controls">
              <div class="touch-cluster touch-move">
                <p class="touch-label">Move</p>
                <div class="touch-stick" data-move-stick>
                  <div class="touch-stick-thumb" data-move-thumb></div>
                </div>
              </div>
              <div class="touch-cluster touch-actions-panel">
                <p class="touch-label">Actions</p>
                <div class="touch-actions">
                  <button class="touch-button touch-button-primary" type="button" data-jump>Jump</button>
                  <button class="touch-button" type="button" data-break>Mine</button>
                  <button class="touch-button" type="button" data-place>Place</button>
                </div>
                <div class="touch-hotbar-cycle">
                  <button class="touch-cycle" type="button" data-hotbar-prev>Prev</button>
                  <button class="touch-cycle" type="button" data-hotbar-next>Next</button>
                </div>
              </div>
            </div>

            <div class="hotbar-shell">
              <div class="hotbar-panel">
                <div class="palette-row" data-palette></div>
              </div>
            </div>

            <div class="menu-modal" data-menu-modal hidden>
              <div class="menu-backdrop" data-close-menu></div>
              <section class="menu-panel" aria-label="Inventory menu">
                <header class="menu-header">
                  <div>
                    <p class="eyebrow">Minecraft Clone</p>
                    <h1>Inventory</h1>
                    <p class="menu-subtitle" data-mobile-status></p>
                  </div>
                  <button class="menu-close" type="button" data-close-menu>Close</button>
                </header>

                <div class="menu-body">
                  <section class="inventory-window">
                    <div class="inventory-window-top">
                      <article class="inventory-preview-panel">
                        <p class="inventory-window-label">Player</p>
                        <div class="inventory-player-preview" aria-hidden="true">
                          <span class="inventory-player-head"></span>
                          <span class="inventory-player-body"></span>
                        </div>
                        <p class="inventory-window-note">Crafting uses the recipe book at right in this slice.</p>
                      </article>

                      <article class="inventory-crafting-panel">
                        <p class="inventory-window-label">Crafting</p>
                        <div class="inventory-crafting-preview" aria-hidden="true">
                          <div class="inventory-slot inventory-slot-empty"></div>
                          <div class="inventory-slot inventory-slot-empty"></div>
                          <div class="inventory-slot inventory-slot-empty"></div>
                          <div class="inventory-slot inventory-slot-empty"></div>
                          <span class="inventory-crafting-arrow"></span>
                          <div class="inventory-slot inventory-slot-empty inventory-slot-result"></div>
                        </div>
                        <p class="inventory-window-note">Visual reference follows Minecraft. Recipe clicks still craft instantly.</p>
                      </article>
                    </div>

                    <section class="inventory-section">
                      <p class="inventory-window-label">Inventory</p>
                      <div class="inventory-storage-grid" data-inventory></div>
                    </section>

                    <section class="inventory-section">
                      <p class="inventory-window-label">Hotbar</p>
                      <div class="inventory-hotbar-grid" data-menu-hotbar></div>
                    </section>
                  </section>

                  <aside class="inventory-sidebar">
                    <section class="recipe-book-panel">
                      <div class="recipe-book-header">
                        <p class="inventory-window-label">Recipe Book</p>
                        <p class="recipe-book-note">Unlocked outputs and their ingredient costs.</p>
                      </div>
                      <div class="recipe-book" data-crafting></div>
                    </section>

                    <section class="world-panel">
                      <p class="inventory-window-label">World</p>
                      <p class="world-panel-copy" data-mobile-coords></p>
                      <p class="world-panel-copy" data-tool></p>
                      <p class="world-panel-copy" data-stations></p>
                      <p class="world-panel-copy" data-renderer></p>
                      <p class="world-panel-copy" data-device-note></p>
                      <button class="reset-button" type="button" data-reset>Reset world</button>
                    </section>
                  </aside>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;

  const viewport = root.querySelector<HTMLElement>('[data-viewport]');
  const hudStatus = root.querySelector<HTMLElement>('[data-hud-status]');
  const palette = root.querySelector<HTMLElement>('[data-palette]');
  const prompt = root.querySelector<HTMLElement>('[data-prompt]');
  const coords = root.querySelector<HTMLElement>('[data-coords]');
  const target = root.querySelector<HTMLElement>('[data-target]');
  const tool = root.querySelector<HTMLElement>('[data-tool]');
  const stations = root.querySelector<HTMLElement>('[data-stations]');
  const renderer = root.querySelector<HTMLElement>('[data-renderer]');
  const inventory = root.querySelector<HTMLElement>('[data-inventory]');
  const crafting = root.querySelector<HTMLElement>('[data-crafting]');
  const menuHotbar = root.querySelector<HTMLElement>('[data-menu-hotbar]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-reset]');
  const deviceNote = root.querySelector<HTMLElement>('[data-device-note]');
  const mobileStatus = root.querySelector<HTMLElement>('[data-mobile-status]');
  const mobileCoords = root.querySelector<HTMLElement>('[data-mobile-coords]');
  const touchUi = root.querySelector<HTMLElement>('[data-touch-ui]');
  const lookSurface = root.querySelector<HTMLElement>('[data-look-surface]');
  const moveStick = root.querySelector<HTMLElement>('[data-move-stick]');
  const moveThumb = root.querySelector<HTMLElement>('[data-move-thumb]');
  const jumpButton = root.querySelector<HTMLButtonElement>('[data-jump]');
  const breakButton = root.querySelector<HTMLButtonElement>('[data-break]');
  const placeButton = root.querySelector<HTMLButtonElement>('[data-place]');
  const hotbarPrevButton = root.querySelector<HTMLButtonElement>('[data-hotbar-prev]');
  const hotbarNextButton = root.querySelector<HTMLButtonElement>('[data-hotbar-next]');
  const menuModal = root.querySelector<HTMLElement>('[data-menu-modal]');
  const openMenuButton = root.querySelector<HTMLButtonElement>('[data-open-menu]');
  const openHelpButton = root.querySelector<HTMLButtonElement>('[data-open-help]');
  const dismissHelpButton = root.querySelector<HTMLButtonElement>('[data-dismiss-help]');
  const closeMenuButtons = [...root.querySelectorAll<HTMLElement>('[data-close-menu]')];

  if (
    !viewport ||
    !hudStatus ||
    !palette ||
    !prompt ||
    !coords ||
    !target ||
    !tool ||
    !stations ||
    !renderer ||
    !inventory ||
    !crafting ||
    !menuHotbar ||
    !resetButton ||
    !deviceNote ||
    !mobileStatus ||
    !mobileCoords ||
    !touchUi ||
    !lookSurface ||
    !moveStick ||
    !moveThumb ||
    !jumpButton ||
    !breakButton ||
    !placeButton ||
    !hotbarPrevButton ||
    !hotbarNextButton ||
    !menuModal ||
    !openMenuButton ||
    !openHelpButton ||
    !dismissHelpButton
  ) {
    throw new Error('Missing sandbox UI node.');
  }

  const TOUCH_HELP_AUTO_HIDE_DELAY_MS = 2400;
  const safeHudStatus = hudStatus;
  const safePrompt = prompt;
  const safeCoords = coords;
  const safeTarget = target;
  const safeTool = tool;
  const safeStations = stations;
  const safeRenderer = renderer;
  const safeInventory = inventory;
  const safeCrafting = crafting;
  const safeMenuHotbar = menuHotbar;
  const safeResetButton = resetButton;
  const safeDeviceNote = deviceNote;
  const safeMobileStatus = mobileStatus;
  const safeMobileCoords = mobileCoords;
  const safeTouchUi = touchUi;
  const safeLookSurface = lookSurface;
  const safeOpenHelpButton = openHelpButton;
  const safeDismissHelpButton = dismissHelpButton;
  let inventoryLayout = loadInventoryLayout();
  let selectedInventorySlotIndex: number | null = null;
  let draggedInventorySlotIndex: number | null = null;
  let lastStatus: SandboxStatus | null = null;
  let touchHelpVisible = false;
  let touchHelpInitialized = false;
  let touchHelpTimer = 0;

  const clearTouchHelpTimer = () => {
    if (touchHelpTimer) {
      window.clearTimeout(touchHelpTimer);
      touchHelpTimer = 0;
    }
  };

  const applyTouchHelpVisibility = () => {
    const touchDevice = lastStatus?.touchDevice ?? false;
    const showHudStatus = !touchDevice || touchHelpVisible;

    safeHudStatus.hidden = !showHudStatus;
    safeOpenHelpButton.hidden = !touchDevice || touchHelpVisible;
    safeDismissHelpButton.hidden = !touchDevice || !touchHelpVisible;
  };

  const scheduleTouchHelpAutoHide = () => {
    clearTouchHelpTimer();

    if (!(lastStatus?.touchDevice) || !touchHelpVisible) {
      return;
    }

    touchHelpTimer = window.setTimeout(() => {
      touchHelpVisible = false;
      applyTouchHelpVisibility();
    }, TOUCH_HELP_AUTO_HIDE_DELAY_MS);
  };

  const setMenuOpen = (open: boolean) => {
    menuModal.hidden = !open;
    root.classList.toggle('menu-open', open);
  };

  palette.innerHTML = BLOCK_ORDER.map(
    (type, index) => `
      <button class="swatch${index === 0 ? ' active' : ''}" type="button" data-block-type="${type}">
        <span class="swatch-chip swatch-${type}"></span>
        <span class="swatch-key">${index + 1}</span>
        <span class="swatch-count" data-count-for="${type}">0</span>
      </button>
    `,
  ).join('');

  const paletteButtons = [...palette.querySelectorAll<HTMLButtonElement>('[data-block-type]')];
  const touchControls: TouchUiControls = {
    root: safeTouchUi,
    lookSurface: safeLookSurface,
    moveStick,
    moveThumb,
    jumpButton,
    breakButton,
    placeButton,
    hotbarPrevButton,
    hotbarNextButton,
  };

  const syncSelectedInventorySlot = (status: SandboxStatus) => {
    if (selectedInventorySlotIndex !== null && inventoryLayout[selectedInventorySlotIndex]) {
      return;
    }

    const selectedHotbarIndex = inventoryLayout.findIndex((slot, index) => {
      return index >= STORAGE_SLOT_COUNT && Boolean(
        slot &&
        isHotbarSelectableItem(slot.type) &&
        slot.type === status.selectedBlock,
      );
    });

    selectedInventorySlotIndex = selectedHotbarIndex >= 0 ? selectedHotbarIndex : null;
  };

  const renderInventoryPanels = (status: SandboxStatus) => {
    safeInventory.innerHTML = renderStorageSlots(
      inventoryLayout,
      selectedInventorySlotIndex,
      draggedInventorySlotIndex,
    );
    safeMenuHotbar.innerHTML = renderMenuHotbar(
      inventoryLayout,
      selectedInventorySlotIndex,
      status.selectedBlock,
      draggedInventorySlotIndex,
    );
  };

  const selectInventorySlot = (slotIndex: number | null) => {
    selectedInventorySlotIndex = slotIndex;

    if (lastStatus) {
      renderInventoryPanels(lastStatus);
      bindInventorySlotInteractions();
    }
  };

  const syncSelectedBlockFromSlot = (slotIndex: number | null) => {
    if (slotIndex === null || slotIndex < STORAGE_SLOT_COUNT) {
      return;
    }

    const slot = inventoryLayout[slotIndex];

    if (slot && isHotbarSelectableItem(slot.type)) {
      sandbox.setSelectedBlock(slot.type);
    }
  };

  const moveInventorySlot = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !inventoryLayout[fromIndex]) {
      return;
    }

    const nextLayout = [...inventoryLayout];
    const sourceSlot = nextLayout[fromIndex];
    nextLayout[fromIndex] = nextLayout[toIndex];
    nextLayout[toIndex] = sourceSlot;
    inventoryLayout = nextLayout;
    selectedInventorySlotIndex = toIndex;
    persistInventoryLayout(inventoryLayout);
    syncSelectedBlockFromSlot(toIndex);

    if (lastStatus) {
      renderInventoryPanels(lastStatus);
      bindInventorySlotInteractions();
    }
  };

  function bindInventorySlotInteractions(): void {
    const slotButtons = [
      ...safeInventory.querySelectorAll<HTMLButtonElement>('[data-slot-index]'),
      ...safeMenuHotbar.querySelectorAll<HTMLButtonElement>('[data-slot-index]'),
    ];

    for (const button of slotButtons) {
      const slotIndex = Number(button.dataset.slotIndex);

      button.addEventListener('click', () => {
        const hasItem = Boolean(inventoryLayout[slotIndex]);

        if (selectedInventorySlotIndex === null) {
          if (hasItem) {
            selectInventorySlot(slotIndex);
            syncSelectedBlockFromSlot(slotIndex);
          }

          return;
        }

        if (selectedInventorySlotIndex === slotIndex) {
          selectInventorySlot(null);
          return;
        }

        moveInventorySlot(selectedInventorySlotIndex, slotIndex);
      });

      button.addEventListener('dragstart', (event) => {
        if (!inventoryLayout[slotIndex]) {
          event.preventDefault();
          return;
        }

        draggedInventorySlotIndex = slotIndex;
        event.dataTransfer?.setData('text/plain', String(slotIndex));
        event.dataTransfer?.setDragImage(button, button.clientWidth / 2, button.clientHeight / 2);
        event.dataTransfer!.effectAllowed = 'move';
        renderInventoryPanels(lastStatus ?? {
          locked: false,
          selectedBlock: 'grass',
          coords: '',
          target: '',
          prompt: '',
          touchDevice: false,
          selectedTool: '',
          stations: '',
          renderer: '',
          inventory: [],
          recipes: [],
          placeableCounts: {},
        });
        bindInventorySlotInteractions();
      });

      button.addEventListener('dragover', (event) => {
        if (draggedInventorySlotIndex === null) {
          return;
        }

        event.preventDefault();
        event.dataTransfer!.dropEffect = 'move';
      });

      button.addEventListener('drop', (event) => {
        event.preventDefault();

        if (draggedInventorySlotIndex === null) {
          return;
        }

        const sourceIndex = Number(event.dataTransfer?.getData('text/plain') ?? draggedInventorySlotIndex);
        draggedInventorySlotIndex = null;
        moveInventorySlot(sourceIndex, slotIndex);
      });

      button.addEventListener('dragend', () => {
        draggedInventorySlotIndex = null;

        if (lastStatus) {
          renderInventoryPanels(lastStatus);
          bindInventorySlotInteractions();
        }
      });
    }
  }

  function applyStatus(status: SandboxStatus): void {
    lastStatus = status;
    if (status.touchDevice) {
      if (!touchHelpInitialized) {
        touchHelpVisible = true;
        touchHelpInitialized = true;
        scheduleTouchHelpAutoHide();
      }
    } else {
      touchHelpInitialized = false;
      touchHelpVisible = false;
      clearTouchHelpTimer();
    }

    applyTouchHelpVisibility();
    safePrompt.textContent = status.prompt;
    safeCoords.textContent = status.coords;
    safeTarget.textContent = status.target;
    safeTool.textContent = `Best tool: ${status.selectedTool}`;
    safeStations.textContent = `Stations: ${status.stations}`;
    safeRenderer.textContent = `Renderer: ${status.renderer}`;
    safeMobileStatus.textContent = status.touchDevice
      ? 'Pocket-style play outside, full inventory window inside.'
      : 'Minecraft-style inventory window with recipe book and quickbar overview.';
    safeMobileCoords.textContent = status.coords;
    safeTouchUi.classList.toggle('active', status.touchDevice);
    safeLookSurface.classList.toggle('active', status.touchDevice);
    safeDeviceNote.textContent = status.touchDevice
      ? 'Mobile keeps the world visible for movement and look, then opens inventory as an overlay.'
      : 'Desktop keeps gameplay clean and moves inventory management into the overlay window.';

    inventoryLayout = reconcileInventoryLayout(inventoryLayout, status.inventory);
    persistInventoryLayout(inventoryLayout);
    syncSelectedInventorySlot(status);
    renderInventoryPanels(status);
    safeCrafting.innerHTML = renderRecipes(status.recipes);
    bindInventorySlotInteractions();

    for (const button of safeCrafting.querySelectorAll<HTMLButtonElement>('[data-recipe-id]')) {
      button.addEventListener('click', () => {
        const recipeId = button.dataset.recipeId;

        if (recipeId) {
          sandbox.craftRecipe(recipeId);
        }
      });
    }

    for (const button of paletteButtons) {
      const blockType = button.dataset.blockType ?? '';
      button.classList.toggle('active', blockType === status.selectedBlock);
      const countNode = button.querySelector<HTMLElement>(`[data-count-for="${blockType}"]`);

      if (countNode) {
        countNode.textContent = String(status.placeableCounts[blockType] ?? 0);
      }
    }
  }

  const sandbox = createPlayableScene(viewport, applyStatus, touchControls);
  const exposeQaHarness = new URLSearchParams(window.location.search).has('qaHarness');

  if (exposeQaHarness) {
    window.__minecraftCloneQa = {
      craftRecipe: (recipeId: string) => {
        sandbox.craftRecipe(recipeId);
      },
      setSelectedBlock: (type: HotbarBlockType) => {
        sandbox.setSelectedBlock(type);
      },
      placeSelectedBlockOnNearestSurface: () => sandbox.placeSelectedBlockOnNearestSurface(),
      getBlockAt: (x: number, y: number, z: number) => sandbox.getBlockAt(x, y, z),
      getStatus: () => sandbox.getStatusSnapshot(),
      moveInventorySlot: (fromIndex: number, toIndex: number) => {
        moveInventorySlot(fromIndex, toIndex);
      },
      setMenuOpen,
    };
  }

  for (const button of paletteButtons) {
    button.addEventListener('click', () => {
      const type = button.dataset.blockType as HotbarBlockType;
      sandbox.setSelectedBlock(type);
    });
  }

  openMenuButton.addEventListener('click', () => {
    setMenuOpen(true);
  });

  safeOpenHelpButton.addEventListener('click', () => {
    touchHelpVisible = true;
    applyTouchHelpVisibility();
    scheduleTouchHelpAutoHide();
  });

  safeDismissHelpButton.addEventListener('click', () => {
    touchHelpVisible = false;
    clearTouchHelpTimer();
    applyTouchHelpVisibility();
  });

  for (const button of closeMenuButtons) {
    button.addEventListener('click', () => {
      setMenuOpen(false);
    });
  }

  safeResetButton.addEventListener('click', () => {
    sandbox.resetWorld();
  });
}
