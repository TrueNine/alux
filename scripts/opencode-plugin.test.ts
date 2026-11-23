import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { compactAfterToolOutput, isShellTool, loadMcpServers, loadSkillDefinitions, replayAfterToolOutput, rewriteBeforeToolInput } from '../.opencode-plugin/adapter';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = resolve(repositoryRoot, '.opencode-plugin', 'plugin.json');
const marketplaceManifestPath = resolve(repositoryRoot, '.opencode-plugin', 'marketplace.json');

type OpenCodePluginManifest = {
  name: string;
  version: string;
  skills: string;
  agents: string;
  commands: string;
  plugin: string;
  mcpServers: string;
};

function frontmatterField(frontmatter: string, field: string): string | undefined {
  const match = new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'm').exec(frontmatter);
  if (!match) return undefined;

  const value = match[1]?.trim();
  if (!value) return undefined;
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
    return value.slice(1, -1).trim();
  }
  return value;
}

type V2PluginContext = {
  location: { project: { directory: string } };
  mcp: { transform: (callback: (editor: { set: (name: string, config: unknown) => void }) => void) => Promise<void> };
  skill: { transform: (callback: (editor: { add: (skill: { id: string }) => void }) => void) => Promise<void> };
  tool: {
    hook: (name: 'execute.before' | 'execute.after', callback: (event: { tool: string; input: unknown; status: string; result: { content?: string; output?: unknown } }) => void) => Promise<void>;
  };
  shell: { hook: (name: 'create.before', callback: (event: { command: string; cwd: string }) => void) => Promise<void> };
  event: { subscribe: (options: { types: string[]; signal: AbortSignal }) => AsyncIterable<unknown> };
};

const longOutput = Array.from({ length: 120 }, (_, index) => `line-${index}`).join('\n');

describe('OpenCode plugin', () => {
  test('declares existing plugin assets, entrypoint, and MCP servers', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as OpenCodePluginManifest;
    const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')) as { version?: string };

    expect(manifest).toMatchObject({
      name: 'alux',
      skills: './skills/opencode-skills',
      agents: './agents/opencode-agents',
      commands: './commands/opencode-commands',
      plugin: './.opencode-plugin/index.ts',
      mcpServers: './mcps/.mcp.opencode.json',
    });
    expect(manifest.version).toBe(packageJson.version);
    expect(manifest).not.toHaveProperty('hooks');
    for (const field of ['skills', 'agents', 'commands', 'plugin', 'mcpServers'] as const) {
      expect((await stat(resolve(repositoryRoot, manifest[field]))).isFile() || (await stat(resolve(repositoryRoot, manifest[field]))).isDirectory()).toBe(true);
    }
  });

  test('provides the shared CodeGraph MCP server', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as OpenCodePluginManifest;
    const configuration = JSON.parse(await readFile(resolve(repositoryRoot, manifest.mcpServers), 'utf8')) as {
      mcp?: { servers?: Record<string, { type?: string; command?: string[] }> };
    };
    expect(configuration.mcp?.servers?.codegraph).toMatchObject({
      type: 'local',
      command: ['codegraph', 'serve', '--mcp'],
    });
  });

  test('declares the single-plugin Marketplace catalog', async () => {
    const marketplace = JSON.parse(await readFile(marketplaceManifestPath, 'utf8')) as {
      name: string;
      owner: { name: string; email: string };
      metadata: { description: string };
      plugins: Array<{
        name: string;
        source: string;
        description: string;
      }>;
    };

    expect(marketplace).toMatchObject({
      name: 'alux',
      owner: {
        name: 'TrueNine',
        email: 'truenine304520@gmail.com',
      },
      plugins: [
        {
          name: 'alux',
          source: '.',
        },
      ],
    });
    expect(marketplace.metadata.description.length).toBeGreaterThan(0);
    expect(marketplace.plugins).toHaveLength(1);
    expect(marketplace.plugins[0]?.description.length).toBeGreaterThan(0);
  });

  test('provides valid required frontmatter for every declared skill', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as OpenCodePluginManifest;
    const skillsRoot = resolve(repositoryRoot, manifest.skills);
    const skillDirectories = (await readdir(skillsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    expect(skillDirectories.length).toBeGreaterThan(0);
    for (const skillDirectory of skillDirectories) {
      const skillPath = resolve(skillsRoot, skillDirectory, 'SKILL.md');
      expect((await stat(skillPath)).isFile()).toBe(true);

      const skillDocument = await readFile(skillPath, 'utf8');
      const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skillDocument);
      expect(frontmatterMatch, `${skillPath} must start with YAML frontmatter`).not.toBeNull();

      const frontmatter = frontmatterMatch?.[1] ?? '';
      expect(frontmatterField(frontmatter, 'name')).toBe(skillDirectory);
      expect(frontmatterField(frontmatter, 'description')?.length).toBeGreaterThan(0);
    }
  });

  test('exports an OpenCode V2 plugin and does not keep a V1 entrypoint', async () => {
    const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')) as {
      exports?: { '.'?: string; './server'?: string };
      peerDependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(packageJson.exports).toMatchObject({
      '.': './.opencode-plugin/index.ts',
      './server': './.opencode-plugin/index.ts',
    });
    expect(packageJson.peerDependencies).not.toHaveProperty('@opencode-ai/plugin');
    expect(packageJson.devDependencies).not.toHaveProperty('@opencode-ai/plugin');
    expect(packageJson.peerDependencies?.['@opencode/plugin']).toBeTruthy();
    expect((await stat(resolve(repositoryRoot, '.opencode/plugins/alux/index.ts'))).isFile()).toBe(true);

    const loaded = (await import('../.opencode-plugin/index')) as unknown as {
      AluxPlugin?: unknown;
      default?: {
        id?: string;
        setup?: (ctx: V2PluginContext) => Promise<(() => void) | undefined>;
        server?: unknown;
      };
    };
    expect(loaded.AluxPlugin).toBeUndefined();
    expect(loaded.default?.server).toBeUndefined();
    expect(loaded.default?.id).toBe('alux');

    const before: Array<(event: { tool: string; input: unknown }) => void> = [];
    const after: Array<(event: { status: string; tool: string; result: { content?: string; output?: unknown } }) => void> = [];
    let shellHook: ((event: { command: string; cwd: string }) => void) | undefined;
    const mcpServers: string[] = [];
    const skills: string[] = [];
    const cleanup = await loaded.default?.setup?.({
      location: { project: { directory: repositoryRoot } },
      mcp: {
        transform: async (callback) => {
          callback({ set: (name) => mcpServers.push(name) });
        },
      },
      skill: {
        transform: async (callback) => {
          callback({ add: (skill) => skills.push(skill.id) });
        },
      },
      tool: {
        hook: async (name, callback) => {
          if (name === 'execute.before') before.push(callback as (event: { tool: string; input: unknown }) => void);
          if (name === 'execute.after') after.push(callback as (event: { status: string; tool: string; result: { content?: string; output?: unknown } }) => void);
        },
      },
      shell: {
        hook: async (_name, callback) => {
          shellHook = callback;
        },
      },
      event: {
        subscribe() {
          return (async function* () {})();
        },
      },
    });

    expect(mcpServers).toEqual(['codegraph']);
    expect(skills).toEqual((await readdir(resolve(repositoryRoot, 'skills/opencode-skills'))).filter((name) => name !== '.gitkeep').sort((left, right) => left.localeCompare(right)));
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(1);
    expect(shellHook).toBeTypeOf('function');

    const input = { tool: 'bash', input: { command: 'echo hi > out.txt' } };
    before[0]?.(input);
    expect(input.input).toEqual({ command: 'echo hi > out.txt' });

    const completed = { status: 'completed', tool: 'bash', result: { content: longOutput } };
    after[0]?.(completed);
    expect(completed.result.content).toContain('Output summary');
    expect(completed.result.content?.length).toBeLessThan(longOutput.length);

    shellHook?.({ command: 'echo hi > out.txt', cwd: repositoryRoot });
    cleanup?.();
  });

  test('recognizes the OpenCode shell tool', () => {
    expect(isShellTool('bash')).toBe(true);
    expect(isShellTool('Bash')).toBe(true);
    expect(isShellTool('read')).toBe(false);
  });

  test('rewrites shell commands through the shared pre-tool-use pipeline', () => {
    const rewrite = (command: string): string | undefined => (command === 'dir' ? 'Get-ChildItem' : undefined);

    expect(rewriteBeforeToolInput('bash', { command: 'dir' }, rewrite)).toEqual({ args: { command: 'Get-ChildItem' } });
    expect(rewriteBeforeToolInput('bash', { command: 'ls' }, rewrite)).toBeUndefined();
    expect(rewriteBeforeToolInput('read', { command: 'dir' }, rewrite)).toBeUndefined();
    expect(rewriteBeforeToolInput('bash', {}, rewrite)).toBeUndefined();
    expect(rewriteBeforeToolInput('bash', { command: 'dir', cwd: '/tmp' }, rewrite)).toEqual({ args: { command: 'Get-ChildItem', cwd: '/tmp' } });
  });

  test('loads the packaged V2 MCP servers and skills without the host runtime', () => {
    expect(loadMcpServers(repositoryRoot).codegraph).toEqual({
      type: 'local',
      command: ['codegraph', 'serve', '--mcp'],
      disabled: false,
      codemode: false,
    });
    expect(loadMcpServers(repositoryRoot, 'missing.json')).toEqual({});

    const skills = loadSkillDefinitions(repositoryRoot);
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.every((skill) => skill.id === skill.name && skill.description && skill.content.length > 0 && !skill.content.startsWith('---'))).toBe(true);
    expect(loadSkillDefinitions(repositoryRoot, 'missing-skills')).toEqual([]);
  });

  test('replays safe shell output through rtk proxy and skips unsafe or failed calls', () => {
    const spawn = (options: { cmd: string[] }) => {
      if (options.cmd[1] === 'rewrite') return { exitCode: 0, stdout: new TextEncoder().encode('rtk git status'), stderr: new Uint8Array() };
      return { exitCode: 0, stdout: new TextEncoder().encode('compact status'), stderr: new Uint8Array() };
    };

    expect(replayAfterToolOutput('shell', { command: 'git status', workdir: repositoryRoot }, 'short', spawn)).toEqual({ output: 'compact status' });
    expect(replayAfterToolOutput('shell', { command: 'rm -rf .', workdir: repositoryRoot }, 'short', spawn)).toBeUndefined();
    expect(replayAfterToolOutput('read', { command: 'git status' }, 'short', spawn)).toBeUndefined();
    expect(replayAfterToolOutput('shell', { command: 'git status' }, { exitCode: 1 }, spawn)).toBeUndefined();
  });

  test('compacts verbose shell output through the shared post-tool-use summarizer', () => {
    expect(compactAfterToolOutput('bash', 'short output')).toBeUndefined();
    expect(compactAfterToolOutput('read', longOutput)).toBeUndefined();

    const compacted = compactAfterToolOutput('bash', longOutput);
    expect(compacted?.output).toContain('Output summary');
    expect(compacted?.output.length).toBeLessThan(longOutput.length);
  });
});
