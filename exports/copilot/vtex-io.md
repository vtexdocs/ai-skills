# Custom VTEX IO Apps

# App Contract & Builder Boundaries

## When this skill applies

Use this skill when the main decision is about what a VTEX IO app is, what capabilities it declares, and which integration boundaries it publishes through `manifest.json`.

- Creating a new VTEX IO app and defining its initial contract
- Adding or removing builders to match app capabilities
- Choosing between `dependencies` and `peerDependencies`
- Deciding whether a capability belongs in the current app or should move to another app
- Troubleshooting link or publish failures caused by manifest-level contract issues

Do not use this skill for:
- service runtime behavior such as `service.json`, memory, workers, or route exposure
- HTTP handler implementation, middleware composition, or event processing
- GraphQL schema, resolver, or data-fetching implementation
- storefront, admin, or render-runtime frontend behavior
- policy modeling and security boundary enforcement

## Decision rules

- Treat `manifest.json` as the app contract. It declares identity, builders, dependencies, peer dependencies, and high-level capabilities that other apps or the platform rely on.
- Add a builder only when the app truly owns that capability. Builders are not placeholders for future work.
- Keep the contract narrow. If a manifest starts to represent unrelated concerns, split those concerns into separate apps instead of creating a catch-all app.
- Use `dependencies` only for apps that can be safely auto-installed as part of the current app contract. Use `peerDependencies` for apps that must already exist in the environment, remain externally managed, or declare `billingOptions`.
- Keep naming and versioning publishable: `vendor`, `name`, and `version` must form a stable identity that can be linked, published, and consumed safely.
- Keep `billingOptions` aligned with the commercial contract of the app. If the app has billing implications, declare them explicitly in the manifest rather than leaving pricing behavior implicit.
- Apps that declare `billingOptions` cannot be consumed through `dependencies`. If the current app requires a billable app, model that relationship with `peerDependencies` and require manual installation by the account or edition owner.
- Edition apps are compositions of app contracts, not exceptions to them. Keep each underlying app contract explicit, narrow, and semver-safe so composition stays predictable across host environments.
- `manifest.json` can also declare app-level permissions and configuration surfaces, but detailed policy modeling belongs in security-focused skills and detailed `settingsSchema` design belongs in app-settings skills.

This is not an exhaustive list of builders; see the official Builders docs for the full catalog.

Builder ownership reference:

| Builder | Own this builder when the app contract includes |
|---------|--------------------------------------------------|
| `node` | backend runtime capability owned by this app |
| `graphql` | GraphQL schema exposure owned by this app |
| `react` | React bundles owned by this app |
| `admin` | Admin UI surfaces owned by this app |
| `store` | Store Framework block registration owned by this app |
| `messages` | localized message bundles owned by this app |
| `pixel` | storefront pixel injection owned by this app |
| `masterdata` | Master Data schema assets owned by this app |

Contract boundary heuristic:
1. If the capability is shipped, versioned, and maintained with this app, declare its builder here.
2. If the capability is only consumed from another app, declare a dependency instead of duplicating the builder.
3. If the capability introduces a separate runtime, security model, or release cadence, consider splitting it into another app.

## Hard constraints

### Constraint: Every shipped capability must be declared in the manifest contract

If the app ships a processable VTEX IO capability, `manifest.json` MUST declare the corresponding builder. Do not rely on folder presence alone, and do not assume VTEX IO infers capabilities from the repository structure.
Symmetrically, do not declare builders for capabilities that are not actually shipped by this app.

**Why this matters**

VTEX IO compiles and links apps based on declared builders, not on intent. If the builder is missing, the platform ignores that capability and the app contract becomes misleading. The app may link partially while the expected feature is absent.

**Detection**

If you see a maintained `/node`, `/react`, `/graphql`, `/admin`, `/store`, `/messages`, `/pixel`, or `/masterdata` directory, STOP and verify that the matching builder exists in `manifest.json`. If the builder exists but the capability does not, STOP and remove the builder or move the capability back into scope.

**Correct**

```json
{
  "vendor": "acme",
  "name": "reviews-platform",
  "version": "0.4.0",
  "builders": {
    "node": "7.x",
    "graphql": "1.x",
    "messages": "1.x"
  }
}
```

**Wrong**

```json
{
  "vendor": "acme",
  "name": "reviews-platform",
  "version": "0.4.0",
  "builders": {
    "messages": "1.x"
  }
}
```

The app ships backend and GraphQL capabilities but declares only `messages`, so the runtime contract is incomplete and the platform ignores the missing builders.

### Constraint: App identity and versioning must stay publishable and semver-safe

The `vendor`, `name`, and `version` fields MUST identify a valid VTEX IO app contract. Use kebab-case for the app name, keep the vendor consistent with ownership, and use full semantic versioning.

**Why this matters**

Consumers, workspaces, and release flows rely on app identity stability. Invalid names or incomplete versions break linking and publishing, while identity drift creates unsafe upgrades and hard-to-debug dependency mismatches.

**Detection**

If you see uppercase characters, underscores, non-semver versions, or vendor/name changes mixed into unrelated work, STOP and validate whether the change is intentional and release-safe.

**Correct**

```json
{
  "vendor": "acme",
  "name": "order-status-dashboard",
  "version": "2.1.0"
}
```

**Wrong**

```json
{
  "vendor": "AcmeTeam",
  "name": "Order_Status_Dashboard",
  "version": "2.1"
}
```

This identity is not safely publishable because the name is not kebab-case and the version is not valid semver.

### Constraint: Dependencies and peerDependencies must express installation intent correctly

Use `dependencies` only for apps that this app should install as part of its contract and that can be auto-installed safely. Use `peerDependencies` for apps that must already be present in the environment, should remain externally managed, or declare `billingOptions`.

**Why this matters**

This is the core contract boundary between your app and the rest of the VTEX IO workspace. Misclassifying a relationship causes broken installations, hidden coupling, and environment-specific behavior that only appears after link or publish. In particular, builder-hub rejects dependencies on apps that declare `billingOptions`.

**Detection**

If the app requires another app to function in every environment, STOP and confirm whether it belongs in `dependencies` or `peerDependencies`. If the target app declares `billingOptions`, STOP and move it to `peerDependencies`. If the app only integrates with a platform capability, host app, edition-managed app, or paid app that the account is expected to manage manually, STOP and keep it out of `dependencies`.

**Correct**

```json
{
  "dependencies": {
    "vtex.search-graphql": "0.x"
  },
  "peerDependencies": {
    "vtex.store": "2.x",
    "vtex.paid-app-example": "1.x"
  }
}
```

**Wrong**

```json
{
  "dependencies": {
    "vtex.store": "2.x",
    "vtex.paid-app-example": "1.x"
  },
  "peerDependencies": {}
}
```

This contract hard-installs a host app that should usually be externally managed and also attempts to auto-install a billable app, which builder-hub rejects.

## Preferred pattern

Start by deciding the smallest useful contract for the app, then declare only the identity and builders required for that contract.

Recommended manifest for a focused service-plus-GraphQL app:

```json
{
  "vendor": "acme",
  "name": "reviews-platform",
  "version": "0.1.0",
  "title": "Reviews Platform",
  "description": "VTEX IO app that owns review APIs and review GraphQL exposure",
  "builders": {
    "node": "7.x",
    "graphql": "1.x",
    "messages": "1.x"
  },
  "billingOptions": {
    "type": "free"
  },
  "dependencies": {
    "vtex.search-graphql": "0.x"
  },
  "peerDependencies": {
    "vtex.store": "2.x"
  }
}
```

Recommended contract split:

```text
reviews-platform/
├── manifest.json        # identity, builders, dependencies, peerDependencies
├── node/                # backend capability owned by this app
├── graphql/             # GraphQL capability owned by this app
└── messages/            # app-owned translations

reviews-storefront/
├── manifest.json        # separate release surface for storefront concerns
├── react/
└── store/
```

Use this split when the backend/API contract and the storefront contract have different ownership, release cadence, or integration boundaries.

## Common failure modes

- Declaring builders for aspirational capabilities that the app does not yet own, which makes the contract broader than the real implementation.
- Using one large manifest to represent backend runtime, frontend rendering, settings, policies, and integration concerns that should be separated into multiple skills or apps.
- Putting host-level apps in `dependencies` when they should remain `peerDependencies`.
- Pinning exact dependency versions instead of major-version ranges such as `0.x`, `1.x`, or `3.x`.
- Treating `manifest.json` as a dumping ground for runtime or security details that belong in more specific skills.
- Modeling `settingsSchema` here instead of using this skill only to decide whether app-level configuration belongs in the contract at all.

## Review checklist

- [ ] Does the manifest describe only capabilities this app actually owns and ships?
- [ ] Does every shipped capability have a matching builder declaration?
- [ ] Is the app identity publishable: valid `vendor`, kebab-case `name`, and full semver `version`?
- [ ] If the app has billing behavior, is `billingOptions` explicit and aligned with the app contract?
- [ ] Are `dependencies` and `peerDependencies` separated by installation intent?
- [ ] Would splitting the contract into two apps reduce unrelated concerns or release coupling?
- [ ] Are runtime, route, GraphQL implementation, frontend, and security details kept out of this skill?

## Reference

- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) - Complete reference for `manifest.json` fields
- [Builders](https://developers.vtex.com/docs/guides/vtex-io-documentation-builders) - Builder catalog and capability mapping
- [Dependencies](https://developers.vtex.com/docs/guides/vtex-io-documentation-dependencies) - Dependency and peer dependency behavior in VTEX IO
- [Billing Options](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest#billingoptions) - How app billing behavior is declared in the manifest
- [Creating the New App](https://developers.vtex.com/docs/guides/vtex-io-documentation-3-creating-the-new-app) - App initialization flow and manifest basics

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
- **Never cache real-time transactional state** — **Order forms**, **cart simulations**, **payment responses**, **full session state**, and **commitment pricing** must never be served from cache. They reflect live, mutable state that changes on every interaction. Caching these creates stale prices, phantom inventory, or duplicate charges.
- **Resolver chain deduplication** — When a resolver chain calls the **same** client method **multiple times** (e.g. `getCostCenter` in the resolver and again inside a helper), **deduplicate**: call once, pass the result through, or stash in `ctx.state`. Serial waterfalls of 7+ calls that could be 3 parallel + 1 sequential are the top performance sink.
- **Phased `Promise.all`** — Group independent calls into **parallel phases**. Phase 1: `Promise.all([getOrderForm(), getCostCenter(), getSession()])`. Phase 2 (depends on Phase 1): `getSkuMetadata()`. Phase 3 (depends on Phase 2): `generatePrice()`. Never `await` six calls sequentially when only two depend on each other.
- **Batch mutations** — When setting multiple values (e.g. `setManualPrice` per cart item), use `Promise.all` instead of a sequential loop. Each `await` in a loop adds a full round-trip.

### VBase deep patterns

- **Per-entity keys, not blob keys** — Cache individual entities (e.g. `sku:{region}:{skuId}`) instead of composite blobs (e.g. `allSkus:{sortedCartSkuIds}`). Per-entity keys dramatically increase cache hit rates when items are added/removed.
- **Minimal DTOs** — Store only the fields the consumer needs (e.g. `{ skuId, mappedId, isSpecialItem }` at ~50 bytes) instead of the full API response (~10-50 KB per product). Reduces VBase storage, serialization time, and transfer size.
- **Sibling prewarming** — When a search API returns a product with 4 SKU variants, cache **all 4** individual SKUs even if only 1 was requested. The next request for a sibling is a VBase hit instead of an API call.
- **Pass `vbase` as a parameter** — Clients don't have direct access to other clients. Pass `ctx.clients.vbase` as a parameter to client methods or utilities that need it. This keeps code testable and explicit about dependencies.
- **VBase state machines** — For long-running operations (scans, imports, batch processing), use VBase as a state store with `current-operation.json` (lock + progress), heartbeat extensions, checkpoint/resume, and TTL-based lock expiry to prevent zombie locks.

### `service.json` tuning

- **`timeout`** — Maximum seconds before the platform kills a request. Set based on the longest expected operation; do not leave at the default if your resolver calls slow upstreams.
- **`memory`** — MB per worker. Increase if LRU caches or large payloads cause OOM; monitor actual usage before over-provisioning.
- **`workers`** — Concurrent request handlers per replica. More workers handle more concurrent requests but each shares the memory budget and in-process LRU.
- **`minReplicas` / `maxReplicas`** — Controls horizontal scaling. For payment-critical or high-throughput apps, set `minReplicas >= 2` so cold starts don't hit production traffic.

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

### Constraint: Do not use fire-and-forget VBase writes in financial or idempotency-critical paths

When VBase serves as an **idempotency store** (e.g. payment connectors storing transaction state) or a **data-integrity store**, writes **must** be **awaited**. Fire-and-forget writes risk silent failure: a successful upstream operation (e.g. a charge) whose VBase record is lost causes a **duplicate** on the next retry.

**Why this matters** — VTEX Gateway **retries** payment calls with the same `paymentId`. If VBase write fails silently after a successful authorization, the connector cannot find the previous result and sends **another** payment request—causing a **duplicate charge**.

**Detection** — A VBase `saveJSON` or `saveOrUpdate` call **without** `await` in a payment, settlement, refund, or any flow where the stored value is the **only** record preventing re-execution.

**Correct** — Await the write; accept the latency cost for correctness.

```typescript
// Critical path: await guarantees the idempotency record is persisted
await ctx.clients.vbase.saveJSON<Transaction>('transactions', paymentId, transactionData)
return Authorizations.approve(authorization, { ... })
```

**Wrong** — Fire-and-forget in a payment flow.

```typescript
// No await — if this fails silently, the next retry creates a duplicate charge
ctx.clients.vbase.saveJSON('transactions', paymentId, transactionData)
return Authorizations.approve(authorization, { ... })
```

### Constraint: Do not cache real-time transactional data

**Order forms**, **cart simulation responses**, **payment statuses**, **full session state**, and **commitment prices** must **never** be served from LRU, VBase, or any cache layer. They reflect live mutable state.

**Why this matters** — Serving a cached order form shows phantom items, stale prices, or wrong quantities. Caching payment responses could return a previous transaction's status for a different payment. Caching cart simulations returns stale availability and pricing.

**Detection** — LRU or VBase keys like `orderForm:{id}`, `cartSim:{hash}`, `paymentResponse:{id}`, or `session:{token}` used for read-through caching. Or a resolver that caches the result of `checkout.orderForm()`.

**Correct** — Always call the live API for transactional data; cache **reference data** (org, cost center, config, seller lists) around it.

```typescript
// Reference data: cached (changes rarely)
const costCenter = await getCostCenterCached(ctx, costCenterId)
const sellerList = await getSellerListCached(ctx)

// Transactional data: always live
const orderForm = await ctx.clients.checkout.orderForm()
const simulation = await ctx.clients.checkout.simulation(payload)
```

**Wrong** — Caching the order form or cart simulation.

```typescript
const cacheKey = `orderForm:${orderFormId}`
const cached = orderFormCache.get(cacheKey)
if (cached) return cached // Stale cart state served to user
```

### Constraint: Do not block the purchase path on slow or unbounded cache refresh

**Stale-while-revalidate** or **origin** calls **must not** add **unbounded** latency to **checkout-critical** middleware if the platform SLA requires a fast response.

**Why this matters** — Blocking checkout on **optional** enrichment breaks **conversion** and **reliability**.

**Detection** — A **cart** or **payment** resolver **awaits** VBase refresh or **external** API before returning; **no** timeout or **fallback**.

**Correct** — Return **stale** or **default**; **enqueue** refresh; **fail open** where business rules allow.

**Wrong** — `await fetchHeavyPartner()` in the **hot path** with **no** timeout.

## Preferred pattern

1. **Classify** data: **reference data** (org, cost center, config, seller lists → cacheable) vs **transactional data** (order form, cart sim, payment → never cache) vs **user-private** (never in shared cache without encryption and keying).
2. **Choose** LRU only, VBase only, or **LRU → VBase → origin** (two-layer) for **read-heavy** reference data.
3. **Deduplicate** within a request: set **`ctx.state`** flags when a **resolver** chain might call the same loader twice.
4. **Parallelize** independent **`ctx.clients`** calls in **phased** `Promise.all` groups.
5. **Per-entity VBase keys** with minimal DTOs for high-cardinality data (SKUs, users, org records).
6. **Document** TTLs and **invalidation** (who writes, when refresh runs).

### Resolver chain optimization (before/after)

```typescript
// BEFORE: 7 sequential awaits, 2 duplicate calls
const settings = await getAppSettings(ctx)          // 1
const session = await getSessions(ctx)               // 2
const costCenter = await getCostCenter(ctx, ccId)    // 3
const orderForm = await getOrderForm(ctx)            // 4
const skus = await getSkuById(ctx, skuIds)           // 5
const price = await generatePrice(ctx, costCenter)   // 6 (calls getCostCenter AGAIN + getSession AGAIN)
for (const item of items) {
  await setManualPrice(ctx, item)                    // 7, 8, 9... (sequential loop)
}

// AFTER: 3 phases, no duplicates, parallel mutations
const settings = await getAppSettings(ctx)
const [session, costCenter, orderForm] = await Promise.all([
  getSessions(ctx),
  getCostCenter(ctx, ccId),
  getOrderForm(ctx),
])
const skus = await getSkuMetadataBatch(ctx, skuIds)  // per-entity VBase cache
const price = await generatePrice(ctx, costCenter, session)  // reuse, no re-fetch
await Promise.all(items.map(item => setManualPrice(ctx, item)))
```

### Per-entity VBase caching

```typescript
interface SkuMetadata {
  skuId: string
  mappedSku: string | null
  isSpecialItem: boolean
}

async function getSkuMetadataBatch(
  ctx: Context,
  skuIds: string[],
): Promise<Map<string, SkuMetadata>> {
  const { vbase, search } = ctx.clients
  const results = new Map<string, SkuMetadata>()

  // Phase 1: check VBase for each SKU in parallel
  const lookups = await Promise.allSettled(
    skuIds.map(id => vbase.getJSON<SkuMetadata>('sku-metadata', `sku:${id}`))
  )

  const missing: string[] = []
  lookups.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      results.set(skuIds[i], result.value)
    } else {
      missing.push(skuIds[i])
    }
  })

  if (missing.length === 0) return results

  // Phase 2: fetch only missing SKUs from API
  const products = await search.getSkuById(missing)

  // Phase 3: cache ALL sibling SKUs (prewarm)
  for (const product of products) {
    for (const sku of product.items) {
      const metadata: SkuMetadata = {
        skuId: sku.itemId,
        mappedSku: extractMapping(sku),
        isSpecialItem: checkSpecial(sku),
      }
      results.set(sku.itemId, metadata)
      // Fire-and-forget for prewarming (not idempotency-critical)
      vbase.saveJSON('sku-metadata', `sku:${sku.itemId}`, metadata).catch(() => {})
    }
  }

  return results
}
```

## Common failure modes

- **LRU unbounded** — Memory grows without **max** entries; pod **OOM**.
- **VBase without LRU** — Every request hits **VBase** for **hot** keys; **latency** and **cost** rise.
- **In-memory cache without tenant in key** — Same pod serves account A then B; **stale** or **wrong** row returned from module cache.
- **Serial awaits** — Three **independent** Janus calls **awaited** one after another; total latency = sum of all instead of max.
- **Duplicate calls in resolver chains** — `getCostCenter` called in the resolver and again inside a helper; `getSession` called twice in the same flow. Each duplicate adds a full round-trip.
- **Blob VBase keys** — Keying VBase by `sortedCartSkuIds` means adding 1 item to a cart of 10 requires a full re-fetch instead of 1 lookup.
- **Caching transactional data** — Order forms, cart simulations, payment responses served from cache; stale prices, phantom items, or duplicate charges.
- **Fire-and-forget writes in critical paths** — Unawaited VBase writes for idempotency stores; silent failure causes duplicates on retry.
- **No explicit timeouts** — Relying on default or infinite timeouts for upstream calls; one slow dependency stalls the whole request chain.
- **Global mutable singletons** — Module-level mutable objects (e.g. token cache metadata) modified by concurrent requests cause race conditions and incorrect behavior.
- **Treating AppSettings as real-time** — **Stale** admin change until **TTL** expires; **no** notification path.
- **`console.log` in hot paths** — Logging full response objects with template literals produces `[object Object]`; use `ctx.vtex.logger` with `JSON.stringify` and redact sensitive data.

## Review checklist

- [ ] Are **in-memory** cache keys built with **`account` + `workspace`** (and entity id) when values are tenant-specific?
- [ ] Is **LRU** bounded (max entries) and **TTL** defined?
- [ ] For **VBase**, is **stale-while-revalidate** or **TTL-only** behavior **explicit**?
- [ ] Are **independent** upstream calls **parallelized** (`Promise.all` phases) where safe?
- [ ] Are there **no duplicate calls** to the same client method within a resolver chain?
- [ ] Is **AppSettings** (or similar) **loaded** at the right **frequency** (once vs per request)?
- [ ] Is **checkout** or **payment** path **free** of **blocking** optional refreshes?
- [ ] Does every outbound call have an explicit **timeout** (via `@vtex/api` client options or equivalent)?
- [ ] For unreliable upstreams, is there a **degradation** path (cached fallback, skip, circuit breaker)?
- [ ] Are VBase writes **awaited** in financial or idempotency-critical paths?
- [ ] Is **transactional data** (order form, cart sim, payment) always fetched live, never from cache?
- [ ] Are VBase keys **per-entity** (not blob) for high-cardinality data like SKUs?
- [ ] Are `service.json` resource limits (`timeout`, `memory`, `workers`, `replicas`) tuned for the workload?
- [ ] Is logging done via `ctx.vtex.logger` (not `console.log`) with sensitive data redacted?

## Related skills

- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) — Edge paths, cookies, CDN
- [vtex-io-session-apps](../vtex-io-session-apps/skill.md) — Session transforms (caching patterns apply inside transforms)
- [vtex-io-service-apps](../vtex-io-service-apps/skill.md) — Clients, middleware, Service
- [vtex-io-graphql-api](../vtex-io-graphql-api/skill.md) — GraphQL caching
- [vtex-io-app-structure](../vtex-io-app-structure/skill.md) — Manifest, policies

## Reference

- [VTEX IO Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — `vbase` client methods
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — SEGMENT cache and cookies
- [Engineering guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub

---

# Authorization & Policy Design

## When this skill applies

Use this skill when a VTEX IO app needs explicit permissions to call external services, consume VTEX resources, or expose access-controlled behavior.

- Adding an external API integration
- Consuming VTEX resources that require declared permissions
- Reviewing whether a route or client needs policy changes
- Tightening app permissions around an existing integration

Do not use this skill for:
- service runtime tuning
- HTTP handler structure
- frontend UI authorization behavior
- broader trust-boundary or sensitive-data modeling
- choosing between `AUTH_TOKEN`, `STORE_TOKEN`, and `ADMIN_TOKEN`

## Decision rules

- Treat `manifest.json` policies as explicit declarations of what the app is allowed to access.
- Use this skill to decide what the app is authorized to do, not which runtime token identity should make the call.
- Add only the policies required for the integrations and resources the app actually uses.
- Use License Manager policies when the app needs access to VTEX platform resources protected by LM resource keys.
- Use app policies such as `"vendor.app-name:policy-name"` when the app consumes resources or operations exposed by another VTEX IO app through role-based policies.
- Use `outbound-access` when the app needs to call external HTTP services or URLs that are not covered by License Manager or app policies.
- Prefer narrowly scoped outbound-access declarations over wildcard hosts or paths.
- When exposing your own routes or operations, define access on the server side through resource-based policies, route protections, or auth directives instead of assuming consumers will declare something in their own manifest.
- A VRN (VTEX Resource Name) is the internal identifier format VTEX uses for resources and identities. Role-based policies use `resources` expressed as VRNs, and resource-based policies use `principals` expressed as VRNs.
- Use VRNs only where the platform expects them, especially in `service.json` resource-based policies or when interpreting authorization errors. Do not generate VRNs in `manifest.json` for consumer-side policy declarations.
- In resource-based policies, multiple `principals` are evaluated as alternatives, and explicit `deny` rules override `allow` rules.
- When exposing your own role-based policies, keep them minimal and operation-specific rather than broad catch-all permissions.
- Review policy requirements when adding a new client, external integration, or service route that depends on protected access.
- Keep route implementation and policy declaration aligned: if a route depends on a protected integration, make sure the permission boundary is visible and intentional.

Policy types at a glance:

- License Manager policy:

```json
{
  "policies": [
    { "name": "Sku.aspx" }
  ]
}
```

- App policy:

```json
{
  "policies": [
    { "name": "vtex.messages:graphql-translate-messages" }
  ]
}
```

- Outbound-access policy:

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/api/*"
      }
    }
  ]
}
```

- Resource-based route policy with app principal VRN:

```json
{
  "routes": {
    "privateStatus": {
      "path": "/_v/private/status/:code",
      "public": false,
      "policies": [
        {
          "effect": "allow",
          "actions": ["POST"],
          "principals": [
            "vrn:apps:*:my-sponsor-account:*:app/vendor.partner-app@0.x"
          ]
        }
      ]
    }
  }
}
```

This route allows a specific IO app principal. Other apps remain denied by default because they do not match any allow rule.

- Resource-based route policy with VTEX ID principal VRN:

```json
{
  "routes": {
    "status": {
      "path": "/_v/status/:code",
      "public": false,
      "policies": [
        {
          "effect": "allow",
          "actions": ["POST"],
          "principals": [
            "vrn:vtex.vtex-id:-:bibi:-:user/vtexappkey-mcc77-HBXYAE"
          ]
        },
        {
          "effect": "deny",
          "actions": ["POST"],
          "principals": [
            "vrn:vtex.vtex-id:-:bibi:-:user/*@vtex.com"
          ]
        }
      ]
    }
  }
}
```

This is an advanced pattern for integrations that identify callers through a specific VTEX ID principal, including appkey-based contracts. Prefer app VRNs for IO-to-IO access when the caller is another VTEX IO app. VTEX IO auth tokens such as `AUTH_TOKEN`, `STORE_TOKEN`, and `ADMIN_TOKEN` play a different role: they authenticate requests to VTEX services and help preserve requester context, but they do not automatically replace route-level resource policies based on VRN principals.

## Hard constraints

### Constraint: Every protected integration must have an explicit supporting policy

If a client or route depends on access controlled by License Manager policies, role-based app policies, or `outbound-access`, the app MUST declare the corresponding permission explicitly in `manifest.json`. Resources protected by resource-based policies define access on the server side and do not require consumer apps to declare additional policies just for that server-side enforcement.

**Why this matters**

Without the required policy, the code may be correct but the platform will still block the access at runtime, leading to failures that are hard to debug from handler code alone.

**Detection**

If you see a new external host, VTEX resource, or protected capability being consumed, STOP and verify that the required consumer-side policy exists before merging the code. If the app is exposing a protected route or operation, STOP and confirm that the access rule is also enforced on the server side.

**Correct**

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/api/*"
      }
    }
  ]
}
```

**Wrong**

```json
{
  "policies": []
}
```

### Constraint: Outbound policies must follow least privilege

Outbound-access policies MUST be scoped as narrowly as practical for the target host and path.

**Why this matters**

Broad outbound rules increase risk, make reviews harder, and allow integrations to expand silently beyond their intended surface.

**Detection**

If you see wildcard hosts or overly broad paths when the integration uses a much smaller surface, STOP and narrow the declaration.

**Correct**

```json
{
  "name": "outbound-access",
  "attrs": {
    "host": "partner.example.com",
    "path": "/orders/*"
  }
}
```

**Wrong**

```json
{
  "name": "outbound-access",
  "attrs": {
    "host": "*",
    "path": "/*"
  }
}
```

### Constraint: Policy changes must be reviewed together with the behavior they enable

When a policy is added or widened, the route or integration behavior that depends on it MUST be reviewed in the same change.

**Why this matters**

Permissions are meaningful only in context. Reviewing a policy change without the code that consumes it makes overreach and hidden side effects easier to miss.

**Detection**

If a PR changes `manifest.json` permissions without showing the relevant route, client, or integration code, STOP and request the linked behavior before approving.

**Correct**

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/orders/*"
      }
    }
  ]
}
```

**Wrong**

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/api/*"
      }
    }
  ]
}
```

This broader policy alone does not explain why the app needs the expanded access.

## Preferred pattern

Start from the client or route behavior, identify the minimal access needed, and declare only that permission in `manifest.json`. When the app exposes protected routes or operations, define the resource-based access rule on the server side as part of the same review.

Example pattern:

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/orders/*"
      }
    }
  ]
}
```

Review permissions whenever integrations change, not only when policy errors appear in runtime.

## Common failure modes

- Forgetting the outbound-access policy for a new external integration.
- Using an outbound-access policy when the real requirement is a License Manager resource key or an app policy exposed by another VTEX IO app.
- Using wildcard hosts or paths when a narrower declaration would work.
- Assuming consumer apps must declare manifest policies for resources that are actually enforced through resource-based policies on the server side.
- Adding permissions without reviewing the route or client behavior they enable.
- Treating policy failures as code bugs instead of permission bugs.
- Treating a `403` that names a VRN resource or principal as a handler bug instead of an authorization or policy-mapping problem.

## Review checklist

- [ ] Does every protected integration have an explicit policy?
- [ ] Is the policy type correct for the access pattern: License Manager, app policy, or outbound-access?
- [ ] Are outbound-access rules narrow enough for the real integration surface?
- [ ] If the app exposes protected routes or operations, is server-side access control defined explicitly as well?
- [ ] Is the policy change reviewed together with the route or client that needs it?
- [ ] Are wildcard permissions avoided unless strictly necessary?

## Reference

- [Policies](https://developers.vtex.com/docs/guides/vtex-io-documentation-policies) - Policy types and manifest declaration
- [Accessing external resources within a VTEX IO app](https://developers.vtex.com/docs/guides/accessing-external-resources-within-a-vtex-io-app) - Outbound-access policy guidance
- [Policies from License Manager](https://developers.vtex.com/docs/guides/policies-from-license-manager) - License Manager resource keys and policy usage
- [Controlling access to app resources](https://developers.vtex.com/docs/guides/controlling-access-to-app-resources) - Role-based and resource-based access for your own app resources
- [VTEX Resource Name (VRN)](https://developers.vtex.com/docs/guides/vtex-io-documentation-vrn) - How VTEX expresses resources and principals in policies
- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) - App contract and permission declaration

---

# Auth Tokens & Request Context

## When this skill applies

Use this skill when the main decision is which VTEX IO identity should authenticate a backend request to VTEX services.

- Choosing between `ctx.authToken`, `ctx.storeUserAuthToken`, and `ctx.adminUserAuthToken`
- Deciding whether a VTEX client call should use `AUTH_TOKEN`, `STORE_TOKEN`, or `ADMIN_TOKEN`
- Reviewing storefront and Admin integrations that should respect the current user identity
- Replacing hardcoded `appKey` and `appToken` usage inside a VTEX IO app

Do not use this skill for:
- deciding which policies belong in `manifest.json`
- modeling route-level authorization or resource-based policies
- choosing between `ExternalClient`, `JanusClient`, and other client abstractions
- browser-side login or session UX flows
- validating route input or deciding what data may cross the app boundary

## Decision rules

- Use this skill to decide which identity talks to VTEX endpoints, not what that identity is authorized to do.
- Use `AUTH_TOKEN` with `ctx.authToken` only for app-level operations that are not tied to a current shopper or Admin user.
- Use `STORE_TOKEN` with `ctx.storeUserAuthToken` whenever the action comes from storefront browsing or a shopper-triggered flow and the integration should respect shopper permissions.
- Use `ADMIN_TOKEN` with `ctx.adminUserAuthToken` whenever the action comes from an Admin interface and the integration should respect the logged-in Admin user's License Manager permissions.
- Prefer user tokens whenever they are available. The official guidance is to avoid app-token authentication when a store or Admin user token can represent the requester more accurately.
- If the corresponding user token is not present, fall back to `AUTH_TOKEN` only when the operation is truly app-scoped and does not depend on a current shopper or Admin identity.
- When using VTEX IO clients that accept `authMethod`, pass the token choice explicitly when the default app identity is not the right one for the request.
- When wrapping custom VTEX clients, propagate the matching auth token from `IOContext` at the client boundary instead of hardcoding credentials in handlers.
- Keep token choice aligned with the user journey: storefront flows should not silently escalate to app-level permissions, and Admin flows should not bypass the current Admin role context.
- `ADMIN_TOKEN` with `ctx.adminUserAuthToken` must remain server-side only and must never be exposed or proxied to browser clients.
- Treat token choice and policy design as separate concerns: this skill decides which identity is making the call, while auth-and-policies decides what that identity is allowed to do.
- Do not use `appKey` and `appToken` inside a VTEX IO app unless there is a documented exception outside the normal VTEX IO auth-token model.
- Never log raw tokens or return them in responses. Tokens are request secrets, and downstream callers should receive only business data.

Token selection at a glance:

| Token | Context field | Use when | Avoid when |
|---|---|---|---|
| `AUTH_TOKEN` | `ctx.authToken` | app-level jobs, service-to-service work, or operations not linked to a current user | a shopper or Admin user is already driving the action |
| `STORE_TOKEN` | `ctx.storeUserAuthToken` | storefront and shopper-triggered operations | backend jobs or Admin-only operations |
| `ADMIN_TOKEN` | `ctx.adminUserAuthToken` | Admin requests that must respect the current user's LM role | storefront flows or background app tasks |

## Hard constraints

### Constraint: User-driven requests must prefer user tokens over the app token

If a request is initiated by a current shopper or Admin user, the VTEX integration MUST use the corresponding user token instead of defaulting to the app token.

**Why this matters**

Using the app token for user-driven work widens permissions unnecessarily and disconnects the request from the real user context that should govern access.

**Detection**

If the code runs in a storefront or Admin request path and still uses `ctx.authToken` or implicit app-token behavior, STOP and verify whether `ctx.storeUserAuthToken` or `ctx.adminUserAuthToken` should be used instead.

**Correct**

```typescript
export class OmsClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.storeUserAuthToken,
      },
    })
  }
}
```

**Wrong**

```typescript
export class OmsClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }
}
```

### Constraint: App tokens must be reserved for app-level operations that are not tied to a user

Use `ctx.authToken` only when the request is genuinely app-scoped and no current shopper or Admin identity should govern the action.

**Why this matters**

The app token carries the permissions declared in the app manifest. Using it for user-triggered actions can bypass the narrower shopper or Admin permission model that the platform expects.

**Detection**

If a request originates from an Admin page, storefront interaction, or another user-facing workflow, STOP before using `ctx.authToken` and confirm that the action is truly app-level rather than user-scoped.

**Correct**

```typescript
export class RatesAndBenefitsClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }
}
```

**Wrong**

```typescript
export class AdminOrdersClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }
}
```

This is wrong when the client is used from an Admin flow that should respect the logged-in user's role.

### Constraint: VTEX IO apps must not hardcode VTEX API credentials when auth tokens are available

A VTEX IO app MUST use tokens from `IOContext` or `authMethod` instead of embedding `appKey`, `appToken`, or static VTEX credentials in source code or routine runtime configuration.

**Why this matters**

Hardcoded VTEX credentials are harder to rotate, easier to leak, and bypass the request-context model that VTEX IO clients already support.

**Detection**

If you see `X-VTEX-API-AppKey`, `X-VTEX-API-AppToken`, raw VTEX API credentials, or environment variables carrying permanent VTEX credentials inside a normal IO app integration, STOP and replace them with the correct auth-token flow unless there is a documented exception.

**Correct**

```typescript
await ctx.clients.catalog.getSkuById(id, {
  authMethod: 'ADMIN_TOKEN',
})
```

**Wrong**

```typescript
await fetch(`https://${ctx.vtex.account}.myvtex.com/api/catalog/pvt/stockkeepingunit/${id}`, {
  headers: {
    'X-VTEX-API-AppKey': process.env.VTEX_APP_KEY!,
    'X-VTEX-API-AppToken': process.env.VTEX_APP_TOKEN!,
  },
})
```

## Preferred pattern

Start from the requester context, choose the token identity that matches that requester, and keep the token propagation inside the client layer.

Minimal selection guide:

```text
storefront request -> STORE_TOKEN / ctx.storeUserAuthToken
admin request -> ADMIN_TOKEN / ctx.adminUserAuthToken
background app work -> AUTH_TOKEN / ctx.authToken
```

Pass the token explicitly when the client supports `authMethod`:

```typescript
await ctx.clients.orders.listOrders({
  authMethod: 'ADMIN_TOKEN',
})
```

```typescript
await ctx.clients.orders.listOrders({
  authMethod: 'STORE_TOKEN',
})
```

Or inject the matching token in a custom VTEX client:

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export class OmsClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.adminUserAuthToken,
      },
    })
  }
}
```

Keep the decision close to the request boundary, then let downstream handlers and services depend on the correctly configured client rather than choosing tokens ad hoc in many places.

## Common failure modes

- Defaulting every VTEX request to `ctx.authToken`, even when a shopper or Admin user initiated the action.
- Using `ctx.authToken` in Admin pages and accidentally bypassing the current Admin user's License Manager role context.
- Using `ctx.authToken` in storefront flows that should be limited by shopper permissions.
- Hardcoding `appKey` and `appToken` in an IO app instead of using auth tokens from `IOContext`.
- Choosing the right token in one client method but forgetting to apply the same identity consistently across related calls.
- Mixing token choice with policy modeling and treating them as the same decision.
- Logging `ctx.authToken`, `ctx.storeUserAuthToken`, or `ctx.adminUserAuthToken` in plain text, or forwarding raw tokens to downstream services that do not need them.

## Review checklist

- [ ] Does each VTEX integration use the correct requester identity: shopper, Admin user, or app?
- [ ] Are `ctx.storeUserAuthToken` and `ctx.adminUserAuthToken` preferred when a user is actually driving the action?
- [ ] Is `ctx.authToken` used only for app-level operations that are not tied to a current user?
- [ ] Are hardcoded VTEX credentials absent from normal IO app integrations?
- [ ] Is token propagation centralized in the client layer or explicit `authMethod` usage rather than scattered across handlers?

## Related skills

- [`vtex-io-auth-and-policies`](../vtex-io-auth-and-policies/skill.md) - Use when the main choice is which permissions and policies the chosen identity should carry

## Reference

- [App authentication using auth tokens](https://developers.vtex.com/docs/guides/app-authentication-using-auth-tokens) - Official token model for `AUTH_TOKEN`, `STORE_TOKEN`, and `ADMIN_TOKEN`
- [Using VTEX IO clients](https://developers.vtex.com/docs/guides/calling-commerce-apis-3-using-vtex-io-clients) - Client usage patterns that complement token selection
- [Policies](https://developers.vtex.com/docs/guides/vtex-io-documentation-policies) - How app-token permissions relate to manifest-declared policies

---

# Client Integration & Service Access

## When this skill applies

Use this skill when the main decision is how a VTEX IO backend app should call VTEX services or external APIs through the VTEX IO client system.

- Creating custom clients under `node/clients/`
- Choosing between native clients from `@vtex/api` or `@vtex/clients` and a custom client
- Registering clients in `IOClients` and exposing them through `ctx.clients`
- Configuring `InstanceOptions` such as retries, timeout, headers, or caching
- Reviewing backend integrations that currently use raw HTTP libraries

Do not use this skill for:
- deciding the app contract in `manifest.json`
- structuring `node/index.ts` or tuning `service.json`
- designing GraphQL schema or resolver contracts
- modeling route authorization or security permissions
- building storefront or admin frontend integrations

## Decision rules

- Prefer native clients from `@vtex/api` or `@vtex/clients` when they already cover the target VTEX service. Common examples include clients for catalog, checkout, logistics, and OMS. Write a custom client only when no suitable native client or factory exists.
- Use `ExternalClient` primarily for non-VTEX external APIs. Avoid using it for VTEX-hosted endpoints such as `*.myvtex.com` or `*.vtexcommercestable.com.br` when a native client in `@vtex/clients`, `JanusClient`, or another documented higher-level VTEX client is available or more appropriate.
- Janus is VTEX's Core Commerce API gateway. Use `JanusClient` only when you need to call a VTEX Core Commerce API through Janus and no suitable native client from `@vtex/clients` already exists.
- Use `InfraClient` only for advanced integrations with VTEX IO infrastructure services under explicit documented guidance. In partner apps, prefer higher-level clients and factories such as `masterData` or `vbase` instead of extending `InfraClient` directly.
- Register every custom or native client in `node/clients/index.ts` through a `Clients` class that extends `IOClients`.
- Consume integrations through `ctx.clients`, never by instantiating client classes inside middlewares, resolvers, or event handlers.
- Keep clients focused on transport, request options, endpoint paths, and small response shaping. Keep business rules, authorization decisions, and orchestration outside the client.
- When building custom clients, always rely on the `IOContext` passed by VTEX IO such as `account`, `workspace`, and available auth tokens instead of hardcoding account names, workspaces, or environment-specific VTEX URLs.
- Configure shared `InstanceOptions` in the runtime client config, then use client-specific overrides only when an integration has clearly different needs.
- Use the `metric` option on important client calls so integrations can be tracked and monitored at the client layer, not only at the handler layer.
- Keep error normalization close to the client boundary, but avoid hiding relevant HTTP status codes or transport failures that are important for observability and debugging.
- When integrating with external services, confirm that the required outbound policies are declared in the app contract, but keep the detailed policy modeling in auth or app-contract skills.
- In rare migration or legacy scenarios, `ExternalClient` may temporarily be used against VTEX-hosted endpoints, but treat this as an exception. The long-term goal should be to move toward native clients or the proper documented VTEX client abstractions so routing, authentication, and observability stay consistent.

Client selection guide:

| Client type | Use when | Avoid when |
|---|---|---|
| `ExternalClient` | calling non-VTEX external APIs | VTEX-hosted APIs that already have a native client or Janus-based abstraction |
| `JanusClient` | calling VTEX Core Commerce APIs not yet wrapped by `@vtex/clients` | any VTEX service that already has a native client such as Catalog, Checkout, Logistics, or OMS |
| `InfraClient` | implementing advanced infra-style clients only under explicit documented guidance | general VTEX or external APIs in partner apps |

InstanceOptions heuristics:

- Start with small, explicit client defaults such as `retries: 2` and a request `timeout` between `1000` and `3000` milliseconds.
- Use small finite retry values such as `1` to `3` for idempotent operations.
- Avoid automatic retries on non-idempotent operations unless the upstream API explicitly documents safe idempotency behavior.
- Do not use high retry counts to hide upstream instability. Surface repeated failures clearly and handle them intentionally in the business layer.
- Prefer per-client headers and metrics instead of scattering header definitions through handlers.
- Use memory or disk cache options only when repeated reads justify it and the response can be safely reused.
- Keep auth setup inside the client constructor or factory configuration, not duplicated across handlers.

## Hard constraints

### Constraint: All service-to-service HTTP calls must go through VTEX IO clients

HTTP communication from a VTEX IO backend app MUST go through `@vtex/api` or `@vtex/clients` clients. Do not use raw libraries such as `axios`, `fetch`, `got`, or `node-fetch` for service integrations.

**Why this matters**

VTEX IO clients provide transport behavior that raw libraries bypass, including authentication context, retries, metrics, caching options, and infrastructure-aware request execution. Raw HTTP calls make integrations harder to observe and easier to misconfigure.

**Detection**

If you see `axios`, `fetch`, `got`, `node-fetch`, or direct ad hoc HTTP code in a VTEX IO backend service, STOP and replace it with an appropriate VTEX IO client pattern.

**Correct**

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class WeatherClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://api.weather.com', context, {
      ...options,
      headers: {
        'X-VTEX-Account': context.account,
        'X-VTEX-Workspace': context.workspace,
        'X-Api-Key': process.env.WEATHER_API_KEY,
        ...options?.headers,
      },
    })
  }

  public getForecast(city: string) {
    return this.http.get(`/v1/forecast/${city}`, {
      metric: 'weather-forecast',
    })
  }
}
```

**Wrong**

```typescript
import axios from 'axios'

export async function getForecast(city: string) {
  const response = await axios.get(`https://api.weather.com/v1/forecast/${city}`, {
    headers: {
      'X-Api-Key': process.env.WEATHER_API_KEY,
    },
  })

  return response.data
}
```

### Constraint: Clients must be registered in IOClients and consumed through ctx.clients

Clients MUST be registered in the `Clients` class that extends `IOClients`, and middlewares, resolvers, or event handlers MUST access them through `ctx.clients`.

**Why this matters**

The VTEX IO client registry ensures the current request context, options, caching behavior, and instrumentation are applied consistently. Direct instantiation inside handlers bypasses that shared lifecycle and creates fragile integration code.

**Detection**

If you see `new MyClient(...)` inside a middleware, resolver, or event handler, STOP. Move the client into `node/clients/`, register it in `IOClients`, and consume it through `ctx.clients`.

**Correct**

```typescript
import { IOClients } from '@vtex/api'
import { Catalog } from '@vtex/clients'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', Catalog)
  }
}
```

```typescript
export async function getSku(ctx: Context) {
  const sku = await ctx.clients.catalog.getSkuById(ctx.vtex.route.params.id)
  ctx.body = sku
}
```

**Wrong**

```typescript
import { Catalog } from '@vtex/clients'

export async function getSku(ctx: Context) {
  const catalog = new Catalog(ctx.vtex, {})
  const sku = await catalog.getSkuById(ctx.vtex.route.params.id)
  ctx.body = sku
}
```

### Constraint: Choose the narrowest client type that matches the integration boundary

Each integration MUST use the correct client abstraction for its boundary. Do not default every integration to `ExternalClient` or `JanusClient` when a more specific client type or native package already exists.

**Why this matters**

The client type communicates intent and shapes how authentication, URLs, and service boundaries are handled. Using the wrong abstraction makes the integration harder to understand and more likely to drift from VTEX IO conventions.

**Detection**

If the target is a VTEX Core Commerce API, STOP and check whether a native client from `@vtex/clients` or `JanusClient` is more appropriate than `ExternalClient`. If the target is VTEX-hosted, STOP and confirm that there is no more specific documented VTEX client abstraction before defaulting to `ExternalClient`.

**Correct**

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export class RatesAndBenefitsClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, options)
  }
}
```

**Wrong**

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class RatesAndBenefitsClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(`https://${context.account}.vtexcommercestable.com.br`, context, options)
  }
}
```

## Preferred pattern

Recommended file layout:

```text
node/
├── clients/
│   ├── index.ts
│   ├── catalog.ts
│   └── partnerApi.ts
├── middlewares/
│   └── getData.ts
└── index.ts
```

Register native and custom clients in one place:

```typescript
import { IOClients } from '@vtex/api'
import { Catalog } from '@vtex/clients'
import { PartnerApiClient } from './partnerApi'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', Catalog)
  }

  public get partnerApi() {
    return this.getOrSet('partnerApi', PartnerApiClient)
  }
}
```

Create custom clients with explicit routes and options:

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class PartnerApiClient extends ExternalClient {
  private routes = {
    order: (id: string) => `/orders/${id}`,
  }

  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://partner.example.com', context, {
      ...options,
      retries: 2,
      timeout: 2000,
      headers: {
        'X-VTEX-Account': context.account,
        'X-VTEX-Workspace': context.workspace,
        ...options?.headers,
      },
    })
  }

  public getOrder(id: string) {
    return this.http.get(this.routes.order(id), {
      metric: 'partner-get-order',
    })
  }
}
```

Wire shared client options in the runtime:

```typescript
import type { ClientsConfig } from '@vtex/api'
import { Clients } from './clients'

const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 2,
      timeout: 2000,
    },
  },
}
```

Use clients from handlers through `ctx.clients`:

```typescript
export async function getOrder(ctx: Context) {
  const order = await ctx.clients.partnerApi.getOrder(ctx.vtex.route.params.id)
  ctx.body = order
}
```

If a client file grows too large, split it by bounded integration domains and keep `node/clients/index.ts` as a small registry.

## Common failure modes

- Using `axios`, `fetch`, or other raw HTTP libraries in backend handlers instead of VTEX IO clients.
- Instantiating clients directly inside handlers instead of registering them in `IOClients`.
- Choosing `ExternalClient` when a native VTEX client or a more specific app client already exists.
- Putting business rules, validation, or orchestration into clients instead of keeping them as transport wrappers.
- Scattering headers, auth setup, and retry settings across handlers instead of centralizing them in the client or shared client config.
- Forgetting the outbound-access policy required for an external integration declared in a custom client.

## Review checklist

- [ ] Does each integration use the correct VTEX IO client abstraction?
- [ ] Are native clients from `@vtex/api` or `@vtex/clients` preferred when available?
- [ ] Are clients registered in `IOClients` and consumed through `ctx.clients`?
- [ ] Are raw HTTP libraries absent from the backend integration code?
- [ ] Are retries, timeouts, headers, and metrics configured in the client layer rather than scattered across handlers?
- [ ] Are business rules kept out of the client layer?

## Reference

- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) - How to consume clients through `ctx.clients`
- [Developing Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-how-to-create-and-use-clients) - How to build custom clients with `@vtex/api`
- [Using VTEX IO clients](https://developers.vtex.com/docs/guides/calling-commerce-apis-3-using-vtex-io-clients) - How to use VTEX clients for Core Commerce APIs
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) - VTEX IO client architecture and native client catalog

---

# GraphQL Schemas & Resolvers

## When this skill applies

Use this skill when your VTEX IO app needs to expose a GraphQL API — either for frontend React components to query, for other VTEX IO apps to consume, or for implementing custom data aggregation layers over VTEX Commerce APIs.

- Defining schemas in `.graphql` files in the `/graphql` directory
- Writing resolver functions in TypeScript in `/node/resolvers/`
- Configuring `@cacheControl` and `@auth` directives
- Wiring resolvers into the Service class

Do not use this skill for:
- Backend service structure and client system (use `vtex-io-service-apps` instead)
- Manifest and builder configuration (use `vtex-io-app-structure` instead)
- MasterData integration details (use `vtex-io-masterdata` instead)

## Decision rules

- The `graphql` builder processes `.graphql` files in `/graphql` and merges them into a single schema.
- Split definitions across multiple files for maintainability: `schema.graphql` for root types, `directives.graphql` for directive declarations, `types/*.graphql` for custom types.
- Use `@cacheControl(scope: PUBLIC, maxAge: SHORT|MEDIUM|LONG)` on all public Query fields. `PUBLIC` = shared CDN cache, `PRIVATE` = per-user cache.
- Use `@auth` on all Mutations and on Queries that return sensitive or user-specific data.
- Never use `@cacheControl` on Mutations.
- Resolver function keys in the Service entry point MUST exactly match the field names in `schema.graphql`.
- Always use `ctx.clients` in resolvers for data access — never raw HTTP calls.

Recommended directory structure:

```text
graphql/
├── schema.graphql        # Query and Mutation root type definitions
├── directives.graphql    # Custom directive declarations (@cacheControl, @auth)
└── types/
    ├── Review.graphql    # Custom type definitions
    └── Product.graphql   # One file per type for organization
```

Built-in directives:
- **`@cacheControl`**: `scope` (`PUBLIC`/`PRIVATE`), `maxAge` (`SHORT` 30s, `MEDIUM` 5min, `LONG` 1h)
- **`@auth`**: Enforces valid VTEX authentication token. Without it, unauthenticated users can call the endpoint.
- **`@smartcache`**: Automatically caches query results in VTEX infrastructure.

## Hard constraints

### Constraint: Declare the graphql Builder

Any app using `.graphql` schema files MUST declare the `graphql` builder in `manifest.json`. The `graphql` builder interprets the schema and registers it with the VTEX IO runtime.

**Why this matters**

Without the `graphql` builder declaration, the `/graphql` directory is completely ignored. Schema files will not be processed, resolvers will not be registered, and GraphQL queries will return "schema not found" errors. The app will link without errors but GraphQL will silently not work.

**Detection**

If you see `.graphql` files in a `/graphql` directory but the manifest does not include `"graphql": "1.x"` in `builders`, STOP and add the builder declaration.

**Correct**

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x"
  }
}
```

**Wrong**

```json
{
  "builders": {
    "node": "7.x"
  }
}
```

Missing `"graphql": "1.x"` — the `/graphql` directory with schema files is ignored. GraphQL queries return errors because no schema is registered. The app links successfully, masking the problem.

---

### Constraint: Use @cacheControl on Public Queries

All public-facing Query fields (those fetching data that is not user-specific) MUST include the `@cacheControl` directive with an appropriate `scope` and `maxAge`. Mutations MUST NOT use `@cacheControl`.

**Why this matters**

Without `@cacheControl`, every query hits your resolver on every request — no CDN caching, no edge caching, no shared caching. This leads to unnecessary load on VTEX infrastructure, slow response times, and potential rate limiting. For public product data, caching is critical for performance.

**Detection**

If a Query field returns public data (not user-specific) and does not have `@cacheControl`, warn the developer to add it. If a Mutation has `@cacheControl`, STOP and remove it.

**Correct**

```graphql
type Query {
  reviews(productId: String!, limit: Int): [Review]
    @cacheControl(scope: PUBLIC, maxAge: SHORT)

  productMetadata(slug: String!): ProductMetadata
    @cacheControl(scope: PUBLIC, maxAge: MEDIUM)

  myReviews: [Review]
    @cacheControl(scope: PRIVATE, maxAge: SHORT)
    @auth
}

type Mutation {
  createReview(review: ReviewInput!): Review @auth
}
```

**Wrong**

```graphql
type Query {
  reviews(productId: String!, limit: Int): [Review]

  myReviews: [Review]
}

type Mutation {
  createReview(review: ReviewInput!): Review
    @cacheControl(scope: PUBLIC, maxAge: LONG)
}
```

No cache control on queries (every request hits the resolver), missing `@auth` on user-specific data, and `@cacheControl` on a mutation (makes no sense).

---

### Constraint: Resolver Names Must Match Schema Fields

Resolver function keys in the Service entry point MUST exactly match the field names defined in `schema.graphql`. The resolver object structure must mirror the GraphQL type hierarchy.

**Why this matters**

The GraphQL runtime maps incoming queries to resolver functions by name. If the resolver key does not match the schema field name, the field will resolve to `null` without any error — a silent failure that is extremely difficult to debug.

**Detection**

If a schema field has no matching resolver key (or vice versa), STOP. Cross-check every Query and Mutation field against the resolver registration in `node/index.ts`.

**Correct**

```graphql
type Query {
  reviews(productId: String!): [Review]
  reviewById(id: ID!): Review
}
```

```typescript
// node/index.ts — resolver keys match schema field names exactly
export default new Service({
  graphql: {
    resolvers: {
      Query: {
        reviews: reviewsResolver,
        reviewById: reviewByIdResolver,
      },
    },
  },
})
```

**Wrong**

```typescript
// node/index.ts — resolver key "getReviews" does not match schema field "reviews"
export default new Service({
  graphql: {
    resolvers: {
      Query: {
        getReviews: reviewsResolver,    // Wrong! Schema says "reviews", not "getReviews"
        getReviewById: reviewByIdResolver, // Wrong! Schema says "reviewById"
      },
    },
  },
})
```

Both fields will silently resolve to null. No error in logs.

## Preferred pattern

Add the GraphQL builder to manifest:

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x"
  }
}
```

Define the schema:

```graphql
type Query {
  reviews(productId: String!, limit: Int, offset: Int): ReviewsResponse
    @cacheControl(scope: PUBLIC, maxAge: SHORT)

  review(id: ID!): Review
    @cacheControl(scope: PUBLIC, maxAge: SHORT)
}

type Mutation {
  createReview(input: ReviewInput!): Review @auth
  updateReview(id: ID!, input: ReviewInput!): Review @auth
  deleteReview(id: ID!): Boolean @auth
}
```

Define custom types:

```graphql
type Review {
  id: ID!
  productId: String!
  author: String!
  rating: Int!
  title: String!
  text: String!
  createdAt: String!
  approved: Boolean!
}

type ReviewsResponse {
  data: [Review!]!
  total: Int!
  hasMore: Boolean!
}

input ReviewInput {
  productId: String!
  rating: Int!
  title: String!
  text: String!
}
```

Declare directives:

```graphql
directive @cacheControl(
  scope: CacheControlScope
  maxAge: CacheControlMaxAge
) on FIELD_DEFINITION

enum CacheControlScope {
  PUBLIC
  PRIVATE
}

enum CacheControlMaxAge {
  SHORT
  MEDIUM
  LONG
}

directive @auth on FIELD_DEFINITION
directive @smartcache on FIELD_DEFINITION
```

Implement resolvers:

```typescript
// node/resolvers/reviews.ts
import type { ServiceContext } from '@vtex/api'
import type { Clients } from '../clients'

type Context = ServiceContext<Clients>

export const queries = {
  reviews: async (
    _root: unknown,
    args: { productId: string; limit?: number; offset?: number },
    ctx: Context
  ) => {
    const { productId, limit = 10, offset = 0 } = args
    const reviews = await ctx.clients.masterdata.searchDocuments<Review>({
      dataEntity: 'reviews',
      fields: ['id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved'],
      where: `productId=${productId} AND approved=true`,
      pagination: { page: Math.floor(offset / limit) + 1, pageSize: limit },
      schema: 'review-schema-v1',
    })

    return {
      data: reviews,
      total: reviews.length,
      hasMore: reviews.length === limit,
    }
  },

  review: async (
    _root: unknown,
    args: { id: string },
    ctx: Context
  ) => {
    return ctx.clients.masterdata.getDocument<Review>({
      dataEntity: 'reviews',
      id: args.id,
      fields: ['id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved'],
    })
  },
}

export const mutations = {
  createReview: async (
    _root: unknown,
    args: { input: ReviewInput },
    ctx: Context
  ) => {
    const { input } = args

    const documentResponse = await ctx.clients.masterdata.createDocument({
      dataEntity: 'reviews',
      fields: {
        ...input,
        author: ctx.vtex.storeUserEmail ?? 'anonymous',
        approved: false,
        createdAt: new Date().toISOString(),
      },
      schema: 'review-schema-v1',
    })

    return ctx.clients.masterdata.getDocument<Review>({
      dataEntity: 'reviews',
      id: documentResponse.DocumentId,
      fields: ['id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved'],
    })
  },

  deleteReview: async (
    _root: unknown,
    args: { id: string },
    ctx: Context
  ) => {
    await ctx.clients.masterdata.deleteDocument({
      dataEntity: 'reviews',
      id: args.id,
    })

    return true
  },
}
```

Wire resolvers into the Service:

```typescript
// node/index.ts
import type { ParamsContext, RecorderState } from '@vtex/api'
import { Service } from '@vtex/api'

import { Clients } from './clients'
import { queries, mutations } from './resolvers/reviews'

export default new Service<Clients, RecorderState, ParamsContext>({
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 5000,
      },
    },
  },
  graphql: {
    resolvers: {
      Query: queries,
      Mutation: mutations,
    },
  },
})
```

Testing the GraphQL API after linking:

```graphql
query GetReviews {
  reviews(productId: "12345", limit: 5) {
    data {
      id
      author
      rating
      title
      text
      createdAt
    }
    total
    hasMore
  }
}

mutation CreateReview {
  createReview(input: {
    productId: "12345"
    rating: 5
    title: "Excellent product"
    text: "Really happy with this purchase."
  }) {
    id
    author
    createdAt
  }
}
```

## Common failure modes

- **Defining resolvers without matching schema fields**: The GraphQL runtime only exposes fields defined in the schema. Resolvers without matching fields are silently ignored. Conversely, schema fields without resolvers return `null`. Always define the schema first, then implement matching resolvers with identical names.
- **Querying external APIs directly in resolvers**: Using `fetch()` or `axios` bypasses the `@vtex/api` client system, losing caching, retries, metrics, and authentication. Always use `ctx.clients` in resolvers.
- **Missing @auth on mutation endpoints**: Without `@auth`, any anonymous user can call the mutation — a critical security vulnerability. Always add `@auth` to mutations and queries returning sensitive data.
- **Missing @cacheControl on public queries**: Every request hits the resolver without caching, causing unnecessary load and slow responses. Add appropriate cache directives to all public Query fields.

## Review checklist

- [ ] Is the `graphql` builder declared in `manifest.json`?
- [ ] Do all public Query fields have `@cacheControl` with appropriate scope and maxAge?
- [ ] Do all Mutations and sensitive Queries have `@auth`?
- [ ] Do resolver function keys exactly match schema field names?
- [ ] Are resolvers using `ctx.clients` for data access (no raw HTTP calls)?
- [ ] Are directive declarations present in `directives.graphql`?
- [ ] Is the resolver wired into the Service entry point under `graphql.resolvers`?

## Related skills

- [`vtex-io-service-apps`](../vtex-io-service-apps/skill.md) — Service app fundamentals needed for all GraphQL resolvers
- [`vtex-io-app-structure`](../vtex-io-app-structure/skill.md) — Manifest and builder configuration that GraphQL depends on
- [`vtex-io-masterdata`](../vtex-io-masterdata/skill.md) — MasterData integration commonly used as a data source in resolvers

## Reference

- [GraphQL in VTEX IO](https://developers.vtex.com/docs/guides/graphql-in-vtex-io) — Overview of GraphQL usage in the VTEX IO platform
- [GraphQL Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-graphql-builder) — Builder reference for schema processing and directory structure
- [Developing a GraphQL API in Service Apps](https://developers.vtex.com/docs/guides/developing-a-graphql-api-in-service-apps) — Step-by-step tutorial for building GraphQL APIs
- [Integrating an App with a GraphQL API](https://developers.vtex.com/docs/guides/integrating-an-app-with-a-graphql-api) — How to consume GraphQL APIs from other VTEX IO apps
- [GraphQL authorization in IO apps](https://developers.vtex.com/docs/guides/graphql-authorization-in-io-apps) — How to implement and use the `@auth` directive for protected GraphQL operations
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — How to implement and use the `@cacheControl` directive for GraphQL operations
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — How to use ctx.clients in resolvers for data access

---

# MasterData v2 Integration

## When this skill applies

Use this skill when your VTEX IO app needs to store custom data (reviews, wishlists, form submissions, configuration records), query or filter that data, or set up automated workflows triggered by data changes—and when you must **justify** Master Data versus other VTEX or external stores.

- Defining data entities and JSON Schemas using the `masterdata` builder
- Performing CRUD operations through MasterDataClient (`ctx.clients.masterdata`)
- Configuring search, scroll, and indexing for efficient data retrieval
- Setting up Master Data triggers for automated workflows
- Managing schema lifecycle to avoid the 60-schema limit
- **Deciding** whether data belongs in **Catalog** (fields, **specifications**, unstructured SKU/product specs), **Master Data**, **native OMS/checkout** surfaces, or an **external** SQL/NoSQL/database
- Avoiding **synchronous** Master Data on the **purchase critical path** (cart, checkout, payment, placement) unless there is a **hard** performance and reliability case
- Preferring **one source of truth**—avoid **duplicating** order headers or OMS lists in Master Data for convenience; prefer **OMS** or a **BFF** with **caching** (see **Related skills**)

Do not use this skill for:

- General backend service patterns (use `vtex-io-service-apps` instead)
- GraphQL schema definitions (use `vtex-io-graphql-api` instead)
- Manifest and builder configuration (use `vtex-io-app-structure` instead)

## Decision rules

### Before you choose Master Data

Architects, developers, and anyone **designing or implementing** a solution should **think deeply** and **treat this section as a checklist to critique the default**: double-check that Master Data is the **right** persistence layer—not an automatic pick. The skill is written to **question** convenience-driven choices.

- **Purpose** — Master Data is a **document-oriented** store (similar in spirit to **document DBs** / DynamoDB-style access patterns). It is **one option** among many; choosing it because it is “there” or “cheap” without a **workload fit** review is a design smell.
- **Product-bound data** — If the information is fundamentally **about products or SKUs**, evaluate **Catalog** first: **specifications**, **unstructured product/SKU specifications**, and native catalog fields before creating a **parallel** MD entity that mirrors catalog truth.
- **Purchase path** — **Do not** place **synchronous** Master Data reads/writes in the **hot path** of **checkout** (cart mutation, payment, order placement) unless you have **evidence** (latency budget, failure modes). Prefer **native** commerce stores and **async** or **after-order** enrichment.
- **Orders and lists** — **Duplicating** **OMS** or **order** data into Master Data to power **My Orders** or similar **usually** fights **single source of truth**. Prefer **OMS APIs** (or **marketplace** protocols) behind a **BFF** or **IO** layer with **application caching** and correct **HTTP/path** semantics—not a second **order database** in MD “because it is easier.”
- **Exposing MD** — Master Data is **storage** only. Any **storefront** or **partner** access should go through a **service** that enforces **authentication**, **authorization**, and **rate limits**—typically **VTEX IO** or an external **BFF** following [headless-bff-architecture](../../../headless/skills/headless-bff-architecture/skill.md) patterns.
- **When MD fits** — After **storage fit** review, if MD remains appropriate, implement CRUD and schema discipline as below; combine with [vtex-io-application-performance](../vtex-io-application-performance/skill.md) and [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) when exposing HTTP or GraphQL from IO.

### Entity governance and hygiene

Before creating a new entity or extending an existing one, understand the landscape:

- **Native entities** — The platform manages entities like `CL` (clients), `AD` (addresses), `OD` (orders), `BK` (bookmarks), `AU` (auth), and others. **Never** create custom entities that duplicate native entity purposes. Know which entities exist before adding new ones.
- **Entity usage audit** — In accounts with dozens of custom entities, classify each by purpose: **logs/monitoring**, **cache/temporary**, **order extension**, **customer extension**, **marketing**, **CMS/content**, **integration/sync**, **auth/identity**, **logistics/geo**, or **custom business logic**. Entities in the **logs** or **cache** categories often indicate misuse—IO app logs belong in the logger, not MD; caches belong in VBase, not MD.
- **Critical path flag** — Identify whether an entity is used in **checkout**, **cart**, **payment**, or **login** flows. Entities on the critical path must meet strict latency and availability requirements. If an MD entity is on the critical path, question whether it should be there at all.
- **Document count awareness** — Use `REST-Content-Range` headers from `GET /search?_fields=id` with `REST-Range: resources=0-0` to efficiently count documents without fetching them. Large entities (100k+ docs) need `scrollDocuments`, pagination strategy, and potentially a BFF caching layer.

### Bulk operations and data migration

When importing, exporting, or migrating large datasets:

- **Validate before import** — Cross-reference import data against the authoritative source (e.g. catalog export for SKU validation, CL entity or user management API for email allowlists). Produce exception reports for invalid rows before touching MD.
- **JSONL payloads** — Generate one JSON object per MD document in a `.jsonl` file for bulk imports. This enables resumable, line-by-line processing.
- **Rate limiting** — MD APIs enforce rate limits. Use configurable delays between calls (e.g. 400ms) with exponential backoff on HTTP 429 responses.
- **Checkpoints** — For large imports (10k+ documents), persist progress to a checkpoint file (last successful document ID or line index). On failure or timeout, resume from the checkpoint instead of restarting.
- **Parallel with bounded concurrency** — Use a concurrency pool (e.g. `p-queue` with concurrency 5-10) for parallel `POST` or `PATCH` operations. Too much parallelism triggers rate limits; too little is slow.
- **Bulk delete before re-import** — When replacing all documents in an entity, use scroll + delete before import, or implement a separate delete pass with the same checkpoint and backoff patterns.
- **Schema alignment** — Ensure import payloads match the entity's JSON Schema exactly. Missing required fields or type mismatches cause silent validation failures.

### Implementation rules

- A **data entity** is a named collection of documents (analogous to a database table). A **JSON Schema** defines structure, validation, and indexing.
- When using the `masterdata` builder, entities are defined by folder structure: `masterdata/{entityName}/schema.json`. The builder creates entities named `{vendor}_{appName}_{entityName}`.
- Use `ctx.clients.masterdata` or `masterDataFor` from `@vtex/clients` for all CRUD operations — never direct REST calls.
- All fields used in `where` clauses MUST be declared in the schema's `v-indexed` array for efficient querying.
- Use `searchDocuments` for bounded result sets (known small size, max page size 100). Use `scrollDocuments` for large/unbounded result sets.
- The `masterdata` builder creates a new schema per app version. Clean up unused schemas to avoid the 60-schema-per-entity hard limit.

MasterDataClient methods:

| Method                              | Description                                          |
| ----------------------------------- | ---------------------------------------------------- |
| `getDocument`                       | Retrieve a single document by ID                     |
| `createDocument`                    | Create a new document, returns generated ID          |
| `createOrUpdateEntireDocument`      | Upsert a complete document                           |
| `createOrUpdatePartialDocument`     | Upsert partial fields (patch)                        |
| `updateEntireDocument`              | Replace all fields of an existing document           |
| `updatePartialDocument`             | Update specific fields only                          |
| `deleteDocument`                    | Delete a document by ID                              |
| `searchDocuments`                   | Search with filters, pagination, and field selection |
| `searchDocumentsWithPaginationInfo` | Search with total count metadata                     |
| `scrollDocuments`                   | Iterate over large result sets                       |

Search `where` clause syntax:

```text
where: "productId=12345 AND approved=true"
where: "rating>3"
where: "createdAt between 2025-01-01 AND 2025-12-31"
```

Architecture:

```text
VTEX IO App (node builder)
  │
  ├── ctx.clients.masterdata.createDocument()
  │       │
  │       ▼
  │   Master Data v2 API
  │       │
  │       ├── Validates against JSON Schema
  │       ├── Indexes declared fields
  │       └── Fires triggers (if conditions match)
  │             │
  │             ▼
  │         HTTP webhook / Email / Action
  │
  └── ctx.clients.masterdata.searchDocuments()
          │
          ▼
      Master Data v2 (reads indexed fields for efficient queries)
```

## Hard constraints

### Constraint: Use MasterDataClient — Never Direct REST Calls

All Master Data operations in VTEX IO apps MUST go through the MasterDataClient (`ctx.clients.masterdata`) or the `masterDataFor` factory from `@vtex/clients`. You MUST NOT make direct REST calls to `/api/dataentities/` endpoints.

**Why this matters**

The MasterDataClient handles authentication token injection, request routing, retry logic, caching, and proper error handling. Direct REST calls bypass all of these, requiring manual auth headers, pagination, and retry logic. When the VTEX auth token format changes, direct calls break while the client handles it transparently.

**Detection**

If you see direct HTTP calls to URLs matching `/api/dataentities/`, `api.vtex.com/api/dataentities`, or raw fetch/axios calls targeting Master Data endpoints, warn the developer to use `ctx.clients.masterdata` instead.

**Correct**

```typescript
// Using MasterDataClient through ctx.clients
export async function getReview(ctx: Context, next: () => Promise<void>) {
  const { id } = ctx.query;

  const review = await ctx.clients.masterdata.getDocument<Review>({
    dataEntity: "reviews",
    id: id as string,
    fields: [
      "id",
      "productId",
      "author",
      "rating",
      "title",
      "text",
      "approved",
    ],
  });

  ctx.status = 200;
  ctx.body = review;
  await next();
}
```

**Wrong**

```typescript
// Direct REST call to Master Data — bypasses client infrastructure
import axios from "axios";

export async function getReview(ctx: Context, next: () => Promise<void>) {
  const { id } = ctx.query;

  // No caching, no retry, no proper auth, no metrics
  const response = await axios.get(
    `https://api.vtex.com/api/dataentities/reviews/documents/${id}`,
    {
      headers: {
        "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY,
        "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN,
      },
    },
  );

  ctx.status = 200;
  ctx.body = response.data;
  await next();
}
```

---

### Constraint: Define JSON Schemas for All Data Entities

Every data entity your app uses MUST have a corresponding JSON Schema, either via the `masterdata` builder (recommended) or created via the Master Data API before the app is deployed.

**Why this matters**

Without a schema, Master Data stores documents as unstructured JSON. This means no field validation, no indexing (making search extremely slow on large datasets), no type safety, and no trigger support. Queries on unindexed fields perform full scans, which can time out or hit rate limits.

**Detection**

If the app creates or searches documents in a data entity but no JSON Schema exists for that entity (either in the `masterdata/` builder directory or via API), warn the developer to define a schema.

**Correct**

```json
{
  "$schema": "http://json-schema.org/schema#",
  "title": "review-schema-v1",
  "type": "object",
  "properties": {
    "productId": {
      "type": "string"
    },
    "author": {
      "type": "string"
    },
    "rating": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "title": {
      "type": "string",
      "maxLength": 200
    },
    "text": {
      "type": "string",
      "maxLength": 5000
    },
    "approved": {
      "type": "boolean"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": ["productId", "rating", "title", "text"],
  "v-default-fields": [
    "productId",
    "author",
    "rating",
    "title",
    "approved",
    "createdAt"
  ],
  "v-indexed": ["productId", "author", "approved", "rating", "createdAt"]
}
```

**Wrong**

```typescript
// Saving documents without any schema — no validation, no indexing
await ctx.clients.masterdata.createDocument({
  dataEntity: "reviews",
  fields: {
    productId: "12345",
    rating: "five", // String instead of number — no validation!
    title: 123, // Number instead of string — no validation!
  },
});

// Searching on unindexed fields — full table scan, will time out on large datasets
await ctx.clients.masterdata.searchDocuments({
  dataEntity: "reviews",
  where: "productId=12345", // productId is not indexed — very slow
  fields: ["id", "rating"],
  pagination: { page: 1, pageSize: 10 },
});
```

---

### Constraint: Manage Schema Versions to Avoid the 60-Schema Limit

Master Data v2 data entities have a limit of 60 schemas per entity. When using the `masterdata` builder, each app version linked or installed creates a new schema. You MUST delete unused schemas regularly.

**Why this matters**

Once the 60-schema limit is reached, the `masterdata` builder cannot create new schemas, and linking or installing new app versions will fail. This is a hard platform limit that cannot be increased.

**Detection**

If the app has been through many link/install cycles, warn the developer to check and clean up old schemas using the Delete Schema API.

**Correct**

```bash
# Periodically clean up unused schemas
# List schemas for the entity
curl -X GET "https://{account}.vtexcommercestable.com.br/api/dataentities/reviews/schemas" \
  -H "X-VTEX-API-AppKey: {appKey}" \
  -H "X-VTEX-API-AppToken: {appToken}"

# Delete old schemas that are no longer in use
curl -X DELETE "https://{account}.vtexcommercestable.com.br/api/dataentities/reviews/schemas/old-schema-name" \
  -H "X-VTEX-API-AppKey: {appKey}" \
  -H "X-VTEX-API-AppToken: {appToken}"
```

**Wrong**

```text
Never cleaning up schemas during development.
After 60 link cycles, the builder fails:
"Error: Maximum number of schemas reached for entity 'reviews'"
The app cannot be linked or installed until old schemas are deleted.
```

### Constraint: Do not use Master Data as a log, cache, or temporary store

Entities used for application **logging**, **caching** (IO app state, query results), or **temporary staging** data do not belong in Master Data. Use `ctx.vtex.logger` for logs, **VBase** for app-specific caches and temp state, and external log aggregation for audit trails.

**Why this matters** — Log and cache entities accumulate millions of documents, hit rate limits, make the entity unusable for legitimate queries, and waste storage. MD is not designed for high-write, high-volume, disposable data.

**Detection** — Entities with names like `LOG`, `cache`, `temp`, `staging`, `debug`, or entities whose document count grows unboundedly with traffic volume rather than business events.

**Correct**

```typescript
// Logs: use structured logger
ctx.vtex.logger.info({ action: 'priceUpdate', skuId, newPrice })

// Cache: use VBase
await ctx.clients.vbase.saveJSON('my-cache', cacheKey, data)
```

**Wrong**

```typescript
// Using MD as a log store — creates millions of documents
await ctx.clients.masterdata.createDocument({
  dataEntity: 'appLogs',
  fields: { level: 'info', message: `Price updated for ${skuId}`, timestamp: new Date() },
})
```

### Constraint: Do not create a parallel source of truth in Master Data without justification

Using Master Data to **mirror** data that already has a **system of record** in **OMS**, **Catalog**, or an **external ERP**—for example **order headers** for a custom list view, or **SKU attributes** that belong in **catalog specifications**—creates **drift**, **reconciliation** cost, and **incident** risk.

**Why this matters**

Two sources of truth disagree after partial failures, retries, or manual edits. Teams spend capacity syncing and debugging instead of **customer outcomes**.

**Detection**

New MD entities whose fields **duplicate** OMS order fields “for performance” without a **BFF cache** plan; **product** attributes stored in MD when **Catalog** specs would suffice; **scheduled jobs** to “fix” MD from OMS because they diverged.

**Correct**

```text
1. Identify the authoritative system (OMS, Catalog, partner API).
2. Read from that source via BFF or IO, with caching (application + HTTP semantics) as needed.
3. Use MD only for data without a native home or after explicit architecture sign-off.
```

**Wrong**

```text
"We store order snapshots in MD so the storefront is faster" while OMS remains canonical
and no reconciliation strategy exists — eventual inconsistency is guaranteed.
```

## Preferred pattern

Add the masterdata builder and policies:

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x",
    "masterdata": "1.x"
  },
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "api.vtex.com",
        "path": "/api/*"
      }
    },
    {
      "name": "ADMIN_DS"
    }
  ]
}
```

Define data entity schemas:

```json
{
  "$schema": "http://json-schema.org/schema#",
  "title": "review-schema-v1",
  "type": "object",
  "properties": {
    "productId": {
      "type": "string"
    },
    "author": {
      "type": "string"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "rating": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "title": {
      "type": "string",
      "maxLength": 200
    },
    "text": {
      "type": "string",
      "maxLength": 5000
    },
    "approved": {
      "type": "boolean"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": ["productId", "rating", "title", "text"],
  "v-default-fields": [
    "productId",
    "author",
    "rating",
    "title",
    "approved",
    "createdAt"
  ],
  "v-indexed": ["productId", "author", "approved", "rating", "createdAt"],
  "v-cache": false
}
```

Set up the client with `masterDataFor`:

```typescript
// node/clients/index.ts
import { IOClients } from "@vtex/api";
import { masterDataFor } from "@vtex/clients";

interface Review {
  id: string;
  productId: string;
  author: string;
  email: string;
  rating: number;
  title: string;
  text: string;
  approved: boolean;
  createdAt: string;
}

export class Clients extends IOClients {
  public get reviews() {
    return this.getOrSet("reviews", masterDataFor<Review>("reviews"));
  }
}
```

Implement CRUD operations:

```typescript
// node/resolvers/reviews.ts
import type { ServiceContext } from "@vtex/api";
import type { Clients } from "../clients";

type Context = ServiceContext<Clients>;

export const queries = {
  reviews: async (
    _root: unknown,
    args: { productId: string; page?: number; pageSize?: number },
    ctx: Context,
  ) => {
    const { productId, page = 1, pageSize = 10 } = args;

    const results = await ctx.clients.reviews.search(
      { page, pageSize },
      [
        "id",
        "productId",
        "author",
        "rating",
        "title",
        "text",
        "createdAt",
        "approved",
      ],
      "", // sort
      `productId=${productId} AND approved=true`,
    );

    return results;
  },
};

export const mutations = {
  createReview: async (
    _root: unknown,
    args: {
      input: { productId: string; rating: number; title: string; text: string };
    },
    ctx: Context,
  ) => {
    const { input } = args;
    const email = ctx.vtex.storeUserEmail ?? "anonymous@store.com";

    const response = await ctx.clients.reviews.save({
      ...input,
      author: email.split("@")[0],
      email,
      approved: false,
      createdAt: new Date().toISOString(),
    });

    return ctx.clients.reviews.get(response.DocumentId, [
      "id",
      "productId",
      "author",
      "rating",
      "title",
      "text",
      "createdAt",
      "approved",
    ]);
  },

  deleteReview: async (_root: unknown, args: { id: string }, ctx: Context) => {
    await ctx.clients.reviews.delete(args.id);
    return true;
  },
};
```

Configure triggers (optional):

```json
{
  "name": "notify-moderator-on-new-review",
  "active": true,
  "condition": "approved=false",
  "action": {
    "type": "email",
    "provider": "default",
    "subject": "New review pending moderation",
    "to": ["moderator@mystore.com"],
    "body": "A new review has been submitted for product {{productId}} by {{author}}."
  },
  "retry": {
    "times": 3,
    "delay": { "addMinutes": 5 }
  }
}
```

Wire into Service:

```typescript
// node/index.ts
import type { ParamsContext, RecorderState } from "@vtex/api";
import { Service } from "@vtex/api";

import { Clients } from "./clients";
import { queries, mutations } from "./resolvers/reviews";

export default new Service<Clients, RecorderState, ParamsContext>({
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 5000,
      },
    },
  },
  graphql: {
    resolvers: {
      Query: queries,
      Mutation: mutations,
    },
  },
});
```

## Common failure modes

- **Direct REST calls to /api/dataentities/**: Using `axios` or `fetch` to call Master Data endpoints bypasses the client infrastructure — no auth, no caching, no retries. Use `ctx.clients.masterdata` or `masterDataFor` instead.
- **Searching without indexed fields**: Queries on non-indexed fields trigger full document scans. For large datasets, this causes timeouts and rate limit errors. Ensure all `where` clause fields are in the schema's `v-indexed` array.
- **Not paginating search results**: Master Data v2 has a maximum page size of 100 documents. Requesting more silently returns only up to the limit. Use proper pagination or `scrollDocuments` for large result sets.
- **Ignoring the 60-schema limit**: Each app version linked/installed creates a new schema. After 60 link cycles, the builder fails. Periodically clean up unused schemas via the Delete Schema API.
- **Using MD for logs or caches**: Entities that grow with traffic volume instead of business events. Millions of log or cache documents degrade the account's MD performance.
- **Bulk import without rate limiting**: Flooding MD with parallel writes triggers 429 errors and account-wide throttling. Always use bounded concurrency with backoff.
- **Import without validation**: Importing data without cross-referencing the catalog or user store leads to orphaned documents, broken references, and data that fails schema validation silently.
- **No checkpoint in bulk operations**: A 50k-document import that fails at document 30k must restart from zero without a checkpoint file.

## Review checklist

- [ ] Is the `masterdata` builder declared in `manifest.json`?
- [ ] Do all data entities have JSON Schemas with proper field definitions?
- [ ] Are all `where` clause fields declared in `v-indexed`?
- [ ] Are CRUD operations using `ctx.clients.masterdata` or `masterDataFor` (no direct REST calls)?
- [ ] Is pagination properly handled (max 100 per page, scroll for large sets)?
- [ ] Is there a plan for schema cleanup to avoid the 60-schema limit?
- [ ] Are required policies (`outbound-access`, `ADMIN_DS`) declared in the manifest?
- [ ] Was **Catalog** or native stores ruled in/out before MD for **product** or **order** data?
- [ ] Is MD **off** the **purchase critical path** unless explicitly justified?
- [ ] If exposing MD externally, is access through a **controlled** IO/BFF layer with **auth**?
- [ ] Is the entity **not** being used for **logging**, **caching**, or **temporary** data?
- [ ] For bulk operations, are **rate limiting**, **backoff**, and **checkpoints** implemented?
- [ ] Is import data **validated** against the authoritative source before writing to MD?
- [ ] Are **native entities** (CL, AD, OD, etc.) identified and not duplicated by custom entities?

## Related skills

- [vtex-io-application-performance](../vtex-io-application-performance/skill.md) — IO performance patterns (cache layers, BFF-facing behavior)
- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) — Public vs private routes for MD-backed APIs
- [vtex-io-session-apps](../vtex-io-session-apps/skill.md) — Session transforms that may read from or complement MD-stored state
- [architecture-well-architected-commerce](../../../architecture/skills/architecture-well-architected-commerce/skill.md) — Cross-cutting storage and pillar alignment
- [headless-bff-architecture](../../../headless/skills/headless-bff-architecture/skill.md) — BFF boundaries when MD is not accessed from IO

## Reference

- [Creating a Master Data v2 CRUD App](https://developers.vtex.com/docs/guides/create-master-data-crud-app) — Complete guide for building Master Data apps with the masterdata builder
- [Working with JSON Schemas in Master Data v2](https://developers.vtex.com/docs/guides/working-with-json-schemas-in-master-data-v2) — Schema structure, validation, and indexing configuration
- [Schema Lifecycle](https://developers.vtex.com/docs/guides/master-data-schema-lifecycle) — How schemas evolve and impact data entities over time
- [Setting Up Triggers on Master Data v2](https://developers.vtex.com/docs/guides/setting-up-triggers-on-master-data-v2) — Trigger configuration for automated workflows
- [Master Data v2 API Reference](https://developers.vtex.com/docs/api-reference/master-data-api-v2#overview) — Complete API reference for all Master Data v2 endpoints
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — MasterDataClient methods and usage in VTEX IO

---

# Observability & Operational Readiness

## When this skill applies

Use this skill when a VTEX IO service needs better production visibility, troubleshooting behavior, or operational safety.

- Adding metrics to important client calls or flows
- Improving logs for routes, workers, or integrations
- Surfacing failures clearly for operations and support
- Reviewing whether a service is ready for production
- Monitoring rate-limit-sensitive integrations

Do not use this skill for:
- app policy declaration
- trust-boundary modeling
- frontend analytics or browser monitoring
- route contract design by itself

## Decision rules

- Log enough structured context to debug failures, but do not log secrets or sensitive payloads.
- Use `ctx.vtex.logger` with appropriate log levels such as `info`, `warn`, and `error` instead of `console.log`, so logs are properly collected and searchable in the VTEX logging stack.
- Treat `ctx.vtex.logger` as the native platform logging mechanism. If a partner needs to forward logs to its own logging system, prefer doing that through a dedicated integration app or client instead of replacing the VTEX logger pattern inside every service.
- Use client-level metrics on important downstream calls so integration behavior is visible below the handler layer.
- Choose metric names that reflect the integration and operation, such as `partner-get-order` or `partner-sync-catalog`, so counts, latency, and error rates can be tracked over time.
- Make failures observable at the point where they happen. Do not swallow errors silently in routes, events, or workers.
- For rate-limit-sensitive APIs, combine short timeouts, backoff-aware retries, and caching of frequent reads to reduce burst pressure and avoid hitting hard limits.
- Review whether expensive or fragile flows expose enough operational signals before releasing them.

## Hard constraints

### Constraint: Important failures must be visible in logs, metrics, or durable state

Routes, event handlers, and workers MUST not hide important failures from operators.

**Why this matters**

If failures disappear silently, the service becomes impossible to diagnose under real traffic and retries.

**Detection**

If an error is caught and ignored without logging, metric emission, or explicit failure state, STOP and surface the failure.

**Correct**

```typescript
try {
  await ctx.clients.partnerApi.sendOrder(orderId)
} catch (error) {
  ctx.vtex.logger.error({
    message: 'Failed to send order to partner',
    orderId,
    account: ctx.vtex.account,
    routeId: ctx.vtex.route?.id,
  })
  throw error
}
```

**Wrong**

```typescript
try {
  await ctx.clients.partnerApi.sendOrder(orderId)
} catch (_) {
  return
}
```

### Constraint: Metrics should be attached to important integration calls

Client calls that are operationally important SHOULD include `metric` so request behavior can be tracked consistently.

**Why this matters**

Without metrics, integration failures and latency patterns are much harder to isolate from generic route behavior.

**Detection**

If a key downstream integration call has no `metric` and operations depend on it, STOP and add a meaningful metric name.

**Correct**

```typescript
return this.http.get(`/orders/${id}`, {
  metric: 'partner-get-order',
})
```

**Wrong**

```typescript
return this.http.get(`/orders/${id}`)
```

### Constraint: Logs must stay useful without leaking sensitive data

Logs MUST contain enough context to debug production behavior, but MUST NOT include secrets, tokens, or unnecessarily sensitive payloads.

**Why this matters**

Operational logs are only valuable if they are safe to retain and inspect. Sensitive logging creates security risk while still failing to guarantee useful diagnosis.

**Detection**

If a log line includes tokens, auth headers, raw personal payloads, or entire downstream responses, STOP and sanitize the log.

**Correct**

```typescript
ctx.vtex.logger.info({
  message: 'Partner sync started',
  orderId,
  account: ctx.vtex.account,
})
```

**Wrong**

```typescript
ctx.vtex.logger.info({
  message: 'Partner sync started',
  body: ctx.request.body,
  auth: ctx.request.header.authorization,
})
```

## Preferred pattern

Operationally healthy VTEX IO services should:

- emit metrics for important client calls so counts, latency, and error rates are visible
- log failures with enough structured context such as domain IDs, account, and `routeId`
- avoid silent error swallowing
- sanitize sensitive data before logging
- review retries, caching, and throughput with rate-limit behavior in mind

Use observability to shorten diagnosis time, not just to create more logs.

## Common failure modes

- Catching and ignoring errors in async flows.
- Logging too little context to diagnose production incidents.
- Logging too much sensitive data.
- Omitting metrics from important integration calls.
- Treating rate-limit failures as isolated bugs instead of operational signals.

## Review checklist

- [ ] Are important failures visible to operators?
- [ ] Do key integrations emit useful metrics?
- [ ] Are logs structured and safe?
- [ ] Are retries, caching, and rate-limit behavior considered together?
- [ ] Would someone on call be able to diagnose this flow from the available signals?

## Reference

- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) - Client usage patterns relevant to metrics and retries
- [Best practices for avoiding rate-limit errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) - Operational guidance for stable integrations

---

# Frontend React Components & Hooks

## When this skill applies

Use this skill when building VTEX IO frontend apps using the `react` builder — creating React components that integrate with Store Framework as theme blocks, configuring `interfaces.json`, setting up `contentSchemas.json` for Site Editor, and applying styling patterns.

- Creating custom storefront components (product displays, forms, banners)
- Building admin panel interfaces with VTEX Styleguide
- Registering components as Store Framework blocks
- Exposing component props in Site Editor via `contentSchemas.json`
- Applying `css-handles` for safe storefront styling

Do not use this skill for:
- Backend service implementation (use `vtex-io-service-apps` instead)
- GraphQL schema and resolver development (use `vtex-io-graphql-api` instead)
- Manifest and builder configuration (use `vtex-io-app-structure` instead)

## Decision rules

- Every visible storefront element is a **block**. Blocks are declared in theme JSON and map to React components via **interfaces**.
- `interfaces.json` (in `/store`) maps block names to React component files: `"component"` is the file name in `/react` (without extension), `"allowed"` lists child blocks, `"composition"` controls how children work (`"children"` or `"blocks"`).
- Each exported component MUST have a root-level file in `/react` that re-exports it. The builder resolves `"component": "ProductReviews"` to `react/ProductReviews.tsx`.
- For **storefront** components, use `vtex.css-handles` for styling (not inline styles, not global CSS).
- For **admin** components, use `vtex.styleguide` — the official VTEX Admin component library. No third-party UI libraries.
- Use `contentSchemas.json` in `/store` to make component props editable in Site Editor (JSON Schema format).
- Use `react-intl` and the `messages` builder for i18n — never hardcode user-facing strings.
- Fetch data via GraphQL queries (`useQuery` from `react-apollo`), never via direct API calls from the browser.

Architecture:

```text
Store Theme (JSON blocks)
  └── declares "product-reviews" block with props
        │
        ▼
interfaces.json → maps "product-reviews" to "ProductReviews" component
        │
        ▼
react/ProductReviews.tsx → React component renders
        │
        ├── useCssHandles() → CSS classes for styling
        ├── useQuery() → GraphQL data fetching
        └── useProduct() / useOrderForm() → Store Framework context hooks
```

## Hard constraints

### Constraint: Declare Interfaces for All Storefront Blocks

Every React component that should be usable as a Store Framework block MUST have a corresponding entry in `store/interfaces.json`. Without the interface declaration, the block cannot be referenced in theme JSON files.

**Why this matters**

The store builder resolves block names to React components through `interfaces.json`. If a component has no interface, it is invisible to Store Framework and will not render on the storefront.

**Detection**

If a React component in `/react` is intended for storefront use but has no matching entry in `store/interfaces.json`, warn the developer. The component will compile but never render.

**Correct**

```json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-item"]
  },
  "product-review-item": {
    "component": "ReviewItem"
  }
}
```

```tsx
// react/ProductReviews.tsx
import ProductReviews from './components/ProductReviews'

export default ProductReviews
```

**Wrong**

```tsx
// react/ProductReviews.tsx exists but NO store/interfaces.json entry
// The component compiles fine but cannot be used in any theme.
// Adding <product-reviews /> in a theme JSON will produce:
// "Block 'product-reviews' not found"
import ProductReviews from './components/ProductReviews'

export default ProductReviews
```

---

### Constraint: Use VTEX Styleguide for Admin UIs

Admin panel components (apps using the `admin` builder) MUST use VTEX Styleguide (`vtex.styleguide`) for UI elements. You MUST NOT use third-party UI libraries like Material UI, Chakra UI, or Ant Design in admin apps.

**Why this matters**

VTEX Admin has a consistent design language enforced by Styleguide. Third-party UI libraries produce inconsistent visuals, may conflict with the Admin's global CSS, and add unnecessary bundle size. Apps submitted to the VTEX App Store with non-Styleguide admin UIs will fail review.

**Detection**

If you see imports from `@material-ui`, `@chakra-ui/react`, `@chakra-ui`, `antd`, or `@ant-design` in an admin app, warn the developer to use `vtex.styleguide` instead.

**Correct**

```tsx
// react/admin/ReviewModeration.tsx
import React, { useState } from 'react'
import {
  Layout,
  PageHeader,
  Table,
  Button,
  Tag,
  Modal,
  Input,
} from 'vtex.styleguide'

interface Review {
  id: string
  author: string
  rating: number
  text: string
  status: 'pending' | 'approved' | 'rejected'
}

function ReviewModeration() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const tableSchema = {
    properties: {
      author: { title: 'Author', width: 200 },
      rating: { title: 'Rating', width: 100 },
      text: { title: 'Review Text' },
      status: {
        title: 'Status',
        width: 150,
        cellRenderer: ({ cellData }: { cellData: string }) => (
          <Tag type={cellData === 'approved' ? 'success' : 'error'}>
            {cellData}
          </Tag>
        ),
      },
    },
  }

  return (
    <Layout fullWidth pageHeader={<PageHeader title="Review Moderation" />}>
      <Table
        items={reviews}
        schema={tableSchema}
        density="medium"
      />
    </Layout>
  )
}

export default ReviewModeration
```

**Wrong**

```tsx
// react/admin/ReviewModeration.tsx
import React from 'react'
import { DataGrid } from '@material-ui/data-grid'
import { Button } from '@material-ui/core'

// Material UI components will look inconsistent in the VTEX Admin,
// conflict with global styles, and inflate bundle size.
// This app will fail VTEX App Store review.
function ReviewModeration() {
  return (
    <div>
      <DataGrid rows={[]} columns={[]} />
      <Button variant="contained" color="primary">Approve</Button>
    </div>
  )
}
```

---

### Constraint: Export Components from react/ Root Level

Every Store Framework block component MUST have a root-level export file in the `/react` directory that matches the `component` value in `interfaces.json`. The actual implementation can live in subdirectories, but the root file must exist.

**Why this matters**

The react builder resolves components by looking for files at the root of `/react`. If `interfaces.json` declares `"component": "ProductReviews"`, the builder looks for `react/ProductReviews.tsx`. Without this root export file, the component will not be found and the block will fail to render.

**Detection**

If `interfaces.json` references a component name that does not have a matching file at the root of `/react`, STOP and create the export file.

**Correct**

```tsx
// react/ProductReviews.tsx — root-level export file
import ProductReviews from './components/ProductReviews/index'

export default ProductReviews
```

```tsx
// react/components/ProductReviews/index.tsx — actual implementation
import React from 'react'
import { useCssHandles } from 'vtex.css-handles'

const CSS_HANDLES = ['container', 'title', 'list'] as const

interface Props {
  title: string
  maxReviews: number
}

function ProductReviews({ title, maxReviews }: Props) {
  const handles = useCssHandles(CSS_HANDLES)
  return (
    <div className={handles.container}>
      <h2 className={handles.title}>{title}</h2>
      {/* ... */}
    </div>
  )
}

export default ProductReviews
```

**Wrong**

```text
react/components/ProductReviews/index.tsx exists but
react/ProductReviews.tsx does NOT exist.
The builder cannot find the component.
Error: "Could not find component ProductReviews"
```

## Preferred pattern

Create the React component inside a subdirectory:

```tsx
// react/components/ProductReviews/index.tsx
import React, { useMemo } from 'react'
import { useQuery } from 'react-apollo'
import { useProduct } from 'vtex.product-context'
import { useCssHandles } from 'vtex.css-handles'

import GET_REVIEWS from '../../graphql/getReviews.graphql'
import ReviewItem from './ReviewItem'

const CSS_HANDLES = [
  'reviewsContainer',
  'reviewsTitle',
  'reviewsList',
  'averageRating',
  'emptyState',
] as const

interface Props {
  title?: string
  showAverage?: boolean
  maxReviews?: number
}

function ProductReviews({
  title = 'Customer Reviews',
  showAverage = true,
  maxReviews = 10,
}: Props) {
  const handles = useCssHandles(CSS_HANDLES)
  const productContext = useProduct()
  const productId = productContext?.product?.productId

  const { data, loading, error } = useQuery(GET_REVIEWS, {
    variables: { productId, limit: maxReviews },
    skip: !productId,
  })

  const averageRating = useMemo(() => {
    if (!data?.reviews?.length) return 0

    const sum = data.reviews.reduce(
      (acc: number, review: { rating: number }) => acc + review.rating,
      0
    )

    return (sum / data.reviews.length).toFixed(1)
  }, [data])

  if (loading) return <div className={handles.reviewsContainer}>Loading...</div>
  if (error) return null

  return (
    <div className={handles.reviewsContainer}>
      <h2 className={handles.reviewsTitle}>{title}</h2>

      {showAverage && data?.reviews?.length > 0 && (
        <div className={handles.averageRating}>
          Average: {averageRating} / 5
        </div>
      )}

      {data?.reviews?.length === 0 ? (
        <p className={handles.emptyState}>No reviews yet.</p>
      ) : (
        <ul className={handles.reviewsList}>
          {data.reviews.map((review: { id: string; author: string; rating: number; text: string }) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default ProductReviews
```

Root export file:

```tsx
// react/ProductReviews.tsx
import ProductReviews from './components/ProductReviews'

export default ProductReviews
```

Block interface:

```json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-form"],
    "render": "client"
  }
}
```

Site Editor schema:

```json
{
  "definitions": {
    "ProductReviews": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "title": "Section Title",
          "description": "Title displayed above the reviews list",
          "default": "Customer Reviews"
        },
        "showAverage": {
          "type": "boolean",
          "title": "Show average rating",
          "default": true
        },
        "maxReviews": {
          "type": "number",
          "title": "Maximum reviews",
          "default": 10,
          "enum": [5, 10, 20, 50]
        }
      }
    }
  }
}
```

Using the component in a Store Framework theme:

```json
{
  "store.product": {
    "children": [
      "product-images",
      "product-name",
      "product-price",
      "buy-button",
      "product-reviews"
    ]
  },
  "product-reviews": {
    "props": {
      "title": "What Our Customers Say",
      "showAverage": true,
      "maxReviews": 20
    }
  }
}
```

## Common failure modes

- **Importing third-party UI libraries for admin apps**: Using `@material-ui/core`, `@chakra-ui/react`, or `antd` conflicts with VTEX Admin's global CSS, produces inconsistent visuals, and will fail App Store review. Use `vtex.styleguide` instead.
- **Directly calling APIs from React components**: Using `fetch()` or `axios` exposes authentication tokens to the client and bypasses CORS restrictions. Use GraphQL queries that resolve server-side via `useQuery` from `react-apollo`.
- **Hardcoded strings without i18n**: Components with hardcoded strings only work in one language. Use the `messages` builder and `react-intl` for internationalization.
- **Missing root-level export file**: If `interfaces.json` references `"component": "ProductReviews"` but `react/ProductReviews.tsx` doesn't exist, the block silently fails to render.

## Review checklist

- [ ] Does every storefront block have a matching entry in `store/interfaces.json`?
- [ ] Does every `interfaces.json` component have a root-level export file in `/react`?
- [ ] Are admin apps using `vtex.styleguide` (no third-party UI libraries)?
- [ ] Are storefront components using `css-handles` for styling?
- [ ] Is data fetched via GraphQL (`useQuery`), not direct API calls?
- [ ] Are user-facing strings using `react-intl` and the `messages` builder?
- [ ] Is `contentSchemas.json` defined for Site Editor-editable props?

## Reference

- [Developing Custom Storefront Components](https://developers.vtex.com/docs/guides/vtex-io-documentation-developing-custom-storefront-components) — Guide for building Store Framework components
- [Interfaces](https://developers.vtex.com/docs/guides/vtex-io-documentation-interface) — How interfaces map blocks to React components
- [React Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-react-builder) — React builder configuration and directory structure
- [Making a Custom Component Available in Site Editor](https://developers.vtex.com/docs/guides/vtex-io-documentation-making-a-custom-component-available-in-site-editor) — contentSchemas.json and Site Editor integration
- [Store Framework](https://developers.vtex.com/docs/guides/store-framework) — Overview of the block-based storefront system
- [Using Components](https://developers.vtex.com/docs/guides/store-framework-using-components) — How to use native and custom components in themes
- [VTEX Styleguide](https://styleguide.vtex.com/) — Official component library for VTEX Admin UIs

---

# Security Boundaries & Exposure Review

## When this skill applies

Use this skill when the main question is whether a VTEX IO route, integration, or service boundary is safe.

- Reviewing public versus private route exposure
- Validating external input at service boundaries
- Handling tokens, account context, or sensitive payloads
- Avoiding cross-account, cross-workspace, or cross-user leakage
- Hardening integrations that expose or consume sensitive data

Do not use this skill for:
- policy declaration syntax in `manifest.json`
- service runtime sizing
- logging and observability strategy
- frontend browser security concerns
- deciding which VTEX auth token should call an endpoint

## Decision rules

- Use this skill to decide what data and input may safely cross the app boundary, not which policies or tokens authorize the call.
- Treat every public route as an explicit trust boundary.
- In `service.json`, changing a route from `public: false` to `public: true` is a boundary change and should trigger explicit security review.
- Use `public: true` for routes that must be callable from outside VTEX IO, such as partner webhooks or externally consumed integration endpoints. Treat them as internet-exposed boundaries.
- Use `public: false` for routes that are meant only for VTEX internal flows or other IO apps, but do not treat them as implicitly safe. They still require validation and scoped assumptions.
- A route with `public: true` in `service.json` is reachable from outside the app as long as the account domain is accessible. Do not rely on obscure paths or internal-looking URLs as a security measure.
- Validate external input as early as possible, before it reaches domain logic or downstream integrations.
- For webhook-style routes, validate both structure and authenticity, for example through required fields plus a shared secret or signature header, before calling downstream clients.
- Do not assume a request is safe because it originated from another VTEX service or internal-looking route path.
- Keep account, workspace, and user context explicit when a service reads or writes scoped data.
- When data or behavior must be restricted to a specific workspace, check `ctx.vtex.workspace` explicitly and reject calls from other workspaces.
- Never expose more data than the caller needs. Shape responses intentionally instead of returning raw downstream payloads.
- Keep secrets, tokens, and security-sensitive headers out of logs and route responses.
- Do not use `console.log` or `console.error` in production routes or services. Use `ctx.vtex.logger` for application logging with structured objects, and only use a dedicated external logging client when the app intentionally forwards logs to a partner-owned system.
- Avoid exposing debug or diagnostic routes that return internal configuration, secrets, or full downstream payloads. If such routes are strictly necessary, keep them non-public and limited to minimal, non-sensitive information.
- Use this skill to decide what may cross the boundary, and use `vtex-io-auth-and-policies` to decide how that boundary is authorized and protected.

## Related skills

- [`vtex-io-auth-and-policies`](../vtex-io-auth-and-policies/skill.md) - Use when the main decision is how route or resource access will be authorized
- [`vtex-io-auth-tokens-and-context`](../vtex-io-auth-tokens-and-context/skill.md) - Use when the main decision is which runtime identity should call VTEX endpoints

## Hard constraints

### Constraint: Public routes must validate untrusted input at the boundary

Any route exposed beyond a tightly controlled internal boundary MUST validate incoming data before calling domain logic or downstream clients.

**Why this matters**

Unvalidated input at public boundaries creates the fastest path to abuse, bad writes, and accidental downstream failures.

**Detection**

If a public route forwards body fields, params, or headers directly into business logic or client calls without validation, STOP and add validation first.

**Correct**

```typescript
export async function webhook(ctx: Context) {
  const body = ctx.request.body

  if (!body?.eventId || !body?.type) {
    ctx.status = 400
    ctx.body = { message: 'Invalid payload' }
    return
  }

  await ctx.clients.partnerApi.handleWebhook(body)
  ctx.status = 202
}
```

**Wrong**

```typescript
export async function webhook(ctx: Context) {
  await ctx.clients.partnerApi.handleWebhook(ctx.request.body)
  ctx.status = 202
}
```

### Constraint: Sensitive data must not cross route boundaries by accident

Routes and integrations MUST not leak tokens, internal headers, raw downstream payloads, or data that belongs to another account, workspace, or user context.

**Why this matters**

Boundary leaks are hard to detect once deployed and can expose information far beyond the intended caller scope.

**Detection**

If a route returns raw downstream responses, logs secrets, or mixes contexts without explicit filtering, STOP and narrow the output before proceeding.

**Correct**

```typescript
ctx.body = {
  orderId: order.id,
  status: order.status,
}
```

**Wrong**

```typescript
ctx.body = order
```

### Constraint: Trust boundaries must stay explicit when services call each other

When one service calls another, the receiving boundary MUST still be treated as a real security boundary with explicit validation and scoped assumptions.

**Why this matters**

Internal service-to-service traffic can still carry malformed or overbroad data. Assuming “internal means trusted” leads to fragile security posture and cross-context leakage.

**Detection**

If a service accepts data from another service without validating format, scope, or account/workspace context, STOP and make those checks explicit.

**Correct**

```typescript
if (ctx.vtex.account !== expectedAccount) {
  ctx.status = 403
  return
}
```

**Wrong**

```typescript
await processPartnerPayload(ctx.request.body)
```

## Preferred pattern

Security review should start at the boundary:

1. Who can call this route or trigger this integration?
2. What data enters the system?
3. What must be validated immediately?
4. What data leaves the system?
5. Could account, workspace, or user context leak across the boundary?

Use minimal request and response shapes, explicit validation, and scoped context checks to keep boundaries safe.

## Common failure modes

- Treating public routes like trusted internal handlers.
- Returning raw downstream payloads that expose more data than necessary.
- Logging secrets or security-sensitive headers.
- Using `console.log` in handlers instead of `ctx.vtex.logger`, making logs less structured and increasing the risk of leaking sensitive data.
- Mixing account or workspace context without explicit checks.
- Assuming service-to-service traffic is inherently safe.

## Review checklist

- [ ] Is the trust boundary clear?
- [ ] Are external inputs validated before reaching domain or integration logic?
- [ ] Is the response shape intentionally minimal?
- [ ] Are sensitive values kept out of logs and responses?
- [ ] Could account, workspace, or user context leak across this boundary?

## Reference

- [Service](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) - Route exposure and service behavior
- [Policies](https://developers.vtex.com/docs/guides/vtex-io-documentation-policies) - Authorization-related declaration context

---

# Backend Service Apps & API Clients

## When this skill applies

Use this skill when developing a VTEX IO app that needs backend logic — REST API routes, GraphQL resolvers, event handlers, scheduled tasks, or integrations with VTEX Commerce APIs and external services.

- Building the Service entry point (`node/index.ts`) with typed context, clients, and state
- Creating and registering custom clients extending JanusClient or ExternalClient
- Using `ctx.clients` to access clients with built-in caching, retry, and metrics
- Configuring routes and middleware chains in service.json

Do not use this skill for:
- Manifest and builder configuration (use `vtex-io-app-structure` instead)
- GraphQL schema definitions (use `vtex-io-graphql-api` instead)
- React component development (use `vtex-io-react-apps` instead)

## Decision rules

- The Service class (`node/index.ts`) is the entry point for every VTEX IO backend app. It receives clients, routes (with middleware chains), GraphQL resolvers, and event handlers.
- Every middleware, resolver, and event handler receives `ctx` with: `ctx.clients` (registered clients), `ctx.state` (mutable per-request state), `ctx.vtex` (auth tokens, account info), `ctx.body` (request/response body).
- Use `JanusClient` for VTEX internal APIs (base URL: `https://{account}.vtexcommercestable.com.br`).
- Use `ExternalClient` for non-VTEX APIs (any URL you specify).
- Use `AppClient` for routes exposed by other VTEX IO apps.
- Use `MasterDataClient` for Master Data v2 CRUD operations.
- Register custom clients by extending `IOClients` — each client is lazily instantiated on first access via `this.getOrSet()`.
- Keep clients as thin data-access wrappers. Put business logic in middlewares or service functions.

Client hierarchy:

| Class | Use Case | Base URL |
|-------|----------|----------|
| `JanusClient` | Access VTEX internal APIs (Janus gateway) | `https://{account}.vtexcommercestable.com.br` |
| `ExternalClient` | Access external (non-VTEX) APIs | Any URL you specify |
| `AppClient` | Access routes exposed by other VTEX IO apps | `https://{workspace}--{account}.myvtex.com` |
| `InfraClient` | Access VTEX IO infrastructure services | Internal |
| `MasterDataClient` | Access Master Data v2 CRUD operations | VTEX API |

Architecture:

```text
Request → VTEX IO Runtime → Service
  ├── routes → middleware chain → ctx.clients.{name}.method()
  ├── graphql → resolvers → ctx.clients.{name}.method()
  └── events → handlers → ctx.clients.{name}.method()
                               │
                               ▼
                         Client (JanusClient / ExternalClient)
                               │
                               ▼
                    External Service / VTEX API
```

## Hard constraints

### Constraint: Use @vtex/api Clients — Never Raw HTTP Libraries

All HTTP communication from a VTEX IO service app MUST go through `@vtex/api` clients (JanusClient, ExternalClient, AppClient, or native clients from `@vtex/clients`). You MUST NOT use `axios`, `fetch`, `got`, `node-fetch`, or any other raw HTTP library.

**Why this matters**

VTEX IO clients provide automatic authentication header injection, built-in caching (disk and memory), retry with exponential backoff, timeout management, native metrics and billing tracking, and proper error handling. Raw HTTP libraries bypass all of these. Additionally, outbound traffic from VTEX IO is firewalled — only `@vtex/api` clients properly route through the infrastructure.

**Detection**

If you see `import axios from 'axios'`, `import fetch from 'node-fetch'`, `import got from 'got'`, `require('node-fetch')`, or any direct `fetch()` call in a VTEX IO service app, STOP. Replace with a proper client extending JanusClient or ExternalClient.

**Correct**

```typescript
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class WeatherClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://api.weather.com', context, {
      ...options,
      headers: {
        'X-Api-Key': 'my-key',
        ...options?.headers,
      },
    })
  }

  public async getForecast(city: string): Promise<Forecast> {
    return this.http.get(`/v1/forecast/${city}`, {
      metric: 'weather-forecast',
    })
  }
}
```

**Wrong**

```typescript
import axios from 'axios'

// This bypasses VTEX IO infrastructure entirely.
// No caching, no retries, no metrics, no auth token injection.
// Outbound requests may be blocked by the firewall.
export async function getForecast(city: string): Promise<Forecast> {
  const response = await axios.get(`https://api.weather.com/v1/forecast/${city}`, {
    headers: { 'X-Api-Key': 'my-key' },
  })
  return response.data
}
```

---

### Constraint: Access Clients via ctx.clients — Never Instantiate Directly

Clients MUST always be accessed through `ctx.clients.{clientName}` in middlewares, resolvers, and event handlers. You MUST NOT instantiate client classes directly with `new`.

**Why this matters**

The IOClients registry manages client lifecycle, ensuring proper initialization with the current request's IOContext (account, workspace, auth tokens). Direct instantiation creates clients without authentication context, without caching configuration, and without connection to the metrics pipeline.

**Detection**

If you see `new MyClient(...)` or `new ExternalClient(...)` inside a middleware or resolver, STOP. The client should be registered in the Clients class and accessed via `ctx.clients`.

**Correct**

```typescript
// node/clients/index.ts
import { IOClients } from '@vtex/api'
import { CatalogClient } from './catalogClient'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', CatalogClient)
  }
}

