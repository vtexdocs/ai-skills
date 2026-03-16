# VTEX Development Skills

These instructions provide guidance for AI-assisted VTEX platform development.

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

---

# Headless Front-End Development

# BFF Layer Design & Security

## Overview

**What this skill covers**: The Backend-for-Frontend (BFF) architecture pattern for headless VTEX storefronts, including secure API proxying, credential management, and the critical separation between public and private VTEX APIs.

**When to use it**: When building any headless frontend that communicates with VTEX APIs — whether a custom storefront, mobile app, or kiosk. Every headless project needs a BFF layer to protect API credentials and manage authentication tokens server-side.

**What you'll learn**:
- Why a BFF layer is mandatory for headless VTEX (not optional)
- How to classify VTEX APIs as public vs private and route them accordingly
- How to manage `VtexIdclientAutCookie` server-side and proxy authenticated requests
- How to protect `VTEX_APP_KEY` and `VTEX_APP_TOKEN` from client-side exposure

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Public vs Private VTEX APIs

VTEX APIs fall into two categories based on their authentication requirements:

- **Public APIs** (`/pub/` in the path): Can be called without API keys. Examples include Intelligent Search (`/api/io/_v/api/intelligent-search/`), Catalog public endpoints (`/api/catalog_system/pub/`), and Checkout public endpoints (`/api/checkout/pub/`). However, even public Checkout endpoints should still be proxied through BFF for security.
- **Private APIs** (`/pvt/` in the path): Require `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers. Examples include OMS (`/api/oms/pvt/`), Profile System (`/api/profile-system/pvt/`), and Pricing (`/api/pricing/pvt/`). These must NEVER be called from client-side code.

The only API safe to call directly from the frontend is Intelligent Search, because it is fully public and designed for client-side use.

### Concept 2: VtexIdclientAutCookie

When a shopper logs in to a VTEX store, the platform issues a JWT token set as a cookie named `VtexIdclientAutCookie`. This token:

- Is valid for 24 hours after creation
- Authenticates requests on behalf of the shopper
- Has scoped permissions (shoppers can only perform shopping-related actions)
- Must be stored and managed server-side in headless implementations
- Can be refreshed using the VTEX ID refresh token flow

In headless stores, the BFF layer intercepts the login callback, extracts the `VtexIdclientAutCookie`, stores it in a secure server-side session, and uses it to authenticate subsequent API calls on behalf of the shopper.

### Concept 3: Machine Authentication (API Keys)

For server-to-server communication where no shopper context is needed, VTEX uses application keys:

- `X-VTEX-API-AppKey`: The public identifier for the credential pair
- `X-VTEX-API-AppToken`: The secret token associated with the key

These credentials are configured in License Manager with specific roles and permissions. They must only exist in server-side environment variables and never be transmitted to or accessible from client-side code.

**Architecture/Data Flow**:

```text
Frontend (Browser/App)
    │
    ├── Direct call (OK): Intelligent Search API (public, read-only)
    │
    └── All other requests → BFF Layer (Node.js/Express)
                                │
                                ├── Injects VtexIdclientAutCookie from session
                                ├── Injects X-VTEX-API-AppKey / X-VTEX-API-AppToken
                                ├── Validates & sanitizes input
                                └── Proxies to VTEX APIs
                                        │
                                        ├── Checkout API (/api/checkout/pub/...)
                                        ├── OMS API (/api/oms/pvt/...)
                                        ├── Profile API (/api/profile-system/pvt/...)
                                        └── Other VTEX services
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Frontend MUST NOT Call Private VTEX APIs

**Rule**: Client-side code (browser JavaScript, mobile app networking layer) MUST NOT make direct HTTP requests to private VTEX API endpoints. All private API calls must be routed through the BFF.

**Why**: Private VTEX APIs require `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers. If the frontend calls these APIs directly, the credentials must be embedded in client-side code or transmitted to the browser, exposing them to any user who opens browser DevTools. Stolen API keys can be used to access order data, modify pricing, or perform destructive administrative actions.

**Detection**: If you see `fetch` or `axios` calls to `vtexcommercestable.com.br/api/checkout`, `/api/oms`, `/api/profile`, or any `/pvt/` endpoint in client-side code (files under `src/`, `public/`, `app/`, or any browser-executed bundle) → STOP immediately. These calls must be moved to the BFF.

✅ **CORRECT**:
```typescript
// Frontend code — calls BFF, not VTEX directly
async function getOrderDetails(orderId: string): Promise<Order> {
  const response = await fetch(`/api/bff/orders/${orderId}`, {
    credentials: "include", // sends session cookie to BFF
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch order: ${response.status}`);
  }

  return response.json();
}
```

❌ **WRONG**:
```typescript
// Frontend code — calls VTEX OMS API directly (SECURITY VULNERABILITY)
async function getOrderDetails(orderId: string): Promise<Order> {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/oms/pvt/orders/${orderId}`,
    {
      headers: {
        "X-VTEX-API-AppKey": "vtexappkey-mystore-ABCDEF", // EXPOSED!
        "X-VTEX-API-AppToken": "eyJhbGciOi...", // EXPOSED!
      },
    }
  );
  return response.json();
}
```

---

### Constraint: VtexIdclientAutCookie MUST Be Managed Server-Side

**Rule**: The `VtexIdclientAutCookie` token MUST be stored in a secure server-side session (e.g., encrypted cookie, Redis session store) and MUST NOT be stored in `localStorage`, `sessionStorage`, or any client-accessible JavaScript variable.

**Why**: The `VtexIdclientAutCookie` is a bearer token that authenticates all actions on behalf of a shopper — placing orders, viewing profile data, accessing payment information. If stored client-side, it can be stolen via XSS attacks, browser extensions, or shared/public computers. An attacker with this token can impersonate the shopper.

**Detection**: If you see `VtexIdclientAutCookie` referenced in `localStorage.setItem`, `sessionStorage.setItem`, or assigned to a JavaScript variable in client-side code → STOP immediately. The token must be managed exclusively server-side.

✅ **CORRECT**:
```typescript
// BFF route — stores VtexIdclientAutCookie in server-side session
import { Router, Request, Response } from "express";
import session from "express-session";

const router = Router();

// After VTEX login callback, extract and store token server-side
router.get("/auth/callback", async (req: Request, res: Response) => {
  const vtexAuthToken = req.cookies["VtexIdclientAutCookie"];

  if (!vtexAuthToken) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  // Store in server-side session — never sent to frontend
  req.session.vtexAuthToken = vtexAuthToken;

  // Clear the cookie from the browser response
  res.clearCookie("VtexIdclientAutCookie");

  // Redirect to frontend with a secure session cookie
  res.redirect("/account");
});

// BFF proxy uses session token for VTEX API calls
router.get("/api/bff/profile", async (req: Request, res: Response) => {
  const vtexToken = req.session.vtexAuthToken;

  if (!vtexToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const response = await fetch(
    `https://${process.env.VTEX_ACCOUNT}.vtexcommercestable.com.br/api/checkout/pub/profiles`,
    {
      headers: {
        Cookie: `VtexIdclientAutCookie=${vtexToken}`,
      },
    }
  );

  const profile = await response.json();
  res.json(profile);
});
```

❌ **WRONG**:
```typescript
// Frontend code — stores auth token in localStorage (SECURITY VULNERABILITY)
function handleLoginCallback() {
  const params = new URLSearchParams(window.location.search);
  const vtexToken = params.get("authToken");

  // WRONG: token is now accessible to any JS on the page, including XSS payloads
  localStorage.setItem("VtexIdclientAutCookie", vtexToken!);
}

// Later, reads from localStorage and sends in header
async function getProfile() {
  const token = localStorage.getItem("VtexIdclientAutCookie"); // EXPOSED!
  return fetch("https://mystore.vtexcommercestable.com.br/api/checkout/pub/profiles", {
    headers: { Cookie: `VtexIdclientAutCookie=${token}` },
  });
}
```

---

### Constraint: API Keys MUST NOT Appear in Client-Side Code

**Rule**: `VTEX_APP_KEY` and `VTEX_APP_TOKEN` values MUST only exist in server-side environment variables and MUST NOT be present in any file that is bundled, served, or accessible to the browser.

**Why**: API keys grant programmatic access to the VTEX platform with the permissions of their associated role. Exposing them in frontend bundles, public directories, or client-side environment variables (e.g., `NEXT_PUBLIC_*`, `VITE_*`) allows anyone to extract them and make unauthorized API calls.

**Detection**: If you see `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `X-VTEX-API-AppKey`, or `X-VTEX-API-AppToken` in files under `src/`, `public/`, `app/` directories, or in environment variables prefixed with `NEXT_PUBLIC_`, `VITE_`, or `REACT_APP_` → STOP immediately. Move these to server-side-only environment variables.

✅ **CORRECT**:
```typescript
// BFF server code — reads keys from server-side env vars only
// File: server/vtex-client.ts (never bundled for browser)
import { Router, Request, Response } from "express";

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

const router = Router();

router.get("/api/bff/orders/:orderId", async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const response = await fetch(
    `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br/api/oms/pvt/orders/${orderId}`,
    {
      headers: {
        "X-VTEX-API-AppKey": VTEX_APP_KEY,
        "X-VTEX-API-AppToken": VTEX_APP_TOKEN,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    return res.status(response.status).json({ error: "Failed to fetch order" });
  }

  const order = await response.json();
  res.json(order);
});

export default router;
```

❌ **WRONG**:
```typescript
// .env file with NEXT_PUBLIC_ prefix — exposed to browser bundle!
// NEXT_PUBLIC_VTEX_APP_KEY=vtexappkey-mystore-ABCDEF
// NEXT_PUBLIC_VTEX_APP_TOKEN=eyJhbGciOi...

// Frontend code reads exposed env vars
async function fetchOrders() {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/oms/pvt/orders`,
    {
      headers: {
        "X-VTEX-API-AppKey": process.env.NEXT_PUBLIC_VTEX_APP_KEY!, // EXPOSED IN BUNDLE!
        "X-VTEX-API-AppToken": process.env.NEXT_PUBLIC_VTEX_APP_TOKEN!, // EXPOSED IN BUNDLE!
      },
    }
  );
  return response.json();
}
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Set Up the BFF Server

Create an Express server that will serve as the BFF layer between your frontend and VTEX APIs. All VTEX credentials live exclusively in this server's environment.

```typescript
// server/index.ts
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import { checkoutRoutes } from "./routes/checkout";
import { profileRoutes } from "./routes/profile";
import { ordersRoutes } from "./routes/orders";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches VtexIdclientAutCookie TTL)
    },
  })
);

// Mount BFF routes
app.use("/api/bff/checkout", checkoutRoutes);
app.use("/api/bff/profile", profileRoutes);
app.use("/api/bff/orders", ordersRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BFF server running on port ${PORT}`);
});
```

### Step 2: Create a VTEX API Client with Credential Injection

Build a shared utility that injects the correct authentication headers for each request type — either API keys for machine-to-machine calls or `VtexIdclientAutCookie` for shopper-scoped calls.

```typescript
// server/vtex-api-client.ts
const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

const BASE_URL = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br`;

interface VtexRequestOptions {
  path: string;
  method?: string;
  body?: unknown;
  authType: "app-key" | "user-token";
  userToken?: string;
}

export async function vtexRequest<T>(options: VtexRequestOptions): Promise<T> {
  const { path, method = "GET", body, authType, userToken } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (authType === "app-key") {
    headers["X-VTEX-API-AppKey"] = VTEX_APP_KEY;
    headers["X-VTEX-API-AppToken"] = VTEX_APP_TOKEN;
  } else if (authType === "user-token" && userToken) {
    headers["Cookie"] = `VtexIdclientAutCookie=${userToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `VTEX API error: ${response.status} ${response.statusText} for ${method} ${path}`
    );
  }

  return response.json() as Promise<T>;
}
```

### Step 3: Implement BFF Route Handlers

Create route handlers that validate incoming requests, extract session data, and proxy to VTEX APIs with proper authentication.

```typescript
// server/routes/orders.ts
import { Router, Request, Response } from "express";
import { vtexRequest } from "../vtex-api-client";

export const ordersRoutes = Router();

// Get order details — requires API key auth (private endpoint)
ordersRoutes.get("/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Validate input
    if (!/^[a-zA-Z0-9-]+$/.test(orderId)) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    // Optionally check user session for authorization
    const vtexToken = req.session.vtexAuthToken;
    if (!vtexToken) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const order = await vtexRequest({
      path: `/api/oms/pvt/orders/${orderId}`,
      authType: "app-key",
    });

    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});
```

### Complete Example

A full BFF setup with authentication flow, session management, and API proxying:

```typescript
// server/routes/auth.ts
import { Router, Request, Response } from "express";

export const authRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_LOGIN_URL = `https://${VTEX_ACCOUNT}.myvtex.com/login`;
const FRONTEND_URL = process.env.FRONTEND_URL!;

// Redirect shopper to VTEX login page
authRoutes.get("/login", (_req: Request, res: Response) => {
  const returnUrl = `${FRONTEND_URL}/auth/callback`;
  res.redirect(`${VTEX_LOGIN_URL}?returnUrl=${encodeURIComponent(returnUrl)}`);
});

// Handle login callback — extract VtexIdclientAutCookie and store server-side
authRoutes.get("/callback", (req: Request, res: Response) => {
  const vtexToken = req.cookies["VtexIdclientAutCookie"];

  if (!vtexToken) {
    return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }

  // Store token in server-side session
  req.session.vtexAuthToken = vtexToken;

  // Clear the VTEX cookie from the browser
  res.clearCookie("VtexIdclientAutCookie");

  // Redirect to authenticated frontend page
  res.redirect(`${FRONTEND_URL}/account`);
});

// Logout — destroy session
authRoutes.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// Check authentication status
authRoutes.get("/status", (req: Request, res: Response) => {
  res.json({
    authenticated: !!req.session.vtexAuthToken,
  });
});
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Proxying All APIs Including Intelligent Search

**What happens**: Developers route every VTEX API call through the BFF, including Intelligent Search, adding unnecessary latency and server load to search queries.

**Why it fails**: Intelligent Search is a public, read-only API designed for direct frontend consumption. Proxying it through the BFF adds a network hop, increases latency on every search interaction, and puts unnecessary load on the BFF server. Search queries are high-frequency operations that benefit from direct CDN-cached responses.

**Fix**: Call Intelligent Search directly from the frontend. Only proxy APIs that require authentication or handle sensitive data.

```typescript
// Frontend code — call Intelligent Search directly (this is correct!)
async function searchProducts(query: string, from: number = 0, to: number = 19): Promise<SearchResult> {
  const baseUrl = `https://${STORE_ACCOUNT}.vtexcommercestable.com.br`;
  const response = await fetch(
    `${baseUrl}/api/io/_v/api/intelligent-search/product_search/?query=${encodeURIComponent(query)}&from=${from}&to=${to}&locale=en-US`,
  );
  return response.json();
}
```

---

### Anti-Pattern: Sharing a Single API Key Across All BFF Operations

**What happens**: Developers use one API key with broad permissions (e.g., Owner role) for all BFF operations instead of creating scoped keys for different operations.

**Why it fails**: If the API key is compromised (e.g., via a server vulnerability or log leak), the attacker gains access to every VTEX resource. The principle of least privilege requires that each key only has the permissions it needs.

**Fix**: Create separate API keys for different BFF modules with minimal required permissions. Use one key for OMS read access, another for checkout operations, etc.

```typescript
// server/vtex-credentials.ts — separate keys per domain
export const credentials = {
  oms: {
    appKey: process.env.VTEX_OMS_APP_KEY!,
    appToken: process.env.VTEX_OMS_APP_TOKEN!,
  },
  checkout: {
    appKey: process.env.VTEX_CHECKOUT_APP_KEY!,
    appToken: process.env.VTEX_CHECKOUT_APP_TOKEN!,
  },
  catalog: {
    appKey: process.env.VTEX_CATALOG_APP_KEY!,
    appToken: process.env.VTEX_CATALOG_APP_TOKEN!,
  },
} as const;
```

---

### Anti-Pattern: Logging API Credentials or Auth Tokens

**What happens**: Developers log request headers or full request objects during debugging, inadvertently writing API keys or `VtexIdclientAutCookie` values to log files.

**Why it fails**: Log files are often stored in centralized logging systems (e.g., CloudWatch, Datadog) accessible to multiple team members. Credentials in logs can be harvested by anyone with log access or by attackers who compromise the logging infrastructure.

**Fix**: Sanitize all log output to strip sensitive headers before logging. Never log full request/response objects.

```typescript
// server/middleware/request-logger.ts
import { Request, Response, NextFunction } from "express";

const SENSITIVE_HEADERS = [
  "x-vtex-api-appkey",
  "x-vtex-api-apptoken",
  "cookie",
  "authorization",
];

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  const sanitizedHeaders = Object.fromEntries(
    Object.entries(req.headers).map(([key, value]) =>
      SENSITIVE_HEADERS.includes(key.toLowerCase())
        ? [key, "[REDACTED]"]
        : [key, value]
    )
  );

  console.log({
    method: req.method,
    path: req.path,
    headers: sanitizedHeaders,
    timestamp: new Date().toISOString(),
  });

  next();
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — Core architecture guide for building headless stores on VTEX
- [Headless authentication](https://developers.vtex.com/docs/guides/headless-authentication) — OAuth-based shopper authentication flow for headless implementations
- [API authentication using API keys](https://developers.vtex.com/docs/guides/api-authentication-using-api-keys) — How to use appKey/appToken pairs for machine authentication
- [API authentication using user tokens](https://developers.vtex.com/docs/guides/api-authentication-using-user-tokens) — How VtexIdclientAutCookie works and its scopes
- [Refresh token flow for headless implementations](https://developers.vtex.com/docs/guides/refresh-token-flow-for-headless-implementations) — How to refresh expired VtexIdclientAutCookie tokens
- [Best practices for using application keys](https://help.vtex.com/en/tutorial/best-practices-api-keys--7b6nD1VMHa49aI5brlOvJm) — VTEX security guidelines for API key management

---

# Caching & Performance for Headless VTEX

## Overview

**What this skill covers**: Caching strategies for headless VTEX storefronts, including which APIs can be aggressively cached, which must never be cached, CDN configuration, BFF-level caching with `stale-while-revalidate` patterns, and cache invalidation strategies.

**When to use it**: When building or optimizing a headless VTEX storefront for performance. Proper caching is the single most impactful performance optimization for headless commerce — it reduces latency, server load, and API rate limit consumption while improving shopper experience.

**What you'll learn**:
- How to classify VTEX APIs into cacheable (public/read-only) vs non-cacheable (transactional/personal)
- How to implement CDN caching for Intelligent Search and Catalog APIs
- How to add BFF-level caching with `stale-while-revalidate` for optimal freshness/performance balance
- How to implement cache invalidation when catalog data changes

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: API Cacheability Classification

VTEX APIs fall into two categories based on whether their responses can be cached:

**Cacheable APIs** (public, read-only, non-personalized):
| API | Example Endpoints | Recommended TTL |
|---|---|---|
| Intelligent Search | `/api/io/_v/api/intelligent-search/product_search/` | 2-5 minutes |
| Catalog (public) | `/api/catalog_system/pub/category/tree/`, `/api/catalog_system/pub/products/search/` | 5-15 minutes |
| Intelligent Search autocomplete | `/api/io/_v/api/intelligent-search/autocomplete_suggestions` | 1-2 minutes |
| Intelligent Search top searches | `/api/io/_v/api/intelligent-search/top_searches` | 5-10 minutes |

**Non-cacheable APIs** (transactional, personalized, or sensitive):
| API | Example Endpoints | Why Not Cacheable |
|---|---|---|
| Checkout | `/api/checkout/pub/orderForm` | Cart data is per-user, changes with every action |
| Profile | `/api/profile-system/pvt/` | Personal data, GDPR/LGPD sensitive |
| OMS (Orders) | `/api/oms/pvt/orders` | Order status changes, user-specific |
| Payments | `/api/payments/` | Financial transactions, must always be real-time |
| Pricing (private) | `/api/pricing/pvt/` | May have per-user pricing rules |

### Concept 2: Cache Layers

In a headless VTEX architecture, caching can happen at multiple layers:

1. **CDN Edge Cache**: Caches responses closest to the user. Best for Intelligent Search (called directly from frontend). Use `Cache-Control` headers.
2. **BFF In-Memory Cache**: Caches VTEX API responses within the BFF process. Fast but limited by server memory. Good for category trees and top searches.
3. **BFF Distributed Cache (Redis/Memcached)**: Shared cache across multiple BFF instances. Best for catalog data that multiple users request.
4. **Browser Cache**: Client-side caching via `Cache-Control` headers. Good for static catalog data, but be careful with personalized data.

### Concept 3: Stale-While-Revalidate (SWR)

The `stale-while-revalidate` pattern serves cached (potentially stale) data immediately while asynchronously fetching fresh data in the background. This provides:

- **Instant responses**: Users see data immediately, even if slightly stale
- **Eventual freshness**: Cache is updated in the background for the next request
- **Resilience**: If the origin is down, stale data is still served

The HTTP header pattern: `Cache-Control: public, max-age=120, stale-while-revalidate=60`
- Serves cached data for 120 seconds without checking origin
- Between 120-180 seconds, serves stale data while fetching fresh data
- After 180 seconds, waits for fresh data before responding

### Concept 4: Cache Invalidation

Catalog data changes (product updates, price changes, new products) must eventually reflect on the storefront. Strategies:

- **Time-based (TTL)**: Set appropriate expiration times. Shorter TTL = fresher data but more origin load.
- **Event-driven**: Use VTEX webhooks/hooks to invalidate specific cache entries when data changes.
- **Manual purge**: Provide admin endpoints to force-clear cache for specific products or categories.

**Architecture/Data Flow**:

```text
Frontend (Browser)
    │
    ├── Direct to CDN (Intelligent Search)
    │   └── CDN Edge Cache (TTL: 2-5 min, SWR: 60s)
    │       └── VTEX Intelligent Search API
    │
    └── BFF Endpoints
        │
        ├── Cacheable routes (catalog, category tree)
        │   └── BFF Cache Layer (Redis/in-memory)
        │       └── VTEX Catalog API
        │
        └── Non-cacheable routes (checkout, profile, orders)
            └── Direct proxy to VTEX (NO CACHING)
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: MUST Cache Public Data Aggressively

**Rule**: Search results, catalog data, category trees, and other public read-only data MUST be cached at appropriate levels (CDN, BFF, or both). Without caching, every user request hits VTEX APIs directly.

**Why**: Without caching, a headless storefront generates an API request for every single page view, search, and category browse. This quickly exceeds VTEX API rate limits (causing 429 errors and degraded service), adds 200-500ms of latency per request, and creates a poor shopper experience. A store with 10,000 concurrent users making uncached search requests will overwhelm any API.

**Detection**: If a headless storefront calls Intelligent Search or Catalog APIs without any caching layer (no CDN cache headers, no BFF cache, no `Cache-Control` headers) → STOP immediately. Caching must be implemented for all public, read-only API responses.

✅ **CORRECT**:
```typescript
// BFF route with in-memory cache for category tree
import { Router, Request, Response } from "express";

const router = Router();

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  staleAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return {
    data: entry.data,
    isStale: now > entry.staleAt,
  };
}

function setCache<T>(key: string, data: T, maxAgeMs: number, swrMs: number): void {
  const now = Date.now();
  cache.set(key, {
    data,
    staleAt: now + maxAgeMs,
    expiresAt: now + maxAgeMs + swrMs,
  });
}

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const CATALOG_BASE = `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub`;

// Category tree — cache for 15 minutes, SWR for 5 minutes
router.get("/categories", async (_req: Request, res: Response) => {
  const cacheKey = "category-tree";
  const cached = getCached<unknown>(cacheKey);

  if (cached && !cached.isStale) {
    res.set("X-Cache", "HIT");
    return res.json(cached.data);
  }

  // If stale, serve stale data and refresh in background
  if (cached && cached.isStale) {
    res.set("X-Cache", "STALE");
    res.json(cached.data);

    // Background refresh
    fetch(`${CATALOG_BASE}/category/tree/3`)
      .then((r) => r.json())
      .then((data) => setCache(cacheKey, data, 15 * 60 * 1000, 5 * 60 * 1000))
      .catch((err) => console.error("Background cache refresh failed:", err));
    return;
  }

  // Cache miss — fetch and cache
  try {
    const response = await fetch(`${CATALOG_BASE}/category/tree/3`);
    const data = await response.json();
    setCache(cacheKey, data, 15 * 60 * 1000, 5 * 60 * 1000);
    res.set("X-Cache", "MISS");
    res.json(data);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});
```

❌ **WRONG**:
```typescript
// No caching — every request hits VTEX directly
router.get("/categories", async (_req: Request, res: Response) => {
  // This fires on EVERY request — 10,000 users = 10,000 API calls
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/catalog_system/pub/category/tree/3`
  );
  const data = await response.json();
  res.json(data); // No cache headers, no BFF cache, no CDN cache
});
```

---

### Constraint: MUST NOT Cache Transactional or Personal Data

**Rule**: Responses from Checkout API, Profile API, OMS API, and Payments API MUST NOT be cached at any layer — not in the CDN, not in BFF memory, not in Redis, and not in browser cache.

**Why**: Caching transactional data can cause catastrophic failures. A cached OrderForm means a shopper sees stale cart contents (wrong items, wrong prices). Cached profile data can leak one user's personal information to another user (especially behind shared caches). Cached order data shows stale statuses. Any of these is a security vulnerability, data privacy violation (GDPR/LGPD), or business logic failure.

**Detection**: If you see caching logic (Redis `set`, in-memory cache, `Cache-Control` headers with `max-age > 0`) applied to checkout, order, profile, or payment API responses → STOP immediately. These endpoints must always return fresh data.

✅ **CORRECT**:
```typescript
// BFF checkout route — explicitly no caching
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const checkoutRoutes = Router();

// Set no-cache headers for ALL checkout responses
checkoutRoutes.use((_req: Request, res: Response, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  next();
});

checkoutRoutes.get("/cart", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    // Always fetch fresh — never cache
    const result = await vtexCheckout({
      path: `/api/checkout/pub/orderForm/${orderFormId}`,
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});
```

❌ **WRONG**:
```typescript
// CATASTROPHIC: Caching checkout data in Redis
import Redis from "ioredis";
const redis = new Redis();

checkoutRoutes.get("/cart", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  const cacheKey = `cart:${orderFormId}`;

  // WRONG: cached cart could have wrong items, old prices, or stale quantities
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached)); // Serving stale transactional data!
  }

  const result = await vtexCheckout({
    path: `/api/checkout/pub/orderForm/${orderFormId}`,
    cookies: req.session.vtexCookies || {},
  });

  // WRONG: caching cart data that changes with every user action
  await redis.setex(cacheKey, 300, JSON.stringify(result.data));
  res.json(result.data);
});
```

---

### Constraint: MUST Implement Cache Invalidation Strategy

**Rule**: Every caching implementation MUST have a clear invalidation strategy. Cached data must have appropriate TTLs and there must be a mechanism to force-invalidate cache when the underlying data changes.

**Why**: Without invalidation, cached data becomes permanently stale. Products that are out of stock continue to appear available. Price changes don't reflect until the arbitrary TTL expires. New products are invisible. This leads to a poor shopper experience, failed orders (due to stale availability), and incorrect pricing.

**Detection**: If a caching implementation has no TTL (`max-age`, expiration time) or has very long TTLs (hours/days) without any invalidation mechanism → STOP immediately. All caches need bounded TTLs and ideally event-driven invalidation.

✅ **CORRECT**:
```typescript
// Cache with TTL + manual invalidation endpoint + event-driven invalidation
import { Router, Request, Response } from "express";

const router = Router();

// In-memory cache with TTL tracking
const productCache = new Map<string, { data: unknown; expiresAt: number }>();

function setProductCache(productId: string, data: unknown, ttlMs: number): void {
  productCache.set(productId, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function getProductCache(productId: string): unknown | null {
  const entry = productCache.get(productId);
  if (!entry || Date.now() > entry.expiresAt) {
    productCache.delete(productId);
    return null;
  }
  return entry.data;
}

// Regular product endpoint with cache
router.get("/products/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;
  const cached = getProductCache(productId);

  if (cached) {
    return res.json(cached);
  }

  const response = await fetch(
    `https://${process.env.VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`
  );
  const data = await response.json();

  setProductCache(productId, data, 5 * 60 * 1000); // 5-minute TTL
  res.json(data);
});

// Manual invalidation endpoint (secured with API key)
router.post("/cache/invalidate", (req: Request, res: Response) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { productId, pattern } = req.body as { productId?: string; pattern?: string };

  if (productId) {
    productCache.delete(productId);
    return res.json({ invalidated: [productId] });
  }

  if (pattern === "all") {
    const count = productCache.size;
    productCache.clear();
    return res.json({ invalidated: count });
  }

  res.status(400).json({ error: "Provide productId or pattern" });
});

// Webhook endpoint for VTEX catalog change events
router.post("/webhooks/catalog-change", (req: Request, res: Response) => {
  const { IdSku, productId } = req.body as { IdSku?: string; productId?: string };

  if (productId) {
    productCache.delete(productId);
    console.log(`Cache invalidated for product ${productId}`);
  }

  // Also invalidate related search cache entries
  // In production, use a more sophisticated invalidation strategy
  res.status(200).json({ received: true });
});

export default router;
```

❌ **WRONG**:
```typescript
// Cache with no TTL and no invalidation — data becomes permanently stale
const cache = new Map<string, unknown>();

router.get("/products/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;

  // Once cached, this data NEVER expires — price changes, stock updates are invisible
  if (cache.has(productId)) {
    return res.json(cache.get(productId));
  }

  const response = await fetch(`https://mystore.vtexcommercestable.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`);
  const data = await response.json();
  cache.set(productId, data); // No TTL! No invalidation! Stale forever!
  res.json(data);
});
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Set Up CDN Cache Headers for Intelligent Search

Since Intelligent Search is called directly from the frontend, use a CDN (e.g., Cloudflare, CloudFront, Fastly) to cache responses at the edge. Configure your CDN to respect `Cache-Control` headers or set custom caching rules for the search API path.

```typescript
// If you're using a CDN worker/edge function to add cache headers:
// cloudflare-worker.ts or similar edge function
async function handleSearchRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Only cache GET requests to Intelligent Search
  if (request.method !== "GET") {
    return fetch(request);
  }

  // Check CDN cache first
  const cacheKey = new Request(url.toString(), request);
  const cachedResponse = await caches.default.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Fetch from VTEX
  const response = await fetch(request);
  const responseClone = response.clone();

  // Add cache headers
  const cachedRes = new Response(responseClone.body, responseClone);
  cachedRes.headers.set(
    "Cache-Control",
    "public, max-age=120, stale-while-revalidate=60"
  );

  // Store in CDN cache
  await caches.default.put(cacheKey, cachedRes.clone());

  return cachedRes;
}
```

### Step 2: Implement BFF Cache Layer with Redis

For catalog data proxied through the BFF, use Redis as a shared cache that persists across BFF restarts and is shared across multiple instances.

```typescript
// server/cache/redis-cache.ts
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

interface CacheOptions {
  ttlSeconds: number;
  swrSeconds?: number;
}

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<{ data: T; cacheStatus: "HIT" | "STALE" | "MISS" }> {
  const { ttlSeconds, swrSeconds = 0 } = options;

  // Try to get from cache
  const cached = await redis.get(key);
  if (cached) {
    const ttl = await redis.ttl(key);
    const isStale = ttl <= swrSeconds;

    if (isStale && swrSeconds > 0) {
      // Serve stale, refresh in background
      fetcher()
        .then((freshData) =>
          redis.setex(key, ttlSeconds + swrSeconds, JSON.stringify(freshData))
        )
        .catch((err) => console.error(`Background refresh failed for ${key}:`, err));

      return { data: JSON.parse(cached) as T, cacheStatus: "STALE" };
    }

    return { data: JSON.parse(cached) as T, cacheStatus: "HIT" };
  }

  // Cache miss — fetch and store
  const data = await fetcher();
  await redis.setex(key, ttlSeconds + swrSeconds, JSON.stringify(data));

  return { data, cacheStatus: "MISS" };
}

export async function invalidateCache(pattern: string): Promise<number> {
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return 0;
  return redis.del(...keys);
}
```

### Step 3: Apply Caching to BFF Routes Selectively

Only cache public, read-only data. Never cache checkout, profile, or order data.

```typescript
// server/routes/catalog.ts
import { Router, Request, Response } from "express";
import { getCachedOrFetch, invalidateCache } from "../cache/redis-cache";

const router = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_BASE = `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br`;

// Category tree — long cache, changes rarely
router.get("/categories", async (_req: Request, res: Response) => {
  try {
    const result = await getCachedOrFetch(
      "catalog:categories",
      async () => {
        const response = await fetch(`${VTEX_BASE}/api/catalog_system/pub/category/tree/3`);
        return response.json();
      },
      { ttlSeconds: 900, swrSeconds: 300 } // 15 min cache, 5 min SWR
    );

    res.set("X-Cache", result.cacheStatus);
    res.json(result.data);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Product details — moderate cache
router.get("/products/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;

  if (!/^\d+$/.test(productId)) {
    return res.status(400).json({ error: "Invalid product ID" });
  }

  try {
    const result = await getCachedOrFetch(
      `catalog:product:${productId}`,
      async () => {
        const response = await fetch(
          `${VTEX_BASE}/api/catalog_system/pub/products/search?fq=productId:${productId}`
        );
        return response.json();
      },
      { ttlSeconds: 300, swrSeconds: 60 } // 5 min cache, 1 min SWR
    );

    res.set("X-Cache", result.cacheStatus);
    res.json(result.data);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Cart simulation — very short cache (same cart config may be checked by many users)
router.post("/simulation", async (req: Request, res: Response) => {
  const cacheKey = `catalog:simulation:${JSON.stringify(req.body)}`;

  try {
    const result = await getCachedOrFetch(
      cacheKey,
      async () => {
        const response = await fetch(
          `${VTEX_BASE}/api/checkout/pub/orderForms/simulation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
          }
        );
        return response.json();
      },
      { ttlSeconds: 30, swrSeconds: 10 } // 30 sec cache, 10 sec SWR
    );

    res.set("X-Cache", result.cacheStatus);
    res.json(result.data);
  } catch (error) {
    console.error("Error simulating cart:", error);
    res.status(500).json({ error: "Failed to simulate cart" });
  }
});

// Webhook for catalog changes — invalidates affected cache
router.post("/webhooks/catalog", async (req: Request, res: Response) => {
  const { productId } = req.body as { productId?: string };

  if (productId) {
    await invalidateCache(`catalog:product:${productId}`);
  }

  // Invalidate category tree on any catalog change
  await invalidateCache("catalog:categories");

  res.status(200).json({ received: true });
});

