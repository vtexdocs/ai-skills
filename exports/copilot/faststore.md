# FastStore Implementation & Customization

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

---

# FastStore Section & Component Overrides

## Overview

**What this skill covers**: FastStore's override system for customizing native sections and components. This includes using `getOverriddenSection()` to create section-level overrides, replacing individual components within a section, and passing custom props to native components.

**When to use it**: When you need to customize the behavior or appearance of a FastStore storefront component beyond what theming and design tokens can achieve. Use overrides when you need to replace a component entirely, inject custom logic, or modify props on native components.

**What you'll learn**:
- How to create override files in `src/components/overrides/`
- How to use `getOverriddenSection()` to customize sections
- How to override individual components within a section
- How to pass custom props to native components while preserving integration

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Sections vs Components

In FastStore, **sections** are top-level layout components that organize and encapsulate other components. For example, the `Hero` section contains `Hero`, `HeroImage`, and `HeroHeader` components. Overrides work at the section level — you override a section and then customize the individual components within it. You cannot override a component outside the context of its parent section.

### Concept 2: The `getOverriddenSection()` Function

`getOverriddenSection()` is the core API for creating overrides. It accepts a configuration object with the original `Section`, an optional `className`, and a `components` map specifying which child components to replace or customize. It returns a new React component that replaces the original section while preserving all native behavior and integrations.

### Concept 3: Override File Convention

Override files live in `src/components/overrides/` and are named after the section they override (e.g., `ProductDetails.tsx` for the `ProductDetails` section). Each file exports the overridden section as default. FastStore automatically discovers and applies overrides from this directory.

**Architecture/Data Flow**:
```text
src/components/overrides/[SectionName].tsx
  → imports Section from @faststore/core
  → calls getOverriddenSection({ Section, components: {...} })
  → exports overridden section as default
  → FastStore renders overridden version in place of native section
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Use the Override API — Never Modify FastStore Core

**Rule**: MUST use `getOverriddenSection()` from `@faststore/core` to customize sections. MUST NOT directly modify files in `node_modules/@faststore/` or import internal source files.

**Why**: Modifying `node_modules` is ephemeral (changes are lost on `npm install`) and importing from internal paths like `@faststore/core/src/` creates tight coupling to implementation details that can break on any FastStore update.

**Detection**: If you see imports from `@faststore/core/src/` (internal source paths) → STOP. These are private implementation details. Only import from the public API: `@faststore/core` and `@faststore/core/experimental`. If you see direct file edits in `node_modules/@faststore/` → STOP immediately and use the override system instead.

✅ **CORRECT**:
```typescript
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

import CustomProductTitle from '../CustomProductTitle'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    ProductTitle: { Component: CustomProductTitle },
  },
})

export default OverriddenProductDetails
```

❌ **WRONG**:
```typescript
// WRONG: Importing from internal source paths
import { ProductDetails } from '@faststore/core/src/components/sections/ProductDetails'
// This path is an implementation detail that can change without notice.
// It bypasses the public API and will break on FastStore updates.

// WRONG: Modifying node_modules directly
// Editing node_modules/@faststore/core/dist/components/ProductDetails.js
// Changes are lost on every npm install and cannot be version-controlled.
```

---

### Constraint: Override Files Must Live in src/components/overrides/

**Rule**: MUST place override files in the `src/components/overrides/` directory, named after the section being overridden (e.g., `ProductDetails.tsx`).

**Why**: FastStore's build system scans `src/components/overrides/` to discover and apply section overrides. Files placed elsewhere will not be detected and the override will silently fail — the native section will render instead with no error message.

**Detection**: If you see override-related code (calls to `getOverriddenSection`) in files outside `src/components/overrides/` → warn that the override will not be applied. Check that the filename matches a valid native section name from the FastStore section list.

✅ **CORRECT**:
```typescript
// src/components/overrides/Alert.tsx
// File is in the correct directory and named after the Alert section
import { getOverriddenSection } from '@faststore/core'
import { AlertSection } from '@faststore/core'

import CustomIcon from '../CustomIcon'

const OverriddenAlert = getOverriddenSection({
  Section: AlertSection,
  components: {
    Icon: { Component: CustomIcon },
  },
})

export default OverriddenAlert
```

❌ **WRONG**:
```typescript
// src/components/MyCustomAlert.tsx
// WRONG: File is NOT in src/components/overrides/
// FastStore will NOT discover this override.
// The native Alert section will render unchanged.
import { getOverriddenSection } from '@faststore/core'
import { AlertSection } from '@faststore/core'

const OverriddenAlert = getOverriddenSection({
  Section: AlertSection,
  components: {
    Icon: { Component: CustomIcon },
  },
})

export default OverriddenAlert
```

---

### Constraint: Override Only Documented Overridable Components

**Rule**: MUST only override components listed as overridable in the FastStore native sections documentation. Components prefixed with `__experimental` can be overridden but their props are not accessible.

**Why**: Attempting to override a component not listed as overridable will silently fail. The override configuration will be ignored and the native component will render. Components marked `__experimental` have unstable prop interfaces that may change without notice.

**Detection**: If you see a component name in the `components` override map that does not appear in the FastStore list of overridable components for that section → warn that this override may not work. If the component is prefixed with `__experimental` → warn about inaccessible props and instability.

✅ **CORRECT**:
```typescript
// src/components/overrides/ProductDetails.tsx
// ProductTitle is a documented overridable component of ProductDetails section
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    ProductTitle: {
      props: {
        refNumber: true,
        showDiscountBadge: false,
      },
    },
  },
})

export default OverriddenProductDetails
```

❌ **WRONG**:
```typescript
// src/components/overrides/ProductDetails.tsx
// "InternalPriceCalculator" is NOT a documented overridable component
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    // This component name does not exist in the overridable list.
    // The override will be silently ignored.
    InternalPriceCalculator: { Component: MyPriceCalculator },
  },
})

export default OverriddenProductDetails
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Create the overrides directory

Ensure your project has the `src/components/overrides/` directory. If it doesn't exist, create it:

```typescript
// Terminal command:
// mkdir -p src/components/overrides
//
// Project structure after creation:
// src/
//   components/
//     overrides/    ← override files go here
//     ...           ← custom components go here
```

### Step 2: Create a custom component (if replacing a component)

If you need to replace a native component entirely, create your custom component first. Place it in `src/components/`:

