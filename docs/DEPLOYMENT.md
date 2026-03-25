# Deployment Guide

## Hosting target

The first production hosting path uses GitHub Pages and the repository's static
Vite build output.

- workflow: [deploy-pages.yml](/home/helionaut/src/projects/minecraft-clone/.github/workflows/deploy-pages.yml)
- expected production URL pattern: `https://helionaut.github.io/minecraft-clone/`
- actual production URL source of truth: the `page_url` output from the
  `deploy` job and the `reports/deployment/github-pages.json` artifact

## Triggering a release

- `push` to `main` automatically runs the Pages workflow
- `workflow_dispatch` can publish the current branch head when an early manual
  deployment is needed

Before publishing, keep the local gate green:

```bash
npm run check
```

For UI-affecting releases, also capture and review representative screenshots
before calling the release healthy:

```bash
PLAYWRIGHT_BASE_URL="<preview-or-production-url>" npm run test:deploy-smoke
```

## GitHub setup

This repository needs GitHub Pages configured for a custom workflow build:

```bash
gh api \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  /repos/helionaut/minecraft-clone/pages \
  -f build_type=workflow
```

If Pages already exists, update it instead:

```bash
gh api \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/helionaut/minecraft-clone/pages \
  -f build_type=workflow
```

## Release validation

The deploy workflow enforces these checks before a release is considered healthy:

1. `npm run check` on the exact commit being published
2. `actions/deploy-pages` returning a production `page_url`
3. a Playwright smoke test against the deployed site URL

The smoke test verifies:

- the `Playable voxel sandbox` heading renders
- the `Reset world` control is visible
- the WebGL viewport canvas is attached
- the desktop entry prompt renders after page load
- desktop and mobile release screenshots are captured as Playwright artifacts
- mobile touch controls remain visible in portrait and landscape review states

## Manual verification

After the workflow finishes:

1. Open the production URL from the deploy job output or deployment metadata
   artifact.
2. Confirm the page title panel and viewport load without a blank screen.
3. Review the Playwright screenshot artifacts for at least:
   `desktop-shell.png`, `desktop-inventory.png`, `mobile-shell-390x844.png`,
   `mobile-inventory-390x844.png`, and `mobile-shell-844x390.png`.
4. Verify the full gameplay UI remains visible in those screenshots:
   top HUD, inventory button, hotbar, move stick, action buttons, and inventory
   overlay controls must all stay inside the visible frame without clipping.
5. On desktop, click the viewport and verify the prompt changes after pointer
   lock engages.
6. Move with `WASD`, jump with `Space`, and verify the crosshair/target readout
   respond near blocks.
7. In a mobile browser context, confirm controls remain visible with browser UI
   bars present and after rotating once between portrait and landscape.
8. Mine with left click, place with right click, refresh once, and confirm the
   local-persistence behavior still matches the current game contract.

## Reporting the production URL

The deploy path always records the live URL in `reports/deployment/github-pages.json`
and the GitHub Actions step summary.

Optional downstream notifications are supported:

- `TELEGRAM_BOT_TOKEN`
  Enables a Telegram message to the Minecraft Clone project thread
  (`chat_id=-1003774956386`, `topic_id=1499`).
- `SYMPHONY_DEPLOY_WEBHOOK_URL`
  Posts the same deployment payload to Symphony for automation or relay logic.

If these secrets are absent, the workflow still deploys and uploads the metadata
artifact without failing.
