# Type Safety

> Type safety patterns in this project.

---

## Overview

The renderer is fully TypeScript-based. The dominant patterns are:

- interfaces for props and structured objects,
- string-literal unions for statuses and modes,
- feature-local types when a shape is not shared,
- `Record<string, unknown>` for flexible JSON-like config payloads,
- manual runtime guards at IPC or browser boundaries.

Path aliases are enabled through `tsconfig.web.json`:

- `@/*` -> `src/renderer/src/*`
- `@renderer/*` -> `src/renderer/src/*`

---

## Type Organization

- Put shared renderer/domain types in `src/renderer/src/data/types.ts`.
- Keep feature-local types beside the feature when they are not broadly reused.
- Keep provider context types inside the provider file unless they are shared outside it.
- Keep API client request/response types close to the API wrapper that uses them.

Examples:

- `src/renderer/src/data/types.ts` defines shared task, project, and automation shapes.
- `src/renderer/src/pages/task-detail/types.ts` keeps large page-specific view models local to the feature.
- `src/renderer/src/lib/providers.ts` defines request and response interfaces alongside the API client functions.
- `src/renderer/src/providers/language-provider.tsx` and `src/renderer/src/providers/theme-provider.tsx` keep their context contracts close to the provider.

---

## Validation

There is no dedicated runtime validation library in active use. Validation is manual and defensive:

- check `response.ok` on fetch calls,
- narrow with `Array.isArray`, `typeof`, and optional chaining,
- normalize external values into local unions or fallback values,
- guard Electron APIs before calling them.

Examples:

- `src/renderer/src/hooks/useDashboardData.ts` normalizes unknown status strings into the `TaskStatus` union.
- `src/renderer/src/config/locale/index.ts` narrows nested translation lookup and falls back safely.
- `src/renderer/src/components/projects/ProjectDialogs.tsx` checks whether dialog IPC APIs are available before invoking them.

If data enters from IPC or external APIs, keep the unsafe edge narrow and convert to a typed shape as early as possible.

---

## Common Patterns

- Prefer string-literal unions for small controlled enums.
- Use `as const` for static maps and translation registries.
- Use explicit prop and context interfaces instead of implicit object shapes.
- Keep separate types when backend/database naming differs from renderer view models.

Examples:

- `src/renderer/src/data/types.ts` uses literal unions such as `TaskStatus`.
- `src/renderer/src/config/locale/index.ts` uses `as const` for the translation registry.
- `src/renderer/src/hooks/useProjects.ts` defines a renderer-facing `Project` shape that differs from some database-layer snake_case types in `src/renderer/src/data/types.ts`.

---

## Forbidden Patterns

- Do not spread new `any` types through the UI when `unknown` plus narrowing would work.
- Do not hide model mismatches behind broad type assertions.
- Do not rely on non-null assertions for values that come from IPC, DOM lookups, or optional Electron APIs unless the invariant is truly guaranteed.

Legacy `as` casts and a few loose `any` edges already exist in the repo, especially at IPC boundaries. Keep new code stricter than the legacy edge, not looser.
