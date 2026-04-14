# Custom VTEX IO Apps

Guide to building custom VTEX IO applications, covering builders, policies, `@vtex/api` clients, service patterns, and app development best practices. This track covers everything needed to build production-ready VTEX IO apps that extend the VTEX platform with custom functionality.

## Overview

VTEX IO is a serverless platform for building custom applications that extend VTEX Commerce. This track teaches developers how to scaffold VTEX IO apps, configure builders (`node`, `react`, `graphql`, `admin`, `pixel`, `messages`, `store`), declare policies for API access, implement backend services with the `Service` class and client system, build frontend React components and Store Framework blocks, expose APIs, and manage data and configuration safely.

The VTEX IO track is being reorganized into smaller, more decision-oriented skills. The current source files still reflect the older structure in some places, but the intended model is grouped as follows.

## Planned Grouping

### Group 1: Foundations

- `vtex-io-app-contract`
- `vtex-io-service-runtime`
- `vtex-io-client-integration`

### Group 2: API exposure

- `vtex-io-graphql-api`
- `vtex-io-http-routes`
- `vtex-io-events-and-workers`

### Group 3: Frontend

- `vtex-io-storefront-react`
- `vtex-io-admin-react`
- `vtex-io-render-runtime-and-blocks`

### Group 4: Data and config

- `vtex-io-app-settings`
- `vtex-io-masterdata-strategy`
- `vtex-io-data-access-patterns`

### Group 5: Security and operations

- `vtex-io-auth-and-policies`
- `vtex-io-security-boundaries`
- `vtex-io-observability-and-ops`

## Skills

The table below reflects the currently published VTEX IO skills in this repository. It will evolve toward the grouped structure above.

| Skill                                         | Description                                                                                                                                                                                                                                                                                                      | Link                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **App Architecture & Manifest Configuration** | Configure `manifest.json` with builders, policies, dependencies, and `service.json` resource limits. Understand the app lifecycle (link, publish, deploy).                                                                                                                                                       | [skills/vtex-io-app-structure/skill.md](skills/vtex-io-app-structure/skill.md)                     |
| **Backend Service Apps & API Clients**        | Build backend services using the Service class, implement middleware chains, register and use clients (JanusClient, ExternalClient, MasterDataClient), and configure routes in `service.json`.                                                                                                                   | [skills/vtex-io-service-apps/skill.md](skills/vtex-io-service-apps/skill.md)                       |
| **Frontend React Components & Hooks**         | Create React components in the `/react` directory, register them as Store Framework blocks via `interfaces.json`, configure Site Editor props with `contentSchemas.json`, and use VTEX Styleguide and css-handles.                                                                                               | [skills/vtex-io-react-apps/skill.md](skills/vtex-io-react-apps/skill.md)                           |
| **GraphQL Schemas & Resolvers**               | Define GraphQL schemas in `.graphql` files, write resolver functions, use `@cacheControl` and `@auth` directives, and wire resolvers into the Service class.                                                                                                                                                     | [skills/vtex-io-graphql-api/skill.md](skills/vtex-io-graphql-api/skill.md)                         |
| **Service paths & CDN behavior**              | Choose `public` vs `/_v/segment` vs `/_v/private` routes in `service.json`, align cookies and edge caching with data scope, and set HTTP cache headers safely.                                                                                                                                                   | [skills/vtex-io-service-paths-and-cdn/skill.md](skills/vtex-io-service-paths-and-cdn/skill.md)     |
| **Application performance**                   | Improve latency and resilience with LRU, VBase, stale-while-revalidate, AppSettings loading, parallel client calls, resolver deduplication, per-entity VBase keys, and service.json tuning—plus rules on what must never be cached (transactional data) and when VBase writes must be awaited (financial flows). | [skills/vtex-io-application-performance/skill.md](skills/vtex-io-application-performance/skill.md) |
| **Session transform apps**                    | Build or debug session transforms: namespace ownership, input-vs-output fields, transform ordering (DAG), public-as-input vs private-as-read, cross-namespace propagation, and caching inside transforms for B2B, pricing, or regionalization context.                                                           | [skills/vtex-io-session-apps/skill.md](skills/vtex-io-session-apps/skill.md)                       |
| **MasterData v2 Integration**                 | Define data entities with JSON Schemas via the `masterdata` builder, perform CRUD through MasterDataClient, configure search/scroll, set up triggers, audit entity governance and bulk operations—and **challenge** whether Master Data is the right place at all.                                               | [skills/vtex-io-masterdata/skill.md](skills/vtex-io-masterdata/skill.md)                           |

