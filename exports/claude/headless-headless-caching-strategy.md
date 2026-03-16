This skill provides guidance for AI agents working with VTEX Headless Front-End Development. Apply these constraints and patterns when assisting developers with apply when implementing caching logic, cdn configuration, or performance optimization for a headless vtex storefront. covers which vtex apis can be cached (intelligent search, catalog) versus which must never be cached (checkout, profile, oms), stale-while-revalidate patterns, cache invalidation, and bff-level caching. use for any headless project that needs ttl rules and caching strategy guidance.

# Caching & Performance for Headless VTEX

## Overview

**What this skill covers**: Caching strategies for headless VTEX storefronts, including which APIs can be aggressively cached, which must never be cached, CDN configuration, BFF-level caching with `stale-while-revalidate` patterns, and cache invalidation strategies.

**When to use it**: When building or optimizing a headless VTEX storefront for performance. Proper caching is the single most impactful performance optimization for headless commerce — it reduces latency, server load, and API rate limit consumption while improving shopper experience.

**What you'll learn**:
- How to classify VTEX APIs into cacheable (public/read-only) vs non-cacheable (transactional/personal)
- How to implement CDN caching for Intelligent Search and Catalog APIs
- How to add BFF-level caching with `stale-while-revalidate` for optimal freshness/performance balance
- How to implement cache invalidation when catalog data changes

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: API Cacheability Classification

VTEX APIs fall into two categories based on whether their responses can be cached:

**Cacheable APIs** (public, read-only, non-personalized):
| API | Example Endpoints | Recommended TTL |
|---|---|---|
| Intelligent Search | `/api/io/_v/api/intelligent-search/product_search/` | 2-5 minutes |
| Catalog (public) | `/api/catalog_system/pub/category/tree/`, `/api/catalog_system/pub/products/search/` | 5-15 minutes |
| Intelligent Search autocomplete | `/api/io/_v/api/intelligent-search/autocomplete_suggestions` | 1-2 minutes |
| Intelligent Search top searches | `/api/io/_v/api/intelligent-search/top_searches` | 5-10 minutes |

**Non-cacheable APIs** (transactional, personalized, or sensitive):
| API | Example Endpoints | Why Not Cacheable |
|---|---|---|
| Checkout | `/api/checkout/pub/orderForm` | Cart data is per-user, changes with every action |
| Profile | `/api/profile-system/pvt/` | Personal data, GDPR/LGPD sensitive |
| OMS (Orders) | `/api/oms/pvt/orders` | Order status changes, user-specific |
| Payments | `/api/payments/` | Financial transactions, must always be real-time |
| Pricing (private) | `/api/pricing/pvt/` | May have per-user pricing rules |

### Concept 2: Cache Layers

In a headless VTEX architecture, caching can happen at multiple layers:

1. **CDN Edge Cache**: Caches responses closest to the user. Best for Intelligent Search (called directly from frontend). Use `Cache-Control` headers.
2. **BFF In-Memory Cache**: Caches VTEX API responses within the BFF process. Fast but limited by server memory. Good for category trees and top searches.
3. **BFF Distributed Cache (Redis/Memcached)**: Shared cache across multiple BFF instances. Best for catalog data that multiple users request.
4. **Browser Cache**: Client-side caching via `Cache-Control` headers. Good for static catalog data, but be careful with personalized data.

### Concept 3: Stale-While-Revalidate (SWR)

The `stale-while-revalidate` pattern serves cached (potentially stale) data immediately while asynchronously fetching fresh data in the background. This provides:

- **Instant responses**: Users see data immediately, even if slightly stale
- **Eventual freshness**: Cache is updated in the background for the next request
- **Resilience**: If the origin is down, stale data is still served

The HTTP header pattern: `Cache-Control: public, max-age=120, stale-while-revalidate=60`
- Serves cached data for 120 seconds without checking origin
- Between 120-180 seconds, serves stale data while fetching fresh data
- After 180 seconds, waits for fresh data before responding

### Concept 4: Cache Invalidation