```typescript
// src/components/CustomBuyButton.tsx
import React from 'react'
import { Button as UIButton } from '@faststore/ui'
import { useCart } from '@faststore/sdk'

interface CustomBuyButtonProps {
  children?: React.ReactNode
}

export default function CustomBuyButton({ children }: CustomBuyButtonProps) {
  const { addItem } = useCart()

  const handleClick = () => {
    // Custom buy button logic — for example, showing a confirmation toast
    console.log('Item added to cart')
  }

  return (
    <UIButton
      variant="primary"
      onClick={handleClick}
      data-fs-buy-button
    >
      {children || 'Add to Cart'}
    </UIButton>
  )
}
```

### Step 3: Create the override file

Create the override file in `src/components/overrides/` named after the target section:

```typescript
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

import CustomBuyButton from '../CustomBuyButton'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    BuyButton: { Component: CustomBuyButton },
  },
})

export default OverriddenProductDetails
```

### Step 4: Override props without replacing the component

If you only need to change a component's props (not replace it entirely), use the `props` key instead of `Component`:

```typescript
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    BuyButton: {
      props: {
        size: 'small',
        iconPosition: 'left',
      },
    },
  },
})

export default OverriddenProductDetails
```

### Complete Example

Full end-to-end example: overriding the Alert section with a custom icon and custom styling:

```typescript
// src/components/BoldIcon.tsx
import React from 'react'

interface BoldIconProps {
  width?: number
  height?: number
}

export default function BoldIcon({ width = 24, height = 24 }: BoldIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
```

```typescript
// src/components/overrides/Alert.tsx
import { getOverriddenSection } from '@faststore/core'
import { AlertSection } from '@faststore/core'
import styles from './simple-alert.module.scss'

import BoldIcon from '../BoldIcon'

const OverriddenAlert = getOverriddenSection({
  Section: AlertSection,
  className: styles.simpleAlert,
  components: {
    Icon: { Component: BoldIcon },
  },
})

export default OverriddenAlert
```

```scss
/* src/components/overrides/simple-alert.module.scss */
.simpleAlert {
  [data-fs-alert] {
    background-color: var(--fs-color-warning-bkg);
    border-radius: var(--fs-border-radius);
    padding: var(--fs-spacing-2) var(--fs-spacing-3);
  }
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Monkey-Patching FastStore Internals

**What happens**: Developer modifies files inside `node_modules/@faststore/` directly, or patches FastStore source code using `patch-package` for changes that the override system supports.

**Why it fails**: Direct modifications to `node_modules` are not version-controlled and are wiped on every `npm install` or CI build. Using `patch-package` for overridable changes creates unnecessary maintenance burden — patches break on every FastStore update and must be manually reconciled. The override system exists specifically to handle these customizations in a forward-compatible way.

**Fix**: Use `getOverriddenSection()` for all section and component customizations. Reserve `patch-package` only for genuine bug fixes in FastStore that have no override-based workaround.

```typescript
// src/components/overrides/ProductDetails.tsx
// Use the override system instead of patching node_modules
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

import CustomProductTitle from '../CustomProductTitle'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    ProductTitle: { Component: CustomProductTitle },
  },
})

export default OverriddenProductDetails
```

---

### Anti-Pattern: Using CSS `!important` Instead of Overrides

**What happens**: Developer uses `!important` declarations in global CSS to force visual changes on FastStore native components instead of using the override API to replace or customize components.

**Why it fails**: `!important` declarations create specificity wars that are difficult to debug and maintain. They can conflict with FastStore's structural styles and design token system. When FastStore updates its CSS, `!important` overrides may produce unexpected results. The override system provides a clean, maintainable way to change both behavior and appearance.

**Fix**: Use the override system to replace components, or use the theming/design token system for visual-only changes.

```typescript
// For behavioral changes, use overrides:
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

import CustomBuyButton from '../CustomBuyButton'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    BuyButton: { Component: CustomBuyButton },
  },
})

export default OverriddenProductDetails

// For visual-only changes, use design tokens in src/themes/custom-theme.scss:
// [data-fs-buy-button] {
//   --fs-button-primary-bkg-color: var(--fs-color-accent-0);
//   --fs-button-primary-text-color: var(--fs-color-text-inverse);
// }
```

---

### Anti-Pattern: Wrapper Components Instead of Override API

**What happens**: Developer creates a wrapper component that renders the native FastStore section and adds logic around it (e.g., wrapping `<ProductDetailsSection>` in a custom `<div>` with event handlers), bypassing the override system entirely.

**Why it fails**: Wrapper components do not integrate with FastStore's section discovery, Headless CMS, or analytics tracking. The wrapped section will not appear in the CMS editor for content managers. Props passed from the CMS to the section may not propagate correctly through the wrapper. Analytics events tied to the section lifecycle may not fire.

**Fix**: Use `getOverriddenSection()` with the `className` option for styling wrappers, and the `components` map for behavioral changes.

```typescript
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'
import styles from './custom-product-details.module.scss'

import CustomBuyButton from '../CustomBuyButton'

// Use className for wrapper-level styling and components for behavior
const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  className: styles.customProductDetails,
  components: {
    BuyButton: { Component: CustomBuyButton },
  },
})

