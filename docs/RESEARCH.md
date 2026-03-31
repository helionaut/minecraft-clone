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
- No Linux system Chrome binary was present in PATH: `google-chrome` and `chromium` were both missing inside WSL.
- No Linux `nvidia-smi` was present in PATH inside WSL.
- Repo-local Chrome-for-Testing could be downloaded and launched from the issue workspace, but default headless and flagged/headed `xvfb-run` launches both still reported `navigator.gpu === false`.
- The flagged headed probe reported WebGL renderer `ANGLE (Mesa, llvmpipe (LLVM 20.1.2 256 bits), OpenGL 4.5)`, which confirms software rendering rather than RTX-backed acceleration on this host.
- A later host probe showed that the underlying Windows machine does expose a real browser/GPU stack to WSL:
  - Chrome exists at `/mnt/c/Program Files/Google/Chrome/Application/chrome.exe`
  - Windows `nvidia-smi.exe` exists at `/mnt/c/Windows/System32/nvidia-smi.exe`
  - `nvidia-smi.exe` reports `NVIDIA GeForce GTX 965M`, driver `582.28`, and active Chrome GPU processes
- That Windows-backed path still fails as a profiling surface from this session:
  - `PLAYWRIGHT_PROFILE_EXECUTABLE_PATH=/mnt/c/Program Files/Google/Chrome/Application/chrome.exe npm run profile:webgpu-startup:local-preview` fails before navigation because Playwright launches Chrome with `--remote-debugging-pipe`, and Windows Chrome exits with `Remote debugging pipe file descriptors are not open`
  - manually launching Windows Chrome with `--remote-debugging-port=9222` succeeds on the Windows side, but WSL cannot connect to that endpoint on either `127.0.0.1` or the Windows host IP, so `connectOverCDP` is not currently reachable from this session either
  - the Windows host does not have `node` or `npm`, so the profiling wrapper cannot be moved wholesale to the Windows side without extra bootstrap work
  - this WSL session also exposes no usable Windows interop bridge of its own: `WSL_INTEROP` is empty, and directly invoking `/mnt/c/Windows/System32/cmd.exe`, `powershell.exe`, or `chrome.exe` still fails with `Invalid argument` even when `WSL_INTEROP` is set manually to the discovered `/run/WSL/*_interop` sockets
  - a follow-up probe on 2026-03-31 showed `wslinfo --networking-mode` returning `nat` and `/proc/sys/fs/binfmt_misc/WSLInterop` enabled, so the remaining transport problem is narrower than a disabled WSL feature: the guest can see the interop bridge and Windows filesystems, but Windows process launch still fails from this session
- Even if that transport problem were removed, the visible adapter on this machine is GTX 965M rather than the RTX-class hardware named in the issue
- The attached Playwright MCP browser surface was also checked and is not usable here: it is configured for system Chrome at `/opt/google/chrome/chrome`, that binary is missing, and an unattended `npx playwright install chrome` attempt fails because it requires `sudo`.
- The profiling wrapper has since been hardened to accept `PLAYWRIGHT_PROFILE_EXECUTABLE_PATH`, so the eventual RTX run can point directly at a Chrome-for-Testing or locally installed Chrome binary without depending on Playwright channel discovery.
- MCP discovery returned zero configured resources and zero resource templates, so there is no off-host browser or GPU execution surface hidden behind the current environment.
- GitHub Actions also does not provide a hidden fallback execution lane here: the repo currently has zero registered self-hosted runners, and `.github/workflows/ci.yml` runs PR validation only on `ubuntu-latest`.
- A sharper limitation emerged after publishing `.github/workflows/profile-webgpu-startup.yml`: GitHub does not register or dispatch that `workflow_dispatch` lane while it exists only on the PR branch. `gh workflow list` and `GET /repos/helionaut/minecraft-clone/actions/workflows` still expose only `CI`, `Deploy Pages`, and `PRD Docs`, and direct dispatch/get requests for `profile-webgpu-startup.yml` return `404 workflow ... not found on the default branch`.
- That leaves the ticket's requested RTX execution surface unavailable from this machine before any truthful target-surface profiler trace can be captured.
- A manual `workflow_dispatch` deployment attempt for this PR branch built successfully but failed at the Pages deploy gate because the `github-pages` environment rejects this branch under its custom branch policy.

