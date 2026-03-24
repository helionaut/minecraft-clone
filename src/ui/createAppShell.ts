import { type PlaceableBlockType } from '../gameplay/blocks.ts';
import { createPlayableScene, type SandboxStatus } from '../rendering/scene.ts';

const BLOCK_ORDER: PlaceableBlockType[] = ['grass', 'sand', 'stone'];

export function createAppShell(root: HTMLDivElement): void {
  root.innerHTML = `
    <main class="shell">
      <section class="sandbox">
        <div class="viewport-wrap">
          <div class="viewport" data-viewport></div>
          <div class="hud" aria-live="polite">
            <div class="hud-top">
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

            <div class="crosshair" aria-hidden="true"></div>

            <div class="hud-bottom">
              <div class="panel palette">
                <p class="label">Build palette</p>
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

  if (!viewport || !palette || !prompt || !coords || !target || !resetButton || !deviceNote) {
    throw new Error('Missing sandbox UI node.');
  }

  palette.innerHTML = BLOCK_ORDER.map(
    (type, index) => `
      <button class="swatch${index === 0 ? ' active' : ''}" type="button" data-block-type="${type}">
        <span class="swatch-chip swatch-${type}"></span>
        <span>${type}</span>
        <span class="swatch-key">${index + 1}</span>
      </button>
    `,
  ).join('');

  const paletteButtons = [
    ...palette.querySelectorAll<HTMLButtonElement>('[data-block-type]'),
  ];

  const applyStatus = (status: SandboxStatus) => {
    prompt.textContent = status.prompt;
    coords.textContent = status.coords;
    target.textContent = status.target;
    deviceNote.textContent = status.touchDevice
      ? 'Mobile layout is view-only for this milestone.'
      : 'Desktop supports pointer-lock mining and placement.';

    for (const button of paletteButtons) {
      button.classList.toggle(
        'active',
        button.dataset.blockType === status.selectedBlock,
      );
    }
  };

  const sandbox = createPlayableScene(viewport, applyStatus);

  for (const button of paletteButtons) {
    button.addEventListener('click', () => {
      const type = button.dataset.blockType as PlaceableBlockType;
      sandbox.setSelectedBlock(type);
    });
  }

  resetButton.addEventListener('click', () => {
    sandbox.resetWorld();
  });
}
