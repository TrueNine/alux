import { expect, test } from 'bun:test';
import { isSafeRtkCommand, normalizeRtkCommand } from './rtk';

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

test('normalizeRtkCommand strips a trailing `|| true` pipe', () => {
  expect(normalizeRtkCommand('bun test || true')).toBe('bun test');
  expect(normalizeRtkCommand('deno lint 2>/dev/null || true')).toBe('deno lint');
});
