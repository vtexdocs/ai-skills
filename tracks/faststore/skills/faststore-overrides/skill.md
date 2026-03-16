---
name: faststore-overrides
description: >
  Apply when creating or modifying FastStore component overrides in src/components/overrides/. Covers
  getOverriddenSection API, component replacement, props overriding, and custom section creation. Use for
  any FastStore storefront customization beyond theming that requires changing component behavior or structure.
track: faststore
tags:
  - faststore
  - overrides
  - sections
  - components
  - getOverriddenSection
  - customization
globs:
  - "src/components/overrides/**/*.tsx"
  - "src/components/overrides/**/*.ts"
version: "1.0"
vtex_docs_verified: "2026-03-16"
---

# FastStore Section & Component Overrides

## Overview

**What this skill covers**: FastStore's override system for customizing native sections and components. This includes using `getOverriddenSection()` to create section-level overrides, replacing individual components within a section, and passing custom props to native components.

**When to use it**: When you need to customize the behavior or appearance of a FastStore storefront component beyond what theming and design tokens can achieve. Use overrides when you need to replace a component entirely, inject custom logic, or modify props on native components.

**What you'll learn**:
- How to create override files in `src/components/overrides/`
- How to use `getOverriddenSection()` to customize sections
- How to override individual components within a section
- How to pass custom props to native components while preserving integration

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Sections vs Components

In FastStore, **sections** are top-level layout components that organize and encapsulate other components. For example, the `Hero` section contains `Hero`, `HeroImage`, and `HeroHeader` components. Overrides work at the section level — you override a section and then customize the individual components within it. You cannot override a component outside the context of its parent section.

### Concept 2: The `getOverriddenSection()` Function

`getOverriddenSection()` is the core API for creating overrides. It accepts a configuration object with the original `Section`, an optional `className`, and a `components` map specifying which child components to replace or customize. It returns a new React component that replaces the original section while preserving all native behavior and integrations.

### Concept 3: Override File Convention

Override files live in `src/components/overrides/` and are named after the section they override (e.g., `ProductDetails.tsx` for the `ProductDetails` section). Each file exports the overridden section as default. FastStore automatically discovers and applies overrides from this directory.

**Architecture/Data Flow**:
```text
src/components/overrides/[SectionName].tsx
  → imports Section from @faststore/core
  → calls getOverriddenSection({ Section, components: {...} })
  → exports overridden section as default
  → FastStore renders overridden version in place of native section
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Use the Override API — Never Modify FastStore Core

**Rule**: MUST use `getOverriddenSection()` from `@faststore/core` to customize sections. MUST NOT directly modify files in `node_modules/@faststore/` or import internal source files.

**Why**: Modifying `node_modules` is ephemeral (changes are lost on `npm install`) and importing from internal paths like `@faststore/core/src/` creates tight coupling to implementation details that can break on any FastStore update.

**Detection**: If you see imports from `@faststore/core/src/` (internal source paths) → STOP. These are private implementation details. Only import from the public API: `@faststore/core` and `@faststore/core/experimental`. If you see direct file edits in `node_modules/@faststore/` → STOP immediately and use the override system instead.

✅ **CORRECT**:
```typescript
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

import CustomProductTitle from '../CustomProductTitle'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    ProductTitle: { Component: CustomProductTitle },
  },
})

export default OverriddenProductDetails
```

❌ **WRONG**:
```typescript
// WRONG: Importing from internal source paths
import { ProductDetails } from '@faststore/core/src/components/sections/ProductDetails'
// This path is an implementation detail that can change without notice.
// It bypasses the public API and will break on FastStore updates.

// WRONG: Modifying node_modules directly
// Editing node_modules/@faststore/core/dist/components/ProductDetails.js
// Changes are lost on every npm install and cannot be version-controlled.
```

---

### Constraint: Override Files Must Live in src/components/overrides/

**Rule**: MUST place override files in the `src/components/overrides/` directory, named after the section being overridden (e.g., `ProductDetails.tsx`).

**Why**: FastStore's build system scans `src/components/overrides/` to discover and apply section overrides. Files placed elsewhere will not be detected and the override will silently fail — the native section will render instead with no error message.

**Detection**: If you see override-related code (calls to `getOverriddenSection`) in files outside `src/components/overrides/` → warn that the override will not be applied. Check that the filename matches a valid native section name from the FastStore section list.

✅ **CORRECT**:
```typescript
// src/components/overrides/Alert.tsx
// File is in the correct directory and named after the Alert section
import { getOverriddenSection } from '@faststore/core'
import { AlertSection } from '@faststore/core'