export default router;
```

### Complete Example

Full caching setup with CDN headers, BFF cache, and no-cache enforcement for transactional routes:

```typescript
// server/middleware/cache-headers.ts
import { Request, Response, NextFunction } from "express";

// Middleware to set appropriate cache headers based on route type
export function cacheHeaders(type: "public" | "private" | "no-cache") {
  return (_req: Request, res: Response, next: NextFunction) => {
    switch (type) {
      case "public":
        res.set({
          "Cache-Control": "public, max-age=120, stale-while-revalidate=60",
          Vary: "Accept-Encoding",
        });
        break;
      case "private":
        res.set({
          "Cache-Control": "private, max-age=60",
          Vary: "Accept-Encoding, Cookie",
        });
        break;
      case "no-cache":
        res.set({
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "Surrogate-Control": "no-store",
        });
        break;
    }
    next();
  };
}

// server/index.ts — apply cache strategies per route group
import express from "express";
import { cacheHeaders } from "./middleware/cache-headers";
import catalogRoutes from "./routes/catalog";
import { checkoutRoutes } from "./routes/checkout";
import { orderRoutes } from "./routes/orders";
import { profileRoutes } from "./routes/profile";

const app = express();
app.use(express.json());

// Cacheable routes — public catalog data
app.use("/api/bff/catalog", cacheHeaders("public"), catalogRoutes);

// Non-cacheable routes — transactional and personal data
app.use("/api/bff/checkout", cacheHeaders("no-cache"), checkoutRoutes);
app.use("/api/bff/orders", cacheHeaders("no-cache"), orderRoutes);
app.use("/api/bff/profile", cacheHeaders("no-cache"), profileRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BFF server running on port ${PORT}`);
});
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Caching Based on Session or User Identity

**What happens**: Developers create per-user caches for catalog data (e.g., caching product search results keyed by user ID).

**Why it fails**: Catalog data is the same for all anonymous users in the same trade policy. Creating per-user cache entries multiplies storage requirements by the number of users and eliminates the primary benefit of caching (serving the same response to many users). A store with 50,000 users and 1,000 unique searches would create 50 million cache entries instead of 1,000.

**Fix**: Cache public API responses by request URL/params only, not by user. Only skip cache or add user context for personalized pricing scenarios tied to specific trade policies.

```typescript
// Cache key based on request parameters only — not user identity
function buildCacheKey(path: string, params: Record<string, string>): string {
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `search:${path}:${sortedParams}`;
}

// For trade-policy-specific pricing, include trade policy (not user ID)
function buildTradePolicyCacheKey(path: string, params: Record<string, string>, tradePolicy: string): string {
  return `search:tp${tradePolicy}:${path}:${new URLSearchParams(params).toString()}`;
}
```

---

### Anti-Pattern: Setting Extremely Long Cache TTLs Without Invalidation

**What happens**: Developers set cache TTLs of hours or days to maximize cache hit rates, but provide no invalidation mechanism.

**Why it fails**: Long TTLs mean that price changes, stock updates, and new product launches are invisible to shoppers for hours or days. A product that sells out continues to appear available. A flash sale price doesn't take effect until the cache expires. This leads to failed orders, customer frustration, and potential legal issues with displayed pricing.

**Fix**: Use moderate TTLs (2-15 minutes for search, 5-15 minutes for catalog) combined with event-driven invalidation. The `stale-while-revalidate` pattern allows instant responses while still checking for fresh data regularly.

```typescript
// Moderate TTL with stale-while-revalidate — balances freshness and performance
const CACHE_CONFIG = {
  search: { ttlSeconds: 120, swrSeconds: 60 },      // 2 min + 1 min SWR
  categories: { ttlSeconds: 900, swrSeconds: 300 },  // 15 min + 5 min SWR
  product: { ttlSeconds: 300, swrSeconds: 60 },       // 5 min + 1 min SWR
  topSearches: { ttlSeconds: 600, swrSeconds: 120 },  // 10 min + 2 min SWR
} as const;
```

---

### Anti-Pattern: No Cache Monitoring or Observability

**What happens**: Developers implement caching but have no way to measure cache hit rates, miss rates, or stale-serve rates.

**Why it fails**: Without monitoring, you cannot tell if caching is effective, if TTLs are appropriate, or if cache invalidation is working. A cache with a 5% hit rate provides almost no benefit while adding complexity. A cache that never invalidates may be serving stale data without anyone noticing.

**Fix**: Add cache status headers and logging to track hit/miss/stale rates. Monitor these metrics in your observability platform.

```typescript
// Add cache observability to every cached response
import { Request, Response, NextFunction } from "express";

interface CacheMetrics {
  hits: number;
  misses: number;
  stale: number;
}

const metrics: CacheMetrics = { hits: 0, misses: 0, stale: 0 };

export function trackCacheMetrics(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown) {
    const cacheStatus = res.getHeader("X-Cache") as string;

    if (cacheStatus === "HIT") metrics.hits++;
    else if (cacheStatus === "MISS") metrics.misses++;
    else if (cacheStatus === "STALE") metrics.stale++;

    return originalJson(body);
  };

  next();
}

// Expose metrics endpoint for monitoring
export function getCacheMetrics(): CacheMetrics & { hitRate: string } {
  const total = metrics.hits + metrics.misses + metrics.stale;
  const hitRate = total > 0 ? ((metrics.hits / total) * 100).toFixed(1) + "%" : "N/A";
  return { ...metrics, hitRate };
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [How the cache works](https://help.vtex.com/en/docs/tutorials/understanding-how-the-cache-works) — VTEX native caching behavior and cache layer architecture
- [Cloud infrastructure](https://developers.vtex.com/docs/guides/cloud-infrastructure) — VTEX CDN, router, and caching infrastructure overview
- [Best practices for avoiding rate limit errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Caching as a strategy to avoid API rate limits
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — Cache patterns for VTEX IO (useful reference for cache scope concepts)
- [Intelligent Search API](https://developers.vtex.com/docs/api-reference/intelligent-search-api) — The primary cacheable API for headless storefronts
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores

---

# Checkout API Proxy & OrderForm Management

## Overview

**What this skill covers**: How to securely proxy VTEX Checkout API operations through a BFF layer in headless implementations, including OrderForm lifecycle management, cart operations, order placement, and the checkout completion flow.

**When to use it**: When building any headless storefront that needs shopping cart and checkout functionality. Every cart and checkout operation must go through the BFF — the Checkout API handles sensitive customer data (profile, address, payment) and must never be called directly from client-side code.

**What you'll learn**:
- The OrderForm data structure and its lifecycle from cart creation to order placement
- How to proxy all Checkout API operations through the BFF securely
- How to manage `orderFormId` and `CheckoutOrderFormOwnership` cookie server-side
- How to validate inputs server-side before forwarding to VTEX

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: The OrderForm

The `orderForm` is the central data structure of VTEX Checkout. It contains every piece of information about a purchase:

- **items**: Products in the cart (SKU ID, quantity, seller, price)
- **clientProfileData**: Customer profile (email, name, document, phone)
- **shippingData**: Delivery address and selected shipping option
- **paymentData**: Payment method, installments, card info
- **marketingData**: Coupons, UTM parameters
- **totalizers**: Subtotals, discounts, shipping costs

Each `orderForm` has a unique `orderFormId` that identifies the cart. When you call `GET /api/checkout/pub/orderForm`, VTEX either returns the current cart (if one exists for the session) or creates a new one.

### Concept 2: OrderForm Sections (Attachments)

Cart data is organized into "attachments" — sections of the OrderForm that can be updated independently:

| Attachment | Endpoint | Purpose |
|---|---|---|
| items | `POST .../orderForm/{id}/items` | Add, remove, or update cart items |
| clientProfileData | `POST .../orderForm/{id}/attachments/clientProfileData` | Customer profile info |
| shippingData | `POST .../orderForm/{id}/attachments/shippingData` | Address and delivery option |
| paymentData | `POST .../orderForm/{id}/attachments/paymentData` | Payment method selection |
| marketingData | `POST .../orderForm/{id}/attachments/marketingData` | Coupons and UTM data |

Each attachment update returns the full updated `orderForm`, so you always have the current state.

### Concept 3: Order Placement Flow

Placing an order in VTEX follows a strict 3-step sequence that must complete within 5 minutes:

1. **Place order**: `POST /api/checkout/pub/orderForm/{orderFormId}/transaction` — Creates the order from the cart
2. **Send payment**: `POST /api/payments/transactions/{transactionId}/payments` — Sends payment details to the gateway
3. **Process order**: `POST /api/checkout/pub/gatewayCallback/{orderGroup}` — Triggers order processing

If steps 2 and 3 are not completed within 5 minutes of step 1, the order is automatically canceled and marked as `incomplete`.

### Concept 4: CheckoutOrderFormOwnership Cookie

When a new cart is created, VTEX sends a `CheckoutOrderFormOwnership` cookie alongside the `checkout.vtex.com` cookie. This cookie ensures that only the customer who created the cart can access their personal information (profile, address). Without it, personal data in the OrderForm is masked.

In a headless BFF, you must:
1. Capture the `CheckoutOrderFormOwnership` cookie from VTEX responses
2. Store it in the server-side session alongside the `orderFormId`
3. Forward it back to VTEX on subsequent checkout requests

**Architecture/Data Flow**:

```text
Frontend
    │
    └── POST /api/bff/cart/items/add  {skuId, quantity, seller}
            │
            BFF Layer
            │ 1. Validates input (skuId format, quantity > 0, seller exists)
            │ 2. Reads orderFormId from server-side session
            │ 3. Forwards CheckoutOrderFormOwnership cookie
            │ 4. Calls VTEX: POST /api/checkout/pub/orderForm/{id}/items
            │ 5. Updates session with new orderFormId if changed
            │ 6. Returns sanitized orderForm to frontend
            │
            VTEX Checkout API
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: ALL Checkout Operations MUST Go Through BFF

**Rule**: Client-side code MUST NOT make direct HTTP requests to any VTEX Checkout API endpoint (`/api/checkout/`). All checkout operations — cart creation, item management, profile updates, shipping, payment, and order placement — must be proxied through the BFF layer.

**Why**: Checkout endpoints handle sensitive personal data (email, address, phone, payment details). Direct frontend calls expose the request/response flow to browser DevTools, extensions, and XSS attacks. Additionally, the BFF layer is needed to manage `VtexIdclientAutCookie` and `CheckoutOrderFormOwnership` cookies server-side, validate inputs, and prevent cart manipulation (e.g., price tampering).

**Detection**: If you see `fetch` or `axios` calls to `/api/checkout/` in any client-side code (browser-executed JavaScript, frontend source files) → STOP immediately. All checkout calls must route through BFF endpoints.

✅ **CORRECT**:
```typescript
// Frontend — calls BFF endpoint, never VTEX directly
async function addItemToCart(skuId: string, quantity: number, seller: string): Promise<OrderForm> {
  const response = await fetch("/api/bff/cart/items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skuId, quantity, seller }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add item: ${response.status}`);
  }

  return response.json();
}
```

❌ **WRONG**:
```typescript
// Frontend — calls VTEX Checkout API directly (SECURITY VULNERABILITY)
async function addItemToCart(skuId: string, quantity: number, seller: string): Promise<OrderForm> {
  const orderFormId = localStorage.getItem("orderFormId"); // Also wrong: see next constraint
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm/${orderFormId}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderItems: [{ id: skuId, quantity, seller }],
      }),
    }
  );
  return response.json();
}
```

---

### Constraint: orderFormId MUST Be Managed Server-Side

**Rule**: The `orderFormId` MUST be stored in a secure server-side session. It SHOULD NOT be stored in `localStorage`, `sessionStorage`, or exposed to the frontend in a way that allows direct VTEX API calls.

**Why**: The `orderFormId` is the key to a customer's shopping cart and all data within it — profile information, shipping address, payment details. If exposed client-side, an attacker could use it to query VTEX directly and retrieve personal data, or manipulate the cart by adding/removing items through direct API calls bypassing any validation logic.

**Detection**: If you see `orderFormId` stored in `localStorage` or `sessionStorage` → STOP immediately. It should be managed in the BFF session.

✅ **CORRECT**:
```typescript
// BFF — manages orderFormId in server-side session
import { Router, Request, Response } from "express";
import { vtexCheckoutRequest } from "../vtex-api-client";

export const cartRoutes = Router();

// Get or create cart — orderFormId stays server-side
cartRoutes.get("/", async (req: Request, res: Response) => {
  try {
    let orderFormId = req.session.orderFormId;

    if (orderFormId) {
      // Retrieve existing cart
      const orderForm = await vtexCheckoutRequest({
        path: `/api/checkout/pub/orderForm/${orderFormId}`,
        method: "GET",
        cookies: req.session.vtexCookies,
      });
      return res.json(sanitizeOrderForm(orderForm));
    }

    // Create new cart
    const orderForm = await vtexCheckoutRequest({
      path: "/api/checkout/pub/orderForm",
      method: "GET",
      cookies: req.session.vtexCookies,
    });

    // Store orderFormId in session — never expose raw ID to frontend
    req.session.orderFormId = orderForm.orderFormId;
    req.session.vtexCookies = orderForm._cookies; // Store checkout cookies

    res.json(sanitizeOrderForm(orderForm));
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Failed to get cart" });
  }
});

// Remove sensitive data before sending to frontend
function sanitizeOrderForm(orderForm: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...orderForm };
  delete sanitized._cookies;
  return sanitized;
}
```

❌ **WRONG**:
```typescript
// Frontend — stores orderFormId in localStorage (INSECURE)
async function getCart(): Promise<OrderForm> {
  let orderFormId = localStorage.getItem("orderFormId"); // EXPOSED to client

  if (!orderFormId) {
    const response = await fetch(
      "https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm"
    );
    const data = await response.json();
    orderFormId = data.orderFormId;
    localStorage.setItem("orderFormId", orderFormId!); // Stored client-side!
  }

  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm/${orderFormId}`
  );
  return response.json();
}
```

---

### Constraint: MUST Validate All Inputs Server-Side

**Rule**: The BFF MUST validate all input data before forwarding requests to the VTEX Checkout API. This includes validating SKU IDs, quantities, email formats, address fields, and coupon codes.

**Why**: Without server-side validation, malicious users can send crafted requests through the BFF to VTEX with invalid or manipulative data — negative quantities, SQL injection in text fields, or spoofed seller IDs. While VTEX has its own validation, defense-in-depth requires validating at the BFF layer to catch issues early and provide clear error messages.

**Detection**: If BFF route handlers pass `req.body` directly to VTEX API calls without any validation or sanitization → STOP immediately. All inputs must be validated before proxying.

✅ **CORRECT**:
```typescript
// BFF — validates inputs before forwarding to VTEX
import { Router, Request, Response } from "express";
import { vtexCheckoutRequest } from "../vtex-api-client";

export const cartItemsRoutes = Router();

interface AddItemRequest {
  skuId: string;
  quantity: number;
  seller: string;
}

function validateAddItemInput(body: unknown): body is AddItemRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;

  return (
    typeof b.skuId === "string" &&
    /^\d+$/.test(b.skuId) &&
    typeof b.quantity === "number" &&
    Number.isInteger(b.quantity) &&
    b.quantity > 0 &&
    b.quantity <= 100 &&
    typeof b.seller === "string" &&
    /^[a-zA-Z0-9]+$/.test(b.seller)
  );
}

cartItemsRoutes.post("/", async (req: Request, res: Response) => {
  if (!validateAddItemInput(req.body)) {
    return res.status(400).json({
      error: "Invalid input",
      details: "skuId must be numeric, quantity must be 1-100, seller must be alphanumeric",
    });
  }

  const { skuId, quantity, seller } = req.body;
  const orderFormId = req.session.orderFormId;

  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    const orderForm = await vtexCheckoutRequest({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
      method: "POST",
      body: {
        orderItems: [{ id: skuId, quantity, seller }],
      },
      cookies: req.session.vtexCookies,
    });

    res.json(sanitizeOrderForm(orderForm));
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});
```

❌ **WRONG**:
```typescript
// BFF — passes raw input to VTEX without validation (UNSAFE)
cartRoutes.post("/items", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;

  // No validation — attacker can send any payload
  const orderForm = await vtexCheckoutRequest({
    path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
    method: "POST",
    body: req.body, // Raw, unvalidated input passed directly!
    cookies: req.session.vtexCookies,
  });

  res.json(orderForm);
});
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Create a VTEX Checkout API Client

Build a shared utility that handles authentication and cookie management for all Checkout API calls.

```typescript
// server/vtex-checkout-client.ts
const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const BASE_URL = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br`;

interface CheckoutRequestOptions {
  path: string;
  method?: string;
  body?: unknown;
  cookies?: Record<string, string>;
  userToken?: string;
}

interface CheckoutResponse<T = unknown> {
  data: T;
  cookies: Record<string, string>;
}

export async function vtexCheckout<T>(
  options: CheckoutRequestOptions
): Promise<CheckoutResponse<T>> {
  const { path, method = "GET", body, cookies = {}, userToken } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // Build cookie header from stored cookies
  const cookieParts: string[] = [];
  if (cookies["checkout.vtex.com"]) {
    cookieParts.push(`checkout.vtex.com=${cookies["checkout.vtex.com"]}`);
  }
  if (cookies["CheckoutOrderFormOwnership"]) {
    cookieParts.push(`CheckoutOrderFormOwnership=${cookies["CheckoutOrderFormOwnership"]}`);
  }
  if (userToken) {
    cookieParts.push(`VtexIdclientAutCookie=${userToken}`);
  }
  if (cookieParts.length > 0) {
    headers["Cookie"] = cookieParts.join("; ");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Checkout API error: ${response.status} for ${method} ${path}: ${errorBody}`
    );
  }

  // Extract cookies from response for session storage
  const responseCookies: Record<string, string> = {};
  const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookieHeaders) {
    const [nameValue] = setCookie.split(";");
    const [name, value] = nameValue.split("=");
    if (name && value) {
      responseCookies[name.trim()] = value.trim();
    }
  }

  const data = (await response.json()) as T;
  return { data, cookies: { ...cookies, ...responseCookies } };
}
```

### Step 2: Implement Cart Management BFF Routes

Create BFF endpoints for all cart operations: get cart, add items, update items, remove items.

```typescript
// server/routes/cart.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const cartRoutes = Router();

interface OrderForm {
  orderFormId: string;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
    imageUrl: string;
    seller: string;
  }>;
  totalizers: Array<{ id: string; name: string; value: number }>;
  value: number;
  [key: string]: unknown;
}

