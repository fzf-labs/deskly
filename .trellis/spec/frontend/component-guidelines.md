# Component Guidelines

> How components are built in this project.

---

## Overview

The renderer uses React function components with TypeScript and Tailwind CSS. Most components are named exports. Route pages are usually thin and delegate async logic or orchestration to hooks.

The component stack is:

- `components/ui/*` for reusable primitives and Radix wrappers.
- `components/shared/*` for cross-feature pieces.
- `components/<feature>/*` for reusable domain-specific components.
- `pages/<feature>/components/*` for page-local pieces that should not be shared yet.

---

## Component Structure

Typical structure in this repo:

1. Imports, with `@/` aliases for renderer modules.
2. Local prop interfaces or local helper constants.
3. Component body with state and handlers.
4. JSX return with Tailwind utility classes inline.

Keep route pages focused on wiring data and navigation. Move heavy stateful logic into a hook when the file starts mixing loading, IPC, workflow orchestration, and view derivation.

Examples:

- `src/renderer/src/pages/dashboard/DashboardPage.tsx` is a thin page component that delegates data loading to hooks.
- `src/renderer/src/components/projects/ProjectDialogs.tsx` keeps local form state and submit handlers inside the dialog component.
- `src/renderer/src/pages/task-detail/useTaskDetail.tsx` shows the point where page logic is large enough to extract from the page component.

---

## Props Conventions

- Prefer `interface <Name>Props` for component props.
- Destructure props in the function signature.
- Type callbacks explicitly, for example `(open: boolean) => void`.
- Use `ReactNode` only for true composition slots such as provider children or wrappers.
- Keep props narrow. Do not pass large mutable objects when the component only needs a few fields.

Examples:

- `src/renderer/src/components/shared/SetupGuard.tsx` uses a small `children: ReactNode` prop contract.
- `src/renderer/src/components/projects/ProjectDialogs.tsx` types dialog callbacks inline and keeps them explicit.
- `src/renderer/src/components/ui/button.tsx` merges intrinsic button props with variant props for reusable primitives.

---

## Styling Patterns

- Use Tailwind utility classes inline in JSX for most component styling.
- Use design tokens from `theme.css` through semantic utility names such as `bg-background`, `text-muted-foreground`, and `border-border`.
- Use `cn()` from `src/renderer/src/lib/utils.ts` for conditional class merging.
- Use `cva()` for reusable variant-heavy primitives in `components/ui`.
- Prefer existing Radix-based wrappers in `components/ui` before creating one-off modal/menu/tooltip implementations.

Examples:

- `src/renderer/src/components/ui/button.tsx` uses `cva` plus `cn` to define reusable variants.
- `src/renderer/src/components/projects/ProjectDialogs.tsx` uses `cn` for local mode-toggle styling.
- `src/renderer/src/components/layout/MainLayout.tsx` composes layout entirely with semantic Tailwind utility classes and theme tokens.

---

## Accessibility

- Prefer semantic elements first: use `button`, `form`, `input`, `textarea`, and `label` instead of clickable `div`s.
- Always set `type="button"` on non-submit buttons inside forms or interactive cards.
- Reuse Radix-based `Dialog`, `DropdownMenu`, `Tooltip`, and related wrappers for keyboard and focus handling.
- When placing nested interactive controls inside a clickable container, stop propagation deliberately.
- Keep focus styling consistent by using existing UI primitives or existing `outline-ring` and `focus-visible` token patterns.

Examples:

- `src/renderer/src/components/projects/ProjectDialogs.tsx` uses a real `<form>` and submit handler.
- `src/renderer/src/pages/projects/ProjectsPage.tsx` uses `type="button"` and `event.stopPropagation()` for nested menu actions inside a clickable card.
- `src/renderer/src/components/ui/button.tsx` includes focus-visible treatment in the shared primitive.

---

## Common Mistakes

- Letting page components grow orchestration logic that belongs in a hook or helper.
- Copying raw button, dialog, or dropdown behavior when a shared primitive already exists in `components/ui`.
- Promoting page-local components to `components/` too early. Reuse should be real, not speculative.
- Introducing non-semantic clickable wrappers without keyboard behavior.
- Mixing shared translated copy and hardcoded strings inconsistently. The repo currently has both patterns, so new reusable UI should prefer the locale catalog when the text is shared across screens.
