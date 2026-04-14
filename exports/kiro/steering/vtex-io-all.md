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
- **Be deliberate with transactional data caching** — **Payment responses** and **active transaction state** must **never** be cached. For other transactional data (**order forms**, **cart simulations**, **session state**), the default is no cache, but **short-lived** caches (TTL < 5 min) can be acceptable when the consumer tolerates brief staleness. Confirm the use case explicitly before caching—long TTLs on transactional data create stale prices, phantom inventory, or inconsistent state.
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
- **`minReplicas` / `maxReplicas`** — Controls horizontal scaling under load. Note: **all pods scale to zero** when the app receives no requests for the duration of its `ttl` (max 60 minutes). `minReplicas` only governs the floor while traffic exists—it does **not** keep pods alive indefinitely. Design for cold starts: first request after idle spins up a new pod, so keep LRU warm-up cost low and avoid relying on in-memory state surviving idle periods.

### Tenancy and in-memory caches

Pods **can** be shared across accounts, but **every request is always scoped** to a specific **`{account, workspace}`** by the platform—`ctx.vtex.account` and `ctx.vtex.workspace` are set by the runtime, not by the developer. All platform APIs (**VBase**, app buckets, Master Data, etc.) **automatically partition data** by account/workspace, so their responses are tenant-safe by design. The **only** risk is **in-process** state: LRU caches, module-level `Map`s, or global variables that **you** manage—these are **not** partitioned by the platform and must be **keyed** explicitly with **`ctx.vtex.account`** and **`ctx.vtex.workspace`** (plus entity id) so **two** consecutive requests for **different** accounts on the **same pod** cannot read each other’s entries.

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

For **payment connectors**, the first line of defense is the **acquirer/gateway idempotency feature**: pass the **VTEX `paymentId`** as the idempotency key to the external payment provider (e.g. via an `Idempotency-Key` HTTP header). This ensures the provider itself rejects duplicate charges even if VBase state is lost. VBase remains essential for local state tracking and for returning the correct response to VTEX Gateway retries, but the external idempotency key prevents the worst outcome (double charge) at the provider level.

**Why this matters** — VTEX Gateway **retries** payment calls with the same `paymentId`. If VBase write fails silently after a successful authorization and the acquirer has no idempotency key, the connector sends **another** payment request—causing a **duplicate charge**. With the acquirer idempotency key in place, the provider rejects the duplicate; without it, VBase is the only safeguard.

**Detection** — A VBase `saveJSON` or `saveOrUpdate` call **without** `await` in a payment, settlement, refund, or any flow where the stored value is the **only** record preventing re-execution. Also check whether the external payment call includes an idempotency key header.

**Correct** — Use acquirer idempotency key **and** await VBase writes.

```typescript
// Pass VTEX paymentId as idempotency key to the acquirer
const response = await ctx.clients.paymentProvider.authorize(paymentData, {
  headers: { 'Idempotency-Key': authorization.paymentId },
})

// Await VBase write for local state tracking
await ctx.clients.vbase.saveJSON<Transaction>('transactions', paymentId, transactionData)
return Authorizations.approve(authorization, { ... })
```

**Wrong** — No acquirer idempotency key and fire-and-forget VBase write.

```typescript
// No idempotency key to the acquirer + no await on VBase
const response = await ctx.clients.paymentProvider.authorize(paymentData)
ctx.clients.vbase.saveJSON('transactions', paymentId, transactionData)
return Authorizations.approve(authorization, { ... })
```

### Constraint: Be deliberate when caching transactional or near-real-time data

**Payment statuses** and **active transaction state** must **never** be cached—they are strictly real-time. For other transactional data like **order forms**, **cart simulations**, and **session state**, the default is **no cache**, but **short-lived caches** (e.g. 1–5 minutes) can be acceptable when the use case tolerates brief staleness. This is a **case-by-case** decision: explicitly confirm that the consumer can handle stale data for the chosen TTL before caching.

**Why this matters** — Serving a cached order form may show phantom items or stale prices. Caching payment responses could return a previous transaction's status. However, for read-heavy scenarios where the same data is requested repeatedly within seconds (e.g. a product listing page fetching simulation data for multiple components), a short-lived cache can dramatically reduce load on upstream APIs without meaningful user impact.

**Detection** — LRU or VBase keys like `orderForm:{id}`, `cartSim:{hash}`, `paymentResponse:{id}`, or `session:{token}` used for read-through caching **without** an explicit TTL decision or justification. Long TTLs (>5 min) on transactional data are almost always wrong. Any cache on payment responses or active transaction state is wrong.

