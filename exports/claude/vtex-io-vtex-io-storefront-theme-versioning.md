This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when installing, publishing, upgrading, or rolling back a vtex io storefront theme app (`vendor.store-theme` or any app that owns `store/blocks.json`, `store/routes.json`, and `store/contentschemas.json`). covers how site editor and theme content are scoped by the app's major version, why a major version bump leaves the new major with no merchant content and silently falls back to default theme content, and the safe install-in-workspace, migrate-content with the `updatethemeids` mutation, smoke-test, then promote workflow. use for any operation that changes which version of a content-holding app is installed in `master`.

# Storefront Theme Versioning, Install, and Rollback

## When this skill applies

Use this skill whenever the version of a content-holding storefront app (a theme such as `vendor.store-theme`, or any app that ships `store/blocks.json`, `store/routes.json`, `store/templates/`, or `store/contentSchemas.json`) is about to change in `master`.

- Bumping the version of a theme app with `vtex release patch | minor | major`
- Running `vtex publish` / `vtex deploy` on a theme app
- Running `vtex install vendor.store-theme@X.Y.Z` against a production account
- Promoting a workspace that has a different theme version installed than `master`
- Planning recovery from a deploy that "lost" all storefront content
- Reviewing a developer's deploy script that touches a storefront theme

Do not use this skill for:

- block registration via `interfaces.json` — use `vtex-io-render-runtime-and-blocks`
- shopper-facing component code under `react/` — use `vtex-io-storefront-react`
- app-level settings under `manifest.json#settingsSchema` — use `vtex-io-app-settings`
- Master Data schema versioning — use `vtex-io-masterdata-strategy`

## Decision rules

- Treat any app that ships content under `store/` (theme apps and many storefront apps) as a **content-holding app**. Its installed MAJOR version is part of the key the platform uses to store and look up every Site Editor change a merchant has ever saved against blocks declared by that app.
- Site Editor content, custom routes, templates, and per-template render caches are stored by `vtex.pages-graphql` under keys of the form `vendor.app@MAJOR.x:template`. Examples: `acme.store-theme@0.x:store.home`, `acme.store-theme@0.x:store.product`.
- A `patch` (`0.0.61` → `0.0.62`) and a `minor` (`0.1.0` → `0.2.0`) reuse the same key and the new version sees the same merchant content. A `major` (`0.x` → `5.x`) changes the key. The new major starts with **zero merchant content** even if the theme code is otherwise identical.
- When `vtex.pages-graphql` cannot find content for the active major, it falls back to the default `vtex.store-theme` content. The site visibly degrades to "VTEX default theme" content even though the customer's app is installed and rendering.
- Avoid `vtex release major` on a content-holding app whenever possible. Prefer keeping changes within the current major as `patch` or `minor` so merchant content carries forward automatically.
- When a major bump is unavoidable because of a structural change to blocks, routes, or templates, **migrate the merchant content from the old major to the new major** with the `updateThemeIds` mutation in `vtex.pages-graphql@2.x` before promoting. The mutation rekeys all Site Editor edits, Pages, and Redirects from `vendor.app@{oldMajor}.x` to `vendor.app@{newMajor}.x` in one operation. This is the official developer-accessible recovery surface; do not assume content has to be re-authored manually.
- Always install and validate a new theme major in a **production-flag dev workspace** (`vtex use rollout-workspace --production`, which both creates and switches to the workspace in one step) before promoting. Linking is not enough: `vtex link` does not exercise published artifacts and does not produce the same content-key behavior as `vtex install` + `vtex workspace promote`.
- Run `updateThemeIds` against `vtex.pages-graphql@2.x` from the GraphQL Admin IDE (`vtex install vtex.admin-graphql-ide@3.x`, then `vtex browse admin/graphql-ide`) inside the production-flag dev workspace, after `vtex install` of the new major and before `vtex workspace promote`. Site Editor, Pages, and Redirects in that workspace will then resolve under the new major and be carried with the workspace at promote time.
- Treat `vtex workspace promote` as the atomic cutover. Smoke-test the dev workspace's full page set (home, PDP, PLP, department, search, custom routes, account, checkout entry) after running `updateThemeIds`. If the dev workspace is broken, master will be broken.
- Verify that the version published to the Apps Registry matches the source you expect. A common failure pattern is publishing a stripped-down boilerplate by mistake — the registry version installs cleanly, but it does not contain the custom blocks the existing Site Editor content references. `updateThemeIds` cannot fix a missing-block problem; it only rekeys existing content.
- The same `updateThemeIds` step is required when **downgrading** to a previous major (for example `5.x` → `4.x`). The mutation moves content in either direction across MAJOR boundaries.

## Hard constraints

### Constraint: Major version bumps on content-holding apps require an `updateThemeIds` migration before promote

A `vtex release major` (or any version change that crosses the `MAJOR.x` boundary) on an app that owns Store Framework content MUST NOT be promoted to `master` without first migrating merchant content from the old major to the new major in a production-flag dev workspace, using the `updateThemeIds` mutation in `vtex.pages-graphql@2.x`. The new major starts empty from `vtex.pages-graphql`'s point of view; promoting it to `master` without running `updateThemeIds` makes the storefront fall back to default theme content for every page that depended on Site Editor edits.

**Why this matters**

`vtex.pages-graphql` keys every merchant-owned route, template, Site Editor edit, and Page/Redirect entry by `vendor.app@MAJOR.x:template`. A patch and minor bump preserve the key; a major bump invalidates it. After a major bump, every Site Editor change the merchant ever saved is no longer visible to the resolver under the new major, and the storefront falls back to default `vtex.store-theme` content. The official developer-accessible fix is the `updateThemeIds` mutation, which rekeys all Site Editor edits, Pages, and Redirects from the old major to the new one in a single operation. Skipping it (or assuming developers must re-author content manually) leaves the storefront degraded for shoppers.

**Detection**

Before running any `vtex install vendor.app@X.Y.Z` on a production account, compare `X` to the major currently installed (`vtex ls --production | grep store-theme`). If `X` differs, STOP. Require the `updateThemeIds` migration to be executed in a production-flag dev workspace, after the new major is installed and before promote.

Also STOP if a developer is about to run `vtex release major` on an app that ships any of: `store/blocks.json`, `store/routes.json`, `store/templates/`, `store/contentSchemas.json`. Confirm the structural change cannot be modeled as a `patch` or `minor` first; if the major is unavoidable, plan the `updateThemeIds` step explicitly.

**Correct**

```bash
vtex use theme-rollout --production            # creates and switches to a production-flag dev workspace
vtex install acme.store-theme@5.0.0
vtex install vtex.admin-graphql-ide@3.x        # required to access the GraphQL IDE
vtex browse admin/graphql-ide
# In the IDE, select the app `vtex.pages-graphql@2.x` from the dropdown and run:
#
# mutation {
#   updateThemeIds(
#     from: "acme.store-theme@0.x",
#     to:   "acme.store-theme@5.x"
#   )
# }
#
# Expected response: { "data": { "updateThemeIds": true } }
# Validate Site Editor, Pages, and Redirects in this workspace, then:
vtex workspace promote
```

**Wrong**

```bash
vtex release major
vtex publish
vtex install acme.store-theme@5.0.0
# installed straight to master — no merchant content is visible under @5.x
# and the storefront falls back to default vtex.store-theme content
```

### Constraint: Never install a content-holding app version directly to master without a dev-workspace smoke test

Any change that swaps the installed version of a content-holding app on `master` MUST go through a production-flag dev workspace first (`vtex use $name --production`), be smoke-tested across the full page set, and then be promoted with `vtex workspace promote`.

**Why this matters**

`master` is the public storefront. Installing a theme directly to `master` makes the new version live for every shopper instantly. If the install reveals a missing block, an empty content surface under the new major, or a stripped-down published artifact, the only recovery is rollback under load. A production-flag dev workspace renders against the same data as `master` and surfaces the same failures without exposing shoppers.

**Detection**

If a developer's command sequence runs `vtex install` while the active workspace is `master`, STOP. Require switching to a production-flag dev workspace first.

**Correct**

```bash
vtex use theme-rollout-2026-04 --production    # creates and switches to a production-flag dev workspace
vtex install acme.store-theme@5.3.5
# if this install crosses a MAJOR boundary, run updateThemeIds before smoke tests.
# fetch home, PDP, PLP, search, custom routes from $workspace--$account.myvtex.com
# only after smoke tests pass:
vtex workspace promote
```

**Wrong**

```bash
vtex use master
vtex install acme.store-theme@5.3.5
# any failure is now public
```

### Constraint: Verify the published artifact matches the source you expect

Before installing a new published version of a content-holding app to `master`, confirm that the artifact in the Apps Registry actually contains the blocks the active merchant content references. A successful `vtex publish` does not guarantee the artifact carries the merchant's customizations.

**Why this matters**

A common failure pattern is publishing from a stripped-down repository or from a base-theme fork that lost the custom blocks the merchant has been editing for months. The install succeeds, but `pages-graphql` cannot resolve the blocks referenced in the merchant's stored content, and the storefront falls back to default content. The artifact and the content disagree.

**Detection**

If the published version was built from a repository that does not contain the custom blocks the active theme references, STOP. Republish from the correct source. The `updateThemeIds` migration only rekeys content; it cannot resolve missing block IDs, so a stripped-down artifact will still fall back to default content even after a successful migration.

