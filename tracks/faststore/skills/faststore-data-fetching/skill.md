---
name: faststore-data-fetching
description: >
  Apply when working with FastStore GraphQL files in src/graphql/ or src/fragments/, or configuring
  faststore.config. Covers API extensions, GraphQL fragments, server-side and client-side data fetching,
  and custom resolver patterns. Use for integrating custom data sources or extending the FastStore GraphQL schema.
track: faststore
tags:
  - faststore
  - graphql
  - api
  - data-fetching
  - fragments
  - api-extensions
  - resolvers
globs:
  - "src/graphql/**/*.{ts,tsx}"
  - "src/fragments/**/*.ts"
  - "faststore.config.*"
version: "1.0"
vtex_docs_verified: "2026-03-16"
---

# FastStore Data Layer & API Integration

## Overview

**What this skill covers**: FastStore's GraphQL-based data layer, including the FastStore API, API extensions for VTEX and third-party data, GraphQL fragments for extending queries, and patterns for consuming data in components. The FastStore API sits between the storefront and the VTEX platform, exposing product, cart, session, and search data via a GraphQL schema.

**When to use it**: When you need to fetch product data, extend existing queries with additional fields, integrate third-party APIs, or add custom data to FastStore pages. Use this skill whenever you need data beyond what native FastStore components display by default.

**What you'll learn**:
- How the FastStore API GraphQL layer works and its predefined queries
- How to extend VTEX API schemas with custom types and resolvers
- How to extend third-party API schemas for external data
- How to use GraphQL fragments to add fields to existing queries
- How to consume extended data in custom components

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: FastStore API as the Data Gateway

The FastStore API is a GraphQL layer that serves as the interface between your storefront and the VTEX commerce platform. It provides type-safe queries for products, collections, search, cart, and session. All catalog data displayed on the storefront flows through this API. The API is designed for performance — it exposes only the fields needed for common ecommerce pages and supports GraphQL's selective field retrieval to avoid over-fetching.

### Concept 2: API Extensions (VTEX and Third-Party)

When the native FastStore API schema doesn't include data you need, you can extend it. There are two extension paths:
- **VTEX API extensions**: Access VTEX platform data not exposed by default (e.g., custom product fields, installment details). These go in `src/graphql/vtex/` with `typeDefs/` and `resolvers/` subdirectories.
- **Third-party API extensions**: Integrate external data sources (e.g., reviews, ratings, inventory from external systems). These go in `src/graphql/thirdParty/` with the same subdirectory structure.

Both follow GraphQL conventions: you define type definitions (schema) and resolvers (data fetching logic).

### Concept 3: GraphQL Fragments for Query Extension

FastStore uses predefined queries (e.g., `ServerProduct`, `ClientProductGallery`, `ClientManyProducts`) that components consume. To add fields to these queries, you create GraphQL fragments in `src/fragments/`. Fragments come in two types:
- **Server fragments** (`ServerProduct.ts`): Execute on the server during SSR. Used for data that should be available at page load.
- **Client fragments** (`ClientProduct.ts`): Execute on the client. Used for data that can load after the initial render.

Fragments use the `gql` function from `@faststore/core/api` to define the additional fields.

