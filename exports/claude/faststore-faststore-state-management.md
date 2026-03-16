This skill provides guidance for AI agents working with VTEX FastStore Implementation & Customization. Apply these constraints and patterns when assisting developers with apply when using faststore sdk hooks like usecart, usesession, or usesearch, or working with sdk-related state files. covers cart manipulation, session handling, faceted search, and ui state management from @faststore/sdk. use for any interactive ecommerce feature that relies on faststore's built-in state management.

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
