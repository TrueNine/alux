<h1 align="center">ALUX (Agentic Flux Gateway and Monitor)</h1>

<p align="center">
  <img src="assets/logo.svg" alt="ALUX" width="160"/>
</p>

<p align="center">
  <img alt="Codex/ChatGPT" src="https://img.shields.io/badge/Codex%2FChatGPT-412991?style=flat-square&logo=chatgpt&logoColor=white"/>
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-D97757?style=flat-square&logo=anthropic&logoColor=white"/>
  <img alt="Cursor" src="https://img.shields.io/badge/Cursor-000000?style=flat-square&logo=cursor&logoColor=white"/>
  <img alt="Cline" src="https://img.shields.io/badge/Cline-2B2B3B?style=flat-square"/>
  <img alt="OpenCode" src="https://img.shields.io/badge/OpenCode-000000?style=flat-square&logo=opencode&logoColor=white"/>
  <img alt="GitHub Copilot" src="https://img.shields.io/badge/GitHub%20Copilot-000000?style=flat-square&logo=githubcopilot&logoColor=white"/>
  <img alt="ZCode" src="https://img.shields.io/badge/ZCode-7C3AED?style=flat-square"/>
  <img alt="Grok Build" src="https://img.shields.io/badge/Grok%20Build-000000?style=flat-square&logo=xai&logoColor=white"/>
  <img alt="CodeBuddy" src="https://img.shields.io/badge/CodeBuddy-2F6FEB?style=flat-square"/>
  <img alt="Qoder" src="https://img.shields.io/badge/Qoder-6B4FBB?style=flat-square"/>
</p>

<p align="center">
  <img alt="Golang" src="https://img.shields.io/badge/Golang-00ADD8?style=flat-square&logo=go&logoColor=white"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white"/>
  <img alt="Bun" src="https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white"/>
  <img alt="Rust" src="https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white"/>
  <img alt="AgentSkills" src="https://img.shields.io/badge/AgentSkills-6B7280?style=flat-square"/>
  <img alt="Hernes" src="https://img.shields.io/badge/Hernes-6B7280?style=flat-square"/>
</p>

## Installation Plugin or Update Plugin

### GitHub Copilot

<details>

GitHub Copilot automatically reads the repository guidance in
`.github/copilot-instructions.md` and `AGENTS.md`. Copilot CLI loads its plugin
assets from `.copilot-plugin/`. Copilot coding agent uses
`.github/workflows/copilot-setup-steps.yml` to prepare Bun dependencies.
The Copilot CLI plugin loads its packaged assets from
`skills/copilot-skills/` and enables the shared session-start, pre-tool, and
post-tool hooks from `hooks/hooks.copilot.json`. Copilot hooks use the camelCase
protocol with lowercase runtime tool names (`bash`, `powershell`): pre-tool
rewrites travel through `modifiedArgs`, and post-tool compaction replaces the
verbose result through `modifiedResult.textResultForLlm`.

GitHub Copilot CLI support is provided through the Alux marketplace entry. The
plugin manifest is packaged under `.copilot-plugin/`; direct installation from
the repository root is intentionally not supported.

```bash
copilot plugin marketplace add TrueNine/alux
copilot plugin install alux@alux
```

</details>

### ChatGPT/Codex and Codex CLI

<details>

install:
```bash
codex plugin marketplace add TrueNine/alux
codex plugin marketplace upgrade alux
codex plugin add alux@alux
```

update:
```bash
codex plugin marketplace upgrade devopsflow
codex plugin add devopsflow@devopsflow
```

The plugin exposes the skills under `skills/codex-skills` and loads `hooks/hooks.codex.json`. Its Codex hooks follow the Claude-compatible protocol: `SessionStart` synchronizes derived instruction files, `PreToolUse` applies the PowerShell UTF-8 rewrite and rewrites supported shell commands through RTK before execution (Codex matches shell calls as `Bash` and accepts `hookSpecificOutput.updatedInput` command rewrites since the hooks beta in Codex CLI 0.117.0), and `PostToolUse` compacts verbose output through exit-code-2 feedback, which Codex applies by replacing the original tool result.

