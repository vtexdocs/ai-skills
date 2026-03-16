---
name: headless-bff-architecture
description: Apply when designing or modifying a BFF (Backend-for-Frontend) layer, middleware, or API proxy for a headless VTEX storefront. Covers BFF middleware architecture, public vs private API classification, VtexIdclientAutCookie management, API key protection, and secure request proxying. Use for any headless commerce project that must never expose VTEX_APP_KEY or call private VTEX APIs from the browser.
---

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
