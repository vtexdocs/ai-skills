---
name: vtex-io-graphql-api
description: Apply when deciding, designing, or implementing GraphQL APIs in VTEX IO apps, including schema files in graphql/ and resolvers in node/resolvers/. Covers when GraphQL is the right mechanism, schema and resolver contracts, cache and auth directives, and resolver registration in the Service class.
metadata:
  track: vtex-io
  tags:
    - vtex-io
    - graphql
    - graphql-builder
    - resolvers
    - schema
    - cache
    - auth
  globs:
    - "graphql/**/*.graphql"
    - "node/resolvers/**/*.ts"
    - "node/index.ts"
  version: "1.0"
  purpose: Decide when to expose GraphQL APIs in VTEX IO and how to implement them safely
  applies_to:
    - GraphQL schema design
    - resolver implementation
    - frontend or app data consumption
  excludes:
    - webhooks
    - callbacks
    - machine-to-machine integrations better served by HTTP routes
  decision_scope:
    - graphql-vs-http-route
    - auth-strategy
    - cache-strategy
    - schema-resolver-contract
---

# GraphQL API Design & Implementation

## When this skill applies

Use this skill when a VTEX IO app needs to expose a GraphQL API for:
- storefront React components
- other VTEX IO apps
- structured frontend or app data consumption
- typed aggregation layers over VTEX or external services

Do not use this skill as the default choice for:
- webhooks
- callbacks
- asynchronous notifications
- machine-to-machine integrations that are better represented as HTTP routes

## Decision rules

- Use GraphQL when the consumer is frontend or app code that benefits from structured querying.
- Prefer HTTP routes for webhooks, callbacks, and integration-style endpoints.
- Do not introduce GraphQL only for convenience if a route is simpler and more explicit.
- Use GraphQL as a typed aggregation layer, not as the default transport for every backend capability.

## Hard constraints

### Constraint: Declare the `graphql` builder

Any app using `.graphql` files must declare the `graphql` builder in `manifest.json`.

**Why this matters**
Without the builder, the `/graphql` directory is ignored. The app may link successfully, but the schema will not be processed and GraphQL queries will fail at runtime.

**Detection**
If `.graphql` files exist but `manifest.json` does not declare the supported `graphql` builder version for the app context, stop and add the builder.

**Correct**
```json
{
  "builders": {
    "node": "7.x",
    "graphql": "2.x"
  }
}
```

**Wrong**

```json
{
  "builders": {
    "node": "7.x"
  }
}
```

### Constraint: Resolver names must match schema field names

Resolver keys in the `Service` configuration must exactly match the field names defined in the GraphQL schema.

**Why this matters**
GraphQL resolves fields by name. If the resolver key does not match the schema field, the field can resolve to `null` with no obvious error.

**Detection**
Cross-check every `Query` and `Mutation` field against resolver registration in `node/index.ts`.

**Correct**

```graphql
type Query {
  reviews(productId: String!): [Review]
  reviewById(id: ID!): Review
}
```

```typescript
export default new Service({
  graphql: {
    resolvers: {
      Query: {
        reviews: reviewsResolver,
        reviewById: reviewByIdResolver,
      },
    },
  },
})
```

**Wrong**

```typescript
export default new Service({
  graphql: {
    resolvers: {
      Query: {
        getReviews: reviewsResolver,
        getReviewById: reviewByIdResolver,
      },
    },
  },
})
```

### Constraint: Use ctx.clients inside resolvers

Resolvers must access VTEX and external services through registered clients in `ctx.clients`.

**Why this matters**
This preserves the VTEX IO runtime contract for authentication context, retries, timeout configuration, metrics, and supported client behavior.

**Detection**
If a resolver imports `axios`, uses raw `fetch`, or instantiates clients directly with `new`, stop and move the integration into registered clients.

**Correct**

```typescript
export const queries = {
  productDetails: async (_root: unknown, args: { id: string }, ctx: Context) => {
    return ctx.clients.catalog.getProduct(args.id)
  },
}
```

**Wrong**

