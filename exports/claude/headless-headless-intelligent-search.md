This skill provides guidance for AI agents working with VTEX Headless Front-End Development. Apply these constraints and patterns when assisting developers with apply when implementing search functionality, faceted navigation, or autocomplete in a headless vtex storefront. covers product_search, autocomplete_suggestions, facets, banners, correction_search, and top_searches endpoints, plus analytics event collection. use for any custom frontend that integrates vtex intelligent search api for product discovery and search result rendering.

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
