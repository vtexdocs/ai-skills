---
name: payment-idempotency
description: >
  Apply when implementing idempotency logic in payment connector code or handling duplicate payment requests.
  Covers paymentId as idempotency key, payment state machine transitions, retry semantics for cancellation
  and refund operations, and requestId handling. Use for preventing duplicate charges and ensuring correct
  Gateway retry behavior across Create Payment, Cancel, Capture, and Refund endpoints.
track: payment
tags:
  - idempotency
  - duplicate-prevention
  - payment-state-machine
  - retry
  - paymentId
  - requestId
globs:
  - "**/payment/**/*.ts"
  - "**/connector/**/*.ts"
version: "1.0"
vtex_docs_verified: "2026-03-16"
---

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