// GET /api/bff/cart — get or create cart
cartRoutes.get("/", async (req: Request, res: Response) => {
  try {
    const result = await vtexCheckout<OrderForm>({
      path: req.session.orderFormId
        ? `/api/checkout/pub/orderForm/${req.session.orderFormId}`
        : "/api/checkout/pub/orderForm",
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.orderFormId = result.data.orderFormId;
    req.session.vtexCookies = result.cookies;

    res.json(result.data);
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Failed to get cart" });
  }
});

// POST /api/bff/cart/items — add items to cart
cartRoutes.post("/items", async (req: Request, res: Response) => {
  const { items } = req.body as {
    items: Array<{ id: string; quantity: number; seller: string }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }

  for (const item of items) {
    if (!item.id || typeof item.quantity !== "number" || item.quantity < 1 || !item.seller) {
      return res.status(400).json({ error: "Each item must have id, quantity (>0), and seller" });
    }
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart. Call GET /api/bff/cart first." });
  }

  try {
    const result = await vtexCheckout<OrderForm>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
      method: "POST",
      body: { orderItems: items },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error adding items:", error);
    res.status(500).json({ error: "Failed to add items to cart" });
  }
});

// PATCH /api/bff/cart/items/:index — update item quantity
cartRoutes.patch("/items/:index", async (req: Request, res: Response) => {
  const index = parseInt(req.params.index, 10);
  const { quantity } = req.body as { quantity: number };

  if (isNaN(index) || index < 0) {
    return res.status(400).json({ error: "Invalid item index" });
  }
  if (typeof quantity !== "number" || quantity < 0) {
    return res.status(400).json({ error: "Quantity must be a non-negative number" });
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    const result = await vtexCheckout<OrderForm>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items/${index}`,
      method: "PATCH",
      body: { quantity },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});
```

### Step 3: Implement Order Placement BFF Route

The order placement flow is a multi-step process that must complete within 5 minutes.

```typescript
// server/routes/order.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const orderRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

interface PlaceOrderResponse {
  orders: Array<{ orderId: string; transactionData: { merchantTransactions: Array<{ transactionId: string }> } }>;
  orderGroup: string;
}

// POST /api/bff/order/place — place order from existing cart
orderRoutes.post("/place", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    // Step 1: Place order from existing cart
    const placeResult = await vtexCheckout<PlaceOrderResponse>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/transaction`,
      method: "POST",
      body: { referenceId: orderFormId },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    const { orders, orderGroup } = placeResult.data;

    if (!orders || orders.length === 0) {
      return res.status(500).json({ error: "Order placement returned no orders" });
    }

    const orderId = orders[0].orderId;
    const transactionId =
      orders[0].transactionData.merchantTransactions[0]?.transactionId;

    // Step 2: Send payment info (from frontend-provided payment data)
    const { paymentData } = req.body as {
      paymentData: {
        paymentSystem: number;
        installments: number;
        value: number;
        referenceValue: number;
      };
    };

    if (!paymentData) {
      return res.status(400).json({ error: "Payment data is required" });
    }

    const paymentUrl = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br/api/payments/transactions/${transactionId}/payments`;
    const paymentResponse = await fetch(paymentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VTEX-API-AppKey": VTEX_APP_KEY,
        "X-VTEX-API-AppToken": VTEX_APP_TOKEN,
      },
      body: JSON.stringify([
        {
          paymentSystem: paymentData.paymentSystem,
          installments: paymentData.installments,
          currencyCode: "BRL",
          value: paymentData.value,
          installmentsInterestRate: 0,
          installmentsValue: paymentData.value,
          referenceValue: paymentData.referenceValue,
          fields: {},
          transaction: { id: transactionId, merchantName: VTEX_ACCOUNT },
        },
      ]),
    });

    if (!paymentResponse.ok) {
      return res.status(500).json({ error: "Payment submission failed" });
    }

    // Step 3: Process order (trigger gateway callback)
    const processResult = await vtexCheckout<unknown>({
      path: `/api/checkout/pub/gatewayCallback/${orderGroup}`,
      method: "POST",
      cookies: req.session.vtexCookies || {},
    });

    // Clear cart session after successful order
    delete req.session.orderFormId;
    delete req.session.vtexCookies;

    res.json({
      orderId,
      orderGroup,
      transactionId,
      status: "placed",
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
});
```

### Complete Example

Full BFF cart and checkout flow wired together:

```typescript
// server/index.ts — mount all checkout routes
import express from "express";
import session from "express-session";
import { cartRoutes } from "./routes/cart";
import { orderRoutes } from "./routes/order";

const app = express();

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Cart routes: GET /api/bff/cart, POST /api/bff/cart/items, PATCH /api/bff/cart/items/:index
app.use("/api/bff/cart", cartRoutes);

// Order routes: POST /api/bff/order/place
app.use("/api/bff/order", orderRoutes);

// Attachment routes for profile, shipping, payment
app.post("/api/bff/cart/profile", async (req, res) => {
  const { email, firstName, lastName, document, documentType, phone } = req.body;

  // Validate email format
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  const { vtexCheckout } = await import("./vtex-checkout-client");
  const result = await vtexCheckout({
    path: `/api/checkout/pub/orderForm/${orderFormId}/attachments/clientProfileData`,
    method: "POST",
    body: { email, firstName, lastName, document, documentType, phone },
    cookies: req.session.vtexCookies || {},
    userToken: req.session.vtexAuthToken,
  });

  req.session.vtexCookies = result.cookies;
  res.json(result.data);
});

app.post("/api/bff/cart/shipping", async (req, res) => {
  const { address, logisticsInfo } = req.body;

  if (!address || !address.postalCode || !address.country) {
    return res.status(400).json({ error: "Address with postalCode and country is required" });
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  const { vtexCheckout } = await import("./vtex-checkout-client");
  const result = await vtexCheckout({
    path: `/api/checkout/pub/orderForm/${orderFormId}/attachments/shippingData`,
    method: "POST",
    body: {
      clearAddressIfPostalCodeNotFound: false,
      selectedAddresses: [address],
      logisticsInfo: logisticsInfo || [],
    },
    cookies: req.session.vtexCookies || {},
    userToken: req.session.vtexAuthToken,
  });

  req.session.vtexCookies = result.cookies;
  res.json(result.data);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BFF server running on port ${PORT}`);
});
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Creating a New Cart on Every Page Load

**What happens**: Developers call `GET /api/checkout/pub/orderForm` (without an `orderFormId`) on every page load, creating a new empty cart each time instead of retrieving the existing one.

**Why it fails**: Each call without an `orderFormId` creates a new cart, abandoning the previous one. Items the shopper added are lost. VTEX creates orphaned orderForms that consume resources. The shopper must re-add all items every time they navigate.

**Fix**: Always store and reuse the `orderFormId` from the server-side session. Only call the "create new cart" endpoint when no `orderFormId` exists.

```typescript
// Always check for existing orderFormId first
cartRoutes.get("/", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;

  const path = orderFormId
    ? `/api/checkout/pub/orderForm/${orderFormId}` // Retrieve existing cart
    : "/api/checkout/pub/orderForm"; // Create new cart only if none exists

  const result = await vtexCheckout<OrderForm>({
    path,
    cookies: req.session.vtexCookies || {},
    userToken: req.session.vtexAuthToken,
  });

  req.session.orderFormId = result.data.orderFormId;
  req.session.vtexCookies = result.cookies;
  res.json(result.data);
});
```

---

### Anti-Pattern: Ignoring the 5-Minute Order Processing Window

**What happens**: Developers place an order (step 1) but delay sending payment information or processing the order, exceeding the 5-minute window.

**Why it fails**: VTEX automatically cancels orders that are not fully processed within 5 minutes of placement. The order is tagged as `incomplete` and the customer must start the checkout flow over. This creates a terrible user experience and potential inventory issues.

**Fix**: Execute all three order placement steps (place order → send payment → process order) sequentially and immediately in a single BFF request handler. Never split these across multiple independent frontend calls.

```typescript
// Execute all 3 steps in a single, synchronous flow
orderRoutes.post("/place", async (req: Request, res: Response) => {
  try {
    // Step 1: Place order — starts the 5-minute timer
    const placeResult = await vtexCheckout<PlaceOrderResponse>({
      path: `/api/checkout/pub/orderForm/${req.session.orderFormId}/transaction`,
      method: "POST",
      body: { referenceId: req.session.orderFormId },
      cookies: req.session.vtexCookies || {},
    });

    // Step 2: Send payment — immediately after placement
    await sendPayment(placeResult.data);

    // Step 3: Process order — immediately after payment
    await processOrder(placeResult.data.orderGroup);

    res.json({ success: true, orderId: placeResult.data.orders[0].orderId });
  } catch (error) {
    console.error("Order placement failed:", error);
    res.status(500).json({ error: "Order placement failed" });
  }
});
```

---

### Anti-Pattern: Exposing Raw VTEX Error Messages to Frontend

**What happens**: Developers forward VTEX API error responses directly to the frontend without sanitization.

**Why it fails**: VTEX error responses may contain internal implementation details, account names, API paths, or data structures that leak information about your backend architecture. This information can be used by attackers to craft targeted attacks.

**Fix**: Map VTEX errors to user-friendly messages in the BFF. Log the full error server-side for debugging.

```typescript
// Map VTEX errors to safe, user-friendly messages
function mapCheckoutError(vtexError: string, statusCode: number): { code: string; message: string } {
  if (statusCode === 400 && vtexError.includes("item")) {
    return { code: "INVALID_ITEM", message: "One or more items are unavailable" };
  }
  if (statusCode === 400 && vtexError.includes("address")) {
    return { code: "INVALID_ADDRESS", message: "Please check your shipping address" };
  }
  if (statusCode === 409) {
    return { code: "CART_CONFLICT", message: "Your cart was updated. Please review your items." };
  }
  return { code: "CHECKOUT_ERROR", message: "An error occurred during checkout. Please try again." };
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Headless cart and checkout](https://developers.vtex.com/docs/guides/headless-cart-and-checkout) — Complete guide to implementing cart and checkout in headless stores
- [Checkout API reference](https://developers.vtex.com/docs/api-reference/checkout-api) — Full API reference for all Checkout endpoints
- [orderForm fields](https://developers.vtex.com/docs/guides/orderform-fields) — Detailed documentation of the OrderForm data structure
- [Creating a regular order from an existing cart](https://developers.vtex.com/docs/guides/creating-a-regular-order-from-an-existing-cart) — Step-by-step guide to the order placement flow
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores
- [Add cart items](https://developers.vtex.com/docs/guides/add-cart-items) — Guide to adding products to a shopping cart

---

# Intelligent Search API Integration

## Overview

**What this skill covers**: The VTEX Intelligent Search API — the only VTEX API that is fully public and designed for direct frontend consumption. Covers all search endpoints, query parameters, response structures, faceted navigation, and the critical requirement to send analytics events.

**When to use it**: When implementing product search, category browsing, autocomplete, or faceted filtering in a headless VTEX storefront. This is the search solution for any custom headless frontend.

**What you'll learn**:
- All Intelligent Search API endpoints and their purposes
- How to implement faceted navigation with proper query parameters
- How to paginate results correctly using `from`/`to` parameters
- Why analytics events are mandatory and how to send them via the Intelligent Search Events API - Headless

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Intelligent Search Is a PUBLIC API

Unlike most VTEX APIs, Intelligent Search does **not** require API keys or authentication tokens. It is designed to be called directly from the frontend. The base URL pattern is:

```text
https://{accountName}.{environment}.com.br/api/io/_v/api/intelligent-search/{endpoint}
```

This means:
- **No BFF proxy needed** for search queries (and proxying adds unnecessary latency)
- Results are CDN-cacheable for better performance
- No risk of credential exposure

This is the ONE exception to the "everything through BFF" rule in headless VTEX architecture.

### Concept 2: Search Endpoints

Intelligent Search provides these core endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/product_search/{facets}` | GET | Search products by query and/or facets |
| `/facets/{facets}` | GET | Get available filters for a query |
| `/autocomplete_suggestions` | GET | Get term and product suggestions while typing |
| `/top_searches` | GET | Get the 10 most popular search terms |
| `/correction_search` | GET | Get spelling correction for a misspelled term |
| `/search_suggestions` | GET | Get suggested terms similar to the search term |
| `/banners/{facets}` | GET | Get banners configured for a query |

### Concept 3: Faceted Navigation

Facets are the combination of filters applied to a search. The `facets` path parameter follows the format:

```text
/{facetKey1}/{facetValue1}/{facetKey2}/{facetValue2}
```

Filter combination rules:
- **Same facet type → OR (union)**: Selecting "Red" and "Blue" for color returns products matching either color
- **Different facet types → AND (intersection)**: Selecting "Red" color and "Nike" brand returns only red Nike products

Common facet keys include: `category-1`, `category-2`, `brand`, `price`, `productClusterIds`, and custom specifications configured as filterable in Intelligent Search settings.

### Concept 4: Analytics Events (Mandatory)

Intelligent Search improves results based on shopper behavior. For headless implementations, you **must** send analytics events using the **Intelligent Search Events API - Headless**. Without events, search ranking cannot learn and results degrade over time.

The events API base URL is:
```text
https://sp.vtex.com/event-api/v1/{accountName}/event
```

**Architecture/Data Flow**:

```text
Frontend (Browser)
    │
    ├── GET /api/io/_v/api/intelligent-search/product_search/...
    │   └── Returns: products, facets, pagination info
    │
    ├── GET /api/io/_v/api/intelligent-search/facets/...
    │   └── Returns: available filters with counts
    │
    ├── GET /api/io/_v/api/intelligent-search/autocomplete_suggestions?query=...
    │   └── Returns: suggested terms + suggested products
    │
    └── POST https://sp.vtex.com/event-api/v1/{account}/event
        └── Sends: search impressions, clicks, add-to-cart events
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: MUST Send Analytics Events

**Rule**: Every headless search implementation MUST send analytics events to the Intelligent Search Events API - Headless. At minimum, send search impression events when results are displayed and click events when a product is selected from search results.

**Why**: Intelligent Search uses machine learning to rank results based on user behavior. Without analytics events, the search engine has no behavioral data and cannot personalize or optimize results. Over time, search quality degrades compared to stores that send events. Additionally, VTEX Admin search analytics dashboards will show no data.

**Detection**: If a search implementation renders results from Intelligent Search but has no calls to `sp.vtex.com/event-api` or the Intelligent Search Events API → STOP immediately. Analytics events must be implemented alongside search.

✅ **CORRECT**:
```typescript
// search-analytics.ts — sends events to Intelligent Search Events API
const ACCOUNT_NAME = "mystore";
const EVENTS_URL = `https://sp.vtex.com/event-api/v1/${ACCOUNT_NAME}/event`;

interface SearchEvent {
  type: "search.query" | "search.click" | "search.add_to_cart";
  text: string;
  misspelled: boolean;
  match: number;
  operator: string;
  locale: string;
  agent: string;
  url: string;
  products?: Array<{ productId: string; position: number }>;
}

export async function sendSearchEvent(event: SearchEvent): Promise<void> {
  try {
    await fetch(EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true, // ensures event is sent even during navigation
    });
  } catch (error) {
    // Analytics failures should not break the UI
    console.warn("Failed to send search event:", error);
  }
}

// Usage: call after rendering search results
function onSearchResultsRendered(query: string, products: Product[]): void {
  sendSearchEvent({
    type: "search.query",
    text: query,
    misspelled: false,
    match: products.length,
    operator: "and",
    locale: "en-US",
    agent: "my-headless-store",
    url: window.location.href,
    products: products.map((p, i) => ({
      productId: p.productId,
      position: i + 1,
    })),
  });
}
```

❌ **WRONG**:
```typescript
// Search works but NO analytics events are sent — search ranking degrades
async function searchProducts(query: string): Promise<Product[]> {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?query=${query}&locale=en-US`
  );
  const data = await response.json();
  return data.products;
  // Missing: no call to sendSearchEvent() — Intelligent Search cannot learn
}
```

---

### Constraint: MUST Paginate Results Correctly

**Rule**: Every product search request MUST include `from` and `to` query parameters to control pagination. The maximum page size is 50 items (`to - from` must not exceed 49, since indices are inclusive and zero-based).

**Why**: Without pagination parameters, the API defaults to a small result set. Requesting too many results in a single call (or not paginating at all) causes slow responses, high memory usage on the client, and poor user experience. Additionally, the API enforces a maximum of 50 items per request.

**Detection**: If a call to `/product_search/` does not include `from` and `to` query parameters → STOP immediately. Pagination must always be explicit.

✅ **CORRECT**:
```typescript
// Properly paginated search with from/to parameters
interface SearchOptions {
  query: string;
  page: number;
  pageSize: number;
  locale: string;
  facets?: string;
}

async function searchProducts(options: SearchOptions): Promise<SearchResponse> {
  const { query, page, pageSize, locale, facets = "" } = options;

  // Calculate zero-based from/to (inclusive)
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const params = new URLSearchParams({
    query,
    locale,
    from: String(from),
    to: String(to),
  });

  const baseUrl = `https://${ACCOUNT}.vtexcommercestable.com.br`;
  const facetPath = facets ? `/${facets}` : "";
  const url = `${baseUrl}/api/io/_v/api/intelligent-search/product_search${facetPath}?${params}`;

  const response = await fetch(url);
  return response.json();
}

// Usage
const results = await searchProducts({
  query: "running shoes",
  page: 0,
  pageSize: 20,
  locale: "en-US",
  facets: "category-1/shoes",
});
```

❌ **WRONG**:
```typescript
// No pagination — returns default small result set, no way to load more
async function searchProducts(query: string): Promise<SearchResponse> {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?query=${query}`
    // Missing: from, to, locale parameters
  );
  return response.json();
}
```

---

### Constraint: Do NOT Unnecessarily Proxy Intelligent Search Through BFF

**Rule**: Intelligent Search API requests SHOULD be made directly from the frontend. Do not route search traffic through the BFF unless you have a specific need (e.g., server-side rendering, adding custom business logic).

**Why**: Intelligent Search is a public API that does not require authentication. Adding a BFF proxy layer introduces an additional network hop, increases latency on every search operation, adds server cost, and prevents the CDN from caching responses efficiently. Search queries are high-frequency operations — even 50ms of added latency impacts conversion.

**Detection**: If all Intelligent Search calls go through a BFF endpoint instead of directly to VTEX → note this to the developer. It is not a security issue but a performance concern. If there is no justification (like SSR), recommend direct frontend calls.

✅ **CORRECT**:
```typescript
// Frontend — calls Intelligent Search directly (no BFF needed)
const VTEX_SEARCH_BASE = `https://${ACCOUNT}.vtexcommercestable.com.br/api/io/_v/api/intelligent-search`;

export async function getAutocomplete(term: string, locale: string): Promise<AutocompleteResponse> {
  const params = new URLSearchParams({ query: term, locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/autocomplete_suggestions?${params}`);
  return response.json();
}

export async function getTopSearches(locale: string): Promise<TopSearchesResponse> {
  const params = new URLSearchParams({ locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/top_searches?${params}`);
  return response.json();
}

export async function getFacets(facetPath: string, query: string, locale: string): Promise<FacetsResponse> {
  const params = new URLSearchParams({ query, locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/facets/${facetPath}?${params}`);
  return response.json();
}
```

❌ **WRONG**:
```typescript
// BFF proxy for Intelligent Search — unnecessary overhead
// server/routes/search.ts
router.get("/api/bff/search", async (req, res) => {
  const { query, from, to, locale } = req.query;
  // This just forwards to VTEX with no added value
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?query=${query}&from=${from}&to=${to}&locale=${locale}`
  );
  const data = await response.json();
  res.json(data); // Added latency for no benefit
});
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Create a Search API Client

Build a typed client for all Intelligent Search endpoints. This runs in the frontend.

```typescript
// lib/intelligent-search-client.ts
const ACCOUNT = "mystore";
const ENVIRONMENT = "vtexcommercestable";
const BASE_URL = `https://${ACCOUNT}.${ENVIRONMENT}.com.br/api/io/_v/api/intelligent-search`;

interface ProductSearchParams {
  query?: string;
  from?: number;
  to?: number;
  locale: string;
  facets?: string;
  sort?: "price:asc" | "price:desc" | "orders:desc" | "name:asc" | "name:desc" | "release:desc" | "discount:desc";
  hideUnavailableItems?: boolean;
}

interface SearchProduct {
  productId: string;
  productName: string;
  brand: string;
  brandId: number;
  link: string;
  linkText: string;
  categories: string[];
  priceRange: {
    sellingPrice: { highPrice: number; lowPrice: number };
    listPrice: { highPrice: number; lowPrice: number };
  };
  items: Array<{
    itemId: string;
    name: string;
    images: Array<{ imageUrl: string; imageLabel: string }>;
    sellers: Array<{
      sellerId: string;
      sellerName: string;
      commertialOffer: {
        Price: number;
        ListPrice: number;
        AvailableQuantity: number;
      };
    }>;
  }>;
}

interface ProductSearchResponse {
  products: SearchProduct[];
  recordsFiltered: number;
  correction?: { misspelled: boolean };
  fuzzy: string;
  operator: string;
  translated: boolean;
  pagination: {
    count: number;
    current: { index: number; proxyUrl: string };
    before: Array<{ index: number; proxyUrl: string }>;
    after: Array<{ index: number; proxyUrl: string }>;
    perPage: number;
    next: { index: number; proxyUrl: string };
    previous: { index: number; proxyUrl: string };
    first: { index: number; proxyUrl: string };
    last: { index: number; proxyUrl: string };
  };
}

export async function productSearch(params: ProductSearchParams): Promise<ProductSearchResponse> {
  const { facets = "", ...queryParams } = params;
  const searchParams = new URLSearchParams();

  if (queryParams.query) searchParams.set("query", queryParams.query);
  if (queryParams.from !== undefined) searchParams.set("from", String(queryParams.from));
  if (queryParams.to !== undefined) searchParams.set("to", String(queryParams.to));
  searchParams.set("locale", queryParams.locale);
  if (queryParams.sort) searchParams.set("sort", queryParams.sort);
  if (queryParams.hideUnavailableItems) searchParams.set("hideUnavailableItems", "true");

  const facetPath = facets ? `/${facets}` : "";
  const url = `${BASE_URL}/product_search${facetPath}?${searchParams}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }
  return response.json();
}
```

### Step 2: Implement Faceted Navigation

Fetch available facets for the current query and render filter UI. Update the search when filters change.

```typescript
// lib/facets.ts
interface FacetValue {
  id: string;
  quantity: number;
  name: string;
  key: string;
  value: string;
  selected: boolean;
  href: string;
}

interface Facet {
  type: "TEXT" | "NUMBER" | "PRICERANGE";
  name: string;
  hidden: boolean;
  quantity: number;
  values: FacetValue[];
}

interface FacetsResponse {
  facets: Facet[];
  breadcrumb: Array<{ name: string; href: string }>;
  queryArgs: {
    query: string;
    map: string;
  };
}

export async function getFacets(
  facetPath: string,
  query: string,
  locale: string
): Promise<FacetsResponse> {
  const params = new URLSearchParams({ query, locale });
  const url = `${BASE_URL}/facets/${facetPath}?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Facets fetch failed: ${response.status}`);
  }
  return response.json();
}

// Build facet path from selected filters
export function buildFacetPath(selectedFilters: Record<string, string[]>): string {
  const parts: string[] = [];
  for (const [key, values] of Object.entries(selectedFilters)) {
    for (const value of values) {
      parts.push(`${key}/${value}`);
    }
  }
  return parts.join("/");
}
```

### Step 3: Implement Autocomplete

Wire up the autocomplete endpoint to your search input for real-time suggestions.

```typescript
// lib/autocomplete.ts
interface AutocompleteSuggestion {
  term: string;
  count: number;
  attributes: Array<{
    key: string;
    value: string;
    labelKey: string;
    labelValue: string;
  }>;
}

interface AutocompleteResponse {
  searches: AutocompleteSuggestion[];
}

export async function getAutocompleteSuggestions(
  query: string,
  locale: string
): Promise<AutocompleteResponse> {
  const params = new URLSearchParams({ query, locale });
  const url = `${BASE_URL}/autocomplete_suggestions?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Autocomplete failed: ${response.status}`);
  }
  return response.json();
}

// Debounced autocomplete for use in search inputs
export function createDebouncedAutocomplete(delayMs: number = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debouncedAutocomplete(
    query: string,
    locale: string,
    callback: (suggestions: AutocompleteResponse) => void
  ): void {
    if (timeoutId) clearTimeout(timeoutId);

    if (query.length < 2) {
      callback({ searches: [] });
      return;
    }

    timeoutId = setTimeout(async () => {
      const suggestions = await getAutocompleteSuggestions(query, locale);
      callback(suggestions);
    }, delayMs);
  };
}
```

### Complete Example

A full search implementation with products, facets, autocomplete, and analytics:

```typescript
// search-page.ts — framework-agnostic search orchestration
import { productSearch, ProductSearchResponse } from "./lib/intelligent-search-client";
import { getFacets, buildFacetPath, FacetsResponse } from "./lib/facets";
import { createDebouncedAutocomplete } from "./lib/autocomplete";
import { sendSearchEvent } from "./search-analytics";

interface SearchState {
  query: string;
  page: number;
  pageSize: number;
  locale: string;
  selectedFilters: Record<string, string[]>;
  sort?: string;
  results: ProductSearchResponse | null;
  facets: FacetsResponse | null;
}

const state: SearchState = {
  query: "",
  page: 0,
  pageSize: 24,
  locale: "en-US",
  selectedFilters: {},
  results: null,
  facets: null,
};

const debouncedAutocomplete = createDebouncedAutocomplete(300);

// Execute search with current state
async function executeSearch(): Promise<void> {
  const facetPath = buildFacetPath(state.selectedFilters);

  const [searchResults, facetResults] = await Promise.all([
    productSearch({
      query: state.query,
      from: state.page * state.pageSize,
      to: (state.page * state.pageSize) + state.pageSize - 1,
      locale: state.locale,
      facets: facetPath,
    }),
    getFacets(facetPath, state.query, state.locale),
  ]);

  state.results = searchResults;
  state.facets = facetResults;

  // Send analytics event after results are rendered
  sendSearchEvent({
    type: "search.query",
    text: state.query,
    misspelled: searchResults.correction?.misspelled ?? false,
    match: searchResults.recordsFiltered,
    operator: searchResults.operator,
    locale: state.locale,
    agent: "my-headless-store",
    url: window.location.href,
    products: searchResults.products.map((p, i) => ({
      productId: p.productId,
      position: state.page * state.pageSize + i + 1,
    })),
  });
}

// Handle search input
function onSearchInput(query: string): void {
  debouncedAutocomplete(query, state.locale, (suggestions) => {
    // Render autocomplete dropdown — implementation depends on your UI framework
    renderAutocomplete(suggestions);
  });
}

// Handle search submit
function onSearchSubmit(query: string): void {
  state.query = query;
  state.page = 0;
  state.selectedFilters = {};
  executeSearch();
}

// Handle filter toggle
function onFilterToggle(facetKey: string, facetValue: string): void {
  const current = state.selectedFilters[facetKey] || [];
  const index = current.indexOf(facetValue);

  if (index === -1) {
    state.selectedFilters[facetKey] = [...current, facetValue];
  } else {
    state.selectedFilters[facetKey] = current.filter((v) => v !== facetValue);
    if (state.selectedFilters[facetKey].length === 0) {
      delete state.selectedFilters[facetKey];
    }
  }

  state.page = 0;
  executeSearch();
}

// Handle pagination
function onPageChange(newPage: number): void {
  state.page = newPage;
  executeSearch();
}

// Handle product click from search results
function onProductClick(productId: string, position: number): void {
  sendSearchEvent({
    type: "search.click",
    text: state.query,
    misspelled: false,
    match: state.results?.recordsFiltered ?? 0,
    operator: state.results?.operator ?? "and",
    locale: state.locale,
    agent: "my-headless-store",
    url: window.location.href,
    products: [{ productId, position }],
  });
}

// Placeholder render function — replace with your framework's rendering
function renderAutocomplete(suggestions: { searches: Array<{ term: string }> }): void {
  // Your framework-specific rendering logic here
  console.log("Autocomplete suggestions:", suggestions.searches);
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Not Sending the `locale` Parameter

**What happens**: Developers omit the `locale` query parameter from search requests.

**Why it fails**: Without `locale`, Intelligent Search may return results in the wrong language or fail to apply locale-specific relevance rules. Multi-language stores will display mixed-language results, and search terms may not be properly tokenized for the target language.

**Fix**: Always include the `locale` parameter in every Intelligent Search request.

```typescript
// Always include locale in search parameters
const params = new URLSearchParams({
  query: "shoes",
  locale: "en-US", // Required for correct language processing
  from: "0",
  to: "19",
});
```

---

### Anti-Pattern: Loading All Products at Once

**What happens**: Developers set very large `from`/`to` ranges (e.g., 0 to 999) or implement infinite scroll that loads all results without limit.

**Why it fails**: The Intelligent Search API limits results to 50 items per request. Even if it allowed more, sending large payloads degrades performance for both the API and the client. Users experience long load times and high memory consumption. Additionally, loading products beyond what is visible wastes bandwidth.

**Fix**: Use proper pagination with reasonable page sizes (12-24 items per page) and lazy-load subsequent pages only when the user scrolls or clicks "next page."

```typescript
// Proper pagination with bounded page sizes
const PAGE_SIZE = 24; // Reasonable default
const MAX_PAGE_SIZE = 50; // API maximum

function getSearchPage(query: string, page: number, locale: string) {
  const safePageSize = Math.min(PAGE_SIZE, MAX_PAGE_SIZE);
  const from = page * safePageSize;
  const to = from + safePageSize - 1;

  return productSearch({ query, from, to, locale });
}
```

---

### Anti-Pattern: Rebuilding Search Ranking Logic Client-Side

**What happens**: Developers fetch search results and then re-sort or re-filter them in the frontend instead of using the API's built-in `sort` parameter and facet paths.

**Why it fails**: Intelligent Search's ranking algorithm considers relevance, sales velocity, availability, and shopper behavior. Client-side re-sorting discards this intelligence. Additionally, client-side filtering only works on the current page of results, not the full catalog — a user filtering by "Red" would only see red items from the current 24 results, not from all matching products.

**Fix**: Use the API's `sort` parameter and facet path for all filtering and sorting. Let the search engine do what it was designed to do.

```typescript
// Use API-level sorting — don't re-sort in the frontend
const results = await productSearch({
  query: "shirt",
  sort: "price:asc", // API handles sorting across entire result set
  locale: "en-US",
  from: 0,
  to: 23,
  facets: "category-1/clothing/color/red", // API handles filtering across entire catalog
});
```

## Reference

**Links to VTEX documentation and related resources.**

- [Headless catalog and search](https://developers.vtex.com/docs/guides/headless-catalog) — Overview of catalog browsing and search in headless stores
- [Intelligent Search API reference](https://developers.vtex.com/docs/api-reference/intelligent-search-api) — Complete API reference for all search endpoints
- [Intelligent Search Events API - Headless](https://developers.vtex.com/docs/api-reference/intelligent-search-events-api-headless) — Events API for sending analytics from headless implementations
- [Intelligent Search overview](https://help.vtex.com/en/docs/tutorials/intelligent-search-overview) — General overview of Intelligent Search capabilities
- [Search configuration](https://help.vtex.com/en/docs/tutorials/search-configuration) — How to configure searchable specifications, facet ordering, and other search settings
- [Autocomplete](https://help.vtex.com/en/docs/tutorials/autocomplete) — How autocomplete suggestions work in Intelligent Search

---

# Marketplace Integration

# Catalog & SKU Integration

## Overview

**What this skill covers**: The complete SKU integration flow between an external seller and a VTEX marketplace, including catalog notifications, SKU suggestions, approval lifecycle, and price/inventory synchronization.

**When to use it**: When building a seller connector that needs to push product catalog data into a VTEX marketplace, handle SKU approval workflows, or keep prices and inventory synchronized.

**What you'll learn**:
- How to use the Change Notification endpoint to register and update SKUs
- The SKU suggestion lifecycle (send → pending → approved/denied)
- How to map product data to the VTEX catalog schema
- How to synchronize prices and inventory via notification endpoints

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Change Notification Flow

The `POST /api/catalog_system/pvt/skuseller/changenotification/{skuId}` endpoint is the entry point for all catalog integration. When called:
- **200 OK** → The SKU already exists in the marketplace. The seller should update the SKU information.
- **404 Not Found** → The SKU does not exist in the marketplace. The seller must send an SKU suggestion.

This two-response pattern drives the entire integration: notify first, then either update or register based on the response.

### Concept 2: SKU Suggestion Lifecycle

The catalog is owned by the marketplace — the seller has no direct access. Every new SKU is sent as a **suggestion** via the `PUT Send SKU Suggestion` API. The lifecycle is:
1. **Seller sends suggestion** with product name, SKU name, images, EAN, specifications
2. **Suggestion enters "pending" state** in the marketplace's Received SKUs panel
3. **Marketplace approves or denies** — approval creates an actual SKU in the catalog
4. **Once approved**, the suggestion ceases to exist; the SKU can only be edited by the marketplace

Suggestions can be updated by the seller only while still in pending state. Once approved or denied, updates require a new suggestion or direct marketplace action.

### Concept 3: Price & Inventory Notifications

Price and inventory changes use separate notification endpoints (not the catalog changenotification):
- `POST /notificator/{sellerId}/changenotification/{skuId}/price` — notify price change
- `POST /notificator/{sellerId}/changenotification/{skuId}/inventory` — notify inventory change

After these notifications, the marketplace calls the seller's **Fulfillment Simulation** endpoint (`POST /pvt/orderForms/simulation`) to retrieve current data. This endpoint must respond within **2.5 seconds** or the product is considered unavailable.

**Architecture/Data Flow**:

```text
Seller                          VTEX Marketplace
  │                                    │
  │─── POST changenotification ──────▶│
  │◀── 200 (exists) or 404 (new) ────│
  │                                    │
  │─── PUT Send SKU Suggestion ──────▶│  (if 404)
  │                                    │── Pending in Received SKUs
  │                                    │── Marketplace approves/denies
  │                                    │
  │─── POST price notification ──────▶│
  │◀── POST fulfillment simulation ───│  (marketplace fetches data)
  │─── Response with price/stock ────▶│
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Use SKU Integration API, Not Direct Catalog API

**Rule**: External sellers MUST use the Change Notification + SKU Suggestion flow to integrate SKUs. Direct Catalog API writes (`POST /api/catalog/pvt/product` or `POST /api/catalog/pvt/stockkeepingunit`) are for marketplace-side operations only.

**Why**: The seller does not own the catalog. Direct catalog writes will fail with 403 Forbidden or create orphaned entries that bypass the approval workflow. The suggestion mechanism ensures marketplace quality control.

**Detection**: If you see direct Catalog API calls for product/SKU creation (e.g., `POST /api/catalog/pvt/product`, `POST /api/catalog/pvt/stockkeepingunit`) from a seller integration → warn that the SKU Integration API should be used instead.

✅ **CORRECT**:
```typescript
import axios, { AxiosInstance } from "axios";

interface SkuSuggestion {
  ProductName: string;
  SkuName: string;
  ImageUrl: string;
  ProductDescription: string;
  BrandName: string;
  CategoryFullPath: string;
  EAN: string;
  Height: number;
  Width: number;
  Length: number;
  WeightKg: number;
  SkuSpecifications: Array<{
    FieldName: string;
    FieldValues: string[];
  }>;
}

async function integrateSellerSku(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  skuData: SkuSuggestion
): Promise<void> {
  const baseUrl = `https://${marketplaceAccount}.vtexcommercestable.com.br`;

  // Step 1: Send change notification to check if SKU exists
  try {
    await client.post(
      `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerSkuId}`
    );
    // 200 OK — SKU exists, marketplace will fetch updates via fulfillment simulation
    console.log(`SKU ${sellerSkuId} exists in marketplace, update triggered`);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // 404 — SKU not found, send suggestion
      console.log(`SKU ${sellerSkuId} not found, sending suggestion`);
      await client.put(
        `${baseUrl}/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
        skuData
      );
      console.log(`SKU suggestion sent for ${sellerSkuId}`);
    } else {
      throw error;
    }
  }
}
```

❌ **WRONG**:
```typescript
// WRONG: Seller trying to write directly to marketplace catalog
// This bypasses the suggestion/approval flow and will fail with 403
async function createSkuDirectly(
  client: AxiosInstance,
  marketplaceAccount: string,
  productData: Record<string, unknown>
): Promise<void> {
  // Direct catalog write — sellers don't have permission for this
  await client.post(
    `https://${marketplaceAccount}.vtexcommercestable.com.br/api/catalog/pvt/product`,
    productData
  );
  // Will fail: 403 Forbidden — seller lacks catalog write permissions
}
```

---

### Constraint: Handle Rate Limiting on Catalog Notifications

**Rule**: All catalog notification calls MUST implement 429 handling with exponential backoff. Batch notifications MUST be throttled to respect VTEX API rate limits.

**Why**: The Change Notification endpoint is rate-limited. Sending bulk notifications without throttling will trigger 429 responses and temporarily block the seller's API access, stalling the entire integration.

**Detection**: If you see catalog notification calls without 429 handling or retry logic → STOP and add rate limiting. If you see a tight loop sending notifications without delays → warn about rate limiting.

✅ **CORRECT**:
```typescript
async function batchNotifySkus(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  skuIds: string[],
  concurrency: number = 5,
  delayMs: number = 200
): Promise<void> {
  const results: Array<{ skuId: string; status: "exists" | "new" | "error" }> = [];

  for (let i = 0; i < skuIds.length; i += concurrency) {
    const batch = skuIds.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (skuId) => {
        try {
          await client.post(
            `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${skuId}`
          );
          return { skuId, status: "exists" as const };
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            "response" in error &&
            (error as { response?: { status?: number } }).response?.status === 404
          ) {
            return { skuId, status: "new" as const };
          }
          if (
            error instanceof Error &&
            "response" in error &&
            (error as { response?: { status?: number; headers?: Record<string, string> } })
              .response?.status === 429
          ) {
            const retryAfter = parseInt(
              (error as { response: { headers: Record<string, string> } }).response.headers[
                "retry-after"
              ] || "60",
              10
            );
            console.warn(`Rate limited. Waiting ${retryAfter}s before retry.`);
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            return { skuId, status: "error" as const };
          }
          throw error;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }

    // Throttle between batches
    if (i + concurrency < skuIds.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
```

❌ **WRONG**:
```typescript
// WRONG: No rate limiting, no error handling, tight loop
async function notifyAllSkus(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  skuIds: string[]
): Promise<void> {
  // Fires all requests simultaneously — will trigger 429 rate limits
  await Promise.all(
    skuIds.map((skuId) =>
      client.post(
        `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${skuId}`
      )
    )
  );
}
```

---

### Constraint: Handle Suggestion Lifecycle States

**Rule**: Sellers MUST check the suggestion state before attempting updates. Suggestions can only be updated while in pending state.

**Why**: Attempting to update an already-approved or denied suggestion will fail silently or create duplicate entries. An approved suggestion becomes an SKU owned by the marketplace.

**Detection**: If you see SKU suggestion updates without checking current suggestion status → warn about suggestion lifecycle handling.

✅ **CORRECT**:
```typescript
async function updateSkuSuggestion(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  sellerSkuId: string,
  updatedData: Record<string, unknown>
): Promise<boolean> {
  // Check current suggestion status before updating
  try {
    const response = await client.get(
      `${baseUrl}/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`
    );

    const suggestion = response.data;
    if (suggestion.Status === "Pending") {
      // Safe to update — suggestion hasn't been processed yet
      await client.put(
        `${baseUrl}/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
        updatedData
      );
      return true;
    }

    // Already approved or denied — cannot update
    console.warn(
      `SKU ${sellerSkuId} suggestion is ${suggestion.Status}, cannot update. ` +
        `Use changenotification to update existing SKUs.`
    );
    return false;
  } catch {
    // Suggestion may not exist — send as new
    await client.put(
      `${baseUrl}/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
      updatedData
    );
    return true;
  }
}
```

❌ **WRONG**:
```typescript
// WRONG: Blindly sending suggestion update without checking state
async function blindUpdateSuggestion(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  sellerSkuId: string,
  data: Record<string, unknown>
): Promise<void> {
  // If the suggestion was already approved, this fails silently
  // or creates a duplicate that confuses the marketplace operator
  await client.put(
    `${baseUrl}/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
    data
  );
}
```

## Implementation Pattern

**The canonical, recommended way to implement SKU catalog integration.**

### Step 1: Set Up the Seller Connector Client

Create an authenticated HTTP client for communicating with the VTEX marketplace.

```typescript
import axios, { AxiosInstance } from "axios";

interface SellerConnectorConfig {
  marketplaceAccount: string;
  sellerId: string;
  appKey: string;
  appToken: string;
}

function createMarketplaceClient(config: SellerConnectorConfig): AxiosInstance {
  return axios.create({
    baseURL: `https://${config.marketplaceAccount}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-VTEX-API-AppKey": config.appKey,
      "X-VTEX-API-AppToken": config.appToken,
    },
    timeout: 10000,
  });
}
```

### Step 2: Implement the Change Notification Flow

Handle both the "exists" (200) and "new" (404) scenarios from the changenotification endpoint.

```typescript
interface CatalogNotificationResult {
  skuId: string;
  action: "updated" | "suggestion_sent" | "error";
  error?: string;
}

async function notifyAndSync(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuId: string,
  skuData: SkuSuggestion
): Promise<CatalogNotificationResult> {
  try {
    await client.post(
      `/api/catalog_system/pvt/skuseller/changenotification/${sellerSkuId}`
    );
    // SKU exists — marketplace will call fulfillment simulation to get updates
    return { skuId: sellerSkuId, action: "updated" };
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      try {
        await client.put(
          `/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
          skuData
        );
        return { skuId: sellerSkuId, action: "suggestion_sent" };
      } catch (suggestionError: unknown) {
        const message = suggestionError instanceof Error ? suggestionError.message : "Unknown error";
        return { skuId: sellerSkuId, action: "error", error: message };
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return { skuId: sellerSkuId, action: "error", error: message };
  }
}
```

### Step 3: Implement the Fulfillment Simulation Endpoint

The marketplace calls this endpoint on the seller's side to retrieve current price and inventory data after a notification.

```typescript
import { RequestHandler } from "express";

interface SimulationItem {
  id: string;
  quantity: number;
  seller: string;
}

interface SimulationRequest {
  items: SimulationItem[];
  postalCode?: string;
  country?: string;
}

interface SimulationResponseItem {
  id: string;
  requestIndex: number;
  quantity: number;
  seller: string;
  price: number;
  listPrice: number;
  sellingPrice: number;
  priceValidUntil: string;
  availability: string;
  merchantName: string;
}

const fulfillmentSimulationHandler: RequestHandler = async (req, res) => {
  const { items, postalCode, country }: SimulationRequest = req.body;

  const responseItems: SimulationResponseItem[] = await Promise.all(
    items.map(async (item, index) => {
      // Fetch current price and inventory from your system
      const skuInfo = await getSkuFromLocalCatalog(item.id);

      return {
        id: item.id,
        requestIndex: index,
        quantity: Math.min(item.quantity, skuInfo.availableQuantity),
        seller: item.seller,
        price: skuInfo.price,
        listPrice: skuInfo.listPrice,
        sellingPrice: skuInfo.sellingPrice,
        priceValidUntil: new Date(Date.now() + 3600000).toISOString(),
        availability: skuInfo.availableQuantity > 0 ? "available" : "unavailable",
        merchantName: "sellerAccountName",
      };
    })
  );

  // CRITICAL: Must respond within 2.5 seconds or products show as unavailable
  res.json({
    items: responseItems,
    postalCode: postalCode ?? "",
    country: country ?? "",
  });
};

async function getSkuFromLocalCatalog(skuId: string): Promise<{
  price: number;
  listPrice: number;
  sellingPrice: number;
  availableQuantity: number;
}> {
  // Replace with your actual catalog/inventory lookup
  return {
    price: 9990,
    listPrice: 12990,
    sellingPrice: 9990,
    availableQuantity: 15,
  };
}
```

### Step 4: Notify Price and Inventory Changes

Send separate notifications for price and inventory updates.

```typescript
async function notifyPriceChange(
  client: AxiosInstance,
  sellerId: string,
  skuId: string
): Promise<void> {
  await client.post(
    `/notificator/${sellerId}/changenotification/${skuId}/price`
  );
}

async function notifyInventoryChange(
  client: AxiosInstance,
  sellerId: string,
  skuId: string
): Promise<void> {
  await client.post(
    `/notificator/${sellerId}/changenotification/${skuId}/inventory`
  );
}

async function syncPriceAndInventory(
  client: AxiosInstance,
  sellerId: string,
  skuIds: string[]
): Promise<void> {
  for (const skuId of skuIds) {
    await notifyPriceChange(client, sellerId, skuId);
    await notifyInventoryChange(client, sellerId, skuId);

    // Throttle to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
```

### Complete Example

```typescript
import axios from "axios";

async function runCatalogSync(): Promise<void> {
  const config: SellerConnectorConfig = {
    marketplaceAccount: "mymarketplace",
    sellerId: "externalseller01",
    appKey: process.env.VTEX_APP_KEY!,
    appToken: process.env.VTEX_APP_TOKEN!,
  };

  const client = createMarketplaceClient(config);

  // Fetch SKUs that need syncing from your system
  const skusToSync = await getLocalSkusNeedingSync();

  for (const sku of skusToSync) {
    const skuSuggestion: SkuSuggestion = {
      ProductName: sku.productName,
      SkuName: sku.skuName,
      ImageUrl: sku.imageUrl,
      ProductDescription: sku.description,
      BrandName: sku.brand,
      CategoryFullPath: sku.categoryPath,
      EAN: sku.ean,
      Height: sku.height,
      Width: sku.width,
      Length: sku.length,
      WeightKg: sku.weight,
      SkuSpecifications: sku.specifications,
    };

    const result = await notifyAndSync(
      client,
      config.sellerId,
      sku.sellerSkuId,
      skuSuggestion
    );

    console.log(`SKU ${sku.sellerSkuId}: ${result.action}`);

    // Throttle between SKU operations
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Sync prices and inventory for all active SKUs
  const activeSkuIds = skusToSync.map((s) => s.sellerSkuId);
  await syncPriceAndInventory(client, config.sellerId, activeSkuIds);
}

async function getLocalSkusNeedingSync(): Promise<
  Array<{
    sellerSkuId: string;
    productName: string;
    skuName: string;
    imageUrl: string;
    description: string;
    brand: string;
    categoryPath: string;
    ean: string;
    height: number;
    width: number;
    length: number;
    weight: number;
    specifications: Array<{ FieldName: string; FieldValues: string[] }>;
  }>
> {
  // Replace with your actual data source
  return [];
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Polling for Suggestion Status in Tight Loops

**What happens**: Developers send a suggestion then immediately poll for approval status in a tight loop, waiting for the marketplace to approve.

**Why it fails**: Suggestion approval is a manual or semi-automatic marketplace process that can take minutes to days. Tight polling wastes API quota and may trigger rate limits that block the entire integration.

**Fix**: Use a scheduled job (cron) to check suggestion statuses periodically (e.g., every 15-30 minutes), or implement a webhook-based notification system.

```typescript
// Correct: Scheduled periodic check, not a tight poll
async function checkPendingSuggestions(
  client: AxiosInstance,
  sellerId: string,
  pendingSkuIds: string[]
): Promise<Array<{ skuId: string; status: string }>> {
  const results: Array<{ skuId: string; status: string }> = [];

  for (const skuId of pendingSkuIds) {
    try {
      const response = await client.get(
        `/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${skuId}`
      );
      results.push({ skuId, status: response.data.Status });
    } catch {
      results.push({ skuId, status: "not_found" });
    }

    // Respect rate limits between checks
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return results;
}
```

---

### Anti-Pattern: Ignoring Fulfillment Simulation Timeout

**What happens**: The seller's fulfillment simulation endpoint performs complex database queries or external API calls that exceed the response time limit.

**Why it fails**: VTEX marketplaces wait a maximum of **2.5 seconds** for a fulfillment simulation response. After that, the product is considered unavailable/inactive and won't appear in the storefront or checkout.

**Fix**: Pre-cache price and inventory data. Use in-memory or Redis cache with event-driven updates so the simulation endpoint responds instantly.

```typescript
import { RequestHandler } from "express";

// Correct: Cache-first approach for fast fulfillment simulation
const cachedPriceInventory = new Map<string, {
  price: number;
  listPrice: number;
  sellingPrice: number;
  availableQuantity: number;
  updatedAt: number;
}>();

const fastFulfillmentSimulation: RequestHandler = async (req, res) => {
  const { items } = req.body;

  const responseItems = items.map((item: SimulationItem, index: number) => {
    const cached = cachedPriceInventory.get(item.id);

    if (!cached) {
      return {
        id: item.id,
        requestIndex: index,
        quantity: 0,
        availability: "unavailable",
      };
    }

    return {
      id: item.id,
      requestIndex: index,
      quantity: Math.min(item.quantity, cached.availableQuantity),
      price: cached.price,
      listPrice: cached.listPrice,
      sellingPrice: cached.sellingPrice,
      availability: cached.availableQuantity > 0 ? "available" : "unavailable",
    };
  });

  // Responds in < 50ms from cache
  res.json({ items: responseItems });
};
```

## Reference

**Links to VTEX documentation and related resources.**

- [External Seller Connector Guide](https://developers.vtex.com/docs/guides/external-seller-integration-connector) — Complete integration flow for external sellers connecting to VTEX marketplaces
- [Change Notification API](https://developers.vtex.com/docs/api-reference/catalog-api#post-/api/catalog_system/pvt/skuseller/changenotification/-skuId-) — API reference for the changenotification endpoint
- [Marketplace API - Manage Suggestions](https://developers.vtex.com/docs/guides/marketplace-api#manage-suggestions) — API reference for sending and managing SKU suggestions
- [External Marketplace Integration - Stock Update](https://developers.vtex.com/docs/guides/external-marketplace-integration-stock-update) — Guide for keeping inventory synchronized
- [External Marketplace Integration - Price Update](https://developers.vtex.com/docs/guides/external-marketplace-integration-price-update) — Guide for keeping prices synchronized
- [Catalog Management for VTEX Marketplace](https://developers.vtex.com/docs/guides/external-seller-integration-vtex-marketplace-operation) — Marketplace-side catalog operations and SKU approval workflows

---

# Fulfillment, Invoice & Tracking

## Overview

**What this skill covers**: The complete seller-side fulfillment flow for VTEX marketplace orders, including authorize fulfillment handling, invoice notification, tracking code updates, and partial invoicing for split shipments.

**When to use it**: When building a seller integration that needs to send invoice data and tracking information to a VTEX marketplace after fulfilling an order.

**What you'll learn**:
- How to handle the Authorize Fulfillment callback from the marketplace
- How to send invoice notifications via `POST /api/oms/pvt/orders/{orderId}/invoice`
- The required invoice payload fields and correct formatting
- How to update tracking information and handle partial invoicing

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Fulfillment Authorization Flow

After payment is approved, the VTEX marketplace sends an **Authorize Fulfillment** request to the seller's endpoint (`POST /pvt/orders/{sellerOrderId}/fulfill`). This signals that the seller can begin the fulfillment process.

The request body contains only the `marketplaceOrderId`. The seller must:
1. Map the `marketplaceOrderId` to their internal order
2. Begin picking, packing, and shipping
3. Once ready, send the invoice notification back to the marketplace

### Concept 2: Invoice Notification Endpoint

The seller sends invoice data to the marketplace using:
`POST /api/oms/pvt/orders/{orderId}/invoice`

Required fields in the request body:
- `type` — `"Output"` for sales invoices (shipment), `"Input"` for return invoices
- `invoiceNumber` — Unique invoice identifier
- `invoiceValue` — Total value in cents (e.g., 9990 = $99.90)
- `issuanceDate` — ISO 8601 date string when the invoice was issued
- `invoiceUrl` — URL to the invoice document (optional but recommended)
- `invoiceKey` — NFe access key (required in Brazil, optional elsewhere)
- `items` — Array of items with `id`, `quantity`, and `price`

After receiving invoice information, the order status changes to **invoiced**. At this point, the order can no longer be canceled (unless a return invoice is sent first).

### Concept 3: Tracking Updates

Tracking information uses the **same invoice endpoint** but is sent separately:
`POST /api/oms/pvt/orders/{orderId}/invoice`

The tracking fields are:
- `courier` — Carrier name
- `trackingNumber` — Tracking identifier from the carrier
- `trackingUrl` — URL for tracking the shipment

For updating tracking on an existing invoice, use:
`PATCH /api/oms/pvt/orders/{orderId}/invoice/{invoiceNumber}`

This endpoint is used to add the tracking number after the invoice has been sent, or to update delivery status with `isDelivered: true`.

**Architecture/Data Flow**:

```text
VTEX Marketplace                    External Seller
       │                                   │
       │── POST /fulfill (auth) ──────────▶│  Payment approved
       │                                   │── Start fulfillment
       │                                   │── Pick, pack, ship
       │◀── POST /invoice (invoice) ──────│  Invoice issued
       │    (status → invoiced)            │
       │                                   │── Carrier picks up
       │◀── PATCH /invoice/{num} ─────────│  Tracking number added
       │    (status → delivering)          │
       │                                   │── Package delivered
       │◀── PATCH /invoice/{num} ─────────│  isDelivered: true
       │    (status → delivered)           │
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Send Correct Invoice Format with All Required Fields

**Rule**: The invoice notification MUST include `type`, `invoiceNumber`, `invoiceValue`, `issuanceDate`, and `items` array. The `invoiceValue` MUST be in cents. The `items` array MUST match the items in the order.

**Why**: Missing required fields cause the API to reject the invoice with 400 Bad Request, leaving the order stuck in "handling" status. Incorrect `invoiceValue` (e.g., using dollars instead of cents) causes financial discrepancies in marketplace reconciliation.

**Detection**: If you see an invoice notification payload missing `invoiceNumber`, `invoiceValue`, `issuanceDate`, or `items` → warn about missing required fields. If `invoiceValue` appears to be in dollars (e.g., `99.90` instead of `9990`) → warn about cents conversion.

✅ **CORRECT**:
```typescript
import axios, { AxiosInstance } from "axios";

interface InvoiceItem {
  id: string;
  quantity: number;
  price: number; // in cents
}

interface InvoicePayload {
  type: "Output" | "Input";
  invoiceNumber: string;
  invoiceValue: number; // total in cents
  issuanceDate: string; // ISO 8601
  invoiceUrl?: string;
  invoiceKey?: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  items: InvoiceItem[];
}

async function sendInvoiceNotification(
  client: AxiosInstance,
  orderId: string,
  invoice: InvoicePayload
): Promise<void> {
  // Validate required fields before sending
  if (!invoice.invoiceNumber) {
    throw new Error("invoiceNumber is required");
  }
  if (!invoice.invoiceValue || invoice.invoiceValue <= 0) {
    throw new Error("invoiceValue must be a positive number in cents");
  }
  if (!invoice.issuanceDate) {
    throw new Error("issuanceDate is required");
  }
  if (!invoice.items || invoice.items.length === 0) {
    throw new Error("items array is required and must not be empty");
  }

  // Warn if invoiceValue looks like it's in dollars instead of cents
  if (invoice.invoiceValue < 100 && invoice.items.length > 0) {
    console.warn(
      `Warning: invoiceValue ${invoice.invoiceValue} seems very low. ` +
        `Ensure it's in cents (e.g., 9990 for $99.90).`
    );
  }

  await client.post(`/api/oms/pvt/orders/${orderId}/invoice`, invoice);
}

// Example usage:
async function invoiceOrder(client: AxiosInstance, orderId: string): Promise<void> {
  await sendInvoiceNotification(client, orderId, {
    type: "Output",
    invoiceNumber: "NFE-2026-001234",
    invoiceValue: 15990, // $159.90 in cents
    issuanceDate: new Date().toISOString(),
    invoiceUrl: "https://invoices.example.com/NFE-2026-001234.pdf",
    invoiceKey: "35260614388220000199550010000012341000012348",
    items: [
      { id: "123", quantity: 1, price: 9990 },
      { id: "456", quantity: 2, price: 3000 },
    ],
  });
}
```

❌ **WRONG**:
```typescript
// WRONG: Missing required fields, value in dollars instead of cents
async function sendBrokenInvoice(
  client: AxiosInstance,
  orderId: string
): Promise<void> {
  await client.post(`/api/oms/pvt/orders/${orderId}/invoice`, {
    // Missing 'type' field — API may reject or default incorrectly
    invoiceNumber: "001234",
    invoiceValue: 159.9, // WRONG: dollars, not cents — causes financial mismatch
    // Missing 'issuanceDate' — API will reject with 400
    // Missing 'items' — API cannot match invoice to order items
  });
}
```

---

### Constraint: Update Tracking Promptly After Shipping

**Rule**: Tracking information MUST be sent as soon as the carrier provides it. Use `PATCH /api/oms/pvt/orders/{orderId}/invoice/{invoiceNumber}` to add tracking to an existing invoice.

**Why**: Late tracking updates prevent customers from seeing shipment status in the marketplace. The order remains in "invoiced" state instead of progressing to "delivering" and then "delivered". This generates customer support tickets and damages seller reputation.

**Detection**: If you see tracking information being batched for daily updates instead of sent in real-time → warn about prompt tracking updates. If tracking is included in the initial invoice call but the carrier hasn't provided it yet (hardcoded/empty values) → warn.

✅ **CORRECT**:
```typescript
interface TrackingUpdate {
  courier: string;
  trackingNumber: string;
  trackingUrl?: string;
  isDelivered?: boolean;
}

async function updateOrderTracking(
  client: AxiosInstance,
  orderId: string,
  invoiceNumber: string,
  tracking: TrackingUpdate
): Promise<void> {
  await client.patch(
    `/api/oms/pvt/orders/${orderId}/invoice/${invoiceNumber}`,
    tracking
  );
}

// Send tracking as soon as carrier provides it
async function onCarrierPickup(
  client: AxiosInstance,
  orderId: string,
  invoiceNumber: string,
  carrierData: { name: string; trackingId: string; trackingUrl: string }
): Promise<void> {
  await updateOrderTracking(client, orderId, invoiceNumber, {
    courier: carrierData.name,
    trackingNumber: carrierData.trackingId,
    trackingUrl: carrierData.trackingUrl,
  });
  console.log(`Tracking updated for order ${orderId}: ${carrierData.trackingId}`);
}

// Update delivery status when confirmed
async function onDeliveryConfirmed(
  client: AxiosInstance,
  orderId: string,
  invoiceNumber: string
): Promise<void> {
  await updateOrderTracking(client, orderId, invoiceNumber, {
    courier: "",
    trackingNumber: "",
    isDelivered: true,
  });
  console.log(`Order ${orderId} marked as delivered`);
}
```

❌ **WRONG**:
```typescript
// WRONG: Sending empty/fake tracking data with the invoice
async function invoiceWithFakeTracking(
  client: AxiosInstance,
  orderId: string
): Promise<void> {
  await client.post(`/api/oms/pvt/orders/${orderId}/invoice`, {
    type: "Output",
    invoiceNumber: "NFE-001",
    invoiceValue: 9990,
    issuanceDate: new Date().toISOString(),
    items: [{ id: "123", quantity: 1, price: 9990 }],
    // WRONG: Hardcoded tracking — carrier hasn't picked up yet
    courier: "TBD",
    trackingNumber: "PENDING",
    trackingUrl: "",
  });
  // Customer sees "PENDING" as tracking number — useless information
}
```

---

### Constraint: Handle Partial Invoicing for Split Shipments

**Rule**: For orders shipped in multiple packages, each shipment MUST have its own invoice with only the items included in that package. The `invoiceValue` MUST reflect only the items in that particular shipment.

**Why**: Sending a single invoice for the full order value when only partial items are shipped causes financial discrepancies. The marketplace cannot reconcile payments correctly, and the order status may not progress properly.

**Detection**: If you see a single invoice being sent with the full order value for partial shipments → warn about partial invoicing. If the items array doesn't match the actual items being shipped → warn.

✅ **CORRECT**:
```typescript
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number; // per unit in cents
}

interface Shipment {
  items: OrderItem[];
  invoiceNumber: string;
}

async function sendPartialInvoices(
  client: AxiosInstance,
  orderId: string,
  shipments: Shipment[]
): Promise<void> {
  for (const shipment of shipments) {
    // Calculate value for only the items in this shipment
    const shipmentValue = shipment.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    await sendInvoiceNotification(client, orderId, {
      type: "Output",
      invoiceNumber: shipment.invoiceNumber,
      invoiceValue: shipmentValue,
      issuanceDate: new Date().toISOString(),
      items: shipment.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
      })),
    });

    console.log(
      `Partial invoice ${shipment.invoiceNumber} sent for order ${orderId}: ` +
        `${shipment.items.length} items, value=${shipmentValue}`
    );
  }
}

// Example: Order with 3 items shipped in 2 packages
await sendPartialInvoices(client, "ORD-123", [
  {
    invoiceNumber: "NFE-001-A",
    items: [
      { id: "sku-1", name: "Laptop", quantity: 1, price: 250000 },
    ],
  },
  {
    invoiceNumber: "NFE-001-B",
    items: [
      { id: "sku-2", name: "Mouse", quantity: 1, price: 5000 },
      { id: "sku-3", name: "Keyboard", quantity: 1, price: 12000 },
    ],
  },
]);
```

❌ **WRONG**:
```typescript
// WRONG: Sending full order value for partial shipment
async function wrongPartialInvoice(
  client: AxiosInstance,
  orderId: string,
  totalOrderValue: number,
  shippedItems: OrderItem[]
): Promise<void> {
  await client.post(`/api/oms/pvt/orders/${orderId}/invoice`, {
    type: "Output",
    invoiceNumber: "NFE-001-A",
    invoiceValue: totalOrderValue, // WRONG: Full order value, not partial
    issuanceDate: new Date().toISOString(),
    items: shippedItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
    })),
    // invoiceValue doesn't match sum of items — financial mismatch
  });
}
```

## Implementation Pattern

**The canonical, recommended way to implement fulfillment, invoicing, and tracking.**

### Step 1: Implement the Authorize Fulfillment Endpoint

The marketplace calls this endpoint when payment is approved.

```typescript
import express, { RequestHandler } from "express";

interface FulfillOrderRequest {
  marketplaceOrderId: string;
}

interface OrderMapping {
  sellerOrderId: string;
  marketplaceOrderId: string;
  items: OrderItem[];
  status: string;
}

// Store for order mappings — use a real database in production
const orderStore = new Map<string, OrderMapping>();

const authorizeFulfillmentHandler: RequestHandler = async (req, res) => {
  const sellerOrderId = req.params.sellerOrderId;
  const { marketplaceOrderId }: FulfillOrderRequest = req.body;

  console.log(
    `Fulfillment authorized: seller=${sellerOrderId}, marketplace=${marketplaceOrderId}`
  );

  // Store the marketplace order ID mapping
  const order = orderStore.get(sellerOrderId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  order.marketplaceOrderId = marketplaceOrderId;
  order.status = "fulfillment_authorized";
  orderStore.set(sellerOrderId, order);

  // Trigger fulfillment process asynchronously
  enqueueFulfillment(sellerOrderId).catch(console.error);

  res.status(200).json({
    date: new Date().toISOString(),
    marketplaceOrderId,
    orderId: sellerOrderId,
    receipt: null,
  });
};

async function enqueueFulfillment(sellerOrderId: string): Promise<void> {
  console.log(`Enqueued fulfillment for ${sellerOrderId}`);
}

const app = express();
app.use(express.json());
app.post("/pvt/orders/:sellerOrderId/fulfill", authorizeFulfillmentHandler);
```

### Step 2: Send Invoice After Fulfillment

Once the order is packed and the invoice is generated, send the invoice notification.

```typescript
async function fulfillAndInvoice(
  client: AxiosInstance,
  order: OrderMapping
): Promise<void> {
  // Generate invoice from your invoicing system
  const invoice = await generateInvoice(order);

  // Send invoice notification to VTEX marketplace
  await sendInvoiceNotification(client, order.marketplaceOrderId, {
    type: "Output",
    invoiceNumber: invoice.number,
    invoiceValue: invoice.totalCents,
    issuanceDate: invoice.issuedAt.toISOString(),
    invoiceUrl: invoice.pdfUrl,
    invoiceKey: invoice.accessKey,
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
    })),
  });

  console.log(
    `Invoice ${invoice.number} sent for order ${order.marketplaceOrderId}`
  );
}