// node/middlewares/getProduct.ts
export async function getProduct(ctx: Context, next: () => Promise<void>) {
  const { clients: { catalog } } = ctx
  const product = await catalog.getProductById(ctx.query.id)
  ctx.body = product
  ctx.status = 200
  await next()
}
```

**Wrong**

```typescript
// node/middlewares/getProduct.ts
import { CatalogClient } from '../clients/catalogClient'

export async function getProduct(ctx: Context, next: () => Promise<void>) {
  // Direct instantiation — no auth context, no caching, no metrics
  const catalog = new CatalogClient(ctx.vtex, {})
  const product = await catalog.getProductById(ctx.query.id)
  ctx.body = product
  ctx.status = 200
  await next()
}
```

---

### Constraint: Avoid Monolithic Service Apps

A single service app SHOULD NOT define more than 10 HTTP routes. If you need more, consider splitting into focused microservice apps.

**Why this matters**

VTEX IO apps run in containers with limited memory (max 512MB). A monolithic app with many routes increases memory usage, cold start time, and blast radius of failures. The VTEX IO platform is designed for small, focused apps that compose together.

**Detection**

If `service.json` defines more than 10 routes, warn the developer to consider splitting the app into smaller services. This is a soft limit — there may be valid exceptions.

**Correct**

```json
{
  "memory": 256,
  "timeout": 30,
  "routes": {
    "get-reviews": { "path": "/_v/api/reviews", "public": false },
    "get-review": { "path": "/_v/api/reviews/:id", "public": false },
    "create-review": { "path": "/_v/api/reviews", "public": false },
    "moderate-review": { "path": "/_v/api/reviews/:id/moderate", "public": false }
  }
}
```

**Wrong**

```json
{
  "memory": 512,
  "timeout": 60,
  "routes": {
    "route1": { "path": "/_v/api/reviews" },
    "route2": { "path": "/_v/api/reviews/:id" },
    "route3": { "path": "/_v/api/products" },
    "route4": { "path": "/_v/api/products/:id" },
    "route5": { "path": "/_v/api/orders" },
    "route6": { "path": "/_v/api/orders/:id" },
    "route7": { "path": "/_v/api/users" },
    "route8": { "path": "/_v/api/users/:id" },
    "route9": { "path": "/_v/api/categories" },
    "route10": { "path": "/_v/api/categories/:id" },
    "route11": { "path": "/_v/api/brands" },
    "route12": { "path": "/_v/api/inventory" }
  }
}
```

12 routes covering reviews, products, orders, users, categories, brands, and inventory — this should be 3-4 separate apps.

## Preferred pattern

Define custom clients:

```typescript
// node/clients/catalogClient.ts
import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export class CatalogClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, {
      ...options,
      headers: {
        VtexIdclientAutCookie: context.authToken,
        ...options?.headers,
      },
    })
  }

  public async getProduct(productId: string): Promise<Product> {
    return this.http.get(`/api/catalog/pvt/product/${productId}`, {
      metric: 'catalog-get-product',
    })
  }

  public async listSkusByProduct(productId: string): Promise<Sku[]> {
    return this.http.get(`/api/catalog_system/pvt/sku/stockkeepingunitByProductId/${productId}`, {
      metric: 'catalog-list-skus',
    })
  }
}
```

Register clients in IOClients:

```typescript
// node/clients/index.ts
import { IOClients } from '@vtex/api'
import { CatalogClient } from './catalogClient'
import { ReviewStorageClient } from './reviewStorageClient'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', CatalogClient)
  }

  public get reviewStorage() {
    return this.getOrSet('reviewStorage', ReviewStorageClient)
  }
}
```

Create middlewares using `ctx.clients` and `ctx.state`:

```typescript
// node/middlewares/getReviews.ts
import type { ServiceContext } from '@vtex/api'
import type { Clients } from '../clients'

