# Repository Guidelines

> Persistence rules for `src/main/services/database/`.

---

## Overview

Repositories own database access. They are the narrowest layer in the backend and should focus on persistence details only.

Representative examples include:

- `TaskRepository`
- `ProjectRepository`
- `WorkflowDefinitionRepository`
- `WorkflowRunRepository`
- `AutomationRepository`

These repositories are coordinated by `DatabaseService`, not by IPC handlers directly.

---

## Responsibilities

Repositories should:

- Own SQL statements and row mapping
- Accept well-defined input types
- Return database-oriented record shapes
- Stay deterministic and side-effect-light outside the database itself

Repositories should not:

- Trigger notifications
- Coordinate CLI sessions, workflow scheduling, or Git behavior
- Read renderer concerns into SQL-layer code
- Re-map results into renderer-facing camelCase contracts

---

## Return Shapes

Return database shapes from repositories. Let services decide whether a higher-level mapping is needed.

This matches the current layering:

- repositories return snake_case records
- `DatabaseService` exposes persistence-level methods
- higher-level services such as `ProjectService` and `TaskService` map those records when the renderer-facing API needs a different shape

---

## Mutation Rules

Keep write paths predictable:

- Accept explicit input objects
- Avoid overloading one repository method with several unrelated behaviors
- Return the stored or updated record when callers need it
- Leave transaction coordination to the service layer when multiple repositories are involved

---

## Common Mistakes

Avoid:

- Business branching inside repository methods
- Hidden calls into other repositories
- Returning partially mapped records that blur persistence and domain layers
- Adding runtime-only concerns such as scheduler or notification logic into persistence modules
