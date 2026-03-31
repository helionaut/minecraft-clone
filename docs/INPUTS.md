# External Inputs Contract: Minecraft Clone

Status: First-slice contract defined, HEL-142 profiling addendum recorded
Last Updated: 2026-03-31

## Project Intent

Build a browser-based Minecraft-clone game using Three.js.

## First-Slice Contract

The first playable slice must be buildable and runnable without any private,
CEO-supplied, or player-supplied inputs.

Required inputs for the first slice:
- none outside the repository and lockfile-managed package dependencies

Current baseline in this repository:
- initial world: generated locally from checked-in logic in
  `src/gameplay/world.ts`
- block materials: procedural colors from checked-in definitions in
  `src/gameplay/blocks.ts`
- inventory icon pack: repo-authored SVG assets generated from
  `scripts/generateInventoryIcons.mjs` into `public/textures/inventory/`
- placeholder textures: not required for the first slice
- fixtures/manifests: optional and only needed if a later change introduces them
- audio: omitted from the first slice
- backend data or hosted services: not required

This is the contract that unblocks `HEL-100`: implementation should start from a
local deterministic world and local placeholder visuals rather than waiting on
art delivery.

## Deterministic Repo-Local Paths

These paths are the source of truth for the current baseline or the reserved
deterministic locations for optional asset lanes.

- world-generation baseline: `src/gameplay/world.ts`
- block/material baseline: `src/gameplay/blocks.ts`
- checked-in gameplay tests: `tests/gameplay/`
- optional checked-in placeholder textures: `public/textures/blocks/`
- optional checked-in world fixtures: `tests/fixtures/worlds/`
- optional generated or checked-in asset manifests: `manifests/assets/`

Path rules:
- first-slice gameplay must not require files outside the repository
- `src/gameplay/world.ts` and `src/gameplay/blocks.ts` remain the canonical
  first-slice defaults until another committed source of truth replaces them
- anything under `public/textures/blocks/` is optional unless the codebase is
  explicitly changed to consume it
- anything under `tests/fixtures/worlds/` is optional unless tests or tooling
  are updated to load serialized fixtures instead of inline test data
- generated manifests must be reproducible from repo-local code and stored under
  `manifests/assets/`
- test fixtures must remain checked in and deterministic when introduced

## Optional Art Asset Lane

Optional art assets are non-blocking.

If the project later upgrades from procedural materials to a checked-in texture
set, use this contract:
- source art must be licensed for repository or build use
- prepared outputs must live under `public/textures/blocks/`
- any generation or normalization step must be invoked by a repo-local script
  added under `scripts/` in the same change that introduces the dependency
- the prepared-texture manifest must live under `manifests/assets/`
- the script and manifest become part of the implementation change that adds the
  dependency; they are optional until that change exists

Until that happens, no fetch, conversion, or preparation step is required, and
there is intentionally no blocking asset-preparation path in the repo.

## Prepared Artifact Expectations

Expected first-slice prepared artifacts are:
- block/material definitions in `src/gameplay/blocks.ts`
- deterministic world-generation logic in `src/gameplay/world.ts`
- test coverage in `tests/gameplay/world.test.ts`
- optional world fixtures only if future tests need checked-in serialized data
- optional asset manifests only if optional textures are actually adopted

No private raw-input directory, secret material bundle, or CEO handoff is part
of the first-slice critical path.

## Current Gaps

None.

The repo can proceed on the assumption that the first vertical slice uses only
local code, local fixtures, and optional checked-in placeholder assets.

## HEL-142 Profiling Artifact Contract

HEL-142 is not blocked on a private asset, but it does depend on one external
proof artifact that cannot be generated on the current machine.

Required external input for HEL-142:
- one startup profiling artifact bundle or unpacked artifact directory captured
  from desktop Chrome running on RTX-class hardware against branch
  `eugeniy/hel-142-profile-desktop-frame-spikes-on-rtx-chrome-for-webgpu-scene`

Accepted returned forms:
- `startup-profile-upload-bundle.zip`
- an unpacked artifact directory containing at least:
  - `runtime-status.json`
  - `startup-profile.json`
  - `chrome-performance-trace.json`
  - `console-messages.json`

Preferred generation paths on the RTX machine:
- `PLAYWRIGHT_PROFILE_EXECUTABLE_PATH=/absolute/path/to/chrome npm run profile:webgpu-startup:local-preview`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173/minecraft-clone/ npm run profile:webgpu-startup`
- if WSL is only hosting the preview, `npm run profile:webgpu-startup:stage-windows-runtime`
  followed by `C:\\Temp\\hel142-startup-runtime\\run-startup-profile.cmd`

How the returned input is consumed in this workspace:
- `STARTUP_PROFILE_UPLOAD_SOURCE=/absolute/path/to/<bundle-or-dir> npm run profile:webgpu-startup:analyze-upload`

Source-of-truth repo paths for this lane:
- operator instructions: `docs/RESEARCH.md`
- upload analyzer: `scripts/analyzeWebGpuStartupProfileUpload.mjs`
- imported artifact staging root: `reports/startup-profiling/imported/`
- committed control baseline for comparison:
  `artifacts/startup-profiling-baselines/hel-142-windows-intel-control-startup-profile-report.json`

Current HEL-142 gap:
- no qualifying RTX startup profiling artifact has been uploaded yet, so the
  analyzer path exists but still has no external input to process
