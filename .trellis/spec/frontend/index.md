# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

These documents describe the current frontend conventions for Deskly's Electron renderer. The source of truth is the existing code under `src/renderer/src`, not an idealized architecture.

Use this directory before changing renderer code in:

- `src/renderer/src/pages`
- `src/renderer/src/components`
- `src/renderer/src/hooks`
- `src/renderer/src/providers`
- `src/renderer/src/data`
- `src/renderer/src/lib`

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

## Pre-Development Checklist

Read these before modifying renderer code:

1. This `index.md`
2. [Directory Structure](./directory-structure.md)
3. [Component Guidelines](./component-guidelines.md)
4. [Hook Guidelines](./hook-guidelines.md) if you will touch hooks, async loading, or page orchestration
5. [State Management](./state-management.md) if you will add shared state, persistence, or event-driven refresh
6. [Type Safety](./type-safety.md) for IPC boundaries, shared models, or new TypeScript types
7. [Quality Guidelines](./quality-guidelines.md) before finishing any frontend change

Also read shared thinking guides from `.trellis/spec/guides/` when the change crosses layers or duplicates existing patterns.

---

## Notes

- Language for the guideline docs should remain English.
- When the codebase evolves, update these docs to reflect real usage rather than aspirational patterns.
