<!--
SKILL TEMPLATE SCHEMA
=====================

This file defines the canonical format for new skills in this repository.

YAML FRONTMATTER FIELDS:
- name (required): kebab-case identifier, unique across the entire repo. Used as skill ID.
- description (required): activation-oriented summary for AI auto-detection. Must start with "Apply when ...".
- metadata.track (required): one of: faststore, payment, vtex-io, marketplace, headless
- metadata.tags (required): relevant technology/concept keywords for discovery
- metadata.globs (optional): file patterns that should auto-trigger the skill
- metadata.version (optional): semantic version for change tracking
- metadata.purpose (optional): one-line summary of the decision or implementation goal
- metadata.applies_to (optional): common task types covered by the skill
- metadata.excludes (optional): cases this skill should not be used for
- metadata.decision_scope (optional): architecture or implementation choices the skill helps make
- metadata.vtex_docs_verified (optional): last date factual claims were verified against VTEX docs (YYYY-MM-DD)

STRUCTURE:
Skills should stay concise and decision-oriented. Prefer short sections, enforceable constraints, and concrete examples.

All skills SHOULD include these H2 sections in this order:
1. When this skill applies
2. Decision rules
3. Hard constraints
4. Preferred pattern
5. Common failure modes
6. Review checklist
7. Related skills (optional)
8. Reference

HARD CONSTRAINTS:
Each constraint should include:
- a clear rule
- why it matters
- detection guidance
- **Correct** example
- **Wrong** example

STYLE:
- Use backticks consistently for technical identifiers
- Keep examples concrete and easy for an AI to pattern-match
- Distinguish platform constraints from example values or placeholders
- Add `Related skills` only when it helps choose between nearby skills or clarifies adjacent responsibilities
- Skip `Related skills` when it would just restate obvious track structure or add low-value links
- Do not turn the skill into long-form documentation
-->

---
name: example-skill-name
description: Apply when deciding, designing, or implementing [capability] in [platform/context]. Covers when [mechanism A] is the right choice, the core contracts and implementation pattern, and the most important constraints to avoid common failures.
metadata:
  track: faststore
  tags:
    - keyword1
    - keyword2
    - keyword3
  globs:
    - "src/path/**/*.ts"
    - "src/path/**/*.tsx"
  version: "1.0"
  purpose: Decide when to use [pattern] and how to implement it safely
  applies_to:
    - task type 1
    - task type 2
  excludes:
    - use case this skill should not cover
  decision_scope:
    - decision-a-vs-b
    - implementation-strategy
  vtex_docs_verified: "2026-03-17"
---

# Skill Title

## When this skill applies

Use this skill when [condition].
- [specific trigger]
- [specific trigger]
- [specific trigger]

Do not use this skill as the default choice for:
- [case that belongs to another skill]
- [case that belongs to another mechanism]

## Decision rules

- Use [pattern/mechanism] when [condition].
- Prefer [alternative] when [condition].
- Do not introduce [pattern/mechanism] only for convenience if [simpler option] is more explicit.
- Use this skill as a decision guide first, then as an implementation guide.

## Hard constraints

### Constraint: [Required builder, contract, or platform rule]

[State the rule in plain language.]

**Why this matters**
[Explain the failure mode, security risk, or platform incompatibility.]

**Detection**
[Describe what the AI or reviewer should look for and when to stop.]

**Correct**
```json
{
  "example": true
}
```

**Wrong**

```json
{
  "example": false
}
```

### Constraint: [Naming, registration, or implementation rule]

[State the rule in plain language.]

**Why this matters**
[Explain what breaks if this is violated.]

**Detection**
[Describe the pattern to cross-check.]

**Correct**

```typescript
export const example = () => {
  return 'correct'
}
```

**Wrong**

```typescript
export const broken = () => {
  return 'wrong'
}
```

### Constraint: [Security, auth, cache, or data rule]

[State the rule in plain language.]

**Why this matters**
[Explain the operational, security, or data consequence.]

**Detection**
[Describe what must be present or absent.]

**Correct**

```graphql
type Query {
  example: String
}
```

**Wrong**

```graphql
type Query {
  example: String
}
```

## Preferred pattern

Recommended file layout:

```text
src/
├── example/
│   └── implementation.ts
└── index.ts
```

Minimal configuration pattern:

```json
{
  "key": "value"
}
```

Use the platform version supported by the project or the documented standard for the target app.

Minimal implementation pattern:

```typescript
export function example() {
  return 'value'
}
```

If examples include placeholder identifiers, credentials, policies, or resource codes, replace them with the actual values configured for the app.

## Common failure modes

- [Wrong mechanism is chosen for the job.]
- [Required platform registration or configuration is missing.]
- [Implementation breaks because a contract is mismatched.]
- [Security, auth, or cache behavior is missing or incorrect.]

## Review checklist

- [ ] Is this the correct mechanism for the use case?
- [ ] Are the required platform declarations and registrations present?
- [ ] Do implementation keys and contracts match exactly?
- [ ] Are security, auth, and cache rules applied correctly?
- [ ] Are example placeholder values replaced with real app-specific values where needed?

## Related skills

- [`related-skill-name`](../related-skill/skill.md) - When to use that skill instead of this one
- [`another-related-skill`](../another-related-skill/skill.md) - How it complements this skill

## Reference

- [VTEX Documentation Title](https://developers.vtex.com/docs/guides/...) - Why this is relevant
- [VTEX Documentation Title](https://developers.vtex.com/docs/guides/...) - Why this is relevant
