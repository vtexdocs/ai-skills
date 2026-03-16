This skill provides guidance for AI agents working with VTEX Payment Connector Development. Apply these constraints and patterns when assisting developers with apply when implementing asynchronous payment methods (boleto, pix, bank redirects) or working with callback urls in payment connector code. covers undefined status response, callbackurl notification, x-vtex-signature validation, sync vs async handling, and the 7-day retry window. use for any payment flow where authorization does not complete synchronously.

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

---

This skill provides guidance for AI agents working with VTEX Payment Connector Development. Apply these constraints and patterns when assisting developers with apply when implementing idempotency logic in payment connector code or handling duplicate payment requests. covers paymentid as idempotency key, payment state machine transitions, retry semantics for cancellation and refund operations, and requestid handling. use for preventing duplicate charges and ensuring correct gateway retry behavior across create payment, cancel, capture, and refund endpoints.

# Idempotency & Duplicate Prevention

## Overview

**What this skill covers**: Idempotency patterns for VTEX Payment Provider Protocol connectors. This includes using `paymentId` as the primary idempotency key for Create Payment, using `requestId` for Cancel/Capture/Refund operations, implementing a payment state machine, and handling Gateway retries that can occur for up to 7 days on `undefined` status payments.

**When to use it**: When implementing any PPP endpoint handler that processes payments, cancellations, captures, or refunds. Use this skill whenever you need to ensure that repeated Gateway calls with the same identifiers produce identical results without re-processing.

**What you'll learn**:
- How `paymentId` and `requestId` function as idempotency keys across different endpoints
- How to build a state machine that prevents invalid transitions
- How to store and return cached responses for duplicate requests
- Why the Gateway retries `undefined` payments for up to 7 days

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: paymentId as Idempotency Key

Every Create Payment request from the VTEX Gateway includes a unique `paymentId`. This identifier is the canonical idempotency key for the payment lifecycle. If the Gateway sends a second Create Payment request with the same `paymentId`, the connector MUST return the exact same response as the first call without creating a new transaction at the acquirer. The Gateway retries Create Payment calls with `undefined` status for up to 7 days.

### Concept 2: requestId for Operation Idempotency

Cancel, Capture, and Refund requests include a `requestId` field that ensures operational idempotency. The cancellation flow can be retried for an entire day. Each `requestId` represents a single logical operation — if the connector receives the same `requestId` again, it must return the previously computed result without re-executing the operation at the acquirer.

### Concept 3: Payment State Machine

A payment moves through defined states: `undefined` → `approved` → `settled` or `undefined` → `denied` or `approved` → `cancelled`. The connector must enforce valid transitions. An `approved` payment cannot be approved again; a `cancelled` payment cannot be captured. The state machine prevents double-charging and ensures idempotent behavior.

**Architecture/Data Flow**:

```text
Gateway sends POST /payments (paymentId=ABC)
  → Connector checks store: paymentId=ABC exists?
    → YES: return stored response (no acquirer call)
    → NO: process with acquirer, store result, return response

Gateway retries POST /payments (paymentId=ABC) [up to 7 days if undefined]
  → Connector finds paymentId=ABC in store → returns stored response
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: MUST Use paymentId as Idempotency Key for Create Payment

**Rule**: The connector MUST check for an existing record with the given `paymentId` before processing a new payment. If a record exists, return the stored response without calling the acquirer again.

**Why**: The VTEX Gateway retries Create Payment requests with `undefined` status for up to 7 days. Without idempotency on `paymentId`, each retry creates a new charge at the acquirer, resulting in duplicate charges to the customer. This is a financial loss and a critical production incident.

**Detection**: If the Create Payment handler does not check for an existing `paymentId` before processing, STOP. The handler must query the data store for the `paymentId` first.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // Check for existing payment — idempotency guard
  const existingPayment = await paymentStore.findByPaymentId(paymentId);
  if (existingPayment) {
    // Return the exact same response — no new acquirer call
    res.status(200).json(existingPayment.response);
    return;
  }

  // First time seeing this paymentId — process with acquirer
  const result = await acquirer.authorize(req.body);

  const response = {
    paymentId,
    status: result.status,
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

  // Store the response for future idempotent lookups
  await paymentStore.save(paymentId, { request: req.body, response });

  res.status(200).json(response);
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // No idempotency check — every call hits the acquirer
  // If the Gateway retries this (which it will for undefined status),
  // the customer gets charged multiple times
  const result = await acquirer.authorize(req.body);

  res.status(200).json({
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
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

### Constraint: MUST Return Identical Response for Duplicate Requests

**Rule**: When the connector receives a Create Payment request with a `paymentId` that already exists in the data store, it MUST return the exact stored response. It MUST NOT create a new record, generate new identifiers, or re-process the payment.

**Why**: The Gateway uses the response fields (`authorizationId`, `tid`, `nsu`, `status`) to track the transaction. If a retry returns different values, the Gateway loses track of the original transaction, causing reconciliation failures and potential double settlements.

**Detection**: If the handler creates a new database record or generates new identifiers when it finds an existing `paymentId`, STOP. The handler must return the previously stored response verbatim.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  const existing = await paymentStore.findByPaymentId(paymentId);
  if (existing) {
    // Return the EXACT stored response — same authorizationId, tid, nsu, status
    res.status(200).json(existing.response);
    return;
  }

  // ... process new payment and store response
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  const existing = await paymentStore.findByPaymentId(paymentId);
  if (existing) {
    // WRONG: Generating new identifiers for an existing payment
    // The Gateway will see different tid/nsu and lose track of the transaction
    const newTid = generateNewTid();
    res.status(200).json({
      ...existing.response,
      tid: newTid,  // Different from original — breaks reconciliation
      nsu: generateNewNsu(),
    });
    return;
  }

  // ... process new payment
}
```

---

### Constraint: MUST NOT Approve Async Payments Synchronously