async function generateInvoice(order: OrderMapping): Promise<{
  number: string;
  totalCents: number;
  issuedAt: Date;
  pdfUrl: string;
  accessKey: string;
}> {
  const totalCents = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return {
    number: `NFE-${Date.now()}`,
    totalCents,
    issuedAt: new Date(),
    pdfUrl: `https://invoices.example.com/NFE-${Date.now()}.pdf`,
    accessKey: "35260614388220000199550010000012341000012348",
  };
}
```

### Step 3: Send Tracking When Carrier Picks Up

```typescript
async function handleCarrierPickup(
  client: AxiosInstance,
  orderId: string,
  invoiceNumber: string,
  carrier: { name: string; trackingId: string; trackingUrl: string }
): Promise<void> {
  await updateOrderTracking(client, orderId, invoiceNumber, {
    courier: carrier.name,
    trackingNumber: carrier.trackingId,
    trackingUrl: carrier.trackingUrl,
  });

  console.log(
    `Tracking ${carrier.trackingId} sent for order ${orderId}`
  );
}
```

### Step 4: Confirm Delivery

```typescript
async function handleDeliveryConfirmation(
  client: AxiosInstance,
  orderId: string,
  invoiceNumber: string
): Promise<void> {
  await client.patch(
    `/api/oms/pvt/orders/${orderId}/invoice/${invoiceNumber}`,
    {
      isDelivered: true,
      courier: "",
      trackingNumber: "",
    }
  );

  console.log(`Order ${orderId} marked as delivered`);
}
```

### Complete Example

```typescript
import axios, { AxiosInstance } from "axios";

