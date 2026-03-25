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