### Windows-side host capture from this pass

- Changed variable:
  - kept the preview/build on WSL, but moved the profiling runtime itself onto Windows by using a portable Windows Node v22.22.1 toolchain from the shared cache
  - bypassed the UNC workspace limitations by staging a minimal Windows-local runtime bundle under `/mnt/c/Temp/hel142-startup-runtime/` containing `scripts/captureWebGpuStartupProfileOverCdp.mjs` plus `node_modules/playwright-core`
  - the repo now includes `npm run profile:webgpu-startup:stage-windows-runtime` to regenerate that Windows-local runtime bundle from WSL without recreating the copy steps manually
  - that staged bundle now carries the helper/report/compare/upload-manifest scripts plus the committed Intel control baseline, so `run-startup-profile.cmd` can emit `startup-profile-report.*`, `startup-profile-comparison.*`, and `startup-profile-upload-manifest.*` directly on the Windows side, and it will also try to package the whole result as `startup-profile-upload-bundle.zip`
- Result:
  - the Windows-local runtime bundle successfully launched `C:\Program Files\Google\Chrome\Application\chrome.exe`, hit the WSL preview URL `http://127.0.0.1:4174/minecraft-clone/`, and wrote a new artifact bundle to `reports/startup-profiling/test-results/windows-host-runtime-attempt/`
  - generated artifacts now include:
    - `chrome-performance-trace.json`
    - `console-messages.json`
    - `runtime-status.json`
    - `startup-profile.json`
    - `startup-profile-summary.json`
    - `startup-profile-report.json`
    - `startup-profile-report.md`
    - `startup-shell.png`
- Runtime classification:
  - `navigator.gpu` was available
  - the app did not stay on desktop WebGPU rendering; status text reported `WebGL 2 | hardware accelerated | ANGLE (Intel, Intel(R) HD Graphics 4600 ...) | volumetric lighting disabled (webgpu-fallback-adapter)`
  - `webglRenderer` was `ANGLE (Intel, Intel(R) HD Graphics 4600 (0x00000416) Direct3D11 vs_5_0 ps_5_0, D3D11)`
  - that makes this run a truthful hardware-accelerated desktop control on integrated Intel graphics, not the requested RTX Chrome proof
- Findings from `startup-profile-report.json`:
  - startup total duration: about `2762.3ms`
  - long frames after startup: `19`
  - max frame duration: about `2527.5ms`
  - dominant startup bucket remained `initial-rebuild-world` at about `2142.7ms`
  - the largest measured subphase inside that bucket was `initial-rebuild-world:compute-lighting` at about `1302.0ms`
  - `create-scene-renderer` was materially smaller at about `480.8ms`
  - `initial-rebuild-world:rebuild-visible-meshes` was about `437.7ms`
  - `initial-rebuild-world:sync-chunks` was about `402.5ms`
  - top trace hotspots were still main-thread `RunTask`/microtask spans, with the top GPU/compositor setup hotspot around `GpuChannelHost::CreateViewCommandBuffer` / `CommandBufferProxyImpl::Initialize` at about `170ms`
  - committed baseline summary artifact: `artifacts/startup-profiling-baselines/hel-142-windows-intel-control-startup-profile-report.md`
- What this eliminates:
  - on a real hardware-accelerated desktop Chrome surface, even outside SwiftShader, the strongest startup suspect is still synchronous world rebuild work rather than pure renderer bootstrap
  - the leading sub-suspect is now narrower than the original hypothesis: `computeVoxelLighting(...)` inside the first `rebuildWorld()` pass is the largest measured startup subphase on this host run
- What still remains unproven:
  - this machine still does not satisfy the issue's RTX requirement
  - the visible NVIDIA adapter from WSL is GTX 965M, while the successful hardware-accelerated browser run actually bound to Intel HD 4600
  - the earlier SwiftShader-only control report was not durable enough to keep as the default comparison baseline, so the branch now publishes a committed hardware-accelerated control report at `artifacts/startup-profiling-baselines/hel-142-windows-intel-control-startup-profile-report.json`
  - a follow-up WSL session on 2026-03-31 confirmed an additional transport limit: `/dev/dxg` and the Windows Chrome path are visible, but direct execution of `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`, `cmd.exe`, and `chrome.exe` failed with `Invalid argument`, so the previously working Windows-local runtime bundle cannot be relaunched from every runner

