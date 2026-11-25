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
  <img alt="Kimi Code" src="https://img.shields.io/badge/Kimi%20Code-000000?style=flat-square"/>
  <img alt="Pi" src="https://img.shields.io/badge/Pi-8C5CF5?style=flat-square"/>
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

The plugin exposes the skills under `skills/cursor-skills` and loads `hooks/hooks.cursor.json`. Its Cursor hooks mirror the Claude workflow: `sessionStart` synchronizes derived instruction files, and `preToolUse` applies the PowerShell UTF-8 rewrite and rewrites supported Shell commands through RTK before execution. The post-tool hook is omitted: Cursor only permits shell post-hooks to inject `additional_context`, which appends to the conversation instead of replacing the original tool result, so a summary would only add tokens. The `/add-plugin alux` command will only be documented after Alux is available in the Cursor Marketplace.


</details>

### OpenCode

OpenCode support is V2 only. OpenCode 1 cannot load this plugin: the server entry is `@opencode/plugin`'s `Plugin.define`, not the old `@opencode-ai/plugin` function. The package is not published to npm. Install it from GitHub, or point a project config at a local checkout.

<details>

> [!WARNING]
> OpenCode V1 is no longer supported. This plugin does not ship the old `@opencode-ai/plugin` entry, and OpenCode 1 will not load it. Install and run OpenCode V2.

Install it for every project on this machine:

```bash
opencode plugin add github:TrueNine/alux
```

That command writes a global plugin entry. It stays on the commit it installed and does not follow `main`. To track the default branch instead:

```bash
opencode plugin add github:TrueNine/alux#main
```

Check, update, or remove it with:

```bash
opencode plugin list
opencode plugin update alux
opencode plugin remove alux
```

`plugin update` moves an unpinned `github:TrueNine/alux` install and a `#main` install. An exact commit stays pinned until you add the plugin again.

To enable Alux in one project only, clone the repository and add its directory to that project's `opencode.jsonc`. The path is relative to the config file, and the directory must be the package root (the directory that contains `package.json`). OpenCode loads the V2 server entry from the `"."` and `"./server"` exports.

