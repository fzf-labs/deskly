# Directory Structure

> How frontend code is organized in this project.

---

## Overview

Deskly is in the middle of a migration from a page-first renderer to a feature-first renderer. New work should respect the current layout, but it should also avoid deepening the old top-level sprawl.

Current responsibility split:

- `pages/` contains route containers and page-specific orchestration
- `components/` contains reusable UI plus some legacy domain folders
- `hooks/` contains shared hooks and several legacy business hooks
- `data/` contains IPC-facing adapters and settings data sources
- `lib/` contains pure helpers and Electron wrapper utilities
- `providers/` contains React context providers
- `types/` contains legacy renderer-only type modules
- `features/` is the target location for new domain slices during the migration

---

## Directory Layout

```
src/renderer/src/
├── components/
├── data/
├── features/          # migration target; add new domain entry points here
├── hooks/
├── lib/
├── pages/
├── providers/
├── styles/
├── types/
└── utils/
```

---

## Module Organization

Use these rules when placing new code:

- Route shells stay in `pages/`; page files should assemble feature modules instead of owning business logic
- Cross-page UI belongs in `components/shared/`, `components/layout/`, or `components/ui/`
- Domain logic that serves one business area should move toward `features/<feature-name>/`
- IPC wrappers and cross-feature data access belong in `data/`
- Pure helpers with no renderer state belong in `lib/`

Examples from the current codebase:

- `pages/task-detail/` contains a full page slice with local types and helpers
- `components/pipeline/` contains reusable pipeline UI that will eventually move under a `pipeline` feature
- `data/adapter.ts` centralizes IPC calls for task, workflow, and automation flows
- `lib/electron-api.ts` is a thin wrapper around `window.api`

---

## Naming Conventions

Naming conventions in the renderer today:

- React components use `PascalCase.tsx`
- Hooks use `useXxx.ts` or `useXxx.tsx`
- Utility modules use `kebab-case.ts` or focused nouns
- Page folders use route-oriented names such as `task-detail`, `pipeline`, and `generated-workflow-review`
- Avoid creating new ambiguous folders such as `misc`, `common2`, or `helpers`

If a folder represents a business capability, prefer the final domain name that will survive the migration. For example, pipeline-related modules should converge on `pipeline` instead of creating another parallel workflow naming scheme.

---

## Examples

Useful references:

- `src/renderer/src/pages/task-detail/` for a page-local slice with types, helpers, and components
- `src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx` for a large domain editor with internal helper extraction
- `src/renderer/src/data/adapter.ts` for centralized IPC access
- `src/renderer/src/lib/electron-api.ts` for thin renderer-side wrappers over preload APIs
