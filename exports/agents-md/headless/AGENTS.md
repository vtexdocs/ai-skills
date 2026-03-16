# AGENTS.md — Headless Front-End Development

These instructions guide AI agents working on VTEX Headless Front-End Development tasks.
Follow these patterns and constraints when assisting developers.

## headless-bff-architecture

> Apply when designing or modifying a BFF (Backend-for-Frontend) layer, middleware, or API proxy for a headless VTEX storefront. Covers BFF middleware architecture, public vs private API classification, VtexIdclientAutCookie management, API key protection, and secure request proxying. Use for any headless commerce project that must never expose VTEX_APP_KEY or call private VTEX APIs from the browser.

# BFF Layer Design & Security

## Overview

**What this skill covers**: The Backend-for-Frontend (BFF) architecture pattern for headless VTEX storefronts, including secure API proxying, credential management, and the critical separation between public and private VTEX APIs.

**When to use it**: When building any headless frontend that communicates with VTEX APIs — whether a custom storefront, mobile app, or kiosk. Every headless project needs a BFF layer to protect API credentials and manage authentication tokens server-side.

**What you'll learn**:
- Why a BFF layer is mandatory for headless VTEX (not optional)
- How to classify VTEX APIs as public vs private and route them accordingly
- How to manage `VtexIdclientAutCookie` server-side and proxy authenticated requests
- How to protect `VTEX_APP_KEY` and `VTEX_APP_TOKEN` from client-side exposure

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Public vs Private VTEX APIs

VTEX APIs fall into two categories based on their authentication requirements:

- **Public APIs** (`/pub/` in the path): Can be called without API keys. Examples include Intelligent Search (`/api/io/_v/api/intelligent-search/`), Catalog public endpoints (`/api/catalog_system/pub/`), and Checkout public endpoints (`/api/checkout/pub/`). However, even public Checkout endpoints should still be proxied through BFF for security.
- **Private APIs** (`/pvt/` in the path): Require `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers. Examples include OMS (`/api/oms/pvt/`), Profile System (`/api/profile-system/pvt/`), and Pricing (`/api/pricing/pvt/`). These must NEVER be called from client-side code.

The only API safe to call directly from the frontend is Intelligent Search, because it is fully public and designed for client-side use.

### Concept 2: VtexIdclientAutCookie

When a shopper logs in to a VTEX store, the platform issues a JWT token set as a cookie named `VtexIdclientAutCookie`. This token:

- Is valid for 24 hours after creation
- Authenticates requests on behalf of the shopper
- Has scoped permissions (shoppers can only perform shopping-related actions)
- Must be stored and managed server-side in headless implementations
- Can be refreshed using the VTEX ID refresh token flow

In headless stores, the BFF layer intercepts the login callback, extracts the `VtexIdclientAutCookie`, stores it in a secure server-side session, and uses it to authenticate subsequent API calls on behalf of the shopper.

### Concept 3: Machine Authentication (API Keys)

For server-to-server communication where no shopper context is needed, VTEX uses application keys:

- `X-VTEX-API-AppKey`: The public identifier for the credential pair
- `X-VTEX-API-AppToken`: The secret token associated with the key

These credentials are configured in License Manager with specific roles and permissions. They must only exist in server-side environment variables and never be transmitted to or accessible from client-side code.

**Architecture/Data Flow**:

```text
Frontend (Browser/App)
    │
    ├── Direct call (OK): Intelligent Search API (public, read-only)
    │
    └── All other requests → BFF Layer (Node.js/Express)
                                │
                                ├── Injects VtexIdclientAutCookie from session
                                ├── Injects X-VTEX-API-AppKey / X-VTEX-API-AppToken
                                ├── Validates & sanitizes input
                                └── Proxies to VTEX APIs
                                        │
                                        ├── Checkout API (/api/checkout/pub/...)
                                        ├── OMS API (/api/oms/pvt/...)
                                        ├── Profile API (/api/profile-system/pvt/...)
                                        └── Other VTEX services
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Frontend MUST NOT Call Private VTEX APIs

**Rule**: Client-side code (browser JavaScript, mobile app networking layer) MUST NOT make direct HTTP requests to private VTEX API endpoints. All private API calls must be routed through the BFF.

**Why**: Private VTEX APIs require `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers. If the frontend calls these APIs directly, the credentials must be embedded in client-side code or transmitted to the browser, exposing them to any user who opens browser DevTools. Stolen API keys can be used to access order data, modify pricing, or perform destructive administrative actions.

**Detection**: If you see `fetch` or `axios` calls to `vtexcommercestable.com.br/api/checkout`, `/api/oms`, `/api/profile`, or any `/pvt/` endpoint in client-side code (files under `src/`, `public/`, `app/`, or any browser-executed bundle) → STOP immediately. These calls must be moved to the BFF.

✅ **CORRECT**:
```typescript
// Frontend code — calls BFF, not VTEX directly
async function getOrderDetails(orderId: string): Promise<Order> {
  const response = await fetch(`/api/bff/orders/${orderId}`, {
    credentials: "include", // sends session cookie to BFF
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch order: ${response.status}`);
  }

  return response.json();
}
```

❌ **WRONG**:
```typescript
// Frontend code — calls VTEX OMS API directly (SECURITY VULNERABILITY)
async function getOrderDetails(orderId: string): Promise<Order> {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/oms/pvt/orders/${orderId}`,
    {
      headers: {
        "X-VTEX-API-AppKey": "vtexappkey-mystore-ABCDEF", // EXPOSED!
        "X-VTEX-API-AppToken": "eyJhbGciOi...", // EXPOSED!
      },
    }
  );
  return response.json();
}
```

---

### Constraint: VtexIdclientAutCookie MUST Be Managed Server-Side

**Rule**: The `VtexIdclientAutCookie` token MUST be stored in a secure server-side session (e.g., encrypted cookie, Redis session store) and MUST NOT be stored in `localStorage`, `sessionStorage`, or any client-accessible JavaScript variable.

**Why**: The `VtexIdclientAutCookie` is a bearer token that authenticates all actions on behalf of a shopper — placing orders, viewing profile data, accessing payment information. If stored client-side, it can be stolen via XSS attacks, browser extensions, or shared/public computers. An attacker with this token can impersonate the shopper.

**Detection**: If you see `VtexIdclientAutCookie` referenced in `localStorage.setItem`, `sessionStorage.setItem`, or assigned to a JavaScript variable in client-side code → STOP immediately. The token must be managed exclusively server-side.

✅ **CORRECT**:
```typescript
// BFF route — stores VtexIdclientAutCookie in server-side session
import { Router, Request, Response } from "express";
import session from "express-session";

const router = Router();

// After VTEX login callback, extract and store token server-side
router.get("/auth/callback", async (req: Request, res: Response) => {
  const vtexAuthToken = req.cookies["VtexIdclientAutCookie"];

  if (!vtexAuthToken) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  // Store in server-side session — never sent to frontend
  req.session.vtexAuthToken = vtexAuthToken;

  // Clear the cookie from the browser response
  res.clearCookie("VtexIdclientAutCookie");

  // Redirect to frontend with a secure session cookie
  res.redirect("/account");
});

// BFF proxy uses session token for VTEX API calls
router.get("/api/bff/profile", async (req: Request, res: Response) => {
  const vtexToken = req.session.vtexAuthToken;

  if (!vtexToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const response = await fetch(
    `https://${process.env.VTEX_ACCOUNT}.vtexcommercestable.com.br/api/checkout/pub/profiles`,
    {
      headers: {
        Cookie: `VtexIdclientAutCookie=${vtexToken}`,
      },
    }
  );

  const profile = await response.json();
  res.json(profile);
});
```

❌ **WRONG**:
```typescript
// Frontend code — stores auth token in localStorage (SECURITY VULNERABILITY)
function handleLoginCallback() {
  const params = new URLSearchParams(window.location.search);
  const vtexToken = params.get("authToken");

  // WRONG: token is now accessible to any JS on the page, including XSS payloads
  localStorage.setItem("VtexIdclientAutCookie", vtexToken!);
}

// Later, reads from localStorage and sends in header
async function getProfile() {
  const token = localStorage.getItem("VtexIdclientAutCookie"); // EXPOSED!
  return fetch("https://mystore.vtexcommercestable.com.br/api/checkout/pub/profiles", {
    headers: { Cookie: `VtexIdclientAutCookie=${token}` },
  });
}
```

---

### Constraint: API Keys MUST NOT Appear in Client-Side Code

**Rule**: `VTEX_APP_KEY` and `VTEX_APP_TOKEN` values MUST only exist in server-side environment variables and MUST NOT be present in any file that is bundled, served, or accessible to the browser.

**Why**: API keys grant programmatic access to the VTEX platform with the permissions of their associated role. Exposing them in frontend bundles, public directories, or client-side environment variables (e.g., `NEXT_PUBLIC_*`, `VITE_*`) allows anyone to extract them and make unauthorized API calls.

**Detection**: If you see `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `X-VTEX-API-AppKey`, or `X-VTEX-API-AppToken` in files under `src/`, `public/`, `app/` directories, or in environment variables prefixed with `NEXT_PUBLIC_`, `VITE_`, or `REACT_APP_` → STOP immediately. Move these to server-side-only environment variables.

✅ **CORRECT**:
```typescript
// BFF server code — reads keys from server-side env vars only
// File: server/vtex-client.ts (never bundled for browser)
import { Router, Request, Response } from "express";

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

const router = Router();

router.get("/api/bff/orders/:orderId", async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const response = await fetch(
    `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br/api/oms/pvt/orders/${orderId}`,
    {
      headers: {
        "X-VTEX-API-AppKey": VTEX_APP_KEY,
        "X-VTEX-API-AppToken": VTEX_APP_TOKEN,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    return res.status(response.status).json({ error: "Failed to fetch order" });
  }

  const order = await response.json();
  res.json(order);
});

export default router;
```

❌ **WRONG**:
```typescript
// .env file with NEXT_PUBLIC_ prefix — exposed to browser bundle!
// NEXT_PUBLIC_VTEX_APP_KEY=vtexappkey-mystore-ABCDEF
// NEXT_PUBLIC_VTEX_APP_TOKEN=eyJhbGciOi...

// Frontend code reads exposed env vars
async function fetchOrders() {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/oms/pvt/orders`,
    {
      headers: {
        "X-VTEX-API-AppKey": process.env.NEXT_PUBLIC_VTEX_APP_KEY!, // EXPOSED IN BUNDLE!
        "X-VTEX-API-AppToken": process.env.NEXT_PUBLIC_VTEX_APP_TOKEN!, // EXPOSED IN BUNDLE!
      },
    }
  );
  return response.json();
}
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Set Up the BFF Server

