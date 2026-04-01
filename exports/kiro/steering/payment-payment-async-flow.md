<!-- globs: **/payment/**/*.ts, **/callback/**/*.ts -->

Apply when implementing asynchronous payment methods (Boleto, Pix, bank redirects) or working with callback URLs in payment connector code. Covers undefined status response, callbackUrl notification, X-VTEX-signature validation, sync vs async handling, and the 7-day retry window. Use for any payment flow where authorization does not complete synchronously.

# Asynchronous Payment Flows & Callbacks

## When this skill applies

Use this skill when:
- Implementing a payment connector that supports Boleto Bancário, Pix, bank transfers, or redirect-based flows
- Working with any payment method where the acquirer does not return a final status synchronously
- Handling `callbackUrl` notification or retry flows
- Managing the Gateway's 7-day automatic retry cycle for `undefined` status payments

Do not use this skill for:
- PPP endpoint contracts and response shapes — use [`payment-provider-protocol`](payment-payment-provider-protocol.md)
- `paymentId`/`requestId` idempotency and state machine logic — use [`payment-idempotency`](payment-payment-idempotency.md)
- PCI compliance and Secure Proxy card handling — use [`payment-pci-security`](payment-payment-pci-security.md)

## Decision rules

- If the acquirer cannot return a final status synchronously, the payment method is async — return `status: "undefined"`.
- Common async methods: Boleto Bancário (`BankInvoice`), Pix, bank transfers, redirect-based auth.
- Common sync methods: credit cards, debit cards with instant authorization.
- **Without VTEX IO**: the `callbackUrl` is a notification endpoint — POST the updated status with `X-VTEX-API-AppKey`/`X-VTEX-API-AppToken` headers.
- **With VTEX IO**: the `callbackUrl` is a retry endpoint — POST to it (no payload) to trigger the Gateway to re-call POST `/payments`.
- Always preserve the `X-VTEX-signature` query parameter in the `callbackUrl` — never strip or modify it.
- Set `delayToCancel` to 604800 (7 days) for async methods to match the Gateway's retry window.

## Hard constraints

### Constraint: MUST return `undefined` for async payment methods

For any payment method where authorization does not complete synchronously (Boleto, Pix, bank transfer, redirect-based auth), the Create Payment response MUST use `status: "undefined"`. The connector MUST NOT return `"approved"` or `"denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why this matters**
Returning `"approved"` for an unconfirmed payment tells the Gateway the money has been collected. The order is released for fulfillment immediately. If the customer never actually pays (e.g., never scans the Pix QR code), the merchant ships products without payment. Returning `"denied"` prematurely cancels a payment that might still be completed.

**Detection**
If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect), STOP. Async methods must return `"undefined"` and resolve via callback.

**Correct**
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

**Wrong**
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

### Constraint: MUST use callbackUrl from request — never hardcode

The connector MUST use the exact `callbackUrl` provided in the Create Payment request body, including all query parameters (`X-VTEX-signature`, etc.). The connector MUST NOT hardcode callback URLs or construct them manually.

**Why this matters**
The `callbackUrl` contains transaction-specific authentication tokens (`X-VTEX-signature`) that the Gateway uses to validate the callback. A hardcoded or modified URL will be rejected by the Gateway, leaving the payment stuck in `undefined` status forever. The URL format may also change between environments (production vs sandbox).

**Detection**
If the connector hardcodes a callback URL string, constructs the URL manually, or strips query parameters from the `callbackUrl`, warn the developer. The `callbackUrl` must be stored and used exactly as received.

**Correct**
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

**Wrong**
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

### Constraint: MUST be ready for repeated Create Payment calls

The connector MUST handle the Gateway calling Create Payment with the same `paymentId` multiple times during the 7-day retry window. Each call must return the current payment status (which may have been updated via callback since the last call).

**Why this matters**
The Gateway retries `undefined` payments automatically. If the connector treats each call as a new payment, it will create duplicate charges. If the connector always returns the original `undefined` status without checking for updates, the Gateway never learns that the payment was approved, and eventually cancels it.

**Detection**
If the Create Payment handler does not check for an existing `paymentId` and return the latest status, STOP. The handler must support idempotent retries that reflect the current state.

**Correct**
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

**Wrong**
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

## Preferred pattern

Data flow for non-VTEX IO (notification callback):

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (with X-VTEX-API-AppKey/AppToken headers)
4. Gateway updates payment status to approved/denied
```

