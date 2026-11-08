#!/usr/bin/env bun

import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { appendGitExclude } from '../hooks/shared/git-exclude.ts';

export type InstallPlatform = 'claude' | 'cline' | 'copilot' | 'grok';

export type InstallAsset = { source: string; target: string };

export type InstallProjectAssetsResult = {
  copiedFiles: string[];
  excludedEntries: string[];
};

/** Copy-distributed asset trees per platform: rules for every conditional platform, plus the Cline skills fallback. */
export const PLATFORM_ASSETS: Record<InstallPlatform, InstallAsset[]> = {
  claude: [{ source: 'rules/claude-rules', target: '.claude/rules' }],
  cline: [
    { source: 'rules/cline-rules', target: '.cline/rules' },
    { source: 'skills/cline-skills', target: '.cline/skills' },
  ],
  copilot: [{ source: 'rules/copilot-rules', target: '.github/instructions' }],
  grok: [{ source: 'rules/grok-rules', target: '.grok/rules' }],
};

const PLATFORMS = Object.keys(PLATFORM_ASSETS) as InstallPlatform[];

function toPosix(path: string): string {
  return path.split('\\').join('/');
}

async function collectFiles(path: string): Promise<string[]> {
  if (!(await stat(path)).isDirectory()) return [path];
  const files: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    files.push(...(await collectFiles(join(path, entry.name))));
  }
  return files;
}

/** Standalone clones (a `.git` directory) are untracked noise; submodule or worktree checkouts (a `.git` file) are tracked on purpose. */
async function isStandaloneClone(repositoryRoot: string): Promise<boolean> {
  const gitStat = await stat(join(repositoryRoot, '.git')).catch(() => undefined);
  return gitStat?.isDirectory() ?? false;
}

/** Installs the selected platforms' copy-distributed assets into a project and registers them as git-excluded. */
export async function installProjectAssets(projectDirectory: string, options: { platforms?: InstallPlatform[]; repositoryRoot?: string } = {}): Promise<InstallProjectAssetsResult> {
  const repositoryRoot = resolve(options.repositoryRoot ?? dirname(import.meta.dir));
  const projectRoot = resolve(projectDirectory);
  const platforms = options.platforms?.length ? options.platforms : [...PLATFORMS];
  for (const platform of platforms) {
    if (!PLATFORM_ASSETS[platform]) throw new Error(`Unknown platform: ${platform}`);
  }

  const copiedFiles: string[] = [];
  for (const platform of platforms) {
    for (const asset of PLATFORM_ASSETS[platform]) {
      const sourceRoot = join(repositoryRoot, asset.source);
      const entries = await readdir(sourceRoot, { withFileTypes: true }).catch(() => undefined);
      if (!entries) throw new Error(`Source directory does not exist: ${sourceRoot} (run sync:skills / sync:rules first)`);
      for (const entry of entries) {
        const targetPath = join(projectRoot, asset.target, entry.name);
        await mkdir(dirname(targetPath), { recursive: true });
        await cp(join(sourceRoot, entry.name), targetPath, { recursive: true, force: true });
        for (const file of await collectFiles(targetPath)) {
          copiedFiles.push(toPosix(relative(projectRoot, file)));
        }
      }
    }
  }

  copiedFiles.sort((left, right) => left.localeCompare(right));
  const entries = [...copiedFiles];
  const clonePath = toPosix(relative(projectRoot, repositoryRoot));
  const cloneInsideProject = Boolean(clonePath) && !clonePath.startsWith('..') && clonePath !== '.' && !isAbsolute(clonePath);
  if (cloneInsideProject && (await isStandaloneClone(repositoryRoot))) entries.push(`${clonePath}/`);
  const excludedEntries = appendGitExclude(projectRoot, entries);
  return { copiedFiles, excludedEntries };
}

function usage(): never {
  console.error('Usage: install-project-assets.ts <project-dir> [--platform <claude|cline|copilot|grok>]...');
  process.exit(2);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const platforms: InstallPlatform[] = [];
  let projectDirectory: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--platform') {
      const value = args[++index];
      if (!value) usage();
      platforms.push(value as InstallPlatform);
      continue;
    }
    if (argument?.startsWith('-')) usage();
    projectDirectory = argument;
  }
  if (!projectDirectory) usage();

  try {
    const result = await installProjectAssets(projectDirectory, { platforms });
    console.log(`Installed ${result.copiedFiles.length} file(s); registered ${result.excludedEntries.length} .git/info/exclude entr(ies).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
