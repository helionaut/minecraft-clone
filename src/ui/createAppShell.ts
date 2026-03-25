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

const BLOCK_ORDER: readonly PlaceableBlockType[] = PLACEABLE_BLOCK_ORDER;

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

function renderStorageSlots(entries: readonly InventoryStatusEntry[]): string {
  return Array.from({ length: 27 }, (_unused, index) => {
    const entry = entries[index];

    if (!entry) {
      return '<div class="inventory-slot inventory-slot-empty" aria-hidden="true"></div>';
    }

    const type = inventoryItemTypeFrom(entry.type);
    const icon = getInventoryIcon(type);

    return `
      <div class="inventory-slot" data-item-type="${entry.type}" aria-label="${icon.label} x${entry.count}">
        ${createItemIcon(type, entry.count)}
      </div>
    `;
  }).join('');
}

function renderMenuHotbar(
  selectedBlock: PlaceableBlockType,
  placeableCounts: SandboxStatus['placeableCounts'],
): string {
  return BLOCK_ORDER.map((type) => {
    const icon = getInventoryIcon(type);
    const count = placeableCounts[type] ?? 0;

    return `
      <div
        class="inventory-slot inventory-hotbar-slot${selectedBlock === type ? ' active' : ''}"
        data-hotbar-slot="${type}"
        aria-label="${icon.label} hotbar slot"
      >
        ${createItemIcon(type, count)}
      </div>
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
              <div class="hud-status-pill">
                <div class="hud-status-copy">
                  <p class="eyebrow">Minecraft Clone</p>
                  <p class="hud-prompt" data-prompt></p>
                </div>
                <div class="hud-status-metrics">
                  <p class="hud-inline" data-target></p>
                  <p class="hud-inline" data-coords></p>
                </div>
              </div>
              <button class="menu-toggle" type="button" data-open-menu>Inventory</button>
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
  const closeMenuButtons = [...root.querySelectorAll<HTMLElement>('[data-close-menu]')];

  if (
    !viewport ||
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
    !openMenuButton
  ) {
    throw new Error('Missing sandbox UI node.');
  }

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

  const sandbox = createPlayableScene(viewport, applyStatus, touchControls);

  function applyStatus(status: SandboxStatus): void {
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

    safeInventory.innerHTML = renderStorageSlots(status.inventory);
    safeMenuHotbar.innerHTML = renderMenuHotbar(status.selectedBlock, status.placeableCounts);
    safeCrafting.innerHTML = renderRecipes(status.recipes);

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

  for (const button of paletteButtons) {
    button.addEventListener('click', () => {
      const type = button.dataset.blockType as HotbarBlockType;
      sandbox.setSelectedBlock(type);
    });
  }

  openMenuButton.addEventListener('click', () => {
    setMenuOpen(true);
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
