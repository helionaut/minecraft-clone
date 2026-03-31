import {
  type HotbarBlockType,
  PLACEABLE_BLOCK_ORDER,
  type PlaceableBlockType,
} from '../gameplay/blocks.ts';
import type { InventoryItemType } from '../gameplay/progression.ts';
import {
  type ChunkTraversalProfileOptions,
  type ChunkTraversalProfileReport,
  createPlayableScene,
  type HotbarSelectionControls,
  type InventoryStatusEntry,
  type RecipeStatusEntry,
  type SceneDiagnosticsSnapshot,
  type SandboxStatus,
  type TouchUiControls,
} from '../rendering/scene.ts';
import {
  createBrowserDiagnosticsMonitor,
  downloadDiagnosticsReport,
  isDebugDiagnosticsEnabled,
} from '../debug/browserDiagnostics.ts';
import { getInventoryIcon } from './inventoryIcons.ts';

declare global {
  interface Window {
    __minecraftCloneQa?: {
      readonly craftRecipe: (recipeId: string) => void;
      readonly setSelectedBlock: (type: HotbarBlockType) => void;
      readonly mineBlockAt: (x: number, y: number, z: number) => {
        readonly success: boolean;
        readonly drop: InventoryItemType | null;
      };
      readonly placeSelectedBlockOnNearestSurface: () => {
        readonly placed: boolean;
        readonly position: { readonly x: number; readonly y: number; readonly z: number } | null;
      };
      readonly getBlockAt: (x: number, y: number, z: number) => string | null;
      readonly getStatus: () => SandboxStatus | null;
      readonly getDiagnostics?: () => SceneDiagnosticsSnapshot;
      readonly profileChunkTraversal?: (options?: ChunkTraversalProfileOptions) => Promise<ChunkTraversalProfileReport>;
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

interface CraftingGuideState {
  readonly title: string;
  readonly body: string;
  readonly hint: string;
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

function findNextOpenHotbarSlot(slots: readonly (InventoryLayoutSlot | null)[]): number {
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

  const preferHotbarForNewItems = nextSlots.slice(STORAGE_SLOT_COUNT).every((slot) => slot === null);

  for (const entry of entries) {
    if (assignedTypes.has(entry.type)) {
      continue;
    }

    const nextHotbarIndex = findNextOpenHotbarSlot(nextSlots);
    const nextIndex = preferHotbarForNewItems && nextHotbarIndex !== -1
      ? nextHotbarIndex
      : findNextOpenInventorySlot(nextSlots);

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
  activeHotbarSlotIndex: number,
  draggedSlotIndex: number | null,
): string {
  return slots.slice(STORAGE_SLOT_COUNT).map((slot, offset) => {
    const slotIndex = STORAGE_SLOT_COUNT + offset;
    const active = offset === activeHotbarSlotIndex;

    return renderInventorySlot(slot, slotIndex, {
      selected: selectedSlotIndex === slotIndex,
      active,
      dragging: draggedSlotIndex === slotIndex,
    });
  }).join('');
}

function getHudHotbarSlots(
  slots: readonly (InventoryLayoutSlot | null)[],
): Array<InventoryLayoutSlot | null> {
  return slots.slice(STORAGE_SLOT_COUNT);
}

function renderHudHotbar(
  slots: readonly (InventoryLayoutSlot | null)[],
  activeHotbarSlotIndex: number,
): string {
  return getHudHotbarSlots(slots).map((slot, index) => {
    const selectableType = slot && isHotbarSelectableItem(slot.type) ? slot.type : null;
    const active = index === activeHotbarSlotIndex;
    const icon = slot
      ? createItemIcon(slot.type, slot.count)
      : '<span class="inventory-slot-empty" aria-hidden="true"></span>';

    return `
      <button
        class="swatch${active ? ' active' : ''}${slot ? '' : ' swatch-empty'}"
        type="button"
        data-hud-hotbar-slot="${index}"
        ${slot ? `data-item-type="${slot.type}"` : ''}
        ${selectableType ? `data-block-type="${selectableType}"` : ''}
        aria-label="${slot ? `Hotbar slot ${index + 1}: ${getInventoryIcon(slot.type).label} x${slot.count}` : `Empty hotbar slot ${index + 1}`}"
      >
        <span class="swatch-key">${index + 1}</span>
        ${icon}
      </button>
    `;
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

function getInventoryCount(
  entries: readonly InventoryStatusEntry[],
  type: InventoryItemType,
): number {
  return entries.find((entry) => entry.type === type)?.count ?? 0;
}

function getRecipeHint(recipe: RecipeStatusEntry, nearbyStations: readonly string[]): string {
  if (recipe.available) {
    return recipe.station ? `Ready at nearby ${recipe.station}` : 'Ready to craft now';
  }

  if (recipe.station && !nearbyStations.includes(recipe.station)) {
    return `Place ${recipe.station} nearby to unlock this recipe`;
  }

  return 'Missing ingredients';
}

function getCraftingGuideState(
  status: SandboxStatus,
  inventoryLayout: readonly (InventoryLayoutSlot | null)[],
): CraftingGuideState {
  const nearbyStations = status.nearbyStations ?? [];
  const hasNearbyCraftingTable = nearbyStations.includes('crafting table');
  const craftingTableRecipe = status.recipes.find((recipe) => recipe.id === 'crafting-table');
  const hasCraftingTableItem = getInventoryCount(status.inventory, 'crafting-table') > 0;
  const hasCraftingTableInHotbar = inventoryLayout.slice(STORAGE_SLOT_COUNT).some((slot) => slot?.type === 'crafting-table');
  const hasOakPlanks = getInventoryCount(status.inventory, 'oak-planks') > 0;
  const hasOakLogs = getInventoryCount(status.inventory, 'oak-log') > 0;
  const hasSticks = getInventoryCount(status.inventory, 'stick') > 0;
  const hasAvailableTableRecipe = craftingTableRecipe?.available ?? false;
  const hasAvailableToolRecipe = status.recipes.some((recipe) => {
    return recipe.station === 'crafting table' && recipe.available;
  });

  if (hasNearbyCraftingTable) {
    return {
      title: 'Crafting table active',
      body: hasAvailableToolRecipe
        ? 'Tool and station recipes are unlocked while you stay near the placed crafting table.'
        : 'The placed crafting table is active. Gather the missing ingredients, then use the Recipe Book buttons to craft tools.',
      hint: 'Keep the table nearby, then craft from the Recipe Book on the right.',
    };
  }

  if (hasCraftingTableItem && hasCraftingTableInHotbar) {
    return {
      title: 'Place the table nearby',
      body: 'Close the inventory, select the crafting table in your hotbar, and place it on the ground near you.',
      hint: 'Reopen the inventory after placing it. Wooden tools unlock only when a placed table is nearby.',
    };
  }

  if (hasCraftingTableItem) {
    return {
      title: 'Move table to hotbar',
      body: 'Select the crafting table, then click an empty hotbar slot so you can place it in the world.',
      hint: 'The hotbar is the bottom row in this menu and the bar at the bottom of the screen.',
    };
  }

  if (hasAvailableTableRecipe) {
    return {
      title: 'Craft the table',
      body: 'Use the crafting table recipe button in the Recipe Book. Crafting here is instant in this slice.',
      hint: 'After it appears in inventory, move it to the hotbar and place it nearby to unlock tool recipes.',
    };
  }

  if (hasOakPlanks && !hasSticks) {
    return {
      title: 'Craft sticks next',
      body: 'Use the stick recipe from the Recipe Book, then come back for the crafting table recipe.',
      hint: 'Two planks make four sticks. Four planks make one crafting table.',
    };
  }

  if (hasOakLogs || hasOakPlanks) {
    return {
      title: 'Start with planks',
      body: 'Use the Recipe Book to turn oak logs into planks until the crafting table recipe becomes available.',
      hint: 'You need four oak planks total for one crafting table.',
    };
  }

  return {
    title: 'Mine wood first',
    body: 'Mine an oak log, then open the inventory and use the Recipe Book to start the crafting chain.',
    hint: 'The crafting flow is logs -> planks -> crafting table -> place table -> tools.',
  };
}

function renderCraftingGuide(
  status: SandboxStatus,
  inventoryLayout: readonly (InventoryLayoutSlot | null)[],
): string {
  const guide = getCraftingGuideState(status, inventoryLayout);

  return `
    <section class="crafting-guide" aria-label="Crafting help">
      <p class="crafting-guide-kicker">How crafting works</p>
      <p class="crafting-guide-title">${guide.title}</p>
      <p class="crafting-guide-body">${guide.body}</p>
      <p class="crafting-guide-hint">${guide.hint}</p>
    </section>
  `;
}

function renderRecipes(recipes: readonly RecipeStatusEntry[], nearbyStations: readonly string[]): string {
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
            <span class="recipe-row-meta">${getRecipeHint(recipe, nearbyStations)}</span>
            </span>
          </span>
          <span class="recipe-row-costs">${renderRecipeCost(recipe.inputs)}</span>
      </button>
    `;
  }).join('');
}

export async function createAppShell(root: HTMLDivElement): Promise<void> {
  const diagnosticsEnabled = isDebugDiagnosticsEnabled(window.location.search, import.meta.env.MODE);

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
                        <p class="recipe-book-note">Use the Recipe Book buttons to craft instantly, then place stations in the world when recipes ask for them.</p>
                      </div>
                      <div data-crafting-guide></div>
                      <div class="recipe-book" data-crafting></div>
                    </section>

                    <section class="world-panel">
                      <p class="inventory-window-label">World</p>
                      <p class="world-panel-copy" data-mobile-coords></p>
                      <p class="world-panel-copy" data-tool></p>
                      <p class="world-panel-copy" data-stations></p>
                      <p class="world-panel-copy" data-renderer></p>
                      <p class="world-panel-copy" data-device-note></p>
                      <div class="world-panel-actions">
                        <button class="reset-button" type="button" data-reset>Reset world</button>
                        ${diagnosticsEnabled ? '<button class="reset-button" type="button" data-download-diagnostics>Download diagnostics</button>' : ''}
                      </div>
                      ${diagnosticsEnabled ? '<p class="world-panel-copy" data-diagnostics-hint>Debug build hotkey: Alt+Shift+D</p>' : ''}
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
  const craftingGuide = root.querySelector<HTMLElement>('[data-crafting-guide]');
  const menuHotbar = root.querySelector<HTMLElement>('[data-menu-hotbar]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-reset]');
  const downloadDiagnosticsButton = root.querySelector<HTMLButtonElement>('[data-download-diagnostics]');
  const deviceNote = root.querySelector<HTMLElement>('[data-device-note]');
  const mobileStatus = root.querySelector<HTMLElement>('[data-mobile-status]');
  const mobileCoords = root.querySelector<HTMLElement>('[data-mobile-coords]');
  const touchUi = root.querySelector<HTMLElement>('[data-touch-ui]');
  const hotbarShell = root.querySelector<HTMLElement>('.hotbar-shell');
  const touchMoveCluster = root.querySelector<HTMLElement>('.touch-move');
  const touchActionsPanel = root.querySelector<HTMLElement>('.touch-actions-panel');
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
    !craftingGuide ||
    !menuHotbar ||
    !resetButton ||
    !deviceNote ||
    !mobileStatus ||
    !mobileCoords ||
    !touchUi ||
    !hotbarShell ||
    !touchMoveCluster ||
    !touchActionsPanel ||
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
  const safePalette = palette;
  const safePrompt = prompt;
  const safeCoords = coords;
  const safeTarget = target;
  const safeTool = tool;
  const safeStations = stations;
  const safeRenderer = renderer;
  const safeInventory = inventory;
  const safeCrafting = crafting;
  const safeCraftingGuide = craftingGuide;
  const safeMenuHotbar = menuHotbar;
  const safeResetButton = resetButton;
  const safeDownloadDiagnosticsButton = downloadDiagnosticsButton;
  const safeDeviceNote = deviceNote;
  const safeMobileStatus = mobileStatus;
  const safeMobileCoords = mobileCoords;
  const safeTouchUi = touchUi;
  const safeHotbarShell = hotbarShell;
  const safeTouchMoveCluster = touchMoveCluster;
  const safeTouchActionsPanel = touchActionsPanel;
  const safeLookSurface = lookSurface;
  const safeOpenHelpButton = openHelpButton;
  const safeDismissHelpButton = dismissHelpButton;
  let inventoryLayout = loadInventoryLayout();
  let selectedInventorySlotIndex: number | null = null;
  let draggedInventorySlotIndex: number | null = null;
  let selectedHotbarSlotIndex = 0;
  let hotbarSelectionInitialized = false;
  let lastStatus: SandboxStatus | null = null;
  let touchHelpVisible = false;
  let touchHelpInitialized = false;
  let touchHelpTimer = 0;

  const normalizeHotbarSlotIndex = (slotIndex: number) => {
    return Math.min(Math.max(slotIndex, 0), HOTBAR_SLOT_COUNT - 1);
  };

  const getInventorySlotIndexForHotbar = (hotbarSlotIndex: number) => STORAGE_SLOT_COUNT + hotbarSlotIndex;

  const getSelectedHotbarItem = (): InventoryItemType | null => {
    return inventoryLayout[getInventorySlotIndexForHotbar(selectedHotbarSlotIndex)]?.type ?? null;
  };

  const findHotbarSlotIndexForItem = (type: InventoryItemType | null): number | null => {
    if (!type) {
      return null;
    }

    const hotbarIndex = getHudHotbarSlots(inventoryLayout).findIndex((slot) => slot?.type === type);
    return hotbarIndex >= 0 ? hotbarIndex : null;
  };

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

  const syncResponsiveHotbarOffset = () => {
    if (!(lastStatus?.touchDevice)) {
      root.style.removeProperty('--hotbar-raise-offset');
      return;
    }

    const hotbarRect = safeHotbarShell.getBoundingClientRect();
    const moveRect = safeTouchMoveCluster.getBoundingClientRect();
    const actionsRect = safeTouchActionsPanel.getBoundingClientRect();

    if (hotbarRect.width <= 0 || moveRect.width <= 0 || actionsRect.width <= 0) {
      root.style.removeProperty('--hotbar-raise-offset');
      return;
    }

    const centerGapWidth = Math.max(0, actionsRect.left - moveRect.right);

    if (centerGapWidth >= hotbarRect.width) {
      root.style.removeProperty('--hotbar-raise-offset');
      return;
    }

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const minimumLift = Math.max(0, viewportHeight * 0.1);
    const controlTop = Math.min(moveRect.top, actionsRect.top);
    const clearanceLift = Math.max(0, hotbarRect.bottom - (controlTop - 8));
    const hotbarLift = Math.max(minimumLift, clearanceLift);

    root.style.setProperty('--hotbar-raise-offset', `${Math.round(hotbarLift * 100) / 100}px`);
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

  const syncSelectedInventorySlot = () => {
    if (selectedInventorySlotIndex !== null && inventoryLayout[selectedInventorySlotIndex]) {
      return;
    }

    selectedInventorySlotIndex = null;
  };

  const renderInventoryPanels = () => {
    safeInventory.innerHTML = renderStorageSlots(
      inventoryLayout,
      selectedInventorySlotIndex,
      draggedInventorySlotIndex,
    );
    safeMenuHotbar.innerHTML = renderMenuHotbar(
      inventoryLayout,
      selectedInventorySlotIndex,
      selectedHotbarSlotIndex,
      draggedInventorySlotIndex,
    );
  };

  const renderCraftingGuidePanel = () => {
    if (!lastStatus) {
      safeCraftingGuide.innerHTML = '';
      return;
    }

    safeCraftingGuide.innerHTML = renderCraftingGuide(lastStatus, inventoryLayout);
  };

  const renderHudHotbarPanel = () => {
    palette.innerHTML = renderHudHotbar(inventoryLayout, selectedHotbarSlotIndex);
  };

  const selectInventorySlot = (slotIndex: number | null) => {
    selectedInventorySlotIndex = slotIndex;

    if (lastStatus) {
      renderInventoryPanels();
      renderCraftingGuidePanel();
      renderHudHotbarPanel();
      bindInventorySlotInteractions();
      bindHudHotbarInteractions();
    }
  };

  const clearInventoryCarryState = () => {
    selectedInventorySlotIndex = null;
    draggedInventorySlotIndex = null;
  };

  const syncSelectedHotbarSlot = (hotbarSlotIndex: number, syncSceneSelection: boolean) => {
    selectedHotbarSlotIndex = normalizeHotbarSlotIndex(hotbarSlotIndex);
    hotbarSelectionInitialized = true;
    const selectedItem = getSelectedHotbarItem();

    if (syncSceneSelection && selectedItem && isHotbarSelectableItem(selectedItem)) {
      sandbox.setSelectedBlock(selectedItem);
    }

    if (lastStatus) {
      renderInventoryPanels();
      renderCraftingGuidePanel();
      renderHudHotbarPanel();
      bindInventorySlotInteractions();
      bindHudHotbarInteractions();
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
    clearInventoryCarryState();
    persistInventoryLayout(inventoryLayout);
    if (toIndex >= STORAGE_SLOT_COUNT) {
      syncSelectedHotbarSlot(toIndex - STORAGE_SLOT_COUNT, true);
      return;
    }

    if (lastStatus) {
      renderInventoryPanels();
      renderCraftingGuidePanel();
      renderHudHotbarPanel();
      bindInventorySlotInteractions();
      bindHudHotbarInteractions();
    }
  };

  function bindHudHotbarInteractions(): void {
    const hotbarButtons = [...safePalette.querySelectorAll<HTMLButtonElement>('[data-hud-hotbar-slot]')];

    for (const button of hotbarButtons) {
      const hotbarSlotIndex = Number(button.dataset.hudHotbarSlot);

      button.addEventListener('click', () => {
        syncSelectedHotbarSlot(hotbarSlotIndex, true);
      });
    }
  }

  function bindInventorySlotInteractions(): void {
    const slotButtons = [
      ...safeInventory.querySelectorAll<HTMLButtonElement>('[data-slot-index]'),
      ...safeMenuHotbar.querySelectorAll<HTMLButtonElement>('[data-slot-index]'),
    ];

    for (const button of slotButtons) {
      const slotIndex = Number(button.dataset.slotIndex);

      button.addEventListener('click', () => {
        const hasItem = Boolean(inventoryLayout[slotIndex]);
        const isHotbarSlot = slotIndex >= STORAGE_SLOT_COUNT;

        if (selectedInventorySlotIndex === null) {
          if (isHotbarSlot) {
            syncSelectedHotbarSlot(slotIndex - STORAGE_SLOT_COUNT, hasItem);
          }

          if (hasItem) {
            selectInventorySlot(slotIndex);
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
        renderInventoryPanels();
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
          renderInventoryPanels();
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
    if (!hotbarSelectionInitialized) {
      const preferredHotbarSlotIndex = findHotbarSlotIndexForItem(status.activeItem)
        ?? findHotbarSlotIndexForItem(status.selectedBlock);

      if (preferredHotbarSlotIndex !== null) {
        selectedHotbarSlotIndex = preferredHotbarSlotIndex;
      }

      hotbarSelectionInitialized = true;
    }
    selectedHotbarSlotIndex = normalizeHotbarSlotIndex(selectedHotbarSlotIndex);

    syncSelectedInventorySlot();
    renderHudHotbarPanel();
    renderInventoryPanels();
    renderCraftingGuidePanel();
    safeCrafting.innerHTML = renderRecipes(status.recipes, status.nearbyStations ?? []);
    bindHudHotbarInteractions();
    bindInventorySlotInteractions();
    syncResponsiveHotbarOffset();

    for (const button of safeCrafting.querySelectorAll<HTMLButtonElement>('[data-recipe-id]')) {
      button.addEventListener('click', () => {
        const recipeId = button.dataset.recipeId;

        if (recipeId) {
          sandbox.craftRecipe(recipeId);
        }
      });
    }

  }

  const hotbarControls: HotbarSelectionControls = {
    getHotbarSlots: () => {
      return getHudHotbarSlots(inventoryLayout).map((slot) => slot?.type ?? null);
    },
    getSelectedHotbarSlotIndex: () => selectedHotbarSlotIndex,
    setSelectedHotbarSlotIndex: (slotIndex: number) => {
      selectedHotbarSlotIndex = normalizeHotbarSlotIndex(slotIndex);
      hotbarSelectionInitialized = true;
    },
    getActiveHotbarItem: () => getSelectedHotbarItem(),
    setActiveHotbarItem: (type: InventoryItemType | null) => {
      const hotbarSlotIndex = findHotbarSlotIndexForItem(type);

      if (hotbarSlotIndex !== null) {
        selectedHotbarSlotIndex = hotbarSlotIndex;
        hotbarSelectionInitialized = true;
      }
    },
  };

  const searchParams = new URLSearchParams(window.location.search);
  const exposeQaHarness = searchParams.has('qaHarness');
  const freezeAtSpawnFrame = exposeQaHarness && searchParams.has('freezeScene');
  const autoOpenMenu = exposeQaHarness && searchParams.has('autoOpenMenu');
  const browserDiagnosticsMonitor = diagnosticsEnabled
    ? createBrowserDiagnosticsMonitor(window)
    : null;
  const sandbox = await createPlayableScene(
    viewport,
    applyStatus,
    touchControls,
    hotbarControls,
    { freezeAtSpawnFrame },
  );

  if (exposeQaHarness) {
    window.__minecraftCloneQa = {
      craftRecipe: (recipeId: string) => {
        sandbox.craftRecipe(recipeId);
      },
      setSelectedBlock: (type: HotbarBlockType) => {
        sandbox.setSelectedBlock(type);
      },
      mineBlockAt: (x: number, y: number, z: number) => sandbox.mineBlockAt(x, y, z),
      placeSelectedBlockOnNearestSurface: () => sandbox.placeSelectedBlockOnNearestSurface(),
      getBlockAt: (x: number, y: number, z: number) => sandbox.getBlockAt(x, y, z),
      getStatus: () => sandbox.getStatusSnapshot(),
      getDiagnostics: () => sandbox.getDiagnosticsSnapshot(browserDiagnosticsMonitor?.captureSnapshot()),
      profileChunkTraversal: (profileOptions) => sandbox.profileChunkTraversal(profileOptions),
      moveInventorySlot: (fromIndex: number, toIndex: number) => {
        moveInventorySlot(fromIndex, toIndex);
      },
      setMenuOpen,
    };
  }

  const downloadDiagnostics = () => {
    const diagnosticsReport = sandbox.getDiagnosticsSnapshot(browserDiagnosticsMonitor?.captureSnapshot());
    downloadDiagnosticsReport(diagnosticsReport);
  };

  if (autoOpenMenu) {
    setMenuOpen(true);
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

  safeDownloadDiagnosticsButton?.addEventListener('click', downloadDiagnostics);

  window.addEventListener('keydown', (event) => {
    if (!diagnosticsEnabled) {
      return;
    }

    if (event.altKey && event.shiftKey && event.code === 'KeyD') {
      event.preventDefault();
      downloadDiagnostics();
    }
  });

  window.addEventListener('resize', syncResponsiveHotbarOffset);
  window.addEventListener('orientationchange', syncResponsiveHotbarOffset);
}