Catalog data changes (product updates, price changes, new products) must eventually reflect on the storefront. Strategies:

- **Time-based (TTL)**: Set appropriate expiration times. Shorter TTL = fresher data but more origin load.
- **Event-driven**: Use VTEX webhooks/hooks to invalidate specific cache entries when data changes.
- **Manual purge**: Provide admin endpoints to force-clear cache for specific products or categories.

**Architecture/Data Flow**:

```text
Frontend (Browser)
    │
    ├── Direct to CDN (Intelligent Search)
    │   └── CDN Edge Cache (TTL: 2-5 min, SWR: 60s)
    │       └── VTEX Intelligent Search API
    │
    └── BFF Endpoints
        │
        ├── Cacheable routes (catalog, category tree)
        │   └── BFF Cache Layer (Redis/in-memory)
        │       └── VTEX Catalog API
        │
        └── Non-cacheable routes (checkout, profile, orders)
            └── Direct proxy to VTEX (NO CACHING)
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: MUST Cache Public Data Aggressively

**Rule**: Search results, catalog data, category trees, and other public read-only data MUST be cached at appropriate levels (CDN, BFF, or both). Without caching, every user request hits VTEX APIs directly.

**Why**: Without caching, a headless storefront generates an API request for every single page view, search, and category browse. This quickly exceeds VTEX API rate limits (causing 429 errors and degraded service), adds 200-500ms of latency per request, and creates a poor shopper experience. A store with 10,000 concurrent users making uncached search requests will overwhelm any API.

**Detection**: If a headless storefront calls Intelligent Search or Catalog APIs without any caching layer (no CDN cache headers, no BFF cache, no `Cache-Control` headers) → STOP immediately. Caching must be implemented for all public, read-only API responses.

✅ **CORRECT**:
```typescript
// BFF route with in-memory cache for category tree
import { Router, Request, Response } from "express";

const router = Router();

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  staleAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return {
    data: entry.data,
    isStale: now > entry.staleAt,
  };
}

function setCache<T>(key: string, data: T, maxAgeMs: number, swrMs: number): void {
  const now = Date.now();
  cache.set(key, {
    data,
    staleAt: now + maxAgeMs,
    expiresAt: now + maxAgeMs + swrMs,
  });
}

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const CATALOG_BASE = `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub`;

