import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { proxyInvocation, resolveOptimizedCommand, summarize } from './rtk-post-tool-use';

const __dirname = dirname(fileURLToPath(import.meta.url));

const hooksDirectory = join(__dirname, '..');
const entrypoint = join(__dirname, 'rtk-post-tool-use.ts');

function invokeEntrypoint(payload: unknown) {
  return spawnSync('bun', [entrypoint, '--claude'], {
    input: JSON.stringify(payload),
  });
}

function verboseOutput(): string {
  return Array.from({ length: 100 }, (_, index) => `line ${index} ${'x'.repeat(30)}`).join('\n');
}

test('PostToolUse invokes the Bun TypeScript entrypoint', () => {
  const configuration = JSON.parse(readFileSync(join(hooksDirectory, 'hooks.codex.json'), 'utf8'));
  const group = configuration.hooks.PostToolUse[0];

  expect(group).toEqual({
    matcher: '^(Bash|exec|exec_command|unified_exec)$',
    hooks: [
      {
        type: 'command',
        command: `bun "\${PLUGIN_ROOT}/hooks/post-tool-use/rtk-post-tool-use.ts" --codex`,
        statusMessage: 'RTK output compaction',
      },
    ],
  });
});

test('Claude omits the PostToolUse hook (append-only protocol)', () => {
  const configuration = JSON.parse(readFileSync(join(hooksDirectory, 'hooks.claude.json'), 'utf8'));

  expect(configuration.hooks.PostToolUse).toBeUndefined();
});

test('Cursor omits the PostToolUse hook (additional context is append-only)', () => {
  const configuration = JSON.parse(readFileSync(join(hooksDirectory, 'hooks.cursor.json'), 'utf8'));

  expect(configuration.version).toBe(1);
  expect(configuration.hooks.preToolUse).toEqual([
    {
      command: `bun "\${CURSOR_PLUGIN_ROOT}/hooks/pre-tool-use/rtk-pre-tool-use.ts" --cursor`,
      matcher: '^Shell$',
    },
  ]);
  expect(configuration.hooks.postToolUse).toBeUndefined();
});

test('ZCode omits the PostToolUse hook (append-only protocol)', () => {
  const configuration = JSON.parse(readFileSync(join(hooksDirectory, 'hooks.zcode.json'), 'utf8'));

  expect(configuration.hooks.PostToolUse).toBeUndefined();
});

test('CodeBuddy PostToolUse reuses the Claude-compatible Bash protocol', () => {
  const configuration = JSON.parse(readFileSync(join(hooksDirectory, 'hooks.codebuddy.json'), 'utf8'));
  const group = configuration.hooks.PostToolUse[0];

  expect(group).toEqual({
    matcher: '^Bash$',
    hooks: [
      {
        type: 'command',
        command: `bun "\${CODEBUDDY_PLUGIN_ROOT}/hooks/post-tool-use/rtk-post-tool-use.ts" --codebuddy`,
        statusMessage: 'RTK output compaction',
      },
    ],
  });
});

test('Grok omits the PostToolUse hook (passive event, stdout ignored)', () => {
  const configuration = JSON.parse(readFileSync(join(hooksDirectory, 'hooks.grok.json'), 'utf8'));

  expect(configuration.hooks.PostToolUse).toBeUndefined();
});

