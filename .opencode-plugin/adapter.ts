/**
 * Adapter glue between the OpenCode V2 plugin lifecycle and the shared Alux hook
 * implementations under `hooks/`. Kept free of `@opencode/plugin` imports so it
 * can be unit tested and reused without the host runtime.
 */

import { spawnSync as nodeSpawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarize, text } from '../hooks/post-tool-use/rtk-post-tool-use';
import { preprocessCommand } from '../hooks/pre-tool-use/rtk-pre-tool-use';
import { synchronizeAgentInstructions } from '../hooks/session-start/sync-agent-instructions';
import { isSafeRtkCommand, normalizeRtkCommand, proxyInvocation, resolveOptimizedCommand } from '../hooks/shared/rtk.ts';

/** OpenCode tool that executes shell commands. Aliases from other harnesses are accepted for safety. */
const shellTools = new Set(['bash', 'Bash', 'shell', 'exec', 'exec_command', 'unified_exec', 'execute_command', 'write_stdin']);

export function isShellTool(toolName: string): boolean {
  return shellTools.has(toolName);
}

type JsonObject = Record<string, unknown>;
type CommandRewriter = (command: string) => string | undefined;

const commandKeys = ['command', 'cmd', 'script'] as const;

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function commandEntry(args?: JsonObject): { key: (typeof commandKeys)[number]; command: string } | undefined {
  if (!args) return;
  for (const key of commandKeys) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) return { key, command: value };
  }
}

function commandCwd(args?: JsonObject): string | undefined {
  for (const key of ['cwd', 'workdir', 'working_directory']) {
    const value = args?.[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
}

export type BeforeToolRewrite = { args: JsonObject };

/**
 * Rewrites the command of a shell tool call (PowerShell UTF-8 preprocessing and RTK rewrite).
 * Returns `undefined` when the call must pass through untouched.
 */
export function rewriteBeforeToolInput(toolName: string, args: unknown, rewrite?: CommandRewriter, platform: NodeJS.Platform = process.platform): BeforeToolRewrite | undefined {
  if (!isShellTool(toolName)) return;
  const source = asObject(args);
  const entry = commandEntry(source);
  if (!source || !entry) return;
  const rewritten = (rewrite ?? ((command: string) => preprocessCommand(command, commandCwd(source), platform)))(entry.command);
  if (!rewritten || rewritten === entry.command) return;
  return { args: { ...source, [entry.key]: rewritten } };
}

export type AfterToolCompaction = { output: string };

/**
 * Compacts verbose shell tool output with the shared RTK summarizer.
 * Returns `undefined` when the original output should be preserved.
 */
export function compactAfterToolOutput(toolName: string, output: unknown): AfterToolCompaction | undefined {
  if (!isShellTool(toolName)) return;
  const summary = summarize(text(output));
  if (!summary) return;
  return { output: summary };
}

type SpawnSync = (options: { cmd: string[]; cwd?: string; stdout: 'pipe'; stderr: 'pipe' }) => { exitCode: number; stdout: Uint8Array; stderr: Uint8Array };

const proxySpawn: SpawnSync = ({ cmd, cwd }) => {
  const result = nodeSpawnSync(cmd[0] ?? 'rtk', cmd.slice(1), { cwd, encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] });
  return { exitCode: result.status ?? 1, stdout: result.stdout ?? new Uint8Array(), stderr: result.stderr ?? new Uint8Array() };
};

function exitCodeOf(output: unknown): number | undefined {
  const object = asObject(output);
  const code = object?.exit_code ?? object?.exitCode;
  return typeof code === 'number' ? code : undefined;
}

/**
 * Replays a safe read-only shell command through `rtk proxy`.
 * Matches the shared PostToolUse hook: only a successful `rtk rewrite` is replayed, and a non-zero tool exit is left alone.
 */
export function replayAfterToolOutput(toolName: string, input: unknown, output: unknown, spawn?: SpawnSync): AfterToolCompaction | undefined {
  if (!isShellTool(toolName)) return;
  const source = asObject(input);
  const entry = commandEntry(source);
  if (!source || !entry || !isSafeRtkCommand(entry.command)) return;
  const exitCode = exitCodeOf(output);
  if (typeof exitCode === 'number' && exitCode !== 0) return;

  const cwd = commandCwd(source);
  const command = normalizeRtkCommand(entry.command);
  try {
    const rewritten = resolveOptimizedCommand(command, cwd, spawn);
    if (!rewritten) return;
    const result = (spawn ?? proxySpawn)({ cmd: proxyInvocation(rewritten), cwd, stdout: 'pipe', stderr: 'pipe' });
    const proxied = `${new TextDecoder().decode(result.stdout)}${new TextDecoder().decode(result.stderr)}`.trim();
    if (!proxied) return;
    return { output: proxied };
  } catch {
    return;
  }
}

/** Synchronizes derived instruction files for the workspace hosting the session. */
export function synchronizeWorkspaceInstructions(root?: string): void {
  synchronizeAgentInstructions(root ?? process.cwd());
}

export type OpenCodeMcpServer = {
  type: 'local';
  command: string[];
  disabled?: boolean;
  codemode?: boolean;
};

export type OpenCodeSkillDefinition = {
  id: string;
  name: string;
  description?: string;
  autoinvoke?: boolean;
  path: string;
  content: string;
};

function frontmatterBlock(document: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(document);
  if (!match) return { frontmatter: '', body: document };
  return { frontmatter: match[1] ?? '', body: document.slice(match[0].length) };
}

function frontmatterField(frontmatter: string, field: string): string | undefined {
  const match = new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'm').exec(frontmatter);
  const value = match?.[1]?.trim();
  if (!value) return;
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.at(-1) === quote) return value.slice(1, -1).trim();
  return value;
}

