import { createHarnessScene } from '../rendering/scene.ts';

export function createAppShell(root: HTMLDivElement): void {
  root.innerHTML = `
    <main class="shell">
      <section class="experience" aria-label="Minecraft clone harness">
        <div class="viewport" data-viewport>
          <div class="hud" aria-hidden="true">
            <div class="status-chip">Vertical Slice Staging Ground</div>
            <div class="crosshair"></div>
            <div class="status-note">
              Three.js is rendering a deterministic voxel plateau here. Gameplay
              systems, input, collisions, and world mutation will layer on this
              shell without replacing the harness.
            </div>
          </div>
        </div>
        <aside class="sidebar">
          <header>
            <p class="eyebrow">Minecraft Clone</p>
            <h1 class="title">Browser voxel harness</h1>
            <p class="lede">
              A lightweight app shell for the first playable loop. The main route
              stays product-shaped while engineering workflow lives in commands,
              CI, and docs.
            </p>
          </header>

          <section class="panel">
            <h2>Ready for HEL-100</h2>
            <ul class="checklist">
              <li>
                <strong>Gameplay logic</strong>
                Pure world generation lives in testable modules before any UI-heavy flow.
              </li>
              <li>
                <strong>Rendering layer</strong>
                Three.js setup is isolated to a dedicated rendering module.
              </li>
              <li>
                <strong>Validation path</strong>
                One aggregate command verifies lint, types, tests, and production build.
              </li>
            </ul>
          </section>

          <section class="panel">
            <h2>Current stack</h2>
            <ul class="stack">
              <li><strong>Build</strong> Vite + TypeScript</li>
              <li><strong>Rendering</strong> Three.js scene harness</li>
              <li><strong>Tests</strong> Vitest for world and block logic</li>
              <li><strong>Checks</strong> ESLint, typecheck, unit tests, build</li>
            </ul>
            <div class="pill-row" aria-label="Stack tags">
              <span class="pill">Vite</span>
              <span class="pill">TypeScript</span>
              <span class="pill">Three.js</span>
              <span class="pill">Vitest</span>
            </div>
            <div class="code">npm run dev</div>
          </section>

          <p class="stack-copy">
            Repo docs explain where gameplay logic, rendering code, tests, and static
            assets should go next.
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