function createMarketplaceClient(
  accountName: string,
  appKey: string,
  appToken: string
): AxiosInstance {
  return axios.create({
    baseURL: `https://${accountName}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": appKey,
      "X-VTEX-API-AppToken": appToken,
    },
    timeout: 10000,
  });
}

async function completeFulfillmentFlow(
  client: AxiosInstance,
  order: OrderMapping
): Promise<void> {
  // 1. Fulfill and invoice
  await fulfillAndInvoice(client, order);

  // 2. When carrier picks up, send tracking
  const carrierData = await waitForCarrierPickup(order.sellerOrderId);
  const invoice = await getLatestInvoice(order.sellerOrderId);

  await handleCarrierPickup(
    client,
    order.marketplaceOrderId,
    invoice.number,
    carrierData
  );

  // 3. When delivered, confirm
  await waitForDeliveryConfirmation(order.sellerOrderId);
  await handleDeliveryConfirmation(
    client,
    order.marketplaceOrderId,
    invoice.number
  );
}

async function waitForCarrierPickup(
  sellerOrderId: string
): Promise<{ name: string; trackingId: string; trackingUrl: string }> {
  // Replace with actual carrier integration
  return {
    name: "Correios",
    trackingId: "BR123456789",
    trackingUrl: "https://tracking.example.com/BR123456789",
  };
}

async function getLatestInvoice(
  sellerOrderId: string
): Promise<{ number: string }> {
  // Replace with actual invoice lookup
  return { number: `NFE-${sellerOrderId}` };
}

async function waitForDeliveryConfirmation(
  sellerOrderId: string
): Promise<void> {
  // Replace with actual delivery confirmation logic
  console.log(`Waiting for delivery confirmation: ${sellerOrderId}`);
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Sending Invoice Before Fulfillment Authorization

**What happens**: The seller sends an invoice notification immediately when the order is placed, before receiving the Authorize Fulfillment callback from the marketplace.

**Why it fails**: The order hasn't been authorized for fulfillment yet — payment may still be pending or under review. Invoicing before authorization can result in the invoice being rejected or the order being in an inconsistent state.

**Fix**: Only send the invoice after receiving the Authorize Fulfillment callback (`POST /pvt/orders/{sellerOrderId}/fulfill`).

```typescript
// Correct: Wait for fulfillment authorization before invoicing
async function onFulfillmentAuthorized(
  client: AxiosInstance,
  sellerOrderId: string,
  marketplaceOrderId: string
): Promise<void> {
  // Now it's safe to begin fulfillment and send invoice
  const order = orderStore.get(sellerOrderId);
  if (!order) return;

  order.marketplaceOrderId = marketplaceOrderId;
  await fulfillAndInvoice(client, order);
}
```

---

### Anti-Pattern: Not Handling Return Invoices for Cancellation

**What happens**: A seller tries to cancel an invoiced order by calling the Cancel Order endpoint directly without first sending a return invoice.

**Why it fails**: Once an order is in "invoiced" status, it cannot be canceled without a return invoice (`type: "Input"`). The Cancel Order API will reject the request.

**Fix**: Send a return invoice first, then request cancellation.

```typescript
// Correct: Send return invoice before canceling an invoiced order
async function cancelInvoicedOrder(
  client: AxiosInstance,
  orderId: string,
  originalItems: InvoiceItem[],
  originalInvoiceValue: number
): Promise<void> {
  // Step 1: Send return invoice (type: "Input")
  await sendInvoiceNotification(client, orderId, {
    type: "Input", // Return invoice
    invoiceNumber: `RET-${Date.now()}`,
    invoiceValue: originalInvoiceValue,
    issuanceDate: new Date().toISOString(),
    items: originalItems,
  });

  // Step 2: Now cancel the order
  await client.post(
    `/api/marketplace/pvt/orders/${orderId}/cancel`,
    { reason: "Customer requested return" }
  );
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [External Seller Connector - Order Invoicing](https://developers.vtex.com/docs/guides/external-seller-integration-connector#order-invoicing) — Seller-side invoicing flow in the integration guide
- [Order Invoice Notification API](https://developers.vtex.com/docs/api-reference/orders-api#post-/api/oms/pvt/orders/-orderId-/invoice) — API reference for sending invoice data
- [Update Order Tracking API](https://developers.vtex.com/docs/api-reference/orders-api#patch-/api/oms/pvt/orders/-orderId-/invoice/-invoiceNumber-) — API reference for adding/updating tracking info
- [Sending Invoice and Tracking to Marketplace](https://developers.vtex.com/docs/guides/external-marketplace-integration-invoice-tracking) — Guide for marketplace connector invoice/tracking flow
- [Order Flow and Status](https://help.vtex.com/en/docs/tutorials/order-flow-and-status) — Complete order status lifecycle
- [Authorize Fulfillment API](https://developers.vtex.com/docs/api-reference/marketplace-protocol-external-seller-fulfillment#post-/pvt/orders/-sellerOrderId-/fulfill) — API reference for the fulfillment authorization endpoint

---

# Order Integration & Webhooks

## Overview

**What this skill covers**: VTEX order Feed v3 and Hook configuration for marketplace integrations, including webhook setup, order status lifecycle, payload structure, authentication validation, and idempotent event processing.

**When to use it**: When building an integration that needs to react to order status changes in a VTEX marketplace — such as syncing orders to an ERP, triggering fulfillment workflows, or sending notifications to external systems.

**What you'll learn**:
- How to configure Feed v3 and Hook for order updates
- The difference between Feed (pull) and Hook (push) and when to use each
- How to validate webhook authentication and process events idempotently
- How to handle the complete order status lifecycle

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Feed vs. Hook

VTEX provides two mechanisms for consuming order updates:

- **Feed (pull model)**: A queue of order update events. Your integration periodically calls `GET /api/orders/feed` to retrieve events, processes them, then commits them via `POST /api/orders/feed`. You control the pace.
- **Hook (push model)**: VTEX sends order update events to your endpoint via POST whenever an event matches your filter. Your endpoint must respond with HTTP 200 within 5000ms.

Key differences:
| | Feed | Hook |
|---|---|---|
| Model | Pull (active) | Push (reactive) |
| Scalability | You control volume | Must handle any volume |
| Reliability | Events persist in queue | Must be always available |
| Best for | ERPs with limited throughput | High-performance middleware |

Each appKey can configure only one feed and one hook. Different users sharing the same appKey access the same feed/hook.

### Concept 2: Filter Types

Both Feed and Hook support two filter types:

**FromWorkflow** — Filter by order status changes only:
```json
{
  "filter": {
    "type": "FromWorkflow",
    "status": ["ready-for-handling", "handling", "invoiced", "cancel"]
  }
}
```

**FromOrders** — Filter by any order property using JSONata expressions:
```json
{
  "filter": {
    "type": "FromOrders",
    "expression": "status = \"ready-for-handling\" and salesChannel = \"2\"",
    "disableSingleFire": false
  }
}
```

The two filter types are mutually exclusive. Using both in the same configuration request returns `409 Conflict`.

### Concept 3: Hook Notification Payload

When a Hook fires, VTEX sends a POST to your endpoint with this structure:

```json
{
  "Domain": "Marketplace",
  "OrderId": "v40484048naf-01",
  "State": "payment-approved",
  "LastChange": "2019-07-29T23:17:30.0617185Z",
  "Origin": {
    "Account": "accountABC",
    "Key": "vtexappkey-keyEDF"
  }
}
```

The payload contains only the order ID and state — not the full order data. Your integration must call `GET /api/oms/pvt/orders/{orderId}` to retrieve complete order details.

**Architecture/Data Flow**:

```text
VTEX OMS                           Your Integration
   │                                       │
   │── Order status change ──────────────▶│  (Hook POST to your URL)
   │                                       │── Validate auth headers
   │                                       │── Check idempotency (orderId + State)
   │◀── GET /api/oms/pvt/orders/{id} ─────│  (Fetch full order)
   │── Full order data ──────────────────▶│
   │                                       │── Process order
   │◀── HTTP 200 ─────────────────────────│  (Must respond within 5000ms)
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Validate Webhook Authentication

**Rule**: Your hook endpoint MUST validate the authentication headers sent by VTEX before processing any event. The `Origin.Account` and `Origin.Key` fields in the payload must match your expected values.

**Why**: Without auth validation, any actor can send fake order events to your endpoint, triggering unauthorized fulfillment actions, data corruption, or financial losses.

**Detection**: If you see a hook endpoint handler that processes events without checking `Origin.Account`, `Origin.Key`, or custom headers → STOP and add authentication validation.

✅ **CORRECT**:
```typescript
import { RequestHandler } from "express";

interface HookPayload {
  Domain: string;
  OrderId: string;
  State: string;
  LastChange: string;
  Origin: {
    Account: string;
    Key: string;
  };
}

interface HookConfig {
  expectedAccount: string;
  expectedAppKey: string;
  customHeaderKey: string;
  customHeaderValue: string;
}

function createHookHandler(config: HookConfig): RequestHandler {
  return async (req, res) => {
    const payload: HookPayload = req.body;

    // Handle VTEX ping during hook configuration
    if (payload && "hookConfig" in payload) {
      res.status(200).json({ success: true });
      return;
    }

    // Validate Origin credentials
    if (
      payload.Origin?.Account !== config.expectedAccount ||
      payload.Origin?.Key !== config.expectedAppKey
    ) {
      console.error("Unauthorized hook event", {
        receivedAccount: payload.Origin?.Account,
        receivedKey: payload.Origin?.Key,
      });
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validate custom header (configured during hook setup)
    if (req.headers[config.customHeaderKey.toLowerCase()] !== config.customHeaderValue) {
      console.error("Invalid custom header");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Process the event
    await processOrderEvent(payload);
    res.status(200).json({ success: true });
  };
}

async function processOrderEvent(payload: HookPayload): Promise<void> {
  console.log(`Processing order ${payload.OrderId} in state ${payload.State}`);
}
```

❌ **WRONG**:
```typescript
// WRONG: No authentication validation — accepts events from anyone
const unsafeHookHandler: RequestHandler = async (req, res) => {
  const payload: HookPayload = req.body;

  // Directly processing without checking Origin or headers
  // Any actor can POST fake events and trigger unauthorized actions
  await processOrderEvent(payload);
  res.status(200).json({ success: true });
};
```

---

### Constraint: Process Events Idempotently

**Rule**: Your integration MUST process order events idempotently. Use the combination of `OrderId` + `State` + `LastChange` as a deduplication key to prevent duplicate processing.

**Why**: VTEX may deliver the same hook notification multiple times (at-least-once delivery). Without idempotency, duplicate processing can result in double fulfillment, duplicate invoices, or inconsistent state.

**Detection**: If you see an order event handler without an `orderId` duplicate check or deduplication mechanism → warn about idempotency. If the handler directly mutates state without checking if the event was already processed → warn.

✅ **CORRECT**:
```typescript
interface ProcessedEvent {
  orderId: string;
  state: string;
  lastChange: string;
  processedAt: Date;
}

// In-memory store for example — use Redis or database in production
const processedEvents = new Map<string, ProcessedEvent>();

function buildDeduplicationKey(payload: HookPayload): string {
  return `${payload.OrderId}:${payload.State}:${payload.LastChange}`;
}

async function idempotentProcessEvent(payload: HookPayload): Promise<boolean> {
  const deduplicationKey = buildDeduplicationKey(payload);

  // Check if this exact event was already processed
  if (processedEvents.has(deduplicationKey)) {
    console.log(`Event already processed: ${deduplicationKey}`);
    return false; // Skip — already handled
  }

  // Mark as processing (with TTL in production)
  processedEvents.set(deduplicationKey, {
    orderId: payload.OrderId,
    state: payload.State,
    lastChange: payload.LastChange,
    processedAt: new Date(),
  });

  try {
    await handleOrderStateChange(payload.OrderId, payload.State);
    return true;
  } catch (error) {
    // Remove from processed set so it can be retried
    processedEvents.delete(deduplicationKey);
    throw error;
  }
}

async function handleOrderStateChange(orderId: string, state: string): Promise<void> {
  switch (state) {
    case "ready-for-handling":
      await startOrderFulfillment(orderId);
      break;
    case "handling":
      await updateOrderInERP(orderId, "in_progress");
      break;
    case "invoiced":
      await confirmOrderShipped(orderId);
      break;
    case "cancel":
      await cancelOrderInERP(orderId);
      break;
    default:
      console.log(`Unhandled state: ${state} for order ${orderId}`);
  }
}

async function startOrderFulfillment(orderId: string): Promise<void> {
  console.log(`Starting fulfillment for ${orderId}`);
}

async function updateOrderInERP(orderId: string, status: string): Promise<void> {
  console.log(`Updating ERP: ${orderId} → ${status}`);
}

async function confirmOrderShipped(orderId: string): Promise<void> {
  console.log(`Confirming shipment for ${orderId}`);
}

async function cancelOrderInERP(orderId: string): Promise<void> {
  console.log(`Canceling order ${orderId} in ERP`);
}
```

❌ **WRONG**:
```typescript
// WRONG: No deduplication — processes every event even if already handled
async function processWithoutIdempotency(payload: HookPayload): Promise<void> {
  // If VTEX sends the same event twice, this creates duplicate records
  await database.insert("fulfillment_tasks", {
    orderId: payload.OrderId,
    state: payload.State,
    createdAt: new Date(),
  });

  // Duplicate fulfillment task created — items may ship twice
  await triggerFulfillment(payload.OrderId);
}

async function triggerFulfillment(orderId: string): Promise<void> {
  console.log(`Fulfilling ${orderId}`);
}

const database = {
  insert: async (table: string, data: Record<string, unknown>) => {
    console.log(`Inserting into ${table}:`, data);
  },
};
```

---

### Constraint: Handle All Order Statuses

**Rule**: Your integration MUST handle all possible order statuses, including `Status Null`. Unrecognized statuses must be logged but not crash the integration.

**Why**: VTEX documents warn that `Status Null` may be unidentified and end up being mapped as another status, potentially leading to errors. Missing a status in your handler can cause orders to get stuck or lost.

**Detection**: If you see a status handler that only covers 2-3 statuses without a default/fallback case → warn about incomplete status handling.

✅ **CORRECT**:
```typescript
type OrderStatus =
  | "order-created"
  | "order-completed"
  | "on-order-completed"
  | "payment-pending"
  | "waiting-for-order-authorization"
  | "approve-payment"
  | "payment-approved"
  | "payment-denied"
  | "request-cancel"
  | "waiting-for-seller-decision"
  | "authorize-fulfillment"
  | "order-create-error"
  | "order-creation-error"
  | "window-to-cancel"
  | "ready-for-handling"
  | "start-handling"
  | "handling"
  | "invoice-after-cancellation-deny"
  | "order-accepted"
  | "invoiced"
  | "cancel"
  | "canceled";

async function handleAllStatuses(orderId: string, state: string): Promise<void> {
  switch (state) {
    case "ready-for-handling":
    case "start-handling":
      await notifyWarehouse(orderId, "prepare");
      break;

    case "handling":
      await updateFulfillmentStatus(orderId, "in_progress");
      break;

    case "invoiced":
      await markAsShipped(orderId);
      break;

    case "cancel":
    case "canceled":
    case "request-cancel":
      await handleCancellation(orderId, state);
      break;

    case "payment-approved":
      await confirmPaymentReceived(orderId);
      break;

    case "payment-denied":
      await handlePaymentFailure(orderId);
      break;

    default:
      // CRITICAL: Log unknown statuses instead of crashing
      console.warn(`Unknown or unhandled order status: "${state}" for order ${orderId}`);
      await logUnhandledStatus(orderId, state);
      break;
  }
}

async function notifyWarehouse(orderId: string, action: string): Promise<void> {
  console.log(`Warehouse notification: ${orderId} → ${action}`);
}
async function updateFulfillmentStatus(orderId: string, status: string): Promise<void> {
  console.log(`Fulfillment status: ${orderId} → ${status}`);
}
async function markAsShipped(orderId: string): Promise<void> {
  console.log(`Shipped: ${orderId}`);
}
async function handleCancellation(orderId: string, state: string): Promise<void> {
  console.log(`Cancellation: ${orderId} (${state})`);
}
async function confirmPaymentReceived(orderId: string): Promise<void> {
  console.log(`Payment received: ${orderId}`);
}
async function handlePaymentFailure(orderId: string): Promise<void> {
  console.log(`Payment failed: ${orderId}`);
}
async function logUnhandledStatus(orderId: string, state: string): Promise<void> {
  console.log(`UNHANDLED: ${orderId} → ${state}`);
}
```

❌ **WRONG**:
```typescript
// WRONG: Only handles 2 statuses, no fallback for unknown statuses
async function incompleteHandler(orderId: string, state: string): Promise<void> {
  if (state === "ready-for-handling") {
    await startOrderFulfillment(orderId);
  } else if (state === "invoiced") {
    await confirmOrderShipped(orderId);
  }
  // All other statuses silently ignored — orders get lost
  // "cancel" events never processed — canceled orders still ship
  // "Status Null" could be misinterpreted
}
```

## Implementation Pattern

**The canonical, recommended way to implement order integration.**

### Step 1: Configure the Hook

Set up the hook with appropriate filters and your endpoint URL.

```typescript
import axios, { AxiosInstance } from "axios";

interface HookSetupConfig {
  accountName: string;
  appKey: string;
  appToken: string;
  hookUrl: string;
  hookHeaderKey: string;
  hookHeaderValue: string;
  filterStatuses: string[];
}

async function configureOrderHook(config: HookSetupConfig): Promise<void> {
  const client: AxiosInstance = axios.create({
    baseURL: `https://${config.accountName}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": config.appKey,
      "X-VTEX-API-AppToken": config.appToken,
    },
  });

  const hookConfig = {
    filter: {
      type: "FromWorkflow",
      status: config.filterStatuses,
    },
    hook: {
      url: config.hookUrl,
      headers: {
        [config.hookHeaderKey]: config.hookHeaderValue,
      },
    },
  };

  await client.post("/api/orders/hook/config", hookConfig);
  console.log("Hook configured successfully");
}

// Example usage:
await configureOrderHook({
  accountName: "mymarketplace",
  appKey: process.env.VTEX_APP_KEY!,
  appToken: process.env.VTEX_APP_TOKEN!,
  hookUrl: "https://my-integration.example.com/vtex/order-hook",
  hookHeaderKey: "X-Integration-Secret",
  hookHeaderValue: process.env.HOOK_SECRET!,
  filterStatuses: [
    "ready-for-handling",
    "start-handling",
    "handling",
    "invoiced",
    "cancel",
  ],
});
```

### Step 2: Build the Hook Endpoint with Auth and Idempotency

```typescript
import express from "express";

const app = express();
app.use(express.json());

const hookConfig: HookConfig = {
  expectedAccount: process.env.VTEX_ACCOUNT_NAME!,
  expectedAppKey: process.env.VTEX_APP_KEY!,
  customHeaderKey: "X-Integration-Secret",
  customHeaderValue: process.env.HOOK_SECRET!,
};

app.post("/vtex/order-hook", createHookHandler(hookConfig));

// The createHookHandler and idempotentProcessEvent functions
// from the Constraints section above handle auth + deduplication
```

### Step 3: Fetch Full Order Data and Process

After receiving the hook notification, fetch the complete order data for processing.

```typescript
interface VtexOrder {
  orderId: string;
  status: string;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
    sellingPrice: number;
  }>;
  clientProfileData: {
    email: string;
    firstName: string;
    lastName: string;
    document: string;
  };
  shippingData: {
    address: {
      postalCode: string;
      city: string;
      state: string;
      country: string;
      street: string;
      number: string;
    };
    logisticsInfo: Array<{
      itemIndex: number;
      selectedSla: string;
      shippingEstimate: string;
    }>;
  };
  totals: Array<{
    id: string;
    name: string;
    value: number;
  }>;
  value: number;
}

async function fetchAndProcessOrder(
  client: AxiosInstance,
  orderId: string,
  state: string
): Promise<void> {
  const response = await client.get<VtexOrder>(
    `/api/oms/pvt/orders/${orderId}`
  );
  const order = response.data;

  switch (state) {
    case "ready-for-handling":
      await createFulfillmentTask({
        orderId: order.orderId,
        items: order.items.map((item) => ({
          skuId: item.id,
          name: item.name,
          quantity: item.quantity,
        })),
        shippingAddress: order.shippingData.address,
        estimatedDelivery: order.shippingData.logisticsInfo[0]?.shippingEstimate,
      });
      break;

    case "cancel":
      await cancelFulfillmentTask(order.orderId);
      break;

    default:
      console.log(`Order ${orderId}: state=${state}, no action needed`);
  }
}

async function createFulfillmentTask(task: Record<string, unknown>): Promise<void> {
  console.log("Creating fulfillment task:", task);
}

async function cancelFulfillmentTask(orderId: string): Promise<void> {
  console.log("Canceling fulfillment task:", orderId);
}
```

### Step 4: Implement Feed as Fallback

Use Feed v3 as a backup to catch any events the hook might miss during downtime.

```typescript
async function pollFeedAsBackup(client: AxiosInstance): Promise<void> {
  const feedResponse = await client.get<Array<{
    eventId: string;
    handle: string;
    domain: string;
    state: string;
    orderId: string;
    lastChange: string;
  }>>("/api/orders/feed");

  const events = feedResponse.data;

  if (events.length === 0) {
    return; // No events in queue
  }

  const handlesToCommit: string[] = [];

  for (const event of events) {
    try {
      await fetchAndProcessOrder(client, event.orderId, event.state);
      handlesToCommit.push(event.handle);
    } catch (error) {
      console.error(`Failed to process feed event for ${event.orderId}:`, error);
      // Don't commit failed events — they'll return to the queue after visibility timeout
    }
  }

  // Commit successfully processed events
  if (handlesToCommit.length > 0) {
    await client.post("/api/orders/feed", {
      handles: handlesToCommit,
    });
  }
}

// Run feed polling on a schedule (e.g., every 2 minutes)
setInterval(async () => {
  try {
    const client = createVtexClient();
    await pollFeedAsBackup(client);
  } catch (error) {
    console.error("Feed polling error:", error);
  }
}, 120000); // 2 minutes

function createVtexClient(): AxiosInstance {
  return axios.create({
    baseURL: `https://${process.env.VTEX_ACCOUNT_NAME}.vtexcommercestable.com.br`,
    headers: {
      "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
      "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
    },
  });
}
```

### Complete Example

```typescript
import express from "express";
import axios, { AxiosInstance } from "axios";

// 1. Configure hook
async function setupIntegration(): Promise<void> {
  await configureOrderHook({
    accountName: process.env.VTEX_ACCOUNT_NAME!,
    appKey: process.env.VTEX_APP_KEY!,
    appToken: process.env.VTEX_APP_TOKEN!,
    hookUrl: `${process.env.BASE_URL}/vtex/order-hook`,
    hookHeaderKey: "X-Integration-Secret",
    hookHeaderValue: process.env.HOOK_SECRET!,
    filterStatuses: [
      "ready-for-handling",
      "handling",
      "invoiced",
      "cancel",
    ],
  });
}

// 2. Start webhook server
const app = express();
app.use(express.json());

const hookHandler = createHookHandler({
  expectedAccount: process.env.VTEX_ACCOUNT_NAME!,
  expectedAppKey: process.env.VTEX_APP_KEY!,
  customHeaderKey: "X-Integration-Secret",
  customHeaderValue: process.env.HOOK_SECRET!,
});

app.post("/vtex/order-hook", hookHandler);

// 3. Health check for VTEX ping
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// 4. Start feed polling as backup
setInterval(async () => {
  try {
    const client = createVtexClient();
    await pollFeedAsBackup(client);
  } catch (error) {
    console.error("Feed backup polling error:", error);
  }
}, 120000);

app.listen(3000, () => {
  console.log("Order integration running on port 3000");
  setupIntegration().catch(console.error);
});
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Using List Orders API Instead of Feed/Hook

**What happens**: Developers poll `GET /api/oms/pvt/orders` with status filters to detect order changes instead of using Feed v3 or Hook.

**Why it fails**: The List Orders API depends on indexing, which can lag behind real-time updates. It's slower, less reliable, and more likely to hit rate limits when polled frequently. Feed v3 runs before indexing and doesn't depend on it.

**Fix**: Migrate to Feed v3 or Hook for order change detection. Use List Orders only for ad-hoc queries.

```typescript
// Correct: Use Feed v3 to consume order updates
async function consumeOrderFeed(client: AxiosInstance): Promise<void> {
  const response = await client.get("/api/orders/feed");
  const events = response.data;

  for (const event of events) {
    await processOrderEvent({
      Domain: "Marketplace",
      OrderId: event.orderId,
      State: event.state,
      LastChange: event.lastChange,
      Origin: { Account: "", Key: "" },
    });
  }

  // Commit processed events
  const handles = events.map((e: { handle: string }) => e.handle);
  if (handles.length > 0) {
    await client.post("/api/orders/feed", { handles });
  }
}
```

---

### Anti-Pattern: Blocking Hook Response with Long Processing

**What happens**: The hook endpoint performs all order processing synchronously before responding to VTEX.

**Why it fails**: VTEX requires the hook endpoint to respond with HTTP 200 within **5000ms**. If processing takes longer (e.g., ERP sync, complex database writes), VTEX considers the delivery failed and retries with increasing delays. Repeated failures can lead to hook deactivation.

**Fix**: Acknowledge the event immediately, then process asynchronously via a queue.

```typescript
import { RequestHandler } from "express";

// Correct: Acknowledge immediately, process async
const asyncHookHandler: RequestHandler = async (req, res) => {
  const payload: HookPayload = req.body;

  // Validate auth (fast operation)
  if (!validateAuth(payload, req.headers)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Enqueue for async processing (fast operation)
  await enqueueOrderEvent(payload);

  // Respond immediately — well within 5000ms
  res.status(200).json({ received: true });
};

function validateAuth(
  payload: HookPayload,
  headers: Record<string, unknown>
): boolean {
  return (
    payload.Origin?.Account === process.env.VTEX_ACCOUNT_NAME &&
    headers["x-integration-secret"] === process.env.HOOK_SECRET
  );
}

async function enqueueOrderEvent(payload: HookPayload): Promise<void> {
  // Use a message queue (SQS, RabbitMQ, Redis, etc.)
  console.log(`Enqueued order event: ${payload.OrderId}`);
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Feed v3 Guide](https://developers.vtex.com/docs/guides/orders-feed) — Complete guide to Feed and Hook configuration, filter types, and best practices
- [Orders API - Feed v3 Endpoints](https://developers.vtex.com/docs/api-reference/orders-api#get-/api/orders/feed) — API reference for feed retrieval and commit
- [Hook Configuration API](https://developers.vtex.com/docs/api-reference/orders-api#post-/api/orders/hook/config) — API reference for creating and updating hook configuration
- [Orders Overview](https://developers.vtex.com/docs/guides/orders-overview) — Overview of the VTEX Orders module
- [Order Flow and Status](https://help.vtex.com/en/docs/tutorials/order-flow-and-status) — Complete list of order statuses and transitions
- [ERP Integration - Set Up Order Integration](https://developers.vtex.com/docs/guides/erp-integration-set-up-order-integration) — Guide for integrating order feed with back-office systems

---

# API Rate Limiting & Resilience

## Overview

**What this skill covers**: VTEX API rate limiting mechanics, response headers for rate limit awareness, and resilience patterns including exponential backoff with jitter, circuit breakers, and request queuing for marketplace integrations.

**When to use it**: When building any integration that calls VTEX APIs — catalog sync, order processing, price/inventory updates, or fulfillment operations — and needs to handle rate limits gracefully without losing data or degrading performance.

**What you'll learn**:
- How VTEX rate limits work, including burst credits and per-route limits
- How to read and react to rate limit headers (`Retry-After`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- How to implement exponential backoff with jitter to avoid thundering herd problems
- How to build circuit breakers and request queues for high-throughput integrations

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: VTEX Rate Limit Mechanics

VTEX enforces rate limits per route per account. When limits are exceeded:
- **429 Too Many Requests** — Your request was rejected. The response includes a `Retry-After` header (in seconds) indicating when to retry.
- **503 Service Unavailable** — A circuit breaker was activated because the target service received too many errors. Requests are temporarily blocked to let the service recover.

Rate limits vary by API:
- **Pricing API**: PUT/POST routes: 40 requests/second/account with 1000 burst credits. DELETE: 16 requests/second/account with 300 burst credits.
- **Catalog API**: Varies by endpoint; no published fixed limits.
- **Orders API**: Subject to general platform limits; VTEX recommends 1-minute backoff on 429.

**Burst Credits**: When you exceed the rate limit, excess requests consume burst credits (1 credit per excess request). When burst credits reach 0, the request is blocked with 429. Credits refill over time at the same rate as the route's limit when the route is not being used.

### Concept 2: Rate Limit Response Headers

VTEX APIs return these headers to help your integration manage request rates:

| Header | Description |
|---|---|
| `Retry-After` | Seconds to wait before retrying (present on 429 responses) |
| `X-RateLimit-Remaining` | Number of requests remaining in the current window |
| `X-RateLimit-Reset` | Timestamp (seconds) when the rate limit window resets |

Always read `Retry-After` on 429 responses. Using a fixed retry interval instead ignores the server's guidance and may cause prolonged blocking.

### Concept 3: Exponential Backoff with Jitter

Exponential backoff increases the wait time between retries exponentially (e.g., 1s, 2s, 4s, 8s). **Jitter** adds randomness to prevent the "thundering herd" problem where many clients retry at the same time after a rate limit window resets.

The formula: `delay = min(maxDelay, baseDelay * 2^attempt) * (0.5 + random(0, 0.5))`

This ensures:
- Failed requests are retried with increasing delays
- Multiple clients don't retry simultaneously
- The delay is bounded by a maximum to prevent excessively long waits

**Architecture/Data Flow**:

```text
Your Integration                          VTEX API
      │                                       │
      │── Request ──────────────────────────▶│
      │◀── 200 OK ─────────────────────────│  (success)
      │                                       │
      │── Request ──────────────────────────▶│
      │◀── 429 + Retry-After: 30 ──────────│  (rate limited)
      │                                       │
      │   [Wait: max(Retry-After, backoff)]   │
      │   [backoff = base * 2^attempt * jitter]│
      │                                       │
      │── Retry ───────────────────────────▶│
      │◀── 200 OK ─────────────────────────│  (success)
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Implement Exponential Backoff on 429 Responses

**Rule**: When receiving a 429 response, the integration MUST wait before retrying using exponential backoff with jitter. The wait time MUST respect the `Retry-After` header when present.

**Why**: Immediate retries after a 429 will be rejected again and consume burst credits faster, leading to prolonged blocking. Without jitter, all clients retry simultaneously after the window resets, causing another rate limit spike (thundering herd).

**Detection**: If you see immediate retry on 429 (no delay, no backoff) → STOP and implement exponential backoff. If you see retry logic without reading the `Retry-After` header → warn that the header should be respected. If you see `while(true)` retry loops or `setInterval` with intervals less than 5 seconds → warn about tight loops.

✅ **CORRECT**:
```typescript
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
};

/**
 * Calculates exponential backoff delay with full jitter.
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt) * random(0.5, 1.0)
 *
 * The jitter prevents thundering herd when multiple clients
 * are rate-limited simultaneously.
 */
function calculateBackoffWithJitter(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const boundedDelay = Math.min(maxDelayMs, exponentialDelay);
  // Full jitter: random value between 50% and 100% of the bounded delay
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(boundedDelay * jitter);
}

/**
 * Executes an API request with automatic retry on 429 responses.
 * Respects the Retry-After header and applies exponential backoff with jitter.
 */
async function requestWithRetry<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<AxiosResponse<T>> {
  let lastError: AxiosError | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await client.request<T>(config);
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        throw error;
      }

      lastError = error;
      const status = error.response?.status;

      // Only retry on 429 (rate limited) and 503 (circuit breaker)
      if (status !== 429 && status !== 503) {
        throw error;
      }

      if (attempt === retryConfig.maxRetries) {
        break; // Exhausted retries
      }

      // Respect Retry-After header if present (value is in seconds)
      const retryAfterHeader = error.response?.headers?.["retry-after"];
      const retryAfterMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : 0;

      // Use the greater of Retry-After or calculated backoff
      const backoffMs = calculateBackoffWithJitter(
        attempt,
        retryConfig.baseDelayMs,
        retryConfig.maxDelayMs
      );
      const delayMs = Math.max(retryAfterMs, backoffMs);

      console.warn(
        `Rate limited (${status}). Retry ${attempt + 1}/${retryConfig.maxRetries} ` +
          `in ${delayMs}ms (Retry-After: ${retryAfterHeader ?? "none"}, ` +
          `backoff: ${backoffMs}ms)`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError ?? new Error("Request failed after all retries");
}
```

❌ **WRONG**:
```typescript
// WRONG: Immediate retry without backoff or Retry-After respect
async function retryImmediately<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await client.request<T>(config);
      return response.data;
    } catch (error: unknown) {
      // Retries immediately — will hit 429 again and drain burst credits
      // Does not read Retry-After header — ignores server guidance
      console.log(`Retry ${i + 1}...`);
      // No delay at all — thundering herd when multiple instances retry
    }
  }
  throw new Error("Failed after retries");
}
```

---

### Constraint: Respect the Retry-After Header

**Rule**: When a 429 response includes a `Retry-After` header, the integration MUST wait at least the specified number of seconds before retrying. The backoff delay should be the maximum of the calculated backoff and the `Retry-After` value.

**Why**: The `Retry-After` header is the server's explicit instruction on when it will accept requests again. Ignoring it results in requests being rejected until the specified time has passed, wasting bandwidth and potentially extending the block period.

**Detection**: If you see retry logic that does not read or use the `Retry-After` header value → warn that the header should be checked. If the retry delay is always a fixed value regardless of the header → warn.

✅ **CORRECT**:
```typescript
function getRetryDelayMs(error: AxiosError, attempt: number): number {
  const retryAfterHeader = error.response?.headers?.["retry-after"];

  // Parse Retry-After (could be seconds or HTTP-date)
  let retryAfterMs = 0;
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      retryAfterMs = seconds * 1000;
    } else {
      // HTTP-date format
      const retryDate = new Date(retryAfterHeader).getTime();
      retryAfterMs = Math.max(0, retryDate - Date.now());
    }
  }

  // Calculate backoff with jitter
  const backoffMs = calculateBackoffWithJitter(attempt, 1000, 60000);

  // Use the larger value — respect server guidance
  return Math.max(retryAfterMs, backoffMs);
}
```

❌ **WRONG**:
```typescript
// WRONG: Fixed 1-second retry ignoring Retry-After header
async function fixedRetry<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig
): Promise<T> {
  try {
    const response = await client.request<T>(config);
    return response.data;
  } catch {
    // Always waits 1 second regardless of Retry-After header
    // If Retry-After says 60 seconds, this will fail again and again
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await client.request<T>(config);
    return response.data;
  }
}
```

---

### Constraint: No Tight Retry Loops

**Rule**: Integrations MUST NOT use `while(true)` loops for retrying or `setInterval`/`setTimeout` with intervals less than 5 seconds for polling VTEX APIs.

**Why**: Tight loops generate excessive requests that quickly exhaust rate limits, degrade VTEX platform performance for all users, and can make the VTEX Admin unavailable for the account. VTEX explicitly warns that excessive 429 errors can make Admin unavailable.

**Detection**: If you see `while(true)` or `for(;;)` retry patterns without adequate delays → warn about tight loops. If you see `setInterval` with intervals less than 5000ms for API calls → warn about polling frequency.

✅ **CORRECT**:
```typescript
// Correct: Controlled polling with adequate intervals
async function pollWithBackpressure(
  client: AxiosInstance,
  intervalMs: number = 30000 // 30 seconds minimum
): Promise<void> {
  const poll = async (): Promise<void> => {
    try {
      const response = await client.get("/api/orders/feed");
      const events = response.data;

      if (events.length > 0) {
        await processEvents(events);
        await commitEvents(
          client,
          events.map((e: { handle: string }) => e.handle)
        );
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = parseInt(
          error.response.headers["retry-after"] || "60",
          10
        );
        console.warn(`Rate limited, waiting ${retryAfter}s`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return;
      }
      console.error("Polling error:", error);
    }

    // Schedule next poll
    setTimeout(poll, intervalMs);
  };

  // Start polling
  await poll();
}

async function processEvents(events: unknown[]): Promise<void> {
  console.log(`Processing ${events.length} events`);
}

async function commitEvents(client: AxiosInstance, handles: string[]): Promise<void> {
  await client.post("/api/orders/feed", { handles });
}
```

❌ **WRONG**:
```typescript
// WRONG: Tight loop with no backpressure
async function tightLoop(client: AxiosInstance): Promise<void> {
  while (true) {
    try {
      const response = await client.get("/api/orders/feed");
      await processEvents(response.data);
    } catch {
      // Immediate retry — no delay, burns through rate limits
      continue;
    }
  }
}

// WRONG: setInterval with 1-second polling
setInterval(async () => {
  // 1 request/second = 3600/hour — will trigger rate limits quickly
  const client = createClient();
  await client.get("/api/catalog_system/pvt/sku/stockkeepingunitids");
}, 1000);

function createClient(): AxiosInstance {
  return axios.create({ baseURL: "https://account.vtexcommercestable.com.br" });
}
```

## Implementation Pattern

**The canonical, recommended way to implement rate-limit-aware VTEX API calls.**

### Step 1: Create a Rate-Limit-Aware HTTP Client

Wrap your HTTP client with automatic retry logic.

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

interface RateLimitedClientConfig {
  accountName: string;
  appKey: string;
  appToken: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function createRateLimitedClient(config: RateLimitedClientConfig): {
  client: AxiosInstance;
  request: <T>(requestConfig: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
} {
  const client = axios.create({
    baseURL: `https://${config.accountName}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": config.appKey,
      "X-VTEX-API-AppToken": config.appToken,
    },
    timeout: 30000,
  });

  const retryConfig: RetryConfig = {
    maxRetries: config.maxRetries ?? 5,
    baseDelayMs: config.baseDelayMs ?? 1000,
    maxDelayMs: config.maxDelayMs ?? 60000,
  };

  return {
    client,
    request: <T>(requestConfig: AxiosRequestConfig) =>
      requestWithRetry<T>(client, requestConfig, retryConfig),
  };
}
```

### Step 2: Implement a Circuit Breaker

Prevent cascading failures when a service is consistently failing.

```typescript
enum CircuitState {
  CLOSED = "CLOSED",     // Normal operation — requests flow through
  OPEN = "OPEN",         // Service failing — requests blocked
  HALF_OPEN = "HALF_OPEN", // Testing recovery — one request allowed
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeMs: number = 30000,
    private readonly halfOpenSuccessThreshold: number = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeMs) {
        throw new Error(
          `Circuit breaker is OPEN. Retry after ${this.recoveryTimeMs}ms.`
        );
      }
      // Transition to half-open for a test request
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        console.log("Circuit breaker: CLOSED (recovered)");
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.warn(
        `Circuit breaker: OPEN after ${this.failureCount} failures`
      );
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

### Step 3: Implement a Request Queue

Queue requests to control throughput and avoid bursts.

```typescript
interface QueuedRequest<T> {
  config: AxiosRequestConfig;
  resolve: (value: AxiosResponse<T>) => void;
  reject: (error: Error) => void;
}

class RequestQueue {
  private queue: Array<QueuedRequest<unknown>> = [];
  private processing: boolean = false;
  private readonly requestsPerSecond: number;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly client: {
      request: <T>(config: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
    },
    requestsPerSecond: number = 10,
    circuitBreaker?: CircuitBreaker
  ) {
    this.requestsPerSecond = requestsPerSecond;
    this.circuitBreaker = circuitBreaker ?? new CircuitBreaker();
  }

  async enqueue<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return new Promise<AxiosResponse<T>>((resolve, reject) => {
      this.queue.push({
        config,
        resolve: resolve as (value: AxiosResponse<unknown>) => void,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const delayBetweenRequests = 1000 / this.requestsPerSecond;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;

      try {
        const result = await this.circuitBreaker.execute(() =>
          this.client.request(request.config)
        );
        request.resolve(result);
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }

      // Throttle between requests
      if (this.queue.length > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenRequests)
        );
      }
    }

    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
```

### Step 4: Monitor Rate Limit Headers Proactively

Read rate limit headers to slow down before hitting 429.

```typescript
import { AxiosResponse } from "axios";

interface RateLimitInfo {
  remaining: number | null;
  resetAt: number | null;
  retryAfter: number | null;
}

function parseRateLimitHeaders(response: AxiosResponse): RateLimitInfo {
  return {
    remaining: response.headers["x-ratelimit-remaining"]
      ? parseInt(response.headers["x-ratelimit-remaining"], 10)
      : null,
    resetAt: response.headers["x-ratelimit-reset"]
      ? parseInt(response.headers["x-ratelimit-reset"], 10) * 1000
      : null,
    retryAfter: response.headers["retry-after"]
      ? parseInt(response.headers["retry-after"], 10) * 1000
      : null,
  };
}

async function adaptiveRequest<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
  queue: RequestQueue
): Promise<AxiosResponse<T>> {
  const response = await queue.enqueue<T>(config);
  const rateInfo = parseRateLimitHeaders(response);

  // Proactively slow down when remaining requests are low
  if (rateInfo.remaining !== null && rateInfo.remaining < 10) {
    console.warn(
      `Rate limit approaching: ${rateInfo.remaining} requests remaining. ` +
        `Slowing down.`
    );
    // Add extra delay to reduce pressure
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return response;
}
```

### Complete Example

```typescript
import axios from "axios";

async function buildResilientIntegration(): Promise<void> {
  const { client, request } = createRateLimitedClient({
    accountName: process.env.VTEX_ACCOUNT_NAME!,
    appKey: process.env.VTEX_APP_KEY!,
    appToken: process.env.VTEX_APP_TOKEN!,
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
  });

  const circuitBreaker = new CircuitBreaker(
    5,     // Open after 5 failures
    30000, // Wait 30s before testing recovery
    3      // Close after 3 successful half-open requests
  );

  const queue = new RequestQueue({ request }, 10, circuitBreaker);

  // Example: Batch update prices with rate limiting
  const skuIds = ["sku-1", "sku-2", "sku-3", "sku-4", "sku-5"];

  for (const skuId of skuIds) {
    try {
      const response = await queue.enqueue({
        method: "POST",
        url: `/notificator/seller01/changenotification/${skuId}/price`,
      });

      const rateInfo = parseRateLimitHeaders(response);
      if (rateInfo.remaining !== null && rateInfo.remaining < 5) {
        console.warn("Approaching rate limit, adding delay");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Circuit breaker is OPEN")) {
        console.error("Circuit breaker open — pausing all requests");
        await new Promise((resolve) => setTimeout(resolve, 30000));
      } else {
        console.error(`Failed to update price for ${skuId}:`, error);
      }
    }
  }
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Fixed Retry Delay Without Jitter

**What happens**: Developers implement retry logic with a fixed delay (e.g., always wait 5 seconds) instead of exponential backoff with jitter.

**Why it fails**: When multiple integration instances are rate-limited simultaneously, they all retry at the same time (5 seconds later), creating another burst that triggers rate limiting again. This "thundering herd" pattern can persist indefinitely.

**Fix**: Use exponential backoff with random jitter so retries are spread across time.

```typescript
// Correct: Exponential backoff with jitter
function getRetryDelay(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 60000;
  const exponential = baseDelay * Math.pow(2, attempt);
  const bounded = Math.min(maxDelay, exponential);
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(bounded * jitter);
}

// attempt 0: ~500-1000ms
// attempt 1: ~1000-2000ms
// attempt 2: ~2000-4000ms
// attempt 3: ~4000-8000ms
// attempt 4: ~8000-16000ms
```

---

### Anti-Pattern: No Proactive Rate Management

**What happens**: Developers only handle 429 errors reactively (after being rate limited) instead of monitoring rate limit headers to slow down proactively.

**Why it fails**: By the time you receive a 429, you've already lost burst credits. Proactive monitoring of `X-RateLimit-Remaining` allows you to reduce request rate before hitting the limit, maintaining consistent throughput.

**Fix**: Read rate limit headers on successful responses and adjust request pacing when remaining quota is low.

```typescript
// Correct: Proactive rate management
async function proactiveRateManagement(
  client: AxiosInstance,
  requests: AxiosRequestConfig[]
): Promise<void> {
  let delayBetweenRequests = 100; // Start at 100ms between requests

  for (const config of requests) {
    const response = await requestWithRetry(client, config);
    const rateInfo = parseRateLimitHeaders(response);

    // Proactively adjust speed based on remaining quota
    if (rateInfo.remaining !== null) {
      if (rateInfo.remaining < 5) {
        delayBetweenRequests = 5000; // Slow down significantly
      } else if (rateInfo.remaining < 20) {
        delayBetweenRequests = 1000; // Moderate slowdown
      } else {
        delayBetweenRequests = 100; // Normal speed
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayBetweenRequests));
  }
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Best Practices for Avoiding Rate Limit Errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Official VTEX guide on rate limit management and best practices
- [Handling Errors and Exceptions](https://developers.vtex.com/docs/guides/handling-errors-and-exceptions) — VTEX guide on error handling including 429 and 5xx responses
- [API Response Status Codes](https://developers.vtex.com/docs/guides/api-response-codes) — Complete list of VTEX API response codes and their meanings
- [Pricing API Overview - Rate Limits](https://developers.vtex.com/docs/guides/pricing-api-overview) — Specific rate limit documentation for the Pricing API including burst credits
- [Feed v3 - Best Practices](https://developers.vtex.com/docs/guides/orders-feed) — Rate limiting recommendations for order feed integrations
- [How to Load Test a Store](https://developers.vtex.com/docs/guides/how-to-load-test-a-store) — VTEX documentation on rate limiting behavior, 429 responses, and circuit breakers

---

# Payment Connector Development

# Asynchronous Payment Flows & Callbacks

## Overview

**What this skill covers**: The complete asynchronous payment authorization flow in the VTEX Payment Provider Protocol. This includes returning `undefined` status for pending payments, using the `callbackUrl` to notify the Gateway of final status, handling the difference between notification callbacks (non-VTEX IO) and retry callbacks (VTEX IO), and managing the 7-day retry window.

**When to use it**: When implementing a payment connector that supports any asynchronous payment method — Boleto Bancário, Pix, bank transfers, redirect-based flows, or any method where the acquirer does not return a final status synchronously.

**What you'll learn**:
- When and how to return `undefined` status from Create Payment
- How the `callbackUrl` notification and retry flows work
- How to validate `X-VTEX-signature` on callback URLs
- How to handle the Gateway's automatic 7-day retry cycle

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: The `undefined` Status

When a payment cannot be resolved immediately (the acquirer needs time, the customer must complete an action), the connector returns `status: "undefined"` in the Create Payment response. This tells the Gateway the payment is pending — not failed, not approved. The Gateway will then wait and retry until a final status (`approved` or `denied`) is received.

### Concept 2: Callback URL — Two Flows

The `callbackUrl` is provided in the Create Payment request body. Its behavior depends on the hosting model:

- **Without VTEX IO** (partner infrastructure): The `callbackUrl` is a **notification endpoint**. The provider POSTs the updated status directly to this URL with `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers.
- **With VTEX IO**: The `callbackUrl` is a **retry endpoint**. The provider calls this URL (no payload required) to trigger the Gateway to re-call the Create Payment (`/payments`) endpoint. The Gateway then receives the updated status from the provider's response.

Both flows require the `X-VTEX-signature` query parameter to be preserved when calling the callback URL.

### Concept 3: The 7-Day Retry Window

If a payment remains in `undefined` status, the VTEX Gateway automatically retries the Create Payment endpoint periodically for up to 7 days. During this window, the connector must be prepared to receive repeated Create Payment calls with the same `paymentId`. When the payment is finally resolved, the connector returns the final status. If still `undefined` after 7 days, the payment is automatically cancelled.

### Concept 4: X-VTEX-signature

The `callbackUrl` includes a query parameter `X-VTEX-signature`. This is a mandatory authentication token that identifies the transaction. When calling the callback URL, the provider must use the URL exactly as received (including all query parameters) to ensure the Gateway can authenticate the callback.

**Architecture/Data Flow (Non-VTEX IO)**:

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (with X-VTEX-API-AppKey/AppToken headers)
4. Gateway updates payment status to approved/denied
```

**Architecture/Data Flow (VTEX IO)**:

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (retry, no payload)
4. Gateway → POST /payments → Connector (returns status: "approved"/"denied")
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: MUST Return `undefined` for Async Payment Methods

**Rule**: For any payment method where authorization does not complete synchronously (Boleto, Pix, bank transfer, redirect-based auth), the Create Payment response MUST use `status: "undefined"`. The connector MUST NOT return `"approved"` or `"denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why**: Returning `"approved"` for an unconfirmed payment tells the Gateway the money has been collected. The order is released for fulfillment immediately. If the customer never actually pays (e.g., never scans the Pix QR code), the merchant ships products without payment. Returning `"denied"` prematurely cancels a payment that might still be completed by the customer.

**Detection**: If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect), STOP. Async methods must return `"undefined"` and resolve via callback.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const asyncMethods = ["BankInvoice", "Pix"];
  const isAsync = asyncMethods.includes(paymentMethod);

  if (isAsync) {
    const pending = await acquirer.initiateAsyncPayment(req.body);

    // Store callbackUrl for later notification
    await store.save(paymentId, {
      paymentId,
      status: "undefined",
      callbackUrl,
      acquirerReference: pending.reference,
    });

    res.status(200).json({
      paymentId,
      status: "undefined",  // Correct: payment is pending
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "PENDING",
      message: "Awaiting customer action",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: 604800,  // 7 days for async
      paymentUrl: pending.qrCodeUrl ?? pending.boletoUrl ?? undefined,
    });
    return;
  }

  // Synchronous methods (credit card) can return final status
  const result = await acquirer.authorizeSyncPayment(req.body);
  res.status(200).json({
    paymentId,
    status: result.status,  // "approved" or "denied" is OK for sync
    // ... other fields
  });
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod } = req.body;

  // WRONG: Creating a Pix charge and immediately returning "approved"
  // The customer hasn't scanned the QR code yet — no money collected
  const pixCharge = await acquirer.createPixCharge(req.body);

  res.status(200).json({
    paymentId,
    status: "approved",  // WRONG — Pix hasn't been paid yet!
    authorizationId: pixCharge.id,
    nsu: null,
    tid: null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

---

### Constraint: MUST Use callbackUrl from Request — Never Hardcode

**Rule**: The connector MUST use the exact `callbackUrl` provided in the Create Payment request body, including all query parameters (`X-VTEX-signature`, etc.). The connector MUST NOT hardcode callback URLs or construct them manually.

**Why**: The `callbackUrl` contains transaction-specific authentication tokens (`X-VTEX-signature`) that the Gateway uses to validate the callback. A hardcoded or modified URL will be rejected by the Gateway, leaving the payment stuck in `undefined` status forever. The URL format may also change between environments (production vs sandbox).

**Detection**: If the connector hardcodes a callback URL string, constructs the URL manually, or strips query parameters from the `callbackUrl`, warn the developer. The `callbackUrl` must be stored and used exactly as received.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, callbackUrl } = req.body;

  // Store the exact callbackUrl from the request
  await store.save(paymentId, {
    paymentId,
    status: "undefined",
    callbackUrl,  // Stored exactly as received, including query params
  });

  // ... return undefined response
}

// When the acquirer webhook arrives, use the stored callbackUrl
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const { paymentReference, status } = req.body;
  const payment = await store.findByAcquirerRef(paymentReference);
  if (!payment) { res.status(404).send(); return; }

  // Update local state
  await store.updateStatus(payment.paymentId, status === "paid" ? "approved" : "denied");

  // Use the EXACT stored callbackUrl — do not modify it
  await fetch(payment.callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
      "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
    },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      status: status === "paid" ? "approved" : "denied",
    }),
  });

  res.status(200).send();
}
```

❌ **WRONG**:
```typescript
// WRONG: Hardcoding callback URL — ignores X-VTEX-signature and environment
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const { paymentReference, status } = req.body;
  const payment = await store.findByAcquirerRef(paymentReference);

  // WRONG — hardcoded URL, missing X-VTEX-signature authentication
  await fetch("https://mystore.vtexpayments.com.br/api/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      status: status === "paid" ? "approved" : "denied",
    }),
  });

  res.status(200).send();
}
```

---

### Constraint: MUST Be Ready for Repeated Create Payment Calls

**Rule**: The connector MUST handle the Gateway calling Create Payment with the same `paymentId` multiple times during the 7-day retry window. Each call must return the current payment status (which may have been updated via callback since the last call).

**Why**: The Gateway retries `undefined` payments automatically. If the connector treats each call as a new payment, it will create duplicate charges. If the connector always returns the original `undefined` status without checking for updates, the Gateway never learns that the payment was approved, and eventually cancels it.

**Detection**: If the Create Payment handler does not check for an existing `paymentId` and return the latest status, STOP. The handler must support idempotent retries that reflect the current state.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // Check for existing payment — may have been updated via callback
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    // Return current status — may have changed from "undefined" to "approved"
    res.status(200).json({
      ...existing.response,
      status: existing.status,  // Reflects the latest state
    });
    return;
  }

  // First time — create new payment
  // ...
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // WRONG: Always returns the original cached response without checking
  // if the status has been updated. Gateway never sees "approved".
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    // Always returns the stale "undefined" response — never updates
    res.status(200).json(existing.originalResponse);
    return;
  }

  // ...
}
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Classify Payment Methods as Sync or Async

Determine which payment methods require async handling at the start of the Create Payment flow.

```typescript
const ASYNC_PAYMENT_METHODS = new Set([
  "BankInvoice",   // Boleto Bancário
  "Pix",           // Pix instant payments
]);

function isAsyncPaymentMethod(paymentMethod: string): boolean {
  return ASYNC_PAYMENT_METHODS.has(paymentMethod);
}
```

### Step 2: Implement Async Create Payment with callbackUrl Storage

Return `undefined` and store the `callbackUrl` for later use.

```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  // Idempotency check — return latest status if payment exists
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json({
      ...existing.response,
      status: existing.status,
    });
    return;
  }

  if (isAsyncPaymentMethod(paymentMethod)) {
    const pending = await acquirer.initiateAsync(req.body);

    const response = {
      paymentId,
      status: "undefined" as const,
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "ASYNC-PENDING",
      message: "Awaiting payment confirmation",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: 604800,
      paymentUrl: pending.paymentUrl ?? undefined,
    };

    await store.save(paymentId, {
      paymentId,
      status: "undefined",
      callbackUrl,
      acquirerRef: pending.reference,
      response,
    });

    res.status(200).json(response);
    return;
  }

  // Sync flow — process and return final status
  const result = await acquirer.authorizeSync(req.body);
  const response = {
    paymentId,
    status: result.approved ? "approved" : "denied",
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };

  await store.save(paymentId, {
    paymentId,
    status: response.status,
    response,
  });

  res.status(200).json(response);
}
```

### Step 3: Implement the Acquirer Webhook Handler with Callback Notification

When the acquirer confirms the payment, update local state and notify the Gateway.

```typescript
// Non-VTEX IO: Use notification callback
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const webhookData = req.body;
  const acquirerRef = webhookData.transactionId;
  const acquirerStatus = webhookData.status; // "paid", "expired", "failed"

  const payment = await store.findByAcquirerRef(acquirerRef);
  if (!payment || !payment.callbackUrl) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  // Map acquirer status to PPP status
  const pppStatus = acquirerStatus === "paid" ? "approved" : "denied";

  // Update local state FIRST
  await store.updateStatus(payment.paymentId, pppStatus);

  // Notify the Gateway via callbackUrl — use it exactly as stored
  try {
    await fetch(payment.callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
        "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
      },
      body: JSON.stringify({
        paymentId: payment.paymentId,
        status: pppStatus,
      }),
    });
  } catch (error) {
    // Log the error but don't fail — the Gateway will also retry via /payments
    console.error(`Callback failed for ${payment.paymentId}:`, error);
    // The Gateway's 7-day retry on /payments acts as a safety net
  }

  res.status(200).json({ received: true });
}

// For VTEX IO: Use retry callback (no payload needed)
async function handleAcquirerWebhookVtexIO(req: Request, res: Response): Promise<void> {
  const webhookData = req.body;
  const acquirerRef = webhookData.transactionId;

  const payment = await store.findByAcquirerRef(acquirerRef);
  if (!payment || !payment.callbackUrl) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  const pppStatus = webhookData.status === "paid" ? "approved" : "denied";
  await store.updateStatus(payment.paymentId, pppStatus);

  // VTEX IO: Just call the retry URL — Gateway will re-call POST /payments
  try {
    await fetch(payment.callbackUrl, { method: "POST" });
  } catch (error) {
    console.error(`Retry callback failed for ${payment.paymentId}:`, error);
  }

  res.status(200).json({ received: true });
}
```

### Complete Example

Full async payment flow with webhook and callback:

```typescript
import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

const ASYNC_METHODS = new Set(["BankInvoice", "Pix"]);

// Create Payment — supports both sync and async methods
app.post("/payments", async (req: Request, res: Response) => {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json({ ...existing.response, status: existing.status });
    return;
  }

  if (ASYNC_METHODS.has(paymentMethod)) {
    const pending = await acquirer.initiateAsync(req.body);
    const response = buildAsyncResponse(paymentId, pending);
    await store.save(paymentId, {
      paymentId, status: "undefined", callbackUrl,
      acquirerRef: pending.reference, response,
    });
    res.status(200).json(response);
  } else {
    const result = await acquirer.authorizeSync(req.body);
    const response = buildSyncResponse(paymentId, result);
    await store.save(paymentId, { paymentId, status: response.status, response });
    res.status(200).json(response);
  }
});

// Acquirer Webhook — receives payment confirmation, notifies Gateway
app.post("/webhooks/acquirer", async (req: Request, res: Response) => {
  const { transactionId, status: acquirerStatus } = req.body;
  const payment = await store.findByAcquirerRef(transactionId);
  if (!payment) { res.status(404).send(); return; }

  const pppStatus = acquirerStatus === "paid" ? "approved" : "denied";
  await store.updateStatus(payment.paymentId, pppStatus);

  if (payment.callbackUrl) {
    try {
      await fetch(payment.callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
          "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
        },
        body: JSON.stringify({ paymentId: payment.paymentId, status: pppStatus }),
      });
    } catch (err) {
      console.error("Callback failed, Gateway will retry via /payments", err);
    }
  }

  res.status(200).send();
});

app.listen(443);
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Synchronous Approval of Async Payments

**What happens**: The connector receives a Pix or Boleto Create Payment request and immediately returns `status: "approved"` because the QR code or slip was generated successfully.

**Why it fails**: Generating a QR code or Boleto slip is not the same as receiving payment. The customer still needs to scan/pay. Returning `"approved"` triggers order fulfillment before payment is confirmed. The merchant ships products and never receives payment.

**Fix**: Always return `"undefined"` for async methods and wait for acquirer confirmation:

```typescript
if (ASYNC_METHODS.has(paymentMethod)) {
  const pending = await acquirer.initiateAsync(req.body);
  res.status(200).json({
    paymentId,
    status: "undefined",  // Never "approved" for async
    // ...
    paymentUrl: pending.qrCodeUrl,  // Customer scans this to pay
  });
}
```

---

### Anti-Pattern: Ignoring the callbackUrl

**What happens**: The connector does not store the `callbackUrl` from the Create Payment request and relies entirely on the Gateway's automatic retries to detect payment completion.

**Why it fails**: The Gateway's retry interval increases over time. Without callback notification, there can be a long delay between the customer paying and the order being approved. This creates a poor customer experience and increases support tickets. In worst cases, the 7-day window expires and the payment is cancelled even though the customer paid.

**Fix**: Always store and use the `callbackUrl`:

```typescript
// Store the callbackUrl when creating the payment
await store.save(paymentId, {
  paymentId,
  status: "undefined",
  callbackUrl: req.body.callbackUrl,  // Store this!
  acquirerRef: pending.reference,
});

// Use it when the acquirer confirms payment
async function onAcquirerConfirmation(paymentId: string): Promise<void> {
  const payment = await store.findByPaymentId(paymentId);
  if (payment?.callbackUrl) {
    await fetch(payment.callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
        "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
      },
      body: JSON.stringify({ paymentId, status: "approved" }),
    });
  }
}
```

---

### Anti-Pattern: No Retry Logic for Failed Callbacks

**What happens**: The connector calls the `callbackUrl` once, and if the request fails (network error, timeout, 5xx), it silently drops the notification.

**Why it fails**: If the callback fails and the connector doesn't retry, the Gateway never learns the payment was approved. The payment sits in `undefined` until the Gateway's next retry of Create Payment, which may be hours away. In the worst case, the payment is auto-cancelled after 7 days.

**Fix**: Implement retry logic with exponential backoff for callback failures:

```typescript
async function notifyGateway(callbackUrl: string, payload: object): Promise<void> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
          "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) return;

      console.error(`Callback attempt ${attempt + 1} failed: ${response.status}`);
    } catch (error) {
      console.error(`Callback attempt ${attempt + 1} error:`, error);
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }

  // All retries failed — Gateway will still retry via /payments as safety net
  console.error("All callback retries exhausted. Relying on Gateway retry.");
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Detailed explanation of the `undefined` status, callback URL notification and retry flows, and the 7-day retry window
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization flow documentation including async retry mechanics and callback URL behavior for VTEX IO vs non-VTEX IO
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint-level implementation guide with callbackUrl and returnUrl usage
- [Pix: Instant Payments in Brazil](https://developers.vtex.com/docs/guides/payments-integration-pix-instant-payments-in-brazil) — Pix-specific async flow implementation including QR code generation and callback handling
- [Callback URL Signature Authentication](https://help.vtex.com/en/announcements/2024-05-03-callback-url-signature-authentication-token) — Mandatory X-VTEX-signature requirement for callback URL authentication (effective June 2024)
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with callbackUrl field documentation

---

# Idempotency & Duplicate Prevention

## Overview

**What this skill covers**: Idempotency patterns for VTEX Payment Provider Protocol connectors. This includes using `paymentId` as the primary idempotency key for Create Payment, using `requestId` for Cancel/Capture/Refund operations, implementing a payment state machine, and handling Gateway retries that can occur for up to 7 days on `undefined` status payments.

**When to use it**: When implementing any PPP endpoint handler that processes payments, cancellations, captures, or refunds. Use this skill whenever you need to ensure that repeated Gateway calls with the same identifiers produce identical results without re-processing.

**What you'll learn**:
- How `paymentId` and `requestId` function as idempotency keys across different endpoints
- How to build a state machine that prevents invalid transitions
- How to store and return cached responses for duplicate requests
- Why the Gateway retries `undefined` payments for up to 7 days

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: paymentId as Idempotency Key

Every Create Payment request from the VTEX Gateway includes a unique `paymentId`. This identifier is the canonical idempotency key for the payment lifecycle. If the Gateway sends a second Create Payment request with the same `paymentId`, the connector MUST return the exact same response as the first call without creating a new transaction at the acquirer. The Gateway retries Create Payment calls with `undefined` status for up to 7 days.

### Concept 2: requestId for Operation Idempotency

Cancel, Capture, and Refund requests include a `requestId` field that ensures operational idempotency. The cancellation flow can be retried for an entire day. Each `requestId` represents a single logical operation — if the connector receives the same `requestId` again, it must return the previously computed result without re-executing the operation at the acquirer.

### Concept 3: Payment State Machine

A payment moves through defined states: `undefined` → `approved` → `settled` or `undefined` → `denied` or `approved` → `cancelled`. The connector must enforce valid transitions. An `approved` payment cannot be approved again; a `cancelled` payment cannot be captured. The state machine prevents double-charging and ensures idempotent behavior.

**Architecture/Data Flow**:

```text
Gateway sends POST /payments (paymentId=ABC)
  → Connector checks store: paymentId=ABC exists?
    → YES: return stored response (no acquirer call)
    → NO: process with acquirer, store result, return response

Gateway retries POST /payments (paymentId=ABC) [up to 7 days if undefined]
  → Connector finds paymentId=ABC in store → returns stored response
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: MUST Use paymentId as Idempotency Key for Create Payment

**Rule**: The connector MUST check for an existing record with the given `paymentId` before processing a new payment. If a record exists, return the stored response without calling the acquirer again.

**Why**: The VTEX Gateway retries Create Payment requests with `undefined` status for up to 7 days. Without idempotency on `paymentId`, each retry creates a new charge at the acquirer, resulting in duplicate charges to the customer. This is a financial loss and a critical production incident.

**Detection**: If the Create Payment handler does not check for an existing `paymentId` before processing, STOP. The handler must query the data store for the `paymentId` first.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // Check for existing payment — idempotency guard
  const existingPayment = await paymentStore.findByPaymentId(paymentId);
  if (existingPayment) {
    // Return the exact same response — no new acquirer call
    res.status(200).json(existingPayment.response);
    return;
  }

  // First time seeing this paymentId — process with acquirer
  const result = await acquirer.authorize(req.body);

  const response = {
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };

  // Store the response for future idempotent lookups
  await paymentStore.save(paymentId, { request: req.body, response });

  res.status(200).json(response);
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // No idempotency check — every call hits the acquirer
  // If the Gateway retries this (which it will for undefined status),
  // the customer gets charged multiple times
  const result = await acquirer.authorize(req.body);

  res.status(200).json({
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

---

### Constraint: MUST Return Identical Response for Duplicate Requests

**Rule**: When the connector receives a Create Payment request with a `paymentId` that already exists in the data store, it MUST return the exact stored response. It MUST NOT create a new record, generate new identifiers, or re-process the payment.

**Why**: The Gateway uses the response fields (`authorizationId`, `tid`, `nsu`, `status`) to track the transaction. If a retry returns different values, the Gateway loses track of the original transaction, causing reconciliation failures and potential double settlements.

**Detection**: If the handler creates a new database record or generates new identifiers when it finds an existing `paymentId`, STOP. The handler must return the previously stored response verbatim.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  const existing = await paymentStore.findByPaymentId(paymentId);
  if (existing) {
    // Return the EXACT stored response — same authorizationId, tid, nsu, status
    res.status(200).json(existing.response);
    return;
  }

  // ... process new payment and store response
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  const existing = await paymentStore.findByPaymentId(paymentId);
  if (existing) {
    // WRONG: Generating new identifiers for an existing payment
    // The Gateway will see different tid/nsu and lose track of the transaction
    const newTid = generateNewTid();
    res.status(200).json({
      ...existing.response,
      tid: newTid,  // Different from original — breaks reconciliation
      nsu: generateNewNsu(),
    });
    return;
  }

  // ... process new payment
}
```

---

### Constraint: MUST NOT Approve Async Payments Synchronously

**Rule**: If a payment method is asynchronous (e.g., Boleto, Pix, bank redirect), the Create Payment response MUST return `status: "undefined"`. It MUST NOT return `status: "approved"` or `status: "denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why**: Returning `approved` for an async method tells the Gateway the payment is confirmed before the customer has actually paid. The order ships, but no money was collected. The merchant loses the product and the revenue. The correct flow is to return `undefined` and use the `callbackUrl` to notify the Gateway when the payment is confirmed.

**Detection**: If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect-based), STOP. Async methods must return `"undefined"` and use callbacks.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const isAsyncMethod = ["BankInvoice", "Pix"].includes(paymentMethod);

  if (isAsyncMethod) {
    // Initiate async payment — do NOT return approved
    const pending = await acquirer.initiateAsyncPayment(req.body);

    await paymentStore.save(paymentId, {
      status: "undefined",
      callbackUrl,
      acquirerRef: pending.reference,
    });

    res.status(200).json({
      paymentId,
      status: "undefined",  // Correct for async
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "ASYNC-PENDING",
      message: "Awaiting customer payment",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: 604800,  // 7 days for async
      paymentUrl: pending.paymentUrl,
    });
    return;
  }

  // Sync methods can return approved/denied immediately
  // ...
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod } = req.body;

  // WRONG: Approving a Pix payment synchronously
  // The customer hasn't paid yet — the order will ship without payment
  const result = await acquirer.createPixCharge(req.body);

  res.status(200).json({
    paymentId,
    status: "approved",  // WRONG — Pix is async, should be "undefined"
    authorizationId: result.authorizationId ?? null,
    nsu: null,
    tid: null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Create a Payment State Store

Build a persistent store keyed by `paymentId` that tracks payment state and cached responses.

```typescript
interface PaymentRecord {
  paymentId: string;
  status: "undefined" | "approved" | "denied" | "cancelled" | "settled" | "refunded";
  response: Record<string, unknown>;
  callbackUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface OperationRecord {
  requestId: string;
  paymentId: string;
  operation: "cancel" | "capture" | "refund";
  response: Record<string, unknown>;
  createdAt: Date;
}

class PaymentStore {
  // Use a database in production (PostgreSQL, DynamoDB, VBase for VTEX IO)
  private payments = new Map<string, PaymentRecord>();
  private operations = new Map<string, OperationRecord>();

  async findByPaymentId(paymentId: string): Promise<PaymentRecord | null> {
    return this.payments.get(paymentId) ?? null;
  }

  async save(paymentId: string, record: PaymentRecord): Promise<void> {
    this.payments.set(paymentId, record);
  }

  async updateStatus(paymentId: string, status: PaymentRecord["status"]): Promise<void> {
    const record = this.payments.get(paymentId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date();
    }
  }

  async findOperation(requestId: string): Promise<OperationRecord | null> {
    return this.operations.get(requestId) ?? null;
  }

  async saveOperation(requestId: string, record: OperationRecord): Promise<void> {
    this.operations.set(requestId, record);
  }
}
```

### Step 2: Implement Idempotent Create Payment

Guard every Create Payment call with a `paymentId` lookup.

```typescript
const store = new PaymentStore();

async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const body = req.body;
  const { paymentId, paymentMethod, callbackUrl } = body;

  // Idempotency check
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json(existing.response);
    return;
  }

  const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);
  const result = await acquirer.process(body);

  const status = isAsync ? "undefined" : result.status;
  const response = {
    paymentId,
    status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: isAsync ? 604800 : 21600,
    ...(result.paymentUrl ? { paymentUrl: result.paymentUrl } : {}),
  };

  await store.save(paymentId, {
    paymentId,
    status,
    response,
    callbackUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  res.status(200).json(response);
}
```

### Step 3: Implement Idempotent Cancel/Capture/Refund with requestId

Guard operations using `requestId` and enforce valid state transitions.

```typescript
async function cancelPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.params;
  const { requestId } = req.body;

  // Operation idempotency check
  const existingOp = await store.findOperation(requestId);
  if (existingOp) {
    res.status(200).json(existingOp.response);
    return;
  }

  // State machine validation
  const payment = await store.findByPaymentId(paymentId);
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  if (payment.status === "cancelled") {
    // Already cancelled — return success idempotently
    const response = {
      paymentId,
      cancellationId: null,
      code: "already-cancelled",
      message: "Payment was already cancelled",
      requestId,
    };
    res.status(200).json(response);
    return;
  }

  if (!["undefined", "approved"].includes(payment.status)) {
    res.status(200).json({
      paymentId,
      cancellationId: null,
      code: "cancel-failed",
      message: `Cannot cancel payment in ${payment.status} state`,
      requestId,
    });
    return;
  }

  const result = await acquirer.cancel(paymentId);
  const response = {
    paymentId,
    cancellationId: result.cancellationId ?? null,
    code: result.code ?? null,
    message: result.message ?? "Successfully cancelled",
    requestId,
  };

  await store.updateStatus(paymentId, "cancelled");
  await store.saveOperation(requestId, {
    requestId,
    paymentId,
    operation: "cancel",
    response,
    createdAt: new Date(),
  });

  res.status(200).json(response);
}
```

### Complete Example

Full idempotent payment lifecycle with state machine:

```typescript
import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

const store = new PaymentStore();

// Create Payment — idempotent on paymentId
app.post("/payments", async (req: Request, res: Response) => {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json(existing.response);
    return;
  }

  const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);
  const result = await acquirer.process(req.body);
  const status = isAsync ? "undefined" : result.status;

  const response = buildCreatePaymentResponse(paymentId, status, result, isAsync);
  await store.save(paymentId, {
    paymentId, status, response, callbackUrl,
    createdAt: new Date(), updatedAt: new Date(),
  });

  res.status(200).json(response);
});

// Cancel — idempotent on requestId, validates state
app.post("/payments/:paymentId/cancellations", async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const { requestId } = req.body;

  const existingOp = await store.findOperation(requestId);
  if (existingOp) { res.status(200).json(existingOp.response); return; }

  const payment = await store.findByPaymentId(paymentId);
  if (!payment || !["undefined", "approved"].includes(payment.status)) {
    res.status(200).json({ paymentId, cancellationId: null, code: "cancel-failed", message: "Invalid state", requestId });
    return;
  }

  const result = await acquirer.cancel(paymentId);
  const response = { paymentId, cancellationId: result.cancellationId ?? null, code: null, message: "Cancelled", requestId };
  await store.updateStatus(paymentId, "cancelled");
  await store.saveOperation(requestId, { requestId, paymentId, operation: "cancel", response, createdAt: new Date() });
  res.status(200).json(response);
});

// Capture — idempotent on requestId, validates state
app.post("/payments/:paymentId/settlements", async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const { requestId, value } = req.body;

  const existingOp = await store.findOperation(requestId);
  if (existingOp) { res.status(200).json(existingOp.response); return; }

  const payment = await store.findByPaymentId(paymentId);
  if (!payment || payment.status !== "approved") {
    res.status(200).json({ paymentId, settleId: null, value: 0, code: "capture-failed", message: "Invalid state", requestId });
    return;
  }

  const result = await acquirer.capture(paymentId, value);
  const response = { paymentId, settleId: result.settleId ?? null, value: result.capturedValue ?? value, code: null, message: null, requestId };
  await store.updateStatus(paymentId, "settled");
  await store.saveOperation(requestId, { requestId, paymentId, operation: "capture", response, createdAt: new Date() });
  res.status(200).json(response);
});

// Refund — idempotent on requestId, validates state
app.post("/payments/:paymentId/refunds", async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const { requestId, value, settleId } = req.body;

  const existingOp = await store.findOperation(requestId);
  if (existingOp) { res.status(200).json(existingOp.response); return; }

  const payment = await store.findByPaymentId(paymentId);
  if (!payment || payment.status !== "settled") {
    res.status(200).json({ paymentId, refundId: null, value: 0, code: "refund-failed", message: "Invalid state", requestId });
    return;
  }

  const result = await acquirer.refund(paymentId, value);
  const response = { paymentId, refundId: result.refundId ?? null, value: result.refundedValue ?? value, code: null, message: null, requestId };
  await store.updateStatus(paymentId, "refunded");
  await store.saveOperation(requestId, { requestId, paymentId, operation: "refund", response, createdAt: new Date() });
  res.status(200).json(response);
});

app.listen(443);
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Processing Duplicate Payments

**What happens**: The connector calls the acquirer for every Create Payment request without checking if the `paymentId` already exists in the data store.

**Why it fails**: The Gateway retries `undefined` payments for up to 7 days. Each retry creates a new charge at the acquirer. A single $100 payment can result in hundreds of charges totaling thousands of dollars. This is a critical financial bug.

**Fix**: Always check the data store before calling the acquirer:

```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // ALWAYS check for existing payment first
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json(existing.response);
    return;
  }

  // Only call acquirer for genuinely new payments
  const result = await acquirer.process(req.body);
  // ... store and return response
}
```

---

### Anti-Pattern: Synchronous Approval of Async Payment Methods

**What happens**: The connector returns `status: "approved"` immediately for Boleto or Pix payments, before the customer has actually paid.

**Why it fails**: The Gateway treats `approved` as confirmed payment. The order is released for fulfillment, but no money was collected. The merchant ships products for free. Revenue is lost.

**Fix**: Return `status: "undefined"` for async methods and use the callback mechanism:

```typescript
const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);
const status = isAsync ? "undefined" : result.status;
// Async methods: notify via callbackUrl when payment is confirmed
```

---

### Anti-Pattern: Losing State Between Retries

**What happens**: The connector stores payment state in memory (e.g., a JavaScript `Map` or local variable) instead of a persistent database.

**Why it fails**: When the connector process restarts (deploy, crash, scaling), all in-memory state is lost. The next Gateway retry creates a duplicate payment at the acquirer because the idempotency check fails to find the original record.

**Fix**: Use a persistent data store:

```typescript
// WRONG — in-memory, lost on restart
const payments = new Map<string, PaymentRecord>();

