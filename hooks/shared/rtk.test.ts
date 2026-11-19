import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { isRewritableCommand, isSafeRtkCommand, normalizeRtkCommand, resolveOptimizedCommand } from './rtk';

function rtkAvailable(): boolean {
  try {
    const result = spawnSync('rtk', ['--version'], { stdio: 'pipe' });
    return result.status === 0;
  } catch {
    return false;
  }
}

test('recognizes Bun package manager commands as safe RTK commands', () => {
  for (const command of ['bun install', 'bun install express', 'bun add lodash@^4.0.0', 'bun remove lodash', 'bun pm ls', 'bun pm ls --all --json']) {
    expect(isSafeRtkCommand(command)).toBe(true);
  }
});

test('recognizes Bun runtime commands through the shared npm/bun pattern', () => {
  for (const command of ['bun test', 'bun test --watch', 'bun build ./src/index.ts', 'bun run test', 'bunx tsc --noEmit', 'bunx vitest run']) {
    expect(isSafeRtkCommand(command)).toBe(true);
  }
});

test('recognizes Deno runtime commands as safe RTK commands', () => {
  for (const command of ['deno test', 'deno test --allow-all', 'deno lint', 'deno lint --fix', 'deno check', 'deno check mod.ts']) {
    expect(isSafeRtkCommand(command)).toBe(true);
  }
});

test('rejects Deno and Bun commands that RTK does not filter', () => {
  for (const command of ['deno install -Af', 'deno run mod.ts', 'deno task build', 'bun start', 'bun run dev']) {
    expect(isSafeRtkCommand(command)).toBe(false);
  }
});

test('Bun test runs route to the RTK failure-only summary', () => {
  expect(isSafeRtkCommand('bun test')).toBe(true);
});

test('rewritable gate passes every single command to rtk, including commands outside the replay whitelist', () => {
  for (const command of ['git status', 'bun run dev', 'node build.js', 'kubectl get pods', 'bun test || true', 'gh pr checks 42']) {
    expect(isRewritableCommand(command)).toBe(true);
  }
});

test('rewritable gate passes sequential compounds to rtk, which rewrites them segment-wise', () => {
  for (const command of ['git status && git diff', 'ls; rm -rf dist', 'git status || echo dirty', 'ls docs\nrg -n foo docs', "rg 'foo && bar' file.txt"]) {
    expect(isRewritableCommand(command)).toBe(true);
  }
});

test('rewritable gate blocks empty, redirected, and substituted commands', () => {
  for (const command of ['', '   ', 'ls > out.txt', 'tr < in.txt', 'echo $(uname)', 'cat file `pwd`', 'git status 2> err.txt']) {
    expect(isRewritableCommand(command)).toBe(false);
  }
});

test('normalizeRtkCommand strips a trailing `|| true` pipe', () => {
  expect(normalizeRtkCommand('bun test || true')).toBe('bun test');
  expect(normalizeRtkCommand('deno lint 2>/dev/null || true')).toBe('deno lint');
});

test.skipIf(!rtkAvailable())('resolveOptimizedCommand uses the real rtk binary by default', () => {
  expect(resolveOptimizedCommand('git status')).toBe('rtk git status');
});
