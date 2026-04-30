---
name: sales-app-static-analysis-rules
description: fsp-analyzer rule catalog for Sales App extension validation. Load during Step 3 (Code Generation & Validation) to check generated TypeScript/CSS against sandbox security, CSS containment, and React performance rules enforced at build time.
metadata:
  version: "1.0"
---

# Static Analysis Rules (fsp-analyzer)

Sales App extensions run inside a sandboxed environment enforced by `@vtex/fsp-analyzer`. These rules are checked at `preBuild` and `preDev` hook time. The AI must validate all generated code against these rules before presenting it to the user.

Rule IDs match the `ViolationKind`, `ReactViolationKind`, `WarningKind`, and `ReactWarningKind` types from `@vtex/fsp-analyzer` so developers can cross-reference with real build output.

---

## How to apply these rules

After generating a component, CSS file, and `index.tsx`, check each generated file against the **violation** rules (block generation — fix before presenting) and the **warning** rules (flag to the user with a suggestion). Do not present code that has unresolved violations.

---

## 1. Sandbox Security Rules

Applied to `.ts` and `.tsx` files by `FastStoreSandboxAnalyzer`.

### `RESTRICTED_API` — DOM API access banned

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted identifiers: `document`, `window`, `localStorage`, `sessionStorage`, `navigator`.

**Detection:** Any use of these identifiers as a value (not as a type import).

**Correct**
```typescript
// Use React state and props for data; use useExtension() for account context
const { account } = useExtension();
```

**Wrong**
```typescript
const userId = localStorage.getItem('userId');
const width = window.innerWidth;
document.title = 'My Extension';
```

---

### `VARIABLE_ALIASING` — Aliasing restricted APIs

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Assigning a restricted API to a variable to circumvent detection.

**Detection:** `const x = document`, `const [w, d] = [window, document]`, or any destructuring that aliases a restricted API.

**Correct**
```typescript
// Pass data via props or React context, not via aliased globals
```

**Wrong**
```typescript
const doc = document;
const [w, d] = [window, document];
doc.querySelector('.item');
```

---

### `GLOBAL_MANIPULATION` — Global object manipulation

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted member expressions: `window.location`, `window.history`.

**Detection:** Member expressions on `window` to access `location` or `history`.

**Correct**
```typescript
// Navigation is managed by Sales App shell; do not manipulate location
```

**Wrong**
```typescript
window.location.href = '/new-path';
window.location.reload();
```

---

### `HISTORY_MANIPULATION` — Browser history manipulation

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted calls: `window.history.pushState`, `window.history.replaceState`, `history.pushState`, `history.replaceState`.

**Detection:** Any call to these methods.

**Correct**
```typescript
// Let the Sales App shell handle routing
```

**Wrong**
```typescript
history.pushState({}, '', '/cart');
window.history.replaceState(null, '', '/pdp');
```

---

### `DYNAMIC_SCRIPT_CREATION` — Dynamic script creation

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted expressions: `document.createElement`, `document.write`, `document.writeln`, `document.body.appendChild`, `document.head.appendChild`.

**Detection:** Any call to these methods.

**Correct**
```typescript
// Render UI via JSX; never inject scripts dynamically
```

**Wrong**
```typescript
const script = document.createElement('script');
script.src = 'https://cdn.example.com/lib.js';
document.body.appendChild(script);
```

---

### `CODE_EXECUTION` — Arbitrary code execution

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted calls: `eval`, `Function` (as constructor), `setTimeout` (string form), `setInterval` (string form), `new Function`.

**Detection:** Any call or instantiation of these identifiers.

> **Note on `setTimeout`/`setInterval`:** These are restricted in the sandbox to prevent arbitrary code injection. Use `useEffect` with `AbortController` or cleanup functions for timing-based logic:

**Correct**
```typescript
useEffect(() => {
  const id = window.setTimeout(() => { /* logic */ }, 500);
  return () => window.clearTimeout(id);
}, []);
// Note: even this should be reviewed; prefer event-driven patterns
```

**Wrong**
```typescript
eval('doSomething()');
const fn = new Function('return 42');
setTimeout('doSomething()', 1000);
```

---

