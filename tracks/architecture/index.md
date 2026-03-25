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

| Skill                         | Description                                                                                                                                  | Link                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Well-Architected Commerce** | Map decisions to Technical Foundation, Future-proof, and Operational Excellence; default to platform-first and product skills for execution. | [skills/well-architected-commerce/skill.md](skills/well-architected-commerce/skill.md) |

## Recommended flow

1. **Frame** the initiative with the three pillars (risk, change velocity, operations).
2. **Choose** storefront and integration model (FastStore vs Headless vs Store Framework, IO apps, marketplace role).
3. **Execute** with the relevant product track skills; do not duplicate platform constraints here.

## Related tracks

- [FastStore](../faststore/index.md) — Storefront implementation and customization.
- [Payment](../payment/index.md) — Payment Provider Protocol and PCI-related patterns.
- [VTEX IO](../vtex-io/index.md) — Custom apps, services, Master Data, GraphQL.
- [Marketplace](../marketplace/index.md) — Seller connectors and marketplace order flows.
- [Headless](../headless/index.md) — BFF, checkout proxy, caching, Intelligent Search.
