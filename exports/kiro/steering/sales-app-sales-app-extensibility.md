<!-- globs: packages/sales-app/**/*.tsx, packages/sales-app/**/*.ts, packages/sales-app/**/*.css, packages/sales-app/src/index.tsx -->

Apply when building, customizing, or deploying extensions for VTEX Sales App. Covers the complete 6-step workflow from prerequisite checks through code generation to deployment, including extension points (cart, PDP, menu), React hooks (useCart, usePDP, useCartItem, useCurrentUser, useExtension), TypeScript types, and secure API integration patterns.

# Sales App Extensibility

## When this skill applies

Use this skill when building, customizing, or deploying extensions for VTEX Sales App.

- Adding features to the cart page (promotions, loyalty, services)
- Adding features to the Product Detail Page (badges, recommendations, warranties)
- Adding features to the menu (user profile, navigation, metrics)
- Integrating external APIs into Sales App extensions
- Generating, scaffolding, or validating extension code for Sales App

Do not use this skill for:
- Regular FastStore storefront customization (use `faststore-storefront`)
- Building VTEX IO apps (use `vtex-io-*` skills)
- Sales App core development or framework modifications

### Prerequisite: FastStore project

The project root must contain: `biome.json`, `faststore.json`, `package.json`, `tsconfig.json`, `turbo.json`.

If any are missing, **STOP**. The user must install FastStore first:

```bash
npx @vtex/fsp-cli init
# Prompt: "What is the application name?" → enter name or press Enter for default
cd <application-name> && yarn
```

Documentation: https://beta.fast.store/getting-started

### Prerequisite: Sales App module

Inside the FastStore project, a Sales App workspace must exist (typically at `packages/sales-app`) with `src/`, `package.json`, and `tsconfig.json`. Check root `package.json` `"workspaces"` for a path containing `sales-app`. If missing, **STOP**:

```bash
yarn add @vtex/sales-app -D -W
npx fsp create
# Prompts: account name → "Sales App" → path (default or custom)
# Then add the path to root package.json "workspaces" array
yarn install
```

Documentation: https://beta.fast.store/sales-app/setting-up

**Do NOT proceed to discovery or code generation until both prerequisites are confirmed.**

## Decision rules

Follow the mandatory 6-step workflow in order. Do not skip steps.

| Step | Purpose | Gate |
|------|---------|------|
| 0 | Check prerequisites | FastStore + Sales App installed → proceed; otherwise STOP |
| 1 | Discovery | Understand what the user wants to build |
| 2 | Requirements & Plan | Map requirements → generate plan → **wait for user approval** |
| 3 | Code Generation & Validation | Generate component + CSS + index.tsx → validate |
| 4 | Local Testing | Provide dev commands and URLs |
| 5 | Build & Deploy | Build command → deployment guide |

### Extension point selection

| Extension Point | Category | Available Hooks | Layout Shift |
|----------------|----------|----------------|--------------|
| `cart.cart-list.after` | Cart | useCart, useExtension | No |
| `cart.cart-item.after` | Cart | useCart, useCartItem, useExtension | Yes |
| `cart.order-summary.after` | Cart | useCart, useExtension | Yes |
| `pdp.sidebar.before` | PDP | usePDP, useCart, useExtension | Yes |
| `pdp.sidebar.after` | PDP | usePDP, useCart, useExtension | Yes |
| `pdp.content.after` | PDP | usePDP, useCart, useExtension | Yes |
| `menu.item` | Menu | useExtension | No |
| `menu.drawer-content` | Menu | useCurrentUser, useExtension | No |

### Hook availability

- **useCart** → all cart + PDP extensions
- **useCartItem** → `cart.cart-item.after` only
- **useCurrentUser** → `menu.drawer-content` only
- **usePDP** → PDP extensions only
- **useExtension** → all extension points

### Template selection

- No API + no hooks → **simple template**
- No API + hooks → **hook template**
- API + no auth → **API template**
- API + VTEX IO proxy → **IO proxy template** (recommended)
- API + direct auth → **direct auth template** (insecure, warn user)

### API authentication strategy

1. **Recommended: VTEX IO Proxy App** — IO app stores keys server-side. Extension uses `credentials: 'include'` with a **relative path** (`/_v/my-api/data`).
2. **Insecure: Direct Auth** — Keys in frontend code, visible in browser. Testing/development only.

## Hard constraints

### Constraint: Component must return JSX.Element, never null

`defineExtensions` expects `ExtensionPointComponent` which returns `Element`, not `Element | null`.

**Why this matters**
Returning `null` causes a TypeScript compilation error. The build will fail.

**Detection**
`return null` in any component registered with `defineExtensions`.

