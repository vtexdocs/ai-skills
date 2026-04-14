---
name: faststore-cms
description: How VTEX Headless CMS integrates with FastStore, including how to define section schema.json and sync them. Use when registering new CMS sections, defining editable CMS fields (text, boolean, dropdown, nested objects), syncing schema changes, or understanding how CMS props flow to React components.
metadata:
  author: vtex
  version: "1.0"
---

# FastStore CMS Integration

## Overview

**Authoritative inputs** for Headless CMS sections are:

- `cms/faststore/components/*.jsonc` — section schema (including `"$componentKey"`)
- `cms/faststore/pages/*.jsonc` — optional page templates (when your project uses them)
- `src/components/index.tsx` — **default export** object whose **keys** must match `"$componentKey"` for each custom section

The file **`cms/faststore/schema.json` is generated output** from `vtex content generate-schema`. It aggregates those sources for upload. **Never edit `schema.json` by hand** — fix the JSONC and/or `index.tsx`, then regenerate.

**All global native sections are already registered** in the platform; your repo extends the CMS with custom definitions.

To edit **content** in existing sections, use the Store Admin at:
`https://{store-id}.myvtex.com/admin` → `Storefront` → `Content: All content`

## Critical Rules

1. There is no need of creating `cms/faststore/pages/*.jsonc` files for new sections. This should be edited only when a new landing page is needed.
2. After every change to `cms/faststore/components/*.jsonc` or `cms/faststore/pages/*.jsonc`, you **must** run **`vtex content generate-schema`** and **`vtex content upload-schema`** in the same working session (see [End-to-end agent workflow](#end-to-end-agent-workflow)). **Do not** use `yarn cms-sync`, `faststore cms-sync`, or other legacy `cms-sync` flows to publish Headless CMS schema — use **`vtex content`** only.
3. Every file inside the folder `cms/faststore/components/` should follow this name pattern and extension: `cms_component__<name>.jsonc`
4. Follow the conventions of the native components in `node_modules/@faststore/core/cms/faststore/components/` — see [Native Component Pattern Reference](#native-component-pattern-reference) for the full style guide

## Native Component Pattern Reference

When creating a new `cms/faststore/components/cms_component__<name>.jsonc`, **follow the conventions used by the native components** in `node_modules/@faststore/core/cms/faststore/components/`. The patterns below are extracted from those files and must be treated as the canonical style guide.

### Structural conventions

1. **Top-level keys appear in this order** — always:

   ```jsonc
   {
     "$extends": ["#/$defs/base-component"],
     "$componentKey": "MySection",
     "$componentTitle": "My Section",
     "title": "My Section",
     "description": "Short CMS editor description",
     "type": "object",
     "required": [...],
     "properties": { ... }
   }
   ```

   - `$extends` is always `["#/$defs/base-component"]`.
   - `$componentKey` is **PascalCase with no spaces** (e.g. `"ProductShelf"`, `"BannerText"`).
   - `$componentTitle` and `"title"` are **human-readable** (may contain spaces): `"Product Shelf"`, `"Banner Text"`.
   - `"description"` is a short sentence shown in the CMS palette (e.g. `"Add a quick promotion with an image/action pair"`).
   - `"required"` lists only the fields that **must** be filled by the editor; optional fields are simply omitted from this array.

2. **File name** matches the lowercased component name: `cms_component__productshelf.jsonc` for `$componentKey: "ProductShelf"`.

### Property conventions

| Pattern                 | Convention                                                                                                                              | Example from core                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Simple text field       | `{ "type": "string", "title": "Title" }`                                                                                                | Hero → `title`                                                                    |
| Text with default       | Add `"default"` at the same level                                                                                                       | Newsletter → `emailInputLabel`                                                    |
| Rich text (WYSIWYG)     | `"widget": { "ui:widget": "draftjs-rich-text" }`                                                                                        | Newsletter → `privacyPolicy`                                                      |
| Image upload            | `"widget": { "ui:widget": "media-gallery", "restrictMediaTypes": { "video": true, "image": ["png","jpg","jpeg","gif","svg","webp"] } }` | Hero → `image.src`                                                                |
| Boolean toggle          | `{ "type": "boolean", "title": "...", "default": false }`                                                                               | Alert → `dismissible`                                                             |
| Dropdown (enum)         | `"enum"` + `"enumNames"` arrays of equal length; `enum` holds the value, `enumNames` the label                                          | Hero → `colorVariant` (`["main","light","accent"]` / `["Main","Light","Accent"]`) |
| Integer with default    | `{ "type": "integer", "title": "...", "default": 5 }`                                                                                   | ProductShelf → `numberOfItems`                                                    |
| Nested object group     | `{ "type": "object", "title": "...", "properties": { ... } }` — nest `required` inside the object when needed                           | BannerText → `link` (with inner `required: ["text","url"]`)                       |
| Repeatable list         | `{ "type": "array", "items": { "type": "object", ... } }` — use `minItems`/`maxItems` to constrain                                      | Incentives → `incentives` (array of incentive objects)                            |
| Sub-object config group | Group related toggles/fields under a descriptive object                                                                                 | ProductShelf → `taxesConfiguration`, `productCardConfiguration`                   |

### Key rules derived from native components

- **Every property must have `"title"`** — it is the CMS editor label.
- **Use `"default"` generously** — provide sensible defaults so editors start with a working section.
- **`"description"` on a property** is optional but recommended when the field is not self-explanatory (e.g. ProductShelf → `after`: `"Initial pagination item"`).
- **Enums always use both `"enum"` and `"enumNames"`** — even when the display name matches the value. The arrays must have the same length and order.
- **Nested objects with required inner fields** place the `"required"` array inside the object definition, not at the root level.
- **No trailing commas in JSON** — although `.jsonc` tolerates them, the native components do **not** use trailing commas. Follow the same style.
- **`"type"` is always explicit** on every property, including nested objects and array items.

### Complete annotated example (following native style)

```jsonc
{
  "$extends": ["#/$defs/base-component"],
  "$componentKey": "PromoBanner",
  "$componentTitle": "Promo Banner",
  "title": "Promo Banner",
  "description": "Display a promotional banner with image and call to action",
  "type": "object",
  "required": ["title", "image"],
  "properties": {
    "title": {
      "title": "Title",
      "type": "string",
    },
    "subtitle": {
      "title": "Subtitle",
      "type": "string",
    },
    "image": {
      "title": "Image",
      "type": "object",
      "properties": {
        "src": {
          "title": "Image",
          "type": "string",
          "widget": {
            "ui:widget": "media-gallery",
            "restrictMediaTypes": {
              "video": true,
              "image": ["png", "jpg", "jpeg", "gif", "svg", "webp"],
            },
          },
        },
        "alt": {
          "title": "Alternative Label",
          "type": "string",
        },
      },
    },
    "link": {
      "title": "Call to Action",
      "type": "object",
      "required": ["text", "url"],
      "properties": {
        "text": {
          "title": "Text",
          "type": "string",
        },
        "url": {
          "title": "URL",
          "type": "string",
        },
        "linkTargetBlank": {
          "title": "Open link in new window?",
          "type": "boolean",
          "default": false,
        },
      },
    },
    "colorVariant": {
      "title": "Color variant",
      "type": "string",
      "enumNames": ["Main", "Light", "Accent"],
      "enum": ["main", "light", "accent"],
    },
    "showBadge": {
      "title": "Show discount badge?",
      "type": "boolean",
      "default": true,
    },
    "items": {
      "title": "Highlight Items",
      "type": "array",
      "minItems": 1,
      "maxItems": 4,
      "items": {
        "title": "Item",
        "type": "object",
        "required": ["label"],
        "properties": {
          "label": {
            "title": "Label",
            "type": "string",
          },
          "icon": {
            "title": "Icon",
            "type": "string",
            "enumNames": ["Truck", "Gift", "Shield Check"],
            "enum": ["Truck", "Gift", "ShieldCheck"],
          },
        },
      },
    },
  },
}
```

## Mandatory Workflow for New Custom Sections

Follow this EXACT sequence. Do NOT skip steps.

### Phase 1: Planning (BEFORE writing code)

- [ ] Check if similar component exists: `ls src/components/`
- [ ] Verify CMS schema names: `ls cms/faststore/components/`
- [ ] Choose unique component name (PascalCase)

### Phase 2: Component Creation

- [ ] Create folder: `mkdir -p src/components/sections/<Name>` (or `src/components/<Name>/` for non-section sub-components)
- [ ] Create React component at `src/components/sections/<Name>/<Name>.tsx` with TypeScript interfaces
- [ ] Create styles at `src/components/sections/<Name>/<name>.module.scss`
  - Wrap all styles in a single class
  - Import as CSS module in the component
  - If the section uses `@faststore/ui` components, **import their stylesheets manually** in the `.module.scss`
- [ ] **RUN LINTER**: `ReadLints` on new files
- [ ] **FIX ALL ERRORS** before proceeding

### Phase 3: CMS Schema & Registration

- [ ] Create JSONC schema at `cms/faststore/components/cms_component__<Name>.jsonc` following the [Native Component Pattern Reference](#native-component-pattern-reference)
- [ ] Verify `$componentKey` matches exactly
- [ ] Register in `src/components/index.tsx` with an object key **identical** to `$componentKey`
- [ ] **RUN LINTER** on `index.tsx`

### Phase 4: Schema Management (SAME SESSION)

- [ ] Generate: `vtex content generate-schema -o cms/faststore/schema.json -b vtex.faststore4`
- [ ] Verify: `grep -A 5 '"<ComponentName>"' cms/faststore/schema.json` (search for the `$componentKey` string)
  - If it does not appear, fix JSONC or registration — **do not** edit `schema.json` manually
- [ ] Upload: `vtex content upload-schema cms/faststore/schema.json` (**required** — without upload, the CMS editor will not see new or updated section definitions)
- [ ] Confirm upload success message

### Phase 5: Validation & Deployment

- [ ] No linter errors remain
- [ ] Schema uploaded successfully
- [ ] Component key appears in `schema.json`
- [ ] Add the section to the desired page via **Admin → Storefront → Content** (unless your project relies on `pages/*.jsonc` and your team's publish process covers composition)
- [ ] Document usage (optional but recommended)

**🛑 STOP at first error. Fix before proceeding.**

## Section Scopes

Sections can be scoped to specific page types using `"requiredScopes"`:

```json
{
  "$extends": ["#/$defs/base-component"],
  "$componentKey": "QuickFilter",
  "$componentTitle": "QuickFilter",
  "requiredScopes": ["plp", "search"],
  "type": "object",
  "description": "Quick Filter section for search pages",
  "required": [],
  "properties": {}
}
```

## Section registration ≠ Section rendering

**`upload-schema` registers** section **definitions** in Headless CMS (they show up in the editor palette). That is **not** the same as placing the section on the home page or another route.

To **render** a new section on a page (typical case):

1. Go to **Admin → Storefront → Content** (e.g. "All content")
2. Select the page type (e.g., Home, Product List Page)
3. Add the section to that page's layout
4. Save and publish

If your project uses **`cms/faststore/pages/*.jsonc`** to version page composition, follow that policy — otherwise assume **Content** in Admin is where the section gets onto the live page.

In dev mode, page content still comes from the CMS API. If the section is registered in the editor but missing on the storefront, it often was never **added** to that page's content (or not published).

## End-to-end agent workflow

Assume **VTEX CLI is installed globally** — invoke `vtex` directly (not `npx vtex`).

From the **project root**:

1. **Generate** (canonical command — matches the storefront skill):

```bash
vtex content generate-schema -o cms/faststore/schema.json -b vtex.faststore4
```

2. **Validate** — for new or renamed sections, grep or read `cms/faststore/schema.json` and confirm the `"$componentKey"` is present.

3. **Upload** (mandatory for the CMS to pick up schema changes):

```bash
vtex content upload-schema cms/faststore/schema.json
```

The store ID you enter at prompts should match `api.storeId` in `discovery.config.js`.

### Non-interactive upload (automatic - ALWAYS USE THIS)

When uploading schema in an automated workflow, ALWAYS use `expect` to handle prompts automatically:

```bash
# Export store ID from discovery.config.js
export STORE_ID=$(node -e "console.log(require('./discovery.config.js').api.storeId)")

# Run upload with expect to auto-answer prompts
expect -c "
  spawn vtex content upload-schema cms/faststore/schema.json
  expect \"store ID\"
  send \"\$env(STORE_ID)\\r\"
  expect -re \"uploaded|confirm\"
  send \"y\\r\"
  expect -re \"Are you sure|confirm\"
  send \"y\\r\"
  expect eof
" 2>&1
```

Alternative: wrap `expect -c` in **double quotes** in bash so `${STORE_ID}` is expanded before `expect` runs — useful if `$env(...)` behaves differently in your Tcl version.

**Agents must** report the **exact** prompt or error if login, workspace, store ID, or confirmation blocks upload, and tell the human the next step (`vtex login`, correct account, etc.).

Without **`upload-schema`**, new or updated sections **will not** appear in the Headless CMS editor.

## Important: CMS Sections Only Receive CMS-Defined Props

CMS sections receive props from the schema `properties` defined in their `.jsonc` file —
these are the fields the editor fills in the CMS admin.

**Do NOT** expect sections to receive props passed programmatically from parent
page components. If a section needs data beyond what the CMS editor provides
(e.g., product data, search results), it must read from:

- Page context hooks (`usePDP()`, `usePLP()`, `usePage()`, etc.)
- Custom GraphQL queries via `useQuery` / `useLazyQuery`