```bash
git clone https://github.com/TrueNine/alux.git
```

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["../alux"]
}
```

Config changes apply without restarting OpenCode. If the plugin does not appear, run `opencode plugin list` and confirm the installed OpenCode is V2.

After it loads, Alux contributes the skills under `skills/opencode-skills`, registers the CodeGraph MCP server from `mcps/.mcp.opencode.json` (`codegraph serve --mcp`), rewrites shell commands before execution, replaces verbose shell output with the shared RTK summary, and replays safe read-only commands through `rtk proxy` when the summary does not already replace the result. Install CodeGraph and ensure `codegraph` is on `PATH` before relying on that MCP server. Derived instruction files are synchronized when the plugin loads and again when a session is created.

Opening this repository itself also loads `.opencode/plugins/alux`. That discovery path is only for working inside the Alux checkout. Other projects do not see it unless they install the plugin as shown above.

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

ZCode reads the repository guidance from `AGENTS.md` natively. The plugin manifest is packaged under `.zcode-plugin/` (ZCode's preferred manifest location) together with its own marketplace catalog at `.zcode-plugin/marketplace.json`; it loads the skills under `skills/zcode-skills/` and enables the shared session-start and pre-tool hooks from `hooks/hooks.zcode.json` over the Claude-compatible hook protocol. The post-tool hook is omitted: Claude-compatible PostToolUse feedback is appended to the tool result rather than replacing it, so verbose-output savings come from the PreToolUse RTK rewrite.

<details>

Install from a checked-out copy of this repository:

1. In ZCode, open **Plugin Marketplace → Add → Add Plugin Marketplace** and paste the repository root directory. ZCode auto-discovers the marketplace catalog at the repository root and prefers the `.zcode-plugin/plugin.json` manifest when loading the plugin.
2. Under **Personal → alux**, install the `alux` plugin and manage it afterwards under **Settings → Plugins**.
3. Create a new task, select the Alux skills from the composer picker, and send a trial prompt.

</details>

### Grok Build

Grok Build reads the repository guidance from `AGENTS.md` natively. The plugin manifest is packaged under `.grok-plugin/` (Grok's preferred manifest location) together with its own marketplace catalog at `.grok-plugin/marketplace.json` (which Grok prefers over the `.claude-plugin/` copy); it loads the skills under `skills/grok-skills/` and enables the shared session-start and pre-tool hooks from `hooks/hooks.grok.json` over the Claude-compatible hook protocol. The post-tool hook is omitted: Grok treats PostToolUse as a passive event and ignores hook output, so it could never replace the tool result.

<details>

install:
```bash
grok plugin marketplace add TrueNine/alux
grok plugin install alux --trust
```

The `^Bash$` hook matcher reaches Grok's native `run_terminal_command` tool through Grok's Claude tool-name aliases, and plugin hook commands expand `${GROK_PLUGIN_ROOT}`. Pre-tool rewrites travel through Grok's `hookSpecificOutput.updatedInput` support. Grok defaults its hook timeout to 5 seconds, so the session-start and pre-tool handlers declare an explicit 30-second timeout.

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

### Kimi Code

Kimi Code reads the repository guidance from `AGENTS.md` natively. The plugin manifest is packaged under `.kimi-plugin/plugin.json` (Kimi also accepts a root `kimi.plugin.json`, which wins when both exist; this repository ships only the directory form); it loads the skills under `skills/kimi-skills/`. Kimi Code plugin manifests wire hook rules and MCP servers inline rather than through referenced files, so the manifest embeds the shared session-start hook from `hooks/hooks.kimi.json` and the CodeGraph server from `mcps/.mcp.kimi.json` directly; contract tests keep the embedded copies synchronized with the canonical files.

<details>

> [!WARNING]
> Official support is Kimi Code, not the legacy kimi-cli. The old Python/uv `kimi-cli` (`~/.kimi`) is no longer the supported product and cannot load this plugin. Install and run Kimi Code (`kimi`, data under `~/.kimi-code`). `kimi migrate` only copies config, MCP servers, and sessions; it does not install plugins.

Kimi Code CLI 2.7.2 has no `kimi plugins install` subcommand (`kimi --help` lists `login`, `migrate`, `web`, and the rest, but not plugins). Plugin installation is the slash command inside `kimi`. No local clone is required; Kimi copies the repository into its own plugin directory:

```bash
kimi
/plugins install https://github.com/TrueNine/alux
/plugins reload
```

The installed plugin already carries `skills/kimi-skills/`, the session-start hook, and the CodeGraph MCP server. A checkout is only for developing the plugin itself (`/plugins install /path/to/alux`).

The repository also ships a custom marketplace catalog at `.kimi-plugin/marketplace.json` (`version: "2"` catalog, `alux` entry). Browsing it needs a checkout, because Kimi resolves a relative `source` against the catalog file: the entry's `source` is `..`, which is the repository root that contains `.kimi-plugin/plugin.json`.

```bash
/plugins marketplace /path/to/alux/.kimi-plugin/marketplace.json
```

Plugin hooks run with the plugin root as their working directory. Kimi sets `KIMI_PLUGIN_ROOT` but does not expand `${KIMI_PLUGIN_ROOT}` in the command string, and Windows `cmd.exe` would not expand that syntax either, so the session-start hook is a `./` path (`bun ./hooks/session-start/sync-agent-instructions.ts`). The script still reads the session project from the stdin `cwd` field rather than the process working directory. The RTK pre-tool and post-tool hooks are not wired: Kimi Code `PreToolUse` hooks can only block through `permissionDecision: deny` and offer no command-rewrite channel, and `PostToolUse` is an observation-only event whose output never replaces the tool result, so the RTK pipeline would have nothing to attach to. Only the session-start instruction sync runs.

</details>

### Pi Coding Agent

Use Pi 1.6.0 or later. From a checkout of Alux, preview the package for one session or register it for future sessions.

```bash
pi -e .
pi install .
```

For a project-local install, run `pi install /path/to/alux -l` from the target project and approve that project's Pi configuration when prompted. Pi loads the package from the checkout, so keep it at the registered path. To install directly from GitHub, run `pi install git:github.com/TrueNine/alux`.

The package exposes the canonical skills in `skills/shared/` as `/skill:alux-*` commands. Pi loads the target project's `AGENTS.md` natively. The extension adds shared rule guidance with each rule's path scope and registers CodeGraph with Pi's built-in MCP, visible in `/mcp`. An existing `mcp.json` entry for CodeGraph takes precedence.

Pi's model-invoked Bash and PowerShell tools use Alux's command preprocessing and successful-output compaction. On Windows, add `--tools +powershell` if PowerShell is outside your active tool set. Each command executes once. Pi retains full structured results for programmatic callers, and failed or already-truncated output stays available in its original form. Install `rtk` for command optimization, `codegraph` for MCP, and Bun for skills that run bundled scripts.

## MCP servers

Every Alux plugin ships the CodeGraph MCP server, which runs `codegraph serve --mcp` and indexes the current workspace. Platform catalogs live under `mcps/` (`.mcp.claude.json`, `.mcp.codex.json`, `.mcp.opencode.json`, `.mcp.zcode.json`, `.mcp.grok.json`, `.mcp.codebuddy.json`, `.mcp.copilot.json`, `.mcp.qoder.json`, and `.mcp.kimi.json`); the Cursor plugin auto-discovers the root `mcp.json`. The Kimi Code plugin embeds its catalog copy directly in the manifest, as Kimi Code plugin manifests declare `mcpServers` inline. The Cline plugin declares the `mcp` capability and registers the same server programmatically through `api.registerMcpServer` during setup, staying fail-open on hosts without MCP registration support. Install CodeGraph and ensure `codegraph` is on `PATH` before enabling the plugin.

## RTK hooks

Every platform shares one RTK pipeline in [`hooks/`](hooks/): `PreToolUse` first applies the Windows PowerShell `Get-Content` UTF-8 rewrite, then maps common read-only PowerShell cmdlets (`Get-ChildItem`/`gci` → `ls`, `Get-Content`/`gc` → `cat`, `Select-String`/`sls` → `rg`; bare `-Recurse` becomes `-R`) into consult candidates — rtk has no rewrite support for cmdlets, so the mapping only feeds `rtk rewrite`, which still decides what reaches the model while a refused consult falls back to the UTF-8 rewrite or an untouched passthrough. The consult then runs for every command without redirections or command substitutions — rtk itself decides what it can optimize, so simple commands outside the read-only whitelist (for example `bun run dev`) are rewritten too, and sequential compounds (`&&`, `;`, `||`, multi-line) are rewritten segment-wise. Redirects and `$(`/backtick substitutions skip the rewrite and pass through untouched. `PostToolUse` compacts verbose output (kept head/tail lines around an omission marker) and replays safe read-only commands through `rtk proxy` for the compact native output — but only on platforms whose PostToolUse protocol actually replaces the result the model sees (Codex, Copilot, CodeBuddy, Qoder, plus the Cline/OpenCode SDK adapters). Append-only platforms (Claude, ZCode, Grok, Cursor) omit the post hook entirely: their feedback would be added next to the original verbose output instead of replacing it, which costs tokens rather than saving them. Kimi Code wires neither RTK hook: its `PreToolUse` hooks can only block via `permissionDecision: deny` with no command-rewrite channel, and `PostToolUse` is observation-only, so both the rewrite and the compaction would be no-ops; the session-start instruction sync still runs. The strict read-only whitelist (`isSafeRtkCommand`) guards the replay, because replay re-executes the command.

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
| `rules/shared/*.md` | Pi | Read directly by the package extension | The system prompt tells Pi which rule to read for matching paths |

Codex, OpenCode, ZCode, and Kimi Code have no per-file conditional rules mechanism (Codex scopes through nested `AGENTS.md` files only; OpenCode's config `instructions` array selects files by glob but loads them unconditionally; ZCode and Kimi Code read `AGENTS.md` and skills), so no trees are generated for them.

<details>

Only Cursor carries rules inside its plugin — the Claude Code, CodeBuddy, Grok, Cline, Copilot, and Qoder plugin manifests have no rules component. From a checked-out alux copy, install the copy-distributed assets into a project; the installer registers every copied file (and the alux clone itself, when it lives inside the project) in the project's `.git/info/exclude`, so alux assets stay local and never enter the project's version control:

```bash
# Copy-distributed assets (claude, cline, codebuddy, copilot, grok, qoder).
# kimi is accepted by the script and copies skills into .kimi-code/skills, but the Kimi plugin already ships those skills — do not clone alux just to install it.
bun alux/scripts/install-project-assets.ts .

# Or platform by platform
bun alux/scripts/install-project-assets.ts . --platform claude
```

Re-run after upgrading alux to refresh the copies. `.git/info/exclude` only affects untracked files, so remove previously committed copies with `git rm --cached` first. Submodule checkouts are handled: the exclusion is written to the checkout's own git directory (`.git/modules/<name>/info/exclude`), keeping the submodule clean. When alux itself is added as a project submodule, the clone is tracked on purpose and left out of the exclusion list.

Cursor users get the rules automatically when the plugin is installed; `globs` restricts a rule to matching files and `alwaysApply: true` loads it every session.

</details>