### Current profiler-backed findings summary

- Source artifact bundle: `reports/startup-profiling/test-results/windows-host-runtime-attempt/`
- Surface classification: desktop Chrome with hardware acceleration and `navigator.gpu`, but the runtime still fell back to `WebGL 2 | hardware accelerated | ANGLE (Intel, Intel(R) HD Graphics 4600 ...) | volumetric lighting disabled (webgpu-fallback-adapter)`, so this is a control run rather than RTX proof
- Dominant startup phase:
  - `initial-rebuild-world`: about `2142.7ms` out of `2762.3ms` total startup
- Dominant nested startup suspect:
  - `initial-rebuild-world:compute-lighting`: about `1302.0ms`
- Secondary startup suspects:
  - `create-scene-renderer`: about `480.8ms`
  - `initial-rebuild-world:rebuild-visible-meshes`: about `437.7ms`
  - `initial-rebuild-world:sync-chunks`: about `402.5ms`
- Post-startup behavior:
  - `19` long frames after startup
  - max frame duration about `2527.5ms`
- Trace shape:
  - dominant main-thread work remained long `RunTask` / microtask spans around the first scene startup window
  - the largest GPU/compositor setup slice was only about `170ms` (`GpuChannelHost::CreateViewCommandBuffer` / `CommandBufferProxyImpl::Initialize`)

### Prioritized remediation candidates from the current control run

1. `initial-rebuild-world:compute-lighting`
   - strongest measured nested suspect in the current desktop control run
   - first RTX follow-up should split this further into `seed-sunlight-columns`, `seed-emissive-blocks`, and `propagate-light-queue`
2. `initial-rebuild-world:rebuild-visible-meshes`
   - second world-rebuild suspect after lighting
   - compare `worldGroup.clear()` and per-block `new Mesh(...)` rebuild cost against the lighting pass
3. `initial-rebuild-world`
   - the broad parent phase still dominates startup overall, so chunk sync, voxel iteration, and scene rebuild work remain higher priority than renderer bootstrap
4. `post-startup frame loop`
   - `19` long frames after startup mean the follow-up RTX trace should still inspect the first interactive seconds, not only the initial load

### Eliminated or narrowed suspects from the current control run

- Pure renderer bootstrap is not the leading suspect on this hardware-accelerated desktop control surface:
  - `create-scene-renderer` measured about `480.8ms`, well below `initial-rebuild-world` and `initial-rebuild-world:compute-lighting`
- The startup problem is not explained only by software rendering:
  - the successful Windows-host control run was hardware accelerated on Intel graphics, yet the same broad startup pattern still favored synchronous world rebuild work
- The RTX-specific volumetric/material path remains unproven rather than confirmed:
  - this control run never stayed on desktop WebGPU and disabled volumetric lighting through the fallback adapter path, so RTX-only conclusions still require the target machine

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

