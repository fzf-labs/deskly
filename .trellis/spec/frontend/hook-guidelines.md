# Hook Guidelines

> How hooks are used in this project.

---

## Overview

The renderer relies heavily on custom hooks for page orchestration and shared stateful logic. There is no React Query or external data cache, so hooks are responsible for loading, refreshing, and cleaning up IPC-driven state.

Representative examples:

- `src/renderer/src/hooks/useProjects.ts` for project list loading and local persistence
- `src/renderer/src/pages/task-detail/useTaskDetail.tsx` for a large page-level orchestration hook
- `src/renderer/src/hooks/useLogStream.ts` for event-driven session log handling

---

## Custom Hook Patterns

Prefer hooks that expose a small, explicit surface:

- State values
- Derived flags
- Actions or callbacks
- Cleanup handled internally

Use page-level hooks only when a route genuinely needs orchestration. When logic belongs to one domain concept, prefer smaller hooks inside the owning page or feature folder instead of adding more top-level hooks.

If a hook starts coordinating unrelated responsibilities, split it by concern. `useTaskDetail.tsx` documents the cost of merging too many jobs into a single hook.

---

## Data Fetching

Data fetching is done with preload IPC calls and manual refresh patterns:

- Wrap async loaders in `useCallback`
- Trigger them from `useEffect`
- Keep explicit loading and error state in the hook
- Subscribe and unsubscribe from renderer events inside effects

`useProjects.ts` is the clearest small example: it fetches on mount, listens for `projects:changed`, and exposes `refresh`.

Avoid introducing a second data-fetching style for one-off features. Stay consistent with the existing explicit loading model unless the whole area is being migrated together.

---

## Naming Conventions

Hook naming rules:

- All hooks start with `use`
- Use nouns for domain hooks (`useProjects`, `useDashboardData`)
- Use verbs only when the hook is clearly an effectful helper (`useUnsavedChangesGuard`)
- Keep page-local hooks in the page folder when they are not shared elsewhere

Do not hide page ownership by placing one-off orchestration hooks in top-level `hooks/` just because they use React state.

---

## Common Mistakes

Common mistakes:

- Creating a top-level hook for logic that only one page uses
- Mixing IPC, UI state, notifications, and navigation in the same hook without clear sections
- Forgetting to clean up event listeners from `window.api` or DOM custom events
- Re-declaring cross-layer payload types locally instead of importing shared contracts

New hooks should be easier to delete, move, and test than the legacy page orchestration hooks.
