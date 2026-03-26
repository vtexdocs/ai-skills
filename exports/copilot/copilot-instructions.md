# VTEX Development Skills

These instructions provide guidance for AI-assisted VTEX platform development.

# Well-Architected Commerce & Solution Architecture

# Well-Architected Commerce on VTEX

## When this skill applies

Use this skill when the task is **cross-cutting** or **decision-oriented** across VTEX commerce capabilities — not when a single product skill already fully defines the work.

- Defining or reviewing **solution architecture** (storefront model + integrations + operations).
- Choosing between **native VTEX capabilities** and **custom services** (IO apps, external BFFs, middleware).
- Running an **architecture or readiness review** (security baseline, scalability posture, observability, delivery process).
- **Scoping** work that will span FastStore, Headless, VTEX IO, Marketplace, Payments and/or any other VTEX module.

**Do not** use this skill as a substitute for product skills when the task is already localized (e.g. “implement PPP refunds” → payment track; “Feed v3 vs Hook” → marketplace track).

### Three pillars (foundation)

These pillars are the **lens** for every architecture choice. The **VTEX-specific extension rules** that follow translate them into concrete guidance for IO, Master Data, and native vs custom work—they **elaborate** the pillars; they do not replace them.

- **Technical Foundation** — Security, reliability, compliance, and integrity: protect data and transactions, build trustworthy infrastructure, plan for availability and recovery, and meet regulatory and audit expectations. _Nothing in Future-proof or Operational Excellence relaxes this pillar._

- **Future-proof** — Adaptability, **simplicity of the whole solution**, innovation in line with VTEX direction, and sustainable evolution: prefer composable, maintainable designs that can evolve with the platform—without duplicating what VTEX already provides or locking the account into unmaintainable custom sprawl.

- **Operational Excellence** — Accountability, data-informed decisions, and continuous improvement: clear ownership, metrics, and delivery discipline. Operations and customer tech teams should spend capacity on **customer outcomes** and **real differentiators**, not on running unnecessary custom layers that replicate platform commodities.

For the **full Well-Architected Commerce framework** (expanded pillar narrative and updates), use the **Well-Architected Commerce MCP** in your editor environment; this skill is the concise, validated instruction set aligned with that framework.

### VTEX-specific extension rules

_These rules **operationalize** **Future-proof** and **Operational Excellence** when you extend or store data on VTEX. They are **additional** to the pillar definitions above. **Hard constraints** later in this skill add enforceable stops (including IO and Master Data)._

1. **Native and OOTB before VTEX IO** — Prefer **native VTEX capabilities** (admin, native modules, standard APIs, documented OOTB flows) and **configuration** before authoring a **VTEX IO** extension. **Use VTEX IO only when** there is **no** suitable native or OOTB path. If you choose IO while a native option exists, record a **clear, explicit rationale** (why native was rejected, tradeoffs accepted). Defaulting to IO without that analysis is an architecture smell.

2. **Master Data (MD) with eyes open** — The team must **understand Master Data** (entity model, indexing, consistency, limits—see **Related skills** and **Reference**) before using it as storage. **Do not use MD as the default database for everything.** **Avoid MD on the purchase critical path** (synchronous dependency during cart, checkout, payment, or order placement) unless rigorously justified; prefer native commerce stores and async or peripheral MD for supporting data.

3. **Simplicity means native leverage, not “IO for everything”** — When something is **not** natively supported, ask: Is this a **key business differentiator** worth owning, or mainly an **operational/process gap**? **Do not use technical layers to compensate** for broken operations or the wrong operational model—fix process and ownership when that is the root cause.

4. **Let the platform carry commodities** — Push **commodity** behaviors onto **VTEX-native** mechanisms where possible so operations can focus on **fast, precise customer support** and tech teams on **capabilities that differentiate**, not on maintaining bespoke replicas of standard product behavior.

## Decision rules

1. **Classify every major decision** under one or more **pillars** (see **Three pillars (foundation)**). If a choice does not map to any pillar, question whether it is necessary.
2. **When extending the platform** (VTEX IO, Master Data entities, new integrations, or bespoke services), apply the **VTEX-specific extension rules** above and record how each choice supports **Future-proof** and/or **Operational Excellence** without weakening **Technical Foundation**.
3. **Prefer fewer integration hops** where custom code remains necessary: each hop adds failure modes and operational load. Additional services or backends are valid when they **isolate failure domains** or **clear team boundaries**, not by default.
4. **After architecture choices are clear**, assign execution to **product track skills** (see Related skills). This skill sets direction; product skills enforce VTEX-specific contracts.
5. **Operational discipline** requires definable **metrics and ownership** (who runs it, how incidents are detected, how changes are released). Undocumented “best effort” operations violate **Operational Excellence** even if the design is lean.

## Hard constraints

### Constraint: Do not bypass Technical Foundation for speed

Security, credential handling, PCI scope, and private API access **must** follow VTEX and industry baselines. Architectural shortcuts that expose secrets, widen PCI scope, or call private APIs from untrusted clients are **never** acceptable tradeoffs for velocity.

**Why this matters** — Data breaches, fraud, and account compromise destroy customer trust and can invalidate compliance posture for the whole program.

**Detection** — If the design places `VTEX_APP_KEY`/`VTEX_APP_TOKEN`, raw card data, or shopper session tokens in browser code, public repos, or logs → **stop** and redesign using product skills (e.g. headless BFF, payment Secure Proxy).

**Correct** — Classify data and APIs; keep secrets and private calls server-side; reference PCI and authentication guides for the chosen integration style.

```text
Architecture decision log:
- Private VTEX APIs → server-side only (BFF or IO service).
- Card data → Payment Provider Protocol / Secure Proxy patterns only.
```

**Wrong** — “We will call Checkout OMS from the SPA for speed” or “store app token in NEXT_PUBLIC for dev convenience.”

### Constraint: Future-proof means justified complexity, not maximal decomposition

Every new service, queue, or datastore must have a **stated owner**, **failure mode**, and **reason** tied to a pillar (e.g. isolation, scale, regulatory boundary). Unbounded service proliferation violates the **Simplicity** core value.

**Why this matters** — Undocumented distributed systems become impossible to operate, debug, or upgrade; they increase cost and incident duration.

**Detection** — If a diagram adds a new box “for flexibility” without a pillar mapping → challenge it. If two services could be one VTEX IO app with clear modules → merge or defer.

**Correct** — Document: “Service X owns partner webhook translation; Technical Foundation: audit log; Future-proof: replaceable adapter; Ops: on-call rotation Z.”

```text
Before adding a service:
1. Which pillar(s) require it?
2. What fails if it is absent?
3. Can native/OOTB, existing BFF, or a minimal IO surface cover it?
```

**Wrong** — “Microservices architecture” as a default with no operational model or without VTEX integration constraints from product skills.

### Constraint: VTEX IO extension requires exhausted native/OOTB options

Choosing **VTEX IO** to implement a capability that **already exists** natively or OOTB (or could be met with configuration and standard integrations) **without** a documented exception rationale creates long-term cost, upgrade risk, and operational debt.

**Why this matters** — Duplicate implementations drift from platform evolution, break on upgrades, and consume engineering that should go to differentiation.

**Detection** — Proposal leads with “we will build an IO app for X” before listing **native/OOTB alternatives** considered. No written “why not native” when a Help Center or Developers guide describes a standard path.

**Correct** — Decision log entry: native/OOTB options evaluated → rejected because [specific gap] → IO scope minimized to that gap only.

```text
Native/OOTB check before IO:
1. What does VTEX ship for this (admin, module, API, partner app)?
2. If still building IO: what exactly cannot be done natively?
```

**Wrong** — “We always customize via IO” or “IO is simpler than learning native features” without evidence that native cannot meet the requirement.

### Constraint: Master Data is not a general-purpose or checkout-critical datastore

Using **Master Data** without understanding its **storage model, limits, and consistency**—or using it as the **default** store for all custom data, or on the **purchase critical path**—risks latency, reliability, and support issues at scale.

**Why this matters** — MD is optimized for documented entity patterns, not arbitrary OLTP in the middle of checkout; misuse impacts revenue and stability.

**Detection** — Synchronous order flow calls MD on every cart mutation; “put all custom fields in MD” with no schema discipline; MD chosen before catalog, profile, or OMS-native options are evaluated.

**Correct** — Team reads MD architecture guidance; entities scoped to justified use cases; **off critical path** or async patterns for non-essential MD access during purchase; heavy logic delegated to native systems where possible.

```text
Before MD for new data:
1. Can Catalog, Checkout, Profile, or another native store hold this?
2. Is access in the hot path of purchase? If yes, redesign or justify.
```

**Wrong** — “MD for everything” or blocking checkout on MD round-trips under peak load without hard performance proof.

## Preferred pattern

1. **Align the team** on the **three pillars (foundation)** in-session; use the **Well-Architected Commerce MCP** when you need expanded framework wording or the latest narrative.
2. **Run the VTEX-specific extension rules** for each capability: list native/OOTB options first; only then scope IO, MD, or external build—and capture “why not native” when IO is chosen.
3. **Separate differentiator from ops gap**: for each custom build, label **strategic differentiator** vs **process/operational fix**; if the latter, prefer process or native tooling before code.
4. **Produce a short decision log**: pillars addressed, native vs IO vs MD choices, “why not native” where applicable, open risks.
5. **Attach** the relevant **product track** guidance for each implementation stream (storefront, payments, IO, marketplace).
6. **Revisit** Operational Excellence: commodities on platform, team focus on support and differentiators, plus metrics, release process, and incident response **before** go-live.

## Common failure modes

- **Meta-skill overuse** — Spending architecture narrative on problems already fully specified by a product skill (e.g. PPP idempotency rules).
- **Pillar theater** — Labeling slides with three pillars without changing concrete decisions or ownership.
- **IO-default bias** — Reaching for VTEX IO before proving native/OOTB cannot satisfy the requirement; treating customization as the first step.
- **MD-as-Postgres** — Using Master Data for every entity without modeling, or coupling checkout to synchronous MD reads/writes.
- **Simplicity misunderstood** — Interpreting “simple architecture” as “one big IO app that does everything” instead of “minimum custom surface, maximum native leverage.”
- **Tech over process** — Automating or coding around broken operational workflows instead of fixing ownership, SLAs, or training.
- **Commodity customization** — Customer tech teams maintaining bespoke implementations of behaviors VTEX already provides as standard product, starving real differentiators.
- **Missing handoff** — Architecture doc with no pointers to **which** product skills and **which** official VTEX guides developers must follow.

## Review checklist

- [ ] Are **Technical Foundation** concerns (auth, secrets, PCI scope, private APIs) explicitly addressed?
- [ ] For each **VTEX IO** extension: was **native/OOTB** evaluated first, and is there a **written “why not native”** when IO was chosen?
- [ ] For **Master Data** use: does the team understand MD architecture (see Reference), and is MD **off the purchase critical path** unless strongly justified?
- [ ] Is each custom component labeled **differentiator** vs **operational/process gap**, and are process fixes considered before new code?
- [ ] Does **Future-proof** hold: each new service, queue, or datastore has **owner**, **failure mode**, and **pillar-based reason**; no unmotivated sprawl?
- [ ] Are **integration hops** minimized; are extra services justified by failure isolation or team boundaries?
- [ ] Does **Operational Excellence** show **commodities on the platform**, clear focus for support and differentiators, plus **metrics**, **monitoring**, and **release/incident ownership**?
- [ ] Has every implementation stream been mapped to a **product track skill**?
- [ ] Are official **VTEX docs** linked for areas that have platform-specific constraints?

## Related skills

- [vtex-io-app-structure](../../../vtex-io/skills/vtex-io-app-structure/skill.md) — IO manifest, builders, policies (use only after native/OOTB path is ruled out).
- [vtex-io-masterdata](../../../vtex-io/skills/vtex-io-masterdata/skill.md) — Master Data v2 schemas, limits, and when MD is appropriate.
- [headless-bff-architecture](../../../headless/skills/headless-bff-architecture/skill.md) — BFF and credential boundaries for headless.
- [payment-pci-security](../../../payment/skills/payment-pci-security/skill.md) — PCI and Secure Proxy constraints.
- [faststore-data-fetching](../../../faststore/skills/faststore-data-fetching/skill.md) — GraphQL extensions and data layer.
- [marketplace-order-hook](../../../marketplace/skills/marketplace-order-hook/skill.md) — Marketplace order integration patterns.

## Reference

- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — Storefront integration models and platform boundaries
- [Engineering best practices](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices aligned with Technical Foundation
- [Working with JSON Schemas in Master Data v2](https://developers.vtex.com/docs/guides/working-with-json-schemas-in-master-data-v2) — MD storage model and schema behavior before choosing MD
- [Best practices for avoiding rate limit errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Reliable integration with VTEX APIs
- [PCI DSS compliance in VTEX](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance) — Payment security baseline
- [Best practices for using application keys](https://help.vtex.com/en/docs/tutorials/best-practices-api-keys) — API key hygiene and trust

---

# FastStore Implementation & Customization

# FastStore Data Layer & API Integration

## When this skill applies

Use this skill when:

- You need to fetch product data, extend existing queries with additional fields, or integrate third-party APIs.
- You need data beyond what native FastStore components display by default.
- You are creating API extensions in `src/graphql/vtex/` or `src/graphql/thirdParty/`.
- You are adding GraphQL fragments in `src/fragments/` to include new fields in predefined queries.
- You are writing server-side resolvers that call VTEX REST APIs or external services.

Do not use this skill for:

- Client-side state management (cart, session, search) — use the `faststore-state-management` skill.
- Visual theming — use the `faststore-theming` skill.
- Component replacement or props overriding — use the `faststore-overrides` skill.

## Decision rules

- Use the FastStore GraphQL API for all catalog data (products, collections, search results, prices) — never make direct REST calls from client-side code.
- Use VTEX API extensions (`src/graphql/vtex/`) when accessing VTEX platform data not exposed by default (e.g., custom product fields, installment details).
- Use third-party API extensions (`src/graphql/thirdParty/`) when integrating external data sources (e.g., reviews, ratings, external inventory).
- Use server fragments (`src/fragments/ServerProduct.ts`) for data needed at page load (SSR).
- Use client fragments (`src/fragments/ClientProduct.ts`) for data that can load after initial render.
- Keep API keys and secrets in server-side resolvers only — never in client-side code or `NEXT_PUBLIC_` environment variables.
- Do not create custom Next.js API routes (`pages/api/`) — use the API extension system instead.

## Hard constraints

### Constraint: Use the GraphQL Layer for Catalog Data

MUST use the FastStore GraphQL API for fetching catalog data (products, collections, search results, prices). MUST NOT make direct REST calls to VTEX Catalog APIs (`/api/catalog/`, `/api/catalog_system/`) from client-side code.

**Why this matters**
The FastStore API handles authentication, caching, request batching, and data normalization. Direct REST calls bypass all of these optimizations and expose your VTEX domain structure to the browser. They also create CORS issues, duplicate data fetching logic, and miss the type safety that GraphQL provides. Server-side REST calls to VTEX APIs are acceptable in GraphQL resolvers — that's exactly what API extensions are for.

**Detection**
If you see `fetch('https://{account}.vtexcommercestable.com.br/api/catalog')` or `fetch('https://{account}.myvtex.com/api/catalog')` in client-side code (components, hooks, useEffect) → warn that this bypasses the GraphQL layer. If it's in a file under `src/graphql/` resolvers → this is acceptable (that's the API extension pattern). If you see `axios` or `fetch` with VTEX API paths in any file under `src/components/` or `src/pages/` → STOP and refactor to use the GraphQL API.

**Correct**

```typescript
// src/graphql/vtex/resolvers/product.ts
// Server-side resolver — REST calls to VTEX APIs are correct here
import type { Resolver } from "@faststore/api";

const productResolver: Record<string, Resolver> = {
  StoreProduct: {
    customAttribute: async (root, _args, context) => {
      // Server-side: safe to call VTEX REST APIs in resolvers
      const response = await context.clients.commerce.catalog.getProduct(
        root.productID,
      );
      return response.customAttribute;
    },
  },
};

export default productResolver;
```

**Wrong**

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

MUST NOT include VTEX API keys (`VTEX_APP_KEY`, `VTEX_APP_TOKEN`) or any secret credentials in client-side code, environment variables prefixed with `NEXT_PUBLIC_`, or any file that gets bundled into the browser.

**Why this matters**
API keys in client-side code are visible to anyone who inspects the page source or network requests. VTEX API keys provide access to catalog management, order processing, and account administration. Exposed keys can be used to modify products, access customer data, or disrupt store operations. This is a critical security vulnerability.

**Detection**
If you see `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `X-VTEX-API-AppKey`, or `X-VTEX-API-AppToken` in any file under `src/components/`, `src/pages/`, or any file that runs in the browser → STOP immediately. This is a critical security issue. If you see `NEXT_PUBLIC_VTEX_APP_KEY` or `NEXT_PUBLIC_VTEX_APP_TOKEN` in `.env` files → STOP immediately. The `NEXT_PUBLIC_` prefix makes these values available in the browser bundle.

**Correct**

```typescript
// src/graphql/vtex/resolvers/installments.ts
// API keys are used ONLY in server-side resolvers, accessed via context
import type { Resolver } from "@faststore/api";

const installmentResolver: Record<string, Resolver> = {
  StoreProduct: {
    availableInstallments: async (root, _args, context) => {
      // context.clients handles authentication automatically
      // No API keys are hardcoded or exposed
      const product = await context.clients.commerce.catalog.getProduct(
        root.productID,
      );

      const installments =
        product.items?.[0]?.sellers?.[0]?.commertialOffer?.Installments || [];

      return installments.map((inst: any) => ({
        count: inst.NumberOfInstallments,
        value: inst.Value,
        totalValue: inst.TotalValuePlusInterestRate,
        interestRate: inst.InterestRate,
      }));
    },
  },
};

export default installmentResolver;
```

**Wrong**

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

MUST place API extension files in the correct directory structure: `src/graphql/vtex/` for VTEX API extensions and `src/graphql/thirdParty/` for third-party API extensions. Each must contain `typeDefs/` and `resolvers/` subdirectories.

**Why this matters**
FastStore's build system discovers and compiles API extensions from these specific directories. Files placed elsewhere will not be included in the GraphQL schema and resolvers will not execute. There will be no error at build time — the extended fields simply won't exist, causing runtime GraphQL errors when components try to query them.

**Detection**
If you see GraphQL type definitions (`.graphql` files) or resolver files outside of `src/graphql/vtex/` or `src/graphql/thirdParty/` → warn that they will not be discovered by the build system. If the `typeDefs/` or `resolvers/` subdirectory is missing → warn about incorrect structure.

**Correct**

```graphql
# src/graphql/vtex/typeDefs/product.graphql
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
import type { Resolver } from "@faststore/api";

const productResolver: Record<string, Resolver> = {
  StoreProduct: {
    availableInstallments: async (root, _args, context) => {
      const product = await context.clients.commerce.catalog.getProduct(
        root.productID,
      );
      const installments =
        product.items?.[0]?.sellers?.[0]?.commertialOffer?.Installments || [];

      return installments.map((inst: any) => ({
        count: inst.NumberOfInstallments,
        value: inst.Value,
        totalValue: inst.TotalValuePlusInterestRate,
        interestRate: inst.InterestRate,
      }));
    },
  },
};

export default productResolver;
```

```typescript
// src/graphql/vtex/resolvers/index.ts
import { default as StoreProductResolver } from "./product";

const resolvers = {
  ...StoreProductResolver,
};

export default resolvers;
```

**Wrong**

```typescript
// WRONG: Resolver placed in src/api/ instead of src/graphql/vtex/resolvers/
// src/api/resolvers/product.ts
// This file will NOT be discovered by FastStore's build system.
// The GraphQL schema will NOT include the extended fields.
// Components querying these fields will get runtime errors.

const productResolver = {
  StoreProduct: {
    availableInstallments: async (root: any) => {
      return [];
    },
  },
};

export default productResolver;
```

## Preferred pattern

Recommended file layout for API extensions:

```text
src/
├── graphql/
│   ├── vtex/
│   │   ├── typeDefs/
│   │   │   └── product.graphql
│   │   └── resolvers/
│   │       ├── product.ts
│   │       └── index.ts
│   └── thirdParty/
│       ├── typeDefs/
│       │   └── extra.graphql
│       └── resolvers/
│           ├── reviews.ts
│           └── index.ts
└── fragments/
    ├── ServerProduct.ts    ← server-side fragment (SSR)
    └── ClientProduct.ts    ← client-side fragment (post-render)
```

Minimal API extension — add a field to `StoreProduct`:

```graphql
# src/graphql/vtex/typeDefs/product.graphql
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
// src/graphql/vtex/resolvers/product.ts
import type { Resolver } from "@faststore/api";

const productResolver: Record<string, Resolver> = {
  StoreProduct: {
    availableInstallments: async (root, _args, context) => {
      const product = await context.clients.commerce.catalog.getProduct(
        root.productID,
      );
      const installments =
        product.items?.[0]?.sellers?.[0]?.commertialOffer?.Installments || [];

      return installments.map((inst: any) => ({
        count: inst.NumberOfInstallments,
        value: inst.Value,
        totalValue: inst.TotalValuePlusInterestRate,
        interestRate: inst.InterestRate,
      }));
    },
  },
};

export default productResolver;
```

Include the new field in queries via fragments:

```typescript
// src/fragments/ServerProduct.ts
import { gql } from "@faststore/core/api";

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
`);
```

Third-party API extension (e.g., product reviews):

```typescript
// src/graphql/thirdParty/resolvers/reviews.ts
import type { Resolver } from "@faststore/api";

const REVIEWS_API_KEY = process.env.REVIEWS_API_KEY; // Server-only env var (no NEXT_PUBLIC_ prefix)

const reviewsResolver: Record<string, Resolver> = {
  StoreProduct: {
    reviews: async (root) => {
      const response = await fetch(
        `https://api.reviews-service.com/products/${root.productID}/reviews`,
        {
          headers: {
            Authorization: `Bearer ${REVIEWS_API_KEY}`,
          },
        },
      );
      const data = await response.json();
      return {
        averageRating: data.average_rating,
        totalReviews: data.total_count,
        reviews: data.reviews.slice(0, 5).map((r: any) => ({
          author: r.author_name,
          rating: r.rating,
          text: r.review_text,
          date: r.created_at,
        })),
      };
    },
  },
};

