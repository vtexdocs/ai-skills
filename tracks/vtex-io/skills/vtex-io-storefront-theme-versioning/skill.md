---
name: vtex-io-storefront-theme-versioning
description: >
  Apply when installing, publishing, upgrading, or rolling back a VTEX IO storefront theme app
  (`vendor.store-theme` or any app that owns `store/blocks.json`, `store/routes.json`, and
  `store/contentSchemas.json`). Covers how Site Editor and theme content are persisted in VBase
  keyed by the app's MAJOR version, why a major version bump silently orphans all storefront
  content, the safe deploy and promote workflow, and the rollback contract. Use for any operation
  that changes which version of a content-holding app is installed in `master`.
metadata:
  track: vtex-io
  tags:
    - vtex-io
    - storefront
    - store-theme
    - vbase
    - site-editor
    - versioning
    - deployment
    - rollback
    - pages-graphql
  globs:
    - "manifest.json"
    - "store/blocks.json"
    - "store/routes.json"
    - "store/templates/**/*.json"
    - "store/contentSchemas.json"
  version: "1.0"
  purpose: Decide how to safely version, install, promote, and roll back a VTEX IO storefront theme app without orphaning Site Editor content
  applies_to:
    - publishing a new version of a storefront theme app
    - installing a new theme major version in production
    - promoting a workspace that changes the active theme version
    - planning a rollback after a broken theme deploy
    - reviewing whether a `vtex release` command is safe for a content-holding app
  excludes:
    - block registration via `interfaces.json` (see `vtex-io-render-runtime-and-blocks`)
    - storefront component implementation (see `vtex-io-storefront-react`)
    - app-level settings storage (see `vtex-io-app-settings`)
    - Master Data versioning (see `vtex-io-masterdata-strategy`)
  decision_scope:
    - when a version change should be `patch`, `minor`, or `major` for a content-holding app
    - which workspace (`master` vs production-flag dev workspace) should receive a theme install first
    - when VBase content must be backed up before a theme operation
    - how to recover when a major bump has already orphaned content
  vtex_docs_verified: "2026-04-24"
---

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

- Treat any app that ships content under `store/` (theme apps and many storefront apps) as a **content-holding app**. Its installed MAJOR version is part of the VBase storage key for every Site Editor change a merchant has ever saved.
- Site Editor content, custom routes, templates, and per-template render caches are persisted by `vtex.pages-graphql` in VBase under keys of the form `vendor.app@MAJOR.x:template`. Examples: `acme.store-theme@0.x:store.home`, `acme.store-theme@0.x:store.product`.
- A `patch` (`0.0.61` → `0.0.62`) and a `minor` (`0.1.0` → `0.2.0`) reuse the same VBase key. A `major` (`0.x` → `5.x`) changes the key. The new major version starts with **zero merchant content** in VBase even if the theme code is otherwise identical.
- When `vtex.pages-graphql` cannot find content under the active major's key, it falls back to the default `vtex.store-theme` content. The site visibly degrades to "VTEX default theme" content even though the customer's app is installed and rendering.
- Never run `vtex release major` on a content-holding app unless you have a documented content-migration plan, a current VBase backup of the previous major, and an approved rollback window. A major bump on a theme is a destructive operation from the merchant's point of view.
- Always install and validate a new theme major in a **dev workspace with the production flag** (`vtex use saggintestprod --production`) before promoting. Linking is not enough: `vtex link` does not exercise published artifacts and does not produce the same VBase key transitions as `vtex install` + `vtex workspace promote`.
- Treat `vtex workspace promote` as the atomic cutover. Smoke-test the dev workspace's full page set (home, PDP, PLP, department, search, custom routes, account, checkout entry) before promoting. If the dev workspace is broken, master will be broken.
- Always back up the active theme's VBase content (`routes.json`, `templates.json`, `content.json`, and per-template `*_v2.json` / `*_v2_render.json` caches under `vtex.pages-graphql/userData/store/`) before any operation that changes the installed theme version on `master`.
- Verify that the version published to the Apps Registry matches the source you expect. A common failure pattern is publishing a stripped-down boilerplate by mistake — the registry version installs cleanly, but it does not contain the custom blocks the existing Site Editor content references.
- The CLI session token in `~/.vtex/session/session.json` (`token` field) is the same token accepted by internal VTEX APIs as the `VtexIdclientAutCookie` cookie. Use it for diagnostic VBase reads/backups during recovery; never embed it in app code.

## Hard constraints

### Constraint: Major version bumps on content-holding apps orphan VBase content

A `vtex release major` (or any version change that crosses the `MAJOR.x` boundary) on an app that owns Store Framework content MUST NOT be installed in `master` without an explicit content-migration plan, a fresh VBase backup of the previous major, and a documented rollback. The new major starts empty in `vtex.pages-graphql` VBase.

**Why this matters**

`vtex.pages-graphql` keys all merchant-owned routes, templates, and content by `vendor.app@MAJOR.x:template`. A patch and minor bump preserve the key; a major bump invalidates it. After a major bump, every Site Editor change the merchant ever saved becomes unreachable, and the resolver falls back to default `vtex.store-theme` content. The storefront looks "wiped" even though no data was deleted — it is simply not addressable under the active major key.

**Detection**

Before running any `vtex install vendor.app@X.Y.Z` on a production account, compare `X` to the major currently installed (`vtex ls --production | grep store-theme`). If `X` differs, STOP. Require an explicit migration and rollback plan before continuing.

Also STOP if a developer is about to run `vtex release major` on an app that ships any of: `store/blocks.json`, `store/routes.json`, `store/templates/`, `store/contentSchemas.json`.

**Correct**

```bash
vtex use staging-theme --production
vtex install acme.store-theme@5.0.0
# back up current master VBase first
# smoke-test the staging-theme workspace end-to-end
# only then promote
vtex workspace promote
```

**Wrong**

```bash
vtex release major
vtex publish
vtex install acme.store-theme@5.0.0
# installed straight to master — every Site Editor edit ever saved is now orphaned
```

### Constraint: Never install a content-holding app version directly to master without a dev-workspace smoke test

Any change that swaps the installed version of a content-holding app on `master` MUST go through a production-flag dev workspace first (`vtex use $name --production`), be smoke-tested across the full page set, and then be promoted with `vtex workspace promote`.

**Why this matters**

`master` is the public storefront. Installing a theme directly to `master` makes the new version live for every shopper instantly. If the install reveals a missing block, an orphaned content key, or a stripped-down published artifact, the only recovery is rollback under load. A production-flag dev workspace renders against the same data as `master` and surfaces the same failures without exposing shoppers.

**Detection**

If a developer's command sequence runs `vtex install` while the active workspace is `master`, STOP. Require switching to a production-flag dev workspace first.

**Correct**

```bash
vtex workspace create theme-rollout-2026-04 --production
vtex use theme-rollout-2026-04 --production
vtex install acme.store-theme@5.3.5
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

### Constraint: Back up VBase before any theme version change on master

Before any operation that changes the installed major or replaces the active theme app on `master`, the user MUST take a snapshot of `vtex.pages-graphql/userData/store/` for the active workspace. The snapshot MUST include `routes.json`, `templates.json`, `content.json`, and the per-template `*_v2.json` and `*_v2_render.json` caches for the currently installed major.

**Why this matters**

VBase content is the merchant's accumulated work in Site Editor. There is no first-class undo. If the install orphans content (major bump) or the new artifact ships a different block tree, the only fast recovery is restoring the previous VBase snapshot under the previous major key. Without a snapshot, recovery requires either an older workspace that still has the data or an internal AWS investigation.

**Detection**

If a deploy plan for a content-holding app does not include a VBase backup step, STOP and add one before any `vtex install` or `vtex workspace promote`.

**Correct**

```bash
# snapshot critical VBase files before changing the installed theme
TKN=$(jq -r .token ~/.vtex/session/session.json)
BUCKET="vtex.pages-graphql/userData"
for f in store/routes.json store/templates.json store/content.json \
         store/acme.store-theme@0.x:store.home_v2.json \
         store/acme.store-theme@0.x:store.product_v2.json; do
  curl -sS \
    -H "VtexIdclientAutCookie: $TKN" \
    "https://infra.io.vtex.com/vbase/v2/$ACCOUNT/master/buckets/$BUCKET/files/$f" \
    -o "_vbase-backups/$(date +%F)/$f"
done
```

**Wrong**

```bash
vtex install acme.store-theme@5.0.0
# no backup taken; if the install orphans content, there is nothing to restore
```

### Constraint: Verify the published artifact matches the source you expect

Before installing a new published version of a content-holding app to `master`, confirm that the artifact in the Apps Registry actually contains the blocks the active VBase content references. A successful `vtex publish` does not guarantee the artifact carries the merchant's customizations.

**Why this matters**

A common failure pattern is publishing from a stripped-down repository or from a base-theme fork that lost the custom blocks the merchant has been editing for months. The install succeeds, but `pages-graphql` cannot resolve the blocks referenced in the merchant's stored content, and the storefront falls back to default content. The artifact and the content disagree.

**Detection**

If the published version was built from a repository that does not contain the custom blocks the active VBase `templates.json` references, STOP. Either rebuild from the correct source or treat this install as a major change requiring full content migration.

**Correct**

```bash
# pull the published artifact and confirm it ships the custom blocks
vtex apps files acme.store-theme@5.3.5 store/ | grep -E 'umMaisUm|customHeader'
# matches the block IDs in the active templates.json
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
   - major  → ANY change that breaks an existing block contract
              OR any change that should not inherit current VBase content

2. vtex release [patch|minor|major]
   vtex publish

3. Create a production-flag dev workspace
   vtex workspace create theme-rollout-YYYY-MM-DD --production
   vtex use theme-rollout-YYYY-MM-DD --production

4. Back up VBase from master
   snapshot vtex.pages-graphql/userData/store/ → _vbase-backups/<date>/

5. Install the new version in the dev workspace
   vtex install vendor.app@X.Y.Z

6. Smoke-test in the dev workspace against the full page set
   - $workspace--$account.myvtex.com/             (home)
   - $workspace--$account.myvtex.com/<pdp-slug>/p (product)
   - $workspace--$account.myvtex.com/<category>   (PLP)
   - $workspace--$account.myvtex.com/<dept>       (department)
   - $workspace--$account.myvtex.com/<search>?_q  (search)
   - any /institucional/* or other custom routes
   - account, login, cart, checkout entry

7. If anything is wrong: stop. Do not promote. Investigate.
   If everything renders correctly:
   vtex workspace promote

8. Re-test on $account.myvtex.com (master) and the public domain.
   If the public CDN serves stale content, validate with cache-busting
   query strings; the edge will refresh on its normal TTL.

9. Keep the dev workspace and the VBase snapshot for at least one
   business day in case rollback is needed.
```

Recommended VBase content-key map for a theme app:

```text
vtex.pages-graphql/userData/store/
├── routes.json                                       # merchant-defined routes
├── templates.json                                    # block tree per template
├── content.json                                      # text/image overrides
├── vendor.store-theme@MAJOR.x:store.home_v2.json
├── vendor.store-theme@MAJOR.x:store.home_v2_render.json
├── vendor.store-theme@MAJOR.x:store.product_v2.json
├── vendor.store-theme@MAJOR.x:store.search_v2.json
└── vendor.store-theme@MAJOR.x:store.custom#<route>_v2.json
```

When `MAJOR` changes, none of these per-template caches are reachable under the new major's key. They are not deleted; they are orphaned.

Recommended emergency rollback after a broken major install:

```text
1. vtex use rollback-YYYY-MM-DD --production
2. vtex install vendor.store-theme@<previous major version>
3. Restore the VBase snapshot for the previous major
   (PUT each file back into vtex.pages-graphql/userData/store/)
4. Smoke-test the rollback workspace
5. vtex workspace promote
6. Once master is healthy, optionally clean up orphaned @NEW.x VBase
   files to prevent confusion in future audits
```

## Common failure modes

- Running `vtex release major` on a theme to "clean up" the version number, not realizing it orphans all Site Editor content.
- Installing a new theme major directly on `master` because the dev workspace "looked the same".
- Publishing from a forked repository that does not contain the custom blocks the active VBase content references.
- Treating `vtex link` as equivalent to `vtex install` for content-holding apps. `link` does not exercise the published artifact resolution path.
- Running `vtex workspace promote` from a workspace that was never smoke-tested end-to-end.
- Skipping the VBase backup because "the version is so close" — minor and patch are safe; major is not, and SemVer mistakes happen.
- Trusting the public domain to confirm a fix immediately after promotion. CloudFront serves stale content; use `?utm_source=<value>` or another cache-busting parameter to bypass the edge during validation.
- Using `Authorization: Bearer $TKN` against internal VTEX APIs during recovery. Internal APIs accept the same CLI token, but as the `VtexIdclientAutCookie` cookie, not as a Bearer header.
- Counting occurrences of a string in minified VBase JSON files with `grep -c`. `grep -c` counts lines; minified JSON is one line. Use a real JSON parser or `re.findall` for accurate audits.

## Review checklist

- [ ] Is the proposed version bump correctly classified as patch, minor, or major against SemVer rules?
- [ ] If the bump crosses a major boundary, is there a documented content-migration plan and rollback window?
- [ ] Is the install going to a production-flag dev workspace first, never directly to `master`?
- [ ] Has VBase been backed up (routes, templates, content, per-template caches) before any version change on `master`?
- [ ] Has the published artifact been verified to contain the custom blocks the active VBase content references?
- [ ] Has the dev workspace been smoke-tested across home, PDP, PLP, department, search, custom routes, account, and checkout entry?
- [ ] Is the rollback workspace and VBase snapshot retained for at least one business day after promotion?

## Related skills

- [`vtex-io-app-contract`](../vtex-io-app-contract/skill.md) — When the question is what the manifest contract should declare, and why a major version bump is a contract-breaking change for content-holding apps.
- [`vtex-io-storefront-theme-app`](../vtex-io-storefront-theme-app/skill.md) — When the question is what a theme app actually owns (`store/blocks.json`, `store/routes.json`, page templates) and how those files become VBase content.
- [`vtex-io-render-runtime-and-blocks`](../vtex-io-render-runtime-and-blocks/skill.md) — When the question is how a block name in `templates.json` resolves to a React component, and why missing blocks under the active major cause render failures.
- [`vtex-io-data-access-patterns`](../vtex-io-data-access-patterns/skill.md) — When the question is whether the data should live in VBase at all, or in app settings, Master Data, or another store.

## Reference

- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) — How `vendor`, `name`, and `version` form the app identity used as the VBase content key prefix.
- [Versioning an App](https://developers.vtex.com/docs/guides/vtex-io-documentation-versioning-an-app) — `vtex release` and the SemVer rules that decide whether a bump preserves or invalidates downstream content keys.
- [Publishing an App](https://developers.vtex.com/docs/guides/vtex-io-documentation-publishing-an-app) — How `vtex publish` produces the artifact installed by `vtex install`.
- [Installing an App](https://developers.vtex.com/docs/guides/vtex-io-documentation-installing-an-app) — Workspace scope of `vtex install` and why dev workspaces must be production-flag for realistic testing.
- [Workspaces](https://developers.vtex.com/docs/guides/vtex-io-documentation-workspaces) — Production vs development workspaces, `vtex workspace promote`, and the master cutover model.
- [Store Framework](https://developers.vtex.com/docs/guides/vtex-io-documentation-store-framework) — Why theme apps own `store/` content and how Store Framework consumes it at render time.