- The published profiling lane was run end-to-end against a local preview on this host using a portable Chrome for Testing binary via `PLAYWRIGHT_PROFILE_EXECUTABLE_PATH`.
- Result: the run failed at the new runtime guard, not at startup-profile collection. `runtime-status.json` reported:
  - `browserSupportsWebGpu: true`
  - renderer status string: `WebGL 2 | software fallback | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) | volumetric lighting disabled (software-renderer)`
  - WebGL renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`
- The run still emitted control artifacts under `reports/startup-profiling/test-results/webgpuStartup.profile-capt-28d63-e-WebGPU-scene-startup-path/`, including `chrome-performance-trace.json`, `console-messages.json`, `runtime-status.json`, `startup-shell.png`, and `trace.zip`.
- Control-only startup profile summary on that invalid surface:
  - `initial-rebuild-world`: about `2420.8ms`
  - `create-scene-renderer`: about `31.2ms`
  - `initial-sync-size`: about `21.0ms`
  - `initial-status-publish`: about `16.8ms`
  - `longFrameCount`: `44`
  - `maxFrameDurationMs`: about `3133.2ms`
- The current desktop startup configuration makes that `initial-rebuild-world` phase broad enough to hide several expensive substeps inside one measurement:
  - visible bounds at spawn cover `3 x 3` chunks (`renderChunkRadius: 1` with `chunkSize: 16`), or a `48 x 48` horizontal footprint
  - lighting expands that volume by one cell on `x/z` and one level above `y`, so `computeVoxelLighting()` can scan roughly `50 x 35 x 50` cells near spawn before propagation work even begins
  - the same phase then calls `worldGroup.clear()` and recreates one `Mesh` per visible loaded block inside `world.forEachLoadedBlockInBounds(...)`
- The Chrome trace and console export from that same control run also showed repeated `GPU stall due to ReadPixels` warnings and multiple main-thread `RunTask` spans between roughly `544ms` and `2707ms`.
- A manually generated control report now exists in the same artifact directory as `startup-profile-report.json` and `startup-profile-report.md`. Its top GPU/compositor hotspots were `GLES2::ReadPixels` and command-buffer wait calls around `570-579ms`, which makes the current local trace a useful software-rendered baseline for later RTX comparison.
- This does not prove the RTX behavior, but it does eliminate one weak hypothesis on the local control surface: browser/bootstrap overhead was not the dominant startup cost there. The first remediation candidate to compare on RTX is the synchronous `rebuildWorld()` path in `src/rendering/scene.ts`, especially `computeVoxelLighting(...)`, `worldGroup.clear()`, and the per-block `new Mesh(...)` rebuild loop.

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
- The lighting startup subphases now also carry workload counts in the emitted startup profile and generated markdown report:
  - `seed-sunlight-columns` records `columnCount` and `cellVisits`
  - `seed-emissive-blocks` records `scannedCells` and `emissiveBlocks`
  - `propagate-light-queue` records `queueSeeds`, `processedEntries`, `neighborChecks`, and propagation-time `lightWrites`
- The profile also captures early frame durations so the next RTX pass can see whether long frames continue after startup.

### Next-pass profiling checklist on an RTX desktop Chrome machine

0. If this repository later gains a suitable self-hosted Windows runner with labels `self-hosted`, `windows`, `x64`, and `gpu`, the lowest-ceremony path can be a GitHub Actions dispatch, but only after `.github/workflows/profile-webgpu-startup.yml` exists on `main` (or whatever branch GitHub treats as the default workflow source):

   - open the `Profile WebGPU Startup` workflow in GitHub Actions
   - dispatch it against ref `eugeniy/hel-142-profile-desktop-frame-spikes-on-rtx-chrome-for-webgpu-scene`
   - set `chrome_executable_path` if the runner cannot expose Chrome via the default channel lookup
   - keep `require_rtx=true` for the real proof run

   That workflow runs `npm run profile:webgpu-startup:local-preview` on the self-hosted Windows/GPU runner and uploads `reports/startup-profiling` as `webgpu-startup-profile-<run-id>`. Until the workflow lands on `main`, the operator must use the manual local-preview commands below rather than the GitHub Actions UI/API.

1. Serve this PR branch from the RTX desktop machine itself so Playwright hits the current profiling instrumentation from the latest published PR #52 head instead of the `main` GitHub Pages site:

   ```bash
   git checkout eugeniy/hel-142-profile-desktop-frame-spikes-on-rtx-chrome-for-webgpu-scene
   git pull --ff-only
   npm ci
   npm run build
   npm run preview -- --host 127.0.0.1 --port 4173
   ```

2. In a second shell on the same RTX machine, run the committed profiling lane against that local preview:

   ```bash
   PLAYWRIGHT_BASE_URL="http://127.0.0.1:4173/minecraft-clone/" \
   npm run profile:webgpu-startup
   ```

   The wrapper validates `PLAYWRIGHT_BASE_URL`, defaults the browser channel to `chrome`, requires an RTX-class renderer by default, and prints the artifact directory before launching Playwright. Use `PLAYWRIGHT_PROFILE_DRY_RUN=1` for a preflight check without starting the browser.

   If the RTX machine does not expose Chrome as a Playwright channel, point the wrapper at an explicit binary instead:

   ```bash
   PLAYWRIGHT_BASE_URL="http://127.0.0.1:4173/minecraft-clone/" \
   PLAYWRIGHT_PROFILE_EXECUTABLE_PATH="/absolute/path/to/chrome" \
   npm run profile:webgpu-startup
   ```

   If the operator is intentionally collecting a non-RTX control run instead of the requested proof, disable the default RTX gate explicitly:

   ```bash
   PLAYWRIGHT_BASE_URL="http://127.0.0.1:4173/minecraft-clone/" \
   PLAYWRIGHT_PROFILE_REQUIRE_RTX=0 \
   npm run profile:webgpu-startup
   ```

   If the operator is starting from WSL on a Windows-backed machine and needs to recreate the minimal Windows-local runtime bundle first, run:

   ```bash
   PLAYWRIGHT_PROFILE_DRY_RUN=1 npm run profile:webgpu-startup:stage-windows-runtime
   npm run profile:webgpu-startup:stage-windows-runtime
   ```

   That stages `scripts/captureWebGpuStartupProfileOverCdp.mjs`, `scripts/isExecutedDirectly.mjs`, `scripts/summarizeWebGpuStartupProfile.mjs`, `scripts/compareWebGpuStartupProfiles.mjs`, `scripts/writeWebGpuStartupProfileUploadManifest.mjs`, `node_modules/playwright-core`, the committed Intel control baseline, `README.txt`, and `run-startup-profile.cmd` under `/mnt/c/Temp/hel142-startup-runtime/`. Launch `C:\Temp\hel142-startup-runtime\run-startup-profile.cmd` from Windows; it now captures the run and writes `startup-profile-report.*`, `startup-profile-comparison.*`, and `startup-profile-upload-manifest.*` into `C:\Temp\hel142-startup-runtime\artifacts\`, and it attempts to create `startup-profile-upload-bundle.zip` there too. Then copy that artifact folder back into `reports/startup-profiling/test-results/windows-host-runtime-attempt/`.

   If the RTX machine needs explicit Chrome flags to stay on the high-performance adapter or expose the desired WebGPU path, pass them through `PLAYWRIGHT_PROFILE_BROWSER_ARGS`. Separate flags with newlines or `;;`, for example:

   ```bash
   PLAYWRIGHT_BASE_URL="http://127.0.0.1:4173/minecraft-clone/" \
   PLAYWRIGHT_PROFILE_EXECUTABLE_PATH="/absolute/path/to/chrome" \
   PLAYWRIGHT_PROFILE_BROWSER_ARGS=$'--force_high_performance_gpu\n--enable-unsafe-webgpu\n--ignore-gpu-blocklist' \
   npm run profile:webgpu-startup
   ```

   On success, the wrapper now also auto-runs `npm run profile:webgpu-startup:report` and `npm run profile:webgpu-startup:compare`, then writes an upload manifest against the newest Playwright output directory, so the resulting artifact folder already contains `startup-profile-report.json`, `startup-profile-report.md`, `startup-profile-comparison.json`, `startup-profile-comparison.md`, `startup-profile-upload-manifest.json`, and `startup-profile-upload-manifest.md`. The generated report and upload manifest also include the target-surface verdict, which should confirm an RTX/WebGPU match on the real proof run.

   For the lowest-ceremony path on the RTX machine, the repo also now exposes a one-command local-preview flow:

   ```bash
   PLAYWRIGHT_PROFILE_EXECUTABLE_PATH="/absolute/path/to/chrome" \
   npm run profile:webgpu-startup:local-preview
   ```

   That command runs `npm run build`, starts `vite preview` on `127.0.0.1:4173`, waits for `http://127.0.0.1:4173/minecraft-clone/`, runs the existing Playwright capture wrapper, then stops the preview server.