Data flow for VTEX IO (retry callback):

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (retry, no payload)
4. Gateway → POST /payments → Connector (returns status: "approved"/"denied")
```

Classify payment methods:

```typescript
const ASYNC_PAYMENT_METHODS = new Set([
  "BankInvoice",   // Boleto Bancário
  "Pix",           // Pix instant payments
]);

function isAsyncPaymentMethod(paymentMethod: string): boolean {
  return ASYNC_PAYMENT_METHODS.has(paymentMethod);
}
```

Acquirer webhook handler with callback notification (non-VTEX IO):

```typescript
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const webhookData = req.body;
  const acquirerRef = webhookData.transactionId;

  const payment = await store.findByAcquirerRef(acquirerRef);
  if (!payment || !payment.callbackUrl) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  const pppStatus = webhookData.status === "paid" ? "approved" : "denied";

  // Update local state FIRST
  await store.updateStatus(payment.paymentId, pppStatus);

  // Notify the Gateway via callbackUrl with retry logic
  await notifyGateway(payment.callbackUrl, {
    paymentId: payment.paymentId,
    status: pppStatus,
  });

  res.status(200).json({ received: true });
}
```

Callback retry with exponential backoff:

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

## Common failure modes

- **Synchronous approval of async payments** — Returning `status: "approved"` for Pix or Boleto because the QR code or slip was generated successfully. Generating a QR code is not the same as receiving payment. The order ships without money collected.
- **Ignoring the callbackUrl** — Not storing the `callbackUrl` from the Create Payment request and relying entirely on the Gateway's automatic retries. The retry interval increases over time, causing long delays between payment and order approval. Worst case: the 7-day window expires and the payment is cancelled even though the customer paid.
- **Hardcoding callback URLs** — Constructing callback URLs manually instead of using the one from the request, stripping the `X-VTEX-signature` parameter. The Gateway rejects the callback and the payment stays stuck in `undefined`.
- **No retry logic for failed callbacks** — Calling the `callbackUrl` once and silently dropping the notification on failure. The Gateway never learns the payment was approved, and the payment sits in `undefined` until the next retry or is auto-cancelled.
- **Returning stale status on retries** — Always returning the original `undefined` response without checking if the status was updated via callback. The Gateway never sees the `approved` status and eventually cancels the payment.

## Review checklist

- [ ] Do async payment methods (Boleto, Pix) return `status: "undefined"` in Create Payment?
- [ ] Is the `callbackUrl` stored exactly as received from the request (including all query params)?
- [ ] Does the webhook handler update local state before calling the `callbackUrl`?
- [ ] Is `X-VTEX-signature` preserved in the `callbackUrl` when calling it?
- [ ] Are `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers included in notification callbacks (non-VTEX IO)?
- [ ] Is there retry logic with exponential backoff for failed callback calls?
- [ ] Does the Create Payment handler return the latest status (not stale) on Gateway retries?
- [ ] Is `delayToCancel` set to 604800 (7 days) for async methods?

## Related skills

- [`payment-provider-protocol`](payment-payment-provider-protocol.md) — Endpoint contracts and response shapes
- [`payment-idempotency`](payment-payment-idempotency.md) — `paymentId`/`requestId` idempotency and state machine
- [`payment-pci-security`](payment-payment-pci-security.md) — PCI compliance and Secure Proxy

## Reference

- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Detailed explanation of the `undefined` status, callback URL notification and retry flows, and the 7-day retry window
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization flow documentation including async retry mechanics and callback URL behavior for VTEX IO vs non-VTEX IO
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint-level implementation guide with callbackUrl and returnUrl usage
- [Pix: Instant Payments in Brazil](https://developers.vtex.com/docs/guides/payments-integration-pix-instant-payments-in-brazil) — Pix-specific async flow implementation including QR code generation and callback handling
- [Callback URL Signature Authentication](https://help.vtex.com/en/announcements/2024-05-03-callback-url-signature-authentication-token) — Mandatory X-VTEX-signature requirement for callback URL authentication (effective June 2024)
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with callbackUrl field documentation