/** Reads the V2 MCP catalog shipped with the plugin. Missing or invalid files yield no servers. */
export function loadMcpServers(root: string, relativePath = 'mcps/.mcp.opencode.json'): Record<string, OpenCodeMcpServer> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
  } catch {
    return {};
  }
  const servers = (parsed as { mcp?: { servers?: Record<string, { type?: unknown; command?: unknown; disabled?: unknown; codemode?: unknown }> } }).mcp?.servers;
  if (!servers) return {};

  const loaded: Record<string, OpenCodeMcpServer> = {};
  for (const [name, server] of Object.entries(servers)) {
    if (server.type !== 'local' || !Array.isArray(server.command) || server.command.some((part) => typeof part !== 'string')) continue;
    loaded[name] = {
      type: 'local',
      command: server.command,
      ...(typeof server.disabled === 'boolean' ? { disabled: server.disabled } : {}),
      ...(typeof server.codemode === 'boolean' ? { codemode: server.codemode } : {}),
    };
  }
  return loaded;
}

/**
 * Loads packaged skills for registration through the V2 skill transform.
 * OpenCode does not read the old plugin.json `skills` path, so the server
 * plugin has to contribute these definitions itself.
 */
export function loadSkillDefinitions(root: string, relativePath = 'skills/opencode-skills'): OpenCodeSkillDefinition[] {
  const skillsRoot = resolve(root, relativePath);
  let entries: string[];
  try {
    entries = readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const skills: OpenCodeSkillDefinition[] = [];
  for (const id of entries) {
    let document: string;
    const skillPath = resolve(skillsRoot, id, 'SKILL.md');
    try {
      document = readFileSync(skillPath, 'utf8');
    } catch {
      continue;
    }
    const { frontmatter, body } = frontmatterBlock(document);
    const description = frontmatterField(frontmatter, 'description');
    const disabled = frontmatterField(frontmatter, 'disable-model-invocation');
    skills.push({
      id,
      name: frontmatterField(frontmatter, 'name') || id,
      ...(description ? { description } : {}),
      ...(disabled === 'true' ? { autoinvoke: false } : {}),
      path: skillPath,
      content: body.trim() ? body : document,
    });
  }
  return skills.sort((left, right) => left.id.localeCompare(right.id));
}
