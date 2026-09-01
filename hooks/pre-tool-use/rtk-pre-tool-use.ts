#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSafeRtkCommand, resolveOptimizedCommand } from '../shared/rtk';
import { rewritePowerShellGetContent } from './powershell-get-content-utf8';
import '../shared/log';

type JsonObject = Record<string, unknown>;
type HookPlatform = 'claude' | 'codex' | 'cursor' | 'cline';
const platform: HookPlatform | undefined = process.argv.includes('--claude')
  ? 'claude'
  : process.argv.includes('--codex')
    ? 'codex'
    : process.argv.includes('--cursor')
      ? 'cursor'
      : process.argv.includes('--cline')
        ? 'cline'
        : undefined;
const clineShellTools = new Set(['Bash', 'shell', 'exec', 'exec_command', 'unified_exec', 'execute_command', 'write_stdin']);
type CommandRewriter = (command: string, platform?: NodeJS.Platform) => string | undefined;
type MarkerRefresher = (command: string, platform?: NodeJS.Platform, localAppData?: string) => boolean;
type CommandOptimizer = (command: string, cwd?: string) => string | undefined;

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function commandFrom(input?: JsonObject): string | undefined {
  for (const key of ['command', 'cmd']) {
    const value = input?.[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
}

export function refreshRtkWarningMarker(command: string, platform: NodeJS.Platform = process.platform, localAppData = process.env.LOCALAPPDATA): boolean {
  if (platform !== 'win32' || !localAppData || !/^rtk(?:\.exe)?(?:\s|$)/i.test(command.trim())) return false;

  try {
    const dataDirectory = join(localAppData, 'rtk');
    mkdirSync(dataDirectory, { recursive: true });
    writeFileSync(join(dataDirectory, '.hook_warn_last'), '');
    return true;
  } catch {
    return false;
  }
}

export function preprocessCommand(
  command: string,
  platform: NodeJS.Platform = process.platform,
  localAppData = process.env.LOCALAPPDATA,
  rewrite: CommandRewriter = rewritePowerShellGetContent,
  refreshMarker: MarkerRefresher = refreshRtkWarningMarker,
): string | undefined {
  const rewritten = rewrite(command, platform);
  refreshMarker(rewritten ?? command, platform, localAppData);
  return rewritten;
}

export function preprocessCursorCommand(
  command: string,
  cwd?: string,
  platform: NodeJS.Platform = process.platform,
  localAppData = process.env.LOCALAPPDATA,
  rewrite: CommandRewriter = rewritePowerShellGetContent,
  refreshMarker: MarkerRefresher = refreshRtkWarningMarker,
  optimize: CommandOptimizer = resolveOptimizedCommand,
): string | undefined {
  const rewritten = rewrite(command, platform);
  const candidate = rewritten ?? command;
  const optimized = isSafeRtkCommand(candidate) ? optimize(candidate, cwd) : undefined;
  const processed = optimized ?? rewritten;
  refreshMarker(processed ?? candidate, platform, localAppData);
  return processed;
}

async function main(): Promise<void> {
  try {
    const payload = JSON.parse(new TextDecoder().decode(await Bun.stdin.arrayBuffer())) as JsonObject;
    const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : typeof payload.toolName === 'string' ? payload.toolName : '';
    if (
      !platform ||
      (platform === 'claude'
        ? toolName !== 'Bash'
        : platform === 'cursor'
          ? toolName !== 'Shell'
          : platform === 'cline'
            ? !clineShellTools.has(toolName)
            : !['Bash', 'exec', 'exec_command', 'unified_exec'].includes(toolName))
    )
      return;
    const input = asObject(payload.tool_input) ?? asObject(payload.toolInput);
    const command = commandFrom(input);
    if (!command) return;
    const cwd = typeof input?.working_directory === 'string' ? input.working_directory : typeof input?.workdir === 'string' ? input.workdir : typeof payload.cwd === 'string' ? payload.cwd : undefined;
    const rewritten = platform === 'cursor' ? preprocessCursorCommand(command, cwd) : preprocessCommand(command);
    if (!rewritten) return;
    if (platform === 'cursor') {
      process.stdout.write(
        `${JSON.stringify({
          permission: 'allow',
          updated_input: { ...input, command: rewritten },
        })}\n`,
      );
      return;
    }
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          updatedInput: { ...input, command: rewritten },
        },
      })}\n`,
    );
  } catch {
    return;
  }
}

if (import.meta.main) await main();
