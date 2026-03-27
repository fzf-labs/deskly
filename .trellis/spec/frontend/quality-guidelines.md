# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend changes are expected to preserve current user behavior while improving structure. The immediate priorities are type safety, clean ownership boundaries, and stable IPC-driven flows such as task detail, pipeline editing, and automation management.

---

## Forbidden Patterns

Avoid these patterns in new code:

- Adding new business logic directly to route components in `pages/`
- Creating new cross-layer DTOs outside `src/shared/contracts/`
- Hiding side effects in generic utility files when the behavior belongs to a specific feature
- Adding more responsibilities to already oversized hooks or components just because they are nearby
- Using untyped `any` or broad `Record<string, unknown>` beyond boundary modules

Legacy code still contains some of these patterns. Treat them as migration targets, not examples to copy.

---

## Required Patterns

New frontend work should follow these rules:

- Keep IPC calls behind `window.api`, `data/`, or thin wrappers such as `lib/electron-api.ts`
- Import shared contracts for cross-layer shapes
- Clean up renderer event listeners and subscriptions
- Keep page files focused on route assembly and page composition
- Preserve existing public renderer behavior when refactoring internals

---

## Testing Requirements

Minimum validation for architecture-oriented frontend work:

- `pnpm lint`
- `pnpm typecheck`
- Relevant automated tests if the touched area already has them
- Manual sanity checks for task detail, workflow/pipeline flows, and settings or automation screens when those areas are affected

For refactors, behavior preservation matters more than cosmetic cleanup.

---

## Code Review Checklist

Reviewers should check:

- Are route shells staying thin?
- Did any new duplicate DTO or payload type appear outside shared contracts?
- Are imports respecting the intended ownership boundary?
- Are async effects cleaned up correctly?
- Did the change accidentally deepen a legacy monolith instead of moving logic toward a feature boundary?
