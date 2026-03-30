---
name: vtex-io-application-performance
description: >
  Apply when improving VTEX IO Node or .NET services for latency, throughput, and resilience: in-process LRU,
  VBase, stale-while-revalidate, AppSettings loading, request context, parallel client calls, and avoiding
  duplicate work. Covers application-level performance patterns that complement edge/CDN caching. Use when
  optimizing backends beyond route-level Cache-Control.
metadata:
  track: vtex-io
  tags:
    - vtex-io
    - performance
    - cache
    - vbase
    - lru
    - stale-while-revalidate
    - appsettings
    - context
    - parallel-requests
  globs:
    - "node/**/*.ts"
    - "**/service.json"
  version: "1.0"
  purpose: Improve IO service performance and resilience using caching layers, deduplication, and parallel I/O
  applies_to:
    - reducing repeated upstream API calls
    - persisting cache across instances (VBase)
    - loading configuration once vs per request
    - parallelizing independent outbound calls
  excludes:
    - service path prefixes and edge CDN rules (see vtex-io-service-paths-and-cdn)
    - GraphQL schema cache directives (see vtex-io-graphql-api)
  decision_scope:
    - lru-vs-vbase-vs-origin
    - global-appsettings-vs-request-cache
  vtex_docs_verified: "2026-03-28"
---

# VTEX IO application performance

## When this skill applies

Use this skill when you optimize **VTEX IO** backends (typically **Node** with `@vtex/api` / Koa-style middleware, or **.NET** services) for **performance and resilience**: **caching**, **deduplicating** work, **parallel I/O**, and **efficient** configuration loading—not only “add a cache.”

- Adding an **in-memory LRU** (per pod) for hot keys
- Adding **VBase** persistence for **shared** cache across pods, optionally with **stale-while-revalidate** (return stale, refresh in background)
- Loading **AppSettings** (or similar) **once** at startup or on a TTL refresh vs **every request**
- **Parallelizing** independent client calls (`Promise.all`) instead of serial waterfalls
- Passing **`ctx.clients`** (e.g. `vbase`) into **client helpers** or resolvers so caches are **testable** and **explicit**

Do not use this skill for:

- Choosing **`/_v/private`** vs public **paths** or **`Cache-Control`** at the edge → **vtex-io-service-paths-and-cdn**
- GraphQL **`@cacheControl`** field semantics only → **vtex-io-graphql-api**

## Decision rules

- **Layer 1 — LRU (in-process)** — Fastest; **lost** on cold start and **not shared** across replicas. Use bounded size + TTL for **hot** keys (organization, cost center, small config slices).
- **Layer 2 — VBase** — **Shared** across pods; platform data is **partitioned** by **account** / **workspace** like other IO resources. Pair with **hash** or `trySaveIfhashMatches` when the client supports concurrency-safe updates (see [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients)).
- **Stale-while-revalidate** — On **VBase hit** with expired **freshness**, return **stale** immediately and **revalidate** asynchronously (fetch origin → write VBase + LRU). Reduces tail latency vs blocking on origin every time.
- **TTL-only** — Simpler: cache until TTL expires, then **blocking** fetch. Prefer when **staleness** is unacceptable or origin is cheap.
- **AppSettings** — If values are **account-wide** and **rarely change**, load **once** (or refresh on interval) and hold in **module memory**; if **workspace-dependent** or **must** reflect admin changes quickly, use **per-request** read or **short TTL** cache. Never cache **secrets** in logs or global state without guardrails.
- **Context** — Use **`ctx.state`** for **per-request** deduplication (e.g. “already loaded org for this request”). Use **global** module cache only for **immutable** or **TTL-refreshed** app data; **account** and **workspace** live on **`ctx.vtex`**—always include them in **in-memory** cache keys when the same pod serves **multiple** tenants.
- **Parallel requests** — When resolvers need **independent** upstream calls, run them **in parallel**; combine only when outputs depend on each other.
- **Timeouts on every outbound call** — Every `ctx.clients` call and external HTTP request **must** have an explicit **timeout**. Use `@vtex/api` client options (`timeout`, `retries`, `exponentialTimeoutCoefficient`) to tune per-client behavior. Unbounded waits are the top cause of cascading failures in distributed systems.
- **Graceful degradation** — When an upstream is slow or down, **fail open** where the business allows (return cached/default data, skip optional enrichment) rather than blocking the response. Consider **circuit breaker** patterns for chronically failing dependencies.

### Tenancy and in-memory caches

IO runs **per app version per shard**, with pods **shared across accounts**: every request is still resolved in **`{account, workspace}`** context. **VBase**, app buckets, and related platform stores **partition data** by account/workspace. **In-process** LRU/module `Map` **does not**—you must **key** explicitly with **`ctx.vtex.account`** and **`ctx.vtex.workspace`** (plus entity id) so **two** consecutive requests for **different** accounts on the **same pod** cannot read each other’s entries.

