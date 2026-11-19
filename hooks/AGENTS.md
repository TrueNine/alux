<!-- BEGIN:hooks/AGENTS.md -->

# hooks/AGENTS.md

This directory contains per-platform hook entrypoints (`pre-tool-use/`, `post-tool-use/`, `session-start/`), shared rules (`shared/`), and per-platform hook configuration manifests (`hooks.<platform>.json`).

## Codex Hook Registration

- Treat `~/.codex/hooks.json` and the loose scripts under `~/.codex/hooks/` as stale leftovers, never as live configuration. They date from 2026-08-26, keep matcher entries with empty hook arrays, and are not loaded by Codex (verified on 0.169.1). Editing them has no effect, and diagnosing them leads to the wrong conclusion that "hooks are not registered".
- The real registration chain is: the plugin manifest declares `"hooks": "./hooks/hooks.codex.json"` in `.codex-plugin/plugin.json`, Codex installs a copy into the plugin cache (`~/.codex/plugins/cache/alux/alux/<version>/hooks/hooks.codex.json`, commands carry `${PLUGIN_ROOT}`), and trust is recorded per hook in `~/.codex/config.toml` under `[hooks.state."alux@alux:hooks/hooks.codex.json:<event>:<index>:<index>"]` with `trusted_hash` and `trusted_content_hash` (sha256). A missing trust entry or a hash mismatch makes Codex ask for re-trust.

## Verifying Hook Behavior

- To answer "is the hook registered", inspect the plugin cache copy of `hooks.codex.json` and the `hooks.state` entries in `~/.codex/config.toml`; never inspect `~/.codex/hooks.json`.
- To answer "does the hook run", query the Codex sqlite log instead of rollout files (session `*.jsonl` does not record hook events):

  ```bash
  bun -e "const {Database}=require('bun:sqlite');const db=new Database('C:/Users/truen/.codex/logs_2.sqlite',{readonly:true});db.query(\"SELECT ts,target,feedback_log_body FROM logs WHERE feedback_log_body LIKE '%hook/started%' ORDER BY id DESC LIMIT 5\").all().forEach(r=>console.log(r.ts,r.target,String(r.feedback_log_body).slice(0,160)))"
  ```

- Remember that trigger rate is not rewrite rate. Codex desktop routes shell calls through the JS harness `exec` custom tool whose `tool_input` is a JS source string (nested `tools.exec_command({cmd:...})`, often batched via `Promise.allSettled`), so command extraction that expects a `{command|cmd}` object fails silently and the commands escape the rewrite. Subagents share the 相同 harness. Protocol authority: https://learn.chatgpt.com/docs/hooks (hooks are beta since Codex CLI 0.117.0; re-verify the semantics after every Codex upgrade).

<!-- END:hooks/AGENTS.md -->
