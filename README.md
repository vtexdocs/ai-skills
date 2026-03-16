# VTEX External Developer Skills

A collection of AI agent skills for VTEX platform development, organized across five specialized tracks. Each skill is authored once in a canonical Markdown format and exported to multiple AI platforms, so you get consistent guidance regardless of which tool you use.

## Overview

This repository contains structured knowledge and best practices for VTEX development. The skills are designed to give AI assistants accurate, constraint-aware guidance when helping developers build on VTEX, covering everything from FastStore overrides to payment connector security.

The build system is Bun-based. Skills live in `tracks/`, exports go to `exports/`, and two scripts handle everything: `validate.ts` checks skill quality and `export.ts` generates platform-specific files.

## Tracks

Five tracks, 21 skills total.

### Track 1: FastStore Implementation & Customization (4 skills)

Overrides, theming, SDK hooks, and data fetching for FastStore storefronts. Covers the override API, design token system, cart/session/search state management, and GraphQL API extensions.

| Skill | Description |
|---|---|
| `faststore-overrides` | Section and component overrides using `getOverriddenSection()` |
| `faststore-theming` | Design tokens, SCSS theming, and `[data-fs-*]` attribute targeting |
| `faststore-state-management` | Cart, Session, Search, and Analytics SDK hooks |
| `faststore-data-fetching` | GraphQL fragments, API extensions, and resolver patterns |

### Track 2: Payment Connector Development (4 skills)

All 9 Payment Provider Protocol endpoints, idempotency patterns, async payment flows, and PCI compliance via the Secure Proxy. Covers both mandatory payment flow and optional configuration flow.

| Skill | Description |
|---|---|
| `payment-provider-protocol` | All 9 PPP endpoints: 6 payment flow + 3 configuration flow |
| `payment-idempotency` | `paymentId` and `requestId` idempotency, duplicate prevention |
| `payment-async-flow` | Async approval, callback URLs, and the 7-day retry window |
| `payment-pci-security` | Secure Proxy, card tokenization, and PCI constraint enforcement |

### Track 3: Custom VTEX IO Apps (5 skills)

App manifest, builders, policies, `@vtex/api` clients, React components, GraphQL schemas, and MasterData v2 integration. The most comprehensive track, covering both frontend and backend IO development.

| Skill | Description |
|---|---|
| `vtex-io-app-structure` | Manifest, builders, policies, and app architecture |
| `vtex-io-service-apps` | Node service apps, `ctx.clients`, and `@vtex/api` client hierarchy |
| `vtex-io-react-apps` | React components, `css-handles`, hooks, and Styleguide usage |
| `vtex-io-graphql` | GraphQL schemas, resolvers, `@cacheControl`, and `@auth` directives |
| `vtex-io-masterdata` | MasterData v2 CRUD, schema design, and the 60-schema limit |

### Track 4: Marketplace Integration (4 skills)

SKU catalog sync, order hooks, fulfillment simulation, and rate limiting for marketplace connectors. Covers the Change Notification flow, Feed v3 vs Hook tradeoffs, and invoice/tracking patterns.

| Skill | Description |
|---|---|
| `marketplace-catalog-sync` | Change Notification entry point, SKU suggestion lifecycle |
| `marketplace-order-hook` | Feed v3 (pull) vs Hook (push), filter types, commit patterns |
| `marketplace-fulfillment` | Simulation endpoint, 2.5s timeout, invoice and tracking updates |
| `marketplace-rate-limiting` | 429 handling, exponential backoff, circuit breaker patterns |

### Track 5: Headless Front-End Development (4 skills)

BFF architecture, Intelligent Search API, checkout proxy patterns, and caching strategy for headless VTEX storefronts. Covers why a BFF is mandatory and which APIs can never be called from the browser.

| Skill | Description |
|---|---|
| `headless-bff-architecture` | BFF layer design, auth proxy, and API key protection |
| `headless-intelligent-search` | Search, facets, autocomplete, and Search Events API |
| `headless-checkout-proxy` | Checkout API proxying, session cookies, and the 5-minute order window |
| `headless-caching-strategy` | TTL rules, stale-while-revalidate, and what must never be cached |

## Directory Structure

