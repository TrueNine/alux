import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { proxyInvocation, resolveOptimizedCommand } from './rtk-post-tool-use';

const hooksDirectory = join(import.meta.dir, '..');
const entrypoint = join(import.meta.dir, 'rtk-post-tool-use.ts');

function invokeEntrypoint(payload: unknown) {
  return Bun.spawnSync({
    cmd: ['bun', entrypoint, '--claude'],
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: 'pipe',
    stderr: 'pipe',
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

test('Claude PostToolUse only matches Bash', () => {
  const configuration = JSON.parse(readFileSync(join(hooksDirectory, 'hooks.claude.json'), 'utf8'));
  const group = configuration.hooks.PostToolUse[0];

  expect(group).toEqual({
    matcher: '^Bash$',
    hooks: [
      {
        type: 'command',
        command: `bun "\${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use/rtk-post-tool-use.ts" --claude`,
        statusMessage: 'RTK output compaction',
      },
    ],
  });
});

test('Cursor PostToolUse injects processed Shell output as context', () => {
  const configuration = JSON.parse(readFileSync(join(hooksDirectory, 'hooks.cursor.json'), 'utf8'));

  expect(configuration.version).toBe(1);
  expect(configuration.hooks.postToolUse).toEqual([
    {
      command: `bun "\${CURSOR_PLUGIN_ROOT}/hooks/post-tool-use/rtk-post-tool-use.ts" --cursor`,
      matcher: '^Shell$',
    },
  ]);
});

test('TypeScript entrypoint preserves a no-op hook result', () => {
  const result = Bun.spawnSync({
    cmd: ['bun', entrypoint],
    stdin: new TextEncoder().encode('not json'),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  expect(result.exitCode).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('TypeScript entrypoint summarizes verbose Bash output', () => {
  const payload = {
    tool_name: 'Bash',
    tool_input: { command: 'bun test' },
    tool_response: {
      output: verboseOutput(),
      exit_code: 0,
    },
  };
  const result = invokeEntrypoint(payload);

  const replacement = new TextDecoder().decode(result.stderr);
  expect(result.exitCode).toBe(2);
  expect(replacement).toContain('Output summary (100 lines)');
  expect(replacement).toContain('... omitted verbose output ...');
  expect(replacement).not.toContain('line 50');
});

test('Cursor entrypoint summarizes JSON-stringified Shell output', () => {
  const result = Bun.spawnSync({
    cmd: ['bun', entrypoint, '--cursor'],
    stdin: new TextEncoder().encode(
      JSON.stringify({
        tool_name: 'Shell',
        tool_input: { command: 'bun test' },
        tool_output: JSON.stringify({
          exitCode: 0,
          stdout: verboseOutput(),
          stderr: '',
        }),
      }),
    ),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  expect(result.exitCode).toBe(0);
  expect(new TextDecoder().decode(result.stderr)).toBe('');
  const output = JSON.parse(new TextDecoder().decode(result.stdout));
  expect(output.additional_context).toContain('Output summary (100 lines)');
  expect(output.additional_context).toContain('... omitted verbose output ...');
  expect(output.additional_context).not.toContain('line 50');
});

test('Codex entrypoint retains exec tool support', () => {
  const result = Bun.spawnSync({
    cmd: ['bun', entrypoint, '--codex'],
    stdin: new TextEncoder().encode(
      JSON.stringify({
        tool_name: 'exec',
        tool_response: { output: verboseOutput() },
      }),
    ),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  expect(result.exitCode).toBe(2);
  expect(new TextDecoder().decode(result.stderr)).toContain('Output summary (100 lines)');
});

test('entrypoint without a platform mode is a no-op', () => {
  const result = Bun.spawnSync({
    cmd: ['bun', entrypoint],
    stdin: new TextEncoder().encode(
      JSON.stringify({
        tool_name: 'Bash',
        tool_response: { output: verboseOutput() },
      }),
    ),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  expect(result.exitCode).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('TypeScript entrypoint never summarizes verbose Read output', () => {
  const result = invokeEntrypoint({
    tool_name: 'Read',
    tool_input: { file_path: '/tmp/example.txt' },
    tool_response: { output: verboseOutput() },
  });

  expect(result.exitCode).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('TypeScript entrypoint ignores verbose output without a tool name', () => {
  const result = invokeEntrypoint({
    tool_response: { output: verboseOutput() },
  });

  expect(result.exitCode).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});

test('TypeScript entrypoint does not retain a Python implementation dependency', () => {
  const source = readFileSync(entrypoint, 'utf8');

  expect(source).not.toContain('python3');
  expect(source).not.toContain('hook.py');
  expect(existsSync(join(import.meta.dir, 'rtk-post-tool-use'))).toBe(false);
  expect(existsSync(join(import.meta.dir, 'rtk-post-tool-use.py'))).toBe(false);
});

test('TypeScript entrypoint cites the RTK repository and hook documentation', () => {
  const source = readFileSync(entrypoint, 'utf8');

  expect(source).toContain('// GitHub: https://github.com/rtk-ai/rtk');
  expect(source).toContain('// Documentation: https://github.com/rtk-ai/rtk/blob/develop/hooks/README.md');
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