test('TypeScript entrypoint preserves a no-op hook result', () => {
  const result = spawnSync('bun', [entrypoint], {
    input: 'not json',
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('Claude entrypoint stays silent on verbose Bash output (append-only protocol)', () => {
  const payload = {
    tool_name: 'Bash',
    tool_input: { command: 'bun test' },
    tool_response: {
      output: verboseOutput(),
      exit_code: 0,
    },
  };
  const result = invokeEntrypoint(payload);

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('Cursor entrypoint stays silent on verbose Shell output (append-only protocol)', () => {
  const result = spawnSync('bun', [entrypoint, '--cursor'], {
    input: JSON.stringify({
      tool_name: 'Shell',
      tool_input: { command: 'bun test' },
      tool_output: JSON.stringify({
        exitCode: 0,
        stdout: verboseOutput(),
        stderr: '',
      }),
    }),
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('Codex entrypoint retains exec tool support', () => {
  const result = spawnSync('bun', [entrypoint, '--codex'], {
    input: JSON.stringify({
      tool_name: 'exec',
      tool_response: { output: verboseOutput() },
    }),
  });

  expect(result.status).toBe(2);
  expect(new TextDecoder().decode(result.stderr)).toContain('Output summary (100 lines)');
});

test('ZCode entrypoint stays silent on verbose Bash output (append-only protocol)', () => {
  const result = spawnSync('bun', [entrypoint, '--zcode'], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'bun test' },
      tool_response: {
        output: verboseOutput(),
        exit_code: 0,
      },
    }),
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('CodeBuddy entrypoint replaces verbose Bash output', () => {
  const result = spawnSync('bun', [entrypoint, '--codebuddy'], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'bun test' },
      tool_response: {
        output: verboseOutput(),
        exit_code: 0,
      },
    }),
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stderr)).toBe('');
  const output = JSON.parse(new TextDecoder().decode(result.stdout));
  expect(output.hookSpecificOutput.hookEventName).toBe('PostToolUse');
  expect(output.hookSpecificOutput.updatedToolOutput).toContain('Output summary (100 lines)');
  expect(output.hookSpecificOutput.updatedToolOutput).toContain('... omitted verbose output ...');
  expect(output.hookSpecificOutput.updatedToolOutput).not.toContain('line 50');
});

test('Qoder entrypoint replaces verbose Bash output', () => {
  const result = spawnSync('bun', [entrypoint, '--qoder'], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'bun test' },
      tool_response: {
        output: verboseOutput(),
        exit_code: 0,
      },
    }),
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stderr)).toBe('');
  const output = JSON.parse(new TextDecoder().decode(result.stdout));
  expect(output.hookSpecificOutput.hookEventName).toBe('PostToolUse');
  expect(output.hookSpecificOutput.updatedToolOutput).toContain('Output summary (100 lines)');
  expect(output.hookSpecificOutput.updatedToolOutput).toContain('... omitted verbose output ...');
  expect(output.hookSpecificOutput.updatedToolOutput).not.toContain('line 50');
});

test('Copilot entrypoint replaces verbose bash output', () => {
  const result = spawnSync('bun', [entrypoint, '--copilot'], {
    input: JSON.stringify({
      toolName: 'bash',
      toolArgs: { command: 'bun test' },
      toolResult: {
        resultType: 'success',
        textResultForLlm: verboseOutput(),
      },
    }),
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stderr)).toBe('');
  const output = JSON.parse(new TextDecoder().decode(result.stdout));
  expect(output.modifiedResult.resultType).toBe('success');
  expect(output.modifiedResult.textResultForLlm).toContain('Output summary (100 lines)');
  expect(output.modifiedResult.textResultForLlm).toContain('... omitted verbose output ...');
  expect(output.modifiedResult.textResultForLlm).not.toContain('line 50');
});

test('Copilot entrypoint ignores non-shell tools', () => {
  const result = spawnSync('bun', [entrypoint, '--copilot'], {
    input: JSON.stringify({
      toolName: 'edit',
      toolArgs: { command: 'bun test' },
      toolResult: {
        resultType: 'success',
        textResultForLlm: verboseOutput(),
      },
    }),
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('Grok entrypoint stays silent on verbose run_terminal_command output (passive event)', () => {
  const result = spawnSync('bun', [entrypoint, '--grok'], {
    input: JSON.stringify({
      toolName: 'run_terminal_command',
      toolInput: { command: 'bun test' },
      toolResult: {
        type: 'Bash',
        command: 'bun test',
        exit_code: 0,
        output_for_prompt: verboseOutput(),
      },
    }),
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('entrypoint without a platform mode is a no-op', () => {
  const result = spawnSync('bun', [entrypoint], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_response: { output: verboseOutput() },
    }),
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('TypeScript entrypoint never summarizes verbose Read output', () => {
  const result = invokeEntrypoint({
    tool_name: 'Read',
    tool_input: { file_path: '/tmp/example.txt' },
    tool_response: { output: verboseOutput() },
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('TypeScript entrypoint ignores verbose output without a tool name', () => {
  const result = invokeEntrypoint({
    tool_response: { output: verboseOutput() },
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('TypeScript entrypoint does not retain a Python implementation dependency', () => {
  const source = readFileSync(entrypoint, 'utf8');

  expect(source).not.toContain('python3');
  expect(source).not.toContain('hook.py');
  expect(existsSync(join(__dirname, 'rtk-post-tool-use'))).toBe(false);
  expect(existsSync(join(__dirname, 'rtk-post-tool-use.py'))).toBe(false);
});

test('TypeScript entrypoint cites the RTK repository and hook documentation', () => {
  const source = readFileSync(entrypoint, 'utf8');

  expect(source).toContain('// GitHub: https://github.com/rtk-ai/rtk');
  expect(source).toContain('// Documentation: https://github.com/rtk-ai/rtk/blob/develop/hooks/README.md');
});

test('summarize honours ALUX_RTK_COMPACT_* environment overrides', () => {
  const output = Array.from({ length: 10 }, (_, index) => `line ${index} ${'y'.repeat(40)}`).join('\n');
  process.env.ALUX_RTK_COMPACT_MIN_CHARS = '50';
  process.env.ALUX_RTK_COMPACT_HEAD_LINES = '2';
  process.env.ALUX_RTK_COMPACT_TAIL_LINES = '3';
  process.env.ALUX_RTK_COMPACT_LINE_WIDTH = '40';
  try {
    const summary = summarize(output);

    expect(summary).toContain('Output summary (10 lines)');
    expect(summary).toContain('... omitted verbose output ...');
    expect(summary).not.toContain('line 5 ');
    expect(summary?.split('\n')[1]?.length).toBeLessThanOrEqual(40);
    expect(summarize(output, { minChars: 10_000 })).toBeUndefined();
  } finally {
    delete process.env.ALUX_RTK_COMPACT_MIN_CHARS;
    delete process.env.ALUX_RTK_COMPACT_HEAD_LINES;
    delete process.env.ALUX_RTK_COMPACT_TAIL_LINES;
    delete process.env.ALUX_RTK_COMPACT_LINE_WIDTH;
  }
});

test('summarize falls back to defaults on invalid environment overrides', () => {
  process.env.ALUX_RTK_COMPACT_MIN_CHARS = 'abc';
  process.env.ALUX_RTK_COMPACT_HEAD_LINES = '0';
  try {
    const output = Array.from({ length: 100 }, (_, index) => `line ${index}`).join('\n');
    const summary = summarize(output);

    expect(summary).toContain('Output summary (100 lines)');
    expect(summary).not.toContain('line 50');
    expect(summarize('short')).toBeUndefined();
  } finally {
    delete process.env.ALUX_RTK_COMPACT_MIN_CHARS;
    delete process.env.ALUX_RTK_COMPACT_HEAD_LINES;
  }
});

test('optimization decisions come from rtk rewrite', () => {
  const calls: string[][] = [];
  const spawn = (options: { cmd: string[] }) => {
    calls.push(options.cmd);
    return {
      exitCode: 3,
      stdout: new TextEncoder().encode('rtk gh pr view 42'),
      stderr: new Uint8Array(),
    };
  };

  expect(resolveOptimizedCommand('gh pr view 42', undefined, spawn)).toBe('rtk gh pr view 42');
  expect(calls).toEqual([['rtk', 'rewrite', 'gh pr view 42']]);
});

test('commands without an RTK optimization are not proxied', () => {
  const spawn = () => ({
    exitCode: 1,
    stdout: new Uint8Array(),
    stderr: new Uint8Array(),
  });

  expect(resolveOptimizedCommand('unknown-tool --flag', undefined, spawn)).toBeUndefined();
});

test('optimized commands execute through rtk proxy', () => {
  expect(proxyInvocation('rtk gh pr view 42')).toEqual(['rtk', 'proxy', 'rtk gh pr view 42']);
});
