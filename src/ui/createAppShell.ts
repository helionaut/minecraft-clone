import {
  type HotbarBlockType,
  PLACEABLE_BLOCK_ORDER,
  type PlaceableBlockType,
} from '../gameplay/blocks.ts';
import {
  createPlayableScene,
  type RecipeStatusEntry,
  type SandboxStatus,
  type TouchUiControls,
} from '../rendering/scene.ts';

const BLOCK_ORDER: readonly PlaceableBlockType[] = PLACEABLE_BLOCK_ORDER;

export function createAppShell(root: HTMLDivElement): void {
  root.innerHTML = `
    <main class="shell">
      <section class="sandbox">
        <div class="viewport-wrap">
          <div class="viewport" data-viewport></div>
          <div class="hud" aria-live="polite">
            <div class="hud-top">
              <details class="hud-drawer" data-hud-drawer open>
                <summary class="hud-summary">
                  <div class="hud-summary-copy">
                    <p class="eyebrow">Minecraft Clone</p>
                    <p class="hud-summary-status" data-mobile-status></p>
                  </div>
                  <p class="hud-summary-coords" data-mobile-coords></p>
                </summary>
                <div class="hud-drawer-panels">
                  <div class="panel panel-title">
                    <p class="eyebrow">Minecraft Clone</p>
                    <h1>Infinite voxel sandbox</h1>
                    <p class="hint" data-prompt></p>
                  </div>
                  <div class="panel panel-readout">
                    <p class="label">Coordinates</p>
                    <p class="value" data-coords></p>
                    <p class="label">Target</p>
                    <p class="value small" data-target></p>
                    <p class="label">Best tool</p>
                    <p class="value small" data-tool></p>
                    <p class="label">Stations</p>
                    <p class="value small" data-stations></p>
                  </div>
                </div>
              </details>
            </div>

            <div class="crosshair" aria-hidden="true"></div>
            <div class="touch-look-surface" data-look-surface aria-hidden="true">
              <span class="touch-look-hint">Drag anywhere to look</span>
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

            <div class="hud-bottom">
              <div class="panel palette">
                <p class="label">Hotbar</p>
                <p class="note">Place blocks from your inventory. Mine materials to refill empty slots.</p>
                <div class="palette-row" data-palette></div>
              </div>
              <div class="panel panel-actions">
                <button class="reset-button" type="button" data-reset>Reset world</button>
                <p class="note">World edits and inventory persist in this browser until reset.</p>
                <p class="note" data-device-note></p>
              </div>
            </div>

            <div class="hud-bottom hud-bottom-secondary">
              <div class="panel">
                <p class="label">Inventory</p>
                <div class="inventory-list" data-inventory></div>
              </div>
              <div class="panel">
                <p class="label">Crafting</p>
                <div class="crafting-list" data-crafting></div>
              </div>
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
  const hud = root.querySelector<HTMLElement>('.hud');
  const hudDrawer = root.querySelector<HTMLDetailsElement>('[data-hud-drawer]');
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
    !hud ||
    !hudDrawer ||
    !mobileStatus ||
    !mobileCoords
  ) {
    throw new Error('Missing sandbox UI node.');
  }

  if (
    !touchUi ||
    !lookSurface ||
    !moveStick ||
    !moveThumb ||
    !jumpButton ||
    !breakButton ||
    !placeButton ||
    !hotbarPrevButton ||
    !hotbarNextButton
  ) {
    throw new Error('Missing touch control UI node.');
  }

  const safePrompt = prompt;
  const safeCoords = coords;
  const safeTarget = target;
  const safeTool = tool;
  const safeStations = stations;
  const safeInventory = inventory;
  const safeCrafting = crafting;
  const safeResetButton = resetButton;
  const safeDeviceNote = deviceNote;
  const safeHud = hud;
  const safeHudDrawer = hudDrawer;
  const safeMobileStatus = mobileStatus;
  const safeMobileCoords = mobileCoords;
  const safeTouchUi = touchUi;
  const safeLookSurface = lookSurface;
  const safeMoveStick = moveStick;
  const safeMoveThumb = moveThumb;
  const safeJumpButton = jumpButton;
  const safeBreakButton = breakButton;
  const safePlaceButton = placeButton;
  const safeHotbarPrevButton = hotbarPrevButton;
  const safeHotbarNextButton = hotbarNextButton;

  palette.innerHTML = BLOCK_ORDER.map(
    (type, index) => `
      <button class="swatch${index === 0 ? ' active' : ''}" type="button" data-block-type="${type}">
        <span class="swatch-chip swatch-${type}"></span>
        <span class="swatch-name">${type.replace('-', ' ')}</span>
        <span class="swatch-key">${index + 1}</span>
        <span class="swatch-count" data-count-for="${type}">0</span>
      </button>
    `,
  ).join('');

  const paletteButtons = [...palette.querySelectorAll<HTMLButtonElement>('[data-block-type]')];
  const compactHudQuery = window.matchMedia('(max-width: 700px)');
  const compactLandscapeQuery = window.matchMedia('(max-height: 560px)');
  let touchMode = false;
  let compactHudActive = false;

  const updateCompactHud = () => {
    const nextCompactHud = touchMode && (compactHudQuery.matches || compactLandscapeQuery.matches);

    if (nextCompactHud === compactHudActive) {
      return;
    }

    compactHudActive = nextCompactHud;
    safeHud.classList.toggle('compact-touch-hud', compactHudActive);
    safeHudDrawer.open = !compactHudActive;
  };

  const touchControls: TouchUiControls = {
    root: safeTouchUi,
    lookSurface: safeLookSurface,
    moveStick: safeMoveStick,
    moveThumb: safeMoveThumb,
    jumpButton: safeJumpButton,
    breakButton: safeBreakButton,
    placeButton: safePlaceButton,
    hotbarPrevButton: safeHotbarPrevButton,
    hotbarNextButton: safeHotbarNextButton,
  };

  const sandbox = createPlayableScene(viewport, applyStatus, touchControls);

  function renderRecipes(recipes: readonly RecipeStatusEntry[]): void {
    safeCrafting.innerHTML = recipes.map((recipe) => `
      <button
        class="craft-button${recipe.available ? ' available' : ''}"
        type="button"
        data-recipe-id="${recipe.id}"
        ${recipe.available ? '' : 'disabled'}
      >
        <span>${recipe.label}</span>
        <span>${recipe.station ?? 'hand recipe'}</span>
      </button>
    `).join('');

    for (const button of safeCrafting.querySelectorAll<HTMLButtonElement>('[data-recipe-id]')) {
      button.addEventListener('click', () => {
        const recipeId = button.dataset.recipeId;

        if (recipeId) {
          sandbox.craftRecipe(recipeId);
        }
      });
    }
  }

  function applyStatus(status: SandboxStatus): void {
    touchMode = status.touchDevice;
    updateCompactHud();
    safePrompt.textContent = status.prompt;
    safeCoords.textContent = status.coords;
    safeTarget.textContent = status.target;
    safeTool.textContent = status.selectedTool;
    safeStations.textContent = status.stations;
    safeMobileStatus.textContent = status.touchDevice
      ? 'Mine, place, and craft from the drawer.'
      : 'Click to enter the world.';
    safeMobileCoords.textContent = status.coords;
    safeTouchUi.classList.toggle('active', status.touchDevice);
    safeLookSurface.classList.toggle('active', status.touchDevice);
    safeDeviceNote.textContent = status.touchDevice
      ? 'Mobile supports movement, drag-look, mining, placing, and crafting from the HUD.'
      : 'Desktop supports pointer-lock mining, placement, chunk streaming, and crafting.';
    safeInventory.innerHTML = status.inventory.length > 0
      ? status.inventory.map((entry) => `<p>${entry.type.replaceAll('-', ' ')} x${entry.count}</p>`).join('')
      : '<p>Inventory empty. Mine logs, stone, and ore to start progression.</p>';
    renderRecipes(status.recipes);

    for (const button of paletteButtons) {
      const blockType = button.dataset.blockType ?? '';
      button.classList.toggle('active', blockType === status.selectedBlock);
      const countNode = button.querySelector<HTMLElement>(`[data-count-for="${blockType}"]`);

      if (countNode) {
        countNode.textContent = String(status.placeableCounts[blockType] ?? 0);
      }
    }
  }

  compactHudQuery.addEventListener('change', updateCompactHud);
  compactLandscapeQuery.addEventListener('change', updateCompactHud);

  for (const button of paletteButtons) {
    button.addEventListener('click', () => {
      const type = button.dataset.blockType as HotbarBlockType;
      sandbox.setSelectedBlock(type);
    });
  }

  safeResetButton.addEventListener('click', () => {
    sandbox.resetWorld();
  });
}
