# Marketplace Integration

Complete reference for VTEX marketplace integration, including SKU integration, order hooks, fulfillment, rate limiting, and marketplace operations. This track covers everything needed to build production-ready marketplace connectors that integrate external sellers or systems with VTEX marketplaces.

## Overview

VTEX Marketplace is a multi-seller commerce platform where external sellers integrate their catalogs, manage orders, and fulfill shipments through VTEX. This track teaches developers how to build seller connectors that push SKUs to marketplaces, handle order notifications via Feed v3 and Hooks, send invoice and tracking data, and build resilient integrations that handle VTEX API rate limits gracefully. Whether you're building a seller connector, an ERP integration, or a fulfillment system, this track provides the patterns and constraints needed for reliable marketplace operations.

## Skills

| Skill | Description | Link |
|-------|-------------|------|
| **Catalog & SKU Integration** | Use the Change Notification endpoint to register and update SKUs, manage the SKU suggestion lifecycle (pending → approved/denied), synchronize prices and inventory, and handle fulfillment simulation. | [skills/marketplace-catalog-sync/skill.md](skills/marketplace-catalog-sync/skill.md) |
| **Order Integration & Webhooks** | Configure Feed v3 (pull) and Hook (push) for order updates, validate webhook authentication, process events idempotently, and handle the complete order status lifecycle. | [skills/marketplace-order-hook/skill.md](skills/marketplace-order-hook/skill.md) |
| **Fulfillment, Invoice & Tracking** | Handle Authorize Fulfillment callbacks, send invoice notifications with required fields, update tracking information, and manage partial invoicing for split shipments. | [skills/marketplace-fulfillment/skill.md](skills/marketplace-fulfillment/skill.md) |
| **API Rate Limiting & Resilience** | Understand VTEX rate limit mechanics, read rate limit headers, implement exponential backoff with jitter, build circuit breakers, and queue requests for high-throughput integrations. | [skills/marketplace-rate-limiting/skill.md](skills/marketplace-rate-limiting/skill.md) |

## Recommended Learning Order

1. **Start with Catalog & SKU Integration** — Understand how to push products to the marketplace first. This is the foundation for all marketplace operations.
2. **Learn Order Integration** — Understand how to consume order updates via Feed v3 or Hook.
3. **Add Fulfillment** — Learn how to send invoice and tracking data back to the marketplace.
4. **Implement Rate Limiting** — Finally, ensure your integration handles VTEX API rate limits gracefully and scales reliably.

## Key Constraints Summary

- **Change Notification endpoint is the entry point** — Always call `POST /api/catalog_system/pvt/skuseller/changenotification/{skuId}` first. The response (200 or 404) determines whether to update or register the SKU.
- **SKU suggestions can only be updated while pending** — Once approved or denied, the suggestion is locked. You cannot change it. Send a new suggestion if needed.
- **Order Hook endpoint must respond within 5000ms** — Slow responses cause timeouts and missed events. Implement async processing if needed.
- **Feed and Hook filters are mutually exclusive** — Use either `FromWorkflow` (status-based) or `FromOrders` (JSONata expressions), not both.
- **Invoice payload requires exact field formatting** — `invoiceValue` is in cents, not reais. Missing required fields cause 400 Bad Request errors.
- **Validate webhook authentication** — Always verify the request signature before processing. Unsigned webhooks are a security vulnerability.
- **Implement exponential backoff for 429 responses** — Respect the `Retry-After` header. Ignoring rate limits causes circuit breaker activation (503 Service Unavailable).

## Related Tracks

- **For payment processing**, see [Track 2: Payment Connector Development](../payment/index.md) — Understand payment flows in marketplace orders.
- **For headless storefronts**, see [Track 5: Headless Front-End Development](../headless/index.md) — Build custom marketplace frontends.
- **For VTEX IO apps**, see [Track 3: Custom VTEX IO Apps](../vtex-io/index.md) — Build marketplace connectors as VTEX IO apps.
