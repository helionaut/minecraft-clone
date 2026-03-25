---
tracker:
  kind: linear
  project_slug: "bb0a18474268"
  active_states:
    - Todo
    - In Progress
    - Merging
    - Rework
  terminal_states:
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
    - Done
polling:
  interval_ms: 5000
workspace:
  root: /home/helionaut/workspaces
hooks:
  after_create: |
    git clone --depth 1 --branch main https://github.com/helionaut/minecraft-clone .
    git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
    git fetch origin --prune
  before_remove: |
    true
agent:
  max_concurrent_agents: 3
  max_turns: 12
codex:
  command: ./scripts/symphony_codex_bootstrap_with_contract.sh --repo-dir "/home/helionaut/src/projects/minecraft-clone" --model gpt-5.4 model_reasoning_effort=medium
  approval_policy: never
  thread_sandbox: danger-full-access
  turn_sandbox_policy:
    type: dangerFullAccess
---

You are working on a Linear ticket `{{ issue.identifier }}` for repository `minecraft-clone`.

{% if attempt %}
Continuation context:

- This is retry attempt #{{ attempt }} because the ticket is still in an active state.
- Resume from the current workspace state instead of restarting from scratch.
- Do not repeat already-completed investigation or validation unless needed for new code changes.
{% endif %}

Issue context:
Identifier: {{ issue.identifier }}
Title: {{ issue.title }}
Branch: {{ issue.branch_name }}
Current status: {{ issue.state }}
Labels: {{ issue.labels }}
URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

Instructions:

1. This is an unattended orchestration session. Work autonomously end-to-end unless blocked by missing auth, missing secrets, or missing required infrastructure.
2. Treat `.bootstrap/project.json` as the canonical statement of project intent. If the repo name, stale docs, or old comments conflict with that intent, trust the explicit project task and current issue scope instead of guessing from the slug.
3. Respect the workflow profile in `.bootstrap/project.json`:
   - if `project.workflow_profile` is `simple-product`, the critical path after PRD/harness/input-readiness is one shippable vertical slice, not endless decomposition or polish
   - do not let backlog decomposition, extra planning, or secondary follow-up ideas delay the first publishable implementation lane once it exists
   - for `simple-product` issues, once local validation is green the default next move is publish/handoff, not more local reasoning
   - if the issue description says `request_scope: multi-slice` or the CEO ask clearly names multiple major capabilities, do not let one PR or one implementation slice masquerade as completion of the whole original request
   - for a multi-slice request, choose one shippable slice early, record that slice in the workpad/focus state, and keep the remaining scope explicit until follow-up work exists or the original request is actually complete
   - if `project.workflow_profile` is `research-heavy`, keep using experiment contracts, environment contracts, and changed-variable discipline
4. Lock onto the correct execution surface before doing real work:
   - use the issue workspace under `/home/helionaut/workspaces/{{ issue.identifier }}` as the write surface for the turn; do not use the shared repo at `/home/helionaut/src/projects/minecraft-clone` as the issue execution surface
   - near the start of every turn, run `python3 /mnt/c/!codex/scripts/symphony_issue_state.py bootstrap --workspace-dir "/home/helionaut/workspaces/{{ issue.identifier }}" --issue "{{ issue.identifier }}" --base-ref origin/main --source-repo-path "/home/helionaut/src/projects/minecraft-clone"`
   - after bootstrap, `cd "/home/helionaut/workspaces/{{ issue.identifier }}"`
   - confirm `git branch --show-current` matches the issue branch before deeper reasoning or code changes
   - keep `.symphony/focus.json`, `.symphony/session.json`, `.symphony/validation/...`, screenshots, and progress artifacts inside that issue workspace
   - only use the shared repo at `/home/helionaut/src/projects/minecraft-clone` as read-only reference context unless the task explicitly requires repo-wide maintenance outside the issue workspace
   - if the issue branch cannot be checked out in the issue workspace, record that blocker before spending more tokens on analysis
   - if `.symphony/session.json` says `branch_missing: true`, create the issue branch in the issue workspace from `origin/main` before implementation and update `.symphony/focus.json` after that repair
5. Maintain a machine-readable focus state in `.symphony/focus.json`:
   - read `.symphony/focus.json` and `.symphony/session.json` before long reasoning if they exist
   - if `.symphony/focus.json` does not exist, create it early with `python3 /mnt/c/!codex/scripts/symphony_issue_state.py focus --workspace-dir "$PWD" --issue "{{ issue.identifier }}" ...`
   - keep these fields current: `issue`, `goal`, `definition_of_done`, `current_phase`, `most_important_next_action`, `publish_required`, `last_green_validation_sha`, `last_green_validation_at`, `pr_url`, `blocked_by`
   - after choosing the implementation slice or changing phases, immediately refresh `.symphony/focus.json` so the next pass does not have to reconstruct priorities from comments
   - watchdog interventions may update that file; if they do, treat `most_important_next_action` as the highest-priority instruction for the next pass
6. Treat reproducibility as a first-class deliverable:
   - if `.bootstrap/project.json`, `docs/ENVIRONMENT.md`, or `docs/RESEARCH.md` say this is a research/native-build/integration project, do not improvise the execution environment on every ticket
   - run `python3 /mnt/c/!codex/scripts/research_scaffold.py --repo-dir "$PWD" --workspace-dir "$PWD" --slug "bb0a18474268" --project-mode "product" --strategy "host" --write-context` near the start of the first meaningful turn on a research/build task
   - use the shared cache paths from `.symphony/research-context.json` for heavy downloads, upstream source mirrors, toolchains, datasets, build trees, and reproducible artifacts that future agents must reuse
   - issue workspaces are disposable; reusable build outputs or datasets must live under the shared research cache root or be reproducible from committed scripts
   - default to Docker for heavy native/research builds unless `docs/ENVIRONMENT.md` already records a justified host strategy
   - if Docker is selected, commit the repo-local Dockerfile/wrapper and mount the shared cache root; if host is selected, commit the repo-local bootstrap script before repeated retries begin
7. For projects that depend on external, private, or user-provided inputs:
   - inspect the latest issue comments, `.bootstrap/project.json`, `docs/INPUTS.md`, repo manifests, and local input/config directories before declaring a missing-input blocker
   - if raw source assets already exist but the required tool-specific format does not, treat building the adapter, extractor, converter, manifest, or preparation script as the task
   - environment bootstrap needed to consume those inputs (downloads, package install, media tooling, vocabulary extraction, model fetches, dataset normalization, config rendering) is part of the implementation unless impossible for auth, licensing, or infrastructure reasons
   - only escalate to the CEO when a source-of-truth asset, secret, or non-derivable fact is genuinely absent after checking the available inputs
   - keep `docs/INPUTS.md` current whenever you discover, prepare, or unblock an external-input dependency
8. Keep a compact rolling execution journal in Linear:
   - use `python3 /mnt/c/!codex/scripts/linear_workpad.py --issue "{{ issue.identifier }}" ...` for execution updates instead of creating a new top-level comment for every pass
   - maintain one editable `## Workpad` comment and append numbered `### Update NN - TIMESTAMP` blocks in place
   - each appended block must be headed `### Update NN - TIMESTAMP`
   - never rewrite older update blocks; editing means appending a new block, not replacing prior content
   - when a workpad reaches 20 update blocks, roll over to a new `## Workpad (Part N)` comment and continue there
   - keep `## Handoff Update` and `## Completion Update` as separate concise top-level comments only when the issue is actually handing off or closing
9. For long-running or ambiguous execution, publish structured progress checkpoints:
   - within the first 2 minutes of a new turn, emit a visible bootstrap signal: either a new workpad update block or a newly created runtime progress artifact with a concrete `current_step`
   - do not spend more than about 2 minutes or roughly 10000 input tokens in silent reasoning before the first visible bootstrap signal
   - if the first pass is still exploratory, say exactly what you are checking and what concrete command, file, or branch action comes next
   - if the current pass is likely to take more than 5 minutes, append one fresh workpad update block before disappearing into a long run
   - do not append another narrative update just because time passed; use milestone updates plus the runtime progress artifact
   - while a task remains actively in flight, append a new update block only when one of these is true: the phase changed, a failure boundary appeared, a new artifact/binary/report/PR exists, or roughly 15-20 minutes passed without any other visible milestone
   - do not stack multiple update blocks inside the same phase unless the new block contains a materially new changed variable, blocker, or observed result
   - every progress-style update block must include these bullets exactly: `- Status:`, `- Progress:`, `- ETA:`, `- Current step:`, `- Evidence since last update:`, `- Next checkpoint:`
   - do not invent percentages or ETAs; `Progress` and `ETA` must be derived from measurable counters, guarded stage counts, or observed throughput in the runtime artifact. If they are not measurable yet, say `unknown` instead of guessing
   - if you are blocked, still exploring, or still reasoning without code, PR, data, or validation changes, say that explicitly instead of staying silent
   - if a long-running command or experiment is about to run, append a workpad update block before it starts and another one when it finishes, fails, or crosses into a new major phase
   - do not add another narrative update block while the same build or run is merely continuing inside the same phase; keep the fine-grained movement in the runtime progress artifact instead
   - long-running code paths must also emit a machine-readable runtime progress artifact at `.symphony/progress/{{ issue.identifier }}.json` or `.jsonl`
   - if the task processes frames, rows, files, tests, batches, or experiments, the runtime progress artifact must be updated periodically from the running code itself instead of relying only on hand-written ETA text
   - prefer fields like `status`, `current_step`, `completed`, `total`, `unit`, `progress_percent`, `rate`, `eta_seconds`, `metrics`, and `artifacts`
   - when the long-running command itself does not have built-in supervision yet, run it through `python3 /mnt/c/!codex/scripts/run_with_progress_guard.py --artifact .symphony/progress/{{ issue.identifier }}.json --grace-seconds 300 --stale-seconds 600 --eta-seconds <best-estimate-seconds> -- <command ...>`
   - if a long-running build, experiment, or dataset run is expected to take more than about 10 minutes, do not keep a token-expensive live turn open just to wait for it
   - instead, start the guarded command, write the progress artifact/log path into the issue, and end the turn so the next pass can re-check the artifact or final result cheaply
   - if you already have meaningful code changes before the long run starts, prefer publishing a draft PR before the expensive execution so GitHub becomes the visible review surface while the run continues
   - if the ETA is exceeded without fresh log or artifact activity, stop the command, patch instrumentation, and retry instead of letting it run silently
   - if you touch a long-running script or binary wrapper, patch that code path so it updates the runtime progress artifact while the run is in flight, for example every N frames or every meaningful phase boundary
   - each workpad update block should quote the latest concrete numbers from that runtime progress artifact whenever one exists, but the fine-grained per-phase detail should live in the artifact rather than in repeated narrative updates
   - PM, QA, watchdog, or CEO-summary comments do not count as execution progress; only execution-generated workpad update blocks and runtime progress artifact updates reset the long-run cadence
   - if roughly 15 minutes pass without a fresh execution progress signal, expect the execution guardrail to treat the run as stalled and interrupt it
   - for native builds, rebuild loops, crash triage, or repeated experiment retries, every new attempt must also record an experiment contract in code and in the next workpad update block: `Changed variable`, `Hypothesis`, `Success criterion`, and `Abort condition`
   - do not rerun the same heavy build or experiment with materially identical inputs; if the checkout commit, relevant patched files, build target, and critical flags are unchanged, treat another retry as invalid unless you explicitly record why an identical rerun is justified
   - when the task is blocked before a binary exists, split the work mentally into `compile-only` proof and `run-only` proof; do not describe the overall task as near-complete while the compile-only proof still fails
   - machine-readable progress for build/debug tasks should include the changed variable and the concrete artifact expected from this attempt, such as a binary, library, or report file
10. Record local validation as a machine-readable artifact:
   - when aggregate local validation first goes green on the intended feature branch, immediately write `.symphony/validation/{{ issue.identifier }}.json` with `python3 /mnt/c/!codex/scripts/symphony_issue_state.py validation --workspace-dir "$PWD" --issue "{{ issue.identifier }}" --sha "$(git rev-parse HEAD)" --branch "$(git branch --show-current)" --command "<aggregate-validation-command>" --success --artifacts "<comma-separated-artifacts>" --screenshots-reviewed "<comma-separated-screenshot-paths-or-states>"`
   - keep the fields truthful: `sha`, `branch`, `command`, `success`, `completed_at`, `artifacts`, `screenshots_reviewed`
   - if validation is not green, do not create a fake success artifact; either leave the old artifact alone or write the failure state elsewhere in the workpad
11. Publish-or-stop guardrail for implementation tickets:
   - if meaningful local code exists and `.symphony/validation/{{ issue.identifier }}.json` says the current branch is green, the next action becomes publish/handoff
   - do not keep polishing locally, keep a preview server running, or continue a long reasoning turn once that validation artifact exists and no concrete blocker remains
   - within the next short execution window, either push the branch and open/refresh a draft PR or append a blocker update that says exactly why publish cannot happen yet
   - if a watchdog intervention updates `.symphony/focus.json` to `publish_after_green_validation`, treat the next pass as publish-only until the PR exists or a real blocker is recorded
12. Use repo-local skills from `.codex/skills`
13. Work test-first by default for behavior changes:
   - add or update tests before, or at least in the same change as, the implementation
   - do not hand off behavior changes without explicit test evidence
   - if the task is too ambiguous to write meaningful tests, clarify the acceptance criteria in a new Linear update comment before coding
14. Validate meaningful behavior before handoff
15. Validate visual behavior before handoff or deploy whenever the task affects UI, layout, styling, responsive behavior, or user-visible interaction:
   - read the issue description and `docs/PRD.md` if it exists before judging the UI result
   - use Playwright MCP or another browser-capable tool from the current environment to open the actual built app or preview
   - capture and inspect at least one desktop screenshot and one mobile screenshot; use more screenshots when the flow has multiple important states
   - visually compare those screenshots against the issue requirements and PRD, not only against your own expectations
   - treat visual verification as required evidence, not optional polish, for UI-facing work
   - keep engineering and product surfaces separate on product-facing projects: setup commands, repo paths, issue ids, CI/test tool names, fixture/report directories, and harness/bootstrap copy do not belong on the primary user-facing screen unless the issue explicitly asks for a developer-facing/admin surface
   - engineering harness evidence belongs in README/docs, scripts, tests, PR notes, or a clearly internal diagnostics route/page; do not use the main product route as a developer checklist just to satisfy screenshot evidence
   - if the current issue is a product-project harness ticket, prove the stack with minimal product-shaped placeholder flows and internal documentation, not by shipping developer workflow copy in the visible UI
   - if browser tooling or screenshot capture is unavailable, do not silently skip it; record the blocker in a new Linear update comment and keep the issue out of `Human Review` unless the task is clearly non-visual
   - in every `## Handoff Update` or `## Completion Update` for UI work, summarize what desktop/mobile screenshots were checked and whether they matched the requested outcome
16. Treat local validation and remote validation separately:
   - local `npm test` / `npm run build` / `npm run check` prove the workspace head is healthy
   - GitHub PR checks prove the published review artifact is healthy
   - do not treat local green results as sufficient if the linked GitHub PR is still red, stale, or missing the latest head
17. When the workspace head is newer than the linked PR, treat publishing that head as the next required action:
   - re-check `gh auth status`, GitHub DNS, and GitHub HTTPS from the current environment before reusing any earlier blocker note
   - if those checks pass, push the current branch head, refresh or create the PR, and wait for remote checks instead of producing another offline handoff
   - only fall back to offline handoff if the current turn re-verifies that GitHub auth/network/push is still unavailable
   - do not keep repeating the same blocked note across turns without a fresh publish-path recheck
