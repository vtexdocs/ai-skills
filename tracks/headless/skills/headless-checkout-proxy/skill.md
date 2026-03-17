---
name: headless-checkout-proxy
description: >
  Apply when implementing cart, checkout, or order placement logic proxied through a BFF for headless VTEX
  storefronts. Covers OrderForm lifecycle, cart creation, item management, profile/shipping/payment attachments,
  orderFormId management, and secure checkout flows. Use for any headless frontend that needs to proxy VTEX
  Checkout API calls through a server-side layer with proper session cookie handling.
metadata:
  track: headless
  tags:
    - checkout
    - orderform
    - cart
    - bff
    - headless
    - security
    - proxy
  globs:
    - "**/checkout/**/*.ts"
    - "**/order/**/*.ts"
    - "**/cart/**/*.ts"
  version: "1.0"
  purpose: Proxy VTEX Checkout API securely through a BFF with proper OrderForm and cookie management
  applies_to:
    - implementing cart operations in a headless storefront
    - proxying checkout API calls through a BFF
    - managing orderFormId and checkout cookies server-side
    - implementing the 3-step order placement flow
  excludes:
    - general BFF architecture decisions (see headless-bff-architecture)
    - search API integration (see headless-intelligent-search)
    - caching strategy for API responses (see headless-caching-strategy)
  decision_scope:
    - orderform-session-management
    - checkout-cookie-handling
    - order-placement-flow-design
  vtex_docs_verified: "2026-03-16"
---

# Checkout API Proxy & OrderForm Management

## When this skill applies

Use this skill when building cart and checkout functionality for any headless VTEX storefront. Every cart and checkout operation must go through the BFF.

- Implementing cart creation, item add/update/remove operations
- Attaching profile, shipping, or payment data to an OrderForm
- Implementing the 3-step order placement flow (place → pay → process)
- Managing `orderFormId` and `CheckoutOrderFormOwnership` cookies server-side

Do not use this skill for:
- General BFF architecture and API routing (use [`headless-bff-architecture`](../headless-bff-architecture/skill.md))
- Search API integration (use [`headless-intelligent-search`](../headless-intelligent-search/skill.md))
- Caching strategy decisions (use [`headless-caching-strategy`](../headless-caching-strategy/skill.md))

## Decision rules

- ALL Checkout API calls MUST be proxied through the BFF — no exceptions. The Checkout API handles sensitive personal data (profile, address, payment).
- Store `orderFormId` in a server-side session, never in `localStorage` or `sessionStorage`.
- Capture and forward `CheckoutOrderFormOwnership` and `checkout.vtex.com` cookies between the BFF and VTEX on every request.
- Validate all inputs server-side before forwarding to VTEX — never pass raw `req.body` directly.
- Execute the 3-step order placement flow (place order → send payment → process order) in a single synchronous BFF handler to stay within the **5-minute window**.
- Always store and reuse the existing `orderFormId` from the session — only create a new cart when no `orderFormId` exists.

OrderForm attachment endpoints:

| Attachment | Endpoint | Purpose |
|---|---|---|
| items | `POST .../orderForm/{id}/items` | Add, remove, or update cart items |
| clientProfileData | `POST .../orderForm/{id}/attachments/clientProfileData` | Customer profile info |
| shippingData | `POST .../orderForm/{id}/attachments/shippingData` | Address and delivery option |
| paymentData | `POST .../orderForm/{id}/attachments/paymentData` | Payment method selection |
| marketingData | `POST .../orderForm/{id}/attachments/marketingData` | Coupons and UTM data |

## Hard constraints

### Constraint: ALL checkout operations MUST go through BFF

Client-side code MUST NOT make direct HTTP requests to any VTEX Checkout API endpoint (`/api/checkout/`). All checkout operations — cart creation, item management, profile updates, shipping, payment, and order placement — must be proxied through the BFF layer.

**Why this matters**

Checkout endpoints handle sensitive personal data (email, address, phone, payment details). Direct frontend calls expose the request/response flow to browser DevTools, extensions, and XSS attacks. Additionally, the BFF layer is needed to manage `VtexIdclientAutCookie` and `CheckoutOrderFormOwnership` cookies server-side, validate inputs, and prevent cart manipulation (e.g., price tampering).

**Detection**

If you see `fetch` or `axios` calls to `/api/checkout/` in any client-side code (browser-executed JavaScript, frontend source files) → STOP immediately. All checkout calls must route through BFF endpoints.

**Correct**

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

