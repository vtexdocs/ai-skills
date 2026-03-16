---
name: headless-checkout-proxy
description: Apply when implementing cart, checkout, or order placement logic proxied through a BFF for headless VTEX storefronts. Covers OrderForm lifecycle, cart creation, item management, profile/shipping/payment attachments, orderFormId management, and secure checkout flows. Use for any headless frontend that needs to proxy VTEX Checkout API calls through a server-side layer with proper session cookie handling.
---

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