// CORRECT — persistent database
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function findByPaymentId(paymentId: string): Promise<PaymentRecord | null> {
  const result = await pool.query(
    "SELECT * FROM payments WHERE payment_id = $1",
    [paymentId]
  );
  return result.rows[0] ?? null;
}

// For VTEX IO apps, use VBase:
// const vbase = ctx.clients.vbase;
// await vbase.getJSON<PaymentRecord>("payments", paymentId);
```

## Reference

**Links to VTEX documentation and related resources.**

- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Official guide explaining idempotency requirements for Cancel, Capture, and Refund operations
- [Developing a Payment Connector for VTEX](https://help.vtex.com/en/docs/tutorials/developing-a-payment-connector-for-vtex) — Help Center guide with idempotency implementation steps using paymentId and VBase
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Detailed authorization, capture, and cancellation flow documentation including retry behavior
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including callback URL retry mechanics and 7-day retry window
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with requestId and paymentId field definitions

---

# PCI Compliance & Secure Proxy

## Overview

**What this skill covers**: PCI DSS compliance requirements and the VTEX Secure Proxy mechanism for payment connectors that handle card payments. This includes how `secureProxyUrl` tokenizes sensitive card data, the difference between PCI-certified and non-PCI environments, what data can and cannot be stored or logged, and how to use the `X-PROVIDER-Forward-To` header to route requests through the Secure Proxy to the acquirer.

**When to use it**: When building a payment connector that accepts credit cards, debit cards, or co-branded cards. Use this skill whenever the connector needs to process card data, communicate with an acquirer, or when determining whether Secure Proxy is required.

**What you'll learn**:
- When Secure Proxy is required vs optional
- How tokenized card data flows through the Secure Proxy
- What data must never be stored, logged, or transmitted outside the Secure Proxy
- How to use `X-PROVIDER-Forward-To` and custom headers to communicate with acquirers

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: PCI DSS and VTEX

PCI DSS (Payment Card Industry Data Security Standard) is an international standard governing how companies must process card information. VTEX's Payment Gateway is PCI-certified. Connectors that process card payments must either:

1. **Have PCI DSS certification** (AOC signed by a QSA) — the connector receives raw card data directly and communicates with the acquirer.
2. **Use Secure Proxy** — mandatory for non-PCI environments, including all VTEX IO connectors. The connector receives tokenized card data and routes acquirer calls through the Gateway's proxy.

### Concept 2: Secure Proxy Tokenization

When Secure Proxy is used, the Gateway replaces sensitive card fields with tokens in the Create Payment request:

- `card.numberToken` replaces the card number (e.g., `#vtex#token#d799bae#number#`)
- `card.holderToken` replaces the cardholder name
- `card.cscToken` replaces the CVV/security code
- `card.bin` and `card.numberLength` are provided as plain values (non-sensitive)
- `card.expiration` is provided as plain values

The connector uses these tokens when building the request to the acquirer. The Secure Proxy replaces tokens with real values before forwarding to the acquirer.

### Concept 3: secureProxyUrl

The `secureProxyUrl` field is included in the Create Payment request body when Secure Proxy is active. This URL points to the Gateway's proxy endpoint. The connector must POST to this URL (instead of directly to the acquirer) with:

- `X-PROVIDER-Forward-To` header: the acquirer's API endpoint URL
- `X-PROVIDER-Forward-{HeaderName}` headers: custom headers for the acquirer (prefix is stripped by the proxy)
- Request body containing tokenized card data

The Secure Proxy replaces tokens with real card data and forwards the request to the acquirer. The response is passed back to the connector unchanged.

### Concept 4: What Can and Cannot Be Stored

**Can store**: `card.bin` (first 6 digits), `card.numberLength`, `card.expiration`, transaction IDs, payment status.

**MUST NEVER store**: Full card number (PAN), CVV/CSC, cardholder name from card data, any token values. These must only exist in memory during request processing and must never be written to databases, files, or logs.

**Architecture/Data Flow (Secure Proxy)**:

```text
1. Gateway → POST /payments (with secureProxyUrl + tokenized card data) → Connector
2. Connector → POST secureProxyUrl (tokens in body, X-PROVIDER-Forward-To: acquirer URL) → Gateway
3. Gateway replaces tokens with real card data → POST acquirer URL → Acquirer
4. Acquirer → response → Gateway → Connector
5. Connector → Create Payment response → Gateway
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: MUST Use secureProxyUrl for Non-PCI Environments

**Rule**: If the connector is hosted in a non-PCI environment (including all VTEX IO apps), it MUST use the `secureProxyUrl` from the Create Payment request to communicate with the acquirer. It MUST NOT call the acquirer directly with raw card data. If a `secureProxyUrl` field is present in the request, Secure Proxy is active and MUST be used.

**Why**: Non-PCI environments are not authorized to handle raw card data. Calling the acquirer directly bypasses the Gateway's secure data handling, violating PCI DSS. This can result in data breaches, massive fines ($100K+ per month), loss of card processing ability, and legal liability.

**Detection**: If the connector calls an acquirer endpoint directly (without going through `secureProxyUrl`) when `secureProxyUrl` is present in the request, STOP immediately. All acquirer communication must go through the Secure Proxy.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, secureProxyUrl, card } = req.body;

  if (secureProxyUrl) {
    // Non-PCI: Route through Secure Proxy
    const acquirerResponse = await fetch(secureProxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PROVIDER-Forward-To": "https://api.acquirer.com/v2/payments",
        "X-PROVIDER-Forward-MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
        "X-PROVIDER-Forward-MerchantKey": process.env.ACQUIRER_MERCHANT_KEY!,
      },
      body: JSON.stringify({
        orderId: paymentId,
        payment: {
          cardNumber: card.numberToken,     // Token, not real number
          holder: card.holderToken,          // Token, not real name
          securityCode: card.cscToken,       // Token, not real CVV
          expirationMonth: card.expiration.month,
          expirationYear: card.expiration.year,
        },
      }),
    });

    const result = await acquirerResponse.json();
    // Build and return PPP response...
  }
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, secureProxyUrl, card } = req.body;

  // WRONG: Calling acquirer directly, bypassing Secure Proxy
  // This connector is non-PCI but handles card data as if it were PCI-certified
  const acquirerResponse = await fetch("https://api.acquirer.com/v2/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
    },
    body: JSON.stringify({
      orderId: paymentId,
      payment: {
        // These are tokens but sent directly to acquirer — acquirer can't read tokens!
        // And if raw data were here, this would be a PCI violation
        cardNumber: card.numberToken,
        holder: card.holderToken,
        securityCode: card.cscToken,
      },
    }),
  });

  // This request will fail: acquirer receives tokens instead of real card data
  // And the Secure Proxy was completely bypassed
}
```

---

### Constraint: MUST NOT Store Raw Card Data

**Rule**: The connector MUST NOT store the full card number (PAN), CVV/CSC, cardholder name, or any card token values in any persistent storage — database, file system, cache, session store, or any other durable medium. Card data must only exist in memory during the request lifecycle.

**Why**: Storing raw card data violates PCI DSS Requirement 3. A data breach exposes customers to fraud. Consequences include fines of $5,000–$100,000 per month from card networks, mandatory forensic investigation costs ($50K+), loss of ability to process cards, class-action lawsuits, and criminal liability in some jurisdictions.

**Detection**: If the code writes card number, CVV, cardholder name, or token values to a database, file, cache (Redis, VBase), or any persistent store, STOP immediately. Only `card.bin` (first 6 digits) and `card.numberLength` may be stored.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, card, secureProxyUrl } = req.body;

  // Only store non-sensitive card metadata
  await paymentStore.save(paymentId, {
    paymentId,
    cardBin: card.bin,            // First 6 digits — safe to store
    cardNumberLength: card.numberLength,  // Length — safe to store
    cardExpMonth: card.expiration.month,  // Expiration — safe to store
    cardExpYear: card.expiration.year,
    // DO NOT store: card.numberToken, card.holderToken, card.cscToken
  });

  // Use card tokens only in-memory for the Secure Proxy call
  const acquirerResult = await callAcquirerViaProxy(secureProxyUrl, card);

  // Return response — card data is now out of scope
  res.status(200).json(buildResponse(paymentId, acquirerResult));
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, card } = req.body;

  // CRITICAL PCI VIOLATION: Storing full card data in database
  await database.query(
    `INSERT INTO payments (payment_id, card_number, cvv, holder_name)
     VALUES ($1, $2, $3, $4)`,
    [paymentId, card.number, card.csc, card.holder]
  );
  // This single line can result in:
  // - $100K/month fines from card networks
  // - Mandatory forensic audit ($50K+)
  // - Loss of card processing ability
  // - Criminal liability
}
```

---

### Constraint: MUST NOT Log Sensitive Card Data

**Rule**: The connector MUST NOT log card numbers, CVV/CSC values, cardholder names, or token values to any logging system — console, file, monitoring service, error tracker, or APM tool. Even in debug mode. Even in development.

**Why**: Logs are typically stored in plaintext, retained for extended periods, and accessible to many team members. Card data in logs is a PCI DSS violation and a data breach. Log aggregation services (Datadog, Splunk, CloudWatch) may store data across multiple regions, amplifying the breach scope.

**Detection**: If the code contains `console.log`, `console.error`, `logger.info`, `logger.debug`, or any logging call that includes `card.number`, `card.csc`, `card.holder`, `card.numberToken`, `card.holderToken`, `card.cscToken`, or the full request body without redaction, STOP immediately. Redact or omit all sensitive fields before logging.

✅ **CORRECT**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, card, paymentMethod, value } = req.body;

  // Safe logging — only non-sensitive fields
  console.log("Processing payment", {
    paymentId,
    paymentMethod,
    value,
    cardBin: card?.bin,              // First 6 digits only — safe
    cardNumberLength: card?.numberLength,  // Safe
  });

  // NEVER log the full request body for payment requests
  // It contains card tokens or raw card data
}

function redactSensitiveFields(body: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...body };
  if (redacted.card && typeof redacted.card === "object") {
    const card = redacted.card as Record<string, unknown>;
    redacted.card = {
      bin: card.bin,
      numberLength: card.numberLength,
      expiration: card.expiration,
      // All other fields redacted
    };
  }
  return redacted;
}
```

❌ **WRONG**:
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  // CRITICAL PCI VIOLATION: Logging the entire request body
  // This includes card number, CVV, holder name, and/or token values
  console.log("Payment request received:", JSON.stringify(req.body));

  // ALSO WRONG: Logging specific card fields
  console.log("Card number:", req.body.card.number);
  console.log("CVV:", req.body.card.csc);
  console.log("Card holder:", req.body.card.holder);

  // ALSO WRONG: Logging tokens (they reference real card data)
  console.log("Card token:", req.body.card.numberToken);
}
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Detect Secure Proxy Mode

Check for `secureProxyUrl` in the Create Payment request to determine if Secure Proxy is active.

```typescript
interface CreatePaymentRequest {
  paymentId: string;
  value: number;
  currency: string;
  paymentMethod: string;
  card?: {
    holder?: string;        // Raw (PCI) or absent (Secure Proxy)
    holderToken?: string;   // Token (Secure Proxy only)
    number?: string;        // Raw (PCI) or absent (Secure Proxy)
    numberToken?: string;   // Token (Secure Proxy only)
    bin: string;            // Always present — first 6 digits
    numberLength: number;   // Always present
    csc?: string;           // Raw (PCI) or absent (Secure Proxy)
    cscToken?: string;      // Token (Secure Proxy only)
    expiration: { month: string; year: string };
  };
  secureProxyUrl?: string;          // Present when Secure Proxy is active
  secureProxyTokensURL?: string;    // For custom token operations
  callbackUrl: string;
  miniCart: Record<string, unknown>;
}

function isSecureProxyActive(req: CreatePaymentRequest): boolean {
  return !!req.secureProxyUrl;
}
```

### Step 2: Build the Acquirer Request with Tokens

When Secure Proxy is active, use tokenized card values in the request body sent to the proxy.

```typescript
interface AcquirerPaymentRequest {
  merchantOrderId: string;
  payment: {
    cardNumber: string;
    holder: string;
    securityCode: string;
    expirationDate: string;
    amount: number;
  };
}

function buildAcquirerRequest(
  paymentReq: CreatePaymentRequest
): AcquirerPaymentRequest {
  const card = paymentReq.card!;

  return {
    merchantOrderId: paymentReq.paymentId,
    payment: {
      // Use tokens if Secure Proxy, raw values if PCI-certified
      cardNumber: card.numberToken ?? card.number!,
      holder: card.holderToken ?? card.holder!,
      securityCode: card.cscToken ?? card.csc!,
      expirationDate: `${card.expiration.month}/${card.expiration.year}`,
      amount: paymentReq.value,
    },
  };
}
```

