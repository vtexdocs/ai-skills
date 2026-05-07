# FastStore v3 → v4 Migration
 
Migrate this FastStore project from v3 to v4 by applying all required changes described below. Work through each step sequentially, reading the relevant files before editing them.
 
---
 
## Step 1 — Update `@faststore/cli` in `package.json`
 
Read `package.json`. Then apply:
 
1. Change `@faststore/cli` to:
   ```
   "https://pkg.csb.dev/vtex/faststore/commit/ad98a434/@faststore/cli"
   ```
2. **Remove** the `next` entry from `dependencies` (Next.js is now managed internally by `@faststore/cli`).
3. **Add** `"graphql": "^16.12.0"` to `dependencies`.
4. Ensure `react` is at `^18.3.1` and `react-dom` at `^18.2.0` (update if they are lower).
5. In `devDependencies`, update `typescript` to `^5.9.3` (update if lower).
 
> If this is a **monorepo**, also add to the `resolutions` field:
> ```json
> "@inquirer/type": "^1.5.5"
> ```
 
After editing, show a diff summary of the changes made.
 
---
 
## Step 2 — Update `discovery.config.js`
 
Read `discovery.config.js`. Find the `experimental` object and set:
```js
nodeVersion: 24,
```
 
Replace whatever value `nodeVersion` currently has.
 
---
 
## Step 3 — Update SCSS utilities imports

Search for all `.scss` files in the project (use Glob `**/*.scss`). For each file found:

1. Read the file.
2. Check if it uses any of the following (without a namespace):
   - `@include media(`
   - `@include layout-content`
   - `rem(` (the FastStore SCSS function, NOT the CSS unit `1rem`)
   - `@import "~@faststore/ui/src/styles/base/utilities"`
   - Any other `@include` mixin or function call that comes from FastStore utilities (e.g. `truncate-title`, `layout-content-full`, `layout-colored`, `section-divisor`, `input-focus-ring`, `focus-ring`, `focus-ring-visible`)

3. If the file uses these mixins/functions without an explicit `@use` import, apply these changes:
   - **Add** at the very top of the file (before any other content):
     ```scss
     @use "@faststore/ui/src/styles/base/utilities" as u;
     ```
   - **Replace** every `@include media(` with `@include u.media(`
   - **Replace** every `@include layout-content` with `@include u.layout-content`
   - **Replace** every call to the `rem()` function with `u.rem(`. Example: `top: rem(9px);` → `top: u.rem(9px);`
   - **Remove** any existing `@import "~@faststore/ui/src/styles/base/utilities"` line (the old global import).
   - Apply the namespace `u.` to any other FastStore utility mixin OR function calls found in the file (not only mixins — functions like `rem` need it too).

4. If the file already has `@use "@faststore/ui/src/styles/base/utilities"`, skip it.

> **Why `rem` must be namespaced:**
> CSS Values 4 introduced a native `rem()` math function (modulo/remainder) that requires **2 arguments**. With the new `@use` module system, `rem(9px)` no longer resolves to the FastStore Sass function and falls through to the CSS native one, producing the error:
> ```
> 2 arguments required, but only 1 was passed.
> ```
> Prefixing the call with `u.rem(...)` resolves it to the FastStore function again.

After processing all SCSS files, report which files were modified.
 
---

## Step 4 — Fix `@faststore/sdk/dist/types` imports

> **Background:**
> In v4, `@faststore/sdk` no longer exposes the `./dist/types` sub-path in its `package.json#exports` field. With `moduleResolution: bundler` (used by `.faststore/tsconfig.json`), every `import ... from '@faststore/sdk/dist/types'` breaks with:
> ```
> Cannot find module '@faststore/sdk/dist/types' or its corresponding type declarations.
> ```
> One or more files inside `node_modules/@faststore/core` (and consequently `.faststore/src/`) still ship that broken import — most commonly `.faststore/src/sdk/product/useProductGalleryQuery.ts` importing the type `Facet`.

