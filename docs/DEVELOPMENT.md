# Development Guide

## Purpose

This repository is set up to let a new agent clone, install, run, and validate
the project without extra bootstrap work.

## Commands

- install dependencies: `npm install`
- start the dev server: `npm run dev`
- build the production bundle: `npm run build`
- run unit tests: `npm run test`
- run the aggregate quality gate: `npm run check`

## Structure Guidance

- `src/gameplay/`
  Keep deterministic world generation, block registries, collision rules, and
  future player simulation logic here. Prefer pure functions and data-first APIs.
- `src/rendering/`
  Keep Three.js renderer setup, scene graph composition, materials, camera
  control adapters, and animation loops here.
- `src/ui/`
  Keep DOM shell code, HUD elements, menus, and user-facing overlays here.
- `tests/`
  Add fast tests for gameplay modules first. UI and browser-heavy behavior can
  follow once the vertical slice needs them.
- `public/`
  Place static assets here only when the app needs direct file serving. Avoid
  gating the first slice on heavyweight art pipelines.

## Engineering Rule

The primary game route should remain product-shaped. Developer workflow copy,
repo paths, and validation instructions belong in `README.md`, `docs/`, scripts,
and CI rather than on the main screen.
