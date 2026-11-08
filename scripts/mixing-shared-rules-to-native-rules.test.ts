import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { mixSharedRules, parseSharedRule, renderClaudeRule, renderClineRule, renderCopilotRule, renderCursorRule, renderGrokRule } from './mixing-shared-rules-to-native-rules.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

const globRule = `---
description: Scoped rule
globs:
  - "**/*.ts"
  - "**/*.tsx"
---

Scoped body.
`;

const alwaysRule = `---
description: Unconditional rule
---

Unconditional body.
`;

async function createRulesRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'alux-rules-'));
  temporaryDirectories.push(root);
  await mkdir(join(root, 'shared'), { recursive: true });
  for (const target of ['cursor-rules', 'claude-rules', 'cline-rules', 'copilot-rules', 'grok-rules']) {
    await mkdir(join(root, target), { recursive: true });
  }
  await writeFile(join(root, 'shared', 'scoped-rule.md'), globRule);
  await writeFile(join(root, 'shared', 'unconditional-rule.md'), alwaysRule);
  return root;
}

describe('parseSharedRule', () => {
  test('reads description, block globs, and body', () => {
    const rule = parseSharedRule('scoped-rule', globRule);
    expect(rule.description).toBe('Scoped rule');
    expect(rule.globs).toEqual(['**/*.ts', '**/*.tsx']);
    expect(rule.body).toBe('Scoped body.\n');
  });

  test('reads inline globs and unquoted scalars', () => {
    const rule = parseSharedRule('inline', '---\ndescription: Inline\nglobs: src/**/*.md\n---\nbody');
    expect(rule.description).toBe('Inline');
    expect(rule.globs).toEqual(['src/**/*.md']);
    expect(rule.body).toBe('body');
  });

  test('rejects rules without frontmatter or description', () => {
    expect(() => parseSharedRule('bare', 'no frontmatter')).toThrow('frontmatter');
    expect(() => parseSharedRule('undescribed', '---\nglobs: "**/*.md"\n---\nbody')).toThrow('description');
  });
});

describe('renderers', () => {
  const rule = parseSharedRule('scoped-rule', globRule);
  const unconditional = parseSharedRule('unconditional-rule', alwaysRule);

  test('cursor keeps globs and falls back to alwaysApply', () => {
    expect(renderCursorRule(rule)).toBe('---\ndescription: Scoped rule\nglobs:\n  - **/*.ts\n  - **/*.tsx\n---\n\nScoped body.\n');
    expect(renderCursorRule(unconditional)).toBe('---\ndescription: Unconditional rule\nalwaysApply: true\n---\n\nUnconditional body.\n');
  });

  test('claude converts globs into paths and omits paths when unconditional', () => {
    expect(renderClaudeRule(rule)).toBe('---\ndescription: Scoped rule\npaths:\n  - **/*.ts\n  - **/*.tsx\n---\n\nScoped body.\n');
    expect(renderClaudeRule(unconditional)).toBe('---\ndescription: Unconditional rule\n---\n\nUnconditional body.\n');
  });

  test('grok ships the body without frontmatter', () => {
    expect(renderGrokRule(rule)).toBe('Scoped body.\n');
    expect(renderGrokRule(unconditional)).toBe('Unconditional body.\n');
  });

  test('cline reuses the Claude paths frontmatter', () => {
    expect(renderClineRule(rule)).toBe(renderClaudeRule(rule));
    expect(renderClineRule(unconditional)).toBe(renderClaudeRule(unconditional));
  });

  test('copilot renders applyTo as a comma-separated quoted string', () => {
    expect(renderCopilotRule(rule)).toBe(`---\ndescription: Scoped rule\napplyTo: '**/*.ts, **/*.tsx'\n---\n\nScoped body.\n`);
    expect(renderCopilotRule(unconditional)).toBe(`---\ndescription: Unconditional rule\napplyTo: '**'\n---\n\nUnconditional body.\n`);
  });
});

describe('mixSharedRules', () => {
  test('exposes a sync:rules package command', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.['sync:rules']).toBe('bun scripts/mixing-shared-rules-to-native-rules.ts');
  });

  test('writes transformed rules into every native rules directory', async () => {
    const root = await createRulesRoot();

    const result = await mixSharedRules(root);

    expect(result).toEqual({
      copiedRules: ['scoped-rule', 'unconditional-rule'],
      targetDirectories: ['claude-rules', 'cline-rules', 'copilot-rules', 'cursor-rules', 'grok-rules'],
    });
    expect(await readFile(join(root, 'cursor-rules', 'scoped-rule.mdc'), 'utf8')).toContain('globs:');
    expect(await readFile(join(root, 'cursor-rules', 'unconditional-rule.mdc'), 'utf8')).toContain('alwaysApply: true');
    expect(await readFile(join(root, 'claude-rules', 'scoped-rule.md'), 'utf8')).toContain('paths:');
    expect(await readFile(join(root, 'claude-rules', 'unconditional-rule.md'), 'utf8')).not.toContain('paths:');
    expect(await readFile(join(root, 'cline-rules', 'scoped-rule.md'), 'utf8')).toContain('paths:');
    expect(await readFile(join(root, 'copilot-rules', 'scoped-rule.instructions.md'), 'utf8')).toContain(`applyTo: '**/*.ts, **/*.tsx'`);
    expect(await readFile(join(root, 'copilot-rules', 'unconditional-rule.instructions.md'), 'utf8')).toContain(`applyTo: '**'`);
    expect(await readFile(join(root, 'grok-rules', 'scoped-rule.md'), 'utf8')).toBe('Scoped body.\n');
  });

  test('rejects a missing shared root and unknown native directories', async () => {
    const root = await createRulesRoot();
    await mkdir(join(root, 'unknown-rules'), { recursive: true });

    await expect(mixSharedRules(join(root, 'missing'))).rejects.toThrow('Shared rules directory does not exist');
    await expect(mixSharedRules(root)).rejects.toThrow('No rule renderer registered');
  });
});