export default OverriddenProductDetails
```

## Reference

**Links to VTEX documentation and related resources.**

- [Overrides overview](https://developers.vtex.com/docs/guides/faststore/overrides-overview) — Introduction to the FastStore override system and when to use it
- [getOverriddenSection function](https://developers.vtex.com/docs/guides/faststore/overrides-getoverriddensection-function) — API reference for the core override function
- [Override native components and props](https://developers.vtex.com/docs/guides/faststore/overrides-components-and-props-v1) — Step-by-step guide for overriding component props
- [Override a native component](https://developers.vtex.com/docs/guides/faststore/overrides-native-component) — Guide for replacing a native component entirely
- [List of native sections and overridable components](https://developers.vtex.com/docs/guides/faststore/building-sections-list-of-native-sections) — Complete reference of which components can be overridden per section
- [Creating a new section](https://developers.vtex.com/docs/guides/faststore/building-sections-creating-a-new-section) — Guide for creating custom sections when overrides are insufficient
- [Troubleshooting overrides](https://developers.vtex.com/docs/troubleshooting/my-store-does-not-reflect-the-overrides-i-created) — Common issues and solutions when overrides don't work
- [FastStore Theming & Design Tokens](../faststore-theming/skill.md) — Related skill for visual customizations that don't require overrides

---

# FastStore SDK State Management

## Overview

**What this skill covers**: The `@faststore/sdk` package and its hooks for managing client-side state in FastStore storefronts. This includes the Cart module (`useCart`), Session module (`useSession`), Search module (`useSearch`), and Analytics module. The SDK manages the state of key ecommerce features in the browser and synchronizes with the VTEX platform via the FastStore API.

**When to use it**: When building any interactive ecommerce feature that involves the shopping cart, user session (currency, locale, channel), product search/filtering, or UI component visibility. The SDK is the single source of truth for these concerns — use its hooks instead of building custom state.

**What you'll learn**:
- How to use `useCart()` for cart operations (add, remove, update items)
- How to use `useSession()` for session data (currency, locale, channel, person)
- How to use `useSearch()` for faceted search state (sort, filters, pagination)
- Why you must never build custom state for cart/session/search when the SDK provides it

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: SDK Module Architecture

The `@faststore/sdk` is organized into four modules, each managing a specific domain of ecommerce state:
- **Cart**: Shopping cart state — items, quantities, prices, validation status
- **Session**: User session data — currency, channel, locale, country, person (logged-in user)
- **Search**: Faceted search state — sort order, selected facets, pagination, URL parameters
- **Analytics**: GA4-compatible event tracking for ecommerce actions

Each module provides hooks (e.g., `useCart()`) that give components read and write access to the module's state. State is managed in the browser and validated against the VTEX platform via GraphQL mutations.

### Concept 2: Cart Validation

The cart is not just a client-side data structure. When items are added or modified, the SDK validates the cart against the VTEX platform via the FastStore API's `validateCart` mutation. This ensures prices, availability, and promotions are accurate. The `isValidating` flag from `useCart()` indicates whether a validation request is in progress. Always show a loading state during validation to prevent users from checking out with stale data.

### Concept 3: Session and Localization

The session holds runtime context: which sales channel the shopper is in, what currency to display, what locale to use, and the shopper's identity (if logged in). Components like price displays and shipping estimators depend on session data. The `useSession()` hook provides this context. Session changes (e.g., switching locale) trigger re-validation of the cart and re-fetching of product data.

**Architecture/Data Flow**:
```text
Browser State (@faststore/sdk)
  ├── Cart Module → useCart() → validated via FastStore API → VTEX Commerce
  ├── Session Module → useSession() → validated via FastStore API → VTEX Commerce
  ├── Search Module → useSearch() → reads/writes URL parameters → triggers queries
  └── Analytics Module → sendAnalyticsEvent() → GA4 data layer
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Use @faststore/sdk for Cart, Session, and Search State

**Rule**: MUST use `@faststore/sdk` hooks (`useCart`, `useSession`, `useSearch`) for managing cart, session, and search state. MUST NOT build custom state management (React Context, Redux, Zustand, useState/useReducer) for these domains.

**Why**: The SDK hooks are wired into the FastStore platform integration layer. `useCart()` triggers cart validation mutations. `useSession()` propagates locale/currency changes to all data queries. `useSearch()` synchronizes with URL parameters and triggers search re-fetches. Custom state bypasses all of this — carts won't be validated, prices may be stale, search won't sync with URLs, and analytics events won't fire.

**Detection**: If you see `useState` or `useReducer` managing cart items, cart totals, session locale, session currency, or search facets → STOP. These should use `useCart()`, `useSession()`, or `useSearch()` from `@faststore/sdk`. If you see `createContext` with names like `CartContext`, `SessionContext`, or `SearchContext` → STOP. The SDK already provides these contexts.

✅ **CORRECT**:
```typescript
// src/components/MiniCart.tsx
import React from 'react'
import { useCart } from '@faststore/sdk'

export default function MiniCart() {
  const { items, totalItems, isValidating, removeItem } = useCart()

  if (totalItems === 0) {
    return <p>Your cart is empty</p>
  }

  return (
    <div data-fs-mini-cart>
      <h3>Cart ({totalItems} items)</h3>
      {isValidating && <span>Updating cart...</span>}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.itemOffered.name}</span>
            <span>${item.price}</span>
            <button onClick={() => removeItem(item.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

❌ **WRONG**:
```typescript
// WRONG: Building a custom cart context instead of using @faststore/sdk
import React, { createContext, useContext, useReducer } from 'react'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

// This custom context duplicates what @faststore/sdk already provides.
// Cart changes here will NOT trigger platform validation.
// Prices and availability will NOT be verified against VTEX.
// Analytics events will NOT fire for add-to-cart actions.
const CartContext = createContext<{
  items: CartItem[]
  dispatch: React.Dispatch<any>
}>({ items: [], dispatch: () => {} })

function cartReducer(state: CartItem[], action: any) {
  switch (action.type) {
    case 'ADD':
      return [...state, action.payload]
    case 'REMOVE':
      return state.filter((item) => item.id !== action.payload)
    default:
      return state
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, [])
  return (
    <CartContext.Provider value={{ items, dispatch }}>
      {children}
    </CartContext.Provider>
  )
}
```

---

### Constraint: Always Handle Cart Validation State

**Rule**: MUST check the `isValidating` flag from `useCart()` and show appropriate loading states during cart validation. MUST NOT allow checkout navigation while `isValidating` is `true`.

**Why**: Cart validation is an asynchronous operation that checks items against the VTEX platform for current prices, availability, and applicable promotions. If a user proceeds to checkout during validation, they may see stale prices or encounter errors. The `isValidating` flag exists to prevent this.

**Detection**: If you see `useCart()` destructured without `isValidating` in components that have checkout links or "Proceed to Checkout" buttons → warn that the validation state is not being handled. If you see a checkout link or button that does not check `isValidating` before navigating → warn about potential stale cart data.

✅ **CORRECT**:
```typescript
// src/components/CartSummary.tsx
import React from 'react'
import { useCart } from '@faststore/sdk'

export default function CartSummary() {
  const { items, totalItems, isValidating } = useCart()

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  return (
    <div data-fs-cart-summary>
      <p>{totalItems} item{totalItems !== 1 ? 's' : ''} in your cart</p>
      <p>Subtotal: ${subtotal.toFixed(2)}</p>
      {isValidating && (
        <p data-fs-cart-validating>Verifying prices and availability...</p>
      )}
      <a
        href="/checkout"
        data-fs-checkout-button
        aria-disabled={isValidating}
        onClick={(e) => {
          if (isValidating) {
            e.preventDefault()
          }
        }}
      >
        {isValidating ? 'Updating cart...' : 'Proceed to Checkout'}
      </a>
    </div>
  )
}
```

❌ **WRONG**:
```typescript
// WRONG: Ignoring cart validation state
import React from 'react'
import { useCart } from '@faststore/sdk'

