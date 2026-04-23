---
name: faststore-architecture
description: FastStore project structure, routes, CLI build pipeline, store configuration (discovery.config.js), and naming conventions. Use when understanding how a FastStore project is organized, how the @faststore/cli works, what files to create or modify, how routing works, or how to configure store settings like SEO, API, session, and analytics.
metadata:
  author: vtex
  version: "1.0"
---

# FastStore Architecture Reference

FastStore is an open-source framework by VTEX for high-performance e-commerce. The architecture follows a **thin customization layer** pattern:

- **FastStore Core** (`@faststore/core`) owns pages, routing, data-fetching, and native sections. It runs a Next.js app internally.
- **The storefront repository** (`src/`) contains _only_ the delta — overrides, new sections, API extensions, theme tokens, and CMS schemas. Never touch Next.js pages or routing directly.
- **`@faststore/cli`** orchestrates everything: it generates a `.faststore/` directory (gitignored) that merges core with your customizations, then delegates to Next.js for build/dev/start.

```
┌──────────────────────────────────────────────────────┐
│                    Developer repo (src/)             │
│  ┌──────────┐ ┌─────────────┐ ┌───────────────────┐  │
│  │ Sections │ │ GraphQL     │ │ Themes / Styles   │  │
│  │ Overrides│ │ Extensions  │ │ (SCSS + tokens)   │  │
│  └────┬─────┘ └──────┬──────┘ └────────┬──────────┘  │
│       │              │                 │             │
│  ┌────▼──────────────▼─────────────────▼──────────┐  │
│  │            @faststore/cli (build)              │  │
│  │         merges into .faststore/                │  │
│  └────────────────────┬───────────────────────────┘  │
│                       │                              │
│  ┌────────────────────▼───────────────────────────┐  │
│  │  @faststore/core  (Next.js app, pages,         │  │
│  │   routing, data fetching, native sections)     │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Project Routes

| Route                      | URL                           |
| -------------------------- | ----------------------------- |
| Home (landing page)        | `{host}/`                     |
| PLP — Product Listing Page | `{host}/s` or `{host}/{slug}` |
| PDP — Product Details Page | `{host}/{slug}/p`             |
| Error Page                 | `{host}/500`                  |
| Not Found                  | `{host}/404`                  |
| Login                      | `{host}/login`                |
| Checkout                   | `{host}/checkout`             |

_Slug = product name identifier._

## Project Structure

```
playground.store/
├── cms/
│   └── faststore/
│       └── components/          # Sections definitions in `cms_component__<sectioName>.jsonc` files
│       └── pages/               # new pages definition
│       └── schema.json          # CMS final schema definition
├── src/
│   ├── components/
│   │   ├── index.tsx              # ** Section registry — maps names to components **
│   │   ├── BuyButtonWithDetails/  # Custom component (used inside a section override)
│   │   ├── ContactForm/           # Standalone new section (not an override)
│   │   └── sections/              # Section-level overrides and new sections
│   ├── fragments/                 # GraphQL fragments to extend core queries
│   │   ├── ClientProduct.ts
│   │   └── ServerProduct.ts
│   ├── graphql/
│   │   ├── vtex/                  # Extensions to VTEX/FastStore API schema
│   │   │   ├── typeDefs/
│   │   │   └── resolvers/
│   │   └── thirdParty/            # Entirely new schemas (third-party APIs)
│   │       ├── typeDefs/
│   │       └── resolvers/
│   ├── scripts/
│   │   └── ThirdPartyScripts.tsx  # Injected into <head>
│   ├── themes/
│   │   └── custom-theme.scss      # Design token overrides
│   └── utils/
│       └── priceFormatter.ts
├── discovery.config.js            # ** Main store config **
├── cypress.config.ts
├── vtex.env
├── vercel.json
├── package.json
├── tsconfig.json
└── yarn.lock
```

### Key Directories

| Directory                  | Purpose                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/components/`          | All custom UI — overrides, new sections, sub-components. `index.tsx` is the **section registry**. |
| `src/components/sections/` | Convention for section-level components (each gets its own folder).                               |
| `src/fragments/`           | GraphQL fragments extending FastStore core queries (e.g., add fields to PDP).                     |
| `src/graphql/vtex/`        | Schema extensions and resolvers augmenting the existing FastStore API.                            |
| `src/graphql/thirdParty/`  | Entirely new GraphQL types/mutations for external APIs.                                           |
| `src/themes/`              | SCSS files with CSS custom property overrides (design tokens).                                    |
| `src/scripts/`             | Third-party script injection.                                                                     |
| `cms/faststore/`           | JSON schemas defining CMS content editor fields.                                                  |
| `.faststore/`              | **Generated, gitignored** — recreated on every build. Never edit directly.                        |

## Store Configuration — `discovery.config.js`

This is the central configuration file. FastStore CLI reads it to set up the entire app.

