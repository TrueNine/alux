import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import { summarize } from '../post-tool-use/rtk-post-tool-use.ts';
import { rewritePowerShellGetContent } from '../pre-tool-use/powershell-get-content-utf8.ts';
import { preprocessCommand, preprocessCursorCommand, refreshRtkWarningMarker } from '../pre-tool-use/rtk-pre-tool-use.ts';
import { isSafeRtkCommand, normalizeRtkCommand, proxyInvocation, resolveOptimizedCommand } from './rtk.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const preToolUseEntry = join(__dirname, '..', 'pre-tool-use', 'rtk-pre-tool-use.ts');
const postToolUseEntry = join(__dirname, '..', 'post-tool-use', 'rtk-post-tool-use.ts');

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ScenarioState {
  command?: string;
  normalized?: string;
  safe?: boolean;
  rewriteExitCode?: number;
  rewriteOutput?: string;
  rewriteThrows?: boolean;
  rewriteCmd?: string[];
  optimized?: string;
  proxy?: string;
  markerCommand?: string;
  markerPlatform?: string;
  markerLocalAppData?: string;
  markerRefreshed?: boolean;
  powerShellCommand?: string;
  powerShellPlatform?: string;
  powerShellOffsets?: number[];
  powerShellRewritten?: string;
  markerSeen?: string[];
  cursorOptimizeCalls?: number;
  hookTool?: string;
  hookCommand?: string;
  hookLines?: number;
  hookMissingToolName?: boolean;
  platformFlag?: string;
  invalidPayload?: 'pre' | 'post';
  hookResult?: HookResult;
  inspectedPlatform?: string;
  inspectedMatcher?: string;
  inspectedCommand?: string;
  toolOutput?: string;
  summary?: string;
  entrySource?: string;
}

const state: ScenarioState = {};
const temporaryRoots: string[] = [];

Before(() => {
  while (temporaryRoots.length) {
    const root = temporaryRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
  for (const key of Object.keys(state) as (keyof ScenarioState)[]) delete state[key];
});

function createTempDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'alux-rtk-steps-'));
  temporaryRoots.push(root);
  return root;
}

function verboseOutput(lines: number): string {
  return Array.from({ length: lines }, (_, index) => `line ${index} ${'x'.repeat(30)}`).join('\n');
}

// Background

Given('Alux uses the shared RTK rules', () => {
  // Intentional no-op: `hooks/shared/rtk.ts` is imported directly by the steps.
});

// 命令归一化与安全判定

Given('a command {string}', (command: string) => {
  state.command = command;
});

Given('an empty command', () => {
  state.command = '';
});

When('I normalize the RTK command', () => {
  if (state.command === undefined) throw new Error('no command was set');
  state.normalized = normalizeRtkCommand(state.command);
});

Then('the normalized command should be {string}', (expected: string) => {
  if (state.normalized !== expected) throw new Error(`expected normalized ${JSON.stringify(expected)}, got ${JSON.stringify(state.normalized)}`);
});

When('I check whether it is a safe RTK command', () => {
  if (state.command === undefined) throw new Error('no command was set');
  state.safe = isSafeRtkCommand(state.command);
});

Then('the safety result should be true', () => {
  if (state.safe !== true) throw new Error(`expected safe, got ${String(state.safe)}`);
});

Then('the safety result should be false', () => {
  if (state.safe !== false) throw new Error(`expected unsafe, got ${String(state.safe)}`);
});

// 改写与代理

Given('an RTK rewrite stub with exit code {int} and output {string}', (exitCode: number, output: string) => {
  state.rewriteExitCode = exitCode;
  state.rewriteOutput = output;
});

Given('an RTK rewrite stub that throws', () => {
  state.rewriteThrows = true;
});