### `RESTRICTED_IMPORT` — Restricted Node.js module imports

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted modules: `fs`, `path`, `child_process`, `crypto`.

**Detection:** Any `import` statement importing from these module names.

**Correct**
```typescript
// Extensions are browser-only React components; do not import Node.js modules
import { useCart } from '@vtex/sales-app';
```

**Wrong**
```typescript
import fs from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';
```

---

### `RESTRICTED_IMPORT_SOURCE` — Direct node_modules path imports

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

**Detection:** Import paths containing `node_modules/`.

**Wrong**
```typescript
import something from 'node_modules/lodash/get';
```

---

### `EXTERNAL_RESOURCE_LOADING` — Unrestricted external resource loading

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted expressions: `fetch` (to external URLs), `XMLHttpRequest`, `script.src`, `link.href`.

**Detection:** `fetch` calls where the first argument is a known third-party domain string, or direct use of `XMLHttpRequest`.

> **Exception:** `fetch` via the IO Proxy relative path (`/_v/...`) is allowed and required for secure API integration.

**Correct**
```typescript
// Always use IO Proxy relative path
const response = await fetch('/_v/my-loyalty-api/points', {
  credentials: 'include',
});
```

**Wrong**
```typescript
const response = await fetch('https://api.example.com/data');
const xhr = new XMLHttpRequest();
```

---

### `EXTERNAL_RESOURCE_FETCH` — Fetch to known CDN domains

**Severity:** Warning (flag)  
**Files:** `.ts`, `.tsx`

Known third-party domains: `cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`, `ajax.googleapis.com`, `code.jquery.com`.

**Detection:** `fetch()` first argument literal containing one of these domains.

**Action:** Warn the user. These external fetches bypass the IO Proxy and may expose security risks or fail in the sandbox.

---

### `QUERY_SELECTOR_USAGE` — DOM query selectors

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted calls: `document.getElementById`, `document.getElementsByClassName`, `document.getElementsByTagName`, `document.querySelector`, `document.querySelectorAll`, and element-scoped variants.

**Detection:** Any call to these methods.

**Correct**
```typescript
// Use React refs for direct DOM access when absolutely needed
const ref = useRef<HTMLDivElement>(null);
```

**Wrong**
```typescript
const el = document.querySelector('.my-class');
document.getElementById('cart-container');
```

---

### `STYLE_MANIPULATION` — Direct style manipulation

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted expressions: `element.style`, `element.className`, `element.classList`, `element.setAttribute.style`, `element.setAttribute.class`, `element.hidden`, `element.display`, `element.visibility`.

**Detection:** Any member expression matching these patterns.

**Correct**
```typescript
// Use plain CSS with namespaced class names
import './MyExtension.css';

return <div className={isActive ? 'extension-active' : 'extension-inactive'} />;
```

**Wrong**
```typescript
element.style.color = 'red';
element.classList.add('active');
element.setAttribute('style', 'display: none');
```

---

### `INFINITE_LOOP` — Infinite loops

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

**Detection:** `while(true)`, `for(;;)` with no update/test, or `do...while(true)` without a termination condition.

**Wrong**
```typescript
while (true) {
  processItem();
}
```

---

### `MEMORY_LEAK` — Memory leak patterns

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

**Detection:** Event listeners, subscriptions, or timers added without cleanup in `useEffect`.

**Correct**
```typescript
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

**Wrong**
```typescript
useEffect(() => {
  window.addEventListener('resize', handler);
  // Missing cleanup — memory leak
}, []);
```

---

### `EXCESSIVE_API_CALLS` — Excessive API call patterns

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

**Detection:** `fetch` calls or API calls triggered inside render (outside `useEffect`) or inside loops.

**Wrong**
```typescript
// fetch inside render — fires on every re-render
const data = await fetch('/_v/api/data');