```js
module.exports = {
  seo: {
    title: "FastStore Playground",
    description: "A fast and performant store framework",
    titleTemplate: "%s | Playground",
    author: "FastStore",
  },
  theme: "custom-theme", // Must match a filename in src/themes/
  platform: "vtex",
  api: {
    storeId: "playground", // VTEX account name
    workspace: "master",
    environment: "vtexcommercestable",
    hideUnavailableItems: true,
    incrementAddress: false,
  },
  session: {
    currency: { code: "BRL", symbol: "R$" },
    locale: "pt-BR",
    channel: '{"salesChannel":1,"regionId":""}',
    country: "BRA",
    // ...other session defaults
  },
  storeUrl: "https://playground.vtex.app",
  checkoutUrl: "https://secure.vtexfaststore.com/checkout",
  loginUrl: "https://secure.vtexfaststore.com/api/io/login",
  analytics: {
    gtmContainerId: "GTM-1234567",
  },
  vtexHeadlessCms: {
    webhookUrls: [
      "https://playground.myvtex.com/cms-releases/webhook-releases",
    ],
  },
};
```

## CLI Scripts

Example `package.json` scripts (many stores match this shape):

```json
{
  "scripts": {
    "dev": "faststore dev",
    "build": "faststore build",
    "start": "faststore start",
    "cms-sync": "faststore cms-sync",
    "test": "faststore test"
  }
}
```

**Headless CMS schema:** Treat **`cms-sync` / `faststore cms-sync`** as **legacy** for **publishing or refreshing** the **Headless CMS** schema. The current flow is **`vtex content generate-schema`** and **`vtex content upload-schema`** (global **VTEX CLI**, `vtex` — not `npx vtex`). See [cms-schema-and-section-registration.md](cms-schema-and-section-registration.md) and the storefront [skill.md](../skill.md).

### What `faststore build` / `faststore dev` Does

1. Reads `discovery.config.js`
2. Generates `.faststore/` (deleted and recreated each run)
3. Copies/merges `src/` into `.faststore/src/customizations/`:
   - `src/components/index.tsx` → `.faststore/src/customizations/components/index.tsx`
   - `src/themes/*.scss` → injected into global stylesheet
   - `src/fragments/*.ts` → extends GraphQL query fragments
   - `src/graphql/` → extends the GraphQL API
   - `src/scripts/ThirdPartyScripts.tsx` → injected into `<head>`
4. Runs Next.js build/dev on the generated app

**You never create Next.js pages, `_app.tsx`, `_document.tsx`, or routing files.** FastStore Core owns those.

## Naming Conventions

| What                    | Convention       | Example                                 |
| ----------------------- | ---------------- | --------------------------------------- |
| Stylesheet filenames    | kebab-case       | `custom-button.module.scss`             |
| Component files         | PascalCase       | `CustomButton.tsx`                      |
| Component exports       | PascalCase       | `export default CustomButton`           |
| Function exports        | camelCase        | `export const getButtonVariants`        |
| Constants               | UPPER_SNAKE_CASE | `const BUTTON_VARIANTS`                 |
| Section folders         | PascalCase       | `src/components/sections/CustomButton/` |
| GraphQL files           | camelCase        | `contactForm.graphql`                   |
| Fragment files          | PascalCase       | `ServerProduct.ts`, `ClientProduct.ts`  |
| Export key in index.tsx | PascalCase       | `CustomButton`                          |
| $componentKey in JSONC  | PascalCase       | `CustomButton`                          |

⚠️ **CRITICAL**: The $componentKey in JSONC MUST match the export key in index.tsx EXACTLY.

## Experimental Imports

Imports from `@faststore/core/experimental` have an `_unstable` suffix and may change between versions:

```tsx
import { useNewsletter_unstable as useNewsletter } from "@faststore/core/experimental";
import { useLazyQuery_unstable as useLazyQuery } from "@faststore/core/experimental";
import { Image_unstable as Image } from "@faststore/core/experimental";
```

## PLP/Search Contexts

PLP pages list variable numbers of items. Two URL patterns exist:

- `{host}/s` — search pages
- `{host}/{...slug}` — category PLP pages

Facets (filters) are indexed by the Intelligent Search SDK. Configure at `https://{account}.myvtex.com/admin` → Catalog → Products and SKUs.

Facets are available via the `usePage<SearchPageContext | PLPContext>()` hook at `context?.data?.search?.facets`.

## Server vs Client Data Split

FastStore pages load data in two phases. **Not all data is available on both phases.**

| Page   | Server query                                              | Client query                                                 | Merged via                                           |
| ------ | --------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| PLP    | `ServerCollectionPageQuery` → collection, seo, breadcrumb | `ClientProductGalleryQuery` → products, **facets**, metadata | `deepmerge` in `ProductListing.tsx` → `PageProvider` |
| PDP    | `ServerProductQuery` → product basics                     | `ClientProductQuery` → full product data                     | merged in `ProductDetailsPage.tsx` → `PageProvider`  |
| Search | (none)                                                    | `ClientProductGalleryQuery` → products, **facets**, metadata | `ProductListing.tsx` → `PageProvider`                |

**Custom sections using `usePage()` must handle both phases:**

- On first server render, only server data is available
- After client hydration, the merged data (including client fields like facets) becomes available
- Components should return `null` or a skeleton when expected client data is missing