```text
vtex_skills/
  _templates/
    skill-template.md       # Canonical template for new skills
  exports/
    agents-md/              # AGENTS.md format (6 files)
    claude/                 # Claude Projects format (26 files)
    copilot/                # GitHub Copilot format (6 files)
    cursor/                 # Cursor .mdc format (26 files)
    opencode/               # OpenCode SKILL.md format (21 files)
  scripts/
    export.ts               # Generates all platform exports
    validate.ts             # Validates all skill files
  tracks/
    faststore/
      index.md
      skills/
        faststore-overrides/skill.md
        faststore-theming/skill.md
        faststore-state-management/skill.md
        faststore-data-fetching/skill.md
    headless/
      index.md
      skills/
        headless-bff-architecture/skill.md
        headless-intelligent-search/skill.md
        headless-checkout-proxy/skill.md
        headless-caching-strategy/skill.md
    marketplace/
      index.md
      skills/
        marketplace-catalog-sync/skill.md
        marketplace-order-hook/skill.md
        marketplace-fulfillment/skill.md
        marketplace-rate-limiting/skill.md
    payment/
      index.md
      skills/
        payment-provider-protocol/skill.md
        payment-idempotency/skill.md
        payment-async-flow/skill.md
        payment-pci-security/skill.md
    vtex-io/
      index.md
      skills/
        vtex-io-app-structure/skill.md
        vtex-io-service-apps/skill.md
        vtex-io-react-apps/skill.md
        vtex-io-graphql/skill.md
        vtex-io-masterdata/skill.md
  package.json
  tsconfig.json
```

## Usage

### AGENTS.md (Recommended)

AGENTS.md is the cross-tool standard for AI coding agent instructions, supported natively by Cursor, GitHub Copilot, Codex, Windsurf, Amp, Devin, and more. It is governed by the Linux Foundation's Agentic AI Foundation and adopted by over 60,000 repositories.

Copy the `exports/agents-md/` directory structure into your project root.

```bash
cp -r exports/agents-md/. /your-project/
```

This places a root `AGENTS.md` with links to per-track `AGENTS.md` files in subdirectories. Most AI coding tools will discover and follow these instructions automatically.

### Cursor

Copy `.mdc` files from `exports/cursor/` to `.cursor/rules/` in your project.

```bash
mkdir -p /your-project/.cursor/rules
cp exports/cursor/*.mdc /your-project/.cursor/rules/
```

Each skill exports with glob patterns that auto-attach the rule when you reference matching files. For example, the FastStore overrides skill activates when you open files in `src/components/overrides/`. Skills also include activation descriptions so Cursor's AI can decide when to include them based on conversation context.

Per-track composite files (e.g., `faststore-all.mdc`) are also available if you want all skills for a track loaded together.

### GitHub Copilot

Copy the combined instructions file from `exports/copilot/` to `.github/copilot-instructions.md` in your project.

```bash
cp exports/copilot/copilot-instructions.md /your-project/.github/copilot-instructions.md
```

Per-track files are also available in `exports/copilot/` if you only want a subset of tracks.

### Claude Projects

Upload files from `exports/claude/` as project knowledge in your Claude Project settings.

You can upload individual skill files for focused context, or the per-track composite files (e.g., `faststore.md`) for broader coverage. Claude will reference them automatically during conversations in that project.

### OpenCode

Copy skill directories from `exports/opencode/` to `~/.config/opencode/skills/`.

```bash
cp -r exports/opencode/. ~/.config/opencode/skills/
```

Each skill becomes a directory with a `SKILL.md` file. OpenCode discovers them automatically and makes them available as loadable skills in your sessions.

## Export Commands

Generate platform exports from the source skill files:

```bash
# Export to all platforms
bun run export

# Export to a specific platform
bun run export:cursor
bun run export:copilot
bun run export:claude
bun run export:agents-md
bun run export:opencode
```

Exports are written to `exports/{platform}/` and overwrite existing files. Run export after any skill changes before committing.

## Validation

Check all skill files for quality and correctness before exporting:

```bash
bun run validate
```

The validator runs 11 checks on every skill file:

- **yaml-validity** — frontmatter parses without errors
- **description-quality** — description is at least 20 words
- **required-sections** — all 6 H2 sections present in correct order
- **code-block-annotations** — all opening code fences have a language annotation
- **no-placeholders** — no `TBD`, `TODO`, or `[placeholder]` text in prose
- **detection-patterns** — each constraint includes a Detection field
- **paired-examples** — each constraint has both a CORRECT and WRONG example
- **url-format** — all VTEX doc links use the correct domain format
- **size-bounds** — skill files are within acceptable size limits
- **track-consistency** — the `track` frontmatter field matches the directory
- **globs-format** — if present, the `globs` field is a valid array of glob pattern strings

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for a complete guide on adding skills, tracks, and export platforms.
