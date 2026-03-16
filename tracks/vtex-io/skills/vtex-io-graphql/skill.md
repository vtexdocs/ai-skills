---
name: vtex-io-graphql
description: >
  Apply when working with GraphQL schema files in graphql/ or implementing resolvers in node/resolvers/ for
  VTEX IO apps. Covers schema.graphql definitions, @cacheControl and @auth directives, custom type definitions,
  and resolver registration in the Service class. Use for exposing data through GraphQL queries and mutations
  with proper cache control and authentication enforcement.
track: vtex-io
tags:
  - vtex-io
  - graphql
  - graphql-builder
  - resolvers
  - schema
  - cache-control
  - auth-directive
  - queries
  - mutations
globs:
  - "graphql/**/*.graphql"
  - "graphql/**/*.ts"
  - "node/resolvers/**/*.ts"
version: "1.0"
vtex_docs_verified: "2026-03-16"
---

# GraphQL Schemas & Resolvers

## Overview

**What this skill covers**: Implementing GraphQL APIs in VTEX IO apps using the `graphql` builder — defining schemas in `.graphql` files, writing resolver functions in TypeScript, configuring `@cacheControl` and `@auth` directives, organizing the `graphql/` directory, and wiring resolvers into the Service class.

**When to use it**: When your VTEX IO app needs to expose a GraphQL API — either for frontend React components to query, for other VTEX IO apps to consume, or for implementing custom data aggregation layers over VTEX Commerce APIs.

**What you'll learn**:
- How to structure the `graphql/` directory with schemas, directives, and types
- How to write resolver functions that use `ctx.clients` for data access
- How to use `@cacheControl` to optimize performance and `@auth` to enforce authentication
- How to instantiate resolvers in the Service entry point

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: GraphQL Builder and Directory Structure

The `graphql` builder processes `.graphql` files in the `/graphql` directory. The recommended structure is:

```text
graphql/
├── schema.graphql        # Query and Mutation root type definitions
├── directives.graphql    # Custom directive declarations (@cacheControl, @auth)
└── types/
    ├── Review.graphql    # Custom type definitions
    └── Product.graphql   # One file per type for organization
```

The builder merges all `.graphql` files into a single schema. You can split definitions across multiple files and subdirectories for maintainability.

### Concept 2: Schema Definition

The `schema.graphql` file defines the root Query and Mutation types — the entry points of your API:

```graphql
type Query {
  reviews(productId: String!, limit: Int): [Review]
    @cacheControl(scope: PUBLIC, maxAge: SHORT)

  review(id: ID!): Review
    @cacheControl(scope: PUBLIC, maxAge: SHORT)
}

type Mutation {
  createReview(review: ReviewInput!): Review @auth
  deleteReview(id: ID!): Boolean @auth
}
```

### Concept 3: Directives — @cacheControl and @auth

VTEX IO provides built-in GraphQL directives:

**`@cacheControl`** — Controls HTTP caching for queries:
- `scope`: `PUBLIC` (shared CDN cache) or `PRIVATE` (per-user cache)
- `maxAge`: `SHORT` (30s), `MEDIUM` (5min), `LONG` (1h)

**`@auth`** — Enforces authentication. The resolver only executes if the request includes a valid VTEX authentication token. Without `@auth`, unauthenticated users can call the endpoint.

**`@smartcache`** — Automatically caches query results in VTEX infrastructure.

These directives are declared in `directives.graphql`:

```graphql
directive @cacheControl(
  scope: CacheControlScope
  maxAge: CacheControlMaxAge
) on FIELD_DEFINITION

enum CacheControlScope {
  PUBLIC
  PRIVATE
}

enum CacheControlMaxAge {
  SHORT
  MEDIUM
  LONG
}

directive @auth on FIELD_DEFINITION
directive @smartcache on FIELD_DEFINITION
```

### Concept 4: Resolvers

Resolvers are TypeScript functions in the `/node/resolvers/` directory that execute when a GraphQL field is queried. Each resolver receives four arguments: `root`, `args`, `ctx`, and `info`. The `ctx` object provides access to `ctx.clients` for data fetching.