3. If a hosted preview is preferred instead of a local preview, first loosen the `github-pages` environment branch policy or merge the profiling branch to `main`; the current Pages site at `https://helionaut.github.io/minecraft-clone/` serves `main`, not the latest PR #52 head.

4. The profiling run will open `?renderer=webgpu&qaHarness=1&startupProfile=1` and write artifacts into the newest Playwright output directory under `reports/startup-profiling/test-results/<playwright-output-dir>/`, including:
   - `chrome-performance-trace.json`
   - `console-messages.json`
   - `runtime-status.json`
   - `startup-profile.json`
   - `startup-profile-summary.json`
   - `startup-profile-report.json`
   - `startup-profile-report.md`
   - `startup-shell.png`
5. If the wrapper cannot auto-generate the report for any reason, generate the findings bundle manually:

   ```bash
   STARTUP_PROFILE_ARTIFACT_DIR="reports/startup-profiling/test-results/<playwright-output-dir>" \
   npm run profile:webgpu-startup:report
   ```

   This writes:
   - `startup-profile-report.json`
   - `startup-profile-report.md`

   The report summarizes top startup phases, long-frame counts, console warnings/errors, top Chrome trace hotspots from `chrome-performance-trace.json`, and remediation candidates so the RTX machine operator only has to upload the generated artifact directory.
