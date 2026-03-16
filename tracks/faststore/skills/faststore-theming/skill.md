---
name: faststore-theming
description: >
  Apply when editing FastStore theme files in src/themes/ or working with design tokens and SCSS variables.
  Covers global tokens, local component tokens, Sass variables, CSS custom properties, and Brandless
  architecture. Use for any visual customization of FastStore storefronts that does not require component overrides.
track: faststore
tags:
  - faststore
  - theming
  - design-tokens
  - css
  - sass
  - brandless
  - styling
globs:
  - "src/themes/**/*.scss"
  - "src/themes/**/*.css"
  - "**/*.tokens.scss"
version: "1.0"
vtex_docs_verified: "2026-03-16"
---

# FastStore Theming & Design Tokens

## Overview

**What this skill covers**: FastStore's theming system, including design tokens (global and local), the Brandless default theme, custom theme creation, and component-level styling using Sass and CSS custom properties.

**When to use it**: When you need to change the visual appearance of a FastStore storefront — colors, typography, spacing, borders, or component-specific styles — without changing component behavior. Theming is the first tool to reach for before considering overrides.

**What you'll learn**:
- How global and local design tokens work together in the token hierarchy
- How to create and apply a custom theme in `src/themes/`
- How to style individual components using local tokens and data attributes
- How to maintain consistency using the Brandless architecture

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: Design Tokens

Design tokens are named CSS custom properties (variables) that define the visual properties of your store. FastStore organizes tokens into two tiers:
- **Global tokens** define system-wide values: colors, typography, spacing, borders, and transitions. They follow the naming pattern `--fs-{type}-{category}-{variant}` (e.g., `--fs-color-main-0`, `--fs-spacing-3`, `--fs-text-size-body`).
- **Local tokens** are component-specific and typically inherit from global tokens. They follow the pattern `--fs-{component}-{property}` (e.g., `--fs-button-primary-bkg-color`).

Changing a global token propagates through all components that reference it. Changing a local token affects only that component.

### Concept 2: Brandless Architecture

Brandless is FastStore's default theme — a minimal, unopinionated foundation composed of two layers:
- **Structural Styles**: Foundational design patterns and interaction behaviors (show/hide menus, layout grids). These should rarely be modified.
- **Theme Layer**: The customizable layer where branding happens. This is where you modify design tokens to change colors, typography, spacing, and other visual properties.

The Brandless base tokens are defined in `@faststore/ui` at `src/styles/base/tokens.scss`. Your custom theme overrides these values.

### Concept 3: Custom Theme Files

Custom themes live in `src/themes/` as `.scss` files. The main entry point is `src/themes/custom-theme.scss`. This file is where you override global tokens and add component-specific styling using data attributes. FastStore's build process automatically picks up this file.

**Architecture/Data Flow**:
```text
@faststore/ui base tokens (Brandless defaults)
  → src/themes/custom-theme.scss (your global token overrides)
    → Component local tokens (inherit from globals unless explicitly overridden)
      → Rendered component styles
```

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: Use Design Tokens — Not Inline Styles

**Rule**: MUST use design tokens (global or local) to style FastStore components. MUST NOT use inline `style={}` props on FastStore components for theming purposes.

**Why**: Inline styles bypass the design token hierarchy, cannot be overridden by themes, do not participate in responsive breakpoints, and create maintenance nightmares. They also defeat CSS caching since styles are embedded in HTML. Design tokens ensure consistency and allow store-wide changes from a single file.

**Detection**: If you see `style={{` or `style={` on FastStore native components (components imported from `@faststore/ui` or `@faststore/core`) → warn that this bypasses the theming system. Suggest using design tokens or CSS modules instead. Exception: inline styles are acceptable on fully custom components that are not part of the FastStore UI library.

✅ **CORRECT**:
```typescript
// src/themes/custom-theme.scss
// Override the BuyButton's primary background color using design tokens
[data-fs-buy-button] {
  --fs-button-primary-bkg-color: #e31c58;
  --fs-button-primary-bkg-color-hover: #c4174d;
  --fs-button-primary-text-color: var(--fs-color-text-inverse);

  [data-fs-button-wrapper] {
    border-radius: var(--fs-border-radius-pill);
  }
}
```

❌ **WRONG**:
```typescript
// WRONG: Using inline styles on a FastStore component
import { BuyButton } from '@faststore/ui'

function ProductActions() {
  return (
    <BuyButton
      style={{ backgroundColor: '#e31c58', color: 'white', borderRadius: '999px' }}
    >
      Add to Cart
    </BuyButton>
  )
  // Inline styles bypass the design token hierarchy.
  // They cannot be changed store-wide from the theme file.
  // They do not respond to dark mode or other theme variants.
}
```

