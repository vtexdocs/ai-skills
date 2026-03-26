<p align="center">
  <img src="assets/banner.png" alt="VTEX AI Skills" width="100%">
</p>

<h1 align="center">VTEX AI Skills</h1>
<p align="center">
  <strong>22 AI agent skills for VTEX platform development — one source, five export formats.</strong>
</p>
<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#tracks--skills">Tracks</a> •
  <a href="#supported-platforms">Platforms</a> •
  <a href="#contributing">Contributing</a>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/skills-22-F71963" alt="22 skills">
  <img src="https://img.shields.io/badge/tracks-6-blue" alt="6 tracks">
  <img src="https://img.shields.io/badge/platforms-5-green" alt="5 platforms">
  <img src="https://img.shields.io/github/license/vtexdocs/ai-skills" alt="License">
  <img src="https://img.shields.io/github/actions/workflow/status/vtexdocs/ai-skills/generate-exports.yml?label=exports" alt="Build">
</p>

---

## Quick Start

Pick your platform and run one command. No clone needed.

### Install all skills with npx (Cursor, Claude Code, Codex, OpenCode, and 38+ agents)

```bash
npx skills add vtexdocs/ai-skills
```

This uses the [open skills CLI](https://github.com/vercel-labs/skills) to install skills into whichever AI agents you have configured. It auto-detects Cursor, Claude Code, Codex, OpenCode, and others. Use `--list` to preview available skills before installing, or `--all` to install everything non-interactively.

### AGENTS.md (Recommended — works with Cursor, Copilot, Codex, Windsurf, Amp, Devin, and more)

```bash
curl -sL https://github.com/vtexdocs/ai-skills/releases/latest/download/agents-md.tar.gz | tar xz -C your-project/
```

This places a root `AGENTS.md` with links to per-track files in subdirectories. Most AI coding tools discover and follow these instructions automatically.

### Cursor

```bash
mkdir -p your-project/.cursor/rules
curl -sL https://github.com/vtexdocs/ai-skills/releases/latest/download/cursor-rules.tar.gz | tar xz -C your-project/.cursor/rules/
```

Each `.mdc` file includes glob patterns that auto-attach the rule when you open matching files. Per-track composites (e.g., `faststore-all.mdc`) are also available.

### GitHub Copilot

```bash
mkdir -p your-project/.github
curl -sL https://github.com/vtexdocs/ai-skills/releases/latest/download/copilot-instructions.tar.gz | tar xz -C your-project/.github/
```

Per-track files are available in `exports/copilot/` if you only need a subset.

### Claude Projects

Upload files from [`exports/claude/`](exports/claude/) as project knowledge in your Claude Project settings. Use individual skill files for focused context, or per-track composites (e.g., `faststore.md`) for broader coverage.

### OpenCode

```bash
curl -sL https://github.com/vtexdocs/ai-skills/releases/latest/download/opencode-skills.tar.gz | tar xz -C ~/.config/opencode/skills/
```

Each skill becomes a directory with a `SKILL.md` file. OpenCode discovers them automatically and makes them available as loadable skills in your sessions.

<details>
<summary>Alternative: clone the repo and copy locally</summary>

```bash
git clone https://github.com/vtexdocs/ai-skills.git
cd ai-skills

# AGENTS.md
cp -r exports/agents-md/. /path/to/your-project/

# Cursor
mkdir -p /path/to/your-project/.cursor/rules
cp exports/cursor/*.mdc /path/to/your-project/.cursor/rules/

# Copilot
cp exports/copilot/copilot-instructions.md /path/to/your-project/.github/copilot-instructions.md

# OpenCode
cp -r exports/opencode/. ~/.config/opencode/skills/
```

</details>

---

## Why Use This?

- **AI assistants don't know VTEX-specific patterns.** The Overrides API, PPP endpoints, BFF requirements, and MasterData schema limits aren't in any LLM's training data at the depth you need. These skills fill that gap.
- **Real constraints, not generic advice.** PCI compliance via the Secure Proxy, idempotency requirements on payment endpoints, the 2.5s fulfillment simulation timeout, the 60-schema MasterData limit — these are the details that prevent costly mistakes in production.
- **One source, five platforms.** Skills are authored once in a canonical Markdown format and exported automatically. No manual sync, no drift between tools.
- **Built from official VTEX documentation.** Not generic LLM knowledge. Every constraint has a source, a detection pattern, and paired correct/wrong code examples.

---

## Supported Platforms

| Platform            | Format          | Auto-detection        | Files |
| ------------------- | --------------- | --------------------- | ----- |
| **AGENTS.md**       | Markdown        | ✅ Native in 7+ tools | 7     |
| **Cursor**          | `.mdc` rules    | ✅ Glob + description | 28    |
| **GitHub Copilot**  | Instructions    | ✅ Auto-loaded        | 7     |
| **Claude Projects** | Knowledge files | Manual upload         | 28    |
| **OpenCode**        | `SKILL.md`      | ✅ Auto-discovered    | 22    |

---

## Tracks & Skills

<details>
<summary><strong>Track 1: FastStore Implementation</strong> — 4 skills for storefront customization</summary>

Overrides, theming, SDK hooks, and data fetching for FastStore storefronts. Covers the override API, design token system, cart/session/search state management, and GraphQL API extensions.

| Skill                        | Description                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| `faststore-overrides`        | Section and component overrides using `getOverriddenSection()`     |
| `faststore-theming`          | Design tokens, SCSS theming, and `[data-fs-*]` attribute targeting |
| `faststore-state-management` | Cart, Session, Search, and Analytics SDK hooks                     |
| `faststore-data-fetching`    | GraphQL fragments, API extensions, and resolver patterns           |

</details>

<details>
<summary><strong>Track 2: Payment Connector Development</strong> — 4 skills for PPP integration</summary>

All 9 Payment Provider Protocol endpoints, idempotency patterns, async payment flows, and PCI compliance via the Secure Proxy. Covers both mandatory payment flow and optional configuration flow.

| Skill                       | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `payment-provider-protocol` | All 9 PPP endpoints: 6 payment flow + 3 configuration flow      |
| `payment-idempotency`       | `paymentId` and `requestId` idempotency, duplicate prevention   |
| `payment-async-flow`        | Async approval, callback URLs, and the 7-day retry window       |
| `payment-pci-security`      | Secure Proxy, card tokenization, and PCI constraint enforcement |

</details>

<details>
<summary><strong>Track 3: Custom VTEX IO Apps</strong> — evolving skill set for IO app development</summary>

App manifest, builders, policies, `@vtex/api` clients, React components, GraphQL schemas, and MasterData v2 integration. The most comprehensive track, covering both frontend and backend IO development.

This track is being reorganized into smaller groups:

- Foundations
- API exposure
- Frontend
- Data and config
- Security and operations

| Skill                   | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `vtex-io-app-structure` | Manifest, builders, policies, and app architecture                  |
| `vtex-io-service-apps`  | Node service apps, `ctx.clients`, and `@vtex/api` client hierarchy  |
| `vtex-io-react-apps`    | React components, `css-handles`, hooks, and Styleguide usage        |
| `vtex-io-graphql-api`   | GraphQL schemas, resolvers, `@cacheControl`, and `@auth` directives |
| `vtex-io-masterdata`    | MasterData v2 CRUD, schema design, and the 60-schema limit          |

See [tracks/vtex-io/index.md](tracks/vtex-io/index.md) for the planned grouped model and VTEX IO skill roadmap.

</details>

<details>
<summary><strong>Track 4: Marketplace Integration</strong> — 4 skills for marketplace connectors</summary>

SKU catalog sync, order hooks, fulfillment simulation, and rate limiting for marketplace connectors. Covers the Change Notification flow, Feed v3 vs Hook tradeoffs, and invoice/tracking patterns.

| Skill                       | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `marketplace-catalog-sync`  | Change Notification entry point, SKU suggestion lifecycle       |
| `marketplace-order-hook`    | Feed v3 (pull) vs Hook (push), filter types, commit patterns    |
| `marketplace-fulfillment`   | Simulation endpoint, 2.5s timeout, invoice and tracking updates |
| `marketplace-rate-limiting` | 429 handling, exponential backoff, circuit breaker patterns     |

</details>

<details>
<summary><strong>Track 5: Headless Front-End Development</strong> — 4 skills for headless storefronts</summary>

BFF architecture, Intelligent Search API, checkout proxy patterns, and caching strategy for headless VTEX storefronts. Covers why a BFF is mandatory and which APIs can never be called from the browser.

| Skill                         | Description                                                           |
| ----------------------------- | --------------------------------------------------------------------- |
| `headless-bff-architecture`   | BFF layer design, auth proxy, and API key protection                  |
| `headless-intelligent-search` | Search, facets, autocomplete, and Search Events API                   |
| `headless-checkout-proxy`     | Checkout API proxying, session cookies, and the 5-minute order window |
| `headless-caching-strategy`   | TTL rules, stale-while-revalidate, and what must never be cached      |

</details>

<details>
<summary><strong>Track 6: Well-Architected Commerce &amp; Solution Architecture</strong> — 1 cross-cutting skill</summary>

Solution architecture and the **Well-Architected Commerce** pillars (Technical Foundation, Future-proof, Operational Excellence). Use for scoping and reviews across storefront, IO, headless, marketplace, and payments — then hand off to product tracks for implementation details.

| Skill                                    | Description                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `architecture-well-architected-commerce` | Pillar-based tradeoffs, platform-first vs custom, routing work to product skills |

See [tracks/architecture/index.md](tracks/architecture/index.md) and the shipped skill [architecture-well-architected-commerce/skill.md](tracks/architecture/skills/architecture-well-architected-commerce/skill.md).

</details>

---

## Open Plugins / Cursor Directory

This repository is an [Open Plugin](https://open-plugins.com) — a portable, platform-agnostic skill pack that any AI coding tool can discover and install.

```
rules/*.mdc              # 28 Cursor rules (auto-discovered)
skills/*/SKILL.md        # 22 agent skills (auto-discovered)
.cursor-plugin/plugin.json   # Cursor plugin manifest
.plugin/plugin.json          # Vendor-neutral plugin manifest
```

Compatible tools (Cursor, Claude Code, and others implementing the Open Plugins spec) can install this repo directly as a plugin. The `rules/` and `skills/` directories at the repo root follow the standard layout, and the manifests provide metadata for discovery.

---

## For Contributors

<details>
<summary>Directory structure, export commands, and validation</summary>

### Directory Structure

```text
vtex_skills/
  _templates/
    skill-template.md       # Canonical template for new skills
  tracks/                   # SOURCE — edit skill files here
    architecture/
      index.md
      skills/
        architecture-well-architected-commerce/skill.md
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
        vtex-io-graphql-api/skill.md
        vtex-io-masterdata/skill.md
  exports/                  # auto-generated — do not edit
    agents-md/              # AGENTS.md format (7 files: root + 6 tracks)
    claude/                 # Claude Projects format (28 files)
    copilot/                # GitHub Copilot format (7 files)
    cursor/                 # Cursor .mdc format (28 files)
    opencode/               # OpenCode SKILL.md format (22 files)
  skills/                   # auto-generated — do not edit (OpenCode export)
  rules/                    # auto-generated — do not edit (Cursor export)
  scripts/
    export.ts               # Generates all platform exports
    validate.ts             # Validates all skill files
  package.json
  tsconfig.json
```

### Export Commands

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

### Validation

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

</details>

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for a complete guide on adding skills, tracks, and export platforms.

---

## License

See [LICENSE](LICENSE) for details.