// fetch inside loop — excessive calls
for (const item of items) {
  await fetch(`/_v/api/item/${item.id}`);
}
```

---

### `LARGE_BUNDLE_SIZE_IMPACT` — Bundle size impacts

**Severity:** Warning (flag)  
**Files:** `.ts`, `.tsx`

**Detection:**
- String literals longer than 1,000 characters
- Object literals with more than 100 properties
- Imports from heavyweight libraries: `lodash`, `moment`

**Action:** Warn the user and suggest alternatives (`date-fns` instead of `moment`, native array methods instead of `lodash`).

**Correct**
```typescript
import { format } from 'date-fns';
const formattedDate = format(new Date(), 'yyyy-MM-dd');
```

**Wrong**
```typescript
import moment from 'moment';
import _ from 'lodash';
```

---

## 2. CSS Containment Rules

Applied to `.css`, `.scss`, `.less` files by `CSSAnalyzer`. CSS namespace prefix defaults to `extension-` (configured via `allowedNamespaces`).

### `CSS_GLOBAL_SELECTOR` — Global element selectors

**Severity:** Violation (block)  
**Files:** `.css`

Restricted selectors: `*`, `body`, `html`, `:root`, `head`, `main`, `#root`, `#__next`.

**Detection:** Any CSS rule whose selector matches or contains these elements at the top level.

**Correct**
```css
/* Scope all rules inside the extension container */
.extension-container {
  font-size: 14px;
}

.extension-container .title {
  font-weight: bold;
}
```

**Wrong**
```css
body {
  font-size: 14px;
}

* {
  box-sizing: border-box;
}

:root {
  --my-color: red;
}
```

---

### `CSS_CONTAINMENT_BREAKOUT` — CSS containment breakout

**Severity:** Violation (block)  
**Files:** `.css`

Restricted patterns: `:host`, `:host-context`, `::slotted`, `:global`, `position: fixed`, `position: absolute`, `z-index: 9999`.

**Detection:** Any rule or declaration matching these patterns.

> **Note on positioning:** `position: relative` and `position: sticky` within the extension container are generally safe. Avoid `fixed` and unbounded `absolute` that escape the extension boundary.

**Correct**
```css
.extension-container {
  position: relative; /* safe — contained */
}
```

**Wrong**
```css
.overlay {
  position: fixed;
  z-index: 9999;
  top: 0;
  left: 0;
}

:host {
  display: block;
}
```

---

### `CSS_NAMESPACE_REQUIRED` — Missing CSS namespace

**Severity:** Violation (block)  
**Files:** `.css`

All CSS selectors must be scoped under an allowed namespace prefix (default: `extension-`). The project uses plain CSS (not CSS modules), so all classes must be manually namespaced.

**Detection:** A selector not prefixed with any value from `allowedNamespaces`.

**Correct**
```css
/* Plain CSS — namespace all classes */
.extension-container { padding: 8px; }
.extension-title { font-size: 16px; }
```

**Wrong**
```css
/* Plain CSS — no namespace — pollutes global styles */
.container { padding: 8px; }
.title { font-size: 16px; }
```

---

### `CSS_GLOBAL_IMPORT` — CSS @import rules

**Severity:** Violation (block)  
**Files:** `.css`

`@import` pulls external stylesheets that affect global styles and bypass containment.

**Detection:** Any `@import` at-rule anywhere in the CSS file.

**Correct**
```css
/* Import a local CSS variable file via bundler config, not @import */
```

**Wrong**
```css
@import url('https://fonts.googleapis.com/css2?family=Roboto');
@import './reset.css';
```

---

### `CSS_GLOBAL_KEYFRAMES` — Keyframes without namespace

**Severity:** Violation (block)  
**Files:** `.css`

`@keyframes` names are global. Without a namespace they may conflict with other extensions or the Sales App shell.

**Detection:** `@keyframes` whose name does not start with an allowed namespace prefix.

**Correct**
```css
@keyframes extension-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

**Wrong**
```css
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

---

### `CSS_RESTRICTED_PROPERTY` — Restricted CSS properties

**Severity:** Violation (block)  
**Files:** `.css`

Certain properties affect layout or rendering globally and are restricted to prevent layout shift or containment breakout.

**Detection:** Declarations using restricted property names (e.g., properties that set global layout hints).

**Action:** If detected, remove or scope the declaration appropriately.

---

### `CSS_RESTRICTED_VALUE` — Restricted CSS values

**Severity:** Violation (block)  
**Files:** `.css`

Certain CSS values (e.g., `!important`) override the cascade and break containment guarantees.

