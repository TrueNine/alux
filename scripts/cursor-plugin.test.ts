import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = resolve(repositoryRoot, '.cursor-plugin', 'plugin.json');
const marketplaceManifestPath = resolve(repositoryRoot, '.cursor-plugin', 'marketplace.json');

type CursorPluginManifest = {
  name: string;
  logo: string;
  category: string;
  tags: string[];
  skills: string;
  hooks: string;
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

describe('Cursor plugin', () => {
  test('declares existing plugin assets and hooks', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as CursorPluginManifest;

    expect(manifest).toMatchObject({
      name: 'alux',
      logo: 'assets/logo.svg',
      category: 'developer-tools',
      skills: './skills/cursor-skills',
      hooks: './hooks/hooks.cursor.json',
    });
    expect(manifest.tags).toEqual(expect.arrayContaining(['agent-skills', 'agent-instructions', 'developer-workflows']));
    expect((await stat(resolve(repositoryRoot, manifest.hooks))).isFile()).toBe(true);
    expect((await stat(resolve(repositoryRoot, manifest.logo))).isFile()).toBe(true);
    expect((await stat(resolve(repositoryRoot, manifest.skills))).isDirectory()).toBe(true);
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
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as CursorPluginManifest;
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
});
