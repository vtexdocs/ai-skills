---
name: payment-provider-framework
description: "Apply when designing, or implementing a Payment Connector in VTEX IO. Covers PPF implementation in VTEX IO, use of secure proxy, manifest and other PPP routes exposure and clients definitions. Use for any implementation of a Payment Connector hosted in VTEX IO."
---

# Payment Provider Framework (VTEX IO)

## When this skill applies

Use this skill when:
- Creating or maintaining a payment connector implemented as a VTEX IO app (not a standalone HTTP service you host yourself)
- Wiring `@vtex/payment-provider`, `PaymentProvider`, and `PaymentProviderService` in `node/index.ts`
- Configuring the `paymentProvider` builder, `configuration.json` (payment methods, `customFields`, feature flags)
- Implementing `this.retry(request)` for Gateway retry semantics on IO
- Extending `SecureExternalClient` and passing `secureProxy` on requests for card flows on IO
- Testing via payment affiliation, workspaces, beta/stable releases, the VTEX App Store, and VTEX homologation

Do not use this skill for:
- PPP HTTP contracts, response field-by-field requirements, and the nine endpoints in the abstract — use [`payment-provider-protocol`](../payment-provider-protocol/SKILL.md)
- Idempotency and duplicate `paymentId` handling — use [`payment-idempotency`](../payment-idempotency/SKILL.md)
- Async `undefined` status, `callbackUrl` notification vs retry (IO vs non-IO) — use [`payment-async-flow`](../payment-async-flow/SKILL.md)
- PCI rules, logging, and token semantics beyond IO wiring — use [`payment-pci-security`](../payment-pci-security/SKILL.md)

## Decision rules