// Category tree — cache for 15 minutes, SWR for 5 minutes
router.get("/categories", async (_req: Request, res: Response) => {
  const cacheKey = "category-tree";
  const cached = getCached<unknown>(cacheKey);

  if (cached && !cached.isStale) {
    res.set("X-Cache", "HIT");
    return res.json(cached.data);
  }

  // If stale, serve stale data and refresh in background
  if (cached && cached.isStale) {
    res.set("X-Cache", "STALE");
    res.json(cached.data);

    // Background refresh
    fetch(`${CATALOG_BASE}/category/tree/3`)
      .then((r) => r.json())
      .then((data) => setCache(cacheKey, data, 15 * 60 * 1000, 5 * 60 * 1000))
      .catch((err) => console.error("Background cache refresh failed:", err));
    return;
  }

  // Cache miss — fetch and cache
  try {
    const response = await fetch(`${CATALOG_BASE}/category/tree/3`);
    const data = await response.json();
    setCache(cacheKey, data, 15 * 60 * 1000, 5 * 60 * 1000);
    res.set("X-Cache", "MISS");
    res.json(data);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});
```

❌ **WRONG**:
```typescript
// No caching — every request hits VTEX directly
router.get("/categories", async (_req: Request, res: Response) => {
  // This fires on EVERY request — 10,000 users = 10,000 API calls
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/catalog_system/pub/category/tree/3`
  );
  const data = await response.json();
  res.json(data); // No cache headers, no BFF cache, no CDN cache
});
```

---

### Constraint: MUST NOT Cache Transactional or Personal Data

**Rule**: Responses from Checkout API, Profile API, OMS API, and Payments API MUST NOT be cached at any layer — not in the CDN, not in BFF memory, not in Redis, and not in browser cache.

**Why**: Caching transactional data can cause catastrophic failures. A cached OrderForm means a shopper sees stale cart contents (wrong items, wrong prices). Cached profile data can leak one user's personal information to another user (especially behind shared caches). Cached order data shows stale statuses. Any of these is a security vulnerability, data privacy violation (GDPR/LGPD), or business logic failure.

**Detection**: If you see caching logic (Redis `set`, in-memory cache, `Cache-Control` headers with `max-age > 0`) applied to checkout, order, profile, or payment API responses → STOP immediately. These endpoints must always return fresh data.

✅ **CORRECT**:
```typescript
// BFF checkout route — explicitly no caching
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const checkoutRoutes = Router();

// Set no-cache headers for ALL checkout responses
checkoutRoutes.use((_req: Request, res: Response, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  next();
});

checkoutRoutes.get("/cart", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    // Always fetch fresh — never cache
    const result = await vtexCheckout({
      path: `/api/checkout/pub/orderForm/${orderFormId}`,
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});
```

❌ **WRONG**:
```typescript
// CATASTROPHIC: Caching checkout data in Redis
import Redis from "ioredis";
const redis = new Redis();

checkoutRoutes.get("/cart", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  const cacheKey = `cart:${orderFormId}`;

  // WRONG: cached cart could have wrong items, old prices, or stale quantities
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached)); // Serving stale transactional data!
  }

  const result = await vtexCheckout({
    path: `/api/checkout/pub/orderForm/${orderFormId}`,
    cookies: req.session.vtexCookies || {},
  });

  // WRONG: caching cart data that changes with every user action
  await redis.setex(cacheKey, 300, JSON.stringify(result.data));
  res.json(result.data);
});
```

---

### Constraint: MUST Implement Cache Invalidation Strategy

**Rule**: Every caching implementation MUST have a clear invalidation strategy. Cached data must have appropriate TTLs and there must be a mechanism to force-invalidate cache when the underlying data changes.

**Why**: Without invalidation, cached data becomes permanently stale. Products that are out of stock continue to appear available. Price changes don't reflect until the arbitrary TTL expires. New products are invisible. This leads to a poor shopper experience, failed orders (due to stale availability), and incorrect pricing.

**Detection**: If a caching implementation has no TTL (`max-age`, expiration time) or has very long TTLs (hours/days) without any invalidation mechanism → STOP immediately. All caches need bounded TTLs and ideally event-driven invalidation.

✅ **CORRECT**:
```typescript
// Cache with TTL + manual invalidation endpoint + event-driven invalidation
import { Router, Request, Response } from "express";

const router = Router();

// In-memory cache with TTL tracking
const productCache = new Map<string, { data: unknown; expiresAt: number }>();

function setProductCache(productId: string, data: unknown, ttlMs: number): void {
  productCache.set(productId, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function getProductCache(productId: string): unknown | null {
  const entry = productCache.get(productId);
  if (!entry || Date.now() > entry.expiresAt) {
    productCache.delete(productId);
    return null;
  }
  return entry.data;
}

// Regular product endpoint with cache
router.get("/products/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;
  const cached = getProductCache(productId);

  if (cached) {
    return res.json(cached);
  }

  const response = await fetch(
    `https://${process.env.VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`
  );
  const data = await response.json();

  setProductCache(productId, data, 5 * 60 * 1000); // 5-minute TTL
  res.json(data);
});

// Manual invalidation endpoint (secured with API key)
router.post("/cache/invalidate", (req: Request, res: Response) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { productId, pattern } = req.body as { productId?: string; pattern?: string };

  if (productId) {
    productCache.delete(productId);
    return res.json({ invalidated: [productId] });
  }

  if (pattern === "all") {
    const count = productCache.size;
    productCache.clear();
    return res.json({ invalidated: count });
  }

  res.status(400).json({ error: "Provide productId or pattern" });
});

