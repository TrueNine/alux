import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), 'alux-pre-commit-'));
  fixtures.push(directory);
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ scripts: { lint: 'bun check.ts lint', 'check:typescript': 'bun check.ts typescript' } }));
  writeFileSync(join(directory, 'check.ts'), 'console.log(process.argv[2]); process.exit(Number(process.env.CHECK_EXIT_CODE ?? 0));\n');
  return directory;
}

function run(script: string, cwd: string, exitCode = 0) {
  return Bun.spawnSync([process.execPath, fileURLToPath(new URL(script, import.meta.url))], {
    cwd,
    env: { ...process.env, CHECK_EXIT_CODE: String(exitCode) },
    stdout: 'pipe',
    stderr: 'pipe',
  });
}

test.each([
  ['lint.ts', 'lint', 0],
  ['typescript.ts', 'typescript', 23],
] as const)('%s runs the check in the current repository and preserves exit code', (script, output, exitCode) => {
  const result = run(script, fixture(), exitCode);
  expect(result.stdout.toString().trim()).toBe(output);
  expect(result.exitCode).toBe(exitCode);
});

test.each([false, true])('shared skill sync only runs for staged changes: %s', (staged) => {
  const directory = fixture();
  expect(Bun.spawnSync(['git', 'init', '--quiet', directory]).exitCode).toBe(0);
  mkdirSync(join(directory, 'skills', 'shared'), { recursive: true });
  mkdirSync(join(directory, 'scripts'), { recursive: true });
  writeFileSync(join(directory, 'skills', 'shared', 'example.md'), 'shared skill');
  writeFileSync(join(directory, 'scripts', 'mixining-shared-skills-to-native-skills.ts'), "console.log('synchronized'); process.exit(19);\n");
  if (staged) expect(Bun.spawnSync(['git', 'add', '--', 'skills/shared/'], { cwd: directory }).exitCode).toBe(0);

  const result = run('sync-shared-skills.ts', directory);
  expect(result.stdout.toString().trim()).toBe(staged ? 'synchronized' : '');
  expect(result.exitCode).toBe(staged ? 19 : 0);
  expect(readFileSync(join(directory, 'skills', 'shared', 'example.md'), 'utf8')).toBe('shared skill');
});
