import { createHarnessScene } from '../rendering/scene.ts';

export function createAppShell(root: HTMLDivElement): void {
  root.innerHTML = `
    <main class="shell">
      <section class="experience" aria-label="Minecraft clone harness">
        <div class="viewport" data-viewport>
          <div class="hud" aria-hidden="true">
            <div class="status-chip">Staging Biome</div>
            <div class="crosshair"></div>
            <div class="status-note">
              Dawn over a quiet plateau. The first slice starts with movement,
              mining, and block placement layered onto this world.
            </div>
          </div>
        </div>
        <aside class="sidebar">
          <header>
            <p class="eyebrow">Minecraft Clone</p>
            <h1 class="title">First light over the plateau</h1>
            <p class="lede">
              A calm proving ground for the opening survival loop: step into the
              biome, read the terrain, and prepare for the first interactive slice.
            </p>
          </header>

          <section class="panel">
            <h2>Slice goals</h2>
            <ul class="checklist">
              <li>
                <strong>Scout the terrain</strong>
                The camera circles a deterministic voxel plateau that will become the first
                spawn zone.
              </li>
              <li>
                <strong>Claim a first block</strong>
                The highlighted cube marks the next interaction target for mining and
                placement work.
              </li>
              <li>
                <strong>Grow into a playable loop</strong>
                Movement, collisions, inventory, and world mutation can layer onto this
                shell without replacing it.
              </li>
            </ul>
          </section>

          <section class="panel">
            <h2>World readout</h2>
            <ul class="stack">
              <li><strong>Biome</strong> Elevated grass plateau over dirt and stone</li>
              <li><strong>Lighting</strong> Warm morning sun with soft ambient fill</li>
              <li><strong>Focus point</strong> Highlight marker centered near the ridge</li>
              <li><strong>Next systems</strong> Movement, mining, placement, and HUD state</li>
            </ul>
          </section>

          <p class="stack-copy">
            The visible route stays in-world. Setup, validation, and repo workflow stay in
            the project docs.
          </p>
        </aside>
      </section>
    </main>
  `;

  const viewport = root.querySelector<HTMLElement>('[data-viewport]');

  if (!viewport) {
    throw new Error('Missing viewport container.');
  }

  createHarnessScene(viewport);
}