---

### Constraint: Place Theme Files in src/themes/

**Rule**: MUST place custom theme SCSS files in the `src/themes/` directory. The primary theme file must be named `custom-theme.scss`.

**Why**: FastStore's build system imports theme files from `src/themes/custom-theme.scss`. Files placed elsewhere will not be picked up by the build and your token overrides will have no effect. There will be no error — the default Brandless theme will render instead.

**Detection**: If you see token override declarations (variables starting with `--fs-`) in SCSS files outside `src/themes/` → warn that these may not be applied. If the file `src/themes/custom-theme.scss` does not exist in the project → warn that no custom theme is active.

✅ **CORRECT**:
```typescript
// src/themes/custom-theme.scss
// Global token overrides — applied store-wide
:root {
  --fs-color-main-0: #003232;
  --fs-color-main-1: #004c4c;
  --fs-color-main-2: #006666;
  --fs-color-main-3: #008080;
  --fs-color-main-4: #00b3b3;

  --fs-color-accent-0: #e31c58;
  --fs-color-accent-1: #c4174d;
  --fs-color-accent-2: #a51342;

  --fs-text-face-body: 'Inter', -apple-system, system-ui, BlinkMacSystemFont, sans-serif;
  --fs-text-face-title: 'Poppins', var(--fs-text-face-body);

  --fs-text-size-title-huge: 3.5rem;
  --fs-text-size-title-page: 2.25rem;
}

// Component-specific token overrides
[data-fs-price] {
  --fs-price-listing-color: #cb4242;
}
```

❌ **WRONG**:
```typescript
// src/styles/my-theme.scss
// WRONG: This file is in src/styles/, not src/themes/
// FastStore will NOT import this file. Token overrides will be ignored.
:root {
  --fs-color-main-0: #003232;
  --fs-color-accent-0: #e31c58;
}

// Also WRONG: Creating a theme in the project root
// ./theme.scss — this will not be discovered by the build system
```

---

### Constraint: Use Data Attributes for Component Targeting

**Rule**: MUST use FastStore's `data-fs-*` data attributes to target components in theme SCSS files. MUST NOT use class names or tag selectors to target FastStore native components.

**Why**: FastStore components use data attributes as their public styling API (e.g., `data-fs-button`, `data-fs-price`, `data-fs-hero`). Class names are implementation details that can change between versions. Using data attributes ensures your theme survives FastStore updates. Each component documents its available data attributes in the customization section of its docs.

**Detection**: If you see CSS selectors targeting `.fs-*` class names or generic tag selectors (`button`, `h1`, `div`) to style FastStore components → warn about fragility. Suggest using `[data-fs-*]` selectors instead.

✅ **CORRECT**:
```typescript
// src/themes/custom-theme.scss
// Target the Hero section using its data attribute
[data-fs-hero] {
  --fs-hero-text-size: var(--fs-text-size-title-huge);
  --fs-hero-heading-weight: var(--fs-text-weight-bold);

  [data-fs-hero-heading] {
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  [data-fs-hero-image] {
    border-radius: var(--fs-border-radius);
    filter: brightness(0.9);
  }
}
```

❌ **WRONG**:
```typescript
// src/themes/custom-theme.scss
// WRONG: Targeting by class names — these are internal and may change
.fs-hero {
  font-size: 3.5rem;
}

.fs-hero h1 {
  text-transform: uppercase;
}

// WRONG: Using generic tag selectors
section > div > h1 {
  font-weight: bold;
}
// These are fragile selectors that break when FastStore restructures its HTML.
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: Create the custom theme file

Create the `src/themes/` directory and the `custom-theme.scss` file:

```typescript
// File: src/themes/custom-theme.scss
// This file is automatically imported by FastStore's build system.

// --------------------------------------------------------
// Global Token Overrides
// --------------------------------------------------------
// Override Brandless defaults to match your brand identity.

:root {
  // Colors
  --fs-color-main-0: #003232;
  --fs-color-main-1: #004c4c;
  --fs-color-main-2: #006666;
  --fs-color-main-3: #008080;
  --fs-color-main-4: #00b3b3;

  --fs-color-accent-0: #e31c58;
  --fs-color-accent-1: #c4174d;

  // Typography
  --fs-text-face-body: 'Inter', -apple-system, system-ui, sans-serif;
  --fs-text-face-title: 'Poppins', var(--fs-text-face-body);
}
```

### Step 2: Add component-specific token overrides

Below the global overrides, add component-level customizations using data attributes:

```typescript
// File: src/themes/custom-theme.scss (continued)

