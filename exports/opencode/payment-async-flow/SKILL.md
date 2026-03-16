---
name: payment-async-flow
description: Apply when implementing asynchronous payment methods (Boleto, Pix, bank redirects) or working with callback URLs in payment connector code. Covers undefined status response, callbackUrl notification, X-VTEX-signature validation, sync vs async handling, and the 7-day retry window. Use for any payment flow where authorization does not complete synchronously.
---

# Asynchronous Payment Flows & Callbacks

## Overview

**What this skill covers**: The complete asynchronous payment authorization flow in the VTEX Payment Provider Protocol. This includes returning `undefined` status for pending payments, using the `callbackUrl` to notify the Gateway of final status, handling the difference between notification callbacks (non-VTEX IO) and retry callbacks (VTEX IO), and managing the 7-day retry window.

**When to use it**: When implementing a payment connector that supports any asynchronous payment method — Boleto Bancário, Pix, bank transfers, redirect-based flows, or any method where the acquirer does not return a final status synchronously.

**What you'll learn**:
- When and how to return `undefined` status from Create Payment
- How the `callbackUrl` notification and retry flows work
- How to validate `X-VTEX-signature` on callback URLs
- How to handle the Gateway's automatic 7-day retry cycle

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: The `undefined` Status

When a payment cannot be resolved immediately (the acquirer needs time, the customer must complete an action), the connector returns `status: "undefined"` in the Create Payment response. This tells the Gateway the payment is pending — not failed, not approved. The Gateway will then wait and retry until a final status (`approved` or `denied`) is received.

### Concept 2: Callback URL — Two Flows

The `callbackUrl` is provided in the Create Payment request body. Its behavior depends on the hosting model:

- **Without VTEX IO** (partner infrastructure): The `callbackUrl` is a **notification endpoint**. The provider POSTs the updated status directly to this URL with `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers.
- **With VTEX IO**: The `callbackUrl` is a **retry endpoint**. The provider calls this URL (no payload required) to trigger the Gateway to re-call the Create Payment (`/payments`) endpoint. The Gateway then receives the updated status from the provider's response.

Both flows require the `X-VTEX-signature` query parameter to be preserved when calling the callback URL.

### Concept 3: The 7-Day Retry Window

If a payment remains in `undefined` status, the VTEX Gateway automatically retries the Create Payment endpoint periodically for up to 7 days. During this window, the connector must be prepared to receive repeated Create Payment calls with the same `paymentId`. When the payment is finally resolved, the connector returns the final status. If still `undefined` after 7 days, the payment is automatically cancelled.

### Concept 4: X-VTEX-signature

The `callbackUrl` includes a query parameter `X-VTEX-signature`. This is a mandatory authentication token that identifies the transaction. When calling the callback URL, the provider must use the URL exactly as received (including all query parameters) to ensure the Gateway can authenticate the callback.

**Architecture/Data Flow (Non-VTEX IO)**:

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (with X-VTEX-API-AppKey/AppToken headers)
4. Gateway updates payment status to approved/denied
```

**Architecture/Data Flow (VTEX IO)**:

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (retry, no payload)
4. Gateway → POST /payments → Connector (returns status: "approved"/"denied")
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: MUST Return `undefined` for Async Payment Methods