export default function CartSummary() {
  const { items, totalItems } = useCart()
  // Missing isValidating — user can click checkout while cart is being validated.
  // This can lead to price mismatches at checkout or failed orders.

  return (
    <div>
      <p>{totalItems} items</p>
      <a href="/checkout">Proceed to Checkout</a>
      {/* No loading state. No validation check. User may proceed with stale prices. */}
    </div>
  )
}
```

---

### Constraint: Do Not Store Session Data in localStorage

**Rule**: MUST use `useSession()` from `@faststore/sdk` for accessing session data (currency, locale, channel, person). MUST NOT read/write session data directly to `localStorage` or `sessionStorage`.

**Why**: The SDK's session module manages synchronization with the VTEX platform. When session data changes, the SDK triggers a `validateSession` mutation that updates the server-side session and re-validates the cart. Writing directly to `localStorage` bypasses this validation — the platform won't know about the change, prices may display in the wrong currency, and cart items may not reflect the correct sales channel.

**Detection**: If you see `localStorage.getItem` or `localStorage.setItem` with keys related to session data (currency, locale, channel, region, postalCode) → STOP. These should be managed through `useSession()`. If you see `sessionStorage` used for the same purpose → STOP.

✅ **CORRECT**:
```typescript
// src/components/LocaleSwitcher.tsx
import React from 'react'
import { useSession } from '@faststore/sdk'

export default function LocaleSwitcher() {
  const { locale, currency, setSession } = useSession()

  const handleLocaleChange = (newLocale: string, newCurrency: string) => {
    // setSession triggers platform validation and re-fetches data
    setSession({
      locale: newLocale,
      currency: { code: newCurrency, symbol: newCurrency === 'USD' ? '$' : 'R$' },
    })
  }

  return (
    <div data-fs-locale-switcher>
      <button
        onClick={() => handleLocaleChange('en-US', 'USD')}
        aria-pressed={locale === 'en-US'}
      >
        EN
      </button>
      <button
        onClick={() => handleLocaleChange('pt-BR', 'BRL')}
        aria-pressed={locale === 'pt-BR'}
      >
        PT
      </button>
      <span>Current: {locale} ({currency.code})</span>
    </div>
  )
}
```

❌ **WRONG**:
```typescript
// WRONG: Managing session data manually via localStorage
import React, { useState, useEffect } from 'react'

export default function LocaleSwitcher() {
  const [locale, setLocale] = useState('en-US')

  useEffect(() => {
    // WRONG: Reading session data from localStorage
    const saved = localStorage.getItem('store-locale')
    if (saved) setLocale(saved)
  }, [])

  const handleLocaleChange = (newLocale: string) => {
    // WRONG: Writing session data to localStorage
    // The VTEX platform does NOT know about this change.
    // Product prices, availability, and cart will NOT update.
    localStorage.setItem('store-locale', newLocale)
    setLocale(newLocale)
  }

  return (
    <div>
      <button onClick={() => handleLocaleChange('en-US')}>EN</button>
      <button onClick={() => handleLocaleChange('pt-BR')}>PT</button>
    </div>
  )
}
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Add items to the cart with useCart

Use `useCart()` to manage the shopping cart. The `addItem` function accepts an item matching the SDK's cart item shape:

```typescript
// src/components/AddToCartButton.tsx
import React from 'react'
import { useCart } from '@faststore/sdk'
import { Button } from '@faststore/ui'

interface AddToCartButtonProps {
  product: {
    id: string
    name: string
    image: { url: string; alternateName: string }
    sku: string
    price: number
    listPrice: number
    seller: { identifier: string }
  }
}

export default function AddToCartButton({ product }: AddToCartButtonProps) {
  const { addItem } = useCart()

  const handleAddToCart = () => {
    addItem({
      id: product.sku,
      price: product.price,
      listPrice: product.listPrice,
      quantity: 1,
      seller: product.seller,
      itemOffered: {
        sku: product.sku,
        name: product.name,
        image: [product.image],
        isVariantOf: { productGroupID: product.id, name: product.name },
      },
    })
  }

  return (
    <Button variant="primary" onClick={handleAddToCart} data-fs-buy-button>
      Add to Cart
    </Button>
  )
}
```

### Step 2: Read session data with useSession

Use `useSession()` to access the current session context. This is useful for displaying localized content:

```typescript
// src/components/PriceDisplay.tsx
import React from 'react'
import { useSession } from '@faststore/sdk'

interface PriceDisplayProps {
  price: number
  listPrice: number
}

export default function PriceDisplay({ price, listPrice }: PriceDisplayProps) {
  const { currency, locale } = useSession()

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.code,
  })

  const hasDiscount = listPrice > price

  return (
    <div data-fs-price-display>
      {hasDiscount && (
        <span data-fs-price-listing>{formatter.format(listPrice)}</span>
      )}
      <span data-fs-price-selling>{formatter.format(price)}</span>
    </div>
  )
}
```

### Step 3: Build search interactions with useSearch

Use `useSearch()` to read and modify the search state. This hook works within the `SearchProvider` context:

```typescript
// src/components/SortDropdown.tsx
import React from 'react'
import { useSearch } from '@faststore/sdk'

const SORT_OPTIONS = {
  score_desc: 'Relevance',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  orders_desc: 'Best Sellers',
  name_asc: 'Name: A-Z',
  name_desc: 'Name: Z-A',
  release_desc: 'Newest',
  discount_desc: 'Biggest Discount',
} as const

type SortKey = keyof typeof SORT_OPTIONS

export default function SortDropdown() {
  const { state, setState } = useSearch()

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = event.target.value as SortKey

    setState({
      ...state,
      sort: newSort,
      page: 0, // Reset to first page on sort change
    })
  }

  return (
    <div data-fs-sort-dropdown>
      <label htmlFor="sort-select">Sort by:</label>
      <select
        id="sort-select"
        value={state.sort}
        onChange={handleSortChange}
        data-fs-select
      >
        {Object.entries(SORT_OPTIONS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
```