</details>

### Cursor

Cursor support is installed locally from a checked-out copy of this repository. Run one of the following from the repository root to link it into Cursor's local plugin directory.

<details>

macOS and Linux:
```bash
mkdir -p ~/.cursor/plugins/local
ln -s "$(pwd)" ~/.cursor/plugins/local/alux
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME\.cursor\plugins\local"
New-Item -ItemType Junction -Path "$HOME\.cursor\plugins\local\alux" -Target (Get-Location)
```

The plugin exposes the skills under `skills/cursor-skills` and loads `hooks/hooks.cursor.json`. Its Cursor hooks mirror the Claude workflow: `sessionStart` synchronizes derived instruction files, `preToolUse` applies the PowerShell UTF-8 rewrite and rewrites supported Shell commands through RTK before execution, and `postToolUse` compacts verbose fallback output. Cursor only permits shell post-hooks to inject `additional_context`, so fallback summaries are added to the conversation rather than replacing Cursor's original tool result. The `/add-plugin alux` command will only be documented after Alux is available in the Cursor Marketplace.


</details>

### Cline (CLI / SDK / Kanban)

Cline support uses the Cline SDK plugin system. It currently applies to the Cline CLI, SDK, and Kanban surfaces; the VS Code and JetBrains extensions do not load plugins yet.

<details>

install:
```bash
cline plugin install https://github.com/TrueNine/alux.git
```

The manifest lives in the `cline.plugins` field of `package.json` and points at `.cline-plugin/index.ts`, which exports a Cline SDK `AgentPlugin`. Its lifecycle hooks mirror the Claude workflow: `setup` synchronizes derived instruction files, `beforeTool` applies the PowerShell UTF-8 rewrite and rewrites supported shell commands through RTK before execution (`execute_command` and friends), and `afterTool` compacts verbose shell output with the shared RTK summarizer.

Cline only auto-discovers bundled plugin skills from a single-level `<package-root>/skills/<skill-name>/SKILL.md` layout, while Alux keeps one shared `skills/` tree for all agent platforms. To use the Alux skills with Cline, install them into your project's `.cline/skills/` directory; the installer keeps them local-only by registering every file in `.git/info/exclude`:

```bash
git clone https://github.com/TrueNine/alux.git
bun alux/scripts/install-project-assets.ts . --platform cline
```

</details>

### ZCode

ZCode reads the repository guidance from `AGENTS.md` natively. The plugin manifest is packaged under `.zcode-plugin/` (ZCode's preferred manifest location) together with its own marketplace catalog at `.zcode-plugin/marketplace.json`; it loads the skills under `skills/zcode-skills/` and enables the shared session-start, pre-tool, and post-tool hooks from `hooks/hooks.zcode.json` over the Claude-compatible hook protocol.

<details>

Install from a checked-out copy of this repository:

1. In ZCode, open **Plugin Marketplace → Add → Add Plugin Marketplace** and paste the repository root directory. ZCode auto-discovers the marketplace catalog at the repository root and prefers the `.zcode-plugin/plugin.json` manifest when loading the plugin.
2. Under **Personal → alux**, install the `alux` plugin and manage it afterwards under **Settings → Plugins**.
3. Create a new task, select the Alux skills from the composer picker, and send a trial prompt.

</details>

### Grok Build

Grok Build reads the repository guidance from `AGENTS.md` natively. The plugin manifest is packaged under `.grok-plugin/` (Grok's preferred manifest location) together with its own marketplace catalog at `.grok-plugin/marketplace.json` (which Grok prefers over the `.claude-plugin/` copy); it loads the skills under `skills/grok-skills/` and enables the shared session-start, pre-tool, and post-tool hooks from `hooks/hooks.grok.json` over the Claude-compatible hook protocol.

<details>

install:
```bash
grok plugin marketplace add TrueNine/alux
grok plugin install alux --trust
```

The `^Bash$` hook matcher reaches Grok's native `run_terminal_command` tool through Grok's Claude tool-name aliases, and plugin hook commands expand `${GROK_PLUGIN_ROOT}`. Pre-tool rewrites travel through Grok's `hookSpecificOutput.updatedInput` support, and post-tool summaries are delivered to the model as exit-2 feedback. Grok defaults its hook timeout to 5 seconds, so the session-start and pre-tool handlers declare an explicit 30-second timeout.

</details>

### CodeBuddy Code

CodeBuddy Code reads the repository guidance from `CODEBUDDY.md` natively. The plugin manifest is packaged under `.codebuddy-plugin/` (CodeBuddy's native manifest location) together with its own marketplace catalog at `.codebuddy-plugin/marketplace.json`; it loads the skills under `skills/codebuddy-skills/` and enables the shared session-start, pre-tool, and post-tool hooks from `hooks/hooks.codebuddy.json` over the Claude-compatible hook protocol.

<details>

install:
```bash
/plugin marketplace add TrueNine/alux
/plugin install alux@alux
```

Plugin hook commands expand `${CODEBUDDY_PLUGIN_ROOT}` (CodeBuddy also accepts `${CLAUDE_PLUGIN_ROOT}` as a compatibility fallback). Pre-tool rewrites travel through `hookSpecificOutput.modifiedInput`, and post-tool compaction replaces the tool result through `hookSpecificOutput.updatedToolOutput`. CodeBuddy additionally reads `.claude-plugin/plugin.json` as a fallback manifest, but the native `.codebuddy-plugin/` copy takes precedence.

</details>

### Qoder (CLI and IDE)

Qoder CLI and Qoder IDE both support plugins. Qoder CLI reads the repository guidance from `AGENTS.md` natively. The plugin manifest is packaged under `.qoder-plugin/` (Qoder's preferred manifest location) together with its own marketplace catalog at `.qoder-plugin/marketplace.json`; it loads the skills under `skills/qoder-skills/` and enables the shared session-start, pre-tool, and post-tool hooks from `hooks/hooks.qoder.json` over the Claude-compatible hook protocol.

<details>

Install from the Git marketplace:

```bash
qoder plugins marketplace add TrueNine/alux
qoder plugins install alux@alux
```

Or install a checked-out copy directly:

```bash
qoder plugins install /path/to/alux
```

Plugin hook commands expand `${QODER_PLUGIN_ROOT}` (Qoder also accepts `${CLAUDE_PLUGIN_ROOT}` as a compatibility fallback). Pre-tool rewrites travel through `hookSpecificOutput.updatedInput`, and post-tool compaction replaces the tool result through `hookSpecificOutput.updatedToolOutput`. Qoder additionally reads `.claude-plugin/plugin.json` as a fallback manifest, but the native `.qoder-plugin/` copy takes precedence; its marketplace lookup prefers `.qoder-plugin/marketplace.json` over `.claude-plugin/marketplace.json`.

For Qoder IDE, open **Settings → Plugins**, choose **Import** under **Custom**, and select this repository (or add it as a local marketplace), then enable the `alux` plugin.

</details>

## MCP servers

Every Alux plugin ships the CodeGraph MCP server, which runs `codegraph serve --mcp` and indexes the current workspace. Platform catalogs live under `mcps/` (`.mcp.claude.json`, `.mcp.codex.json`, `.mcp.opencode.json`, `.mcp.zcode.json`, `.mcp.grok.json`, `.mcp.codebuddy.json`, `.mcp.copilot.json`, and `.mcp.qoder.json`); the Cursor plugin auto-discovers the root `mcp.json`. The Cline plugin declares the `mcp` capability and registers the same server programmatically through `api.registerMcpServer` during setup, staying fail-open on hosts without MCP registration support. Install CodeGraph and ensure `codegraph` is on `PATH` before enabling the plugin.

## RTK hooks

Every platform shares one RTK pipeline in [`hooks/`](hooks/): `PreToolUse` first applies the Windows PowerShell `Get-Content` UTF-8 rewrite, then consults `rtk rewrite` for every single (non-compound) command — rtk itself decides what it can optimize, so simple commands outside the read-only whitelist (for example `bun run dev`) are rewritten too. Commands with shell composition (`&&`, `||`, `;`, redirects, `$(`, backticks) skip the rewrite and pass through untouched. `PostToolUse` compacts verbose output (kept head/tail lines around an omission marker) and replays safe read-only commands through `rtk proxy` for the compact native output; the strict read-only whitelist (`isSafeRtkCommand`) guards only this replay, because replay re-executes the command.

Compaction thresholds are tunable through environment variables (invalid or non-positive values fall back to the defaults):

| Variable | Default | Meaning |
|----------|---------|---------|
| `ALUX_RTK_COMPACT_MIN_CHARS` | `500` | Only outputs at least this many characters are compacted |
| `ALUX_RTK_COMPACT_HEAD_LINES` | `35` | Head lines kept before the omission marker |
| `ALUX_RTK_COMPACT_TAIL_LINES` | `35` | Tail lines kept after the omission marker |
| `ALUX_RTK_COMPACT_LINE_WIDTH` | `320` | Maximum characters per retained line |

## Shared Rules

The `rules/` tree distributes glob-scoped agent rules the same way `skills/` distributes skills: `rules/shared/*.md` is the canonical source (YAML frontmatter with `description` and optional `globs`), and `bun run sync:rules` generates the per-platform trees:

| Tree | Platform | Distribution | Glob support |
|------|----------|--------------|--------------|
| `rules/cursor-rules/*.mdc` | Cursor | Carried by the plugin (`.cursor-plugin/plugin.json` → `rules` field) | `globs` / `alwaysApply` honored |
| `rules/claude-rules/*.md` | Claude Code | Installed into the project's `.claude/rules/` (git-excluded) | `paths` honored |
| `rules/codebuddy-rules/*.md` | CodeBuddy Code | Installed into the project's `.codebuddy/rules/` (git-excluded) | `paths` honored |
| `rules/cline-rules/*.md` | Cline | Installed into the project's `.cline/rules/` (git-excluded) | `paths` honored |
| `rules/copilot-rules/*.instructions.md` | GitHub Copilot | Installed into the project's `.github/instructions/` (git-excluded) | `applyTo` honored |
| `rules/grok-rules/*.md` | Grok Build | Installed into the project's `.grok/rules/` (git-excluded) | None — frontmatter is stripped and every rule loads unconditionally |
| `rules/qoder-rules/*.md` | Qoder | Installed into the project's `.qoder/rules/` (git-excluded) | `paths` honored |

Codex, OpenCode, and ZCode have no per-file conditional rules mechanism (Codex scopes through nested `AGENTS.md` files only; OpenCode's config `instructions` array selects files by glob but loads them unconditionally; ZCode reads `AGENTS.md` and skills), so no trees are generated for them.

<details>

Only Cursor carries rules inside its plugin — the Claude Code, CodeBuddy, Grok, Cline, Copilot, and Qoder plugin manifests have no rules component. From a checked-out alux copy, install the copy-distributed assets into a project; the installer registers every copied file (and the alux clone itself, when it lives inside the project) in the project's `.git/info/exclude`, so alux assets stay local and never enter the project's version control:

```bash
# All platforms (claude, cline, codebuddy, copilot, grok, qoder; cline also installs .cline/skills)
bun alux/scripts/install-project-assets.ts .

# Or platform by platform
bun alux/scripts/install-project-assets.ts . --platform claude
```

Re-run after upgrading alux to refresh the copies. `.git/info/exclude` only affects untracked files, so remove previously committed copies with `git rm --cached` first. Submodule checkouts are handled: the exclusion is written to the checkout's own git directory (`.git/modules/<name>/info/exclude`), keeping the submodule clean. When alux itself is added as a project submodule, the clone is tracked on purpose and left out of the exclusion list.

Cursor users get the rules automatically when the plugin is installed; `globs` restricts a rule to matching files and `alwaysApply: true` loads it every session.

</details>