**Correct**

```bash
# pull the published artifact and confirm it ships the custom blocks
vtex apps files acme.store-theme@5.3.5 store/ | grep -E 'umMaisUm|customHeader'
# matches the block IDs the active theme depends on
```

**Wrong**

```bash
vtex publish
vtex install acme.store-theme@5.3.5
# published artifact is the boilerplate fork; it is missing every custom block
# referenced in the merchant's stored content
```

## Preferred pattern

Recommended deploy flow for any change to a content-holding app installed on `master`:

```text
1. Decide the SemVer bump deliberately
   - patch  → bug fix, no block contract change
   - minor  → new optional block, backward-compatible additions
   - major  → ANY structural change that breaks an existing block contract
              (avoid when possible; requires the updateThemeIds migration)

2. vtex release [patch|minor|major]
   vtex publish

3. Switch to a production-flag dev workspace
   (vtex use both creates and switches in one step)
   vtex use theme-rollout-YYYY-MM-DD --production

4. Install the new version in the dev workspace
   vtex install vendor.app@X.Y.Z

5. If the bump crosses a MAJOR boundary (including downgrades such as 5.x → 4.x):
   a. vtex install vtex.admin-graphql-ide@3.x   (if not already installed)
   b. vtex browse admin/graphql-ide
   c. In the IDE, select the app `vtex.pages-graphql@2.x` from the dropdown
   d. Run:
        mutation {
          updateThemeIds(
            from: "{appVendor}.{appName}@{oldMajor}.x",
            to:   "{appVendor}.{appName}@{newMajor}.x"
          )
        }
      Keep the literal "x" in both keys; do not replace it with a minor or
      patch number or the mutation silently fails.
   e. Expected response: { "data": { "updateThemeIds": true } }
   If the bump is patch or minor inside the same major, skip this step —
   content keys are preserved automatically.

6. Smoke-test in the dev workspace against the full page set
   - $workspace--$account.myvtex.com/             (home)
   - $workspace--$account.myvtex.com/<pdp-slug>/p (product)
   - $workspace--$account.myvtex.com/<category>   (PLP)
   - $workspace--$account.myvtex.com/<dept>       (department)
   - $workspace--$account.myvtex.com/<search>?_q  (search)
   - any /institucional/* or other custom routes
   - VTEX Admin → Storefront → Site Editor, Pages, Redirects
   - account, login, cart, checkout entry

7. If anything is wrong: stop. Do not promote. Investigate.
   If everything renders correctly:
   vtex workspace promote

8. Re-test on $account.myvtex.com (master) and the public domain.
   If the public CDN serves stale content, validate with cache-busting
   query strings; the edge will refresh on its normal TTL.

9. Keep the dev workspace for at least one business day in case a fast
   re-promote is needed.
```

Recommended emergency rollback after a broken major install on `master`:

```text
1. vtex use rollback-YYYY-MM-DD --production
   (vtex use both creates and switches; there is no `vtex workspace create`)
2. vtex install vendor.store-theme@<previous major version>
3. If the rollback crosses a MAJOR boundary (it almost always does), run
   updateThemeIds in vtex.pages-graphql@2.x to migrate stored Site Editor
   edits, Pages, and Redirects from the broken major back to the previous
   major:

     mutation {
       updateThemeIds(
         from: "{appVendor}.{appName}@{brokenMajor}.x",
         to:   "{appVendor}.{appName}@{previousMajor}.x"
       )
     }

4. Smoke-test the rollback workspace end-to-end (storefront pages and
   VTEX Admin → Storefront → Site Editor, Pages, Redirects).
5. vtex workspace promote

If updateThemeIds returns false, the GraphQL IDE shows an error, or
content does not appear after migration, escalate to VTEX support
before promoting; do not promote a workspace whose Site Editor content
has not been validated.
```

Recommended way to think about content-key behavior:

```text
Patch / minor bump
   acme.store-theme @ 0.0.61  →  0.0.62
   storage key prefix unchanged: acme.store-theme@0.x:*
   merchant content carries over automatically

Major bump
   acme.store-theme @ 0.0.61  →  5.0.0
   storage key prefix changes: acme.store-theme@0.x:*  →  acme.store-theme@5.x:*
   the new major starts empty from the resolver's point of view
   run updateThemeIds in vtex.pages-graphql@2.x inside the production-flag
   dev workspace to rekey Site Editor edits, Pages, and Redirects from
   acme.store-theme@0.x to acme.store-theme@5.x, then promote
```

## Common failure modes

