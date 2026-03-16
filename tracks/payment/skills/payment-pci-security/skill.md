---
name: payment-pci-security
description: >
  Apply when handling credit card data, implementing secureProxyUrl flows, or working with payment security
  and proxy code. Covers PCI DSS compliance, Secure Proxy card tokenization, sensitive data handling rules,
  X-PROVIDER-Forward-To header usage, and custom token creation. Use for any payment connector that processes
  credit, debit, or co-branded card payments to prevent data breaches and PCI violations.
track: payment
tags:
  - pci-dss
  - secure-proxy
  - card-tokenization
  - security
  - sensitive-data
  - secureProxyUrl
globs:
  - "**/payment/**/*.ts"
  - "**/proxy/**/*.ts"
  - "**/secure/**/*.ts"
version: "1.0"
vtex_docs_verified: "2026-03-16"
---

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
