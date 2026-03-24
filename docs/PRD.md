# Product Requirements Document: First Publishable Minecraft Clone Slice

## Document Purpose

Define the first shippable vertical slice for Minecraft Clone so downstream
implementation, harness, deployment, and QA work can proceed without guessing
product intent.

## Product Promise

A player can open the browser app, enter a small voxel world, move around, and
place or remove blocks.

## Target User

- A player who wants an immediate, low-friction browser sandbox.
- A reviewer validating that the project already delivers a recognizable
  Minecraft-like core loop before deeper systems exist.

## User Value In V1

The first slice proves the core fantasy quickly:

- the app loads directly in the browser with no account, launcher, or backend
- the player can look around and navigate a readable voxel space
- the world responds to input through block removal and placement
- the result is predictable across refresh through either local persistence or a
  deterministic reset path

If this slice is working, the project is publishable as a playable prototype
rather than a static demo.

## Primary User Flow

1. The player opens the deployed web app.
2. The player enters an interactive voxel world within one short loading path.
3. The player can look around, move, jump, and collide with terrain.
4. The player can target a block, remove it, and place a block into a valid
   adjacent space.
5. On refresh, the world either restores the prior local state or returns to the
   same deterministic baseline state every time.

## In Scope For V1

### Core Gameplay Loop

- load a small locally generated voxel world in the browser
- control a first-person or over-the-shoulder player camera with clear aiming
- move forward, backward, left, and right
- jump with gravity
- collide with solid blocks so the player cannot pass through terrain
- place a block into a valid adjacent position
- remove a targeted block
- provide visible feedback for the targeted block or placement cell
- preserve the world through local persistence or reset to a deterministic seed

### UX And Shell

- startable from a static web deployment
- minimal onboarding or prompt text needed to begin play
- clear indication that the app is interactive, such as a start button,
  crosshair, or short controls hint
- layout that remains usable in a desktop browser and within a mobile-sized
  viewport for shell review

### Technical Outcomes

- deterministic world generation or deterministic reset path
- no required backend services
- no required external art, audio, or content downloads for the first slice

## Non-Goals For V1

- multiplayer, chat, or any networked shared world state
- crafting, inventory depth, survival loops, health, or hunger
- mobs, NPCs, combat, or AI systems
- backend services, authentication, cloud save, or analytics dependencies
- advanced terrain systems such as chunk streaming, caves, or biome diversity
- deep content polish, audio polish, or broad block catalogs
- parity with full Minecraft feature scope

## Experience Requirements

### Gameplay Requirements

- The player must spawn above solid terrain and remain inside the playable area.
- Camera and movement controls must be responsive enough to navigate the whole
  starter world without soft-locking.
- Jumping must allow traversal over at least one-block height differences when
  level geometry permits.
- Collision must stop the player from walking through solid blocks or falling
  through the ground during normal play.
- Block removal must affect the currently targeted removable block only.
- Block placement must create exactly one new block in the intended adjacent
  cell and must not place inside the player's occupied space.

### World State Requirements

- The initial world must be finite and small enough to load quickly on a normal
  desktop browser session.
- The terrain layout and starter block palette must be deterministic for a given
  build.
- The implementation must choose one of these v1 contracts and document it in
  the app and README:
  - local persistence: block edits survive refresh in the same browser
  - deterministic reset: refresh returns to the same baseline world every time

### Usability Requirements

- A first-time reviewer must be able to identify how to start and how to
  interact without reading source code.
- If pointer lock or keyboard capture is required on desktop, the app must make
  that activation step explicit.
- Mobile does not need full gameplay parity in v1, but the app shell must render
  cleanly in a phone-sized viewport and communicate the slice status clearly.

## Acceptance Criteria

These criteria must be specific enough to support automated tests and manual
review.

### Functional Acceptance

- App boot:
  - Given a fresh page load, the main route renders a visible start or play
    entry point without console-blocking runtime errors.
  - After starting play, the scene shows a voxel world, player camera, and a
    visible aiming aid or equivalent interaction cue.
- World generation:
  - Given the same build and no saved local world state, the generated world
    layout is identical across two refreshes.
  - The starter world contains at least one walkable surface and at least one
    removable solid block within reachable distance of spawn.
- Movement and physics:
  - Holding a movement input changes the player position in the expected
    direction.
  - Triggering jump while grounded increases the player height before gravity
    returns the player to a walkable surface.
  - Moving the player into a solid block does not allow the camera origin to end
    inside that block.
- Block interaction:
  - When a solid block is targeted and remove is triggered, the targeted cell
    becomes empty.
  - When an empty adjacent cell is targeted and place is triggered, exactly one
    block is added in that cell.
  - Removing and then placing a block updates rendered state without a full page
    reload.
- Refresh contract:
  - If local persistence is chosen, a block edit made before refresh is present
    after refresh in the same browser.
  - If deterministic reset is chosen, the edited world returns to the baseline
    seed state after refresh.

### Validation Requirements

- Automated test coverage must exist for deterministic world generation, player
  collision or movement rules, and block placement or removal logic.
- Aggregate local validation must include the project's lint or type checks plus
  production build success.
- Manual browser validation must confirm the full gameplay loop on desktop:
  load, enter world, move, jump, collide, remove block, place block, refresh,
  and verify the chosen refresh contract.

### Desktop And Mobile Shell Review Evidence

- Desktop evidence must include at least:
  - one screenshot of the app before entering or capturing controls
  - one screenshot of the in-world gameplay state with the world visible
- Mobile evidence must include at least:
  - one screenshot of the shell in a phone-sized viewport
  - confirmation that text, buttons, and framing are readable without overlap or
    clipped primary controls
- Review notes must state whether mobile is shell-only for v1 or supports active
  interaction.

## Success Criteria

The first slice is successful when all of the following are true:

- A reviewer can open the deployed app and complete the promised gameplay loop
  without needing undocumented setup.
- The implementation is stable enough that the loop works repeatedly on desktop
  in local validation.
- The refresh behavior is explicit, deterministic, and matches the product
  contract.
- The app builds as a static web artifact suitable for deployment without
  backend infrastructure.
- Required acceptance evidence exists for automated checks plus desktop and
  mobile shell review.

## Deployment Readiness Criteria

- The app must build into static assets that can be hosted from a static web
  platform.
- No server-side rendering, custom backend process, database, or authenticated
  API dependency may be required for v1 gameplay.
- All required runtime assets for v1 must be bundled, generated locally, or
  checked into the repository.
- A production build must load the first playable slice without depending on
  environment-specific secrets.

## Technical Constraints

- Rendering stack should remain compatible with a browser-first static-web
  deployment model.
- V1 should avoid external required assets; prefer procedural colors, generated
  geometry, and checked-in placeholder resources.
- World logic should be deterministic and testable outside the render loop where
  feasible.
- Core gameplay systems for world generation, collision rules, and block edits
  should be separable enough to support automated tests.
- Save behavior, if included, must be local-only and browser-compatible.
- Performance optimization is only required enough to keep the small starter
  world playable; chunk streaming and large-world scaling are deferred.

## Open Product Decisions For Implementation

These are implementation choices, not reasons to reopen product scope:

- first-person camera vs another close camera framing
- exact starter world dimensions and block palette
- whether the refresh contract uses local persistence or deterministic reset
- exact desktop control mapping and whether mobile offers shell-only or limited
  touch interaction in v1

Any choice made in these areas must still satisfy the acceptance criteria above.
