import {
  type HotbarBlockType,
  PLACEABLE_BLOCK_ORDER,
  type PlaceableBlockType,
} from '../gameplay/blocks.ts';
import {
  createPlayableScene,
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
                    <h1>Playable voxel sandbox</h1>
                    <p class="hint" data-prompt></p>
                  </div>
                  <div class="panel panel-readout">
                    <p class="label">Coordinates</p>
                    <p class="value" data-coords></p>
                    <p class="label">Target</p>
                    <p class="value small" data-target></p>
                  </div>
                </div>
              </details>
            </div>

            <div class="crosshair" aria-hidden="true"></div>

            <div class="touch-ui" data-touch-ui aria-label="Mobile gameplay controls">
              <div class="touch-cluster touch-move">
                <p class="touch-label">Move</p>
                <div class="touch-stick" data-move-stick>
                  <div class="touch-stick-thumb" data-move-thumb></div>
                </div>
              </div>
              <div class="touch-cluster touch-look">
                <p class="touch-label">Look</p>
                <div class="touch-lookpad" data-look-pad>
                  <span>Drag</span>
                </div>
                <div class="touch-actions">
                  <button class="touch-button" type="button" data-jump>Jump</button>
                  <button class="touch-button" type="button" data-break>Mine</button>
                  <button class="touch-button" type="button" data-place>Place</button>
                </div>
                <div class="touch-hotbar-cycle">
                  <button class="touch-cycle" type="button" data-hotbar-prev>
                    Prev
                  </button>
                  <button class="touch-cycle" type="button" data-hotbar-next>
                    Next
                  </button>
                </div>
              </div>
            </div>

            <div class="hud-bottom">
              <div class="panel palette">
                <p class="label">Hotbar</p>
                <p class="note">Tap slots on mobile or use wheel and slot keys on desktop.</p>
                <div class="palette-row" data-palette></div>
              </div>
              <div class="panel panel-actions">
                <button class="reset-button" type="button" data-reset>
                  Reset world
                </button>
                <p class="note">
                  Local world edits persist in this browser until reset.
                </p>
                <p class="note" data-device-note></p>
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
  const resetButton = root.querySelector<HTMLButtonElement>('[data-reset]');
  const deviceNote = root.querySelector<HTMLElement>('[data-device-note]');
  const hud = root.querySelector<HTMLElement>('.hud');
  const hudDrawer = root.querySelector<HTMLDetailsElement>('[data-hud-drawer]');
  const mobileStatus = root.querySelector<HTMLElement>('[data-mobile-status]');
  const mobileCoords = root.querySelector<HTMLElement>('[data-mobile-coords]');
  const touchUi = root.querySelector<HTMLElement>('[data-touch-ui]');
  const moveStick = root.querySelector<HTMLElement>('[data-move-stick]');
  const moveThumb = root.querySelector<HTMLElement>('[data-move-thumb]');
  const lookPad = root.querySelector<HTMLElement>('[data-look-pad]');
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
    !moveStick ||
    !moveThumb ||
    !lookPad ||
    !jumpButton ||
    !breakButton ||
    !placeButton ||
    !hotbarPrevButton ||
    !hotbarNextButton
  ) {
    throw new Error('Missing touch control UI node.');
  }

  palette.innerHTML = BLOCK_ORDER.map(
    (type, index) => `
      <button class="swatch${index === 0 ? ' active' : ''}" type="button" data-block-type="${type}">
        <span class="swatch-chip swatch-${type}"></span>
        <span class="swatch-name">${type.replace('-', ' ')}</span>
        <span class="swatch-key">${index + 1}</span>
      </button>
    `,
  ).join('');

  const paletteButtons = [
    ...palette.querySelectorAll<HTMLButtonElement>('[data-block-type]'),
  ];
  const compactHudQuery = window.matchMedia('(max-width: 700px)');
  let touchMode = false;
  let compactHudActive = false;

  const updateCompactHud = () => {
    const nextCompactHud = touchMode && compactHudQuery.matches;

    if (nextCompactHud === compactHudActive) {
      return;
    }

    compactHudActive = nextCompactHud;
    hud.classList.toggle('compact-touch-hud', compactHudActive);
    hudDrawer.open = !compactHudActive;
  };

  const applyStatus = (status: SandboxStatus) => {
    touchMode = status.touchDevice;
    updateCompactHud();
    prompt.textContent = status.prompt;
    coords.textContent = status.coords;
    target.textContent = status.target;
    mobileStatus.textContent = status.touchDevice
      ? 'Move, drag to aim, then tap Mine or Place.'
      : 'Click to enter the world.';
    mobileCoords.textContent = status.coords;
    touchUi.classList.toggle('active', status.touchDevice);
    deviceNote.textContent = status.touchDevice
      ? 'Mobile supports drag-look, thumbstick movement, jump, mining, placing, and block switching.'
      : 'Desktop supports pointer-lock mining and placement.';

    for (const button of paletteButtons) {
      button.classList.toggle(
        'active',
        button.dataset.blockType === status.selectedBlock,
      );
    }
  };

  compactHudQuery.addEventListener('change', updateCompactHud);

  const touchControls: TouchUiControls = {
    root: touchUi,
    moveStick,
    moveThumb,
    lookPad,
    jumpButton,
    breakButton,
    placeButton,
    hotbarPrevButton,
    hotbarNextButton,
  };

  const sandbox = createPlayableScene(viewport, applyStatus, touchControls);

  for (const button of paletteButtons) {
    button.addEventListener('click', () => {
      const type = button.dataset.blockType as HotbarBlockType;
      sandbox.setSelectedBlock(type);
    });
  }

  resetButton.addEventListener('click', () => {
    sandbox.resetWorld();
  });
}
