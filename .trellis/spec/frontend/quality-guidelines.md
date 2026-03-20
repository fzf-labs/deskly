# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend quality in this repo is enforced mainly through TypeScript, ESLint, and disciplined manual verification of Electron flows.

Current project-level commands from `package.json`:

- `npm run lint`
- `npm run typecheck`
- `npm run test`

As of 2026-03-20, there are no renderer `*.test.*` or `*.spec.*` files under `src/`, so practical quality gates today are lint, typecheck, and manual feature checks.

---

## Forbidden Patterns

- Adding a new global state library when existing hooks/providers are sufficient.
- Leaving async UI without `loading` and `error` handling when the screen depends on the result.
- Forgetting cleanup for event listeners, IPC subscriptions, or media query listeners.
- Expanding legacy `any` and broad type assertions deeper into the UI tree.
- Duplicating derived state instead of deriving it from source data.
- Using long relative import chains when `@/` aliases keep modules clearer.

---

## Required Patterns

- Prefer `@/` imports for renderer modules.
- Keep route pages focused on composition; extract reusable or orchestration-heavy logic into hooks/components.
- Use existing UI primitives from `components/ui` for dialogs, dropdowns, tooltips, and shared button variants.
- Return cleanup functions from effects that subscribe to anything external.
- Keep IPC and fetch boundaries typed and defensive.
- Use semantic HTML and explicit button types in interactive UIs.
- Run `npm run lint` and `npm run typecheck` before considering a frontend change complete.

Examples:

- Cleanup patterns:
  `src/renderer/src/hooks/useProjects.ts`, `src/renderer/src/providers/theme-provider.tsx`.
- Thin-page pattern:
  `src/renderer/src/pages/dashboard/DashboardPage.tsx`.
- Shared UI primitive pattern:
  `src/renderer/src/components/ui/button.tsx`, `src/renderer/src/components/ui/dialog.tsx`.

---

## Testing Requirements

- For UI-only changes, pass `npm run lint` and `npm run typecheck`.
- Manually verify the relevant route, dialog, and Electron/IPC interaction.
- If logic is extracted into a pure helper with real branching, consider adding a Vitest unit test even though the current renderer test suite is sparse.
- Do not assume `npm run test` provides meaningful coverage unless you also add test files.

For this codebase, manual verification is especially important for:

- task execution flows,
- project creation/edit/delete flows,
- dialog interactions,
- event-driven refresh and notification behavior,
- theme/language/settings persistence.

---

## Code Review Checklist

- Does the code live in the right layer: `pages`, `components`, `hooks`, `providers`, `data`, or `lib`?
- Are async calls typed, error-handled, and surfaced to the UI when needed?
- Are subscriptions and listeners cleaned up?
- Is state owned at the narrowest reasonable scope?
- Is repeated logic a candidate for extraction instead of another copy-paste?
- Are shared UI patterns built on the existing `components/ui` primitives?
- If new user-facing text is reused across screens, should it move into the locale catalog instead of remaining hardcoded?
