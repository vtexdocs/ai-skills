---
name: vtex-io-storefront-theme-versioning
description: >
  Apply when installing, publishing, upgrading, or rolling back a VTEX IO storefront theme app
  (`vendor.store-theme` or any app that owns `store/blocks.json`, `store/routes.json`, and
  `store/contentSchemas.json`). Covers how Site Editor and theme content are scoped by the
  app's MAJOR version, why a major version bump leaves the new major with no merchant content
  and silently falls back to default theme content, and the safe install-in-workspace,
  recreate-content, smoke-test, then promote workflow. Use for any operation that changes
  which version of a content-holding app is installed in `master`.
metadata:
  track: vtex-io
  tags:
    - vtex-io
    - storefront
    - store-theme
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
  purpose: Decide how to safely version, install, promote, and roll back a VTEX IO storefront theme app without losing visibility of merchant Site Editor content
  applies_to:
    - publishing a new version of a storefront theme app
    - installing a new theme major version in production
    - promoting a workspace that changes the active theme version
    - planning recovery after a broken theme deploy
    - reviewing whether a `vtex release` command is safe for a content-holding app
  excludes:
    - block registration via `interfaces.json` (see `vtex-io-render-runtime-and-blocks`)
    - storefront component implementation (see `vtex-io-storefront-react`)
    - app-level settings storage (see `vtex-io-app-settings`)
    - Master Data versioning (see `vtex-io-masterdata-strategy`)
  decision_scope:
    - when a version change should be `patch`, `minor`, or `major` for a content-holding app
    - which workspace (`master` vs production-flag dev workspace) should receive a theme install first
    - how to recreate merchant content under a new major before promoting
    - how to recover when a major bump has already been promoted to `master`
  vtex_docs_verified: "2026-04-30"
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

- Treat any app that ships content under `store/` (theme apps and many storefront apps) as a **content-holding app**. Its installed MAJOR version is part of the key the platform uses to store and look up every Site Editor change a merchant has ever saved against blocks declared by that app.
- Site Editor content, custom routes, templates, and per-template render caches are stored by `vtex.pages-graphql` under keys of the form `vendor.app@MAJOR.x:template`. Examples: `acme.store-theme@0.x:store.home`, `acme.store-theme@0.x:store.product`.
- A `patch` (`0.0.61` → `0.0.62`) and a `minor` (`0.1.0` → `0.2.0`) reuse the same key and the new version sees the same merchant content. A `major` (`0.x` → `5.x`) changes the key. The new major starts with **zero merchant content** even if the theme code is otherwise identical.
- When `vtex.pages-graphql` cannot find content for the active major, it falls back to the default `vtex.store-theme` content. The site visibly degrades to "VTEX default theme" content even though the customer's app is installed and rendering.
- Avoid `vtex release major` on a content-holding app whenever possible. Prefer keeping changes within the current major as `patch` or `minor` so merchant content carries forward automatically.
- When a major bump is unavoidable because of a structural change to blocks, routes, or templates, treat it as a **content rebuild**. The new major needs the merchant content to be re-authored under it before it goes live. There is no developer-side restore path for the previous major's content.
- Always install and validate a new theme major in a **dev workspace with the production flag** (`vtex use rollout-workspace --production`) before promoting. Linking is not enough: `vtex link` does not exercise published artifacts and does not produce the same content-key behavior as `vtex install` + `vtex workspace promote`.
- Use the dev workspace as the place to **rebuild Site Editor content under the new major** (Site Editor edits, routes, custom pages, banners). Site Editor content is workspace-scoped, so edits made in the dev workspace will be promoted with `vtex workspace promote`.
- Treat `vtex workspace promote` as the atomic cutover. Smoke-test the dev workspace's full page set (home, PDP, PLP, department, search, custom routes, account, checkout entry) before promoting. If the dev workspace is broken, master will be broken.
- Verify that the version published to the Apps Registry matches the source you expect. A common failure pattern is publishing a stripped-down boilerplate by mistake — the registry version installs cleanly, but it does not contain the custom blocks the existing Site Editor content references.

## Hard constraints

### Constraint: Major version bumps on content-holding apps require a content rebuild before promote

A `vtex release major` (or any version change that crosses the `MAJOR.x` boundary) on an app that owns Store Framework content MUST NOT be promoted to `master` without first rebuilding the merchant content under the new major in a production-flag dev workspace. The new major starts empty from `vtex.pages-graphql`'s point of view; promoting it to `master` without re-authoring the content makes the storefront fall back to default theme content for every page that depended on Site Editor edits.

**Why this matters**

`vtex.pages-graphql` keys every merchant-owned route, template, and Site Editor edit by `vendor.app@MAJOR.x:template`. A patch and minor bump preserve the key; a major bump invalidates it. After a major bump, every Site Editor change the merchant ever saved is no longer visible to the resolver, and the storefront falls back to default `vtex.store-theme` content. Developers do not have a self-service restore path for the previous major's content, so the only safe path forward is to recreate the content under the new major before it is exposed to shoppers.

**Detection**

Before running any `vtex install vendor.app@X.Y.Z` on a production account, compare `X` to the major currently installed (`vtex ls --production | grep store-theme`). If `X` differs, STOP. Require an explicit content-rebuild plan in a production-flag dev workspace before continuing.

Also STOP if a developer is about to run `vtex release major` on an app that ships any of: `store/blocks.json`, `store/routes.json`, `store/templates/`, `store/contentSchemas.json`. Confirm the structural change cannot be modeled as a `patch` or `minor` first.

**Correct**

```bash
vtex workspace create theme-rollout --production
vtex use theme-rollout --production
vtex install acme.store-theme@5.0.0
# 1. open the storefront in this workspace
# 2. recreate every Site Editor edit, route, banner, and custom page under the new major
# 3. smoke-test the workspace end-to-end
# 4. only then:
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

### Constraint: Verify the published artifact matches the source you expect

Before installing a new published version of a content-holding app to `master`, confirm that the artifact in the Apps Registry actually contains the blocks the active merchant content references. A successful `vtex publish` does not guarantee the artifact carries the merchant's customizations.

**Why this matters**

A common failure pattern is publishing from a stripped-down repository or from a base-theme fork that lost the custom blocks the merchant has been editing for months. The install succeeds, but `pages-graphql` cannot resolve the blocks referenced in the merchant's stored content, and the storefront falls back to default content. The artifact and the content disagree.

**Detection**

If the published version was built from a repository that does not contain the custom blocks the active theme references, STOP. Either rebuild from the correct source or treat this install as a major change requiring a full content rebuild.

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
              (avoid when possible; requires a content rebuild)

2. vtex release [patch|minor|major]
   vtex publish

3. Create a production-flag dev workspace
   vtex workspace create theme-rollout-YYYY-MM-DD --production
   vtex use theme-rollout-YYYY-MM-DD --production

4. Install the new version in the dev workspace
   vtex install vendor.app@X.Y.Z

5. If the bump is major:
   - open the storefront for the dev workspace
   - re-author every Site Editor change, route, banner, and custom page
     under the new major (Site Editor changes are workspace-scoped and
     will be promoted with the workspace)
   - if the bump is patch/minor, the existing content carries over and
     this step is unnecessary

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

9. Keep the dev workspace for at least one business day in case a fast
   re-promote is needed.
```

Recommended emergency rollback after a broken major install on `master`:

```text
1. vtex workspace create rollback-YYYY-MM-DD --production
2. vtex use rollback-YYYY-MM-DD --production
3. vtex install vendor.store-theme@<previous major version>
4. Re-author the merchant content under the previous major in this
   workspace (the previous major's stored content is no longer the
   active version on master, so treat this as a content rebuild even
   though it is the previous code)
5. Smoke-test the rollback workspace end-to-end
6. vtex workspace promote

If the time required to re-author content is unacceptable, escalate to
VTEX support. Self-service recovery of previously stored merchant content
is not part of the developer surface.
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
   merchant content must be re-authored under @5.x before promote
```

## Common failure modes

- Running `vtex release major` on a theme to "clean up" the version number, not realizing it requires a full content rebuild before promote.
- Installing a new theme major directly on `master` because the dev workspace "looked the same".
- Publishing from a forked repository that does not contain the custom blocks the active theme depends on.
- Treating `vtex link` as equivalent to `vtex install` for content-holding apps. `link` does not exercise the published artifact resolution path or the major-keyed content lookup.
- Running `vtex workspace promote` from a workspace that was never smoke-tested end-to-end.
- Promoting a major bump without re-authoring the merchant content in the dev workspace first, so the storefront goes live with default `vtex.store-theme` content for every page that previously depended on Site Editor edits.
- Trusting the public domain to confirm a fix immediately after promotion. CloudFront serves stale content; use `?utm_source=<value>` or another cache-busting parameter to bypass the edge during validation.
- Assuming there is a developer-accessible way to restore the previous major's merchant content. Recovery is a content rebuild in a workspace; there is no self-service restore path.

## Review checklist

- [ ] Is the proposed version bump correctly classified as patch, minor, or major against SemVer rules?
- [ ] If the bump crosses a major boundary, is there a documented content-rebuild plan in a production-flag dev workspace?
- [ ] Is the install going to a production-flag dev workspace first, never directly to `master`?
- [ ] If the bump is major, has every Site Editor change, route, banner, and custom page been re-authored in the dev workspace under the new major before promote?
- [ ] Has the published artifact been verified to contain the custom blocks the active theme depends on?
- [ ] Has the dev workspace been smoke-tested across home, PDP, PLP, department, search, custom routes, account, and checkout entry?
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
- [Workspaces](https://developers.vtex.com/docs/guides/vtex-io-documentation-workspaces) — Production vs development workspaces, `vtex workspace promote`, and the master cutover model.
- [Store Framework](https://developers.vtex.com/docs/guides/vtex-io-documentation-store-framework) — Why theme apps own `store/` content and how Store Framework consumes it at render time.
