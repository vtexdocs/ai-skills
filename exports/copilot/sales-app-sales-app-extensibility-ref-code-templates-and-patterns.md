# Code Templates and Patterns

## Template Selection

| Condition | Template |
|-----------|----------|
| No API + no hooks | Simple template |
| No API + hooks needed | Hook template |
| API + no authentication | API template |
| API + VTEX IO proxy app | IO Proxy template (recommended) |
| API + direct auth | Direct Auth template (insecure — warn user) |

## Simple Extension (no hooks, no API)

```typescript
import React from 'react';
import './${COMPONENT_NAME}.css';

/**
 * ${COMPONENT_NAME}
 * ${DESCRIPTION}
 *
 * Extension Point: ${EXTENSION_POINT}
 *
 * IMPORTANT: This component MUST always return a JSX.Element, never null.
 * The defineExtensions type (ExtensionPointComponent) does not accept null.
 * If you need to conditionally hide content, return an empty fragment: <></>
 */
export function ${COMPONENT_NAME}(): JSX.Element {
  return (
    <div className="container">
      <div className="content">
        ${CONTENT}
      </div>
    </div>
  );
}
```

## Extension with Hooks

```typescript
import React from 'react';
import { ${HOOKS_IMPORT} } from '@vtex/sales-app';
import './${COMPONENT_NAME}.css';

/**
 * ${COMPONENT_NAME}
 * ${DESCRIPTION}
 *
 * Extension Point: ${EXTENSION_POINT}
 * Hooks: ${HOOKS_LIST}
 */
export function ${COMPONENT_NAME}(): JSX.Element {
  ${HOOKS_USAGE}

  return (
    <div className="container">
      <div className="content">
        ${CONTENT}
      </div>
    </div>
  );
}
```

### Hook initialization patterns

```typescript
// useCart — access cart data and mutations
const cart = useCart();
// cart.items, cart.value, cart.totalizers, cart.clientProfileData, cart.giftCards
// cart.addItem(), cart.removeItem(), cart.addCoupon(), cart.addGiftCard(), cart.sync()

// useCartItem — access individual cart item (cart.cart-item.after ONLY)
const { item, itemIndex, changeItem, changePrice } = useCartItem();
// ALWAYS check: if (!item) return (<></>);

// useCurrentUser — access logged-in user (menu.drawer-content ONLY)
const { name, email } = useCurrentUser();

// useExtension — access account and extension point context (ALL extension points)
const { account, extensionPoint } = useExtension();

// usePDP — access product data (PDP extensions ONLY)
const { productSku } = usePDP();
// productSku.id, productSku.name, productSku.price, productSku.listPrice
```

## Extension with API (no auth)

```typescript
import React, { useState, useEffect } from 'react';
import { ${HOOKS_IMPORT} } from '@vtex/sales-app';
import './${COMPONENT_NAME}.css';

interface ${COMPONENT_NAME}Data {
  // Generated from API documentation — see docs/<ExtensionName>.md for source
  // Object fields → typed properties. Nested objects → separate interfaces. Optional fields → property?: Type
  ${DATA_INTERFACE}
}

export function ${COMPONENT_NAME}(): JSX.Element {
  ${HOOKS_USAGE}
  const [data, setData] = useState<${COMPONENT_NAME}Data | null>(null)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('${API_ENDPOINT}', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [account]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <span className="spinner"></span>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error"><span>Error: {error}</span></div>
      </div>
    );
  }

  if (!data) return (<></>);

  return (
    <div className="container">
      <div className="content">
        ${CONTENT}
      </div>
    </div>
  );
}
```

## Extension with IO Proxy (recommended for authenticated APIs)

The IO app handles the external API keys securely on the server side. The extension uses `credentials: 'include'` to forward session cookies.

**Critical**: The API endpoint must be a **relative path** (e.g., `/_v/my-api/data`). **NEVER** use a full URL like `https://{account}.myvtex.com/...`. The Sales App internal proxy resolves the domain automatically.

