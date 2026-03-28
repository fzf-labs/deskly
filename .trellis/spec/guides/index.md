# Thinking Guides

> **Purpose**: Expand your thinking to catch things you might not have considered.

---

## Why Thinking Guides?

**Most bugs and tech debt come from "didn't think of that"**, not from lack of skill:

- Didn't think about what happens at layer boundaries → cross-layer bugs
- Didn't think about code patterns repeating → duplicated code everywhere
- Didn't think about edge cases → runtime errors
- Didn't think about future maintainers → unreadable code

These guides help you **ask the right questions before coding**.

---

## Available Guides

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| [AI Development Enhancement Plan v2](./ai-development-enhancement-plan.md) | Improve AI delivery workflow after architecture cleanup | When planning the next wave of AI productivity investments |
| [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md) | Identify patterns and reduce duplication | When you notice repeated patterns |
| [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md) | Think through data flow across layers | Features spanning multiple layers |
| [TDD Development Guide](./tdd-development-guide.md) | Apply test-first development in a practical repo-specific way | When you want to write tests before implementation |

---

## Quick Reference: Thinking Triggers

### When to Think About AI Development Ergonomics

- [ ] Architecture is already cleaner, but AI tasks still feel inconsistent
- [ ] Sessions spend too much time rediscovering boundaries or examples
- [ ] Reviews keep finding the same import, contract, or scope mistakes
- [ ] Full validation is too slow for normal iteration

-> Read [AI Development Enhancement Plan v2](./ai-development-enhancement-plan.md)

### When to Think About Test-First Development

- [ ] You are changing logic, mappings, validation, or orchestration behavior
- [ ] You are fixing a bug with a reproducible failure
- [ ] You are refactoring a risky legacy module
- [ ] You want a tighter feedback loop than manual testing

-> Read [TDD Development Guide](./tdd-development-guide.md)

### When to Think About Cross-Layer Issues

- [ ] Feature touches 3+ layers (API, Service, Component, Database)
- [ ] Data format changes between layers
- [ ] Multiple consumers need the same data
- [ ] You're not sure where to put some logic

→ Read [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md)

### When to Think About Code Reuse

- [ ] You're writing similar code to something that exists
- [ ] You see the same pattern repeated 3+ times
- [ ] You're adding a new field to multiple places
- [ ] **You're modifying any constant or config**
- [ ] **You're creating a new utility/helper function** ← Search first!

→ Read [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md)

---

## Pre-Modification Rule (CRITICAL)

> **Before changing ANY value, ALWAYS search first!**

```bash
# Search for the value you're about to change
grep -r "value_to_change" .
```

This single habit prevents most "forgot to update X" bugs.

---

## How to Use This Directory

1. **Before coding**: Skim the relevant thinking guide
2. **During coding**: If something feels repetitive or complex, check the guides
3. **After bugs**: Add new insights to the relevant guide (learn from mistakes)

---

## Contributing

Found a new "didn't think of that" moment? Add it to the relevant guide.

---

**Core Principle**: 30 minutes of thinking saves 3 hours of debugging.