**Detection:** `!important` in any declaration, or values targeting global layout tokens.

**Correct**
```css
.extension-button {
  color: var(--vtex-color-primary);
}
```

**Wrong**
```css
.extension-button {
  color: red !important;
}
```

---

## 3. React Performance Rules

Applied to `.tsx` files by `ReactPerformanceAnalyzer`. Violations block presentation; warnings are flagged to the user.

### `REACT_UNNECESSARY_RERENDER` — State update inside loop

**Severity:** Violation (block)  
**Files:** `.tsx`

State setter calls inside `for` or `while` loops trigger a re-render on every iteration.

**Detection:** A `setState` / `set*` call whose parent node is a `for` or `while` statement.

**Correct**
```typescript
// Compute derived value, then set once
const updatedItems = items.map(transform);
setItems(updatedItems);
```

**Wrong**
```typescript
for (const item of items) {
  setCount((c) => c + 1); // re-renders on every iteration
}
```

---

### `REACT_EXPENSIVE_OPERATION` — Expensive array operations in render

**Severity:** Violation (block)  
**Files:** `.tsx`

`Array.map`, `Array.filter`, `Array.reduce` called inside JSX expressions or as direct prop values fire on every render.

**Detection:** A call to these methods whose parent is a JSX expression container or a prop value.

**Correct**
```typescript
const filteredItems = useMemo(() => items.filter(isActive), [items]);

return <ul>{filteredItems.map((i) => <li key={i.id}>{i.name}</li>)}</ul>;
```

**Wrong**
```typescript
return (
  <ul>
    {items.filter(isActive).map((i) => <li key={i.id}>{i.name}</li>)}
  </ul>
);
```

---

### `REACT_ANONYMOUS_COMPONENT` — Anonymous (lowercase) component

**Severity:** Violation (block)  
**Files:** `.tsx`

Components assigned to variables starting with lowercase are treated as HTML tags by React and cannot be used in JSX.

**Detection:** Arrow function or function expression assigned to a variable that does not start with an uppercase letter.

**Correct**
```typescript
export function LoyaltyPoints(): JSX.Element { ... }
export const WarrantyBadge = (): JSX.Element => { ... };
```

**Wrong**
```typescript
const loyaltyPoints = (): JSX.Element => { ... };
const warrantyBadge = function() { ... };
```

---

### `REACT_DIRECT_DOM_MANIPULATION` — Direct DOM manipulation in React

**Severity:** Violation (block)  
**Files:** `.tsx`

Bypasses the React virtual DOM and causes unpredictable behavior.

**Detection:** Calls to `document.querySelector` or `document.getElementById` inside a React component.

**Correct**
```typescript
const containerRef = useRef<HTMLDivElement>(null);
// Access DOM via containerRef.current
```

**Wrong**
```typescript
const el = document.querySelector('.cart-list');
el.style.display = 'none'; // bypasses React
```

---

### `REACT_LAYOUT_EFFECT_MISUSE` — useLayoutEffect usage

**Severity:** Violation (block)  
**Files:** `.tsx`

`useLayoutEffect` blocks the browser paint and can cause performance issues in a sandboxed extension.

**Detection:** Any call to `useLayoutEffect`.

**Correct**
```typescript
useEffect(() => {
  // DOM reading/writing after paint
}, []);
```

**Wrong**
```typescript
useLayoutEffect(() => {
  // blocks paint
}, []);
```

---

### `REACT_MISSING_DEPS` — Missing dependency array

**Severity:** Warning (flag)  
**Files:** `.tsx`

`useEffect`, `useCallback`, or `useMemo` without a second argument re-runs on every render.

**Detection:** A call to one of these hooks with fewer than 2 arguments, or with a non-array second argument.

**Correct**
```typescript
useEffect(() => {
  fetchData();
}, [productId]); // explicit deps
```

**Wrong**
```typescript
useEffect(() => {
  fetchData(); // runs on every render
});
```

---

### `REACT_INLINE_FUNCTION` — Inline functions in JSX props

**Severity:** Warning (flag)  
**Files:** `.tsx`

Arrow functions defined directly in JSX attributes create a new function reference on every render, preventing child memoization.

**Detection:** Function expression or arrow function expression whose parent is a JSX expression container or prop.

