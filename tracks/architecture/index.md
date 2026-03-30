# Well-Architected Commerce & Solution Architecture

Cross-cutting guidance for **designing and reviewing** VTEX commerce solutions before and alongside product-specific implementation (VTEX IO, FastStore, Headless, Marketplace, Payments). This track encodes the **Well-Architected Commerce** pillars: Technical Foundation, Future-proof, and Operational Excellence.

## Overview

Product tracks answer **how** to implement on a given VTEX surface. The architecture track answers **what to optimize for** when multiple surfaces and vendors are in play: security and reliability, simplicity and evolution, and operational discipline. Use it for discovery, high-level design, RFP-style scoping, and architecture reviews — then route detailed work to the right product skill.

### Maintainer context (outside this repo)

| Source                            | Role                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Well-Architected Commerce MCP** | Full framework narrative when evolving this track                                                                               |
| **`docs/`** (local, gitignored)   | Optional notes, improvement checklists, session exports — create at repo root if needed; not part of the published skill bundle |

## Skills

| Skill                         | Description                                                                                                                                  | Link                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Well-Architected Commerce** | Map decisions to Technical Foundation, Future-proof, and Operational Excellence; default to platform-first and product skills for execution. | [skills/architecture-well-architected-commerce/skill.md](skills/architecture-well-architected-commerce/skill.md) |

## Recommended Learning Order

1. **Frame** the initiative with the three pillars (risk, change velocity, operations).
2. **Choose** storefront and integration model (FastStore vs Headless vs Store Framework, IO apps, marketplace role).
3. **Execute** with the relevant product track skills; do not duplicate platform constraints here.

## Key Constraints Summary

- **Technical Foundation is non-negotiable** — No shortcut that exposes secrets, widens PCI scope, or calls private VTEX APIs from untrusted clients.
- **Three pillars are framework-first** — Technical Foundation, Future-proof, and Operational Excellence follow the **Well-Architected Commerce** framework (see skill); platform **how-to** lives in product tracks.
- **Native and OOTB before VTEX IO** — Extend with IO only when no suitable native path exists; document **why not native** when IO is chosen anyway.
- **Master Data and IO details** — Storage fit, purchase path, caching, and paths: see **vtex-io** skills ([vtex-io-masterdata](../vtex-io/skills/vtex-io-masterdata/skill.md), [vtex-io-application-performance](../vtex-io/skills/vtex-io-application-performance/skill.md), [vtex-io-service-paths-and-cdn](../vtex-io/skills/vtex-io-service-paths-and-cdn/skill.md)).
- **Justify every new service or datastore** — Owner, failure mode, and pillar mapping; avoid sprawl “for flexibility.”
- **Differentiator vs operational gap** — Do not use custom code to patch broken process; fix ownership and operations when that is the root cause.
- **Hand off to product skills** — This track sets direction; FastStore, Headless, IO, Marketplace, and Payment skills define implementation contracts.

## Related tracks

- [FastStore](../faststore/index.md) — Storefront implementation and customization.
- [Payment](../payment/index.md) — Payment Provider Protocol and PCI-related patterns.
- [VTEX IO](../vtex-io/index.md) — Custom apps, services, Master Data, GraphQL.
- [Marketplace](../marketplace/index.md) — Seller connectors and marketplace order flows.
- [Headless](../headless/index.md) — BFF, checkout proxy, caching, Intelligent Search.