**Architecture/Data Flow**:
```text
VTEX Commerce Platform
  ↓
FastStore API (GraphQL)  ←  src/graphql/vtex/ (VTEX extensions)
  ↓                      ←  src/graphql/thirdParty/ (Third-party extensions)
  ↓
Predefined Queries  ←  src/fragments/ (Query extensions via fragments)
  ↓
React Components  ←  usePage(), useProductsQuery(), custom hooks
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Use the GraphQL Layer for Catalog Data

**Rule**: MUST use the FastStore GraphQL API for fetching catalog data (products, collections, search results, prices). MUST NOT make direct REST calls to VTEX Catalog APIs (`/api/catalog/`, `/api/catalog_system/`) from client-side code.

**Why**: The FastStore API handles authentication, caching, request batching, and data normalization. Direct REST calls bypass all of these optimizations and expose your VTEX domain structure to the browser. They also create CORS issues, duplicate data fetching logic, and miss the type safety that GraphQL provides. Server-side REST calls to VTEX APIs are acceptable in GraphQL resolvers — that's exactly what API extensions are for.

**Detection**: If you see `fetch('https://{account}.vtexcommercestable.com.br/api/catalog')` or `fetch('https://{account}.myvtex.com/api/catalog')` in client-side code (components, hooks, useEffect) → warn that this bypasses the GraphQL layer. If it's in a file under `src/graphql/` resolvers → this is acceptable (that's the API extension pattern). If you see `axios` or `fetch` with VTEX API paths in any file under `src/components/` or `src/pages/` → STOP and refactor to use the GraphQL API.

✅ **CORRECT**:
```typescript
// src/graphql/vtex/resolvers/product.ts
// Server-side resolver — REST calls to VTEX APIs are correct here
import type { Resolver } from '@faststore/api'

const productResolver: Record<string, Resolver> = {
  StoreProduct: {
    customAttribute: async (root, _args, context) => {
      // Server-side: safe to call VTEX REST APIs in resolvers
      const response = await context.clients.commerce.catalog.getProduct(
        root.productID
      )
      return response.customAttribute
    },
  },
}

export default productResolver
```

❌ **WRONG**:
```typescript
// src/components/ProductCustomData.tsx
// WRONG: Direct REST call to VTEX Catalog API from a client component
import React, { useEffect, useState } from 'react'

interface ProductCustomDataProps {
  productId: string
}

export default function ProductCustomData({ productId }: ProductCustomDataProps) {
  const [data, setData] = useState(null)

  useEffect(() => {
    // WRONG: Direct REST call from the browser
    // This exposes the VTEX domain, bypasses caching, and creates CORS issues.
    fetch(`https://mystore.vtexcommercestable.com.br/api/catalog/pvt/product/${productId}`)
      .then((res) => res.json())
      .then(setData)
  }, [productId])

  return <div>{data?.Name}</div>
}
```

---

### Constraint: Never Expose API Keys in Client-Side Code

**Rule**: MUST NOT include VTEX API keys (`VTEX_APP_KEY`, `VTEX_APP_TOKEN`) or any secret credentials in client-side code, environment variables prefixed with `NEXT_PUBLIC_`, or any file that gets bundled into the browser.

**Why**: API keys in client-side code are visible to anyone who inspects the page source or network requests. VTEX API keys provide access to catalog management, order processing, and account administration. Exposed keys can be used to modify products, access customer data, or disrupt store operations. This is a critical security vulnerability.

**Detection**: If you see `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `X-VTEX-API-AppKey`, or `X-VTEX-API-AppToken` in any file under `src/components/`, `src/pages/`, or any file that runs in the browser → STOP immediately. This is a critical security issue. If you see `NEXT_PUBLIC_VTEX_APP_KEY` or `NEXT_PUBLIC_VTEX_APP_TOKEN` in `.env` files → STOP immediately. The `NEXT_PUBLIC_` prefix makes these values available in the browser bundle. If you see `process.env.VTEX_APP_KEY` in client-side code → STOP. While Next.js won't expose non-prefixed env vars to the client, the intent suggests a misunderstanding that may lead to the `NEXT_PUBLIC_` prefix being added later.

✅ **CORRECT**:
```typescript
// src/graphql/vtex/resolvers/installments.ts
// API keys are used ONLY in server-side resolvers, accessed via context
import type { Resolver } from '@faststore/api'

const installmentResolver: Record<string, Resolver> = {
  StoreProduct: {
    availableInstallments: async (root, _args, context) => {
      // context.clients handles authentication automatically
      // No API keys are hardcoded or exposed
      const product = await context.clients.commerce.catalog.getProduct(
        root.productID
      )

      const installments = product.items?.[0]?.sellers?.[0]?.commertialOffer?.Installments || []

      return installments.map((inst: any) => ({
        count: inst.NumberOfInstallments,
        value: inst.Value,
        totalValue: inst.TotalValuePlusInterestRate,
        interestRate: inst.InterestRate,
      }))
    },
  },
}

export default installmentResolver
```

