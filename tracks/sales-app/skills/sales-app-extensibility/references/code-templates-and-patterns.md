---
name: sales-app-code-templates
description: Code generation templates for Sales App extensions — simple, hook-based, API (no auth), IO Proxy (secure), Direct Auth (insecure), CSS module, and index.tsx with defineExtensions. Use when generating or scaffolding extension code.
metadata:
  version: "1.0"
---

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
// cart.items, cart.value, cart.totalizers, cart.clientProfileData, cart.addItem()

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
  // Define the API response structure
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

All extensions use CSS modules with Admin UI design tokens.

```css
/**
 * ${COMPONENT_NAME} Styles
 * Design tokens follow Admin UI patterns.
 */

.container { padding: 16px; background-color: #ffffff; }
.content { display: flex; flex-direction: column; gap: 12px; }
.title { font-size: 16px; font-weight: 600; color: #1a1a1a; margin: 0; }
.subtitle { font-size: 14px; color: #666666; margin: 0; }
.text { font-size: 14px; color: #333333; line-height: 1.5; }

/* Loading State */
.loading {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 24px; color: #666666;
}
.spinner {
  width: 20px; height: 20px;
  border: 2px solid #e0e0e0; border-top-color: #0066cc;
  border-radius: 50%; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Error State */
.error {
  padding: 16px; background-color: #fff5f5;
  border: 1px solid #ffcccc; border-radius: 8px;
  color: #cc0000; font-size: 14px;
}

/* Button Styles */
.button {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 16px; font-size: 14px; font-weight: 500;
  border: none; border-radius: 6px; cursor: pointer;
  transition: background-color 0.2s ease;
}
.buttonPrimary { background-color: #0066cc; color: #ffffff; }
.buttonPrimary:hover { background-color: #0052a3; }
.buttonSecondary { background-color: #f0f0f0; color: #333333; }
.buttonSecondary:hover { background-color: #e0e0e0; }

/* Card Styles */
.card {
  padding: 16px; background-color: #f9f9f9;
  border-radius: 8px; border: 1px solid #e0e0e0;
}

/* Badge Styles */
.badge {
  display: inline-block; padding: 4px 8px;
  font-size: 12px; font-weight: 500; border-radius: 4px;
}
.badgeSuccess { background-color: #e6f4ea; color: #137333; }
.badgeWarning { background-color: #fef7e0; color: #b06000; }
.badgeInfo { background-color: #e8f0fe; color: #1a73e8; }

/* Input Styles */
.input {
  width: 100%; padding: 10px 12px; font-size: 14px;
  border: 1px solid #d0d0d0; border-radius: 6px;
  outline: none; transition: border-color 0.2s ease;
}
.input:focus { border-color: #0066cc; }

/* Row/Flex Helpers */
.row { display: flex; align-items: center; gap: 12px; }
.spaceBetween { justify-content: space-between; }

/* Price Display */
.price { font-size: 18px; font-weight: 600; color: #1a1a1a; }
.priceOld { font-size: 14px; color: #999999; text-decoration: line-through; }
.priceDiscount { font-size: 14px; color: #137333; font-weight: 500; }
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