**Rule**: If a payment method is asynchronous (e.g., Boleto, Pix, bank redirect), the Create Payment response MUST return `status: "undefined"`. It MUST NOT return `status: "approved"` or `status: "denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why**: Returning `approved` for an async method tells the Gateway the payment is confirmed before the customer has actually paid. The order ships, but no money was collected. The merchant loses the product and the revenue. The correct flow is to return `undefined` and use the `callbackUrl` to notify the Gateway when the payment is confirmed.

**Detection**: If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect-based), STOP. Async methods must return `"undefined"` and use callbacks.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const isAsyncMethod = ["BankInvoice", "Pix"].includes(paymentMethod);

  if (isAsyncMethod) {
    // Initiate async payment — do NOT return approved
    const pending = await acquirer.initiateAsyncPayment(req.body);

    await paymentStore.save(paymentId, {
      status: "undefined",
      callbackUrl,
      acquirerRef: pending.reference,
    });

    res.status(200).json({
      paymentId,
      status: "undefined",  // Correct for async
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "ASYNC-PENDING",
      message: "Awaiting customer payment",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: 604800,  // 7 days for async
      paymentUrl: pending.paymentUrl,
    });
    return;
  }

  // Sync methods can return approved/denied immediately
  // ...
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod } = req.body;

  // WRONG: Approving a Pix payment synchronously
  // The customer hasn't paid yet — the order will ship without payment
  const result = await acquirer.createPixCharge(req.body);

  res.status(200).json({
    paymentId,
    status: "approved",  // WRONG — Pix is async, should be "undefined"
    authorizationId: result.authorizationId ?? null,
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

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Create a Payment State Store

Build a persistent store keyed by `paymentId` that tracks payment state and cached responses.

```typescript
interface PaymentRecord {
  paymentId: string;
  status: "undefined" | "approved" | "denied" | "cancelled" | "settled" | "refunded";
  response: Record<string, unknown>;
  callbackUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface OperationRecord {
  requestId: string;
  paymentId: string;
  operation: "cancel" | "capture" | "refund";
  response: Record<string, unknown>;
  createdAt: Date;
}

class PaymentStore {
  // Use a database in production (PostgreSQL, DynamoDB, VBase for VTEX IO)
  private payments = new Map<string, PaymentRecord>();
  private operations = new Map<string, OperationRecord>();

  async findByPaymentId(paymentId: string): Promise<PaymentRecord | null> {
    return this.payments.get(paymentId) ?? null;
  }

  async save(paymentId: string, record: PaymentRecord): Promise<void> {
    this.payments.set(paymentId, record);
  }

  async updateStatus(paymentId: string, status: PaymentRecord["status"]): Promise<void> {
    const record = this.payments.get(paymentId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date();
    }
  }

  async findOperation(requestId: string): Promise<OperationRecord | null> {
    return this.operations.get(requestId) ?? null;
  }

  async saveOperation(requestId: string, record: OperationRecord): Promise<void> {
    this.operations.set(requestId, record);
  }
}
```

### Step 2: Implement Idempotent Create Payment

Guard every Create Payment call with a `paymentId` lookup.

```typescript
const store = new PaymentStore();

async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body;
  const { paymentId, paymentMethod, callbackUrl } = body;

  // Idempotency check
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json(existing.response);
    return;
  }

  const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);
  const result = await acquirer.process(body);

  const status = isAsync ? "undefined" : result.status;
  const response = {
    paymentId,
    status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: isAsync ? 604800 : 21600,
    ...(result.paymentUrl ? { paymentUrl: result.paymentUrl } : {}),
  };

  await store.save(paymentId, {
    paymentId,
    status,
    response,
    callbackUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  res.status(200).json(response);
}
```

### Step 3: Implement Idempotent Cancel/Capture/Refund with requestId

Guard operations using `requestId` and enforce valid state transitions.

```typescript
async function cancelPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.params;
  const { requestId } = req.body;

  // Operation idempotency check
  const existingOp = await store.findOperation(requestId);
  if (existingOp) {
    res.status(200).json(existingOp.response);
    return;
  }

  // State machine validation
  const payment = await store.findByPaymentId(paymentId);
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  if (payment.status === "cancelled") {
    // Already cancelled — return success idempotently
    const response = {
      paymentId,
      cancellationId: null,
      code: "already-cancelled",
      message: "Payment was already cancelled",
      requestId,
    };
    res.status(200).json(response);
    return;
  }

  if (!["undefined", "approved"].includes(payment.status)) {
    res.status(200).json({
      paymentId,
      cancellationId: null,
      code: "cancel-failed",
      message: `Cannot cancel payment in ${payment.status} state`,
      requestId,
    });
    return;
  }

  const result = await acquirer.cancel(paymentId);
  const response = {
    paymentId,
    cancellationId: result.cancellationId ?? null,
    code: result.code ?? null,
    message: result.message ?? "Successfully cancelled",
    requestId,
  };

  await store.updateStatus(paymentId, "cancelled");
  await store.saveOperation(requestId, {
    requestId,
    paymentId,
    operation: "cancel",
    response,
    createdAt: new Date(),
  });

  res.status(200).json(response);
}
```

### Complete Example

Full idempotent payment lifecycle with state machine:

```typescript
import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

const store = new PaymentStore();

// Create Payment — idempotent on paymentId
app.post("/payments", async (req: Request, res: Response) => {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json(existing.response);
    return;
  }

  const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);
  const result = await acquirer.process(req.body);
  const status = isAsync ? "undefined" : result.status;

  const response = buildCreatePaymentResponse(paymentId, status, result, isAsync);
  await store.save(paymentId, {
    paymentId, status, response, callbackUrl,
    createdAt: new Date(), updatedAt: new Date(),
  });

  res.status(200).json(response);
});

// Cancel — idempotent on requestId, validates state
app.post("/payments/:paymentId/cancellations", async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const { requestId } = req.body;

  const existingOp = await store.findOperation(requestId);
  if (existingOp) { res.status(200).json(existingOp.response); return; }

  const payment = await store.findByPaymentId(paymentId);
  if (!payment || !["undefined", "approved"].includes(payment.status)) {
    res.status(200).json({ paymentId, cancellationId: null, code: "cancel-failed", message: "Invalid state", requestId });
    return;
  }

  const result = await acquirer.cancel(paymentId);
  const response = { paymentId, cancellationId: result.cancellationId ?? null, code: null, message: "Cancelled", requestId };
  await store.updateStatus(paymentId, "cancelled");
  await store.saveOperation(requestId, { requestId, paymentId, operation: "cancel", response, createdAt: new Date() });
  res.status(200).json(response);
});

// Capture — idempotent on requestId, validates state
app.post("/payments/:paymentId/settlements", async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const { requestId, value } = req.body;

  const existingOp = await store.findOperation(requestId);
  if (existingOp) { res.status(200).json(existingOp.response); return; }

  const payment = await store.findByPaymentId(paymentId);
  if (!payment || payment.status !== "approved") {
    res.status(200).json({ paymentId, settleId: null, value: 0, code: "capture-failed", message: "Invalid state", requestId });
    return;
  }

  const result = await acquirer.capture(paymentId, value);
  const response = { paymentId, settleId: result.settleId ?? null, value: result.capturedValue ?? value, code: null, message: null, requestId };
  await store.updateStatus(paymentId, "settled");
  await store.saveOperation(requestId, { requestId, paymentId, operation: "capture", response, createdAt: new Date() });
  res.status(200).json(response);
});