type Context = ServiceContext<Clients>

export async function validateParams(ctx: Context, next: () => Promise<void>) {
  const { productId } = ctx.query

  if (!productId || typeof productId !== 'string') {
    ctx.status = 400
    ctx.body = { error: 'productId query parameter is required' }
    return
  }

  ctx.state.productId = productId
  await next()
}

export async function getReviews(ctx: Context, next: () => Promise<void>) {
  const { productId } = ctx.state
  const reviews = await ctx.clients.reviewStorage.getByProduct(productId)

  ctx.status = 200
  ctx.body = reviews
  await next()
}
```

Wire everything in the Service entry point:

```typescript
// node/index.ts
import type { ParamsContext, RecorderState } from '@vtex/api'
import { Service, method } from '@vtex/api'

import { Clients } from './clients'
import { validateParams, getReviews } from './middlewares/getReviews'
import { createReview } from './middlewares/createReview'
import { resolvers } from './resolvers'

export default new Service<Clients, RecorderState, ParamsContext>({
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 5000,
      },
      catalog: {
        retries: 3,
        timeout: 10000,
      },
    },
  },
  routes: {
    reviews: method({
      GET: [validateParams, getReviews],
      POST: [createReview],
    }),
  },
  graphql: {
    resolvers: {
      Query: resolvers.queries,
      Mutation: resolvers.mutations,
    },
  },
})
```

## Common failure modes

- **Using axios/fetch/got/node-fetch for HTTP calls**: These libraries bypass the entire VTEX IO infrastructure — no automatic auth token injection, no caching, no retry logic, no metrics. Outbound requests may also be blocked by the firewall. Create a proper client extending `ExternalClient` or `JanusClient` instead.
- **Putting business logic in clients**: Clients become bloated and hard to test. Keep clients as thin wrappers around HTTP calls. Put business logic in middlewares or dedicated service functions.
- **Direct client instantiation**: Using `new MyClient(...)` inside a middleware creates clients without auth context, caching, or metrics. Always access via `ctx.clients`.

## Review checklist

- [ ] Are all HTTP calls going through `@vtex/api` clients (no axios, fetch, got)?
- [ ] Are all clients accessed via `ctx.clients`, never instantiated with `new`?
- [ ] Are custom clients registered in the IOClients class?
- [ ] Does the Service entry point correctly wire clients, routes, resolvers, and events?
- [ ] Is business logic in middlewares/resolvers, not in client classes?
- [ ] Does `service.json` have reasonable route count (≤10)?
- [ ] Are client options (retries, timeout) configured appropriately?

## Reference

- [Services](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) — Overview of VTEX IO backend service development
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — Native client list and client architecture overview
- [Developing Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-how-to-create-and-use-clients) — Step-by-step guide for creating custom JanusClient and ExternalClient
- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) — How to use @vtex/api and @vtex/clients in middlewares and resolvers
- [Calling Commerce APIs](https://developers.vtex.com/docs/guides/calling-commerce-apis-1-getting-the-service-app-boilerplate) — Tutorial for building a service app that calls VTEX Commerce APIs
- [Best Practices for Avoiding Rate Limits](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Why clients with caching prevent rate-limit issues

---

# VTEX IO service paths and CDN behavior

## When this skill applies

Use this skill when you define or change **`service.json` routes** for a VTEX IO backend and need the edge (CDN) to pass the **right cookies** and apply the **right caching** for that endpoint’s data.

- Choosing between **public**, **segment** (`/_v/segment/...`), and **private** (`/_v/private/...`) path prefixes for a route
- Setting **`Cache-Control`** (and related headers) on HTTP responses so **public** cache behavior matches **data scope** (anonymous vs segment vs authenticated shopper)
- Explaining why a route **does not** receive `vtex_session` or `vtex_segment` cookies
- Troubleshooting **CloudFront** or edge behavior when cookies are missing (see official troubleshooting)

Do not use this skill for:

- Application-level LRU caches, VBase, or stale-while-revalidate orchestration → use **vtex-io-application-performance**
- GraphQL field-level `@cacheControl` only → use **vtex-io-graphql-api** alongside this skill

## Decision rules

- Paths are declared in **`service.json`** under `routes`. The **prefix** you choose (`/yourPath`, `/_v/segment/yourPath`, `/_v/private/yourPath`) controls **cookie forwarding** and **whether VTEX may cache the service response at the edge**—see the [Service path patterns](https://developers.vtex.com/docs/guides/service-path-patterns) table.
- **Public** (`{yourPath}`): **No guarantee** the app receives request cookies. The edge **may cache** responses when possible. Use for **non-user-specific** data (e.g. static reference data that is safe to share across shoppers).
- **Segment** (`/_v/segment/{yourPath}`): The app receives **`vtex_segment`**. The edge caches **per segment**. Use when the response depends on **segment** (currency, region, sales channel, etc.) but **not** on authenticated identity.
- **Private** (`/_v/private/{yourPath}`): The app receives **`vtex_segment`** and **`vtex_session`**. The edge **does not cache** the service response. Use for **identity- or session-scoped** data (orders, addresses, profile).
- **`Cache-Control` on responses** must align with **classification**: never signal **CDN/shared cache** for payloads that embed **secrets**, **per-user** data, or **authorization** decisions unless the contract is explicitly designed for that (e.g. immutable public assets). When in doubt, prefer **private paths** and **no-store / private** cache directives for shopper-specific JSON.
- Read [Sessions System overview](https://developers.vtex.com/docs/guides/sessions-system-overview) for how cookies relate to paths and sessions.

## Hard constraints

### Constraint: Do not use a public or segment-cached path for private or auth-scoped payloads

Routes that return **authenticated shopper data**, **PII**, or **authorization-sensitive** JSON **must not** rely on **public** paths or **edge-cached** responses that could serve one user’s data to another.

**Why this matters** — The edge may cache or route without the session context you expect; misclassified data can leak across users or segments.

**Detection** — A route under a **public** path returns **order history**, **addresses**, **tokens**, or **account-specific** fields; or **`Cache-Control`** suggests long-lived public caching for such payloads.

**Correct** — Use `/_v/private/...` for the route (or a pattern that receives `vtex_session`), and set **appropriate** `Cache-Control` (e.g. `private, no-store` for JSON APIs that are not cacheable). Note: the **path prefix** (`/_v/private/`) controls **CDN and cookie** behavior; the `"public": true` field controls **whether VTEX auth tokens are required** to call the route—these are **orthogonal**.

```json
{
  "routes": {
    "myOrders": {
      "path": "/_v/private/my-app/orders",
      "public": true
    }
  }
}
```

**Wrong** — Exposing `GET /my-app/orders` as a **public** path (no `/_v/private/` or `/_v/segment/` prefix) and returning **per-user** JSON while **assuming** the browser session is always visible to the service.

## Preferred pattern

1. **Classify the response** (anonymous, segment, authenticated) **before** picking the path prefix.
2. **Map** to **public** / **segment** / **private** per [Service path patterns](https://developers.vtex.com/docs/guides/service-path-patterns).
3. **Set** response headers **explicitly** where the platform allows: align **`Cache-Control`** with the same classification (public immutable vs private vs no-store).
4. **Document** any path that must stay **private** for security or compliance so storefronts and BFFs do not link-cache it incorrectly.

## Common failure modes

- **Assuming cookies on public routes** — Services do not reliably receive `vtex_session` on public paths; identity logic fails intermittently.
- **Caching personalized JSON at the edge** — Long `max-age` on user-specific responses without `private` path + correct cache policy.
- **Mixing concerns** — One route returns both **public catalog** and **private account** data; split endpoints or use **private** + server-side auth checks.
- **Ignoring segment** — Price or promo that varies by **currency** or **segment** is served on a **public** path and **cached** for the wrong segment.

## Review checklist

- [ ] Is each route’s **path prefix** (`public` / `/_v/segment` / `/_v/private`) justified by **cookie** and **Caching behavior** in the official table?
- [ ] For **shopper-specific** or **auth** responses, is the route **private** (or otherwise protected) and **not** edge-cacheable inappropriately?
- [ ] Do **`Cache-Control`** (and related) headers **match** data sensitivity?
- [ ] Are **parallel** calls from the client using the **correct** path for each payload type?

## Related skills

- [vtex-io-application-performance](../vtex-io-application-performance/skill.md) — Application performance (LRU, VBase, AppSettings, parallel fetches, tenant keys)
- [vtex-io-service-apps](../vtex-io-service-apps/skill.md) — `service.json` and Service entry
- [vtex-io-graphql-api](../vtex-io-graphql-api/skill.md) — GraphQL cache and `@cacheControl`
- [headless-caching-strategy](../../../headless/skills/headless-caching-strategy/skill.md) — Storefront / BFF caching

## Reference

- [Service path patterns](https://developers.vtex.com/docs/guides/service-path-patterns) — Path formats, cookies, caching, use cases
- [Sessions System overview](https://developers.vtex.com/docs/guides/sessions-system-overview) — `vtex_segment`, `vtex_session`, session behavior
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub
- [VTEX IO Engineering guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices

---

# Service Runtime & Execution Model

## When this skill applies

Use this skill when the main decision is how a VTEX IO backend app runs inside the `node` builder: how the `Service` entrypoint is structured, how runtime configuration is declared, and how routes, events, or GraphQL handlers are registered into the service.

- Creating a new backend app under `node/`
- Structuring `node/index.ts` as the service entrypoint
- Defining typed `Context`, `State`, and params contracts for handlers
- Configuring `service.json` for timeout, memory, workers, and replicas
- Troubleshooting runtime issues caused by service registration or execution model mismatches
- Registering GraphQL handlers at the runtime level, while keeping schema and resolver design in a separate skill

Do not use this skill for:
- deciding the app contract in `manifest.json`
- designing custom clients or integration transport layers
- detailed HTTP route handler behavior
- event-specific business workflows
- GraphQL schema or resolver modeling beyond runtime registration

## Decision rules

- Treat `node/index.ts` as the runtime composition root of the backend app.
- Use the `Service` definition to register runtime surfaces such as routes, events, and GraphQL handlers, not to hold business logic directly.
- Keep runtime wiring explicit: context typing, client typing, route registration, and event registration should be visible at the service boundary.
- Put execution knobs such as timeout, ttl, memory, workers, and replica limits in `service.json`, not inside handler code.
- Use `service.json` to declare the runtime parameters the platform uses to execute the service, especially `memory`, `timeout`, `ttl`, `minReplicas`, `maxReplicas`, `workers`, `routes`, `events`, and `rateLimitPerReplica`.
- Use `routes` in `service.json` to expose HTTP entrypoints. Routes are private by default, so set `public: true` explicitly for routes that must be externally reachable.
- Use `smartcache: true` only on idempotent, cacheable routes where the same response can be safely reused across repeated requests. Avoid it on personalized, authenticated, or write-oriented endpoints.
- Use `events` in `service.json` to declare which event sources and handlers are part of the service runtime. Keep event registration in the runtime layer and event-specific business rules in dedicated event modules.
- Use `rateLimitPerReplica` to shape throughput per replica for requests and events. Set a global baseline only when the service needs it, then add small explicit overrides only for expensive routes or noisy event sources.
- Do not use `rateLimitPerReplica` as a substitute for redesigning expensive routes, queueing work, or moving slow operations to async processing.
- Keep handlers focused on request or event behavior; keep runtime structure focused on bootstrapping and registration.
- Model `Context`, `State`, and params types deliberately so middlewares and handlers share a stable contract. Apply the same typed `Context` and `State` to middlewares so they can safely manipulate `ctx.state`, `ctx.vtex`, and params without falling back to `any`.
- If a backend app starts mixing runtime wiring, client implementation, and business rules in the same file, split those concerns before expanding the service further.
- Although some authorization fields such as `routes.access` or `routes.policies` may live in `service.json`, they are primarily authorization concerns and belong in auth or security-focused skills rather than this runtime skill.

Runtime sizing heuristics:

- These ranges are intended for partner and account-level apps. Native VTEX core services may legitimately use much higher values such as thousands of MB of memory or hundreds of replicas, but those values should not be used as defaults for custom apps.

Suggested defaults:

- Start synchronous HTTP services with `timeout` between 10 and 30 seconds. For UX-facing routes, prefer 5 to 15 seconds.
- Start `memory` at 256 MB.
- Start `workers` at 1.
- Use `minReplicas: 2` as the default for installed apps, and reserve `minReplicas: 1` for linked-app development contexts where the platform allows it.
- Use `maxReplicas: 5` as the lowest practical starting point, since the documented minimum is `5`.
- Use `ttl` intentionally. In VTEX IO, `ttl` is measured in minutes, with platform defaults and limits that differ from `timeout`. For partner apps, start from the default `10` minutes and increase intentionally up to `60` only when reducing cold starts matters more than allowing idle instances to sleep sooner.

Scaling ranges and exceptions:

- Use 128 to 256 MB for simpler IO-bound services, and move to 512 MB only when there is evidence of OOM, large payload processing, or heavier libraries.
- Increase `workers` to 2 to 4 only for high-throughput IO-bound workloads after measuring benefit. Avoid using more than 4 workers per instance as a default.
- Increase `maxReplicas` from `5` toward `10` only when public traffic or predictable peaks justify it. Treat values above 10 as exceptions that require explicit justification and monitoring in partner apps.
- Avoid `timeout` values above 60 seconds for HTTP routes; if more time is needed, redesign the flow as async work.
- Remember that `ttl` has a documented minimum of `10` minutes and maximum of `60` minutes. Use higher values intentionally to reduce cold starts on low-traffic or bursty services, and avoid treating `ttl` like a per-request timeout.
- For partner apps, `rateLimitPerReplica.perMinute` often starts in the `60` to `300` range for normal routes and in the `10` to `60` range for more expensive ones. `rateLimitPerReplica.concurrent` often starts between `1` and `5`.

## Hard constraints

### Constraint: The Service entrypoint must stay a runtime composition root

`node/index.ts` MUST define and export the VTEX IO service runtime structure, not become a catch-all file for business logic, data transformation, or transport implementation.

**Why this matters**

When the entrypoint mixes registration with business logic, the execution model becomes harder to reason about, handlers become tightly coupled, and changes to routes, events, or GraphQL surfaces become risky.

**Detection**

If `node/index.ts` contains large handler bodies, external API calls, complex branching, or data-mapping logic, STOP and move that logic into dedicated modules. Keep the entrypoint focused on typing and registration.

**Correct**

```typescript
import type { ClientsConfig, RecorderState, ServiceContext } from '@vtex/api'
import { Service } from '@vtex/api'
import { clients, Clients } from './clients'
import { routes } from './routes'

