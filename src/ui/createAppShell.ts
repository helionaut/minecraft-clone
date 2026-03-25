import {
  type HotbarBlockType,
  PLACEABLE_BLOCK_ORDER,
  type PlaceableBlockType,
} from '../gameplay/blocks.ts';
import {
  createPlayableScene,
  type InventoryStatusEntry,
  type RecipeStatusEntry,
  type SandboxStatus,
  type TouchUiControls,
} from '../rendering/scene.ts';

const BLOCK_ORDER: readonly PlaceableBlockType[] = PLACEABLE_BLOCK_ORDER;
type MenuTabId = 'inventory' | 'crafting' | 'world';

function getReadableName(value: string): string {
  return value.replaceAll('-', ' ');
}

function createItemIcon(type: string, count?: number): string {
  return `
    <span class="item-icon item-icon-${type}" aria-hidden="true"></span>
    ${typeof count === 'number' ? `<span class="item-count">${count}</span>` : ''}
  `;
}

function renderInventoryEntries(entries: readonly InventoryStatusEntry[]): string {
  if (entries.length === 0) {
    return `
      <div class="empty-state">
        <p>Inventory is empty.</p>
        <p>Mine logs, stone, and ore to stock materials.</p>
      </div>
    `;
  }

  return entries.map((entry) => `
    <article class="inventory-slot">
      <div class="slot-icon-wrap">
        ${createItemIcon(entry.type, entry.count)}
      </div>
      <div class="slot-copy">
        <p class="slot-name">${getReadableName(entry.type)}</p>
        <p class="slot-meta">${entry.count} in stack</p>
      </div>
    </article>
  `).join('');
}

function renderRecipeCost(entries: readonly InventoryStatusEntry[]): string {
  return entries.map((entry) => `
    <span class="recipe-cost-pill">
      ${createItemIcon(entry.type)}
      <span>${entry.count}</span>
    </span>
  `).join('');
}