// Refund — idempotent on requestId, validates state
app.post("/payments/:paymentId/refunds", async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const { requestId, value, settleId } = req.body;

  const existingOp = await store.findOperation(requestId);
  if (existingOp) { res.status(200).json(existingOp.response); return; }

  const payment = await store.findByPaymentId(paymentId);
  if (!payment || payment.status !== "settled") {
    res.status(200).json({ paymentId, refundId: null, value: 0, code: "refund-failed", message: "Invalid state", requestId });
    return;
  }

  const result = await acquirer.refund(paymentId, value);
  const response = { paymentId, refundId: result.refundId ?? null, value: result.refundedValue ?? value, code: null, message: null, requestId };
  await store.updateStatus(paymentId, "refunded");
  await store.saveOperation(requestId, { requestId, paymentId, operation: "refund", response, createdAt: new Date() });
  res.status(200).json(response);
});

app.listen(443);
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Processing Duplicate Payments

**What happens**: The connector calls the acquirer for every Create Payment request without checking if the `paymentId` already exists in the data store.

**Why it fails**: The Gateway retries `undefined` payments for up to 7 days. Each retry creates a new charge at the acquirer. A single $100 payment can result in hundreds of charges totaling thousands of dollars. This is a critical financial bug.

**Fix**: Always check the data store before calling the acquirer:

```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // ALWAYS check for existing payment first
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json(existing.response);
    return;
  }

  // Only call acquirer for genuinely new payments
  const result = await acquirer.process(req.body);
  // ... store and return response
}
```

---

### Anti-Pattern: Synchronous Approval of Async Payment Methods

**What happens**: The connector returns `status: "approved"` immediately for Boleto or Pix payments, before the customer has actually paid.

**Why it fails**: The Gateway treats `approved` as confirmed payment. The order is released for fulfillment, but no money was collected. The merchant ships products for free. Revenue is lost.

**Fix**: Return `status: "undefined"` for async methods and use the callback mechanism:

```typescript
const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);
const status = isAsync ? "undefined" : result.status;
// Async methods: notify via callbackUrl when payment is confirmed
```

---

### Anti-Pattern: Losing State Between Retries

**What happens**: The connector stores payment state in memory (e.g., a JavaScript `Map` or local variable) instead of a persistent database.

**Why it fails**: When the connector process restarts (deploy, crash, scaling), all in-memory state is lost. The next Gateway retry creates a duplicate payment at the acquirer because the idempotency check fails to find the original record.

**Fix**: Use a persistent data store:

```typescript
// WRONG — in-memory, lost on restart
const payments = new Map<string, PaymentRecord>();

// CORRECT — persistent database
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function findByPaymentId(paymentId: string): Promise<PaymentRecord | null> {
  const result = await pool.query(
    "SELECT * FROM payments WHERE payment_id = $1",
    [paymentId]
  );
  return result.rows[0] ?? null;
}

// For VTEX IO apps, use VBase:
// const vbase = ctx.clients.vbase;
// await vbase.getJSON<PaymentRecord>("payments", paymentId);
```

## Reference

**Links to VTEX documentation and related resources.**

- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Official guide explaining idempotency requirements for Cancel, Capture, and Refund operations
- [Developing a Payment Connector for VTEX](https://help.vtex.com/en/docs/tutorials/developing-a-payment-connector-for-vtex) — Help Center guide with idempotency implementation steps using paymentId and VBase
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Detailed authorization, capture, and cancellation flow documentation including retry behavior
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including callback URL retry mechanics and 7-day retry window
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with requestId and paymentId field definitions

---

This skill provides guidance for AI agents working with VTEX Payment Connector Development. Apply these constraints and patterns when assisting developers with apply when handling credit card data, implementing secureproxyurl flows, or working with payment security and proxy code. covers pci dss compliance, secure proxy card tokenization, sensitive data handling rules, x-provider-forward-to header usage, and custom token creation. use for any payment connector that processes credit, debit, or co-branded card payments to prevent data breaches and pci violations.

# PCI Compliance & Secure Proxy

## Overview

**What this skill covers**: PCI DSS compliance requirements and the VTEX Secure Proxy mechanism for payment connectors that handle card payments. This includes how `secureProxyUrl` tokenizes sensitive card data, the difference between PCI-certified and non-PCI environments, what data can and cannot be stored or logged, and how to use the `X-PROVIDER-Forward-To` header to route requests through the Secure Proxy to the acquirer.

**When to use it**: When building a payment connector that accepts credit cards, debit cards, or co-branded cards. Use this skill whenever the connector needs to process card data, communicate with an acquirer, or when determining whether Secure Proxy is required.

**What you'll learn**:
- When Secure Proxy is required vs optional
- How tokenized card data flows through the Secure Proxy
- What data must never be stored, logged, or transmitted outside the Secure Proxy
- How to use `X-PROVIDER-Forward-To` and custom headers to communicate with acquirers

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: PCI DSS and VTEX

PCI DSS (Payment Card Industry Data Security Standard) is an international standard governing how companies must process card information. VTEX's Payment Gateway is PCI-certified. Connectors that process card payments must either:

1. **Have PCI DSS certification** (AOC signed by a QSA) — the connector receives raw card data directly and communicates with the acquirer.
2. **Use Secure Proxy** — mandatory for non-PCI environments, including all VTEX IO connectors. The connector receives tokenized card data and routes acquirer calls through the Gateway's proxy.

### Concept 2: Secure Proxy Tokenization

When Secure Proxy is used, the Gateway replaces sensitive card fields with tokens in the Create Payment request:

- `card.numberToken` replaces the card number (e.g., `#vtex#token#d799bae#number#`)
- `card.holderToken` replaces the cardholder name
- `card.cscToken` replaces the CVV/security code
- `card.bin` and `card.numberLength` are provided as plain values (non-sensitive)
- `card.expiration` is provided as plain values

The connector uses these tokens when building the request to the acquirer. The Secure Proxy replaces tokens with real values before forwarding to the acquirer.

### Concept 3: secureProxyUrl

The `secureProxyUrl` field is included in the Create Payment request body when Secure Proxy is active. This URL points to the Gateway's proxy endpoint. The connector must POST to this URL (instead of directly to the acquirer) with:

- `X-PROVIDER-Forward-To` header: the acquirer's API endpoint URL
- `X-PROVIDER-Forward-{HeaderName}` headers: custom headers for the acquirer (prefix is stripped by the proxy)
- Request body containing tokenized card data

The Secure Proxy replaces tokens with real card data and forwards the request to the acquirer. The response is passed back to the connector unchanged.

### Concept 4: What Can and Cannot Be Stored

**Can store**: `card.bin` (first 6 digits), `card.numberLength`, `card.expiration`, transaction IDs, payment status.

**MUST NEVER store**: Full card number (PAN), CVV/CSC, cardholder name from card data, any token values. These must only exist in memory during request processing and must never be written to databases, files, or logs.

**Architecture/Data Flow (Secure Proxy)**:

```text
1. Gateway → POST /payments (with secureProxyUrl + tokenized card data) → Connector
2. Connector → POST secureProxyUrl (tokens in body, X-PROVIDER-Forward-To: acquirer URL) → Gateway
3. Gateway replaces tokens with real card data → POST acquirer URL → Acquirer
4. Acquirer → response → Gateway → Connector
5. Connector → Create Payment response → Gateway
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: MUST Use secureProxyUrl for Non-PCI Environments

**Rule**: If the connector is hosted in a non-PCI environment (including all VTEX IO apps), it MUST use the `secureProxyUrl` from the Create Payment request to communicate with the acquirer. It MUST NOT call the acquirer directly with raw card data. If a `secureProxyUrl` field is present in the request, Secure Proxy is active and MUST be used.

**Why**: Non-PCI environments are not authorized to handle raw card data. Calling the acquirer directly bypasses the Gateway's secure data handling, violating PCI DSS. This can result in data breaches, massive fines ($100K+ per month), loss of card processing ability, and legal liability.

**Detection**: If the connector calls an acquirer endpoint directly (without going through `secureProxyUrl`) when `secureProxyUrl` is present in the request, STOP immediately. All acquirer communication must go through the Secure Proxy.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, secureProxyUrl, card } = req.body;

  if (secureProxyUrl) {
    // Non-PCI: Route through Secure Proxy
    const acquirerResponse = await fetch(secureProxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PROVIDER-Forward-To": "https://api.acquirer.com/v2/payments",
        "X-PROVIDER-Forward-MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
        "X-PROVIDER-Forward-MerchantKey": process.env.ACQUIRER_MERCHANT_KEY!,
      },
      body: JSON.stringify({
        orderId: paymentId,
        payment: {
          cardNumber: card.numberToken,     // Token, not real number
          holder: card.holderToken,          // Token, not real name
          securityCode: card.cscToken,       // Token, not real CVV
          expirationMonth: card.expiration.month,
          expirationYear: card.expiration.year,
        },
      }),
    });

    const result = await acquirerResponse.json();
    // Build and return PPP response...
  }
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, secureProxyUrl, card } = req.body;

  // WRONG: Calling acquirer directly, bypassing Secure Proxy
  // This connector is non-PCI but handles card data as if it were PCI-certified
  const acquirerResponse = await fetch("https://api.acquirer.com/v2/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
    },
    body: JSON.stringify({
      orderId: paymentId,
      payment: {
        // These are tokens but sent directly to acquirer — acquirer can't read tokens!
        // And if raw data were here, this would be a PCI violation
        cardNumber: card.numberToken,
        holder: card.holderToken,
        securityCode: card.cscToken,
      },
    }),
  });

  // This request will fail: acquirer receives tokens instead of real card data
  // And the Secure Proxy was completely bypassed
}
```

---

### Constraint: MUST NOT Store Raw Card Data

**Rule**: The connector MUST NOT store the full card number (PAN), CVV/CSC, cardholder name, or any card token values in any persistent storage — database, file system, cache, session store, or any other durable medium. Card data must only exist in memory during the request lifecycle.

**Why**: Storing raw card data violates PCI DSS Requirement 3. A data breach exposes customers to fraud. Consequences include fines of $5,000–$100,000 per month from card networks, mandatory forensic investigation costs ($50K+), loss of ability to process cards, class-action lawsuits, and criminal liability in some jurisdictions.

**Detection**: If the code writes card number, CVV, cardholder name, or token values to a database, file, cache (Redis, VBase), or any persistent store, STOP immediately. Only `card.bin` (first 6 digits) and `card.numberLength` may be stored.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, card, secureProxyUrl } = req.body;

  // Only store non-sensitive card metadata
  await paymentStore.save(paymentId, {
    paymentId,
    cardBin: card.bin,            // First 6 digits — safe to store
    cardNumberLength: card.numberLength,  // Length — safe to store
    cardExpMonth: card.expiration.month,  // Expiration — safe to store
    cardExpYear: card.expiration.year,
    // DO NOT store: card.numberToken, card.holderToken, card.cscToken
  });

  // Use card tokens only in-memory for the Secure Proxy call
  const acquirerResult = await callAcquirerViaProxy(secureProxyUrl, card);

  // Return response — card data is now out of scope
  res.status(200).json(buildResponse(paymentId, acquirerResult));
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, card } = req.body;

  // CRITICAL PCI VIOLATION: Storing full card data in database
  await database.query(
    `INSERT INTO payments (payment_id, card_number, cvv, holder_name)
     VALUES ($1, $2, $3, $4)`,
    [paymentId, card.number, card.csc, card.holder]
  );
  // This single line can result in:
  // - $100K/month fines from card networks
  // - Mandatory forensic audit ($50K+)
  // - Loss of card processing ability
  // - Criminal liability
}
```

---

### Constraint: MUST NOT Log Sensitive Card Data

**Rule**: The connector MUST NOT log card numbers, CVV/CSC values, cardholder names, or token values to any logging system — console, file, monitoring service, error tracker, or APM tool. Even in debug mode. Even in development.

**Why**: Logs are typically stored in plaintext, retained for extended periods, and accessible to many team members. Card data in logs is a PCI DSS violation and a data breach. Log aggregation services (Datadog, Splunk, CloudWatch) may store data across multiple regions, amplifying the breach scope.

**Detection**: If the code contains `console.log`, `console.error`, `logger.info`, `logger.debug`, or any logging call that includes `card.number`, `card.csc`, `card.holder`, `card.numberToken`, `card.holderToken`, `card.cscToken`, or the full request body without redaction, STOP immediately. Redact or omit all sensitive fields before logging.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, card, paymentMethod, value } = req.body;

  // Safe logging — only non-sensitive fields
  console.log("Processing payment", {
    paymentId,
    paymentMethod,
    value,
    cardBin: card?.bin,              // First 6 digits only — safe
    cardNumberLength: card?.numberLength,  // Safe
  });

  // NEVER log the full request body for payment requests
  // It contains card tokens or raw card data
}

function redactSensitiveFields(body: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...body };
  if (redacted.card && typeof redacted.card === "object") {
    const card = redacted.card as Record<string, unknown>;
    redacted.card = {
      bin: card.bin,
      numberLength: card.numberLength,
      expiration: card.expiration,
      // All other fields redacted
    };
  }
  return redacted;
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  // CRITICAL PCI VIOLATION: Logging the entire request body
  // This includes card number, CVV, holder name, and/or token values
  console.log("Payment request received:", JSON.stringify(req.body));

  // ALSO WRONG: Logging specific card fields
  console.log("Card number:", req.body.card.number);
  console.log("CVV:", req.body.card.csc);
  console.log("Card holder:", req.body.card.holder);

  // ALSO WRONG: Logging tokens (they reference real card data)
  console.log("Card token:", req.body.card.numberToken);
}
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Detect Secure Proxy Mode

Check for `secureProxyUrl` in the Create Payment request to determine if Secure Proxy is active.

```typescript
interface CreatePaymentRequest {
  paymentId: string;
  value: number;
  currency: string;
  paymentMethod: string;
  card?: {
    holder?: string;        // Raw (PCI) or absent (Secure Proxy)
    holderToken?: string;   // Token (Secure Proxy only)
    number?: string;        // Raw (PCI) or absent (Secure Proxy)
    numberToken?: string;   // Token (Secure Proxy only)
    bin: string;            // Always present — first 6 digits
    numberLength: number;   // Always present
    csc?: string;           // Raw (PCI) or absent (Secure Proxy)
    cscToken?: string;      // Token (Secure Proxy only)
    expiration: { month: string; year: string };
  };
  secureProxyUrl?: string;          // Present when Secure Proxy is active
  secureProxyTokensURL?: string;    // For custom token operations
  callbackUrl: string;
  miniCart: Record<string, unknown>;
}