export interface State extends RecorderState {}

export type Context = ServiceContext<Clients, State>

const clientsConfig: ClientsConfig<Clients> = {
  implementation: clients,
  options: {},
}

export default new Service<Clients, State>({
  clients: clientsConfig,
  routes,
})
```

**Wrong**

```typescript
import { Service } from '@vtex/api'
import axios from 'axios'

export default new Service({
  routes: {
    reviews: async (ctx: any) => {
      const response = await axios.get('https://example.com/data')
      const transformed = response.data.items.map((item: any) => ({
        ...item,
        extra: true,
      }))

      ctx.body = transformed.filter((item: any) => item.active)
    },
  },
})
```

### Constraint: Runtime configuration must be expressed in `service.json`, not improvised in code

Resource and execution settings such as timeout, ttl, memory, workers, and replica behavior MUST be configured in `service.json` when the app depends on them.
`service.json` resides inside the `node/` folder and centralizes runtime parameters such as routes, events, memory, timeout, ttl, workers, replicas, and rate limits for this service.

**Why this matters**

These settings are part of the service runtime contract with the platform. Hiding them in assumptions or spreading them across code makes behavior harder to predict and can cause timeouts, cold-start churn, underprovisioning, or scaling mismatches. In VTEX IO, `ttl` is especially important because it is measured in minutes and influences how aggressively service infrastructure can go idle between requests.
Using the minimum `ttl` on low-traffic services can increase cold starts, because the platform is allowed to scale the service down more aggressively between bursts.

**Detection**

If the app depends on long-running work, concurrency, warm capacity, or specific route exposure behavior, STOP and verify that the relevant `service.json` settings are present and intentional. If the behavior is only implied in code comments or handler logic, move it into runtime configuration.

**Correct**

```json
{
  "memory": 256,
  "timeout": 30,
  "ttl": 10,
  "minReplicas": 2,
  "maxReplicas": 10,
  "workers": 4,
  "rateLimitPerReplica": {
    "perMinute": 300,
    "concurrent": 10
  },
  "routes": {
    "reviews": {
      "path": "/_v/api/reviews",
      "public": false
    }
  }
}
```

**Wrong**

```json
{
  "routes": {
    "reviews": {
      "path": "/_v/api/reviews"
    }
  }
}
```

This runtime configuration is incomplete for a service that depends on explicit timeout, concurrency, rate limiting, or replica behavior, and it leaves execution characteristics undefined.

### Constraint: Route exposure must be explicit in the runtime contract

Every HTTP route exposed by the service MUST be declared in `service.json` with an intentional visibility choice. Do not rely on implicit defaults when the route should be private or public.
Routes are private by default, so always set `public: true` explicitly when the route must be externally reachable.

**Why this matters**

Route visibility is part of the runtime contract of the service. If exposure is ambiguous, a route can be published with the wrong accessibility, which creates security risk for private handlers and integration failures for routes expected to be public.

**Detection**

If a route exists in the service runtime, STOP and verify that it is declared in `service.json` and that `public` matches the intended exposure. If the route is consumed only by trusted backoffice or app-to-app flows, default to checking that it is private before expanding access.

**Correct**

```json
{
  "routes": {
    "status": {
      "path": "/_v/status/health",
      "public": true,
      "smartcache": true
    },
    "reviews": {
      "path": "/_v/api/reviews",
      "public": false
    }
  }
}
```

**Wrong**

```json
{
  "routes": {
    "reviews": {
      "path": "/_v/api/reviews"
    }
  }
}
```

This route leaves visibility implicit, so the runtime contract does not clearly communicate whether the endpoint is meant to be public or protected.

### Constraint: Typed context and state must match the handlers registered in the runtime

The service MUST define `Context`, `State`, and handler contracts that match the routes, events, or GraphQL handlers it registers.

**Why this matters**

Untyped or inconsistent runtime contracts make middleware composition fragile and allow handlers to rely on state or params that are never guaranteed to exist.

**Detection**

If middlewares or handlers use `ctx.state`, `ctx.clients`, `ctx.vtex`, or params fields without a shared typed contract, STOP and introduce or fix the runtime types before adding more handlers.

**Correct**

```typescript
import type { ParamsContext, RecorderState, ServiceContext } from '@vtex/api'

