---
name: alux-designmd
description: "Use when working on frontend pages, components, styling, layout, visual design, interaction, UI/UX, or DESIGN.md contracts. Check the target project's AGENTS.md and DESIGN.md before implementation; also use when creating, updating, selecting templates for, or validating DESIGN.md. Do not use for backend, data, or documentation-only tasks."
version: "0.2.33"
license: AGPL-3.0-or-later
metadata:
  version: "0.2.33"
---

# Frontend Design Contract

Use [DESIGN.md](DESIGN.md) to record frontend visual decisions as a reusable, reviewable contract that design and coding tools can consume. This skill covers the contract and its validation; production implementation must also follow the target project's frontend, accessibility, testing, and release conventions.

## About DESIGN.md

[DESIGN.md](DESIGN.md) comes from [Google Labs design.md](https://github.com/google-labs-code/design.md), with its specification and tool entry points documented at [designmd.app](https://designmd.app/). The format organizes colors, typography, spacing, component patterns, and interaction rules in Markdown. Use the [@google/design.md CLI](https://github.com/google-labs-code/design.md) for lint, diff, and export when the target project supports it. The CLI is not a runtime dependency of the target project.

## Core Compliance Rules

1. Discover the target project first. Look for its existing [DESIGN.md](DESIGN.md), [AGENTS.md](AGENTS.md), [README](README.md), frontend entry points, and validation commands. Do not assume a repository name, `skills/` directory, or tool-specific directory.
2. Once the target is identified as a frontend project, require both [DESIGN.md](DESIGN.md) and [AGENTS.md](AGENTS.md). If either file is missing, create or repair it first and stop before design or production coding.
3. [AGENTS.md](AGENTS.md) must contain the exact [@DESIGN.md](DESIGN.md) reference and state that all design and coding work must follow that contract. Continue only after this declaration is present.
4. Treat the declaration as a hard constraint. Every agent must follow [DESIGN.md](DESIGN.md) during design, coding, refactoring, styling changes, and review.
5. If the implementation conflicts with [DESIGN.md](DESIGN.md), pause implementation, update the contract, and pass diff and lint before continuing. Do not silently bypass, locally override, or replace the contract with personal preference.
6. Recheck the contract at every stage: confirm the relevant tokens and patterns before editing, inspect each new UI or interaction during implementation, and verify consistency and evidence before delivery.
7. Record the source of design decisions. Separate user requirements, codebase facts, brand sources, and inferences. Mark uncertain brand values for confirmation instead of inventing exact colors, fonts, or licensing claims.
8. Make every [DESIGN.md](DESIGN.md) change comparable and reversible. Produce a candidate file and run diff before replacing the current baseline.
9. Use Markdown links for references. Do not use a bare path or URL wrapped only in inline code.

### Default Agent Behavior

For any frontend, UI, or UX change, act without waiting for another request:

- Before editing, state: "This is a frontend UI/UX change. I will design and implement it according to [@DESIGN.md](DESIGN.md)."
- During editing, recheck the contract's color, typography, spacing, component, state, responsive, and accessibility rules.
- If existing implementation diverges from [DESIGN.md](DESIGN.md), identify the deviation and bring the implementation into compliance. If the contract is insufficient, update and validate it first.
- After editing, report the rules followed and the validations run; do not report only that styling changed.

## Workflow

### 1. Define Scope and Baseline

Record the target product or page, audience, brand sources, supported themes or breakpoints, behavior that must remain unchanged, target paths, and validation commands. Prefer existing project conventions. If no convention exists, propose maintaining [DESIGN.md](DESIGN.md) at the project root and state that choice before proceeding.

Determine whether the target is a frontend project by checking its frontend framework, page or component directories, frontend package manifest, build entry point, or the user's explicit statement. Then perform both required checks:

- Confirm [DESIGN.md](DESIGN.md) exists and is the design contract for the current directory. If it does not exist, create it and record why.
- Confirm [AGENTS.md](AGENTS.md) exists and contains [@DESIGN.md](DESIGN.md) plus a statement that the reference constrains design and coding. Create or repair it before continuing if necessary.

A clear [AGENTS.md](AGENTS.md) statement is: "All frontend design and coding must follow [@DESIGN.md](DESIGN.md); update and validate that file before any visual or interaction change."

Read the target project's [DESIGN.md](DESIGN.md) and [AGENTS.md](AGENTS.md) before making changes. If [DESIGN.md](DESIGN.md) is missing, inspect 1 个 relevant file under [templates/](templates/) for structure only. Template brand names, colors, fonts, and product judgments are not facts about the target project.

Choose a template by context:

| Template File | DESIGN.md Format Reference |
| --- | --- |
| [apple-DESIGN.md](templates/apple-DESIGN.md) | Brand presentation, photography or product canvas, display typography, and showcase components |
| [figma-DESIGN.md](templates/figma-DESIGN.md) | Brand presentation, photography or product canvas, display typography, and showcase components |
| [ibm-DESIGN.md](templates/ibm-DESIGN.md) | Enterprise and technical products, layered tokens, dense content, square boundaries, and state colors |
| [nvidia-DESIGN.md](templates/nvidia-DESIGN.md) | Enterprise and technical products, layered tokens, dense content, square boundaries, and state colors |
| [mongodb-DESIGN.md](templates/mongodb-DESIGN.md) | Developer products, light and dark surfaces, developer UI, code previews, and semantic colors |
| [supabase-DESIGN.md](templates/supabase-DESIGN.md) | Developer products, light and dark surfaces, developer UI, code previews, and semantic colors |
| [notion-DESIGN.md](templates/notion-DESIGN.md) | Workspaces or platforms, multi-context pages, navigation, cards, themed surfaces, and platform interactions |
| [vercel-DESIGN.md](templates/vercel-DESIGN.md) | Workspaces or platforms, multi-context pages, navigation, cards, themed surfaces, and platform interactions |
| [cursor-DESIGN.md](templates/cursor-DESIGN.md) | Style research: front matter, token groups, component patterns, and narrative granularity |
| [claude-DESIGN.md](templates/claude-DESIGN.md) | Style research: front matter, token groups, component patterns, and narrative granularity |
| [xai-DESIGN.md](templates/xai-DESIGN.md) | Style research: front matter, token groups, component patterns, and narrative granularity |
| [spacex-DESIGN.md](templates/spacex-DESIGN.md) | Style research: front matter, token groups, component patterns, and narrative granularity |
| [sentry-DESIGN.md](templates/sentry-DESIGN.md) | Style research: front matter, token groups, component patterns, and narrative granularity |

Copy only 1 个 file from [templates/](templates/) when a template is needed. Replace its brand and product content with target-project facts, check token references, add target-project states, and run validation. Do not copy external webpages, community samples, or brand content from another project.

### 2. Enforce the Design Contract

Before editing production code, extract the rules relevant to the task from [DESIGN.md](DESIGN.md) and record them in the work log or plan:

- Which color, typography, spacing, radius, shadow, and component tokens apply.
- Which interaction states, responsive rules, accessibility requirements, and prohibitions apply.
- Which existing patterns must be reused and which differences require a contract update first.

For every new page, component, style, or interaction, identify the corresponding rule in [DESIGN.md](DESIGN.md). If no rule applies, update the contract before inventing a visual language.

### 3. Write or Update DESIGN.md

Write or update [DESIGN.md](DESIGN.md) only when the contract is missing or cannot express the requested change. Keep it concise and consumable: use stable semantic tokens, explicit font fallbacks, reusable component patterns, and state rules. Do not add page copy, business data, or unconfirmed brand assumptions. When needed, copy structure from 1 个 file under [templates/](templates/) and replace it with target-project facts.

### 4. Review and Iterate

Review [DESIGN.md](DESIGN.md) for valid front matter, closed references, duplicate tokens, component tokens that reference unknown variables, adequate contrast, font fallbacks, and examples that match the implementation. Treat user-provided screenshots or pages as evidence of shown behavior only; do not infer hidden states from a screenshot. Recheck implementation against the contract before and after coding.

Preserve the baseline when changing the contract:

```bash
cp DESIGN.md DESIGN-v2.md
# Edit DESIGN-v2.md
bunx @google/design.md diff DESIGN.md DESIGN-v2.md
```

Do not assume the CLI's export syntax. Run `bunx @google/design.md --help` first, then use the current help output to export Tailwind CSS v4 theme variables. Record the output path and tool version.

### 5. Verify and Deliver

Run this from the target project root, replacing the path when the project uses another file name:

```bash
bunx @google/design.md lint DESIGN.md
```

Then run the target project's existing formatter, type check, visual regression, and build commands as applicable. If the project provides a `design:lint` script, prefer it after confirming that it checks the current [DESIGN.md](DESIGN.md). Report each command, exit code, checked artifact, and important summary. Clearly list network, CLI installation, font licensing, or missing-browser limitations as remaining risks.

Before delivery, confirm:

- The requested pages, themes, and tool consumers are covered.
- The current [DESIGN.md](DESIGN.md) passes lint, or the blocking reason is documented.
- [AGENTS.md](AGENTS.md) references [@DESIGN.md](DESIGN.md), explains the constraint, and the implementation follows it.
- Every changed UI or interaction maps to a rule in [DESIGN.md](DESIGN.md); conflicts were resolved by updating and validating the contract first.
- Major changes include a diff summary and migration impact; unused legacy tokens were not deleted accidentally.
- Requested Tailwind exports have been checked for variable names, values, and reference paths.
- Generator inputs, versions, and limitations are recorded; temporary third-party output is not treated as the project contract.

## Tools and References

- Official specification and entry points: [Google design.md](https://github.com/google-labs-code/design.md) and [designmd.app](https://designmd.app/). When CLI behavior, syntax, or version is uncertain, follow the current repository documentation and `--help` output.
- Community template index: [awesome-design-md](https://github.com/VoltAgent/awesome-design-md/). Use it only to discover samples, and review source, license, and token quality before adoption.
- Brand samples bundled with this skill are under [templates/](templates/). Read only the relevant template instead of loading every template.

## Common Mistakes

- Writing [DESIGN.md](DESIGN.md) as marketing copy without consumable tokens and state rules.
- Copying a template without replacing its brand, which introduces incorrect names, duplicate tokens, or unsuitable fonts and licenses.
- Running only lint while skipping implementation review, accessibility, font fallbacks, or export verification.
- Renaming or deleting tokens without a diff or migration mapping.
- Treating a `bunx` network installation failure as a [DESIGN.md](DESIGN.md) syntax error; report tool-environment and file-validation failures separately.

<!-- ALUX_DESIGNMD_SKILL_EOF: This is the complete Alux Designmd skill. -->
