# FastStore Search & Facets Reference

## Common Pitfalls

### Accessing facets in custom PLP/Search sections

- Facets are **NOT** available in the server-side page data (`__NEXT_DATA__`). They come from the **client-side** `useProductGalleryQuery` inside the `ProductListing` template, which deep-merges them into the `PageProvider` context.
- After client-side hydration, facets are accessible via `usePage()`:
  ```tsx
  const context = usePage<PLPContext | SearchPageContext>();
  const facets = (context as any)?.data?.search?.facets ?? [];
  ```
- The component will initially render with no facets (returns `null`), then re-render once the client-side query completes and the context updates.

### Facet type discrimination

- GraphQL facets use `__typename` for type discrimination, **NOT** a `type` field:
  - `__typename === "StoreFacetBoolean"` → has `values[]` with `{ value, label, selected, quantity }`
  - `__typename === "StoreFacetRange"` → price ranges, no `values` array
- **Do NOT filter with `f.type === "BOOLEAN"`** — this field does not exist on the runtime object.

### useSearch() API — Zustand store

The `useSearch()` hook from `@faststore/sdk` returns a **Zustand global store**, not the React Context documented in older references. Key differences:

| ✅ Correct (Zustand store)                | ❌ Wrong (old Context API)                      |
| ----------------------------------------- | ----------------------------------------------- |
| `const { state, setState } = useSearch()` | `const { setFacet, removeFacet } = useSearch()` |
| `state.selectedFacets`                    | Direct method calls on the hook return          |

To toggle a facet, import the **standalone utility** `toggleFacet` from `@faststore/sdk`:

```tsx
import { useSearch, toggleFacet } from "@faststore/sdk";

const { state, setState } = useSearch();
const newFacets = toggleFacet(state.selectedFacets, { key, value });
setState({ ...state, selectedFacets: newFacets, page: 0 });
```

Available utilities from `@faststore/sdk`:

- `toggleFacet(facets, facet)` → add if absent, remove if present
- `setFacet(facets, facet, unique?)` → add a facet
- `removeFacet(facets, facet)` → remove a facet
- `toggleFacets(facets, facets[])` → toggle multiple at once

## Page Context Data Flow (PLP/Search)

The PLP page context is built in two phases:

1. **Server-side** (`getStaticProps`): `ServerCollectionPageQuery` → returns `collection.seo`, `collection.breadcrumbList`, `collection.metaData`. **No facets.**
2. **Client-side** (`useProductGalleryQuery`): `ClientProductGalleryQuery` → returns `search.products`, `search.facets`, `search.metadata`.

The `ProductListing` template merges both via `deepmerge` into the `PageProvider` context:

```tsx
// From @faststore/core ProductListing.tsx
const { data: pageProductGalleryData } = useProductGalleryQuery({
  term,
  sort,
  selectedFacets,
  itemsPerPage,
});
const context = {
  data: {
    ...deepmerge(
      { ...server },
      { ...pageProductGalleryData },
      { arrayMerge: overwriteMerge },
    ),
    pages,
  },
  globalSettings,
} as PLPContext;
```

After client-side hydration: `usePage().data.search.facets` is available.

## PLPContext type

```ts
interface PLPContext {
  data?: ServerCollectionPageQueryQuery & // server: collection, seo
    ClientProductGalleryQueryQuery & { pages: ClientManyProductsQueryQuery[] }; // client: search.facets, search.products
  globalSettings?: Record<string, unknown>;
}
```

## Accessing facets in a custom section

```tsx
import { usePage } from "@faststore/core";
import type { PLPContext, SearchPageContext } from "@faststore/core";

const context = usePage<PLPContext | SearchPageContext>();
const facets = (context as any)?.data?.search?.facets ?? [];
```

**Important:** On initial server render, facets will be empty. The component should handle this gracefully (e.g., return `null`). After client-side hydration and the ProductGalleryQuery completes, React will re-render the component with facets.

## Facet type discrimination

GraphQL facets use `__typename`, NOT a `type` field:

| `__typename`        | Description                         | Has `values[]`?                             |
| ------------------- | ----------------------------------- | ------------------------------------------- |
| `StoreFacetBoolean` | Checkbox-style facets (brand, size) | Yes: `{ value, label, selected, quantity }` |
| `StoreFacetRange`   | Range facets (price)                | No                                          |

```tsx
const booleanFacets = facets.filter(
  (f) => f.__typename === "StoreFacetBoolean" && f.values?.length > 0,
);
```

## useSearch() — Zustand store API

The `useSearch()` hook from `@faststore/sdk` returns a Zustand global store:

```tsx
import { useSearch } from "@faststore/sdk";

const { state, setState } = useSearch();
// state.selectedFacets — { key: string, value: string }[]
// state.sort — StoreSort enum string
// state.term — search term or null
// state.page — current page index
// setState(partial) — merges partial state into current
```

**`setFacet` and `removeFacet` are NOT methods on the hook return object.** They are standalone utility functions.

## Facet toggle utilities

Imported as standalone functions from `@faststore/sdk`:

```tsx
import {
  toggleFacet,
  setFacet,
  removeFacet,
  toggleFacets,
} from "@faststore/sdk";
```

All are **pure functions**: `(currentFacets[], facet) => newFacets[]`

```tsx
import { useSearch, toggleFacet } from "@faststore/sdk";

const { state, setState } = useSearch();

function handleToggle(key: string, value: string) {
  const newFacets = toggleFacet(state.selectedFacets, { key, value });
  setState({ ...state, selectedFacets: newFacets, page: 0 });
}
```

| Function                           | Behavior                                     |
| ---------------------------------- | -------------------------------------------- |
| `toggleFacet(facets, facet)`       | Add if absent, remove if present             |
| `setFacet(facets, facet, unique?)` | Add a facet (if `unique`, replaces same-key) |
| `removeFacet(facets, facet)`       | Remove a facet by value                      |
| `toggleFacets(facets, facets[])`   | Toggle multiple facets at once               |

## @faststore/sdk — exports map

| Export               | Type                 | Usage                                                 |
| -------------------- | -------------------- | ----------------------------------------------------- |
| `useSearch`          | Hook (Zustand store) | `const { state, setState } = useSearch()`             |
| `SearchProvider`     | React Component      | Wraps PLP/Search pages (already handled by framework) |
| `toggleFacet`        | Pure function        | `toggleFacet(facets[], facet) → newFacets[]`          |
| `setFacet`           | Pure function        | `setFacet(facets[], facet, unique?) → newFacets[]`    |
| `removeFacet`        | Pure function        | `removeFacet(facets[], facet) → newFacets[]`          |
| `toggleFacets`       | Pure function        | `toggleFacets(facets[], facets[]) → newFacets[]`      |
| `parseSearchState`   | Pure function        | Parses URL into search state object                   |
| `formatSearchState`  | Pure function        | Serializes search state into URL                      |
| `sendAnalyticsEvent` | Function             | Dispatch analytics events                             |
| `useAnalyticsEvent`  | Hook                 | Subscribe to analytics events                         |

**Common mistake:** `setFacet` and `removeFacet` are NOT methods on the `useSearch()` return object. They are standalone pure functions that take and return facet arrays.