## Recommended Learning Order

1. **Start with App Architecture** — Understand `manifest.json`, builders, and policies first. This is the foundation for all VTEX IO apps.
2. **Learn Backend Services** — Understand the Service class, clients, and middleware pattern for building backend logic.
3. **Service paths & application performance** — After you have routes, align **path patterns** with **cookies** and **edge caching**; add **LRU/VBase**, **parallel** fetches, **resolver deduplication**, and **efficient** AppSettings/context where needed. Understand what must never be cached (transactional data) and when VBase writes must be awaited.
4. **Add Frontend Components** — Learn how to build React components and register them as Store Framework blocks.
5. **Expose GraphQL APIs** — Learn how to define schemas and resolvers for data access.
6. **Session transforms** — When your app needs to derive session state (B2B pricing, regionalization, custom context), learn namespace ownership, input propagation, and caching inside transforms.
7. **Store Custom Data** — Use Master Data v2 only after **scrutinizing** the storage choice: confirm MD fits the workload, audit entity governance, or use another VTEX surface or external DB.

## Planned Learning Flow

1. **Foundations** — Start with app contract, service runtime, and client integration.
2. **API exposure** — Choose between `graphql`, `http-routes`, and `events-and-workers` based on the integration shape.
3. **Frontend** — Split storefront React, admin React, and render/runtime concerns.
4. **Data and config** — Separate app settings, Master Data strategy, and general data access patterns.
5. **Security and operations** — Finish with auth, policy boundaries, and operational visibility.

## Choosing The API Exposure Skill

- Use `vtex-io-graphql-api` when frontend or app consumers need structured querying and typed aggregation.
- Use `vtex-io-http-routes` for explicit integration endpoints, callbacks, or webhook-style contracts.
- Use `vtex-io-events-and-workers` for asynchronous processing, retries, and work that should not block a request-response cycle.

## Key Constraints Summary

- **`manifest.json` is mandatory** — Every VTEX IO app requires a valid manifest. Without it, the app cannot be linked, published, or deployed.
- **Builders must be declared in `manifest.json`** — Only declared builders are processed. Undeclared builders are ignored.
- **Policies are required for external access** — Declare policies for outbound-access (external URLs) and VTEX resources. Missing policies cause 403 Forbidden errors.
- **Always use `ctx.clients` for API access** — Never instantiate clients directly. The `ctx.clients` pattern provides caching, retry, and metrics.
- **Match route prefix to data scope** — Public vs `/_v/segment` vs `/_v/private` controls cookies and edge caching ([Service path patterns](https://developers.vtex.com/docs/guides/service-path-patterns)); do not CDN-cache private or auth-scoped JSON.
- **Layer application performance patterns deliberately** — LRU for hot keys, VBase for shared stale-while-revalidate, **tenant-scoped** in-memory keys (`account` + `workspace`) on shared pods. Every outbound call needs an **explicit timeout**; degrade gracefully when upstreams are slow. Never cache transactional data (order forms, cart simulations, payment responses). Await VBase writes in financial/idempotency-critical paths.
- **Session transforms: own your namespace** — Each session app owns its output namespace; never write to another app's output namespace. Use `public.*` for input propagation only, not as a read model. Frontend reads private namespaces for business state.
- **Never use third-party UI libraries in admin apps** — Admin apps MUST use VTEX Styleguide. Third-party libraries break consistency and are not supported.
- **Use css-handles for storefront styling** — Never hardcode class names. Use `useCssHandles()` to expose safe CSS classes for customization.
- **Master Data has a 60-schema-per-entity hard limit** — Plan your schema versioning strategy to avoid hitting this limit.

## Related Tracks

- **For frontend-only approaches**, see [Track 1: FastStore Implementation & Customization](../faststore/index.md) — Use FastStore for pre-built storefront components.
- **For payment connectors**, see [Track 2: Payment Connector Development](../payment/index.md) — Build payment connectors as VTEX IO apps.
- **For marketplace integrations**, see [Track 4: Marketplace Integration](../marketplace/index.md) — Build marketplace connectors as VTEX IO apps.