- **PPF on IO**: Payment Provider Framework is the VTEX IO–based way to build payment connectors. The app uses IO infrastructure; [API routes](https://developers.vtex.com/docs/guides/payment-provider-protocol-api-overview), request/response types, and [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy) are integrated per VTEX guides. Start from the example app described in [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) (clone/bootstrap as documented there).
- **Prerequisites**: Follow [Implementation prerequisites](https://help.vtex.com/en/tutorial/payment-provider-protocol--RdsT2spdq80MMwwOeEq0m#implementation-prerequisites) in the Payment Provider Protocol article and [Integrating a new payment provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex).
- **Dependencies**: In the app `node` folder, add `@vtex/payment-provider` (for example `1.x` in `package.json`). Keep `@vtex/api` in `devDependencies` (for example `6.x`); linking may bump it beyond `6.x`, which is acceptable. If `@vtex/api` types break, delete `node_modules` and `yarn.lock` in the project root and in `node`, then run `yarn install -f` in both.
- **`paymentProvider` builder**: In `manifest.json`, include `"paymentProvider": "1.x"` next to `node` so policies for Payment Gateway callbacks and PPP routes apply.
- **`configuration.json`**: Declare `paymentMethods` so the builder can implement them without re-declaring everything on `/manifest`. Use names that match [List Payment Provider Manifest](https://developers.vtex.com/docs/api-reference/payment-provider-protocol?endpoint=get-/manifest); only invent a new name when the method is genuinely new. New methods in Admin may require a [support ticket](https://help.vtex.com/en/tutorial/opening-tickets-to-vtex-support--16yOEqpO32UQYygSmMSSAM).
- **`PaymentProvider`**: One class method per PPP route; TypeScript enforces shapes — see [Payment Flow endpoints](https://developers.vtex.com/docs/api-reference/payment-provider-protocol#get-/manifest) in the API reference.
- **`PaymentProviderService`**: Registers default routes `/manifest`, `/payments`, `/settlements`, `/refunds`, `/cancellations`, `/inbound`; pass extra `routes` / `clients` when needed.
- **Overriding `/manifest`**: Only with an approved use case — [open a ticket](https://help.vtex.com/en/tutorial/opening-tickets-to-vtex-support--16yOEqpO32UQYygSmMSSAM). See **Preferred pattern** for an example route override shape.
- **Configurable options**: Use `configuration.json` / builder options for flags such as `implementsOAuth`, `implementsSplit`, `usesProviderHeadersName`, `useAntifraud`, `usesBankInvoiceEnglishName`, `usesSecureProxy`, `requiresDocument`, `acceptSplitPartialRefund`, `usesAutoSettleOptions` (auto-settlement UI — [Custom Auto Capture](https://developers.vtex.com/docs/guides/custom-auto-capture-feature)). Set `name` and rely on auto-generated `serviceUrl` on IO unless documented otherwise.
- **Gateway retry**: In PPF, call `this.retry(request)` where the protocol requires retry — see [Payment authorization](https://help.vtex.com/en/tutorial/payment-provider-protocol--RdsT2spdq80MMwwOeEq0m#payment-authorization) in the PPP article.
- **Card data on IO**: Prefer `SecureExternalClient` with `secureProxy: secureProxyUrl` from Create Payment; destination must be allowlisted (AOC via [support](https://help.vtex.com/support)). Supported `Content-Type` values for Secure Proxy: `application/json` and `application/x-www-form-urlencoded` only.
- **Checkout testing**: Account must be allowed for IO connectors ([ticket](https://help.vtex.com/en/tutorial/opening-tickets-to-vtex-support--16yOEqpO32UQYygSmMSSAM) with app name and account). Publish beta, install on `master`, wait ~1 hour, open affiliation URL, enable test mode and workspace, configure payment condition (~10 minutes), place test order; then stable + homologation.
- **Publication**: Configure `billingOptions` per [Billing Options](https://developers.vtex.com/docs/guides/vtex-io-documentation-billing-options); submit via [Submitting your app](https://developers.vtex.com/docs/guides/vtex-io-documentation-submitting-your-app-in-the-vtex-app-store). Prepare homologation artifacts (connector app name, partner contact, production endpoint, allowed accounts, new methods/flows) per [Integrating a new payment provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex#7-homologation-and-go-live) (SLA often ~30 days).
- **Updates**: Ship changes in a new beta, re-test affiliations, then stable; re-homologate if required.

## Hard constraints

### Constraint: Declare the `paymentProvider` builder and a real connector identity in `configuration.json`

IO connectors MUST include the `paymentProvider` builder in `manifest.json` and a `paymentProvider/configuration.json` with a non-placeholder `name` and accurate `paymentMethods`. Do not ship the literal placeholder `"MyConnector"` (or equivalent) as production configuration.

**Why this matters**

Without the builder, PPP routes and Gateway policies are not wired. A placeholder name breaks Admin, affiliations, and homologation.

**Detection**

If `manifest.json` lacks `paymentProvider`, or `configuration.json` still uses example placeholder names, stop and fix before publishing.

**Correct**

```json
{
  "name": "PartnerAcmeCard",
  "paymentMethods": [
    { "name": "Visa", "allowsSplit": "onCapture" },
    { "name": "BankInvoice", "allowsSplit": "onAuthorize" }
  ]
}
```

**Wrong**

```json
{
  "name": "MyConnector",
  "paymentMethods": []
}
```

### Constraint: Register PPP routes only through `PaymentProviderService` with a `PaymentProvider` implementation

The service MUST wrap a class extending `PaymentProvider` from `@vtex/payment-provider` so standard PPP paths are registered. Do not hand-roll the same route surface without the package unless VTEX explicitly prescribes an alternative.

**Why this matters**

Missed or mismatched routes break Gateway calls and homologation; the package keeps handlers aligned with the protocol.

**Detection**

If `node/index.ts` exposes PPP paths manually and does not instantiate `PaymentProviderService` with the connector class, reconcile with the documented pattern.

**Correct**

```typescript
import { PaymentProviderService } from "@vtex/payment-provider";
import { YourPaymentConnector } from "./connector";

export default new PaymentProviderService({
  connector: YourPaymentConnector,
});
```

**Wrong**

```typescript
// Ad-hoc router only — no PaymentProviderService / PaymentProvider base
export default someCustomRouterWithoutPPPPackage;
```

### Constraint: Use `this.retry(request)` for Gateway retry on IO

Where the PPP flow requires retry semantics on IO, handlers MUST invoke `this.retry(request)` as specified in the protocol — not a custom retry helper that bypasses the framework.

**Why this matters**

The Gateway expects framework-driven retry behavior; omitting it causes inconsistent authorization and settlement behavior.

**Detection**

Search payment handlers for protocol retry cases; if retries are implemented without `this.retry`, fix before release.

**Correct**

```typescript
// Inside a PaymentProvider subclass method, when the protocol requires retry:
return this.retry(request);
```

**Wrong**

```typescript
// Re-implementing gateway retry with setTimeout/fetch instead of this.retry
await fetch(callbackUrl, { method: "POST", body: JSON.stringify(payload) });
```

### Constraint: Forward card authorization calls through Secure Proxy on IO with allowlisted destinations

For card flows on IO with `usesSecureProxy` behavior, proxied HTTP calls MUST go through `SecureExternalClient` (or equivalent VTEX pattern), MUST pass `secureProxy` set to the `secureProxyUrl` from the payment request, and MUST target a VTEX-allowlisted PCI endpoint. Only `application/json` or `application/x-www-form-urlencoded` bodies are supported. If `usesSecureProxy` is false, the provider must be PCI-certified and supply AOC for `serviceUrl` per VTEX.

**Why this matters**

Skipping Secure Proxy or wrong content types breaks PCI scope, proxy validation, or acquirer integration — blocking homologation or exposing card data incorrectly.

**Detection**

Inspect client code for POSTs that include card tokens without `secureProxy` in the request config, or destinations not registered with VTEX.

**Correct**

```typescript
import { SecureExternalClient, CardAuthorization } from "@vtex/payment-provider";
import type { InstanceOptions, IOContext, RequestConfig } from "@vtex/api";

export class MyPCICertifiedClient extends SecureExternalClient {
  constructor(protected context: IOContext, options?: InstanceOptions) {
    super("https://pci-certified.example.com", context, options);
  }

  public authorize = (cardRequest: CardAuthorization) =>
    this.http.post(
      "authorize",
      {
        holder: cardRequest.holderToken,
        number: cardRequest.numberToken,
        expiration: cardRequest.expiration,
        csc: cardRequest.cscToken,
      },
      {
        headers: { Authorization: "Bearer ..." },
        secureProxy: cardRequest.secureProxyUrl,
      } as RequestConfig
    );
}
```

**Wrong**

```typescript
// Direct outbound call with raw card fields and no secureProxy
await http.post("https://acquirer.example/pay", { pan, cvv, expiry });
```

## Preferred pattern

Recommended layout for a PPF IO app:

```text
/
├── manifest.json
├── paymentProvider/
│   └── configuration.json
├── node/
│   ├── package.json
│   ├── index.ts          # exports PaymentProviderService
│   ├── connector.ts      # class extends PaymentProvider
│   └── clients/
│       └── pciClient.ts  # extends SecureExternalClient when needed
```

Install dependency:

```sh
yarn add @vtex/payment-provider
```

`manifest.json` builders excerpt:

```json
{
  "builders": {
    "node": "6.x",
    "paymentProvider": "1.x"
  }
}
```

`PaymentProvider` subclass skeleton:

```typescript
import { PaymentProvider } from "@vtex/payment-provider";

export class YourPaymentConnector extends PaymentProvider {
  // One method per PPP route; return typed responses
}
```

Optional **`/manifest` route override** shape (only after VTEX approval). Update `x-provider-app` when the app version changes meaningfully; omit `handler` / `headers` only if you fully implement them yourself.

```json
{
  "memory": 256,
  "ttl": 10,
  "timeout": 10,
  "minReplicas": 2,
  "maxReplicas": 3,
  "routes": {
    "manifest": {
      "path": "/_v/api/my-connector/manifest",
      "handler": "vtex.payment-gateway@1.x/providerManifest",
      "headers": {
        "x-provider-app": "$appVendor.$appName@$appVersion"
      },
      "public": true
    }
  }
}
```

**Configurable options** (reference): `name` (required), `serviceUrl` (required; auto on IO), `implementsOAuth`, `implementsSplit`, `usesProviderHeadersName`, `useAntifraud`, `usesBankInvoiceEnglishName`, `usesSecureProxy`, `requiresDocument`, `acceptSplitPartialRefund`, `usesAutoSettleOptions` — see VTEX PPF documentation for defaults and exact semantics.

**`customFields`** in `configuration.json` for Admin: `type` may be `text`, `password` (not for `appKey` / `appToken`), or `select` with `options`.

**Affiliation URL pattern** for testing:

```text
https://{account}.myvtex.com/admin/affiliations/connector/Vtex.PaymentGateway.Connectors.PaymentProvider.PaymentProviderConnector_{connector-name}/
```

Replace `{connector-name}` with `${vendor}-${appName}-${appMajor}` (example: `vtex-payment-provider-example-v1`).

Testing flow summary: publish beta (for example `vendor.app@0.1.0-beta` — see [Making your app publicly available](https://developers.vtex.com/docs/guides/vtex-io-documentation-10-making-your-app-publicly-available#launching-a-new-version)), install on `master`, wait ~1 hour, open affiliation, under **Payment Control** enable **Enable test mode** and set **Workspace** (often `master`), add a [payment condition](https://help.vtex.com/en/tutorial/how-to-configure-payment-conditions--tutorials_455), wait ~10 minutes, place order; then [deploy stable](https://developers.vtex.com/docs/guides/vtex-io-documentation-making-your-new-app-version-publicly-available#step-6---deploying-the-app-stable-version) and complete [homologation](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex#7-homologation-and-go-live).

Replace all example vendor names, endpoints, and credentials with values for your real app before production.

## Common failure modes

- Missing `paymentProvider` builder or empty/wrong `paymentMethods` so `/manifest` and Admin do not list methods correctly.
- Type or install drift (`@vtex/api` / `@vtex/payment-provider`) without the clean reinstall path in root and `node`.
- Skipping `this.retry(request)` and duplicating retry with ad-hoc HTTP — Gateway behavior diverges from PPP.
- Card calls without `secureProxy`, wrong `Content-Type`, or non-allowlisted destination — Secure Proxy or PCI review fails.
- Testing without account allowlisting, without sellable products, or without waiting for master install / payment condition propagation.
- Overriding `/manifest` without VTEX approval or leaving stale `x-provider-app` after a major version bump.
- Homologation ticket missing production endpoint, allowed accounts, or purchase-flow details ([Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows)).

## Review checklist

- [ ] Is the connector an IO app using `PaymentProvider` + `PaymentProviderService` (not only a standalone middleware guide)?
- [ ] Do `manifest.json` and `paymentProvider/configuration.json` match the real connector name and supported methods?
- [ ] Are optional manifest overrides ticket-approved and are `handler` / headers / `x-provider-app` correct?
- [ ] Does every route implementation align with types in `@vtex/payment-provider` and with [`payment-provider-protocol`](../payment-provider-protocol/SKILL.md) for response shapes?
- [ ] Are Gateway retries implemented with `this.retry(request)` where required?
- [ ] Do card flows use `SecureExternalClient` (or equivalent) with `secureProxy: secureProxyUrl` and allowlisted destinations?
- [ ] Has beta/staging testing followed affiliation, test mode, workspace, and payment condition steps before stable?
- [ ] Are billing, App Store submission, and homologation prerequisites documented in the internal release checklist?

## Related skills

- [`payment-provider-protocol`](../payment-provider-protocol/SKILL.md) — PPP endpoints, HTTP methods, and response shapes
- [`payment-idempotency`](../payment-idempotency/SKILL.md) — `paymentId` / `requestId` and retries
- [`payment-async-flow`](../payment-async-flow/SKILL.md) — `undefined` status and `callbackUrl` (IO retry vs notification)
- [`payment-pci-security`](../payment-pci-security/SKILL.md) — PCI and Secure Proxy semantics beyond IO wiring

## Reference

- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — Official PPF guide (includes getting started and example app)
- [Payment Provider Protocol API overview](https://developers.vtex.com/docs/guides/payment-provider-protocol-api-overview)
- [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy)
- [PCI DSS compliance (payments)](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance)
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/tutorial/payment-provider-protocol--RdsT2spdq80MMwwOeEq0m)
- [Integrating a new payment provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex)