// Webhook endpoint for VTEX catalog change events
router.post("/webhooks/catalog-change", (req: Request, res: Response) => {
  const { IdSku, productId } = req.body as { IdSku?: string; productId?: string };

  if (productId) {
    productCache.delete(productId);
    console.log(`Cache invalidated for product ${productId}`);
  }

  // Also invalidate related search cache entries
  // In production, use a more sophisticated invalidation strategy
  res.status(200).json({ received: true });
});

export default router;
```

❌ **WRONG**:
```typescript
// Cache with no TTL and no invalidation — data becomes permanently stale
const cache = new Map<string, unknown>();

router.get("/products/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;

  // Once cached, this data NEVER expires — price changes, stock updates are invisible
  if (cache.has(productId)) {
    return res.json(cache.get(productId));
  }

  const response = await fetch(`https://mystore.vtexcommercestable.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`);
  const data = await response.json();
  cache.set(productId, data); // No TTL! No invalidation! Stale forever!
  res.json(data);
});
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Set Up CDN Cache Headers for Intelligent Search

Since Intelligent Search is called directly from the frontend, use a CDN (e.g., Cloudflare, CloudFront, Fastly) to cache responses at the edge. Configure your CDN to respect `Cache-Control` headers or set custom caching rules for the search API path.

```typescript
// If you're using a CDN worker/edge function to add cache headers:
// cloudflare-worker.ts or similar edge function
async function handleSearchRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Only cache GET requests to Intelligent Search
  if (request.method !== "GET") {
    return fetch(request);
  }

  // Check CDN cache first
  const cacheKey = new Request(url.toString(), request);
  const cachedResponse = await caches.default.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Fetch from VTEX
  const response = await fetch(request);
  const responseClone = response.clone();

  // Add cache headers
  const cachedRes = new Response(responseClone.body, responseClone);
  cachedRes.headers.set(
    "Cache-Control",
    "public, max-age=120, stale-while-revalidate=60"
  );

  // Store in CDN cache
  await caches.default.put(cacheKey, cachedRes.clone());

  return cachedRes;
}
```

### Step 2: Implement BFF Cache Layer with Redis

For catalog data proxied through the BFF, use Redis as a shared cache that persists across BFF restarts and is shared across multiple instances.

```typescript
// server/cache/redis-cache.ts
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

interface CacheOptions {
  ttlSeconds: number;
  swrSeconds?: number;
}

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<{ data: T; cacheStatus: "HIT" | "STALE" | "MISS" }> {
  const { ttlSeconds, swrSeconds = 0 } = options;

  // Try to get from cache
  const cached = await redis.get(key);
  if (cached) {
    const ttl = await redis.ttl(key);
    const isStale = ttl <= swrSeconds;

    if (isStale && swrSeconds > 0) {
      // Serve stale, refresh in background
      fetcher()
        .then((freshData) =>
          redis.setex(key, ttlSeconds + swrSeconds, JSON.stringify(freshData))
        )
        .catch((err) => console.error(`Background refresh failed for ${key}:`, err));

      return { data: JSON.parse(cached) as T, cacheStatus: "STALE" };
    }

    return { data: JSON.parse(cached) as T, cacheStatus: "HIT" };
  }

  // Cache miss — fetch and store
  const data = await fetcher();
  await redis.setex(key, ttlSeconds + swrSeconds, JSON.stringify(data));

  return { data, cacheStatus: "MISS" };
}

export async function invalidateCache(pattern: string): Promise<number> {
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return 0;
  return redis.del(...keys);
}
```

### Step 3: Apply Caching to BFF Routes Selectively

Only cache public, read-only data. Never cache checkout, profile, or order data.

