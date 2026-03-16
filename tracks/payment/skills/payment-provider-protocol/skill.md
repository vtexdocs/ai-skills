---
name: payment-provider-protocol
description: >
  Apply when implementing a VTEX Payment Provider Protocol (PPP) connector or working with payment/connector
  endpoint files. Covers all nine required endpoints: Manifest, Create Payment, Cancel, Capture/Settle, Refund,
  Inbound Request, Create Auth Token, Provider Auth Redirect, and Get Credentials. Use for building or
  debugging any payment connector that integrates with the VTEX Payment Gateway.
track: payment
tags:
  - payment-provider-protocol
  - ppp
  - payment-connector
  - vtex-gateway
  - payment-endpoints
  - middleware
globs:
  - "**/payment/**/*.ts"
  - "**/connector/**/*.ts"
  - "**/provider/**/*.ts"
version: "1.0"
vtex_docs_verified: "2026-03-16"
---

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
