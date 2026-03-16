# Contributing to VTEX External Developer Skills

This guide covers everything you need to add skills, tracks, and export platforms to this repository.

## Table of Contents

- [Adding a New Skill](#adding-a-new-skill)
- [Skill Template Reference](#skill-template-reference)
- [Adding a New Track](#adding-a-new-track)
- [Adding a New Export Platform](#adding-a-new-export-platform)
- [Quality Checklist](#quality-checklist)
- [Naming Conventions](#naming-conventions)

---

## Adding a New Skill

### Step 1: Create the skill directory

Skills live at `tracks/{track}/skills/{skill-name}/skill.md`. Create the directory and file:

```bash
mkdir -p tracks/faststore/skills/faststore-my-new-skill
touch tracks/faststore/skills/faststore-my-new-skill/skill.md
```

### Step 2: Copy the template

Copy `_templates/skill-template.md` into your new file:

```bash
cp _templates/skill-template.md tracks/faststore/skills/faststore-my-new-skill/skill.md
```

### Step 3: Fill in the frontmatter

Open the file and update the YAML frontmatter at the top:

```yaml
---
name: faststore-my-new-skill
description: >
  A comprehensive guide to [topic]. Covers [key area 1], [key area 2], and [key area 3].
  Essential for developers working with [platform/feature]. Includes patterns for [common task],
  constraints to avoid [common mistake], and anti-patterns that lead to [failure mode].
track: faststore
tags:
  - faststore
  - relevant-keyword
  - another-keyword
version: "1.0"
vtex_docs_verified: "2026-03-16"
---
```

The `description` field must be at least 20 words. It's used for AI trigger matching, so make it keyword-rich and specific about what the skill covers.

### Step 4: Write the six required sections

Every skill must have these six H2 sections in this exact order:

1. `## Overview`
2. `## Key Concepts`
3. `## Constraints`
4. `## Implementation Pattern`
5. `## Anti-Patterns`
6. `## Reference`

See [Skill Template Reference](#skill-template-reference) for what goes in each section.

### Step 5: Annotate all code blocks

Every opening code fence must have a language annotation. The validator will fail on bare fences.

```typescript
// Good
```typescript
const x = 1
```

```text
// Also good for diagrams and directory trees
```text
src/
  components/
```

Closing fences are always bare (just ` ``` `). Only opening fences need the annotation.

### Step 6: Run validation

```bash
bun run validate
```

Fix any reported issues before proceeding. The validator checks 10 things; see the [README](README.md#validation) for the full list.

### Step 7: Run export

```bash
bun run export
```

This regenerates all platform exports. Commit both the skill file and the updated `exports/` directory.

### Step 8: Update the track index

Open `tracks/{track}/index.md` and add your skill to the skills table and the recommended learning order.

---

## Skill Template Reference

The canonical template is at `_templates/skill-template.md`. Here's what each section should contain.

### Overview

Three things: what the skill covers, when to use it, and what the reader will learn. Keep it to a short paragraph or three bullet points. Don't repeat the frontmatter description verbatim.

### Key Concepts

Background knowledge a developer needs before reading the rest of the skill. Use `###` subsections for each concept. Include an architecture diagram or data flow description if the topic involves multiple interacting components.

### Constraints

Rules that must be followed to avoid failures, security issues, or platform incompatibilities. This is the most important section.

Each constraint needs four parts:

**Rule**: A clear, unambiguous statement. Use "MUST" or "MUST NOT". Example: "MUST validate the `X-VTEX-signature` header on every callback."

**Why**: The consequence of violating the rule. What breaks? What security issue arises? Be specific.

**Detection**: A pattern the AI should watch for. Example: "If you see a callback handler without signature validation, STOP and add it." This is what triggers the AI to apply the constraint proactively.

**Paired examples**: A `✅ CORRECT` code block and a `❌ WRONG` code block. Both must be annotated (` ```typescript `, ` ```python `, etc.). The wrong example should include a comment explaining what's wrong.

Separate constraints with a horizontal rule (`---`).

### Implementation Pattern

The canonical, step-by-step approach for the skill's main task. Use `###` subsections for each step. End with a "Complete Example" subsection that shows the full implementation in one place.

All code blocks must be complete enough to run or adapt directly. Avoid pseudocode.

### Anti-Patterns

Common mistakes developers make. Each anti-pattern needs:

- **What happens**: The mistake itself (what the developer does)
- **Why it fails**: The consequence
- **Fix**: The correct approach, with a code example

Anti-patterns are different from constraints. Constraints are rules to follow during implementation. Anti-patterns are mistakes to recognize and fix after the fact.

### Reference

Links to VTEX documentation. Use this format:

```markdown
- [Article Title](https://developers.vtex.com/docs/guides/...) — Why this is relevant
- [Help Center Article](https://help.vtex.com/en/docs/...) — Why this is relevant
```

Only link to `developers.vtex.com` or `help.vtex.com`. Don't link to third-party sites or GitHub issues. If you verified facts against the docs, update `vtex_docs_verified` in the frontmatter.

---

## Adding a New Track

### Step 1: Create the track directory

Track directory names are kebab-case and short. Existing tracks: `faststore`, `payment`, `vtex-io`, `marketplace`, `headless`.

```bash
mkdir -p tracks/my-new-track/skills
```

### Step 2: Create the track index

```bash
touch tracks/my-new-track/index.md
```

The index file should include:

- H1 title
- One-line description
- Overview paragraph (2-3 sentences)
- Skills table with name, description, and relative link to each skill file
- Recommended Learning Order (numbered list)
- Key Constraints Summary (bullet list of the most critical rules from all skills)
- Related Tracks (cross-references to other tracks)

See any existing `tracks/*/index.md` for a complete example.

### Step 3: Add skills

Follow the [Adding a New Skill](#adding-a-new-skill) steps. Set the `track` frontmatter field to your new track's directory name.

### Step 4: Update the README

Add the new track to the Tracks section in `README.md` with its skill count and a brief description.

---

## Adding a New Export Platform

### Step 1: Create the exporter

Add a new exporter function in `scripts/export.ts`. The exporter receives a list of `Track` objects (each containing an array of `Skill` objects) and writes files to `exports/{platform}/`.

Follow the pattern of the existing exporters. Each exporter should:

- Accept `tracks: Track[]` as its argument
- Write output files using the `writeOutput(path, content)` helper
- Create one file per skill, or composite files per track, depending on what the platform needs
- Handle the platform's specific format requirements (frontmatter, headers, etc.)

### Step 2: Register the exporter

In `scripts/export.ts`, add your platform to:

1. The `--platform` CLI argument validation list
2. The `exporters` map that routes platform names to exporter functions
3. The `export:my-platform` script in `package.json`

### Step 3: Add the export directory

Create `exports/my-platform/` and add a `.gitkeep` if needed. The export script creates directories automatically, but having the directory in the repo makes the structure visible.

### Step 4: Document the platform

Add a subsection to the Usage section in `README.md` explaining how to use the exported files with the new platform.

---

## Quality Checklist

Before submitting a pull request, verify all of these:

- [ ] `bun run validate` passes with no errors
- [ ] `bun run export` completes with exit code 0
- [ ] No `TBD`, `TODO`, or `[placeholder]` text in prose sections
- [ ] All code blocks have language annotations on opening fences
- [ ] The `description` frontmatter field is at least 20 words
- [ ] All 6 required H2 sections are present in the correct order
- [ ] Each constraint has a Detection field and paired CORRECT/WRONG examples
- [ ] All VTEX doc links use `developers.vtex.com` or `help.vtex.com`
- [ ] The `vtex_docs_verified` date reflects when you last checked the docs
- [ ] The track `index.md` includes the new skill in its table and learning order
- [ ] The `exports/` directory is updated (run `bun run export` and commit the output)

---

## Naming Conventions

### Skill names

Use kebab-case. Prefix with the track name. Examples: `faststore-overrides`, `payment-idempotency`, `vtex-io-graphql`.

The name must be unique across the entire repository. It's used as the skill ID in exports.

### Track directory names

Short, lowercase, kebab-case. Match the `track` frontmatter field exactly. Current names: `faststore`, `payment`, `vtex-io`, `marketplace`, `headless`.

### Skill file structure

Every skill lives at exactly this path:

```text
tracks/{track-name}/skills/{skill-name}/skill.md
```

No other file names or locations are supported. The export and validation scripts discover skills by looking for files matching this pattern.

### Tags

Use lowercase, hyphenated tags. Tags should be technology names, concept names, or API names. Examples: `faststore`, `graphql`, `masterdata`, `pci-compliance`, `rate-limiting`.

Don't use tags that duplicate the track name or skill name. Tags are for cross-cutting concepts that help with discovery.

### Export file names

Export file names are derived from skill names and track names automatically by the export script. Don't create or rename export files manually.