```typescript
// server/routes/catalog.ts
import { Router, Request, Response } from "express";
import { getCachedOrFetch, invalidateCache } from "../cache/redis-cache";

const router = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_BASE = `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br`;

// Category tree — long cache, changes rarely
router.get("/categories", async (_req: Request, res: Response) => {
  try {
    const result = await getCachedOrFetch(
      "catalog:categories",
      async () => {
        const response = await fetch(`${VTEX_BASE}/api/catalog_system/pub/category/tree/3`);
        return response.json();
      },
      { ttlSeconds: 900, swrSeconds: 300 } // 15 min cache, 5 min SWR
    );

    res.set("X-Cache", result.cacheStatus);
    res.json(result.data);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Product details — moderate cache
router.get("/products/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;

  if (!/^\d+$/.test(productId)) {
    return res.status(400).json({ error: "Invalid product ID" });
  }

  try {
    const result = await getCachedOrFetch(
      `catalog:product:${productId}`,
      async () => {
        const response = await fetch(
          `${VTEX_BASE}/api/catalog_system/pub/products/search?fq=productId:${productId}`
        );
        return response.json();
      },
      { ttlSeconds: 300, swrSeconds: 60 } // 5 min cache, 1 min SWR
    );

    res.set("X-Cache", result.cacheStatus);
    res.json(result.data);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Cart simulation — very short cache (same cart config may be checked by many users)
router.post("/simulation", async (req: Request, res: Response) => {
  const cacheKey = `catalog:simulation:${JSON.stringify(req.body)}`;

  try {
    const result = await getCachedOrFetch(
      cacheKey,
      async () => {
        const response = await fetch(
          `${VTEX_BASE}/api/checkout/pub/orderForms/simulation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
          }
        );
        return response.json();
      },
      { ttlSeconds: 30, swrSeconds: 10 } // 30 sec cache, 10 sec SWR
    );

    res.set("X-Cache", result.cacheStatus);
    res.json(result.data);
  } catch (error) {
    console.error("Error simulating cart:", error);
    res.status(500).json({ error: "Failed to simulate cart" });
  }
});

// Webhook for catalog changes — invalidates affected cache
router.post("/webhooks/catalog", async (req: Request, res: Response) => {
  const { productId } = req.body as { productId?: string };

  if (productId) {
    await invalidateCache(`catalog:product:${productId}`);
  }

  // Invalidate category tree on any catalog change
  await invalidateCache("catalog:categories");

  res.status(200).json({ received: true });
});

export default router;
```

### Complete Example

Full caching setup with CDN headers, BFF cache, and no-cache enforcement for transactional routes:

```typescript
// server/middleware/cache-headers.ts
import { Request, Response, NextFunction } from "express";

// Middleware to set appropriate cache headers based on route type
export function cacheHeaders(type: "public" | "private" | "no-cache") {
  return (_req: Request, res: Response, next: NextFunction) => {
    switch (type) {
      case "public":
        res.set({
          "Cache-Control": "public, max-age=120, stale-while-revalidate=60",
          Vary: "Accept-Encoding",
        });
        break;
      case "private":
        res.set({
          "Cache-Control": "private, max-age=60",
          Vary: "Accept-Encoding, Cookie",
        });
        break;
      case "no-cache":
        res.set({
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "Surrogate-Control": "no-store",
        });
        break;
    }
    next();
  };
}

// server/index.ts — apply cache strategies per route group
import express from "express";
import { cacheHeaders } from "./middleware/cache-headers";
import catalogRoutes from "./routes/catalog";
import { checkoutRoutes } from "./routes/checkout";
import { orderRoutes } from "./routes/orders";
import { profileRoutes } from "./routes/profile";

const app = express();
app.use(express.json());

// Cacheable routes — public catalog data
app.use("/api/bff/catalog", cacheHeaders("public"), catalogRoutes);

