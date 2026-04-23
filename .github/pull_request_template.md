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

VTEX Skills, the VTEX Developer MCP, and other AI-assisted development tooling are documented across the public developer portal (`developers.vtex.com`) and help center (`help.vtex.com`). When this PR changes user-facing behavior (new/removed skills, renamed tracks, install commands, supported platforms, CLI flags, repository URL, etc.), any related public page may need to be updated in lockstep.

Examples of pages that commonly mirror this repository (non-exhaustive):

- [VTEX Skills guide](https://developers.vtex.com/docs/guides/vtex-skills)
- [Release notes — VTEX Developer MCP and Skills](https://developers.vtex.com/updates/release-notes/2026-04-09-vtex-developer-mcp-and-skills)

Search `developers.vtex.com` and `help.vtex.com` for any other page that references the affected tracks, skills, install commands, or repo URL — there may be more than the examples above.

> **Tip:** if you have the `vtex-docs` MCP configured (or any AI assistant with the VTEX Developer MCP), ask it to run `search_documentation` for the changed concepts and `fetch_document` on the hits — it covers both `developers.vtex.com` and `help.vtex.com` in a single pass. AI agents working on this repo are already instructed to do this automatically (see [`AGENTS.md`](../AGENTS.md#use-the-vtex-docs-mcp-for-discovery-and-diffing)).

Pick one:

- [ ] **No public docs change needed** — this PR only affects internal content (skill body edits, validator tweaks, refactors, CI, etc.)
- [ ] **Public docs update required** — list every page that needs to change and link the follow-up (issue, PR in [`vtex/dev-portal-content`](https://github.com/vtex/dev-portal-content), or ticket) below:

<!--
Example:
- Adds a new track `architecture` → update the "Tracks and skills" table on the VTEX Skills guide and any other page that lists the tracks.
- Follow-up: vtex/dev-portal-content#1234
-->

See [Public documentation sync](../CONTRIBUTING.md#public-documentation-sync) in `CONTRIBUTING.md` for the full checklist of what triggers a docs update.

---

## Related Issues

<!-- Link to related issues if applicable -->