Resolvers are instantiated in the Service entry point (`node/index.ts`) inside the `graphql.resolvers` field:

```typescript
export default new Service({
  graphql: {
    resolvers: {
      Query: {
        reviews: getReviews,
        review: getReview,
      },
      Mutation: {
        createReview: createReview,
        deleteReview: deleteReview,
      },
    },
  },
})
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Declare the graphql Builder

**Rule**: Any app using `.graphql` schema files MUST declare the `graphql` builder in `manifest.json`. The `graphql` builder interprets the schema and registers it with the VTEX IO runtime.

**Why**: Without the `graphql` builder declaration, the `/graphql` directory is completely ignored. Schema files will not be processed, resolvers will not be registered, and GraphQL queries will return "schema not found" errors. The app will link without errors but GraphQL will silently not work.

**Detection**: If you see `.graphql` files in a `/graphql` directory but the manifest does not include `"graphql": "1.x"` in `builders`, STOP and add the builder declaration.

✅ **CORRECT**:
```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x"
  }
}
```

❌ **WRONG**:
```json
{
  "builders": {
    "node": "7.x"
  }
}
// Missing "graphql": "1.x" — the /graphql directory with schema files
// is ignored. GraphQL queries return errors because no schema is
// registered. The app links successfully, masking the problem.
```

---

### Constraint: Use @cacheControl on Public Queries

**Rule**: All public-facing Query fields (those fetching data that is not user-specific) MUST include the `@cacheControl` directive with an appropriate `scope` and `maxAge`. Mutations MUST NOT use `@cacheControl`.

**Why**: Without `@cacheControl`, every query hits your resolver on every request — no CDN caching, no edge caching, no shared caching. This leads to unnecessary load on VTEX infrastructure, slow response times for end users, and potential rate limiting. For public product data like reviews or catalog info, caching is critical for performance.

**Detection**: If a Query field returns public data (not user-specific) and does not have `@cacheControl`, warn the developer to add it. If a Mutation has `@cacheControl`, STOP and remove it.

✅ **CORRECT**:
```graphql
type Query {
  # Public product data — cached at CDN for 30 seconds
  reviews(productId: String!, limit: Int): [Review]
    @cacheControl(scope: PUBLIC, maxAge: SHORT)

  # Public catalog data — cached for 5 minutes
  productMetadata(slug: String!): ProductMetadata
    @cacheControl(scope: PUBLIC, maxAge: MEDIUM)

  # User-specific data — cached per-user only
  myReviews: [Review]
    @cacheControl(scope: PRIVATE, maxAge: SHORT)
    @auth
}

type Mutation {
  # Mutations NEVER have @cacheControl
  createReview(review: ReviewInput!): Review @auth
}
```

❌ **WRONG**:
```graphql
type Query {
  # No cache control — every request hits the resolver
  reviews(productId: String!, limit: Int): [Review]

  # Missing @auth on user-specific data
  myReviews: [Review]
}

type Mutation {
  # @cacheControl on a mutation — this makes no sense
  createReview(review: ReviewInput!): Review
    @cacheControl(scope: PUBLIC, maxAge: LONG)
}
```

---

### Constraint: Resolver Names Must Match Schema Fields

**Rule**: Resolver function keys in the Service entry point MUST exactly match the field names defined in `schema.graphql`. The resolver object structure must mirror the GraphQL type hierarchy.

**Why**: The GraphQL runtime maps incoming queries to resolver functions by name. If the resolver key does not match the schema field name, the field will resolve to `null` without any error — a silent failure that is extremely difficult to debug.

**Detection**: If a schema field has no matching resolver key (or vice versa), STOP. Cross-check every Query and Mutation field against the resolver registration in `node/index.ts`.

✅ **CORRECT**:
```graphql
# graphql/schema.graphql
type Query {
  reviews(productId: String!): [Review]
  reviewById(id: ID!): Review
}
```

```typescript
// node/index.ts — resolver keys match schema field names exactly
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