interface State extends RecorderState {
  reviewId?: string
}

type CustomContext = ServiceContext<Clients, State, ParamsContext>

export async function getReview(ctx: CustomContext) {
  ctx.state.reviewId = ctx.vtex.route.params.id
  ctx.body = { id: ctx.state.reviewId }
}
```

**Wrong**

```typescript
export async function getReview(ctx: any) {
  ctx.state.reviewId = ctx.params.review
  ctx.body = { id: ctx.state.missingField.value }
}
```

## Preferred pattern

Recommended file layout:

```text
node/
├── index.ts
├── clients/
│   └── index.ts
├── routes/
│   └── index.ts
├── events/
│   └── index.ts
├── graphql/
│   └── index.ts
└── middlewares/
    └── validate.ts
```

Minimal service runtime pattern:

```typescript
import type { ClientsConfig, RecorderState, ServiceContext } from '@vtex/api'
import { Service } from '@vtex/api'
import { clients, Clients } from './clients'
import { routes } from './routes'

export interface State extends RecorderState {}

export type Context = ServiceContext<Clients, State>

const clientsConfig: ClientsConfig<Clients> = {
  implementation: clients,
  options: {},
}

export default new Service<Clients, State>({
  clients: clientsConfig,
  routes,
})
```

Minimal `service.json` pattern:

```json
{
  "memory": 256,
  "timeout": 30,
  "ttl": 10,
  "minReplicas": 2,
  "maxReplicas": 5,
  "workers": 1,
  "rateLimitPerReplica": {
    "perMinute": 120,
    "concurrent": 4
  },
  "routes": {
    "status": {
      "path": "/_v/status/health",
      "public": true,
      "smartcache": true
    },
    "reviews": {
      "path": "/_v/api/reviews",
      "public": false
    }
  },
  "events": {
    "orderCreated": {
      "sender": "vtex.orders-broadcast",
      "topics": ["order-created"],
      "rateLimitPerReplica": {
        "perMinute": 60,
        "concurrent": 2
      }
    }
  }
}
```

Use the service entrypoint to compose runtime surfaces, then push business behavior into handlers, clients, and other focused modules.
If `routes/index.ts` or `events/index.ts` grows too large, split it by domain such as `routes/orders.ts` or `events/catalog.ts` and keep the index file as a small registry.

## Common failure modes

- Putting business logic directly into `node/index.ts`.
- Treating `service.json` as optional when runtime behavior depends on explicit resource settings.
- Setting `ttl` too low and causing the service to sleep too aggressively between bursts of traffic.
- Enabling `smartcache` on personalized or write-oriented routes and risking incorrect cache reuse across requests.
- Registering routes, events, or GraphQL handlers without a clear typed `Context` and `State`.
- Mixing runtime composition with client implementation details.
- Letting one service entrypoint accumulate unrelated responsibilities across HTTP, events, and GraphQL without clear module boundaries.

## Review checklist

- [ ] Is `node/index.ts` acting as a runtime composition root rather than a business-logic file?
- [ ] Are routes, events, and GraphQL handlers registered explicitly and cleanly?
- [ ] Does `service.json` express the runtime behavior the app actually depends on?
- [ ] Are `Context`, `State`, and params types shared consistently across handlers?
- [ ] Are runtime concerns separated from client implementation and business logic?

## Reference

- [Service](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) - VTEX IO service runtime structure and registration
- [Service JSON](https://developers.vtex.com/docs/guides/vtex-io-documentation-service-json) - Runtime configuration for VTEX IO services
- [Node Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-node-builder) - Backend app structure under the `node` builder
- [Developing an App](https://developers.vtex.com/docs/guides/vtex-io-documentation-4-developing-an-app) - General backend app development flow

---

# VTEX IO session transform apps

## When this skill applies

Use this skill when your VTEX IO app integrates with the **VTEX session system** (`vtex.session`) to **derive**, **compute**, or **propagate** state that downstream transforms, the storefront, or checkout depend on.

- Building a **session transform** that computes custom fields from upstream session state (e.g. pricing context from an external backend, regionalization from org data)
- Declaring **input/output** fields in `vtex.session/configuration.json`
- Deciding which **namespace** your app should own and which it should **read from**
- Propagating values into **`public.*`** inputs so **native** transforms (profile, search, checkout) re-run
- Debugging **stale** session fields, **race conditions**, or **namespace collisions** between apps
- Designing **B2B** session flows where `storefront-permissions`, custom transforms, and checkout interact

Do not use this skill for:

- General IO backend patterns (use `vtex-io-service-apps`)
- Performance patterns outside session transforms (use `vtex-io-application-performance`)
- GraphQL schema or resolver design (use `vtex-io-graphql-api`)

## Decision rules

### Namespace ownership

- **Every session app owns exactly one output namespace** (or a small set of fields within one). The namespace name typically matches the app concept (e.g. `rona`, `myapp`, `storefront-permissions`).
- **Never write to another app's output namespace.** If `storefront-permissions` owns `storefront-permissions.organization`, your transform must **not** overwrite it—read it as an input instead.
- **Never duplicate** VTEX-owned fields (org, cost center, postal, country) into your namespace when they already exist in `storefront-permissions`, `profile`, `checkout`, or `store`. Your namespace should contain **only** data that comes from **your** backend or computation.

### `public` is input, private is read model

- **`public.*`** fields are an **input surface**: values the shopper or a flow sets so session transforms can run (e.g. geolocation, flags, UTMs, user intent). Do **not** treat `public.*` as the canonical read model in storefront code.
- **Private namespaces** (`profile`, `checkout`, `store`, `search`, `storefront-permissions`, your custom namespace) are the **read model**: computed outputs derived from inputs. Frontend components should read **private** namespace fields for business rules and display.
- If your transform must influence native apps (e.g. set a postal code derived from a cost center address), **update `public.*` input fields** that native apps declare as inputs—so the platform re-runs those upstream transforms and private outputs stay consistent. This is **input propagation**, not duplicating truth.

### Transform ordering (DAG)

- VTEX session runs transforms in a **directed acyclic graph** (DAG) based on declared input/output dependencies in each app's `vtex.session/configuration.json`.
- A transform runs when any of its **declared input fields** change. If you depend on `storefront-permissions.costcenter`, your transform runs **after** `storefront-permissions` outputs that field.
- **Order your dependencies carefully**: if your transform needs both `storefront-permissions` outputs and `profile` outputs, declare both as inputs so the platform schedules you after both.

### Caching inside transforms

- Session transforms execute on **every session change** that touches a declared input. They must be **fast**.
- Use **LRU** (in-process, per-worker) for hot lookups (org data, configuration, tokens) with short TTLs.
- Use **VBase stale-while-revalidate** for data that can tolerate brief staleness (external backend responses, computed mappings). Return stale immediately; revalidate in the background.
- Follow the same tenant-keying rules as any IO service: in-memory cache keys must include **`account`** and **`workspace`** (see `vtex-io-application-performance`).

### Frontend session consumption

- Storefront components should **request specific session items** via the `items=` query parameter (e.g. `items=rona.storeNumber,storefront-permissions.costcenter`).
- **Read** from the relevant **private** namespaces (`rona.*`, `storefront-permissions.*`, `profile.*`, etc.) for canonical state.
- **Write** to `public.*` only when setting **user intent** (e.g. selecting a location, switching a flag). Never write to `public.*` as a "cache" for values that private namespaces already provide.

## Hard constraints

### Constraint: Do not duplicate another app's output namespace fields into your namespace

Your session transform must output **only** fields that come from **your** computation or backend. Copying identity, address, or org fields that `storefront-permissions`, `profile`, or `checkout` already own creates **two sources of truth** that diverge on partial failures.

**Why this matters** — When two namespaces contain the same fact (e.g. `costCenterId` in both your namespace and `storefront-permissions`), consumers read inconsistent values after a session that partially updated. Debug time skyrockets and race conditions appear.

**Detection** — Your transform's output includes fields like `organization`, `costcenter`, `postalCode`, `country` that mirror `storefront-permissions.*` or `profile.*` outputs. Or frontend reads the same logical field from two different namespaces.

**Correct** — Read `storefront-permissions.costcenter` as an input; use it to compute your backend-specific fields (e.g. `myapp.priceTable`, `myapp.storeNumber`); output **only** those derived fields.

```json
{
  "my-session-app": {
    "input": {
      "storefront-permissions": ["costcenter", "organization"]
    },
    "output": {
      "myapp": ["priceTable", "storeNumber"]
    }
  }
}
```

**Wrong** — Output duplicates of VTEX-owned fields.

```json
{
  "my-session-app": {
    "output": {
      "myapp": ["costcenter", "organization", "postalCode", "priceTable", "storeNumber"]
    }
  }
}
```

### Constraint: Use input propagation to influence native transforms, not direct overwrites

When your transform derives a value (e.g. postal code from a cost center address) that native apps consume, set it as an **input** field those apps declare (typically `public.postalCode`, `public.country`)—**not** by writing directly to `checkout.postalCode` or `search.postalCode`.

**Why this matters** — Native transforms expect their **input** fields to change so they can recompute their **output** fields. Writing directly to their output namespaces bypasses recomputation and leaves stale derived state (e.g. `regionId` not updated, checkout address inconsistent).

**Detection** — Your transform declares output fields in namespaces owned by other apps (e.g. `output: { checkout: [...] }` or `output: { search: [...] }`). Or you PATCH session with values in a namespace you don't own.

**Correct** — Declare output in `public` for fields that native apps consume as inputs, verified against each native app's `vtex.session/configuration.json`.

```json
{
  "my-session-app": {
    "output": {
      "myapp": ["storeNumber", "priceTable"],
      "public": ["postalCode", "country", "state"]
    }
  }
}
```

**Wrong** — Writing to search or checkout output namespaces directly.

```json
{
  "my-session-app": {
    "output": {
      "myapp": ["storeNumber", "priceTable"],
      "checkout": ["postalCode", "country"],
      "search": ["facets"]
    }
  }
}
```

### Constraint: Frontend must read private namespaces, not `public`, for canonical business state

Storefront components and middleware must read session data from the **authoritative private namespace** (e.g. `storefront-permissions.organization`, `profile.email`, `myapp.priceTable`), not from `public.*` fields.

**Why this matters** — `public.*` fields are inputs that may be stale, user-set, or partial. Private namespace fields are the **computed** truth after all transforms have run. Reading `public.postalCode` instead of the profile- or checkout-derived value leads to displaying stale or inconsistent data.

**Detection** — React components or middleware that read `public.storeNumber`, `public.organization`, or `public.costCenter` for display or business logic instead of the corresponding private field.

**Correct**

```typescript
// Read from the authoritative namespace
const { data } = useSessionItems([
  'myapp.storeNumber',
  'myapp.priceTable',
  'storefront-permissions.costcenter',
  'storefront-permissions.organization',
])
```

**Wrong**

```typescript
// Reading from public as if it were the source of truth
const { data } = useSessionItems([
  'public.storeNumber',
  'public.organization',
  'public.costCenter',
])
```

## Preferred pattern

### `vtex.session/configuration.json`

Declare your transform's input dependencies and output fields:

```json
{
  "my-session-app": {
    "input": {
      "storefront-permissions": ["costcenter", "organization", "costCenterAddressId"]
    },
    "output": {
      "myapp": ["storeNumber", "priceTable"]
    }
  }
}
```

### Transform handler

```typescript
// node/handlers/transform.ts
export async function transform(ctx: Context) {
  const { costcenter, organization } = parseSfpInputs(ctx.request.body)

  if (!costcenter) {
    ctx.body = { myapp: {} }
    return
  }

  const costCenterData = await getCostCenterCached(ctx, costcenter)
  const pricing = await resolvePricing(ctx, costCenterData)

  ctx.body = {
    myapp: {
      storeNumber: pricing.storeNumber,
      priceTable: pricing.priceTable,
    },
  }
}
```

### Caching inside the transform

```typescript
// Two-layer cache: LRU (sub-ms) -> VBase (persistent, SWR) -> API
const costCenterLRU = new LRU<string, CostCenterData>({ max: 1000, ttl: 600_000 })

