# IPC Guidelines

> How Electron IPC handlers are defined and maintained.

---

## Overview

IPC handlers are the public boundary between renderer and main. They should stay thin, validated, and stable.

Representative examples:

- `src/main/ipc/projects.ipc.ts`
- `src/main/ipc/task.ipc.ts`
- `src/main/ipc/database.ipc.ts`
- `src/main/ipc/cli-session.ipc.ts`

---

## Handler Rules

Each handler should:

1. Use validator helpers (`v.string`, `v.shape`, `v.enum`, and related utilities) to validate input.
2. Delegate business logic to a service.
3. Return shared contracts or explicitly compatible shapes.
4. Keep channel names sourced from `src/main/ipc/channels/`.

Handlers should not:

- Contain long business workflows
- Recreate domain services inline
- Introduce ad hoc channel strings outside the shared channel registry

---

## Compatibility Rules

Deskly already has renderer consumers for `window.api`, so IPC compatibility matters:

- Keep channel string values stable unless there is an explicit breaking-change plan
- Preserve response envelopes when existing renderer code depends on them
- Prefer internal refactors, shared contracts, and re-exports over one-shot rewrites

For example, `projects.ipc.ts` still returns a success envelope on create because the renderer already expects that behavior.

---

## Payload Ownership

Cross-layer payloads belong in shared contracts. IPC modules may adapt them for validation or compatibility, but they should not become new type-authoring locations.

Current target ownership:

- tasks, workflows, automations, projects, notifications, and session payloads in `src/shared/contracts/`
- channel registry in `src/main/ipc/channels/`
- renderer API typing derived from preload implementation instead of a separate handwritten declaration file

---

## Common Mistakes

Avoid:

- Copy-pasting payload types into IPC files
- Mixing validation, orchestration, and persistence logic in one handler
- Returning slightly different shapes for the same channel without a compatibility reason
- Adding new channels directly in handler files without updating the shared channel registry