❌ **WRONG**:
```typescript
// node/index.ts — resolver key "getReviews" does not match schema field "reviews"
export default new Service({
  graphql: {
    resolvers: {
      Query: {
        getReviews: reviewsResolver,    // Wrong! Schema says "reviews", not "getReviews"
        getReviewById: reviewByIdResolver, // Wrong! Schema says "reviewById"
      },
    },
  },
})
// Both fields will silently resolve to null. No error in logs.
```

## Implementation Pattern

**The canonical, recommended way to build a GraphQL API in a VTEX IO app.**

### Step 1: Add the GraphQL Builder to Manifest

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x"
  }
}
```

### Step 2: Define the Schema

```graphql
# graphql/schema.graphql
type Query {
  reviews(productId: String!, limit: Int, offset: Int): ReviewsResponse
    @cacheControl(scope: PUBLIC, maxAge: SHORT)

  review(id: ID!): Review
    @cacheControl(scope: PUBLIC, maxAge: SHORT)
}

type Mutation {
  createReview(input: ReviewInput!): Review @auth
  updateReview(id: ID!, input: ReviewInput!): Review @auth
  deleteReview(id: ID!): Boolean @auth
}
```

### Step 3: Define Custom Types

```graphql
# graphql/types/Review.graphql
type Review {
  id: ID!
  productId: String!
  author: String!
  rating: Int!
  title: String!
  text: String!
  createdAt: String!
  approved: Boolean!
}

type ReviewsResponse {
  data: [Review!]!
  total: Int!
  hasMore: Boolean!
}

input ReviewInput {
  productId: String!
  rating: Int!
  title: String!
  text: String!
}
```

### Step 4: Declare Directives

```graphql
# graphql/directives.graphql
directive @cacheControl(
  scope: CacheControlScope
  maxAge: CacheControlMaxAge
) on FIELD_DEFINITION

enum CacheControlScope {
  PUBLIC
  PRIVATE
}

enum CacheControlMaxAge {
  SHORT
  MEDIUM
  LONG
}

directive @auth on FIELD_DEFINITION
directive @smartcache on FIELD_DEFINITION
```

### Step 5: Implement Resolvers

```typescript
// node/resolvers/reviews.ts
import type { ServiceContext } from '@vtex/api'
import type { Clients } from '../clients'

type Context = ServiceContext<Clients>

export const queries = {
  reviews: async (
    _root: unknown,
    args: { productId: string; limit?: number; offset?: number },
    ctx: Context
  ) => {
    const { productId, limit = 10, offset = 0 } = args
    const reviews = await ctx.clients.masterdata.searchDocuments<Review>({
      dataEntity: 'reviews',
      fields: ['id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved'],
      where: `productId=${productId} AND approved=true`,
      pagination: { page: Math.floor(offset / limit) + 1, pageSize: limit },
      schema: 'review-schema-v1',
    })

    return {
      data: reviews,
      total: reviews.length,
      hasMore: reviews.length === limit,
    }
  },

  review: async (
    _root: unknown,
    args: { id: string },
    ctx: Context
  ) => {
    return ctx.clients.masterdata.getDocument<Review>({
      dataEntity: 'reviews',
      id: args.id,
      fields: ['id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved'],
    })
  },
}

export const mutations = {
  createReview: async (
    _root: unknown,
    args: { input: ReviewInput },
    ctx: Context
  ) => {
    const { input } = args

    const documentResponse = await ctx.clients.masterdata.createDocument({
      dataEntity: 'reviews',
      fields: {
        ...input,
        author: ctx.vtex.storeUserEmail ?? 'anonymous',
        approved: false,
        createdAt: new Date().toISOString(),
      },
      schema: 'review-schema-v1',
    })

    return ctx.clients.masterdata.getDocument<Review>({
      dataEntity: 'reviews',
      id: documentResponse.DocumentId,
      fields: ['id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved'],
    })
  },

  deleteReview: async (
    _root: unknown,
    args: { id: string },
    ctx: Context
  ) => {
    await ctx.clients.masterdata.deleteDocument({
      dataEntity: 'reviews',
      id: args.id,
    })

    return true
  },
}
```

### Step 6: Wire Resolvers into the Service

```typescript
// node/index.ts
import type { ParamsContext, RecorderState } from '@vtex/api'
import { Service } from '@vtex/api'