**Correct**

```typescript
export function MyExtension(): JSX.Element {
  if (!data) return (<></>);
  return <div>{data.value}</div>;
}
```

**Wrong**

```typescript
export function MyExtension(): JSX.Element | null {
  if (!data) return null;
  return <div>{data.value}</div>;
}
```

### Constraint: Guard optional properties before use

`CartItem.manualPrice` (number | undefined), `CartItem.productRefId` (string | undefined), `CartItem.attachments` (Attachment[] | undefined) must be guarded.

**Why this matters**
TypeScript strict mode rejects accessing possibly-undefined values.

**Detection**
`item.manualPrice`, `item.productRefId`, or `item.attachments` without `?.`, `??`, `&&`, or `!= null`.

**Correct**

```typescript
const price = item.manualPrice ?? item.sellingPrice;
const refId = item.productRefId ?? 'N/A';
const count = item.attachments?.length ?? 0;
```

**Wrong**

```typescript
const price = item.manualPrice;
const refId = item.productRefId.toUpperCase();
const count = item.attachments.length;
```

### Constraint: useCartItem().item may be undefined

`item` from `useCartItem()` is `CartItem | undefined`.

**Why this matters**
Accessing properties on `undefined` causes a runtime crash.

**Detection**
Destructured `item` from `useCartItem()` used without `if (!item)` guard.

**Correct**

```typescript
const { item } = useCartItem();
if (!item) return (<></>);
return <div>{item.name}</div>;
```

**Wrong**

```typescript
const { item } = useCartItem();
return <div>{item.name}</div>;
```

### Constraint: Never expose authentication keys in frontend code

API keys in `fetch` headers are visible in the browser network tab.

**Why this matters**
Leaked keys compromise the external service.

**Detection**
Literal auth header values in `fetch()`: `'x-api-key': '...'`, `'Authorization': 'Bearer ...'`.

**Correct**

```typescript
const response = await fetch('/_v/my-api/data', {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
});
```

**Wrong**

```typescript
const response = await fetch('https://api.example.com/data', {
  headers: { 'x-api-key': 'sk-secret-key-12345' },
});
```

### Constraint: IO Proxy must use relative paths only

The Sales App internal proxy resolves the domain automatically.

**Why this matters**
A full URL bypasses the proxy, breaking session cookies and causing CORS errors.

**Detection**
`fetch('https://{account}.myvtex.com/...')` in IO proxy components.

**Correct**

```typescript
await fetch('/_v/my-loyalty-api/points', { credentials: 'include' });
```

**Wrong**

```typescript
await fetch('https://myaccount.myvtex.com/_v/my-loyalty-api/points');
```

### Constraint: defineExtensions is required in index.tsx

Entry point must use `defineExtensions` from `@vtex/sales-app`.

**Why this matters**
Without it, the build succeeds but no extensions render.

**Detection**
Missing `defineExtensions` import or call in `index.tsx`.

**Correct**

```typescript
import { defineExtensions } from '@vtex/sales-app';
import { MyExtension } from './components/MyExtension';
export default defineExtensions({ 'cart.cart-list.after': MyExtension });
```

**Wrong**

```typescript
import { MyExtension } from './components/MyExtension';
export default { 'cart.cart-list.after': MyExtension };
```

### Constraint: Extension point names must match exactly

IDs are a fixed set. Non-existent names silently fail.

**Why this matters**
The extension renders nowhere. No build error — invisible at runtime.

**Detection**
Any name not in: `cart.cart-list.after`, `cart.cart-item.after`, `cart.order-summary.after`, `pdp.sidebar.before`, `pdp.sidebar.after`, `pdp.content.after`, `menu.item`, `menu.drawer-content`.

**Correct**

```typescript
defineExtensions({ 'cart.cart-list.after': MyExtension });
```

**Wrong**

```typescript
defineExtensions({ 'cart.list.after': MyExtension });
```

### Constraint: Hooks must be used in compatible extension points

Each hook has an `available_in` restriction.

**Why this matters**
Hook context is only mounted for specific extension points. Using elsewhere throws runtime errors.

**Detection**
`useCartItem` in PDP/menu. `useCurrentUser` in cart. `usePDP` in menu/cart-list.

**Correct**

```typescript
// useCartItem in cart.cart-item.after ✓
defineExtensions({ 'cart.cart-item.after': ItemWarranty });
```

**Wrong**

```typescript
// useCartItem in pdp.sidebar.after ✗ — will fail at runtime
defineExtensions({ 'pdp.sidebar.after': ItemWarranty });
```

### Constraint: Always present execution plan and wait for approval

Do not generate code until the user confirms the plan.