**Rule**: For any payment method where authorization does not complete synchronously (Boleto, Pix, bank transfer, redirect-based auth), the Create Payment response MUST use `status: "undefined"`. The connector MUST NOT return `"approved"` or `"denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why**: Returning `"approved"` for an unconfirmed payment tells the Gateway the money has been collected. The order is released for fulfillment immediately. If the customer never actually pays (e.g., never scans the Pix QR code), the merchant ships products without payment. Returning `"denied"` prematurely cancels a payment that might still be completed by the customer.

**Detection**: If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect), STOP. Async methods must return `"undefined"` and resolve via callback.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const asyncMethods = ["BankInvoice", "Pix"];
  const isAsync = asyncMethods.includes(paymentMethod);

  if (isAsync) {
    const pending = await acquirer.initiateAsyncPayment(req.body);

    // Store callbackUrl for later notification
    await store.save(paymentId, {
      paymentId,
      status: "undefined",
      callbackUrl,
      acquirerReference: pending.reference,
    });

    res.status(200).json({
      paymentId,
      status: "undefined",  // Correct: payment is pending
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "PENDING",
      message: "Awaiting customer action",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: 604800,  // 7 days for async
      paymentUrl: pending.qrCodeUrl ?? pending.boletoUrl ?? undefined,
    });
    return;
  }

  // Synchronous methods (credit card) can return final status
  const result = await acquirer.authorizeSyncPayment(req.body);
  res.status(200).json({
    paymentId,
    status: result.status,  // "approved" or "denied" is OK for sync
    // ... other fields
  });
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod } = req.body;

  // WRONG: Creating a Pix charge and immediately returning "approved"
  // The customer hasn't scanned the QR code yet — no money collected
  const pixCharge = await acquirer.createPixCharge(req.body);

  res.status(200).json({
    paymentId,
    status: "approved",  // WRONG — Pix hasn't been paid yet!
    authorizationId: pixCharge.id,
    nsu: null,
    tid: null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

---

### Constraint: MUST Use callbackUrl from Request — Never Hardcode

**Rule**: The connector MUST use the exact `callbackUrl` provided in the Create Payment request body, including all query parameters (`X-VTEX-signature`, etc.). The connector MUST NOT hardcode callback URLs or construct them manually.

**Why**: The `callbackUrl` contains transaction-specific authentication tokens (`X-VTEX-signature`) that the Gateway uses to validate the callback. A hardcoded or modified URL will be rejected by the Gateway, leaving the payment stuck in `undefined` status forever. The URL format may also change between environments (production vs sandbox).

**Detection**: If the connector hardcodes a callback URL string, constructs the URL manually, or strips query parameters from the `callbackUrl`, warn the developer. The `callbackUrl` must be stored and used exactly as received.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, callbackUrl } = req.body;

  // Store the exact callbackUrl from the request
  await store.save(paymentId, {
    paymentId,
    status: "undefined",
    callbackUrl,  // Stored exactly as received, including query params
  });

  // ... return undefined response
}

// When the acquirer webhook arrives, use the stored callbackUrl
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const { paymentReference, status } = req.body;
  const payment = await store.findByAcquirerRef(paymentReference);
  if (!payment) { res.status(404).send(); return; }

  // Update local state
  await store.updateStatus(payment.paymentId, status === "paid" ? "approved" : "denied");

  // Use the EXACT stored callbackUrl — do not modify it
  await fetch(payment.callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
      "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
    },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      status: status === "paid" ? "approved" : "denied",
    }),
  });

  res.status(200).send();
}
```

❌ **WRONG**:
```typescript
// WRONG: Hardcoding callback URL — ignores X-VTEX-signature and environment
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const { paymentReference, status } = req.body;
  const payment = await store.findByAcquirerRef(paymentReference);

  // WRONG — hardcoded URL, missing X-VTEX-signature authentication
  await fetch("https://mystore.vtexpayments.com.br/api/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      status: status === "paid" ? "approved" : "denied",
    }),
  });

  res.status(200).send();
}
```

---

### Constraint: MUST Be Ready for Repeated Create Payment Calls

**Rule**: The connector MUST handle the Gateway calling Create Payment with the same `paymentId` multiple times during the 7-day retry window. Each call must return the current payment status (which may have been updated via callback since the last call).

**Why**: The Gateway retries `undefined` payments automatically. If the connector treats each call as a new payment, it will create duplicate charges. If the connector always returns the original `undefined` status without checking for updates, the Gateway never learns that the payment was approved, and eventually cancels it.

**Detection**: If the Create Payment handler does not check for an existing `paymentId` and return the latest status, STOP. The handler must support idempotent retries that reflect the current state.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // Check for existing payment — may have been updated via callback
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    // Return current status — may have changed from "undefined" to "approved"
    res.status(200).json({
      ...existing.response,
      status: existing.status,  // Reflects the latest state
    });
    return;
  }

  // First time — create new payment
  // ...
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // WRONG: Always returns the original cached response without checking
  // if the status has been updated. Gateway never sees "approved".
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    // Always returns the stale "undefined" response — never updates
    res.status(200).json(existing.originalResponse);
    return;
  }

  // ...
}
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Classify Payment Methods as Sync or Async

Determine which payment methods require async handling at the start of the Create Payment flow.

