# Backend Development Guidelines

> Service, repository, and IPC conventions for the Electron main process.

---

## Overview

Deskly backend logic lives in the Electron main process and is organized around a few clear layers:

- IPC handlers validate renderer input and delegate to services
- Services own orchestration, runtime coordination, and mapping between persistence and API-facing shapes
- Repositories own SQL and database persistence details
- Shared contracts define cross-layer payloads that renderer, preload, and main can agree on

These guides document the current structure and the direction of the architecture refactor.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Service Guidelines](./service-guidelines.md) | Main-process orchestration and service boundaries | Ready |
| [Repository Guidelines](./repository-guidelines.md) | Persistence ownership and database mapping rules | Ready |
| [IPC Guidelines](./ipc-guidelines.md) | Channel ownership, validation, and handler patterns | Ready |

---

## Working Rules

1. Validate all renderer input at the IPC boundary.
2. Keep orchestration in services, not in repositories.
3. Keep database record shapes and API-facing shapes clearly separated.
4. Reuse shared contracts for cross-layer payloads instead of redefining them in main or renderer.
