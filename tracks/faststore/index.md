# FastStore Implementation & Customization

Comprehensive guide to FastStore overrides, theming, SDK hooks, and component customization for building custom storefronts. This track covers everything needed to build, style, and extend FastStore storefronts beyond the default configuration.

## Overview

FastStore is VTEX's modern, headless storefront framework built on Next.js and React. This track teaches developers how to customize FastStore storefronts through overrides (component replacement), theming (visual customization), state management (cart, session, search), and data integration (GraphQL extensions). Whether you're styling a storefront, replacing components, or integrating custom data sources, this track provides the patterns and constraints needed to build production-ready FastStore implementations.

## Skills

| Skill | Description | Link |
|-------|-------------|------|
| **FastStore Section & Component Overrides** | Learn how to use `getOverriddenSection()` to customize native sections and components, replace individual components within sections, and pass custom props while preserving FastStore integrations. | [skills/faststore-overrides/skill.md](skills/faststore-overrides/skill.md) |
| **FastStore Theming & Design Tokens** | Master the design token system (global and local), create custom themes in `src/themes/`, and style components using Sass and CSS custom properties without modifying component behavior. | [skills/faststore-theming/skill.md](skills/faststore-theming/skill.md) |
| **FastStore SDK State Management** | Use `@faststore/sdk` hooks (`useCart()`, `useSession()`, `useSearch()`) to manage cart, session, and search state. Understand why the SDK is the single source of truth for these concerns. | [skills/faststore-state-management/skill.md](skills/faststore-state-management/skill.md) |
| **FastStore Data Layer & API Integration** | Extend the FastStore GraphQL API with VTEX and third-party data sources, use fragments to customize queries, and consume extended data in components. | [skills/faststore-data-fetching/skill.md](skills/faststore-data-fetching/skill.md) |

## Recommended Learning Order

1. **Start with Theming** — Understand design tokens and the Brandless architecture first. Most customizations begin with visual changes.
2. **Move to Overrides** — Once you understand theming, learn how to replace components when theming alone isn't enough.
3. **Add State Management** — Learn the SDK hooks for building interactive features (cart, search, filters).
4. **Integrate Custom Data** — Finally, extend the GraphQL API to bring in custom data sources.

## Key Constraints Summary

- **Override files MUST live in `src/components/overrides/`** — FastStore auto-discovers them. Placing them elsewhere breaks the override system.
- **Never override components outside their parent section** — Overrides work at the section level only. You cannot override a component in isolation.
- **Use design tokens, not hardcoded values** — Hardcoded colors/spacing break theming consistency and make maintenance difficult.
- **Never build custom state for cart/session/search** — The SDK provides these. Building custom state causes sync issues and duplicates logic.
- **Never expose API keys client-side** — All VTEX API calls must go through the GraphQL layer or a BFF. Direct API calls from the browser expose credentials.
- **FastStore explicitly forbids custom Next.js API routes** — Use GraphQL extensions instead. Custom routes bypass FastStore's security and caching.

## Related Tracks

- **For headless approaches without FastStore**, see [Track 5: Headless Front-End Development](../headless/index.md) — Build custom storefronts with your own frontend framework.
- **For backend services and integrations**, see [Track 3: Custom VTEX IO Apps](../vtex-io/index.md) — Extend FastStore with VTEX IO service apps.