**Correct**
```typescript
const handleClick = useCallback(() => {
  doSomething();
}, []);

return <button onClick={handleClick}>Click</button>;
```

**Wrong**
```typescript
return <button onClick={() => doSomething()}>Click</button>;
```

---

### `REACT_LARGE_COMPONENT` — Component over 200 lines

**Severity:** Warning (flag)  
**Files:** `.tsx`

Large components are harder to maintain and test. Threshold: **200 lines**.

**Detection:** A function/arrow function with start/end line difference > 200.

**Action:** Suggest splitting into smaller sub-components or extracting logic into custom hooks.

---

### `REACT_MANY_USESTATE` — More than 5 useState calls

**Severity:** Warning (flag)  
**Files:** `.tsx`

Many `useState` calls in a single component indicate complex local state. Threshold: **5 calls**.

**Detection:** More than 5 calls to `useState` (or `React.useState`) within a single function component.

**Action:** Suggest consolidating related state into a single `useState` with an object, or extracting to a custom hook.

**Correct**
```typescript
const [formState, setFormState] = useState({
  name: '',
  email: '',
  quantity: 1,
});
```

**Wrong**
```typescript
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [quantity, setQuantity] = useState(1);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [submitted, setSubmitted] = useState(false); // 6th useState — flagged
```

---

### `REACT_CONDITIONAL_HOOK` — Hook called conditionally

**Severity:** Warning (flag)  
**Files:** `.tsx`

Calling a hook inside an `if`, `switch`, or ternary expression violates the Rules of Hooks.

**Detection:** A hook call (useEffect, useState, useMemo, useCallback, useLayoutEffect) whose ancestor is an `IfStatement`, `SwitchStatement`, or `ConditionalExpression`.

**Correct**
```typescript
const cart = useCart(); // always called unconditionally

if (!cart) return <></>;
```

**Wrong**
```typescript
if (isEnabled) {
  const cart = useCart(); // conditional hook call — violates Rules of Hooks
}
```

---

### `REACT_COMPLEX_JSX` — Deep JSX nesting

**Severity:** Warning (flag)  
**Files:** `.tsx`

Deep JSX trees are harder to read and may indicate a need to extract sub-components. Threshold: **5 levels deep**.

**Detection:** A JSX element whose JSX child tree exceeds 5 levels of nesting.

**Action:** Extract inner JSX into a named sub-component.

---

### `REACT_UNOPTIMIZED_LIST` — List rendering without key or large list

**Severity:** Warning (flag)  
**Files:** `.tsx`

Missing `key` props in list rendering causes React reconciliation issues. Lists over 50 items may need virtualization.

**Detection:**
- `map()` producing JSX without a `key` attribute on the root element
- List size exceeding 50 items

**Correct**
```typescript
return (
  <ul>
    {items.map((item) => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
);
```

**Wrong**
```typescript
return (
  <ul>
    {items.map((item) => (
      <li>{item.name}</li> // missing key
    ))}
  </ul>
);
```

---

### `REACT_COMPLEX_STATE` — useState with complex object

**Severity:** Warning (flag)  
**Files:** `.tsx`

`useState` initialized with an object having more than 5 properties suggests a need for `useReducer`. Threshold: **5 properties**.

**Detection:** `useState(obj)` where `obj` is an object literal with > 5 properties.

**Action:** Suggest converting to `useReducer` for complex state.

---

### `REACT_NESTED_UPDATE` — Nested state updates

**Severity:** Warning (flag)  
**Files:** `.tsx`

Calling a state setter from within another state setter's callback can cause unexpected re-renders.

**Detection:** A `set*` call whose ancestor is another `set*` call expression.

---

## Validation Output Format

When reporting issues after code review, group by file and severity:

```
### Static Analysis Results

**Violations (must fix before completing Step 3):**
- [RULE_ID] File: ComponentName.tsx, Line ~N — <message>
  Fix: <suggested fix>

**Warnings (review with user):**
- [RULE_ID] File: ComponentName.tsx, Line ~N — <message>
  Suggestion: <improvement>

✅ No violations found. N warnings flagged.
```

Do not proceed with Step 4 (Documentation) until all violations are resolved.