- Running `vtex release major` on a theme to "clean up" the version number, not realizing it requires the `updateThemeIds` migration before promote.
- Installing a new theme major directly on `master` because the dev workspace "looked the same".
- Publishing from a forked repository that does not contain the custom blocks the active theme depends on. `updateThemeIds` rekeys content but cannot resolve missing block IDs.
- Treating `vtex link` as equivalent to `vtex install` for content-holding apps. `link` does not exercise the published artifact resolution path or the major-keyed content lookup.
- Running `vtex workspace promote` from a workspace that was never smoke-tested end-to-end.
- Promoting a major bump without running `updateThemeIds` first, so the storefront goes live with default `vtex.store-theme` content for every page that previously depended on Site Editor edits.
- Reaching for a non-existent `vtex workspace create` command. The CLI creates a workspace as a side effect of `vtex use {workspaceName} --production`; that single command both creates and switches.
- Replacing the literal `x` in `updateThemeIds` arguments with a minor or patch number (`acme.store-theme@5.0.0` instead of `acme.store-theme@5.x`). The mutation requires the major-with-x form and silently no-ops otherwise.
- Running `updateThemeIds` against the wrong app in the GraphQL IDE dropdown. The mutation only exists in `vtex.pages-graphql@2.x`.
- Trusting the public domain to confirm a fix immediately after promotion. CloudFront serves stale content; use `?utm_source=<value>` or another cache-busting parameter to bypass the edge during validation.
- Forgetting that downgrades (for example `5.x` → `4.x`) also cross a MAJOR boundary and need their own `updateThemeIds` run before promote.

## Review checklist

- [ ] Is the proposed version bump correctly classified as patch, minor, or major against SemVer rules?
- [ ] If the bump crosses a major boundary, is there a documented `updateThemeIds` migration step in the production-flag dev workspace (in either direction, including downgrades)?
- [ ] Is the install going to a production-flag dev workspace first (`vtex use $name --production`), never directly to `master`?
- [ ] If the bump is major, has `updateThemeIds` been run against `vtex.pages-graphql@2.x` from the GraphQL Admin IDE, and has the response been `{ "updateThemeIds": true }`?
- [ ] Has the published artifact been verified to contain the custom blocks the active theme depends on?
- [ ] Has the dev workspace been smoke-tested across home, PDP, PLP, department, search, custom routes, account, checkout entry, and the Storefront module (Site Editor, Pages, Redirects)?
- [ ] Is the dev workspace retained for at least one business day after promotion in case a fast re-promote is needed?

## Related skills

- [`vtex-io-app-contract`](../vtex-io-app-contract/skill.md) — When the question is what the manifest contract should declare, and why a major version bump is a contract-breaking change for content-holding apps.
- [`vtex-io-storefront-theme-app`](../vtex-io-storefront-theme-app/skill.md) — When the question is what a theme app actually owns (`store/blocks.json`, `store/routes.json`, page templates) and how those files relate to merchant Site Editor content.
- [`vtex-io-render-runtime-and-blocks`](../vtex-io-render-runtime-and-blocks/skill.md) — When the question is how a block name in a theme resolves to a React component, and why missing blocks under the active major cause render failures.
- [`vtex-io-data-access-patterns`](../vtex-io-data-access-patterns/skill.md) — When the question is whether a piece of data should live behind Site Editor at all, or in app settings, Master Data, or another store.

## Reference

- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) — How `vendor`, `name`, and `version` form the app identity used in storefront content keys.
- [Versioning an App](https://developers.vtex.com/docs/guides/vtex-io-documentation-versioning-an-app) — `vtex release` and the SemVer rules that decide whether a bump preserves or invalidates downstream content keys.
- [Publishing an App](https://developers.vtex.com/docs/guides/vtex-io-documentation-publishing-an-app) — How `vtex publish` produces the artifact installed by `vtex install`.
- [Installing an App](https://developers.vtex.com/docs/guides/vtex-io-documentation-installing-an-app) — Workspace scope of `vtex install` and why dev workspaces must be production-flag for realistic testing.
- [Creating a Production Workspace](https://developers.vtex.com/docs/guides/vtex-io-documentation-creating-a-production-workspace) — `vtex use {workspaceName} --production` is the single command that both creates and switches to a production-flag workspace.
- [Promoting a Workspace to Master](https://developers.vtex.com/docs/guides/vtex-io-documentation-promoting-a-workspace-to-master) — `vtex workspace promote` as the atomic cutover from a production-flag dev workspace to `master`.
- [Migrating CMS settings after a major theme update](https://developers.vtex.com/docs/guides/vtex-io-documentation-migrating-cms-settings-after-major-update) — Official procedure for the `updateThemeIds` mutation in `vtex.pages-graphql@2.x`, including the GraphQL IDE setup and the literal `MAJOR.x` argument format.
- [Store Framework](https://developers.vtex.com/docs/guides/vtex-io-documentation-store-framework) — Why theme apps own `store/` content and how Store Framework consumes it at render time.