// --------------------------------------------------------
// FS UI Components
// --------------------------------------------------------
// Customize individual component styles using local tokens.

[data-fs-button] {
  --fs-button-border-radius: var(--fs-border-radius-pill);
  --fs-button-padding: 0 var(--fs-spacing-5);

  &[data-fs-button-variant="primary"] {
    --fs-button-primary-bkg-color: var(--fs-color-accent-0);
    --fs-button-primary-bkg-color-hover: var(--fs-color-accent-1);
    --fs-button-primary-text-color: var(--fs-color-text-inverse);
  }
}

[data-fs-price] {
  --fs-price-listing-color: #cb4242;
  --fs-price-listing-text-decoration: line-through;
}

[data-fs-navbar] {
  --fs-navbar-bkg-color: var(--fs-color-main-0);
  --fs-navbar-text-color: var(--fs-color-text-inverse);
}
```

### Step 3: Add fonts (if using custom fonts)

If your brand uses custom fonts, import them in the theme file and reference them via tokens:

```typescript
// File: src/themes/custom-theme.scss (at the top of the file)
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap');

// Then in your :root block:
:root {
  --fs-text-face-body: 'Inter', -apple-system, system-ui, sans-serif;
  --fs-text-face-title: 'Poppins', var(--fs-text-face-body);

  --fs-text-weight-light: 400;
  --fs-text-weight-regular: 500;
  --fs-text-weight-bold: 700;
  --fs-text-weight-black: 800;
}
```

### Complete Example

Full custom theme file for a branded store:

```typescript
// File: src/themes/custom-theme.scss
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap');

// --------------------------------------------------------
// Global Token Overrides
// --------------------------------------------------------
:root {
  // Brand Colors
  --fs-color-main-0: #003232;
  --fs-color-main-1: #004c4c;
  --fs-color-main-2: #006666;
  --fs-color-main-3: #008080;
  --fs-color-main-4: #00b3b3;

  --fs-color-accent-0: #e31c58;
  --fs-color-accent-1: #c4174d;
  --fs-color-accent-2: #a51342;
  --fs-color-accent-3: #870f37;

  // Typography
  --fs-text-face-body: 'Inter', -apple-system, system-ui, sans-serif;
  --fs-text-face-title: 'Poppins', var(--fs-text-face-body);
  --fs-text-size-title-huge: 3.5rem;
  --fs-text-size-title-page: 2.25rem;
  --fs-text-size-title-section: 1.75rem;
  --fs-text-size-title-subsection: 1.25rem;

  // Spacing
  --fs-grid-max-width: 1440px;
  --fs-grid-padding: 0 var(--fs-spacing-5);

  // Borders
  --fs-border-radius: 0.375rem;
  --fs-border-radius-pill: 100px;
  --fs-border-color: #e0e0e0;
  --fs-border-color-light: #f0f0f0;
}

// --------------------------------------------------------
// FS UI Components
// --------------------------------------------------------

[data-fs-button] {
  --fs-button-border-radius: var(--fs-border-radius);
  --fs-button-padding: 0 var(--fs-spacing-5);

  &[data-fs-button-variant="primary"] {
    --fs-button-primary-bkg-color: var(--fs-color-accent-0);
    --fs-button-primary-bkg-color-hover: var(--fs-color-accent-1);
    --fs-button-primary-text-color: var(--fs-color-text-inverse);
  }
}

[data-fs-price] {
  --fs-price-listing-color: #cb4242;
  --fs-price-listing-text-decoration: line-through;
}

[data-fs-hero] {
  --fs-hero-text-size: var(--fs-text-size-title-huge);
  --fs-hero-heading-weight: var(--fs-text-weight-bold);
}

[data-fs-product-card] {
  --fs-product-card-border-color: var(--fs-border-color-light);
  --fs-product-card-border-radius: var(--fs-border-radius);
  --fs-product-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  --fs-product-card-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.12);
}

[data-fs-navbar] {
  --fs-navbar-bkg-color: var(--fs-color-main-0);
  --fs-navbar-text-color: var(--fs-color-text-inverse);
}

[data-fs-search-input-field] {
  --fs-search-input-field-height-desktop: var(--fs-spacing-6);
}
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: Using `!important` to Override Styles

**What happens**: Developer uses `!important` declarations throughout their theme to force style changes on FastStore components, often because they are fighting specificity issues from placing styles in the wrong location.

**Why it fails**: `!important` creates a specificity dead-end. Once used, every subsequent override also needs `!important`, creating an escalating specificity war. It makes the theme unmaintainable, hard to debug, and fragile during FastStore updates. It also defeats the cascading nature of design tokens — a token overridden with `!important` cannot be re-overridden by local tokens.

