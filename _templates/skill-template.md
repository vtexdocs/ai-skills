<!-- 
SKILL TEMPLATE SCHEMA
=====================

This file defines the canonical format for all skills in the vtex_skills repository.

YAML FRONTMATTER FIELDS:
- name (required): kebab-case identifier, unique across entire repo. Used as skill ID.
- description (required): ≥20 words, activation-oriented for AI auto-detection. Must start with "Apply when [trigger]." format.
- track (required): one of: faststore, payment, vtex-io, marketplace, headless
- tags (required): array of relevant technology/concept keywords for discovery
- globs (optional): array of file glob patterns that should auto-trigger the skill (e.g., ["src/components/**/*.tsx"])
- version (optional): semantic version for change tracking (default: "1.0")
- vtex_docs_verified (optional): last date factual claims were verified against VTEX docs (YYYY-MM-DD format)

STRUCTURE:
All skills MUST include these 6 H2 sections in this order:
1. Overview — what the skill covers, when to use it
2. Key Concepts — essential knowledge before implementation
3. Constraints — rules that MUST be followed, with detection patterns
4. Implementation Pattern — canonical, recommended approach
5. Anti-Patterns — common mistakes and how to fix them
6. Reference — links to VTEX documentation

CONSTRAINT SUBSECTIONS:
Each constraint must include:
- Rule: Clear statement of what MUST/MUST NOT be done
- Why: Explanation of consequences if violated
- Detection: Pattern the AI should watch for
- ✅ CORRECT: Working code example
- ❌ WRONG: Broken code example with explanation

ANTI-PATTERN SUBSECTIONS:
Each anti-pattern must include:
- What happens: Description of the mistake
- Why it fails: Consequence of the mistake
- Fix: Correct approach with code example

EXPORT NOTES:
- The export script will strip version and vtex_docs_verified fields for OpenCode
- Only name and description are used for OpenCode SKILL.md format
- All other fields are preserved in source but not exported to OpenCode
- The globs field is used by the Cursor exporter for file-pattern auto-triggering
-->

---
name: example-skill-name
description: >
  Apply when [trigger condition, e.g., creating or modifying files in specific directory]. Covers
  [key area 1], [key area 2], and [key area 3]. Use for [developer task, e.g., implementing feature X
  or debugging issue Y in the context of platform/feature].
track: faststore
tags:
  - keyword1
  - keyword2
  - keyword3
globs:
  - "src/path/**/*.ts"
  - "src/path/**/*.tsx"
version: "1.0"
vtex_docs_verified: "2026-03-16"
---

# Skill Title

## Overview

**What this skill covers**: [Describe the specific domain, feature, or pattern this skill addresses]

**When to use it**: [Describe the developer task or problem this skill helps solve]

**What you'll learn**: [List 3-4 key takeaways]

Example: "This skill covers FastStore component overrides using the `override` system. Use it when customizing store components beyond theme configuration. You'll learn how to create override files, inject custom logic, and maintain compatibility with FastStore updates."

## Key Concepts

**Essential knowledge before implementation**:

### Concept 1: [Name]
[Definition and explanation. Why this matters for the task.]

### Concept 2: [Name]
[Definition and explanation. Why this matters for the task.]

### Concept 3: [Name]
[Definition and explanation. Why this matters for the task.]

**Architecture/Data Flow** (if applicable):
[Diagram or description of how components interact]

## Constraints

**Rules that MUST be followed to avoid failures, security issues, or platform incompatibilities.**

### Constraint: [Name]

**Rule**: [Clear statement of what MUST or MUST NOT be done. Be specific and unambiguous.]

**Why**: [Explain the consequence if violated. What breaks? What security issue arises? What performance problem occurs?]

**Detection**: [Pattern the AI should watch for. Example: "If you see imports from X, STOP and verify Y"]

✅ **CORRECT**:
```typescript
// Working example that follows the rule
// Include comments explaining why this is correct
```

❌ **WRONG**:
```typescript
// Broken example that violates the rule
// Include comments explaining what's wrong and why it fails
```

---

### Constraint: [Name]

**Rule**: [Clear statement]

**Why**: [Consequence]

**Detection**: [Pattern to watch for]

✅ **CORRECT**:
```typescript
// Working example
```

❌ **WRONG**:
```typescript
// Broken example
```

## Implementation Pattern

**The canonical, recommended way to implement this feature or pattern.**

### Step 1: [First step]
[Explanation of what to do and why]

```typescript
// Complete, working code example
```

### Step 2: [Second step]
[Explanation of what to do and why]

```typescript
// Complete, working code example
```

### Step 3: [Third step]
[Explanation of what to do and why]

```typescript
// Complete, working code example
```

### Complete Example
[Full, end-to-end working example that ties all steps together]

```typescript
// Full implementation
```

## Anti-Patterns

**Common mistakes developers make and how to fix them.**

### Anti-Pattern: [Name]

**What happens**: [Describe what the developer does — the mistake]

**Why it fails**: [Explain the consequence. What breaks? What error occurs? What performance issue arises?]

**Fix**: [Correct approach with code example]

```typescript
// Correct implementation
```

---

### Anti-Pattern: [Name]

**What happens**: [Describe the mistake]

**Why it fails**: [Consequence]

**Fix**: [Correct approach with code example]

```typescript
// Correct implementation
```

## Reference

**Links to VTEX documentation and related resources.**

- [VTEX Documentation Title](https://developers.vtex.com/docs/guides/...) — Why this is relevant to the skill
- [VTEX Help Center Article](https://help.vtex.com/en/docs/...) — Why this is relevant to the skill
- [Related Skill Name](../other-skill.md) — How this skill relates to other skills in the repository