6. If the auto-generated comparison files are missing for any reason, compare the RTX report bundle against the published Windows Intel control baseline from this workspace:

   ```bash
   STARTUP_PROFILE_CANDIDATE_REPORT="reports/startup-profiling/test-results/<playwright-output-dir>/startup-profile-report.json" \
   npm run profile:webgpu-startup:compare
   ```

   By default, this compares against `artifacts/startup-profiling-baselines/hel-142-windows-intel-control-startup-profile-report.json` and writes:
   - `startup-profile-comparison.json`
   - `startup-profile-comparison.md`

   Use that comparison output to separate true RTX-only hotspots from the already known SwiftShader control costs such as `initial-rebuild-world` and `ReadPixels`-driven stalls.
7. If the RTX machine returns a copied artifact directory or `startup-profile-upload-bundle.zip`, ingest it from the Linux workspace with one command instead of re-running the report/comparison steps manually:

   ```bash
   STARTUP_PROFILE_UPLOAD_SOURCE=/absolute/path/to/startup-profile-upload-bundle.zip \
   npm run profile:webgpu-startup:analyze-upload

   The analyzer also now accepts a direct HTTP(S) bundle URL, so a future pass
   can skip the manual download step if the RTX operator shares a reachable
   `startup-profile-upload-bundle.zip` link:

   STARTUP_PROFILE_UPLOAD_SOURCE=https://.../startup-profile-upload-bundle.zip \
   npm run profile:webgpu-startup:analyze-upload

   For private repo workflows, the analyzer also accepts a GitHub Actions
   artifact API URL and will reuse `GITHUB_TOKEN`, `GH_TOKEN`, or the local
   `gh auth token` session when available:

   STARTUP_PROFILE_UPLOAD_SOURCE=https://api.github.com/repos/<owner>/<repo>/actions/artifacts/<id>/zip \
   npm run profile:webgpu-startup:analyze-upload

   If the operator pastes the normal GitHub web artifact page URL instead of
   the API URL, the analyzer now normalizes that form automatically before
   fetching:

   STARTUP_PROFILE_UPLOAD_SOURCE=https://github.com/<owner>/<repo>/actions/runs/<run-id>/artifacts/<id> \
   npm run profile:webgpu-startup:analyze-upload
   ```

   If the run came from the new GitHub Actions workflow, the uploaded artifact
   will be named `webgpu-startup-profile-<run-id>` and can be downloaded from
   that workflow run or fetched directly from its artifact URL before running
   the analyzer.

   The analyzer accepts either a `.zip` bundle or an unpacked artifact directory. It regenerates `startup-profile-report.*`, `startup-profile-comparison.*`, and `startup-profile-upload-manifest.*` under the resolved artifact directory so the uploaded RTX capture is ready for review without extra hand assembly.
   Compare the RTX deltas against these code paths first:
   - `computeVoxelLighting(...)` in `src/gameplay/lighting.ts`
   - `worldGroup.clear()` plus the `world.forEachLoadedBlockInBounds(...)` loop in `src/rendering/scene.ts`
   - per-block `new Mesh(...)` creation through `blockMaterialFactory.getMaterials(...)` in the same rebuild loop
7. Record whether the app falls back to safe mode after device loss.
8. Break down startup cost across:
   - `createSceneRenderer()` / `renderer.init()`
   - volumetric light volume creation
   - first `rebuildWorld()`
   - early frame loop spikes after startup

### Infrastructure required to finish the original ask

- Desktop Chrome with WebGPU available
- RTX-class GPU with working hardware acceleration and driver visibility
- A local checkout of PR #52 on that RTX machine, or a hosted preview path that is allowed to deploy this branch
- Ability to collect Chrome Performance traces and browser console exports from that machine