### Step 3: Call the Acquirer Through Secure Proxy

Route the request through `secureProxyUrl` with proper headers.

```typescript
async function callAcquirerViaProxy(
  secureProxyUrl: string,
  acquirerRequest: AcquirerPaymentRequest
): Promise<AcquirerResponse> {
  const response = await fetch(secureProxyUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      // X-PROVIDER-Forward-To tells the proxy where to send the request
      "X-PROVIDER-Forward-To": process.env.ACQUIRER_API_URL!,
      // Custom headers for the acquirer — prefix is stripped by the proxy
      "X-PROVIDER-Forward-MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
      "X-PROVIDER-Forward-MerchantKey": process.env.ACQUIRER_MERCHANT_KEY!,
    },
    body: JSON.stringify(acquirerRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Secure Proxy call failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<AcquirerResponse>;
}

// For PCI-certified environments, call acquirer directly
async function callAcquirerDirect(
  acquirerRequest: AcquirerPaymentRequest
): Promise<AcquirerResponse> {
  const response = await fetch(process.env.ACQUIRER_API_URL!, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
      "MerchantKey": process.env.ACQUIRER_MERCHANT_KEY!,
    },
    body: JSON.stringify(acquirerRequest),
  });

  return response.json() as Promise<AcquirerResponse>;
}
```

### Complete Example

Full Create Payment handler with Secure Proxy support and safe logging:

```typescript
import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

app.post("/payments", async (req: Request, res: Response) => {
  const body: CreatePaymentRequest = req.body;
  const { paymentId, card, secureProxyUrl } = body;

  // Safe logging — no card data
  console.log("Payment request", {
    paymentId,
    paymentMethod: body.paymentMethod,
    value: body.value,
    hasSecureProxy: !!secureProxyUrl,
    cardBin: card?.bin,
  });

  // Store only non-sensitive data
  await paymentStore.save(paymentId, {
    paymentId,
    cardBin: card?.bin,
    cardNumberLength: card?.numberLength,
    status: "processing",
    callbackUrl: body.callbackUrl,
  });

  // Build the acquirer request using tokens or raw data
  const acquirerRequest = buildAcquirerRequest(body);

  let acquirerResult: AcquirerResponse;
  try {
    if (secureProxyUrl) {
      // Non-PCI: Route through Secure Proxy
      acquirerResult = await callAcquirerViaProxy(secureProxyUrl, acquirerRequest);
    } else {
      // PCI-certified: Call acquirer directly
      acquirerResult = await callAcquirerDirect(acquirerRequest);
    }
  } catch (error) {
    // Safe error logging — never log the acquirer request (contains tokens)
    console.error("Acquirer call failed", {
      paymentId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const failResponse = {
      paymentId,
      status: "undefined" as const,
      authorizationId: null,
      nsu: null,
      tid: null,
      acquirer: null,
      code: "ACQUIRER_ERROR",
      message: "Failed to communicate with acquirer",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: 21600,
    };

    await paymentStore.updateStatus(paymentId, "undefined");
    res.status(200).json(failResponse);
    return;
  }

  const status = acquirerResult.approved ? "approved" : "denied";
  const response = {
    paymentId,
    status,
    authorizationId: acquirerResult.authorizationId ?? null,
    nsu: acquirerResult.nsu ?? null,
    tid: acquirerResult.tid ?? null,
    acquirer: "MyAcquirer",
    code: acquirerResult.code ?? null,
    message: acquirerResult.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };

  await paymentStore.updateStatus(paymentId, status);
  res.status(200).json(response);
});

app.listen(443);
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Direct Card Handling in Non-PCI Environment

**What happens**: The connector is hosted on VTEX IO or a non-PCI server but calls the acquirer API directly without using the Secure Proxy, attempting to pass card tokens directly to the acquirer.

**Why it fails**: The acquirer receives tokens (e.g., `#vtex#token#d799bae#number#`) instead of real card numbers. The acquirer cannot process these tokens and rejects the transaction. Even if the connector somehow received raw card data, transmitting it from a non-PCI environment violates PCI DSS and exposes the data to interception.

**Fix**: Always check for `secureProxyUrl` and route through the proxy:

```typescript
if (secureProxyUrl) {
  // Route through Secure Proxy — tokens are replaced with real data by the Gateway
  const result = await fetch(secureProxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PROVIDER-Forward-To": "https://api.acquirer.com/v2/payments",
      "X-PROVIDER-Forward-MerchantId": process.env.MERCHANT_ID!,
    },
    body: JSON.stringify(acquirerPayload),
  });
}
```

---

### Anti-Pattern: Storing Full Card Numbers (PANs)

**What happens**: The developer stores the full card number in a database column for "reference" or "reconciliation" purposes.

**Why it fails**: This is a direct PCI DSS Requirement 3 violation. If the database is breached, all stored card numbers are compromised. Card networks impose fines of $5,000–$100,000 per month, require a mandatory forensic audit, and may permanently revoke the ability to process card payments.

**Fix**: Store only the BIN (first 6 digits) and last 4 digits for reference:

```typescript
// Store only non-sensitive identifiers
await database.query(
  `INSERT INTO payments (payment_id, card_bin, card_last_four, card_exp_month, card_exp_year)
   VALUES ($1, $2, $3, $4, $5)`,
  [
    paymentId,
    card.bin,                                    // First 6 digits — safe
    card.bin ? undefined : undefined,            // Last 4 not available via PPP
    card.expiration.month,
    card.expiration.year,
  ]
);
// NEVER store: card.number, card.numberToken, card.csc, card.cscToken, card.holder, card.holderToken
```

---

### Anti-Pattern: Logging Card Details for Debugging

**What happens**: During development or debugging, the developer adds `console.log(req.body)` or `console.log(card)` to troubleshoot payment issues, then forgets to remove it before deployment.

**Why it fails**: The full request body contains card numbers, CVV, and/or token values. These end up in log files, monitoring dashboards, and log aggregation services. This is a PCI DSS violation even in development if the logs are stored persistently. In production, it's a full data breach.

**Fix**: Create a utility that redacts sensitive fields and use it consistently:

```typescript
function safePaymentLog(label: string, body: Record<string, unknown>): void {
  const safe = {
    paymentId: body.paymentId,
    paymentMethod: body.paymentMethod,
    value: body.value,
    currency: body.currency,
    orderId: body.orderId,
    hasCard: !!body.card,
    hasSecureProxy: !!body.secureProxyUrl,
    cardBin: (body.card as Record<string, unknown>)?.bin,
    // Everything else is intentionally omitted
  };

  console.log(label, JSON.stringify(safe));
}

// Usage
safePaymentLog("Create payment request", req.body);
// Output: Create payment request {"paymentId":"ABC","paymentMethod":"Visa","value":100,"cardBin":"555544",...}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy) — Complete Secure Proxy documentation including flow diagrams, request/response examples, custom tokens, and supported JsonLogic operators
- [PCI DSS Compliance](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance) — PCI certification requirements, AOC submission process, and when Secure Proxy is mandatory
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint implementation guide including Create Payment request body with secureProxyUrl and tokenized card fields
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including PCI prerequisites and Secure Proxy requirements
- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — VTEX IO framework for payment connectors (Secure Proxy mandatory for all IO apps)
- [PCI Security Standards Council](https://www.pcisecuritystandards.org/) — Official PCI DSS requirements and compliance documentation

---

# PPP Endpoint Implementation

## Overview

**What this skill covers**: The complete set of nine endpoints required by the VTEX Payment Provider Protocol (PPP). This includes six payment-flow endpoints (Manifest, Create Payment, Cancel Payment, Capture/Settle Payment, Refund Payment, Inbound Request) and three configuration-flow endpoints (Create Authorization Token, Provider Authentication Redirect, Get Credentials).

**When to use it**: When building a new payment connector middleware that integrates a Payment Service Provider (PSP) with the VTEX Payment Gateway. Use this skill whenever you need to implement, debug, or extend PPP endpoints.

**What you'll learn**:
- The exact HTTP method, path, request body, and response shape for all 9 PPP endpoints
- Required response fields and status codes for each endpoint
- How the payment flow and configuration flow interact with the VTEX Gateway
- Constraints that prevent homologation failures and runtime errors

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Payment Provider Protocol (PPP)

The PPP is the public contract between a payment provider and the VTEX Payment Gateway. It defines nine REST endpoints that the connector middleware must implement. The Gateway calls these endpoints to authorize, capture, cancel, and refund payments, as well as to configure merchant credentials. The middleware can be written in any language but must be served over HTTPS on port 443 with TLS 1.2 support.

### Concept 2: Payment Flow vs Configuration Flow

The protocol is divided into two flows:

- **Payment Flow** (6 endpoints): Handles runtime payment operations — listing capabilities (Manifest), creating payments, cancelling, capturing/settling, refunding, and inbound requests.
- **Configuration Flow** (3 endpoints): Handles merchant onboarding — creating auth tokens, redirecting the merchant to the provider's login, and returning credentials (`appKey`, `appToken`, `applicationId`) to VTEX.

The configuration flow is optional but recommended. The payment flow is mandatory.

### Concept 3: Endpoint Requirements

All endpoints must satisfy these requirements:
- Served over HTTPS on port 443 with TLS 1.2
- Use a standard subdomain/domain (no IP addresses)
- Respond in under 5 seconds during homologation tests
- Respond in under 20 seconds in production
- The provider must be PCI-DSS certified or use Secure Proxy for card payments

**Architecture/Data Flow**:

```text
Shopper → VTEX Checkout → VTEX Payment Gateway → [Your Connector Middleware] → Acquirer/PSP
                                ↕
                    Configuration Flow (Admin)
```

The Gateway initiates all calls. Your middleware never calls the Gateway except via `callbackUrl` (for async notifications) and Secure Proxy (for card data forwarding).

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Implement All Required Payment Flow Endpoints

**Rule**: The connector MUST implement all six payment-flow endpoints: GET `/manifest`, POST `/payments`, POST `/payments/{paymentId}/cancellations`, POST `/payments/{paymentId}/settlements`, POST `/payments/{paymentId}/refunds`, and POST `/payments/{paymentId}/inbound-request/{action}`.

**Why**: The VTEX Payment Provider Test Suite validates every endpoint during homologation. Missing endpoints cause test failures and the connector will not be approved. At runtime, the Gateway expects all endpoints to be available — a missing cancel endpoint means payments cannot be voided.

**Detection**: If the connector router/handler file does not define handlers for all 6 payment-flow paths, STOP and add the missing endpoints before proceeding.

✅ **CORRECT**:
```typescript
import { Router } from "express";

const router = Router();

// All 6 payment-flow endpoints implemented
router.get("/manifest", manifestHandler);
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);
router.post("/payments/:paymentId/refunds", refundPaymentHandler);
router.post("/payments/:paymentId/inbound-request/:action", inboundRequestHandler);

export default router;
```

❌ **WRONG**:
```typescript
import { Router } from "express";

const router = Router();

// Missing manifest, inbound-request, and refund endpoints
// This will fail homologation and break runtime operations
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);

export default router;
```

---

### Constraint: Return Correct HTTP Status Codes and Response Shapes

**Rule**: Each endpoint MUST return the exact response shape documented in the PPP API. Create Payment MUST return `paymentId`, `status`, `authorizationId`, `tid`, `nsu`, `acquirer`, `code`, `message`, `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, and `delayToCancel`. Cancel MUST return `paymentId`, `cancellationId`, `code`, `message`, `requestId`. Capture MUST return `paymentId`, `settleId`, `value`, `code`, `message`, `requestId`. Refund MUST return `paymentId`, `refundId`, `value`, `code`, `message`, `requestId`.

**Why**: The Gateway parses these fields programmatically. Missing fields cause deserialization errors, and the Gateway treats the payment as failed. Incorrect `delayToAutoSettle` values (or missing ones) cause payments to auto-cancel or auto-capture at wrong times.

**Detection**: If a response object is missing any of the required fields for its endpoint, STOP and add the missing fields.

✅ **CORRECT**:
```typescript
interface CreatePaymentResponse {
  paymentId: string;
  status: "approved" | "denied" | "undefined";
  authorizationId: string | null;
  nsu: string | null;
  tid: string | null;
  acquirer: string | null;
  code: string | null;
  message: string | null;
  delayToAutoSettle: number;
  delayToAutoSettleAfterAntifraud: number;
  delayToCancel: number;
  paymentUrl?: string;
}

async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, value, currency, paymentMethod, card, callbackUrl } = req.body;

  const result = await processPaymentWithAcquirer(req.body);

  const response: CreatePaymentResponse = {
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyAcquirer",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,    // 6 hours in seconds
    delayToAutoSettleAfterAntifraud: 1800, // 30 minutes in seconds
    delayToCancel: 21600,         // 6 hours in seconds
  };

  res.status(200).json(response);
}
```

❌ **WRONG**:
```typescript
// Missing required fields — Gateway will reject this response
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const result = await processPaymentWithAcquirer(req.body);

  // Missing: authorizationId, nsu, tid, acquirer, code, message,
  // delayToAutoSettle, delayToAutoSettleAfterAntifraud, delayToCancel
  res.status(200).json({
    paymentId: req.body.paymentId,
    status: result.status,
  });
}
```

---

### Constraint: Manifest Must Declare All Supported Payment Methods

**Rule**: The GET `/manifest` endpoint MUST return a `paymentMethods` array listing every payment method the connector supports, with the correct `name` and `allowsSplit` configuration for each.

**Why**: The Gateway reads the manifest to determine which payment methods are available for this connector. If a method is missing from the manifest, merchants cannot configure it in the VTEX Admin. The `allowsSplit` field controls revenue split behavior — an incorrect value causes split payment failures.

**Detection**: If the manifest handler returns an empty `paymentMethods` array or hardcodes methods that the provider does not actually support, STOP and fix the manifest to match the provider's real capabilities.

✅ **CORRECT**:
```typescript
interface PaymentMethodManifest {
  name: string;
  allowsSplit: "onCapture" | "onAuthorize" | "disabled";
}

interface ManifestResponse {
  paymentMethods: PaymentMethodManifest[];
}

async function manifestHandler(_req: Request, res: Response): Promise<void> {
  const manifest: ManifestResponse = {
    paymentMethods: [
      { name: "Visa", allowsSplit: "onCapture" },
      { name: "Mastercard", allowsSplit: "onCapture" },
      { name: "American Express", allowsSplit: "onCapture" },
      { name: "BankInvoice", allowsSplit: "onAuthorize" },
      { name: "Pix", allowsSplit: "disabled" },
    ],
  };

  res.status(200).json(manifest);
}
```

❌ **WRONG**:
```typescript
// Empty manifest — no payment methods will appear in the Admin
async function manifestHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ paymentMethods: [] });
}
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Define Types for All Endpoint Contracts

Define TypeScript interfaces for every request and response shape. This catches missing fields at compile time.

```typescript
// --- Manifest ---
interface ManifestResponse {
  paymentMethods: Array<{
    name: string;
    allowsSplit: "onCapture" | "onAuthorize" | "disabled";
  }>;
}

// --- Create Payment ---
interface CreatePaymentRequest {
  reference: string;
  orderId: string;
  transactionId: string;
  paymentId: string;
  paymentMethod: string;
  value: number;
  currency: string;
  installments: number;
  card?: {
    holder: string;
    number: string;
    csc: string;
    expiration: { month: string; year: string };
  };
  miniCart: Record<string, unknown>;
  callbackUrl: string;
  returnUrl?: string;
}

interface CreatePaymentResponse {
  paymentId: string;
  status: "approved" | "denied" | "undefined";
  authorizationId: string | null;
  nsu: string | null;
  tid: string | null;
  acquirer: string | null;
  code: string | null;
  message: string | null;
  delayToAutoSettle: number;
  delayToAutoSettleAfterAntifraud: number;
  delayToCancel: number;
  paymentUrl?: string;
}

// --- Cancel Payment ---
interface CancelPaymentRequest {
  paymentId: string;
  requestId: string;
}