async function getCostCenterCached(ctx: Context, costCenterId: string) {
  const { account, workspace } = ctx.vtex
  const key = `${account}:${workspace}:${costCenterId}`

  const lruHit = costCenterLRU.get(key)
  if (lruHit) return lruHit

  const result = await staleFromVBaseWhileRevalidate(
    ctx.clients.vbase,
    'cost-centers',
    costCenterId,
    () => fetchCostCenterFromAPI(ctx, costCenterId),
    { ttlMs: 1_800_000 }
  )

  costCenterLRU.set(key, result)
  return result
}
```

### `service.json` route

```json
{
  "routes": {
    "transform": {
      "path": "/_v/my-session-app/session/transform",
      "public": true
    }
  }
}
```

### Session ecosystem awareness

When building a transform, map out the transform DAG for your store:

```text
authentication-session → impersonate-session → profile-session
profile-session → store-session → checkout-session
profile-session → search-session
authentication-session + checkout-session + impersonate-session → storefront-permissions
storefront-permissions → YOUR-TRANSFORM (reads SFP outputs)
```

Your transform sits at the **end** of whatever dependency chain it requires. Declaring inputs correctly ensures the platform schedules you **after** all upstream transforms.

## Common failure modes

- **Frontend writes B2B state via `updateSession`** — Instead of letting `storefront-permissions` + your transform compute B2B session fields, the frontend PATCHes them directly. This creates race conditions, partial state, and duplicated sources of truth.
- **Duplicating VTEX-owned fields** — Copying `costcenter`, `organization`, or `postalCode` into your namespace when they already live in `storefront-permissions` or `profile`.
- **Slow transforms without caching** — Calling external APIs on every transform invocation without LRU + VBase SWR. Transforms run on every session change that touches a declared input; they must be fast.
- **Reading `public.*` as source of truth** — Frontend components reading `public.organization` or `public.storeNumber` instead of the private namespace field, leading to stale or inconsistent display.
- **Writing to other apps' output namespaces** — Declaring output fields in `checkout`, `search`, or `storefront-permissions` namespaces you don't own, bypassing native transform recomputation.
- **Missing tenant keys in LRU** — In-memory cache for org or pricing data keyed only by entity ID without `account:workspace`, unsafe on multi-tenant shared pods.

## Review checklist

- [ ] Does the transform output **only** fields from its own computation/backend, not duplicates of other namespaces?
- [ ] Are **input** dependencies declared correctly in `vtex.session/configuration.json`?
- [ ] Are **output** fields limited to your own namespace (plus `public.*` inputs when propagation is needed)?
- [ ] Is `public.*` used **only** for input propagation, not as a second read model?
- [ ] Do frontend components read from **private** namespaces, not `public.*`, for business state?
- [ ] Are upstream API calls in the transform **cached** (LRU + VBase SWR) to keep transform latency low?
- [ ] Are in-memory cache keys scoped with `account:workspace` for multi-tenant safety?
- [ ] Is the transform order (DAG) correct—does it run after all its dependency transforms?
- [ ] Has `updateSession` been removed from frontend code for fields the transform computes?

## Related skills

- [vtex-io-application-performance](../vtex-io-application-performance/skill.md) — Caching layers and parallel I/O applicable inside transforms
- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) — Route prefix for the transform endpoint
- [vtex-io-service-apps](../vtex-io-service-apps/skill.md) — Service class, clients, and middleware basics
- [vtex-io-app-structure](../vtex-io-app-structure/skill.md) — Manifest, builders, policies

## Reference

- [VTEX Session System](https://developers.vtex.com/docs/guides/vtex-io-documentation-using-the-session-manager) — Session manager overview and API
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — VBase, MasterData, and custom clients
- [Engineering Guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices
