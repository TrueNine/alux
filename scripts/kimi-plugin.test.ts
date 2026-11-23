import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = resolve(repositoryRoot, '.kimi-plugin', 'plugin.json');
const marketplaceManifestPath = resolve(repositoryRoot, '.kimi-plugin', 'marketplace.json');

type KimiHookRule = {
  event: string;
  matcher?: string;
  command: string;
  timeout?: number;
};

type KimiPluginManifest = {
  name: string;
  version: string;
  description: string;
  skills: string;
  hooks: KimiHookRule[];
  mcpServers: Record<string, { command?: string; args?: string[]; url?: string }>;
  interface?: { displayName?: string; shortDescription?: string };
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

describe('Kimi Code plugin', () => {
  test('declares existing plugin assets and matches the package version', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as KimiPluginManifest;
    const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')) as { version?: string };

    expect(manifest).toMatchObject({
      name: 'alux',
      description: 'Shared skills and workflows for Kimi Code',
      skills: './skills/kimi-skills',
      interface: {
        displayName: 'Alux',
        shortDescription: 'Shared skills and workflows for Kimi Code',
      },
    });
    expect(manifest.version).toBe(packageJson.version);
    const skillsRoot = resolve(repositoryRoot, manifest.skills);
    expect(skillsRoot.startsWith(resolve(repositoryRoot)), `${manifest.skills} stays within the plugin root`).toBe(true);
    expect((await stat(skillsRoot)).isDirectory()).toBe(true);
  });

  test('declares the single-plugin Marketplace catalog', async () => {
    const marketplace = JSON.parse(await readFile(marketplaceManifestPath, 'utf8')) as {
      version: string;
      plugins: Array<{
        id: string;
        displayName: string;
        source: string;
        description: string;
      }>;
    };

    expect(marketplace.version).toBe('2');
    expect(marketplace.plugins).toHaveLength(1);
    expect(marketplace.plugins[0]).toMatchObject({
      id: 'alux',
      displayName: 'Alux',
      source: '..',
    });
    expect(marketplace.plugins[0]?.description.length).toBeGreaterThan(0);

    // Kimi resolves a relative marketplace source against the catalog file, not the repository root.
    const pluginRoot = resolve(dirname(marketplaceManifestPath), marketplace.plugins[0]?.source ?? '.');
    expect(pluginRoot).toBe(resolve(repositoryRoot));
    expect(await stat(resolve(pluginRoot, '.kimi-plugin', 'plugin.json')).then((value) => value.isFile())).toBe(true);
  });

  test('embeds hook rules inline and keeps them synchronized with the canonical manifest', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as KimiPluginManifest;
    const canonical = JSON.parse(await readFile(resolve(repositoryRoot, 'hooks', 'hooks.kimi.json'), 'utf8')) as { hooks: KimiHookRule[] };

    expect(manifest.hooks.length).toBeGreaterThan(0);
    expect(manifest.hooks).toEqual(canonical.hooks);
    expect(manifest.hooks[0]).toMatchObject({
      event: 'SessionStart',
      command: 'bun ./hooks/session-start/sync-agent-instructions.ts',
      timeout: 30,
    });
    expect(manifest.hooks[0]?.command).not.toContain('$');
    expect(manifest.hooks.filter((rule) => rule.event === 'PreToolUse')).toHaveLength(0);
    expect(manifest.hooks.filter((rule) => rule.event === 'PostToolUse')).toHaveLength(0);
  });

  test('embeds the shared CodeGraph MCP server inline and keeps it synchronized with the canonical catalog', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as KimiPluginManifest;
    const canonical = JSON.parse(await readFile(resolve(repositoryRoot, 'mcps', '.mcp.kimi.json'), 'utf8')) as KimiPluginManifest;

    expect(manifest.mcpServers).toEqual(canonical.mcpServers);
    expect(manifest.mcpServers?.codegraph).toMatchObject({
      command: 'codegraph',
      args: ['serve', '--mcp'],
    });
  });

  test('provides valid required frontmatter for every declared skill', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as KimiPluginManifest;
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
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as KimiPluginManifest;
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
});