**Why this matters**
Generating without agreement wastes effort and may produce the wrong extension.

**Detection**
Jumping from discovery to code generation without presenting a plan.

**Correct**
Discovery → Requirements → Present plan → **User approves** → Generate code.

**Wrong**
Discovery → Generate code immediately.

## Preferred pattern

### Workflow overview

**Step 0** — Check FastStore + Sales App prerequisites. STOP if missing.

**Step 1** — Discovery. Detect use case from keywords, ask follow-up questions, determine API auth strategy. Load the [discovery reference](references/discovery-and-use-cases.md) for detailed question flows.

**Step 2** — Map requirements to extension point + hooks + template. Present plan. Wait for approval.

**Step 3** — Generate component, CSS, and index.tsx. Validate against the 10-point checklist. Load the [code templates reference](references/code-templates-and-patterns.md) for all template patterns and the [types reference](references/extension-points-hooks-and-types.md) for hook return types and TypeScript definitions.

**Step 4** — Provide local dev commands and test URLs. Load the [dev/build/deploy reference](references/local-dev-build-and-deploy.md).

**Step 5** — Build command and deployment guide. Load the [dev/build/deploy reference](references/local-dev-build-and-deploy.md).

## Reference Files

Load these on demand based on what the task requires. Do not load all of them upfront.

| File | Load when… |
|------|-----------|
| [references/extension-points-hooks-and-types.md](references/extension-points-hooks-and-types.md) | Choosing an extension point, selecting hooks, looking up TypeScript types (`CartItem`, `ProductSku`, `Totalizers`, `Attachment`), or checking hook return values and availability per extension point |
| [references/code-templates-and-patterns.md](references/code-templates-and-patterns.md) | Generating extension code — simple, hook, API, IO Proxy, or Direct Auth templates; CSS module pattern; `index.tsx` with `defineExtensions`; hook initialization; validation checklist |
| [references/discovery-and-use-cases.md](references/discovery-and-use-cases.md) | Running Step 1 (Discovery) — use case detection keywords, follow-up questions, API auth decision tree, IO Proxy vs Direct Auth flow |
| [references/local-dev-build-and-deploy.md](references/local-dev-build-and-deploy.md) | Running Steps 4–5 — dev server commands, test URLs, build command, common build errors, FastStore WebOps deployment, monitoring, rollback |

## Common failure modes

- **Returning null instead of empty fragment** — `return null` not allowed; use `return (<></>)`. Build fails.
- **Accessing item.manualPrice without guard** — TypeScript "possibly undefined" error. Use `??`.
- **Using useCartItem outside cart.cart-item.after** — Hook context only exists there. Runtime error.
- **Hardcoding auth tokens in frontend fetch** — Keys visible in browser. Use VTEX IO proxy.
- **Using full URL with IO Proxy** — Bypasses internal proxy. Use relative path `/_v/...`.
- **Placing code outside packages/sales-app/src/** — Not included in build.
- **Missing defineExtensions in index.tsx** — Extension compiles but never renders.
- **Skipping prerequisite checks** — Generating code without FastStore/Sales App installed.
- **Not presenting plan** — User may want a different approach. Always confirm.
- **Invented extension point names** — `cart.list.after` instead of `cart.cart-list.after` fails silently.

## Review checklist

- [ ] FastStore installed (biome.json, faststore.json, package.json, tsconfig.json, turbo.json)?
- [ ] Sales App module installed (src/, package.json, tsconfig.json in sales-app directory)?
- [ ] Discovery completed and use case identified?
- [ ] Execution plan approved by user?
- [ ] Extension point is valid (from the 8-point reference)?
- [ ] Hooks compatible with chosen extension point?
- [ ] Component returns JSX.Element, never null?
- [ ] Optional properties guarded (manualPrice, productRefId, attachments)?
- [ ] useCartItem().item checked for undefined?
- [ ] No auth credentials exposed in frontend code?
- [ ] IO Proxy uses relative path (/_v/...)?
- [ ] defineExtensions configured in index.tsx?
- [ ] CSS file path matches component name?
- [ ] Build passes: `yarn fsp build {account} sales-app`?
- [ ] Tested locally: `yarn fsp dev {account}`?

## Related skills

- `faststore-storefront` — storefront customization outside Sales App
- `vtex-io-app-contract` — building VTEX IO proxy apps for secure API integration

## Reference

- Sales App setup: https://beta.fast.store/sales-app/setting-up
- FastStore getting started: https://beta.fast.store/getting-started
- VTEX Sales App documentation: https://help.vtex.com/en/tracks/instore-getting-started-and-setting-up
- VTEX IO app development: https://developers.vtex.com/docs/guides/vtex-io-documentation-developing-an-app
