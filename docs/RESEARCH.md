# Research Notes

## HEL-142 - WebGPU startup frame spikes on RTX desktop Chrome

Date: 2026-03-30
Status: blocked on missing execution surface

### Strategic context

HEL-139 reported 100-700ms `requestAnimationFrame` stalls and WebGPU device loss on a desktop Chrome Incognito session with an RTX 3080. This follow-up needs a profiler-backed startup breakdown on comparable hardware.

### Changed variable for this pass

Attempted to execute the profiling pass from the current Symphony host workspace instead of an RTX-class desktop Chrome machine.

### Environment check results

- `git branch --show-current` now matches the issue branch `eugeniy/hel-142-profile-desktop-frame-spikes-on-rtx-chrome-for-webgpu-scene`.
- No system Chrome binary was present: `google-chrome` and `chromium` were both missing on this host.
- No NVIDIA tooling was present: `nvidia-smi` was not available on this host.
- Repo-local Chrome-for-Testing could be downloaded and launched from the issue workspace, but default headless and flagged/headed `xvfb-run` launches both still reported `navigator.gpu === false`.
- The flagged headed probe reported WebGL renderer `ANGLE (Mesa, llvmpipe (LLVM 20.1.2 256 bits), OpenGL 4.5)`, which confirms software rendering rather than RTX-backed acceleration on this host.
- That makes the ticket's requested execution surface unavailable on this machine before any profiler trace can be captured.
- A manual `workflow_dispatch` deployment attempt for this PR branch built successfully but failed at the Pages deploy gate because the `github-pages` environment rejects this branch under its custom branch policy.

### Code-backed startup suspects to profile on the next pass

1. WebGPU renderer initialization in `src/rendering/sceneRenderer.ts`
   - `navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })`
   - `await renderer.init()`
   - If the stall is GPU pipeline setup or device bootstrap, this is the first high-value segment.
2. RTX-only volumetric material setup in `src/rendering/scene.ts` and `src/rendering/desktopVolumetricLighting.ts`
   - `createDesktopVolumetricLightVolume()`
   - `new VolumeNodeMaterial(...)`
   - This is the most RTX-specific startup path in the current scene setup.
3. Initial world rebuild in `src/rendering/scene.ts`
   - `rebuildWorld()`
   - `computeVoxelLighting(...)`
   - `world.forEachLoadedBlockInBounds(...)` with per-voxel `new Mesh(...)`
   - If the stall is CPU-bound main-thread work, this is the strongest non-GPU suspect.

### What was eliminated on this host

- A local reproduction on the required surface was not possible.
- Chrome/WebGPU diagnostics and Chrome Performance traces could not be captured truthfully here.
- Any conclusion about RTX-specific startup spikes would be speculative from this machine.

### Control experiment on the invalid local browser surface

- The published profiling lane was run end-to-end against a local preview on this host using bundled Chromium with `PLAYWRIGHT_PROFILE_BROWSER_CHANNEL=''`.
- Result: the run failed at the new runtime guard, not at startup-profile collection. `runtime-status.json` reported:
  - `browserSupportsWebGpu: true`
  - renderer status string: `WebGL 2 | software fallback | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) | volumetric lighting disabled (software-renderer)`
  - WebGL renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`
- The run still emitted control artifacts under `reports/startup-profiling/test-results/...`, including `chrome-performance-trace.json`, `console-messages.json`, `runtime-status.json`, `startup-shell.png`, and `trace.zip`.
- Control-only startup profile summary on that invalid surface:
  - `initial-rebuild-world`: about `2178.3ms`
  - `create-scene-renderer`: about `29.5ms`
  - `initial-sync-size`: about `18.1ms`
  - `initial-status-publish`: about `16.2ms`
  - `longFrameCount`: `30`
  - `maxFrameDurationMs`: about `2566.4ms`
- This does not prove the RTX behavior, but it does eliminate one weak hypothesis on the local control surface: browser/bootstrap overhead was not the dominant startup cost there; world rebuild work dominated instead.

### Instrumentation prepared in this pass

- The scene startup path now supports `?startupProfile=1`.
- The existing QA harness now exposes `window.__minecraftCloneQa.getStartupProfile()`.
- A dedicated Playwright profiling lane now exists via `npm run profile:webgpu-startup`.
- The startup profile records phase timings for:
  - `create-scene-renderer`
  - `create-desktop-volumetric-light-volume`
  - `initial-rebuild-world`
  - `initial-sync-size`
  - `initial-status-publish`
  - `initial-sync-frame-visuals` when running with the frozen spawn frame harness
- The profile also captures early frame durations so the next RTX pass can see whether long frames continue after startup.

### Next-pass profiling checklist on an RTX desktop Chrome machine

1. Serve this PR branch from the RTX desktop machine itself so Playwright hits the profiling instrumentation from `5bcf209` instead of the `main` GitHub Pages site:

   ```bash
   git checkout eugeniy/hel-142-profile-desktop-frame-spikes-on-rtx-chrome-for-webgpu-scene
   npm ci
   npm run build
   npm run preview -- --host 127.0.0.1 --port 4173
   ```

2. In a second shell on the same RTX machine, run the committed profiling lane against that local preview:

   ```bash
   PLAYWRIGHT_BASE_URL="http://127.0.0.1:4173/minecraft-clone/" \
   PLAYWRIGHT_PROFILE_BROWSER_CHANNEL=chrome \
   npm run profile:webgpu-startup
   ```

   The wrapper validates `PLAYWRIGHT_BASE_URL`, defaults the browser channel to `chrome`, and prints the artifact directory before launching Playwright. Use `PLAYWRIGHT_PROFILE_DRY_RUN=1` for a preflight check without starting the browser.

3. If a hosted preview is preferred instead of a local preview, first loosen the `github-pages` environment branch policy or merge the profiling branch to `main`; the current Pages site at `https://helionaut.github.io/minecraft-clone/` serves `main`, not PR #52.

4. The profiling run will open `?renderer=webgpu&qaHarness=1&startupProfile=1` and write artifacts under `reports/startup-profiling/` including:
   - `chrome-performance-trace.json`
   - `console-messages.json`
   - `runtime-status.json`
   - `startup-profile.json`
   - `startup-profile-summary.json`
   - `startup-shell.png`
5. Record whether the app falls back to safe mode after device loss.
6. Break down startup cost across:
   - `createSceneRenderer()` / `renderer.init()`
   - volumetric light volume creation
   - first `rebuildWorld()`
   - early frame loop spikes after startup

### Infrastructure required to finish the original ask

- Desktop Chrome with WebGPU available
- RTX-class GPU with working hardware acceleration and driver visibility
- A local checkout of PR #52 on that RTX machine, or a hosted preview path that is allowed to deploy this branch
- Ability to collect Chrome Performance traces and browser console exports from that machine