function isSecureProxyActive(req: CreatePaymentRequest): boolean {
  return !!req.secureProxyUrl;
}
```

### Step 2: Build the Acquirer Request with Tokens

When Secure Proxy is active, use tokenized card values in the request body sent to the proxy.

```typescript
interface AcquirerPaymentRequest {
  merchantOrderId: string;
  payment: {
    cardNumber: string;
    holder: string;
    securityCode: string;
    expirationDate: string;
    amount: number;
  };
}

function buildAcquirerRequest(
  paymentReq: CreatePaymentRequest
): AcquirerPaymentRequest {
  const card = paymentReq.card!;

  return {
    merchantOrderId: paymentReq.paymentId,
    payment: {
      // Use tokens if Secure Proxy, raw values if PCI-certified
      cardNumber: card.numberToken ?? card.number!,
      holder: card.holderToken ?? card.holder!,
      securityCode: card.cscToken ?? card.csc!,
      expirationDate: `${card.expiration.month}/${card.expiration.year}`,
      amount: paymentReq.value,
    },
  };
}
```

### Step 3: Call the Acquirer Through Secure Proxy

Route the request through `secureProxyUrl` with proper headers.

```typescript
async function callAcquirerViaProxy(
  secureProxyUrl: string,
  acquirerRequest: AcquirerPaymentRequest
): Promise<AcquirerResponse> {
  const response = await fetch(secureProxyUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      // X-PROVIDER-Forward-To tells the proxy where to send the request
      "X-PROVIDER-Forward-To": process.env.ACQUIRER_API_URL!,
      // Custom headers for the acquirer — prefix is stripped by the proxy
      "X-PROVIDER-Forward-MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
      "X-PROVIDER-Forward-MerchantKey": process.env.ACQUIRER_MERCHANT_KEY!,
    },
    body: JSON.stringify(acquirerRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Secure Proxy call failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<AcquirerResponse>;
}

// For PCI-certified environments, call acquirer directly
async function callAcquirerDirect(
  acquirerRequest: AcquirerPaymentRequest
): Promise<AcquirerResponse> {
  const response = await fetch(process.env.ACQUIRER_API_URL!, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
      "MerchantKey": process.env.ACQUIRER_MERCHANT_KEY!,
    },
    body: JSON.stringify(acquirerRequest),
  });

  return response.json() as Promise<AcquirerResponse>;
}
```

### Complete Example

Full Create Payment handler with Secure Proxy support and safe logging:

```typescript
import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

