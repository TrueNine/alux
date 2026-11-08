import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Resolves the exclude file git actually reads for the checkout at `directory`:
 * `.git/info/exclude` for normal checkouts, the submodule's own git directory
 * (`$GIT_DIR/modules/<name>/info/exclude`) for submodule checkouts, and the
 * common directory for linked worktrees. Returns `undefined` when the checkout
 * carries no usable git metadata.
 */
export function resolveGitExcludePath(directory: string): string | undefined {
  try {
    const gitPath = join(directory, '.git');
    if (!existsSync(gitPath)) return undefined;
    if (statSync(gitPath).isDirectory()) return join(gitPath, 'info', 'exclude');

    // Submodule and worktree checkouts carry a .git FILE pointing at the real git directory.
    const pointer = /^gitdir:\s*(.+)$/im.exec(readFileSync(gitPath, 'utf8'))?.[1]?.trim();
    if (!pointer) return undefined;
    const gitDirectory = resolve(dirname(gitPath), pointer);
    if (!existsSync(gitDirectory)) return undefined;
    const commonDirectoryPath = join(gitDirectory, 'commondir');
    if (existsSync(commonDirectoryPath)) {
      const commonDirectory = readFileSync(commonDirectoryPath, 'utf8').trim();
      if (commonDirectory) {
        return join(resolve(gitDirectory, commonDirectory), 'info', 'exclude');
      }
    }
    return join(gitDirectory, 'info', 'exclude');
  } catch {
    return undefined;
  }
}

/** Appends the given entries to the checkout's resolved exclude file. Idempotent; returns the appended entries. */
export function appendGitExclude(directory: string, entries: string[]): string[] {
  const excludePath = resolveGitExcludePath(directory);
  if (!excludePath) return [];

  mkdirSync(dirname(excludePath), { recursive: true });
  const existing = existsSync(excludePath) ? readFileSync(excludePath, 'utf8') : '';
  const known = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
  const additions: string[] = [];
  for (const entry of entries) {
    if (!known.has(entry)) {
      additions.push(entry);
      known.add(entry);
    }
  }
  if (additions.length > 0) {
    const separator = existing && !existing.endsWith('\n') ? '\n' : '';
    writeFileSync(excludePath, `${existing}${separator}${additions.map((entry) => `${entry}\n`).join('')}`);
  }
  return additions;
}