import CustomIcon from '../CustomIcon'

const OverriddenAlert = getOverriddenSection({
  Section: AlertSection,
  components: {
    Icon: { Component: CustomIcon },
  },
})

export default OverriddenAlert
```

❌ **WRONG**:
```typescript
// src/components/MyCustomAlert.tsx
// WRONG: File is NOT in src/components/overrides/
// FastStore will NOT discover this override.
// The native Alert section will render unchanged.
import { getOverriddenSection } from '@faststore/core'
import { AlertSection } from '@faststore/core'

const OverriddenAlert = getOverriddenSection({
  Section: AlertSection,
  components: {
    Icon: { Component: CustomIcon },
  },
})

export default OverriddenAlert
```

---

### Constraint: Override Only Documented Overridable Components

**Rule**: MUST only override components listed as overridable in the FastStore native sections documentation. Components prefixed with `__experimental` can be overridden but their props are not accessible.

**Why**: Attempting to override a component not listed as overridable will silently fail. The override configuration will be ignored and the native component will render. Components marked `__experimental` have unstable prop interfaces that may change without notice.

**Detection**: If you see a component name in the `components` override map that does not appear in the FastStore list of overridable components for that section → warn that this override may not work. If the component is prefixed with `__experimental` → warn about inaccessible props and instability.

✅ **CORRECT**:
```typescript
// src/components/overrides/ProductDetails.tsx
// ProductTitle is a documented overridable component of ProductDetails section
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    ProductTitle: {
      props: {
        refNumber: true,
        showDiscountBadge: false,
      },
    },
  },
})

export default OverriddenProductDetails
```

❌ **WRONG**:
```typescript
// src/components/overrides/ProductDetails.tsx
// "InternalPriceCalculator" is NOT a documented overridable component
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    // This component name does not exist in the overridable list.
    // The override will be silently ignored.
    InternalPriceCalculator: { Component: MyPriceCalculator },
  },
})

export default OverriddenProductDetails
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Create the overrides directory

Ensure your project has the `src/components/overrides/` directory. If it doesn't exist, create it:

```typescript
// Terminal command:
// mkdir -p src/components/overrides
//
// Project structure after creation:
// src/
//   components/
//     overrides/    ← override files go here
//     ...           ← custom components go here
```

### Step 2: Create a custom component (if replacing a component)

If you need to replace a native component entirely, create your custom component first. Place it in `src/components/`:

```typescript
// src/components/CustomBuyButton.tsx
import React from 'react'
import { Button as UIButton } from '@faststore/ui'
import { useCart } from '@faststore/sdk'

interface CustomBuyButtonProps {
  children?: React.ReactNode
}

export default function CustomBuyButton({ children }: CustomBuyButtonProps) {
  const { addItem } = useCart()

  const handleClick = () => {
    // Custom buy button logic — for example, showing a confirmation toast
    console.log('Item added to cart')
  }

  return (
    <UIButton
      variant="primary"
      onClick={handleClick}
      data-fs-buy-button
    >
      {children || 'Add to Cart'}
    </UIButton>
  )
}
```

### Step 3: Create the override file

Create the override file in `src/components/overrides/` named after the target section:

```typescript
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

import CustomBuyButton from '../CustomBuyButton'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    BuyButton: { Component: CustomBuyButton },
  },
})

export default OverriddenProductDetails
```

### Step 4: Override props without replacing the component

If you only need to change a component's props (not replace it entirely), use the `props` key instead of `Component`:

```typescript
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    BuyButton: {
      props: {
        size: 'small',
        iconPosition: 'left',
      },
    },
  },
})

export default OverriddenProductDetails
```

### Complete Example

Full end-to-end example: overriding the Alert section with a custom icon and custom styling:

```typescript
// src/components/BoldIcon.tsx
import React from 'react'

interface BoldIconProps {
  width?: number
  height?: number
}

export default function BoldIcon({ width = 24, height = 24 }: BoldIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
```

```typescript
// src/components/overrides/Alert.tsx
import { getOverriddenSection } from '@faststore/core'
import { AlertSection } from '@faststore/core'
import styles from './simple-alert.module.scss'

import BoldIcon from '../BoldIcon'

const OverriddenAlert = getOverriddenSection({
  Section: AlertSection,
  className: styles.simpleAlert,
  components: {
    Icon: { Component: BoldIcon },
  },
})

export default OverriddenAlert
```

