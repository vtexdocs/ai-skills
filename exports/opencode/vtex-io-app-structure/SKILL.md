---
name: vtex-io-app-structure
description: "Apply when creating or modifying manifest.json, service.json, or node/package.json in a VTEX IO app. Covers builders (node, react, graphql, admin, pixel, messages, store), policy declarations, dependencies, peerDependencies, and app lifecycle management. Use for scaffolding new VTEX IO apps, configuring builders, or fixing deployment failures related to app structure and naming conventions."
---

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
