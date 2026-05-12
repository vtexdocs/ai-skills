## Description

<!-- Briefly describe the changes in this PR -->

---

## Contribution Checklist

Before submitting, please verify:

- [ ] **Source files only**: Edited skill files in `tracks/{track}/skills/{name}/skill.md`, not in `skills/`, `exports/`, or `rules/` directories
- [ ] **Correct file name**: Skill file is named `skill.md` (lowercase), not `SKILL.md` or other variants
- [ ] **Frontmatter complete**: Includes `name`, `description`, and `metadata` with `track` and `tags` fields
- [ ] **Validation passed**: Ran `bun run validate` and all hard checks pass
- [ ] **Exports regenerated**: Ran `bun run export` and committed both source and generated files
- [ ] **Skill name format**: Uses kebab-case and is unique across the repository
- [ ] **Track directory correct**: Track name in frontmatter matches the directory structure

---

## Public Documentation Sync

Public VTEX docs on `developers.vtex.com` and `help.vtex.com` may need to be updated when this PR ships. Pick one:

- [ ] **No public docs change needed**
- [ ] **Public docs update required** — list the affected pages and link the follow-up below:

<!--
Example:
- developers.vtex.com/docs/guides/vtex-skills → update the "Tracks and skills" table.
- Follow-up: vtex/dev-portal-content#1234
-->

See [Public documentation sync](../CONTRIBUTING.md#public-documentation-sync) in `CONTRIBUTING.md` for what triggers a docs update and how to find every affected page.

---

## Related Issues

<!-- Link to related issues if applicable -->
