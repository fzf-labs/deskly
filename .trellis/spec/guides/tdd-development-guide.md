# TDD Development Guide

> **Purpose**: Make test-first development practical for this repository.

---

## Overview

Deskly already has a solid Vitest foundation for main-process logic, renderer pure logic, shared contracts, and architecture guards.

The next step is to make **test-first development the default behavior** for non-trivial changes.

In this repository, TDD should mean:

1. define one small behavior
2. write or update a focused failing test
3. make the smallest code change to pass
4. refactor safely
5. run a broader validation pass

This is more important for **logic and contract changes** than for purely visual edits.

---

## When TDD Is Required

Use test-first development by default when the change affects:

- main-process service logic
- workflow or task runtime behavior
- renderer feature model or usecase logic
- cross-layer contracts or payload mapping
- IPC handler validation behavior
- bug fixes with a reproducible failure
- architecture guards and repository constraints

Typical examples in this repo:

- `src/main/services/*`
- `src/main/ipc/*`
- `src/renderer/src/features/*/model/*`
- `src/renderer/src/features/*/usecases/*`
- `src/shared/contracts/*`

---

## When TDD Is Recommended But Flexible

TDD is still helpful, but does not need to be rigid, for:

- renderer state orchestration hooks
- refactors of legacy modules
- route assembly changes
- settings and automation flows with existing coverage

For refactors, start with a **characterization test** that captures current behavior before moving code.

---

## When TDD Can Be Light

Do not force a heavy TDD ceremony for:

- copy changes
- comments and docs
- pure styling tweaks
- layout-only changes with no behavior shift
- mechanical file moves with strong existing coverage

Even then, add or update tests if the move reveals missing behavior coverage.

---

## Repo-Specific Test Placement

Use these default mappings:

- `src/main/services/X.ts` -> `tests/main/services/X.test.ts`
- `src/main/ipc/*` -> `tests/main/*` or `tests/shared/*` when the contract is the real concern
- `src/renderer/src/features/<feature>/model/*` -> `tests/renderer/*`
- `src/renderer/src/features/<feature>/usecases/*` -> `tests/renderer/*`
- `src/shared/contracts/*` -> `tests/shared/*`
- repository architecture rules -> `tests/shared/architecture-guard.test.ts`

Prefer placing tests near the ownership layer, not near convenience imports.

---

## Preferred TDD Loop

### 1. Red

Start by writing the smallest failing test that expresses the intended behavior.

Good targets:

- one service method behavior
- one mapping rule
- one validation branch
- one renderer pure function outcome
- one architecture constraint

Keep the failure specific. Avoid writing a large scenario with many reasons to fail.

### 2. Green

Write the smallest implementation needed to pass the focused test.

Do not refactor yet. Do not broaden scope yet.

### 3. Refactor

After the test passes:

- clean naming
- remove duplication
- extract helpers if needed
- align with feature and cross-layer boundaries

Run the same focused test again after refactoring.

### 4. Broaden Validation

After the local loop is green, run the narrowest broader command that matches the touched area.

Examples:

- `pnpm test:main`
- `pnpm test:renderer`
- `pnpm test:shared`
- `pnpm lint`
- `pnpm typecheck`

Finish with the full required validation for the task.

---

## Commands For Fast TDD Loops

Use focused commands first:

```bash
pnpm test:file tests/main/services/TaskService.test.ts
pnpm test:file tests/renderer/task-create-utils.test.ts
pnpm test:file tests/shared/architecture-guard.test.ts
pnpm test:watch
```

Then broaden as needed:

```bash
pnpm test:main
pnpm test:renderer
pnpm test:shared
pnpm test
pnpm lint
pnpm typecheck
```

For file-specific iteration, prefer exact test files or exact test names over running the whole suite every time.

---

## Practical Patterns For Deskly

### Main Services

Prefer testing service behavior before changing implementation.

Good examples:

- `tests/main/services/TaskService.test.ts`
- `tests/main/services/TaskService.database.test.ts`
- `tests/main/services/WorkflowDefinitionGenerationService.test.ts`

Use mocks when the behavior is orchestration-heavy. Use temporary real databases when persistence interactions matter.

### Renderer Logic

Prefer pure logic tests over component-heavy tests.

Good examples:

- `tests/renderer/task-create-utils.test.ts`
- `tests/renderer/project-routing.test.ts`
- `tests/renderer/components/pipeline/workflow-definition-form.test.ts`

If a renderer change can be tested as a model or mapper, do that before considering UI interaction coverage.

### Shared and Architecture Rules

When changing repository rules or contract ownership, update the guard first.

Good examples:

- `tests/shared/architecture-guard.test.ts`
- `tests/shared/cli-config-spec.test.ts`

For repository-level constraints, the test should fail before the code or structure is changed.

---

## Common Mistakes

Avoid:

- writing the implementation first and adding tests afterward just for coverage
- changing many behaviors before the first failing test exists
- relying only on manual testing for logic changes
- writing broad integration tests when one focused unit or contract test would do
- tying renderer tests to UI structure when the real change is a pure transformation

---

## Review Checklist

For non-trivial changes, reviewers should ask:

- Was a focused failing test added or updated before the behavior change?
- Is the test placed in the right ownership layer?
- Does the test describe behavior rather than implementation details?
- Is the validation scope appropriate for the risk of the change?
- Could this change have been covered with a smaller characterization test first?

---

## Summary

In Deskly, TDD should be the default for behavior changes, not a ritual applied to everything.

The most effective default is:

**service logic, renderer pure logic, contracts, and guards first; heavy UI interaction testing second.**