function renderRecipes(recipes: readonly RecipeStatusEntry[]): string {
  if (recipes.length === 0) {
    return `
      <div class="empty-state">
        <p>No recipes unlocked.</p>
      </div>
    `;
  }

  return recipes.map((recipe) => `
    <button
      class="recipe-card${recipe.available ? ' available' : ''}"
      type="button"
      data-recipe-id="${recipe.id}"
      ${recipe.available ? '' : 'disabled'}
    >
      <div class="recipe-card-top">
        <div class="slot-icon-wrap slot-icon-wrap-large">
          ${createItemIcon(recipe.outputs[0]?.type ?? recipe.id, recipe.outputs[0]?.count)}
        </div>
        <div class="recipe-card-copy">
          <p class="slot-name">${recipe.label}</p>
          <p class="slot-meta">${recipe.station ? `Needs ${recipe.station}` : 'Hand recipe'}</p>
        </div>
      </div>
      <div class="recipe-costs">
        ${renderRecipeCost(recipe.inputs)}
      </div>
    </button>
  `).join('');
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
              <button class="menu-toggle" type="button" data-open-menu>Pack</button>
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
                <p class="hotbar-title">Hotbar</p>
                <div class="palette-row" data-palette></div>
              </div>
            </div>

            <div class="menu-modal" data-menu-modal hidden>
              <div class="menu-backdrop" data-close-menu></div>
              <section class="menu-panel" aria-label="Inventory and crafting menu">
                <header class="menu-header">
                  <div>
                    <p class="eyebrow">Minecraft Clone</p>
                    <h1>Backpack</h1>
                    <p class="menu-subtitle" data-mobile-status></p>
                  </div>
                  <button class="menu-close" type="button" data-close-menu>Close</button>
                </header>

                <nav class="menu-tabs" aria-label="Menu sections">
                  <button class="menu-tab active" type="button" data-menu-tab="inventory">Inventory</button>
                  <button class="menu-tab" type="button" data-menu-tab="crafting">Crafting</button>
                  <button class="menu-tab" type="button" data-menu-tab="world">World</button>
                </nav>

                <div class="menu-body">
                  <section class="menu-view active" data-menu-view="inventory">
                    <div class="menu-section-heading">
                      <p class="label">Inventory</p>
                      <p class="note">Blocks, materials, tools, and stations you carry.</p>
                    </div>
                    <div class="inventory-grid" data-inventory></div>
                  </section>

                  <section class="menu-view" data-menu-view="crafting">
                    <div class="menu-section-heading">
                      <p class="label">Crafting</p>
                      <p class="note">Recipes show output icons, ingredient costs, and required stations.</p>
                    </div>
                    <div class="crafting-grid" data-crafting></div>
                  </section>

                  <section class="menu-view" data-menu-view="world">
                    <div class="menu-stack">
                      <article class="menu-card">
                        <p class="label">Status</p>
                        <p class="value" data-mobile-coords></p>
                        <p class="value small" data-tool></p>
                        <p class="value small" data-stations></p>
                      </article>
                      <article class="menu-card">
                        <p class="label">Device</p>
                        <p class="note" data-device-note></p>
                      </article>
                      <article class="menu-card">
                        <p class="label">World</p>
                        <button class="reset-button" type="button" data-reset>Reset world</button>
                        <p class="note">World edits and inventory persist in this browser until reset.</p>
                      </article>
                    </div>
                  </section>
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
  const inventory = root.querySelector<HTMLElement>('[data-inventory]');
  const crafting = root.querySelector<HTMLElement>('[data-crafting]');
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
  const menuTabs = [...root.querySelectorAll<HTMLButtonElement>('[data-menu-tab]')];
  const menuViews = [...root.querySelectorAll<HTMLElement>('[data-menu-view]')];

  if (
    !viewport ||
    !palette ||
    !prompt ||
    !coords ||
    !target ||
    !tool ||
    !stations ||
    !inventory ||
    !crafting ||
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

  let activeMenuTab: MenuTabId = 'inventory';
  let latestStatus: SandboxStatus | null = null;
  const safePrompt = prompt;
  const safeCoords = coords;
  const safeTarget = target;
  const safeTool = tool;
  const safeStations = stations;
  const safeInventory = inventory;
  const safeCrafting = crafting;
  const safeResetButton = resetButton;
  const safeDeviceNote = deviceNote;
  const safeMobileStatus = mobileStatus;
  const safeMobileCoords = mobileCoords;
  const safeTouchUi = touchUi;
  const safeLookSurface = lookSurface;

  const setActiveMenuTab = (nextTab: MenuTabId) => {
    activeMenuTab = nextTab;

    for (const tab of menuTabs) {
      tab.classList.toggle('active', tab.dataset.menuTab === nextTab);
    }

    for (const view of menuViews) {
      view.classList.toggle('active', view.dataset.menuView === nextTab);
    }
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

  const sandbox = createPlayableScene(viewport, applyStatus, touchControls);

  function applyStatus(status: SandboxStatus): void {
    latestStatus = status;
    safePrompt.textContent = status.prompt;
    safeCoords.textContent = status.coords;
    safeTarget.textContent = status.target;
    safeTool.textContent = `Best tool: ${status.selectedTool}`;
    safeStations.textContent = `Stations: ${status.stations}`;
    safeMobileStatus.textContent = status.touchDevice
      ? 'Minimal HUD active. Open the pack to inspect inventory and craft.'
      : 'Open the pack for inventory, crafting, and world actions.';
    safeMobileCoords.textContent = status.coords;
    safeTouchUi.classList.toggle('active', status.touchDevice);
    safeLookSurface.classList.toggle('active', status.touchDevice);
    safeDeviceNote.textContent = status.touchDevice
      ? 'Mobile keeps the screen clear for movement, mining, placing, and drag-look in landscape.'
      : 'Desktop keeps pointer-lock play clean and moves inventory and crafting into the pack menu.';

    safeInventory.innerHTML = renderInventoryEntries(status.inventory);
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

    if (latestStatus?.recipes.some((recipe) => recipe.available)) {
      setActiveMenuTab('crafting');
    }
  });

  for (const button of closeMenuButtons) {
    button.addEventListener('click', () => {
      setMenuOpen(false);
    });
  }

  for (const tab of menuTabs) {
    tab.addEventListener('click', () => {
      const nextTab = tab.dataset.menuTab as MenuTabId | undefined;

      if (nextTab) {
        setActiveMenuTab(nextTab);
      }
    });
  }

  safeResetButton.addEventListener('click', () => {
    sandbox.resetWorld();
    setActiveMenuTab('world');
  });

  setActiveMenuTab(activeMenuTab);
}