## Hard constraints

### Constraint: Do not store sensitive or tenant-specific data in module-level caches without tenant keys

**Global** or **module-level** maps must **not** store **PII**, **tokens**, or **authorization-sensitive** blobs keyed only by **user id** or **email** without **`account` and `workspace`** (and any other dimension needed for isolation).

**Why this matters** — Pods are **multi-tenant**: the same process may serve **many** accounts in sequence. **VBase** and similar APIs are **scoped** to the current account/workspace, but an **in-memory** `Map` is **your** responsibility. Missing **`account`/`workspace`** in the key risks **cross-tenant** reads from warm cache.

**Detection** — A module-scope `Map` keyed only by `userId` or `email`; or cache keys that **omit** `ctx.vtex.account` / `ctx.vtex.workspace` when the value is **tenant-specific**.

**Correct** — Build keys from **`ctx.vtex.account`**, **`ctx.vtex.workspace`**, and the entity id; **never** store **app tokens** in VBase/LRU as plain cache values; **prefer** `ctx.clients` and **platform** auth.

```typescript
// Pseudocode: in-memory key must mirror tenant scope (same pod, many accounts)
function cacheKey(ctx: Context, subjectId: string) {
  return `${ctx.vtex.account}:${ctx.vtex.workspace}:${subjectId}`;
}
```

**Wrong** — `globalUserCache.set(email, profile)` keyed **only** by **email**, with **no** `account`/`workspace` segment—**unsafe** on shared pods even though a later **VBase** read would be **account-scoped**, because **this** map is not partitioned by the platform.

### Constraint: Do not block the purchase path on slow or unbounded cache refresh

**Stale-while-revalidate** or **origin** calls **must not** add **unbounded** latency to **checkout-critical** middleware if the platform SLA requires a fast response.

**Why this matters** — Blocking checkout on **optional** enrichment breaks **conversion** and **reliability**.

**Detection** — A **cart** or **payment** resolver **awaits** VBase refresh or **external** API before returning; **no** timeout or **fallback**.

**Correct** — Return **stale** or **default**; **enqueue** refresh; **fail open** where business rules allow.

**Wrong** — `await fetchHeavyPartner()` in the **hot path** with **no** timeout.

## Preferred pattern

1. **Classify** data: **safe to share** across users (after scoping) vs **user-private** (never in shared cache without encryption and keying).
2. **Choose** LRU only, VBase only, or **LRU → VBase → origin** (two-layer) for **read-heavy** reference data.
3. **Deduplicate** within a request: set **`ctx.state`** flags when a **resolver** chain might call the same loader twice.
4. **Parallelize** independent **`ctx.clients`** calls.
5. **Document** TTLs and **invalidation** (who writes, when refresh runs).

## Common failure modes

- **LRU unbounded** — Memory grows without **max** entries; pod **OOM**.
- **VBase without LRU** — Every request hits **VBase** for **hot** keys; **latency** and **cost** rise.
- **In-memory cache without tenant in key** — Same pod serves account A then B; **stale** or **wrong** row returned from module cache.
- **Serial awaits** — Three **independent** Janus calls **awaited** one after another.
- **No explicit timeouts** — Relying on default or infinite timeouts for upstream calls; one slow dependency stalls the whole request chain.
- **Treating AppSettings as real-time** — **Stale** admin change until **TTL** expires; **no** notification path.

## Review checklist

- [ ] Are **in-memory** cache keys built with **`account` + `workspace`** (and entity id) when values are tenant-specific?
- [ ] Is **LRU** bounded (max entries) and **TTL** defined?
- [ ] For **VBase**, is **stale-while-revalidate** or **TTL-only** behavior **explicit**?
- [ ] Are **independent** upstream calls **parallelized** where safe?
- [ ] Is **AppSettings** (or similar) **loaded** at the right **frequency** (once vs per request)?
- [ ] Is **checkout** or **payment** path **free** of **blocking** optional refreshes?
- [ ] Does every outbound call have an explicit **timeout** (via `@vtex/api` client options or equivalent)?
- [ ] For unreliable upstreams, is there a **degradation** path (cached fallback, skip, circuit breaker)?

## Related skills

- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) — Edge paths, cookies, CDN
- [vtex-io-service-apps](../vtex-io-service-apps/skill.md) — Clients, middleware, Service
- [vtex-io-graphql-api](../vtex-io-graphql-api/skill.md) — GraphQL caching
- [vtex-io-app-structure](../vtex-io-app-structure/skill.md) — Manifest, policies

## Reference

- [VTEX IO Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — `vbase` client methods
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — SEGMENT cache and cookies
- [Engineering guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub
