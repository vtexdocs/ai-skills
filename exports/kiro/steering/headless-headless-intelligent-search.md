<!-- globs: **/search/**/*.ts, **/search/**/*.tsx, **/facet*/**/*.{ts,tsx} -->

Apply when implementing search functionality, faceted navigation, or autocomplete in a headless VTEX storefront. Covers product_search, autocomplete_suggestions, facets, banners, correction_search, and top_searches endpoints, plus analytics event collection. Use for any custom frontend that integrates VTEX Intelligent Search API for product discovery and search result rendering.

# Intelligent Search API Integration

## When this skill applies

Use this skill when implementing product search, category browsing, autocomplete, or faceted filtering in a headless VTEX storefront.

- Building a search results page with product listings
- Implementing faceted navigation (category, brand, price, color filters)
- Adding autocomplete suggestions to a search input
- Wiring up search analytics events for Intelligent Search ranking

Do not use this skill for:
- BFF architecture and API routing decisions (use [`headless-bff-architecture`](headless-headless-bff-architecture.md))
- Checkout or cart API integration (use [`headless-checkout-proxy`](headless-headless-checkout-proxy.md))
- Caching strategy and TTL configuration (use [`headless-caching-strategy`](headless-headless-caching-strategy.md))

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
