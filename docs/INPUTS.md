# External Inputs Contract: Minecraft Clone

Status: First-slice contract defined
Last Updated: 2026-03-24

## Project Intent

Build a browser-based Minecraft-clone game using Three.js.

## First-Slice Contract

The first playable slice must be buildable and runnable without any private,
CEO-supplied, or player-supplied inputs.

Required inputs for the first slice:
- none outside the repository and lockfile-managed package dependencies

Implemented baseline assumptions:
- initial world: generated locally in the app from checked-in logic and defaults
- block materials: procedural colors by default
- placeholder textures: allowed only as checked-in repo assets
- fixtures/manifests: generated from repo-local code or checked in with tests
- audio: omitted from the first slice
- backend data or hosted services: not required

This is the contract that unblocks `HEL-100`: implementation should start from a
local deterministic world and local placeholder visuals rather than waiting on
art delivery.

## Deterministic Repo-Local Paths

These paths are the reserved source-of-truth locations if the project needs them.
They are deterministic even when a directory does not exist yet.

- gameplay world generation defaults: `src/game/world/`
- checked-in optional placeholder textures: `public/textures/blocks/`
- checked-in test fixtures for world/block behavior: `tests/fixtures/worlds/`
- generated or checked-in asset manifests: `manifests/assets/`
- optional local asset-preparation scripts: `scripts/`

Path rules:
- first-slice gameplay must not require files outside the repository
- anything under `public/textures/blocks/` is optional unless the codebase is
  explicitly changed to consume it
- generated manifests must be reproducible from repo-local code and stored under
  `manifests/assets/`
- test fixtures must remain checked in and deterministic

## Optional Art Asset Lane

Optional art assets are non-blocking.

If the project later upgrades from procedural materials to a checked-in texture
set, use this contract:
- source art must be licensed for repository or build use
- prepared outputs must live under `public/textures/blocks/`
- any generation or normalization step must be invoked by a repo-local script in
  `scripts/`
- the script and manifest become part of the implementation change that adds the
  dependency

Until that happens, no fetch, conversion, or preparation step is required.

## Prepared Artifact Expectations

Expected first-slice prepared artifacts are:
- block/material definitions in source code or checked-in config
- deterministic world-generation fixtures for tests
- optional asset manifests only if optional textures are actually adopted

No private raw-input directory, secret material bundle, or CEO handoff is part
of the first-slice critical path.

## Current Gaps

None.

The repo can proceed on the assumption that the first vertical slice uses only
local code, local fixtures, and optional checked-in placeholder assets.
