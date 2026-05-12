# Master Data

Guide to evaluating, designing, and operating VTEX Master Data as a storage layer. This track covers when to use Master Data versus alternatives, schema design with VTEX-specific extensions (`v-indexed`, `v-cache`, `v-security`, `v-triggers`), data lifecycle management, and operational best practices for production workloads.

## Overview

VTEX Master Data is a document-oriented storage service integrated into the VTEX platform. It supports JSON Schema validation, field indexing, search/scroll APIs, trigger-based automation, and per-field security. Master Data is **one storage option** among many—Catalog, OMS, VBase, and external databases each have strengths for different workloads.

This track focuses on **Master Data as a platform capability**: when it fits, how to design schemas, and how to operate it safely. For **VTEX IO app integration patterns** (MasterDataClient, `masterdata` builder, CRUD in code), see the [vtex-io-masterdata](../vtex-io/skills/vtex-io-masterdata/skill.md) skill in the VTEX IO track.

## Skills

| Skill                | Description                                                                                                                                                                                                                  | Link                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Storage strategy** | Decide when Master Data fits versus Catalog, OMS, VBase, or external databases. Design schemas with `v-indexed`, `v-cache`, `v-security`, and triggers. Understand limitations, capacity planning, and operational patterns. | [skills/masterdata-storage-strategy/skill.md](skills/masterdata-storage-strategy/skill.md) |

## Relationship to other tracks

- **VTEX IO** — The [vtex-io-masterdata](../vtex-io/skills/vtex-io-masterdata/skill.md) skill covers integration patterns from IO apps (clients, builders, CRUD). This track covers MD as a storage platform independent of the consumer.
- **Architecture** — The [architecture-well-architected-commerce](../architecture/skills/architecture-well-architected-commerce/skill.md) skill provides cross-cutting principles that inform storage choices.
- **Headless** — The [headless-bff-architecture](../headless/skills/headless-bff-architecture/skill.md) skill covers BFF patterns when MD data is accessed from non-IO consumers.
