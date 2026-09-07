import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = resolve(repositoryRoot, '.copilot-plugin', 'plugin.json');
const marketplaceManifestPath = resolve(repositoryRoot, '.github', 'plugin', 'marketplace.json');
const pluginRoot = resolve(manifestPath, '..');

type CopilotPluginManifest = {
  name: string;
  version: string;
  skills: string;
  hooks: string;
};

describe('GitHub Copilot CLI plugin', () => {
  test('declares existing plugin assets', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as CopilotPluginManifest;

    expect(manifest).toMatchObject({
      name: 'alux',
      skills: '../skills/copilot-skills',
      hooks: '../hooks/hooks.copilot.json',
    });
    expect(manifest.version).toBe('0.0.14');
    expect((await stat(resolve(pluginRoot, manifest.skills))).isDirectory()).toBe(true);
    expect((await stat(resolve(pluginRoot, manifest.hooks))).isFile()).toBe(true);
  });

  test('declares the repository marketplace catalog', async () => {
    const marketplace = JSON.parse(await readFile(marketplaceManifestPath, 'utf8')) as {
      name: string;
      owner: { name: string; email: string };
      plugins: Array<{ name: string; source: string }>;
    };

    expect(marketplace).toMatchObject({
      name: 'alux',
      owner: {
        name: 'TrueNine',
        email: 'truenine304520@gmail.com',
      },
      plugins: [{ name: 'alux', source: './.copilot-plugin' }],
    });
    expect(marketplace.plugins).toHaveLength(1);
  });

  test('contains valid skills', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as CopilotPluginManifest;
    const skills = await readdir(resolve(pluginRoot, manifest.skills));

    expect(skills).not.toHaveLength(0);
    for (const skill of skills) {
      const skillPath = resolve(pluginRoot, manifest.skills, skill, 'SKILL.md');
      expect((await stat(skillPath)).isFile()).toBe(true);
    }
  });
});
