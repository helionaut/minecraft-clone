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
- Current host limitation: the active Symphony host is WSL2 with no `google-chrome`/`chromium`, no `nvidia-smi`, and no WebGPU-capable Chrome runtime.
- Browser probe update on this host:
  - repo-local Chrome-for-Testing can be downloaded and launched from the workspace
  - default headless launch reports `navigator.gpu === false`
  - headed launch under `xvfb-run` with `--enable-unsafe-webgpu --ignore-gpu-blocklist --enable-features=Vulkan,UseSkiaRenderer` still reports `navigator.gpu === false`
  - the same headed probe reports `WEBGL_debug_renderer_info` as `ANGLE (Mesa, llvmpipe (LLVM 20.1.2 256 bits), OpenGL 4.5)`, so this host is still software-rendered rather than RTX-backed
- Remote surface limitation: no MCP-provided browser/GPU execution surface is attached in this environment.
- Attached browser-tool limitation: the available Playwright MCP browser wrapper is configured for system Chrome at `/opt/google/chrome/chrome`; that binary is missing on this host, and `npx playwright install chrome` cannot complete unattended because it requires `sudo`.
- Wrapper portability update: `npm run profile:webgpu-startup` now accepts `PLAYWRIGHT_PROFILE_EXECUTABLE_PATH=/absolute/path/to/chrome` and will prefer that explicit browser binary over Playwright channel discovery. This removes the requirement for a system-installed `/opt/google/chrome/chrome` on the eventual RTX machine.
- Hosted preview limitation: the shared GitHub Pages site serves `main`, and the `github-pages` environment branch policy rejects PR-branch deploys for PR #52.

Required execution surface for the remaining proof:

- desktop machine with RTX-class NVIDIA GPU and working driver visibility
- desktop Chrome with WebGPU enabled and hardware acceleration working
- local checkout of branch `eugeniy/hel-142-profile-desktop-frame-spikes-on-rtx-chrome-for-webgpu-scene`
- ability to run:

```bash
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173/minecraft-clone/ npm run profile:webgpu-startup
```

Optional portable browser path:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173/minecraft-clone/ \
PLAYWRIGHT_PROFILE_EXECUTABLE_PATH=/absolute/path/to/chrome \
npm run profile:webgpu-startup
```

Expected artifacts from that machine:

- `reports/startup-profiling/chrome-performance-trace.json`
- `reports/startup-profiling/console-messages.json`
- `reports/startup-profiling/runtime-status.json`
- `reports/startup-profiling/startup-profile.json`
- `reports/startup-profiling/startup-profile-summary.json`
