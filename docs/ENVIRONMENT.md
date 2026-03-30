# Environment Contract

Project: Minecraft Clone
Project mode: `product`
Default execution strategy: `host`

## Why this file exists

This project must be reproducible across multiple Symphony issue workspaces and multiple future agents.

Issue workspaces are disposable. Reusable environment decisions, heavy downloads, toolchains, datasets, and build outputs must not live only inside a single `HEL-*` workspace.

## Decision rule

- Default to `docker` for research/native-build tasks when any of these are true:
  - the task compiles native code or depends on `apt`/system packages
  - the build or test run is expensive enough that repeated host bootstrap would waste time or tokens
  - the result must be reproducible across future agents or hosts
- Use `host` only when:
  - the stack is lightweight and already stable on the host
  - the host bootstrap can be captured in a small repo-local script
  - containerizing the task adds more complexity than reproducibility value
- The decision must be recorded before repeated retries begin.

## Current contract

- Strategy: `host`
- Status: `draft until the first environment issue resolves`
- Shared cache root: `~/srv/research-cache/minecraft-clone`
- Stable subdirectories:
  - downloads: `~/srv/research-cache/minecraft-clone/downloads`
  - datasets: `~/srv/research-cache/minecraft-clone/datasets`
  - toolchains: `~/srv/research-cache/minecraft-clone/toolchains`
  - builds: `~/srv/research-cache/minecraft-clone/builds`
  - artifacts: `~/srv/research-cache/minecraft-clone/artifacts`
  - logs: `~/srv/research-cache/minecraft-clone/logs`
  - docker state/volumes: `~/srv/research-cache/minecraft-clone/docker`

## Reuse rules

- Never leave the only copy of a useful baseline inside a disposable issue workspace.
- Commit repo-local wrappers, manifests, patches, lockfiles, and runbooks.
- If using `docker`, commit the Dockerfile and repo-local entry script; mount the shared cache root into the container.
- If using `host`, commit `scripts/bootstrap_host_deps.sh` (or equivalent) before allowing repeated build retries.
- Every follow-up issue must say which environment baseline or cache paths it expects to reuse.

## Symphony execution surface

- Authoritative workflow source: repo-root `WORKFLOW.md`
- Repo-local Codex launcher wrapper: `scripts/symphony_codex_bootstrap_with_contract.sh`
- Shared execution checkout: `/home/helionaut/src/projects/minecraft-clone`
- Runtime workflow copy: `/home/helionaut/srv/symphony/workflows/minecraft-clone.md`

Operator cleanup sequence after the workflow change lands on `main`:

```bash
git -C /home/helionaut/src/projects/minecraft-clone fetch origin main
git -C /home/helionaut/src/projects/minecraft-clone reset --hard origin/main
git -C /home/helionaut/src/projects/minecraft-clone clean -fd
cp /home/helionaut/src/projects/minecraft-clone/WORKFLOW.md /home/helionaut/srv/symphony/workflows/minecraft-clone.md
python3 /mnt/c/!codex/scripts/project_status_report.py --slug minecraft-clone --mode full > /tmp/minecraft-clone-status.json
python3 /mnt/c/!codex/scripts/project_hygiene_report.py --slug minecraft-clone > /tmp/minecraft-clone-hygiene.json
```

Expected post-cleanup result:

- the shared checkout is on `main` and `git status --short --branch` is clean
- the runtime workflow reports `codexModel=gpt-5.4` and `codexReasoningEffort=medium`
- the status/hygiene reports no longer flag actionable execution-environment drift for `minecraft-clone`

## HEL-142 hardware contract

- Ticket scope: profile WebGPU startup frame spikes on desktop Chrome with RTX-class hardware.
- Current host limitation: the active Symphony workspace is WSL2, but the underlying Windows host now proves only a partial browser/GPU surface rather than the required RTX execution surface.
- Browser probe update on this host:
  - repo-local Chrome-for-Testing can be downloaded and launched from the workspace
  - default headless launch reports `navigator.gpu === false`
  - headed launch under `xvfb-run` with `--enable-unsafe-webgpu --ignore-gpu-blocklist --enable-features=Vulkan,UseSkiaRenderer` still reports `navigator.gpu === false`
  - the same headed probe reports `WEBGL_debug_renderer_info` as `ANGLE (Mesa, llvmpipe (LLVM 20.1.2 256 bits), OpenGL 4.5)`, so this host is still software-rendered rather than RTX-backed
