# AGENTS.md — VTEX Development Skills

This repository contains AI agent skills for VTEX platform development.
Each track directory contains an AGENTS.md with detailed instructions.

## FastStore Implementation & Customization

See [`faststore/AGENTS.md`](./faststore/AGENTS.md) for detailed instructions.

  - **faststore-data-fetching**: Apply when deciding, designing, or implementing data fetching with FastStore GraphQL files in src/graphql/ or src/fragments/, or configuring faststore.config. Covers API extensions, GraphQL fragments, server-side and client-side data fetching, and custom resolver patterns. Use for integrating custom data sources or extending the FastStore GraphQL schema.
  - **faststore-overrides**: Apply when deciding, designing, or implementing FastStore component overrides in src/components/overrides/. Covers getOverriddenSection API, component replacement, props overriding, and custom section creation. Use for any FastStore storefront customization beyond theming that requires changing component behavior or structure.
  - **faststore-state-management**: Apply when deciding, designing, or implementing client-side state with FastStore SDK hooks like useCart, useSession, or useSearch. Covers cart manipulation, session handling, faceted search, and analytics event tracking from @faststore/sdk. Use for any interactive ecommerce feature that relies on FastStore's built-in state management.
  - **faststore-theming**: Apply when deciding, designing, or implementing FastStore theme customizations in src/themes/ or working with design tokens and SCSS variables. Covers global tokens, local component tokens, Sass variables, CSS custom properties, and Brandless architecture. Use for any visual customization of FastStore storefronts that does not require component overrides.

## Headless Front-End Development

See [`headless/AGENTS.md`](./headless/AGENTS.md) for detailed instructions.

  - **headless-bff-architecture**: Apply when designing or modifying a BFF (Backend-for-Frontend) layer, middleware, or API proxy for a headless VTEX storefront. Covers BFF middleware architecture, public vs private API classification, VtexIdclientAutCookie management, API key protection, and secure request proxying. Use for any headless commerce project that must never expose VTEX_APP_KEY or call private VTEX APIs from the browser.
  - **headless-caching-strategy**: Apply when implementing caching logic, CDN configuration, or performance optimization for a headless VTEX storefront. Covers which VTEX APIs can be cached (Intelligent Search, Catalog) versus which must never be cached (Checkout, Profile, OMS), stale-while-revalidate patterns, cache invalidation, and BFF-level caching. Use for any headless project that needs TTL rules and caching strategy guidance.
  - **headless-checkout-proxy**: Apply when implementing cart, checkout, or order placement logic proxied through a BFF for headless VTEX storefronts. Covers OrderForm lifecycle, cart creation, item management, profile/shipping/payment attachments, orderFormId management, and secure checkout flows. Use for any headless frontend that needs to proxy VTEX Checkout API calls through a server-side layer with proper session cookie handling.
  - **headless-intelligent-search**: Apply when implementing search functionality, faceted navigation, or autocomplete in a headless VTEX storefront. Covers product_search, autocomplete_suggestions, facets, banners, correction_search, and top_searches endpoints, plus analytics event collection. Use for any custom frontend that integrates VTEX Intelligent Search API for product discovery and search result rendering.

## Marketplace Integration

See [`marketplace/AGENTS.md`](./marketplace/AGENTS.md) for detailed instructions.

  - **marketplace-catalog-sync**: Apply when building catalog or SKU synchronization logic for VTEX marketplace seller connectors. Covers the changenotification endpoint, SKU suggestion lifecycle, product data mapping, price and inventory sync, and fulfillment simulation. Use for implementing seller-side catalog integration that pushes SKUs to VTEX marketplaces with proper notification handling and rate-limited batch synchronization.
  - **marketplace-fulfillment**: Apply when implementing fulfillment, invoice, or tracking logic for VTEX marketplace seller connectors. Covers the Order Invoice Notification API, invoice payload structure, tracking updates, partial invoicing for split shipments, and the authorize fulfillment flow. Use for building seller-side order fulfillment that integrates with VTEX marketplace order management including the 2.5s simulation timeout.
  - **marketplace-order-hook**: Apply when implementing order integration hooks, feeds, or webhook handlers for VTEX marketplace connectors. Covers Feed v3 (pull) vs Hook (push), filter types (FromWorkflow and FromOrders), order status lifecycle, payload validation, and idempotent processing. Use for building order integrations between VTEX marketplaces and external systems such as ERPs, WMS, or fulfillment services.
  - **marketplace-rate-limiting**: Apply when implementing retry logic, rate limit handling, or resilience patterns in VTEX API integrations. Covers VTEX rate limit headers (X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After), 429 status handling, exponential backoff with jitter, circuit breaker patterns, and request queuing. Use for any VTEX marketplace integration that must gracefully handle API throttling and maintain high availability.

