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
  mcpServers: string;
};

describe('GitHub Copilot CLI plugin', () => {
  test('declares existing plugin assets', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as CopilotPluginManifest;
    const packageManifest = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')) as { version: string };

    expect(manifest).toMatchObject({
      name: 'alux',
      skills: '../skills/copilot-skills',
      hooks: '../hooks/hooks.copilot.json',
      mcpServers: '../mcps/.mcp.copilot.json',
    });
    expect(manifest.version).toBe(packageManifest.version);
    expect((await stat(resolve(pluginRoot, manifest.skills))).isDirectory()).toBe(true);
    expect((await stat(resolve(pluginRoot, manifest.hooks))).isFile()).toBe(true);
    expect((await stat(resolve(pluginRoot, manifest.mcpServers))).isFile()).toBe(true);
  });

  test('provides the shared CodeGraph MCP server', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as CopilotPluginManifest;
    const configuration = JSON.parse(await readFile(resolve(pluginRoot, manifest.mcpServers), 'utf8')) as {
      mcpServers?: Record<string, { type?: string; command?: string; args?: string[] }>;
    };
    expect(configuration.mcpServers?.codegraph).toMatchObject({
      type: 'local',
      command: 'codegraph',
      args: ['serve', '--mcp'],
    });
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
