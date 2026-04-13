# AGENTS.md — AI Contributor Guide

This file provides instructions for AI coding agents working on this repository.

## Quick rules

1. **Source files only**: Edit skill files in `tracks/{track}/skills/{name}/skill.md`. Never edit `exports/`, `skills/`, or `rules/` — they are auto-generated and will be silently overwritten the next time `bun run export` runs.
2. **Validate before committing**: Run `bun run validate`. All hard checks must pass; soft checks produce warnings but do not block CI.
3. **Regenerate exports**: Run `bun run export` after any skill change. Commit both source and generated files.

## Skill template

The decision-oriented template at `_templates/skill-template.md` is the recommended structure for new skills.

Recommended H2 sections (in order):
1. `## When this skill applies`
2. `## Decision rules`
3. `## Hard constraints`
4. `## Preferred pattern`
5. `## Common failure modes`
6. `## Review checklist`
7. `## Reference`

`## Related skills` is optional — add it only when it helps choose between nearby skills.

Skills that use a different structure (e.g., rules-based or tutorial-style) will pass validation with warnings instead of errors. The template sections are enforced as soft checks.

## Frontmatter format

```yaml
name: skill-name-kebab-case
description: Apply when [trigger condition]. Covers [key areas]. Use for [specific task].
metadata:
  track: faststore  # one of: faststore, payment, vtex-io, marketplace, headless
  tags: [keyword1, keyword2]
  globs: ["src/path/**/*.ts"]
  version: "1.0"
  vtex_docs_verified: "YYYY-MM-DD"
  # Optional:
  purpose: One-line goal summary
  applies_to: [task type 1, task type 2]
  excludes: [excluded use case]
  decision_scope: [decision-a-vs-b]
```

## Hard constraint format

Each constraint in `## Hard constraints` must include:

- A clear rule statement
- `**Why this matters**` — failure mode or security consequence
- `**Detection**` — what to look for and when to stop
- `**Correct**` — working code example
- `**Wrong**` — broken code example

## Description format

Must start with `Apply when ...` for AI activation matching.

## Reference URLs

Only link to `developers.vtex.com` or `help.vtex.com`. Verify URLs resolve before committing.

## Validation checks

`bun run validate` runs 11 checks on every skill file. Checks are split into **hard** (must pass — block CI) and **soft** (produce warnings only):

**Hard checks** (7): yaml-validity, description-quality, code-block-annotations, no-placeholders, size-bounds, track-consistency, globs-format.

**Soft checks** (4): required-sections, detection-patterns, paired-examples, url-format.

## Releases and versioning

Releases are automated via [Release Please](https://github.com/googleapis/release-please). **Do not push version tags manually.**

- Merging to `main` triggers a bot-managed **release PR** that bumps the version based on conventional commits.
- Merging that release PR creates the tag and GitHub Release automatically.
- `package.json`, `.plugin/plugin.json`, and `.cursor-plugin/plugin.json` are all bumped together — never edit their `version` fields by hand.

**Commit prefix → version bump:**

| Prefix | Bump | Example |
|---|---|---|
| `feat:` / `feat(scope):` | minor | new skill, new export platform |
| `fix:` / `fix(scope):` | patch | bug fix, broken URL |
| `refactor:` / `refactor(scope):` | patch | skill content improvement |
| `chore:`, `docs:` | none | no release PR opened |
| `feat!:` or `BREAKING CHANGE:` in footer | major | removed skill, renamed track |

Use `refactor(track):` for skill content changes so they appear in the changelog under "Skill Improvements" without triggering a minor bump.