app.post("/payments", async (req: Request, res: Response) => {
  const body: CreatePaymentRequest = req.body;
  const { paymentId, card, secureProxyUrl } = body;

  // Safe logging — no card data
  console.log("Payment request", {
    paymentId,
    paymentMethod: body.paymentMethod,
    value: body.value,
    hasSecureProxy: !!secureProxyUrl,
    cardBin: card?.bin,
  });

  // Store only non-sensitive data
  await paymentStore.save(paymentId, {
    paymentId,
    cardBin: card?.bin,
    cardNumberLength: card?.numberLength,
    status: "processing",
    callbackUrl: body.callbackUrl,
  });

  // Build the acquirer request using tokens or raw data
  const acquirerRequest = buildAcquirerRequest(body);

  let acquirerResult: AcquirerResponse;
  try {
    if (secureProxyUrl) {
      // Non-PCI: Route through Secure Proxy
      acquirerResult = await callAcquirerViaProxy(secureProxyUrl, acquirerRequest);
    } else {
      // PCI-certified: Call acquirer directly
      acquirerResult = await callAcquirerDirect(acquirerRequest);
    }
  } catch (error) {
    // Safe error logging — never log the acquirer request (contains tokens)
    console.error("Acquirer call failed", {
      paymentId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const failResponse = {
      paymentId,
      status: "undefined" as const,
      authorizationId: null,
      nsu: null,
      tid: null,
      acquirer: null,
      code: "ACQUIRER_ERROR",
      message: "Failed to communicate with acquirer",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: 21600,
    };

    await paymentStore.updateStatus(paymentId, "undefined");
    res.status(200).json(failResponse);
    return;
  }

  const status = acquirerResult.approved ? "approved" : "denied";
  const response = {
    paymentId,
    status,
    authorizationId: acquirerResult.authorizationId ?? null,
    nsu: acquirerResult.nsu ?? null,
    tid: acquirerResult.tid ?? null,
    acquirer: "MyAcquirer",
    code: acquirerResult.code ?? null,
    message: acquirerResult.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };

  await paymentStore.updateStatus(paymentId, status);
  res.status(200).json(response);
});

app.listen(443);
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Direct Card Handling in Non-PCI Environment

**What happens**: The connector is hosted on VTEX IO or a non-PCI server but calls the acquirer API directly without using the Secure Proxy, attempting to pass card tokens directly to the acquirer.

**Why it fails**: The acquirer receives tokens (e.g., `#vtex#token#d799bae#number#`) instead of real card numbers. The acquirer cannot process these tokens and rejects the transaction. Even if the connector somehow received raw card data, transmitting it from a non-PCI environment violates PCI DSS and exposes the data to interception.

**Fix**: Always check for `secureProxyUrl` and route through the proxy:

```typescript
if (secureProxyUrl) {
  // Route through Secure Proxy — tokens are replaced with real data by the Gateway
  const result = await fetch(secureProxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PROVIDER-Forward-To": "https://api.acquirer.com/v2/payments",
      "X-PROVIDER-Forward-MerchantId": process.env.MERCHANT_ID!,
    },
    body: JSON.stringify(acquirerPayload),
  });
}
```

---

### Anti-Pattern: Storing Full Card Numbers (PANs)

**What happens**: The developer stores the full card number in a database column for "reference" or "reconciliation" purposes.

**Why it fails**: This is a direct PCI DSS Requirement 3 violation. If the database is breached, all stored card numbers are compromised. Card networks impose fines of $5,000–$100,000 per month, require a mandatory forensic audit, and may permanently revoke the ability to process card payments.

**Fix**: Store only the BIN (first 6 digits) and last 4 digits for reference:

```typescript
// Store only non-sensitive identifiers
await database.query(
  `INSERT INTO payments (payment_id, card_bin, card_last_four, card_exp_month, card_exp_year)
   VALUES ($1, $2, $3, $4, $5)`,
  [
    paymentId,
    card.bin,                                    // First 6 digits — safe
    card.bin ? undefined : undefined,            // Last 4 not available via PPP
    card.expiration.month,
    card.expiration.year,
  ]
);
// NEVER store: card.number, card.numberToken, card.csc, card.cscToken, card.holder, card.holderToken
```

---

### Anti-Pattern: Logging Card Details for Debugging

**What happens**: During development or debugging, the developer adds `console.log(req.body)` or `console.log(card)` to troubleshoot payment issues, then forgets to remove it before deployment.

**Why it fails**: The full request body contains card numbers, CVV, and/or token values. These end up in log files, monitoring dashboards, and log aggregation services. This is a PCI DSS violation even in development if the logs are stored persistently. In production, it's a full data breach.

**Fix**: Create a utility that redacts sensitive fields and use it consistently:

```typescript
function safePaymentLog(label: string, body: Record<string, unknown>): void {
  const safe = {
    paymentId: body.paymentId,
    paymentMethod: body.paymentMethod,
    value: body.value,
    currency: body.currency,
    orderId: body.orderId,
    hasCard: !!body.card,
    hasSecureProxy: !!body.secureProxyUrl,
    cardBin: (body.card as Record<string, unknown>)?.bin,
    // Everything else is intentionally omitted
  };

  console.log(label, JSON.stringify(safe));
}

// Usage
safePaymentLog("Create payment request", req.body);
// Output: Create payment request {"paymentId":"ABC","paymentMethod":"Visa","value":100,"cardBin":"555544",...}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy) — Complete Secure Proxy documentation including flow diagrams, request/response examples, custom tokens, and supported JsonLogic operators
- [PCI DSS Compliance](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance) — PCI certification requirements, AOC submission process, and when Secure Proxy is mandatory
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint implementation guide including Create Payment request body with secureProxyUrl and tokenized card fields
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including PCI prerequisites and Secure Proxy requirements
- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — VTEX IO framework for payment connectors (Secure Proxy mandatory for all IO apps)
- [PCI Security Standards Council](https://www.pcisecuritystandards.org/) — Official PCI DSS requirements and compliance documentation

---

This skill provides guidance for AI agents working with VTEX Payment Connector Development. Apply these constraints and patterns when assisting developers with apply when implementing a vtex payment provider protocol (ppp) connector or working with payment/connector endpoint files. covers all nine required endpoints: manifest, create payment, cancel, capture/settle, refund, inbound request, create auth token, provider auth redirect, and get credentials. use for building or debugging any payment connector that integrates with the vtex payment gateway.

# PPP Endpoint Implementation

## Overview

**What this skill covers**: The complete set of nine endpoints required by the VTEX Payment Provider Protocol (PPP). This includes six payment-flow endpoints (Manifest, Create Payment, Cancel Payment, Capture/Settle Payment, Refund Payment, Inbound Request) and three configuration-flow endpoints (Create Authorization Token, Provider Authentication Redirect, Get Credentials).

**When to use it**: When building a new payment connector middleware that integrates a Payment Service Provider (PSP) with the VTEX Payment Gateway. Use this skill whenever you need to implement, debug, or extend PPP endpoints.

**What you'll learn**:
- The exact HTTP method, path, request body, and response shape for all 9 PPP endpoints
- Required response fields and status codes for each endpoint
- How the payment flow and configuration flow interact with the VTEX Gateway
- Constraints that prevent homologation failures and runtime errors

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Payment Provider Protocol (PPP)

The PPP is the public contract between a payment provider and the VTEX Payment Gateway. It defines nine REST endpoints that the connector middleware must implement. The Gateway calls these endpoints to authorize, capture, cancel, and refund payments, as well as to configure merchant credentials. The middleware can be written in any language but must be served over HTTPS on port 443 with TLS 1.2 support.

### Concept 2: Payment Flow vs Configuration Flow

The protocol is divided into two flows:

- **Payment Flow** (6 endpoints): Handles runtime payment operations — listing capabilities (Manifest), creating payments, cancelling, capturing/settling, refunding, and inbound requests.
- **Configuration Flow** (3 endpoints): Handles merchant onboarding — creating auth tokens, redirecting the merchant to the provider's login, and returning credentials (`appKey`, `appToken`, `applicationId`) to VTEX.

The configuration flow is optional but recommended. The payment flow is mandatory.

### Concept 3: Endpoint Requirements

All endpoints must satisfy these requirements:
- Served over HTTPS on port 443 with TLS 1.2
- Use a standard subdomain/domain (no IP addresses)
- Respond in under 5 seconds during homologation tests
- Respond in under 20 seconds in production
- The provider must be PCI-DSS certified or use Secure Proxy for card payments

**Architecture/Data Flow**:

```text
Shopper → VTEX Checkout → VTEX Payment Gateway → [Your Connector Middleware] → Acquirer/PSP
                                ↕
                    Configuration Flow (Admin)
```

The Gateway initiates all calls. Your middleware never calls the Gateway except via `callbackUrl` (for async notifications) and Secure Proxy (for card data forwarding).

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Implement All Required Payment Flow Endpoints

**Rule**: The connector MUST implement all six payment-flow endpoints: GET `/manifest`, POST `/payments`, POST `/payments/{paymentId}/cancellations`, POST `/payments/{paymentId}/settlements`, POST `/payments/{paymentId}/refunds`, and POST `/payments/{paymentId}/inbound-request/{action}`.

**Why**: The VTEX Payment Provider Test Suite validates every endpoint during homologation. Missing endpoints cause test failures and the connector will not be approved. At runtime, the Gateway expects all endpoints to be available — a missing cancel endpoint means payments cannot be voided.

**Detection**: If the connector router/handler file does not define handlers for all 6 payment-flow paths, STOP and add the missing endpoints before proceeding.

✅ **CORRECT**:
```typescript
import { Router } from "express";

const router = Router();

// All 6 payment-flow endpoints implemented
router.get("/manifest", manifestHandler);
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);
router.post("/payments/:paymentId/refunds", refundPaymentHandler);
router.post("/payments/:paymentId/inbound-request/:action", inboundRequestHandler);

export default router;
```

❌ **WRONG**:
```typescript
import { Router } from "express";

const router = Router();

// Missing manifest, inbound-request, and refund endpoints
// This will fail homologation and break runtime operations
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);

