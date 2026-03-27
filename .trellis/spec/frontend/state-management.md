# State Management

> How state is managed in this project.

---

## Overview

Deskly does not use Redux, Zustand, or React Query in the renderer. State is currently managed with a combination of:

- Local component and hook state
- React context providers
- Explicit IPC reads and writes
- Browser storage and custom window events for a few global selections

This keeps the stack small, but it means ownership must stay clear or state quickly becomes scattered.

---

## State Categories

Use these categories consistently:

- Local UI state: dialog open flags, form drafts, temporary selection state
- Page orchestration state: loading flags, derived runtime status, fetched page data
- Shared app state: provider, language, feedback, and project context managed via providers
- Persisted client state: values mirrored in `localStorage` such as the current project selection
- IPC-backed data: tasks, workflow definitions, automation records, and session data loaded from main/preload APIs

---

## When to Use Global State

Promote state to a provider only when it is needed by multiple distant branches of the tree or when it truly represents app-wide configuration.

Use local hook state when:

- The state only matters to one route or one feature
- The state is derived from current page data
- The state can be recomputed on mount without user-facing cost

The current project selection in `useProjects.ts` is a good example of shared state that is still implemented with storage and custom events. New code should prefer clearer ownership if a provider already exists.

---

## Server State

There is no dedicated server-state layer. IPC-backed data is fetched manually and refreshed on demand.

Current patterns:

- Load data inside hooks with `useEffect`
- Refresh after mutations
- Broadcast coarse-grained DOM events such as `projects:changed` when needed
- Use `window.api` event listeners for streaming or process-driven updates

Keep these flows explicit. Avoid introducing hidden caches that can drift from main-process state.

---

## Common Mistakes

Common mistakes:

- Mixing durable domain state with short-lived UI state in the same hook
- Updating shared state through ad hoc DOM events when a local prop or provider would be clearer
- Duplicating the same entity shape in multiple state owners
- Leaving side effects inside `data/` when they belong to a feature use case

When in doubt, keep state closer to the page or feature that owns the behavior.