export default reviewsResolver;
```

## Common failure modes

- Making direct REST calls to VTEX Catalog APIs from React components — creates CORS issues, bypasses caching, and exposes VTEX account structure to the browser.
- Exposing API keys (`VTEX_APP_KEY`, `VTEX_APP_TOKEN`) in client-side code or `NEXT_PUBLIC_` environment variables — critical security vulnerability.
- Placing resolvers or type definitions outside `src/graphql/vtex/` or `src/graphql/thirdParty/` — they will not be discovered by the build system.
- Creating custom Next.js API routes (`pages/api/`) instead of using the API extension system — bypasses caching, type safety, and request batching.
- Forgetting to create the resolver index file (`src/graphql/vtex/resolvers/index.ts`) that re-exports all resolvers.

## Review checklist

- [ ] Is all catalog data fetched via the FastStore GraphQL API (not direct REST calls from components)?
- [ ] Are API extension files in `src/graphql/vtex/` or `src/graphql/thirdParty/` with proper `typeDefs/` and `resolvers/` subdirectories?
- [ ] Does the resolver index file re-export all resolvers?
- [ ] Are API keys and secrets used only in server-side resolvers (no `NEXT_PUBLIC_` prefix)?
- [ ] Are fragments created in `src/fragments/` to include new fields in predefined queries?
- [ ] Are there no custom Next.js API routes that could be replaced with API extensions?

## Reference

- [FastStore API overview](https://developers.vtex.com/docs/guides/faststore/faststore-api-overview) — Introduction to the GraphQL API and its capabilities
- [API extensions overview](https://developers.vtex.com/docs/guides/faststore/api-extensions-overview) — Guide to extending the FastStore API with custom data
- [Extending VTEX API schemas](https://developers.vtex.com/docs/guides/faststore/api-extensions-extending-api-schema) — Step-by-step for adding VTEX platform data to the GraphQL schema
- [Extending third-party API schemas](https://developers.vtex.com/docs/guides/faststore/api-extensions-extending-api-schema#extending-faststore-api-with-third-party-api-schemas) — Integrating external data sources
- [Extending queries using fragments](https://developers.vtex.com/docs/guides/faststore/api-extensions-extending-queries-using-fragments) — How to add fields to predefined queries using fragments
- [Consuming API extensions with custom components](https://developers.vtex.com/docs/guides/faststore/api-extensions-consuming-api-extensions) — Using extended data in React components
- [GraphQL schema objects](https://developers.vtex.com/docs/guides/faststore/schema-objects) — Reference for all native GraphQL types (StoreProduct, StoreOffer, etc.)
- [GraphQL queries reference](https://developers.vtex.com/docs/guides/faststore/schema-queries) — All predefined queries available in the FastStore API
- [API extension troubleshooting](https://developers.vtex.com/docs/guides/faststore/api-extensions-troubleshooting) — Common issues with API extensions and their solutions
- [`faststore-state-management`](../faststore-state-management/skill.md) — Related skill for client-side state management with SDK hooks

---

# FastStore Section & Component Overrides

## When this skill applies

Use this skill when:
- You need to customize the behavior or appearance of a FastStore storefront component beyond what theming and design tokens can achieve.
- You need to replace a native component entirely with a custom implementation.
- You need to inject custom logic or modify props on native components within a section.
- You are working with files in `src/components/overrides/`.

Do not use this skill for:
- Visual-only changes (colors, typography, spacing) — use the `faststore-theming` skill and design tokens instead.
- Building custom state management for cart, session, or search — use the `faststore-state-management` skill.
- Extending the GraphQL data layer — use the `faststore-data-fetching` skill.

## Decision rules

- Use overrides when theming alone cannot achieve the desired change (e.g., replacing a component, adding logic, changing behavior).
- Use the `components` map with `{ Component: CustomComponent }` when replacing a native component entirely.
- Use the `components` map with `{ props: { ... } }` when only changing props on a native component without replacing it.
- Use the `className` option on `getOverriddenSection()` for wrapper-level styling alongside behavioral changes.
- Prefer theming with design tokens for purely visual changes — overrides are heavier and more tightly coupled.
- Only override components listed as overridable in the FastStore native sections documentation. Undocumented component names are silently ignored.
- Components prefixed with `__experimental` can be overridden but their props are not accessible and may change without notice.

## Hard constraints

### Constraint: Use the Override API — Never Modify FastStore Core

MUST use `getOverriddenSection()` from `@faststore/core` to customize sections. MUST NOT directly modify files in `node_modules/@faststore/` or import internal source files.

**Why this matters**
Modifying `node_modules` is ephemeral (changes are lost on `npm install`) and importing from internal paths like `@faststore/core/src/` creates tight coupling to implementation details that can break on any FastStore update.

**Detection**
If you see imports from `@faststore/core/src/` (internal source paths) → STOP. These are private implementation details. Only import from the public API: `@faststore/core` and `@faststore/core/experimental`. If you see direct file edits in `node_modules/@faststore/` → STOP immediately and use the override system instead.

**Correct**
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

**Wrong**
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

MUST place override files in the `src/components/overrides/` directory, named after the section being overridden (e.g., `ProductDetails.tsx`).

**Why this matters**
FastStore's build system scans `src/components/overrides/` to discover and apply section overrides. Files placed elsewhere will not be detected and the override will silently fail — the native section will render instead with no error message.

**Detection**
If you see override-related code (calls to `getOverriddenSection`) in files outside `src/components/overrides/` → warn that the override will not be applied. Check that the filename matches a valid native section name from the FastStore section list.

**Correct**
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

**Wrong**
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

MUST only override components listed as overridable in the FastStore native sections documentation. Components prefixed with `__experimental` can be overridden but their props are not accessible.

**Why this matters**
Attempting to override a component not listed as overridable will silently fail. The override configuration will be ignored and the native component will render. Components marked `__experimental` have unstable prop interfaces that may change without notice.

**Detection**
If you see a component name in the `components` override map that does not appear in the FastStore list of overridable components for that section → warn that this override may not work. If the component is prefixed with `__experimental` → warn about inaccessible props and instability.

**Correct**
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

**Wrong**
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

## Preferred pattern

Recommended file layout:

```text
src/
├── components/
│   ├── overrides/
│   │   ├── ProductDetails.tsx    ← override file (named after section)
│   │   ├── Alert.tsx
│   │   └── simple-alert.module.scss
│   ├── CustomBuyButton.tsx       ← custom component
│   └── BoldIcon.tsx
```

Minimal override — replace a component:

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

Override props without replacing the component:

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

Override with custom styling:

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

## Common failure modes

- Monkey-patching `node_modules/@faststore/` or using `patch-package` for changes the override system supports. Changes are lost on install and create maintenance burden.
- Using CSS `!important` to force visual changes instead of the override API for behavioral changes or design tokens for visual changes.
- Creating wrapper components around native sections instead of using `getOverriddenSection()`. Wrappers bypass CMS integration, analytics tracking, and section discovery.
- Placing override files outside `src/components/overrides/` — they will be silently ignored.
- Overriding a component name not listed in the FastStore overridable components documentation — the override is silently ignored.

## Review checklist

- [ ] Is the override file located in `src/components/overrides/` and named after the target section?
- [ ] Does the file use `getOverriddenSection()` from `@faststore/core`?
- [ ] Are all overridden component names documented as overridable for that section?
- [ ] Are imports only from `@faststore/core` or `@faststore/core/experimental` (not internal source paths)?
- [ ] Could this change be achieved with design tokens instead of an override?
- [ ] Does the override export as default?

## Reference

- [Overrides overview](https://developers.vtex.com/docs/guides/faststore/overrides-overview) — Introduction to the FastStore override system and when to use it
- [getOverriddenSection function](https://developers.vtex.com/docs/guides/faststore/overrides-getoverriddensection-function) — API reference for the core override function
- [Override native components and props](https://developers.vtex.com/docs/guides/faststore/overrides-components-and-props-v1) — Step-by-step guide for overriding component props
- [Override a native component](https://developers.vtex.com/docs/guides/faststore/overrides-native-component) — Guide for replacing a native component entirely
- [List of native sections and overridable components](https://developers.vtex.com/docs/guides/faststore/building-sections-list-of-native-sections) — Complete reference of which components can be overridden per section
- [Creating a new section](https://developers.vtex.com/docs/guides/faststore/building-sections-creating-a-new-section) — Guide for creating custom sections when overrides are insufficient
- [Troubleshooting overrides](https://developers.vtex.com/docs/troubleshooting/my-store-does-not-reflect-the-overrides-i-created) — Common issues and solutions when overrides don't work
- [`faststore-theming`](../faststore-theming/skill.md) — Related skill for visual customizations that don't require overrides

---

# FastStore SDK State Management

## When this skill applies

Use this skill when:
- You are building any interactive ecommerce feature that involves the shopping cart, user session, product search/filtering, or analytics tracking.
- You need to add, remove, or update cart items.
- You need to read or change session data (currency, locale, sales channel, postal code).
- You need to manage faceted search state (sort order, selected facets, pagination).
- You are working with `@faststore/sdk` hooks (`useCart`, `useSession`, `useSearch`).

Do not use this skill for:
- Visual-only changes — use the `faststore-theming` skill.
- Replacing or customizing native components — use the `faststore-overrides` skill.
- Extending the GraphQL schema or fetching custom data — use the `faststore-data-fetching` skill.

## Decision rules

- Use `useCart()` for all cart operations — it handles platform validation, price verification, and analytics automatically.
- Use `useSession()` for all session data — it triggers `validateSession` mutations that keep the platform synchronized.
- Use `useSearch()` within `SearchProvider` for all search state — it synchronizes with URL parameters and supports browser back-button navigation.
- Do not build custom state management (React Context, Redux, Zustand, `useState`/`useReducer`) for cart, session, or search. The SDK hooks are wired into the FastStore platform integration layer.
- Always check `isValidating` from `useCart()` and block checkout navigation during validation.
- Use `sendAnalyticsEvent()` from the SDK for GA4-compatible ecommerce event tracking.

## Hard constraints

### Constraint: Use @faststore/sdk for Cart, Session, and Search State

MUST use `@faststore/sdk` hooks (`useCart`, `useSession`, `useSearch`) for managing cart, session, and search state. MUST NOT build custom state management (React Context, Redux, Zustand, useState/useReducer) for these domains.

**Why this matters**
The SDK hooks are wired into the FastStore platform integration layer. `useCart()` triggers cart validation mutations. `useSession()` propagates locale/currency changes to all data queries. `useSearch()` synchronizes with URL parameters and triggers search re-fetches. Custom state bypasses all of this — carts won't be validated, prices may be stale, search won't sync with URLs, and analytics events won't fire.

**Detection**
If you see `useState` or `useReducer` managing cart items, cart totals, session locale, session currency, or search facets → STOP. These should use `useCart()`, `useSession()`, or `useSearch()` from `@faststore/sdk`. If you see `createContext` with names like `CartContext`, `SessionContext`, or `SearchContext` → STOP. The SDK already provides these contexts.

**Correct**
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

**Wrong**
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

MUST check the `isValidating` flag from `useCart()` and show appropriate loading states during cart validation. MUST NOT allow checkout navigation while `isValidating` is `true`.

**Why this matters**
Cart validation is an asynchronous operation that checks items against the VTEX platform for current prices, availability, and applicable promotions. If a user proceeds to checkout during validation, they may see stale prices or encounter errors. The `isValidating` flag exists to prevent this.

**Detection**
If you see `useCart()` destructured without `isValidating` in components that have checkout links or "Proceed to Checkout" buttons → warn that the validation state is not being handled. If you see a checkout link or button that does not check `isValidating` before navigating → warn about potential stale cart data.

**Correct**
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

**Wrong**
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

MUST use `useSession()` from `@faststore/sdk` for accessing session data (currency, locale, channel, person). MUST NOT read/write session data directly to `localStorage` or `sessionStorage`.

**Why this matters**
The SDK's session module manages synchronization with the VTEX platform. When session data changes, the SDK triggers a `validateSession` mutation that updates the server-side session and re-validates the cart. Writing directly to `localStorage` bypasses this validation — the platform won't know about the change, prices may display in the wrong currency, and cart items may not reflect the correct sales channel.

**Detection**
If you see `localStorage.getItem` or `localStorage.setItem` with keys related to session data (currency, locale, channel, region, postalCode) → STOP. These should be managed through `useSession()`. If you see `sessionStorage` used for the same purpose → STOP.

**Correct**
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

**Wrong**
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

## Preferred pattern

Recommended usage of SDK hooks together:

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
            <span data-fs-cart-item-name>{item.itemOffered.name}</span>
            <span data-fs-cart-item-price>{formatter.format(item.price)}</span>
            <div data-fs-cart-item-quantity>
              <Button
                variant="tertiary"
                onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                disabled={item.quantity <= 1}
              >
                -
              </Button>
              <span>{item.quantity}</span>
              <Button
                variant="tertiary"
                onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
              >
                +
              </Button>
            </div>
            <Button variant="tertiary" onClick={() => removeItem(item.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <div data-fs-cart-summary>
        <span>Subtotal: {formatter.format(subtotal)}</span>
        <a
          href="/checkout"
          data-fs-checkout-button
          aria-disabled={isValidating}
          onClick={(e) => {
            if (isValidating) e.preventDefault()
          }}
        >
          {isValidating ? 'Updating cart...' : 'Proceed to Checkout'}
        </a>
      </div>
    </div>
  )
}
```

Search state with `useSearch()`:

```typescript
// src/components/FacetFilter.tsx
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

## Common failure modes

- Creating a custom React Context for cart state (`CartContext`, `useReducer`) — disconnects from VTEX platform validation, analytics, and checkout.
- Storing session data (locale, currency, postal code) in `localStorage` — the SDK's `validateSession` mutation never fires, so the platform is out of sync.
- Building custom search state with `useState` — loses URL synchronization, breaks back-button navigation, and bypasses the SDK's optimized query generation.
- Ignoring the `isValidating` flag from `useCart()` — users can proceed to checkout with stale prices or out-of-stock items.
- Using `useCart_unstable` or `useSession_unstable` hooks without understanding they have unstable interfaces that may change.

## Review checklist

- [ ] Is cart state managed exclusively via `useCart()` from `@faststore/sdk`?
- [ ] Is session data accessed exclusively via `useSession()` from `@faststore/sdk`?
- [ ] Is search state managed via `useSearch()` within a `SearchProvider` context?
- [ ] Is the `isValidating` flag checked before allowing checkout navigation?
- [ ] Is there no custom React Context, Redux, or Zustand store duplicating SDK state?
- [ ] Is there no direct `localStorage`/`sessionStorage` access for session-related data?

## Reference

- [FastStore SDK overview](https://developers.vtex.com/docs/guides/faststore/sdk-overview) — Introduction to the SDK modules and their responsibilities
- [useCart hook](https://developers.vtex.com/docs/guides/faststore/sdk-use-cart) — API reference for the cart hook with all properties and functions
- [Cart module overview](https://developers.vtex.com/docs/guides/faststore/cart-overview) — Cart data structure, validation, and platform integration
- [Session module](https://developers.vtex.com/docs/guides/faststore/sdk-session) — Session data structure, currency, locale, and channel management
- [useSearch hook](https://developers.vtex.com/docs/guides/faststore/sdk-use-search) — API reference for the search hook with sorting, facets, and pagination
- [SearchProvider](https://developers.vtex.com/docs/guides/faststore/search-search-provider) — Context provider required for useSearch to function
- [Analytics module](https://developers.vtex.com/docs/guides/faststore/sdk-analytics) — GA4-compatible analytics event tracking
- [Experimental hooks and components](https://developers.vtex.com/docs/guides/faststore/sdk-experimental-exports) — Unstable hooks for advanced use cases (useCart_unstable, useSession_unstable)
- [`faststore-data-fetching`](../faststore-data-fetching/skill.md) — Related skill for fetching product data via the GraphQL API

---

# FastStore Theming & Design Tokens

## When this skill applies

Use this skill when:
- You need to change the visual appearance of a FastStore storefront — colors, typography, spacing, borders, or component-specific styles.
- You are working with files in `src/themes/` or creating `custom-theme.scss`.
- You need to customize individual component styles using local tokens and `[data-fs-*]` data attributes.
- You are setting up a brand identity on top of the Brandless default theme.

Do not use this skill for:
- Changes that require replacing a component, injecting logic, or modifying behavior — use the `faststore-overrides` skill.
- Client-side state management — use the `faststore-state-management` skill.
- Data fetching or API extensions — use the `faststore-data-fetching` skill.

## Decision rules

- Use theming as the first approach before considering overrides — it is lighter and more maintainable.
- Use global tokens (`:root` scope) when the change should propagate store-wide (e.g., brand colors, font families).
- Use local tokens (`[data-fs-*]` scope) when the change applies to a single component (e.g., button background color).
- Use `[data-fs-*]` data attributes to target components — never use `.fs-*` class names or generic tag selectors.
- Place all theme files in `src/themes/` with `custom-theme.scss` as the entry point — files elsewhere are not discovered.
- Reference design tokens via `var(--fs-*)` instead of hardcoding hex colors, pixel sizes, or font values.
- Use CSS modules for custom (non-FastStore) components to avoid conflicting with FastStore's structural styles.

## Hard constraints

### Constraint: Use Design Tokens — Not Inline Styles

MUST use design tokens (global or local) to style FastStore components. MUST NOT use inline `style={}` props on FastStore components for theming purposes.

**Why this matters**
Inline styles bypass the design token hierarchy, cannot be overridden by themes, do not participate in responsive breakpoints, and create maintenance nightmares. They also defeat CSS caching since styles are embedded in HTML. Design tokens ensure consistency and allow store-wide changes from a single file.

**Detection**
If you see `style={{` or `style={` on FastStore native components (components imported from `@faststore/ui` or `@faststore/core`) → warn that this bypasses the theming system. Suggest using design tokens or CSS modules instead. Exception: inline styles are acceptable on fully custom components that are not part of the FastStore UI library.

**Correct**
```scss
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

**Wrong**
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

MUST place custom theme SCSS files in the `src/themes/` directory. The primary theme file must be named `custom-theme.scss`.

**Why this matters**
FastStore's build system imports theme files from `src/themes/custom-theme.scss`. Files placed elsewhere will not be picked up by the build and your token overrides will have no effect. There will be no error — the default Brandless theme will render instead.

**Detection**
If you see token override declarations (variables starting with `--fs-`) in SCSS files outside `src/themes/` → warn that these may not be applied. If the file `src/themes/custom-theme.scss` does not exist in the project → warn that no custom theme is active.

**Correct**
```scss
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

**Wrong**
```scss
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

MUST use FastStore's `data-fs-*` data attributes to target components in theme SCSS files. MUST NOT use class names or tag selectors to target FastStore native components.

**Why this matters**
FastStore components use data attributes as their public styling API (e.g., `data-fs-button`, `data-fs-price`, `data-fs-hero`). Class names are implementation details that can change between versions. Using data attributes ensures your theme survives FastStore updates. Each component documents its available data attributes in the customization section of its docs.

**Detection**
If you see CSS selectors targeting `.fs-*` class names or generic tag selectors (`button`, `h1`, `div`) to style FastStore components → warn about fragility. Suggest using `[data-fs-*]` selectors instead.

**Correct**
```scss
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

**Wrong**
```scss
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

## Preferred pattern

Recommended file layout:

```text
src/
└── themes/
    └── custom-theme.scss    ← main entry point (auto-imported by FastStore)
```

Minimal custom theme:

```scss
// src/themes/custom-theme.scss
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap');

// Global Token Overrides
:root {
  --fs-color-main-0: #003232;
  --fs-color-main-1: #004c4c;
  --fs-color-accent-0: #e31c58;
  --fs-color-accent-1: #c4174d;

  --fs-text-face-body: 'Inter', -apple-system, system-ui, sans-serif;
  --fs-text-face-title: 'Poppins', var(--fs-text-face-body);
}

// Component-specific overrides
[data-fs-button] {
  --fs-button-border-radius: var(--fs-border-radius-pill);

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

For custom (non-FastStore) components, use CSS modules to avoid conflicts:

```scss
// src/components/CustomBanner.module.scss
.customBanner {
  display: flex;
  align-items: center;
  gap: var(--fs-spacing-3); // Still reference FastStore tokens for consistency
  padding: var(--fs-spacing-4);
  background-color: var(--fs-color-main-0);
  color: var(--fs-color-text-inverse);
  border-radius: var(--fs-border-radius);
}
```

## Common failure modes

- Using `!important` declarations — creates specificity dead-ends and defeats the cascading nature of design tokens. Use the correct token at the correct selector specificity instead.
- Hardcoding hex colors, pixel sizes, and font values directly in component styles instead of referencing `var(--fs-*)` tokens. Changes cannot propagate store-wide.
- Creating a parallel CSS system (Tailwind, Bootstrap, custom global stylesheet) that conflicts with FastStore's structural styles and doubles the CSS payload.
- Placing theme files outside `src/themes/` — they will not be discovered by the build system.
- Targeting FastStore components with `.fs-*` class names or generic tag selectors instead of `[data-fs-*]` data attributes.

## Review checklist

- [ ] Is the theme file located in `src/themes/custom-theme.scss`?
- [ ] Are global token overrides placed in `:root` scope?
- [ ] Are component-level overrides using `[data-fs-*]` data attribute selectors?
- [ ] Are all values referencing design tokens via `var(--fs-*)` instead of hardcoded values?
- [ ] Is there no use of `!important` declarations?
- [ ] Could this change be achieved without overrides (is theming sufficient)?
- [ ] Are custom component styles scoped with CSS modules to avoid conflicts?

## Reference

- [Theming overview](https://developers.vtex.com/docs/guides/faststore/using-themes-overview) — Introduction to theming concepts, Brandless architecture, and token hierarchy
- [Global tokens](https://developers.vtex.com/docs/guides/faststore/global-tokens-overview) — Complete reference for all global design tokens (colors, typography, spacing, borders)
- [Global tokens: Colors](https://developers.vtex.com/docs/guides/faststore/global-tokens-colors) — Color token reference and palette structure
- [Global tokens: Typography](https://developers.vtex.com/docs/guides/faststore/global-tokens-typography) — Font family, size, and weight tokens
- [Global tokens: Spacing](https://developers.vtex.com/docs/guides/faststore/global-tokens-spacing) — Spacing scale tokens
- [Styling a component](https://developers.vtex.com/docs/guides/faststore/using-themes-components) — Guide for customizing individual component styles with local tokens
- [Available themes](https://developers.vtex.com/docs/guides/faststore/themes-overview) — Pre-built themes (Midnight, Soft Blue) available as starting points
- [Importing FastStore UI component styles](https://developers.vtex.com/docs/guides/faststore/using-themes-importing-ui-components-styles) — How to import and use component styles in custom sections
- [`faststore-overrides`](../faststore-overrides/skill.md) — Related skill for when theming alone is insufficient and behavioral changes are needed

---

# Headless Front-End Development

# BFF Layer Design & Security

## When this skill applies

Use this skill when building or modifying any headless VTEX storefront that communicates with VTEX APIs — whether a custom storefront, mobile app, or kiosk.

- Setting up a BFF (Backend-for-Frontend) layer for a new headless project
- Deciding which VTEX APIs need server-side proxying vs direct frontend calls
- Implementing credential management (`VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `VtexIdclientAutCookie`)
- Reviewing a headless architecture for security compliance

Do not use this skill for:

- Checkout-specific proxy logic and OrderForm management (use [`headless-checkout-proxy`](../headless-checkout-proxy/skill.md))
- Search API integration details (use [`headless-intelligent-search`](../headless-intelligent-search/skill.md))
- Caching and TTL strategy (use [`headless-caching-strategy`](../headless-caching-strategy/skill.md))

## Decision rules

- A BFF layer is **mandatory** for every headless VTEX project. There is no scenario where a headless storefront can safely operate without one.
- Route all VTEX API calls through the BFF **except** Intelligent Search, which is the only API safe to call directly from the frontend.
- Use `VtexIdclientAutCookie` (stored server-side) for shopper-scoped API calls. Use `X-VTEX-API-AppKey`/`X-VTEX-API-AppToken` for machine-to-machine calls.
- Classify APIs by their path: `/pub/` endpoints are public but most still need BFF proxying for session management; `/pvt/` endpoints are private and **must** go through BFF.
- Even public Checkout endpoints (`/api/checkout/pub/`) must be proxied through BFF for security — they handle sensitive personal data.
- Create separate API keys with minimal permissions for different BFF modules rather than sharing one key with broad access.

## Hard constraints

### Constraint: A BFF layer is mandatory for headless VTEX — no exceptions

Every headless VTEX storefront MUST have a server-side BFF layer. Client-side code MUST NOT make direct HTTP requests to private VTEX API endpoints. All private API calls must be routed through the BFF.

**Why this matters**

Private VTEX APIs require `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers. If the frontend calls these APIs directly, the credentials must be embedded in client-side code or transmitted to the browser, exposing them to any user who opens browser DevTools. Stolen API keys can be used to access order data, modify pricing, or perform destructive administrative actions.

**Detection**

If you see `fetch` or `axios` calls to `vtexcommercestable.com.br/api/checkout`, `/api/oms`, `/api/profile`, or any `/pvt/` endpoint in client-side code (files under `src/`, `public/`, `app/`, or any browser-executed bundle) → STOP immediately. These calls must be moved to the BFF.

**Correct**

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

**Wrong**

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
    },
  );
  return response.json();
}
```

---

### Constraint: VtexIdclientAutCookie MUST be managed server-side

The `VtexIdclientAutCookie` token MUST be stored in a secure server-side session (e.g., encrypted cookie, Redis session store) and MUST NOT be stored in `localStorage`, `sessionStorage`, or any client-accessible JavaScript variable.

**Why this matters**

The `VtexIdclientAutCookie` is a bearer token that authenticates all actions on behalf of a shopper — placing orders, viewing profile data, accessing payment information. If stored client-side, it can be stolen via XSS attacks, browser extensions, or shared/public computers. An attacker with this token can impersonate the shopper.

**Detection**

If you see `VtexIdclientAutCookie` referenced in `localStorage.setItem`, `sessionStorage.setItem`, or assigned to a JavaScript variable in client-side code → STOP immediately. The token must be managed exclusively server-side.

**Correct**

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
    },
  );

  const profile = await response.json();
  res.json(profile);
});
```

**Wrong**

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
  return fetch(
    "https://mystore.vtexcommercestable.com.br/api/checkout/pub/profiles",
    {
      headers: { Cookie: `VtexIdclientAutCookie=${token}` },
    },
  );
}
```

