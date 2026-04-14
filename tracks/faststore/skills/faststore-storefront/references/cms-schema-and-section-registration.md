---
name: faststore-cms
description: How VTEX Headless CMS integrates with FastStore, including how to define section schema.json and sync them. Use when registering new CMS sections, defining editable CMS fields (text, boolean, dropdown, nested objects), syncing schema changes, or understanding how CMS props flow to React components.
metadata:
  author: vtex
  version: "1.0"
---

# FastStore CMS Integration

## Overview

The `cms/faststore/schema.json` file defines final JSON schemas for all storefront CMS data

**All global native sections are already registered** — `schema.json` must not change it manually.

To edit content in existing global sections, use the Store Admin at:
`https://{store-id}.myvtex.com/admin` → `Storefront` → `Content: All content`

## Critical Rules

1. There is no need of creating `cms/faststore/pages/*.jsonc` files for new sections. This should be edited only when a new landing page is needed.
2. After every change to `cms/faststore/components/*.jsonc` or `cms/faststore/pages/*.jsonc`, must execute final schema generation and upload it to the cms admin app.
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

| Rule                     | Detail                                                        |
| ------------------------ | ------------------------------------------------------------- |
| `"$componentKey"`        | **Must** match a key exported from `src/components/index.tsx` |
| `"name"`                 | **Must** match a key exported from `src/components/index.tsx` |
| Properties               | Become the section's props passed to the React component      |
| `"enum"` + `"enumNames"` | Renders a dropdown in the CMS editor                          |
| `"type": "boolean"`      | Renders a toggle                                              |
| `"type": "object"`       | Creates a nested group of fields                              |
| `"required"`             | Array of field names that must be filled by the editor        |

## CMS Section Registration Workflow

## Complete Workflow: Creating a New CMS Section

1. Create the JSONC schema at `cms/faststore/components/cms_component__<Name>.jsonc`
   - Use `$extends`, `$componentKey`, `$componentTitle`
   - Define `properties` that become CMS editor fields
2. Create the React component at `src/components/sections/<Name>/<Name>.tsx`
3. Create styles at `src/components/sections/<Name>/<name>.module.scss`
   - Wrap all styles in a single class
   - Import as CSS module in the component
4. Register in `src/components/index.tsx` with key matching `$componentKey`
5. Run `vtex content generate-schema -o cms/faststore/schema.json -b vtex.faststore4`
6. Run `vtex content upload-schema cms/faststore/schema.json`
7. Add the section to the desired page via Store Admin → Storefront → Content

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

Registering a section in the schema and uploading it makes the section **available** in the CMS editor. It does **NOT** automatically add it to any page.

To render a new section on a page:

1. Go to Store Admin → Storefront → Content: All content
2. Select the page type (e.g., Product List Page)
3. Add the section to the page template
4. Save and publish

In dev mode, the page content comes from the CMS API. If the section is registered but doesn't appear on the page, it likely hasn't been added to the page content yet.

## Generate final schema.json file

To generate the final schema `cms/faststore/schema.json` the following command must be executed

```bash
  vtex content generate-schema -o cms/faststore/schema.json -b vtex.faststore4
```

To upload the final schema to the CMS admin app:

```bash
  vtex content upload-schema cms/faststore/schema.json
```

The store ID used in the upload command should match the `api.storeId` value
from `discovery.config.js`. Read this value before running the upload script.

LLMs can use the following script to upload the final schema to the CMS admin app:

```bash
STORE_ID=$(node -e "console.log(require('./discovery.config.js').api.storeId)")
expect -c 'spawn vtex content upload-schema cms/faststore/schema.json; expect \"store ID\"; send \"$STORE_ID\r\"; expect -re "uploaded|confirm"; send "y\r"; expect -re "Are you sure|confirm"; send "y\r"; expect eof' 2>&1;
```

This pushes schema changes to VTEX CMS. Without this step, new sections will not appear in the CMS editor.

## Important: CMS Sections Only Receive CMS-Defined Props

CMS sections receive props from the schema `properties` defined in their `.jsonc` file —
these are the fields the editor fills in the CMS admin.

**Do NOT** expect sections to receive props passed programmatically from parent
page components. If a section needs data beyond what the CMS editor provides
(e.g., product data, search results), it must read from:

- Page context hooks (`usePDP()`, `usePLP()`, `usePage()`, etc.)
- Custom GraphQL queries via `useQuery` / `useLazyQuery`
