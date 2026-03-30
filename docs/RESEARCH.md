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
- A local Playwright Chromium probe succeeded, but reported `navigator.gpu === false`, so the browser runtime available here does not expose WebGPU.
- That makes the ticket's requested execution surface unavailable on this machine before any profiler trace can be captured.

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

1. Run the committed profiling lane against the RTX Chrome target:

   ```bash
   PLAYWRIGHT_BASE_URL="https://<target-host-or-preview>" \
   PLAYWRIGHT_PROFILE_BROWSER_CHANNEL=chrome \
   npm run profile:webgpu-startup
   ```

2. The profiling run will open `?renderer=webgpu&qaHarness=1&startupProfile=1` and write artifacts under `reports/startup-profiling/` including:
   - `chrome-performance-trace.json`
   - `console-messages.json`
   - `runtime-status.json`
   - `startup-profile.json`
   - `startup-profile-summary.json`
   - `startup-shell.png`
3. Record whether the app falls back to safe mode after device loss.
4. Break down startup cost across:
   - `createSceneRenderer()` / `renderer.init()`
   - volumetric light volume creation
   - first `rebuildWorld()`
   - early frame loop spikes after startup

### Infrastructure required to finish the original ask

- Desktop Chrome with WebGPU available
- RTX-class GPU with working hardware acceleration and driver visibility
- Ability to collect Chrome Performance traces and browser console exports from that machine