❌ **WRONG**:
```typescript
// src/components/ProductInstallments.tsx
// CRITICAL SECURITY ISSUE: API keys exposed in client-side code
import React, { useEffect, useState } from 'react'

export default function ProductInstallments({ productId }: { productId: string }) {
  const [installments, setInstallments] = useState([])

  useEffect(() => {
    fetch(`https://mystore.vtexcommercestable.com.br/api/catalog/pvt/product/${productId}`, {
      headers: {
        // CRITICAL: These keys are now visible to EVERY visitor of your site.
        // Anyone can extract them from the browser's network tab.
        'X-VTEX-API-AppKey': 'vtexappkey-mystore-ABCDEF',
        'X-VTEX-API-AppToken': 'very-secret-token-12345',
      },
    })
      .then((res) => res.json())
      .then((data) => setInstallments(data.Installments))
  }, [productId])

  return <div>{installments.length} installments available</div>
}
```

---

### Constraint: Follow the API Extension Directory Structure

**Rule**: MUST place API extension files in the correct directory structure: `src/graphql/vtex/` for VTEX API extensions and `src/graphql/thirdParty/` for third-party API extensions. Each must contain `typeDefs/` and `resolvers/` subdirectories.

**Why**: FastStore's build system discovers and compiles API extensions from these specific directories. Files placed elsewhere will not be included in the GraphQL schema and resolvers will not execute. There will be no error at build time — the extended fields simply won't exist, causing runtime GraphQL errors when components try to query them.

**Detection**: If you see GraphQL type definitions (`.graphql` files) or resolver files outside of `src/graphql/vtex/` or `src/graphql/thirdParty/` → warn that they will not be discovered by the build system. If the `typeDefs/` or `resolvers/` subdirectory is missing → warn about incorrect structure.

✅ **CORRECT**:
```typescript
// Directory structure for VTEX API extension:
// src/graphql/vtex/typeDefs/product.graphql
// src/graphql/vtex/resolvers/product.ts
// src/graphql/vtex/resolvers/index.ts

// src/graphql/vtex/typeDefs/product.graphql
type StoreProduct {
  availableInstallments: [Installment]
}

type Installment {
  count: Int
  value: Float
  totalValue: Float
  interestRate: Float
}
```

```typescript
// src/graphql/vtex/resolvers/product.ts
import type { Resolver } from '@faststore/api'

const productResolver: Record<string, Resolver> = {
  StoreProduct: {
    availableInstallments: async (root, _args, context) => {
      const product = await context.clients.commerce.catalog.getProduct(
        root.productID
      )
      const installments =
        product.items?.[0]?.sellers?.[0]?.commertialOffer?.Installments || []

      return installments.map((inst: any) => ({
        count: inst.NumberOfInstallments,
        value: inst.Value,
        totalValue: inst.TotalValuePlusInterestRate,
        interestRate: inst.InterestRate,
      }))
    },
  },
}

export default productResolver
```

```typescript
// src/graphql/vtex/resolvers/index.ts
import { default as StoreProductResolver } from './product'

const resolvers = {
  ...StoreProductResolver,
}

export default resolvers
```

❌ **WRONG**:
```typescript
// WRONG: Resolver placed in src/api/ instead of src/graphql/vtex/resolvers/
// src/api/resolvers/product.ts
// This file will NOT be discovered by FastStore's build system.
// The GraphQL schema will NOT include the extended fields.
// Components querying these fields will get runtime errors.

const productResolver = {
  StoreProduct: {
    availableInstallments: async (root: any) => {
      return []
    },
  },
}

export default productResolver
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Define the GraphQL type definitions

Create the type definition file that extends the existing schema:

```typescript
// src/graphql/vtex/typeDefs/product.graphql
// Extend StoreProduct with installment data from VTEX
type StoreProduct {
  availableInstallments: [Installment]
}

type Installment {
  count: Int!
  value: Float!
  totalValue: Float!
  interestRate: Float!
}
```

### Step 2: Create the resolver

