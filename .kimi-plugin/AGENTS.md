<!-- BEGIN:.kimi-plugin/AGENTS.md -->

# .kimi-plugin/AGENTS.md

This directory is the Kimi Code plugin surface. Do not rediscover the limits below; they were verified against Kimi Code CLI 2.7.2 (`@moonshot-ai/kimi-code`) on 2026-11-23. Protocol authority: https://moonshotai.github.io/kimi-code/en/customization/plugins.html and the installed `dist/main.mjs`.

```mermaid
---
config:
  treeView:
    showIcons: true
    defaultIconPack: material-icon-theme
---
treeView-beta
    .kimi-plugin/ icon(material-icon-theme:folder)
        AGENTS.md icon(material-icon-theme:markdown)
        plugin.json icon(material-icon-theme:json)
        marketplace.json icon(material-icon-theme:json)
    hooks/ icon(material-icon-theme:folder)
        hooks.kimi.json icon(material-icon-theme:json)
    mcps/ icon(material-icon-theme:folder)
        .mcp.kimi.json icon(material-icon-theme:json)
    skills/ icon(material-icon-theme:folder)
        kimi-skills/ icon(material-icon-theme:folder)
```

## Product

- Target Kimi Code only (`kimi`, data under `~/.kimi-code`). The legacy Python/uv kimi-cli (`~/.kimi`) is no longer the supported product and cannot load this plugin.
- `kimi migrate` copies config, MCP servers, and sessions. It does not install or migrate plugins. Do not document it as an install path.

## Install

- Kimi Code CLI 2.7.2 has no `kimi plugins install` subcommand. Do not invent a shell installer or require `git clone`.
- The supported install is inside a running `kimi` session: `/plugins install https://github.com/TrueNine/alux`, then `/plugins reload` or a new session. Kimi copies the repository into its managed plugin directory.
- A checkout is only for developing this plugin (`/plugins install /path/to/alux`).

## Hooks

- Keep `plugin.json` `hooks` inline and identical to `hooks/hooks.kimi.json`. Kimi does not load a hooks file path.
- Plugin hooks run with the plugin root as cwd. Kimi sets `KIMI_PLUGIN_ROOT` but does not expand `${KIMI_PLUGIN_ROOT}` in the command string, and Windows `cmd.exe` will not either. The session-start command must stay `bun ./hooks/session-start/sync-agent-instructions.ts`. The script reads the session project from stdin `cwd`.
- Wire only `SessionStart`. Do not add `PreToolUse` or `PostToolUse` for RTK.
- `PreToolUse` can only veto. `runPreToolUse` returns `block?.reason` and calls `event.veto()`. Parsed hook JSON accepts `message` plus `hookSpecificOutput.permissionDecision` / `permissionDecisionReason`. Only `permissionDecision: deny` (or exit code 2) blocks. There is no `updatedInput` and allow stdout is discarded, so command rewrite cannot land.
- `PostToolUse` and `PostToolUseFailure` are `fireAndForget`. Hook stdout is never applied. The payload `toolOutput` is sliced to 2000 characters before the hook runs, so compaction and `rtk proxy` replay have nothing to attach to. A deny-and-retry workaround is not full RTK support; do not add it.

## Manifest

- Ship `.kimi-plugin/plugin.json` only. A root `kimi.plugin.json` wins when both exist. Do not add the root file unless that edit also removes the directory manifest.
- `skills` must stay `./skills/kimi-skills`. `mcpServers` must stay inline and identical to `mcps/.mcp.kimi.json`, with `command` and no `type` field. Kimi treats a `command` entry as stdio.
- Marketplace `source` must stay `..`. Kimi resolves a relative source against the catalog file directory, so `.` would install `.kimi-plugin/` itself and miss the manifest. Browsing the catalog requires a checkout; it is not the install path.
- Kimi Code has no per-file conditional rules mechanism. Do not add a `rules/kimi-rules/` tree.

<!-- END:.kimi-plugin/AGENTS.md -->
