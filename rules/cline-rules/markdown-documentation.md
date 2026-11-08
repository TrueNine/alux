---
description: Editing conventions for Markdown documentation in agent-driven repositories
paths: **/*.md
---

# Markdown documentation conventions

- Keep exactly one H1 per document and descend the heading hierarchy one level at a time.
- Keep instruction files (`AGENTS.md` and friends) actionable: conventions and commands, never a copy of the README; link out instead of duplicating content.
- In changelogs, prepend new entries above released sections and never rewrite or reorder released entries.
- Prefer relative links between documents of the same repository so previews and offline reads resolve.
- Wrap prose at natural sentence boundaries and leave fenced code blocks with their language tag set.