### Complete Example

Full shopping cart component using multiple SDK hooks together:

```typescript
// src/components/CartDrawer.tsx
import React from 'react'
import { useCart } from '@faststore/sdk'
import { useSession } from '@faststore/sdk'
import { Button, Loader } from '@faststore/ui'

export default function CartDrawer() {
  const { items, totalItems, isValidating, removeItem, updateItemQuantity } =
    useCart()
  const { currency, locale } = useSession()

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.code,
  })

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  if (totalItems === 0) {
    return (
      <div data-fs-cart-drawer>
        <h2>Your Cart</h2>
        <p>Your cart is empty. Start shopping to add items.</p>
      </div>
    )
  }

  return (
    <div data-fs-cart-drawer>
      <h2>Your Cart ({totalItems} items)</h2>

      {isValidating && (
        <div data-fs-cart-loading>
          <Loader />
          <span>Verifying prices and availability...</span>
        </div>
      )}

      <ul data-fs-cart-items>
        {items.map((item) => (
          <li key={item.id} data-fs-cart-item>
            <img
              src={item.itemOffered.image[0]?.url}
              alt={item.itemOffered.image[0]?.alternateName}
              width={72}
              height={72}
            />
            <div data-fs-cart-item-details>
              <span data-fs-cart-item-name>
                {item.itemOffered.name}
              </span>
              <span data-fs-cart-item-price>
                {formatter.format(item.price)}
              </span>
              <div data-fs-cart-item-quantity>
                <Button
                  variant="tertiary"
                  onClick={() =>
                    updateItemQuantity(item.id, item.quantity - 1)
                  }
                  disabled={item.quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  -
                </Button>
                <span>{item.quantity}</span>
                <Button
                  variant="tertiary"
                  onClick={() =>
                    updateItemQuantity(item.id, item.quantity + 1)
                  }
                  aria-label="Increase quantity"
                >
                  +
                </Button>
              </div>
              <Button
                variant="tertiary"
                onClick={() => removeItem(item.id)}
                aria-label={`Remove ${item.itemOffered.name}`}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div data-fs-cart-summary>
        <div data-fs-cart-subtotal>
          <span>Subtotal</span>
          <span>{formatter.format(subtotal)}</span>
        </div>
        <a
          href="/checkout"
          data-fs-checkout-button
          aria-disabled={isValidating}
          onClick={(e) => {
            if (isValidating) {
              e.preventDefault()
            }
          }}
        >
          {isValidating ? 'Updating cart...' : 'Proceed to Checkout'}
        </a>
      </div>
    </div>
  )
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Custom Cart Context

**What happens**: Developer creates a React Context with `createContext` and `useReducer` to manage cart state, duplicating the entire cart data model and operations that `@faststore/sdk` already provides.

**Why it fails**: The custom context is disconnected from the VTEX platform. Items added to the custom cart are never validated — prices may be outdated, items may be out of stock, and promotions won't be applied. When the user navigates to checkout (which uses the SDK's cart), the custom cart state won't be present. Analytics events for add-to-cart, remove-from-cart, and view-cart won't fire.

**Fix**: Use `useCart()` from `@faststore/sdk`. It provides `addItem`, `removeItem`, `updateItemQuantity`, `items`, `totalItems`, `isValidating`, and `isEmpty` — everything needed for cart management.

```typescript
// Use the SDK's useCart hook — it handles platform validation and analytics
import { useCart } from '@faststore/sdk'

export default function CartWidget() {
  const { items, totalItems, isValidating, addItem, removeItem } = useCart()

  return (
    <div data-fs-cart-widget>
      <span>{totalItems} items</span>
      {isValidating && <span>Updating...</span>}
    </div>
  )
}
```

---

### Anti-Pattern: localStorage for Session Data

**What happens**: Developer stores session-related data (locale, currency, region, postal code, sales channel) in `localStorage` and reads it directly in components, bypassing the SDK's session module.

**Why it fails**: Session changes stored in `localStorage` are invisible to the VTEX platform. The cart will not be re-validated for the new locale/currency. Product prices will display in the wrong currency. Search results may not reflect the correct sales channel. The SDK's `validateSession` mutation — which ensures the platform is synchronized — never fires.

**Fix**: Use `useSession()` and `setSession()` from `@faststore/sdk`. All session state changes will be validated against the platform and propagated to dependent queries.

```typescript
import { useSession } from '@faststore/sdk'

export default function RegionSelector() {
  const { postalCode, setSession } = useSession()

  const handlePostalCodeChange = (newPostalCode: string) => {
    // setSession validates against the platform and updates all dependent data
    setSession({ postalCode: newPostalCode })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const input = e.currentTarget.elements.namedItem('postalCode') as HTMLInputElement
        handlePostalCodeChange(input.value)
      }}
    >
      <input name="postalCode" defaultValue={postalCode} placeholder="Enter ZIP code" />
      <button type="submit">Update</button>
    </form>
  )
}
```

---

### Anti-Pattern: Custom Search State Management

**What happens**: Developer builds a custom search state system using `useState` or `useReducer` to track sort order, selected facets, and pagination, then manually constructs URLs or API calls based on this state.

**Why it fails**: The SDK's search module is tightly integrated with URL parameters — the search state IS the URL. When a user shares a link or uses the browser's back button, the SDK automatically restores the search state from the URL. A custom system would lose state on navigation, produce URLs that don't reflect the current search, and break the back-button experience. It also bypasses the SDK's optimized query generation for the FastStore API.

**Fix**: Use `useSearch()` within the `SearchProvider` context. The SDK handles URL synchronization, facet state, sort order, and pagination automatically.

```typescript
import { useSearch } from '@faststore/sdk'