Create an Express server that will serve as the BFF layer between your frontend and VTEX APIs. All VTEX credentials live exclusively in this server's environment.

```typescript
// server/index.ts
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import { checkoutRoutes } from "./routes/checkout";
import { profileRoutes } from "./routes/profile";
import { ordersRoutes } from "./routes/orders";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches VtexIdclientAutCookie TTL)
    },
  })
);

// Mount BFF routes
app.use("/api/bff/checkout", checkoutRoutes);
app.use("/api/bff/profile", profileRoutes);
app.use("/api/bff/orders", ordersRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BFF server running on port ${PORT}`);
});
```

### Step 2: Create a VTEX API Client with Credential Injection

Build a shared utility that injects the correct authentication headers for each request type — either API keys for machine-to-machine calls or `VtexIdclientAutCookie` for shopper-scoped calls.

```typescript
// server/vtex-api-client.ts
const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

const BASE_URL = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br`;

interface VtexRequestOptions {
  path: string;
  method?: string;
  body?: unknown;
  authType: "app-key" | "user-token";
  userToken?: string;
}

export async function vtexRequest<T>(options: VtexRequestOptions): Promise<T> {
  const { path, method = "GET", body, authType, userToken } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (authType === "app-key") {
    headers["X-VTEX-API-AppKey"] = VTEX_APP_KEY;
    headers["X-VTEX-API-AppToken"] = VTEX_APP_TOKEN;
  } else if (authType === "user-token" && userToken) {
    headers["Cookie"] = `VtexIdclientAutCookie=${userToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `VTEX API error: ${response.status} ${response.statusText} for ${method} ${path}`
    );
  }

  return response.json() as Promise<T>;
}
```

### Step 3: Implement BFF Route Handlers

Create route handlers that validate incoming requests, extract session data, and proxy to VTEX APIs with proper authentication.

```typescript
// server/routes/orders.ts
import { Router, Request, Response } from "express";
import { vtexRequest } from "../vtex-api-client";

export const ordersRoutes = Router();

// Get order details — requires API key auth (private endpoint)
ordersRoutes.get("/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Validate input
    if (!/^[a-zA-Z0-9-]+$/.test(orderId)) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    // Optionally check user session for authorization
    const vtexToken = req.session.vtexAuthToken;
    if (!vtexToken) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const order = await vtexRequest({
      path: `/api/oms/pvt/orders/${orderId}`,
      authType: "app-key",
    });

    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});
```

### Complete Example

A full BFF setup with authentication flow, session management, and API proxying:

```typescript
// server/routes/auth.ts
import { Router, Request, Response } from "express";

export const authRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_LOGIN_URL = `https://${VTEX_ACCOUNT}.myvtex.com/login`;
const FRONTEND_URL = process.env.FRONTEND_URL!;

// Redirect shopper to VTEX login page
authRoutes.get("/login", (_req: Request, res: Response) => {
  const returnUrl = `${FRONTEND_URL}/auth/callback`;
  res.redirect(`${VTEX_LOGIN_URL}?returnUrl=${encodeURIComponent(returnUrl)}`);
});

// Handle login callback — extract VtexIdclientAutCookie and store server-side
authRoutes.get("/callback", (req: Request, res: Response) => {
  const vtexToken = req.cookies["VtexIdclientAutCookie"];

  if (!vtexToken) {
    return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }

  // Store token in server-side session
  req.session.vtexAuthToken = vtexToken;

  // Clear the VTEX cookie from the browser
  res.clearCookie("VtexIdclientAutCookie");

  // Redirect to authenticated frontend page
  res.redirect(`${FRONTEND_URL}/account`);
});

// Logout — destroy session
authRoutes.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// Check authentication status
authRoutes.get("/status", (req: Request, res: Response) => {
  res.json({
    authenticated: !!req.session.vtexAuthToken,
  });
});
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Proxying All APIs Including Intelligent Search

**What happens**: Developers route every VTEX API call through the BFF, including Intelligent Search, adding unnecessary latency and server load to search queries.

**Why it fails**: Intelligent Search is a public, read-only API designed for direct frontend consumption. Proxying it through the BFF adds a network hop, increases latency on every search interaction, and puts unnecessary load on the BFF server. Search queries are high-frequency operations that benefit from direct CDN-cached responses.

**Fix**: Call Intelligent Search directly from the frontend. Only proxy APIs that require authentication or handle sensitive data.

```typescript
// Frontend code — call Intelligent Search directly (this is correct!)
async function searchProducts(query: string, from: number = 0, to: number = 19): Promise<SearchResult> {
  const baseUrl = `https://${STORE_ACCOUNT}.vtexcommercestable.com.br`;
  const response = await fetch(
    `${baseUrl}/api/io/_v/api/intelligent-search/product_search/?query=${encodeURIComponent(query)}&from=${from}&to=${to}&locale=en-US`,
  );
  return response.json();
}
```

---

### Anti-Pattern: Sharing a Single API Key Across All BFF Operations

**What happens**: Developers use one API key with broad permissions (e.g., Owner role) for all BFF operations instead of creating scoped keys for different operations.

**Why it fails**: If the API key is compromised (e.g., via a server vulnerability or log leak), the attacker gains access to every VTEX resource. The principle of least privilege requires that each key only has the permissions it needs.

**Fix**: Create separate API keys for different BFF modules with minimal required permissions. Use one key for OMS read access, another for checkout operations, etc.

```typescript
// server/vtex-credentials.ts — separate keys per domain
export const credentials = {
  oms: {
    appKey: process.env.VTEX_OMS_APP_KEY!,
    appToken: process.env.VTEX_OMS_APP_TOKEN!,
  },
  checkout: {
    appKey: process.env.VTEX_CHECKOUT_APP_KEY!,
    appToken: process.env.VTEX_CHECKOUT_APP_TOKEN!,
  },
  catalog: {
    appKey: process.env.VTEX_CATALOG_APP_KEY!,
    appToken: process.env.VTEX_CATALOG_APP_TOKEN!,
  },
} as const;
```

---

### Anti-Pattern: Logging API Credentials or Auth Tokens

**What happens**: Developers log request headers or full request objects during debugging, inadvertently writing API keys or `VtexIdclientAutCookie` values to log files.

**Why it fails**: Log files are often stored in centralized logging systems (e.g., CloudWatch, Datadog) accessible to multiple team members. Credentials in logs can be harvested by anyone with log access or by attackers who compromise the logging infrastructure.

**Fix**: Sanitize all log output to strip sensitive headers before logging. Never log full request/response objects.

```typescript
// server/middleware/request-logger.ts
import { Request, Response, NextFunction } from "express";