import { Clients } from './clients'
import { queries, mutations } from './resolvers/reviews'

export default new Service<Clients, RecorderState, ParamsContext>({
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 5000,
      },
    },
  },
  graphql: {
    resolvers: {
      Query: queries,
      Mutation: mutations,
    },
  },
})
```

### Complete Example

Testing the GraphQL API after linking:

```graphql
# Query in GraphiQL at https://{workspace}--{account}.myvtex.com/_v/graphql
query GetReviews {
  reviews(productId: "12345", limit: 5) {
    data {
      id
      author
      rating
      title
      text
      createdAt
    }
    total
    hasMore
  }
}

mutation CreateReview {
  createReview(input: {
    productId: "12345"
    rating: 5
    title: "Excellent product"
    text: "Really happy with this purchase."
  }) {
    id
    author
    createdAt
  }
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Defining Resolvers Without Matching Schema Fields

**What happens**: Developers write resolver functions but forget to define the corresponding fields in the GraphQL schema, or use different names.

**Why it fails**: The GraphQL runtime only exposes fields defined in the schema. Resolvers without matching schema fields are silently ignored. Conversely, schema fields without resolvers return `null`.

**Fix**: Always define the schema first, then implement matching resolvers. Keep resolver keys identical to schema field names:

```typescript
// Schema defines: reviews, review, createReview
// Resolvers must use the same names:
export default new Service({
  graphql: {
    resolvers: {
      Query: {
        reviews: reviewsResolver,      // matches schema
        review: reviewResolver,        // matches schema
      },
      Mutation: {
        createReview: createResolver,  // matches schema
      },
    },
  },
})
```

---

### Anti-Pattern: Querying External APIs Directly in Resolvers

**What happens**: Developers use `fetch()` or `axios` directly inside resolver functions to call VTEX Commerce APIs or external services.

**Why it fails**: This bypasses the `@vtex/api` client system, losing caching, retries, metrics, and authentication. See the vtex-io-service-apps skill for details on why `ctx.clients` is mandatory.

**Fix**: Always use `ctx.clients` in resolvers. Create custom clients for any external service:

```typescript
// CORRECT: Using ctx.clients in a resolver
export const queries = {
  productDetails: async (_root: unknown, args: { id: string }, ctx: Context) => {
    return ctx.clients.catalog.getProduct(args.id)
  },
}
```

---

### Anti-Pattern: Missing @auth on Mutation Endpoints

**What happens**: Developers create mutation endpoints (create, update, delete) without the `@auth` directive.

**Why it fails**: Without `@auth`, any anonymous user can call the mutation. This means anyone can create, modify, or delete data without authentication — a critical security vulnerability.

**Fix**: Always add `@auth` to mutations and to queries that return sensitive or user-specific data:

```graphql
type Mutation {
  createReview(input: ReviewInput!): Review @auth
  updateReview(id: ID!, input: ReviewInput!): Review @auth
  deleteReview(id: ID!): Boolean @auth
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [GraphQL in VTEX IO](https://developers.vtex.com/docs/guides/graphql-in-vtex-io) — Overview of GraphQL usage in the VTEX IO platform
- [GraphQL Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-graphql-builder) — Builder reference for schema processing and directory structure
- [Developing a GraphQL API in Service Apps](https://developers.vtex.com/docs/guides/developing-a-graphql-api-in-service-apps) — Step-by-step tutorial for building GraphQL APIs
- [Integrating an App with a GraphQL API](https://developers.vtex.com/docs/guides/integrating-an-app-with-a-graphql-api) — How to consume GraphQL APIs from other VTEX IO apps
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — How to use ctx.clients in resolvers for data access