**Correct** — Separate reference data (always cache) from transactional data (default no cache, short TTL only with explicit justification).

```typescript
// Reference data: cached (changes rarely)
const costCenter = await getCostCenterCached(ctx, costCenterId);
const sellerList = await getSellerListCached(ctx);

// Transactional data: default live, but short cache is acceptable if justified
const orderForm = await ctx.clients.checkout.orderForm();
const simulation = await ctx.clients.checkout.simulation(payload);

// Acceptable: short-lived cache for a read-heavy page (e.g. simulation results
// reused across multiple components within the same page render, TTL < 60s)
// Only after confirming staleness is acceptable for this specific consumer.
```

**Wrong** — Long-lived cache on transactional data, or any cache on payment state.

```typescript
// Never cache payment responses or transaction status
const paymentCache = lru({ max: 1000, ttl: 300_000 });

// Avoid: long TTL on order form without explicit justification
const orderFormCache = lru({ max: 500, ttl: 600_000 }); // 10 min is too long
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
const settings = await getAppSettings(ctx); // 1
const session = await getSessions(ctx); // 2
const costCenter = await getCostCenter(ctx, ccId); // 3
const orderForm = await getOrderForm(ctx); // 4
const skus = await getSkuById(ctx, skuIds); // 5
const price = await generatePrice(ctx, costCenter); // 6 (calls getCostCenter AGAIN + getSession AGAIN)
for (const item of items) {
  await setManualPrice(ctx, item); // 7, 8, 9... (sequential loop)
}

// AFTER: 3 phases, no duplicates, parallel mutations
const settings = await getAppSettings(ctx);
const [session, costCenter, orderForm] = await Promise.all([
  getSessions(ctx),
  getCostCenter(ctx, ccId),
  getOrderForm(ctx),
]);
const skus = await getSkuMetadataBatch(ctx, skuIds); // per-entity VBase cache
const price = await generatePrice(ctx, costCenter, session); // reuse, no re-fetch
await Promise.all(items.map((item) => setManualPrice(ctx, item)));
```

### Per-entity VBase caching

```typescript
interface SkuMetadata {
  skuId: string;
  mappedSku: string | null;
  isSpecialItem: boolean;
}

async function getSkuMetadataBatch(
  ctx: Context,
  skuIds: string[],
): Promise<Map<string, SkuMetadata>> {
  const { vbase, search } = ctx.clients;
  const results = new Map<string, SkuMetadata>();

  // Phase 1: check VBase for each SKU in parallel
  const lookups = await Promise.allSettled(
    skuIds.map((id) => vbase.getJSON<SkuMetadata>("sku-metadata", `sku:${id}`)),
  );

  const missing: string[] = [];
  lookups.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value) {
      results.set(skuIds[i], result.value);
    } else {
      missing.push(skuIds[i]);
    }
  });

  if (missing.length === 0) return results;

  // Phase 2: fetch only missing SKUs from API
  const products = await search.getSkuById(missing);

  // Phase 3: cache ALL sibling SKUs (prewarm)
  for (const product of products) {
    for (const sku of product.items) {
      const metadata: SkuMetadata = {
        skuId: sku.itemId,
        mappedSku: extractMapping(sku),
        isSpecialItem: checkSpecial(sku),
      };
      results.set(sku.itemId, metadata);
      // Fire-and-forget for prewarming (not idempotency-critical)
      vbase
        .saveJSON("sku-metadata", `sku:${sku.itemId}`, metadata)
        .catch(() => {});
    }
  }

  return results;
}
```

## Common failure modes

- **LRU unbounded** — Memory grows without **max** entries; pod **OOM**.
- **VBase without LRU** — Every request hits **VBase** for **hot** keys; **latency** and **cost** rise.
- **In-memory cache without tenant in key** — Same pod serves account A then B; **stale** or **wrong** row returned from module cache.
- **Serial awaits** — Three **independent** Janus calls **awaited** one after another; total latency = sum of all instead of max.
- **Duplicate calls in resolver chains** — `getCostCenter` called in the resolver and again inside a helper; `getSession` called twice in the same flow. Each duplicate adds a full round-trip.
- **Blob VBase keys** — Keying VBase by `sortedCartSkuIds` means adding 1 item to a cart of 10 requires a full re-fetch instead of 1 lookup.
- **Long-lived cache on transactional data** — Order forms or cart simulations cached with long TTLs without explicit justification; payment responses or transaction state cached at all.
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
- [ ] Is **payment/transaction state** always fetched live? For other transactional data (order form, cart sim), is any cache **short-lived** with explicit justification?
- [ ] Are VBase keys **per-entity** (not blob) for high-cardinality data like SKUs?
- [ ] Are `service.json` resource limits (`timeout`, `memory`, `workers`, `replicas`) tuned for the workload?
- [ ] Is logging done via `ctx.vtex.logger` (not `console.log`) with sensitive data redacted?