export default function FacetFilter() {
  const { state, setState } = useSearch()

  const toggleFacet = (facetKey: string, facetValue: string) => {
    const currentFacets = state.selectedFacets || []
    const exists = currentFacets.some(
      (f) => f.key === facetKey && f.value === facetValue
    )

    const newFacets = exists
      ? currentFacets.filter(
          (f) => !(f.key === facetKey && f.value === facetValue)
        )
      : [...currentFacets, { key: facetKey, value: facetValue }]

    setState({
      ...state,
      selectedFacets: newFacets,
      page: 0, // Reset pagination when filters change
    })
  }

  return (
    <div data-fs-facet-filter>
      <button onClick={() => toggleFacet('brand', 'Nike')}>
        Nike {state.selectedFacets?.some((f) => f.key === 'brand' && f.value === 'Nike') ? '✓' : ''}
      </button>
    </div>
  )
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [FastStore SDK overview](https://developers.vtex.com/docs/guides/faststore/sdk-overview) — Introduction to the SDK modules and their responsibilities
- [useCart hook](https://developers.vtex.com/docs/guides/faststore/sdk-use-cart) — API reference for the cart hook with all properties and functions
- [Cart module overview](https://developers.vtex.com/docs/guides/faststore/cart-overview) — Cart data structure, validation, and platform integration
- [Session module](https://developers.vtex.com/docs/guides/faststore/sdk-session) — Session data structure, currency, locale, and channel management
- [useSearch hook](https://developers.vtex.com/docs/guides/faststore/sdk-use-search) — API reference for the search hook with sorting, facets, and pagination
- [SearchProvider](https://developers.vtex.com/docs/guides/faststore/search-search-provider) — Context provider required for useSearch to function
- [Analytics module](https://developers.vtex.com/docs/guides/faststore/sdk-analytics) — GA4-compatible analytics event tracking
- [Experimental hooks and components](https://developers.vtex.com/docs/guides/faststore/sdk-experimental-exports) — Unstable hooks for advanced use cases (useCart_unstable, useSession_unstable)
- [FastStore Data Layer & API Integration](../faststore-data-fetching/skill.md) — Related skill for fetching product data via the GraphQL API

---

# FastStore Theming & Design Tokens

## Overview

**What this skill covers**: FastStore's theming system, including design tokens (global and local), the Brandless default theme, custom theme creation, and component-level styling using Sass and CSS custom properties.

**When to use it**: When you need to change the visual appearance of a FastStore storefront — colors, typography, spacing, borders, or component-specific styles — without changing component behavior. Theming is the first tool to reach for before considering overrides.

**What you'll learn**:
- How global and local design tokens work together in the token hierarchy
- How to create and apply a custom theme in `src/themes/`
- How to style individual components using local tokens and data attributes
- How to maintain consistency using the Brandless architecture

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Design Tokens

Design tokens are named CSS custom properties (variables) that define the visual properties of your store. FastStore organizes tokens into two tiers:
- **Global tokens** define system-wide values: colors, typography, spacing, borders, and transitions. They follow the naming pattern `--fs-{type}-{category}-{variant}` (e.g., `--fs-color-main-0`, `--fs-spacing-3`, `--fs-text-size-body`).
- **Local tokens** are component-specific and typically inherit from global tokens. They follow the pattern `--fs-{component}-{property}` (e.g., `--fs-button-primary-bkg-color`).

Changing a global token propagates through all components that reference it. Changing a local token affects only that component.

### Concept 2: Brandless Architecture

Brandless is FastStore's default theme — a minimal, unopinionated foundation composed of two layers:
- **Structural Styles**: Foundational design patterns and interaction behaviors (show/hide menus, layout grids). These should rarely be modified.
- **Theme Layer**: The customizable layer where branding happens. This is where you modify design tokens to change colors, typography, spacing, and other visual properties.

The Brandless base tokens are defined in `@faststore/ui` at `src/styles/base/tokens.scss`. Your custom theme overrides these values.

### Concept 3: Custom Theme Files

Custom themes live in `src/themes/` as `.scss` files. The main entry point is `src/themes/custom-theme.scss`. This file is where you override global tokens and add component-specific styling using data attributes. FastStore's build process automatically picks up this file.

**Architecture/Data Flow**:
```text
@faststore/ui base tokens (Brandless defaults)
  → src/themes/custom-theme.scss (your global token overrides)
    → Component local tokens (inherit from globals unless explicitly overridden)
      → Rendered component styles
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Use Design Tokens — Not Inline Styles

**Rule**: MUST use design tokens (global or local) to style FastStore components. MUST NOT use inline `style={}` props on FastStore components for theming purposes.

**Why**: Inline styles bypass the design token hierarchy, cannot be overridden by themes, do not participate in responsive breakpoints, and create maintenance nightmares. They also defeat CSS caching since styles are embedded in HTML. Design tokens ensure consistency and allow store-wide changes from a single file.

**Detection**: If you see `style={{` or `style={` on FastStore native components (components imported from `@faststore/ui` or `@faststore/core`) → warn that this bypasses the theming system. Suggest using design tokens or CSS modules instead. Exception: inline styles are acceptable on fully custom components that are not part of the FastStore UI library.

✅ **CORRECT**:
```typescript
// src/themes/custom-theme.scss
// Override the BuyButton's primary background color using design tokens
[data-fs-buy-button] {
  --fs-button-primary-bkg-color: #e31c58;
  --fs-button-primary-bkg-color-hover: #c4174d;
  --fs-button-primary-text-color: var(--fs-color-text-inverse);

  [data-fs-button-wrapper] {
    border-radius: var(--fs-border-radius-pill);
  }
}
```

❌ **WRONG**:
```typescript
// WRONG: Using inline styles on a FastStore component
import { BuyButton } from '@faststore/ui'

function ProductActions() {
  return (
    <BuyButton
      style={{ backgroundColor: '#e31c58', color: 'white', borderRadius: '999px' }}
    >
      Add to Cart
    </BuyButton>
  )
  // Inline styles bypass the design token hierarchy.
  // They cannot be changed store-wide from the theme file.
  // They do not respond to dark mode or other theme variants.
}
```

---

### Constraint: Place Theme Files in src/themes/

**Rule**: MUST place custom theme SCSS files in the `src/themes/` directory. The primary theme file must be named `custom-theme.scss`.

**Why**: FastStore's build system imports theme files from `src/themes/custom-theme.scss`. Files placed elsewhere will not be picked up by the build and your token overrides will have no effect. There will be no error — the default Brandless theme will render instead.

**Detection**: If you see token override declarations (variables starting with `--fs-`) in SCSS files outside `src/themes/` → warn that these may not be applied. If the file `src/themes/custom-theme.scss` does not exist in the project → warn that no custom theme is active.

✅ **CORRECT**:
```typescript
// src/themes/custom-theme.scss
// Global token overrides — applied store-wide
:root {
  --fs-color-main-0: #003232;
  --fs-color-main-1: #004c4c;
  --fs-color-main-2: #006666;
  --fs-color-main-3: #008080;
  --fs-color-main-4: #00b3b3;

  --fs-color-accent-0: #e31c58;
  --fs-color-accent-1: #c4174d;
  --fs-color-accent-2: #a51342;

  --fs-text-face-body: 'Inter', -apple-system, system-ui, BlinkMacSystemFont, sans-serif;
  --fs-text-face-title: 'Poppins', var(--fs-text-face-body);

  --fs-text-size-title-huge: 3.5rem;
  --fs-text-size-title-page: 2.25rem;
}

// Component-specific token overrides
[data-fs-price] {
  --fs-price-listing-color: #cb4242;
}
```

❌ **WRONG**:
```typescript
// src/styles/my-theme.scss
// WRONG: This file is in src/styles/, not src/themes/
// FastStore will NOT import this file. Token overrides will be ignored.
:root {
  --fs-color-main-0: #003232;
  --fs-color-accent-0: #e31c58;
}

// Also WRONG: Creating a theme in the project root
// ./theme.scss — this will not be discovered by the build system
```

---

### Constraint: Use Data Attributes for Component Targeting

**Rule**: MUST use FastStore's `data-fs-*` data attributes to target components in theme SCSS files. MUST NOT use class names or tag selectors to target FastStore native components.

**Why**: FastStore components use data attributes as their public styling API (e.g., `data-fs-button`, `data-fs-price`, `data-fs-hero`). Class names are implementation details that can change between versions. Using data attributes ensures your theme survives FastStore updates. Each component documents its available data attributes in the customization section of its docs.

**Detection**: If you see CSS selectors targeting `.fs-*` class names or generic tag selectors (`button`, `h1`, `div`) to style FastStore components → warn about fragility. Suggest using `[data-fs-*]` selectors instead.

✅ **CORRECT**:
```typescript
// src/themes/custom-theme.scss
// Target the Hero section using its data attribute
[data-fs-hero] {
  --fs-hero-text-size: var(--fs-text-size-title-huge);
  --fs-hero-heading-weight: var(--fs-text-weight-bold);

  [data-fs-hero-heading] {
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  [data-fs-hero-image] {
    border-radius: var(--fs-border-radius);
    filter: brightness(0.9);
  }
}
```

❌ **WRONG**:
```typescript
// src/themes/custom-theme.scss
// WRONG: Targeting by class names — these are internal and may change
.fs-hero {
  font-size: 3.5rem;
}

.fs-hero h1 {
  text-transform: uppercase;
}

// WRONG: Using generic tag selectors
section > div > h1 {
  font-weight: bold;
}
// These are fragile selectors that break when FastStore restructures its HTML.
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Create the custom theme file

Create the `src/themes/` directory and the `custom-theme.scss` file:

```typescript
// File: src/themes/custom-theme.scss
// This file is automatically imported by FastStore's build system.

// --------------------------------------------------------
// Global Token Overrides
// --------------------------------------------------------
// Override Brandless defaults to match your brand identity.

:root {
  // Colors
  --fs-color-main-0: #003232;
  --fs-color-main-1: #004c4c;
  --fs-color-main-2: #006666;
  --fs-color-main-3: #008080;
  --fs-color-main-4: #00b3b3;

  --fs-color-accent-0: #e31c58;
  --fs-color-accent-1: #c4174d;

  // Typography
  --fs-text-face-body: 'Inter', -apple-system, system-ui, sans-serif;
  --fs-text-face-title: 'Poppins', var(--fs-text-face-body);
}
```

### Step 2: Add component-specific token overrides

Below the global overrides, add component-level customizations using data attributes:

```typescript
// File: src/themes/custom-theme.scss (continued)

// --------------------------------------------------------
// FS UI Components
// --------------------------------------------------------
// Customize individual component styles using local tokens.

[data-fs-button] {
  --fs-button-border-radius: var(--fs-border-radius-pill);
  --fs-button-padding: 0 var(--fs-spacing-5);

  &[data-fs-button-variant="primary"] {
    --fs-button-primary-bkg-color: var(--fs-color-accent-0);
    --fs-button-primary-bkg-color-hover: var(--fs-color-accent-1);
    --fs-button-primary-text-color: var(--fs-color-text-inverse);
  }
}

[data-fs-price] {
  --fs-price-listing-color: #cb4242;
  --fs-price-listing-text-decoration: line-through;
}

[data-fs-navbar] {
  --fs-navbar-bkg-color: var(--fs-color-main-0);
  --fs-navbar-text-color: var(--fs-color-text-inverse);
}
```

### Step 3: Add fonts (if using custom fonts)

If your brand uses custom fonts, import them in the theme file and reference them via tokens:

```typescript
// File: src/themes/custom-theme.scss (at the top of the file)
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap');

// Then in your :root block:
:root {
  --fs-text-face-body: 'Inter', -apple-system, system-ui, sans-serif;
  --fs-text-face-title: 'Poppins', var(--fs-text-face-body);

  --fs-text-weight-light: 400;
  --fs-text-weight-regular: 500;
  --fs-text-weight-bold: 700;
  --fs-text-weight-black: 800;
}
```

### Complete Example

Full custom theme file for a branded store:

```typescript
// File: src/themes/custom-theme.scss
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap');

// --------------------------------------------------------
// Global Token Overrides
// --------------------------------------------------------
:root {
  // Brand Colors
  --fs-color-main-0: #003232;
  --fs-color-main-1: #004c4c;
  --fs-color-main-2: #006666;
  --fs-color-main-3: #008080;
  --fs-color-main-4: #00b3b3;

  --fs-color-accent-0: #e31c58;
  --fs-color-accent-1: #c4174d;
  --fs-color-accent-2: #a51342;
  --fs-color-accent-3: #870f37;

  // Typography
  --fs-text-face-body: 'Inter', -apple-system, system-ui, sans-serif;
  --fs-text-face-title: 'Poppins', var(--fs-text-face-body);
  --fs-text-size-title-huge: 3.5rem;
  --fs-text-size-title-page: 2.25rem;
  --fs-text-size-title-section: 1.75rem;
  --fs-text-size-title-subsection: 1.25rem;

  // Spacing
  --fs-grid-max-width: 1440px;
  --fs-grid-padding: 0 var(--fs-spacing-5);

  // Borders
  --fs-border-radius: 0.375rem;
  --fs-border-radius-pill: 100px;
  --fs-border-color: #e0e0e0;
  --fs-border-color-light: #f0f0f0;
}

// --------------------------------------------------------
// FS UI Components
// --------------------------------------------------------

[data-fs-button] {
  --fs-button-border-radius: var(--fs-border-radius);
  --fs-button-padding: 0 var(--fs-spacing-5);

  &[data-fs-button-variant="primary"] {
    --fs-button-primary-bkg-color: var(--fs-color-accent-0);
    --fs-button-primary-bkg-color-hover: var(--fs-color-accent-1);
    --fs-button-primary-text-color: var(--fs-color-text-inverse);
  }
}

[data-fs-price] {
  --fs-price-listing-color: #cb4242;
  --fs-price-listing-text-decoration: line-through;
}

[data-fs-hero] {
  --fs-hero-text-size: var(--fs-text-size-title-huge);
  --fs-hero-heading-weight: var(--fs-text-weight-bold);
}

[data-fs-product-card] {
  --fs-product-card-border-color: var(--fs-border-color-light);
  --fs-product-card-border-radius: var(--fs-border-radius);
  --fs-product-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  --fs-product-card-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.12);
}

[data-fs-navbar] {
  --fs-navbar-bkg-color: var(--fs-color-main-0);
  --fs-navbar-text-color: var(--fs-color-text-inverse);
}

[data-fs-search-input-field] {
  --fs-search-input-field-height-desktop: var(--fs-spacing-6);
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Using `!important` to Override Styles

**What happens**: Developer uses `!important` declarations throughout their theme to force style changes on FastStore components, often because they are fighting specificity issues from placing styles in the wrong location.

**Why it fails**: `!important` creates a specificity dead-end. Once used, every subsequent override also needs `!important`, creating an escalating specificity war. It makes the theme unmaintainable, hard to debug, and fragile during FastStore updates. It also defeats the cascading nature of design tokens — a token overridden with `!important` cannot be re-overridden by local tokens.

**Fix**: Use the correct design token in the correct location. Place global overrides in `:root` and component overrides under `[data-fs-*]` selectors. If a token override isn't working, check that the selector specificity is sufficient and that the file is in `src/themes/`.

```typescript
// src/themes/custom-theme.scss
// Use proper token targeting — no !important needed
[data-fs-buy-button] {
  --fs-button-primary-bkg-color: #e31c58;
  --fs-button-primary-bkg-color-hover: #c4174d;
}

// If you need higher specificity for a specific page context:
[data-fs-product-details] [data-fs-buy-button] {
  --fs-button-primary-bkg-color: #1c58e3;
}
```

---

### Anti-Pattern: Hardcoded Color and Size Values

**What happens**: Developer uses hardcoded hex colors, pixel sizes, and font values directly in component styles instead of referencing design tokens.

**Why it fails**: Hardcoded values cannot be updated globally. Changing the brand color requires finding and updating every hardcoded instance. It breaks the token hierarchy — other components that should share the same color won't. It also makes the store inconsistent when new sections or components are added, since they will use token defaults that don't match the hardcoded values.

**Fix**: Always reference design tokens. If a token for your need doesn't exist, override a global token in `:root` and reference it. Use local tokens for component-specific exceptions.

```typescript
// src/themes/custom-theme.scss
// Define brand colors as global tokens, then reference them
:root {
  --fs-color-accent-0: #e31c58;
  --fs-color-accent-1: #c4174d;
}

// Reference the tokens — never hardcode
[data-fs-buy-button] {
  --fs-button-primary-bkg-color: var(--fs-color-accent-0);
  --fs-button-primary-bkg-color-hover: var(--fs-color-accent-1);
}

[data-fs-badge] {
  --fs-badge-bkg-color: var(--fs-color-accent-0);
}
```

---

### Anti-Pattern: Creating a Parallel CSS System

**What happens**: Developer ignores FastStore's token system entirely and creates their own CSS framework alongside FastStore's styles (e.g., importing Tailwind, Bootstrap, or a custom global stylesheet that redefines base element styles).

**Why it fails**: A parallel CSS system conflicts with FastStore's structural styles and token architecture. Global resets or utility classes from Tailwind/Bootstrap can override FastStore's carefully tuned component styles. It doubles the CSS payload. Maintenance becomes a nightmare since two styling systems must be kept in sync. New team members must understand both systems.

**Fix**: Work within FastStore's token system for all FastStore components. If you need utility classes for custom (non-FastStore) components, scope them carefully using CSS modules to avoid affecting native components.

```typescript
// src/components/CustomBanner.module.scss
// Scoped styles for custom components — won't affect FastStore components
.customBanner {
  display: flex;
  align-items: center;
  gap: var(--fs-spacing-3); // Still reference FastStore tokens for consistency
  padding: var(--fs-spacing-4);
  background-color: var(--fs-color-main-0);
  color: var(--fs-color-text-inverse);
  border-radius: var(--fs-border-radius);
}

.customBannerTitle {
  font-family: var(--fs-text-face-title);
  font-size: var(--fs-text-size-title-subsection);
  font-weight: var(--fs-text-weight-bold);
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Theming overview](https://developers.vtex.com/docs/guides/faststore/using-themes-overview) — Introduction to theming concepts, Brandless architecture, and token hierarchy
- [Global tokens](https://developers.vtex.com/docs/guides/faststore/global-tokens-overview) — Complete reference for all global design tokens (colors, typography, spacing, borders)
- [Global tokens: Colors](https://developers.vtex.com/docs/guides/faststore/global-tokens-colors) — Color token reference and palette structure
- [Global tokens: Typography](https://developers.vtex.com/docs/guides/faststore/global-tokens-typography) — Font family, size, and weight tokens
- [Global tokens: Spacing](https://developers.vtex.com/docs/guides/faststore/global-tokens-spacing) — Spacing scale tokens
- [Styling a component](https://developers.vtex.com/docs/guides/faststore/using-themes-components) — Guide for customizing individual component styles with local tokens
- [Available themes](https://developers.vtex.com/docs/guides/faststore/themes-overview) — Pre-built themes (Midnight, Soft Blue) available as starting points
- [Importing FastStore UI component styles](https://developers.vtex.com/docs/guides/faststore/using-themes-importing-ui-components-styles) — How to import and use component styles in custom sections
- [FastStore Section & Component Overrides](../faststore-overrides/skill.md) — Related skill for when theming alone is insufficient and behavioral changes are needed
