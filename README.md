<h1 align="center">ALUX (Agentic Flux GatewayMonitor)</h1>

<p align="center">
  <img src="assets/logo.svg" alt="ALUX" width="160"/>
</p>

<p align="center">
  
</p>

<p align="center">
  <img alt="Codex/ChatGPT" src="https://img.shields.io/badge/Codex%2FChatGPT-412991?style=flat-square&logo=openai&logoColor=white"/>
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-D97757?style=flat-square&logo=anthropic&logoColor=white"/>
  <img alt="Cursor" src="https://img.shields.io/badge/Cursor-000000?style=flat-square&logo=cursor&logoColor=white"/>
  <img alt="Cline" src="https://img.shields.io/badge/Cline-2B2B3B?style=flat-square"/>
  <img alt="Golang" src="https://img.shields.io/badge/Golang-00ADD8?style=flat-square&logo=go&logoColor=white"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white"/>
  <img alt="Bun" src="https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white"/>
  <img alt="Rust" src="https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white"/>
  <img alt="AgentSkills" src="https://img.shields.io/badge/AgentSkills-6B7280?style=flat-square"/>
  <img alt="Hernes" src="https://img.shields.io/badge/Hernes-6B7280?style=flat-square"/>
</p>

## Installation Plugin or Update Plugin

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

</details>

### Cursor

Cursor support is installed locally from a checked-out copy of this repository. Run one of the following from the repository root to link it into Cursor's local plugin directory.

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

### Cline (CLI / SDK / Kanban)

Cline support uses the Cline SDK plugin system. It currently applies to the Cline CLI, SDK, and Kanban surfaces; the VS Code and JetBrains extensions do not load plugins yet.

install:
```bash
cline plugin install https://github.com/TrueNine/alux.git
```

The manifest lives in the `cline.plugins` field of `package.json` and points at `.cline-plugin/index.ts`, which exports a Cline SDK `AgentPlugin`. Its lifecycle hooks mirror the Claude workflow: `setup` synchronizes derived instruction files, `beforeTool` applies the PowerShell UTF-8 rewrite to shell tool calls (`execute_command` and friends), and `afterTool` compacts verbose shell output with the shared RTK summarizer.

Cline only auto-discovers bundled plugin skills from a single-level `<package-root>/skills/<skill-name>/SKILL.md` layout, while Alux keeps one shared `skills/` tree for all agent platforms. To use the Alux skills with Cline, copy them into your project's `.cline/skills/` directory (recommended, version control friendly):

```bash
git clone https://github.com/TrueNine/alux.git
mkdir -p .cline/skills
cp -R alux/skills/cline-skills/* .cline/skills/
```