Create the resolver that fetches the data from the VTEX API:

```typescript
// src/graphql/vtex/resolvers/product.ts
import type { Resolver } from '@faststore/api'

const productResolver: Record<string, Resolver> = {
  StoreProduct: {
    availableInstallments: async (root, _args, context) => {
      const product = await context.clients.commerce.catalog.getProduct(
        root.productID
      )

      const installments =
        product.items?.[0]?.sellers?.[0]?.commertialOffer?.Installments || []

      return installments.map((inst: any) => ({
        count: inst.NumberOfInstallments,
        value: inst.Value,
        totalValue: inst.TotalValuePlusInterestRate,
        interestRate: inst.InterestRate,
      }))
    },
  },
}

export default productResolver
```

### Step 3: Create the resolver index

Export all resolvers from a single index file:

```typescript
// src/graphql/vtex/resolvers/index.ts
import { default as StoreProductResolver } from './product'

const resolvers = {
  ...StoreProductResolver,
}

export default resolvers
```

### Step 4: Create fragments to include the new data in queries

Add fragments to request the new fields in existing queries:

```typescript
// src/fragments/ServerProduct.ts
// Server-side fragment — data is available at SSR time
import { gql } from '@faststore/core/api'

export const fragment = gql(`
  fragment ServerProduct on Query {
    product(locator: $locator) {
      availableInstallments {
        count
        value
        totalValue
        interestRate
      }
    }
  }
`)
```

```typescript
// src/fragments/ClientProduct.ts
// Client-side fragment — for data that can load after initial render
import { gql } from '@faststore/core/api'

export const fragment = gql(`
  fragment ClientProduct on Query {
    product(locator: $locator) {
      availableInstallments {
        count
        value
        totalValue
        interestRate
      }
    }
  }
`)
```

### Complete Example

Full API extension: adding installment information to the Product Details Page.

```typescript
// 1. Type definitions
// src/graphql/vtex/typeDefs/product.graphql
type StoreProduct {
  availableInstallments: [Installment]
}

type Installment {
  count: Int!
  value: Float!
  totalValue: Float!
  interestRate: Float!
}
```

```typescript
// 2. Resolver
// src/graphql/vtex/resolvers/product.ts
import type { Resolver } from '@faststore/api'

const productResolver: Record<string, Resolver> = {
  StoreProduct: {
    availableInstallments: async (root, _args, context) => {
      const product = await context.clients.commerce.catalog.getProduct(
        root.productID
      )
      const installments =
        product.items?.[0]?.sellers?.[0]?.commertialOffer?.Installments || []

      return installments.map((inst: any) => ({
        count: inst.NumberOfInstallments,
        value: inst.Value,
        totalValue: inst.TotalValuePlusInterestRate,
        interestRate: inst.InterestRate,
      }))
    },
  },
}

export default productResolver
```

```typescript
// 3. Resolver index
// src/graphql/vtex/resolvers/index.ts
import { default as StoreProductResolver } from './product'

const resolvers = {
  ...StoreProductResolver,
}

export default resolvers
```

```typescript
// 4. Server fragment
// src/fragments/ServerProduct.ts
import { gql } from '@faststore/core/api'

export const fragment = gql(`
  fragment ServerProduct on Query {
    product(locator: $locator) {
      availableInstallments {
        count
        value
        totalValue
        interestRate
      }
    }
  }
`)
```

