import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = resolve(repositoryRoot, '.grok-plugin', 'plugin.json');
const marketplaceManifestPath = resolve(repositoryRoot, '.grok-plugin', 'marketplace.json');

type GrokPluginManifest = {
  name: string;
  version: string;
  description: string;
  skills: string;
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

describe('Grok Build plugin', () => {
  test('declares existing plugin assets, hooks, and MCP servers', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as GrokPluginManifest;
    const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')) as { version?: string };

    expect(manifest).toMatchObject({
      name: 'alux',
      description: 'Shared skills and workflows for Grok Build',
      skills: './skills/grok-skills',
      hooks: './hooks/hooks.grok.json',
      mcpServers: './mcps/.mcp.grok.json',
    });
    expect(manifest.version).toBe(packageJson.version);
    for (const field of ['skills', 'hooks', 'mcpServers'] as const) {
      const resource = resolve(repositoryRoot, manifest[field]);
      expect(resource.startsWith(resolve(repositoryRoot)), `${manifest[field]} stays within the plugin root`).toBe(true);
      expect((await stat(resource)).isFile() || (await stat(resource)).isDirectory()).toBe(true);
    }
  });

  test('declares the single-plugin Marketplace catalog', async () => {
    const marketplace = JSON.parse(await readFile(marketplaceManifestPath, 'utf8')) as {
      name: string;
      owner: { name: string; email: string };
      description: string;
      plugins: Array<{
        name: string;
        source: string;
        description: string;
        version: string;
        author: { name: string };
        homepage: string;
        keywords: string[];
        tags: string[];
      }>;
    };
    const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')) as { version?: string };

    expect(marketplace).toMatchObject({
      name: 'alux',
      owner: {
        name: 'TrueNine',
        email: 'truenine304520@gmail.com',
      },
      plugins: [
        {
          name: 'alux',
          source: './',
          author: { name: 'TrueNine' },
          homepage: 'https://github.com/TrueNine/alux',
        },
      ],
    });
    expect(marketplace.description.length).toBeGreaterThan(0);
    expect(marketplace.plugins).toHaveLength(1);
    expect(marketplace.plugins[0]?.description.length).toBeGreaterThan(0);
    expect(marketplace.plugins[0]?.version).toBe(packageJson.version);
    expect(marketplace.plugins[0]?.keywords).toContain('grok');
    expect(marketplace.plugins[0]?.tags.length).toBeGreaterThan(0);

    const pluginRoot = resolve(repositoryRoot, marketplace.plugins[0]?.source ?? './');
    expect(await stat(resolve(pluginRoot, '.grok-plugin', 'plugin.json')).then((value) => value.isFile())).toBe(true);
  });

  test('provides valid required frontmatter for every declared skill', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as GrokPluginManifest;
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

  test('keeps synchronized shared skills identical to the canonical source', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as GrokPluginManifest;
    const [sharedSkills, nativeSkills] = await Promise.all([
      readdir(resolve(repositoryRoot, 'skills', 'shared'), { withFileTypes: true }),
      readdir(resolve(repositoryRoot, manifest.skills), { withFileTypes: true }),
    ]);

    for (const skill of sharedSkills.filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
      const sharedSkill = await readFile(resolve(repositoryRoot, 'skills', 'shared', skill, 'SKILL.md'), 'utf8');
      const nativeSkill = await readFile(resolve(repositoryRoot, manifest.skills, skill, 'SKILL.md'), 'utf8');
      expect(nativeSkill, `${skill} must stay synchronized with shared/`).toBe(sharedSkill);
    }
    expect(
      nativeSkills
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual(
      sharedSkills
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right)),
    );
  });

  test('wires session, pre-tool, and post-tool hooks over the Claude-compatible protocol', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as GrokPluginManifest;
    const configuration = JSON.parse(await readFile(resolve(repositoryRoot, manifest.hooks), 'utf8')) as {
      hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; command: string; timeout?: number }> }>>;
    };

    expect(configuration.hooks.SessionStart[0]?.hooks[0]).toMatchObject({
      type: 'command',
      command: `bun "\${GROK_PLUGIN_ROOT}/hooks/session-start/sync-agent-instructions.ts"`,
    });
    for (const event of ['PreToolUse', 'PostToolUse'] as const) {
      const group = configuration.hooks[event][0];
      expect(group?.matcher).toBe('^Bash$');
      expect(group?.hooks[0]).toMatchObject({
        type: 'command',
        command: `bun "\${GROK_PLUGIN_ROOT}/hooks/${event === 'PreToolUse' ? 'pre-tool-use' : 'post-tool-use'}/rtk-${event === 'PreToolUse' ? 'pre' : 'post'}-tool-use.ts" --grok`,
      });
    }
    for (const handler of configuration.hooks.PreToolUse[0]?.hooks ?? []) {
      expect(handler.timeout).toBeGreaterThan(5);
    }
  });

  test('keeps the MCP server catalog as an optional empty placeholder', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as GrokPluginManifest;
    const mcpServers = JSON.parse(await readFile(resolve(repositoryRoot, manifest.mcpServers), 'utf8'));
    expect(mcpServers).toEqual({});
  });
});
