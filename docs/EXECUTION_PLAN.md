# Minecraft Clone Execution Plan

## Goal

Build a browser-based Minecraft-clone game using Three.js and move from bootstrap
to one shippable vertical slice as quickly as possible.

## Product Scope

The first published version should feel like a playable voxel sandbox, not a
full Minecraft reimplementation.

### In Scope For The First Vertical Slice

- browser-based 3D voxel world rendered with Three.js
- first-person camera with mouse look
- keyboard movement, jumping, gravity, and collision against blocks
- add/remove blocks with a visible targeted block indicator
- a small deterministic world generated locally in the browser
- simple block palette and lightweight HUD elements such as a crosshair
- local-only persistence that can be reset without backend infrastructure
- desktop and mobile-responsive shell, even if gameplay is desktop-first

### Out Of Scope For The First Vertical Slice

- multiplayer or networking
- crafting, inventory depth, survival systems, or mobs
- account systems, backend services, or cloud saves
- advanced terrain biomes, caves, or chunk streaming beyond what the first slice needs
- content polish that delays the first playable deploy

## Technical Direction

- Stack: `Three.js` with a modern browser build tool such as `Vite` and `TypeScript`
- Render contract: deterministic local run path and one deployable static build
- Quality contract: tests for pure world/gameplay logic, lint/type/build checks for the app, Playwright visual evidence for the user-facing shell
- Asset strategy: prefer procedural materials or checked-in placeholder textures for the first slice so implementation does not block on external art

## Delivery Sequence

1. `HEL-95` defines the PRD and acceptance criteria for the playable slice.
2. `HEL-96` establishes the repo harness, local commands, CI, and test locations.
3. `HEL-97` confirms that the first slice can ship without private inputs and documents any optional asset path.
4. `HEL-98` decomposes only far enough to unblock implementation, then stops.
5. First implementation lane: ship a playable voxel sandbox vertical slice.
6. `HEL-99` publishes the first static-web deployment path once the slice is stable locally.

## First Implementation Lane

The first implementation issue created after backlog decomposition should target
one playable loop:

1. load the game in a browser
2. enter a small voxel world
3. move around reliably
4. break and place blocks
5. refresh and still see a predictable result

That lane is the critical path after PRD, harness, and input readiness are in
place. Secondary ideas should not delay it.

## Symphony Next Actions

### Immediate

1. Complete `HEL-95` with a PRD focused on the vertical slice above.
2. Complete `HEL-96` with a single reproducible web-app harness and aggregate `check`.
3. Complete `HEL-97` by documenting the no-external-input baseline and any optional texture path.

### After The Three Prerequisites

1. Create and start the vertical-slice implementation issue immediately.
2. Keep backlog work constrained to issues that directly unblock the slice.
3. Publish as soon as local validation for the slice is green; do not keep polishing locally.