// Non-cacheable routes — transactional and personal data
app.use("/api/bff/checkout", cacheHeaders("no-cache"), checkoutRoutes);
app.use("/api/bff/orders", cacheHeaders("no-cache"), orderRoutes);
app.use("/api/bff/profile", cacheHeaders("no-cache"), profileRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BFF server running on port ${PORT}`);
});
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Caching Based on Session or User Identity

**What happens**: Developers create per-user caches for catalog data (e.g., caching product search results keyed by user ID).

**Why it fails**: Catalog data is the same for all anonymous users in the same trade policy. Creating per-user cache entries multiplies storage requirements by the number of users and eliminates the primary benefit of caching (serving the same response to many users). A store with 50,000 users and 1,000 unique searches would create 50 million cache entries instead of 1,000.

**Fix**: Cache public API responses by request URL/params only, not by user. Only skip cache or add user context for personalized pricing scenarios tied to specific trade policies.

```typescript
// Cache key based on request parameters only — not user identity
function buildCacheKey(path: string, params: Record<string, string>): string {
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `search:${path}:${sortedParams}`;
}

// For trade-policy-specific pricing, include trade policy (not user ID)
function buildTradePolicyCacheKey(path: string, params: Record<string, string>, tradePolicy: string): string {
  return `search:tp${tradePolicy}:${path}:${new URLSearchParams(params).toString()}`;
}
```

---

### Anti-Pattern: Setting Extremely Long Cache TTLs Without Invalidation

**What happens**: Developers set cache TTLs of hours or days to maximize cache hit rates, but provide no invalidation mechanism.

**Why it fails**: Long TTLs mean that price changes, stock updates, and new product launches are invisible to shoppers for hours or days. A product that sells out continues to appear available. A flash sale price doesn't take effect until the cache expires. This leads to failed orders, customer frustration, and potential legal issues with displayed pricing.

**Fix**: Use moderate TTLs (2-15 minutes for search, 5-15 minutes for catalog) combined with event-driven invalidation. The `stale-while-revalidate` pattern allows instant responses while still checking for fresh data regularly.

```typescript
// Moderate TTL with stale-while-revalidate — balances freshness and performance
const CACHE_CONFIG = {
  search: { ttlSeconds: 120, swrSeconds: 60 },      // 2 min + 1 min SWR
  categories: { ttlSeconds: 900, swrSeconds: 300 },  // 15 min + 5 min SWR
  product: { ttlSeconds: 300, swrSeconds: 60 },       // 5 min + 1 min SWR
  topSearches: { ttlSeconds: 600, swrSeconds: 120 },  // 10 min + 2 min SWR
} as const;
```

---

### Anti-Pattern: No Cache Monitoring or Observability

**What happens**: Developers implement caching but have no way to measure cache hit rates, miss rates, or stale-serve rates.

**Why it fails**: Without monitoring, you cannot tell if caching is effective, if TTLs are appropriate, or if cache invalidation is working. A cache with a 5% hit rate provides almost no benefit while adding complexity. A cache that never invalidates may be serving stale data without anyone noticing.

**Fix**: Add cache status headers and logging to track hit/miss/stale rates. Monitor these metrics in your observability platform.

```typescript
// Add cache observability to every cached response
import { Request, Response, NextFunction } from "express";

interface CacheMetrics {
  hits: number;
  misses: number;
  stale: number;
}

const metrics: CacheMetrics = { hits: 0, misses: 0, stale: 0 };

export function trackCacheMetrics(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown) {
    const cacheStatus = res.getHeader("X-Cache") as string;

    if (cacheStatus === "HIT") metrics.hits++;
    else if (cacheStatus === "MISS") metrics.misses++;
    else if (cacheStatus === "STALE") metrics.stale++;

    return originalJson(body);
  };

  next();
}

// Expose metrics endpoint for monitoring
export function getCacheMetrics(): CacheMetrics & { hitRate: string } {
  const total = metrics.hits + metrics.misses + metrics.stale;
  const hitRate = total > 0 ? ((metrics.hits / total) * 100).toFixed(1) + "%" : "N/A";
  return { ...metrics, hitRate };
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [How the cache works](https://help.vtex.com/en/docs/tutorials/understanding-how-the-cache-works) — VTEX native caching behavior and cache layer architecture
- [Cloud infrastructure](https://developers.vtex.com/docs/guides/cloud-infrastructure) — VTEX CDN, router, and caching infrastructure overview
- [Best practices for avoiding rate limit errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Caching as a strategy to avoid API rate limits
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — Cache patterns for VTEX IO (useful reference for cache scope concepts)
- [Intelligent Search API](https://developers.vtex.com/docs/api-reference/intelligent-search-api) — The primary cacheable API for headless storefronts
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores
