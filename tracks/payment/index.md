# Payment Connector Development

Best practices for developing VTEX payment connectors, including PPP endpoints, idempotency, PCI compliance, and integration patterns. This track covers everything needed to build production-ready payment connectors that integrate with the VTEX Payment Gateway.

## Overview

The VTEX Payment Provider Protocol (PPP) defines how payment connectors integrate with the VTEX Payment Gateway. This track teaches developers how to implement all nine PPP endpoints, handle both synchronous and asynchronous payment flows, ensure idempotent operations, comply with PCI DSS security requirements, and build resilient connectors that handle retries and callbacks correctly. Whether you're building a connector for a new payment service provider or maintaining an existing one, this track provides the patterns and constraints needed for homologation and production stability.

## Skills

| Skill | Description | Link |
|-------|-------------|------|
| **PPP Endpoint Implementation** | Implement all nine required PPP endpoints: Manifest, Create Payment, Cancel, Capture/Settle, Refund, Inbound Request, Create Auth Token, Provider Auth Redirect, and Get Credentials. | [skills/payment-provider-protocol/skill.md](skills/payment-provider-protocol/skill.md) |
| **Idempotency & Duplicate Prevention** | Use `paymentId` and `requestId` as idempotency keys, implement a payment state machine, and handle Gateway retries that can occur for up to 7 days on `undefined` status payments. | [skills/payment-idempotency/skill.md](skills/payment-idempotency/skill.md) |
| **Asynchronous Payment Flows & Callbacks** | Handle asynchronous payment methods (Boleto, Pix, bank transfers) by returning `undefined` status, managing `callbackUrl` notifications, and validating `X-VTEX-signature` headers. | [skills/payment-async-flow/skill.md](skills/payment-async-flow/skill.md) |
| **PCI Compliance & Secure Proxy** | Understand PCI DSS requirements, use `secureProxyUrl` for card tokenization, protect sensitive data, and route acquirer calls through the Secure Proxy. | [skills/payment-pci-security/skill.md](skills/payment-pci-security/skill.md) |

## Recommended Learning Order

1. **Start with PPP Endpoints** — Understand the complete protocol structure and all nine endpoints first.
2. **Learn Idempotency** — Understand how to prevent duplicate charges and handle retries correctly.
3. **Add Async Flow Support** — Learn how to handle asynchronous payment methods and callbacks.
4. **Implement PCI Security** — Finally, ensure your connector meets PCI compliance requirements and uses Secure Proxy correctly.

## Key Constraints Summary

- **All nine PPP endpoints are required for homologation** — Manifest, Create Payment, Cancel, Capture/Settle, Refund, Inbound Request, Create Auth Token, Provider Auth Redirect, Get Credentials.
- **`paymentId` is the idempotency key for Create Payment** — If the Gateway retries with the same `paymentId`, return the exact same response without creating a new transaction.
- **`requestId` is the idempotency key for Cancel/Capture/Refund** — Each `requestId` represents a single logical operation. Duplicate requests must return the cached result.
- **Never store, log, or transmit raw card data** — Use Secure Proxy tokenization. Raw card data is a PCI violation and a data breach risk.
- **Validate `X-VTEX-signature` on all callback URLs** — Unsigned callbacks are a security vulnerability. Always verify the signature before processing.
- **Return `undefined` status for asynchronous payments** — Do not return `approved` or `denied` until the acquirer confirms. Premature status changes break the payment flow.
- **Respect the 7-day retry window** — The Gateway retries `undefined` payments for up to 7 days. Your connector must handle retries gracefully.

## Related Tracks

- **For marketplace order payments**, see [Track 4: Marketplace Integration](../marketplace/index.md) — Understand how payment connectors integrate with marketplace order flows.
- **For VTEX IO payment apps**, see [Track 3: Custom VTEX IO Apps](../vtex-io/index.md) — Build VTEX IO apps that use payment connectors.
