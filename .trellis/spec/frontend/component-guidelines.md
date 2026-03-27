# Component Guidelines

> How components are built in this project.

---

## Overview

Renderer components are plain React function components written in TypeScript. The codebase mixes highly reusable UI primitives with domain components, so new work should keep those layers separate:

- Shared primitives belong in `components/ui/`, `components/shared/`, or `components/layout/`
- Domain-specific UI belongs near the page or feature that owns it
- Heavy orchestration should stay in hooks or data adapters, not in presentational components

Representative examples:

- `src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx` shows a large domain component that still keeps editor state and composition inside one module
- `src/renderer/src/components/shared/page-shell.tsx` shows reusable layout composition
- `src/renderer/src/components/ui/` contains low-level primitives used across pages

---

## Component Structure

Typical component files follow this order:

1. Imports
2. Exported prop and helper types
3. Constants
4. Small helper functions
5. Component implementation
6. Small private subcomponents only when they are truly file-local

Use named exports for top-level components. Keep helper types close to the component unless they are shared by multiple modules in the same page or feature.

---

## Props Conventions

Define props with `interface` when the component has a stable public surface. This is the dominant pattern in files such as `WorkflowTemplateDialog.tsx`, `TaskDetailHeader.tsx`, and settings tab components.

Guidelines:

- Prefer explicit prop names over generic `data` or `options`
- Model callbacks with precise input types
- Keep renderer-only view model props local to the page or feature
- Import cross-layer types from shared contracts or `@/data`, not from ad hoc local duplicates

If a component receives too many props because it also owns orchestration, that is a signal to extract a page hook or a feature-level view model.

---

## Styling Patterns

The renderer primarily uses utility-class styling with shared UI primitives. `WorkflowTemplateDialog.tsx` is a good example of the current style: semantic React structure plus locally named class constants for repeated utility groups.

Guidelines:

- Prefer utility classes and shared primitives over one-off wrappers
- Extract repeated utility strings into file-local constants when the same group is reused several times
- Use `cn` for conditional class composition
- Keep visual tokens consistent with the existing UI kit instead of inventing per-page styling systems

---

## Accessibility

Use semantic interactive elements and accessible primitives by default:

- Prefer shared `Button`, `Dialog`, `Select`, and related components over custom click targets
- Keep keyboard interaction intact when adding editors, dialogs, or lists
- Do not replace buttons with clickable `div`s unless there is a strong reason and keyboard support is recreated
- Preserve focus management when using dialog or sidebar patterns

When a component wraps a form-like workflow, keep labels, headings, and button text explicit. Workflow and task editors should remain understandable without relying on icon-only affordances.

---

## Common Mistakes

Common problems in the current codebase:

- Page-only business logic leaking into reusable component folders
- Components becoming orchestration hubs because data loading, event wiring, and rendering were merged together
- Re-declaring shared DTOs inside renderer files
- Letting legacy directories become the default for new work even when a feature-local location would be clearer

The large `useTaskDetail` ecosystem is a reminder that once orchestration grows too much, future changes become expensive. New components should bias toward smaller responsibilities.
