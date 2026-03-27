# Service Guidelines

> How main-process services are structured in this project.

---

## Overview

Services coordinate work across repositories, runtime helpers, and external integrations. They should be the only place where multiple concerns are intentionally composed.

Current examples:

- `src/main/services/TaskService.ts` coordinates worktree setup, settings checks, workflow bootstrap, and task creation
- `src/main/services/ProjectService.ts` maps database records into renderer-facing project shapes
- `src/main/services/DatabaseService.ts` aggregates repositories and runtime services behind a persistence-oriented API

---

## Responsibilities

Services may:

- Validate business rules that are more specific than basic IPC schema validation
- Coordinate multiple repositories or runtime helpers
- Map between database records and API-facing contracts
- Define transaction or workflow boundaries
- Emit or react to service-level lifecycle events

Services should not:

- Embed raw SQL
- Reimplement shared DTOs locally
- Push renderer-only formatting concerns into main-process logic

---

## Mapping Rules

Keep persistence shapes and API-facing shapes explicit.

Examples from the current codebase:

- `ProjectService.toProject()` maps snake_case database fields into camelCase project objects
- `TaskService.mapTask()` converts database task records into task service results with worktree-aware fields

If both shapes are needed, keep both names visible. Do not hide the distinction with a loosely named catch-all type.

---

## Dependency Direction

Preferred direction:

1. IPC handler
2. Service
3. Repository or runtime helper

Examples:

- `task.ipc.ts` delegates task creation and lifecycle transitions to `TaskService`
- `TaskService` delegates persistence to `DatabaseService`
- `DatabaseService` delegates SQL to repositories such as `TaskRepository` and `WorkflowRunRepository`

---

## Common Mistakes

Avoid these patterns:

- Growing `DatabaseService` into a dumping ground for unrelated runtime orchestration
- Returning raw repository records when the public API expects a mapped shape
- Allowing business rules to spread across IPC handlers, services, and repositories at the same time
- Defining one-off DTOs in a service file when the same shape is visible to renderer code