export default router;
```

---

### Constraint: Return Correct HTTP Status Codes and Response Shapes

**Rule**: Each endpoint MUST return the exact response shape documented in the PPP API. Create Payment MUST return `paymentId`, `status`, `authorizationId`, `tid`, `nsu`, `acquirer`, `code`, `message`, `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, and `delayToCancel`. Cancel MUST return `paymentId`, `cancellationId`, `code`, `message`, `requestId`. Capture MUST return `paymentId`, `settleId`, `value`, `code`, `message`, `requestId`. Refund MUST return `paymentId`, `refundId`, `value`, `code`, `message`, `requestId`.

**Why**: The Gateway parses these fields programmatically. Missing fields cause deserialization errors, and the Gateway treats the payment as failed. Incorrect `delayToAutoSettle` values (or missing ones) cause payments to auto-cancel or auto-capture at wrong times.

**Detection**: If a response object is missing any of the required fields for its endpoint, STOP and add the missing fields.

✅ **CORRECT**:
```typescript
interface CreatePaymentResponse {
  paymentId: string;
  status: "approved" | "denied" | "undefined";
  authorizationId: string | null;
  nsu: string | null;
  tid: string | null;
  acquirer: string | null;
  code: string | null;
  message: string | null;
  delayToAutoSettle: number;
  delayToAutoSettleAfterAntifraud: number;
  delayToCancel: number;
  paymentUrl?: string;
}

async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, value, currency, paymentMethod, card, callbackUrl } = req.body;

  const result = await processPaymentWithAcquirer(req.body);

  const response: CreatePaymentResponse = {
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyAcquirer",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,    // 6 hours in seconds
    delayToAutoSettleAfterAntifraud: 1800, // 30 minutes in seconds
    delayToCancel: 21600,         // 6 hours in seconds
  };

  res.status(200).json(response);
}
```

❌ **WRONG**:
```typescript
// Missing required fields — Gateway will reject this response
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const result = await processPaymentWithAcquirer(req.body);

  // Missing: authorizationId, nsu, tid, acquirer, code, message,
  // delayToAutoSettle, delayToAutoSettleAfterAntifraud, delayToCancel
  res.status(200).json({
    paymentId: req.body.paymentId,
    status: result.status,
  });
}
```

---

### Constraint: Manifest Must Declare All Supported Payment Methods

**Rule**: The GET `/manifest` endpoint MUST return a `paymentMethods` array listing every payment method the connector supports, with the correct `name` and `allowsSplit` configuration for each.

**Why**: The Gateway reads the manifest to determine which payment methods are available for this connector. If a method is missing from the manifest, merchants cannot configure it in the VTEX Admin. The `allowsSplit` field controls revenue split behavior — an incorrect value causes split payment failures.

**Detection**: If the manifest handler returns an empty `paymentMethods` array or hardcodes methods that the provider does not actually support, STOP and fix the manifest to match the provider's real capabilities.

✅ **CORRECT**:
```typescript
interface PaymentMethodManifest {
  name: string;
  allowsSplit: "onCapture" | "onAuthorize" | "disabled";
}

interface ManifestResponse {
  paymentMethods: PaymentMethodManifest[];
}

async function manifestHandler(_req: Request, res: Response): Promise<void> {
  const manifest: ManifestResponse = {
    paymentMethods: [
      { name: "Visa", allowsSplit: "onCapture" },
      { name: "Mastercard", allowsSplit: "onCapture" },
      { name: "American Express", allowsSplit: "onCapture" },
      { name: "BankInvoice", allowsSplit: "onAuthorize" },
      { name: "Pix", allowsSplit: "disabled" },
    ],
  };

  res.status(200).json(manifest);
}
```

❌ **WRONG**:
```typescript
// Empty manifest — no payment methods will appear in the Admin
async function manifestHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ paymentMethods: [] });
}
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Define Types for All Endpoint Contracts

Define TypeScript interfaces for every request and response shape. This catches missing fields at compile time.

```typescript
// --- Manifest ---
interface ManifestResponse {
  paymentMethods: Array<{
    name: string;
    allowsSplit: "onCapture" | "onAuthorize" | "disabled";
  }>;
}

// --- Create Payment ---
interface CreatePaymentRequest {
  reference: string;
  orderId: string;
  transactionId: string;
  paymentId: string;
  paymentMethod: string;
  value: number;
  currency: string;
  installments: number;
  card?: {
    holder: string;
    number: string;
    csc: string;
    expiration: { month: string; year: string };
  };
  miniCart: Record<string, unknown>;
  callbackUrl: string;
  returnUrl?: string;
}

interface CreatePaymentResponse {
  paymentId: string;
  status: "approved" | "denied" | "undefined";
  authorizationId: string | null;
  nsu: string | null;
  tid: string | null;
  acquirer: string | null;
  code: string | null;
  message: string | null;
  delayToAutoSettle: number;
  delayToAutoSettleAfterAntifraud: number;
  delayToCancel: number;
  paymentUrl?: string;
}

// --- Cancel Payment ---
interface CancelPaymentRequest {
  paymentId: string;
  requestId: string;
}

