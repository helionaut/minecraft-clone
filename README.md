# Minecraft Clone

Browser-based voxel game scaffolded for the first playable vertical slice.

This repository currently establishes the engineering harness for a Three.js
Minecraft-style game:

- `Vite` + `TypeScript` app shell
- `Three.js` rendering baseline on the main route
- pure gameplay/world modules that can be tested before UI-heavy flows
- one aggregate validation command shared by local development and CI

## Requirements

- Node.js `22+`
- npm `10+`

Validate the host toolchain:

```bash
./scripts/bootstrap_host_deps.sh
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build a production bundle:

```bash
npm run build
```

## Validation

Run the full local quality gate:

```bash
npm run check
```

`npm run check` aggregates:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

GitHub Actions runs the same aggregate command in [ci.yml](/home/helionaut/src/projects/minecraft-clone/.github/workflows/ci.yml).

## Repo Structure

The harness keeps engineering workflow details in docs and scripts rather than
on the primary game route.

```text
.
|-- src/
|   |-- gameplay/   # pure world/block logic and future simulation systems
|   |-- rendering/  # Three.js scene setup, camera, lighting, renderer glue
|   |-- ui/         # DOM shell and HUD composition
|   `-- styles/     # app-level styling for the shell and viewport
|-- tests/
|   `-- gameplay/   # early test coverage for deterministic world rules
|-- public/         # static assets served directly by Vite when needed
|-- scripts/        # local bootstrap and repo automation
|-- docs/           # environment, input, and project planning docs
`-- .github/        # CI workflows
```

## Next Build Lane

This harness is intended to unblock `HEL-100` by making these paths stable:

- world generation and block-state work can land in `src/gameplay/`
- render-system changes can stay isolated in `src/rendering/`
- HUD and interaction work can layer into `src/ui/`
- pure logic should gain tests in `tests/` before UI-dependent flows grow