```typescript
// 5. Component consuming the extended data
// src/components/ProductInstallments.tsx
import React from 'react'
import { usePage } from '@faststore/core'
import type { PDPContext } from '@faststore/core'
import { useSession } from '@faststore/sdk'

interface Installment {
  count: number
  value: number
  totalValue: number
  interestRate: number
}

export default function ProductInstallments() {
  const context = usePage<PDPContext>()
  const { currency, locale } = useSession()

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.code,
  })

  const installments: Installment[] =
    (context as any)?.data?.product?.availableInstallments || []

  if (installments.length === 0) {
    return null
  }

  // Find the best installment option (most installments with 0% interest)
  const bestNoInterest = installments
    .filter((inst) => inst.interestRate === 0)
    .sort((a, b) => b.count - a.count)[0]

  const bestOverall = installments.sort((a, b) => b.count - a.count)[0]

  return (
    <div data-fs-installments>
      {bestNoInterest && (
        <p data-fs-installment-highlight>
          <strong>{bestNoInterest.count}x</strong> of{' '}
          <strong>{formatter.format(bestNoInterest.value)}</strong> interest-free
        </p>
      )}
      {bestOverall && bestOverall.count !== bestNoInterest?.count && (
        <p data-fs-installment-option>
          or {bestOverall.count}x of {formatter.format(bestOverall.value)}
          {bestOverall.interestRate > 0 &&
            ` (${bestOverall.interestRate}% interest)`}
        </p>
      )}
    </div>
  )
}
```

```typescript
// 6. Use in an override to add installments to the ProductDetails section
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

import ProductInstallments from '../ProductInstallments'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    // Add installment info below the price (using an overridable slot)
    __experimentalProductInstallments: { Component: ProductInstallments },
  },
})

export default OverriddenProductDetails
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Direct REST Calls from the Browser

**What happens**: Developer uses `fetch()` or `axios` in React components to call VTEX REST APIs directly (e.g., `/api/catalog/pvt/product/`, `/api/checkout/pub/orderForm/`) instead of using the FastStore GraphQL API.

**Why it fails**: Direct REST calls from the browser create CORS issues (VTEX APIs don't allow cross-origin requests from storefronts by default). They bypass FastStore's caching layer, causing redundant requests and slower page loads. They expose the VTEX account name and API structure to the client. Private API endpoints (`/pvt/`) require authentication headers that cannot be safely included in client-side code.

**Fix**: Use the GraphQL API for all data needs. If the data isn't available in the default schema, extend the API with custom types and resolvers in `src/graphql/vtex/`. The resolver executes on the server where it can safely call VTEX REST APIs.

```typescript
// Create an API extension to access the data server-side:
// src/graphql/vtex/resolvers/customData.ts
import type { Resolver } from '@faststore/api'

const customDataResolver: Record<string, Resolver> = {
  StoreProduct: {
    specifications: async (root, _args, context) => {
      // Server-side: safe to call VTEX REST APIs
      const product = await context.clients.commerce.catalog.getProduct(
        root.productID
      )
      return product.allSpecifications || []
    },
  },
}

export default customDataResolver
```

---

### Anti-Pattern: API Keys in Client-Side Code

**What happens**: Developer hardcodes VTEX API keys (`VTEX_APP_KEY`, `VTEX_APP_TOKEN`) in client-side JavaScript, or adds them as `NEXT_PUBLIC_` environment variables, making them visible in the browser bundle.

**Why it fails**: This is a critical security vulnerability. API keys visible in the browser can be extracted by anyone viewing the page source. With VTEX API keys, an attacker can modify the product catalog, access customer order data, change prices, or disrupt store operations. This can lead to data breaches, financial loss, and compliance violations.

**Fix**: Never use API keys in client-side code. Use the FastStore API extension system, where resolvers run server-side and authentication is handled by the `context.clients` object. If you need external API keys for third-party services, use server-side API routes or resolvers.

```typescript
// src/graphql/thirdParty/resolvers/reviews.ts
// Third-party API key used safely in a server-side resolver
import type { Resolver } from '@faststore/api'

const REVIEWS_API_KEY = process.env.REVIEWS_API_KEY // Server-only env var (no NEXT_PUBLIC_ prefix)

const reviewsResolver: Record<string, Resolver> = {
  StoreProduct: {
    reviews: async (root) => {
      const response = await fetch(
        `https://api.reviews-service.com/products/${root.productID}/reviews`,
        {
          headers: {
            Authorization: `Bearer ${REVIEWS_API_KEY}`,
          },
        }
      )
      const data = await response.json()

      return {
        averageRating: data.average_rating,
        totalReviews: data.total_count,
        reviews: data.reviews.slice(0, 5).map((r: any) => ({
          author: r.author_name,
          rating: r.rating,
          text: r.review_text,
          date: r.created_at,
        })),
      }
    },
  },
}