## Related skills

- [vtex-io-service-paths-and-cdn](vtex-io-vtex-io-service-paths-and-cdn.md) — Edge paths, cookies, CDN
- [vtex-io-session-apps](vtex-io-vtex-io-session-apps.md) — Session transforms (caching patterns apply inside transforms)
- [vtex-io-service-apps](vtex-io-vtex-io-service-apps.md) — Clients, middleware, Service
- [vtex-io-graphql-api](vtex-io-vtex-io-graphql-api.md) — GraphQL caching
- [vtex-io-app-structure](../vtex-io-app-structure/skill.md) — Manifest, policies

## Reference

- [VTEX IO Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — `vbase` client methods
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — SEGMENT cache and cookies
- [Engineering guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub

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

- [`vtex-io-service-apps`](vtex-io-vtex-io-service-apps.md) — Service app fundamentals needed for all GraphQL resolvers
- [`vtex-io-app-structure`](../vtex-io-app-structure/skill.md) — Manifest and builder configuration that GraphQL depends on
- [`vtex-io-masterdata`](vtex-io-vtex-io-masterdata.md) — MasterData integration commonly used as a data source in resolvers

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
- **Exposing MD** — Master Data is **storage** only. Any **storefront** or **partner** access should go through a **service** that enforces **authentication**, **authorization**, and **rate limits**—typically **VTEX IO** or an external **BFF** following [headless-bff-architecture](headless-headless-bff-architecture.md) patterns.
- **When MD fits** — After **storage fit** review, if MD remains appropriate, implement CRUD and schema discipline as below; combine with [vtex-io-application-performance](vtex-io-vtex-io-application-performance.md) and [vtex-io-service-paths-and-cdn](vtex-io-vtex-io-service-paths-and-cdn.md) when exposing HTTP or GraphQL from IO.

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

### `v-indexed`, `v-cache`, `v-default-fields`, and `v-security`

These are **VTEX-specific extensions** to standard JSON Schema. They control how Master Data v2 indexes, caches, and secures your data:

- **`v-indexed`** — Array of field names that Master Data will index. **Only** indexed fields can be used in `where` clauses for `searchDocuments` and `scrollDocuments`. Queries on non-indexed fields trigger **full document scans** that time out on large datasets. Index **only** what you actually filter or sort on—over-indexing increases write latency and storage cost because every index must be updated on every document write.
- **`v-cache`** — Boolean (default `true`). When `true`, Master Data caches GET responses for individual documents. Set to **`false`** when your entity has **high write frequency** and consumers need **fresh reads** immediately after writes (e.g. real-time counters, session-like state). For most entities that are read-heavy and write-infrequently, **leave the default** (`true`).
- **`v-default-fields`** — Array of field names returned when the caller does **not** specify a `fields` parameter. Keep this list **minimal**—return only the fields most consumers need by default to reduce payload size.
- **`v-security`** — Object controlling **public** (unauthenticated) access to fields. Use `publicRead`, `publicWrite`, and `publicFilter` arrays to expose specific fields without auth. Set `allowGetAll` to `false` unless you explicitly need unauthenticated list access.
- **`v-triggers`** — Array of trigger configurations for automated actions on document changes. See the triggers section below.
- **`v-canonicalto`** — URL pointing to another schema in the same entity for **schema inheritance**.

```json
{
  "properties": {
    "email": { "type": "string", "format": "email" },
    "status": { "type": "string" },
    "score": { "type": "integer" },
    "internalNotes": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "v-indexed": ["email", "status", "createdAt"],
  "v-default-fields": ["email", "status", "score", "createdAt"],
  "v-cache": true,
  "v-security": {
    "allowGetAll": false,
    "publicRead": ["status", "score"],
    "publicWrite": [],
    "publicFilter": ["status"]
  }
}
```

**When to index**: fields used in `where` clauses, sort expressions, or frequently filtered in search. **When not to index**: large text fields (`description`, `notes`), fields never queried, or fields only read by document ID (indexing adds no benefit for `getDocument`).

**When to disable cache** (`v-cache: false`): entities with high write throughput where stale reads are unacceptable (e.g. real-time configuration flags, live counters). **When to keep cache** (`v-cache: true` or omit): standard entities with read-heavy access patterns (reviews, wishlists, product extensions).

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
ctx.vtex.logger.info({ action: "priceUpdate", skuId, newPrice });

// Cache: use VBase
await ctx.clients.vbase.saveJSON("my-cache", cacheKey, data);
```

**Wrong**

```typescript
// Using MD as a log store — creates millions of documents
await ctx.clients.masterdata.createDocument({
  dataEntity: "appLogs",
  fields: {
    level: "info",
    message: `Price updated for ${skuId}`,
    timestamp: new Date(),
  },
});
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

- [vtex-io-application-performance](vtex-io-vtex-io-application-performance.md) — IO performance patterns (cache layers, BFF-facing behavior)
- [vtex-io-service-paths-and-cdn](vtex-io-vtex-io-service-paths-and-cdn.md) — Public vs private routes for MD-backed APIs
- [vtex-io-session-apps](vtex-io-vtex-io-session-apps.md) — Session transforms that may read from or complement MD-stored state
- [architecture-well-architected-commerce](architecture-architecture-well-architected-commerce.md) — Cross-cutting storage and pillar alignment
- [headless-bff-architecture](headless-headless-bff-architecture.md) — BFF boundaries when MD is not accessed from IO

## Reference

- [Creating a Master Data v2 CRUD App](https://developers.vtex.com/docs/guides/create-master-data-crud-app) — Complete guide for building Master Data apps with the masterdata builder
- [Working with JSON Schemas in Master Data v2](https://developers.vtex.com/docs/guides/working-with-json-schemas-in-master-data-v2) — Schema structure, validation, and indexing configuration
- [Schema Lifecycle](https://developers.vtex.com/docs/guides/master-data-schema-lifecycle) — How schemas evolve and impact data entities over time
- [Setting Up Triggers on Master Data v2](https://developers.vtex.com/docs/guides/setting-up-triggers-on-master-data-v2) — Trigger configuration for automated workflows
- [Master Data v2 API Reference](https://developers.vtex.com/docs/api-reference/master-data-api-v2#overview) — Complete API reference for all Master Data v2 endpoints
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — MasterDataClient methods and usage in VTEX IO

---

# VTEX IO access control (RBAC)

## When this skill applies

Use this skill when you need to **control who can access** your VTEX IO app's routes and resources:

- Deciding between **role-based** (`policies.json`) and **resource-based** (`service.json` policies) access control
- Securing **REST endpoints** so only specific apps, users, or API keys can call them
- Setting up **GraphQL authorization** with the `@auth` directive
- Understanding **VRN** (VTEX Resource Name) syntax for declaring principals
- Debugging **403 Forbidden** errors caused by missing or misconfigured policies

Do not use this skill for:

- General service architecture (use `vtex-io-service-apps`)
- PCI compliance and payment security (use `payment-pci-security`)
- Route prefix and CDN behavior (use `vtex-io-service-paths-and-cdn`)

## Decision rules

### Role-based vs resource-based policies

| | Role-based (`policies.json`) | Resource-based (`service.json` policies) |
| --- | --- | --- |
| **Who can call?** | Only other IO apps (by themselves or on behalf of other apps) | Apps, users, and integrations (API keys) |
| **API types** | GraphQL and REST | REST only |
| **How callers get access** | Must declare required policies in their `manifest.json` | No policy declaration needed; just call with auth token |
| **Where configured** | `policies.json` in app root | `policies` array inside route definition in `service.json` |
| **Use when** | Exposing GraphQL endpoints; exposing REST endpoints for app-to-app only | Controlling access for users, API keys, or specific apps to REST endpoints |

### Choosing the right approach

- **GraphQL endpoints** → Use **role-based** policies (`policies.json`) **and/or** the **`@auth` directive** in the schema for user-level authorization.
- **REST endpoint called only by other IO apps** → Use **role-based** policies (`policies.json`). Consuming apps must declare the policy in their `manifest.json`.
- **REST endpoint called by users or API keys** → Use **resource-based** policies in `service.json`. Set the route as `"public": false` and define principals.
- **Public REST endpoint (no auth)** → Set `"public": true` in `service.json`. No policies needed, but be aware this means **anyone** can call it.

### VRN syntax

VRNs (VTEX Resource Names) identify resources and principals:

```text
vrn:{service}:{region}:{account}:{workspace}:{path}
```

- **Apps**: `vrn:apps:*:*:*:app/{vendor}.{app-name}@{version}`
- **Users**: `vrn:vtex.vtex-id:*:*:*:user/{email}`
- **API keys**: `vrn:vtex.vtex-id:*:*:*:user/vtexappkey-{account}-{hash}`
- **Wildcards**: `*` matches any value in a segment. `app/*` matches all apps. `user/*@gmail.com` matches all Gmail users.

## Hard constraints

### Constraint: Use resource-based policies when users or API keys need access

Role-based policies only work for **app-to-app** communication. If users (admin or storefront) or integrations (API keys) need to call your endpoint, you **must** use resource-based policies in `service.json` with the route set to `"public": false`.

**Why this matters** — Setting up a role-based policy for a route that users or API keys call results in 403 Forbidden for those callers, because role-based policies don't evaluate user/integration tokens.

**Detection** — A private route that should be callable by admin users or external integrations, but only has `policies.json` configuration and no `policies` array in `service.json`.

**Correct** — Resource-based policy in `service.json` for user/integration access.

```json
{
  "routes": {
    "orders": {
      "path": "/_v/private/my-app/orders",
      "public": false,
      "policies": [
        {
          "effect": "allow",
          "actions": ["get", "post"],
          "principals": [
            "vrn:vtex.vtex-id:*:*:*:user/*@mycompany.com",
            "vrn:apps:*:*:*:app/partner.integration-app@*"
          ]
        }
      ]
    }
  }
}
```

**Wrong** — Only `policies.json` for a route that users need.

```json
// policies.json — this only covers app-to-app, not users
[{
  "name": "access-orders",
  "statements": [{
    "effect": "allow",
    "actions": ["get"],
    "resources": ["vrn:my-app:*:*:*:/_v/private/my-app/orders"]
  }]
}]
// Users calling this route still get 403
```

### Constraint: Deny policies take precedence over allow policies

When resource-based policies have overlapping principals between an `allow` and a `deny` rule, the **deny** always wins. Be careful with wildcards in allow rules that intersect with specific deny rules.

**Why this matters** — A broad `allow` for `app/*` combined with a specific `deny` for `app/vendor.bad-app@*` correctly blocks `bad-app`. But the reverse—a broad `deny` with a specific `allow`—blocks everything including what you wanted to allow.

**Detection** — Multiple policy entries for the same route with conflicting effects and overlapping principals.

**Correct** — Allow broadly, deny specifically.

```json
{
  "policies": [
    {
      "effect": "allow",
      "actions": ["post"],
      "principals": ["vrn:apps:*:*:*:app/*"]
    },
    {
      "effect": "deny",
      "actions": ["post"],
      "principals": ["vrn:apps:*:*:*:app/untrusted.app@*"]
    }
  ]
}
```

**Wrong** — Deny broadly, try to allow specifically (the allow is overridden).

```json
{
  "policies": [
    {
      "effect": "deny",
      "actions": ["post"],
      "principals": ["vrn:apps:*:*:*:app/*"]
    },
    {
      "effect": "allow",
      "actions": ["post"],
      "principals": ["vrn:apps:*:*:*:app/trusted.app@*"]
    }
  ]
}
```

## Preferred pattern

### Role-based policy (`policies.json`)

```json
[
  {
    "name": "resolve-graphql",
    "description": "Allows apps to resolve GraphQL requests",
    "statements": [
      {
        "effect": "allow",
        "actions": ["post"],
        "resources": [
          "vrn:vtex.store-graphql:{{region}}:{{account}}:{{workspace}}:/_v/graphql"
        ]
      }
    ]
  }
]
```

The consuming app declares the policy in its `manifest.json`:

```json
{
  "policies": [
    {
      "name": "resolve-graphql"
    }
  ]
}
```

### Resource-based policy for mixed access

```json
{
  "routes": {
    "webhook": {
      "path": "/_v/private/my-app/webhook",
      "public": false,
      "policies": [
        {
          "effect": "allow",
          "actions": ["post"],
          "principals": [
            "vrn:apps:*:*:*:app/vtex.orders-broadcast@*",
            "vrn:vtex.vtex-id:*:*:*:user/vtexappkey-myaccount-*"
          ]
        }
      ]
    }
  }
}
```

### GraphQL `@auth` directive

For GraphQL endpoints, use the `@auth` directive for user-level authorization:

```graphql
type Query {
  orders: [Order] @auth(productCode: "10", resourceCode: "list-orders")
  adminSettings: Settings @auth(productCode: "10", resourceCode: "admin-settings")
}

type Mutation {
  updateSettings(input: SettingsInput!): Settings @auth(productCode: "10", resourceCode: "admin-settings")
}
```

The `@auth` directive checks the caller's License Manager role for the specified `productCode` and `resourceCode`.

## Common failure modes

- **403 for users on role-based routes** — Route only has `policies.json`; users and API keys get 403 because role-based policies don't apply to them.
- **Overly broad `public: true`** — Route set to public when it should be private. Anyone can call it without auth.
- **Missing policy in consumer manifest** — App tries to call a role-based protected route but didn't declare the policy in its `manifest.json`. Results in 403.
- **VRN typo** — Misspelled vendor, app name, or principal format in VRN. Silently fails to match, resulting in 403.
- **Wildcard in deny** — Broad deny with `app/*` blocks all apps including trusted ones. Deny takes precedence.
- **No `@auth` on GraphQL mutations** — Mutations that modify data accessible without role checks.

## Review checklist

- [ ] Is the access control type (role-based vs resource-based) correct for the callers (apps vs users/integrations)?
- [ ] Are private routes set to `"public": false` with appropriate policies?
- [ ] Are VRNs correctly formatted for the principal type (apps, users, API keys)?
- [ ] Do consuming apps declare required role-based policies in their `manifest.json`?
- [ ] Are deny rules used carefully (they override allow rules for intersecting principals)?
- [ ] Do GraphQL mutations have `@auth` directives with correct `productCode` and `resourceCode`?
- [ ] Are wildcard principals scoped as narrowly as possible?

## Related skills

- [vtex-io-service-apps](vtex-io-vtex-io-service-apps.md) — Service class, clients, and route configuration
- [vtex-io-app-structure](../vtex-io-app-structure/skill.md) — Manifest, builders, and policy declarations
- [vtex-io-graphql-api](vtex-io-vtex-io-graphql-api.md) — GraphQL schema and `@auth` directive details
- [vtex-io-service-paths-and-cdn](vtex-io-vtex-io-service-paths-and-cdn.md) — Route prefix patterns

## Reference

- [Controlling Access to App Resources](https://developers.vtex.com/docs/guides/controlling-access-to-app-resources) — Role-based and resource-based policies, VRN syntax, principal types
- [App Authentication Using Auth Tokens](https://developers.vtex.com/docs/guides/app-authentication-using-auth-tokens) — Auth token types for app-to-app and user-to-app communication
- [GraphQL Authorization in IO Apps](https://developers.vtex.com/docs/guides/graphql-authorization-in-io-apps) — @auth directive usage
- [VTEX IO VRN](https://developers.vtex.com/docs/guides/vtex-io-documentation-vrn) — VTEX Resource Name format and examples

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

# VTEX IO rootPath for multi-binding stores

## When this skill applies

Use this skill when building VTEX IO apps that must work in stores with **multi-binding** configurations—typically **cross-border** stores where multiple bindings share a single domain with **path prefixes** (e.g. `store.com/us/`, `store.com/br/`, `store.com/mx/`).

- Your app generates **URLs** (links, redirects, API endpoints, canonical URLs) that must include the binding's path prefix
- Your app loads **assets** (images, scripts, stylesheets) that break when the store uses a sub-path binding
- Your **backend routes** need to construct URLs for sitemaps, canonical links, or cross-binding references
- You're debugging **404s** or **wrong links** that only appear in multi-binding stores but work fine in single-binding

Do not use this skill for:

- Single-binding stores with a dedicated domain per locale (no path prefix needed)
- General IO backend patterns (use `vtex-io-service-apps`)
- CDN/edge caching configuration (use `vtex-io-service-paths-and-cdn`)

## Decision rules

- **Single-domain multi-binding** (e.g. `store.com/us/`, `store.com/br/`) → `rootPath` is **required**. Every generated URL must be prefixed with the binding's root path.
- **Multi-domain single-binding** (e.g. `store.us`, `store.com.br`) → `rootPath` is typically **empty** or `/`. URLs work without prefixing, but code should still handle `rootPath` gracefully (use it if non-empty, skip if empty).
- **Backend (Node)** → Extract `rootPath` from the `x-vtex-root-path` request header. Sanitize: if the value is exactly `"/"`, treat it as empty string `""` to avoid double slashes.
- **Frontend (React)** → Use `useRuntime().rootPath` from `vtex.render-runtime` to get the current binding's path prefix in components.
- **Always prefix, never hardcode** — Never hardcode a path prefix like `/us/`. Always use the runtime-provided `rootPath` so the same code works across all bindings.

## Hard constraints

### Constraint: Always use rootPath when constructing URLs in multi-binding stores

Every URL your app generates—links, redirects, API endpoints, canonical URLs, sitemap entries—must include the `rootPath` prefix when the store uses path-based bindings.

**Why this matters** — Without `rootPath`, a link to `/my-account/orders` in the `/br/` binding points to the wrong binding (or 404s). Sitemaps with unprefixed URLs break SEO by pointing search engines to the wrong locale. Redirects without the prefix send users to the default binding instead of their current one.

**Detection** — URLs constructed as string literals (e.g. `/${slug}`) without prepending `rootPath`. Or `navigate()` calls that omit the `rootPath` prefix.

**Correct** — Prepend rootPath to all generated paths.

```typescript
// Backend: extract from header
const rawRootPath = ctx.get('x-vtex-root-path') || ''
const rootPath = rawRootPath === '/' ? '' : rawRootPath

const canonicalUrl = `https://${host}${rootPath}/product/${slug}`
const sitemapEntry = `${rootPath}/${categoryPath}`
```

```tsx
// Frontend: use runtime hook
import { useRuntime } from 'vtex.render-runtime'

const MyLink = ({ slug }: { slug: string }) => {
  const { rootPath } = useRuntime()
  return <a href={`${rootPath}/product/${slug}`}>View product</a>
}
```

**Wrong** — Hardcoded paths without rootPath.

```typescript
// Backend: missing rootPath — breaks in multi-binding
const canonicalUrl = `https://${host}/product/${slug}`

// Frontend: hardcoded path
const MyLink = ({ slug }: { slug: string }) => {
  return <a href={`/product/${slug}`}>View product</a>
}
```

### Constraint: Sanitize rootPath to avoid double slashes

When `rootPath` is `"/"` (single-binding or default binding), using it directly produces double slashes in URLs (e.g. `//product/shoes`). Normalize: if `rootPath === "/"`, treat it as `""`.

**Why this matters** — Double slashes in URLs cause redirect loops, broken canonical URLs, and SEO penalties. Some CDN layers treat `//path` differently from `/path`.

**Detection** — URL construction that concatenates `rootPath + "/" + path` without checking for `rootPath === "/"`.

**Correct**

```typescript
const rootPath = (ctx.get('x-vtex-root-path') || '') === '/' ? '' : (ctx.get('x-vtex-root-path') || '')
const url = `${rootPath}/${path}`
```

**Wrong**

```typescript
const rootPath = ctx.get('x-vtex-root-path') || '/'
const url = `${rootPath}/${path}` // Produces "//path" for default binding
```

## Preferred pattern

### Backend middleware for rootPath

```typescript
// node/middlewares/rootPath.ts
export async function withRootPath(ctx: Context, next: () => Promise<void>) {
  const raw = ctx.get('x-vtex-root-path') || ''
  ctx.state.rootPath = raw === '/' ? '' : raw
  await next()
}
```

### Frontend utility

```tsx
import { useRuntime } from 'vtex.render-runtime'

function usePrefixedPath(path: string): string {
  const { rootPath = '' } = useRuntime()
  const prefix = rootPath === '/' ? '' : rootPath
  return `${prefix}${path.startsWith('/') ? path : `/${path}`}`
}
```

### Binding-aware API calls from frontend

```tsx
const { rootPath, binding } = useRuntime()
// binding.id — current binding ID
// binding.canonicalBaseAddress — e.g. "store.com/br"
// rootPath — e.g. "/br"

// When calling backend APIs, the platform handles rootPath automatically
// for IO-internal calls. For external URLs or custom redirects, prefix manually.
```

## Common failure modes

- **Links break in multi-binding** — Navigation links constructed without `rootPath` send users to the wrong binding or 404.
- **Sitemap has wrong URLs** — Sitemap generator omits `rootPath`, causing search engines to index unprefixed URLs that resolve to the default binding.
- **Double slashes** — `rootPath === "/"` concatenated with `/path` produces `//path`. Normalize to empty string.
- **Hardcoded locale paths** — Using `/us/` or `/br/` instead of dynamic `rootPath`. Breaks when bindings are reconfigured.
- **Backend ignores header** — Node service constructs URLs without reading `x-vtex-root-path`, producing wrong canonicals in multi-binding.

## Review checklist

- [ ] Does the app read `rootPath` from `x-vtex-root-path` header (backend) or `useRuntime()` (frontend)?
- [ ] Are **all** generated URLs (links, redirects, canonicals, sitemaps) prefixed with `rootPath`?
- [ ] Is `rootPath === "/"` normalized to `""` to avoid double slashes?
- [ ] Are there **no** hardcoded locale path prefixes (e.g. `/us/`, `/br/`)?
- [ ] Does the app work correctly in both single-binding and multi-binding stores?

## Related skills

- [vtex-io-service-paths-and-cdn](vtex-io-vtex-io-service-paths-and-cdn.md) — Route prefixes and CDN behavior
- [vtex-io-service-apps](vtex-io-vtex-io-service-apps.md) — Backend middleware patterns
- [vtex-io-react-apps](vtex-io-vtex-io-react-apps.md) — Frontend component patterns

## Reference

- [Cross-Border Store Content Internationalization](https://developers.vtex.com/docs/guides/cross-border-custom-urls-1) — Multi-binding setup for cross-border stores
- [Service Path Patterns](https://developers.vtex.com/docs/guides/service-path-patterns) — Public, segment, and private path prefixes
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub

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

- [vtex-io-application-performance](vtex-io-vtex-io-application-performance.md) — Application performance (LRU, VBase, AppSettings, parallel fetches, tenant keys)
- [vtex-io-service-apps](vtex-io-vtex-io-service-apps.md) — `service.json` and Service entry
- [vtex-io-graphql-api](vtex-io-vtex-io-graphql-api.md) — GraphQL cache and `@cacheControl`
- [headless-caching-strategy](headless-headless-caching-strategy.md) — Storefront / BFF caching

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
      "myapp": [
        "costcenter",
        "organization",
        "postalCode",
        "priceTable",
        "storeNumber"
      ]
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
  "myapp.storeNumber",
  "myapp.priceTable",
  "storefront-permissions.costcenter",
  "storefront-permissions.organization",
]);
```

**Wrong**

```typescript
// Reading from public as if it were the source of truth
const { data } = useSessionItems([
  "public.storeNumber",
  "public.organization",
  "public.costCenter",
]);
```

## Preferred pattern

### `vtex.session/configuration.json`

Declare your transform's input dependencies and output fields:

```json
{
  "my-session-app": {
    "input": {
      "storefront-permissions": [
        "costcenter",
        "organization",
        "costCenterAddressId"
      ]
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
  const { costcenter, organization } = parseSfpInputs(ctx.request.body);

  if (!costcenter) {
    ctx.body = { myapp: {} };
    return;
  }

  const costCenterData = await getCostCenterCached(ctx, costcenter);
  const pricing = await resolvePricing(ctx, costCenterData);

  ctx.body = {
    myapp: {
      storeNumber: pricing.storeNumber,
      priceTable: pricing.priceTable,
    },
  };
}
```

### Caching inside the transform

```typescript
// Two-layer cache: LRU (sub-ms) -> VBase (persistent, SWR) -> API
const costCenterLRU = new LRU<string, CostCenterData>({
  max: 1000,
  ttl: 600_000,
});

async function getCostCenterCached(ctx: Context, costCenterId: string) {
  const { account, workspace } = ctx.vtex;
  const key = `${account}:${workspace}:${costCenterId}`;

  const lruHit = costCenterLRU.get(key);
  if (lruHit) return lruHit;

  const result = await staleFromVBaseWhileRevalidate(
    ctx.clients.vbase,
    "cost-centers",
    costCenterId,
    () => fetchCostCenterFromAPI(ctx, costCenterId),
    { ttlMs: 1_800_000 },
  );

  costCenterLRU.set(key, result);
  return result;
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

- [vtex-io-application-performance](vtex-io-vtex-io-application-performance.md) — Caching layers and parallel I/O applicable inside transforms
- [vtex-io-service-paths-and-cdn](vtex-io-vtex-io-service-paths-and-cdn.md) — Route prefix for the transform endpoint
- [vtex-io-service-apps](vtex-io-vtex-io-service-apps.md) — Service class, clients, and middleware basics
- [vtex-io-app-structure](../vtex-io-app-structure/skill.md) — Manifest, builders, policies

## Reference

- [VTEX Session System](https://developers.vtex.com/docs/guides/vtex-io-documentation-using-the-session-manager) — Session manager overview and API
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — VBase, MasterData, and custom clients
- [Engineering Guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices
