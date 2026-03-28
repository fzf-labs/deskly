# AI Development Enhancement Plan v2

> **Purpose**: Improve AI delivery speed, reliability, and maintainability after the architecture refactor.

---

## Why This Exists

The architecture cleanup solved the biggest structural problem: AI agents can now find the right module boundaries, public surfaces, and shared contracts more consistently.

The next bottlenecks are no longer mostly about directory layout. They are about:

- unclear task inputs
- missing executable guardrails
- too few canonical examples
- repeated rediscovery of module rules
- slow validation feedback

This plan focuses on the next layer of AI enablement: making future tasks more deterministic, cheaper to review, and easier to continue across sessions.

---

## Target Outcomes

- Higher first-pass implementation success rate
- Smaller and cleaner change sets
- Faster local validation before review
- Lower risk of cross-feature and cross-layer drift
- Better continuity between human sessions and AI sessions

---

## Core Principles

1. **Task clarity beats prompt cleverness**
   If the task brief is vague, even a strong model will explore too much and guess too often.

2. **Executable constraints beat prose-only rules**
   Important architecture rules should fail in tests or scripts, not only in code review comments.

3. **Examples beat abstract instructions**
   Shared contracts, IPC payloads, and feature APIs should have canonical examples that AI can copy safely.

4. **Fast feedback beats large validation loops**
   Small, scoped checks are more useful during AI iteration than always waiting for the full repo suite.

5. **Local ownership beats hidden conventions**
   Each important feature or service should explain its public API, invariants, and no-touch zones close to the code.

---

## P0: Highest ROI

These items should be prioritized before more structural refactors.

### 1. Standardize the AI task brief protocol

Every non-trivial task should start with a consistent brief that includes:

- Goal
- In scope
- Out of scope
- Files or modules likely to change
- Files or modules that must not be changed
- Acceptance criteria
- Required validation commands
- Compatibility constraints

Recommended landing points:

- extend `.trellis/workflow.md`
- improve the default output of `.trellis/scripts/task.py create`
- keep the brief close to the task `prd.md`

Why this matters:

- reduces low-value clarification loops
- prevents broad speculative edits
- makes multi-session continuation safer

### 2. Add fast, scoped validation commands

Introduce small commands that match the way AI actually iterates.

Recommended commands:

- `pnpm check:arch`
- `pnpm check:changed`
- `pnpm test:renderer`
- `pnpm test:main`
- `pnpm test:task-detail`
- `pnpm test:cli-session`
- `pnpm test:pipeline`

Why this matters:

- shorter feedback loops
- less temptation to skip validation
- easier recovery from partial failures

### 3. Add canonical examples for shared contracts and IPC payloads

Type declarations alone are not enough. Important contracts should also have example payloads and expected shapes.

Recommended coverage:

- task creation payloads
- workflow definition payloads
- workflow run node payloads
- CLI session events
- notification payloads

Recommended landing points:

- `tests/fixtures/contracts/`
- `tests/fixtures/ipc/`
- golden examples referenced by tests

Why this matters:

- gives AI a safe shape to imitate
- reduces accidental field drift
- makes compatibility changes easier to review

### 4. Add short README files to core features and main-process domains

Each important area should have a short local document with:

- what the module owns
- the public entry point
- allowed dependency direction
- critical invariants
- common mistakes to avoid

Recommended first wave:

- `src/renderer/src/features/task-detail/`
- `src/renderer/src/features/cli-session/`
- `src/renderer/src/features/pipeline/`
- `src/main/services/`
- `src/main/ipc/`

Why this matters:

- lowers repo rediscovery cost
- improves handoff between sessions
- makes feature boundaries visible where work actually happens

### 5. Expand architecture guards beyond directory shape

Current guards already protect feature barrels and top-level directory cleanup. The next layer should guard behavior that still commonly regresses.

Recommended additions:

- prevent deep cross-feature imports
- detect circular feature dependencies
- prevent new cross-layer DTO copies outside `src/shared/contracts/`
- prevent new large files from growing past an agreed threshold
- ensure required feature README files exist for priority modules

Why this matters:

- catches architectural drift early
- reduces review burden
- keeps the AI-friendly structure stable over time

---

## P1: Strong Multipliers

These items are valuable after the P0 layer is in place.

### 1. Add module-level change manifests

For important modules, define a tiny machine-readable or markdown manifest describing:

- public API
- stable imports
- volatile internals
- forbidden direct imports
- preferred validation commands

This can live as `README.md`, `module.md`, or a lightweight config file.

### 2. Add scenario-based golden tests

Move beyond unit shapes and preserve representative end-to-end flows.

Recommended scenarios:

- conversation task creation and replay
- workflow task creation with runtime defaults
- CLI session lifecycle
- generated workflow review
- settings-driven CLI availability

These tests protect the flows AI agents are most likely to touch.

### 3. Create reusable prompt packs for common task types

The repo should have standard request templates for:

- feature implementation
- refactor
- bug fix
- migration
- review
- architecture cleanup

These prompt packs should reference repo conventions instead of asking each session to rediscover them.

### 4. Improve session memory capture

The end of a session should capture:

- what changed
- what remains
- commands run
- known risks
- recommended next step

This should be optimized for quick continuation, not long-form journaling only.

---

## P2: Long-Term Enhancements

These items are useful, but they depend on P0 and P1 being stable first.

### 1. Generate dependency maps automatically

Produce periodic reports for:

- feature-to-feature imports
- shared contract usage
- main-process service dependencies
- large file hotspots

This helps detect drift before it becomes a refactor project again.

### 2. Add risk-based automation around changed files

For example:

- if `src/shared/contracts/` changes, run cross-layer checks automatically
- if `src/main/ipc/` changes, run IPC contract and preload checks
- if `features/task-detail` changes, run task-detail focused tests

This turns repository knowledge into automation instead of tribal memory.

### 3. Build a small eval set for recurring AI work

Track a few representative tasks and measure:

- first-pass test success
- lines changed
- retry count
- review findings

This makes AI workflow improvement measurable instead of anecdotal.

---

## Recommended Execution Order

If only one wave is funded next, use this order:

1. task brief protocol
2. fast validation commands
3. contract and IPC examples
4. feature and service README files
5. expanded architecture guards

This order gives the best balance of immediate developer benefit and low implementation risk.

---

## What Not To Do

- Do not solve this only with bigger system prompts.
- Do not add large new documentation sets without executable enforcement.
- Do not create new top-level compatibility layers just to make AI patches easier.
- Do not let each feature invent its own task or README format.
- Do not add heavy tooling before the lightweight P0 guardrails exist.

---

## Success Metrics

Track a small set of operational signals:

- percentage of non-trivial tasks with explicit acceptance criteria
- percentage of AI changes that pass scoped checks on the first run
- average time from first edit to green validation
- number of review findings caused by contract drift or wrong imports
- number of resumed sessions that complete without rediscovery work

If these numbers improve, the repo is becoming more AI-efficient in a meaningful way.

---

## Summary

The architecture refactor created the right foundation.

The next improvement wave should focus on:

- better task inputs
- stronger executable constraints
- concrete examples
- local module guidance
- faster feedback loops

In short:

**AI-friendly architecture is the base layer. AI-friendly workflow, guardrails, and examples are the multiplier layer.**
