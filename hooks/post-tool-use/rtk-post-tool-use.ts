#!/usr/bin/env bun
// GitHub: https://github.com/rtk-ai/rtk
// Documentation: https://github.com/rtk-ai/rtk/blob/develop/hooks/README.md
import { isSafeRtkCommand, normalizeRtkCommand, proxyInvocation, resolveOptimizedCommand } from '../shared/rtk';
import '../shared/log';

export { proxyInvocation, resolveOptimizedCommand } from '../shared/rtk';

const shellTools = new Set(['Bash', 'shell', 'exec', 'exec_command', 'unified_exec', 'write_stdin']);
type JsonObject = Record<string, unknown>;
type HookPlatform = 'claude' | 'codex' | 'cursor';
const platform: HookPlatform | undefined = process.argv.includes('--claude') ? 'claude' : process.argv.includes('--codex') ? 'codex' : process.argv.includes('--cursor') ? 'cursor' : undefined;
function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n');
  const object = asObject(value);
  if (!object) return '';
  for (const key of ['aggregated_output', 'output', 'text', 'stdout', 'stderr', 'message']) {
    const result = text(object[key]);
    if (result) return result;
  }
  return '';
}

function originalOutput(response?: JsonObject): string {
  if (!response) return '';
  for (const key of ['aggregated_output', 'output', 'text']) {
    const result = text(response[key]);
    if (result) return result;
  }
  return [text(response.stdout), text(response.stderr)].filter(Boolean).join('\n');
}

function commandFrom(input?: JsonObject): string | undefined {
  for (const key of ['command', 'cmd']) {
    const value = input?.[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
}

function summarize(output: string): string | undefined {
  if (output.length < 500) return;
  const lines = output.split('\n').filter(Boolean);
  const retained = [...lines.slice(0, 35), '... omitted verbose output ...', ...lines.slice(-35)];
  return `Output summary (${lines.length} lines)\n${retained.map((line) => line.slice(0, 320)).join('\n')}`;
}

function emitProcessedOutput(value: string): never {
  if (platform === 'cursor') {
    process.stdout.write(`${JSON.stringify({ additional_context: value })}\n`);
    process.exit(0);
  }
  process.stderr.write(`${value}\n`);
  process.exit(2);
}

function execute(command: string, cwd?: string): void {
  const rewritten = resolveOptimizedCommand(command, cwd);
  if (!rewritten) return;
  try {
    const result = Bun.spawnSync({
      cmd: proxyInvocation(rewritten),
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const output = `${new TextDecoder().decode(result.stdout)}${new TextDecoder().decode(result.stderr)}`.trim();
    if (output) emitProcessedOutput(output);
  } catch {
    return;
  }
}

function parseCursorToolOutput(value: unknown): JsonObject | undefined {
  if (typeof value !== 'string') return asObject(value);
  try {
    return asObject(JSON.parse(value));
  } catch {
    return { output: value };
  }
}

async function main(): Promise<void> {
  let payload: JsonObject;
  try {
    payload = JSON.parse(new TextDecoder().decode(await Bun.stdin.arrayBuffer())) as JsonObject;
  } catch {
    return;
  }

  const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : typeof payload.toolName === 'string' ? payload.toolName : '';
  if (!platform || !toolName || (platform === 'claude' ? toolName !== 'Bash' : platform === 'cursor' ? toolName !== 'Shell' : !shellTools.has(toolName))) return;
  const input = asObject(payload.tool_input) ?? asObject(payload.toolInput);
  const response =
    (platform === 'cursor' ? parseCursorToolOutput(payload.tool_output ?? payload.toolOutput) : undefined) ??
    asObject(payload.tool_response) ??
    asObject(payload.toolResponse) ??
    asObject(payload.response);
  const output = originalOutput(response);
  const summary = summarize(output);
  if (summary) emitProcessedOutput(summary);
  if (platform === 'cursor') return;
  const command = commandFrom(input);
  if (!command || !isSafeRtkCommand(command)) return;
  const exitCode = response?.exit_code ?? response?.exitCode;
  if (typeof exitCode === 'number' && exitCode !== 0) return;
  const cwd = typeof input?.workdir === 'string' ? input.workdir : typeof payload.cwd === 'string' ? payload.cwd : undefined;
  execute(normalizeRtkCommand(command), cwd);
}

if (import.meta.main) await main();
