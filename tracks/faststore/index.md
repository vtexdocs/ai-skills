# FastStore Track

VTEX's headless storefront framework built on Next.js and React. This track covers everything needed to build, style, and extend FastStore storefronts.

## Skill

| Skill | Description |
|-------|-------------|
| **[faststore-storefront](skills/faststore-storefront/skill.md)** | Core coding rules and workflow for developing FastStore storefronts — overrides, SCSS theming, GraphQL extensions, CMS registration, and analytics. |

The skill includes on-demand reference files for project structure, section overrides, GraphQL types, custom resolvers, SCSS tokens, CMS schemas, analytics, head scripts, native sections, and UI components.

## Key Constraints

- **Never edit `.faststore/`** — generated on every build.
- **All overrides use `getOverriddenSection`** from `@faststore/core`.
- **SCSS modules only** — no global styles; prefer design tokens.
- **No direct Next.js API routes** — use GraphQL extensions.
- **No client-side API keys** — route all calls through the BFF/GraphQL layer.
- **CMS sections receive no props** — read data from context or BFF.

## Related Tracks

- [Headless Front-End Development](../headless/index.md) — custom storefronts without FastStore.
- [Custom VTEX IO Apps](../vtex-io/index.md) — backend services and integrations.