```scss
/* src/components/overrides/simple-alert.module.scss */
.simpleAlert {
  [data-fs-alert] {
    background-color: var(--fs-color-warning-bkg);
    border-radius: var(--fs-border-radius);
    padding: var(--fs-spacing-2) var(--fs-spacing-3);
  }
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Monkey-Patching FastStore Internals

**What happens**: Developer modifies files inside `node_modules/@faststore/` directly, or patches FastStore source code using `patch-package` for changes that the override system supports.

**Why it fails**: Direct modifications to `node_modules` are not version-controlled and are wiped on every `npm install` or CI build. Using `patch-package` for overridable changes creates unnecessary maintenance burden — patches break on every FastStore update and must be manually reconciled. The override system exists specifically to handle these customizations in a forward-compatible way.

**Fix**: Use `getOverriddenSection()` for all section and component customizations. Reserve `patch-package` only for genuine bug fixes in FastStore that have no override-based workaround.

```typescript
// src/components/overrides/ProductDetails.tsx
// Use the override system instead of patching node_modules
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

import CustomProductTitle from '../CustomProductTitle'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    ProductTitle: { Component: CustomProductTitle },
  },
})

export default OverriddenProductDetails
```

---

### Anti-Pattern: Using CSS `!important` Instead of Overrides

**What happens**: Developer uses `!important` declarations in global CSS to force visual changes on FastStore native components instead of using the override API to replace or customize components.

**Why it fails**: `!important` declarations create specificity wars that are difficult to debug and maintain. They can conflict with FastStore's structural styles and design token system. When FastStore updates its CSS, `!important` overrides may produce unexpected results. The override system provides a clean, maintainable way to change both behavior and appearance.

**Fix**: Use the override system to replace components, or use the theming/design token system for visual-only changes.

```typescript
// For behavioral changes, use overrides:
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'

import CustomBuyButton from '../CustomBuyButton'

const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    BuyButton: { Component: CustomBuyButton },
  },
})

export default OverriddenProductDetails

// For visual-only changes, use design tokens in src/themes/custom-theme.scss:
// [data-fs-buy-button] {
//   --fs-button-primary-bkg-color: var(--fs-color-accent-0);
//   --fs-button-primary-text-color: var(--fs-color-text-inverse);
// }
```

---

### Anti-Pattern: Wrapper Components Instead of Override API

**What happens**: Developer creates a wrapper component that renders the native FastStore section and adds logic around it (e.g., wrapping `<ProductDetailsSection>` in a custom `<div>` with event handlers), bypassing the override system entirely.

**Why it fails**: Wrapper components do not integrate with FastStore's section discovery, Headless CMS, or analytics tracking. The wrapped section will not appear in the CMS editor for content managers. Props passed from the CMS to the section may not propagate correctly through the wrapper. Analytics events tied to the section lifecycle may not fire.

**Fix**: Use `getOverriddenSection()` with the `className` option for styling wrappers, and the `components` map for behavioral changes.

```typescript
// src/components/overrides/ProductDetails.tsx
import { getOverriddenSection } from '@faststore/core'
import { ProductDetailsSection } from '@faststore/core'
import styles from './custom-product-details.module.scss'

import CustomBuyButton from '../CustomBuyButton'

// Use className for wrapper-level styling and components for behavior
const OverriddenProductDetails = getOverriddenSection({
  Section: ProductDetailsSection,
  className: styles.customProductDetails,
  components: {
    BuyButton: { Component: CustomBuyButton },
  },
})

export default OverriddenProductDetails
```

## Reference

**Links to VTEX documentation and related resources.**

- [Overrides overview](https://developers.vtex.com/docs/guides/faststore/overrides-overview) — Introduction to the FastStore override system and when to use it
- [getOverriddenSection function](https://developers.vtex.com/docs/guides/faststore/overrides-getoverriddensection-function) — API reference for the core override function
- [Override native components and props](https://developers.vtex.com/docs/guides/faststore/overrides-components-and-props-v1) — Step-by-step guide for overriding component props
- [Override a native component](https://developers.vtex.com/docs/guides/faststore/overrides-native-component) — Guide for replacing a native component entirely
- [List of native sections and overridable components](https://developers.vtex.com/docs/guides/faststore/building-sections-list-of-native-sections) — Complete reference of which components can be overridden per section
- [Creating a new section](https://developers.vtex.com/docs/guides/faststore/building-sections-creating-a-new-section) — Guide for creating custom sections when overrides are insufficient
- [Troubleshooting overrides](https://developers.vtex.com/docs/troubleshooting/my-store-does-not-reflect-the-overrides-i-created) — Common issues and solutions when overrides don't work
- [FastStore Theming & Design Tokens](../faststore-theming/skill.md) — Related skill for visual customizations that don't require overrides
