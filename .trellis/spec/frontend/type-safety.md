# Type Safety

> Type safety patterns in this project.

---

## Overview

Deskly uses TypeScript across renderer, preload, and main. The most important rule is that cross-layer types must have a single source of truth.

From this refactor onward:

- Shared DTOs and IPC payloads belong in `src/shared/contracts/`
- Renderer modules should import those contracts through `@/data` or direct shared contract exports
- Main-process modules should re-export or consume the same shared contracts instead of redefining entity shapes

Renderer-only view models, UI state, and presentation helpers may still live next to the page or feature that owns them.

---

## Type Organization

Use these placement rules:

- `src/shared/contracts/`: cross-layer DTOs, IPC payloads, and shared result shapes
- `src/renderer/src/pages/<page>/types.ts`: page-local UI models
- `src/renderer/src/features/<feature>/model/`: feature-local domain models when they do not cross the Electron boundary
- `src/main/types/`: compatibility re-exports for main-process consumers

Do not create new copies of task, workflow, automation, project, or session contracts in renderer folders.

---

## Validation

Runtime validation happens at the IPC boundary in main-process handlers using the local validator utilities (`v.string`, `v.shape`, `v.enum`, and friends). Examples can be found in:

- `src/main/ipc/task.ipc.ts`
- `src/main/ipc/projects.ipc.ts`
- `src/main/ipc/database.ipc.ts`

Renderer code usually consumes already-validated results, but it should still normalize optional user input before sending it across the boundary.

---

## Common Patterns

Preferred patterns:

- Re-export shared contracts instead of copying them
- Use narrow unions for statuses and modes
- Keep optional and nullable behavior explicit
- Create local view-model types only when the shape is intentionally different from the shared contract
- Use helper functions to normalize ambiguous user input before it reaches business logic

If a module needs both a database shape and a service shape for the same concept, name both clearly instead of merging them into a vague catch-all type.

---

## Forbidden Patterns

Avoid:

- `any` in application code
- Large untyped payload objects passed through several layers
- New top-level renderer files that duplicate shared contracts
- Type assertions at every call site when one boundary wrapper can solve the problem centrally

Type assertions are acceptable at narrow interoperability edges, but they should not become the default coding style.
