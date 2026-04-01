This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when connecting react components to store framework blocks and render-runtime behavior in vtex io. covers interfaces.json, block registration, block composition, and how storefront components become configurable theme blocks. use for block mapping, theme integration, or reviewing whether a react component is correctly exposed to store framework.

# Render Runtime & Block Registration

## When this skill applies

Use this skill when a VTEX IO storefront component needs to be exposed to Store Framework as a block.

- Registering components in `store/interfaces.json`
- Mapping block names to React components
- Defining block composition and allowed children
- Reviewing whether a component is correctly wired into theme JSON

Do not use this skill for:
- shopper-facing component internals
- admin interfaces
- backend service or route design
- policy modeling

## Decision rules

- Every block visible to Store Framework must be registered in `store/interfaces.json`.
- Keep block names, component mapping, and composition explicit.
- The block ID used as the key in `store/interfaces.json`, for example `product-reviews`, is the same ID that storefront themes reference under `blocks` in `store/*.json`.
- The `component` field should map to the React entry name under `react/`, such as `ProductReviews`, or a nested path such as `product/ProductReviews` when the app structure is hierarchical.
- Use `composition` intentionally when the block needs an explicit child model. `children` means the component renders nested blocks through `props.children`, while `blocks` means the block exposes named block slots controlled by Store Framework.
- `composition` is optional. For many simple blocks, declaring `component` and, when needed, `allowed` is enough.
- Use this skill for the render/runtime contract, and use storefront/admin skills for the component implementation itself.

## Hard constraints

### Constraint: Storefront blocks must be declared in interfaces.json

Every React component intended for Store Framework use MUST have a corresponding `interfaces.json` entry.

**Why this matters**

Without the interface declaration, the component cannot be referenced from theme JSON.

**Detection**

If a storefront React component is intended to be used as a block but has no matching interface entry, STOP and add it first.

**Correct**

```json
{
  "product-reviews": {
    "component": "ProductReviews"
  }
}
```

**Wrong**

```tsx
// react/ProductReviews.tsx exists with no interfaces.json mapping
```

### Constraint: Component mapping must resolve to real React entry files

The `component` field in `interfaces.json` MUST map to a real exported React entry file.

**Why this matters**

Broken mapping silently disconnects block contracts from implementation.

**Detection**

If an interface points to a component name with no corresponding React entry file, STOP and fix the mapping.

**Correct**

```json
{
  "product-reviews": {
    "component": "ProductReviews"
  }
}
```

**Wrong**

```json
{
  "product-reviews": {
    "component": "MissingComponent"
  }
}
```

### Constraint: Block composition must be intentional

Composition and allowed child blocks MUST match the component's actual layout and runtime expectations.

**Why this matters**

Incorrect composition contracts make theme usage brittle and confusing.

**Detection**

If `allowed` or `composition` do not reflect how the component is supposed to receive children, STOP and correct the block contract.

**Correct**

```json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-item"]
  }
}
```

**Wrong**

```json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "blocks",
    "allowed": []
  }
}
```

## Preferred pattern

Keep block contracts explicit in `interfaces.json` and keep block implementation concerns separate from render-runtime registration.

Minimal block lifecycle:

```json
// store/interfaces.json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-item"]
  },
  "product-review-item": {
    "component": "ProductReviewItem"
  }
}
```

```json
// store/home.json
{
  "store.home": {
    "blocks": ["product-reviews"]
  }
}
```

```tsx
// react/ProductReviews.tsx
export default function ProductReviews() {
  return <div>...</div>
}
```

This wiring makes the block name visible in the theme, maps it to a real React entry, and keeps composition rules explicit at the render-runtime boundary.

## Common failure modes

- Forgetting to register a storefront component as a block.
- Mapping block names to missing React entry files.
- Using the wrong composition model.

## Review checklist

- [ ] Is the block declared in `interfaces.json`?
- [ ] Does the component mapping resolve correctly?
- [ ] Are composition and allowed children intentional?
- [ ] Is runtime registration clearly separated from component internals?

## Reference

- [Store Framework](https://developers.vtex.com/docs/guides/vtex-io-documentation-store-framework) - Block and theme context