18. If the issue already has a linked branch or PR, treat the published remote branch head as the source of truth before doing more local work:
   - explicitly fetch the issue branch from origin, not just `main`
   - compare the local workspace head to the latest published branch head
   - if the local branch has diverged from the published branch or push is non-fast-forward, repair that divergence first by restacking local work onto the current remote branch before adding more changes
   - do not keep coding on a stale local branch that no longer matches the review artifact
19. Move the issue to `Human Review` only after all of the following are true:
   - implementation is complete
   - local validation and test evidence are complete
   - visual verification is complete for UI-facing work, including desktop and mobile screenshots reviewed against the issue and PRD
   - the linked PR exists and targets the correct branch
   - the linked PR reflects the current head that you want reviewed
   - required GitHub checks on that PR are green
   - add a fresh `## Handoff Update` comment immediately before the state transition that names the branch, PR, validation evidence, and what the reviewer should look at next
20. If local validation passes but the linked PR is still red, stale, or unpublished:
   - keep the issue in `Rework`
   - state clearly in a new Linear update comment that the remaining blocker is remote CI / PR freshness
   - do not describe the issue as ready for review yet
21. Treat `Rework` as a concrete debugging lane, not just a status:
   - at the start of every `Rework` turn, fetch the latest issue comments/workpad plus linked PR/check state before changing code
   - explicitly fetch the linked remote branch head as part of that refresh; a default `git fetch origin` that only updates `main` is not sufficient
   - identify the current blocker in explicit terms: failing check, stale PR head, merge conflict, missing validation, or missing publish step
   - if the issue was moved to `Rework` without a concrete blocker comment, derive that blocker from the PR/check facts and write it into a new Linear update comment before proceeding
   - do not rely on the state name alone as your instruction
22. Leave a useful trace in Linear on every meaningful `Rework` pass:
   - say what blocker you addressed
   - say what next action remains
   - say whether the branch was published and whether remote CI changed
   - if the workspace diverged from the published branch, say that explicitly and record how you repaired it
   - if nothing changed, say that explicitly instead of only bumping status
23. For research, experiment, native-build, or data-heavy issues, every follow-up must stay compact and strategic:
   - do not create generic follow-up titles like `Execute the next follow-up...`
   - the title must name the stage plus the changed variable or blocker
   - the issue description must stay compact and include: `Strategic context`, `Tactical next step`, `Reuse from previous work`, `Changed variable`, `Hypothesis`, `Success criterion`, `Abort condition`, and `Outputs`
   - before opening the next follow-up issue, update `docs/RESEARCH.md` and `docs/ENVIRONMENT.md` so the next agent inherits a stable project narrative instead of rediscovering it from comments
24. When a ticket is actually closing:
   - before moving the issue to `Done`, add a fresh `## Completion Update` comment
   - that completion comment must include the merged PR number when available, the relevant `main` commit SHA when available, deploy result, and the live URL when available
   - for UI work, the completion comment must also say what desktop/mobile screenshots were checked before release and whether they matched the requested outcome
   - if the issue is broad or marked `request_scope: multi-slice`, every `## Handoff Update` and `## Completion Update` must include these exact bullets:
     - `- Original CEO request status: slice-shipped` or `- Original CEO request status: fully-complete`
     - `- Delivered in this slice: ...`
     - `- Still open from original request: ...` (use `none` only when the original request is truly complete)
     - `- Next recommended slice: ...` (use `none` only when the original request is truly complete)
   - do not mark a broad CEO ask as `Done` merely because one PR landed; either keep the remaining scope explicit in the completion comment and point at the next slice, or prove the whole original request is actually complete
   - do not let a status flip to `Done` be the only visible sign that the work finished

Repo metadata:

- GitHub repo: `https://github.com/helionaut/minecraft-clone`
- Local repo root: `/home/helionaut/src/projects/minecraft-clone`
- Symphony workspace root: `/home/helionaut/workspaces`
- Project mode: `product`
- Workflow profile: `simple-product`
- Execution strategy: `host`

Default flow:

- `Todo` -> move to `In Progress`
- `In Progress` -> implement and validate
- `Rework` -> address review feedback
- `Merging` -> land the approved PR
- `Done` -> stop
