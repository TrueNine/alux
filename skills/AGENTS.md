<!-- BEGIN:skills/AGENTS.md -->

# skills/AGENTS.md

This directory contains reusable agent skills and their platform-specific distributions.

## Source of Truth

- Treat `shared/` as the canonical source for platform-neutral skill content.
- Add or change shared files under `shared/<skill-name>/`, then run `bun run sync:skills` from the repository root.
- Do not directly edit a file copied from `shared/` into a `*-skills/` directory; the next synchronization overwrites it.
- Keep platform-specific files only in the corresponding native directory when no shared counterpart should replace them. For example, Codex-only `agents/` metadata and assets belong under `codex-skills/`.

## Skill Layout

- Give every skill a `SKILL.md` with valid YAML frontmatter and a concise trigger-oriented `description`.
- Keep the main workflow in `SKILL.md`. Put detailed reference material in `references/`, executable helpers in `scripts/`, static resources in `assets/`, and platform metadata in `agents/` when required.
- Use lowercase kebab-case directory names and keep each skill self-contained.
- Resolve bundled resources relative to the skill directory rather than the caller's working directory.
- Do not add AGENTS wrappers or path headings inside `SKILL.md` or agent definitions.

## Implementation Rules

- Write scripts for Bun and TypeScript unless the skill requires another runtime.
- Keep tests beside the script they cover using the `*.test.ts` suffix.
- Preserve unrelated platform-specific files when synchronizing shared skills.
- Avoid committing generated artifacts, temporary conversion outputs, or dependencies installed only to run a helper.
- When a helper changes files, provide a preview or check mode where practical and validate the result before reporting success.

## Validation

After changing shared skill content, synchronize and run the relevant checks from the repository root:

```bash
bun run sync:skills
bun test
bun run lint
bun run check:typescript
```

For agent-instruction files, also run the normalizer check and authoring validator supplied by `alux-agent-instructions`. Treat every reported violation as blocking.

Before finishing, confirm that shared files and their native copies are synchronized and that `git diff` contains no unintended generated changes.

<!-- END:skills/AGENTS.md -->