**Wrong**

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

### Constraint: orderFormId MUST be managed server-side

The `orderFormId` MUST be stored in a secure server-side session. It SHOULD NOT be stored in `localStorage`, `sessionStorage`, or exposed to the frontend in a way that allows direct VTEX API calls.

**Why this matters**

The `orderFormId` is the key to a customer's shopping cart and all data within it — profile information, shipping address, payment details. If exposed client-side, an attacker could use it to query VTEX directly and retrieve personal data, or manipulate the cart by adding/removing items through direct API calls bypassing any validation logic.

**Detection**

If you see `orderFormId` stored in `localStorage` or `sessionStorage` → STOP immediately. It should be managed in the BFF session.

**Correct**

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

**Wrong**

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

### Constraint: MUST validate all inputs server-side before forwarding to VTEX

The BFF MUST validate all input data before forwarding requests to the VTEX Checkout API. This includes validating SKU IDs, quantities, email formats, address fields, and coupon codes.

**Why this matters**

Without server-side validation, malicious users can send crafted requests through the BFF to VTEX with invalid or manipulative data — negative quantities, SQL injection in text fields, or spoofed seller IDs. While VTEX has its own validation, defense-in-depth requires validating at the BFF layer to catch issues early and provide clear error messages.

**Detection**

If BFF route handlers pass `req.body` directly to VTEX API calls without any validation or sanitization → STOP immediately. All inputs must be validated before proxying.

**Correct**

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

**Wrong**

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

## Preferred pattern

Request flow through the BFF for checkout operations:

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

VTEX Checkout API client with cookie management:

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

Cart management BFF routes:

```typescript
// server/routes/cart.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const cartRoutes = Router();

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
```

Order placement — all 3 steps in a single handler to respect the **5-minute window**:

```typescript
// server/routes/order.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const orderRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

// POST /api/bff/order/place — place order from existing cart
// CRITICAL: All 3 steps must complete within 5 minutes or the order is canceled
orderRoutes.post("/place", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    // Step 1: Place order — starts the 5-minute timer
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

    // Step 2: Send payment — immediately after placement
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

    // Step 3: Process order — immediately after payment
    await vtexCheckout<unknown>({
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

## Common failure modes

- **Creating a new cart on every page load**: Calling `GET /api/checkout/pub/orderForm` without an `orderFormId` on every page load creates a new empty cart each time, abandoning the previous one. Always store and reuse the `orderFormId` from the server-side session.

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

- **Ignoring the 5-minute order processing window**: Placing an order (step 1) but delaying payment or processing beyond 5 minutes causes VTEX to automatically cancel the order as `incomplete`. Execute all three steps (place order → send payment → process order) sequentially and immediately in a single BFF request handler. Never split these across multiple independent frontend calls.

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

- **Exposing raw VTEX error messages to the frontend**: Forwarding VTEX API error responses directly to the frontend leaks internal details (account names, API paths, data structures). Map VTEX errors to user-friendly messages in the BFF and log the full error server-side.

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

## Review checklist

- [ ] Are ALL checkout API calls routed through the BFF (no direct frontend calls to `/api/checkout/`)?
- [ ] Is `orderFormId` stored in a server-side session, not in `localStorage` or `sessionStorage`?
- [ ] Are `CheckoutOrderFormOwnership` and `checkout.vtex.com` cookies captured from VTEX responses and forwarded on subsequent requests?
- [ ] Are all inputs validated server-side before forwarding to VTEX?
- [ ] Does the order placement handler execute all 3 steps (place → pay → process) in a single synchronous flow within the 5-minute window?
- [ ] Is the existing `orderFormId` reused from the session rather than creating a new cart on every page load?
- [ ] Are VTEX error responses sanitized before being sent to the frontend?

## Reference

- [Headless cart and checkout](https://developers.vtex.com/docs/guides/headless-cart-and-checkout) — Complete guide to implementing cart and checkout in headless stores
- [Checkout API reference](https://developers.vtex.com/docs/api-reference/checkout-api) — Full API reference for all Checkout endpoints
- [orderForm fields](https://developers.vtex.com/docs/guides/orderform-fields) — Detailed documentation of the OrderForm data structure
- [Creating a regular order from an existing cart](https://developers.vtex.com/docs/guides/creating-a-regular-order-from-an-existing-cart) — Step-by-step guide to the order placement flow
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores
- [Add cart items](https://developers.vtex.com/docs/guides/add-cart-items) — Guide to adding products to a shopping cart