```typescript
const ASYNC_PAYMENT_METHODS = new Set([
  "BankInvoice",   // Boleto Bancário
  "Pix",           // Pix instant payments
]);

function isAsyncPaymentMethod(paymentMethod: string): boolean {
  return ASYNC_PAYMENT_METHODS.has(paymentMethod);
}
```

### Step 2: Implement Async Create Payment with callbackUrl Storage

Return `undefined` and store the `callbackUrl` for later use.

```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  // Idempotency check — return latest status if payment exists
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json({
      ...existing.response,
      status: existing.status,
    });
    return;
  }

  if (isAsyncPaymentMethod(paymentMethod)) {
    const pending = await acquirer.initiateAsync(req.body);

    const response = {
      paymentId,
      status: "undefined" as const,
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "ASYNC-PENDING",
      message: "Awaiting payment confirmation",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: 604800,
      paymentUrl: pending.paymentUrl ?? undefined,
    };

    await store.save(paymentId, {
      paymentId,
      status: "undefined",
      callbackUrl,
      acquirerRef: pending.reference,
      response,
    });

    res.status(200).json(response);
    return;
  }

  // Sync flow — process and return final status
  const result = await acquirer.authorizeSync(req.body);
  const response = {
    paymentId,
    status: result.approved ? "approved" : "denied",
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };

  await store.save(paymentId, {
    paymentId,
    status: response.status,
    response,
  });

  res.status(200).json(response);
}
```

### Step 3: Implement the Acquirer Webhook Handler with Callback Notification

When the acquirer confirms the payment, update local state and notify the Gateway.

```typescript
// Non-VTEX IO: Use notification callback
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const webhookData = req.body;
  const acquirerRef = webhookData.transactionId;
  const acquirerStatus = webhookData.status; // "paid", "expired", "failed"

  const payment = await store.findByAcquirerRef(acquirerRef);
  if (!payment || !payment.callbackUrl) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  // Map acquirer status to PPP status
  const pppStatus = acquirerStatus === "paid" ? "approved" : "denied";

  // Update local state FIRST
  await store.updateStatus(payment.paymentId, pppStatus);

  // Notify the Gateway via callbackUrl — use it exactly as stored
  try {
    await fetch(payment.callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
        "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
      },
      body: JSON.stringify({
        paymentId: payment.paymentId,
        status: pppStatus,
      }),
    });
  } catch (error) {
    // Log the error but don't fail — the Gateway will also retry via /payments
    console.error(`Callback failed for ${payment.paymentId}:`, error);
    // The Gateway's 7-day retry on /payments acts as a safety net
  }

  res.status(200).json({ received: true });
}

// For VTEX IO: Use retry callback (no payload needed)
async function handleAcquirerWebhookVtexIO(req: Request, res: Response): Promise<void> {
  const webhookData = req.body;
  const acquirerRef = webhookData.transactionId;

  const payment = await store.findByAcquirerRef(acquirerRef);
  if (!payment || !payment.callbackUrl) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  const pppStatus = webhookData.status === "paid" ? "approved" : "denied";
  await store.updateStatus(payment.paymentId, pppStatus);

  // VTEX IO: Just call the retry URL — Gateway will re-call POST /payments
  try {
    await fetch(payment.callbackUrl, { method: "POST" });
  } catch (error) {
    console.error(`Retry callback failed for ${payment.paymentId}:`, error);
  }

  res.status(200).json({ received: true });
}
```

### Complete Example

Full async payment flow with webhook and callback:

```typescript
import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

const ASYNC_METHODS = new Set(["BankInvoice", "Pix"]);

// Create Payment — supports both sync and async methods
app.post("/payments", async (req: Request, res: Response) => {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json({ ...existing.response, status: existing.status });
    return;
  }

  if (ASYNC_METHODS.has(paymentMethod)) {
    const pending = await acquirer.initiateAsync(req.body);
    const response = buildAsyncResponse(paymentId, pending);
    await store.save(paymentId, {
      paymentId, status: "undefined", callbackUrl,
      acquirerRef: pending.reference, response,
    });
    res.status(200).json(response);
  } else {
    const result = await acquirer.authorizeSync(req.body);
    const response = buildSyncResponse(paymentId, result);
    await store.save(paymentId, { paymentId, status: response.status, response });
    res.status(200).json(response);
  }
});

// Acquirer Webhook — receives payment confirmation, notifies Gateway
app.post("/webhooks/acquirer", async (req: Request, res: Response) => {
  const { transactionId, status: acquirerStatus } = req.body;
  const payment = await store.findByAcquirerRef(transactionId);
  if (!payment) { res.status(404).send(); return; }

  const pppStatus = acquirerStatus === "paid" ? "approved" : "denied";
  await store.updateStatus(payment.paymentId, pppStatus);

  if (payment.callbackUrl) {
    try {
      await fetch(payment.callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
          "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
        },
        body: JSON.stringify({ paymentId: payment.paymentId, status: pppStatus }),
      });
    } catch (err) {
      console.error("Callback failed, Gateway will retry via /payments", err);
    }
  }

  res.status(200).send();
});

app.listen(443);
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Synchronous Approval of Async Payments

**What happens**: The connector receives a Pix or Boleto Create Payment request and immediately returns `status: "approved"` because the QR code or slip was generated successfully.

**Why it fails**: Generating a QR code or Boleto slip is not the same as receiving payment. The customer still needs to scan/pay. Returning `"approved"` triggers order fulfillment before payment is confirmed. The merchant ships products and never receives payment.

**Fix**: Always return `"undefined"` for async methods and wait for acquirer confirmation:

```typescript
if (ASYNC_METHODS.has(paymentMethod)) {
  const pending = await acquirer.initiateAsync(req.body);
  res.status(200).json({
    paymentId,
    status: "undefined",  // Never "approved" for async
    // ...
    paymentUrl: pending.qrCodeUrl,  // Customer scans this to pay
  });
}
```

---

### Anti-Pattern: Ignoring the callbackUrl

**What happens**: The connector does not store the `callbackUrl` from the Create Payment request and relies entirely on the Gateway's automatic retries to detect payment completion.

**Why it fails**: The Gateway's retry interval increases over time. Without callback notification, there can be a long delay between the customer paying and the order being approved. This creates a poor customer experience and increases support tickets. In worst cases, the 7-day window expires and the payment is cancelled even though the customer paid.

**Fix**: Always store and use the `callbackUrl`:

```typescript
// Store the callbackUrl when creating the payment
await store.save(paymentId, {
  paymentId,
  status: "undefined",
  callbackUrl: req.body.callbackUrl,  // Store this!
  acquirerRef: pending.reference,
});

// Use it when the acquirer confirms payment
async function onAcquirerConfirmation(paymentId: string): Promise<void> {
  const payment = await store.findByPaymentId(paymentId);
  if (payment?.callbackUrl) {
    await fetch(payment.callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
        "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
      },
      body: JSON.stringify({ paymentId, status: "approved" }),
    });
  }
}
```

---

### Anti-Pattern: No Retry Logic for Failed Callbacks

**What happens**: The connector calls the `callbackUrl` once, and if the request fails (network error, timeout, 5xx), it silently drops the notification.

**Why it fails**: If the callback fails and the connector doesn't retry, the Gateway never learns the payment was approved. The payment sits in `undefined` until the Gateway's next retry of Create Payment, which may be hours away. In the worst case, the payment is auto-cancelled after 7 days.

**Fix**: Implement retry logic with exponential backoff for callback failures:

```typescript
async function notifyGateway(callbackUrl: string, payload: object): Promise<void> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
          "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) return;

      console.error(`Callback attempt ${attempt + 1} failed: ${response.status}`);
    } catch (error) {
      console.error(`Callback attempt ${attempt + 1} error:`, error);
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }

  // All retries failed — Gateway will still retry via /payments as safety net
  console.error("All callback retries exhausted. Relying on Gateway retry.");
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Detailed explanation of the `undefined` status, callback URL notification and retry flows, and the 7-day retry window
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization flow documentation including async retry mechanics and callback URL behavior for VTEX IO vs non-VTEX IO
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint-level implementation guide with callbackUrl and returnUrl usage
- [Pix: Instant Payments in Brazil](https://developers.vtex.com/docs/guides/payments-integration-pix-instant-payments-in-brazil) — Pix-specific async flow implementation including QR code generation and callback handling
- [Callback URL Signature Authentication](https://help.vtex.com/en/announcements/2024-05-03-callback-url-signature-authentication-token) — Mandatory X-VTEX-signature requirement for callback URL authentication (effective June 2024)
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with callbackUrl field documentation