---

### Constraint: API keys MUST NOT appear in client-side code

`VTEX_APP_KEY` and `VTEX_APP_TOKEN` values MUST only exist in server-side environment variables and MUST NOT be present in any file that is bundled, served, or accessible to the browser.

**Why this matters**

API keys grant programmatic access to the VTEX platform with the permissions of their associated role. Exposing them in frontend bundles, public directories, or client-side environment variables (e.g., `NEXT_PUBLIC_*`, `VITE_*`) allows anyone to extract them and make unauthorized API calls.

**Detection**

If you see `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `X-VTEX-API-AppKey`, or `X-VTEX-API-AppToken` in files under `src/`, `public/`, `app/` directories, or in environment variables prefixed with `NEXT_PUBLIC_`, `VITE_`, or `REACT_APP_` → STOP immediately. Move these to server-side-only environment variables.

**Correct**

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
    },
  );

  if (!response.ok) {
    return res.status(response.status).json({ error: "Failed to fetch order" });
  }

  const order = await response.json();
  res.json(order);
});

export default router;
```

**Wrong**

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
    },
  );
  return response.json();
}
```

## Preferred pattern

Architecture overview — how requests flow through the BFF:

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

Minimal BFF server setup with session management:

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
  }),
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
  }),
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

VTEX API client with credential injection for both auth types:

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
      `VTEX API error: ${response.status} ${response.statusText} for ${method} ${path}`,
    );
  }

  return response.json() as Promise<T>;
}
```

BFF route handler with session-based auth and input validation:

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

Authentication flow with server-side token management:

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

## Common failure modes