const SENSITIVE_HEADERS = [
  "x-vtex-api-appkey",
  "x-vtex-api-apptoken",
  "cookie",
  "authorization",
];

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  const sanitizedHeaders = Object.fromEntries(
    Object.entries(req.headers).map(([key, value]) =>
      SENSITIVE_HEADERS.includes(key.toLowerCase())
        ? [key, "[REDACTED]"]
        : [key, value]
    )
  );

  console.log({
    method: req.method,
    path: req.path,
    headers: sanitizedHeaders,
    timestamp: new Date().toISOString(),
  });

  next();
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — Core architecture guide for building headless stores on VTEX
- [Headless authentication](https://developers.vtex.com/docs/guides/headless-authentication) — OAuth-based shopper authentication flow for headless implementations
- [API authentication using API keys](https://developers.vtex.com/docs/guides/api-authentication-using-api-keys) — How to use appKey/appToken pairs for machine authentication
- [API authentication using user tokens](https://developers.vtex.com/docs/guides/api-authentication-using-user-tokens) — How VtexIdclientAutCookie works and its scopes
- [Refresh token flow for headless implementations](https://developers.vtex.com/docs/guides/refresh-token-flow-for-headless-implementations) — How to refresh expired VtexIdclientAutCookie tokens
- [Best practices for using application keys](https://help.vtex.com/en/tutorial/best-practices-api-keys--7b6nD1VMHa49aI5brlOvJm) — VTEX security guidelines for API key management

---

## headless-caching-strategy

> Apply when implementing caching logic, CDN configuration, or performance optimization for a headless VTEX storefront. Covers which VTEX APIs can be cached (Intelligent Search, Catalog) versus which must never be cached (Checkout, Profile, OMS), stale-while-revalidate patterns, cache invalidation, and BFF-level caching. Use for any headless project that needs TTL rules and caching strategy guidance.

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

---

## headless-checkout-proxy

> Apply when implementing cart, checkout, or order placement logic proxied through a BFF for headless VTEX storefronts. Covers OrderForm lifecycle, cart creation, item management, profile/shipping/payment attachments, orderFormId management, and secure checkout flows. Use for any headless frontend that needs to proxy VTEX Checkout API calls through a server-side layer with proper session cookie handling.

# Checkout API Proxy & OrderForm Management

## Overview

**What this skill covers**: How to securely proxy VTEX Checkout API operations through a BFF layer in headless implementations, including OrderForm lifecycle management, cart operations, order placement, and the checkout completion flow.

**When to use it**: When building any headless storefront that needs shopping cart and checkout functionality. Every cart and checkout operation must go through the BFF — the Checkout API handles sensitive customer data (profile, address, payment) and must never be called directly from client-side code.

**What you'll learn**:
- The OrderForm data structure and its lifecycle from cart creation to order placement
- How to proxy all Checkout API operations through the BFF securely
- How to manage `orderFormId` and `CheckoutOrderFormOwnership` cookie server-side
- How to validate inputs server-side before forwarding to VTEX

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: The OrderForm

The `orderForm` is the central data structure of VTEX Checkout. It contains every piece of information about a purchase:

- **items**: Products in the cart (SKU ID, quantity, seller, price)
- **clientProfileData**: Customer profile (email, name, document, phone)
- **shippingData**: Delivery address and selected shipping option
- **paymentData**: Payment method, installments, card info
- **marketingData**: Coupons, UTM parameters
- **totalizers**: Subtotals, discounts, shipping costs

Each `orderForm` has a unique `orderFormId` that identifies the cart. When you call `GET /api/checkout/pub/orderForm`, VTEX either returns the current cart (if one exists for the session) or creates a new one.

### Concept 2: OrderForm Sections (Attachments)

Cart data is organized into "attachments" — sections of the OrderForm that can be updated independently:

| Attachment | Endpoint | Purpose |
|---|---|---|
| items | `POST .../orderForm/{id}/items` | Add, remove, or update cart items |
| clientProfileData | `POST .../orderForm/{id}/attachments/clientProfileData` | Customer profile info |
| shippingData | `POST .../orderForm/{id}/attachments/shippingData` | Address and delivery option |
| paymentData | `POST .../orderForm/{id}/attachments/paymentData` | Payment method selection |
| marketingData | `POST .../orderForm/{id}/attachments/marketingData` | Coupons and UTM data |

Each attachment update returns the full updated `orderForm`, so you always have the current state.

### Concept 3: Order Placement Flow

Placing an order in VTEX follows a strict 3-step sequence that must complete within 5 minutes:

1. **Place order**: `POST /api/checkout/pub/orderForm/{orderFormId}/transaction` — Creates the order from the cart
2. **Send payment**: `POST /api/payments/transactions/{transactionId}/payments` — Sends payment details to the gateway
3. **Process order**: `POST /api/checkout/pub/gatewayCallback/{orderGroup}` — Triggers order processing

If steps 2 and 3 are not completed within 5 minutes of step 1, the order is automatically canceled and marked as `incomplete`.

### Concept 4: CheckoutOrderFormOwnership Cookie

When a new cart is created, VTEX sends a `CheckoutOrderFormOwnership` cookie alongside the `checkout.vtex.com` cookie. This cookie ensures that only the customer who created the cart can access their personal information (profile, address). Without it, personal data in the OrderForm is masked.

In a headless BFF, you must:
1. Capture the `CheckoutOrderFormOwnership` cookie from VTEX responses
2. Store it in the server-side session alongside the `orderFormId`
3. Forward it back to VTEX on subsequent checkout requests

**Architecture/Data Flow**:

```text
Frontend
    │
    └── POST /api/bff/cart/items/add  {skuId, quantity, seller}
            │
            BFF Layer
            │ 1. Validates input (skuId format, quantity > 0, seller exists)
            │ 2. Reads orderFormId from server-side session
            │ 3. Forwards CheckoutOrderFormOwnership cookie
            │ 4. Calls VTEX: POST /api/checkout/pub/orderForm/{id}/items
            │ 5. Updates session with new orderFormId if changed
            │ 6. Returns sanitized orderForm to frontend
            │
            VTEX Checkout API
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: ALL Checkout Operations MUST Go Through BFF

**Rule**: Client-side code MUST NOT make direct HTTP requests to any VTEX Checkout API endpoint (`/api/checkout/`). All checkout operations — cart creation, item management, profile updates, shipping, payment, and order placement — must be proxied through the BFF layer.

**Why**: Checkout endpoints handle sensitive personal data (email, address, phone, payment details). Direct frontend calls expose the request/response flow to browser DevTools, extensions, and XSS attacks. Additionally, the BFF layer is needed to manage `VtexIdclientAutCookie` and `CheckoutOrderFormOwnership` cookies server-side, validate inputs, and prevent cart manipulation (e.g., price tampering).

**Detection**: If you see `fetch` or `axios` calls to `/api/checkout/` in any client-side code (browser-executed JavaScript, frontend source files) → STOP immediately. All checkout calls must route through BFF endpoints.

✅ **CORRECT**:
```typescript
// Frontend — calls BFF endpoint, never VTEX directly
async function addItemToCart(skuId: string, quantity: number, seller: string): Promise<OrderForm> {
  const response = await fetch("/api/bff/cart/items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skuId, quantity, seller }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add item: ${response.status}`);
  }

  return response.json();
}
```

❌ **WRONG**:
```typescript
// Frontend — calls VTEX Checkout API directly (SECURITY VULNERABILITY)
async function addItemToCart(skuId: string, quantity: number, seller: string): Promise<OrderForm> {
  const orderFormId = localStorage.getItem("orderFormId"); // Also wrong: see next constraint
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm/${orderFormId}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderItems: [{ id: skuId, quantity, seller }],
      }),
    }
  );
  return response.json();
}
```

---

### Constraint: orderFormId MUST Be Managed Server-Side

**Rule**: The `orderFormId` MUST be stored in a secure server-side session. It SHOULD NOT be stored in `localStorage`, `sessionStorage`, or exposed to the frontend in a way that allows direct VTEX API calls.

**Why**: The `orderFormId` is the key to a customer's shopping cart and all data within it — profile information, shipping address, payment details. If exposed client-side, an attacker could use it to query VTEX directly and retrieve personal data, or manipulate the cart by adding/removing items through direct API calls bypassing any validation logic.

**Detection**: If you see `orderFormId` stored in `localStorage` or `sessionStorage` → STOP immediately. It should be managed in the BFF session.

✅ **CORRECT**:
```typescript
// BFF — manages orderFormId in server-side session
import { Router, Request, Response } from "express";
import { vtexCheckoutRequest } from "../vtex-api-client";

export const cartRoutes = Router();

// Get or create cart — orderFormId stays server-side
cartRoutes.get("/", async (req: Request, res: Response) => {
  try {
    let orderFormId = req.session.orderFormId;

    if (orderFormId) {
      // Retrieve existing cart
      const orderForm = await vtexCheckoutRequest({
        path: `/api/checkout/pub/orderForm/${orderFormId}`,
        method: "GET",
        cookies: req.session.vtexCookies,
      });
      return res.json(sanitizeOrderForm(orderForm));
    }

    // Create new cart
    const orderForm = await vtexCheckoutRequest({
      path: "/api/checkout/pub/orderForm",
      method: "GET",
      cookies: req.session.vtexCookies,
    });

    // Store orderFormId in session — never expose raw ID to frontend
    req.session.orderFormId = orderForm.orderFormId;
    req.session.vtexCookies = orderForm._cookies; // Store checkout cookies

    res.json(sanitizeOrderForm(orderForm));
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Failed to get cart" });
  }
});

// Remove sensitive data before sending to frontend
function sanitizeOrderForm(orderForm: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...orderForm };
  delete sanitized._cookies;
  return sanitized;
}
```

❌ **WRONG**:
```typescript
// Frontend — stores orderFormId in localStorage (INSECURE)
async function getCart(): Promise<OrderForm> {
  let orderFormId = localStorage.getItem("orderFormId"); // EXPOSED to client

  if (!orderFormId) {
    const response = await fetch(
      "https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm"
    );
    const data = await response.json();
    orderFormId = data.orderFormId;
    localStorage.setItem("orderFormId", orderFormId!); // Stored client-side!
  }

  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm/${orderFormId}`
  );
  return response.json();
}
```

---

### Constraint: MUST Validate All Inputs Server-Side

**Rule**: The BFF MUST validate all input data before forwarding requests to the VTEX Checkout API. This includes validating SKU IDs, quantities, email formats, address fields, and coupon codes.

**Why**: Without server-side validation, malicious users can send crafted requests through the BFF to VTEX with invalid or manipulative data — negative quantities, SQL injection in text fields, or spoofed seller IDs. While VTEX has its own validation, defense-in-depth requires validating at the BFF layer to catch issues early and provide clear error messages.

**Detection**: If BFF route handlers pass `req.body` directly to VTEX API calls without any validation or sanitization → STOP immediately. All inputs must be validated before proxying.

✅ **CORRECT**:
```typescript
// BFF — validates inputs before forwarding to VTEX
import { Router, Request, Response } from "express";
import { vtexCheckoutRequest } from "../vtex-api-client";

export const cartItemsRoutes = Router();

interface AddItemRequest {
  skuId: string;
  quantity: number;
  seller: string;
}

function validateAddItemInput(body: unknown): body is AddItemRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;

  return (
    typeof b.skuId === "string" &&
    /^\d+$/.test(b.skuId) &&
    typeof b.quantity === "number" &&
    Number.isInteger(b.quantity) &&
    b.quantity > 0 &&
    b.quantity <= 100 &&
    typeof b.seller === "string" &&
    /^[a-zA-Z0-9]+$/.test(b.seller)
  );
}

cartItemsRoutes.post("/", async (req: Request, res: Response) => {
  if (!validateAddItemInput(req.body)) {
    return res.status(400).json({
      error: "Invalid input",
      details: "skuId must be numeric, quantity must be 1-100, seller must be alphanumeric",
    });
  }

  const { skuId, quantity, seller } = req.body;
  const orderFormId = req.session.orderFormId;

  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    const orderForm = await vtexCheckoutRequest({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
      method: "POST",
      body: {
        orderItems: [{ id: skuId, quantity, seller }],
      },
      cookies: req.session.vtexCookies,
    });

    res.json(sanitizeOrderForm(orderForm));
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});
```

❌ **WRONG**:
```typescript
// BFF — passes raw input to VTEX without validation (UNSAFE)
cartRoutes.post("/items", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;

  // No validation — attacker can send any payload
  const orderForm = await vtexCheckoutRequest({
    path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
    method: "POST",
    body: req.body, // Raw, unvalidated input passed directly!
    cookies: req.session.vtexCookies,
  });

  res.json(orderForm);
});
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Create a VTEX Checkout API Client

Build a shared utility that handles authentication and cookie management for all Checkout API calls.

```typescript
// server/vtex-checkout-client.ts
const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const BASE_URL = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br`;

interface CheckoutRequestOptions {
  path: string;
  method?: string;
  body?: unknown;
  cookies?: Record<string, string>;
  userToken?: string;
}

interface CheckoutResponse<T = unknown> {
  data: T;
  cookies: Record<string, string>;
}

export async function vtexCheckout<T>(
  options: CheckoutRequestOptions
): Promise<CheckoutResponse<T>> {
  const { path, method = "GET", body, cookies = {}, userToken } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // Build cookie header from stored cookies
  const cookieParts: string[] = [];
  if (cookies["checkout.vtex.com"]) {
    cookieParts.push(`checkout.vtex.com=${cookies["checkout.vtex.com"]}`);
  }
  if (cookies["CheckoutOrderFormOwnership"]) {
    cookieParts.push(`CheckoutOrderFormOwnership=${cookies["CheckoutOrderFormOwnership"]}`);
  }
  if (userToken) {
    cookieParts.push(`VtexIdclientAutCookie=${userToken}`);
  }
  if (cookieParts.length > 0) {
    headers["Cookie"] = cookieParts.join("; ");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Checkout API error: ${response.status} for ${method} ${path}: ${errorBody}`
    );
  }

  // Extract cookies from response for session storage
  const responseCookies: Record<string, string> = {};
  const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookieHeaders) {
    const [nameValue] = setCookie.split(";");
    const [name, value] = nameValue.split("=");
    if (name && value) {
      responseCookies[name.trim()] = value.trim();
    }
  }

  const data = (await response.json()) as T;
  return { data, cookies: { ...cookies, ...responseCookies } };
}
```

### Step 2: Implement Cart Management BFF Routes

Create BFF endpoints for all cart operations: get cart, add items, update items, remove items.

```typescript
// server/routes/cart.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const cartRoutes = Router();

