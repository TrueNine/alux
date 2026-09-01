import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { compactAfterToolOutput, isShellTool, rewriteBeforeToolInput } from '../.cline-plugin/adapter';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

const longOutput = Array.from({ length: 120 }, (_, index) => `line-${index}`).join('\n');

describe('Cline plugin', () => {
  test('declares the Cline plugin entry in package.json', async () => {
    const manifest = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')) as {
      cline?: {
        plugins?: Array<{
          paths?: string[];
          capabilities?: string[];
        }>;
      };
    };

    const declaration = manifest.cline?.plugins?.[0];
    expect(declaration?.paths).toEqual(['./.cline-plugin/index.ts']);
    expect(declaration?.capabilities).toEqual(expect.arrayContaining(['hooks', 'skills']));
    expect((await stat(resolve(repositoryRoot, declaration?.paths?.[0] ?? ''))).isFile()).toBe(true);
  });

  test('exposes an AgentPlugin with hooks and skills capabilities', async () => {
    const plugin = (await import('../.cline-plugin/index')).default as {
      name: string;
      manifest: { capabilities: string[] };
      setup?: unknown;
      hooks?: Record<string, unknown>;
    };

    expect(plugin.name).toBe('alux');
    expect(plugin.manifest.capabilities).toEqual(expect.arrayContaining(['hooks', 'skills']));
    expect(plugin.setup).toBeTypeOf('function');
    expect(plugin.hooks?.beforeTool).toBeTypeOf('function');
    expect(plugin.hooks?.afterTool).toBeTypeOf('function');
  });

  test('recognizes the Cline shell tool', () => {
    expect(isShellTool('execute_command')).toBe(true);
    expect(isShellTool('Bash')).toBe(true);
    expect(isShellTool('write_file')).toBe(false);
  });

  test('rewrites shell commands through the shared pre-tool-use pipeline', () => {
    const rewrite = (command: string): string | undefined => (command === 'dir' ? 'Get-ChildItem' : undefined);

    expect(rewriteBeforeToolInput('execute_command', { command: 'dir' }, rewrite)).toEqual({ input: { command: 'Get-ChildItem' } });
    expect(rewriteBeforeToolInput('execute_command', { command: 'ls' }, rewrite)).toBeUndefined();
    expect(rewriteBeforeToolInput('write_file', { command: 'dir' }, rewrite)).toBeUndefined();
    expect(rewriteBeforeToolInput('execute_command', {}, rewrite)).toBeUndefined();
    expect(rewriteBeforeToolInput('execute_command', { command: 'dir', cwd: '/tmp' }, rewrite)).toEqual({ input: { command: 'Get-ChildItem', cwd: '/tmp' } });
  });

  test('compacts verbose shell output through the shared post-tool-use summarizer', () => {
    expect(compactAfterToolOutput('execute_command', 'short output')).toBeUndefined();
    expect(compactAfterToolOutput('write_file', longOutput)).toBeUndefined();

    const compacted = compactAfterToolOutput('execute_command', { output: longOutput });
    expect(compacted?.output).toContain('Output summary (');
    expect(compacted?.output).toContain('... omitted verbose output ...');
  });
});
