import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { appendGitExclude, resolveGitExcludePath } from './git-exclude.ts';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createCheckout(withGitDirectory = true): string {
  const checkout = mkdtempSync(join(tmpdir(), 'alux-git-exclude-'));
  temporaryDirectories.push(checkout);
  if (withGitDirectory) mkdirSync(join(checkout, '.git', 'info'), { recursive: true });
  return checkout;
}

describe('resolveGitExcludePath', () => {
  test('resolves .git/info/exclude for normal checkouts', () => {
    const checkout = createCheckout();

    expect(resolveGitExcludePath(checkout)).toBe(join(checkout, '.git', 'info', 'exclude'));
  });

  test('resolves the submodule git directory through a relative .git file pointer', () => {
    const base = mkdtempSync(join(tmpdir(), 'alux-git-exclude-sub-'));
    temporaryDirectories.push(base);
    const submodule = join(base, 'vendor', 'module');
    const submoduleGitDirectory = join(base, '.git', 'modules', 'vendor', 'module');
    mkdirSync(submoduleGitDirectory, { recursive: true });
    mkdirSync(submodule, { recursive: true });
    writeFileSync(join(submodule, '.git'), 'gitdir: ../../.git/modules/vendor/module\n');

    expect(resolveGitExcludePath(submodule)).toBe(join(submoduleGitDirectory, 'info', 'exclude'));
  });

  test('follows commondir for worktree-style checkouts', () => {
    const checkout = createCheckout(false);
    const linkedGitDirectory = join(checkout, 'linked');
    mkdirSync(linkedGitDirectory, { recursive: true });
    writeFileSync(join(checkout, '.git'), `gitdir: ${linkedGitDirectory}\n`);
    writeFileSync(join(linkedGitDirectory, 'commondir'), '../common.git\n');

    expect(resolveGitExcludePath(checkout)).toBe(join(checkout, 'common.git', 'info', 'exclude'));
  });

  test('returns undefined without git metadata or with an unusable pointer', () => {
    const plain = createCheckout(false);
    expect(resolveGitExcludePath(plain)).toBeUndefined();

    const broken = createCheckout(false);
    writeFileSync(join(broken, '.git'), 'gitdir: ./missing/modules/target\n');
    expect(resolveGitExcludePath(broken)).toBeUndefined();

    const malformed = createCheckout(false);
    writeFileSync(join(malformed, '.git'), 'not a git pointer\n');
    expect(resolveGitExcludePath(malformed)).toBeUndefined();
  });
});

describe('appendGitExclude', () => {
  test('appends missing entries idempotently and preserves existing content', () => {
    const checkout = createCheckout();
    writeFileSync(join(checkout, '.git', 'info', 'exclude'), 'local-only', 'utf8');

    expect(appendGitExclude(checkout, ['CLAUDE.md', 'local-only'])).toEqual(['CLAUDE.md']);
    const exclude = readFileSync(join(checkout, '.git', 'info', 'exclude'), 'utf8');
    expect(exclude).toBe('local-only\nCLAUDE.md\n');
    expect(appendGitExclude(checkout, ['CLAUDE.md'])).toEqual([]);
    expect(readFileSync(join(checkout, '.git', 'info', 'exclude'), 'utf8')).toBe('local-only\nCLAUDE.md\n');
  });

  test('returns nothing when the checkout has no git metadata', () => {
    const checkout = createCheckout(false);

    expect(appendGitExclude(checkout, ['CLAUDE.md'])).toEqual([]);
    expect(existsSync(join(checkout, '.git'))).toBe(false);
  });
});
