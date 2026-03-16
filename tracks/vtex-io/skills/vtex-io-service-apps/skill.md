---
name: vtex-io-service-apps
description: >
  Apply when building backend service apps under node/ in a VTEX IO project or configuring service.json routes.
  Covers the Service class, middleware functions, ctx.clients pattern, JanusClient, ExternalClient,
  MasterDataClient, and IOClients registration. Use for implementing backend APIs, event handlers, or
  integrations that must use @vtex/api clients instead of raw HTTP libraries.
track: vtex-io
tags:
  - vtex-io
  - service-apps
  - node-builder
  - clients
  - middleware
  - janus-client
  - external-client
  - masterdata-client
  - ctx-clients
globs:
  - "node/**/*.ts"
  - "node/**/*.js"
  - "service.json"
version: "1.0"
vtex_docs_verified: "2026-03-16"
---

# Backend Service Apps & API Clients

## Overview

**What this skill covers**: Building VTEX IO backend services using the `node` builder — the Service class, middleware pattern, client system (JanusClient, ExternalClient, MasterDataClient), IOClients registry, service.json route configuration, event handling, and the mandatory `ctx.clients` access pattern.

**When to use it**: When developing a VTEX IO app that needs backend logic — REST API routes, GraphQL resolvers, event handlers, scheduled tasks, or integrations with VTEX Commerce APIs and external services.

**What you'll learn**:
- How to structure the Service entry point with typed context, clients, and state
- How to create and register custom clients extending JanusClient or ExternalClient
- How to use `ctx.clients` to access clients with built-in caching, retry, and metrics
- How to configure routes and middleware chains in service.json

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: The Service Class

The Service class is the entry point for every VTEX IO backend app (`node/index.ts`). It receives a configuration object defining clients, routes (with middleware chains), GraphQL resolvers, and event handlers. The Service class wires everything together and registers it with the VTEX IO runtime.

```typescript
import type { ParamsContext, RecorderState, ServiceContext } from '@vtex/api'
import { Service } from '@vtex/api'

export default new Service<Clients, RecorderState, ParamsContext>({
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 3000,
      },
    },
  },
  routes: { ... },
  graphql: { resolvers: { ... } },
  events: { ... },
})
```

### Concept 2: Context, State, and Clients

Every middleware, resolver, and event handler receives a `ctx` object of type `ServiceContext`. This context provides:

- `ctx.clients` — Access to all registered clients (VTEX native + custom)
- `ctx.state` — Mutable state shared across the middleware chain for a single request
- `ctx.vtex` — Authentication tokens, account info, workspace, request metadata
- `ctx.body` — Request/response body

The generic type parameters `Service<Clients, State, Context>` allow full TypeScript type safety across your entire app.

### Concept 3: Client Hierarchy

VTEX IO provides a hierarchy of base client classes in `@vtex/api`:

| Class | Use Case | Base URL |
|-------|----------|----------|
| `JanusClient` | Access VTEX internal APIs (Janus gateway) | `https://{account}.vtexcommercestable.com.br` |
| `ExternalClient` | Access external (non-VTEX) APIs | Any URL you specify |
| `AppClient` | Access routes exposed by other VTEX IO apps | `https://{workspace}--{account}.myvtex.com` |
| `InfraClient` | Access VTEX IO infrastructure services | Internal |
| `MasterDataClient` | Access Master Data v2 CRUD operations | VTEX API |

All clients extend a common base that provides: disk/memory caching, automatic retries with exponential backoff, timeout configuration, native metrics collection, and billing tracking.

### Concept 4: IOClients Registry

Custom clients are registered by extending the `IOClients` class from `@vtex/api`. This class acts as a dependency injection container — each client is lazily instantiated on first access and reused across the request lifecycle.

```typescript
import { IOClients } from '@vtex/api'
import { MyExternalClient } from './myExternalClient'

export class Clients extends IOClients {
  public get myExternal() {
    return this.getOrSet('myExternal', MyExternalClient)
  }
}
```

**Architecture/Data Flow**:

```text
Request → VTEX IO Runtime → Service
  ├── routes → middleware chain → ctx.clients.{name}.method()
  ├── graphql → resolvers → ctx.clients.{name}.method()
  └── events → handlers → ctx.clients.{name}.method()
                               │
                               ▼
                         Client (JanusClient / ExternalClient)
                               │
                               ▼
                    External Service / VTEX API
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Use @vtex/api Clients — Never Raw HTTP Libraries

**Rule**: All HTTP communication from a VTEX IO service app MUST go through `@vtex/api` clients (JanusClient, ExternalClient, AppClient, or native clients from `@vtex/clients`). You MUST NOT use `axios`, `fetch`, `got`, `node-fetch`, or any other raw HTTP library.

**Why**: VTEX IO clients provide automatic authentication header injection, built-in caching (disk and memory), retry with exponential backoff, timeout management, native metrics and billing tracking, and proper error handling. Raw HTTP libraries bypass all of these, leading to missing auth tokens, no caching, no retries, no metrics, and potential billing issues. Additionally, outbound traffic from VTEX IO is firewalled — only `@vtex/api` clients properly route through the infrastructure.

**Detection**: If you see `import axios from 'axios'`, `import fetch from 'node-fetch'`, `import got from 'got'`, `require('node-fetch')`, or any direct `fetch()` call in a VTEX IO service app, STOP. Replace with a proper client extending JanusClient or ExternalClient.

✅ **CORRECT**:
```typescript
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class WeatherClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://api.weather.com', context, {
      ...options,
      headers: {
        'X-Api-Key': 'my-key',
        ...options?.headers,
      },
    })
  }

  public async getForecast(city: string): Promise<Forecast> {
    return this.http.get(`/v1/forecast/${city}`, {
      metric: 'weather-forecast',
    })
  }
}
```

❌ **WRONG**:
```typescript
import axios from 'axios'

// This bypasses VTEX IO infrastructure entirely.
// No caching, no retries, no metrics, no auth token injection.
// Outbound requests may be blocked by the firewall.
export async function getForecast(city: string): Promise<Forecast> {
  const response = await axios.get(`https://api.weather.com/v1/forecast/${city}`, {
    headers: { 'X-Api-Key': 'my-key' },
  })
  return response.data
}
```

---

### Constraint: Access Clients via ctx.clients — Never Instantiate Directly

**Rule**: Clients MUST always be accessed through `ctx.clients.{clientName}` in middlewares, resolvers, and event handlers. You MUST NOT instantiate client classes directly with `new`.

**Why**: The IOClients registry manages client lifecycle, ensuring proper initialization with the current request's IOContext (account, workspace, auth tokens). Direct instantiation creates clients without authentication context, without caching configuration, and without connection to the metrics pipeline. It also prevents the runtime from managing memory and connection pooling.

**Detection**: If you see `new MyClient(...)` or `new ExternalClient(...)` inside a middleware or resolver, STOP. The client should be registered in the Clients class and accessed via `ctx.clients`.

✅ **CORRECT**:
```typescript
// node/clients/index.ts
import { IOClients } from '@vtex/api'
import { CatalogClient } from './catalogClient'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', CatalogClient)
  }
}

// node/middlewares/getProduct.ts
export async function getProduct(ctx: Context, next: () => Promise<void>) {
  const { clients: { catalog } } = ctx
  const product = await catalog.getProductById(ctx.query.id)
  ctx.body = product
  ctx.status = 200
  await next()
}
```

❌ **WRONG**:
```typescript
// node/middlewares/getProduct.ts
import { CatalogClient } from '../clients/catalogClient'