**Fix**: Use the correct design token in the correct location. Place global overrides in `:root` and component overrides under `[data-fs-*]` selectors. If a token override isn't working, check that the selector specificity is sufficient and that the file is in `src/themes/`.

```typescript
// src/themes/custom-theme.scss
// Use proper token targeting — no !important needed
[data-fs-buy-button] {
  --fs-button-primary-bkg-color: #e31c58;
  --fs-button-primary-bkg-color-hover: #c4174d;
}

// If you need higher specificity for a specific page context:
[data-fs-product-details] [data-fs-buy-button] {
  --fs-button-primary-bkg-color: #1c58e3;
}
```

---

### Anti-Pattern: Hardcoded Color and Size Values

**What happens**: Developer uses hardcoded hex colors, pixel sizes, and font values directly in component styles instead of referencing design tokens.

**Why it fails**: Hardcoded values cannot be updated globally. Changing the brand color requires finding and updating every hardcoded instance. It breaks the token hierarchy — other components that should share the same color won't. It also makes the store inconsistent when new sections or components are added, since they will use token defaults that don't match the hardcoded values.

**Fix**: Always reference design tokens. If a token for your need doesn't exist, override a global token in `:root` and reference it. Use local tokens for component-specific exceptions.

```typescript
// src/themes/custom-theme.scss
// Define brand colors as global tokens, then reference them
:root {
  --fs-color-accent-0: #e31c58;
  --fs-color-accent-1: #c4174d;
}

// Reference the tokens — never hardcode
[data-fs-buy-button] {
  --fs-button-primary-bkg-color: var(--fs-color-accent-0);
  --fs-button-primary-bkg-color-hover: var(--fs-color-accent-1);
}

[data-fs-badge] {
  --fs-badge-bkg-color: var(--fs-color-accent-0);
}
```

---

### Anti-Pattern: Creating a Parallel CSS System

**What happens**: Developer ignores FastStore's token system entirely and creates their own CSS framework alongside FastStore's styles (e.g., importing Tailwind, Bootstrap, or a custom global stylesheet that redefines base element styles).

**Why it fails**: A parallel CSS system conflicts with FastStore's structural styles and token architecture. Global resets or utility classes from Tailwind/Bootstrap can override FastStore's carefully tuned component styles. It doubles the CSS payload. Maintenance becomes a nightmare since two styling systems must be kept in sync. New team members must understand both systems.

**Fix**: Work within FastStore's token system for all FastStore components. If you need utility classes for custom (non-FastStore) components, scope them carefully using CSS modules to avoid affecting native components.

```typescript
// src/components/CustomBanner.module.scss
// Scoped styles for custom components — won't affect FastStore components
.customBanner {
  display: flex;
  align-items: center;
  gap: var(--fs-spacing-3); // Still reference FastStore tokens for consistency
  padding: var(--fs-spacing-4);
  background-color: var(--fs-color-main-0);
  color: var(--fs-color-text-inverse);
  border-radius: var(--fs-border-radius);
}

.customBannerTitle {
  font-family: var(--fs-text-face-title);
  font-size: var(--fs-text-size-title-subsection);
  font-weight: var(--fs-text-weight-bold);
}
```

## Reference

**Links to VTEX documentation and related resources.**

- [Theming overview](https://developers.vtex.com/docs/guides/faststore/using-themes-overview) — Introduction to theming concepts, Brandless architecture, and token hierarchy
- [Global tokens](https://developers.vtex.com/docs/guides/faststore/global-tokens-overview) — Complete reference for all global design tokens (colors, typography, spacing, borders)
- [Global tokens: Colors](https://developers.vtex.com/docs/guides/faststore/global-tokens-colors) — Color token reference and palette structure
- [Global tokens: Typography](https://developers.vtex.com/docs/guides/faststore/global-tokens-typography) — Font family, size, and weight tokens
- [Global tokens: Spacing](https://developers.vtex.com/docs/guides/faststore/global-tokens-spacing) — Spacing scale tokens
- [Styling a component](https://developers.vtex.com/docs/guides/faststore/using-themes-components) — Guide for customizing individual component styles with local tokens
- [Available themes](https://developers.vtex.com/docs/guides/faststore/themes-overview) — Pre-built themes (Midnight, Soft Blue) available as starting points
- [Importing FastStore UI component styles](https://developers.vtex.com/docs/guides/faststore/using-themes-importing-ui-components-styles) — How to import and use component styles in custom sections
- [FastStore Section & Component Overrides](../faststore-overrides/skill.md) — Related skill for when theming alone is insufficient and behavioral changes are needed