interface CancelPaymentResponse {
  paymentId: string;
  cancellationId: string | null;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Capture/Settle Payment ---
interface CapturePaymentRequest {
  paymentId: string;
  transactionId: string;
  value: number;
  requestId: string;
}

interface CapturePaymentResponse {
  paymentId: string;
  settleId: string | null;
  value: number;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Refund Payment ---
interface RefundPaymentRequest {
  paymentId: string;
  transactionId: string;
  settleId: string;
  value: number;
  requestId: string;
}

interface RefundPaymentResponse {
  paymentId: string;
  refundId: string | null;
  value: number;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Inbound Request ---
interface InboundRequest {
  requestId: string;
  transactionId: string;
  paymentId: string;
  authorizationId: string;
  tid: string;
  requestData: { body: string };
}

interface InboundResponse {
  requestId: string;
  paymentId: string;
  responseData: {
    statusCode: number;
    contentType: string;
    content: string;
  };
}
```

### Step 2: Implement the Payment Flow Handlers

Wire up each handler with proper error handling and response construction.

```typescript
import { Router, Request, Response } from "express";

const router = Router();

router.get("/manifest", async (_req: Request, res: Response) => {
  const manifest: ManifestResponse = {
    paymentMethods: [
      { name: "Visa", allowsSplit: "onCapture" },
      { name: "Mastercard", allowsSplit: "onCapture" },
      { name: "Pix", allowsSplit: "disabled" },
    ],
  };
  res.status(200).json(manifest);
});

router.post("/payments", async (req: Request, res: Response) => {
  const body: CreatePaymentRequest = req.body;
  const result = await processWithAcquirer(body);

  const response: CreatePaymentResponse = {
    paymentId: body.paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };
  res.status(200).json(response);
});

router.post("/payments/:paymentId/cancellations", async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const { requestId } = req.body as CancelPaymentRequest;
  const result = await cancelWithAcquirer(paymentId);

  const response: CancelPaymentResponse = {
    paymentId,
    cancellationId: result.cancellationId ?? null,
    code: result.code ?? null,
    message: result.message ?? "Successfully cancelled",
    requestId,
  };
  res.status(200).json(response);
});

router.post("/payments/:paymentId/settlements", async (req: Request, res: Response) => {
  const body: CapturePaymentRequest = req.body;
  const result = await captureWithAcquirer(body.paymentId, body.value);

  const response: CapturePaymentResponse = {
    paymentId: body.paymentId,
    settleId: result.settleId ?? null,
    value: result.capturedValue ?? body.value,
    code: result.code ?? null,
    message: result.message ?? null,
    requestId: body.requestId,
  };
  res.status(200).json(response);
});

router.post("/payments/:paymentId/refunds", async (req: Request, res: Response) => {
  const body: RefundPaymentRequest = req.body;
  const result = await refundWithAcquirer(body.paymentId, body.value);

  const response: RefundPaymentResponse = {
    paymentId: body.paymentId,
    refundId: result.refundId ?? null,
    value: result.refundedValue ?? body.value,
    code: result.code ?? null,
    message: result.message ?? null,
    requestId: body.requestId,
  };
  res.status(200).json(response);
});

router.post(
  "/payments/:paymentId/inbound-request/:action",
  async (req: Request, res: Response) => {
    const body: InboundRequest = req.body;
    const result = await handleInbound(body);

    const response: InboundResponse = {
      requestId: body.requestId,
      paymentId: body.paymentId,
      responseData: {
        statusCode: 200,
        contentType: "application/json",
        content: JSON.stringify(result),
      },
    };
    res.status(200).json(response);
  }
);

export default router;
```

### Step 3: Implement the Configuration Flow Handlers

These endpoints handle merchant onboarding through the VTEX Admin.

```typescript
import { Router, Request, Response } from "express";

const configRouter = Router();

// 1. POST /authorization/token
configRouter.post("/authorization/token", async (req: Request, res: Response) => {
  const { applicationId, returnUrl } = req.body;
  // applicationId is always "vtex"
  const token = await generateAuthorizationToken(applicationId, returnUrl);

  res.status(200).json({
    applicationId,
    token,
  });
});

// 2. GET /authorization/redirect
configRouter.get("/authorization/redirect", async (req: Request, res: Response) => {
  const { token } = req.query;
  // Redirect to provider's OAuth/consent page
  // After merchant approves, redirect back with authorizationCode appended to returnUrl
  const providerLoginUrl = buildProviderLoginUrl(token as string);
  res.redirect(302, providerLoginUrl);
});

// 3. GET /authorization/credentials
configRouter.get("/authorization/credentials", async (req: Request, res: Response) => {
  const { authorizationCode } = req.query;
  const credentials = await exchangeCodeForCredentials(authorizationCode as string);

  res.status(200).json({
    applicationId: "vtex",
    appKey: credentials.appKey,
    appToken: credentials.appToken,
  });
});

export default configRouter;
```

### Complete Example

Tying both flows together in a single Express application:

```typescript
import express from "express";
import paymentRouter from "./routes/payment";
import configRouter from "./routes/config";

const app = express();
app.use(express.json());

// Payment flow endpoints
app.use("/", paymentRouter);

// Configuration flow endpoints
app.use("/", configRouter);

// Health check
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

const PORT = 443;
app.listen(PORT, () => {
  console.log(`Payment provider middleware running on port ${PORT}`);
});
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Partial Endpoint Implementation

**What happens**: The developer implements only Create Payment and Capture, skipping Manifest, Cancel, Refund, and Inbound Request endpoints.

**Why it fails**: The VTEX Payment Provider Test Suite tests all endpoints during homologation. Missing endpoints cause immediate test failure. At runtime, the Gateway cannot cancel or refund payments, leaving merchants unable to process returns.

**Fix**: Implement all six payment-flow endpoints from the start. Use the type definitions above to scaffold all handlers before adding business logic.

```typescript
// Start by creating stub handlers for every endpoint
const stubHandler = async (req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented yet" });
};

router.get("/manifest", stubHandler);
router.post("/payments", stubHandler);
router.post("/payments/:paymentId/cancellations", stubHandler);
router.post("/payments/:paymentId/settlements", stubHandler);
router.post("/payments/:paymentId/refunds", stubHandler);
router.post("/payments/:paymentId/inbound-request/:action", stubHandler);
// Then replace each stub with real logic incrementally
```

---

### Anti-Pattern: Using Incorrect HTTP Methods

**What happens**: The developer uses POST for the Manifest endpoint or GET for Create Payment.

**Why it fails**: The Gateway sends requests with specific HTTP methods. A POST handler on `/manifest` will not receive the GET request the Gateway sends, returning a 404 or 405.

**Fix**: Follow the exact HTTP methods from the protocol:

```typescript
// GET for manifest — the Gateway reads capabilities, not writes
router.get("/manifest", manifestHandler);

// POST for all payment operations — these create or modify state
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);
router.post("/payments/:paymentId/refunds", refundPaymentHandler);
router.post("/payments/:paymentId/inbound-request/:action", inboundRequestHandler);
```

---

### Anti-Pattern: Missing or Incorrect Delay Values

**What happens**: The developer omits `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, or `delayToCancel` from the Create Payment response, or sets them to zero.

**Why it fails**: These values (in seconds) control when the Gateway automatically captures or cancels a payment. Zero or missing values cause immediate auto-capture or auto-cancel, which leads to premature settlement or lost payments.

**Fix**: Always return sensible delay values in seconds:

```typescript
const response: CreatePaymentResponse = {
  paymentId: body.paymentId,
  status: "approved",
  authorizationId: "AUTH-123",
  nsu: "NSU-456",
  tid: "TID-789",
  acquirer: "MyProvider",
  code: "200",
  message: "Approved",
  delayToAutoSettle: 21600,                  // 6 hours
  delayToAutoSettleAfterAntifraud: 1800,     // 30 minutes
  delayToCancel: 21600,                      // 6 hours
};
```

## Reference

**Links to VTEX documentation and related resources.**

- [Payment Provider Protocol Overview](https://developers.vtex.com/docs/guides/payment-provider-protocol-api-overview) — API overview with endpoint requirements, common parameters, and test suite info
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Step-by-step guide covering all 9 endpoints with request/response examples
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — High-level protocol explanation including payment flow diagrams and callback URL usage
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization, capture, and cancellation flow details
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full OpenAPI specification for all PPP endpoints
- [Integrating a New Payment Provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex) — End-to-end integration guide from development to homologation

---

# Custom VTEX IO Apps

# App Architecture & Manifest Configuration

## Overview

**What this skill covers**: The foundational structure of every VTEX IO app — the `manifest.json` file, builder system, policy declarations, dependency management, `service.json` resource limits, and app lifecycle (link, publish, deploy).

**When to use it**: When creating a new VTEX IO app from scratch, adding a builder to an existing app, configuring policies for API access, or troubleshooting deployment failures related to manifest misconfiguration.

**What you'll learn**:
- How to configure `manifest.json` with the correct fields, builders, and policies
- Which builders to use for different app capabilities (backend, frontend, GraphQL, admin, pixel, messages, store themes)
- How to declare policies for accessing VTEX APIs and external services
- How `service.json` controls memory and timeout limits for backend services

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Manifest.json

The `manifest.json` file is the entry point for every VTEX IO app. It defines the app's identity (`vendor`, `name`, `version`), declares which `builders` will process the app's code, lists `dependencies` on other VTEX IO apps, and specifies `policies` granting access to external services and VTEX resources. Without a valid manifest, the app cannot be linked, published, or deployed.

### Concept 2: Builders

Builders are abstractions that process specific directories in your app. Each builder transforms code in its corresponding folder into runnable artifacts. The key builders are:

| Builder | Directory | Purpose |
|---------|-----------|---------|
| `node` | `/node` | Backend services in TypeScript (middlewares, resolvers, event handlers) |
| `react` | `/react` | Frontend React components in TypeScript/TSX |
| `graphql` | `/graphql` | GraphQL schema definitions (`.graphql` files) |
| `admin` | `/admin` | Admin panel pages and navigation entries |
| `pixel` | `/pixel` | Pixel/tracking apps that inject scripts into the storefront |
| `messages` | `/messages` | Internationalization — localized string files per locale |
| `store` | `/store` | Store Framework theme blocks, interfaces, and routes |
| `masterdata` | `/masterdata` | Master Data v2 entity schemas and triggers |
| `styles` | `/styles` | CSS/Tachyons configuration for Store Framework themes |

### Concept 3: Policies

Policies grant your app permission to access external resources. There are three types:

1. **Outbound-access policies**: Grant access to explicit URLs (external APIs or VTEX endpoints).
2. **License Manager policies**: Grant access to VTEX Admin resources using resource keys.
3. **App role-based policies**: Grant access to routes or GraphQL queries exposed by other IO apps, using the format `{vendor}.{app-name}:{policy-name}`.

Without the correct policies, API calls from your app will fail with `403 Forbidden` errors at runtime.

### Concept 4: service.json

The `service.json` file in the `/node` directory configures runtime resource limits for backend services:

```json
{
  "memory": 256,
  "timeout": 30,
  "minReplicas": 2,
  "maxReplicas": 10,
  "workers": 4,
  "routes": {
    "status": {
      "path": "/_v/status/:code",
      "public": true
    }
  }
}
```

- `memory`: Maximum memory in MB (default 256, max 512)
- `timeout`: Request timeout in seconds (default 30)
- `minReplicas` / `maxReplicas`: Autoscaling range
- `routes`: HTTP route definitions with path patterns and access control

**Architecture/Data Flow**:

```text
manifest.json
├── builders → determines which directories are processed
│   ├── node/ → compiled by node builder → backend service
│   ├── react/ → compiled by react builder → frontend bundles
│   ├── graphql/ → compiled by graphql builder → schema/resolvers
│   ├── store/ → compiled by store builder → theme blocks
│   ├── admin/ → compiled by admin builder → admin pages
│   ├── pixel/ → compiled by pixel builder → tracking scripts
│   └── messages/ → compiled by messages builder → i18n strings
├── policies → runtime permissions for API access
├── dependencies → other VTEX IO apps this app requires
└── peerDependencies → apps required but not auto-installed
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Declare All Required Builders

**Rule**: Every directory in your app that contains processable code MUST have a corresponding builder declared in `manifest.json`. If you have a `/node` directory, the `node` builder MUST be declared. If you have a `/react` directory, the `react` builder MUST be declared.

**Why**: Without the builder declaration, the VTEX IO platform ignores the directory entirely. Your backend code will not compile, your React components will not render, and your GraphQL schemas will not be registered. The app will link successfully but the functionality will silently be absent.

**Detection**: If you see backend TypeScript code in a `/node` directory but the manifest does not declare `"node": "7.x"` in `builders`, STOP and add the builder. Same applies to `/react` without `"react": "3.x"`, `/graphql` without `"graphql": "1.x"`, etc.

✅ **CORRECT**:
```json
{
  "name": "my-service-app",
  "vendor": "myvendor",
  "version": "1.0.0",
  "title": "My Service App",
  "description": "A backend service app with GraphQL",
  "builders": {
    "node": "7.x",
    "graphql": "1.x",
    "docs": "0.x"
  },
  "dependencies": {},
  "policies": []
}
```

❌ **WRONG**:
```json
{
  "name": "my-service-app",
  "vendor": "myvendor",
  "version": "1.0.0",
  "title": "My Service App",
  "description": "A backend service app with GraphQL",
  "builders": {
    "docs": "0.x"
  },
  "dependencies": {},
  "policies": []
}
// Missing "node" and "graphql" builders — the /node and /graphql
// directories will be completely ignored. Backend code won't compile,
// GraphQL schema won't be registered. The app links without errors
// but nothing works.
```

---

### Constraint: Declare Policies for All External Access

**Rule**: Every external API call or VTEX resource access MUST have a corresponding policy in `manifest.json`. This includes outbound HTTP calls to external hosts, VTEX Admin resource access, and consumption of other apps' GraphQL APIs.

**Why**: VTEX IO sandboxes apps for security. Without the proper policy, any outbound HTTP request will be blocked at the infrastructure level, returning a `403 Forbidden` error. This is not a code issue — it is a platform-level restriction.

**Detection**: If you see code making API calls (via clients or HTTP) to a host, STOP and verify that an `outbound-access` policy exists for that host in the manifest. If you see `licenseManager.canAccessResource(...)`, verify a License Manager policy exists.

✅ **CORRECT**:
```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "api.vtex.com",
        "path": "/api/*"
      }
    },
    {
      "name": "outbound-access",
      "attrs": {
        "host": "portal.vtexcommercestable.com.br",
        "path": "/api/*"
      }
    },
    {
      "name": "ADMIN_DS"
    },
    {
      "name": "colossus-fire-event"
    },
    {
      "name": "colossus-write-logs"
    }
  ]
}
```

❌ **WRONG**:
```json
{
  "policies": []
}
// Empty policies array while the app makes calls to api.vtex.com
// and uses Master Data. All outbound requests will fail at runtime
// with 403 Forbidden errors that are difficult to debug.
```

---

### Constraint: Follow App Naming Conventions

**Rule**: App names MUST be in kebab-case (lowercase letters separated by hyphens). The vendor MUST match the VTEX account name. Version MUST follow Semantic Versioning 2.0.0.

**Why**: Apps with invalid names cannot be published to the VTEX App Store. Names with special characters or uppercase letters will be rejected by the builder-hub. Vendor mismatch prevents the account from managing the app.

**Detection**: If you see an app name with uppercase letters, underscores, special characters, or numbers at the beginning, STOP and fix the name.

✅ **CORRECT**:
```json
{
  "name": "order-status-dashboard",
  "vendor": "mycompany",
  "version": "2.1.3"
}
```

❌ **WRONG**:
```json
{
  "name": "Order_Status_Dashboard",
  "vendor": "mycompany",
  "version": "2.1"
}
// Uppercase letters and underscores in the name will be rejected.
// Version "2.1" is not valid semver — must be "2.1.0".
```

## Implementation Pattern

**The canonical, recommended way to scaffold and configure a VTEX IO app.**

### Step 1: Initialize the App

Use the VTEX IO CLI to create a new app from a boilerplate template:

```bash
# Install VTEX IO CLI if not already installed
vtex init

# Select the appropriate template:
# - service-example: Backend service with Node
# - graphql-example: GraphQL API with Node
# - react-app-template: Frontend React app
# - store-theme: Store Framework theme
```

### Step 2: Configure manifest.json

Edit the manifest with your app's identity and required builders:

```json
{
  "name": "product-review-service",
  "vendor": "mycompany",
  "version": "0.1.0",
  "title": "Product Review Service",
  "description": "Backend service for managing product reviews with GraphQL API",
  "builders": {
    "node": "7.x",
    "graphql": "1.x",
    "docs": "0.x"
  },
  "dependencies": {
    "vtex.search-graphql": "0.x"
  },
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "api.vtex.com",
        "path": "/api/*"
      }
    },
    {
      "name": "ADMIN_DS"
    },
    {
      "name": "colossus-fire-event"
    },
    {
      "name": "colossus-write-logs"
    }
  ]
}
```

### Step 3: Configure service.json for Backend Apps

Create `/node/service.json` to define resource limits and routes:

```json
{
  "memory": 256,
  "timeout": 30,
  "minReplicas": 2,
  "maxReplicas": 10,
  "workers": 4,
  "routes": {
    "reviews": {
      "path": "/_v/api/reviews",
      "public": false
    },
    "review-by-id": {
      "path": "/_v/api/reviews/:id",
      "public": false
    }
  }
}
```

### Step 4: Set Up the Directory Structure

Create the directories matching your declared builders:

```text
my-app/
├── manifest.json
├── package.json
├── node/
│   ├── package.json
│   ├── tsconfig.json
│   ├── service.json
│   ├── index.ts          # Service entry point
│   ├── clients/
│   │   └── index.ts      # Client registry
│   ├── middlewares/
│   │   └── validate.ts   # HTTP middleware
│   └── resolvers/
│       └── reviews.ts    # GraphQL resolvers
├── graphql/
│   ├── schema.graphql    # Query/Mutation definitions
│   └── types/
│       └── Review.graphql
├── messages/
│   ├── en.json
│   ├── pt.json
│   └── es.json
└── docs/
    └── README.md
```

### Complete Example

A full `manifest.json` for a comprehensive app using multiple builders:

```json
{
  "name": "product-review-suite",
  "vendor": "mycompany",
  "version": "1.0.0",
  "title": "Product Review Suite",
  "description": "Complete product review system with backend, frontend, and admin panel",
  "mustUpdateAt": "2026-01-01",
  "builders": {
    "node": "7.x",
    "react": "3.x",
    "graphql": "1.x",
    "admin": "0.x",
    "messages": "1.x",
    "store": "0.x",
    "docs": "0.x"
  },
  "dependencies": {
    "vtex.styleguide": "9.x",
    "vtex.store-components": "3.x",
    "vtex.css-handles": "0.x"
  },
  "peerDependencies": {
    "vtex.store": "2.x"
  },
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "api.vtex.com",
        "path": "/api/*"
      }
    },
    {
      "name": "ADMIN_DS"
    },
    {
      "name": "colossus-fire-event"
    },
    {
      "name": "colossus-write-logs"
    }
  ],
  "settingsSchema": {
    "title": "Product Review Suite Settings",
    "type": "object",
    "properties": {
      "enableModeration": {
        "title": "Enable review moderation",
        "type": "boolean"
      },
      "reviewsPerPage": {
        "title": "Reviews per page",
        "type": "number"
      }
    }
  }
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Declaring Unused Builders

**What happens**: Developers add builders "just in case" — declaring `react`, `graphql`, `admin`, and `store` builders even though the app only needs `node`.

**Why it fails**: Each builder creates overhead during the build process. Unused builder directories that are empty or missing can cause build warnings. Worse, if someone accidentally adds files to a builder directory, they may introduce unintended functionality.

**Fix**: Only declare builders that your app actively uses. Remove any builder declarations without corresponding directory content.

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x"
  }
}
```

---

### Anti-Pattern: Wildcard Outbound Policies

**What happens**: Developers use overly broad outbound-access policies like `"host": "*"` or `"path": "/*"` to avoid policy errors during development.

**Why it fails**: Overly permissive policies are a security risk and will be rejected during app review for the VTEX App Store. They also make it unclear which external services the app actually communicates with, making security audits difficult.

**Fix**: Declare specific policies for each external service your app communicates with:

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "api.vtex.com",
        "path": "/api/*"
      }
    },
    {
      "name": "outbound-access",
      "attrs": {
        "host": "my-external-api.example.com",
        "path": "/v1/*"
      }
    }
  ]
}
```

---

### Anti-Pattern: Hardcoding Version in Dependencies

**What happens**: Developers pin exact versions in dependencies like `"vtex.store-components": "3.165.0"` instead of using version ranges.

**Why it fails**: Exact versions prevent your app from receiving bug fixes and patches from dependency updates. VTEX IO uses semver ranges, and minor/patch updates are backward-compatible. Pinning forces users to manually update your app for every dependency patch.

**Fix**: Use major version ranges with the `x` wildcard:

```json
{
  "dependencies": {
    "vtex.store-components": "3.x",
    "vtex.styleguide": "9.x"
  }
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) — Complete reference for all manifest.json fields and their usage
- [Builders](https://developers.vtex.com/docs/guides/vtex-io-documentation-builders) — Full list of available builders with descriptions and usage examples
- [Policies](https://developers.vtex.com/docs/guides/vtex-io-documentation-policies) — How to declare outbound-access, License Manager, and role-based policies
- [Dependencies](https://developers.vtex.com/docs/guides/vtex-io-documentation-dependencies) — Managing app dependencies and peer dependencies
- [Accessing External Resources](https://developers.vtex.com/docs/guides/accessing-external-resources-within-a-vtex-io-app) — Policy types and patterns for external API access
- [Creating a New App](https://developers.vtex.com/docs/guides/vtex-io-documentation-3-creating-the-new-app) — Step-by-step guide for app initialization

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

---

# MasterData v2 Integration

## Overview

**What this skill covers**: Integrating Master Data v2 with VTEX IO apps — defining data entities with JSON Schemas via the `masterdata` builder, performing CRUD operations through the MasterDataClient (`ctx.clients.masterdata`), configuring triggers for automated actions, using search and scroll for data retrieval, and managing schema lifecycle to avoid the 60-schema-per-entity limit.

**When to use it**: When your VTEX IO app needs to store custom data (reviews, wishlists, form submissions, configuration records), query or filter that data, or set up automated workflows triggered by data changes.

**What you'll learn**:
- How to define data entities and JSON Schemas using the `masterdata` builder
- How to perform CRUD operations through MasterDataClient with typed documents
- How to configure search, scroll, and indexing for efficient data retrieval
- How to set up Master Data triggers for automated workflows

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Data Entities and JSON Schemas

A **data entity** is a named collection of documents in Master Data (analogous to a database table). Each document is a JSON object. A **JSON Schema** defines the structure, validation rules, and indexing for documents in a data entity.

When using the `masterdata` builder, entities are defined by folder structure:

```text
masterdata/
├── reviews/
│   └── schema.json       # JSON Schema for the "reviews" entity
└── wishlists/
    └── schema.json       # JSON Schema for the "wishlists" entity
```

The builder creates entities named `{vendor}_{appName}_{entityName}` (e.g., `mycompany_reviewapp_reviews`).

### Concept 2: MasterDataClient

The `MasterDataClient` is available at `ctx.clients.masterdata` in every VTEX IO service app that uses the `@vtex/api` package. It provides typed methods for all CRUD operations:

| Method | Description |
|--------|-------------|
| `getDocument` | Retrieve a single document by ID |
| `createDocument` | Create a new document, returns generated ID |
| `createOrUpdateEntireDocument` | Upsert a complete document |
| `createOrUpdatePartialDocument` | Upsert partial fields (patch) |
| `updateEntireDocument` | Replace all fields of an existing document |
| `updatePartialDocument` | Update specific fields only |
| `deleteDocument` | Delete a document by ID |
| `searchDocuments` | Search with filters, pagination, and field selection |
| `searchDocumentsWithPaginationInfo` | Search with total count metadata |
| `scrollDocuments` | Iterate over large result sets |
| `getSchema` | Retrieve a schema definition |
| `createOrUpdateSchema` | Save a schema to a data entity |

### Concept 3: Indexing and Search

Master Data v2 indexes fields declared in the JSON Schema for efficient querying. To make a field searchable, it must be declared in the schema with `v-indexed: true` or listed in the schema's index configuration.

Search uses a `where` clause syntax:

```text
where: "productId=12345 AND approved=true"
where: "rating>3"
where: "createdAt between 2025-01-01 AND 2025-12-31"
```

For large datasets, use `scrollDocuments` instead of `searchDocuments` to avoid timeout issues and paginate through all results.

### Concept 4: Triggers

Master Data v2 triggers execute automated actions when documents are created, updated, or deleted. Triggers can send emails, call HTTP webhooks, or execute custom actions. In the `masterdata` builder, triggers are defined in JSON files:

```text
masterdata/
└── reviews/
    ├── schema.json
    └── triggers/
        └── notify-on-review.json
```

Trigger configuration:

```json
{
  "name": "notify-on-new-review",
  "active": true,
  "condition": "status=approved",
  "action": {
    "type": "http",
    "uri": "https://myaccount.myvtex.com/_v/review-notifications",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    }
  },
  "retry": {
    "times": 3,
    "delay": { "addMinutes": 5 }
  }
}
```

**Architecture/Data Flow**:

```text
VTEX IO App (node builder)
  │
  ├── ctx.clients.masterdata.createDocument()
  │       │
  │       ▼
  │   Master Data v2 API
  │       │
  │       ├── Validates against JSON Schema
  │       ├── Indexes declared fields
  │       └── Fires triggers (if conditions match)
  │             │
  │             ▼
  │         HTTP webhook / Email / Action
  │
  └── ctx.clients.masterdata.searchDocuments()
          │
          ▼
      Master Data v2 (reads indexed fields for efficient queries)
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Use MasterDataClient — Never Direct REST Calls

**Rule**: All Master Data operations in VTEX IO apps MUST go through the MasterDataClient (`ctx.clients.masterdata`) or the `masterDataFor` factory from `@vtex/clients`. You MUST NOT make direct REST calls to `/api/dataentities/` endpoints.

**Why**: The MasterDataClient handles authentication token injection, request routing, retry logic, caching, and proper error handling. Direct REST calls bypass all of these, requiring you to manually manage auth headers, handle pagination, and implement retry logic. The client also provides TypeScript types and consistent error formatting.

**Detection**: If you see direct HTTP calls to URLs matching `/api/dataentities/`, `api.vtex.com/api/dataentities`, or raw fetch/axios calls targeting Master Data endpoints, warn the developer to use `ctx.clients.masterdata` instead.

✅ **CORRECT**:
```typescript
// Using MasterDataClient through ctx.clients
export async function getReview(ctx: Context, next: () => Promise<void>) {
  const { id } = ctx.query

  const review = await ctx.clients.masterdata.getDocument<Review>({
    dataEntity: 'reviews',
    id: id as string,
    fields: ['id', 'productId', 'author', 'rating', 'title', 'text', 'approved'],
  })

  ctx.status = 200
  ctx.body = review
  await next()
}
```

❌ **WRONG**:
```typescript
// Direct REST call to Master Data — bypasses client infrastructure
import axios from 'axios'

export async function getReview(ctx: Context, next: () => Promise<void>) {
  const { id } = ctx.query

  // No caching, no retry, no proper auth, no metrics
  const response = await axios.get(
    `https://api.vtex.com/api/dataentities/reviews/documents/${id}`,
    {
      headers: {
        'X-VTEX-API-AppKey': process.env.VTEX_APP_KEY,
        'X-VTEX-API-AppToken': process.env.VTEX_APP_TOKEN,
      },
    }
  )

  ctx.status = 200
  ctx.body = response.data
  await next()
}
```

---

### Constraint: Define JSON Schemas for All Data Entities

**Rule**: Every data entity your app uses MUST have a corresponding JSON Schema, either via the `masterdata` builder (recommended) or created via the Master Data API before the app is deployed.

**Why**: Without a schema, Master Data stores documents as unstructured JSON. This means no field validation, no indexing (making search extremely slow on large datasets), no type safety, and no trigger support. Queries on unindexed fields perform full scans, which can time out or hit rate limits.

**Detection**: If the app creates or searches documents in a data entity but no JSON Schema exists for that entity (either in the `masterdata/` builder directory or via API), warn the developer to define a schema.

✅ **CORRECT**:
```json
// masterdata/reviews/schema.json
{
  "$schema": "http://json-schema.org/schema#",
  "title": "review-schema-v1",
  "type": "object",
  "properties": {
    "productId": {
      "type": "string"
    },
    "author": {
      "type": "string"
    },
    "rating": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "title": {
      "type": "string",
      "maxLength": 200
    },
    "text": {
      "type": "string",
      "maxLength": 5000
    },
    "approved": {
      "type": "boolean"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": ["productId", "rating", "title", "text"],
  "v-default-fields": ["productId", "author", "rating", "title", "approved", "createdAt"],
  "v-indexed": ["productId", "author", "approved", "rating", "createdAt"]
}
```

❌ **WRONG**:
```typescript
// Saving documents without any schema — no validation, no indexing
await ctx.clients.masterdata.createDocument({
  dataEntity: 'reviews',
  fields: {
    productId: '12345',
    rating: 'five', // String instead of number — no validation!
    title: 123,     // Number instead of string — no validation!
  },
})

// Searching on unindexed fields — full table scan, will time out on large datasets
await ctx.clients.masterdata.searchDocuments({
  dataEntity: 'reviews',
  where: 'productId=12345',  // productId is not indexed — very slow
  fields: ['id', 'rating'],
  pagination: { page: 1, pageSize: 10 },
})
```

---

### Constraint: Manage Schema Versions to Avoid the 60-Schema Limit

**Rule**: Master Data v2 data entities have a limit of 60 schemas per entity. When using the `masterdata` builder, each app version linked or installed creates a new schema. You MUST delete unused schemas regularly.

**Why**: Once the 60-schema limit is reached, the `masterdata` builder cannot create new schemas, and linking or installing new app versions will fail. This is a hard platform limit that cannot be increased.

**Detection**: If the app has been through many link/install cycles, warn the developer to check and clean up old schemas using the [Delete Schema API](https://developers.vtex.com/docs/api-reference/master-data-api-v2#delete-/api/dataentities/-dataEntityName-/schemas/-schemaName-).

✅ **CORRECT**:
```bash
# Periodically clean up unused schemas
# List schemas for the entity
curl -X GET "https://{account}.vtexcommercestable.com.br/api/dataentities/reviews/schemas" \
  -H "X-VTEX-API-AppKey: {appKey}" \
  -H "X-VTEX-API-AppToken: {appToken}"

# Delete old schemas that are no longer in use
curl -X DELETE "https://{account}.vtexcommercestable.com.br/api/dataentities/reviews/schemas/old-schema-name" \
  -H "X-VTEX-API-AppKey: {appKey}" \
  -H "X-VTEX-API-AppToken: {appToken}"
```

❌ **WRONG**:
```text
# Never cleaning up schemas during development.
# After 60 link cycles, the builder fails:
# "Error: Maximum number of schemas reached for entity 'reviews'"
# The app cannot be linked or installed until old schemas are deleted.
```

## Implementation Pattern

**The canonical, recommended way to integrate Master Data v2 in a VTEX IO app.**

### Step 1: Add the masterdata Builder and Policies

```json
// manifest.json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x",
    "masterdata": "1.x"
  },
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "api.vtex.com",
        "path": "/api/*"
      }
    },
    {
      "name": "ADMIN_DS"
    }
  ]
}
```

### Step 2: Define Data Entity Schemas

```json
// masterdata/reviews/schema.json
{
  "$schema": "http://json-schema.org/schema#",
  "title": "review-schema-v1",
  "type": "object",
  "properties": {
    "productId": {
      "type": "string"
    },
    "author": {
      "type": "string"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "rating": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "title": {
      "type": "string",
      "maxLength": 200
    },
    "text": {
      "type": "string",
      "maxLength": 5000
    },
    "approved": {
      "type": "boolean"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": ["productId", "rating", "title", "text"],
  "v-default-fields": ["productId", "author", "rating", "title", "approved", "createdAt"],
  "v-indexed": ["productId", "author", "approved", "rating", "createdAt"],
  "v-cache": false
}
```

### Step 3: Generate TypeScript Typings

```bash
# At the root of your project
vtex setup -i

# This generates types based on your schema that you can import:
# import type { Review } from 'myvendor.myapp'
```

### Step 4: Set Up the Client with masterDataFor

```typescript
// node/clients/index.ts
import { IOClients } from '@vtex/api'
import { masterDataFor } from '@vtex/clients'

// Import the generated type from the masterdata builder
interface Review {
  id: string
  productId: string
  author: string
  email: string
  rating: number
  title: string
  text: string
  approved: boolean
  createdAt: string
}

export class Clients extends IOClients {
  public get reviews() {
    return this.getOrSet('reviews', masterDataFor<Review>('reviews'))
  }
}
```

### Step 5: Implement CRUD Operations

```typescript
// node/resolvers/reviews.ts
import type { ServiceContext } from '@vtex/api'
import type { Clients } from '../clients'

type Context = ServiceContext<Clients>

export const queries = {
  reviews: async (
    _root: unknown,
    args: { productId: string; page?: number; pageSize?: number },
    ctx: Context
  ) => {
    const { productId, page = 1, pageSize = 10 } = args

    const results = await ctx.clients.reviews.search(
      { page, pageSize },
      ['id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved'],
      '',  // sort
      `productId=${productId} AND approved=true`
    )

    return results
  },
}

export const mutations = {
  createReview: async (
    _root: unknown,
    args: { input: { productId: string; rating: number; title: string; text: string } },
    ctx: Context
  ) => {
    const { input } = args
    const email = ctx.vtex.storeUserEmail ?? 'anonymous@store.com'

    const response = await ctx.clients.reviews.save({
      ...input,
      author: email.split('@')[0],
      email,
      approved: false,
      createdAt: new Date().toISOString(),
    })

    return ctx.clients.reviews.get(response.DocumentId, [
      'id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved',
    ])
  },

  deleteReview: async (
    _root: unknown,
    args: { id: string },
    ctx: Context
  ) => {
    await ctx.clients.reviews.delete(args.id)
    return true
  },
}
```

### Step 6: Configure Triggers (Optional)

```json
// masterdata/reviews/triggers/notify-moderator.json
{
  "name": "notify-moderator-on-new-review",
  "active": true,
  "condition": "approved=false",
  "action": {
    "type": "email",
    "provider": "default",
    "subject": "New review pending moderation",
    "to": ["moderator@mystore.com"],
    "body": "A new review has been submitted for product {{productId}} by {{author}}."
  },
  "retry": {
    "times": 3,
    "delay": { "addMinutes": 5 }
  }
}
```

### Complete Example

Full CRUD service for product reviews with Master Data v2:

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

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Direct REST Calls to /api/dataentities/

**What happens**: Developers use `axios` or `fetch` to call Master Data v2 REST endpoints directly, bypassing the MasterDataClient.

**Why it fails**: Direct calls require manual auth header management, manual pagination, no built-in retry logic, and no caching. When the VTEX auth token format changes, direct calls break while the client handles it transparently.

**Fix**: Use `ctx.clients.masterdata` or `masterDataFor` from `@vtex/clients`:

```typescript
// Instead of direct API calls:
const reviews = await ctx.clients.reviews.search(
  { page: 1, pageSize: 10 },
  ['id', 'productId', 'rating', 'title'],
  '',
  `productId=${productId}`
)
```

---

### Anti-Pattern: Searching Without Indexed Fields

**What happens**: Developers query Master Data using `where` clauses on fields that are not indexed in the JSON Schema.

**Why it fails**: Queries on non-indexed fields trigger full document scans. For data entities with thousands of documents, this causes timeouts and rate limit errors. The query may return partial results or fail entirely.

**Fix**: Ensure all fields used in `where` clauses are declared in the schema's `v-indexed` array:

```json
{
  "v-indexed": ["productId", "author", "approved", "rating", "createdAt"]
}
```

Then queries on these fields will use the index:

```typescript
// Fast — productId and approved are indexed
await ctx.clients.reviews.search(
  { page: 1, pageSize: 10 },
  ['id', 'rating', 'title'],
  '',
  'productId=12345 AND approved=true'
)
```

---

### Anti-Pattern: Not Paginating Search Results

**What happens**: Developers call `searchDocuments` requesting all documents at once (e.g., `pageSize: 1000`) instead of paginating.

**Why it fails**: Master Data v2 has a maximum page size of 100 documents. Requesting more silently returns only up to the limit. For large datasets, use `scrollDocuments` to iterate through all results without hitting API limits.

**Fix**: Use proper pagination or scroll for large result sets:

```typescript
// For bounded result sets (known small size)
const reviews = await ctx.clients.reviews.search(
  { page: 1, pageSize: 50 },
  ['id', 'rating', 'title'],
  '',
  `productId=${productId}`
)

// For large/unbounded result sets — use scroll
const allReviews = await ctx.clients.masterdata.scrollDocuments<Review>({
  dataEntity: 'reviews',
  fields: ['id', 'productId', 'rating'],
  where: 'approved=true',
  size: 100,  // Batch size per scroll request
})
```

## Reference

**Links to VTEX documentation and related resources.**

- [Creating a Master Data v2 CRUD App](https://developers.vtex.com/docs/guides/create-master-data-crud-app) — Complete guide for building Master Data apps with the masterdata builder
- [Working with JSON Schemas in Master Data v2](https://developers.vtex.com/docs/guides/working-with-json-schemas-in-master-data-v2) — Schema structure, validation, and indexing configuration
- [Schema Lifecycle](https://developers.vtex.com/docs/guides/master-data-schema-lifecycle) — How schemas evolve and impact data entities over time
- [Setting Up Triggers on Master Data v2](https://developers.vtex.com/docs/guides/setting-up-triggers-on-master-data-v2) — Trigger configuration for automated workflows
- [Master Data v2 API Reference](https://developers.vtex.com/docs/api-reference/master-data-api-v2#overview) — Complete API reference for all Master Data v2 endpoints
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — MasterDataClient methods and usage in VTEX IO

---

# Frontend React Components & Hooks

## Overview

**What this skill covers**: Building VTEX IO frontend apps using the `react` builder — creating React components that integrate with Store Framework as theme blocks, configuring `interfaces.json` to map blocks to components, setting up `contentSchemas.json` for Site Editor customization, using VTEX Styleguide for admin apps, and applying `css-handles` for safe storefront styling.

**When to use it**: When developing custom storefront components (product displays, forms, banners), admin panel interfaces, pixel/tracking apps, or any VTEX IO app that renders UI with React.

**What you'll learn**:
- How to create React components in the `/react` directory and export them correctly
- How to register components as Store Framework blocks via `interfaces.json`
- How to expose component props in Site Editor via `contentSchemas.json`
- How to use VTEX Styleguide for admin UIs and css-handles for storefront styling

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Store Framework Blocks and Interfaces

In VTEX Store Framework, every visible element is a **block**. Blocks are declared in JSON theme files and map to React components via an **interface**. The `interfaces.json` file (in the `/store` directory) establishes this mapping:

```json
{
  "product-reviews": {
    "component": "ProductReviews",
    "allowed": ["product-review-item"],
    "composition": "children"
  }
}
```

- `component`: Name of the React component file in `/react` (without extension)
- `allowed`: Which child blocks can be nested inside this block
- `composition`: How children are composed — `"children"` (explicit), `"blocks"` (implicit)
- `render`: Rendering strategy — `"client"` (default), `"server"`, `"lazy"`

### Concept 2: React Directory Structure

The `/react` directory contains your React components. Each exported component must have a corresponding file at the root of `/react` that re-exports it:

```text
react/
├── ProductReviews.tsx          # Root export file (re-exports the component)
├── components/
│   ├── ProductReviews/
│   │   ├── index.tsx           # Actual component implementation
│   │   ├── ReviewItem.tsx
│   │   └── StarRating.tsx
│   └── shared/
│       └── LoadingSpinner.tsx
├── hooks/
│   └── useReviews.ts
├── typings/
│   └── vtex.d.ts
└── package.json
```

The root-level file (`react/ProductReviews.tsx`) is what the store builder resolves when it reads `"component": "ProductReviews"` from `interfaces.json`.

### Concept 3: Site Editor Integration

Site Editor allows store administrators to edit component properties through the VTEX Admin without touching code. To make your component editable, define a `contentSchemas.json` file in the `/store` directory:

```json
{
  "definitions": {
    "ProductReviews": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "title": "Section Title",
          "default": "Customer Reviews"
        },
        "showAverage": {
          "type": "boolean",
          "title": "Show average rating",
          "default": true
        },
        "maxReviews": {
          "type": "number",
          "title": "Maximum reviews to display",
          "default": 10,
          "enum": [5, 10, 20, 50]
        }
      }
    }
  }
}
```

These schemas use JSON Schema format and map directly to the component's props.

### Concept 4: CSS Handles and VTEX Styleguide

For **storefront** components, use `vtex.css-handles` to expose CSS class names that store theme developers can customize:

```typescript
import { useCssHandles } from 'vtex.css-handles'

const CSS_HANDLES = ['container', 'title', 'reviewList', 'reviewItem'] as const

function ProductReviews() {
  const handles = useCssHandles(CSS_HANDLES)
  return <div className={handles.container}>...</div>
}
```

For **admin** components, use [VTEX Styleguide](https://styleguide.vtex.com/) — the official component library for VTEX Admin UIs. It provides buttons, tables, modals, inputs, and other pre-built components that follow VTEX design standards.

**Architecture/Data Flow**:

```text
Store Theme (JSON blocks)
  └── declares "product-reviews" block with props
        │
        ▼
interfaces.json → maps "product-reviews" to "ProductReviews" component
        │
        ▼
react/ProductReviews.tsx → React component renders
        │
        ├── useCssHandles() → CSS classes for styling
        ├── useQuery() → GraphQL data fetching
        └── useProduct() / useOrderForm() → Store Framework context hooks
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Declare Interfaces for All Storefront Blocks

**Rule**: Every React component that should be usable as a Store Framework block MUST have a corresponding entry in `store/interfaces.json`. Without the interface declaration, the block cannot be referenced in theme JSON files.

**Why**: The store builder resolves block names to React components through `interfaces.json`. If a component exists in `/react` but has no interface, it is invisible to Store Framework. Theme developers cannot use it in their store configurations, and it will not render on the storefront.

**Detection**: If a React component in `/react` is intended for storefront use but has no matching entry in `store/interfaces.json`, warn the developer. The component will compile but never render.

✅ **CORRECT**:
```json
// store/interfaces.json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-item"]
  },
  "product-review-item": {
    "component": "ReviewItem"
  }
}
```

```tsx
// react/ProductReviews.tsx
import ProductReviews from './components/ProductReviews'

export default ProductReviews
```

❌ **WRONG**:
```tsx
// react/ProductReviews.tsx exists but NO store/interfaces.json entry
// The component compiles fine but cannot be used in any theme.
// Adding <product-reviews /> in a theme JSON will produce:
// "Block 'product-reviews' not found"
import ProductReviews from './components/ProductReviews'

export default ProductReviews
```

---

### Constraint: Use VTEX Styleguide for Admin UIs

**Rule**: Admin panel components (apps using the `admin` builder) MUST use VTEX Styleguide (`vtex.styleguide`) for UI elements. You MUST NOT use third-party UI libraries like Material UI (`@material-ui`), Chakra UI (`@chakra-ui/react`), or Ant Design (`antd`) in admin apps.

**Why**: VTEX Admin has a consistent design language enforced by Styleguide. Third-party UI libraries produce inconsistent visuals, may conflict with the Admin's global CSS, and add unnecessary bundle size. Apps submitted to the VTEX App Store with non-Styleguide admin UIs will fail review.

**Detection**: If you see imports from `@material-ui`, `@chakra-ui/react`, `@chakra-ui`, `antd`, or `@ant-design` in an admin app, warn the developer to use `vtex.styleguide` instead.

✅ **CORRECT**:
```tsx
// react/admin/ReviewModeration.tsx
import React, { useState } from 'react'
import {
  Layout,
  PageHeader,
  Table,
  Button,
  Tag,
  Modal,
  Input,
} from 'vtex.styleguide'

interface Review {
  id: string
  author: string
  rating: number
  text: string
  status: 'pending' | 'approved' | 'rejected'
}

function ReviewModeration() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const tableSchema = {
    properties: {
      author: { title: 'Author', width: 200 },
      rating: { title: 'Rating', width: 100 },
      text: { title: 'Review Text' },
      status: {
        title: 'Status',
        width: 150,
        cellRenderer: ({ cellData }: { cellData: string }) => (
          <Tag type={cellData === 'approved' ? 'success' : 'error'}>
            {cellData}
          </Tag>
        ),
      },
    },
  }

  return (
    <Layout fullWidth pageHeader={<PageHeader title="Review Moderation" />}>
      <Table
        items={reviews}
        schema={tableSchema}
        density="medium"
      />
    </Layout>
  )
}

export default ReviewModeration
```

❌ **WRONG**:
```tsx
// react/admin/ReviewModeration.tsx
import React from 'react'
import { DataGrid } from '@material-ui/data-grid'
import { Button } from '@material-ui/core'

// Material UI components will look inconsistent in the VTEX Admin,
// conflict with global styles, and inflate bundle size.
// This app will fail VTEX App Store review.
function ReviewModeration() {
  return (
    <div>
      <DataGrid rows={[]} columns={[]} />
      <Button variant="contained" color="primary">Approve</Button>
    </div>
  )
}
```

---

### Constraint: Export Components from react/ Root Level

**Rule**: Every Store Framework block component MUST have a root-level export file in the `/react` directory that matches the `component` value in `interfaces.json`. The actual implementation can live in subdirectories, but the root file must exist.

**Why**: The react builder resolves components by looking for files at the root of `/react`. If `interfaces.json` declares `"component": "ProductReviews"`, the builder looks for `react/ProductReviews.tsx` (or `.ts`, `.js`, `.jsx`). Without this root export file, the component will not be found and the block will fail to render.

**Detection**: If `interfaces.json` references a component name that does not have a matching file at the root of `/react`, STOP and create the export file.

✅ **CORRECT**:
```tsx
// react/ProductReviews.tsx — root-level export file
import ProductReviews from './components/ProductReviews/index'

export default ProductReviews
```

```tsx
// react/components/ProductReviews/index.tsx — actual implementation
import React from 'react'
import { useCssHandles } from 'vtex.css-handles'

const CSS_HANDLES = ['container', 'title', 'list'] as const

interface Props {
  title: string
  maxReviews: number
}

function ProductReviews({ title, maxReviews }: Props) {
  const handles = useCssHandles(CSS_HANDLES)
  return (
    <div className={handles.container}>
      <h2 className={handles.title}>{title}</h2>
      {/* ... */}
    </div>
  )
}

export default ProductReviews
```

❌ **WRONG**:
```tsx
// react/components/ProductReviews/index.tsx exists but
// react/ProductReviews.tsx does NOT exist.
// The builder cannot find the component.
// Error: "Could not find component ProductReviews"
```

## Implementation Pattern

**The canonical, recommended way to build a VTEX IO React storefront component.**

### Step 1: Create the React Component

Build your component inside a subdirectory for organization:

```tsx
// react/components/ProductReviews/index.tsx
import React, { useMemo } from 'react'
import { useQuery } from 'react-apollo'
import { useProduct } from 'vtex.product-context'
import { useCssHandles } from 'vtex.css-handles'

import GET_REVIEWS from '../../graphql/getReviews.graphql'
import ReviewItem from './ReviewItem'

const CSS_HANDLES = [
  'reviewsContainer',
  'reviewsTitle',
  'reviewsList',
  'averageRating',
  'emptyState',
] as const

interface Props {
  title?: string
  showAverage?: boolean
  maxReviews?: number
}

function ProductReviews({
  title = 'Customer Reviews',
  showAverage = true,
  maxReviews = 10,
}: Props) {
  const handles = useCssHandles(CSS_HANDLES)
  const productContext = useProduct()
  const productId = productContext?.product?.productId

  const { data, loading, error } = useQuery(GET_REVIEWS, {
    variables: { productId, limit: maxReviews },
    skip: !productId,
  })

  const averageRating = useMemo(() => {
    if (!data?.reviews?.length) return 0

    const sum = data.reviews.reduce(
      (acc: number, review: { rating: number }) => acc + review.rating,
      0
    )

    return (sum / data.reviews.length).toFixed(1)
  }, [data])

  if (loading) return <div className={handles.reviewsContainer}>Loading...</div>
  if (error) return null

  return (
    <div className={handles.reviewsContainer}>
      <h2 className={handles.reviewsTitle}>{title}</h2>

      {showAverage && data?.reviews?.length > 0 && (
        <div className={handles.averageRating}>
          Average: {averageRating} / 5
        </div>
      )}

      {data?.reviews?.length === 0 ? (
        <p className={handles.emptyState}>No reviews yet.</p>
      ) : (
        <ul className={handles.reviewsList}>
          {data.reviews.map((review: { id: string; author: string; rating: number; text: string }) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default ProductReviews
```

### Step 2: Create the Root Export File

```tsx
// react/ProductReviews.tsx
import ProductReviews from './components/ProductReviews'

export default ProductReviews
```

### Step 3: Define the Block Interface

```json
// store/interfaces.json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-form"],
    "render": "client"
  }
}
```

### Step 4: Add Site Editor Schema

```json
// store/contentSchemas.json
{
  "definitions": {
    "ProductReviews": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "title": "Section Title",
          "description": "Title displayed above the reviews list",
          "default": "Customer Reviews"
        },
        "showAverage": {
          "type": "boolean",
          "title": "Show average rating",
          "default": true
        },
        "maxReviews": {
          "type": "number",
          "title": "Maximum reviews",
          "default": 10,
          "enum": [5, 10, 20, 50]
        }
      }
    }
  }
}
```

### Complete Example

Using the component in a Store Framework theme:

```json
// store-theme blocks.json
{
  "store.product": {
    "children": [
      "product-images",
      "product-name",
      "product-price",
      "buy-button",
      "product-reviews"
    ]
  },
  "product-reviews": {
    "props": {
      "title": "What Our Customers Say",
      "showAverage": true,
      "maxReviews": 20
    }
  }
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Importing Third-Party UI Libraries for Admin Apps

**What happens**: Developers install `@material-ui/core`, `@chakra-ui/react`, or `antd` to build admin panels instead of using VTEX Styleguide.

**Why it fails**: Third-party UI libraries conflict with the VTEX Admin's global CSS, produce an inconsistent look and feel, significantly increase bundle size, and will cause the app to fail VTEX App Store review.

**Fix**: Use `vtex.styleguide` components. Declare the dependency in `manifest.json`:

```json
{
  "dependencies": {
    "vtex.styleguide": "9.x"
  }
}
```

Then import components directly:

```tsx
import { Button, Table, Modal, Input, Layout, PageHeader } from 'vtex.styleguide'
```

---

### Anti-Pattern: Directly Calling APIs from React Components

**What happens**: Developers use `fetch()` or `axios` inside React components to call VTEX Commerce APIs directly from the browser.

**Why it fails**: Browser-side API calls expose authentication tokens to the client, bypass CORS restrictions, and cannot use server-side caching. VTEX Commerce APIs require server-side authentication that is not available in the browser context.

**Fix**: Use GraphQL queries that resolve on the server side. Create a GraphQL schema in your app's `/graphql` directory with resolvers in `/node/resolvers` that use `ctx.clients` to access VTEX APIs:

```tsx
// Instead of fetch() in the component:
import { useQuery } from 'react-apollo'
import GET_REVIEWS from '../graphql/getReviews.graphql'

function ProductReviews() {
  const { data, loading } = useQuery(GET_REVIEWS, {
    variables: { productId: '123' },
  })
  // ...
}
```

---

### Anti-Pattern: Hardcoded Strings Without i18n

**What happens**: Developers hardcode user-facing strings in React components instead of using the `messages` builder for internationalization.

**Why it fails**: The component will only work in one language. VTEX stores are often multi-locale, and hardcoded strings cannot be translated by the platform's automatic translation system or overridden via Site Editor.

**Fix**: Use the `messages` builder and `react-intl`:

```tsx
import { useIntl } from 'react-intl'

function ProductReviews() {
  const intl = useIntl()
  const title = intl.formatMessage({ id: 'store/product-reviews.title' })
  return <h2>{title}</h2>
}
```

```json
// messages/en.json
{
  "store/product-reviews.title": "Customer Reviews"
}
// messages/pt.json
{
  "store/product-reviews.title": "Avaliações de Clientes"
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Developing Custom Storefront Components](https://developers.vtex.com/docs/guides/vtex-io-documentation-developing-custom-storefront-components) — Guide for building Store Framework components
- [Interfaces](https://developers.vtex.com/docs/guides/vtex-io-documentation-interface) — How interfaces map blocks to React components
- [React Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-react-builder) — React builder configuration and directory structure
- [Making a Custom Component Available in Site Editor](https://developers.vtex.com/docs/guides/vtex-io-documentation-making-a-custom-component-available-in-site-editor) — contentSchemas.json and Site Editor integration
- [Store Framework](https://developers.vtex.com/docs/guides/store-framework) — Overview of the block-based storefront system
- [Using Components](https://developers.vtex.com/docs/guides/store-framework-using-components) — How to use native and custom components in themes
- [VTEX Styleguide](https://styleguide.vtex.com/) — Official component library for VTEX Admin UIs

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