- **Proxying Intelligent Search through BFF**: Routing every VTEX API call through the BFF, including Intelligent Search, adds unnecessary latency and server load. Intelligent Search is a public, read-only API designed for direct frontend consumption. Call it directly from the frontend.

  ```typescript
  // Frontend code — call Intelligent Search directly (this is correct!)
  async function searchProducts(
    query: string,
    from: number = 0,
    to: number = 19,
  ): Promise<SearchResult> {
    const baseUrl = `https://${STORE_ACCOUNT}.vtexcommercestable.com.br`;
    const response = await fetch(
      `${baseUrl}/api/io/_v/api/intelligent-search/product_search/?query=${encodeURIComponent(query)}&from=${from}&to=${to}&locale=en-US`,
    );
    return response.json();
  }
  ```

- **Sharing a single API key across all BFF operations**: Using one API key with broad permissions (e.g., Owner role) for all BFF operations means a compromised key grants access to every VTEX resource. Create separate API keys for different BFF modules with minimal required permissions.

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

- **Logging API credentials or auth tokens**: Logging request headers or full request objects during debugging inadvertently writes API keys or `VtexIdclientAutCookie` values to log files, which may be accessible to multiple team members or attackers. Sanitize all log output to strip sensitive headers before logging.

  ```typescript
  // server/middleware/request-logger.ts
  import { Request, Response, NextFunction } from "express";

  const SENSITIVE_HEADERS = [
    "x-vtex-api-appkey",
    "x-vtex-api-apptoken",
    "cookie",
    "authorization",
  ];

  export function requestLogger(
    req: Request,
    _res: Response,
    next: NextFunction,
  ) {
    const sanitizedHeaders = Object.fromEntries(
      Object.entries(req.headers).map(([key, value]) =>
        SENSITIVE_HEADERS.includes(key.toLowerCase())
          ? [key, "[REDACTED]"]
          : [key, value],
      ),
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

## Review checklist

- [ ] Is a BFF layer present? Every headless VTEX project requires one — no exceptions.
- [ ] Are all private VTEX API calls (`/pvt/` endpoints) routed through the BFF?
- [ ] Are `VTEX_APP_KEY` and `VTEX_APP_TOKEN` stored exclusively in server-side environment variables?
- [ ] Are API keys absent from any `NEXT_PUBLIC_*`, `VITE_*`, or `REACT_APP_*` environment variables?
- [ ] Is `VtexIdclientAutCookie` stored in a server-side session, not in `localStorage` or `sessionStorage`?
- [ ] Is Intelligent Search called directly from the frontend (not unnecessarily proxied through BFF)?
- [ ] Are separate API keys used for different BFF modules with minimal permissions?
- [ ] Are sensitive headers redacted from all log output?

## Reference

- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — Core architecture guide for building headless stores on VTEX
- [Headless authentication](https://developers.vtex.com/docs/guides/headless-authentication) — OAuth-based shopper authentication flow for headless implementations
- [API authentication using API keys](https://developers.vtex.com/docs/guides/api-authentication-using-api-keys) — How to use appKey/appToken pairs for machine authentication
- [API authentication using user tokens](https://developers.vtex.com/docs/guides/api-authentication-using-user-tokens) — How VtexIdclientAutCookie works and its scopes
- [Refresh token flow for headless implementations](https://developers.vtex.com/docs/guides/refresh-token-flow-for-headless-implementations) — How to refresh expired VtexIdclientAutCookie tokens
- [Best practices for using application keys](https://help.vtex.com/en/docs/tutorials/best-practices-api-keys) — VTEX security guidelines for API key management

---

# Caching & Performance for Headless VTEX

## When this skill applies

Use this skill when building or optimizing a headless VTEX storefront for performance. Proper caching is the single most impactful performance optimization for headless commerce.

- Configuring CDN or edge caching for Intelligent Search and Catalog APIs
- Adding BFF-level caching (in-memory or Redis) for frequently requested data
- Deciding which VTEX API responses can be cached and which must never be cached
- Implementing cache invalidation when catalog data changes

Do not use this skill for:
- BFF architecture and API routing decisions (use [`headless-bff-architecture`](../headless-bff-architecture/skill.md))
- Intelligent Search API integration specifics (use [`headless-intelligent-search`](../headless-intelligent-search/skill.md))
- Checkout proxy and OrderForm management (use [`headless-checkout-proxy`](../headless-checkout-proxy/skill.md))

## Decision rules

- Classify every VTEX API as cacheable or non-cacheable before implementing caching logic.
- **Cacheable** (public, read-only, non-personalized): Intelligent Search, Catalog public endpoints, top searches, autocomplete.
- **Non-cacheable** (transactional, personalized, sensitive): Checkout, Profile, OMS, Payments, Pricing private endpoints. These must NEVER be cached at any layer.
- Use `stale-while-revalidate` for the best freshness/performance balance — serve cached data instantly while refreshing in the background.
- Use moderate TTLs (2-15 minutes) combined with event-driven invalidation. Never set TTLs of hours/days without an invalidation mechanism.
- Cache by request URL/params only, not by user identity — catalog data is the same for all anonymous users in the same trade policy.
- Layer caching: CDN edge cache for direct frontend calls (Search), BFF cache (Redis/in-memory) for proxied catalog data.

Recommended TTLs:

| API | Recommended TTL | SWR |
|---|---|---|
| Intelligent Search (product_search) | 2-5 minutes | 60s |
| Catalog (category tree) | 5-15 minutes | 5 min |
| Intelligent Search (autocomplete) | 1-2 minutes | 30s |
| Intelligent Search (top searches) | 5-10 minutes | 2 min |
| Catalog (product details) | 5 minutes | 60s |

APIs that must NEVER be cached:

| API | Why |
|---|---|
| Checkout (`/api/checkout/`) | Cart data is per-user, changes with every action |
| Profile (`/api/profile-system/pvt/`) | Personal data, GDPR/LGPD sensitive |
| OMS (`/api/oms/pvt/orders`) | Order status changes, user-specific |
| Payments (`/api/payments/`) | Financial transactions, must always be real-time |
| Pricing private (`/api/pricing/pvt/`) | May have per-user pricing rules |

## Hard constraints

### Constraint: MUST cache public API data aggressively

Search results, catalog data, category trees, and other public read-only data MUST be cached at appropriate levels (CDN, BFF, or both). Without caching, every user request hits VTEX APIs directly.

**Why this matters**

Without caching, a headless storefront generates an API request for every single page view, search, and category browse. This quickly exceeds VTEX API rate limits (causing 429 errors and degraded service), adds 200-500ms of latency per request, and creates a poor shopper experience. A store with 10,000 concurrent users making uncached search requests will overwhelm any API.

**Detection**

If a headless storefront calls Intelligent Search or Catalog APIs without any caching layer (no CDN cache headers, no BFF cache, no `Cache-Control` headers) → STOP immediately. Caching must be implemented for all public, read-only API responses.

**Correct**

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

**Wrong**

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

### Constraint: MUST NOT cache transactional or personal data

Responses from Checkout API, Profile API, OMS API, and Payments API MUST NOT be cached at any layer — not in the CDN, not in BFF memory, not in Redis, and not in browser cache.

**Why this matters**

Caching transactional data can cause catastrophic failures. A cached OrderForm means a shopper sees stale cart contents (wrong items, wrong prices). Cached profile data can leak one user's personal information to another user (especially behind shared caches). Cached order data shows stale statuses. Any of these is a security vulnerability, data privacy violation (GDPR/LGPD), or business logic failure.

**Detection**

If you see caching logic (Redis `set`, in-memory cache, `Cache-Control` headers with `max-age > 0`) applied to checkout, order, profile, or payment API responses → STOP immediately. These endpoints must always return fresh data.

**Correct**

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

**Wrong**

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

### Constraint: MUST implement cache invalidation strategy

Every caching implementation MUST have a clear invalidation strategy. Cached data must have appropriate TTLs and there must be a mechanism to force-invalidate cache when the underlying data changes.

**Why this matters**

Without invalidation, cached data becomes permanently stale. Products that are out of stock continue to appear available. Price changes don't reflect until the arbitrary TTL expires. New products are invisible. This leads to a poor shopper experience, failed orders (due to stale availability), and incorrect pricing.

**Detection**

If a caching implementation has no TTL (`max-age`, expiration time) or has very long TTLs (hours/days) without any invalidation mechanism → STOP immediately. All caches need bounded TTLs and ideally event-driven invalidation.

**Correct**

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
  const { productId } = req.body as { productId?: string };

  if (productId) {
    productCache.delete(productId);
    console.log(`Cache invalidated for product ${productId}`);
  }

  res.status(200).json({ received: true });
});

export default router;
```

**Wrong**

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

## Preferred pattern

Cache layer architecture for a headless VTEX storefront:

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

CDN cache headers for Intelligent Search (edge function example):

```typescript
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

Redis-based BFF cache with stale-while-revalidate:

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

Applying cache strategy per route group:

```typescript
// server/middleware/cache-headers.ts
import { Request, Response, NextFunction } from "express";

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
```

## Common failure modes

- **Caching based on session or user identity**: Creating per-user caches for catalog data (e.g., keying product search results by user ID) multiplies storage by user count and eliminates the primary benefit of caching. Cache public API responses by request URL/params only. For trade-policy-specific pricing, include trade policy (not user ID) in the cache key.

  ```typescript
  // Cache key based on request parameters only — not user identity
  function buildCacheKey(path: string, params: Record<string, string>): string {
    const sortedParams = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return `search:${path}:${sortedParams}`;
  }
  ```

- **Setting extremely long cache TTLs without invalidation**: TTLs of hours or days mean price changes, stock updates, and new products are invisible to shoppers. Use moderate TTLs (2-15 minutes) combined with event-driven invalidation and `stale-while-revalidate`.

  ```typescript
  // Moderate TTL with stale-while-revalidate
  const CACHE_CONFIG = {
    search: { ttlSeconds: 120, swrSeconds: 60 },      // 2 min + 1 min SWR
    categories: { ttlSeconds: 900, swrSeconds: 300 },  // 15 min + 5 min SWR
    product: { ttlSeconds: 300, swrSeconds: 60 },       // 5 min + 1 min SWR
    topSearches: { ttlSeconds: 600, swrSeconds: 120 },  // 10 min + 2 min SWR
  } as const;
  ```

- **No cache monitoring or observability**: Without measuring hit/miss/stale rates, you cannot tell if caching is effective or if TTLs are appropriate. Add `X-Cache` headers and track metrics in your observability platform.

  ```typescript
  // Add cache observability to every cached response
  interface CacheMetrics {
    hits: number;
    misses: number;
    stale: number;
  }

  const metrics: CacheMetrics = { hits: 0, misses: 0, stale: 0 };

  export function getCacheMetrics(): CacheMetrics & { hitRate: string } {
    const total = metrics.hits + metrics.misses + metrics.stale;
    const hitRate = total > 0 ? ((metrics.hits / total) * 100).toFixed(1) + "%" : "N/A";
    return { ...metrics, hitRate };
  }
  ```

## Review checklist

- [ ] Are all public, read-only API responses (Search, Catalog) cached at CDN and/or BFF level?
- [ ] Are transactional/personal API responses (Checkout, Profile, OMS, Payments) explicitly NOT cached with `no-store` headers?
- [ ] Do all caches have bounded TTLs (not permanent/infinite)?
- [ ] Is there a cache invalidation mechanism (TTL + event-driven or manual purge)?
- [ ] Are cache keys based on request parameters, not user identity?
- [ ] Is `stale-while-revalidate` used for the best freshness/performance balance?
- [ ] Are TTLs moderate (2-15 minutes) rather than extremely long (hours/days)?
- [ ] Is cache observability in place (X-Cache headers, hit/miss metrics)?

## Reference

- [How the cache works](https://help.vtex.com/en/docs/tutorials/understanding-how-the-cache-works) — VTEX native caching behavior and cache layer architecture
- [Cloud infrastructure](https://developers.vtex.com/docs/guides/cloud-infrastructure) — VTEX CDN, router, and caching infrastructure overview
- [Best practices for avoiding rate limit errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Caching as a strategy to avoid API rate limits
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — Cache patterns for VTEX IO (useful reference for cache scope concepts)
- [Intelligent Search API](https://developers.vtex.com/docs/api-reference/intelligent-search-api) — The primary cacheable API for headless storefronts
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores

---

# Checkout API Proxy & OrderForm Management

## When this skill applies

Use this skill when building cart and checkout functionality for any headless VTEX storefront. Every cart and checkout operation must go through the BFF.

- Implementing cart creation, item add/update/remove operations
- Attaching profile, shipping, or payment data to an OrderForm
- Implementing the 3-step order placement flow (place → pay → process)
- Managing `orderFormId` and `CheckoutOrderFormOwnership` cookies server-side

Do not use this skill for:
- General BFF architecture and API routing (use [`headless-bff-architecture`](../headless-bff-architecture/skill.md))
- Search API integration (use [`headless-intelligent-search`](../headless-intelligent-search/skill.md))
- Caching strategy decisions (use [`headless-caching-strategy`](../headless-caching-strategy/skill.md))

## Decision rules

- ALL Checkout API calls MUST be proxied through the BFF — no exceptions. The Checkout API handles sensitive personal data (profile, address, payment).
- Store `orderFormId` in a server-side session, never in `localStorage` or `sessionStorage`.
- Capture and forward `CheckoutOrderFormOwnership` and `checkout.vtex.com` cookies between the BFF and VTEX on every request.
- Validate all inputs server-side before forwarding to VTEX — never pass raw `req.body` directly.
- Execute the 3-step order placement flow (place order → send payment → process order) in a single synchronous BFF handler to stay within the **5-minute window**.
- Always store and reuse the existing `orderFormId` from the session — only create a new cart when no `orderFormId` exists.

OrderForm attachment endpoints:

| Attachment | Endpoint | Purpose |
|---|---|---|
| items | `POST .../orderForm/{id}/items` | Add, remove, or update cart items |
| clientProfileData | `POST .../orderForm/{id}/attachments/clientProfileData` | Customer profile info |
| shippingData | `POST .../orderForm/{id}/attachments/shippingData` | Address and delivery option |
| paymentData | `POST .../orderForm/{id}/attachments/paymentData` | Payment method selection |
| marketingData | `POST .../orderForm/{id}/attachments/marketingData` | Coupons and UTM data |

## Hard constraints

### Constraint: ALL checkout operations MUST go through BFF

Client-side code MUST NOT make direct HTTP requests to any VTEX Checkout API endpoint (`/api/checkout/`). All checkout operations — cart creation, item management, profile updates, shipping, payment, and order placement — must be proxied through the BFF layer.

**Why this matters**

Checkout endpoints handle sensitive personal data (email, address, phone, payment details). Direct frontend calls expose the request/response flow to browser DevTools, extensions, and XSS attacks. Additionally, the BFF layer is needed to manage `VtexIdclientAutCookie` and `CheckoutOrderFormOwnership` cookies server-side, validate inputs, and prevent cart manipulation (e.g., price tampering).

**Detection**

If you see `fetch` or `axios` calls to `/api/checkout/` in any client-side code (browser-executed JavaScript, frontend source files) → STOP immediately. All checkout calls must route through BFF endpoints.

**Correct**

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

**Wrong**

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

### Constraint: orderFormId MUST be managed server-side

The `orderFormId` MUST be stored in a secure server-side session. It SHOULD NOT be stored in `localStorage`, `sessionStorage`, or exposed to the frontend in a way that allows direct VTEX API calls.

**Why this matters**

The `orderFormId` is the key to a customer's shopping cart and all data within it — profile information, shipping address, payment details. If exposed client-side, an attacker could use it to query VTEX directly and retrieve personal data, or manipulate the cart by adding/removing items through direct API calls bypassing any validation logic.

**Detection**

If you see `orderFormId` stored in `localStorage` or `sessionStorage` → STOP immediately. It should be managed in the BFF session.

**Correct**

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

**Wrong**

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

### Constraint: MUST validate all inputs server-side before forwarding to VTEX

The BFF MUST validate all input data before forwarding requests to the VTEX Checkout API. This includes validating SKU IDs, quantities, email formats, address fields, and coupon codes.

**Why this matters**

Without server-side validation, malicious users can send crafted requests through the BFF to VTEX with invalid or manipulative data — negative quantities, SQL injection in text fields, or spoofed seller IDs. While VTEX has its own validation, defense-in-depth requires validating at the BFF layer to catch issues early and provide clear error messages.

**Detection**

If BFF route handlers pass `req.body` directly to VTEX API calls without any validation or sanitization → STOP immediately. All inputs must be validated before proxying.

**Correct**

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

**Wrong**

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

## Preferred pattern

Request flow through the BFF for checkout operations:

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

VTEX Checkout API client with cookie management:

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

Cart management BFF routes:

```typescript
// server/routes/cart.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const cartRoutes = Router();

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
```

Order placement — all 3 steps in a single handler to respect the **5-minute window**:

```typescript
// server/routes/order.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const orderRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

// POST /api/bff/order/place — place order from existing cart
// CRITICAL: All 3 steps must complete within 5 minutes or the order is canceled
orderRoutes.post("/place", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    // Step 1: Place order — starts the 5-minute timer
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

    // Step 2: Send payment — immediately after placement
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

    // Step 3: Process order — immediately after payment
    await vtexCheckout<unknown>({
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

## Common failure modes

- **Creating a new cart on every page load**: Calling `GET /api/checkout/pub/orderForm` without an `orderFormId` on every page load creates a new empty cart each time, abandoning the previous one. Always store and reuse the `orderFormId` from the server-side session.

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

- **Ignoring the 5-minute order processing window**: Placing an order (step 1) but delaying payment or processing beyond 5 minutes causes VTEX to automatically cancel the order as `incomplete`. Execute all three steps (place order → send payment → process order) sequentially and immediately in a single BFF request handler. Never split these across multiple independent frontend calls.

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

- **Exposing raw VTEX error messages to the frontend**: Forwarding VTEX API error responses directly to the frontend leaks internal details (account names, API paths, data structures). Map VTEX errors to user-friendly messages in the BFF and log the full error server-side.

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

## Review checklist

- [ ] Are ALL checkout API calls routed through the BFF (no direct frontend calls to `/api/checkout/`)?
- [ ] Is `orderFormId` stored in a server-side session, not in `localStorage` or `sessionStorage`?
- [ ] Are `CheckoutOrderFormOwnership` and `checkout.vtex.com` cookies captured from VTEX responses and forwarded on subsequent requests?
- [ ] Are all inputs validated server-side before forwarding to VTEX?
- [ ] Does the order placement handler execute all 3 steps (place → pay → process) in a single synchronous flow within the 5-minute window?
- [ ] Is the existing `orderFormId` reused from the session rather than creating a new cart on every page load?
- [ ] Are VTEX error responses sanitized before being sent to the frontend?

## Reference

- [Headless cart and checkout](https://developers.vtex.com/docs/guides/headless-cart-and-checkout) — Complete guide to implementing cart and checkout in headless stores
- [Checkout API reference](https://developers.vtex.com/docs/api-reference/checkout-api) — Full API reference for all Checkout endpoints
- [orderForm fields](https://developers.vtex.com/docs/guides/orderform-fields) — Detailed documentation of the OrderForm data structure
- [Creating a regular order from an existing cart](https://developers.vtex.com/docs/guides/creating-a-regular-order-from-an-existing-cart) — Step-by-step guide to the order placement flow
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores
- [Add cart items](https://developers.vtex.com/docs/guides/add-cart-items) — Guide to adding products to a shopping cart

---

# Intelligent Search API Integration

## When this skill applies

Use this skill when implementing product search, category browsing, autocomplete, or faceted filtering in a headless VTEX storefront.

- Building a search results page with product listings
- Implementing faceted navigation (category, brand, price, color filters)
- Adding autocomplete suggestions to a search input
- Wiring up search analytics events for Intelligent Search ranking

Do not use this skill for:
- BFF architecture and API routing decisions (use [`headless-bff-architecture`](../headless-bff-architecture/skill.md))
- Checkout or cart API integration (use [`headless-checkout-proxy`](../headless-checkout-proxy/skill.md))
- Caching strategy and TTL configuration (use [`headless-caching-strategy`](../headless-caching-strategy/skill.md))

## Decision rules

- Call Intelligent Search **directly from the frontend** — it is the ONE exception to the "everything through BFF" rule. It is fully public and requires no authentication.
- Do NOT proxy Intelligent Search through the BFF unless you have a specific need (e.g., server-side rendering). Proxying adds latency on a high-frequency operation.
- Always use the API's `sort` parameter and facet paths for filtering and sorting — never re-sort or re-filter results client-side.
- Always include `from`, `to`, and `locale` parameters in every search request.
- Always send analytics events to the Intelligent Search Events API — without them, search ranking degrades over time.

Search endpoints overview:

| Endpoint | Method | Purpose |
|---|---|---|
| `/product_search/{facets}` | GET | Search products by query and/or facets |
| `/facets/{facets}` | GET | Get available filters for a query |
| `/autocomplete_suggestions` | GET | Get term and product suggestions while typing |
| `/top_searches` | GET | Get the 10 most popular search terms |
| `/correction_search` | GET | Get spelling correction for a misspelled term |
| `/search_suggestions` | GET | Get suggested terms similar to the search term |
| `/banners/{facets}` | GET | Get banners configured for a query |

Facet combination rules:
- **Same facet type → OR (union)**: Selecting "Red" and "Blue" for color returns products matching either color
- **Different facet types → AND (intersection)**: Selecting "Red" color and "Nike" brand returns only red Nike products

## Hard constraints

### Constraint: MUST send analytics events to Intelligent Search Events API

Every headless search implementation MUST send analytics events to the Intelligent Search Events API - Headless. At minimum, send search impression events when results are displayed and click events when a product is selected from search results.

**Why this matters**

Intelligent Search uses machine learning to rank results based on user behavior. Without analytics events, the search engine has no behavioral data and cannot personalize or optimize results. Over time, search quality degrades compared to stores that send events. Additionally, VTEX Admin search analytics dashboards will show no data.

**Detection**

If a search implementation renders results from Intelligent Search but has no calls to `sp.vtex.com/event-api` or the Intelligent Search Events API → STOP immediately. Analytics events must be implemented alongside search.

**Correct**

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

**Wrong**

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

### Constraint: MUST paginate results with `from` and `to` parameters

Every product search request MUST include `from` and `to` query parameters to control pagination. The maximum page size is 50 items (`to - from` must not exceed 49, since indices are inclusive and zero-based).

**Why this matters**

Without pagination parameters, the API defaults to a small result set. Requesting too many results in a single call (or not paginating at all) causes slow responses, high memory usage on the client, and poor user experience. The API enforces a maximum of 50 items per request.

**Detection**

If a call to `/product_search/` does not include `from` and `to` query parameters → STOP immediately. Pagination must always be explicit.

**Correct**

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

**Wrong**

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

### Constraint: Do NOT unnecessarily proxy Intelligent Search through BFF

Intelligent Search API requests SHOULD be made directly from the frontend. Do not route search traffic through the BFF unless you have a specific need (e.g., server-side rendering, adding custom business logic).

**Why this matters**

Intelligent Search is a public API that does not require authentication. Adding a BFF proxy layer introduces an additional network hop, increases latency on every search operation, adds server cost, and prevents the CDN from caching responses efficiently. Search queries are high-frequency operations — even 50ms of added latency impacts conversion.

**Detection**

If all Intelligent Search calls go through a BFF endpoint instead of directly to VTEX → note this to the developer. It is not a security issue but a performance concern. If there is no justification (like SSR), recommend direct frontend calls.

**Correct**

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

**Wrong**

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

## Preferred pattern

Data flow for Intelligent Search in a headless storefront:

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

Typed search API client for all endpoints:

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

Faceted navigation helper:

```typescript
// lib/facets.ts
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

Debounced autocomplete for search inputs:

```typescript
// lib/autocomplete.ts
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
      const params = new URLSearchParams({ query, locale });
      const response = await fetch(`${BASE_URL}/autocomplete_suggestions?${params}`);
      const suggestions = await response.json();
      callback(suggestions);
    }, delayMs);
  };
}
```

Full search orchestration with analytics:

```typescript
// search-page.ts — framework-agnostic search orchestration
import { productSearch } from "./lib/intelligent-search-client";
import { getFacets, buildFacetPath } from "./lib/facets";
import { createDebouncedAutocomplete } from "./lib/autocomplete";
import { sendSearchEvent } from "./search-analytics";

interface SearchState {
  query: string;
  page: number;
  pageSize: number;
  locale: string;
  selectedFilters: Record<string, string[]>;
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

// Handle product click from search results — send click event
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
```

## Common failure modes

- **Not sending the `locale` parameter**: Without `locale`, Intelligent Search may return results in the wrong language or fail to apply locale-specific relevance rules. Multi-language stores will display mixed-language results. Always include `locale` in every request.

  ```typescript
  // Always include locale in search parameters
  const params = new URLSearchParams({
    query: "shoes",
    locale: "en-US", // Required for correct language processing
    from: "0",
    to: "19",
  });
  ```

- **Loading all products at once**: Setting very large `from`/`to` ranges (e.g., 0 to 999) or infinite scroll without limits. The API limits results to 50 items per request. Use proper pagination with reasonable page sizes (12-24 items per page).

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

- **Rebuilding search ranking logic client-side**: Fetching results and then re-sorting or re-filtering them in the frontend discards Intelligent Search's ranking intelligence. Client-side filtering only works on the current page, not the full catalog. Use the API's `sort` parameter and facet paths.

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

## Review checklist

- [ ] Is Intelligent Search called directly from the frontend (not unnecessarily routed through BFF)?
- [ ] Does every search request include `from`, `to`, and `locale` parameters?
- [ ] Are analytics events sent to `sp.vtex.com/event-api` after search results render?
- [ ] Are click events sent when a user selects a product from search results?
- [ ] Is sorting done via the API's `sort` parameter rather than client-side re-sorting?
- [ ] Is filtering done via facet paths rather than client-side filtering?
- [ ] Is autocomplete debounced to avoid excessive API calls?
- [ ] Are page sizes bounded to ≤ 50 items per request?

## Reference

- [Headless catalog and search](https://developers.vtex.com/docs/guides/headless-catalog) — Overview of catalog browsing and search in headless stores
- [Intelligent Search API reference](https://developers.vtex.com/docs/api-reference/intelligent-search-api) — Complete API reference for all search endpoints
- [Intelligent Search Events API - Headless](https://developers.vtex.com/docs/api-reference/intelligent-search-events-api-headless) — Events API for sending analytics from headless implementations
- [Intelligent Search overview](https://help.vtex.com/en/docs/tutorials/intelligent-search-overview) — General overview of Intelligent Search capabilities
- [Search configuration](https://help.vtex.com/en/docs/tutorials/search-configuration) — How to configure searchable specifications, facet ordering, and other search settings
- [Autocomplete](https://help.vtex.com/en/docs/tutorials/autocomplete) — How autocomplete suggestions work in Intelligent Search

---

# Marketplace Integration

# Catalog & SKU Integration

## When this skill applies

Use this skill when building a seller connector that needs to push product catalog data into a VTEX marketplace, handle SKU approval workflows, or keep prices and inventory synchronized.

- Building the Change Notification flow to register and update SKUs
- Implementing the SKU suggestion lifecycle (send → pending → approved/denied)
- Mapping product data to the VTEX catalog schema
- Synchronizing prices and inventory via notification endpoints

Do not use this skill for:
- Marketplace-side catalog operations (direct Catalog API writes)
- Order fulfillment or invoice handling (see `marketplace-fulfillment`)
- Rate limiting patterns in isolation (see `marketplace-rate-limiting`)

## Decision rules

VTEX exposes two `POST` routes under `api/catalog_system/pvt/skuseller/changenotification`. They are **not** interchangeable — the path shape tells the platform which identifier you are sending.

| Route | Path pattern | Meaning |
| ----- | ------------ | ------- |
| Change notification **with marketplace SKU ID** | `.../changenotification/{skuId}` | `{skuId}` is the **SKU ID in the marketplace catalog** (VTEX). There is **no** `sellerId` in the URL. |
| Change notification **with seller ID and seller SKU ID** | `.../changenotification/{sellerId}/{skuId}` | `{sellerId}` is the seller account on the marketplace; `{skuId}` is the **seller's own SKU code** (the same ID used in `PUT` SKU Suggestion paths). |

**Seller connector integrations** MUST use the **second** route. Official docs sometimes mix descriptions between these two — trust the **URL shape**: the seller-scoped flow always uses **two** path segments after `changenotification/`.

SKU suggestions (`PUT`/`GET`) must go to `https://api.vtex.com/{accountName}/suggestions/{sellerId}/{sellerSkuId}`, not the store hostname. The same App Key and App Token apply. Do not build suggestion URLs using `{account}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/seller/...` — that is a different Catalog System surface.

- For **seller-side** catalog integration, use `POST /api/catalog_system/pvt/skuseller/changenotification/{sellerId}/{sellerSkuId}` (seller Id in the marketplace account + **seller’s SKU ID**). A **200 OK** means the SKU already exists in the marketplace for that seller (update path); a **404 Not Found** means it does not (send a SKU suggestion). Do **not** use `POST .../changenotification/{skuId}` with the seller’s SKU code — that single-segment route expects the **marketplace** SKU ID.
- Use `POST .../changenotification/{skuId}` only when the identifier you have is the **VTEX marketplace** SKU ID (no seller segment in the path).
- Use **`PUT`** on [`/suggestions/{sellerId}/{sellerSkuId}`](https://developers.vtex.com/docs/api-reference/marketplace-apis-suggestions#put-/suggestions/-sellerId-/-sellerSkuId-) under **`https://api.vtex.com/{accountName}`** (Send SKU Suggestion) to register or update pending suggestions. The seller does not own the catalog — every new SKU must go through the suggestion/approval workflow.
- Use separate notification endpoints for price and inventory: `POST /notificator/{sellerId}/changenotification/{sellerSkuId}/price` and `POST /notificator/{sellerId}/changenotification/{sellerSkuId}/inventory`. The path segment after `changenotification/` is the **seller SKU ID** (the seller’s own SKU code — the same identifier used in suggestions and seller-scoped catalog flows), not the marketplace VTEX SKU ID. Reference docs may label this segment `skuId`; read it as **sellerSkuId** in seller-connector integrations.
- After price/inventory notifications, the marketplace calls the seller's **Fulfillment Simulation** endpoint (`POST /pvt/orderForms/simulation`). This endpoint must respond within **2.5 seconds** or the product is considered unavailable.
- Suggestions can only be updated while in "pending" state. Once approved or denied, the seller cannot modify them.

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

## Hard constraints

### Constraint: Use SKU Integration API, Not Direct Catalog API

External sellers MUST use the Change Notification + SKU Suggestion flow to integrate SKUs. Direct Catalog API writes (`POST /api/catalog/pvt/product` or `POST /api/catalog/pvt/stockkeepingunit`) are for marketplace-side operations only.

**Why this matters**

The seller does not own the catalog. Direct catalog writes will fail with 403 Forbidden or create orphaned entries that bypass the approval workflow. The suggestion mechanism ensures marketplace quality control.

**Detection**

If you see direct Catalog API calls for product/SKU creation (e.g., `POST /api/catalog/pvt/product`, `POST /api/catalog/pvt/stockkeepingunit`) from a seller integration → warn that the SKU Integration API should be used instead.

**Correct**

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
  const storeBaseUrl = `https://${marketplaceAccount}.vtexcommercestable.com.br`;
  const suggestionUrl = `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`;

  // Step 1: Seller-scoped change notification (Catalog API — store host)
  try {
    await client.post(
      `${storeBaseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
    );
    // 200 OK — SKU exists, marketplace will fetch updates via fulfillment simulation
    console.log(`SKU ${sellerSkuId} exists in marketplace, update triggered`);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // 404 — SKU not found, send suggestion
      console.log(`SKU ${sellerSkuId} not found, sending suggestion`);
      await client.put(suggestionUrl, skuData);
      console.log(`SKU suggestion sent for ${sellerSkuId}`);
    } else {
      throw error;
    }
  }
}
```

**Wrong**

```typescript
// WRONG: Marketplace-SKU-only path with the seller's SKU code (misroutes the notification).
// .../changenotification/{skuId} expects the VTEX marketplace SKU ID, not sellerSkuId.
await client.post(
  `https://${marketplaceAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/skuseller/changenotification/${sellerSkuId}`
);

// WRONG: SKU Suggestion on the store host + Catalog path — public contract is api.vtex.com + /suggestions/...
await client.put(
  `https://${marketplaceAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
  skuData
);

// WRONG: Seller writing directly to marketplace catalog — bypasses suggestion/approval; expect 403
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
  // Will fail: 403 Forbidden — seller lacks catalog write permissions
}
```

---

### Constraint: Handle Rate Limiting on Catalog Notifications

All catalog notification calls MUST implement 429 handling with exponential backoff. Batch notifications MUST be throttled to respect VTEX API rate limits.

**Why this matters**

The Change Notification endpoint is rate-limited. Sending bulk notifications without throttling will trigger 429 responses and temporarily block the seller's API access, stalling the entire integration.

**Detection**

If you see catalog notification calls without 429 handling or retry logic → STOP and add rate limiting. If you see a tight loop sending notifications without delays → warn about rate limiting.

**Correct**

```typescript
async function batchNotifySkus(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  sellerSkuIds: string[],
  concurrency: number = 5,
  delayMs: number = 200
): Promise<void> {
  const results: Array<{ sellerSkuId: string; status: "exists" | "new" | "error" }> = [];

  for (let i = 0; i < sellerSkuIds.length; i += concurrency) {
    const batch = sellerSkuIds.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (sellerSkuId) => {
        try {
          await client.post(
            `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
          );
          return { sellerSkuId, status: "exists" as const };
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            "response" in error &&
            (error as { response?: { status?: number } }).response?.status === 404
          ) {
            return { sellerSkuId, status: "new" as const };
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
            return { sellerSkuId, status: "error" as const };
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
    if (i + concurrency < sellerSkuIds.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
```

**Wrong**

```typescript
// WRONG: No rate limiting, no error handling, tight loop
async function notifyAllSkus(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  sellerSkuIds: string[]
): Promise<void> {
  // Fires all requests simultaneously — will trigger 429 rate limits
  await Promise.all(
    sellerSkuIds.map((sellerSkuId) =>
      client.post(
        `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
      )
    )
  );
}
```

---

### Constraint: Handle Suggestion Lifecycle States

Sellers MUST check the suggestion state before attempting updates. Suggestions can only be updated while in pending state.

**Why this matters**

Attempting to update an already-approved or denied suggestion will fail silently or create duplicate entries. An approved suggestion becomes an SKU owned by the marketplace.

**Detection**

If you see SKU suggestion updates without checking current suggestion status → warn about suggestion lifecycle handling.

**Correct**

```typescript
async function updateSkuSuggestion(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  updatedData: Record<string, unknown>
): Promise<boolean> {
  const suggestionUrl = `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`;

  // Check current suggestion status before updating
  try {
    const response = await client.get(suggestionUrl);

    const suggestion = response.data;
    if (suggestion.Status === "Pending") {
      // Safe to update — suggestion hasn't been processed yet
      await client.put(suggestionUrl, updatedData);
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
    await client.put(suggestionUrl, updatedData);
    return true;
  }
}
```

**Wrong**

```typescript
// WRONG: Blindly sending suggestion update without checking state
async function blindUpdateSuggestion(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  data: Record<string, unknown>
): Promise<void> {
  // If the suggestion was already approved, this fails silently
  // or creates a duplicate that confuses the marketplace operator
  await client.put(
    `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`,
    data
  );
}
```

## Preferred pattern

### Set Up the Seller Connector Client

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
    // Catalog System routes (e.g. changenotification) use the store host.
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

// Use the same headers for PUT/GET on https://api.vtex.com/{account}/suggestions/...
// (pass a full URL on the same axios instance, or set baseURL to https://api.vtex.com/{account} for suggestion-only calls).
```

### Implement the Change Notification Flow

Handle both the "exists" (200) and "new" (404) scenarios from the changenotification endpoint.

```typescript
interface CatalogNotificationResult {
  skuId: string;
  action: "updated" | "suggestion_sent" | "error";
  error?: string;
}

async function notifyAndSync(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  skuData: SkuSuggestion
): Promise<CatalogNotificationResult> {
  const suggestionUrl = `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`;

  try {
    await client.post(
      `/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
    );
    // SKU exists — marketplace will call fulfillment simulation to get updates
    return { skuId: sellerSkuId, action: "updated" };
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      try {
        await client.put(suggestionUrl, skuData);
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

### Implement the Fulfillment Simulation Endpoint

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

### Notify Price and Inventory Changes

Send separate notifications for price and inventory updates. The `{sellerSkuId}` segment in the URL is the **seller’s SKU identifier** (same code you use in your catalog and in `changenotification/{sellerId}/{sellerSkuId}` / suggestions). Do not pass the marketplace’s internal VTEX SKU ID here unless your integration is explicitly keyed that way.

```typescript
async function notifyPriceChange(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuId: string
): Promise<void> {
  await client.post(
    `/notificator/${sellerId}/changenotification/${sellerSkuId}/price`
  );
}

async function notifyInventoryChange(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuId: string
): Promise<void> {
  await client.post(
    `/notificator/${sellerId}/changenotification/${sellerSkuId}/inventory`
  );
}

async function syncPriceAndInventory(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuIds: string[]
): Promise<void> {
  for (const sellerSkuId of sellerSkuIds) {
    await notifyPriceChange(client, sellerId, sellerSkuId);
    await notifyInventoryChange(client, sellerId, sellerSkuId);

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
      config.marketplaceAccount,
      config.sellerId,
      sku.sellerSkuId,
      skuSuggestion
    );

    console.log(`SKU ${sku.sellerSkuId}: ${result.action}`);

    // Throttle between SKU operations
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Sync prices and inventory for all active SKUs (seller SKU IDs)
  const activeSellerSkuIds = skusToSync.map((s) => s.sellerSkuId);
  await syncPriceAndInventory(client, config.sellerId, activeSellerSkuIds);
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

## Common failure modes

- **Calling the single-segment change notification with the seller’s SKU ID.** `POST .../changenotification/{skuId}` resolves the **marketplace** SKU ID. Passing the seller’s catalog code there will not match the intended SKU and breaks the integration flow. Seller connectors must use `POST .../changenotification/{sellerId}/{sellerSkuId}`. If public API reference text describes `sellerId` in the body but shows a one-segment URL, treat that as a documentation mismatch and follow the path shape above.

- **Polling for suggestion status in tight loops.** Suggestion approval is a manual or semi-automatic marketplace process that can take minutes to days. Tight polling wastes API quota and may trigger rate limits that block the entire integration. Use a scheduled job (cron) to check suggestion statuses periodically (e.g., every 15-30 minutes), or implement a webhook-based notification system.

- **Ignoring the fulfillment simulation timeout.** The seller's fulfillment simulation endpoint performs complex database queries or external API calls that exceed the response time limit. VTEX marketplaces wait a maximum of **2.5 seconds** for a fulfillment simulation response. After that, the product is considered unavailable/inactive and won't appear in the storefront or checkout. Pre-cache price and inventory data using in-memory or Redis cache with event-driven updates so the simulation endpoint responds instantly.

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

## Review checklist

- [ ] Is the Change Notification + SKU Suggestion flow used (not direct Catalog API writes)?
- [ ] Does catalog change notification use `.../changenotification/{sellerId}/{sellerSkuId}` (not the single-segment marketplace-SKU route with a seller SKU code)?
- [ ] Does the integration handle both 200 (exists) and 404 (new) responses from changenotification?
- [ ] Are SKU suggestion updates guarded by a status check (only update while "Pending")?
- [ ] Are `PUT`/`GET` suggestion calls sent to `https://api.vtex.com/{account}/suggestions/{sellerId}/{sellerSkuId}`, not to the store hostname?
- [ ] Are batch catalog notifications throttled with 429 handling and exponential backoff?
- [ ] Does the fulfillment simulation endpoint respond within **2.5 seconds**?
- [ ] Are price and inventory notifications sent via the correct `/notificator/{sellerId}/changenotification/{sellerSkuId}/price|inventory` paths (seller SKU ID in the path)?
- [ ] Are placeholder values (account names, seller IDs, API keys) replaced with real values?

## Reference

- [External Seller Connector Guide](https://developers.vtex.com/docs/guides/external-seller-integration-connector) — Complete integration flow for external sellers connecting to VTEX marketplaces
- [Change notification (marketplace SKU ID)](https://developers.vtex.com/docs/api-reference/catalog-api#post-/api/catalog_system/pvt/skuseller/changenotification/-skuId-) — `POST .../changenotification/{skuId}`; path uses **marketplace** SKU ID only
- [Change notification (seller ID and seller SKU ID)](https://developers.vtex.com/docs/api-reference/catalog-api#post-/api/catalog_system/pvt/skuseller/changenotification/-sellerId-/-skuId-) — `POST .../changenotification/{sellerId}/{skuId}`; **use this for seller connector catalog integration**
- [Send SKU Suggestion (`PUT /suggestions/{sellerId}/{sellerSkuId}`)](https://developers.vtex.com/docs/api-reference/marketplace-apis-suggestions#put-/suggestions/-sellerId-/-sellerSkuId-) — base URL `https://api.vtex.com/{accountName}`
- [Marketplace API — Suggestions](https://developers.vtex.com/docs/api-reference/marketplace-apis-suggestions) — full Suggestions API reference
- [Marketplace API - Manage Suggestions (guide)](https://developers.vtex.com/docs/guides/marketplace-api#manage-suggestions) — narrative guide for SKU suggestions workflow
- [Catalog Management for VTEX Marketplace](https://developers.vtex.com/docs/guides/external-seller-integration-vtex-marketplace-operation) — Marketplace-side catalog operations and SKU approval workflows

---

# Fulfillment, Invoice & Tracking

## When this skill applies

Use this skill when building a seller integration that needs to send invoice data and tracking information to a VTEX marketplace after fulfilling an order.

- Handling the Authorize Fulfillment callback from the marketplace
- Sending invoice notifications via `POST /api/oms/pvt/orders/{marketplaceOrderId}/invoice` (VTEX marketplace order ID in the path — not the seller’s internal order number)
- Updating tracking information via `PATCH /api/oms/pvt/orders/{marketplaceOrderId}/invoice/{invoiceNumber}`
- Implementing partial invoicing for split shipments

Do not use this skill for:

- Catalog or SKU synchronization (see `marketplace-catalog-sync`)
- Order event consumption via Feed/Hook (see `marketplace-order-hook`)
- General API rate limiting (see `marketplace-rate-limiting`)

## Decision rules

- After payment is approved, the VTEX marketplace sends an **Authorize Fulfillment** request to the seller's endpoint (`POST /pvt/orders/{sellerOrderId}/fulfill`). Only begin fulfillment after receiving this callback.
- Send invoices via `POST /api/oms/pvt/orders/{orderId}/invoice`. Required fields: `type`, `invoiceNumber`, `invoiceValue` (in cents), `issuanceDate`, and `items` array.
- Use `type: "Output"` for sales invoices (shipment) and `type: "Input"` for return invoices.
- Send tracking information **separately** after the carrier provides it, using `PATCH /api/oms/pvt/orders/{orderId}/invoice/{invoiceNumber}`. Do not hardcode placeholder tracking values in the initial invoice.
- For split shipments, send **one invoice per package** with only the items in that package. Each `invoiceValue` must reflect only its items.
- Once an order is invoiced, it cannot be canceled without first sending a return invoice (`type: "Input"`).
- The fulfillment simulation endpoint must respond within **2.5 seconds** or the product is considered unavailable.

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

## Hard constraints

### Constraint: Send Correct Invoice Format with All Required Fields

The invoice notification MUST include `type`, `invoiceNumber`, `invoiceValue`, `issuanceDate`, and `items` array. The `invoiceValue` MUST be in cents. The `items` array MUST match the items in the order.

**Why this matters**

Missing required fields cause the API to reject the invoice with 400 Bad Request, leaving the order stuck in "handling" status. Incorrect `invoiceValue` (e.g., using dollars instead of cents) causes financial discrepancies in marketplace reconciliation.

**Detection**

If you see an invoice notification payload missing `invoiceNumber`, `invoiceValue`, `issuanceDate`, or `items` → warn about missing required fields. If `invoiceValue` appears to be in dollars (e.g., `99.90` instead of `9990`) → warn about cents conversion.

**Correct**

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
  invoice: InvoicePayload,
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
        `Ensure it's in cents (e.g., 9990 for $99.90).`,
    );
  }

  await client.post(`/api/oms/pvt/orders/${orderId}/invoice`, invoice);
}

// Example usage:
async function invoiceOrder(
  client: AxiosInstance,
  orderId: string,
): Promise<void> {
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

**Wrong**

```typescript
// WRONG: Missing required fields, value in dollars instead of cents
async function sendBrokenInvoice(
  client: AxiosInstance,
  orderId: string,
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

Tracking information MUST be sent as soon as the carrier provides it. Use `PATCH /api/oms/pvt/orders/{orderId}/invoice/{invoiceNumber}` to add tracking to an existing invoice.

**Why this matters**

Late tracking updates prevent customers from seeing shipment status in the marketplace. The order remains in "invoiced" state instead of progressing to "delivering" and then "delivered". This generates customer support tickets and damages seller reputation.

**Detection**

If you see tracking information being batched for daily updates instead of sent in real-time → warn about prompt tracking updates. If tracking is included in the initial invoice call but the carrier hasn't provided it yet (hardcoded/empty values) → warn.

**Correct**

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
  tracking: TrackingUpdate,
): Promise<void> {
  await client.patch(
    `/api/oms/pvt/orders/${orderId}/invoice/${invoiceNumber}`,
    tracking,
  );
}

// Send tracking as soon as carrier provides it
async function onCarrierPickup(
  client: AxiosInstance,
  orderId: string,
  invoiceNumber: string,
  carrierData: { name: string; trackingId: string; trackingUrl: string },
): Promise<void> {
  await updateOrderTracking(client, orderId, invoiceNumber, {
    courier: carrierData.name,
    trackingNumber: carrierData.trackingId,
    trackingUrl: carrierData.trackingUrl,
  });
  console.log(
    `Tracking updated for order ${orderId}: ${carrierData.trackingId}`,
  );
}

// Update delivery status when confirmed
async function onDeliveryConfirmed(
  client: AxiosInstance,
  orderId: string,
  invoiceNumber: string,
): Promise<void> {
  await updateOrderTracking(client, orderId, invoiceNumber, {
    courier: "",
    trackingNumber: "",
    isDelivered: true,
  });
  console.log(`Order ${orderId} marked as delivered`);
}
```

**Wrong**

```typescript
// WRONG: Sending empty/fake tracking data with the invoice
async function invoiceWithFakeTracking(
  client: AxiosInstance,
  orderId: string,
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

For orders shipped in multiple packages, each shipment MUST have its own invoice with only the items included in that package. The `invoiceValue` MUST reflect only the items in that particular shipment.

**Why this matters**

Sending a single invoice for the full order value when only partial items are shipped causes financial discrepancies. The marketplace cannot reconcile payments correctly, and the order status may not progress properly.

**Detection**

If you see a single invoice being sent with the full order value for partial shipments → warn about partial invoicing. If the items array doesn't match the actual items being shipped → warn.

**Correct**

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
  shipments: Shipment[],
): Promise<void> {
  for (const shipment of shipments) {
    // Calculate value for only the items in this shipment
    const shipmentValue = shipment.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
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
        `${shipment.items.length} items, value=${shipmentValue}`,
    );
  }
}

// Example: Order with 3 items shipped in 2 packages
await sendPartialInvoices(client, "ORD-123", [
  {
    invoiceNumber: "NFE-001-A",
    items: [{ id: "sku-1", name: "Laptop", quantity: 1, price: 250000 }],
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

**Wrong**

```typescript
// WRONG: Sending full order value for partial shipment
async function wrongPartialInvoice(
  client: AxiosInstance,
  orderId: string,
  totalOrderValue: number,
  shippedItems: OrderItem[],
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

## Preferred pattern

### Implement the Authorize Fulfillment Endpoint

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
    `Fulfillment authorized: seller=${sellerOrderId}, marketplace=${marketplaceOrderId}`,
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

### Send Invoice After Fulfillment

Once the order is packed and the invoice is generated, send the invoice notification.

```typescript
async function fulfillAndInvoice(
  client: AxiosInstance,
  order: OrderMapping,
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
    `Invoice ${invoice.number} sent for order ${order.marketplaceOrderId}`,
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
    0,
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

### Send Tracking When Carrier Picks Up

```typescript
async function handleCarrierPickup(
  client: AxiosInstance,
  orderId: string,
  invoiceNumber: string,
  carrier: { name: string; trackingId: string; trackingUrl: string },
): Promise<void> {
  await updateOrderTracking(client, orderId, invoiceNumber, {
    courier: carrier.name,
    trackingNumber: carrier.trackingId,
    trackingUrl: carrier.trackingUrl,
  });

  console.log(`Tracking ${carrier.trackingId} sent for order ${orderId}`);
}
```

### Confirm Delivery

```typescript
async function handleDeliveryConfirmation(
  client: AxiosInstance,
  orderId: string,
  invoiceNumber: string,
): Promise<void> {
  await client.patch(
    `/api/oms/pvt/orders/${orderId}/invoice/${invoiceNumber}`,
    {
      isDelivered: true,
      courier: "",
      trackingNumber: "",
    },
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
  appToken: string,
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
  order: OrderMapping,
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
    carrierData,
  );

  // 3. When delivered, confirm
  await waitForDeliveryConfirmation(order.sellerOrderId);
  await handleDeliveryConfirmation(
    client,
    order.marketplaceOrderId,
    invoice.number,
  );
}

async function waitForCarrierPickup(
  sellerOrderId: string,
): Promise<{ name: string; trackingId: string; trackingUrl: string }> {
  // Replace with actual carrier integration
  return {
    name: "Correios",
    trackingId: "BR123456789",
    trackingUrl: "https://tracking.example.com/BR123456789",
  };
}

async function getLatestInvoice(
  sellerOrderId: string,
): Promise<{ number: string }> {
  // Replace with actual invoice lookup
  return { number: `NFE-${sellerOrderId}` };
}

async function waitForDeliveryConfirmation(
  sellerOrderId: string,
): Promise<void> {
  // Replace with actual delivery confirmation logic
  console.log(`Waiting for delivery confirmation: ${sellerOrderId}`);
}
```

## Common failure modes

- **Sending invoice before fulfillment authorization.** The seller sends an invoice notification immediately when the order is placed, before receiving the Authorize Fulfillment callback from the marketplace. Payment may still be pending or under review. Invoicing before authorization can result in the invoice being rejected or the order being in an inconsistent state. Only send the invoice after receiving `POST /pvt/orders/{sellerOrderId}/fulfill`.

- **Not handling return invoices for cancellation.** A seller tries to cancel an invoiced order by calling the Cancel Order endpoint directly without first sending a return invoice. Once an order is in "invoiced" status, it cannot be canceled without a return invoice (`type: "Input"`). The Cancel Order API will reject the request.

```typescript
// Correct: Send return invoice before canceling an invoiced order
async function cancelInvoicedOrder(
  client: AxiosInstance,
  orderId: string,
  originalItems: InvoiceItem[],
  originalInvoiceValue: number,
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
  await client.post(`/api/marketplace/pvt/orders/${orderId}/cancel`, {
    reason: "Customer requested return",
  });
}
```

- **Fulfillment simulation exceeding the 2.5-second timeout.** The seller's fulfillment simulation endpoint performs complex database queries or external API calls that exceed the response time limit. VTEX marketplaces wait a maximum of **2.5 seconds** for a fulfillment simulation response. After that, the product is considered unavailable/inactive and won't appear in the storefront or checkout. Pre-cache price and inventory data.

## Review checklist

- [ ] Does the seller only begin fulfillment after receiving the Authorize Fulfillment callback?
- [ ] Does the invoice payload include all required fields (`type`, `invoiceNumber`, `invoiceValue`, `issuanceDate`, `items`)?
- [ ] Is `invoiceValue` in cents (not dollars)?
- [ ] Is tracking sent separately after the carrier provides real data (not hardcoded placeholders)?
- [ ] For split shipments, does each invoice cover only its package's items and value?
- [ ] Is cancellation of invoiced orders handled via return invoice (`type: "Input"`) first?
- [ ] Does the fulfillment simulation endpoint respond within **2.5 seconds**?

## Reference

- [External Seller Connector - Order Invoicing](https://developers.vtex.com/docs/guides/external-seller-integration-connector#order-invoicing) — Seller-side invoicing flow in the integration guide
- [Order Invoice Notification API](https://developers.vtex.com/docs/api-reference/orders-api#post-/api/oms/pvt/orders/-orderId-/invoice) — API reference for sending invoice data
- [Update Order Tracking API](https://developers.vtex.com/docs/api-reference/orders-api#patch-/api/oms/pvt/orders/-orderId-/invoice/-invoiceNumber-) — API reference for adding/updating tracking info
- [Sending Invoice and Tracking to Marketplace](https://developers.vtex.com/docs/guides/external-marketplace-integration-invoice-tracking) — Guide for marketplace connector invoice/tracking flow
- [Order Flow and Status](https://help.vtex.com/en/docs/tutorials/order-flow-and-status) — Complete order status lifecycle
- [Authorize Fulfillment API](https://developers.vtex.com/docs/api-reference/marketplace-protocol-external-seller-fulfillment#post-/pvt/orders/-sellerOrderId-/fulfill) — API reference for the fulfillment authorization endpoint

---

# Order Integration & Webhooks

## When this skill applies

Use this skill when building an integration that needs to react to order status changes in a VTEX marketplace — such as syncing orders to an ERP, triggering fulfillment workflows, or sending notifications to external systems.

- Configuring Feed v3 or Hook for order updates
- Choosing between Feed (pull) and Hook (push) delivery models
- Validating webhook authentication and processing events idempotently
- Handling the complete order status lifecycle

Do not use this skill for:

- Catalog or SKU synchronization (see `marketplace-catalog-sync`)
- Invoice and tracking submission (see `marketplace-fulfillment`)
- General API rate limiting (see `marketplace-rate-limiting`)

## Decision rules

- Use **Hook (push)** for high-performance middleware that needs real-time order updates. Your endpoint must respond with HTTP 200 within 5000ms.
- Use **Feed (pull)** for ERPs or systems with limited throughput where you control the consumption pace. Events persist in a queue until committed.
- Use **Feed as a backup** alongside Hook to catch events missed during downtime.
- Use **FromWorkflow** filter when you only need to react to order status changes (simpler, most common).
- Use **FromOrders** filter when you need to filter by any order property using JSONata expressions (e.g., by sales channel).
- The two filter types are **mutually exclusive**. Using both in the same configuration request returns `409 Conflict`.
- Each appKey can configure only one feed and one hook. Different users sharing the same appKey access the same feed/hook.

|             | Feed                         | Hook                        |
| ----------- | ---------------------------- | --------------------------- |
| Model       | Pull (active)                | Push (reactive)             |
| Scalability | You control volume           | Must handle any volume      |
| Reliability | Events persist in queue      | Must be always available    |
| Best for    | ERPs with limited throughput | High-performance middleware |

**Hook Notification Payload**:

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

## Hard constraints

### Constraint: Validate Webhook Authentication

Your hook endpoint MUST validate the authentication headers sent by VTEX before processing any event. The `Origin.Account` and `Origin.Key` fields in the payload must match your expected values.

**Why this matters**

Without auth validation, any actor can send fake order events to your endpoint, triggering unauthorized fulfillment actions, data corruption, or financial losses.

**Detection**

If you see a hook endpoint handler that processes events without checking `Origin.Account`, `Origin.Key`, or custom headers → STOP and add authentication validation.

**Correct**

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
    if (
      req.headers[config.customHeaderKey.toLowerCase()] !==
      config.customHeaderValue
    ) {
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

**Wrong**

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

Your integration MUST process order events idempotently. Use the combination of `OrderId` + `State` + `LastChange` as a deduplication key to prevent duplicate processing.

**Why this matters**

VTEX may deliver the same hook notification multiple times (at-least-once delivery). Without idempotency, duplicate processing can result in double fulfillment, duplicate invoices, or inconsistent state.

**Detection**

If you see an order event handler without an `orderId` duplicate check or deduplication mechanism → warn about idempotency. If the handler directly mutates state without checking if the event was already processed → warn.

**Correct**

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

async function handleOrderStateChange(
  orderId: string,
  state: string,
): Promise<void> {
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

async function updateOrderInERP(
  orderId: string,
  status: string,
): Promise<void> {
  console.log(`Updating ERP: ${orderId} → ${status}`);
}

async function confirmOrderShipped(orderId: string): Promise<void> {
  console.log(`Confirming shipment for ${orderId}`);
}

async function cancelOrderInERP(orderId: string): Promise<void> {
  console.log(`Canceling order ${orderId} in ERP`);
}
```

**Wrong**

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

Your integration MUST handle all possible order statuses, including `Status Null`. Unrecognized statuses must be logged but not crash the integration.

**Why this matters**

VTEX documents warn that `Status Null` may be unidentified and end up being mapped as another status, potentially leading to errors. Missing a status in your handler can cause orders to get stuck or lost.

**Detection**

If you see a status handler that only covers 2-3 statuses without a default/fallback case → warn about incomplete status handling.

**Correct**

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

async function handleAllStatuses(
  orderId: string,
  state: string,
): Promise<void> {
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
      console.warn(
        `Unknown or unhandled order status: "${state}" for order ${orderId}`,
      );
      await logUnhandledStatus(orderId, state);
      break;
  }
}

async function notifyWarehouse(orderId: string, action: string): Promise<void> {
  console.log(`Warehouse notification: ${orderId} → ${action}`);
}
async function updateFulfillmentStatus(
  orderId: string,
  status: string,
): Promise<void> {
  console.log(`Fulfillment status: ${orderId} → ${status}`);
}
async function markAsShipped(orderId: string): Promise<void> {
  console.log(`Shipped: ${orderId}`);
}
async function handleCancellation(
  orderId: string,
  state: string,
): Promise<void> {
  console.log(`Cancellation: ${orderId} (${state})`);
}
async function confirmPaymentReceived(orderId: string): Promise<void> {
  console.log(`Payment received: ${orderId}`);
}
async function handlePaymentFailure(orderId: string): Promise<void> {
  console.log(`Payment failed: ${orderId}`);
}
async function logUnhandledStatus(
  orderId: string,
  state: string,
): Promise<void> {
  console.log(`UNHANDLED: ${orderId} → ${state}`);
}
```

**Wrong**

```typescript
// WRONG: Only handles 2 statuses, no fallback for unknown statuses
async function incompleteHandler(
  orderId: string,
  state: string,
): Promise<void> {
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

## Preferred pattern

### Configure the Hook

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

### Build the Hook Endpoint with Auth and Idempotency

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
// from the Hard constraints section above handle auth + deduplication
```

### Fetch Full Order Data and Process

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
  state: string,
): Promise<void> {
  const response = await client.get<VtexOrder>(
    `/api/oms/pvt/orders/${orderId}`,
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
        estimatedDelivery:
          order.shippingData.logisticsInfo[0]?.shippingEstimate,
      });
      break;

    case "cancel":
      await cancelFulfillmentTask(order.orderId);
      break;

    default:
      console.log(`Order ${orderId}: state=${state}, no action needed`);
  }
}

async function createFulfillmentTask(
  task: Record<string, unknown>,
): Promise<void> {
  console.log("Creating fulfillment task:", task);
}

async function cancelFulfillmentTask(orderId: string): Promise<void> {
  console.log("Canceling fulfillment task:", orderId);
}
```

### Implement Feed as Fallback

Use Feed v3 as a backup to catch any events the hook might miss during downtime.

```typescript
async function pollFeedAsBackup(client: AxiosInstance): Promise<void> {
  const feedResponse = await client.get<
    Array<{
      eventId: string;
      handle: string;
      domain: string;
      state: string;
      orderId: string;
      lastChange: string;
    }>
  >("/api/orders/feed");

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
      console.error(
        `Failed to process feed event for ${event.orderId}:`,
        error,
      );
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
    filterStatuses: ["ready-for-handling", "handling", "invoiced", "cancel"],
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

## Common failure modes

- **Using List Orders API instead of Feed/Hook.** The `GET /api/oms/pvt/orders` endpoint depends on indexing, which can lag behind real-time updates. It's slower, less reliable, and more likely to hit rate limits when polled frequently. Feed v3 runs before indexing and doesn't depend on it. Use Feed v3 or Hook for order change detection; use List Orders only for ad-hoc queries.

- **Blocking hook response with long processing.** VTEX requires the hook endpoint to respond with HTTP 200 within **5000ms**. If processing takes longer (e.g., ERP sync, complex database writes), VTEX considers the delivery failed and retries with increasing delays. Repeated failures can lead to hook deactivation. Acknowledge the event immediately, then process asynchronously via a queue.

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
  headers: Record<string, unknown>,
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

## Review checklist

- [ ] Is the correct delivery model chosen (Feed for controlled throughput, Hook for real-time)?
- [ ] Does the hook endpoint validate `Origin.Account`, `Origin.Key`, and custom headers?
- [ ] Is event processing idempotent using `OrderId` + `State` + `LastChange` as deduplication key?
- [ ] Does the status handler cover all order statuses with a default/fallback case?
- [ ] Does the hook endpoint respond within **5000ms** (using async processing for heavy work)?
- [ ] Is Feed v3 configured as a backup to catch missed hook events?
- [ ] Are filter types not mixed (FromWorkflow and FromOrders are mutually exclusive)?

## Reference

- [Feed v3 Guide](https://developers.vtex.com/docs/guides/orders-feed) — Complete guide to Feed and Hook configuration, filter types, and best practices
- [Orders API - Feed v3 Endpoints](https://developers.vtex.com/docs/api-reference/orders-api#get-/api/orders/feed) — API reference for feed retrieval and commit
- [Hook Configuration API](https://developers.vtex.com/docs/api-reference/orders-api#post-/api/orders/hook/config) — API reference for creating and updating hook configuration
- [Orders Overview](https://developers.vtex.com/docs/guides/orders-overview) — Overview of the VTEX Orders module
- [Order Flow and Status](https://help.vtex.com/en/docs/tutorials/order-flow-and-status) — Complete list of order statuses and transitions
- [ERP Integration - Set Up Order Integration](https://developers.vtex.com/docs/guides/erp-integration-set-up-order-integration) — Guide for integrating order feed with back-office systems

---

# API Rate Limiting & Resilience

## When this skill applies

Use this skill when building any integration that calls VTEX APIs — catalog sync, order processing, price/inventory updates, or fulfillment operations — and needs to handle rate limits gracefully without losing data or degrading performance.

- Implementing retry logic with exponential backoff and jitter
- Reading and reacting to VTEX rate limit headers (`Retry-After`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- Building circuit breakers for high-throughput integrations
- Controlling request throughput with queuing

Do not use this skill for:
- Catalog-specific synchronization logic (see `marketplace-catalog-sync`)
- Order event consumption and processing (see `marketplace-order-hook`)
- Invoice and tracking submission (see `marketplace-fulfillment`)

## Decision rules

- Always implement **exponential backoff with jitter** on 429 responses. Formula: `delay = min(maxDelay, baseDelay * 2^attempt) * (0.5 + random(0, 0.5))`.
- Always **read the `Retry-After` header** on 429 responses. Use the greater of the `Retry-After` value and the calculated backoff delay.
- Use a **circuit breaker** when a service consistently fails (e.g., after 5 consecutive failures), to prevent cascading failures and give the service time to recover.
- Use a **request queue** to control throughput and avoid bursts that trigger rate limits.
- Monitor `X-RateLimit-Remaining` **proactively** on successful responses and slow down before hitting 429.
- VTEX rate limits vary by API:
  - **Pricing API**: PUT/POST: 40 requests/second/account with 1000 burst credits. DELETE: 16 requests/second/account with 300 burst credits.
  - **Catalog API**: Varies by endpoint; no published fixed limits.
  - **Orders API**: Subject to general platform limits; VTEX recommends 1-minute backoff on 429.
- **Burst Credits**: When you exceed the rate limit, excess requests consume burst credits (1 credit per excess request). When burst credits reach 0, the request is blocked with 429. Credits refill over time at the same rate as the route's limit when the route is not being used.

**Rate Limit Response Headers**:

| Header | Description |
|---|---|
| `Retry-After` | Seconds to wait before retrying (present on 429 responses) |
| `X-RateLimit-Remaining` | Number of requests remaining in the current window |
| `X-RateLimit-Reset` | Timestamp (seconds) when the rate limit window resets |

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

## Hard constraints

### Constraint: Implement Exponential Backoff on 429 Responses

When receiving a 429 response, the integration MUST wait before retrying using exponential backoff with jitter. The wait time MUST respect the `Retry-After` header when present.

**Why this matters**

Immediate retries after a 429 will be rejected again and consume burst credits faster, leading to prolonged blocking. Without jitter, all clients retry simultaneously after the window resets, causing another rate limit spike (thundering herd).

**Detection**

If you see immediate retry on 429 (no delay, no backoff) → STOP and implement exponential backoff. If you see retry logic without reading the `Retry-After` header → warn that the header should be respected. If you see `while(true)` retry loops or `setInterval` with intervals less than 5 seconds → warn about tight loops.

**Correct**

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

**Wrong**

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

When a 429 response includes a `Retry-After` header, the integration MUST wait at least the specified number of seconds before retrying. The backoff delay should be the maximum of the calculated backoff and the `Retry-After` value.

**Why this matters**

The `Retry-After` header is the server's explicit instruction on when it will accept requests again. Ignoring it results in requests being rejected until the specified time has passed, wasting bandwidth and potentially extending the block period.

**Detection**

If you see retry logic that does not read or use the `Retry-After` header value → warn that the header should be checked. If the retry delay is always a fixed value regardless of the header → warn.

**Correct**

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

**Wrong**

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

Integrations MUST NOT use `while(true)` loops for retrying or `setInterval`/`setTimeout` with intervals less than 5 seconds for polling VTEX APIs.

**Why this matters**

Tight loops generate excessive requests that quickly exhaust rate limits, degrade VTEX platform performance for all users, and can make the VTEX Admin unavailable for the account. VTEX explicitly warns that excessive 429 errors can make Admin unavailable.

**Detection**

If you see `while(true)` or `for(;;)` retry patterns without adequate delays → warn about tight loops. If you see `setInterval` with intervals less than 5000ms for API calls → warn about polling frequency.

**Correct**

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

**Wrong**

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

## Preferred pattern

### Create a Rate-Limit-Aware HTTP Client

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

### Implement a Circuit Breaker

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

### Implement a Request Queue

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

### Monitor Rate Limit Headers Proactively

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

## Common failure modes

- **Fixed retry delay without jitter.** Using a fixed delay (e.g., always 5 seconds) instead of exponential backoff with jitter causes the "thundering herd" problem: all rate-limited clients retry simultaneously, creating another burst that triggers rate limiting again. Use exponential backoff with random jitter so retries are spread across time.

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

- **No proactive rate management.** Only handling 429 errors reactively (after being rate limited) instead of monitoring rate limit headers to slow down proactively. By the time you receive a 429, you've already lost burst credits. Monitor `X-RateLimit-Remaining` on successful responses and reduce request rate when remaining quota is low.

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

## Review checklist

- [ ] Is exponential backoff with jitter implemented for 429 responses?
- [ ] Is the `Retry-After` header read and respected on 429 responses?
- [ ] Are there no tight retry loops (`while(true)`, `setInterval` < 5 seconds)?
- [ ] Is a circuit breaker in place for consistently failing services?
- [ ] Are `X-RateLimit-Remaining` headers monitored proactively to slow down before hitting limits?
- [ ] Are the correct numeric thresholds used (maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 60000)?
- [ ] Are Pricing API limits respected (40 req/s PUT/POST, 16 req/s DELETE, burst credits)?

## Reference

- [Best Practices for Avoiding Rate Limit Errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Official VTEX guide on rate limit management and best practices
- [Handling Errors and Exceptions](https://developers.vtex.com/docs/guides/handling-errors-and-exceptions) — VTEX guide on error handling including 429 and 5xx responses
- [API Response Status Codes](https://developers.vtex.com/docs/guides/api-response-codes) — Complete list of VTEX API response codes and their meanings
- [Pricing API Overview - Rate Limits](https://developers.vtex.com/docs/guides/pricing-api-overview) — Specific rate limit documentation for the Pricing API including burst credits
- [Feed v3 - Best Practices](https://developers.vtex.com/docs/guides/orders-feed) — Rate limiting recommendations for order feed integrations
- [How to Load Test a Store](https://developers.vtex.com/docs/guides/how-to-load-test-a-store) — VTEX documentation on rate limiting behavior, 429 responses, and circuit breakers

---

# Payment Connector Development

# Asynchronous Payment Flows & Callbacks

## When this skill applies

Use this skill when:
- Implementing a payment connector that supports Boleto Bancário, Pix, bank transfers, or redirect-based flows
- Working with any payment method where the acquirer does not return a final status synchronously
- Handling `callbackUrl` notification or retry flows
- Managing the Gateway's 7-day automatic retry cycle for `undefined` status payments

Do not use this skill for:
- PPP endpoint contracts and response shapes — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- `paymentId`/`requestId` idempotency and state machine logic — use [`payment-idempotency`](../payment-idempotency/skill.md)
- PCI compliance and Secure Proxy card handling — use [`payment-pci-security`](../payment-pci-security/skill.md)

## Decision rules

- If the acquirer cannot return a final status synchronously, the payment method is async — return `status: "undefined"`.
- Common async methods: Boleto Bancário (`BankInvoice`), Pix, bank transfers, redirect-based auth.
- Common sync methods: credit cards, debit cards with instant authorization.
- **Without VTEX IO**: the `callbackUrl` is a notification endpoint — POST the updated status with `X-VTEX-API-AppKey`/`X-VTEX-API-AppToken` headers.
- **With VTEX IO**: the `callbackUrl` is a retry endpoint — POST to it (no payload) to trigger the Gateway to re-call POST `/payments`.
- Always preserve the `X-VTEX-signature` query parameter in the `callbackUrl` — never strip or modify it.
- Set `delayToCancel` to 604800 (7 days) for async methods to match the Gateway's retry window.

## Hard constraints

### Constraint: MUST return `undefined` for async payment methods

For any payment method where authorization does not complete synchronously (Boleto, Pix, bank transfer, redirect-based auth), the Create Payment response MUST use `status: "undefined"`. The connector MUST NOT return `"approved"` or `"denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why this matters**
Returning `"approved"` for an unconfirmed payment tells the Gateway the money has been collected. The order is released for fulfillment immediately. If the customer never actually pays (e.g., never scans the Pix QR code), the merchant ships products without payment. Returning `"denied"` prematurely cancels a payment that might still be completed.

**Detection**
If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect), STOP. Async methods must return `"undefined"` and resolve via callback.

**Correct**
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

**Wrong**
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

### Constraint: MUST use callbackUrl from request — never hardcode

The connector MUST use the exact `callbackUrl` provided in the Create Payment request body, including all query parameters (`X-VTEX-signature`, etc.). The connector MUST NOT hardcode callback URLs or construct them manually.

**Why this matters**
The `callbackUrl` contains transaction-specific authentication tokens (`X-VTEX-signature`) that the Gateway uses to validate the callback. A hardcoded or modified URL will be rejected by the Gateway, leaving the payment stuck in `undefined` status forever. The URL format may also change between environments (production vs sandbox).

**Detection**
If the connector hardcodes a callback URL string, constructs the URL manually, or strips query parameters from the `callbackUrl`, warn the developer. The `callbackUrl` must be stored and used exactly as received.

**Correct**
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

**Wrong**
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

### Constraint: MUST be ready for repeated Create Payment calls

The connector MUST handle the Gateway calling Create Payment with the same `paymentId` multiple times during the 7-day retry window. Each call must return the current payment status (which may have been updated via callback since the last call).

**Why this matters**
The Gateway retries `undefined` payments automatically. If the connector treats each call as a new payment, it will create duplicate charges. If the connector always returns the original `undefined` status without checking for updates, the Gateway never learns that the payment was approved, and eventually cancels it.

**Detection**
If the Create Payment handler does not check for an existing `paymentId` and return the latest status, STOP. The handler must support idempotent retries that reflect the current state.

**Correct**
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

**Wrong**
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

## Preferred pattern

Data flow for non-VTEX IO (notification callback):

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (with X-VTEX-API-AppKey/AppToken headers)
4. Gateway updates payment status to approved/denied
```

Data flow for VTEX IO (retry callback):

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (retry, no payload)
4. Gateway → POST /payments → Connector (returns status: "approved"/"denied")
```

Classify payment methods:

```typescript
const ASYNC_PAYMENT_METHODS = new Set([
  "BankInvoice",   // Boleto Bancário
  "Pix",           // Pix instant payments
]);

function isAsyncPaymentMethod(paymentMethod: string): boolean {
  return ASYNC_PAYMENT_METHODS.has(paymentMethod);
}
```

Acquirer webhook handler with callback notification (non-VTEX IO):

```typescript
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const webhookData = req.body;
  const acquirerRef = webhookData.transactionId;

  const payment = await store.findByAcquirerRef(acquirerRef);
  if (!payment || !payment.callbackUrl) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  const pppStatus = webhookData.status === "paid" ? "approved" : "denied";

  // Update local state FIRST
  await store.updateStatus(payment.paymentId, pppStatus);

  // Notify the Gateway via callbackUrl with retry logic
  await notifyGateway(payment.callbackUrl, {
    paymentId: payment.paymentId,
    status: pppStatus,
  });

  res.status(200).json({ received: true });
}
```

Callback retry with exponential backoff:

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

## Common failure modes

- **Synchronous approval of async payments** — Returning `status: "approved"` for Pix or Boleto because the QR code or slip was generated successfully. Generating a QR code is not the same as receiving payment. The order ships without money collected.
- **Ignoring the callbackUrl** — Not storing the `callbackUrl` from the Create Payment request and relying entirely on the Gateway's automatic retries. The retry interval increases over time, causing long delays between payment and order approval. Worst case: the 7-day window expires and the payment is cancelled even though the customer paid.
- **Hardcoding callback URLs** — Constructing callback URLs manually instead of using the one from the request, stripping the `X-VTEX-signature` parameter. The Gateway rejects the callback and the payment stays stuck in `undefined`.
- **No retry logic for failed callbacks** — Calling the `callbackUrl` once and silently dropping the notification on failure. The Gateway never learns the payment was approved, and the payment sits in `undefined` until the next retry or is auto-cancelled.
- **Returning stale status on retries** — Always returning the original `undefined` response without checking if the status was updated via callback. The Gateway never sees the `approved` status and eventually cancels the payment.

## Review checklist

- [ ] Do async payment methods (Boleto, Pix) return `status: "undefined"` in Create Payment?
- [ ] Is the `callbackUrl` stored exactly as received from the request (including all query params)?
- [ ] Does the webhook handler update local state before calling the `callbackUrl`?
- [ ] Is `X-VTEX-signature` preserved in the `callbackUrl` when calling it?
- [ ] Are `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers included in notification callbacks (non-VTEX IO)?
- [ ] Is there retry logic with exponential backoff for failed callback calls?
- [ ] Does the Create Payment handler return the latest status (not stale) on Gateway retries?
- [ ] Is `delayToCancel` set to 604800 (7 days) for async methods?

## Related skills

- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — Endpoint contracts and response shapes
- [`payment-idempotency`](../payment-idempotency/skill.md) — `paymentId`/`requestId` idempotency and state machine
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI compliance and Secure Proxy

## Reference

- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Detailed explanation of the `undefined` status, callback URL notification and retry flows, and the 7-day retry window
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization flow documentation including async retry mechanics and callback URL behavior for VTEX IO vs non-VTEX IO
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint-level implementation guide with callbackUrl and returnUrl usage
- [Pix: Instant Payments in Brazil](https://developers.vtex.com/docs/guides/payments-integration-pix-instant-payments-in-brazil) — Pix-specific async flow implementation including QR code generation and callback handling
- [Callback URL Signature Authentication](https://help.vtex.com/en/announcements/2024-05-03-callback-url-signature-authentication-token) — Mandatory X-VTEX-signature requirement for callback URL authentication (effective June 2024)
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with callbackUrl field documentation

---

# Idempotency & Duplicate Prevention

## When this skill applies

Use this skill when:
- Implementing any PPP endpoint handler that processes payments, cancellations, captures, or refunds
- Ensuring repeated Gateway calls with the same identifiers produce identical results without re-processing
- Building a payment state machine to prevent invalid transitions (e.g., capturing a cancelled payment)
- Handling the Gateway's 7-day retry window for `undefined` status payments

Do not use this skill for:
- PPP endpoint response shapes and HTTP methods — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- Async callback URL notification logic — use [`payment-async-flow`](../payment-async-flow/skill.md)
- PCI compliance and Secure Proxy — use [`payment-pci-security`](../payment-pci-security/skill.md)

## Decision rules

- Use `paymentId` as the idempotency key for Create Payment — every call with the same `paymentId` must return the same result.
- Use `requestId` as the idempotency key for Cancel, Capture, and Refund operations.
- If the Gateway sends a second Create Payment with the same `paymentId`, return the stored response without calling the acquirer again.
- Async payment methods (Boleto, Pix) MUST return `status: "undefined"` — never `"approved"` until the acquirer confirms.
- A payment moves through defined states: `undefined` → `approved` → `settled`, or `undefined` → `denied`, or `approved` → `cancelled`. Enforce valid transitions only.
- Use a persistent data store (PostgreSQL, DynamoDB, VBase for VTEX IO) — never in-memory storage that is lost on restart.

## Hard constraints

### Constraint: MUST use paymentId as idempotency key for Create Payment

The connector MUST check for an existing record with the given `paymentId` before processing a new payment. If a record exists, return the stored response without calling the acquirer again.

**Why this matters**
The VTEX Gateway retries Create Payment requests with `undefined` status for up to 7 days. Without idempotency on `paymentId`, each retry creates a new charge at the acquirer, resulting in duplicate charges to the customer. This is a financial loss and a critical production incident.

**Detection**
If the Create Payment handler does not check for an existing `paymentId` before processing, STOP. The handler must query the data store for the `paymentId` first.

**Correct**
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

**Wrong**
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

### Constraint: MUST return identical response for duplicate requests

When the connector receives a Create Payment request with a `paymentId` that already exists in the data store, it MUST return the exact stored response. It MUST NOT create a new record, generate new identifiers, or re-process the payment.

**Why this matters**
The Gateway uses the response fields (`authorizationId`, `tid`, `nsu`, `status`) to track the transaction. If a retry returns different values, the Gateway loses track of the original transaction, causing reconciliation failures and potential double settlements.

**Detection**
If the handler creates a new database record or generates new identifiers when it finds an existing `paymentId`, STOP. The handler must return the previously stored response verbatim.

**Correct**
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

**Wrong**
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

### Constraint: MUST NOT approve async payments synchronously

If a payment method is asynchronous (e.g., Boleto, Pix, bank redirect), the Create Payment response MUST return `status: "undefined"`. It MUST NOT return `status: "approved"` or `status: "denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why this matters**
Returning `approved` for an async method tells the Gateway the payment is confirmed before the customer has actually paid. The order ships, but no money was collected. The merchant loses the product and the revenue. The correct flow is to return `undefined` and use the `callbackUrl` to notify the Gateway when the payment is confirmed.

**Detection**
If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect-based), STOP. Async methods must return `"undefined"` and use callbacks.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const isAsyncMethod = ["BankInvoice", "Pix"].includes(paymentMethod);

  if (isAsyncMethod) {
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

**Wrong**
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

## Preferred pattern

Payment state store with idempotency support:

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
```

Idempotent Create Payment with state machine:

```typescript
const store = new PaymentStore();

async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  // Idempotency check
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json(existing.response);
    return;
  }

  const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);
  const result = await acquirer.process(req.body);

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
    paymentId, status, response, callbackUrl,
    createdAt: new Date(), updatedAt: new Date(),
  });

  res.status(200).json(response);
}
```

Idempotent Cancel with `requestId` guard and state validation:

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
  if (!payment || !["undefined", "approved"].includes(payment.status)) {
    res.status(200).json({
      paymentId,
      cancellationId: null,
      code: "cancel-failed",
      message: `Cannot cancel payment in ${payment?.status ?? "unknown"} state`,
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
    requestId, paymentId, operation: "cancel", response, createdAt: new Date(),
  });

  res.status(200).json(response);
}
```

## Common failure modes

- **Processing duplicate payments** — Calling the acquirer for every Create Payment request without checking if the `paymentId` already exists. The Gateway retries `undefined` payments for up to 7 days, so a single $100 payment can result in hundreds of duplicate charges.
- **Synchronous approval of async payment methods** — Returning `status: "approved"` immediately for Boleto or Pix before the customer has actually paid. The order ships without payment collected.
- **Losing state between retries** — Storing payment state in memory (`Map`, local variable) instead of a persistent database. On process restart, all state is lost and the next retry creates a duplicate charge.
- **Generating new identifiers for duplicate requests** — Returning different `tid`, `nsu`, or `authorizationId` values when the Gateway retries with the same `paymentId`. This breaks Gateway reconciliation and can cause double settlements.
- **Ignoring requestId on Cancel/Capture/Refund** — Not checking `requestId` before processing operations, causing duplicate cancellations or refunds when the Gateway retries.

## Review checklist

- [ ] Does the Create Payment handler check the data store for an existing `paymentId` before calling the acquirer?
- [ ] Are stored responses returned verbatim for duplicate `paymentId` requests?
- [ ] Do Cancel, Capture, and Refund handlers check for existing `requestId` before processing?
- [ ] Is the payment state machine enforced (e.g., cannot capture a cancelled payment)?
- [ ] Do async payment methods (Boleto, Pix) return `status: "undefined"` instead of `"approved"`?
- [ ] Is payment state stored in a persistent database (not in-memory)?
- [ ] Are `delayToCancel` values extended for async methods (e.g., 604800 seconds = 7 days)?

## Related skills

- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — Endpoint contracts and response shapes
- [`payment-async-flow`](../payment-async-flow/skill.md) — Callback URL notification and the 7-day retry window
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI compliance and Secure Proxy

## Reference

- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Official guide explaining idempotency requirements for Cancel, Capture, and Refund operations
- [Developing a Payment Connector for VTEX](https://help.vtex.com/en/docs/tutorials/developing-a-payment-connector-for-vtex) — Help Center guide with idempotency implementation steps using paymentId and VBase
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Detailed authorization, capture, and cancellation flow documentation including retry behavior
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including callback URL retry mechanics and 7-day retry window
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with requestId and paymentId field definitions

---

# PCI Compliance & Secure Proxy

## When this skill applies

Use this skill when:
- Building a payment connector that accepts credit cards, debit cards, or co-branded cards
- The connector needs to process card data or communicate with an acquirer
- Determining whether Secure Proxy is required for the hosting environment
- Auditing a connector for PCI DSS compliance (data storage, logging, transmission)

Do not use this skill for:
- PPP endpoint contracts and response shapes — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- Idempotency and duplicate prevention — use [`payment-idempotency`](../payment-idempotency/skill.md)
- Async payment flows (Boleto, Pix) and callbacks — use [`payment-async-flow`](../payment-async-flow/skill.md)

## Decision rules

- If the connector is hosted in a non-PCI environment (including all VTEX IO apps), it MUST use Secure Proxy.
- If the connector has PCI DSS certification (AOC signed by a QSA), it can call the acquirer directly with raw card data.
- Check for `secureProxyUrl` in the Create Payment request — if present, Secure Proxy is active and MUST be used.
- Card tokens (`numberToken`, `holderToken`, `cscToken`) are only valid when sent through the `secureProxyUrl` — the proxy replaces them with real data before forwarding to the acquirer.
- Only `card.bin` (first 6 digits), `card.numberLength`, and `card.expiration` may be stored. Everything else is forbidden.
- Card data must never appear in logs, databases, files, caches, error trackers, or APM tools — even in development.

## Hard constraints

### Constraint: MUST use secureProxyUrl for non-PCI environments

If the connector is hosted in a non-PCI environment (including all VTEX IO apps), it MUST use the `secureProxyUrl` from the Create Payment request to communicate with the acquirer. It MUST NOT call the acquirer directly with raw card data. If a `secureProxyUrl` field is present in the request, Secure Proxy is active and MUST be used.

**Why this matters**
Non-PCI environments are not authorized to handle raw card data. Calling the acquirer directly bypasses the Gateway's secure data handling, violating PCI DSS. This can result in data breaches, massive fines ($100K+ per month), loss of card processing ability, and legal liability.

**Detection**
If the connector calls an acquirer endpoint directly (without going through `secureProxyUrl`) when `secureProxyUrl` is present in the request, STOP immediately. All acquirer communication must go through the Secure Proxy.

**Correct**
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

**Wrong**
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

### Constraint: MUST NOT store raw card data

The connector MUST NOT store the full card number (PAN), CVV/CSC, cardholder name, or any card token values in any persistent storage — database, file system, cache, session store, or any other durable medium. Card data must only exist in memory during the request lifecycle.

**Why this matters**
Storing raw card data violates PCI DSS Requirement 3. A data breach exposes customers to fraud. Consequences include fines of $5,000–$100,000 per month from card networks, mandatory forensic investigation costs ($50K+), loss of ability to process cards, class-action lawsuits, and criminal liability in some jurisdictions.

**Detection**
If the code writes card number, CVV, cardholder name, or token values to a database, file, cache (Redis, VBase), or any persistent store, STOP immediately. Only `card.bin` (first 6 digits) and `card.numberLength` may be stored.

**Correct**
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

**Wrong**
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

### Constraint: MUST NOT log sensitive card data

The connector MUST NOT log card numbers, CVV/CSC values, cardholder names, or token values to any logging system — console, file, monitoring service, error tracker, or APM tool. Even in debug mode. Even in development.

**Why this matters**
Logs are typically stored in plaintext, retained for extended periods, and accessible to many team members. Card data in logs is a PCI DSS violation and a data breach. Log aggregation services (Datadog, Splunk, CloudWatch) may store data across multiple regions, amplifying the breach scope.

**Detection**
If the code contains `console.log`, `console.error`, `logger.info`, `logger.debug`, or any logging call that includes `card.number`, `card.csc`, `card.holder`, `card.numberToken`, `card.holderToken`, `card.cscToken`, or the full request body without redaction, STOP immediately. Redact or omit all sensitive fields before logging.

**Correct**
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

**Wrong**
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

## Preferred pattern

Secure Proxy data flow:

```text
1. Gateway → POST /payments (with secureProxyUrl + tokenized card data) → Connector
2. Connector → POST secureProxyUrl (tokens in body, X-PROVIDER-Forward-To: acquirer URL) → Gateway
3. Gateway replaces tokens with real card data → POST acquirer URL → Acquirer
4. Acquirer → response → Gateway → Connector
5. Connector → Create Payment response → Gateway
```

Detect Secure Proxy mode:

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

Build acquirer request using tokens or raw values:

```typescript
function buildAcquirerRequest(paymentReq: CreatePaymentRequest) {
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

Call acquirer through Secure Proxy with proper headers:

```typescript
async function callAcquirerViaProxy(
  secureProxyUrl: string,
  acquirerRequest: object
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
async function callAcquirerDirect(acquirerRequest: object): Promise<AcquirerResponse> {
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

Safe logging utility:

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
```

## Common failure modes

- **Direct card handling in non-PCI environment** — Calling the acquirer API directly without using the Secure Proxy. The acquirer receives tokens (e.g., `#vtex#token#d799bae#number#`) instead of real card numbers and rejects the transaction. Even if raw data were available, transmitting it from a non-PCI environment is a PCI DSS violation.
- **Storing full card numbers (PANs)** — Persisting the full card number in a database for "reference" or "reconciliation". A single breach of this data can result in $100K/month fines, mandatory forensic audits, and permanent loss of card processing ability.
- **Logging card details for debugging** — Adding `console.log(req.body)` or `console.log(card)` to troubleshoot payment issues and forgetting to remove it. Card data ends up in log files, monitoring dashboards, and log aggregation services. This is a PCI violation even in development.
- **Stripping X-PROVIDER-Forward headers** — Sending requests to the Secure Proxy without the `X-PROVIDER-Forward-To` header. The proxy does not know where to forward the request and returns an error.
- **Storing token values** — Writing `card.numberToken`, `card.holderToken`, or `card.cscToken` to a database or cache, treating them as "safe" because they are tokens. Tokens reference real card data and must not be persisted.

## Review checklist

- [ ] Does the connector use `secureProxyUrl` when it is present in the request?
- [ ] Is `X-PROVIDER-Forward-To` set to the acquirer's API URL in Secure Proxy calls?
- [ ] Are custom acquirer headers prefixed with `X-PROVIDER-Forward-` when going through the proxy?
- [ ] Is only `card.bin`, `card.numberLength`, and `card.expiration` stored in the database?
- [ ] Are card numbers, CVV, holder names, and token values excluded from all log statements?
- [ ] Is there a redaction utility for safely logging payment request data?
- [ ] Does the connector support both Secure Proxy (non-PCI) and direct (PCI-certified) modes?
- [ ] Are error responses logged without including the acquirer request body (which contains tokens)?

## Related skills

- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — Endpoint contracts and response shapes
- [`payment-idempotency`](../payment-idempotency/skill.md) — `paymentId`/`requestId` idempotency and state machine
- [`payment-async-flow`](../payment-async-flow/skill.md) — Async payment methods, callbacks, and the 7-day retry window

## Reference

- [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy) — Complete Secure Proxy documentation including flow diagrams, request/response examples, custom tokens, and supported JsonLogic operators
- [PCI DSS Compliance](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance) — PCI certification requirements, AOC submission process, and when Secure Proxy is mandatory
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint implementation guide including Create Payment request body with secureProxyUrl and tokenized card fields
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including PCI prerequisites and Secure Proxy requirements
- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — VTEX IO framework for payment connectors (Secure Proxy mandatory for all IO apps)
- [PCI Security Standards Council](https://www.pcisecuritystandards.org/) — Official PCI DSS requirements and compliance documentation

---

# PPP Endpoint Implementation

## When this skill applies

Use this skill when:

- Building a new payment connector middleware that integrates a PSP with the VTEX Payment Gateway
- Implementing, debugging, or extending any of the 9 PPP endpoints
- Preparing a connector for VTEX Payment Provider Test Suite homologation

Do not use this skill for:

- Idempotency and duplicate prevention logic — use [`payment-idempotency`](../payment-idempotency/skill.md)
- Async payment flows and callback URLs — use [`payment-async-flow`](../payment-async-flow/skill.md)
- PCI compliance and Secure Proxy card handling — use [`payment-pci-security`](../payment-pci-security/skill.md)

## Decision rules

- The connector MUST implement all 6 payment-flow endpoints: Manifest, Create Payment, Cancel, Capture/Settle, Refund, Inbound Request.
- The configuration flow (3 endpoints: Create Auth Token, Provider Auth Redirect, Get Credentials) is optional but recommended for merchant onboarding.
- All endpoints must be served over HTTPS on port 443 with TLS 1.2.
- The connector must respond in under 5 seconds during homologation tests and under 20 seconds in production.
- The provider must be PCI-DSS certified or use Secure Proxy for card payments.
- The Gateway initiates all calls. The middleware never calls the Gateway except via `callbackUrl` (async notifications) and Secure Proxy (card data forwarding).

## Hard constraints

### Constraint: Implement all required payment flow endpoints

The connector MUST implement all six payment-flow endpoints: GET `/manifest`, POST `/payments`, POST `/payments/{paymentId}/cancellations`, POST `/payments/{paymentId}/settlements`, POST `/payments/{paymentId}/refunds`, and POST `/payments/{paymentId}/inbound-request/{action}`.

**Why this matters**
The VTEX Payment Provider Test Suite validates every endpoint during homologation. Missing endpoints cause test failures and the connector will not be approved. At runtime, the Gateway expects all endpoints — a missing cancel endpoint means payments cannot be voided.

**Detection**
If the connector router/handler file does not define handlers for all 6 payment-flow paths, STOP and add the missing endpoints before proceeding.

**Correct**

```typescript
import { Router } from "express";

const router = Router();

// All 6 payment-flow endpoints implemented
router.get("/manifest", manifestHandler);
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);
router.post("/payments/:paymentId/refunds", refundPaymentHandler);
router.post(
  "/payments/:paymentId/inbound-request/:action",
  inboundRequestHandler,
);

export default router;
```

**Wrong**

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

### Constraint: Return correct HTTP status codes and response shapes

Each endpoint MUST return the exact response shape documented in the PPP API. Create Payment MUST return `paymentId`, `status`, `authorizationId`, `tid`, `nsu`, `acquirer`, `code`, `message`, `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, and `delayToCancel`. Cancel MUST return `paymentId`, `cancellationId`, `code`, `message`, `requestId`. Capture MUST return `paymentId`, `settleId`, `value`, `code`, `message`, `requestId`. Refund MUST return `paymentId`, `refundId`, `value`, `code`, `message`, `requestId`.

**Why this matters**
The Gateway parses these fields programmatically. Missing fields cause deserialization errors and the Gateway treats the payment as failed. Incorrect `delayToAutoSettle` values cause payments to auto-cancel or auto-capture at wrong times.

**Detection**
If a response object is missing any of the required fields for its endpoint, STOP and add the missing fields.

**Correct**

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

async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, value, currency, paymentMethod, card, callbackUrl } =
    req.body;

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
    delayToAutoSettle: 21600, // 6 hours in seconds
    delayToAutoSettleAfterAntifraud: 1800, // 30 minutes in seconds
    delayToCancel: 21600, // 6 hours in seconds
  };

  res.status(200).json(response);
}
```

**Wrong**

```typescript
// Missing required fields — Gateway will reject this response
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await processPaymentWithAcquirer(req.body);

  // Missing: authorizationId, nsu, tid, acquirer, code, message,
  // delayToAutoSettle, delayToAutoSettleAfterAntifraud, delayToCancel
  res.status(200).json({
    paymentId: req.body.paymentId,
    status: result.status,
  });
}
```

### Constraint: Manifest must declare all supported payment methods

The GET `/manifest` endpoint MUST return a `paymentMethods` array listing every payment method the connector supports, with the correct `name` and `allowsSplit` configuration for each.

**Why this matters**
The Gateway reads the manifest to determine which payment methods are available. If a method is missing, merchants cannot configure it in the VTEX Admin. An incorrect `allowsSplit` value causes split payment failures.

**Detection**
If the manifest handler returns an empty `paymentMethods` array or hardcodes methods the provider does not actually support, STOP and fix the manifest.

**Correct**

```typescript
async function manifestHandler(_req: Request, res: Response): Promise<void> {
  const manifest = {
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

**Wrong**

```typescript
// Empty manifest — no payment methods will appear in the Admin
async function manifestHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ paymentMethods: [] });
}
```

## Preferred pattern

Architecture overview:

```text
Shopper → VTEX Checkout → VTEX Payment Gateway → [Your Connector Middleware] → Acquirer/PSP
                                ↕
                    Configuration Flow (Admin)
```

Recommended TypeScript interfaces for all endpoint contracts:

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
interface CancelPaymentResponse {
  paymentId: string;
  cancellationId: string | null;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Capture/Settle Payment ---
interface CapturePaymentResponse {
  paymentId: string;
  settleId: string | null;
  value: number;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Refund Payment ---
interface RefundPaymentResponse {
  paymentId: string;
  refundId: string | null;
  value: number;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Inbound Request ---
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

Complete payment flow router with all 6 endpoints:

```typescript
import { Router, Request, Response } from "express";

const router = Router();

router.get("/manifest", async (_req: Request, res: Response) => {
  res.status(200).json({
    paymentMethods: [
      { name: "Visa", allowsSplit: "onCapture" },
      { name: "Mastercard", allowsSplit: "onCapture" },
      { name: "Pix", allowsSplit: "disabled" },
    ],
  });
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

router.post(
  "/payments/:paymentId/cancellations",
  async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    const { requestId } = req.body;
    const result = await cancelWithAcquirer(paymentId);

    res.status(200).json({
      paymentId,
      cancellationId: result.cancellationId ?? null,
      code: result.code ?? null,
      message: result.message ?? "Successfully cancelled",
      requestId,
    });
  },
);

router.post(
  "/payments/:paymentId/settlements",
  async (req: Request, res: Response) => {
    const body = req.body;
    const result = await captureWithAcquirer(body.paymentId, body.value);

    res.status(200).json({
      paymentId: body.paymentId,
      settleId: result.settleId ?? null,
      value: result.capturedValue ?? body.value,
      code: result.code ?? null,
      message: result.message ?? null,
      requestId: body.requestId,
    });
  },
);

router.post(
  "/payments/:paymentId/refunds",
  async (req: Request, res: Response) => {
    const body = req.body;
    const result = await refundWithAcquirer(body.paymentId, body.value);

    res.status(200).json({
      paymentId: body.paymentId,
      refundId: result.refundId ?? null,
      value: result.refundedValue ?? body.value,
      code: result.code ?? null,
      message: result.message ?? null,
      requestId: body.requestId,
    });
  },
);

router.post(
  "/payments/:paymentId/inbound-request/:action",
  async (req: Request, res: Response) => {
    const body = req.body;
    const result = await handleInbound(body);

    res.status(200).json({
      requestId: body.requestId,
      paymentId: body.paymentId,
      responseData: {
        statusCode: 200,
        contentType: "application/json",
        content: JSON.stringify(result),
      },
    });
  },
);

export default router;
```

Configuration flow endpoints (optional, for merchant onboarding):

```typescript
import { Router, Request, Response } from "express";

const configRouter = Router();

// 1. POST /authorization/token
configRouter.post(
  "/authorization/token",
  async (req: Request, res: Response) => {
    const { applicationId, returnUrl } = req.body;
    const token = await generateAuthorizationToken(applicationId, returnUrl);
    res.status(200).json({ applicationId, token });
  },
);

// 2. GET /authorization/redirect
configRouter.get(
  "/authorization/redirect",
  async (req: Request, res: Response) => {
    const { token } = req.query;
    const providerLoginUrl = buildProviderLoginUrl(token as string);
    res.redirect(302, providerLoginUrl);
  },
);

// 3. GET /authorization/credentials
configRouter.get(
  "/authorization/credentials",
  async (req: Request, res: Response) => {
    const { authorizationCode } = req.query;
    const credentials = await exchangeCodeForCredentials(
      authorizationCode as string,
    );
    res.status(200).json({
      applicationId: "vtex",
      appKey: credentials.appKey,
      appToken: credentials.appToken,
    });
  },
);

export default configRouter;
```

## Common failure modes

- **Partial endpoint implementation** — Implementing only Create Payment and Capture while skipping Manifest, Cancel, Refund, and Inbound Request. The Test Suite tests all endpoints and will fail homologation. At runtime, the Gateway cannot cancel or refund payments.
- **Incorrect HTTP methods** — Using POST for the Manifest endpoint or GET for Create Payment. The Gateway sends specific HTTP methods; mismatched handlers return 404 or 405.
- **Missing or zero delay values** — Omitting `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, or `delayToCancel` from the Create Payment response, or setting them to zero. This causes immediate auto-capture or auto-cancel, leading to premature settlement or lost payments.
- **Incomplete response shapes** — Returning only `paymentId` and `status` without `authorizationId`, `tid`, `nsu`, `acquirer`, etc. The Gateway deserializes all fields and treats missing ones as failures.

## Review checklist

- [ ] Are all 6 payment-flow endpoints implemented (Manifest, Create Payment, Cancel, Capture, Refund, Inbound Request)?
- [ ] Does each endpoint return the complete response shape with all required fields?
- [ ] Does the Manifest declare all payment methods the provider actually supports?
- [ ] Are the correct HTTP methods used (GET for Manifest, POST for everything else)?
- [ ] Are `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, and `delayToCancel` set to sensible non-zero values?
- [ ] Is the connector served over HTTPS on port 443 with TLS 1.2?
- [ ] Does the connector respond within 5 seconds for test suite and 20 seconds in production?
- [ ] Are configuration flow endpoints implemented if merchant self-onboarding is needed?

## Related skills

- [`payment-idempotency`](../payment-idempotency/skill.md) — Idempotency keys (`paymentId`, `requestId`) and state machine for duplicate prevention
- [`payment-async-flow`](../payment-async-flow/skill.md) — Async payment methods, `callbackUrl`, and the 7-day retry window
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI compliance, Secure Proxy, and card data handling

## Reference

- [Payment Provider Protocol Overview](https://developers.vtex.com/docs/guides/payment-provider-protocol-api-overview) — API overview with endpoint requirements, common parameters, and test suite info
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Step-by-step guide covering all 9 endpoints with request/response examples
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — High-level protocol explanation including payment flow diagrams and callback URL usage
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization, capture, and cancellation flow details
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full OpenAPI specification for all PPP endpoints
- [Integrating a New Payment Provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex) — End-to-end integration guide from development to homologation

---

# Custom VTEX IO Apps

# App Architecture & Manifest Configuration

## When this skill applies

Use this skill when working with the foundational structure of a VTEX IO app — the `manifest.json` file, builder system, policy declarations, dependency management, `service.json` resource limits, and app lifecycle (link, publish, deploy).

- Creating a new VTEX IO app from scratch
- Adding a builder to an existing app
- Configuring policies for API access
- Troubleshooting deployment failures related to manifest misconfiguration

Do not use this skill for:

- Backend service implementation details (use `vtex-io-service-apps` instead)
- React component development (use `vtex-io-react-apps` instead)
- GraphQL schema and resolver details (use `vtex-io-graphql-api` instead)

## Decision rules

- Every VTEX IO app starts with `manifest.json` — it defines identity (`vendor`, `name`, `version`), builders, dependencies, and policies.
- Use the builder that matches the directory: `node` for `/node`, `react` for `/react`, `graphql` for `/graphql`, `admin` for `/admin`, `pixel` for `/pixel`, `messages` for `/messages`, `store` for `/store`, `masterdata` for `/masterdata`, `styles` for `/styles`.
- Declare policies for every external host your app calls and every VTEX Admin resource it accesses.
- Use `service.json` in `/node` to configure memory (max 512MB), timeout, autoscaling, and route definitions.
- Use semver ranges (`3.x`) for dependencies, not exact versions.
- Use `peerDependencies` for apps that must be present but should not be auto-installed.

Builders reference:

| Builder      | Directory     | Purpose                                                                 |
| ------------ | ------------- | ----------------------------------------------------------------------- |
| `node`       | `/node`       | Backend services in TypeScript (middlewares, resolvers, event handlers) |
| `react`      | `/react`      | Frontend React components in TypeScript/TSX                             |
| `graphql`    | `/graphql`    | GraphQL schema definitions (`.graphql` files)                           |
| `admin`      | `/admin`      | Admin panel pages and navigation entries                                |
| `pixel`      | `/pixel`      | Pixel/tracking apps that inject scripts into the storefront             |
| `messages`   | `/messages`   | Internationalization — localized string files per locale                |
| `store`      | `/store`      | Store Framework theme blocks, interfaces, and routes                    |
| `masterdata` | `/masterdata` | Master Data v2 entity schemas and triggers                              |
| `styles`     | `/styles`     | CSS/Tachyons configuration for Store Framework themes                   |

Policy types:

1. **Outbound-access policies**: Grant access to explicit URLs (external APIs or VTEX endpoints).
2. **License Manager policies**: Grant access to VTEX Admin resources using resource keys.
3. **App role-based policies**: Grant access to routes or GraphQL queries exposed by other IO apps, using the format `{vendor}.{app-name}:{policy-name}`.

Architecture:

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

## Hard constraints

### Constraint: Declare All Required Builders

Every directory in your app that contains processable code MUST have a corresponding builder declared in `manifest.json`. If you have a `/node` directory, the `node` builder MUST be declared. If you have a `/react` directory, the `react` builder MUST be declared.

**Why this matters**

Without the builder declaration, the VTEX IO platform ignores the directory entirely. Your backend code will not compile, your React components will not render, and your GraphQL schemas will not be registered. The app will link successfully but the functionality will silently be absent.

**Detection**

If you see backend TypeScript code in a `/node` directory but the manifest does not declare `"node": "7.x"` in `builders`, STOP and add the builder. Same applies to `/react` without `"react": "3.x"`, `/graphql` without `"graphql": "1.x"`, etc.

**Correct**

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

**Wrong**

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
```

Missing "node" and "graphql" builders — the /node and /graphql directories will be completely ignored. Backend code won't compile, GraphQL schema won't be registered. The app links without errors but nothing works.

---

### Constraint: Declare Policies for All External Access

Every external API call or VTEX resource access MUST have a corresponding policy in `manifest.json`. This includes outbound HTTP calls to external hosts, VTEX Admin resource access, and consumption of other apps' GraphQL APIs.

**Why this matters**

VTEX IO sandboxes apps for security. Without the proper policy, any outbound HTTP request will be blocked at the infrastructure level, returning a `403 Forbidden` error. This is not a code issue — it is a platform-level restriction.

**Detection**

If you see code making API calls (via clients or HTTP) to a host, STOP and verify that an `outbound-access` policy exists for that host in the manifest. If you see `licenseManager.canAccessResource(...)`, verify a License Manager policy exists.

**Correct**

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

**Wrong**

```json
{
  "policies": []
}
```

Empty policies array while the app makes calls to api.vtex.com and uses Master Data. All outbound requests will fail at runtime with 403 Forbidden errors that are difficult to debug.

---

### Constraint: Follow App Naming Conventions

App names MUST be in kebab-case (lowercase letters separated by hyphens). The vendor MUST match the VTEX account name. Version MUST follow Semantic Versioning 2.0.0.

**Why this matters**

Apps with invalid names cannot be published to the VTEX App Store. Names with special characters or uppercase letters will be rejected by the builder-hub. Vendor mismatch prevents the account from managing the app.

**Detection**

If you see an app name with uppercase letters, underscores, special characters, or numbers at the beginning, STOP and fix the name.

**Correct**

```json
{
  "name": "order-status-dashboard",
  "vendor": "mycompany",
  "version": "2.1.3"
}
```

**Wrong**

```json
{
  "name": "Order_Status_Dashboard",
  "vendor": "mycompany",
  "version": "2.1"
}
```

Uppercase letters and underscores in the name will be rejected. Version "2.1" is not valid semver — must be "2.1.0".

## Preferred pattern

Initialize with the VTEX IO CLI:

```bash
vtex init
```

Select the appropriate template: `service-example`, `graphql-example`, `react-app-template`, or `store-theme`.

Recommended manifest configuration:

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

Recommended `service.json` for backend apps:

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

Recommended directory structure:

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

Full `manifest.json` for a comprehensive app using multiple builders:

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

## Common failure modes

- **Declaring unused builders**: Adding builders "just in case" creates overhead during the build process. Unused builder directories can cause build warnings. Only declare builders your app actively uses.
- **Wildcard outbound policies**: Using `"host": "*"` or `"path": "/*"` is a security risk, will be rejected during app review, and makes security audits difficult. Declare specific policies for each external service.
- **Hardcoding version in dependencies**: Pinning exact versions like `"vtex.store-components": "3.165.0"` prevents receiving bug fixes. Use major version ranges with `x` wildcard: `"vtex.store-components": "3.x"`.

## Review checklist

- [ ] Does every code directory (`/node`, `/react`, `/graphql`, etc.) have a matching builder in `manifest.json`?
- [ ] Are all external hosts and VTEX resources declared in `policies`?
- [ ] Is the app name kebab-case, vendor matching account, version valid semver?
- [ ] Does `service.json` exist for apps with the `node` builder?
- [ ] Are dependencies using major version ranges (`3.x`) instead of exact versions?
- [ ] Are placeholder values (vendor, app name, policies) replaced with real values?

## Reference

- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) — Complete reference for all manifest.json fields and their usage
- [Builders](https://developers.vtex.com/docs/guides/vtex-io-documentation-builders) — Full list of available builders with descriptions and usage examples
- [Policies](https://developers.vtex.com/docs/guides/vtex-io-documentation-policies) — How to declare outbound-access, License Manager, and role-based policies
- [Dependencies](https://developers.vtex.com/docs/guides/vtex-io-documentation-dependencies) — Managing app dependencies and peer dependencies
- [Accessing External Resources](https://developers.vtex.com/docs/guides/accessing-external-resources-within-a-vtex-io-app) — Policy types and patterns for external API access
- [Creating a New App](https://developers.vtex.com/docs/guides/vtex-io-documentation-3-creating-the-new-app) — Step-by-step guide for app initialization

---

# GraphQL Schemas & Resolvers

## When this skill applies

Use this skill when your VTEX IO app needs to expose a GraphQL API — either for frontend React components to query, for other VTEX IO apps to consume, or for implementing custom data aggregation layers over VTEX Commerce APIs.

- Defining schemas in `.graphql` files in the `/graphql` directory
- Writing resolver functions in TypeScript in `/node/resolvers/`
- Configuring `@cacheControl` and `@auth` directives
- Wiring resolvers into the Service class

Do not use this skill for:
- Backend service structure and client system (use `vtex-io-service-apps` instead)
- Manifest and builder configuration (use `vtex-io-app-structure` instead)
- MasterData integration details (use `vtex-io-masterdata` instead)

## Decision rules

- The `graphql` builder processes `.graphql` files in `/graphql` and merges them into a single schema.
- Split definitions across multiple files for maintainability: `schema.graphql` for root types, `directives.graphql` for directive declarations, `types/*.graphql` for custom types.
- Use `@cacheControl(scope: PUBLIC, maxAge: SHORT|MEDIUM|LONG)` on all public Query fields. `PUBLIC` = shared CDN cache, `PRIVATE` = per-user cache.
- Use `@auth` on all Mutations and on Queries that return sensitive or user-specific data.
- Never use `@cacheControl` on Mutations.
- Resolver function keys in the Service entry point MUST exactly match the field names in `schema.graphql`.
- Always use `ctx.clients` in resolvers for data access — never raw HTTP calls.

Recommended directory structure:

```text
graphql/
├── schema.graphql        # Query and Mutation root type definitions
├── directives.graphql    # Custom directive declarations (@cacheControl, @auth)
└── types/
    ├── Review.graphql    # Custom type definitions
    └── Product.graphql   # One file per type for organization
```

Built-in directives:
- **`@cacheControl`**: `scope` (`PUBLIC`/`PRIVATE`), `maxAge` (`SHORT` 30s, `MEDIUM` 5min, `LONG` 1h)
- **`@auth`**: Enforces valid VTEX authentication token. Without it, unauthenticated users can call the endpoint.
- **`@smartcache`**: Automatically caches query results in VTEX infrastructure.

## Hard constraints

### Constraint: Declare the graphql Builder

Any app using `.graphql` schema files MUST declare the `graphql` builder in `manifest.json`. The `graphql` builder interprets the schema and registers it with the VTEX IO runtime.

**Why this matters**

Without the `graphql` builder declaration, the `/graphql` directory is completely ignored. Schema files will not be processed, resolvers will not be registered, and GraphQL queries will return "schema not found" errors. The app will link without errors but GraphQL will silently not work.

**Detection**

If you see `.graphql` files in a `/graphql` directory but the manifest does not include `"graphql": "1.x"` in `builders`, STOP and add the builder declaration.

**Correct**

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x"
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

Missing `"graphql": "1.x"` — the `/graphql` directory with schema files is ignored. GraphQL queries return errors because no schema is registered. The app links successfully, masking the problem.

---

### Constraint: Use @cacheControl on Public Queries

All public-facing Query fields (those fetching data that is not user-specific) MUST include the `@cacheControl` directive with an appropriate `scope` and `maxAge`. Mutations MUST NOT use `@cacheControl`.

**Why this matters**

Without `@cacheControl`, every query hits your resolver on every request — no CDN caching, no edge caching, no shared caching. This leads to unnecessary load on VTEX infrastructure, slow response times, and potential rate limiting. For public product data, caching is critical for performance.

**Detection**

If a Query field returns public data (not user-specific) and does not have `@cacheControl`, warn the developer to add it. If a Mutation has `@cacheControl`, STOP and remove it.

**Correct**

```graphql
type Query {
  reviews(productId: String!, limit: Int): [Review]
    @cacheControl(scope: PUBLIC, maxAge: SHORT)

  productMetadata(slug: String!): ProductMetadata
    @cacheControl(scope: PUBLIC, maxAge: MEDIUM)

  myReviews: [Review]
    @cacheControl(scope: PRIVATE, maxAge: SHORT)
    @auth
}

type Mutation {
  createReview(review: ReviewInput!): Review @auth
}
```

**Wrong**

```graphql
type Query {
  reviews(productId: String!, limit: Int): [Review]

  myReviews: [Review]
}

type Mutation {
  createReview(review: ReviewInput!): Review
    @cacheControl(scope: PUBLIC, maxAge: LONG)
}
```

No cache control on queries (every request hits the resolver), missing `@auth` on user-specific data, and `@cacheControl` on a mutation (makes no sense).

---

### Constraint: Resolver Names Must Match Schema Fields

Resolver function keys in the Service entry point MUST exactly match the field names defined in `schema.graphql`. The resolver object structure must mirror the GraphQL type hierarchy.

**Why this matters**

The GraphQL runtime maps incoming queries to resolver functions by name. If the resolver key does not match the schema field name, the field will resolve to `null` without any error — a silent failure that is extremely difficult to debug.

**Detection**

If a schema field has no matching resolver key (or vice versa), STOP. Cross-check every Query and Mutation field against the resolver registration in `node/index.ts`.

**Correct**

```graphql
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

**Wrong**

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
```

Both fields will silently resolve to null. No error in logs.

## Preferred pattern

Add the GraphQL builder to manifest:

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x"
  }
}
```

Define the schema:

```graphql
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

Define custom types:

```graphql
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

Declare directives:

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

Implement resolvers:

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

Wire resolvers into the Service:

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

Testing the GraphQL API after linking:

```graphql
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

## Common failure modes

- **Defining resolvers without matching schema fields**: The GraphQL runtime only exposes fields defined in the schema. Resolvers without matching fields are silently ignored. Conversely, schema fields without resolvers return `null`. Always define the schema first, then implement matching resolvers with identical names.
- **Querying external APIs directly in resolvers**: Using `fetch()` or `axios` bypasses the `@vtex/api` client system, losing caching, retries, metrics, and authentication. Always use `ctx.clients` in resolvers.
- **Missing @auth on mutation endpoints**: Without `@auth`, any anonymous user can call the mutation — a critical security vulnerability. Always add `@auth` to mutations and queries returning sensitive data.
- **Missing @cacheControl on public queries**: Every request hits the resolver without caching, causing unnecessary load and slow responses. Add appropriate cache directives to all public Query fields.

## Review checklist

- [ ] Is the `graphql` builder declared in `manifest.json`?
- [ ] Do all public Query fields have `@cacheControl` with appropriate scope and maxAge?
- [ ] Do all Mutations and sensitive Queries have `@auth`?
- [ ] Do resolver function keys exactly match schema field names?
- [ ] Are resolvers using `ctx.clients` for data access (no raw HTTP calls)?
- [ ] Are directive declarations present in `directives.graphql`?
- [ ] Is the resolver wired into the Service entry point under `graphql.resolvers`?

## Related skills

- [`vtex-io-service-apps`](../vtex-io-service-apps/skill.md) — Service app fundamentals needed for all GraphQL resolvers
- [`vtex-io-app-structure`](../vtex-io-app-structure/skill.md) — Manifest and builder configuration that GraphQL depends on
- [`vtex-io-masterdata`](../vtex-io-masterdata/skill.md) — MasterData integration commonly used as a data source in resolvers

## Reference

- [GraphQL in VTEX IO](https://developers.vtex.com/docs/guides/graphql-in-vtex-io) — Overview of GraphQL usage in the VTEX IO platform
- [GraphQL Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-graphql-builder) — Builder reference for schema processing and directory structure
- [Developing a GraphQL API in Service Apps](https://developers.vtex.com/docs/guides/developing-a-graphql-api-in-service-apps) — Step-by-step tutorial for building GraphQL APIs
- [Integrating an App with a GraphQL API](https://developers.vtex.com/docs/guides/integrating-an-app-with-a-graphql-api) — How to consume GraphQL APIs from other VTEX IO apps
- [GraphQL authorization in IO apps](https://developers.vtex.com/docs/guides/graphql-authorization-in-io-apps) — How to implement and use the `@auth` directive for protected GraphQL operations
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — How to implement and use the `@cacheControl` directive for GraphQL operations
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — How to use ctx.clients in resolvers for data access

---

# MasterData v2 Integration

## When this skill applies

Use this skill when your VTEX IO app needs to store custom data (reviews, wishlists, form submissions, configuration records), query or filter that data, or set up automated workflows triggered by data changes.

- Defining data entities and JSON Schemas using the `masterdata` builder
- Performing CRUD operations through MasterDataClient (`ctx.clients.masterdata`)
- Configuring search, scroll, and indexing for efficient data retrieval
- Setting up Master Data triggers for automated workflows
- Managing schema lifecycle to avoid the 60-schema limit

Do not use this skill for:
- General backend service patterns (use `vtex-io-service-apps` instead)
- GraphQL schema definitions (use `vtex-io-graphql-api` instead)
- Manifest and builder configuration (use `vtex-io-app-structure` instead)

## Decision rules

- A **data entity** is a named collection of documents (analogous to a database table). A **JSON Schema** defines structure, validation, and indexing.
- When using the `masterdata` builder, entities are defined by folder structure: `masterdata/{entityName}/schema.json`. The builder creates entities named `{vendor}_{appName}_{entityName}`.
- Use `ctx.clients.masterdata` or `masterDataFor` from `@vtex/clients` for all CRUD operations — never direct REST calls.
- All fields used in `where` clauses MUST be declared in the schema's `v-indexed` array for efficient querying.
- Use `searchDocuments` for bounded result sets (known small size, max page size 100). Use `scrollDocuments` for large/unbounded result sets.
- The `masterdata` builder creates a new schema per app version. Clean up unused schemas to avoid the 60-schema-per-entity hard limit.

MasterDataClient methods:

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

Search `where` clause syntax:

```text
where: "productId=12345 AND approved=true"
where: "rating>3"
where: "createdAt between 2025-01-01 AND 2025-12-31"
```

Architecture:

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

## Hard constraints

### Constraint: Use MasterDataClient — Never Direct REST Calls

All Master Data operations in VTEX IO apps MUST go through the MasterDataClient (`ctx.clients.masterdata`) or the `masterDataFor` factory from `@vtex/clients`. You MUST NOT make direct REST calls to `/api/dataentities/` endpoints.

**Why this matters**

The MasterDataClient handles authentication token injection, request routing, retry logic, caching, and proper error handling. Direct REST calls bypass all of these, requiring manual auth headers, pagination, and retry logic. When the VTEX auth token format changes, direct calls break while the client handles it transparently.

**Detection**

If you see direct HTTP calls to URLs matching `/api/dataentities/`, `api.vtex.com/api/dataentities`, or raw fetch/axios calls targeting Master Data endpoints, warn the developer to use `ctx.clients.masterdata` instead.

**Correct**

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

**Wrong**

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

Every data entity your app uses MUST have a corresponding JSON Schema, either via the `masterdata` builder (recommended) or created via the Master Data API before the app is deployed.

**Why this matters**

Without a schema, Master Data stores documents as unstructured JSON. This means no field validation, no indexing (making search extremely slow on large datasets), no type safety, and no trigger support. Queries on unindexed fields perform full scans, which can time out or hit rate limits.

**Detection**

If the app creates or searches documents in a data entity but no JSON Schema exists for that entity (either in the `masterdata/` builder directory or via API), warn the developer to define a schema.

**Correct**

```json
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

**Wrong**

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

Master Data v2 data entities have a limit of 60 schemas per entity. When using the `masterdata` builder, each app version linked or installed creates a new schema. You MUST delete unused schemas regularly.

**Why this matters**

Once the 60-schema limit is reached, the `masterdata` builder cannot create new schemas, and linking or installing new app versions will fail. This is a hard platform limit that cannot be increased.

**Detection**

If the app has been through many link/install cycles, warn the developer to check and clean up old schemas using the Delete Schema API.

**Correct**

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

**Wrong**

```text
Never cleaning up schemas during development.
After 60 link cycles, the builder fails:
"Error: Maximum number of schemas reached for entity 'reviews'"
The app cannot be linked or installed until old schemas are deleted.
```

## Preferred pattern

Add the masterdata builder and policies:

```json
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

Define data entity schemas:

```json
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

Set up the client with `masterDataFor`:

```typescript
// node/clients/index.ts
import { IOClients } from '@vtex/api'
import { masterDataFor } from '@vtex/clients'

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

Implement CRUD operations:

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

Configure triggers (optional):

```json
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

Wire into Service:

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

## Common failure modes

- **Direct REST calls to /api/dataentities/**: Using `axios` or `fetch` to call Master Data endpoints bypasses the client infrastructure — no auth, no caching, no retries. Use `ctx.clients.masterdata` or `masterDataFor` instead.
- **Searching without indexed fields**: Queries on non-indexed fields trigger full document scans. For large datasets, this causes timeouts and rate limit errors. Ensure all `where` clause fields are in the schema's `v-indexed` array.
- **Not paginating search results**: Master Data v2 has a maximum page size of 100 documents. Requesting more silently returns only up to the limit. Use proper pagination or `scrollDocuments` for large result sets.
- **Ignoring the 60-schema limit**: Each app version linked/installed creates a new schema. After 60 link cycles, the builder fails. Periodically clean up unused schemas via the Delete Schema API.

## Review checklist

- [ ] Is the `masterdata` builder declared in `manifest.json`?
- [ ] Do all data entities have JSON Schemas with proper field definitions?
- [ ] Are all `where` clause fields declared in `v-indexed`?
- [ ] Are CRUD operations using `ctx.clients.masterdata` or `masterDataFor` (no direct REST calls)?
- [ ] Is pagination properly handled (max 100 per page, scroll for large sets)?
- [ ] Is there a plan for schema cleanup to avoid the 60-schema limit?
- [ ] Are required policies (`outbound-access`, `ADMIN_DS`) declared in the manifest?

## Reference

- [Creating a Master Data v2 CRUD App](https://developers.vtex.com/docs/guides/create-master-data-crud-app) — Complete guide for building Master Data apps with the masterdata builder
- [Working with JSON Schemas in Master Data v2](https://developers.vtex.com/docs/guides/working-with-json-schemas-in-master-data-v2) — Schema structure, validation, and indexing configuration
- [Schema Lifecycle](https://developers.vtex.com/docs/guides/master-data-schema-lifecycle) — How schemas evolve and impact data entities over time
- [Setting Up Triggers on Master Data v2](https://developers.vtex.com/docs/guides/setting-up-triggers-on-master-data-v2) — Trigger configuration for automated workflows
- [Master Data v2 API Reference](https://developers.vtex.com/docs/api-reference/master-data-api-v2#overview) — Complete API reference for all Master Data v2 endpoints
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — MasterDataClient methods and usage in VTEX IO

---

# Frontend React Components & Hooks

## When this skill applies

Use this skill when building VTEX IO frontend apps using the `react` builder — creating React components that integrate with Store Framework as theme blocks, configuring `interfaces.json`, setting up `contentSchemas.json` for Site Editor, and applying styling patterns.

- Creating custom storefront components (product displays, forms, banners)
- Building admin panel interfaces with VTEX Styleguide
- Registering components as Store Framework blocks
- Exposing component props in Site Editor via `contentSchemas.json`
- Applying `css-handles` for safe storefront styling

Do not use this skill for:
- Backend service implementation (use `vtex-io-service-apps` instead)
- GraphQL schema and resolver development (use `vtex-io-graphql-api` instead)
- Manifest and builder configuration (use `vtex-io-app-structure` instead)

## Decision rules

- Every visible storefront element is a **block**. Blocks are declared in theme JSON and map to React components via **interfaces**.
- `interfaces.json` (in `/store`) maps block names to React component files: `"component"` is the file name in `/react` (without extension), `"allowed"` lists child blocks, `"composition"` controls how children work (`"children"` or `"blocks"`).
- Each exported component MUST have a root-level file in `/react` that re-exports it. The builder resolves `"component": "ProductReviews"` to `react/ProductReviews.tsx`.
- For **storefront** components, use `vtex.css-handles` for styling (not inline styles, not global CSS).
- For **admin** components, use `vtex.styleguide` — the official VTEX Admin component library. No third-party UI libraries.
- Use `contentSchemas.json` in `/store` to make component props editable in Site Editor (JSON Schema format).
- Use `react-intl` and the `messages` builder for i18n — never hardcode user-facing strings.
- Fetch data via GraphQL queries (`useQuery` from `react-apollo`), never via direct API calls from the browser.

Architecture:

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

## Hard constraints

### Constraint: Declare Interfaces for All Storefront Blocks

Every React component that should be usable as a Store Framework block MUST have a corresponding entry in `store/interfaces.json`. Without the interface declaration, the block cannot be referenced in theme JSON files.

**Why this matters**

The store builder resolves block names to React components through `interfaces.json`. If a component has no interface, it is invisible to Store Framework and will not render on the storefront.

**Detection**

If a React component in `/react` is intended for storefront use but has no matching entry in `store/interfaces.json`, warn the developer. The component will compile but never render.

**Correct**

```json
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

**Wrong**

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

Admin panel components (apps using the `admin` builder) MUST use VTEX Styleguide (`vtex.styleguide`) for UI elements. You MUST NOT use third-party UI libraries like Material UI, Chakra UI, or Ant Design in admin apps.

**Why this matters**

VTEX Admin has a consistent design language enforced by Styleguide. Third-party UI libraries produce inconsistent visuals, may conflict with the Admin's global CSS, and add unnecessary bundle size. Apps submitted to the VTEX App Store with non-Styleguide admin UIs will fail review.

**Detection**

If you see imports from `@material-ui`, `@chakra-ui/react`, `@chakra-ui`, `antd`, or `@ant-design` in an admin app, warn the developer to use `vtex.styleguide` instead.

**Correct**

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

**Wrong**

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

Every Store Framework block component MUST have a root-level export file in the `/react` directory that matches the `component` value in `interfaces.json`. The actual implementation can live in subdirectories, but the root file must exist.

**Why this matters**

The react builder resolves components by looking for files at the root of `/react`. If `interfaces.json` declares `"component": "ProductReviews"`, the builder looks for `react/ProductReviews.tsx`. Without this root export file, the component will not be found and the block will fail to render.

**Detection**

If `interfaces.json` references a component name that does not have a matching file at the root of `/react`, STOP and create the export file.

**Correct**

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

**Wrong**

```text
react/components/ProductReviews/index.tsx exists but
react/ProductReviews.tsx does NOT exist.
The builder cannot find the component.
Error: "Could not find component ProductReviews"
```

## Preferred pattern

Create the React component inside a subdirectory:

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

Root export file:

```tsx
// react/ProductReviews.tsx
import ProductReviews from './components/ProductReviews'

export default ProductReviews
```

Block interface:

```json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-form"],
    "render": "client"
  }
}
```

Site Editor schema:

```json
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

Using the component in a Store Framework theme:

```json
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

## Common failure modes

- **Importing third-party UI libraries for admin apps**: Using `@material-ui/core`, `@chakra-ui/react`, or `antd` conflicts with VTEX Admin's global CSS, produces inconsistent visuals, and will fail App Store review. Use `vtex.styleguide` instead.
- **Directly calling APIs from React components**: Using `fetch()` or `axios` exposes authentication tokens to the client and bypasses CORS restrictions. Use GraphQL queries that resolve server-side via `useQuery` from `react-apollo`.
- **Hardcoded strings without i18n**: Components with hardcoded strings only work in one language. Use the `messages` builder and `react-intl` for internationalization.
- **Missing root-level export file**: If `interfaces.json` references `"component": "ProductReviews"` but `react/ProductReviews.tsx` doesn't exist, the block silently fails to render.

## Review checklist

- [ ] Does every storefront block have a matching entry in `store/interfaces.json`?
- [ ] Does every `interfaces.json` component have a root-level export file in `/react`?
- [ ] Are admin apps using `vtex.styleguide` (no third-party UI libraries)?
- [ ] Are storefront components using `css-handles` for styling?
- [ ] Is data fetched via GraphQL (`useQuery`), not direct API calls?
- [ ] Are user-facing strings using `react-intl` and the `messages` builder?
- [ ] Is `contentSchemas.json` defined for Site Editor-editable props?

## Reference

- [Developing Custom Storefront Components](https://developers.vtex.com/docs/guides/vtex-io-documentation-developing-custom-storefront-components) — Guide for building Store Framework components
- [Interfaces](https://developers.vtex.com/docs/guides/vtex-io-documentation-interface) — How interfaces map blocks to React components
- [React Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-react-builder) — React builder configuration and directory structure
- [Making a Custom Component Available in Site Editor](https://developers.vtex.com/docs/guides/vtex-io-documentation-making-a-custom-component-available-in-site-editor) — contentSchemas.json and Site Editor integration
- [Store Framework](https://developers.vtex.com/docs/guides/store-framework) — Overview of the block-based storefront system
- [Using Components](https://developers.vtex.com/docs/guides/store-framework-using-components) — How to use native and custom components in themes
- [VTEX Styleguide](https://styleguide.vtex.com/) — Official component library for VTEX Admin UIs

---

# Backend Service Apps & API Clients

## When this skill applies

Use this skill when developing a VTEX IO app that needs backend logic — REST API routes, GraphQL resolvers, event handlers, scheduled tasks, or integrations with VTEX Commerce APIs and external services.

- Building the Service entry point (`node/index.ts`) with typed context, clients, and state
- Creating and registering custom clients extending JanusClient or ExternalClient
- Using `ctx.clients` to access clients with built-in caching, retry, and metrics
- Configuring routes and middleware chains in service.json

Do not use this skill for:
- Manifest and builder configuration (use `vtex-io-app-structure` instead)
- GraphQL schema definitions (use `vtex-io-graphql-api` instead)
- React component development (use `vtex-io-react-apps` instead)

## Decision rules

- The Service class (`node/index.ts`) is the entry point for every VTEX IO backend app. It receives clients, routes (with middleware chains), GraphQL resolvers, and event handlers.
- Every middleware, resolver, and event handler receives `ctx` with: `ctx.clients` (registered clients), `ctx.state` (mutable per-request state), `ctx.vtex` (auth tokens, account info), `ctx.body` (request/response body).
- Use `JanusClient` for VTEX internal APIs (base URL: `https://{account}.vtexcommercestable.com.br`).
- Use `ExternalClient` for non-VTEX APIs (any URL you specify).
- Use `AppClient` for routes exposed by other VTEX IO apps.
- Use `MasterDataClient` for Master Data v2 CRUD operations.
- Register custom clients by extending `IOClients` — each client is lazily instantiated on first access via `this.getOrSet()`.
- Keep clients as thin data-access wrappers. Put business logic in middlewares or service functions.

Client hierarchy:

| Class | Use Case | Base URL |
|-------|----------|----------|
| `JanusClient` | Access VTEX internal APIs (Janus gateway) | `https://{account}.vtexcommercestable.com.br` |
| `ExternalClient` | Access external (non-VTEX) APIs | Any URL you specify |
| `AppClient` | Access routes exposed by other VTEX IO apps | `https://{workspace}--{account}.myvtex.com` |
| `InfraClient` | Access VTEX IO infrastructure services | Internal |
| `MasterDataClient` | Access Master Data v2 CRUD operations | VTEX API |

Architecture:

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

## Hard constraints

### Constraint: Use @vtex/api Clients — Never Raw HTTP Libraries

All HTTP communication from a VTEX IO service app MUST go through `@vtex/api` clients (JanusClient, ExternalClient, AppClient, or native clients from `@vtex/clients`). You MUST NOT use `axios`, `fetch`, `got`, `node-fetch`, or any other raw HTTP library.

**Why this matters**

VTEX IO clients provide automatic authentication header injection, built-in caching (disk and memory), retry with exponential backoff, timeout management, native metrics and billing tracking, and proper error handling. Raw HTTP libraries bypass all of these. Additionally, outbound traffic from VTEX IO is firewalled — only `@vtex/api` clients properly route through the infrastructure.

**Detection**

If you see `import axios from 'axios'`, `import fetch from 'node-fetch'`, `import got from 'got'`, `require('node-fetch')`, or any direct `fetch()` call in a VTEX IO service app, STOP. Replace with a proper client extending JanusClient or ExternalClient.

**Correct**

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

**Wrong**

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

Clients MUST always be accessed through `ctx.clients.{clientName}` in middlewares, resolvers, and event handlers. You MUST NOT instantiate client classes directly with `new`.

**Why this matters**

The IOClients registry manages client lifecycle, ensuring proper initialization with the current request's IOContext (account, workspace, auth tokens). Direct instantiation creates clients without authentication context, without caching configuration, and without connection to the metrics pipeline.

**Detection**

If you see `new MyClient(...)` or `new ExternalClient(...)` inside a middleware or resolver, STOP. The client should be registered in the Clients class and accessed via `ctx.clients`.

**Correct**

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

**Wrong**

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

A single service app SHOULD NOT define more than 10 HTTP routes. If you need more, consider splitting into focused microservice apps.

**Why this matters**

VTEX IO apps run in containers with limited memory (max 512MB). A monolithic app with many routes increases memory usage, cold start time, and blast radius of failures. The VTEX IO platform is designed for small, focused apps that compose together.

**Detection**

If `service.json` defines more than 10 routes, warn the developer to consider splitting the app into smaller services. This is a soft limit — there may be valid exceptions.

**Correct**

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

**Wrong**

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
```

12 routes covering reviews, products, orders, users, categories, brands, and inventory — this should be 3-4 separate apps.

## Preferred pattern

Define custom clients:

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

Register clients in IOClients:

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

Create middlewares using `ctx.clients` and `ctx.state`:

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

Wire everything in the Service entry point:

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

## Common failure modes

- **Using axios/fetch/got/node-fetch for HTTP calls**: These libraries bypass the entire VTEX IO infrastructure — no automatic auth token injection, no caching, no retry logic, no metrics. Outbound requests may also be blocked by the firewall. Create a proper client extending `ExternalClient` or `JanusClient` instead.
- **Putting business logic in clients**: Clients become bloated and hard to test. Keep clients as thin wrappers around HTTP calls. Put business logic in middlewares or dedicated service functions.
- **Direct client instantiation**: Using `new MyClient(...)` inside a middleware creates clients without auth context, caching, or metrics. Always access via `ctx.clients`.

## Review checklist

- [ ] Are all HTTP calls going through `@vtex/api` clients (no axios, fetch, got)?
- [ ] Are all clients accessed via `ctx.clients`, never instantiated with `new`?
- [ ] Are custom clients registered in the IOClients class?
- [ ] Does the Service entry point correctly wire clients, routes, resolvers, and events?
- [ ] Is business logic in middlewares/resolvers, not in client classes?
- [ ] Does `service.json` have reasonable route count (≤10)?
- [ ] Are client options (retries, timeout) configured appropriately?

## Reference

- [Services](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) — Overview of VTEX IO backend service development
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — Native client list and client architecture overview
- [Developing Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-how-to-create-and-use-clients) — Step-by-step guide for creating custom JanusClient and ExternalClient
- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) — How to use @vtex/api and @vtex/clients in middlewares and resolvers
- [Calling Commerce APIs](https://developers.vtex.com/docs/guides/calling-commerce-apis-1-getting-the-service-app-boilerplate) — Tutorial for building a service app that calls VTEX Commerce APIs
- [Best Practices for Avoiding Rate Limits](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Why clients with caching prevent rate-limit issues
