# Custom VTEX IO Apps

Guide to building custom VTEX IO applications, covering builders, policies, @vtex/api clients, service patterns, and app development best practices. This track covers everything needed to build production-ready VTEX IO apps that extend the VTEX platform with custom functionality.

## Overview

VTEX IO is a serverless platform for building custom applications that extend VTEX Commerce. This track teaches developers how to scaffold VTEX IO apps, configure builders (node, react, graphql, admin, pixel, messages, store), declare policies for API access, implement backend services with the Service class and client system, build frontend React components and Store Framework blocks, expose GraphQL APIs, and integrate Master Data v2 for custom data storage. Whether you're building a backend integration, a storefront component, or a complete custom app, this track provides the patterns and constraints needed for production deployments.

## Skills

| Skill | Description | Link |
|-------|-------------|------|
| **App Architecture & Manifest Configuration** | Configure `manifest.json` with builders, policies, dependencies, and `service.json` resource limits. Understand the app lifecycle (link, publish, deploy). | [skills/vtex-io-app-structure/skill.md](skills/vtex-io-app-structure/skill.md) |
| **Backend Service Apps & API Clients** | Build backend services using the Service class, implement middleware chains, register and use clients (JanusClient, ExternalClient, MasterDataClient), and configure routes in `service.json`. | [skills/vtex-io-service-apps/skill.md](skills/vtex-io-service-apps/skill.md) |
| **Frontend React Components & Hooks** | Create React components in the `/react` directory, register them as Store Framework blocks via `interfaces.json`, configure Site Editor props with `contentSchemas.json`, and use VTEX Styleguide and css-handles. | [skills/vtex-io-react-apps/skill.md](skills/vtex-io-react-apps/skill.md) |
| **GraphQL Schemas & Resolvers** | Define GraphQL schemas in `.graphql` files, write resolver functions, use `@cacheControl` and `@auth` directives, and wire resolvers into the Service class. | [skills/vtex-io-graphql/skill.md](skills/vtex-io-graphql/skill.md) |
| **MasterData v2 Integration** | Define data entities with JSON Schemas via the `masterdata` builder, perform CRUD operations through MasterDataClient, configure search/scroll, and set up triggers. | [skills/vtex-io-masterdata/skill.md](skills/vtex-io-masterdata/skill.md) |

## Recommended Learning Order

1. **Start with App Architecture** — Understand `manifest.json`, builders, and policies first. This is the foundation for all VTEX IO apps.
2. **Learn Backend Services** — Understand the Service class, clients, and middleware pattern for building backend logic.
3. **Add Frontend Components** — Learn how to build React components and register them as Store Framework blocks.
4. **Expose GraphQL APIs** — Learn how to define schemas and resolvers for data access.
5. **Store Custom Data** — Finally, use Master Data v2 to persist custom data in your app.

## Key Constraints Summary

- **`manifest.json` is mandatory** — Every VTEX IO app requires a valid manifest. Without it, the app cannot be linked, published, or deployed.
- **Builders must be declared in `manifest.json`** — Only declared builders are processed. Undeclared builders are ignored.
- **Policies are required for external access** — Declare policies for outbound-access (external URLs) and VTEX resources. Missing policies cause 403 Forbidden errors.
- **Always use `ctx.clients` for API access** — Never instantiate clients directly. The `ctx.clients` pattern provides caching, retry, and metrics.
- **Never use third-party UI libraries in admin apps** — Admin apps MUST use VTEX Styleguide. Third-party libraries break consistency and are not supported.
- **Use css-handles for storefront styling** — Never hardcode class names. Use `useCssHandles()` to expose safe CSS classes for customization.
- **Master Data has a 60-schema-per-entity hard limit** — Plan your schema versioning strategy to avoid hitting this limit.

## Related Tracks

- **For frontend-only approaches**, see [Track 1: FastStore Implementation & Customization](../faststore/index.md) — Use FastStore for pre-built storefront components.
- **For payment connectors**, see [Track 2: Payment Connector Development](../payment/index.md) — Build payment connectors as VTEX IO apps.
- **For marketplace integrations**, see [Track 4: Marketplace Integration](../marketplace/index.md) — Build marketplace connectors as VTEX IO apps.
