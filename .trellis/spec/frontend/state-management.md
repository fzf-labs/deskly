# State Management

> How state is managed in this project.

---

## Overview

State management is intentionally lightweight in the renderer. The current stack is:

- `useState` for local UI state,
- `useMemo` for derived state,
- React context providers for app-wide UI preferences,
- `localStorage` and settings helpers for persistence,
- manual IPC fetch/mutate flows for backend-owned state.

There is no dedicated global state library in active use.

---

## State Categories

- Local component state:
  Use `useState` for dialogs, forms, toggles, selections, and transient UI state.
  Examples: `src/renderer/src/components/projects/ProjectDialogs.tsx`, `src/renderer/src/components/task/CreateTaskDialog.tsx`.

- Feature/page state:
  Put medium-complexity state in a custom hook when a page needs loaders, derived view state, and action handlers.
  Examples: `src/renderer/src/hooks/useDashboardData.ts`, `src/renderer/src/pages/task-detail/useTaskDetail.tsx`.

- App-wide UI state:
  Use React context providers for concerns that affect large parts of the shell.
  Examples: `src/renderer/src/providers/language-provider.tsx`, `src/renderer/src/providers/theme-provider.tsx`, `src/renderer/src/components/layout/sidebar-context.tsx`.

- Persisted client state:
  Store stable user choices in settings helpers or `localStorage`.
  Examples: language/theme settings in `src/renderer/src/data/settings/`, current project selection in `src/renderer/src/hooks/useProjects.ts`.

- IPC/backend state:
  Load backend data on demand and refresh after writes.
  Examples: `src/renderer/src/hooks/useProjects.ts`, `src/renderer/src/data/adapter.ts`.

---

## When to Use Global State

Promote state to a provider only when all of these are true:

- multiple unrelated routes need the same value,
- prop drilling would become noisy,
- the value represents app-level UI/session state rather than one feature's workflow.

Current examples that justify global state:

- theme and resolved theme,
- language and translation helpers,
- sidebar open/closed state.

Project selection currently uses `useProjects` plus `localStorage` and window events rather than a top-level store. Follow that existing approach unless there is a clear reason to consolidate it further.

---

## Server State

The renderer does not use a server-state library today. Current practice is:

- fetch through `window.api` or `db`,
- keep `loading` and `error` locally,
- refresh after mutations,
- use custom window events or Electron listeners when another part of the app can change the data.

Examples:

- `src/renderer/src/hooks/useProjects.ts` dispatches and listens for `projects:changed`.
- `src/renderer/src/pages/task-detail/useTaskDetail.tsx` reloads task and workflow state after runtime events.
- `src/renderer/src/hooks/useDashboardData.ts` recomputes summaries from the latest fetched task list.

---

## Common Mistakes

- Keeping duplicate copies of the same backend data in multiple components.
- Forgetting to refresh state after a successful mutation.
- Introducing a new global store for state that is only used by one route.
- Persisting ephemeral UI state that should reset naturally when the screen closes.
- Storing derived counts, labels, or filtered lists in state instead of deriving them from source data.
