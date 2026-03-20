# Directory Structure

> How frontend code is organized in this project.

---

## Overview

Frontend code lives in `src/renderer/src`. This is an Electron renderer, so UI code is separated from the main-process code in `src/main` and preload code in `src/preload`.

The current structure is feature-oriented at the route level:

- `pages/` contains route entry points and page-local modules.
- `components/` contains reusable UI grouped by domain.
- `hooks/` contains shared renderer hooks.
- `providers/` contains app-wide React context providers.
- `data/` contains renderer-side adapters, types, settings, and small data modules.
- `lib/` contains shared utilities and wrappers used across features.
- `config/` contains styling, locale catalogs, and app config.

---

## Directory Layout

```text
src/renderer/src/
├── App.tsx
├── main.tsx
├── router.tsx
├── components/
│   ├── ui/          # Reusable UI primitives and wrappers
│   ├── layout/      # App shell and sidebar layout
│   ├── shared/      # Cross-feature shared components
│   ├── task/        # Task-specific reusable pieces
│   ├── git/         # Git-related viewers and controls
│   └── ...
├── pages/
│   ├── dashboard/
│   │   ├── DashboardPage.tsx
│   │   └── components/
│   ├── task-detail/
│   │   ├── TaskDetailPage.tsx
│   │   ├── useTaskDetail.tsx
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── components/
│   └── ...
├── hooks/
├── providers/
├── data/
├── lib/
└── config/
```

---

## Module Organization

- Put route entry points in `pages/*` and export them through `pages/index.ts`.
- Keep page-specific complexity close to the page. If logic, types, constants, or subcomponents only serve one route, colocate them under that page folder.
- Put reusable building blocks in `components/` and group them by domain instead of by HTML element count.
- Keep low-level UI primitives in `components/ui`. Higher-level compositions belong in feature folders such as `components/task`, `components/git`, or `components/layout`.
- Put cross-page hooks in `hooks/`. If a hook only supports one page, keep it in that page folder instead of promoting it too early.
- Use `data/` for typed IPC/database adapters and settings modules, not for React UI state.
- Use `lib/` for helpers that do not need React state or rendering.

---

## Naming Conventions

- Use `PascalCase.tsx` for React components and pages: `DashboardPage.tsx`, `MainLayout.tsx`, `CreateTaskDialog.tsx`.
- Use `camelCase.ts` or `camelCase.tsx` for hooks and utilities: `useProjects.ts`, `useDashboardData.ts`, `cli-tools.ts`.
- Use `kebab-case` for provider, config, and helper filenames when that matches the existing folder style: `language-provider.tsx`, `theme-provider.tsx`.
- Use `index.ts` barrel files to expose folder public APIs when a folder has multiple related exports.
- Keep folder names lowercase, usually kebab-case for multi-word features: `task-detail`, `pipeline`, `shared`.

---

## Examples

- Route composition:
  `src/renderer/src/router.tsx` wires pages exported from `src/renderer/src/pages/index.ts`.
- Page-local colocation:
  `src/renderer/src/pages/task-detail/` keeps the page, a large page-only hook, local types, constants, and subcomponents together.
- Shared UI layering:
  `src/renderer/src/components/ui/button.tsx` is a reusable primitive, while `src/renderer/src/components/layout/MainLayout.tsx` is app-shell composition.
- Shared hooks vs page-local hooks:
  `src/renderer/src/hooks/useProjects.ts` is reused across routes, while `src/renderer/src/pages/task-detail/useTaskDetail.tsx` is intentionally local to one feature.