```typescript
import axios from 'axios'

export const queries = {
  productDetails: async (_root: unknown, args: { id: string }) => {
    const response = await axios.get(`/api/catalog/pvt/product/${args.id}`)
    return response.data
  },
}
```

### Constraint: Declare `@auth` on every Query and Mutation

With the `graphql` builder `2.x`, every `Query` and `Mutation` must declare `@auth` explicitly.

**Why this matters**
The active `graphql` builder requires authorization metadata on operations. Public operations still need `@auth(scope: PUBLIC)`, while protected operations need `@auth(scope: PRIVATE, productCode: "66", resourceCode: "workspace-read-write")` or another valid License Manager resource pair for the use case. If `@auth` is omitted or declared incompletely, schema validation can fail before runtime.

**Detection**
If any `Query` or `Mutation` is missing `@auth`, stop and add it. If an operation is protected but lacks `scope: PRIVATE` or the needed `productCode` and `resourceCode`, stop and complete the directive. Treat `productCode: "66"` with `resourceCode: "workspace-read-write"` as a documented example pair, and replace it with the actual License Manager resource configured for the app when implementing production code.

**Correct**

```graphql
type Query {
  myReviews: [Review]
    @cacheControl(scope: PRIVATE, maxAge: SHORT)
    @auth(scope: PRIVATE, productCode: "66", resourceCode: "workspace-read-write")

  productMetadata(slug: String!): ProductMetadata
    @cacheControl(scope: PUBLIC, maxAge: MEDIUM)
    @auth(scope: PUBLIC)
}

type Mutation {
  createReview(input: ReviewInput!): Review
    @auth(scope: PRIVATE, productCode: "66", resourceCode: "workspace-read-write")

  deleteReview(id: ID!): Boolean
    @auth(scope: PRIVATE, productCode: "66", resourceCode: "workspace-read-write")
}
```

**Wrong**

```graphql
type Query {
  myReviews: [Review]

  productMetadata(slug: String!): ProductMetadata
    @cacheControl(scope: PUBLIC, maxAge: MEDIUM)
}

type Mutation {
  deleteReview(id: ID!): Boolean @auth
}
```

### Constraint: Define cache strategy explicitly for queries

Queries should define cache behavior explicitly. `Mutation` fields must not be cached.

**Why this matters**
Queries without an explicit cache strategy may generate unnecessary resolver load and slower responses. VTEX supports three cache scopes: `PUBLIC` for data shared across users, `SEGMENT` for data that varies by shopper segment, and `PRIVATE` for per-user data. `Mutation` fields are not cacheable operations.

**Detection**
If a `Query` lacks an explicit cache strategy, choose the narrowest correct scope and set `maxAge`. Use `PUBLIC` for shared catalog-like data, `SEGMENT` when the response varies by region, audience, or sales channel, and `PRIVATE` for user-specific data. If a `Mutation` has cache directives, remove them.

**Correct**

```graphql
type Query {
  reviews(productId: String!, limit: Int): [Review]
    @cacheControl(scope: PUBLIC, maxAge: SHORT)
    @auth(scope: PUBLIC)

  pricePreview(skuId: ID!): PricePreview
    @cacheControl(scope: SEGMENT, maxAge: SHORT)
    @auth(scope: PUBLIC)

  myReviews: [Review]
    @cacheControl(scope: PRIVATE, maxAge: SHORT)
    @auth(scope: PRIVATE, productCode: "66", resourceCode: "workspace-read-write")
}

type Mutation {
  createReview(input: ReviewInput!): Review
    @auth(scope: PRIVATE, productCode: "66", resourceCode: "workspace-read-write")
}
```

**Wrong**

```graphql
type Query {
  reviews(productId: String!, limit: Int): [Review]
}

type Mutation {
  createReview(input: ReviewInput!): Review
    @cacheControl(scope: PUBLIC, maxAge: LONG)
}
```

## Preferred pattern

Recommended file layout:

```
graphql/
├── schema.graphql
├── directives.graphql
└── types/
    └── Review.graphql

node/
├── resolvers/
│   └── reviews.ts
└── index.ts
```