interface OrderForm {
  orderFormId: string;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
    imageUrl: string;
    seller: string;
  }>;
  totalizers: Array<{ id: string; name: string; value: number }>;
  value: number;
  [key: string]: unknown;
}

// GET /api/bff/cart — get or create cart
cartRoutes.get("/", async (req: Request, res: Response) => {
  try {
    const result = await vtexCheckout<OrderForm>({
      path: req.session.orderFormId
        ? `/api/checkout/pub/orderForm/${req.session.orderFormId}`
        : "/api/checkout/pub/orderForm",
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.orderFormId = result.data.orderFormId;
    req.session.vtexCookies = result.cookies;

    res.json(result.data);
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Failed to get cart" });
  }
});

// POST /api/bff/cart/items — add items to cart
cartRoutes.post("/items", async (req: Request, res: Response) => {
  const { items } = req.body as {
    items: Array<{ id: string; quantity: number; seller: string }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }

  for (const item of items) {
    if (!item.id || typeof item.quantity !== "number" || item.quantity < 1 || !item.seller) {
      return res.status(400).json({ error: "Each item must have id, quantity (>0), and seller" });
    }
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart. Call GET /api/bff/cart first." });
  }

  try {
    const result = await vtexCheckout<OrderForm>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
      method: "POST",
      body: { orderItems: items },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error adding items:", error);
    res.status(500).json({ error: "Failed to add items to cart" });
  }
});

// PATCH /api/bff/cart/items/:index — update item quantity
cartRoutes.patch("/items/:index", async (req: Request, res: Response) => {
  const index = parseInt(req.params.index, 10);
  const { quantity } = req.body as { quantity: number };

  if (isNaN(index) || index < 0) {
    return res.status(400).json({ error: "Invalid item index" });
  }
  if (typeof quantity !== "number" || quantity < 0) {
    return res.status(400).json({ error: "Quantity must be a non-negative number" });
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    const result = await vtexCheckout<OrderForm>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items/${index}`,
      method: "PATCH",
      body: { quantity },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});
```

### Step 3: Implement Order Placement BFF Route

The order placement flow is a multi-step process that must complete within 5 minutes.

```typescript
// server/routes/order.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const orderRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

interface PlaceOrderResponse {
  orders: Array<{ orderId: string; transactionData: { merchantTransactions: Array<{ transactionId: string }> } }>;
  orderGroup: string;
}

// POST /api/bff/order/place — place order from existing cart
orderRoutes.post("/place", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    // Step 1: Place order from existing cart
    const placeResult = await vtexCheckout<PlaceOrderResponse>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/transaction`,
      method: "POST",
      body: { referenceId: orderFormId },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    const { orders, orderGroup } = placeResult.data;

    if (!orders || orders.length === 0) {
      return res.status(500).json({ error: "Order placement returned no orders" });
    }

    const orderId = orders[0].orderId;
    const transactionId =
      orders[0].transactionData.merchantTransactions[0]?.transactionId;

    // Step 2: Send payment info (from frontend-provided payment data)
    const { paymentData } = req.body as {
      paymentData: {
        paymentSystem: number;
        installments: number;
        value: number;
        referenceValue: number;
      };
    };

    if (!paymentData) {
      return res.status(400).json({ error: "Payment data is required" });
    }

    const paymentUrl = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br/api/payments/transactions/${transactionId}/payments`;
    const paymentResponse = await fetch(paymentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VTEX-API-AppKey": VTEX_APP_KEY,
        "X-VTEX-API-AppToken": VTEX_APP_TOKEN,
      },
      body: JSON.stringify([
        {
          paymentSystem: paymentData.paymentSystem,
          installments: paymentData.installments,
          currencyCode: "BRL",
          value: paymentData.value,
          installmentsInterestRate: 0,
          installmentsValue: paymentData.value,
          referenceValue: paymentData.referenceValue,
          fields: {},
          transaction: { id: transactionId, merchantName: VTEX_ACCOUNT },
        },
      ]),
    });

    if (!paymentResponse.ok) {
      return res.status(500).json({ error: "Payment submission failed" });
    }

    // Step 3: Process order (trigger gateway callback)
    const processResult = await vtexCheckout<unknown>({
      path: `/api/checkout/pub/gatewayCallback/${orderGroup}`,
      method: "POST",
      cookies: req.session.vtexCookies || {},
    });

    // Clear cart session after successful order
    delete req.session.orderFormId;
    delete req.session.vtexCookies;

    res.json({
      orderId,
      orderGroup,
      transactionId,
      status: "placed",
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
});
```

### Complete Example

Full BFF cart and checkout flow wired together:

```typescript
// server/index.ts — mount all checkout routes
import express from "express";
import session from "express-session";
import { cartRoutes } from "./routes/cart";
import { orderRoutes } from "./routes/order";

const app = express();

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Cart routes: GET /api/bff/cart, POST /api/bff/cart/items, PATCH /api/bff/cart/items/:index
app.use("/api/bff/cart", cartRoutes);

// Order routes: POST /api/bff/order/place
app.use("/api/bff/order", orderRoutes);

// Attachment routes for profile, shipping, payment
app.post("/api/bff/cart/profile", async (req, res) => {
  const { email, firstName, lastName, document, documentType, phone } = req.body;

  // Validate email format
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  const { vtexCheckout } = await import("./vtex-checkout-client");
  const result = await vtexCheckout({
    path: `/api/checkout/pub/orderForm/${orderFormId}/attachments/clientProfileData`,
    method: "POST",
    body: { email, firstName, lastName, document, documentType, phone },
    cookies: req.session.vtexCookies || {},
    userToken: req.session.vtexAuthToken,
  });

  req.session.vtexCookies = result.cookies;
  res.json(result.data);
});

app.post("/api/bff/cart/shipping", async (req, res) => {
  const { address, logisticsInfo } = req.body;

  if (!address || !address.postalCode || !address.country) {
    return res.status(400).json({ error: "Address with postalCode and country is required" });
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  const { vtexCheckout } = await import("./vtex-checkout-client");
  const result = await vtexCheckout({
    path: `/api/checkout/pub/orderForm/${orderFormId}/attachments/shippingData`,
    method: "POST",
    body: {
      clearAddressIfPostalCodeNotFound: false,
      selectedAddresses: [address],
      logisticsInfo: logisticsInfo || [],
    },
    cookies: req.session.vtexCookies || {},
    userToken: req.session.vtexAuthToken,
  });

  req.session.vtexCookies = result.cookies;
  res.json(result.data);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BFF server running on port ${PORT}`);
});
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Creating a New Cart on Every Page Load

**What happens**: Developers call `GET /api/checkout/pub/orderForm` (without an `orderFormId`) on every page load, creating a new empty cart each time instead of retrieving the existing one.

**Why it fails**: Each call without an `orderFormId` creates a new cart, abandoning the previous one. Items the shopper added are lost. VTEX creates orphaned orderForms that consume resources. The shopper must re-add all items every time they navigate.

**Fix**: Always store and reuse the `orderFormId` from the server-side session. Only call the "create new cart" endpoint when no `orderFormId` exists.

```typescript
// Always check for existing orderFormId first
cartRoutes.get("/", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;

  const path = orderFormId
    ? `/api/checkout/pub/orderForm/${orderFormId}` // Retrieve existing cart
    : "/api/checkout/pub/orderForm"; // Create new cart only if none exists

  const result = await vtexCheckout<OrderForm>({
    path,
    cookies: req.session.vtexCookies || {},
    userToken: req.session.vtexAuthToken,
  });

  req.session.orderFormId = result.data.orderFormId;
  req.session.vtexCookies = result.cookies;
  res.json(result.data);
});
```

---

### Anti-Pattern: Ignoring the 5-Minute Order Processing Window

**What happens**: Developers place an order (step 1) but delay sending payment information or processing the order, exceeding the 5-minute window.

**Why it fails**: VTEX automatically cancels orders that are not fully processed within 5 minutes of placement. The order is tagged as `incomplete` and the customer must start the checkout flow over. This creates a terrible user experience and potential inventory issues.

**Fix**: Execute all three order placement steps (place order → send payment → process order) sequentially and immediately in a single BFF request handler. Never split these across multiple independent frontend calls.

```typescript
// Execute all 3 steps in a single, synchronous flow
orderRoutes.post("/place", async (req: Request, res: Response) => {
  try {
    // Step 1: Place order — starts the 5-minute timer
    const placeResult = await vtexCheckout<PlaceOrderResponse>({
      path: `/api/checkout/pub/orderForm/${req.session.orderFormId}/transaction`,
      method: "POST",
      body: { referenceId: req.session.orderFormId },
      cookies: req.session.vtexCookies || {},
    });

    // Step 2: Send payment — immediately after placement
    await sendPayment(placeResult.data);

    // Step 3: Process order — immediately after payment
    await processOrder(placeResult.data.orderGroup);

    res.json({ success: true, orderId: placeResult.data.orders[0].orderId });
  } catch (error) {
    console.error("Order placement failed:", error);
    res.status(500).json({ error: "Order placement failed" });
  }
});
```

---

### Anti-Pattern: Exposing Raw VTEX Error Messages to Frontend

**What happens**: Developers forward VTEX API error responses directly to the frontend without sanitization.

**Why it fails**: VTEX error responses may contain internal implementation details, account names, API paths, or data structures that leak information about your backend architecture. This information can be used by attackers to craft targeted attacks.

**Fix**: Map VTEX errors to user-friendly messages in the BFF. Log the full error server-side for debugging.

```typescript
// Map VTEX errors to safe, user-friendly messages
function mapCheckoutError(vtexError: string, statusCode: number): { code: string; message: string } {
  if (statusCode === 400 && vtexError.includes("item")) {
    return { code: "INVALID_ITEM", message: "One or more items are unavailable" };
  }
  if (statusCode === 400 && vtexError.includes("address")) {
    return { code: "INVALID_ADDRESS", message: "Please check your shipping address" };
  }
  if (statusCode === 409) {
    return { code: "CART_CONFLICT", message: "Your cart was updated. Please review your items." };
  }
  return { code: "CHECKOUT_ERROR", message: "An error occurred during checkout. Please try again." };
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Headless cart and checkout](https://developers.vtex.com/docs/guides/headless-cart-and-checkout) — Complete guide to implementing cart and checkout in headless stores
- [Checkout API reference](https://developers.vtex.com/docs/api-reference/checkout-api) — Full API reference for all Checkout endpoints
- [orderForm fields](https://developers.vtex.com/docs/guides/orderform-fields) — Detailed documentation of the OrderForm data structure
- [Creating a regular order from an existing cart](https://developers.vtex.com/docs/guides/creating-a-regular-order-from-an-existing-cart) — Step-by-step guide to the order placement flow
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores
- [Add cart items](https://developers.vtex.com/docs/guides/add-cart-items) — Guide to adding products to a shopping cart

---

## headless-intelligent-search

> Apply when implementing search functionality, faceted navigation, or autocomplete in a headless VTEX storefront. Covers product_search, autocomplete_suggestions, facets, banners, correction_search, and top_searches endpoints, plus analytics event collection. Use for any custom frontend that integrates VTEX Intelligent Search API for product discovery and search result rendering.

# Intelligent Search API Integration

## Overview

**What this skill covers**: The VTEX Intelligent Search API — the only VTEX API that is fully public and designed for direct frontend consumption. Covers all search endpoints, query parameters, response structures, faceted navigation, and the critical requirement to send analytics events.

**When to use it**: When implementing product search, category browsing, autocomplete, or faceted filtering in a headless VTEX storefront. This is the search solution for any custom headless frontend.

**What you'll learn**:
- All Intelligent Search API endpoints and their purposes
- How to implement faceted navigation with proper query parameters
- How to paginate results correctly using `from`/`to` parameters
- Why analytics events are mandatory and how to send them via the Intelligent Search Events API - Headless

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Intelligent Search Is a PUBLIC API

Unlike most VTEX APIs, Intelligent Search does **not** require API keys or authentication tokens. It is designed to be called directly from the frontend. The base URL pattern is:

```text
https://{accountName}.{environment}.com.br/api/io/_v/api/intelligent-search/{endpoint}
```

This means:
- **No BFF proxy needed** for search queries (and proxying adds unnecessary latency)
- Results are CDN-cacheable for better performance
- No risk of credential exposure

This is the ONE exception to the "everything through BFF" rule in headless VTEX architecture.

### Concept 2: Search Endpoints

Intelligent Search provides these core endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/product_search/{facets}` | GET | Search products by query and/or facets |
| `/facets/{facets}` | GET | Get available filters for a query |
| `/autocomplete_suggestions` | GET | Get term and product suggestions while typing |
| `/top_searches` | GET | Get the 10 most popular search terms |
| `/correction_search` | GET | Get spelling correction for a misspelled term |
| `/search_suggestions` | GET | Get suggested terms similar to the search term |
| `/banners/{facets}` | GET | Get banners configured for a query |

### Concept 3: Faceted Navigation

Facets are the combination of filters applied to a search. The `facets` path parameter follows the format:

```text
/{facetKey1}/{facetValue1}/{facetKey2}/{facetValue2}
```

Filter combination rules:
- **Same facet type → OR (union)**: Selecting "Red" and "Blue" for color returns products matching either color
- **Different facet types → AND (intersection)**: Selecting "Red" color and "Nike" brand returns only red Nike products

Common facet keys include: `category-1`, `category-2`, `brand`, `price`, `productClusterIds`, and custom specifications configured as filterable in Intelligent Search settings.

### Concept 4: Analytics Events (Mandatory)

Intelligent Search improves results based on shopper behavior. For headless implementations, you **must** send analytics events using the **Intelligent Search Events API - Headless**. Without events, search ranking cannot learn and results degrade over time.

The events API base URL is:
```text
https://sp.vtex.com/event-api/v1/{accountName}/event
```

**Architecture/Data Flow**:

```text
Frontend (Browser)
    │
    ├── GET /api/io/_v/api/intelligent-search/product_search/...
    │   └── Returns: products, facets, pagination info
    │
    ├── GET /api/io/_v/api/intelligent-search/facets/...
    │   └── Returns: available filters with counts
    │
    ├── GET /api/io/_v/api/intelligent-search/autocomplete_suggestions?query=...
    │   └── Returns: suggested terms + suggested products
    │
    └── POST https://sp.vtex.com/event-api/v1/{account}/event
        └── Sends: search impressions, clicks, add-to-cart events
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: MUST Send Analytics Events

**Rule**: Every headless search implementation MUST send analytics events to the Intelligent Search Events API - Headless. At minimum, send search impression events when results are displayed and click events when a product is selected from search results.

**Why**: Intelligent Search uses machine learning to rank results based on user behavior. Without analytics events, the search engine has no behavioral data and cannot personalize or optimize results. Over time, search quality degrades compared to stores that send events. Additionally, VTEX Admin search analytics dashboards will show no data.

**Detection**: If a search implementation renders results from Intelligent Search but has no calls to `sp.vtex.com/event-api` or the Intelligent Search Events API → STOP immediately. Analytics events must be implemented alongside search.

✅ **CORRECT**:
```typescript
// search-analytics.ts — sends events to Intelligent Search Events API
const ACCOUNT_NAME = "mystore";
const EVENTS_URL = `https://sp.vtex.com/event-api/v1/${ACCOUNT_NAME}/event`;

interface SearchEvent {
  type: "search.query" | "search.click" | "search.add_to_cart";
  text: string;
  misspelled: boolean;
  match: number;
  operator: string;
  locale: string;
  agent: string;
  url: string;
  products?: Array<{ productId: string; position: number }>;
}

export async function sendSearchEvent(event: SearchEvent): Promise<void> {
  try {
    await fetch(EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true, // ensures event is sent even during navigation
    });
  } catch (error) {
    // Analytics failures should not break the UI
    console.warn("Failed to send search event:", error);
  }
}

// Usage: call after rendering search results
function onSearchResultsRendered(query: string, products: Product[]): void {
  sendSearchEvent({
    type: "search.query",
    text: query,
    misspelled: false,
    match: products.length,
    operator: "and",
    locale: "en-US",
    agent: "my-headless-store",
    url: window.location.href,
    products: products.map((p, i) => ({
      productId: p.productId,
      position: i + 1,
    })),
  });
}
```

❌ **WRONG**:
```typescript
// Search works but NO analytics events are sent — search ranking degrades
async function searchProducts(query: string): Promise<Product[]> {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?query=${query}&locale=en-US`
  );
  const data = await response.json();
  return data.products;
  // Missing: no call to sendSearchEvent() — Intelligent Search cannot learn
}
```

---

### Constraint: MUST Paginate Results Correctly

**Rule**: Every product search request MUST include `from` and `to` query parameters to control pagination. The maximum page size is 50 items (`to - from` must not exceed 49, since indices are inclusive and zero-based).

**Why**: Without pagination parameters, the API defaults to a small result set. Requesting too many results in a single call (or not paginating at all) causes slow responses, high memory usage on the client, and poor user experience. Additionally, the API enforces a maximum of 50 items per request.

**Detection**: If a call to `/product_search/` does not include `from` and `to` query parameters → STOP immediately. Pagination must always be explicit.

✅ **CORRECT**:
```typescript
// Properly paginated search with from/to parameters
interface SearchOptions {
  query: string;
  page: number;
  pageSize: number;
  locale: string;
  facets?: string;
}

async function searchProducts(options: SearchOptions): Promise<SearchResponse> {
  const { query, page, pageSize, locale, facets = "" } = options;

  // Calculate zero-based from/to (inclusive)
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const params = new URLSearchParams({
    query,
    locale,
    from: String(from),
    to: String(to),
  });

  const baseUrl = `https://${ACCOUNT}.vtexcommercestable.com.br`;
  const facetPath = facets ? `/${facets}` : "";
  const url = `${baseUrl}/api/io/_v/api/intelligent-search/product_search${facetPath}?${params}`;

  const response = await fetch(url);
  return response.json();
}

// Usage
const results = await searchProducts({
  query: "running shoes",
  page: 0,
  pageSize: 20,
  locale: "en-US",
  facets: "category-1/shoes",
});
```

❌ **WRONG**:
```typescript
// No pagination — returns default small result set, no way to load more
async function searchProducts(query: string): Promise<SearchResponse> {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?query=${query}`
    // Missing: from, to, locale parameters
  );
  return response.json();
}
```

---

### Constraint: Do NOT Unnecessarily Proxy Intelligent Search Through BFF

**Rule**: Intelligent Search API requests SHOULD be made directly from the frontend. Do not route search traffic through the BFF unless you have a specific need (e.g., server-side rendering, adding custom business logic).

**Why**: Intelligent Search is a public API that does not require authentication. Adding a BFF proxy layer introduces an additional network hop, increases latency on every search operation, adds server cost, and prevents the CDN from caching responses efficiently. Search queries are high-frequency operations — even 50ms of added latency impacts conversion.

**Detection**: If all Intelligent Search calls go through a BFF endpoint instead of directly to VTEX → note this to the developer. It is not a security issue but a performance concern. If there is no justification (like SSR), recommend direct frontend calls.

✅ **CORRECT**:
```typescript
// Frontend — calls Intelligent Search directly (no BFF needed)
const VTEX_SEARCH_BASE = `https://${ACCOUNT}.vtexcommercestable.com.br/api/io/_v/api/intelligent-search`;

export async function getAutocomplete(term: string, locale: string): Promise<AutocompleteResponse> {
  const params = new URLSearchParams({ query: term, locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/autocomplete_suggestions?${params}`);
  return response.json();
}

export async function getTopSearches(locale: string): Promise<TopSearchesResponse> {
  const params = new URLSearchParams({ locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/top_searches?${params}`);
  return response.json();
}

export async function getFacets(facetPath: string, query: string, locale: string): Promise<FacetsResponse> {
  const params = new URLSearchParams({ query, locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/facets/${facetPath}?${params}`);
  return response.json();
}
```

❌ **WRONG**:
```typescript
// BFF proxy for Intelligent Search — unnecessary overhead
// server/routes/search.ts
router.get("/api/bff/search", async (req, res) => {
  const { query, from, to, locale } = req.query;
  // This just forwards to VTEX with no added value
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?query=${query}&from=${from}&to=${to}&locale=${locale}`
  );
  const data = await response.json();
  res.json(data); // Added latency for no benefit
});
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Create a Search API Client

Build a typed client for all Intelligent Search endpoints. This runs in the frontend.

```typescript
// lib/intelligent-search-client.ts
const ACCOUNT = "mystore";
const ENVIRONMENT = "vtexcommercestable";
const BASE_URL = `https://${ACCOUNT}.${ENVIRONMENT}.com.br/api/io/_v/api/intelligent-search`;

interface ProductSearchParams {
  query?: string;
  from?: number;
  to?: number;
  locale: string;
  facets?: string;
  sort?: "price:asc" | "price:desc" | "orders:desc" | "name:asc" | "name:desc" | "release:desc" | "discount:desc";
  hideUnavailableItems?: boolean;
}

interface SearchProduct {
  productId: string;
  productName: string;
  brand: string;
  brandId: number;
  link: string;
  linkText: string;
  categories: string[];
  priceRange: {
    sellingPrice: { highPrice: number; lowPrice: number };
    listPrice: { highPrice: number; lowPrice: number };
  };
  items: Array<{
    itemId: string;
    name: string;
    images: Array<{ imageUrl: string; imageLabel: string }>;
    sellers: Array<{
      sellerId: string;
      sellerName: string;
      commertialOffer: {
        Price: number;
        ListPrice: number;
        AvailableQuantity: number;
      };
    }>;
  }>;
}

interface ProductSearchResponse {
  products: SearchProduct[];
  recordsFiltered: number;
  correction?: { misspelled: boolean };
  fuzzy: string;
  operator: string;
  translated: boolean;
  pagination: {
    count: number;
    current: { index: number; proxyUrl: string };
    before: Array<{ index: number; proxyUrl: string }>;
    after: Array<{ index: number; proxyUrl: string }>;
    perPage: number;
    next: { index: number; proxyUrl: string };
    previous: { index: number; proxyUrl: string };
    first: { index: number; proxyUrl: string };
    last: { index: number; proxyUrl: string };
  };
}

export async function productSearch(params: ProductSearchParams): Promise<ProductSearchResponse> {
  const { facets = "", ...queryParams } = params;
  const searchParams = new URLSearchParams();

  if (queryParams.query) searchParams.set("query", queryParams.query);
  if (queryParams.from !== undefined) searchParams.set("from", String(queryParams.from));
  if (queryParams.to !== undefined) searchParams.set("to", String(queryParams.to));
  searchParams.set("locale", queryParams.locale);
  if (queryParams.sort) searchParams.set("sort", queryParams.sort);
  if (queryParams.hideUnavailableItems) searchParams.set("hideUnavailableItems", "true");

  const facetPath = facets ? `/${facets}` : "";
  const url = `${BASE_URL}/product_search${facetPath}?${searchParams}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }
  return response.json();
}
```

### Step 2: Implement Faceted Navigation

Fetch available facets for the current query and render filter UI. Update the search when filters change.

```typescript
// lib/facets.ts
interface FacetValue {
  id: string;
  quantity: number;
  name: string;
  key: string;
  value: string;
  selected: boolean;
  href: string;
}

interface Facet {
  type: "TEXT" | "NUMBER" | "PRICERANGE";
  name: string;
  hidden: boolean;
  quantity: number;
  values: FacetValue[];
}

interface FacetsResponse {
  facets: Facet[];
  breadcrumb: Array<{ name: string; href: string }>;
  queryArgs: {
    query: string;
    map: string;
  };
}

export async function getFacets(
  facetPath: string,
  query: string,
  locale: string
): Promise<FacetsResponse> {
  const params = new URLSearchParams({ query, locale });
  const url = `${BASE_URL}/facets/${facetPath}?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Facets fetch failed: ${response.status}`);
  }
  return response.json();
}

// Build facet path from selected filters
export function buildFacetPath(selectedFilters: Record<string, string[]>): string {
  const parts: string[] = [];
  for (const [key, values] of Object.entries(selectedFilters)) {
    for (const value of values) {
      parts.push(`${key}/${value}`);
    }
  }
  return parts.join("/");
}
```

### Step 3: Implement Autocomplete

Wire up the autocomplete endpoint to your search input for real-time suggestions.

```typescript
// lib/autocomplete.ts
interface AutocompleteSuggestion {
  term: string;
  count: number;
  attributes: Array<{
    key: string;
    value: string;
    labelKey: string;
    labelValue: string;
  }>;
}

interface AutocompleteResponse {
  searches: AutocompleteSuggestion[];
}

export async function getAutocompleteSuggestions(
  query: string,
  locale: string
): Promise<AutocompleteResponse> {
  const params = new URLSearchParams({ query, locale });
  const url = `${BASE_URL}/autocomplete_suggestions?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Autocomplete failed: ${response.status}`);
  }
  return response.json();
}

// Debounced autocomplete for use in search inputs
export function createDebouncedAutocomplete(delayMs: number = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debouncedAutocomplete(
    query: string,
    locale: string,
    callback: (suggestions: AutocompleteResponse) => void
  ): void {
    if (timeoutId) clearTimeout(timeoutId);

    if (query.length < 2) {
      callback({ searches: [] });
      return;
    }

    timeoutId = setTimeout(async () => {
      const suggestions = await getAutocompleteSuggestions(query, locale);
      callback(suggestions);
    }, delayMs);
  };
}
```

### Complete Example

A full search implementation with products, facets, autocomplete, and analytics:

```typescript
// search-page.ts — framework-agnostic search orchestration
import { productSearch, ProductSearchResponse } from "./lib/intelligent-search-client";
import { getFacets, buildFacetPath, FacetsResponse } from "./lib/facets";
import { createDebouncedAutocomplete } from "./lib/autocomplete";
import { sendSearchEvent } from "./search-analytics";

interface SearchState {
  query: string;
  page: number;
  pageSize: number;
  locale: string;
  selectedFilters: Record<string, string[]>;
  sort?: string;
  results: ProductSearchResponse | null;
  facets: FacetsResponse | null;
}

const state: SearchState = {
  query: "",
  page: 0,
  pageSize: 24,
  locale: "en-US",
  selectedFilters: {},
  results: null,
  facets: null,
};

const debouncedAutocomplete = createDebouncedAutocomplete(300);

// Execute search with current state
async function executeSearch(): Promise<void> {
  const facetPath = buildFacetPath(state.selectedFilters);

  const [searchResults, facetResults] = await Promise.all([
    productSearch({
      query: state.query,
      from: state.page * state.pageSize,
      to: (state.page * state.pageSize) + state.pageSize - 1,
      locale: state.locale,
      facets: facetPath,
    }),
    getFacets(facetPath, state.query, state.locale),
  ]);

  state.results = searchResults;
  state.facets = facetResults;

  // Send analytics event after results are rendered
  sendSearchEvent({
    type: "search.query",
    text: state.query,
    misspelled: searchResults.correction?.misspelled ?? false,
    match: searchResults.recordsFiltered,
    operator: searchResults.operator,
    locale: state.locale,
    agent: "my-headless-store",
    url: window.location.href,
    products: searchResults.products.map((p, i) => ({
      productId: p.productId,
      position: state.page * state.pageSize + i + 1,
    })),
  });
}

// Handle search input
function onSearchInput(query: string): void {
  debouncedAutocomplete(query, state.locale, (suggestions) => {
    // Render autocomplete dropdown — implementation depends on your UI framework
    renderAutocomplete(suggestions);
  });
}

// Handle search submit
function onSearchSubmit(query: string): void {
  state.query = query;
  state.page = 0;
  state.selectedFilters = {};
  executeSearch();
}

// Handle filter toggle
function onFilterToggle(facetKey: string, facetValue: string): void {
  const current = state.selectedFilters[facetKey] || [];
  const index = current.indexOf(facetValue);

  if (index === -1) {
    state.selectedFilters[facetKey] = [...current, facetValue];
  } else {
    state.selectedFilters[facetKey] = current.filter((v) => v !== facetValue);
    if (state.selectedFilters[facetKey].length === 0) {
      delete state.selectedFilters[facetKey];
    }
  }

  state.page = 0;
  executeSearch();
}

// Handle pagination
function onPageChange(newPage: number): void {
  state.page = newPage;
  executeSearch();
}

// Handle product click from search results
function onProductClick(productId: string, position: number): void {
  sendSearchEvent({
    type: "search.click",
    text: state.query,
    misspelled: false,
    match: state.results?.recordsFiltered ?? 0,
    operator: state.results?.operator ?? "and",
    locale: state.locale,
    agent: "my-headless-store",
    url: window.location.href,
    products: [{ productId, position }],
  });
}

// Placeholder render function — replace with your framework's rendering
function renderAutocomplete(suggestions: { searches: Array<{ term: string }> }): void {
  // Your framework-specific rendering logic here
  console.log("Autocomplete suggestions:", suggestions.searches);
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Not Sending the `locale` Parameter

**What happens**: Developers omit the `locale` query parameter from search requests.

**Why it fails**: Without `locale`, Intelligent Search may return results in the wrong language or fail to apply locale-specific relevance rules. Multi-language stores will display mixed-language results, and search terms may not be properly tokenized for the target language.

**Fix**: Always include the `locale` parameter in every Intelligent Search request.

```typescript
// Always include locale in search parameters
const params = new URLSearchParams({
  query: "shoes",
  locale: "en-US", // Required for correct language processing
  from: "0",
  to: "19",
});
```

---

### Anti-Pattern: Loading All Products at Once

**What happens**: Developers set very large `from`/`to` ranges (e.g., 0 to 999) or implement infinite scroll that loads all results without limit.

**Why it fails**: The Intelligent Search API limits results to 50 items per request. Even if it allowed more, sending large payloads degrades performance for both the API and the client. Users experience long load times and high memory consumption. Additionally, loading products beyond what is visible wastes bandwidth.

**Fix**: Use proper pagination with reasonable page sizes (12-24 items per page) and lazy-load subsequent pages only when the user scrolls or clicks "next page."

```typescript
// Proper pagination with bounded page sizes
const PAGE_SIZE = 24; // Reasonable default
const MAX_PAGE_SIZE = 50; // API maximum

function getSearchPage(query: string, page: number, locale: string) {
  const safePageSize = Math.min(PAGE_SIZE, MAX_PAGE_SIZE);
  const from = page * safePageSize;
  const to = from + safePageSize - 1;

  return productSearch({ query, from, to, locale });
}
```

---

### Anti-Pattern: Rebuilding Search Ranking Logic Client-Side

**What happens**: Developers fetch search results and then re-sort or re-filter them in the frontend instead of using the API's built-in `sort` parameter and facet paths.

**Why it fails**: Intelligent Search's ranking algorithm considers relevance, sales velocity, availability, and shopper behavior. Client-side re-sorting discards this intelligence. Additionally, client-side filtering only works on the current page of results, not the full catalog — a user filtering by "Red" would only see red items from the current 24 results, not from all matching products.

**Fix**: Use the API's `sort` parameter and facet path for all filtering and sorting. Let the search engine do what it was designed to do.

```typescript
// Use API-level sorting — don't re-sort in the frontend
const results = await productSearch({
  query: "shirt",
  sort: "price:asc", // API handles sorting across entire result set
  locale: "en-US",
  from: 0,
  to: 23,
  facets: "category-1/clothing/color/red", // API handles filtering across entire catalog
});
```

## Reference

**Links to VTEX documentation and related resources.**

- [Headless catalog and search](https://developers.vtex.com/docs/guides/headless-catalog) — Overview of catalog browsing and search in headless stores
- [Intelligent Search API reference](https://developers.vtex.com/docs/api-reference/intelligent-search-api) — Complete API reference for all search endpoints
- [Intelligent Search Events API - Headless](https://developers.vtex.com/docs/api-reference/intelligent-search-events-api-headless) — Events API for sending analytics from headless implementations
- [Intelligent Search overview](https://help.vtex.com/en/docs/tutorials/intelligent-search-overview) — General overview of Intelligent Search capabilities
- [Search configuration](https://help.vtex.com/en/docs/tutorials/search-configuration) — How to configure searchable specifications, facet ordering, and other search settings
- [Autocomplete](https://help.vtex.com/en/docs/tutorials/autocomplete) — How autocomplete suggestions work in Intelligent Search