When('I resolve the optimized command', () => {
  if (state.command === undefined) throw new Error('no command was set');
  if (state.rewriteThrows) {
    state.optimized = resolveOptimizedCommand(state.command, undefined, () => {
      throw new Error('spawn failed');
    });
    return;
  }
  if (state.rewriteExitCode === undefined || state.rewriteOutput === undefined) throw new Error('no rewrite stub was set');
  const exitCode = state.rewriteExitCode;
  const output = state.rewriteOutput;
  state.optimized = resolveOptimizedCommand(state.command, undefined, (options) => {
    state.rewriteCmd = options.cmd;
    return {
      exitCode,
      stdout: new TextEncoder().encode(output),
      stderr: new Uint8Array(),
    };
  });
});

Then('the rewrite invocation should be {string}', (expected: string) => {
  const actual = (state.rewriteCmd ?? []).join(' ');
  if (actual !== expected) throw new Error(`expected rewrite invocation ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
});

Then('the optimized command should be {string}', (expected: string) => {
  if (state.optimized !== expected) throw new Error(`expected optimized ${JSON.stringify(expected)}, got ${JSON.stringify(state.optimized)}`);
});

Then('there should be no optimized command', () => {
  if (state.optimized !== undefined) throw new Error(`expected no optimized command, got ${JSON.stringify(state.optimized)}`);
});

When('I build the proxy invocation', () => {
  if (state.command === undefined) throw new Error('no command was set');
  state.proxy = proxyInvocation(state.command).join(' ');
});

Then('the proxy invocation should be {string}', (expected: string) => {
  if (state.proxy !== expected) throw new Error(`expected proxy ${JSON.stringify(expected)}, got ${JSON.stringify(state.proxy)}`);
});

// PreToolUse：警告标记

Given('a marker check for command {string} on platform {string} with local app data set', (command: string, platform: string) => {
  state.markerCommand = command;
  state.markerPlatform = platform;
  state.markerLocalAppData = createTempDir();
});

Given('a marker check for command {string} on platform {string} with local app data missing', (command: string, platform: string) => {
  state.markerCommand = command;
  state.markerPlatform = platform;
  state.markerLocalAppData = undefined;
});

When('I refresh the RTK warning marker', () => {
  if (state.markerCommand === undefined || state.markerPlatform === undefined) throw new Error('no marker check was set');
  state.markerRefreshed = refreshRtkWarningMarker(state.markerCommand, state.markerPlatform as NodeJS.Platform, state.markerLocalAppData);
});

Then('the marker should be refreshed', () => {
  if (state.markerRefreshed !== true) throw new Error('expected the marker to be refreshed');
  if (!state.markerLocalAppData) throw new Error('no local app data directory was set');
  if (!existsSync(join(state.markerLocalAppData, 'rtk', '.hook_warn_last'))) throw new Error('expected the marker file to exist');
});

Then('the marker should not be refreshed', () => {
  if (state.markerRefreshed !== false) throw new Error('expected the marker to stay untouched');
  if (state.markerLocalAppData && existsSync(join(state.markerLocalAppData, 'rtk', '.hook_warn_last'))) {
    throw new Error('expected no marker file to be created');
  }
});

// PreToolUse：PowerShell 纠偏与预处理

Given('a PowerShell command {string} on platform {string} with offsets {string}', (command: string, platform: string, offsets: string) => {
  state.powerShellCommand = command;
  state.powerShellPlatform = platform;
  state.powerShellOffsets = offsets
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value));
});

Given('a PowerShell command {string} on platform {string} with no offsets', (command: string, platform: string) => {
  state.powerShellCommand = command;
  state.powerShellPlatform = platform;
  state.powerShellOffsets = [];
});

When('I rewrite PowerShell Get-Content', () => {
  if (state.powerShellCommand === undefined || state.powerShellPlatform === undefined || state.powerShellOffsets === undefined) {
    throw new Error('no PowerShell command was set');
  }
  const offsets = state.powerShellOffsets;
  state.powerShellRewritten = rewritePowerShellGetContent(state.powerShellCommand, state.powerShellPlatform as NodeJS.Platform, () => offsets);
});

Then('the rewritten PowerShell command should be {string}', (expected: string) => {
  if (state.powerShellRewritten !== expected) {
    throw new Error(`expected rewritten ${JSON.stringify(expected)}, got ${JSON.stringify(state.powerShellRewritten)}`);
  }
});

Then('the PowerShell command should be unchanged', () => {
  if (state.powerShellRewritten !== undefined) throw new Error(`expected no rewrite, got ${JSON.stringify(state.powerShellRewritten)}`);
});

Then('the rewritten PowerShell command should contain {string}', (expected: string) => {
  if (!state.powerShellRewritten?.includes(expected)) throw new Error(`expected rewrite to contain ${JSON.stringify(expected)}`);
});

Given('a preprocess input {string}', (command: string) => {
  state.command = command;
});

When('I preprocess the command', () => {
  if (state.command === undefined) throw new Error('no command was set');
  state.normalized = preprocessCommand(
    state.command,
    'win32',
    createTempDir(),
    (command) => rewritePowerShellGetContent(command, 'win32', () => [11]),
    (command) => {
      state.markerSeen = [...(state.markerSeen ?? []), command];
      return true;
    },
  );
});

Then('the marker should have seen {string}', (expected: string) => {
  const actual = state.markerSeen?.at(-1);
  if (actual !== expected) throw new Error(`expected marker to see ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
});

Then('the preprocessed command should be {string}', (expected: string) => {
  if (state.normalized !== expected) throw new Error(`expected preprocessed ${JSON.stringify(expected)}, got ${JSON.stringify(state.normalized)}`);
});

Given('a Cursor preprocess input {string}', (command: string) => {
  state.command = command;
});

When('I preprocess the Cursor command', () => {
  if (state.command === undefined) throw new Error('no command was set');
  const stubOutput = state.rewriteOutput;
  state.cursorOptimizeCalls = 0;
  const calls = state;
  const rewritten = preprocessCursorCommand(
    state.command,
    undefined,
    'linux',
    createTempDir(),
    () => undefined,
    (command) => {
      state.markerSeen = [...(state.markerSeen ?? []), command];
      return true;
    },
    () => {
      calls.cursorOptimizeCalls = (calls.cursorOptimizeCalls ?? 0) + 1;
      return stubOutput || undefined;
    },
  );
  state.normalized = rewritten;
});

Then('the Cursor command should fall back to the PowerShell rewrite result', () => {
  if (state.normalized !== undefined) throw new Error(`expected no Cursor rewrite, got ${JSON.stringify(state.normalized)}`);
  if (state.cursorOptimizeCalls !== 0) throw new Error('expected RTK optimization to be skipped for unsafe commands');
});

// 钩子入口调用

function runHook(entry: string, flag: string | undefined, stdinText: string): HookResult {
  const result = spawnSync('bun', flag ? [entry, flag] : [entry], {
    input: stdinText,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    exitCode: result.status ?? 0,
    stdout: new TextDecoder().decode(result.stdout ?? new Uint8Array()),
    stderr: new TextDecoder().decode(result.stderr ?? new Uint8Array()),
  };
}

Given('a PreToolUse payload for tool {string} with command {string}', (tool: string, command: string) => {
  state.hookTool = tool;
  state.hookCommand = command;
});

Given('an invalid PreToolUse payload', () => {
  state.invalidPayload = 'pre';
});

Given('a platform flag {string}', (flag: string) => {
  state.platformFlag = flag;
});

Given('no platform flag', () => {
  state.platformFlag = undefined;
});

When('I invoke the PreToolUse entrypoint', () => {
  const stdinText = state.invalidPayload === 'pre' ? 'not json' : JSON.stringify({ tool_name: state.hookTool, tool_input: { command: state.hookCommand } });
  state.hookResult = runHook(preToolUseEntry, state.platformFlag, stdinText);
});

Then('the PreToolUse result should be silent', () => {
  const result = state.hookResult;
  if (!result) throw new Error('no PreToolUse result was captured');
  if (result.exitCode !== 0 || result.stdout !== '') throw new Error(`expected a silent result, got exit=${result.exitCode} stdout=${JSON.stringify(result.stdout)}`);
});

// 钩子配置

Given('the hook configuration for {string}', (platform: string) => {
  state.inspectedPlatform = platform;
});

function readHookEntry(platform: string, kind: 'pre' | 'post'): { matcher: string; command: string } {
  const file = join(__dirname, '..', platform === 'cursor' ? 'hooks.cursor.json' : platform === 'claude' ? 'hooks.claude.json' : 'hooks.codex.json');
  const config = JSON.parse(readFileSync(file, 'utf8')) as {
    hooks: Record<string, Array<{ matcher?: string; command?: string; hooks?: Array<{ command: string }> }>>;
  };
  if (platform === 'cursor') {
    const group = config.hooks[kind === 'pre' ? 'preToolUse' : 'postToolUse']?.[0];
    if (!group?.matcher || !group.command) throw new Error(`missing cursor ${kind} hook configuration`);
    return { matcher: group.matcher, command: group.command };
  }
  const group = config.hooks[kind === 'pre' ? 'PreToolUse' : 'PostToolUse']?.[0];
  const command = group?.hooks?.[0]?.command;
  if (!group?.matcher || !command) throw new Error(`missing ${platform} ${kind} hook configuration`);
  return { matcher: group.matcher, command };
}

When('I inspect the PreToolUse hook', () => {
  if (!state.inspectedPlatform) throw new Error('no hook configuration was selected');
  const entry = readHookEntry(state.inspectedPlatform, 'pre');
  state.inspectedMatcher = entry.matcher;
  state.inspectedCommand = entry.command;
});

Then('the PreToolUse matcher should be {string}', (expected: string) => {
  if (state.inspectedMatcher !== expected) throw new Error(`expected PreToolUse matcher ${JSON.stringify(expected)}, got ${JSON.stringify(state.inspectedMatcher)}`);
});

Then('the PreToolUse command should contain {string}', (expected: string) => {
  if (!state.inspectedCommand?.includes(expected)) throw new Error(`expected PreToolUse command to contain ${JSON.stringify(expected)}`);
});

When('I inspect the PostToolUse hook', () => {
  if (!state.inspectedPlatform) throw new Error('no hook configuration was selected');
  const entry = readHookEntry(state.inspectedPlatform, 'post');
  state.inspectedMatcher = entry.matcher;
  state.inspectedCommand = entry.command;
});

Then('the PostToolUse matcher should be {string}', (expected: string) => {
  if (state.inspectedMatcher !== expected) throw new Error(`expected PostToolUse matcher ${JSON.stringify(expected)}, got ${JSON.stringify(state.inspectedMatcher)}`);
});

Then('the PostToolUse command should contain {string}', (expected: string) => {
  if (!state.inspectedCommand?.includes(expected)) throw new Error(`expected PostToolUse command to contain ${JSON.stringify(expected)}`);
});

// PostToolUse：摘要

Given('a short tool output {string}', (output: string) => {
  state.toolOutput = output;
});

Given('a verbose tool output with {int} lines', (lines: number) => {
  state.toolOutput = verboseOutput(lines);
});

Given('a verbose tool output with one 1000-character line repeated {int} times', (times: number) => {
  state.toolOutput = Array.from({ length: times }, () => 'z'.repeat(1000)).join('\n');
});

When('I summarize the tool output', () => {
  if (state.toolOutput === undefined) throw new Error('no tool output was set');
  state.summary = summarize(state.toolOutput);
});

Then('there should be no summary', () => {
  if (state.summary !== undefined) throw new Error(`expected no summary, got ${JSON.stringify(state.summary)}`);
});

Then('the summary should contain {string}', (expected: string) => {
  if (!state.summary?.includes(expected)) throw new Error(`expected summary to contain ${JSON.stringify(expected)}`);
});

Then('the summary should not contain {string}', (unexpected: string) => {
  if (state.summary?.includes(unexpected)) throw new Error(`expected summary to omit ${JSON.stringify(unexpected)}`);
});

Then('the summary lines should be at most {int} characters', (maxLength: number) => {
  if (state.summary === undefined) throw new Error('no summary was produced');
  for (const line of state.summary.split('\n')) {
    if (line.length > maxLength) throw new Error(`summary line exceeds ${maxLength} characters`);
  }
});

// PostToolUse：入口调用

Given('a PostToolUse payload for tool {string} with {int} lines of output', (tool: string, lines: number) => {
  state.hookTool = tool;
  state.hookLines = lines;
});

Given('a PostToolUse payload without a tool name and with {int} lines of output', (lines: number) => {
  state.hookTool = undefined;
  state.hookMissingToolName = true;
  state.hookLines = lines;
});

Given('an invalid PostToolUse payload', () => {
  state.invalidPayload = 'post';
});

function postToolUsePayload(): string {
  if (state.invalidPayload === 'post') return 'not json';
  const output = verboseOutput(state.hookLines ?? 100);
  if (state.hookTool === 'Shell') {
    return JSON.stringify({
      tool_name: 'Shell',
      tool_input: { command: 'bun test' },
      tool_output: JSON.stringify({ exitCode: 0, stdout: output, stderr: '' }),
    });
  }
  const payload: Record<string, unknown> = {
    tool_input: { command: 'bun test' },
    tool_response: { output, exit_code: 0 },
  };
  if (!state.hookMissingToolName) payload.tool_name = state.hookTool;
  return JSON.stringify(payload);
}

When('I invoke the PostToolUse entrypoint', () => {
  state.hookResult = runHook(postToolUseEntry, state.platformFlag, postToolUsePayload());
});

Then('the PostToolUse result should be silent', () => {
  const result = state.hookResult;
  if (!result) throw new Error('no PostToolUse result was captured');
  if (result.exitCode !== 0 || result.stdout !== '' || result.stderr !== '') {
    throw new Error(`expected a silent result, got exit=${result.exitCode} stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}`);
  }
});

Then('the PostToolUse exit code should be {int}', (expected: number) => {
  if (state.hookResult?.exitCode !== expected) throw new Error(`expected exit code ${expected}, got ${state.hookResult?.exitCode}`);
});

Then('the PostToolUse stderr should contain {string}', (expected: string) => {
  if (!state.hookResult?.stderr.includes(expected)) throw new Error(`expected stderr to contain ${JSON.stringify(expected)}`);
});

Then('the PostToolUse stdout should contain {string}', (expected: string) => {
  if (!state.hookResult?.stdout.includes(expected)) throw new Error(`expected stdout to contain ${JSON.stringify(expected)}`);
});

// PostToolUse：实现约束

Given('the PostToolUse entrypoint source', () => {
  state.entrySource = readFileSync(postToolUseEntry, 'utf8');
});

When('I inspect the implementation dependencies', () => {
  if (state.entrySource === undefined) throw new Error('no entrypoint source was loaded');
});

Then('the source should not contain {string}', (unexpected: string) => {
  if (state.entrySource?.includes(unexpected)) throw new Error(`expected source to omit ${JSON.stringify(unexpected)}`);
});

When('I inspect the implementation provenance', () => {
  if (state.entrySource === undefined) throw new Error('no entrypoint source was loaded');
});

Then('the source should contain {string}', (expected: string) => {
  if (!state.entrySource?.includes(expected)) throw new Error(`expected source to contain ${JSON.stringify(expected)}`);
});