## Payment Connector Development

See [`payment/AGENTS.md`](./payment/AGENTS.md) for detailed instructions.

  - **payment-async-flow**: Apply when implementing asynchronous payment methods (Boleto, Pix, bank redirects) or working with callback URLs in payment connector code. Covers undefined status response, callbackUrl notification, X-VTEX-signature validation, sync vs async handling, and correct delayToCancel configuration for each async method.
  - **payment-idempotency**: Apply when implementing idempotency logic in payment connector code or handling duplicate payment requests. Covers paymentId as idempotency key, payment state machine transitions, retry semantics for cancellation and refund operations, and requestId handling. Use for preventing duplicate charges and ensuring correct Gateway retry behavior across Create Payment, Cancel, Capture, and Refund endpoints.
  - **payment-pci-security**: Apply when handling credit card data, implementing secureProxyUrl flows, or working with payment security and proxy code. Covers PCI DSS compliance, Secure Proxy card tokenization, sensitive data handling rules, X-PROVIDER-Forward-To header usage, and custom token creation. Use for any payment connector that processes credit, debit, or co-branded card payments to prevent data breaches and PCI violations.
  - **payment-provider-framework**: Apply when designing, or implementing a Payment Connector in VTEX IO. Covers PPF implementation in VTEX IO, use of secure proxy, manifest and other PPP routes exposure and clients definitions. Use for any implementation of a Payment Connector hosted in VTEX IO.
  - **payment-provider-protocol**: Apply when implementing a VTEX Payment Provider Protocol (PPP) connector or working with payment/connector endpoint files. Covers all nine required endpoints: Manifest, Create Payment, Cancel, Capture/Settle, Refund, Inbound Request, Create Auth Token, Provider Auth Redirect, and Get Credentials. Use for building or debugging any payment connector that integrates with the VTEX Payment Gateway.

## Custom VTEX IO Apps

See [`vtex-io/AGENTS.md`](./vtex-io/AGENTS.md) for detailed instructions.

  - **vtex-io-app-structure**: Apply when creating or modifying manifest.json, service.json, or node/package.json in a VTEX IO app. Covers builders (node, react, graphql, admin, pixel, messages, store), policy declarations, dependencies, peerDependencies, and app lifecycle management. Use for scaffolding new VTEX IO apps, configuring builders, or fixing deployment failures related to app structure and naming conventions.
  - **vtex-io-graphql-api**: Apply when working with GraphQL schema files in graphql/ or implementing resolvers in node/resolvers/ for VTEX IO apps. Covers schema.graphql definitions, @cacheControl and @auth directives, custom type definitions, and resolver registration in the Service class. Use for exposing data through GraphQL queries and mutations with proper cache control and authentication enforcement.
  - **vtex-io-masterdata**: Apply when working with MasterData v2 entities, schemas, or MasterDataClient in VTEX IO apps. Covers data entities, JSON Schema definitions, CRUD operations, the masterdata builder, triggers, search and scroll operations, and schema lifecycle management. Use for storing, querying, and managing custom data in VTEX IO apps while avoiding the 60-schema limit through proper schema versioning.
  - **vtex-io-react-apps**: Apply when building React components under react/ or configuring store blocks in store/ for VTEX IO apps. Covers interfaces.json, contentSchemas.json for Site Editor, VTEX Styleguide for admin apps, and css-handles for storefront styling. Use for creating custom storefront components, admin panels, pixel apps, or any frontend development within the VTEX IO react builder ecosystem.
  - **vtex-io-service-apps**: Apply when building backend service apps under node/ in a VTEX IO project or configuring service.json routes. Covers the Service class, middleware functions, ctx.clients pattern, JanusClient, ExternalClient, MasterDataClient, and IOClients registration. Use for implementing backend APIs, event handlers, or integrations that must use @vtex/api clients instead of raw HTTP libraries.
