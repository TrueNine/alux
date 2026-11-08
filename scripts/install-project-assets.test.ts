import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { installProjectAssets, PLATFORM_ASSETS } from './install-project-assets.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function createFixtureTree(root: string, relativePath: string, files: string[]): Promise<void> {
  for (const file of files) {
    await mkdir(join(root, relativePath, file, '..'), { recursive: true });
    await writeFile(join(root, relativePath, file), 'alux asset\n');
  }
}

async function createAluxRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'alux-repo-'));
  temporaryDirectories.push(root);
  await createFixtureTree(root, 'rules/claude-rules', ['claude-rule.md']);
  await createFixtureTree(root, 'rules/cline-rules', ['cline-rule.md']);
  await createFixtureTree(root, 'rules/copilot-rules', ['copilot-rule.instructions.md']);
  await createFixtureTree(root, 'rules/grok-rules', ['grok-rule.md']);
  await createFixtureTree(root, 'skills/cline-skills/example-skill', ['SKILL.md', 'scripts/run.ts']);
  return root;
}

async function createProject(withGit = true): Promise<string> {
  const project = await mkdtemp(join(tmpdir(), 'alux-project-'));
  temporaryDirectories.push(project);
  if (withGit) await mkdir(join(project, '.git'), { recursive: true });
  return project;
}

