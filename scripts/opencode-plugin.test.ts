import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { compactAfterToolOutput, isShellTool, rewriteBeforeToolInput } from '../.opencode-plugin/adapter';

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
  hooks: string;
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
      hooks: './.opencode-plugin/index.ts',
      mcpServers: './mcps/.mcp.opencode.json',
    });
    expect(manifest.version).toBe(packageJson.version);
    for (const field of ['skills', 'agents', 'commands', 'plugin', 'mcpServers'] as const) {
      expect((await stat(resolve(repositoryRoot, manifest[field]))).isFile() || (await stat(resolve(repositoryRoot, manifest[field]))).isDirectory()).toBe(true);
    }
    expect((await stat(resolve(repositoryRoot, manifest.hooks))).isFile()).toBe(true);
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

  test('exposes an OpenCode plugin with before/after tool hooks', async () => {
    const plugin = (await import('../.opencode-plugin/index')) as {
      AluxPlugin?: (...args: unknown[]) => Promise<Record<string, unknown>>;
      default?: (...args: unknown[]) => Promise<Record<string, unknown>>;
    };

    expect(plugin.AluxPlugin).toBeTypeOf('function');
    const hooks = await plugin.AluxPlugin?.({ directory: repositoryRoot, worktree: repositoryRoot });
    expect(hooks?.['tool.execute.before']).toBeTypeOf('function');
    expect(hooks?.['tool.execute.after']).toBeTypeOf('function');
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

  test('compacts verbose shell output through the shared post-tool-use summarizer', () => {
    expect(compactAfterToolOutput('bash', 'short output')).toBeUndefined();
    expect(compactAfterToolOutput('read', longOutput)).toBeUndefined();

    const compacted = compactAfterToolOutput('bash', longOutput);
    expect(compacted?.output).toContain('Output summary');
    expect(compacted?.output.length).toBeLessThan(longOutput.length);
  });
});