export async function getProduct(ctx: Context, next: () => Promise<void>) {
  // Direct instantiation — no auth context, no caching, no metrics
  const catalog = new CatalogClient(ctx.vtex, {})
  const product = await catalog.getProductById(ctx.query.id)
  ctx.body = product
  ctx.status = 200
  await next()
}
```

---

### Constraint: Avoid Monolithic Service Apps

**Rule**: A single service app SHOULD NOT define more than 10 HTTP routes. If you need more, consider splitting into focused microservice apps.

**Why**: VTEX IO apps run in containers with limited memory (max 512MB). A monolithic app with many routes increases memory usage, cold start time, and blast radius of failures. It also makes the app harder to version and deploy independently. The VTEX IO platform is designed for small, focused apps that compose together.

**Detection**: If `service.json` defines more than 10 routes, warn the developer to consider splitting the app into smaller services. This is a soft limit — there may be valid exceptions.

✅ **CORRECT**:
```json
{
  "memory": 256,
  "timeout": 30,
  "routes": {
    "get-reviews": { "path": "/_v/api/reviews", "public": false },
    "get-review": { "path": "/_v/api/reviews/:id", "public": false },
    "create-review": { "path": "/_v/api/reviews", "public": false },
    "moderate-review": { "path": "/_v/api/reviews/:id/moderate", "public": false }
  }
}
```

❌ **WRONG**:
```json
{
  "memory": 512,
  "timeout": 60,
  "routes": {
    "route1": { "path": "/_v/api/reviews" },
    "route2": { "path": "/_v/api/reviews/:id" },
    "route3": { "path": "/_v/api/products" },
    "route4": { "path": "/_v/api/products/:id" },
    "route5": { "path": "/_v/api/orders" },
    "route6": { "path": "/_v/api/orders/:id" },
    "route7": { "path": "/_v/api/users" },
    "route8": { "path": "/_v/api/users/:id" },
    "route9": { "path": "/_v/api/categories" },
    "route10": { "path": "/_v/api/categories/:id" },
    "route11": { "path": "/_v/api/brands" },
    "route12": { "path": "/_v/api/inventory" }
  }
}
// 12 routes covering reviews, products, orders, users, categories,
// brands, and inventory — this should be 3-4 separate apps.
```

## Implementation Pattern

**The canonical, recommended way to build a VTEX IO service app.**

### Step 1: Define Custom Clients

Create clients extending the appropriate base class for each external service:

```typescript
// node/clients/catalogClient.ts
import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export class CatalogClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, {
      ...options,
      headers: {
        VtexIdclientAutCookie: context.authToken,
        ...options?.headers,
      },
    })
  }

  public async getProduct(productId: string): Promise<Product> {
    return this.http.get(`/api/catalog/pvt/product/${productId}`, {
      metric: 'catalog-get-product',
    })
  }

  public async listSkusByProduct(productId: string): Promise<Sku[]> {
    return this.http.get(`/api/catalog_system/pvt/sku/stockkeepingunitByProductId/${productId}`, {
      metric: 'catalog-list-skus',
    })
  }
}
```

### Step 2: Register Clients in IOClients

Create the Clients class that registers all custom clients:

```typescript
// node/clients/index.ts
import { IOClients } from '@vtex/api'
import { CatalogClient } from './catalogClient'
import { ReviewStorageClient } from './reviewStorageClient'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', CatalogClient)
  }

  public get reviewStorage() {
    return this.getOrSet('reviewStorage', ReviewStorageClient)
  }
}
```

### Step 3: Create Middlewares

Build middleware functions that use `ctx.clients` and `ctx.state`:

```typescript
// node/middlewares/getReviews.ts
import type { ServiceContext } from '@vtex/api'
import type { Clients } from '../clients'

type Context = ServiceContext<Clients>

export async function validateParams(ctx: Context, next: () => Promise<void>) {
  const { productId } = ctx.query

  if (!productId || typeof productId !== 'string') {
    ctx.status = 400
    ctx.body = { error: 'productId query parameter is required' }
    return
  }

  ctx.state.productId = productId
  await next()
}

export async function getReviews(ctx: Context, next: () => Promise<void>) {
  const { productId } = ctx.state
  const reviews = await ctx.clients.reviewStorage.getByProduct(productId)

  ctx.status = 200
  ctx.body = reviews
  await next()
}
```

### Step 4: Wire Everything in the Service Entry Point

```typescript
// node/index.ts
import type { ParamsContext, RecorderState } from '@vtex/api'
import { Service, method } from '@vtex/api'

import { Clients } from './clients'
import { validateParams, getReviews } from './middlewares/getReviews'
import { createReview } from './middlewares/createReview'
import { resolvers } from './resolvers'

