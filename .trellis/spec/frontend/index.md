# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

Deskly currently ships a hybrid renderer architecture:

- Route entry points live in `src/renderer/src/pages/`
- Reusable UI and page sections live in `src/renderer/src/components/`
- IPC access is centralized in `src/renderer/src/data/` and `src/renderer/src/lib/electron-api.ts`
- Shared React state is managed with hooks and providers instead of a global state library
- Feature folders are being introduced incrementally; existing code still contains legacy page-centric modules

These guides should describe the code that exists today while nudging new work toward the migration target.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Ready |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Ready |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | Ready |
| [State Management](./state-management.md) | Local state, global state, server state | Ready |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Ready |
| [Type Safety](./type-safety.md) | Type patterns, validation | Ready |

---

## How To Use These Guidelines

Read the file that matches the work you are about to do:

1. Start with directory structure when adding or moving modules.
2. Read component and hook guidance before touching renderer UI logic.
3. Read state management and type safety before introducing new data flows or cross-layer types.
4. Read quality guidance before large refactors or reviews.

The goal is to help AI assistants and contributors match the current codebase, keep behavior stable, and avoid introducing more architectural drift during the migration to feature-based modules.

---

**Language**: All documentation should be written in **English**.
