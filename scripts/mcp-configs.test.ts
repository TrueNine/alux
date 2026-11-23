import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

type McpConfiguration = {
  mcpServers?: Record<string, { type?: string; command?: string | string[]; args?: string[] }>;
  mcp?: {
    servers?: Record<string, { type?: string; command?: string | string[]; args?: string[] }>;
  };
};

const platformManifests = [
  { platform: 'Claude Code', manifest: '.claude-plugin/plugin.json', type: 'stdio', relativeToManifest: false },
  { platform: 'Codex', manifest: '.codex-plugin/plugin.json', type: undefined, relativeToManifest: false },
  { platform: 'OpenCode', manifest: '.opencode-plugin/plugin.json', type: 'local', relativeToManifest: false },
  { platform: 'ZCode', manifest: '.zcode-plugin/plugin.json', type: 'stdio', relativeToManifest: false },
  { platform: 'Grok Build', manifest: '.grok-plugin/plugin.json', type: 'stdio', relativeToManifest: false },
  { platform: 'CodeBuddy Code', manifest: '.codebuddy-plugin/plugin.json', type: 'stdio', relativeToManifest: false },
  { platform: 'Qoder', manifest: '.qoder-plugin/plugin.json', type: 'stdio', relativeToManifest: false },
  { platform: 'GitHub Copilot CLI', manifest: '.copilot-plugin/plugin.json', type: 'local', relativeToManifest: true },
] as const;

describe('shared CodeGraph MCP configuration', () => {
  test.each(platformManifests)('$platform exposes CodeGraph from its manifest', async ({ manifest, type, relativeToManifest }) => {
    const manifestPath = resolve(repositoryRoot, manifest);
    const plugin = JSON.parse(await readFile(manifestPath, 'utf8')) as { mcpServers?: string };
    expect(plugin.mcpServers, `${manifest} must declare mcpServers`).toBeTruthy();

    const configurationPath = resolve(relativeToManifest ? dirname(manifestPath) : repositoryRoot, plugin.mcpServers ?? '');
    const configuration = JSON.parse(await readFile(configurationPath, 'utf8')) as McpConfiguration;
    const server = configuration.mcp?.servers?.codegraph ?? configuration.mcpServers?.codegraph;

    expect(server, `${manifest} must expose codegraph`).toBeDefined();
    if (type) expect(server?.type).toBe(type);
    expect(server?.command).toEqual(manifest === '.opencode-plugin/plugin.json' ? ['codegraph', 'serve', '--mcp'] : 'codegraph');
    if (manifest !== '.opencode-plugin/plugin.json') {
      expect(server?.args).toEqual(['serve', '--mcp']);
    }
  });

  test('Kimi Code embeds CodeGraph inline in its manifest, synchronized with the canonical catalog', async () => {
    const manifest = JSON.parse(await readFile(resolve(repositoryRoot, '.kimi-plugin', 'plugin.json'), 'utf8')) as {
      mcpServers?: Record<string, { command?: string; args?: string[] }>;
    };
    expect(manifest.mcpServers?.codegraph).toMatchObject({
      command: 'codegraph',
      args: ['serve', '--mcp'],
    });

    const canonical = JSON.parse(await readFile(resolve(repositoryRoot, 'mcps', '.mcp.kimi.json'), 'utf8')) as McpConfiguration;
    expect(manifest.mcpServers).toEqual(canonical.mcpServers);
  });

  test('Cursor auto-discovers the shared CodeGraph server from mcp.json', async () => {
    const configuration = JSON.parse(await readFile(resolve(repositoryRoot, 'mcp.json'), 'utf8')) as McpConfiguration & {
      $schema?: string;
    };

    expect(configuration.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
    expect(configuration.mcpServers?.codegraph).toMatchObject({
      type: 'stdio',
      command: 'codegraph',
      args: ['serve', '--mcp'],
    });
  });
});
