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
4. Follow language idioms and conventions existent in other cms files

## Schema Format

```jsonc
{
  "$extends": ["#/$defs/base-component"],
  "$componentKey": "CustomIconsAlert",
  "$componentTitle": "CustomIconsAlert",
  "type": "object",
  "required": ["icon", "content", "dismissible"],
  "properties": {
    "icon": {
      "type": "string",
      "title": "Icon",
      "enumNames": [
        "Bell",
        "BellRinging",
        "Checked",
        "Info",
        "Truck",
        "User",
        "Storefront",
      ],
      "enum": [
        "Bell",
        "BellRinging",
        "Checked",
        "Info",
        "Truck",
        "User",
        "Storefront",
      ],
    },
    "content": {
      "type": "string",
      "title": "Content",
    },
    "link": {
      "title": "Link",
      "type": "object",
      "properties": {
        "text": { "type": "string", "title": "Link Text" },
        "to": { "type": "string", "title": "Action link" },
      },
    },
    "dismissible": {
      "type": "boolean",
      "default": false,
      "title": "Is dismissible?",
    },
  },
}
```

## Schema Rules

| Rule                     | Detail                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `"$componentKey"`        | **Must** match a **key** on the **default export** object in `src/components/index.tsx` |
| Properties               | Become the section's props passed to the React component                                |
| `"enum"` + `"enumNames"` | Renders a dropdown in the CMS editor                                                    |
| `"type": "boolean"`      | Renders a toggle                                                                        |
| `"type": "object"`       | Creates a nested group of fields                                                        |
| `"required"`             | Array of field names that must be filled by the editor                                  |

## CMS Section Registration Workflow

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

- [ ] Create JSONC schema at `cms/faststore/components/cms_component__<Name>.jsonc`
  - Use `$extends`, `$componentKey`, `$componentTitle`
  - Define `properties` that become CMS editor fields
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
