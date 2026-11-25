import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveOptimizedCommand } from '../hooks/shared/rtk.ts';
import mcp from '../mcp.json';
import manifest from '../package.json';
import alux from './index.ts';

vi.mock(import('../hooks/shared/rtk.ts'), async (importOriginal) => ({
  ...(await importOriginal()),
  resolveOptimizedCommand: vi.fn(),
}));

function loadExtension() {
  const on = vi.fn();
  const registerMcpServer = vi.fn();
  alux({ on, registerMcpServer } as unknown as ExtensionAPI);
  return {
    handler: (event: string) => {
      const callback = on.mock.calls.find(([name]) => name === event)?.[1];
      expect(callback, event).toBeTypeOf('function');
      return callback;
    },
    registerMcpServer,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('Alux Pi package', () => {
  test('ships one extension and the canonical skills, and registers CodeGraph', () => {
    expect(manifest.pi).toEqual({ extensions: ['./.pi-plugin/index.ts'], skills: ['./skills/shared'] });
    const { registerMcpServer } = loadExtension();
    const { command, args } = mcp.mcpServers.codegraph;
    expect(registerMcpServer).toHaveBeenCalledExactlyOnceWith('codegraph', { command, args });
  });

  test('adds path-scoped rule references to Pi’s existing system prompt', () => {
    const { handler } = loadExtension();
    const result = handler('before_agent_start')({ systemPrompt: 'Pi base prompt' });
    expect(result.systemPrompt).toMatch(/^Pi base prompt\n\n## Alux shared rules/);
    expect(result.systemPrompt).toContain('**/*.md');
    expect(result.systemPrompt).toContain('markdown-documentation.md');
  });

  test.each(['bash', 'powershell'])('rewrites %s input in place using the session directory', (toolName) => {
    vi.mocked(resolveOptimizedCommand).mockReturnValue('rtk git status --short');
    const { handler } = loadExtension();
    const input = { command: 'git status --short', timeout: 20 };
    expect(handler('tool_call')({ toolName, input }, { cwd: 'workspace' })).toBeUndefined();
    expect(input).toEqual({ command: 'rtk git status --short', timeout: 20 });
    expect(resolveOptimizedCommand).toHaveBeenCalledExactlyOnceWith('git status --short', 'workspace');
  });

  test('passes through commands for other tools and keeps input if RTK fails', () => {
    vi.mocked(resolveOptimizedCommand).mockImplementation(() => {
      throw new Error('RTK failed');
    });
    const { handler } = loadExtension();
    const handle = handler('tool_call');
    const input = { command: 'git status' };
    handle({ toolName: 'custom', input }, { cwd: 'workspace' });
    expect(resolveOptimizedCommand).not.toHaveBeenCalled();
    handle({ toolName: 'bash', input }, { cwd: 'workspace' });
    expect(input.command).toBe('git status');
  });

  test.each(['bash', 'powershell'])('compacts successful %s text while preserving structured output and diagnostic results', (toolName) => {
    const { handler } = loadExtension();
    const handle = handler('tool_result');
    const output = Array.from({ length: 120 }, (_, index) => `sample output line ${index}`).join('\n');
    const structuredContent = { output, exit_code: 0, truncated: false };
    const event = { toolName, isError: false, content: [{ type: 'text', text: output }], structuredContent };
    const result = handle(event);
    expect(result.content[0].text).toContain('Output summary (120 lines)');
    expect(result.content[0].text).toContain('sample output line 119');
    expect(result.content[0].text).not.toContain('sample output line 60');
    expect(result.structuredContent).toBe(structuredContent);
    expect(handle({ ...event, isError: true })).toBeUndefined();
    expect(handle({ ...event, details: { fullOutputPath: 'pi-output.log' } })).toBeUndefined();
  });
});
