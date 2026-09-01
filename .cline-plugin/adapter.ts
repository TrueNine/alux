/**
 * Adapter glue between Cline SDK lifecycle hooks and the shared Alux hook
 * implementations under `hooks/`. Kept free of `@cline/sdk` imports so it can
 * be unit tested and reused without the host runtime.
 */

import { summarize, text } from '../hooks/post-tool-use/rtk-post-tool-use';
import { preprocessCommand } from '../hooks/pre-tool-use/rtk-pre-tool-use';
import { synchronizeAgentInstructions } from '../hooks/session-start/sync-agent-instructions';

type JsonObject = Record<string, unknown>;
type CommandRewriter = (command: string, platform?: NodeJS.Platform) => string | undefined;

const shellTools = new Set(['Bash', 'shell', 'exec', 'exec_command', 'unified_exec', 'execute_command', 'write_stdin']);

export function isShellTool(toolName: string): boolean {
  return shellTools.has(toolName);
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function commandFrom(input?: JsonObject): string | undefined {
  for (const key of ['command', 'cmd']) {
    const value = input?.[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
}

export type BeforeToolRewrite = { input: JsonObject };

/**
 * Rewrites the command of a shell tool call (PowerShell UTF-8 preprocessing).
 * Returns `undefined` when the call must pass through untouched.
 */
export function rewriteBeforeToolInput(toolName: string, input: unknown, rewrite: CommandRewriter = preprocessCommand, platform: NodeJS.Platform = process.platform): BeforeToolRewrite | undefined {
  if (!isShellTool(toolName)) return;
  const source = asObject(input);
  const command = commandFrom(source);
  if (!command) return;
  const rewritten = rewrite(command, platform);
  if (!rewritten || rewritten === command) return;
  return { input: { ...source, command: rewritten } };
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

/** Synchronizes derived instruction files for the workspace hosting the session. */
export function synchronizeWorkspaceInstructions(root?: string): void {
  synchronizeAgentInstructions(root ?? process.cwd());
}