interface CancelPaymentResponse {
  paymentId: string;
  cancellationId: string | null;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Capture/Settle Payment ---
interface CapturePaymentRequest {
  paymentId: string;
  transactionId: string;
  value: number;
  requestId: string;
}

interface CapturePaymentResponse {
  paymentId: string;
  settleId: string | null;
  value: number;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Refund Payment ---
interface RefundPaymentRequest {
  paymentId: string;
  transactionId: string;
  settleId: string;
  value: number;
  requestId: string;
}

interface RefundPaymentResponse {
  paymentId: string;
  refundId: string | null;
  value: number;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Inbound Request ---
interface InboundRequest {
  requestId: string;
  transactionId: string;
  paymentId: string;
  authorizationId: string;
  tid: string;
  requestData: { body: string };
}

interface InboundResponse {
  requestId: string;
  paymentId: string;
  responseData: {
    statusCode: number;
    contentType: string;
    content: string;
  };
}
```

### Step 2: Implement the Payment Flow Handlers

Wire up each handler with proper error handling and response construction.

```typescript
import { Router, Request, Response } from "express";

const router = Router();

router.get("/manifest", async (_req: Request, res: Response) => {
  const manifest: ManifestResponse = {
    paymentMethods: [
      { name: "Visa", allowsSplit: "onCapture" },
      { name: "Mastercard", allowsSplit: "onCapture" },
      { name: "Pix", allowsSplit: "disabled" },
    ],
  };
  res.status(200).json(manifest);
});

router.post("/payments", async (req: Request, res: Response) => {
  const body: CreatePaymentRequest = req.body;
  const result = await processWithAcquirer(body);

  const response: CreatePaymentResponse = {
    paymentId: body.paymentId,
    status: result.status,
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
  res.status(200).json(response);
});

router.post("/payments/:paymentId/cancellations", async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const { requestId } = req.body as CancelPaymentRequest;
  const result = await cancelWithAcquirer(paymentId);

  const response: CancelPaymentResponse = {
    paymentId,
    cancellationId: result.cancellationId ?? null,
    code: result.code ?? null,
    message: result.message ?? "Successfully cancelled",
    requestId,
  };
  res.status(200).json(response);
});

router.post("/payments/:paymentId/settlements", async (req: Request, res: Response) => {
  const body: CapturePaymentRequest = req.body;
  const result = await captureWithAcquirer(body.paymentId, body.value);

  const response: CapturePaymentResponse = {
    paymentId: body.paymentId,
    settleId: result.settleId ?? null,
    value: result.capturedValue ?? body.value,
    code: result.code ?? null,
    message: result.message ?? null,
    requestId: body.requestId,
  };
  res.status(200).json(response);
});

router.post("/payments/:paymentId/refunds", async (req: Request, res: Response) => {
  const body: RefundPaymentRequest = req.body;
  const result = await refundWithAcquirer(body.paymentId, body.value);

  const response: RefundPaymentResponse = {
    paymentId: body.paymentId,
    refundId: result.refundId ?? null,
    value: result.refundedValue ?? body.value,
    code: result.code ?? null,
    message: result.message ?? null,
    requestId: body.requestId,
  };
  res.status(200).json(response);
});

router.post(
  "/payments/:paymentId/inbound-request/:action",
  async (req: Request, res: Response) => {
    const body: InboundRequest = req.body;
    const result = await handleInbound(body);

    const response: InboundResponse = {
      requestId: body.requestId,
      paymentId: body.paymentId,
      responseData: {
        statusCode: 200,
        contentType: "application/json",
        content: JSON.stringify(result),
      },
    };
    res.status(200).json(response);
  }
);

export default router;
```

### Step 3: Implement the Configuration Flow Handlers

These endpoints handle merchant onboarding through the VTEX Admin.

```typescript
import { Router, Request, Response } from "express";

const configRouter = Router();

// 1. POST /authorization/token
configRouter.post("/authorization/token", async (req: Request, res: Response) => {
  const { applicationId, returnUrl } = req.body;
  // applicationId is always "vtex"
  const token = await generateAuthorizationToken(applicationId, returnUrl);

  res.status(200).json({
    applicationId,
    token,
  });
});

// 2. GET /authorization/redirect
configRouter.get("/authorization/redirect", async (req: Request, res: Response) => {
  const { token } = req.query;
  // Redirect to provider's OAuth/consent page
  // After merchant approves, redirect back with authorizationCode appended to returnUrl
  const providerLoginUrl = buildProviderLoginUrl(token as string);
  res.redirect(302, providerLoginUrl);
});

// 3. GET /authorization/credentials
configRouter.get("/authorization/credentials", async (req: Request, res: Response) => {
  const { authorizationCode } = req.query;
  const credentials = await exchangeCodeForCredentials(authorizationCode as string);

  res.status(200).json({
    applicationId: "vtex",
    appKey: credentials.appKey,
    appToken: credentials.appToken,
  });
});

export default configRouter;
```

### Complete Example

Tying both flows together in a single Express application:

```typescript
import express from "express";
import paymentRouter from "./routes/payment";
import configRouter from "./routes/config";

const app = express();
app.use(express.json());

// Payment flow endpoints
app.use("/", paymentRouter);

// Configuration flow endpoints
app.use("/", configRouter);

// Health check
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

const PORT = 443;
app.listen(PORT, () => {
  console.log(`Payment provider middleware running on port ${PORT}`);
});
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Partial Endpoint Implementation

**What happens**: The developer implements only Create Payment and Capture, skipping Manifest, Cancel, Refund, and Inbound Request endpoints.

**Why it fails**: The VTEX Payment Provider Test Suite tests all endpoints during homologation. Missing endpoints cause immediate test failure. At runtime, the Gateway cannot cancel or refund payments, leaving merchants unable to process returns.

**Fix**: Implement all six payment-flow endpoints from the start. Use the type definitions above to scaffold all handlers before adding business logic.

```typescript
// Start by creating stub handlers for every endpoint
const stubHandler = async (req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented yet" });
};

router.get("/manifest", stubHandler);
router.post("/payments", stubHandler);
router.post("/payments/:paymentId/cancellations", stubHandler);
router.post("/payments/:paymentId/settlements", stubHandler);
router.post("/payments/:paymentId/refunds", stubHandler);
router.post("/payments/:paymentId/inbound-request/:action", stubHandler);
// Then replace each stub with real logic incrementally
```

---

### Anti-Pattern: Using Incorrect HTTP Methods

**What happens**: The developer uses POST for the Manifest endpoint or GET for Create Payment.

**Why it fails**: The Gateway sends requests with specific HTTP methods. A POST handler on `/manifest` will not receive the GET request the Gateway sends, returning a 404 or 405.

**Fix**: Follow the exact HTTP methods from the protocol:

```typescript
// GET for manifest — the Gateway reads capabilities, not writes
router.get("/manifest", manifestHandler);

// POST for all payment operations — these create or modify state
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);
router.post("/payments/:paymentId/refunds", refundPaymentHandler);
router.post("/payments/:paymentId/inbound-request/:action", inboundRequestHandler);
```

---

### Anti-Pattern: Missing or Incorrect Delay Values

**What happens**: The developer omits `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, or `delayToCancel` from the Create Payment response, or sets them to zero.

**Why it fails**: These values (in seconds) control when the Gateway automatically captures or cancels a payment. Zero or missing values cause immediate auto-capture or auto-cancel, which leads to premature settlement or lost payments.

**Fix**: Always return sensible delay values in seconds:

```typescript
const response: CreatePaymentResponse = {
  paymentId: body.paymentId,
  status: "approved",
  authorizationId: "AUTH-123",
  nsu: "NSU-456",
  tid: "TID-789",
  acquirer: "MyProvider",
  code: "200",
  message: "Approved",
  delayToAutoSettle: 21600,                  // 6 hours
  delayToAutoSettleAfterAntifraud: 1800,     // 30 minutes
  delayToCancel: 21600,                      // 6 hours
};
```

## Reference

**Links to VTEX documentation and related resources.**

- [Payment Provider Protocol Overview](https://developers.vtex.com/docs/guides/payment-provider-protocol-api-overview) — API overview with endpoint requirements, common parameters, and test suite info
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Step-by-step guide covering all 9 endpoints with request/response examples
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — High-level protocol explanation including payment flow diagrams and callback URL usage
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization, capture, and cancellation flow details
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full OpenAPI specification for all PPP endpoints
- [Integrating a New Payment Provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex) — End-to-end integration guide from development to homologation