export default reviewsResolver
```

---

### Anti-Pattern: Bypassing GraphQL with Custom API Routes

**What happens**: Developer creates Next.js API routes (`pages/api/`) to serve custom data to the storefront, bypassing FastStore's GraphQL layer entirely. They may do this because they're more familiar with REST than GraphQL.

**Why it fails**: FastStore explicitly recommends against custom API routes. They don't benefit from FastStore's built-in caching, data normalization, or request batching. They add server-side endpoints that consume resources and must be maintained separately. They bypass GraphQL's type safety and selective field retrieval. Orphaned API routes that are no longer used still consume server resources.

**Fix**: Use the FastStore API extension system. Create type definitions and resolvers in `src/graphql/thirdParty/` for external data or `src/graphql/vtex/` for VTEX platform data. The GraphQL layer provides caching, type safety, and a unified data access pattern.

```typescript
// Instead of pages/api/product-reviews.ts, use a GraphQL extension:

// src/graphql/thirdParty/typeDefs/extra.graphql
type Review {
  author: String
  rating: Float
  text: String
  date: String
}

type ReviewSummary {
  averageRating: Float
  totalReviews: Int
  reviews: [Review]
}

type StoreProduct {
  reviewSummary: ReviewSummary
}
```

```typescript
// src/graphql/thirdParty/resolvers/reviews.ts
import type { Resolver } from '@faststore/api'

const REVIEWS_API_KEY = process.env.REVIEWS_API_KEY

const reviewsResolver: Record<string, Resolver> = {
  StoreProduct: {
    reviewSummary: async (root) => {
      const response = await fetch(
        `https://api.reviews-service.com/products/${root.productID}`,
        {
          headers: { Authorization: `Bearer ${REVIEWS_API_KEY}` },
        }
      )
      const data = await response.json()

      return {
        averageRating: data.average_rating,
        totalReviews: data.total_count,
        reviews: data.reviews.slice(0, 5).map((r: any) => ({
          author: r.author_name,
          rating: r.rating,
          text: r.review_text,
          date: r.created_at,
        })),
      }
    },
  },
}

export default reviewsResolver
```

```typescript
// src/graphql/thirdParty/resolvers/index.ts
import { default as reviewsResolver } from './reviews'

const resolvers = {
  ...reviewsResolver,
}

export default resolvers
```

## Reference

**Links to VTEX documentation and related resources.**

- [FastStore API overview](https://developers.vtex.com/docs/guides/faststore/faststore-api-overview) — Introduction to the GraphQL API and its capabilities
- [API extensions overview](https://developers.vtex.com/docs/guides/faststore/api-extensions-overview) — Guide to extending the FastStore API with custom data
- [Extending VTEX API schemas](https://developers.vtex.com/docs/guides/faststore/api-extensions-extending-api-schema) — Step-by-step for adding VTEX platform data to the GraphQL schema
- [Extending third-party API schemas](https://developers.vtex.com/docs/guides/faststore/api-extensions-extending-api-schema#extending-faststore-api-with-third-party-api-schemas) — Integrating external data sources
- [Extending queries using fragments](https://developers.vtex.com/docs/guides/faststore/api-extensions-extending-queries-using-fragments) — How to add fields to predefined queries using fragments
- [Consuming API extensions with custom components](https://developers.vtex.com/docs/guides/faststore/api-extensions-consuming-api-extensions) — Using extended data in React components
- [GraphQL schema objects](https://developers.vtex.com/docs/guides/faststore/schema-objects) — Reference for all native GraphQL types (StoreProduct, StoreOffer, etc.)
- [GraphQL queries reference](https://developers.vtex.com/docs/guides/faststore/schema-queries) — All predefined queries available in the FastStore API
- [API extension troubleshooting](https://developers.vtex.com/docs/guides/faststore/api-extensions-troubleshooting) — Common issues with API extensions and their solutions
- [FastStore SDK State Management](../faststore-state-management/skill.md) — Related skill for client-side state management with SDK hooks
