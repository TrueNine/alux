import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { mixSharedSkills } from './mixining-shared-skills-to-native-skills.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function createSkillsRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'alux-skills-'));
  temporaryDirectories.push(root);
  await mkdir(join(root, 'shared', 'example-skill', 'scripts'), {
    recursive: true,
  });
  await mkdir(join(root, 'codex-skills'), { recursive: true });
  await mkdir(join(root, 'claude-skills'), { recursive: true });
  await mkdir(join(root, 'cursor-skills'), { recursive: true });
  await writeFile(join(root, 'shared', 'example-skill', 'SKILL.md'), 'shared skill');
  await writeFile(join(root, 'shared', 'example-skill', 'scripts', 'run.ts'), "console.log('run')");
  return root;
}

describe('mixSharedSkills', () => {
  test('exposes a sync:skills package command', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.['sync:skills']).toBe('bun scripts/mixining-shared-skills-to-native-skills.ts');
  });

  test('copies every shared skill recursively to every native skills directory', async () => {
    const root = await createSkillsRoot();

    const result = await mixSharedSkills(root);

    expect(result).toEqual({
      copiedSkills: ['example-skill'],
      targetDirectories: ['claude-skills', 'codex-skills', 'cursor-skills'],
    });
    for (const target of ['claude-skills', 'codex-skills', 'cursor-skills']) {
      expect(await readFile(join(root, target, 'example-skill', 'SKILL.md'), 'utf8')).toBe('shared skill');
      expect(await readFile(join(root, target, 'example-skill', 'scripts', 'run.ts'), 'utf8')).toContain('console.log');
    }
  });

  test('updates existing shared skill files', async () => {
    const root = await createSkillsRoot();
    await mkdir(join(root, 'claude-skills', 'example-skill'), {
      recursive: true,
    });
    await writeFile(join(root, 'claude-skills', 'example-skill', 'SKILL.md'), 'outdated shared skill');

    await mixSharedSkills(root);

    expect(await readFile(join(root, 'claude-skills', 'example-skill', 'SKILL.md'), 'utf8')).toBe('shared skill');
  });

  test('merges shared skills into Codex while preserving agent manifests', async () => {
    const root = await createSkillsRoot();
    await mkdir(join(root, 'codex-skills', 'example-skill', 'agents'), {
      recursive: true,
    });
    await writeFile(join(root, 'codex-skills', 'example-skill', 'agents', 'openai.yaml'), 'codex-only manifest');

    await mixSharedSkills(root);

    expect(await readdir(join(root, 'codex-skills'))).toEqual(['example-skill']);
    expect(await readFile(join(root, 'codex-skills', 'example-skill', 'SKILL.md'), 'utf8')).toBe('shared skill');
    expect(await readFile(join(root, 'codex-skills', 'example-skill', 'agents', 'openai.yaml'), 'utf8')).toBe('codex-only manifest');
  });
});