- Windows host probe update from WSL:
  - a real Chrome binary exists at `/mnt/c/Program Files/Google/Chrome/Application/chrome.exe`
  - Windows `nvidia-smi.exe` exists at `/mnt/c/Windows/System32/nvidia-smi.exe`
  - `nvidia-smi.exe` reports `NVIDIA GeForce GTX 965M` on driver `582.28`, so the visible adapter is desktop-class NVIDIA hardware but still not RTX-class
  - the committed Playwright wrapper cannot launch that Windows Chrome binary directly from WSL because Chrome exits on `--remote-debugging-pipe` with `Remote debugging pipe file descriptors are not open`
  - manually launching Windows Chrome with `--remote-debugging-port=9222` leaves the browser listening on the Windows side, but this WSL session cannot reach that listener over either `127.0.0.1` or the Windows host IP from `/etc/resolv.conf`
  - the Windows host also lacks `node` and `npm` in PATH, so unattended profiling from Windows requires a portable `node.exe` toolchain rather than relying on a preinstalled runtime
  - Windows can still reach the WSL preview URL (`http://127.0.0.1:4174/minecraft-clone/` returned HTTP 200 in this pass), so a same-OS browser run is possible once the Node/runtime packaging issue is handled
  - a portable Windows Node v22.22.1 zip from `nodejs.org` can be unpacked under the shared cache and used to run repo scripts from Windows
  - direct execution from the UNC workspace still fails to resolve Playwright package/module entrypoints under Windows Node, so this pass used a minimal Windows-local runtime bundle (`scripts/captureWebGpuStartupProfileOverCdp.mjs` plus `node_modules/playwright-core`) staged under `/mnt/c/Temp/hel142-startup-runtime`
  - that Windows-local runtime bundle successfully captured startup artifacts back into the workspace under `reports/startup-profiling/test-results/windows-host-runtime-attempt/`
  - the resulting runtime is still not the requested target surface: Chrome reported `WebGL 2 | hardware accelerated` on `ANGLE (Intel, Intel(R) HD Graphics 4600...)` with `volumetric lighting disabled (webgpu-fallback-adapter)`
- Remote surface limitation: no MCP-provided browser/GPU execution surface is attached in this environment.
- GitHub runner limitation: the repository currently has zero registered self-hosted Actions runners, and the only CI workflow for PR branches runs on `ubuntu-latest`, so there is no repo-managed remote GPU execution path available from GitHub either.
- Attached browser-tool limitation: the available Playwright MCP browser wrapper is configured for system Chrome at `/opt/google/chrome/chrome`; that binary is missing on this host, and `npx playwright install chrome` cannot complete unattended because it requires `sudo`.
- Wrapper portability update: `npm run profile:webgpu-startup` now accepts `PLAYWRIGHT_PROFILE_EXECUTABLE_PATH=/absolute/path/to/chrome` and will prefer that explicit browser binary over Playwright channel discovery. This removes the requirement for a system-installed `/opt/google/chrome/chrome` on the eventual RTX machine.
- Hosted preview limitation: the shared GitHub Pages site serves `main`, and the `github-pages` environment branch policy rejects PR-branch deploys for PR #52.

Required execution surface for the remaining proof:

- desktop machine with RTX-class NVIDIA GPU and working driver visibility
- desktop Chrome with WebGPU enabled and hardware acceleration working
- local checkout of branch `eugeniy/hel-142-profile-desktop-frame-spikes-on-rtx-chrome-for-webgpu-scene`
- browser automation running on the same OS/network surface as that Chrome instance, or a reachable remote debugging endpoint
- if the host lacks a preinstalled Windows Node runtime, a portable `node.exe` plus a Windows-local copy of the profiling runtime bundle is sufficient
- ability to run:

```bash
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173/minecraft-clone/ npm run profile:webgpu-startup
```

Equivalent one-command local-preview flow on the RTX machine:

```bash
PLAYWRIGHT_PROFILE_EXECUTABLE_PATH=/absolute/path/to/chrome \
npm run profile:webgpu-startup:local-preview
```

Optional portable browser path:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173/minecraft-clone/ \
PLAYWRIGHT_PROFILE_EXECUTABLE_PATH=/absolute/path/to/chrome \
npm run profile:webgpu-startup
```

Expected artifacts from that machine:

- `reports/startup-profiling/test-results/<playwright-output-dir>/chrome-performance-trace.json`
- `reports/startup-profiling/test-results/<playwright-output-dir>/console-messages.json`
- `reports/startup-profiling/test-results/<playwright-output-dir>/runtime-status.json`
- `reports/startup-profiling/test-results/<playwright-output-dir>/startup-profile.json`
- `reports/startup-profiling/test-results/<playwright-output-dir>/startup-profile-summary.json`
- `reports/startup-profiling/test-results/<playwright-output-dir>/startup-profile-report.json`
- `reports/startup-profiling/test-results/<playwright-output-dir>/startup-profile-report.md`
- `reports/startup-profiling/test-results/<playwright-output-dir>/startup-profile-comparison.json`
- `reports/startup-profiling/test-results/<playwright-output-dir>/startup-profile-comparison.md`
- `reports/startup-profiling/test-results/<playwright-output-dir>/startup-profile-upload-manifest.json`
- `reports/startup-profiling/test-results/<playwright-output-dir>/startup-profile-upload-manifest.md`