> **Why we cannot fix this with a per-file override under `src/`:**
> The CLI does **not** swap a core SDK file (e.g. `.faststore/src/sdk/product/useProductGalleryQuery.ts`) when an identically named file exists at `src/sdk/product/useProductGalleryQuery.ts`. Instead, it copies the override into `.faststore/src/customizations/src/sdk/product/useProductGalleryQuery.ts`, where **nothing imports it**. Both files end up in the build, both are type-checked, and the original (still broken) one continues to fail. Per-file SDK overrides only work for the explicit override slots wired by `GlobalOverrides.tsx`, fragments, themes, redirects, etc. — not for arbitrary SDK hooks.

### The fix — declare an ambient module shim

Create a single ambient declaration file under `src/` that locally redeclares the missing subpath. The CLI will copy it to `.faststore/src/customizations/src/types/faststore-sdk-shim.d.ts`, where the `.faststore/tsconfig.json` (`include: ["src/**/*.ts", ...]`) picks it up and the broken imports inside the core files resolve to these locally declared types.

1. Verify there is at least one file inside `.faststore/src/` with a broken import. From the project root:
   ```sh
   grep -rn "@faststore/sdk/dist/types" .faststore/src
   ```
   If there are no matches, you can skip this step.

2. Create the file `src/types/faststore-sdk-shim.d.ts` with the following content:
   ```ts
   declare module '@faststore/sdk/dist/types' {
     import type { SearchState } from '@faststore/sdk'

     export type Facet = SearchState['selectedFacets'][number]
     export type State = SearchState
     export type SearchSort = SearchState['sort']
   }
   ```
   The three exported types cover every name the core historically imported from this subpath (`Facet`, `State`, `SearchSort`), so the shim is future-proof against new core files that reintroduce the same broken import.

3. Do **not** modify anything inside `.faststore/` or `node_modules/`. The shim alone restores type-checking — there is no need to write per-file overrides for the affected core files.

After applying this step, report that `src/types/faststore-sdk-shim.d.ts` was created.

---

## Step 5 — CMS sync instructions
 
After completing the code changes above, print the following instructions for the developer to run manually (do NOT run these commands yourself):
 
### For stores using CMS — with customization:
```sh
vtex login
vtex content generate-schema -b faststorev4 cms/faststore/components cms/faststore/pages -o cms/faststore/schema.json
vtex content upload-schema cms/faststore/schema.json
```
 
### For stores using CMS — without customization:
```sh
vtex login
vtex content upload-schema node_modules/@faststore/core/cms/faststore/schema.json
```
 
### For stores using Headless CMS (legacy):
```sh
cms sync
```
 
---
 
## Step 6 — Node.js version reminder
 
Print the following reminder for the developer:
 
> **Node.js v24 migration checklist:**
> 1. Test the v3 store locally by building with Node.js v24 and fix any issues found.
> 2. Change the Node.js version to v24 in WebOps and deploy the adjusted v3 changes.
> 3. Then proceed to deploy the v4 changes.
 
---
 
## Step 7 — Summary
 
After all edits are complete, print a concise summary of every change made, grouped by file. Example format:
 
```
### Changes applied:
 
- package.json
  - @faststore/cli → https://pkg.csb.dev/vtex/faststore/commit/85d2a096/@faststore/cli
  - Removed: next
  - Added: graphql ^16.12.0
  - react updated to ^18.3.1
  - typescript updated to ^5.9.3
 
- discovery.config.js
  - experimental.nodeVersion → 24
 
- src/themes/custom-theme.scss
  - Added @use "@faststore/ui/src/styles/base/utilities" as u
  - Replaced all @include media( → @include u.media(
  - Replaced @include layout-content → @include u.layout-content
```
 
Then ask the developer to run `yarn install` (or `npm install`) and test the build locally with Node.js v24 before deploying.