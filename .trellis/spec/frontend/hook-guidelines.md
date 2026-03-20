# Hook Guidelines

> How hooks are used in this project.

---

## Overview

This repo uses custom hooks for three main jobs:

- loading and mutating IPC-backed data,
- managing subscriptions and side effects,
- extracting page-level orchestration out of JSX-heavy components.

There is no React Query, SWR, Zustand, or Redux in the renderer today. Data hooks are written with `useState`, `useEffect`, `useCallback`, and `useMemo`.

---

## Custom Hook Patterns

- Name hooks with the `use*` prefix.
- Put shared hooks in `src/renderer/src/hooks/`.
- Keep page-only hooks colocated with the page when they are tightly coupled to that route.
- Return an object with named fields and actions instead of positional tuples for complex hooks.
- Wrap async loaders and event handlers in `useCallback` when they are reused by effects or children.
- Always clean up event listeners, subscriptions, and media query listeners in the effect cleanup function.

Examples:

- `src/renderer/src/hooks/useProjects.ts` is a shared data hook with loading, error, refresh, and mutation actions.
- `src/renderer/src/hooks/useDashboardData.ts` derives summary and activity lists from loaded tasks.
- `src/renderer/src/pages/task-detail/useTaskDetail.tsx` is a feature-local hook that owns orchestration for a single page.

---

## Data Fetching

Current data fetching is manual and explicit:

- call `window.api.*` or `db.*` inside an async function,
- track `loading` and `error` with local state,
- trigger the loader in `useEffect`,
- refresh explicitly after mutations.

The repo also uses browser events or Electron callbacks for synchronization in a few places.

Examples:

- `src/renderer/src/hooks/useProjects.ts` loads projects on mount, refreshes after mutations, and listens for `projects:changed`.
- `src/renderer/src/hooks/useDashboardData.ts` reloads when `projectId` changes and derives memoized summaries.
- `src/renderer/src/providers/theme-provider.tsx` listens for system theme changes and cleans up the listener.

Do not introduce a caching/state-query library unless the current manual pattern is clearly failing in multiple features.

---

## Naming Conventions

- Shared hooks live in `hooks/` with camelCase filenames such as `useProjects.ts`, `useVitePreview.ts`, and `useSessionLogs.ts`.
- Provider consumer hooks stay next to the provider: `useLanguage`, `useTheme`, `useSidebar`.
- Feature-local hooks follow the same `use*` naming in the page folder: `pages/task-detail/useTaskDetail.tsx`.
- If a hook mostly exposes actions plus state, return a named object so call sites stay readable.

---

## Common Mistakes

- Performing async work directly in render instead of inside an effect or callback.
- Forgetting cleanup for window events, Electron listeners, or `matchMedia` subscriptions.
- Storing derived values in state when `useMemo` or a plain calculation is enough.
- Moving a hook to `hooks/` before it is actually shared.
- Expanding direct `window.api` usage in multiple components when one shared hook or adapter would reduce duplication.