Minimal manifest pattern:

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "2.x"
  }
}
```

Use the `graphql` builder version supported by the project or the documented VTEX standard for the target app. The examples below use `2.x`.

Minimal schema pattern:

```graphql
type Query {
  reviews(productId: String!, limit: Int): [Review]
    @cacheControl(scope: PUBLIC, maxAge: SHORT)
    @auth(scope: PUBLIC)
}

type Mutation {
  createReview(input: ReviewInput!): Review
    @auth(scope: PRIVATE, productCode: "66", resourceCode: "workspace-read-write")
}
```

Replace the example `productCode` and `resourceCode` values with the actual License Manager resource configured for the app.

Minimal directive usage example:

```graphql
type Query {
  productMetadata(slug: String!): ProductMetadata
    @cacheControl(scope: PUBLIC, maxAge: MEDIUM)
    @auth(scope: PUBLIC)

  regionalPrice(skuId: ID!): PricePreview
    @cacheControl(scope: SEGMENT, maxAge: SHORT)
    @auth(scope: PUBLIC)

  myAccountData: AccountData
    @cacheControl(scope: PRIVATE, maxAge: SHORT)
    @auth(scope: PRIVATE, productCode: "66", resourceCode: "workspace-read-write")
}
```

Minimal resolver pattern:

```typescript
import type { ServiceContext } from '@vtex/api'
import type { Clients } from '../clients'

type Context = ServiceContext<Clients>

export const queries = {
  reviews: async (
    _root: unknown,
    args: { productId: string },
    ctx: Context
  ) => {
    return ctx.clients.reviews.getByProduct(args.productId)
  },
}
```

Minimal Service registration pattern:

```typescript
import { Service } from '@vtex/api'
import { Clients } from './clients'
import { queries, mutations } from './resolvers/reviews'

export default new Service({
  clients: {
    implementation: Clients,
  },
  graphql: {
    resolvers: {
      Query: queries,
      Mutation: mutations,
    },
  },
})
```

## Common failure modes
- GraphQL is chosen when an HTTP route would be a better fit.
- The app links successfully, but GraphQL does not work because the builder is missing.
- A field resolves to `null` because the resolver key does not match the schema field.
- The resolver works, but the integration is fragile because it bypasses `ctx.clients`.
- A `Query` or `Mutation` fails schema validation because `@auth` is missing or incomplete for the `graphql` builder `2.x`.
- A `Query` is left without an explicit cache strategy, or a `Mutation` is incorrectly cached.

## Review checklist
- [ ] Is GraphQL really the correct mechanism here?
- [ ] Is the `graphql` builder declared?
- [ ] Do schema field names and resolver keys match exactly?
- [ ] Are resolvers using `ctx.clients` instead of raw HTTP libraries?
- [ ] Does every `Query` and `Mutation` declare `@auth` with the correct scope?
- [ ] Is the cache strategy defined explicitly for every `Query`, and absent from every `Mutation`?
- [ ] Do private operations include a valid `productCode` and `resourceCode` pair?
- [ ] Is GraphQL being used for frontend/app consumption rather than integration-only flows?

## Reference
- [GraphQL in VTEX IO](https://developers.vtex.com/docs/guides/graphql-in-vtex-io) — Overview of GraphQL usage in the VTEX IO platform
- [GraphQL Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-graphql-builder) — Builder reference for schema processing and directory structure
- [Developing a GraphQL API in Service Apps](https://developers.vtex.com/docs/guides/developing-a-graphql-api-in-service-apps) — Step-by-step tutorial for building GraphQL APIs
- [Integrating an App with a GraphQL API](https://developers.vtex.com/docs/guides/integrating-an-app-with-a-graphql-api) — How to consume GraphQL APIs from other VTEX IO apps
- [GraphQL authorization in IO apps](https://developers.vtex.com/docs/guides/graphql-authorization-in-io-apps) — How to implement and use the `@auth` directive for protected GraphQL operations
- [VTEX IO Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — How to use ctx.clients in resolvers for data access

 
