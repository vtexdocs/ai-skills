# AGENTS.md — AI Contributor Guide

This file provides instructions for AI coding agents working on this repository.

## Quick rules

1. **Source files only**: Edit skill files in `tracks/{track}/skills/{name}/skill.md`. Never edit files in `exports/`, `skills/`, or `rules/` — they are auto-generated.
2. **Validate before committing**: Run `bun run validate`. All 11 checks must pass.
3. **Regenerate exports**: Run `bun run export` after any skill change. Commit both source and generated files.

## Skill template

All skills use the decision-oriented template at `_templates/skill-template.md`.

Required H2 sections (in order):
1. `## When this skill applies`
2. `## Decision rules`
3. `## Hard constraints`
4. `## Preferred pattern`
5. `## Common failure modes`
6. `## Review checklist`
7. `## Reference`

`## Related skills` is optional — add it only when it helps choose between nearby skills.

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

`bun run validate` runs 11 checks: yaml-validity, description-quality, required-sections, code-block-annotations, no-placeholders, detection-patterns, paired-examples, url-format, size-bounds, track-consistency, globs-format.