async function readExclude(project: string): Promise<string[]> {
  const content = await readFile(join(project, '.git', 'info', 'exclude'), 'utf8').catch(() => '');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

describe('installProjectAssets', () => {
  test('installs every platform by default and registers each copied file in .git/info/exclude', async () => {
    const [repositoryRoot, project] = await Promise.all([createAluxRoot(), createProject()]);

    const result = await installProjectAssets(project, { repositoryRoot });

    expect(result.copiedFiles).toEqual([
      '.claude/rules/claude-rule.md',
      '.cline/rules/cline-rule.md',
      '.cline/skills/example-skill/scripts/run.ts',
      '.cline/skills/example-skill/SKILL.md',
      '.github/instructions/copilot-rule.instructions.md',
      '.grok/rules/grok-rule.md',
    ]);
    expect(result.excludedEntries).toEqual([...result.copiedFiles]);
    expect(await readExclude(project)).toEqual([...result.copiedFiles]);
    expect(await readdir(join(project, '.cline', 'skills', 'example-skill', 'scripts'))).toContain('run.ts');
  });

  test('keeps .git/info/exclude idempotent across repeated installs', async () => {
    const [repositoryRoot, project] = await Promise.all([createAluxRoot(), createProject()]);
    await installProjectAssets(project, { repositoryRoot });
    const before = await readFile(join(project, '.git', 'info', 'exclude'), 'utf8');

    await installProjectAssets(project, { repositoryRoot });

    expect(await readFile(join(project, '.git', 'info', 'exclude'), 'utf8')).toBe(before);
  });

  test('preserves pre-existing exclude content and appends after the last line', async () => {
    const [repositoryRoot, project] = await Promise.all([createAluxRoot(), createProject()]);
    await mkdir(join(project, '.git', 'info'), { recursive: true });
    await writeFile(join(project, '.git', 'info', 'exclude'), '# alux local assets', 'utf8');

    await installProjectAssets(project, { repositoryRoot, platforms: ['claude'] });

    const lines = await readExclude(project);
    expect(lines[0]).toBe('# alux local assets');
    expect(lines).toContain('.claude/rules/claude-rule.md');
  });

  test('honors platform selection', async () => {
    const [repositoryRoot, project] = await Promise.all([createAluxRoot(), createProject()]);

    const result = await installProjectAssets(project, { repositoryRoot, platforms: ['grok'] });

    expect(result.copiedFiles).toEqual(['.grok/rules/grok-rule.md']);
    expect(await readdir(join(project, '.grok', 'rules'))).toEqual(['grok-rule.md']);
    expect(await stat(join(project, '.claude')).catch(() => undefined)).toBeUndefined();
  });

  test('skips .git/info/exclude when the project is not a git repository', async () => {
    const [repositoryRoot, project] = await Promise.all([createAluxRoot(), createProject(false)]);

    const result = await installProjectAssets(project, { repositoryRoot });

    expect(result.copiedFiles.length).toBeGreaterThan(0);
    expect(result.excludedEntries).toEqual([]);
    expect(await stat(join(project, '.git', 'info')).catch(() => undefined)).toBeUndefined();
  });

  test('excludes the alux clone when it lives inside the project as a standalone checkout', async () => {
    const project = await mkdtemp(join(tmpdir(), 'alux-nested-'));
    temporaryDirectories.push(project);
    await mkdir(join(project, '.git'), { recursive: true });
    const repositoryRoot = await createAluxRoot();
    const nestedRoot = join(project, 'alux');
    await cp(repositoryRoot, nestedRoot, { recursive: true });
    await mkdir(join(nestedRoot, '.git'), { recursive: true });

    const result = await installProjectAssets(project, { repositoryRoot: nestedRoot });

    expect(result.excludedEntries).toContain('alux/');
    expect(await readExclude(project)).toContain('alux/');
  });

  test('does not exclude the alux clone when it is a submodule of the project', async () => {
    const project = await mkdtemp(join(tmpdir(), 'alux-nested-'));
    temporaryDirectories.push(project);
    await mkdir(join(project, '.git'), { recursive: true });
    const repositoryRoot = await createAluxRoot();
    const nestedRoot = join(project, 'alux');
    await cp(repositoryRoot, nestedRoot, { recursive: true });
    await writeFile(join(nestedRoot, '.git'), 'gitdir: ../.git/modules/alux\n', 'utf8');

    const result = await installProjectAssets(project, { repositoryRoot: nestedRoot });

    expect(result.excludedEntries).not.toContain('alux/');
    expect(result.copiedFiles.length).toBeGreaterThan(0);
  });

  test('registers exclusions in the submodule git directory for submodule checkouts', async () => {
    const base = await mkdtemp(join(tmpdir(), 'alux-submodule-'));
    temporaryDirectories.push(base);
    const project = join(base, 'sub');
    await mkdir(join(base, '.git', 'modules', 'sub'), { recursive: true });
    await mkdir(project, { recursive: true });
    await writeFile(join(project, '.git'), 'gitdir: ../.git/modules/sub\n', 'utf8');
    const repositoryRoot = await createAluxRoot();

    const result = await installProjectAssets(project, { repositoryRoot, platforms: ['claude'] });

    expect(result.excludedEntries).toEqual(['.claude/rules/claude-rule.md']);
    const moduleExclude = await readFile(join(base, '.git', 'modules', 'sub', 'info', 'exclude'), 'utf8');
    expect(moduleExclude).toContain('.claude/rules/claude-rule.md');
    expect(await stat(join(project, '.git')).then((value) => value.isFile())).toBe(true);
  });

  test('registers exclusions in the common directory for linked worktree checkouts', async () => {
    const base = await mkdtemp(join(tmpdir(), 'alux-worktree-'));
    temporaryDirectories.push(base);
    const project = join(base, 'worktree');
    const worktreeGitDirectory = join(base, 'main-git', 'worktrees', 'wt');
    await mkdir(worktreeGitDirectory, { recursive: true });
    await writeFile(join(worktreeGitDirectory, 'commondir'), '../..\n', 'utf8');
    await mkdir(project, { recursive: true });
    await writeFile(join(project, '.git'), `gitdir: ${worktreeGitDirectory}\n`, 'utf8');
    const repositoryRoot = await createAluxRoot();

    const result = await installProjectAssets(project, { repositoryRoot, platforms: ['grok'] });

    expect(result.excludedEntries).toEqual(['.grok/rules/grok-rule.md']);
    const commonExclude = await readFile(join(base, 'main-git', 'info', 'exclude'), 'utf8');
    expect(commonExclude).toContain('.grok/rules/grok-rule.md');
  });

  test('rejects unknown platforms and missing source trees', async () => {
    const [repositoryRoot, project] = await Promise.all([createAluxRoot(), createProject()]);

    await expect(installProjectAssets(project, { repositoryRoot, platforms: ['zcode' as never] })).rejects.toThrow('Unknown platform');
    await expect(installProjectAssets(project, { repositoryRoot: join(repositoryRoot, 'empty'), platforms: ['claude'] })).rejects.toThrow('Source directory does not exist');
  });

  test('covers every copy-distributed platform target', () => {
    expect(Object.keys(PLATFORM_ASSETS).sort()).toEqual(['claude', 'cline', 'copilot', 'grok']);
  });
});