export default new Service<Clients, RecorderState, ParamsContext>({
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 5000,
      },
      catalog: {
        retries: 3,
        timeout: 10000,
      },
    },
  },
  routes: {
    reviews: method({
      GET: [validateParams, getReviews],
      POST: [createReview],
    }),
  },
  graphql: {
    resolvers: {
      Query: resolvers.queries,
      Mutation: resolvers.mutations,
    },
  },
})
```

### Complete Example

Full project structure for a review service app:

```typescript
// node/clients/reviewStorageClient.ts
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

interface Review {
  id: string
  productId: string
  rating: number
  title: string
  text: string
  author: string
  createdAt: string
}

export class ReviewStorageClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://reviews-api.example.com', context, {
      ...options,
      headers: {
        Authorization: `Bearer ${context.authToken}`,
        ...options?.headers,
      },
    })
  }

  public async getByProduct(productId: string): Promise<Review[]> {
    return this.http.get(`/reviews?productId=${productId}`, {
      metric: 'review-storage-get-by-product',
    })
  }

  public async create(review: Omit<Review, 'id' | 'createdAt'>): Promise<Review> {
    return this.http.post('/reviews', review, {
      metric: 'review-storage-create',
    })
  }
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Using axios/fetch/got/node-fetch for HTTP Calls

**What happens**: Developers install `axios`, `node-fetch`, or `got` in the `node/package.json` and use them directly in middlewares to call external APIs or VTEX Commerce APIs.

**Why it fails**: These libraries bypass the entire VTEX IO infrastructure — no automatic auth token injection, no built-in caching, no retry logic, no timeout management, no metrics collection, and no billing tracking. Outbound requests may also be blocked by the VTEX IO firewall since they don't route through the proper infrastructure.

**Fix**: Create a custom client extending `ExternalClient` (for non-VTEX APIs) or `JanusClient` (for VTEX APIs), and access it via `ctx.clients`:

```typescript
// Instead of: import axios from 'axios'
// Create a proper client:
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class PaymentGatewayClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://gateway.payment.com', context, {
      ...options,
      headers: {
        'X-Gateway-Key': 'key',
        ...options?.headers,
      },
    })
  }

  public async charge(amount: number, currency: string): Promise<ChargeResult> {
    return this.http.post('/v1/charges', { amount, currency }, {
      metric: 'payment-gateway-charge',
    })
  }
}
```

---

### Anti-Pattern: Putting Business Logic in Clients

**What happens**: Developers put complex business logic (validation, transformation, orchestration) inside client classes instead of keeping clients as thin data-access layers.

**Why it fails**: Clients become bloated and hard to test. Business logic in clients couples your domain rules to the transport layer. When the external API changes, you must refactor both the communication and the business logic simultaneously.

**Fix**: Keep clients as thin wrappers around HTTP calls. Put business logic in middlewares or dedicated service functions:

```typescript
// Client: thin data access only
export class OrderClient extends JanusClient {
  public async getOrder(orderId: string): Promise<Order> {
    return this.http.get(`/api/oms/pvt/orders/${orderId}`, {
      metric: 'oms-get-order',
    })
  }
}

// Middleware: business logic lives here
export async function processOrderRefund(ctx: Context, next: () => Promise<void>) {
  const order = await ctx.clients.orders.getOrder(ctx.params.orderId)

  if (order.status !== 'invoiced') {
    ctx.status = 400
    ctx.body = { error: 'Only invoiced orders can be refunded' }
    return
  }

  const refundAmount = calculateRefund(order)
  await ctx.clients.payments.issueRefund(order.paymentId, refundAmount)

  ctx.status = 200
  ctx.body = { refundAmount }
  await next()
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Services](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) — Overview of VTEX IO backend service development
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — Native client list and client architecture overview
- [Developing Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-how-to-create-and-use-clients) — Step-by-step guide for creating custom JanusClient and ExternalClient
- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) — How to use @vtex/api and @vtex/clients in middlewares and resolvers
- [Calling Commerce APIs](https://developers.vtex.com/docs/guides/calling-commerce-apis-1-getting-the-service-app-boilerplate) — Tutorial for building a service app that calls VTEX Commerce APIs
- [Best Practices for Avoiding Rate Limits](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Why clients with caching prevent rate-limit issues