```typescript
import React, { useState, useEffect } from 'react';
import { ${HOOKS_IMPORT} } from '@vtex/sales-app';
import './${COMPONENT_NAME}.css';

interface ${COMPONENT_NAME}Data {
  // Generated from API documentation — see docs/<ExtensionName>.md for source
  // Object fields → typed properties. Nested objects → separate interfaces. Optional fields → property?: Type
  ${DATA_INTERFACE}
}

export function ${COMPONENT_NAME}(): JSX.Element {
  ${HOOKS_USAGE}
  const [data, setData] = useState<${COMPONENT_NAME}Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('${API_ENDPOINT}', {
          method: '${API_METHOD}',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          ${FETCH_BODY}
        });

        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [account]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <span className="spinner"></span>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error"><span>Error: {error}</span></div>
      </div>
    );
  }

  if (!data) return (<></>);

  return (
    <div className="container">
      <div className="content">
        ${CONTENT}
      </div>
    </div>
  );
}
```

## Extension with Direct Auth (insecure — testing only)

**⚠️ SECURITY WARNING**: This template passes authentication keys directly in request headers. The keys are visible to anyone inspecting the browser's network requests. Use a VTEX IO proxy app in production.

```typescript
import React, { useState, useEffect } from 'react';
import { ${HOOKS_IMPORT} } from '@vtex/sales-app';
import './${COMPONENT_NAME}.css';

/**
 * ⚠️ SECURITY WARNING: Authentication keys exposed in frontend code.
 * Move to a VTEX IO proxy app for production use.
 */

interface ${COMPONENT_NAME}Data {
  // Generated from API documentation — see docs/<ExtensionName>.md for source
  // Object fields → typed properties. Nested objects → separate interfaces. Optional fields → property?: Type
  ${DATA_INTERFACE}
}

export function ${COMPONENT_NAME}(): JSX.Element {
  ${HOOKS_USAGE}
  const [data, setData] = useState<${COMPONENT_NAME}Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('${API_ENDPOINT}', {
          method: '${API_METHOD}',
          headers: {
            'Content-Type': 'application/json',
            // ⚠️ INSECURE: Authentication key exposed in frontend code
            '${AUTH_HEADER_NAME}': '${AUTH_HEADER_VALUE}',
          },
          ${FETCH_BODY}
        });

        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [account]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <span className="spinner"></span>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error"><span>Error: {error}</span></div>
      </div>
    );
  }

  if (!data) return (<></>);

  return (
    <div className="container">
      <div className="content">
        ${CONTENT}
      </div>
    </div>
  );
}
```

## CSS Module

All extensions use CSS modules with Sales App design tokens. See [design-guidelines.md](design-guidelines.md) for the full token reference.

```css
/**
 * ${COMPONENT_NAME} Styles
 * Design tokens follow Sales App Design Guidelines.
 * Reference: references/design-guidelines.md
 * UX writing: Use sentence case for all UI text. Never use ALL-CAPS.
 */

.container {
  /* Sales App design tokens — do not replace with hardcoded hex values */
  --sa-color-primary:       #157BF4;   /* Light Blue 800 */
  --sa-color-primary-hover: #0366DD;   /* Light Blue 900 */
  --sa-color-text-primary:   #1F1F1F;  /* Neutral 1200 */
  --sa-color-text-secondary: #5C5C5C;  /* Neutral 600 */
  --sa-color-text-tertiary:  #3D3D3D;  /* Neutral 500 */
  --sa-color-text-muted:     #999999;  /* Neutral 700 */
  --sa-color-bg:        #FFFFFF;
  --sa-color-bg-subtle: #F5F5F5;       /* Neutral 100 */
  --sa-color-bg-muted:  #EBEBEB;       /* Neutral 200 */
  --sa-color-border:       #E0E0E0;    /* Neutral 300 */
  --sa-color-border-input: #D6D6D6;    /* Neutral 400 */
  --sa-color-error-bg:     #FDF6F5;    /* Red 50 */
  --sa-color-error-border: #FFDFD9;    /* Red 200 */
  --sa-color-error-text:   #EC3727;    /* Red 800 */
  --sa-color-success-bg:   #EDFDF5;    /* Green 50 */
  --sa-color-success-text: #01905F;    /* Green 800 */
  --sa-color-warning-bg:   #FBF7D4;    /* Yellow 50 */
  --sa-color-warning-text: #E57001;    /* Orange 700 */
  --sa-color-info-bg:   #F1F8FD;       /* Light Blue 50 */
  --sa-color-info-text: #157BF4;       /* Light Blue 800 */

  padding: 16px;
  background-color: var(--sa-color-bg);
  font-family: 'VTEX Trust', -apple-system, BlinkMacSystemFont, sans-serif;
}
.content { display: flex; flex-direction: column; gap: 12px; }
.title { font-size: 16px; font-weight: 600; color: var(--sa-color-text-primary); margin: 0; }
.subtitle { font-size: 14px; color: var(--sa-color-text-secondary); margin: 0; }
.text { font-size: 14px; color: var(--sa-color-text-tertiary); line-height: 1.5; }

/* Loading state */
.loading {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 24px; color: var(--sa-color-text-secondary);
}
.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--sa-color-border); border-top-color: var(--sa-color-primary);
  border-radius: 50%; animation: ${COMPONENT_NAME}-spin 1s linear infinite;
}
@keyframes ${COMPONENT_NAME}-spin { to { transform: rotate(360deg); } }

/* Error state */
.error {
  padding: 16px; background-color: var(--sa-color-error-bg);
  border: 1px solid var(--sa-color-error-border); border-radius: 8px;
  color: var(--sa-color-error-text); font-size: 14px;
}

/* Button styles */
.button {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 12px 16px; font-size: 14px; font-weight: 500;
  border: none; border-radius: 6px; cursor: pointer;
  transition: background-color 0.2s ease;
}
.buttonPrimary { background-color: var(--sa-color-primary); color: #FFFFFF; }
.buttonPrimary:hover { background-color: var(--sa-color-primary-hover); }
.buttonSecondary { background-color: var(--sa-color-bg-muted); color: var(--sa-color-text-tertiary); }
.buttonSecondary:hover { background-color: var(--sa-color-border); }

/* Card */
.card {
  padding: 16px; background-color: var(--sa-color-bg-subtle);
  border-radius: 8px; border: 1px solid var(--sa-color-border);
}

/* Badges */
.badge {
  display: inline-block; padding: 4px 8px;
  font-size: 12px; font-weight: 500; border-radius: 4px;
}
.badgeSuccess { background-color: var(--sa-color-success-bg); color: var(--sa-color-success-text); }
.badgeWarning { background-color: var(--sa-color-warning-bg); color: var(--sa-color-warning-text); }
.badgeInfo { background-color: var(--sa-color-info-bg); color: var(--sa-color-info-text); }

/* Input */
.input {
  width: 100%; padding: 12px; font-size: 14px;
  border: 1px solid var(--sa-color-border-input); border-radius: 6px;
  outline: none; transition: border-color 0.2s ease;
}
.input:focus { border-color: var(--sa-color-primary); }

/* Row/flex helpers */
.row { display: flex; align-items: center; gap: 12px; }
.spaceBetween { justify-content: space-between; }

/* Price display */
.price { font-size: 18px; font-weight: 600; color: var(--sa-color-text-primary); }
.priceOld { font-size: 14px; color: var(--sa-color-text-muted); text-decoration: line-through; }
.priceDiscount { font-size: 14px; color: var(--sa-color-success-text); font-weight: 500; }

/* Responsive — Sales App breakpoints */
@media (max-width: 743px) {
  .container { padding: 12px; margin: 0 24px; }
}
```

## index.tsx with defineExtensions

```typescript
import { defineExtensions } from '@vtex/sales-app';
${COMPONENT_IMPORTS}

/**
 * Sales App Extensions Entry Point
 *
 * Connects extension components to their target extension points.
 * Each extension point can only have one component assigned to it.
 *
 * Available extension points:
 * - cart.cart-list.after
 * - cart.cart-item.after
 * - cart.order-summary.after
 * - pdp.sidebar.before
 * - pdp.sidebar.after
 * - pdp.content.after
 * - menu.item
 * - menu.drawer-content
 */
export default defineExtensions({
  ${EXTENSION_MAPPINGS}
});
```

## Validation Rules

After generating code, validate for these issues:

1. **React import present** — `import React from 'react'` is required for JSX compilation
2. **Component exported** — must have `export function`, `export const`, or `export default`
3. **No null returns** — `return null` is not allowed; use `return (<></>)` instead
4. **Hook imports** — all hooks must be imported from `@vtex/sales-app`
5. **Optional property guards** — `manualPrice`, `productRefId`, `attachments` must have null checks
6. **useCartItem item check** — `if (!item) return (<></>)` before accessing item properties
7. **Hook/extension-point compatibility** — each hook is only valid in specific extension points
8. **API call handling** — loading state and error handling must be present for any `fetch()` call
9. **CSS class usage** — CSS classes defined in the stylesheet should be used in the component
10. **defineExtensions in index.tsx** — entry point must import and call `defineExtensions`
11. **Static analysis compliance** — generated code must pass all fsp-analyzer sandbox security, CSS containment, and React performance rules. Load the [static analysis reference](static-analysis-rules.md) to run the full check. Fix all violations before presenting code to the user; flag warnings to the user for review.
12. **Design token compliance** — the CSS module must declare `--sa-color-*` custom properties on `.container` and use only those tokens for all colors. No hardcoded hex values outside the token block. Font family must be `'VTEX Trust', -apple-system, BlinkMacSystemFont, sans-serif`. All UI text in sentence case. Icons from Phosphor Icons only. Load the [design guidelines reference](design-guidelines.md) for the full token table.

## API Type Generation from Documentation

When API documentation was ingested during Discovery (Step 1), generate TypeScript interfaces from the extracted response shapes. Apply these rules:

### JSON to TypeScript conversion rules

| JSON value | TypeScript type |
|-----------|----------------|
| `"string"` | `string` |
| `123` | `number` |
| `true` / `false` | `boolean` |
| `null` or sometimes absent | `type \| null` or `property?: type` |
| `{ }` (nested object) | Separate named `interface` |
| `[ ]` (array of objects) | `InterfaceType[]` |
| `[ ]` (array of primitives) | `string[]`, `number[]`, etc. |

### Naming conventions

- Top-level response type: `{ComponentName}Data` (replaces the `${DATA_INTERFACE}` placeholder)
- Nested object type: `{ComponentName}{FieldName}` (e.g., `LoyaltyHistoryEntry`)
- Request body type (POST/PUT): `{ComponentName}Request`
- Keep names PascalCase and domain-specific

### Example

Given API response:

```json
{ "points": 100, "tier": "gold", "expiresAt": null, "history": [{ "date": "2026-01-01", "amount": 10 }] }
```

Generate:

```typescript
interface LoyaltyHistoryEntry {
  date: string;
  amount: number;
}

interface LoyaltyData {
  points: number;
  tier: string;
  expiresAt: string | null;
  history: LoyaltyHistoryEntry[];
}
```

If a field is documented as optional (not always present), use `?`:

```typescript
interface ProductRecommendationData {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;  // optional per API docs
  badge?: string;     // optional per API docs
}
```

### Multiple endpoints

If the extension calls more than one endpoint, generate a separate interface per endpoint response. Prefix with the endpoint purpose: `{ComponentName}{Purpose}Data` (e.g., `LoyaltyBalanceData`, `LoyaltyRedemptionResponse`).

## Custom Fetch Hook Pattern

Use this pattern when the extension calls **2 or more endpoints** or when the fetch logic is complex (chained requests, pagination, polling).

### Decision rule

- **1 endpoint** → inline `useEffect` fetch inside the component (existing pattern).
- **2+ endpoints** → extract into one or more custom hooks in `hooks/use{Purpose}.ts`.

### Custom hook template

```typescript
import { useState, useEffect } from 'react';

export function use${Purpose}(account: string) {
  const [data, setData] = useState<${ResponseType} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('${API_ENDPOINT}', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch ${Purpose}');
        const result: ${ResponseType} = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [account]);

  return { data, loading, error };
}
```

### Usage in component

```typescript
import { use${Purpose} } from './hooks/use${Purpose}';

export function ${COMPONENT_NAME}(): JSX.Element {
  const { account } = useExtension();
  const { data: balance, loading: loadingBalance, error: errorBalance } = use${Purpose}(account);
  const { data: history, loading: loadingHistory, error: errorHistory } = use${OtherPurpose}(account);

  if (loadingBalance || loadingHistory) return <div className="loading">Loading...</div>;
  if (errorBalance || errorHistory) return <div className="error">Error loading data</div>;
  if (!balance || !history) return (<></>);

  return (
    <div className="container">
      {/* render using balance and history */}
    </div>
  );
}
```

### File placement

Custom hooks go in `packages/sales-app/src/hooks/use{Purpose}.ts`. They must be TypeScript-only files (no JSX, no `.tsx` extension needed unless they return JSX).
