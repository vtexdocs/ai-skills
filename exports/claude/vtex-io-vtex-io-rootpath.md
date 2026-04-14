This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when building vtex io apps that must work correctly in multi-binding stores where bindings use path prefixes (e.g. store.com/us/, store.com/br/). covers rootpath extraction from x-vtex-root-path header, useruntime().rootpath in react, url construction in backends, link generation, asset paths, and api route considerations. use when the app breaks or produces wrong urls in cross-border or multi-binding setups.

# VTEX IO rootPath for multi-binding stores

## When this skill applies

Use this skill when building VTEX IO apps that must work in stores with **multi-binding** configurations—typically **cross-border** stores where multiple bindings share a single domain with **path prefixes** (e.g. `store.com/us/`, `store.com/br/`, `store.com/mx/`).

- Your app generates **URLs** (links, redirects, API endpoints, canonical URLs) that must include the binding's path prefix
- Your app loads **assets** (images, scripts, stylesheets) that break when the store uses a sub-path binding
- Your **backend routes** need to construct URLs for sitemaps, canonical links, or cross-binding references
- You're debugging **404s** or **wrong links** that only appear in multi-binding stores but work fine in single-binding

Do not use this skill for:

- Single-binding stores with a dedicated domain per locale (no path prefix needed)
- General IO backend patterns (use `vtex-io-service-apps`)
- CDN/edge caching configuration (use `vtex-io-service-paths-and-cdn`)

## Decision rules

- **Single-domain multi-binding** (e.g. `store.com/us/`, `store.com/br/`) → `rootPath` is **required**. Every generated URL must be prefixed with the binding's root path.
- **Multi-domain single-binding** (e.g. `store.us`, `store.com.br`) → `rootPath` is typically **empty** or `/`. URLs work without prefixing, but code should still handle `rootPath` gracefully (use it if non-empty, skip if empty).
- **Backend (Node)** → In many VTEX IO apps, `rootPath` is **already parsed** into `ctx.state.rootPath` by the platform or an early middleware (alongside `binding`, `forwardedHost`, etc. on the `State` interface). Use `ctx.state.rootPath` directly when available. If your app doesn't have it on state yet, extract it from the `x-vtex-root-path` request header and sanitize: if the value is exactly `"/"`, treat it as empty string `""` to avoid double slashes.
- **Frontend (React)** → Use `useRuntime().rootPath` from `vtex.render-runtime` to get the current binding's path prefix in components.
- **Always prefix, never hardcode** — Never hardcode a path prefix like `/us/`. Always use the runtime-provided `rootPath` so the same code works across all bindings.

## Hard constraints

### Constraint: Always use rootPath when constructing URLs in multi-binding stores

Every URL your app generates—links, redirects, API endpoints, canonical URLs, sitemap entries—must include the `rootPath` prefix when the store uses path-based bindings.

**Why this matters** — Without `rootPath`, a link to `/my-account/orders` in the `/br/` binding points to the wrong binding (or 404s). Sitemaps with unprefixed URLs break SEO by pointing search engines to the wrong locale. Redirects without the prefix send users to the default binding instead of their current one.

**Detection** — URLs constructed as string literals (e.g. `/${slug}`) without prepending `rootPath`. Or `navigate()` calls that omit the `rootPath` prefix.

**Correct** — Prepend rootPath to all generated paths.

```typescript
// Backend: use ctx.state.rootPath (already parsed by platform/middleware)
const { rootPath } = ctx.state

const canonicalUrl = `https://${host}${rootPath}/product/${slug}`
const sitemapEntry = `${rootPath}/${categoryPath}`
```

```tsx
// Frontend: use runtime hook
import { useRuntime } from "vtex.render-runtime";

const MyLink = ({ slug }: { slug: string }) => {
  const { rootPath } = useRuntime();
  return <a href={`${rootPath}/product/${slug}`}>View product</a>;
};
```

**Wrong** — Hardcoded paths without rootPath.

```typescript
// Backend: missing rootPath — breaks in multi-binding
const canonicalUrl = `https://${host}/product/${slug}`

// Frontend: hardcoded path
const MyLink = ({ slug }: { slug: string }) => {
  return <a href={`/product/${slug}`}>View product</a>
}
```

### Constraint: Sanitize rootPath to avoid double slashes

When `rootPath` is `"/"` (single-binding or default binding), using it directly produces double slashes in URLs (e.g. `//product/shoes`). Normalize: if `rootPath === "/"`, treat it as `""`.

**Why this matters** — Double slashes in URLs cause redirect loops, broken canonical URLs, and SEO penalties. Some CDN layers treat `//path` differently from `/path`.

**Detection** — URL construction that concatenates `rootPath + "/" + path` without checking for `rootPath === "/"`.

**Correct**

```typescript
// If rootPath is on ctx.state, it's already sanitized
const { rootPath } = ctx.state
const url = `${rootPath}/${path}`

// If extracting manually from the header, sanitize first
const raw = ctx.get('x-vtex-root-path') || ''
const rootPath = raw === '/' ? '' : raw
const url = `${rootPath}/${path}`
```

**Wrong**

```typescript
const rootPath = ctx.get("x-vtex-root-path") || "/";
const url = `${rootPath}/${path}`; // Produces "//path" for default binding
```

## Preferred pattern

### State interface with rootPath

In many VTEX IO apps, `rootPath` is already declared on the `State` interface and populated by an early middleware. Downstream handlers read it directly from `ctx.state`:

```typescript
// node/typings.d.ts
declare global {
  interface State extends RecorderState {
    binding: Binding
    rootPath: string
    forwardedHost: string
    forwardedPath: string
    isCrossBorder: boolean
    // ... other app-specific state
  }

  type Context = ServiceContext<Clients, State>
}
```

If your app doesn't already have `rootPath` on state, add a middleware early in the chain to parse it once:

```typescript
// node/middlewares/rootPath.ts
export async function withRootPath(ctx: Context, next: () => Promise<void>) {
  const raw = ctx.get('x-vtex-root-path') || ''
  ctx.state.rootPath = raw === '/' ? '' : raw
  await next()
}
```

### Frontend utility

```tsx
import { useRuntime } from "vtex.render-runtime";

function usePrefixedPath(path: string): string {
  const { rootPath = "" } = useRuntime();
  const prefix = rootPath === "/" ? "" : rootPath;
  return `${prefix}${path.startsWith("/") ? path : `/${path}`}`;
}
```

### Binding-aware API calls from frontend

```tsx
const { rootPath, binding } = useRuntime();
// binding.id — current binding ID
// binding.canonicalBaseAddress — e.g. "store.com/br"
// rootPath — e.g. "/br"

// When calling backend APIs, the platform handles rootPath automatically
// for IO-internal calls. For external URLs or custom redirects, prefix manually.
```

## Common failure modes

- **Links break in multi-binding** — Navigation links constructed without `rootPath` send users to the wrong binding or 404.
- **Sitemap has wrong URLs** — Sitemap generator omits `rootPath`, causing search engines to index unprefixed URLs that resolve to the default binding.
- **Double slashes** — `rootPath === "/"` concatenated with `/path` produces `//path`. Normalize to empty string.
- **Hardcoded locale paths** — Using `/us/` or `/br/` instead of dynamic `rootPath`. Breaks when bindings are reconfigured.
- **Backend ignores header** — Node service constructs URLs without reading `x-vtex-root-path`, producing wrong canonicals in multi-binding.

## Review checklist

- [ ] Does the app read `rootPath` from `ctx.state.rootPath` or `x-vtex-root-path` header (backend) or `useRuntime()` (frontend)?
- [ ] Are **all** generated URLs (links, redirects, canonicals, sitemaps) prefixed with `rootPath`?
- [ ] Is `rootPath === "/"` normalized to `""` to avoid double slashes?
- [ ] Are there **no** hardcoded locale path prefixes (e.g. `/us/`, `/br/`)?
- [ ] Does the app work correctly in both single-binding and multi-binding stores?

## Related skills

- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) — Route prefixes and CDN behavior
- [vtex-io-service-apps](../vtex-io-service-apps/skill.md) — Backend middleware patterns
- [vtex-io-react-apps](../vtex-io-react-apps/skill.md) — Frontend component patterns

## Reference

- [Cross-Border Store Content Internationalization](https://developers.vtex.com/docs/guides/cross-border-custom-urls-1) — Multi-binding setup for cross-border stores
- [Service Path Patterns](https://developers.vtex.com/docs/guides/service-path-patterns) — Public, segment, and private path prefixes
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub
