# Changelog

## [1.1.1](https://github.com/vtexdocs/ai-skills/compare/v1.1.0...v1.1.1) (2026-03-18)


### Bug Fixes

* **ci:** restore post-merge export commit using REPO_TOKEN ([eda05ae](https://github.com/vtexdocs/ai-skills/commit/eda05ae2f2b37b65152389d93ffd44ff72af887d))
* **ci:** trigger release workflow on release published event ([a56b595](https://github.com/vtexdocs/ai-skills/commit/a56b5953e3109ea6d58002427cdcbf779746e5dc))

## [1.1.0](https://github.com/vtexdocs/ai-skills/compare/v1.0.0...v1.1.0) (2026-03-17)


### New Skills & Features

* **release:** add Release Please for automated version bumping ([2d758be](https://github.com/vtexdocs/ai-skills/commit/2d758be95da02b1956d0209bae463700d19cb04a))
* **tooling:** support dual-format frontmatter in export script and fix description quoting ([1e11a64](https://github.com/vtexdocs/ai-skills/commit/1e11a64c725b4a18614b21bed548bf2c2c23cf82))
* **tooling:** support dual-format frontmatter in validator ([203e811](https://github.com/vtexdocs/ai-skills/commit/203e811a0af7853bc6495b7038e9177c46372a4f))


### Skill Improvements

* **faststore:** convert 4 skills to decision-oriented template ([31e4e47](https://github.com/vtexdocs/ai-skills/commit/31e4e47))
* **headless:** convert 4 skills to decision-oriented template ([b69ea7c](https://github.com/vtexdocs/ai-skills/commit/b69ea7c))
* **marketplace:** convert 4 skills to decision-oriented template ([848962a](https://github.com/vtexdocs/ai-skills/commit/848962a))
* **payment:** convert 4 skills to decision-oriented template ([4a0bff7](https://github.com/vtexdocs/ai-skills/commit/4a0bff7))
* **vtex-io:** convert and rename 5 skills to decision-oriented template ([4c8ce8e](https://github.com/vtexdocs/ai-skills/commit/4c8ce8e))


### Bug Fixes

* **ci:** remove post-merge export commit, let release.yml own exports ([2ca8887](https://github.com/vtexdocs/ai-skills/commit/2ca8887f87fbd2120a6e138af2bc4521ab70f3e4))
* **ci:** restore post-merge export commit using REPO_TOKEN ([eda05ae](https://github.com/vtexdocs/ai-skills/commit/eda05ae))


### Documentation

* add AGENTS.md with template and validation guidance for AI contributors ([db5129f](https://github.com/vtexdocs/ai-skills/commit/db5129f))


---

## [1.0.0](https://github.com/vtexdocs/ai-skills/commits/v1.0.0) (2026-03-16)


### New Skills & Features

* initial release of 21 VTEX AI skills across 5 tracks ([718d18c](https://github.com/vtexdocs/ai-skills/commit/718d18c))
  * FastStore: overrides, theming, state management, data fetching
  * Payment: provider protocol, idempotency, async flow, PCI security
  * VTEX IO: app structure, service apps, React apps, GraphQL, MasterData
  * Marketplace: catalog sync, order hook, fulfillment, rate limiting
  * Headless: BFF architecture, Intelligent Search, checkout proxy, caching strategy
* add Open Plugin format compatibility — `rules/` and `skills/` root directories ([6eac001](https://github.com/vtexdocs/ai-skills/commit/6eac001))
* add GitHub release workflow with per-platform tarballs ([4caf3b5](https://github.com/vtexdocs/ai-skills/commit/4caf3b5))
* add decision-oriented skill template replacing tutorial-oriented format ([f509412](https://github.com/vtexdocs/ai-skills/commit/f509412))


### Skill Improvements

* refine GraphQL skill: schema structure, `@cacheControl`, `@auth` directives ([1909d9d](https://github.com/vtexdocs/ai-skills/commit/1909d9d))


### Documentation

* rewrite README with hero section, badges, and Quick Start guide ([99c2d90](https://github.com/vtexdocs/ai-skills/commit/99c2d90))
* add VTEX IO track index with skill groupings and learning order ([8fe6f5d](https://github.com/vtexdocs/ai-skills/commit/8fe6f5d))

